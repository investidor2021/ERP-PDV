import re
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_master_db, init_tenant_db
from app.models.master_models import Tenant, User
from app.schemas import schemas
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter()

def get_current_user(request: Request, db: Session = Depends(get_master_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
        )
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada ou token inválido.",
        )
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    return user

@router.post("/register-company", status_code=status.HTTP_201_CREATED)
def register_company(payload: schemas.CompanyRegister, db: Session = Depends(get_master_db)):
    # Validate unique email
    existing_user = db.query(User).filter(User.username == payload.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail de administrador já está cadastrado no sistema."
        )

    # Generate a unique clean tenant_code
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', payload.company_name.strip().replace(' ', '_').lower())
    if not clean_name:
        clean_name = "empresa"
        
    tenant_code = clean_name
    counter = 1
    while db.query(Tenant).filter(Tenant.tenant_code == tenant_code).first():
        tenant_code = f"{clean_name}_{counter}"
        counter += 1

    # Create Tenant
    tenant = Tenant(tenant_code=tenant_code, name=payload.company_name)
    db.add(tenant)
    
    # Create Admin User
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

    # Instantiate tenant database dynamically and run seeding
    try:
        init_tenant_db(tenant_code)
    except Exception as e:
        print(f"Erro ao inicializar banco do tenant {tenant_code}: {e}")

    return {
        "message": "Empresa e administrador cadastrados com sucesso!",
        "tenant_code": tenant_code,
        "admin_email": admin_user.username
    }

@router.post("/login")
def login(payload: schemas.LoginSchema, db: Session = Depends(get_master_db)):
    user = db.query(User).filter(User.username == payload.username.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="E-mail ou senha incorretos."
        )

    # Fetch Tenant name
    tenant = db.query(Tenant).filter(Tenant.tenant_code == user.tenant_code).first()
    if user.role != "SUPER_ADMIN" and tenant and not tenant.is_active:
        raise HTTPException(
            status_code=403,
            detail="Acesso bloqueado. A licença desta empresa está inativa. Entre em contato com o suporte."
        )
    company_name = tenant.name if tenant else "Matriz"

    access_token = create_access_token(
        data={"sub": user.username, "tenant_code": user.tenant_code, "role": user.role}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": user.name,
            "username": user.username,
            "role": user.role,
            "tenant_code": user.tenant_code,
            "company_name": company_name
        }
    }

@router.get("/me", response_model=schemas.UserResponseSchema)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[schemas.UserResponseSchema])
def list_company_users(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_master_db)
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=451,
            detail="Acesso negado. Apenas administradores podem gerenciar usuários."
        )
    return db.query(User).filter(User.tenant_code == current_user.tenant_code).all()

@router.post("/users", response_model=schemas.UserResponseSchema, status_code=status.HTTP_201_CREATED)
def create_company_user(
    payload: schemas.UserCreateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_master_db)
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas administradores podem cadastrar novos usuários."
        )
        
    existing_user = db.query(User).filter(User.username == payload.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail de usuário já está cadastrado."
        )

    hashed_pwd = hash_password(payload.password)
    new_user = User(
        username=payload.username.lower(),
        password_hash=hashed_pwd,
        name=payload.name,
        role=payload.role,
        tenant_code=current_user.tenant_code
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_company_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_master_db)
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas administradores podem excluir usuários."
        )
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado."
        )
        
    # Isolation check
    if target_user.tenant_code != current_user.tenant_code:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Este usuário pertence a outra organização."
        )
        
    # Self-deletion block
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode excluir o seu próprio usuário ativo."
        )
        
    db.delete(target_user)
    db.commit()
    return {"message": "Usuário excluído com sucesso!"}
