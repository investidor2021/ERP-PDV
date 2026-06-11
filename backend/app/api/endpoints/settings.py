from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import ConfiguracaoTaxa

router = APIRouter()

@router.get("/taxas", response_model=List[schemas.ConfiguracaoTaxaResponse])
def read_taxas(db: Session = Depends(get_db)):
    return db.query(ConfiguracaoTaxa).all()

@router.post("/taxas", response_model=schemas.ConfiguracaoTaxaResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_taxa(taxa_in: schemas.ConfiguracaoTaxaCreate, db: Session = Depends(get_db)):
    # Verifica se já existe configuração para o mesmo tipo, bandeira e parcelas
    db_taxa = db.query(ConfiguracaoTaxa).filter(
        ConfiguracaoTaxa.tipo == taxa_in.tipo,
        ConfiguracaoTaxa.bandeira == taxa_in.bandeira,
        ConfiguracaoTaxa.parcelas == taxa_in.parcelas
    ).first()
    
    if db_taxa:
        db_taxa.taxa_percentual = taxa_in.taxa_percentual
    else:
        db_taxa = ConfiguracaoTaxa(**taxa_in.model_dump())
        db.add(db_taxa)
        
    db.commit()
    db.refresh(db_taxa)
    return db_taxa

@router.delete("/taxas/{taxa_id}", status_code=status.HTTP_200_OK)
def delete_taxa(taxa_id: int, db: Session = Depends(get_db)):
    db_taxa = db.query(ConfiguracaoTaxa).filter(ConfiguracaoTaxa.id == taxa_id).first()
    if not db_taxa:
        raise HTTPException(status_code=404, detail="Configuração de taxa não encontrada.")
    db.delete(db_taxa)
    db.commit()
    return {"message": "Taxa excluída com sucesso!"}
