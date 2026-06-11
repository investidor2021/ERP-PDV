from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Orcamento, OrcamentoItem, Cliente, Produto, Servico, Venda
from app.services.peps_service import PEPSService
from datetime import datetime

# ReportLab pdf helper
import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

router = APIRouter()

@router.get("/", response_model=List[schemas.OrcamentoResponseSchema])
def read_budgets(db: Session = Depends(get_db)):
    return db.query(Orcamento).order_by(Orcamento.data_criacao.desc()).all()

@router.post("/", response_model=schemas.OrcamentoResponseSchema, status_code=status.HTTP_201_CREATED)
def create_budget(budget_in: schemas.OrcamentoCreateSchema, db: Session = Depends(get_db)):
    # Generate unique budget number
    hoje = datetime.now().strftime("%Y%m%d")
    last_orc = db.query(Orcamento).filter(Orcamento.numero_orcamento.like(f"OR{hoje}%")).order_by(Orcamento.id.desc()).first()
    if last_orc:
        seq = int(last_orc.numero_orcamento[-4:]) + 1
    else:
        seq = 1
    numero_orcamento = f"OR{hoje}{seq:04d}"

    orcamento = Orcamento(
        numero_orcamento=numero_orcamento,
        data_criacao=datetime.now(),
        cliente_id=budget_in.cliente_id,
        observacoes=budget_in.observacoes,
        frete=budget_in.frete,
        acrescimo=budget_in.acrescimo,
        desconto=budget_in.desconto,
        subtotal=0.0,
        total_final=0.0
    )
    db.add(orcamento)
    db.flush()

    subtotal = 0.0
    for item in budget_in.itens:
        tot_item = (item.valor_unitario - item.desconto) * item.quantidade
        subtotal += tot_item
        
        orc_item = OrcamentoItem(
            orcamento_id=orcamento.id,
            produto_id=item.produto_id,
            servico_id=item.servico_id,
            tipo_item=item.tipo_item,
            quantidade=item.quantidade,
            valor_unitario=item.valor_unitario,
            desconto=item.desconto,
            total=tot_item
        )
        db.add(orc_item)

    orcamento.subtotal = subtotal
    orcamento.total_final = subtotal - budget_in.desconto + budget_in.frete + budget_in.acrescimo
    
    db.commit()
    db.refresh(orcamento)
    return orcamento

@router.get("/{id}", response_model=schemas.OrcamentoResponseSchema)
def read_budget(id: int, db: Session = Depends(get_db)):
    orc = db.query(Orcamento).filter(Orcamento.id == id).first()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    return orc

@router.post("/{id}/status")
def update_budget_status(id: int, status_str: str, db: Session = Depends(get_db)):
    orc = db.query(Orcamento).filter(Orcamento.id == id).first()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    
    if orc.situacao == "CONVERTIDO":
        raise HTTPException(status_code=400, detail="Este orçamento já foi convertido em venda e não pode ter o status alterado.")
        
    orc.situacao = status_str.upper()
    db.commit()
    return {"message": "Status atualizado com sucesso!", "situacao": orc.situacao}

@router.post("/{id}/converter", response_model=schemas.VendaResponseSchema)
def convert_budget_to_sale(id: int, vendedor_id: Optional[int] = None, forma_pagamento: str = "PIX", db: Session = Depends(get_db)):
    """Converts a budget into an active sale, running PEPS deductions and creating financial records."""
    orc = db.query(Orcamento).filter(Orcamento.id == id).first()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    
    if orc.situacao == "CONVERTIDO":
        raise HTTPException(status_code=400, detail="Este orçamento já foi convertido em venda anteriormente.")

    # Convert items
    venda_itens = []
    for item in orc.itens:
        venda_itens.append({
            "tipo_item": item.tipo_item,
            "produto_id": item.produto_id,
            "servico_id": item.servico_id,
            "quantidade": item.quantidade,
            "valor_unitario": item.valor_unitario,
            "desconto": item.desconto
        })

    # Prepare sales payload
    # For simulation, split payments. If a default forma_pagamento is selected, pay all.
    pagamentos = [{
        "forma_pagamento": forma_pagamento,
        "valor": orc.total_final
    }]

    venda_payload = {
        "cliente_id": orc.cliente_id,
        "vendedor_id": vendedor_id,
        "observacoes": orc.observacoes,
        "itens": venda_itens,
        "pagamentos": pagamentos,
        "frete": orc.frete,
        "acrescimo": orc.acrescimo,
        "desconto": orc.desconto
    }

    try:
        # Commit sale and perform PEPS lots depletion
        venda = PEPSService.processar_venda(db, venda_payload, usuario="admin")
        
        # Mark budget as converted
        orc.situacao = "CONVERTIDO"
        db.commit()
        
        return venda
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao converter orçamento em venda: {str(e)}")

@router.get("/{id}/pdf")
def get_budget_pdf(id: int, db: Session = Depends(get_db)):
    """Generates a professional PDF for client printing/sharing."""
    orc = db.query(Orcamento).filter(Orcamento.id == id).first()
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name='TitleStyle',
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#1E3A8A'), # Navy blue
        spaceAfter=5
    )
    
    label_style = ParagraphStyle(
        name='LabelStyle',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#374151')
    )
    
    val_style = ParagraphStyle(
        name='ValStyle',
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#4B5563')
    )

    elements = []
    
    # Title & Header
    elements.append(Paragraph(f"ORÇAMENTO Nº {orc.numero_orcamento}", title_style))
    elements.append(Paragraph(f"Data de Emissão: {orc.data_criacao.strftime('%d/%m/%Y %H:%M:%S')} | Validade: 15 dias", val_style))
    elements.append(Spacer(1, 15))

    # Client details
    cliente = orc.cliente
    client_data = [
        [Paragraph("Cliente:", label_style), Paragraph(cliente.nome_razao, val_style), Paragraph("CPF/CNPJ:", label_style), Paragraph(cliente.cpf_cnpj, val_style)],
        [Paragraph("Email:", label_style), Paragraph(cliente.email or "—", val_style), Paragraph("Telefone:", label_style), Paragraph(cliente.telefone or "—", val_style)],
        [Paragraph("Cidade/UF:", label_style), Paragraph(f"{cliente.cidade or ''}/{cliente.estado or ''}", val_style), Paragraph("Endereço:", label_style), Paragraph(cliente.logradouro or "—", val_style)]
    ]
    t_client = Table(client_data, colWidths=[0.8*inch, 2.8*inch, 0.9*inch, 3.0*inch])
    t_client.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_client)
    elements.append(Spacer(1, 20))

    # Items Grid
    header_style = ParagraphStyle(name='HeaderStyle', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)
    cell_c = ParagraphStyle(name='CellC', fontName='Helvetica', fontSize=8)
    
    grid_data = [[
        Paragraph("Código", header_style),
        Paragraph("Descrição / Item", header_style),
        Paragraph("Qtd", header_style),
        Paragraph("Val. Unit.", header_style),
        Paragraph("Desc.", header_style),
        Paragraph("Total", header_style)
    ]]

    for item in orc.itens:
        if item.tipo_item == "PRODUTO":
            code = item.produto.codigo
            desc = item.produto.descricao
        else:
            code = item.servico.codigo
            desc = item.servico.descricao

        grid_data.append([
            Paragraph(code, cell_c),
            Paragraph(desc, cell_c),
            Paragraph(str(item.quantidade), cell_c),
            Paragraph(f"R$ {item.valor_unitario:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), cell_c),
            Paragraph(f"R$ {item.desconto:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), cell_c),
            Paragraph(f"R$ {item.total:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), cell_c)
        ])

    t_grid = Table(grid_data, colWidths=[1.1*inch, 3.1*inch, 0.5*inch, 0.9*inch, 0.9*inch, 1.0*inch])
    t_grid.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F9FAFB')])
    ]))
    elements.append(t_grid)
    elements.append(Spacer(1, 15))

    # Totals Summary
    tot_label = ParagraphStyle(name='TotLabel', fontName='Helvetica-Bold', fontSize=9, alignment=2)
    tot_val = ParagraphStyle(name='TotVal', fontName='Helvetica', fontSize=9, alignment=2)
    
    tot_data = [
        [Paragraph("Subtotal:", tot_label), Paragraph(f"R$ {orc.subtotal:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), tot_val)],
        [Paragraph("Descontos:", tot_label), Paragraph(f"R$ {orc.desconto:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), tot_val)],
        [Paragraph("Frete:", tot_label), Paragraph(f"R$ {orc.frete:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), tot_val)],
        [Paragraph("Acréscimos:", tot_label), Paragraph(f"R$ {orc.acrescimo:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), tot_val)],
        [Paragraph("Total Final:", ParagraphStyle(name='TotFinalL', fontName='Helvetica-Bold', fontSize=10, alignment=2, textColor=colors.HexColor('#1E3A8A'))), 
         Paragraph(f"R$ {orc.total_final:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), ParagraphStyle(name='TotFinalV', fontName='Helvetica-Bold', fontSize=10, alignment=2))]
    ]
    t_tot = Table(tot_data, colWidths=[5.5*inch, 2.0*inch])
    t_tot.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t_tot)
    
    if orc.observacoes:
        elements.append(Spacer(1, 15))
        elements.append(Paragraph("Observações:", label_style))
        elements.append(Paragraph(orc.observacoes, val_style))

    doc.build(elements)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=orcamento_{orc.numero_orcamento}.pdf"}
    )
