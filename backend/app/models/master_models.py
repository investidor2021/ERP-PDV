from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import declarative_base
from datetime import datetime

BaseMaster = declarative_base()

class Tenant(BaseMaster):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    tenant_code = Column(String, unique=True, index=True, nullable=False) # e.g. "empresa_a"
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(BaseMaster):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False) # e.g. "email@email.com"
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="ADMIN") # "ADMIN" or "USER"
    tenant_code = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
