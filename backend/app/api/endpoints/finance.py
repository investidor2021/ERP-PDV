from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import ContaReceber, FinanceiroLog
from datetime import datetime

router = APIRouter()

@router.get("/contas-receber", response_model=List[schemas.ContaReceberResponse])
def read_receivables(db: Session = Depends(get_db)):
    return db.query(ContaReceber).order_by(ContaReceber.data_vencimento.asc()).all()

@router.post("/contas-receber/{id}/baixa")
def settle_receivable(id: int, baixa: schemas.ContaReceberBaixaSchema, db: Session = Depends(get_db)):
    recebivel = db.query(ContaReceber).filter(ContaReceber.id == id).first()
    if not recebivel:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    
    if recebivel.situacao == "PAGO":
        raise HTTPException(status_code=400, detail="Esta conta já está totalmente paga.")

    valor_pago = baixa.valor_pago
    if valor_pago <= 0:
        raise HTTPException(status_code=400, detail="O valor pago deve ser maior que zero.")

    if valor_pago > recebivel.saldo_devedor:
        raise HTTPException(status_code=400, detail=f"O valor pago (R$ {valor_pago:.2f}) excede o saldo devedor (R$ {recebivel.saldo_devedor:.2f}).")

    # Update balance
    recebivel.saldo_devedor -= valor_pago
    
    # Log payment
    log = FinanceiroLog(
        conta_receber_id=recebivel.id,
        data_pagamento=datetime.now(),
        valor_pago=valor_pago,
        forma_pagamento=baixa.forma_pagamento
    )
    db.add(log)

    # Update status
    if recebivel.saldo_devedor == 0:
        recebivel.situacao = "PAGO"
    else:
        recebivel.situacao = "PARCIAL"

    db.commit()
    
    return {
        "message": "Baixa financeira efetuada com sucesso!",
        "saldo_restante": recebivel.saldo_devedor,
        "situacao": recebivel.situacao
    }

@router.get("/contas-receber/{id}/logs")
def read_receivable_logs(id: int, db: Session = Depends(get_db)):
    recebivel = db.query(ContaReceber).filter(ContaReceber.id == id).first()
    if not recebivel:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    
    logs = db.query(FinanceiroLog).filter(FinanceiroLog.conta_receber_id == id).all()
    return logs
