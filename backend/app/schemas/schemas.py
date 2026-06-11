from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date

# --- PRODUCT SCHEMAS ---
class ProductBase(BaseModel):
    codigo: str
    codigo_fornecedor: Optional[str] = None
    codigo_barras: Optional[str] = None
    descricao: str
    unidade: Optional[str] = "UN"
    ncm: Optional[str] = None
    preco_venda: float = 0.0

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    codigo: Optional[str] = None
    codigo_fornecedor: Optional[str] = None
    codigo_barras: Optional[str] = None
    descricao: Optional[str] = None
    unidade: Optional[str] = None
    ncm: Optional[str] = None
    preco_venda: Optional[float] = None

class ProductResponse(ProductBase):
    id: int
    estoque_atual: int

    class Config:
        from_attributes = True

# --- LOT SCHEMAS ---
class LotCreate(BaseModel):
    produto_id: int
    quantidade: int
    custo_unitario: float
    data_entrada: datetime
    observacao: Optional[str] = None

class LotResponse(BaseModel):
    id: int
    produto_id: int
    nota_id: Optional[int]
    data_entrada: datetime
    quantidade_original: int
    quantidade_saldo: int
    custo_unitario: float

    class Config:
        from_attributes = True

# --- CLIENT SCHEMAS ---
class ClientBase(BaseModel):
    codigo: str
    nome_razao: str
    cpf_cnpj: str
    inscricao_estadual: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    observacoes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    codigo: Optional[str] = None
    nome_razao: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    observacoes: Optional[str] = None

class ClientResponse(ClientBase):
    id: int

    class Config:
        from_attributes = True

# --- SERVICE SCHEMAS ---
class ServiceBase(BaseModel):
    codigo: str
    descricao: str
    valor_padrao: float = 0.0
    categoria: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceResponse(ServiceBase):
    id: int

    class Config:
        from_attributes = True

# --- SELLER SCHEMAS ---
class SellerBase(BaseModel):
    nome: str
    comissao_percentual: float = 0.0

class SellerCreate(SellerBase):
    pass

class SellerResponse(SellerBase):
    id: int

    class Config:
        from_attributes = True

# --- SALES ITEMS & PAYMENTS SCHEMAS ---
class VendaItemSchema(BaseModel):
    tipo_item: str # 'PRODUTO' or 'SERVICO'
    produto_id: Optional[int] = None
    servico_id: Optional[int] = None
    quantidade: int
    valor_unitario: float
    desconto: float = 0.0

class PagamentoSchema(BaseModel):
    forma_pagamento: str # Dinheiro, PIX, Cartão Crédito, etc.
    valor: float
    data_vencimento: Optional[str] = None # ISO format string for manual date overrides
    parcelas: Optional[int] = 1
    bandeira: Optional[str] = None
    taxa_percentual: Optional[float] = 0.0

class VendaCreateSchema(BaseModel):
    cliente_id: int
    vendedor_id: Optional[int] = None
    observacoes: Optional[str] = ""
    itens: List[VendaItemSchema]
    pagamentos: List[PagamentoSchema]
    frete: float = 0.0
    acrescimo: float = 0.0
    desconto: float = 0.0

class VendaItemResponse(BaseModel):
    id: int
    venda_id: int
    produto_id: Optional[int]
    servico_id: Optional[int]
    tipo_item: str
    quantidade: int
    valor_unitario: float
    desconto: float
    total: float
    custo_peps_total: float

    class Config:
        from_attributes = True

class PagamentoResponse(BaseModel):
    id: int
    forma_pagamento: str
    valor: float

    class Config:
        from_attributes = True

class VendaResponseSchema(BaseModel):
    id: int
    numero_venda: str
    data_venda: datetime
    cliente_id: int
    vendedor_id: Optional[int]
    observacoes: Optional[str]
    subtotal: float
    desconto: float
    frete: float
    acrescimo: float
    total_final: float
    chave_fiscal: Optional[str]
    itens: List[VendaItemResponse]
    pagamentos: List[PagamentoResponse]

    class Config:
        from_attributes = True

# --- FINANCIAL SCHEMAS ---
class ContaReceberResponse(BaseModel):
    id: int
    venda_id: Optional[int]
    cliente_id: int
    valor: float
    data_vencimento: date
    situacao: str
    saldo_devedor: float
    taxa_valor: Optional[float] = 0.0
    valor_liquido: Optional[float] = None

    class Config:
        from_attributes = True

class ContaReceberBaixaSchema(BaseModel):
    valor_pago: float
    forma_pagamento: str

# --- COMMISSION SCHEMAS ---
class ComissaoResponse(BaseModel):
    id: int
    venda_id: int
    vendedor_id: int
    valor_venda: float
    percentual_comissao: float
    valor_comissao: float
    data_geracao: datetime
    situacao: str

    class Config:
        from_attributes = True

# --- BUDGET (ORÇAMENTO) SCHEMAS ---
class OrcamentoItemSchema(BaseModel):
    tipo_item: str
    produto_id: Optional[int] = None
    servico_id: Optional[int] = None
    quantidade: int
    valor_unitario: float
    desconto: float = 0.0

class OrcamentoCreateSchema(BaseModel):
    cliente_id: int
    observacoes: Optional[str] = ""
    itens: List[OrcamentoItemSchema]
    frete: float = 0.0
    acrescimo: float = 0.0
    desconto: float = 0.0

class OrcamentoItemResponse(BaseModel):
    id: int
    produto_id: Optional[int]
    servico_id: Optional[int]
    tipo_item: str
    quantidade: int
    valor_unitario: float
    desconto: float
    total: float

    class Config:
        from_attributes = True

class OrcamentoResponseSchema(BaseModel):
    id: int
    numero_orcamento: str
    data_criacao: datetime
    cliente_id: int
    observacoes: Optional[str]
    subtotal: float
    desconto: float
    frete: float
    acrescimo: float
    total_final: float
    situacao: str
    itens: List[OrcamentoItemResponse]

    class Config:
        from_attributes = True

# --- AUDIT SCHEMAS ---
class AuditoriaLogResponse(BaseModel):
    id: int
    data: datetime
    modulo: str
    acao: str
    detalhes: str

    class Config:
        from_attributes = True

# --- SETTINGS / TAXAS SCHEMAS ---
class ConfiguracaoTaxaBase(BaseModel):
    tipo: str # 'CARTAO_CREDITO' or 'CREDIARIO'
    bandeira: str # e.g. 'Visa', 'Mastercard', 'Crediário Loja'
    parcelas: int
    taxa_percentual: float

class ConfiguracaoTaxaCreate(ConfiguracaoTaxaBase):
    pass

class ConfiguracaoTaxaResponse(ConfiguracaoTaxaBase):
    id: int

    class Config:
        from_attributes = True
