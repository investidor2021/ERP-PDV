from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import AuditoriaLog
from app.services.report_service import ReportService

router = APIRouter()

@router.get("/posicao/excel")
def get_stock_position_excel(db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_excel_report(db, "posicao")
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=posicao_estoque.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/posicao/pdf")
def get_stock_position_pdf(db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_pdf_report(db, "posicao", "Relatório de Posição de Estoque Atual")
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=posicao_estoque.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kardex/excel")
def get_kardex_excel(produto_id: int, db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_excel_report(db, "kardex", produto_id)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=kardex_produto_{produto_id}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kardex/pdf")
def get_kardex_pdf(produto_id: int, db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_pdf_report(db, "kardex", f"Ficha Kardex do Produto ID {produto_id}", produto_id)
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=kardex_produto_{produto_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/inventario/excel")
def get_inventario_excel(db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_excel_report(db, "inventario")
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=inventario_geral.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/inventario/pdf")
def get_inventario_pdf(db: Session = Depends(get_db)):
    try:
        data = ReportService.generate_pdf_report(db, "inventario", "Livro de Inventário Geral Contábil")
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=inventario_geral.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auditoria", response_model=List[schemas.AuditoriaLogResponse])
def get_audit_logs(db: Session = Depends(get_db)):
    return db.query(AuditoriaLog).order_by(AuditoriaLog.data.desc()).limit(100).all()
