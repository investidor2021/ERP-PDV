from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import schemas
from app.repositories.client_repo import client_repo

router = APIRouter()

@router.get("/", response_model=List[schemas.ClientResponse])
def read_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return client_repo.get_multi(db, skip=skip, limit=limit)

@router.post("/", response_model=schemas.ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client_in: schemas.ClientCreate, db: Session = Depends(get_db)):
    db_client = client_repo.get_by_cpf_cnpj(db, client_in.cpf_cnpj)
    if db_client:
        raise HTTPException(status_code=400, detail="CPF/CNPJ do cliente já cadastrado.")
    return client_repo.create(db, obj_in=client_in)

@router.get("/search", response_model=List[schemas.ClientResponse])
def search_clients(q: str = "", db: Session = Depends(get_db)):
    return client_repo.search_clients(db, query=q)

@router.get("/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: int, db: Session = Depends(get_db)):
    db_client = client_repo.get(db, client_id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return db_client

@router.put("/{client_id}", response_model=schemas.ClientResponse)
def update_client(client_id: int, client_in: schemas.ClientUpdate, db: Session = Depends(get_db)):
    db_client = client_repo.get(db, client_id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    
    update_data = client_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_client, field, value)
        
    db.commit()
    db.refresh(db_client)
    return db_client

@router.delete("/{client_id}", response_model=schemas.ClientResponse)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    db_client = client_repo.get(db, client_id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return client_repo.remove(db, id=client_id)
