"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Product {
  id: number;
  codigo: string;
  descricao: string;
}

interface AuditLog {
  id: number;
  data: string;
  modulo: string;
  acao: string;
  detalhes: string;
}

export default function ReportsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [reportType, setReportType] = useState("posicao");
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadProducts();
    loadAuditLogs();
  }, []);

  async function loadProducts() {
    try {
      const res = await api.get("/products");
      setProducts(res || []);
      if (res && res.length > 0) setSelectedProductId(res[0].id);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAuditLogs() {
    try {
      setLogsLoading(true);
      const res = await api.get("/reports/auditoria");
      setLogs(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }

  const triggerDownload = (endpoint: string, filename: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    const url = `${baseUrl}${endpoint}`;
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadExcel = () => {
    if (reportType === "posicao") {
      triggerDownload("/reports/posicao/excel", "posicao_estoque.xlsx");
    } else if (reportType === "inventario") {
      triggerDownload("/reports/inventario/excel", "inventario_geral.xlsx");
    } else {
      if (!selectedProductId) return;
      triggerDownload(`/reports/kardex/excel?produto_id=${selectedProductId}`, `kardex_produto_${selectedProductId}.xlsx`);
    }
  };

  const downloadPdf = () => {
    if (reportType === "posicao") {
      triggerDownload("/reports/posicao/pdf", "posicao_estoque.pdf");
    } else if (reportType === "inventario") {
      triggerDownload("/reports/inventario/pdf", "inventario_geral.pdf");
    } else {
      if (!selectedProductId) return;
      triggerDownload(`/reports/kardex/pdf?produto_id=${selectedProductId}`, `kardex_produto_${selectedProductId}.pdf`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
          📊 Relatórios e Auditoria
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Gere arquivos PDF e planilhas de auditoria contábil com custeio PEPS.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Reports Builder */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
          <h3 className="font-bold text-neutral-200 text-sm border-b border-neutral-800 pb-3">
            📋 Gerar Relatórios Gerenciais e Fiscais
          </h3>

          <div className="space-y-4">
            {/* Report selection */}
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">Tipo de Relatório</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs outline-none text-neutral-300 font-medium"
              >
                <option value="posicao">Posição de Estoque Valorizado pelo PEPS</option>
                <option value="inventario">Livro de Inventário Geral (Faturamento/Contábil)</option>
                <option value="kardex">Ficha de Movimento de Estoque (Kardex detalhado)</option>
              </select>
            </div>

            {/* Product selection if Kardex */}
            {reportType === "kardex" && (
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Selecione o Produto</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(parseInt(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs outline-none text-neutral-300 font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Explanatory description of selected report */}
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800/40 text-xs text-neutral-400">
              {reportType === "posicao" && (
                <p>
                  💡 **Posição de Estoque:** Consolida o saldo total de cada SKU, ponderando dinamicamente o valor de compra de cada lote ativo. Exibe o custo médio e valor patrimonial atualizado de aquisição.
                </p>
              )}
              {reportType === "inventario" && (
                <p>
                  💡 **Livro de Inventário:** Relatório oficial exigido pelo fisco. Consolida todos os itens com classificação NCM e saldo contábil valorizado pelo custo PEPS.
                </p>
              )}
              {reportType === "kardex" && (
                <p>
                  💡 **Ficha Kardex:** Histórico temporal e detalhado de cada movimentação (entradas, vendas, quebras, perdas). Permite acompanhar o saldo acumulado e a margem de lucro de cada venda calculada pelo PEPS.
                </p>
              )}
            </div>

            {/* Download Buttons Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
              <button
                onClick={downloadExcel}
                className="w-full bg-neutral-950 hover:bg-neutral-800 text-neutral-300 font-bold py-3 px-4 border border-neutral-800 rounded-lg text-xs transition flex items-center justify-center gap-2"
              >
                <span>📊</span> Baixar em Excel (.xlsx)
              </button>
              <button
                onClick={downloadPdf}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2"
              >
                <span>📄</span> Gerar PDF (.pdf)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Audit Logs list */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center shrink-0 border-b border-neutral-800 pb-2">
            <h3 className="font-bold text-neutral-200 text-xs uppercase tracking-wider">📝 Logs de Auditoria</h3>
            <button
              onClick={loadAuditLogs}
              className="text-[10px] text-neutral-400 font-bold hover:text-emerald-400"
            >
              Atualizar ↻
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {logsLoading ? (
              <p className="text-neutral-500 text-xs text-center py-6">Carregando logs...</p>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] space-y-1">
                  <div className="flex justify-between text-neutral-400 font-bold">
                    <span>{log.modulo}</span>
                    <span>{new Date(log.data).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-neutral-300 font-semibold">{log.acao}</div>
                  <p className="text-neutral-500">{log.detalhes}</p>
                </div>
              ))
            ) : (
              <p className="text-neutral-600 text-xs text-center py-12">Nenhum log registrado.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
