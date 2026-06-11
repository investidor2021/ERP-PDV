from sqlalchemy.orm import Session
from app.models.models import Cliente, Vendedor, Servico

def seed_database(db: Session):
    """Populates database session with default seed records if not already present."""
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
            s1 = Servico(
                codigo="SRV001",
                descricao="Instalação Padrão",
                valor_padrao=150.0,
                categoria="Instalação",
                unidade_medida="UN",
                aliquota_iss=5.0,
                codigo_lc116="07.02",
                custo_estimado=30.0,
                observacoes="Serviço padrão de instalação"
            )
            s2 = Servico(
                codigo="SRV002",
                descricao="Manutenção Preventiva",
                valor_padrao=200.0,
                categoria="Manutenção",
                unidade_medida="UN",
                aliquota_iss=5.0,
                codigo_lc116="07.02",
                custo_estimado=50.0,
                observacoes="Revisão geral e limpeza"
            )
            s3 = Servico(
                codigo="SRV003",
                descricao="Frete de Entrega",
                valor_padrao=50.0,
                categoria="Frete",
                unidade_medida="KM",
                aliquota_iss=2.0,
                codigo_lc116="16.01",
                custo_estimado=20.0,
                observacoes="Frete local de entrega de mercadorias"
            )
            db.add_all([s1, s2, s3])

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Alerta: Erro ao executar seed inicial do banco: {e}")
