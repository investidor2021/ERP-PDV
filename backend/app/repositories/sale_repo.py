from sqlalchemy.orm import Session
from typing import Optional
from app.repositories.base import BaseRepository
from app.models.models import Venda

class SaleRepository(BaseRepository[Venda]):
    def __init__(self):
        super().__init__(Venda)

    def get_by_number(self, db: Session, numero_venda: str) -> Optional[Venda]:
        return db.query(self.model).filter(self.model.numero_venda == numero_venda).first()

sale_repo = SaleRepository()
