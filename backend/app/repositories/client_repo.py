from sqlalchemy.orm import Session
from typing import Optional, List
from app.repositories.base import BaseRepository
from app.models.models import Cliente

class ClientRepository(BaseRepository[Cliente]):
    def __init__(self):
        super().__init__(Cliente)

    def get_by_cpf_cnpj(self, db: Session, cpf_cnpj: str) -> Optional[Cliente]:
        return db.query(self.model).filter(self.model.cpf_cnpj == cpf_cnpj).first()

    def search_clients(self, db: Session, query: str) -> List[Cliente]:
        return db.query(self.model).filter(
            (self.model.nome_razao.like(f"%{query}%")) |
            (self.model.cpf_cnpj.like(f"%{query}%")) |
            (self.model.telefone.like(f"%{query}%")) |
            (self.model.whatsapp.like(f"%{query}%"))
        ).all()

client_repo = ClientRepository()
