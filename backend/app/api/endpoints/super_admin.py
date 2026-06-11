import os
import re
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_master_db, get_tenant_db_path, get_tenant_engine
from app.models.master_models import Tenant, User
from app.schemas import schemas
from app.core.security import decode_access_token

router = APIRouter()

def get_current_super_admin(request: Request, db: Session = Depends(get_master_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
        )
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or payload.get("role") != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Requer privilégios de Super Admin.",
        )
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Super Admin não encontrado.",
        )
    return user

def get_db_size(tenant_code: str) -> float:
    try:
        path = get_tenant_db_path(tenant_code)
        if os.path.exists(path):
            return os.path.getsize(path) / 1024.0  # in KB
    except Exception:
        pass
    return 0.0

@router.get("/tenants", response_model=List[schemas.TenantResponseSchema])
def list_tenants(
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_master_db)
):
    tenants = db.query(Tenant).all()
    result = []
    for t in tenants:
        admin = db.query(User).filter(User.tenant_code == t.tenant_code, User.role == "ADMIN").first()
        db_size = get_db_size(t.tenant_code)
        result.append({
            "id": t.id,
            "tenant_code": t.tenant_code,
            "name": t.name,
            "is_active": t.is_active,
            "created_at": t.created_at,
            "admin_email": admin.username if admin else None,
            "admin_name": admin.name if admin else None,
            "db_size_kb": db_size
        })
    return result

@router.post("/tenants", status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: schemas.CompanyRegister,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_master_db)
):
    existing_user = db.query(User).filter(User.username == payload.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail de administrador já está cadastrado no sistema."
        )

    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', payload.company_name.strip().replace(' ', '_').lower())
    if not clean_name:
        clean_name = "empresa"
        
    tenant_code = clean_name
    counter = 1
    while db.query(Tenant).filter(Tenant.tenant_code == tenant_code).first():
        tenant_code = f"{clean_name}_{counter}"
        counter += 1

    tenant = Tenant(tenant_code=tenant_code, name=payload.company_name, is_active=True)
    db.add(tenant)
    
    from app.core.security import hash_password
    hashed_pwd = hash_password(payload.password)
    admin_user = User(
        username=payload.username.lower(),
        password_hash=hashed_pwd,
        name=payload.admin_name,
        role="ADMIN",
        tenant_code=tenant_code
    )
    db.add(admin_user)
    db.commit()

    try:
        get_tenant_engine(tenant_code)
    except Exception as e:
        print(f"Erro ao inicializar banco do tenant {tenant_code}: {e}")

    return {
        "message": "Empresa provisionada com sucesso!",
        "tenant_code": tenant_code,
        "admin_email": admin_user.username
    }

@router.put("/tenants/{tenant_code}/status")
def update_tenant_status(
    tenant_code: str,
    payload: schemas.TenantStatusUpdateSchema,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_master_db)
):
    tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_code).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    tenant.is_active = payload.is_active
    db.commit()
    return {"message": f"Status da empresa '{tenant.name}' atualizado para {'Ativo' if payload.is_active else 'Suspenso'}."}

@router.get("/stats", response_model=schemas.SuperAdminStatsSchema)
def get_stats(
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_master_db)
):
    tenants = db.query(Tenant).all()
    total_tenants = len(tenants)
    active_tenants = sum(1 for t in tenants if t.is_active)
    inactive_tenants = total_tenants - active_tenants
    
    total_size = 0.0
    for t in tenants:
        total_size += get_db_size(t.tenant_code)
        
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "inactive_tenants": inactive_tenants,
        "total_db_size_kb": total_size
    }
