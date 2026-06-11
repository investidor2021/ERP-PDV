from sqlalchemy.orm import Session
from typing import Optional
from app.repositories.base import BaseRepository
from app.models.models import Produto

class ProductRepository(BaseRepository[Produto]):
    def __init__(self):
        super().__init__(Produto)

    def get_by_code(self, db: Session, codigo: str) -> Optional[Produto]:
        return db.query(self.model).filter(self.model.codigo == codigo).first()

    def get_by_barcode(self, db: Session, codigo_barras: str) -> Optional[Produto]:
        return db.query(self.model).filter(self.model.codigo_barras == codigo_barras).first()

product_repo = ProductRepository()
