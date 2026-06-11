from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.database import engine, Base, SessionLocal
from app.models.models import Cliente, Vendedor, Servico, Produto
from sqlalchemy import text

import os
import glob
from sqlalchemy import create_engine
from app.core.db_seeding import seed_database

# Create SQLite tables for default database
Base.metadata.create_all(bind=engine)

def run_migrations_for_engine(target_engine):
    db = SessionLocal(bind=target_engine)
    try:
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
    finally:
        db.close()

# Run migrations on default DB
try:
    run_migrations_for_engine(engine)
    print("Migration: Banco padrão (default) sincronizado com sucesso.")
except Exception as e:
    print(f"Alerta de migração no banco padrão: {e}")

# Seed default database
db = SessionLocal()
try:
    seed_database(db)
finally:
    db.close()

# Discover and run migrations on all tenant DBs in backend/tenants/*.db
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
