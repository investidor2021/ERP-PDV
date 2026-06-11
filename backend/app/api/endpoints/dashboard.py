from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.models import Venda, VendaItem, Cliente, Servico, Produto, ContaReceber
from datetime import datetime, date, timedelta

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    hoje = datetime.now()
    inicio_mes = date(hoje.year, hoje.month, 1)
    
    # 1. Vendas do dia
    hoje_inicio = datetime(hoje.year, hoje.month, hoje.day, 0, 0, 0)
    vendas_dia = db.query(func.sum(Venda.total_final)).filter(Venda.data_venda >= hoje_inicio).scalar() or 0.0
    
    # 2. Vendas do mês
    vendas_mes = db.query(func.sum(Venda.total_final)).filter(Venda.data_venda >= inicio_mes).scalar() or 0.0
    
    # 3. Lucro do mês
    # Lucro = (venda_item.total - venda_item.custo_peps_total) for products, plus service total (no PEPS cost)
    itens_mes = db.query(VendaItem.total, VendaItem.custo_peps_total, VendaItem.tipo_item).join(Venda).filter(
        Venda.data_venda >= inicio_mes
    ).all()
    
    lucro_mes = 0.0
    for it in itens_mes:
        if it[2] == "PRODUTO":
            lucro_mes += (it[0] - it[1])
        else: # SERVICE
            lucro_mes += it[0] # Service sales are 100% margin here

    # 4. Ticket médio do mês
    qtd_vendas_mes = db.query(func.count(Venda.id)).filter(Venda.data_venda >= inicio_mes).scalar() or 0
    ticket_medio = (vendas_mes / qtd_vendas_mes) if qtd_vendas_mes > 0 else 0.0

    # 5. Contas a receber em aberto
    contas_abertas = db.query(func.sum(ContaReceber.saldo_devedor)).filter(
        ContaReceber.situacao.in_(["ABERTO", "PARCIAL"])
    ).scalar() or 0.0

    # 6. Contas vencidas
    hoje_date = date.today()
    contas_vencidas = db.query(func.sum(ContaReceber.saldo_devedor)).filter(
        ContaReceber.situacao.in_(["ABERTO", "PARCIAL"]),
        ContaReceber.data_vencimento < hoje_date
    ).scalar() or 0.0

    return {
        "vendas_dia": round(vendas_dia, 2),
        "vendas_mes": round(vendas_mes, 2),
        "lucro_mes": round(lucro_mes, 2),
        "ticket_medio": round(ticket_medio, 2),
        "contas_receber_abertas": round(contas_abertas, 2),
        "contas_receber_vencidas": round(contas_vencidas, 2)
    }

@router.get("/charts/sales-by-day")
def get_sales_by_day(days: int = 15, db: Session = Depends(get_db)):
    """Returns total sales and profits daily for the last X days."""
    start_date = datetime.now() - timedelta(days=days)
    
    sales = db.query(
        func.date(Venda.data_venda).label("dia"),
        func.sum(Venda.total_final).label("total")
    ).filter(Venda.data_venda >= start_date).group_by(
        func.date(Venda.data_venda)
    ).order_by("dia").all()

    # Calculate profit per day
    daily_data = []
    for s in sales:
        dia_str = s[0]
        # Query items on this day
        # Querying date from SQLite uses string comparison or datetime
        items = db.query(VendaItem.total, VendaItem.custo_peps_total, VendaItem.tipo_item).join(Venda).filter(
            func.date(Venda.data_venda) == dia_str
        ).all()
        
        lucro_dia = 0.0
        for it in items:
            if it[2] == "PRODUTO":
                lucro_dia += (it[0] - it[1])
            else:
                lucro_dia += it[0]
                
        daily_data.append({
            "data": datetime.strptime(str(dia_str), "%Y-%m-%d").strftime("%d/%m"),
            "vendas": round(s[1], 2),
            "lucro": round(lucro_dia, 2)
        })
        
    return daily_data

@router.get("/top-products")
def get_top_products(limit: int = 5, db: Session = Depends(get_db)):
    """Returns top sold products by quantity."""
    results = db.query(
        Produto.descricao,
        func.sum(VendaItem.quantidade).label("total_qtd")
    ).join(VendaItem, VendaItem.produto_id == Produto.id).group_by(
        Produto.id
    ).order_by(
        func.sum(VendaItem.quantidade).desc()
    ).limit(limit).all()

    return [{"nome": r[0], "quantidade": r[1]} for r in results]

@router.get("/top-services")
def get_top_services(limit: int = 5, db: Session = Depends(get_db)):
    """Returns top sold services by quantity."""
    results = db.query(
        Servico.descricao,
        func.sum(VendaItem.quantidade).label("total_qtd")
    ).join(VendaItem, VendaItem.servico_id == Servico.id).group_by(
        Servico.id
    ).order_by(
        func.sum(VendaItem.quantidade).desc()
    ).limit(limit).all()

    return [{"nome": r[0], "quantidade": r[1]} for r in results]

@router.get("/top-clients")
def get_top_clients(limit: int = 5, db: Session = Depends(get_db)):
    """Returns top buyers (customers) by sales total."""
    results = db.query(
        Cliente.nome_razao,
        func.sum(Venda.total_final).label("total_compra")
    ).join(Venda, Venda.cliente_id == Cliente.id).group_by(
        Cliente.id
    ).order_by(
        func.sum(Venda.total_final).desc()
    ).limit(limit).all()

    return [{"nome": r[0], "total": round(r[1], 2)} for r in results]
