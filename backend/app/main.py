from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.database import engine, Base, SessionLocal
from app.models.models import Cliente, Vendedor, Servico, Produto
from sqlalchemy import text

# Create SQLite tables
Base.metadata.create_all(bind=engine)

# Migration: check and add new columns to contas_receber if they don't exist
db = SessionLocal()
try:
    db.execute(text("ALTER TABLE contas_receber ADD COLUMN taxa_valor FLOAT DEFAULT 0.0"))
    db.execute(text("ALTER TABLE contas_receber ADD COLUMN valor_liquido FLOAT"))
    db.commit()
    print("Migration: Colunas de taxa adicionadas a contas_receber com sucesso.")
except Exception as e:
    db.rollback()
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
