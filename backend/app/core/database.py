import os
from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

Base = declarative_base()

# Cache of tenant engines to avoid creating pools repeatedly
tenant_engines = {}

def get_tenant_db_path(tenant_id: str) -> str:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if tenant_id == "default":
        return os.path.join(backend_dir, "erp_peps.db")
    
    tenants_dir = os.path.join(backend_dir, "tenants")
    os.makedirs(tenants_dir, exist_ok=True)
    return os.path.join(tenants_dir, f"{tenant_id}.db")

def get_tenant_engine(tenant_id: str):
    if tenant_id in tenant_engines:
        return tenant_engines[tenant_id]
        
    db_path = get_tenant_db_path(tenant_id)
    db_url = f"sqlite:///{db_path}"
    
    # SQLite connection args
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    
    # Auto-create tables for the new tenant
    Base.metadata.create_all(bind=engine)
    
    # Run database seed
    from app.core.db_seeding import seed_database
    db = Session(bind=engine)
    try:
        db.execute(text("PRAGMA foreign_keys = ON;"))
        seed_database(db)
    finally:
        db.close()
        
    tenant_engines[tenant_id] = engine
    return engine

# Backwards compatibility engine and SessionLocal
default_path = get_tenant_db_path("default")
engine = create_engine(f"sqlite:///{default_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db(request: Request = None):
    """FastAPI dependency to yield dynamic database sessions according to X-Tenant-ID header."""
    tenant_id = "default"
    if request:
        tenant_id = request.headers.get("X-Tenant-ID", "default")
        
    # Clean tenant_id for security
    tenant_id = "".join(c for c in tenant_id if c.isalnum() or c in ("_", "-"))
    if not tenant_id:
        tenant_id = "default"
        
    tenant_engine = get_tenant_engine(tenant_id)
    TenantSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
    db = TenantSessionLocal()
    try:
        db.execute(text("PRAGMA foreign_keys = ON;"))
        yield db
    finally:
        db.close()
