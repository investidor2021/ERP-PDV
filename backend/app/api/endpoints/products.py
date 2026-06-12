from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Produto, Lote, Movimentacao
from app.repositories.product_repo import product_repo
from app.services.peps_service import PEPSService
from datetime import datetime
import io
import csv
import re

router = APIRouter()

@router.get("/", response_model=List[schemas.ProductResponse])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return product_repo.get_multi(db, skip=skip, limit=limit)

@router.post("/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_prod = product_repo.get_by_code(db, product_in.codigo)
    if db_prod:
        raise HTTPException(status_code=400, detail="Código SKU de produto já cadastrado.")
    return product_repo.create(db, obj_in=product_in)

@router.get("/{product_id}", response_model=schemas.ProductResponse)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return db_prod

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product_in: schemas.ProductUpdate, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    
    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_prod, field, value)
    
    db.commit()
    db.refresh(db_prod)
    return db_prod

@router.delete("/{product_id}", response_model=schemas.ProductResponse)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product_repo.remove(db, id=product_id)

@router.get("/{product_id}/lotes", response_model=List[schemas.LotResponse])
def read_product_lots(product_id: int, db: Session = Depends(get_db)):
    return db.query(Lote).filter(Lote.produto_id == product_id, Lote.quantidade_saldo > 0).order_by(Lote.data_entrada.asc()).all()

@router.post("/lotes-manual", status_code=status.HTTP_201_CREATED)
def create_manual_lot(lot_in: schemas.LotCreate, db: Session = Depends(get_db)):
    try:
        PEPSService.registrar_entrada_manual(
            db=db,
            produto_id=lot_in.produto_id,
            quantidade=lot_in.quantidade,
            custo_unitario=lot_in.custo_unitario,
            data_entrada=lot_in.data_entrada,
            usuario="admin",
            observacao=lot_in.observacao or "Entrada manual de ajuste"
        )
        return {"message": "Lote manual registrado com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/importar-xml")
async def import_xml_invoice(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        xml_content = await file.read()
        res = PEPSService.importar_nfe(db, xml_content, usuario="admin")
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{product_id}/custo-medio")
def read_product_average_costs(product_id: int, db: Session = Depends(get_db)):
    historico = PEPSService.obter_custo_medio_historico(db, product_id)
    atual = PEPSService.obter_custo_medio_atual(db, product_id)
    return {
        "custo_medio_historico": historico,
        "custo_medio_atual": atual
    }

@router.put("/{product_id}/preco-sugerido")
def update_suggested_price(product_id: int, payload: dict, db: Session = Depends(get_db)):
    """Salva o preço sugerido de venda calculado pelo módulo de precificação."""
    db_prod = product_repo.get(db, product_id)
    if not db_prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    preco = payload.get("preco_sugerido_venda")
    if preco is None or preco <= 0:
        raise HTTPException(status_code=422, detail="Preço sugerido deve ser maior que zero.")
    db_prod.preco_sugerido_venda = float(preco)
    # Also sync to preco_venda for NF-e compatibility
    db_prod.preco_venda = float(preco)
    db.commit()
    db.refresh(db_prod)
    return {"message": "Preço sugerido de venda salvo com sucesso!", "preco_sugerido_venda": db_prod.preco_sugerido_venda}


# ── CSV / XLSX IMPORT ─────────────────────────────────────────────────────────

IMPORT_COLUMNS = [
    "codigo", "descricao", "preco_custo", "preco_venda",
    "estoque_inicial", "categoria", "marca", "ncm",
    "unidade", "estoque_minimo", "estoque_maximo", "peso_bruto", "peso_liquido",
    "codigo_barras", "localizacao"
]

@router.get("/template-csv")
def download_template_csv():
    """Baixa planilha modelo CSV com os cabeçalhos corretos para importação."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    # Header row
    writer.writerow(IMPORT_COLUMNS)
    # Example row
    writer.writerow([
        "SKU-001", "Produto Exemplo", "10.50", "29.90",
        "50", "Eletrônicos", "Samsung", "8471.30.12",
        "UN", "5", "200", "0.350", "0.300",
        "7891234567890", "Prateleira A1"
    ])
    output.seek(0)
    headers = {
        "Content-Disposition": "attachment; filename=modelo_importacao_produtos.csv",
        "Content-Type": "text/csv; charset=utf-8-sig"
    }
    return StreamingResponse(iter([output.getvalue().encode("utf-8-sig")]), headers=headers, media_type="text/csv")


def _safe_float(val, default=0.0) -> float:
    if val is None or str(val).strip() == "":
        return default
    try:
        return float(str(val).replace(",", "."))
    except Exception:
        return default

def _safe_int(val, default=0) -> int:
    try:
        return int(float(str(val).replace(",", ".")))
    except Exception:
        return default


@router.post("/importar-planilha")
async def import_spreadsheet(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Importa produtos a partir de arquivo CSV (.csv) ou Excel (.xlsx/.xls).
    - Colunas obrigatórias: codigo, descricao, preco_custo
    - Se o produto já existir (mesmo SKU), seus dados são atualizados.
    - Se for novo e tiver estoque_inicial > 0, um lote de entrada é criado.
    """
    filename = file.filename or ""
    content = await file.read()

    rows = []
    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            import pandas as pd
            df = pd.read_excel(io.BytesIO(content), dtype=str)
            df.columns = [c.strip().lower() for c in df.columns]
            rows = df.to_dict(orient="records")
        else:
            # CSV – tenta detectar delimitador (ponto-vírgula ou vírgula)
            text = content.decode("utf-8-sig", errors="replace")
            sample = text[:1024]
            delimiter = ";" if sample.count(";") >= sample.count(",") else ","
            reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
            for row in reader:
                rows.append({k.strip().lower(): v for k, v in row.items()})
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler arquivo: {e}")

    if not rows:
        raise HTTPException(status_code=422, detail="Arquivo vazio ou sem linhas de dados.")

    criados = 0
    atualizados = 0
    erros = []

    for idx, row in enumerate(rows, start=2):  # start=2 skips header
        codigo = str(row.get("codigo") or "").strip()
        descricao = str(row.get("descricao") or "").strip()
        if not codigo or not descricao:
            erros.append(f"Linha {idx}: 'codigo' e 'descricao' são obrigatórios.")
            continue

        try:
            preco_custo = _safe_float(row.get("preco_custo"))
            preco_venda = _safe_float(row.get("preco_venda"))
            estoque_inicial = _safe_int(row.get("estoque_inicial"))

            existing = product_repo.get_by_code(db, codigo)
            if existing:
                # Update existing product fields
                existing.descricao = descricao
                if preco_custo > 0:
                    existing.preco_custo = preco_custo
                if preco_venda > 0:
                    existing.preco_venda = preco_venda
                if row.get("categoria"):
                    existing.categoria = str(row["categoria"]).strip()
                if row.get("marca"):
                    existing.marca = str(row["marca"]).strip()
                if row.get("ncm"):
                    existing.ncm = str(row["ncm"]).strip()
                if row.get("unidade"):
                    existing.unidade = str(row["unidade"]).strip()
                if row.get("estoque_minimo"):
                    existing.estoque_minimo = _safe_int(row["estoque_minimo"])
                if row.get("estoque_maximo"):
                    existing.estoque_maximo = _safe_int(row["estoque_maximo"])
                if row.get("peso_bruto"):
                    existing.peso_bruto = _safe_float(row["peso_bruto"])
                if row.get("peso_liquido"):
                    existing.peso_liquido = _safe_float(row["peso_liquido"])
                if row.get("codigo_barras"):
                    existing.codigo_barras = str(row["codigo_barras"]).strip()
                if row.get("localizacao"):
                    existing.localizacao = str(row["localizacao"]).strip()
                db.commit()
                atualizados += 1
            else:
                # Create new product
                novo = Produto(
                    codigo=codigo,
                    descricao=descricao,
                    preco_custo=preco_custo,
                    preco_venda=preco_venda if preco_venda > 0 else preco_custo,
                    categoria=str(row.get("categoria") or "").strip() or None,
                    marca=str(row.get("marca") or "").strip() or None,
                    ncm=str(row.get("ncm") or "").strip() or None,
                    unidade=str(row.get("unidade") or "UN").strip(),
                    estoque_minimo=_safe_int(row.get("estoque_minimo")),
                    estoque_maximo=_safe_int(row.get("estoque_maximo")),
                    peso_bruto=_safe_float(row.get("peso_bruto")),
                    peso_liquido=_safe_float(row.get("peso_liquido")),
                    codigo_barras=str(row.get("codigo_barras") or "").strip() or None,
                    localizacao=str(row.get("localizacao") or "").strip() or None,
                    estoque_atual=0,
                )
                db.add(novo)
                db.flush()  # get novo.id

                # Create initial stock lot if requested
                if estoque_inicial > 0:
                    custo_lote = preco_custo if preco_custo > 0 else 0.01
                    PEPSService.registrar_entrada_manual(
                        db=db,
                        produto_id=novo.id,
                        quantidade=estoque_inicial,
                        custo_unitario=custo_lote,
                        data_entrada=datetime.now().date(),
                        usuario="importacao",
                        observacao=f"Estoque inicial via importação de planilha"
                    )

                db.commit()
                criados += 1

        except Exception as e:
            db.rollback()
            erros.append(f"Linha {idx} ({codigo}): {e}")

    return {
        "message": f"Importação concluída: {criados} produto(s) criado(s), {atualizados} atualizado(s).",
        "criados": criados,
        "atualizados": atualizados,
        "erros": erros
    }

