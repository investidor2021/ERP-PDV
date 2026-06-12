from fastapi import APIRouter
from app.api.endpoints import products, clients, services, sales, finance, budgets, dashboard, reports, settings, auth, super_admin, pricing

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(super_admin.router, prefix="/super-admin", tags=["Super Admin"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(products.router, prefix="/products", tags=["Produtos"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clientes"])
api_router.include_router(services.router, prefix="/services", tags=["Serviços"])
api_router.include_router(sales.router, prefix="/sales", tags=["Vendas & Comissões"])
api_router.include_router(finance.router, prefix="/finance", tags=["Financeiro"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["Orçamentos"])
api_router.include_router(pricing.router, prefix="/pricing", tags=["Precificação"])
api_router.include_router(reports.router, prefix="/reports", tags=["Relatórios"])
api_router.include_router(settings.router, prefix="/settings", tags=["Configurações"])
