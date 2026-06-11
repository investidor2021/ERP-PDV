import xml.etree.ElementTree as ET
import re
from datetime import datetime

class XMLService:
    @staticmethod
    def clean_xml_namespaces(xml_data: str) -> str:
        """Removes namespaces from XML to make parsing simpler and namespace-independent."""
        xml_data = re.sub(r'\sxmlns="[^"]+"', '', xml_data)
        xml_data = re.sub(r'\sxmlns:[a-zA-Z0-9]+="[^"]+"', '', xml_data)
        xml_data = re.sub(r'<[a-zA-Z0-9]+:([a-zA-Z0-9_]+)', r'<\1', xml_data)
        xml_data = re.sub(r'</[a-zA-Z0-9]+:([a-zA-Z0-9_]+)', r'</\1', xml_data)
        return xml_data

    @classmethod
    def parse_nfe(cls, xml_content: bytes) -> dict:
        """Parses binary NF-e XML and returns metadata and products."""
        try:
            xml_str = xml_content.decode('utf-8', errors='ignore')
            clean_xml = cls.clean_xml_namespaces(xml_str)
            root = ET.fromstring(clean_xml)
        except Exception as e:
            raise ValueError(f"Falha ao carregar XML: XML inválido ou mal formatado. {str(e)}")

        # 1. Chave
        chave = ""
        inf_nfe = root.find('.//infNFe')
        if inf_nfe is not None:
            inf_id = inf_nfe.attrib.get('Id', '')
            chave = re.sub(r'\D', '', inf_id)
        
        if not chave:
            ch_nfe = root.find('.//chNFe')
            if ch_nfe is not None and ch_nfe.text:
                chave = re.sub(r'\D', '', ch_nfe.text)

        if not chave or len(chave) != 44:
            raise ValueError(f"Chave da NF-e inválida ou não encontrada no XML (Chave: {chave})")

        # 2. ide
        ide = root.find('.//ide')
        if ide is None:
            raise ValueError("Tag <ide> não encontrada no XML.")
        
        numero = ide.findtext('nNF')
        if not numero:
            raise ValueError("Número da NF-e não encontrado.")

        data_emissao_raw = ide.findtext('dhEmi') or ide.findtext('dEmi')
        if not data_emissao_raw:
            data_emissao = datetime.now()
        else:
            try:
                clean_date_str = data_emissao_raw.split('-')[0] if '-' in data_emissao_raw and len(data_emissao_raw.split('-')) > 3 else data_emissao_raw
                clean_date_str = clean_date_str.split('+')[0] if '+' in clean_date_str else clean_date_str
                clean_date_str = clean_date_str.replace('T', ' ')
                if len(clean_date_str) > 19:
                    clean_date_str = clean_date_str[:19]
                data_emissao = datetime.strptime(clean_date_str, "%Y-%m-%d %H:%M:%S")
            except:
                try:
                    data_emissao = datetime.strptime(data_emissao_raw[:10], "%Y-%m-%d")
                except:
                    data_emissao = datetime.now()

        # 3. emit
        emit = root.find('.//emit')
        if emit is None:
            raise ValueError("Tag <emit> não encontrada no XML.")
        
        fornecedor_nome = emit.findtext('xNome') or "Emitente Desconhecido"
        fornecedor_cnpj = emit.findtext('CNPJ') or emit.findtext('CPF') or ""
        
        if not fornecedor_cnpj:
            raise ValueError("CNPJ/CPF do emitente não encontrado no XML.")

        # 4. det
        itens = []
        for det in root.findall('.//det'):
            prod = det.find('prod')
            if prod is None:
                continue

            codigo_fornecedor = prod.findtext('cProd')
            codigo_barras = prod.findtext('cEAN')
            if codigo_barras and codigo_barras.upper() in ["SEM GTIN", "SEM_GTIN", ""]:
                codigo_barras = None

            descricao = prod.findtext('xProd')
            ncm = prod.findtext('NCM')
            cfop = prod.findtext('CFOP')
            unidade = prod.findtext('uCom')
            
            try:
                quantidade = int(float(prod.findtext('qCom') or 0))
                valor_unitario = float(prod.findtext('vUnCom') or 0.0)
                valor_total = float(prod.findtext('vProd') or 0.0)
            except (ValueError, TypeError):
                continue

            # Taxes
            imposto = det.find('imposto')
            icms_val = 0.0
            ipi_val = 0.0
            pis_val = 0.0
            cofins_val = 0.0

            if imposto is not None:
                def get_tax_value(path):
                    el = imposto.find(path)
                    if el is not None and el.text:
                        try:
                            return float(el.text)
                        except ValueError:
                            pass
                    return 0.0

                icms_val = get_tax_value('.//vICMS')
                ipi_val = get_tax_value('.//vIPI')
                pis_val = get_tax_value('.//vPIS')
                cofins_val = get_tax_value('.//vCOFINS')

            itens.append({
                "codigo_fornecedor": codigo_fornecedor,
                "codigo_barras": codigo_barras,
                "descricao": descricao,
                "ncm": ncm,
                "cfop": cfop,
                "unidade": unidade,
                "quantidade": quantidade,
                "valor_unitario": valor_unitario,
                "valor_total": valor_total,
                "icms": icms_val,
                "ipi": ipi_val,
                "pis": pis_val,
                "cofins": cofins_val
            })

        if not itens:
            raise ValueError("Nenhum item válido de produto encontrado no XML.")

        return {
            "chave": chave,
            "numero": numero,
            "data_emissao": data_emissao,
            "fornecedor_cnpj": fornecedor_cnpj,
            "fornecedor_nome": fornecedor_nome,
            "itens": itens
        }

    @staticmethod
    def validar_chave_nfe(chave: str) -> bool:
        """Validates the check digit of a 44-digit NF-e key (Modulo 11)."""
        if not chave or len(chave) != 44 or not chave.isdigit():
            return False
        
        multiplicadores = [2, 3, 4, 5, 6, 7, 8, 9]
        soma = 0
        for i in range(43):
            digit = int(chave[42 - i])
            mult = multiplicadores[i % 8]
            soma += digit * mult
            
        resto = soma % 11
        if resto == 0 or resto == 1:
            dv_calculado = 0
        else:
            dv_calculado = 11 - resto
            
        return int(chave[43]) == dv_calculado
