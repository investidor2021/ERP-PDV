from sqlalchemy.orm import Session
from app.models.models import (
    Produto, Lote, Movimentacao, NotaFiscal, ItemNota, 
    AuditoriaLog, Vendedor, Cliente, Venda, VendaItem, Pagamento, ContaReceber, Comissao,
    Servico
)
from app.services.xml_service import XMLService
from datetime import datetime, date, timedelta

class PEPSService:
    @staticmethod
    def log_auditoria(db: Session, modulo: str, acao: str, detalhes: str):
        log = AuditoriaLog(
            data=datetime.now(),
            modulo=modulo,
            acao=acao,
            detalhes=detalhes
        )
        db.add(log)
        db.commit()

    @classmethod
    def importar_nfe(cls, db: Session, xml_content: bytes, usuario: str = "admin") -> dict:
        """
        Parses and imports an XML NF-e.
        If a product code/GTIN/description is found, links it, otherwise registers a new one.
        Creates lots and increments physical stock.
        """
        parsed = XMLService.parse_nfe(xml_content)
        chave = parsed["chave"]
        numero = parsed["numero"]
        data_emissao = parsed["data_emissao"]
        fornecedor_cnpj = parsed["fornecedor_cnpj"]
        fornecedor_nome = parsed["fornecedor_nome"]
        itens = parsed["itens"]

        # Validate check digit
        if not XMLService.validar_chave_nfe(chave):
            raise ValueError(f"Chave da NF-e {chave} possui dígito verificador inválido.")

        # Check if already exists
        existing_nf = db.query(NotaFiscal).filter(NotaFiscal.chave == chave).first()
        if existing_nf:
            raise ValueError(f"NF-e com a chave {chave} já foi importada anteriormente (NF nº {numero}).")

        # Create NF-e header
        nf = NotaFiscal(
            numero=numero,
            chave=chave,
            data_emissao=data_emissao,
            fornecedor_cnpj=fornecedor_cnpj,
            fornecedor_nome=fornecedor_nome
        )
        db.add(nf)
        db.flush() # Populate nf.id

        importados = 0
        cadastrados_novos = 0

        for item in itens:
            codigo_fornecedor = item["codigo_fornecedor"]
            codigo_barras = item["codigo_barras"]
            descricao = item["descricao"]
            unidade = item["unidade"]
            ncm = item["ncm"]
            quantidade = item["quantidade"]
            valor_unitario = item["valor_unitario"]
            valor_total = item["valor_total"]

            # Match product: barcode -> code -> description + NCM
            produto = None
            if codigo_barras:
                produto = db.query(Produto).filter(Produto.codigo_barras == codigo_barras).first()
            if not produto:
                produto = db.query(Produto).filter(Produto.codigo == codigo_fornecedor).first()
            if not produto:
                produto = db.query(Produto).filter(
                    Produto.descricao == descricao, 
                    Produto.ncm == ncm
                ).first()

            # Create if missing
            if not produto:
                produto = Produto(
                    codigo=codigo_fornecedor,
                    codigo_fornecedor=codigo_fornecedor,
                    codigo_barras=codigo_barras,
                    descricao=descricao,
                    unidade=unidade,
                    ncm=ncm,
                    estoque_atual=0,
                    preco_venda=valor_unitario * 1.5 # default markup 50%
                )
                db.add(produto)
                db.flush()
                cadastrados_novos += 1
                cls.log_auditoria(db, "PRODUTOS", "CADASTRO_AUTOMATICO", f"Produto {descricao} (SKU: {codigo_fornecedor}) criado via XML.")

            # Create ItemNota entry
            item_nota = ItemNota(
                nota_id=nf.id,
                produto_id=produto.id,
                quantidade=quantidade,
                valor_unitario=valor_unitario,
                valor_total=valor_total,
                icms=item["icms"],
                ipi=item["ipi"],
                pis=item["pis"],
                cofins=item["cofins"]
            )
            db.add(item_nota)

            # Create PEPS Lot
            lote = Lote(
                produto_id=produto.id,
                nota_id=nf.id,
                data_entrada=data_emissao,
                quantidade_original=quantidade,
                quantidade_saldo=quantidade,
                custo_unitario=valor_unitario
            )
            db.add(lote)

            # Increment stock
            produto.estoque_atual += quantidade

            # Log movement
            mov = Movimentacao(
                produto_id=produto.id,
                tipo="ENTRADA",
                quantidade=quantidade,
                custo=valor_unitario,
                data_movimento=data_emissao,
                usuario=usuario,
                origem=f"NF-e {numero}",
                observacao=f"Importado de NF-e {numero} emitida por {fornecedor_nome}"
            )
            db.add(mov)
            importados += 1

        db.commit()
        cls.log_auditoria(db, "ESTOQUE", "IMPORTAR_XML", f"Nota Fiscal nº {numero} (Fornecedor: {fornecedor_nome}) importada com sucesso ({importados} itens).")

        return {
            "id": nf.id,
            "numero": numero,
            "fornecedor": fornecedor_nome,
            "itens_processados": importados,
            "novos_produtos": cadastrados_novos
        }

    @classmethod
    def registrar_entrada_manual(cls, db: Session, produto_id: int, quantidade: int, custo_unitario: float, data_entrada: datetime, usuario: str, observacao: str) -> None:
        """Manually registers product entry, creating a new PEPS lot and updates stock."""
        if quantidade <= 0:
            raise ValueError("A quantidade deve ser maior que zero.")
        if custo_unitario < 0:
            raise ValueError("O custo unitário não pode ser negativo.")

        produto = db.query(Produto).filter(Produto.id == produto_id).first()
        if not produto:
            raise ValueError("Produto não encontrado.")

        # Create Lot
        lote = Lote(
            produto_id=produto_id,
            nota_id=None,
            data_entrada=data_entrada,
            quantidade_original=quantidade,
            quantidade_saldo=quantidade,
            custo_unitario=custo_unitario
        )
        db.add(lote)

        # Update stock
        produto.estoque_atual += quantidade

        # Log movement
        mov = Movimentacao(
            produto_id=produto_id,
            tipo="ENTRADA",
            quantidade=quantidade,
            custo=custo_unitario,
            data_movimento=data_entrada,
            usuario=usuario,
            origem="Ajuste Manual",
            observacao=observacao
        )
        db.add(mov)
        db.commit()

        cls.log_auditoria(db, "ESTOQUE", "ENTRADA_MANUAL", f"Entrada manual de {quantidade} un para {produto.descricao} (Custo: R$ {custo_unitario:.2f}).")

    @classmethod
    def registrar_saida_peps_lotes(cls, db: Session, produto_id: int, quantidade: int) -> float:
        """
        Deducts stock from active lots using PEPS (FIFO).
        Returns the total cost calculated. Does NOT commit yet so it can be part of broader sales transactions.
        """
        # Fetch available lots (oldest first)
        lotes = db.query(Lote).filter(
            Lote.produto_id == produto_id, 
            Lote.quantidade_saldo > 0
        ).order_by(Lote.data_entrada.asc(), Lote.id.asc()).all()

        custo_total = 0.0
        restante = quantidade

        for lote in lotes:
            if restante == 0:
                break
            
            if lote.quantidade_saldo >= restante:
                lote.quantidade_saldo -= restante
                custo_total += restante * lote.custo_unitario
                restante = 0
            else:
                custo_total += lote.quantidade_saldo * lote.custo_unitario
                restante -= lote.quantidade_saldo
                lote.quantidade_saldo = 0

        if restante > 0:
            raise ValueError("Saldo físico nos lotes PEPS é insuficiente para a retirada.")

        return custo_total

    @classmethod
    def processar_venda(cls, db: Session, venda_data: dict, usuario: str = "admin") -> Venda:
        """
        Registers a complete sales transaction (POS).
        Performs PEPS deductions on products, creates comissoes, pagamentos, and contas_receber records.
        """
        cliente_id = venda_data["cliente_id"]
        vendedor_id = venda_data.get("vendedor_id")
        observacoes = venda_data.get("observacoes", "")
        itens = venda_data["itens"] # List of dicts (produto_id/servico_id, quantidade, valor_unitario, desconto)
        pagamentos = venda_data["pagamentos"] # List of dicts (forma_pagamento, valor, data_vencimento_manual)
        
        frete = venda_data.get("frete", 0.0)
        acrescimo = venda_data.get("acrescimo", 0.0)
        desconto_total = venda_data.get("desconto", 0.0)

        # Generate unique sales number
        hoje = datetime.now().strftime("%Y%m%d")
        last_venda = db.query(Venda).filter(Venda.numero_venda.like(f"VD{hoje}%")).order_by(Venda.id.desc()).first()
        if last_venda:
            seq = int(last_venda.numero_venda[-4:]) + 1
        else:
            seq = 1
        numero_venda = f"VD{hoje}{seq:04d}"

        # Setup header
        venda = Venda(
            numero_venda=numero_venda,
            data_venda=datetime.now(),
            cliente_id=cliente_id,
            vendedor_id=vendedor_id,
            observacoes=observacoes,
            frete=frete,
            acrescimo=acrescimo,
            desconto=desconto_total,
            subtotal=0.0,
            total_final=0.0
        )
        db.add(venda)
        db.flush()

        venda_subtotal = 0.0
        venda_custo_peps = 0.0

        # Process Items
        for item in itens:
            tipo_item = item["tipo_item"]
            quantidade = item["quantidade"]
            valor_unitario = item["valor_unitario"]
            desc_item = item.get("desconto", 0.0)
            
            tot_item = (valor_unitario - desc_item) * quantidade
            venda_subtotal += tot_item
            
            custo_peps_tot = 0.0
            
            if tipo_item == "PRODUTO":
                prod_id = item["produto_id"]
                produto = db.query(Produto).filter(Produto.id == prod_id).first()
                if not produto:
                    raise ValueError(f"Produto ID {prod_id} não encontrado.")
                if produto.estoque_atual < quantidade:
                    raise ValueError(f"Estoque insuficiente para '{produto.descricao}'. Disponível: {produto.estoque_atual}, solicitado: {quantidade}.")
                
                # Consume lots FIFO
                custo_peps_tot = cls.registrar_saida_peps_lotes(db, prod_id, quantidade)
                venda_custo_peps += custo_peps_tot
                
                # Decrement physical stock
                produto.estoque_atual -= quantidade

                # Log movement
                mov = Movimentacao(
                    produto_id=prod_id,
                    tipo="SAIDA",
                    quantidade=quantidade,
                    custo=custo_peps_tot / quantidade if quantidade > 0 else 0,
                    preco_venda=valor_unitario - desc_item,
                    data_movimento=venda.data_venda,
                    usuario=usuario,
                    origem=f"Venda {numero_venda}",
                    observacao=observacoes
                )
                db.add(mov)
                
                v_item = VendaItem(
                    venda_id=venda.id,
                    produto_id=prod_id,
                    tipo_item="PRODUTO",
                    quantidade=quantidade,
                    valor_unitario=valor_unitario,
                    desconto=desc_item,
                    total=tot_item,
                    custo_peps_total=custo_peps_tot
                )
            else: # SERVICE
                serv_id = item["servico_id"]
                servico = db.query(Servico).filter(Servico.id == serv_id).first()
                if not servico:
                    raise ValueError(f"Serviço ID {serv_id} não encontrado.")
                
                v_item = VendaItem(
                    venda_id=venda.id,
                    servico_id=serv_id,
                    tipo_item="SERVICO",
                    quantidade=quantidade,
                    valor_unitario=valor_unitario,
                    desconto=desc_item,
                    total=tot_item,
                    custo_peps_total=0.0 # No PEPS cost for services
                )
            
            db.add(v_item)

        # Calculate final total
        venda.subtotal = venda_subtotal
        venda.total_final = venda_subtotal - desconto_total + frete + acrescimo
        db.flush()

        # Payments & Accounts Receivable
        total_pago_imediato = 0.0
        
        for pag in pagamentos:
            forma = pag["forma_pagamento"]
            valor_p = pag["valor"]
            
            # Create payment detail
            pag_obj = Pagamento(venda_id=venda.id, forma_pagamento=forma, valor=valor_p)
            db.add(pag_obj)

            # Determine financial integration
            # Immediates: Dinheiro, PIX, Cartão Débito.
            # Deferreds: Boleto, Transferência, Cartão Crédito, Crediário.
            if forma in ["Dinheiro", "PIX", "Cartão Débito"]:
                total_pago_imediato += valor_p
            else:
                # Generate receivable invoices (Contas a Receber)
                parcelas_count = pag.get("parcelas", 1) or 1
                taxa_perc = pag.get("taxa_percentual", 0.0) or 0.0
                
                # Split value into installments
                valor_parcela = round(valor_p / parcelas_count, 2)
                valor_restante = valor_p
                
                due_date_str = pag.get("data_vencimento")
                if due_date_str:
                    base_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
                else:
                    base_date = datetime.now().date()
                
                for i in range(1, parcelas_count + 1):
                    # Rounding adjustment on the last installment
                    if i == parcelas_count:
                        val_inst = round(valor_restante, 2)
                    else:
                        val_inst = valor_parcela
                        valor_restante -= val_inst
                        
                    # Calculate due date
                    if due_date_str:
                        # Spacing 30 days starting from the manual first installment date
                        due_date = base_date + timedelta(days=30 * (i - 1))
                    else:
                        # Default spacing (D+30, D+60, D+90...)
                        due_date = base_date + timedelta(days=30 * i)
                        
                    # Calculate card fee / crediário fee
                    taxa_val = round(val_inst * (taxa_perc / 100), 2)
                    val_liq = round(val_inst - taxa_val, 2)
                    
                    recebivel = ContaReceber(
                        venda_id=venda.id,
                        cliente_id=cliente_id,
                        valor=val_inst,
                        data_vencimento=due_date,
                        situacao="ABERTO",
                        saldo_devedor=val_inst,
                        taxa_valor=taxa_val,
                        valor_liquido=val_liq
                    )
                    db.add(recebivel)

        # Commissions
        if vendedor_id:
            vendedor = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
            if vendedor and vendedor.comissao_percentual > 0:
                val_comissao = venda.total_final * (vendedor.comissao_percentual / 100)
                comissao = Comissao(
                    venda_id=venda.id,
                    vendedor_id=vendedor_id,
                    valor_venda=venda.total_final,
                    percentual_comissao=vendedor.comissao_percentual,
                    valor_comissao=val_comissao,
                    situacao="PENDENTE"
                )
                db.add(comissao)

        db.commit()
        cls.log_auditoria(db, "VENDAS", "FECHAMENTO_VENDA", f"Venda nº {numero_venda} fechada com sucesso. Total: R$ {venda.total_final:.2f}.")
        return venda

    @staticmethod
    def obter_custo_medio_historico(db: Session, produto_id: int) -> float:
        """Weighted average cost of all purchases for a product."""
        row = db.query(
            Lote.quantidade_original, Lote.custo_unitario
        ).filter(Lote.produto_id == produto_id).all()
        
        tot_val = sum(r[0] * r[1] for r in row)
        tot_qtd = sum(r[0] for r in row)
        
        if tot_qtd > 0:
            return round(tot_val / tot_qtd, 2)
        return 0.0

    @staticmethod
    def obter_custo_medio_atual(db: Session, produto_id: int) -> float:
        """Weighted average cost of the active remaining stock."""
        row = db.query(
            Lote.quantidade_saldo, Lote.custo_unitario
        ).filter(Lote.produto_id == produto_id, Lote.quantidade_saldo > 0).all()
        
        tot_val = sum(r[0] * r[1] for r in row)
        tot_qtd = sum(r[0] for r in row)
        
        if tot_qtd > 0:
            return round(tot_val / tot_qtd, 2)
        return 0.0
