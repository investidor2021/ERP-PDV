from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Servico

router = APIRouter()

@router.get("/", response_model=List[schemas.ServiceResponse])
def read_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Servico).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(service_in: schemas.ServiceCreate, db: Session = Depends(get_db)):
    db_service = db.query(Servico).filter(Servico.codigo == service_in.codigo).first()
    if db_service:
        raise HTTPException(status_code=400, detail="Código de serviço já cadastrado.")
    
    db_obj = Servico(**service_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.get("/{service_id}", response_model=schemas.ServiceResponse)
def read_service(service_id: int, db: Session = Depends(get_db)):
    db_service = db.query(Servico).filter(Servico.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return db_service

@router.put("/{service_id}", response_model=schemas.ServiceResponse)
def update_service(service_id: int, service_in: schemas.ServiceUpdate, db: Session = Depends(get_db)):
    db_service = db.query(Servico).filter(Servico.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    
    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_service, field, value)
    
    db.commit()
    db.refresh(db_service)
    return db_service

@router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    db_service = db.query(Servico).filter(Servico.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    db.delete(db_service)
    db.commit()
    return {"message": "Serviço excluído com sucesso!"}
