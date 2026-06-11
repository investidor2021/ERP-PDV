from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Venda, Vendedor, Comissao, VendaItem
from app.services.peps_service import PEPSService

router = APIRouter()

@router.get("/", response_model=List[schemas.VendaResponseSchema])
def read_sales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Venda).order_by(Venda.data_venda.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.VendaResponseSchema, status_code=status.HTTP_201_CREATED)
def create_sale(venda_in: schemas.VendaCreateSchema, db: Session = Depends(get_db)):
    try:
        # Process sale using peps_service (FIFO inventory deductions + financial)
        venda = PEPSService.processar_venda(db, venda_in.model_dump(), usuario="admin")
        return venda
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno ao processar venda: {str(e)}")

@router.get("/vendedores", response_model=List[schemas.SellerResponse])
def read_sellers(db: Session = Depends(get_db)):
    return db.query(Vendedor).all()

@router.post("/vendedores", response_model=schemas.SellerResponse)
def create_seller(seller_in: schemas.SellerCreate, db: Session = Depends(get_db)):
    db_seller = Vendedor(**seller_in.model_dump())
    db.add(db_seller)
    db.commit()
    db.refresh(db_seller)
    return db_seller

@router.get("/comissoes", response_model=List[schemas.ComissaoResponse])
def read_commissions(db: Session = Depends(get_db)):
    return db.query(Comissao).order_by(Comissao.data_geracao.desc()).all()

@router.post("/comissoes/{commission_id}/pagar")
def pay_commission(commission_id: int, db: Session = Depends(get_db)):
    com = db.query(Comissao).filter(Comissao.id == commission_id).first()
    if not com:
        raise HTTPException(status_code=404, detail="Comissão não encontrada.")
    com.situacao = "PAGO"
    db.commit()
    return {"message": "Comissão paga com sucesso!"}

@router.get("/{sale_id}", response_model=schemas.VendaResponseSchema)
def read_sale(sale_id: int, db: Session = Depends(get_db)):
    db_sale = db.query(Venda).filter(Venda.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada.")
    return db_sale

@router.post("/{sale_id}/emitir-fiscal")
def issue_invoice_simulated(sale_id: int, tipo: str, db: Session = Depends(get_db)):
    """Simulated invoice emission (NF-e, NFC-e, NFS-e) for integration preparation."""
    db_sale = db.query(Venda).filter(Venda.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada.")
    
    if db_sale.chave_fiscal:
        raise HTTPException(status_code=400, detail=f"Documento fiscal já emitido para esta venda. Chave: {db_sale.chave_fiscal}")

    # Simulate generating a 44-digit key for SEFAZ
    import random
    chave_simulada = "".join([str(random.randint(0, 9)) for _ in range(44)])
    
    db_sale.chave_fiscal = f"{tipo.upper()}-{chave_simulada}"
    db.commit()
    
    PEPSService.log_auditoria(db, "FISCAL", f"EMISSAO_SIMULADA_{tipo.upper()}", f"Nota Fiscal do tipo {tipo.upper()} emitida com a chave {chave_simulada} para venda {db_sale.numero_venda}.")
    
    return {
        "status": "sucesso",
        "tipo": tipo.upper(),
        "chave_acesso": chave_simulada,
        "mensagem": f"Documento fiscal {tipo.upper()} integrado simuladamente com sucesso."
    }
