import sys
import os

# Add backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, Produto, Lote, Cliente, Vendedor, Venda, VendaItem, ContaReceber, Pagamento
from app.services.peps_service import PEPSService
from datetime import datetime

def test_erp_peps_flow():
    print("Iniciando testes de integracao do ERP PEPS (SQLAlchemy)...")
    
    test_db = "erp_peps_test.db"
    if os.path.exists(test_db):
        os.remove(test_db)
        
    engine = create_engine(f"sqlite:///{test_db}")
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = Session()
    try:
        # 1. Create client and seller
        c = Cliente(codigo="CLI-T", nome_razao="Cliente Teste", cpf_cnpj="12345678900")
        v = Vendedor(nome="Vendedor Teste", comissao_percentual=10.0)
        db.add_all([c, v])
        db.commit()
        print("1. Cliente e Vendedor criados no banco.")

        # 2. Create product
        p = Produto(codigo="PROD-T", descricao="Produto de Teste", estoque_atual=0, preco_venda=15.0)
        db.add(p)
        db.commit()
        print("2. Produto de teste criado no banco.")

        # 3. Add Lots (ENTRADA)
        # Lot 1: 100 un @ R$ 10.0
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p.id,
            quantidade=100,
            custo_unitario=10.0,
            data_entrada=datetime(2026, 6, 1, 10, 0, 0),
            usuario="test_runner",
            observacao="Lote 1"
        )
        # Lot 2: 50 un @ R$ 12.0
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=p.id,
            quantidade=50,
            custo_unitario=12.0,
            data_entrada=datetime(2026, 6, 2, 10, 0, 0),
            usuario="test_runner",
            observacao="Lote 2"
        )
        
        # Verify stock increment
        db.refresh(p)
        assert p.estoque_atual == 150, f"Estoque incorreto: {p.estoque_atual}"
        print(f"3. Entradas registradas. Estoque atual: {p.estoque_atual} un (OK)")

        # 4. Sell 120 un @ R$ 15.0 (PEPS consumptions: 100*10 + 20*12 = 1240.0)
        # Deferred Payment: Boleto
        venda_payload = {
            "cliente_id": c.id,
            "vendedor_id": v.id,
            "observacoes": "Venda de Teste PEPS",
            "itens": [{
                "tipo_item": "PRODUTO",
                "produto_id": p.id,
                "quantidade": 120,
                "valor_unitario": 15.0,
                "desconto": 0.0
            }],
            "pagamentos": [{
                "forma_pagamento": "Boleto",
                "valor": 1800.0, # 120 * 15 = 1800
                "data_vencimento": "2026-07-10"
            }],
            "frete": 0.0,
            "acrescimo": 0.0,
            "desconto": 0.0
        }
        
        venda = PEPSService.processar_venda(db, venda_payload, usuario="test_runner")
        
        # Check stock decrement
        db.refresh(p)
        assert p.estoque_atual == 30, f"Estoque final incorreto: {p.estoque_atual}"
        print(f"4. Venda finalizada. Estoque restante: {p.estoque_atual} un (OK)")

        # Verify lot balances
        lotes = db.query(Lote).order_by(Lote.id.asc()).all()
        assert lotes[0].quantidade_saldo == 0, f"Saldo lote 1 incorreto: {lotes[0].quantidade_saldo}"
        assert lotes[1].quantidade_saldo == 30, f"Saldo lote 2 incorreto: {lotes[1].quantidade_saldo}"
        print("5. Saldos dos lotes atualizados (Lote 1: 0 un, Lote 2: 30 un) (OK)")

        # Check total PEPS cost
        item_venda = db.query(VendaItem).filter(VendaItem.venda_id == venda.id).first()
        assert item_venda.custo_peps_total == 1240.0, f"Custo PEPS incorreto: {item_venda.custo_peps_total}"
        print(f"6. Custo total PEPS faturado: R$ {item_venda.custo_peps_total:.2f} (OK)")

        # Check accounts receivable
        recebivel = db.query(ContaReceber).filter(ContaReceber.venda_id == venda.id).first()
        assert recebivel is not None, "Contas a receber nao gerada"
        assert recebivel.valor == 1800.0, f"Valor de contas a receber incorreto: {recebivel.valor}"
        print(f"7. Contas a receber gerada no valor de: R$ {recebivel.valor:.2f} com vencimento {recebivel.data_vencimento} (OK)")

        # 8. Test Multiple Installments with Fees
        # Sell remaining 30 un @ R$ 15.0 = 450.0.
        # Payment: Cartão Crédito R$ 450.0 in 3 installments with 5% fee (taxa_percentual = 5.0)
        venda_inst_payload = {
            "cliente_id": c.id,
            "vendedor_id": v.id,
            "observacoes": "Venda Parcelada com Taxas",
            "itens": [{
                "tipo_item": "PRODUTO",
                "produto_id": p.id,
                "quantidade": 30,
                "valor_unitario": 15.0,
                "desconto": 0.0
            }],
            "pagamentos": [{
                "forma_pagamento": "Cartão Crédito",
                "valor": 450.0,
                "data_vencimento": "2026-06-11",
                "parcelas": 3,
                "taxa_percentual": 5.0
            }],
            "frete": 0.0,
            "acrescimo": 0.0,
            "desconto": 0.0
        }
        
        venda_inst = PEPSService.processar_venda(db, venda_inst_payload, usuario="test_runner")
        
        # Check that 3 accounts receivable titles were generated for this sale
        recebiveis_inst = db.query(ContaReceber).filter(ContaReceber.venda_id == venda_inst.id).order_by(ContaReceber.id.asc()).all()
        assert len(recebiveis_inst) == 3, f"Qtd de parcelas incorreta: {len(recebiveis_inst)}"
        
        # For each installment:
        # valor = 450 / 3 = 150.0
        # taxa_valor = 150.0 * 0.05 = 7.50
        # valor_liquido = 150.0 - 7.50 = 142.50
        for i, r_inst in enumerate(recebiveis_inst):
            assert r_inst.valor == 150.0, f"Valor da parcela {i+1} incorreto: {r_inst.valor}"
            assert r_inst.taxa_valor == 7.50, f"Taxa da parcela {i+1} incorreta: {r_inst.taxa_valor}"
            assert r_inst.valor_liquido == 142.50, f"Valor liquido da parcela {i+1} incorreto: {r_inst.valor_liquido}"
            
        print(f"8. Venda parcelada gerou 3 parcelas de R$ 150.00 com taxa de R$ 7.50 e liquido de R$ 142.50 cada (OK)")

        print("\n=== TODOS OS TESTES DE INTEGRAÇÃO DO ERP PEPS PASSARAM COM SUCESSO! ===")
        
    finally:
        db.close()
        engine.dispose()
        if os.path.exists(test_db):
            try:
                os.remove(test_db)
            except PermissionError:
                pass

if __name__ == "__main__":
    test_erp_peps_flow()
