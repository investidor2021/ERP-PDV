"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Sale {
  id: number;
  numero_venda: string;
  data_venda: string;
  cliente_id: number;
  vendedor_id: number | null;
  subtotal: number;
  desconto: number;
  frete: number;
  acrescimo: number;
  total_final: number;
  chave_fiscal: string | null;
}

interface Seller {
  id: number;
  nome: string;
}

interface Client {
  id: number;
  nome_razao: string;
}

interface SaleItem {
  id: number;
  tipo_item: string;
  produto_id?: number;
  servico_id?: number;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  total: number;
  custo_peps_total: number;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states for details modal
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [selectedSaleItens, setSelectedSaleItens] = useState<SaleItem[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fiscal emission form helper
  const [issuingSaleId, setIssuingSaleId] = useState<number | null>(null);

  useEffect(() => {
    loadSales();
    loadMasters();
  }, []);

  async function loadSales() {
    try {
      setLoading(true);
      const res = await api.get("/sales");
      setSales(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMasters() {
    try {
      const [cliList, sellerList] = await Promise.all([
        api.get("/clients"),
        api.get("/sales/vendedores"),
      ]);
      setClients(cliList || []);
      setSellers(sellerList || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Load sale details
  const openDetails = async (sale: Sale) => {
    try {
      const res = await api.get(`/sales/${sale.id}`);
      setSelectedSaleId(sale.id);
      setSelectedSaleItens(res.itens || []);
      setShowDetailsModal(true);
    } catch (err) {
      alert("Erro ao buscar itens da venda.");
    }
  };

  // Issue simulated invoice
  const issueInvoice = async (tipo: "nfe" | "nfce" | "nfse") => {
    if (!issuingSaleId) return;
    try {
      const res = await api.post(`/${issuingSaleId}/emitir-fiscal?tipo=${tipo}`, {});
      alert(`Fiscal: ${res.mensagem}\nChave gerada: ${res.chave_acesso}`);
      setIssuingSaleId(null);
      loadSales();
    } catch (err: any) {
      alert(err.message || "Erro ao emitir documento fiscal.");
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
          🔄 Histórico de Vendas Realizadas
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Consulte o faturamento de balcão e gerencie a emissão de documentos fiscais integrados à SEFAZ/FocusNFe.
        </p>
      </div>

      {/* Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        {loading ? (
          <p className="text-neutral-500 text-xs text-center py-12">Carregando faturamento...</p>
        ) : sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3">Código Venda</th>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Vendedor</th>
                  <th className="py-2.5 px-3 text-right">Total Final</th>
                  <th className="py-2.5 px-3 text-center">Cupom Fiscal</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                {sales.map((s) => {
                  const cli = clients.find(c => c.id === s.cliente_id);
                  const seller = sellers.find(v => v.id === s.vendedor_id);
                  return (
                    <tr key={s.id} className="hover:bg-neutral-800/20 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-300">{s.numero_venda}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{new Date(s.data_venda).toLocaleString()}</td>
                      <td className="py-2.5 px-3">{cli?.nome_razao || "Consumidor Final"}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{seller?.nome || "Vendedor Direto"}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{formatBRL(s.total_final)}</td>
                      <td className="py-2.5 px-3 text-center">
                        {s.chave_fiscal ? (
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[9px] font-bold" title={s.chave_fiscal}>
                            EMITIDO ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => setIssuingSaleId(s.id)}
                            className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[9px] font-bold"
                          >
                            EMITIR ⚡
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => openDetails(s)}
                          className="text-emerald-400 hover:text-emerald-300 font-bold"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-xs text-center py-12">Nenhuma venda faturada ainda.</p>
        )}
      </div>

      {/* DETAILS MODAL */}
      {showDetailsModal && selectedSaleId !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="text-lg font-bold text-neutral-200">
                Itens da Venda: {sales.find(s => s.id === selectedSaleId)?.numero_venda}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-neutral-400 hover:text-neutral-300 font-black text-lg"
              >
                ×
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950 text-neutral-500 font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Item / SKU</th>
                    <th className="py-2 px-3 text-center">Qtd</th>
                    <th className="py-2 px-3 text-right">Valor Unit</th>
                    <th className="py-2 px-3 text-right">Desc.</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Custo PEPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                  {selectedSaleItens.map((it) => (
                    <tr key={it.id} className="hover:bg-neutral-800/20">
                      <td className="py-2 px-3 text-[10px] font-bold text-neutral-500">{it.tipo_item}</td>
                      <td className="py-2 px-3 font-medium text-neutral-100">
                        {it.tipo_item === "PRODUTO" ? `📦 Prod ID ${it.produto_id}` : `🛠️ Serv ID ${it.servico_id}`}
                      </td>
                      <td className="py-2 px-3 text-center">{it.quantidade}</td>
                      <td className="py-2 px-3 text-right">R$ {it.valor_unitario.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">R$ {it.desconto.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-neutral-100">R$ {it.total.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-red-400 font-mono">
                        {it.tipo_item === "PRODUTO" ? `R$ ${it.custo_peps_total.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotal metrics summary */}
            <div className="bg-neutral-950 p-4 rounded-xl text-right space-y-1">
              <p className="text-[10px] text-neutral-500 uppercase font-bold">Faturamento Líquido</p>
              <div className="text-xl font-black text-emerald-400">
                {formatBRL(sales.find(s => s.id === selectedSaleId)?.total_final || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FISCAL ISSUER MODAL */}
      {issuingSaleId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-200">⚡ Emissão de Nota Fiscal</h3>
            <p className="text-xs text-neutral-400">Selecione o modelo do documento fiscal a ser integrado com a API FocusNFe/SEFAZ:</p>
            
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => issueInvoice("nfce")}
                className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 py-3 rounded-lg text-xs font-bold transition flex items-center justify-between px-4"
              >
                <span>Cupom Fiscal Consumidor (NFC-e)</span> <span>→</span>
              </button>
              <button
                onClick={() => issueInvoice("nfe")}
                className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 py-3 rounded-lg text-xs font-bold transition flex items-center justify-between px-4"
              >
                <span>Nota Fiscal Eletrônica (NF-e)</span> <span>→</span>
              </button>
              <button
                onClick={() => issueInvoice("nfse")}
                className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 py-3 rounded-lg text-xs font-bold transition flex items-center justify-between px-4"
              >
                <span>Nota Fiscal de Serviços (NFS-e)</span> <span>→</span>
              </button>
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIssuingSaleId(null)}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
