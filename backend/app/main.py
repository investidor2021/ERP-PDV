from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.database import engine, Base, SessionLocal, master_engine, IS_POSTGRES, postgres_engine
from app.models.models import Cliente, Vendedor, Servico, Produto
from app.models.master_models import BaseMaster
from sqlalchemy import text
from sqlalchemy.orm import Session

import os
import glob
from sqlalchemy import create_engine
from app.core.db_seeding import seed_database

# Create SQLite tables for default database and master database
Base.metadata.create_all(bind=engine)
BaseMaster.metadata.create_all(bind=master_engine)

def run_migrations_for_master(target_engine):
    from sqlalchemy.orm import Session
    db = Session(bind=target_engine)
    try:
        try:
            db.execute(text("ALTER TABLE tenants ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            db.commit()
            print("Migration Master: tenants.is_active adicionado.")
        except Exception:
            db.rollback()
    finally:
        db.close()

def seed_super_admin(target_engine):
    from sqlalchemy.orm import Session
    from app.models.master_models import User
    from app.core.security import hash_password
    db = Session(bind=target_engine)
    try:
        user = db.query(User).filter(User.username == "admin@erppeps.com").first()
        if user:
            if user.role != "SUPER_ADMIN":
                user.role = "SUPER_ADMIN"
                db.commit()
                print("Seed Master: Usuario admin@erppeps.com promovido a SUPER_ADMIN.")
        else:
            admin_pwd = hash_password("admin123")
            super_user = User(
                username="admin@erppeps.com",
                password_hash=admin_pwd,
                name="Super Admin",
                role="SUPER_ADMIN",
                tenant_code="master"
            )
            db.add(super_user)
            db.commit()
            print("Seed Master: Usuario SUPER_ADMIN criado com sucesso.")
    except Exception as e:
        db.rollback()
        print(f"Alerta: erro ao criar seed SUPER_ADMIN: {e}")
    finally:
        db.close()

try:
    run_migrations_for_master(master_engine)
except Exception as e:
    print(f"Alerta de migracao no master: {e}")

try:
    seed_super_admin(master_engine)
except Exception as e:
    print(f"Alerta de seed no master: {e}")

def run_migrations_for_tenant_session(db: Session):
    # Migration for contas_receber
    try:
        db.execute(text("ALTER TABLE contas_receber ADD COLUMN taxa_valor FLOAT DEFAULT 0.0"))
        db.commit()
    except Exception:
        db.rollback()
        
    try:
        db.execute(text("ALTER TABLE contas_receber ADD COLUMN valor_liquido FLOAT"))
        db.commit()
    except Exception:
        db.rollback()
        
    # Migration for produtos
    for col, col_type in [
        ("estoque_minimo", "INTEGER DEFAULT 0"),
        ("estoque_maximo", "INTEGER DEFAULT 0"),
        ("marca", "VARCHAR"),
        ("categoria", "VARCHAR"),
        ("peso_liquido", "FLOAT DEFAULT 0.0"),
        ("peso_bruto", "FLOAT DEFAULT 0.0"),
        ("cfop_padrao", "VARCHAR"),
        ("origem_mercadoria", "INTEGER DEFAULT 0"),
        ("localizacao", "VARCHAR")
    ]:
        try:
            db.execute(text(f"ALTER TABLE produtos ADD COLUMN {col} {col_type}"))
            db.commit()
        except Exception:
            db.rollback()
            
    # Migration for servicos
    for col, col_type in [
        ("aliquota_iss", "FLOAT DEFAULT 0.0"),
        ("codigo_lc116", "VARCHAR"),
        ("unidade_medida", "VARCHAR DEFAULT 'UN'"),
        ("custo_estimado", "FLOAT DEFAULT 0.0"),
        ("observacoes", "TEXT")
    ]:
        try:
            db.execute(text(f"ALTER TABLE servicos ADD COLUMN {col} {col_type}"))
            db.commit()
        except Exception:
            db.rollback()

def run_migrations_for_engine(target_engine):
    db = SessionLocal(bind=target_engine)
    try:
        run_migrations_for_tenant_session(db)
    finally:
        db.close()

def run_migrations_for_postgres():
    from app.models.master_models import Tenant
    from sqlalchemy.orm import Session
    db_master = Session(bind=master_engine)
    try:
        tenants = db_master.query(Tenant).all()
        for t in tenants:
            try:
                with postgres_engine.connect() as conn:
                    conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {t.tenant_code};"))
                    conn.commit()
                with postgres_engine.begin() as conn:
                    conn.execute(text(f"SET search_path TO {t.tenant_code}, public;"))
                    Base.metadata.create_all(bind=conn)
                
                db_tenant = Session(bind=postgres_engine)
                try:
                    db_tenant.execute(text(f"SET search_path TO {t.tenant_code}, public;"))
                    run_migrations_for_tenant_session(db_tenant)
                    print(f"Migration: Schema Postgres {t.tenant_code} atualizado com sucesso.")
                finally:
                    db_tenant.close()
            except Exception as e:
                print(f"Erro ao migrar schema Postgres {t.tenant_code}: {e}")
    finally:
        db_master.close()

# Run migrations on default DB
try:
    if IS_POSTGRES:
        with postgres_engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS \"default\";"))
            conn.commit()
        with postgres_engine.begin() as conn:
            conn.execute(text("SET search_path TO \"default\", public;"))
            Base.metadata.create_all(bind=conn)
            
    run_migrations_for_engine(engine)
    print("Migration: Banco padrao (default) sincronizado com sucesso.")
except Exception as e:
    print(f"Alerta de migracao no banco padrao: {e}")

# Seed default database
db = SessionLocal()
try:
    if IS_POSTGRES:
        db.execute(text("SET search_path TO \"default\", public;"))
    seed_database(db)
finally:
    db.close()

# Discover and run migrations on all tenant DBs
if IS_POSTGRES:
    try:
        run_migrations_for_postgres()
    except Exception as e:
        print(f"Erro ao executar migracoes de tenants no Postgres: {e}")
else:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tenants_dir = os.path.join(backend_dir, "tenants")
    if os.path.exists(tenants_dir):
        tenant_files = glob.glob(os.path.join(tenants_dir, "*.db"))
        for tf in tenant_files:
            try:
                tenant_engine = create_engine(f"sqlite:///{tf}", connect_args={"check_same_thread": False})
                Base.metadata.create_all(bind=tenant_engine)
                run_migrations_for_engine(tenant_engine)
                tenant_engine.dispose()
                print(f"Migration: Inquilino {os.path.basename(tf)} atualizado com sucesso.")
            except Exception as e:
                print(f"Erro ao migrar tenant banco {tf}: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API do ERP PEPS (FIFO) com PDV, Orçamentos e Contas a Receber",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production development ease
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include APIs
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "sistema": "ERP PEPS API",
        "status": "ativo",
        "docs": "/docs",
        "mensagem": "Backend rodando com sucesso. Pronto para conexao do Next.js."
    }
