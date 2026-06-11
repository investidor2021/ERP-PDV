import io
import pandas as pd
from sqlalchemy.orm import Session
from app.models.models import Produto, Lote, Movimentacao, Cliente, Venda, VendaItem, ContaReceber, Comissao
from datetime import datetime

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

class ReportService:
    @staticmethod
    def get_stock_position_data(db: Session) -> pd.DataFrame:
        """Returns stock balance with PEPS average cost and total inventory values."""
        produtos = db.query(Produto).order_by(Produto.descricao.asc()).all()
        data = []
        for p in produtos:
            # Calculate dynamic average cost of active lots
            lots = db.query(Lote.quantidade_saldo, Lote.custo_unitario).filter(
                Lote.produto_id == p.id, 
                Lote.quantidade_saldo > 0
            ).all()
            
            tot_val = sum(l[0] * l[1] for l in lots)
            tot_qtd = sum(l[0] for l in lots)
            
            custo_medio = tot_val / tot_qtd if tot_qtd > 0 else 0.0
            
            data.append({
                "SKU": p.codigo,
                "Descrição": p.descricao,
                "Unidade": p.unidade,
                "NCM": p.ncm or "",
                "Saldo Estoque": p.estoque_atual,
                "Custo Médio PEPS (R$)": round(custo_medio, 2),
                "Valor Total (R$)": round(custo_medio * p.estoque_atual, 2)
            })
        return pd.DataFrame(data)

    @staticmethod
    def get_kardex_data(db: Session, produto_id: int) -> pd.DataFrame:
        """Returns chronologically sorted Kardex sheet for a specific product."""
        movs = db.query(Movimentacao).filter(Movimentacao.produto_id == produto_id).order_by(
            Movimentacao.data_movimento.asc(), 
            Movimentacao.id.asc()
        ).all()

        data = []
        saldo_acumulado = 0
        for m in movs:
            if m.tipo == "ENTRADA":
                saldo_acumulado += m.quantidade
                lucro = 0.0
            else: # SAIDA
                saldo_acumulado -= m.quantidade
                preco_v = m.preco_venda or 0.0
                custo_u = m.custo or 0.0
                lucro = (preco_v - custo_u) * m.quantidade

            data.append({
                "Data": m.data_movimento.strftime("%Y-%m-%d %H:%M:%S"),
                "Tipo": m.tipo,
                "Origem": m.origem,
                "Quantidade": m.quantidade,
                "Custo Unitário PEPS": round(m.custo, 2),
                "Preço Venda": round(m.preco_venda, 2) if m.preco_venda else 0.0,
                "Saldo Acumulado": saldo_acumulado,
                "Lucro Bruto (R$)": round(lucro, 2),
                "Observação": m.observacao or ""
            })
        return pd.DataFrame(data)

    @classmethod
    def generate_excel_report(cls, db: Session, report_type: str, produto_id: int = None) -> bytes:
        output = io.BytesIO()
        
        if report_type == "posicao":
            df = cls.get_stock_position_data(db)
            sheet_name = "Posicao Estoque"
        elif report_type == "kardex" and produto_id:
            df = cls.get_kardex_data(db, produto_id)
            sheet_name = "Kardex"
        else:
            df = cls.get_stock_position_data(db)
            sheet_name = "Inventario"
            
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)
            workbook = writer.book
            worksheet = writer.sheets[sheet_name]
            
            # Formatting
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#059669',
                'font_color': '#FFFFFF',
                'border': 1
            })
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                
            worksheet.autofilter(0, 0, len(df), len(df.columns) - 1)
            for idx, col in enumerate(df):
                series = df[col]
                max_len = max((
                    series.astype(str).map(len).max(),
                    len(str(series.name))
                )) + 3
                worksheet.set_column(idx, idx, min(max_len, 40))
                
        return output.getvalue()

    @classmethod
    def generate_pdf_report(cls, db: Session, report_type: str, title: str, produto_id: int = None) -> bytes:
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
            fontSize=16,
            textColor=colors.HexColor('#111827'),
            spaceAfter=15
        )
        
        meta_style = ParagraphStyle(
            name='MetaStyle',
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor('#4B5563'),
            spaceAfter=15
        )
        
        cell_style = ParagraphStyle(
            name='CellStyle',
            fontName='Helvetica',
            fontSize=8,
            textColor=colors.HexColor('#374151'),
            leading=10
        )
        
        cell_bold = ParagraphStyle(
            name='CellBold',
            fontName='Helvetica-Bold',
            fontSize=8,
            textColor=colors.HexColor('#111827'),
            leading=10
        )
        
        header_cell_style = ParagraphStyle(
            name='HeaderCellStyle',
            fontName='Helvetica-Bold',
            fontSize=8,
            textColor=colors.HexColor('#FFFFFF'),
            leading=10
        )

        elements = []
        elements.append(Paragraph(title, title_style))
        elements.append(Paragraph(f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} | ERP PEPS (FIFO)", meta_style))
        elements.append(Spacer(1, 10))

        if report_type == "posicao":
            df = cls.get_stock_position_data(db)
        elif report_type == "kardex" and produto_id:
            df = cls.get_kardex_data(db, produto_id)
        else:
            df = cls.get_stock_position_data(db)

        # Convert to printable structure
        table_data = []
        table_data.append([Paragraph(col, header_cell_style) for col in df.columns])
        
        for _, row in df.iterrows():
            body_row = []
            for col_name in df.columns:
                val = row[col_name]
                if isinstance(val, float):
                    if any(x in col_name for x in ["R$", "Custo", "Valor", "Preço", "Lucro"]):
                        txt = f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    else:
                        txt = f"{val:.2f}".replace(".", ",")
                    style = cell_bold if "Total" in col_name or "Lucro" in col_name else cell_style
                elif isinstance(val, (int, float)):
                    txt = str(val)
                    style = cell_bold if "Estoque" in col_name or "Acumulado" in col_name or "Quantidade" in col_name else cell_style
                else:
                    txt = str(val) if val is not None else ""
                    style = cell_style
                body_row.append(Paragraph(txt, style))
            table_data.append(body_row)

        col_count = len(df.columns)
        available_width = 7.5 * inch
        col_width = available_width / col_count
        widths = [col_width] * col_count
        
        if report_type == "posicao":
            # [SKU, Descricao, Unidade, NCM, Saldo, Custo, Total]
            widths = [0.8*inch, 2.5*inch, 0.5*inch, 0.7*inch, 0.8*inch, 1.1*inch, 1.1*inch]
        elif report_type == "kardex":
            # [Data, Tipo, Origem, Qtd, Custo, Preço, Saldo, Lucro, Obs]
            widths = [1.1*inch, 0.6*inch, 0.8*inch, 0.4*inch, 0.7*inch, 0.7*inch, 0.6*inch, 0.7*inch, 1.9*inch]

        t = Table(table_data, colWidths=widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#059669')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F9FAFB')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
            ('BOTTOMPADDING', (0,1), (-1,-1), 4),
            ('TOPPADDING', (0,1), (-1,-1), 4),
        ]))
        
        elements.append(t)
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
