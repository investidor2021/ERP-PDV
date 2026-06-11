from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Produto, Lote, Movimentacao
from app.repositories.product_repo import product_repo
from app.services.peps_service import PEPSService
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[schemas.ProductResponse])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return product_repo.get_multi(db, skip=skip, limit=limit)

@router.post("/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_prod = product_repo.get_by_code(db, product_in.codigo)
    if db_prod:
        raise HTTPException(status_code=400, detail="Código SKU de produto já cadastrado.")
    return product_repo.create(db, obj_in=product_in)

@router.get("/{product_id}", response_model=schemas.ProductResponse)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return db_prod

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product_in: schemas.ProductUpdate, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    
    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_prod, field, value)
    
    db.commit()
    db.refresh(db_prod)
    return db_prod

@router.delete("/{product_id}", response_model=schemas.ProductResponse)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product_repo.remove(db, id=product_id)

@router.get("/{product_id}/lotes", response_model=List[schemas.LotResponse])
def read_product_lots(product_id: int, db: Session = Depends(get_db)):
    return db.query(Lote).filter(Lote.produto_id == product_id, Lote.quantidade_saldo > 0).order_by(Lote.data_entrada.asc()).all()

@router.post("/lotes-manual", status_code=status.HTTP_201_CREATED)
def create_manual_lot(lot_in: schemas.LotCreate, db: Session = Depends(get_db)):
    try:
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=lot_in.produto_id,
            quantidade=lot_in.quantidade,
            custo_unitario=lot_in.custo_unitario,
            data_entrada=lot_in.data_entrada,
            usuario="admin",
            observacao=lot_in.observacao or "Entrada manual de ajuste"
        )
        return {"message": "Lote manual registrado com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/importar-xml")
async def import_xml_invoice(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        xml_content = await file.read()
        res = PEPSService.importar_nfe(db, xml_content, usuario="admin")
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{product_id}/custo-medio")
def read_product_average_costs(product_id: int, db: Session = Depends(get_db)):
    historico = PEPSService.obter_custo_medio_historico(db, product_id)
    atual = PEPSService.obter_custo_medio_atual(db, product_id)
    return {
        "custo_medio_historico": historico,
        "custo_medio_atual": atual
    }
