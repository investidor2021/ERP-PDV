import os
from fastapi import Request, HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

Base = declarative_base()

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_POSTGRES = DATABASE_URL.startswith("postgresql://")

if IS_POSTGRES:
    # Postgres database pooling
    postgres_engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
    master_engine = postgres_engine
    MasterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
    
    # Backwards compatibility default engine and SessionLocal
    engine = postgres_engine
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
else:
    # SQLite configuration
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    master_db_path = os.path.join(backend_dir, "master.db")
    master_engine = create_engine(f"sqlite:///{master_db_path}", connect_args={"check_same_thread": False})
    MasterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=master_engine)
    
    # Backwards compatibility default engine and SessionLocal
    default_path = os.path.join(backend_dir, "erp_peps.db")
    engine = create_engine(f"sqlite:///{default_path}", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
    
    engine_sqlite = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine_sqlite)
    
    db = Session(bind=engine_sqlite)
    try:
        db.execute(text("PRAGMA foreign_keys = ON;"))
        from app.core.db_seeding import seed_database
        seed_database(db)
    finally:
        db.close()
        
    tenant_engines[tenant_id] = engine_sqlite
    return engine_sqlite

def init_tenant_db(tenant_code: str):
    tenant_code = "".join(c for c in tenant_code if c.isalnum() or c in ("_", "-"))
    if not tenant_code:
        tenant_code = "default"
        
    if IS_POSTGRES:
        with postgres_engine.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {tenant_code};"))
            conn.commit()
            
        with postgres_engine.begin() as conn:
            conn.execute(text(f"SET search_path TO {tenant_code}, public;"))
            Base.metadata.create_all(bind=conn)
            
        SessionLocal_tenant = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
        db = SessionLocal_tenant()
        try:
            db.execute(text(f"SET search_path TO {tenant_code}, public;"))
            from app.core.db_seeding import seed_database
            seed_database(db)
        finally:
            db.close()
    else:
        get_tenant_engine(tenant_code)

def get_master_db():
    db = MasterSessionLocal()
    try:
        if not IS_POSTGRES:
            db.execute(text("PRAGMA foreign_keys = ON;"))
        yield db
    finally:
        db.close()

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
                role = payload.get("role", "USER")
                if tenant_id != "default" and role != "SUPER_ADMIN":
                    from app.models.master_models import Tenant
                    master_session = MasterSessionLocal()
                    try:
                        t = master_session.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
                        if t and not t.is_active:
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Acesso bloqueado. A licença desta empresa está inativa. Entre em contato com o suporte."
                            )
                    finally:
                        master_session.close()
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, 
                    detail="Sessão expirada ou token inválido. Por favor, faça login novamente."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Autenticação necessária. Faça login para continuar."
            )
        
    # Clean tenant_id for security
    tenant_id = "".join(c for c in tenant_id if c.isalnum() or c in ("_", "-"))
    if not tenant_id:
        tenant_id = "default"
        
    if IS_POSTGRES:
        db = SessionLocal()
        try:
            db.execute(text(f"SET search_path TO {tenant_id}, public;"))
            yield db
        finally:
            db.close()
    else:
        tenant_engine = get_tenant_engine(tenant_id)
        TenantSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
        db = TenantSessionLocal()
        try:
            db.execute(text("PRAGMA foreign_keys = ON;"))
            yield db
        finally:
            db.close()
