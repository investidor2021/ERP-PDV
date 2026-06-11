import sys
import os
from datetime import datetime, timedelta

# Add backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.models.models import Produto, Lote, Cliente, Vendedor, Servico
from app.services.peps_service import PEPSService

def seed_rich_data():
    print("Iniciando populacao de dados ficticios (Seeding)...")
    
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Clear existing data to start fresh as requested ("do zero")
        db.query(Lote).delete()
        db.query(Produto).delete()
        db.query(Cliente).delete()
        db.query(Vendedor).delete()
        db.query(Servico).delete()
        db.commit()
        print("Banco de dados limpo para insercao do zero.")

        # 1. Clientes
        c1 = Cliente(
            codigo="CLI001",
            nome_razao="Consumidor Final",
            cpf_cnpj="99999999999",
            inscricao_estadual="",
            telefone="11999999999",
            email="consumidor@final.com",
            cidade="São Paulo",
            estado="SP",
            observacoes="Cliente padrão para vendas rápidas de balcão"
        )
        c2 = Cliente(
            codigo="CLI002",
            nome_razao="Carlos Silva Ltda",
            cpf_cnpj="12345678000190",
            inscricao_estadual="111222333",
            telefone="1133445566",
            whatsapp="11988776655",
            email="financeiro@carlossilva.com.br",
            logradouro="Avenida Paulista",
            numero="1000",
            bairro="Bela Vista",
            cidade="São Paulo",
            estado="SP",
            cep="01310100",
            observacoes="Cliente PJ recorrente, faturamento quinzenal"
        )
        c3 = Cliente(
            codigo="CLI003",
            nome_razao="Maria Oliveira de Souza",
            cpf_cnpj="45678912300",
            inscricao_estadual="",
            telefone="2122334455",
            whatsapp="21977665544",
            email="maria.souza@gmail.com",
            logradouro="Rua Copacabana",
            numero="450",
            complemento="Apt 302",
            bairro="Copacabana",
            cidade="Rio de Janeiro",
            estado="RJ",
            cep="22020002"
        )
        db.add_all([c1, c2, c3])
        db.commit()
        print("Clientes cadastrados.")

        # 2. Vendedores
        v1 = Vendedor(nome="Vendedor Interno", comissao_percentual=5.0)
        v2 = Vendedor(nome="Mariana Souza (Vendas)", comissao_percentual=3.5)
        v3 = Vendedor(nome="Roberto Cruz (Digital)", comissao_percentual=4.0)
        db.add_all([v1, v2, v3])
        db.commit()
        print("Vendedores cadastrados.")

        # 3. Serviços
        s1 = Servico(codigo="SRV001", descricao="Instalação Padrão", valor_padrao=150.0, categoria="Instalação")
        s2 = Servico(codigo="SRV002", descricao="Manutenção Preventiva", valor_padrao=200.0, categoria="Manutenção")
        s3 = Servico(codigo="SRV003", descricao="Frete de Entrega", valor_padrao=50.0, categoria="Frete")
        db.add_all([s1, s2, s3])
        db.commit()
        print("Serviços cadastrados.")

        # 4. Produtos
        p1 = Produto(codigo="GALAXY-S24", codigo_fornecedor="GALAXY-S24", codigo_barras="7891234567890", descricao="Smartphone Samsung Galaxy S24 Ultra 512GB", unidade="UN", ncm="85171231", estoque_atual=0, preco_venda=5999.0)
        p2 = Produto(codigo="DELL-INS-15", codigo_fornecedor="DELL-INS-15", codigo_barras="7891234567891", descricao="Notebook Dell Inspiron 15 Intel i7 16GB", unidade="UN", ncm="84713012", estoque_atual=0, preco_venda=4899.0)
        p3 = Produto(codigo="JBL-T510", codigo_fornecedor="JBL-T510", codigo_barras="7891234567892", descricao="Fone de Ouvido Bluetooth JBL Tune 510BT", unidade="UN", ncm="85183000", estoque_atual=0, preco_venda=299.0)
        p4 = Produto(codigo="HDMI-4K", codigo_fornecedor="HDMI-4K", codigo_barras="7891234567893", descricao="Cabo HDMI 2.0 Ultra HD 4K 2 Metros", unidade="UN", ncm="85444200", estoque_atual=0, preco_venda=39.90)
        p5 = Produto(codigo="LG-MON-29", codigo_fornecedor="LG-MON-29", codigo_barras="7891234567894", descricao="Monitor LG 29 Ultrawide IPS Full HD", unidade="UN", ncm="85285220", estoque_atual=0, preco_venda=1199.0)
        db.add_all([p1, p2, p3, p4, p5])
        db.commit()
        print("Produtos cadastrados.")

        # 5. Lotes PEPS (FIFO)
        # Galaxy S24
        # Lote 1: 10 un @ R$ 3800.00 (Entrada há 15 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p1.id,
            quantidade=10,
            custo_unitario=3800.0,
            data_entrada=datetime.now() - timedelta(days=15),
            usuario="admin",
            observacao="Lote 1: Compra lote promocional"
        )
        # Lote 2: 5 un @ R$ 4100.00 (Entrada há 2 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p1.id,
            quantidade=5,
            custo_unitario=4100.0,
            data_entrada=datetime.now() - timedelta(days=2),
            usuario="admin",
            observacao="Lote 2: Reposição de estoque"
        )

        # Notebook Dell
        # Lote 1: 5 un @ R$ 3200.00 (Entrada há 20 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p2.id,
            quantidade=5,
            custo_unitario=3200.0,
            data_entrada=datetime.now() - timedelta(days=20),
            usuario="admin",
            observacao="Lote 1 Dell: Compra distribuidor SP"
        )
        # Lote 2: 3 un @ R$ 3350.00 (Entrada há 5 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p2.id,
            quantidade=3,
            custo_unitario=3350.0,
            data_entrada=datetime.now() - timedelta(days=5),
            usuario="admin",
            observacao="Lote 2 Dell: Reposição de urgência"
        )

        # Fone JBL
        # Lote 1: 50 un @ R$ 170.00 (Entrada há 10 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p3.id,
            quantidade=50,
            custo_unitario=170.0,
            data_entrada=datetime.now() - timedelta(days=10),
            usuario="admin",
            observacao="Lote 1 JBL: Carga importada"
        )

        # Cabo HDMI
        # Lote 1: 100 un @ R$ 12.00 (Entrada há 30 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p4.id,
            quantidade=100,
            custo_unitario=12.0,
            data_entrada=datetime.now() - timedelta(days=30),
            usuario="admin",
            observacao="Lote 1 HDMI: Bobina atacado"
        )

        # Monitor LG
        # Lote 1: 8 un @ R$ 820.00 (Entrada há 8 dias)
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p5.id,
            quantidade=8,
            custo_unitario=820.0,
            data_entrada=datetime.now() - timedelta(days=8),
            usuario="admin",
            observacao="Lote 1 LG: Compra distribuidor PR"
        )
        print("Lotes PEPS e estoques físicos criados no banco.")

        # 6. Simulate some Sales to populate dashboards, margins and accounts receivable
        # Venda 1: Carlos Silva buys 2 Galaxy S24 (should consume from Lote 1 @ R$ 3800) + 1 Instalação Padrão (Service)
        # Split payment: PIX (R$ 500) + Boleto (R$ 11.648)
        venda_1 = {
            "cliente_id": c2.id,
            "vendedor_id": v2.id, # Mariana Souza
            "observacoes": "Pedido corporativo de smartphone + configuração inicial",
            "itens": [
                {
                    "tipo_item": "PRODUTO",
                    "produto_id": p1.id,
                    "quantidade": 2,
                    "valor_unitario": 5999.0,
                    "desconto": 0.0
                },
                {
                    "tipo_item": "SERVICO",
                    "servico_id": s1.id,
                    "quantidade": 1,
                    "valor_unitario": 150.0,
                    "desconto": 0.0
                }
            ],
            "pagamentos": [
                {"forma_pagamento": "PIX", "valor": 500.0},
                {"forma_pagamento": "Boleto", "valor": 11648.0, "data_vencimento": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")}
            ],
            "frete": 0.0,
            "acrescimo": 0.0,
            "desconto": 0.0
        }
        PEPSService.processar_venda(db, venda_1, usuario="mariana")

        # Venda 2: Maria Oliveira buys 1 Notebook Dell (consumes from Lote 1 Dell @ R$ 3200) + 3 Fones JBL (consumes from Lote 1 JBL @ R$ 170)
        # Sells Dell at R$ 4700 (discount R$ 199) and JBL at R$ 299 each
        # Paid via Cartão Crédito (D+30)
        venda_2 = {
            "cliente_id": c3.id,
            "vendedor_id": v1.id, # Vendedor Interno
            "observacoes": "Compra de notebook para estudos + fone bluetooth",
            "itens": [
                {
                    "tipo_item": "PRODUTO",
                    "produto_id": p2.id,
                    "quantidade": 1,
                    "valor_unitario": 4899.0,
                    "desconto": 199.0 # Dell sold at R$ 4700
                },
                {
                    "tipo_item": "PRODUTO",
                    "produto_id": p3.id,
                    "quantidade": 3,
                    "valor_unitario": 299.0,
                    "desconto": 0.0
                }
            ],
            "pagamentos": [
                {"forma_pagamento": "Cartão Crédito", "valor": 5597.0, "data_vencimento": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")}
            ],
            "frete": 0.0,
            "acrescimo": 0.0,
            "desconto": 0.0
        }
        PEPSService.processar_venda(db, venda_2, usuario="admin")

        # Venda 3: Consumidor Final buys 20 Cabos HDMI (consumes from Lote 1 @ R$ 12) + Frete de entrega (Service)
        # Sells at R$ 39.90
        # Paid 100% in Dinheiro (immediate cash)
        venda_3 = {
            "cliente_id": c1.id,
            "vendedor_id": v3.id, # Roberto Cruz
            "observacoes": "Venda de balcão rápida",
            "itens": [
                {
                    "tipo_item": "PRODUTO",
                    "produto_id": p4.id,
                    "quantidade": 20,
                    "valor_unitario": 39.90,
                    "desconto": 0.0
                },
                {
                    "tipo_item": "SERVICO",
                    "servico_id": s3.id,
                    "quantidade": 1,
                    "valor_unitario": 50.0,
                    "desconto": 0.0
                }
            ],
            "pagamentos": [
                {"forma_pagamento": "Dinheiro", "valor": 848.0}
            ],
            "frete": 0.0,
            "acrescimo": 0.0,
            "desconto": 0.0
        }
        PEPSService.processar_venda(db, venda_3, usuario="admin")

        print("Vendas fictícias simuladas e faturadas com sucesso!")
        print("=== PROCESSO DE SEED REALIZADO COM SUCESSO! ===")
        
    except Exception as e:
        db.rollback()
        print(f"Erro ao popular banco de dados: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_rich_data()
