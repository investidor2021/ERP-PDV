from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.database import engine, Base, SessionLocal
from app.models.models import Cliente, Vendedor, Servico, Produto
from sqlalchemy import text

# Create SQLite tables
Base.metadata.create_all(bind=engine)

# Migration: check and add new columns if they don't exist
db = SessionLocal()
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
            
    print("Migration: Banco de dados sincronizado e colunas adicionadas com sucesso.")
except Exception as e:
    db.rollback()
    print(f"Alerta de migração: {e}")
finally:
    db.close()

# Seed initial default data if database is empty
db = SessionLocal()
try:
    # Seed default client "Consumidor Final"
    consumidor = db.query(Cliente).filter(Cliente.cpf_cnpj == "99999999999").first()
    if not consumidor:
        c = Cliente(
            codigo="CLI001",
            nome_razao="Consumidor Final",
            cpf_cnpj="99999999999",
            inscricao_estadual="",
            telefone="11999999999",
            email="consumidor@final.com",
            cidade="Sao Paulo",
            estado="SP",
            observacoes="Cliente padrao para vendas rapidas de balcao"
        )
        db.add(c)
        
    # Seed default seller "Vendedor Interno"
    vendedor = db.query(Vendedor).filter(Vendedor.nome == "Vendedor Interno").first()
    if not vendedor:
        v = Vendedor(
            nome="Vendedor Interno",
            comissao_percentual=5.0 # 5% commission
        )
        db.add(v)

    # Seed default services
    instalacao = db.query(Servico).filter(Servico.codigo == "SRV001").first()
    if not instalacao:
        s1 = Servico(codigo="SRV001", descricao="Instalação Padrão", valor_padrao=150.0, categoria="Instalação")
        s2 = Servico(codigo="SRV002", descricao="Manutenção Preventiva", valor_padrao=200.0, categoria="Manutenção")
        s3 = Servico(codigo="SRV003", descricao="Frete de Entrega", valor_padrao=50.0, categoria="Frete")
        db.add_all([s1, s2, s3])

    db.commit()
except Exception as e:
    db.rollback()
    print(f"Alerta: Erro ao executar seed inicial do banco: {e}")
finally:
    db.close()

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
