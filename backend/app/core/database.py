import os
from fastapi import Request, HTTPException
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
    
    # Store tenant databases under tenants/ directory
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
    db = Session(bind=engine)
    try:
        db.execute(text("PRAGMA foreign_keys = ON;"))
        from app.core.db_seeding import seed_database
        seed_database(db)
    finally:
        db.close()
        
    tenant_engines[tenant_id] = engine
    return engine

# Master Database configuration
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
master_db_path = os.path.join(backend_dir, "master.db")
master_engine = create_engine(f"sqlite:///{master_db_path}", connect_args={"check_same_thread": False})
MasterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=master_engine)

def get_master_db():
    """Yields a database session to the central Master DB (for auth/signup)."""
    db = MasterSessionLocal()
    try:
        db.execute(text("PRAGMA foreign_keys = ON;"))
        yield db
    finally:
        db.close()

# Backwards compatibility engine and SessionLocal
default_path = get_tenant_db_path("default")
engine = create_engine(f"sqlite:///{default_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db(request: Request = None):
    """FastAPI dependency to yield dynamic tenant sessions from JWT tokens."""
    tenant_id = "default"
    if request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload:
                tenant_id = payload.get("tenant_code", "default")
            else:
                raise HTTPException(
                    status_code=401, 
                    detail="Sessão expirada ou token inválido. Por favor, faça login novamente."
                )
        else:
            raise HTTPException(
                status_code=401, 
                detail="Autenticação necessária. Faça login para continuar."
            )
        
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
