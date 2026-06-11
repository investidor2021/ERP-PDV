from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True, nullable=False) # SKU / Internal Code
    codigo_fornecedor = Column(String, nullable=True)
    codigo_barras = Column(String, index=True, nullable=True)
    descricao = Column(String, nullable=False)
    unidade = Column(String, default="UN")
    ncm = Column(String, nullable=True)
    estoque_atual = Column(Integer, default=0)
    preco_venda = Column(Float, default=0.0)

    # Relationships
    lotes = relationship("Lote", back_populates="produto", cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="produto")
    itens_nota = relationship("ItemNota", back_populates="produto")
    itens_venda = relationship("VendaItem", back_populates="produto")
    itens_orcamento = relationship("OrcamentoItem", back_populates="produto")

class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String, nullable=False)
    chave = Column(String, unique=True, index=True, nullable=False)
    data_emissao = Column(DateTime, nullable=False)
    fornecedor_cnpj = Column(String, nullable=False)
    fornecedor_nome = Column(String, nullable=False)

    # Relationships
    itens = relationship("ItemNota", back_populates="nota_fiscal", cascade="all, delete-orphan")
    lotes = relationship("Lote", back_populates="nota_fiscal")

class ItemNota(Base):
    __tablename__ = "itens_nota"

    id = Column(Integer, primary_key=True, index=True)
    nota_id = Column(Integer, ForeignKey("notas_fiscais.id", ondelete="CASCADE"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Integer, nullable=False)
    valor_unitario = Column(Float, nullable=False)
    valor_total = Column(Float, nullable=False)

    # Taxes
    icms = Column(Float, default=0.0)
    ipi = Column(Float, default=0.0)
    pis = Column(Float, default=0.0)
    cofins = Column(Float, default=0.0)

    # Relationships
    nota_fiscal = relationship("NotaFiscal", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_nota")

class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    nota_id = Column(Integer, ForeignKey("notas_fiscais.id", ondelete="SET NULL"), nullable=True)
    data_entrada = Column(DateTime, default=datetime.utcnow, nullable=False)
    quantidade_original = Column(Integer, nullable=False)
    quantidade_saldo = Column(Integer, nullable=False)
    custo_unitario = Column(Float, nullable=False)

    # Relationships
    produto = relationship("Produto", back_populates="lotes")
    nota_fiscal = relationship("NotaFiscal", back_populates="lotes")

class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    tipo = Column(String, nullable=False) # 'ENTRADA' or 'SAIDA'
    quantidade = Column(Integer, nullable=False)
    custo = Column(Float, nullable=False) # For ENTRADA: unit cost. For SAIDA: unit cost calculated via PEPS.
    preco_venda = Column(Float, nullable=True)
    data_movimento = Column(DateTime, default=datetime.utcnow, nullable=False)
    usuario = Column(String, nullable=False)
    origem = Column(String, nullable=False) # 'AJUSTE', 'VENDA', 'NF-e', 'PERDA', etc.
    observacao = Column(Text, nullable=True)

    # Relationships
    produto = relationship("Produto", back_populates="movimentacoes")

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True, nullable=False)
    nome_razao = Column(String, nullable=False)
    cpf_cnpj = Column(String, unique=True, index=True, nullable=False)
    inscricao_estadual = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    email = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    observacoes = Column(Text, nullable=True)

    # Relationships
    vendas = relationship("Venda", back_populates="cliente")
    orcamentos = relationship("Orcamento", back_populates="cliente")
    contas_receber = relationship("ContaReceber", back_populates="cliente")

class Vendedor(Base):
    __tablename__ = "vendedores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    comissao_percentual = Column(Float, default=0.0) # ex: 5.0 for 5%

    # Relationships
    vendas = relationship("Venda", back_populates="vendedor")
    comissoes = relationship("Comissao", back_populates="vendedor")

class Servico(Base):
    __tablename__ = "servicos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True, nullable=False)
    descricao = Column(String, nullable=False)
    valor_padrao = Column(Float, default=0.0)
    categoria = Column(String, nullable=True) # Ex: Instalação, Manutenção, Montagem

    # Relationships
    itens_venda = relationship("VendaItem", back_populates="servico")
    itens_orcamento = relationship("OrcamentoItem", back_populates="servico")

class Venda(Base):
    __tablename__ = "vendas"

    id = Column(Integer, primary_key=True, index=True)
    numero_venda = Column(String, unique=True, index=True, nullable=False)
    data_venda = Column(DateTime, default=datetime.utcnow, nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vendedor_id = Column(Integer, ForeignKey("vendedores.id"), nullable=True)
    observacoes = Column(Text, nullable=True)
    
    # Financial summary
    subtotal = Column(Float, default=0.0)
    desconto = Column(Float, default=0.0)
    frete = Column(Float, default=0.0)
    acrescimo = Column(Float, default=0.0)
    total_final = Column(Float, default=0.0)

    # Invoice linkage
    chave_fiscal = Column(String, nullable=True) # Link placeholder for NFC-e/NF-e/NFS-e

    # Relationships
    cliente = relationship("Cliente", back_populates="vendas")
    vendedor = relationship("Vendedor", back_populates="vendas")
    itens = relationship("VendaItem", back_populates="venda", cascade="all, delete-orphan")
    pagamentos = relationship("Pagamento", back_populates="venda", cascade="all, delete-orphan")
    contas_receber = relationship("ContaReceber", back_populates="venda", cascade="all, delete-orphan")
    comissoes = relationship("Comissao", back_populates="venda", cascade="all, delete-orphan")

class VendaItem(Base):
    __tablename__ = "vendas_itens"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=True) # Nullable if service
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=True) # Nullable if product
    tipo_item = Column(String, nullable=False) # 'PRODUTO' or 'SERVICO'
    quantidade = Column(Integer, nullable=False)
    valor_unitario = Column(Float, nullable=False)
    desconto = Column(Float, default=0.0) # unit discount
    total = Column(Float, nullable=False)
    custo_peps_total = Column(Float, default=0.0) # total acquisition cost for products under PEPS

    # Relationships
    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_venda")
    servico = relationship("Servico", back_populates="itens_venda")

class Pagamento(Base):
    __tablename__ = "pagamentos"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False)
    forma_pagamento = Column(String, nullable=False) # Dinheiro, PIX, Cartão Crédito, Cartão Débito, Boleto, etc.
    valor = Column(Float, nullable=False)

    # Relationships
    venda = relationship("Venda", back_populates="pagamentos")

class ContaReceber(Base):
    __tablename__ = "contas_receber"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(Integer, ForeignKey("vendas.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    valor = Column(Float, nullable=False)
    data_vencimento = Column(Date, nullable=False)
    situacao = Column(String, default="ABERTO") # ABERTO, PARCIAL, PAGO, CANCELADO, VENCIDO
    saldo_devedor = Column(Float, nullable=False)
    taxa_valor = Column(Float, default=0.0)
    valor_liquido = Column(Float, nullable=True)

    # Relationships
    venda = relationship("Venda", back_populates="contas_receber")
    cliente = relationship("Cliente", back_populates="contas_receber")
    historico_pagamentos = relationship("FinanceiroLog", back_populates="conta_receber", cascade="all, delete-orphan")

class FinanceiroLog(Base):
    __tablename__ = "financeiro_logs"

    id = Column(Integer, primary_key=True, index=True)
    conta_receber_id = Column(Integer, ForeignKey("contas_receber.id", ondelete="CASCADE"), nullable=False)
    data_pagamento = Column(DateTime, default=datetime.utcnow, nullable=False)
    valor_pago = Column(Float, nullable=False)
    forma_pagamento = Column(String, nullable=False)

    # Relationships
    conta_receber = relationship("ContaReceber", back_populates="historico_pagamentos")

class Comissao(Base):
    __tablename__ = "comissoes"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False)
    vendedor_id = Column(Integer, ForeignKey("vendedores.id"), nullable=False)
    valor_venda = Column(Float, nullable=False)
    percentual_comissao = Column(Float, nullable=False)
    valor_comissao = Column(Float, nullable=False)
    data_geracao = Column(DateTime, default=datetime.utcnow, nullable=False)
    situacao = Column(String, default="PENDENTE") # PENDENTE, PAGO

    # Relationships
    venda = relationship("Venda", back_populates="comissoes")
    vendedor = relationship("Vendedor", back_populates="comissoes")

class Orcamento(Base):
    __tablename__ = "orcamentos"

    id = Column(Integer, primary_key=True, index=True)
    numero_orcamento = Column(String, unique=True, index=True, nullable=False)
    data_criacao = Column(DateTime, default=datetime.utcnow, nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    observacoes = Column(Text, nullable=True)
    
    subtotal = Column(Float, default=0.0)
    desconto = Column(Float, default=0.0)
    frete = Column(Float, default=0.0)
    acrescimo = Column(Float, default=0.0)
    total_final = Column(Float, default=0.0)
    situacao = Column(String, default="ABERTO") # ABERTO, APROVADO, REJEITADO, CONVERTIDO

    # Relationships
    cliente = relationship("Cliente", back_populates="orcamentos")
    itens = relationship("OrcamentoItem", back_populates="orcamento", cascade="all, delete-orphan")

class OrcamentoItem(Base):
    __tablename__ = "orcamentos_itens"

    id = Column(Integer, primary_key=True, index=True)
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id", ondelete="CASCADE"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=True)
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=True)
    tipo_item = Column(String, nullable=False) # 'PRODUTO' or 'SERVICO'
    quantidade = Column(Integer, nullable=False)
    valor_unitario = Column(Float, nullable=False)
    desconto = Column(Float, default=0.0)
    total = Column(Float, nullable=False)

    # Relationships
    orcamento = relationship("Orcamento", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_orcamento")
    servico = relationship("Servico", back_populates="itens_orcamento")

class AuditoriaLog(Base):
    __tablename__ = "auditoria_logs"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(DateTime, default=datetime.utcnow, nullable=False)
    modulo = Column(String, nullable=False)
    acao = Column(String, nullable=False)
    detalhes = Column(Text, nullable=False)

class ConfiguracaoTaxa(Base):
    __tablename__ = "configuracoes_taxas"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, nullable=False) # 'CARTAO_CREDITO' or 'CREDIARIO'
    bandeira = Column(String, nullable=False) # e.g. 'Visa', 'Mastercard', 'Crediário Loja'
    parcelas = Column(Integer, nullable=False)
    taxa_percentual = Column(Float, default=0.0)
