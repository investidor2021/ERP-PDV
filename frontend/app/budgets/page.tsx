"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Client {
  id: number;
  nome_razao: string;
}

interface Product {
  id: number;
  codigo: string;
  descricao: string;
  preco_venda: number;
}

interface Service {
  id: number;
  codigo: string;
  descricao: string;
  valor_padrao: number;
}

interface Budget {
  id: number;
  numero_orcamento: string;
  data_criacao: string;
  cliente_id: number;
  subtotal: number;
  desconto: number;
  frete: number;
  acrescimo: number;
  total_final: number;
  situacao: string;
  cliente?: {
    nome_razao: string;
  };
}

interface BudgetItem {
  tipo_item: "PRODUTO" | "SERVICO";
  produto_id?: number;
  servico_id?: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [frete, setFrete] = useState(0);
  const [acrescimo, setAcrescimo] = useState(0);
  const [desconto, setDesconto] = useState(0);

  // Item selector helpers
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<{tipo: "PRODUTO" | "SERVICO", id: number, label: string}[]>([]);

  // Conversion helpers
  const [sellers, setSellers] = useState<{id: number, nome: string}[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<number>(0);
  const [convertingBudgetId, setConvertingBudgetId] = useState<number | null>(null);

  useEffect(() => {
    loadBudgets();
    loadMasters();
  }, []);

  async function loadBudgets() {
    try {
      setLoading(true);
      const res = await api.get("/budgets");
      setBudgets(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMasters() {
    try {
      const [cliList, prodList, servList, sellerList] = await Promise.all([
        api.get("/clients"),
        api.get("/products"),
        api.get("/services"),
        api.get("/sales/vendedores"),
      ]);
      setClients(cliList || []);
      setProducts(prodList || []);
      setServices(servList || []);
      setSellers(sellerList || []);
      
      if (cliList && cliList.length > 0) setSelectedClient(cliList[0].id);
      if (sellerList && sellerList.length > 0) setSelectedSeller(sellerList[0].id);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle re-searching products/services for budget creation
  useEffect(() => {
    if (itemSearch.trim().length < 2) {
      setItemResults([]);
      return;
    }
    const q = itemSearch.toLowerCase();
    
    const matchedP = products
      .filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
      .map(p => ({
        tipo: "PRODUTO" as const,
        id: p.id,
        label: `📦 Product: ${p.codigo} - ${p.descricao} (R$ ${p.preco_venda.toFixed(2)})`
      }));

    const matchedS = services
      .filter(s => s.descricao.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q))
      .map(s => ({
        tipo: "SERVICO" as const,
        id: s.id,
        label: `🛠️ Service: ${s.codigo} - ${s.descricao} (R$ ${s.valor_padrao.toFixed(2)})`
      }));

    setItemResults([...matchedP, ...matchedS]);
  }, [itemSearch, products, services]);

  const addBudgetItem = (tipo: "PRODUTO" | "SERVICO", id: number) => {
    if (tipo === "PRODUTO") {
      const p = products.find(prod => prod.id === id);
      if (p) {
        setItems([...items, {
          tipo_item: "PRODUTO",
          produto_id: p.id,
          codigo: p.codigo,
          descricao: p.descricao,
          quantidade: 1,
          valor_unitario: p.preco_venda,
          desconto: 0
        }]);
      }
    } else {
      const s = services.find(serv => serv.id === id);
      if (s) {
        setItems([...items, {
          tipo_item: "SERVICO",
          servico_id: s.id,
          codigo: s.codigo,
          descricao: s.descricao,
          quantidade: 1,
          valor_unitario: s.valor_padrao,
          desconto: 0
        }]);
      }
    }
    setItemSearch("");
    setItemResults([]);
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("Adicione pelo menos um item ao orçamento.");
      return;
    }
    const payload = {
      cliente_id: selectedClient,
      observacoes,
      itens: items.map(it => ({
        tipo_item: it.tipo_item,
        produto_id: it.produto_id || null,
        servico_id: it.servico_id || null,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        desconto: it.desconto
      })),
      frete,
      acrescimo,
      desconto
    };

    try {
      await api.post("/budgets", payload);
      alert("Orçamento gerado com sucesso!");
      setShowAddModal(false);
      setItems([]);
      setFrete(0);
      setAcrescimo(0);
      setDesconto(0);
      setObservacoes("");
      loadBudgets();
    } catch (err: any) {
      alert(err.message || "Erro ao criar orçamento.");
    }
  };

  const changeStatus = async (id: number, statusStr: string) => {
    try {
      await api.post(`/budgets/${id}/status?status_str=${statusStr}`);
      loadBudgets();
    } catch (err: any) {
      alert(err.message || "Erro ao mudar status.");
    }
  };

  const convertToSale = async () => {
    if (!convertingBudgetId) return;
    try {
      const payload: any = {};
      if (selectedSeller) payload.vendedor_id = selectedSeller;
      
      const res = await api.post(`/budgets/${convertingBudgetId}/converter?vendedor_id=${selectedSeller || ""}&forma_pagamento=PIX`);
      alert(`Orçamento convertido na venda nº ${res.numero_venda} com sucesso!`);
      setConvertingBudgetId(null);
      loadBudgets();
    } catch (err: any) {
      alert(err.message || "Erro ao converter orçamento.");
    }
  };

  const downloadPdf = async (id: number, numberStr: string) => {
    try {
      const blob = await api.get(`/budgets/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orcamento_${numberStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert("Erro ao baixar PDF do orçamento.");
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "ABERTO") return <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded text-[10px] font-bold">ABERTO</span>;
    if (s === "APROVADO") return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">APROVADO</span>;
    if (s === "REJEITADO") return <span className="bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">REJEITADO</span>;
    return <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">CONVERTIDO</span>;
  };

  const subtotalOrc = items.reduce((sum, it) => sum + (it.valor_unitario - it.desconto) * it.quantidade, 0);
  const totalOrc = subtotalOrc - desconto + frete + acrescimo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
            📋 Propostas & Orçamentos
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gere propostas de vendas e converta-as em faturamento ativo com baixa automática de estoque.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
        >
          ➕ Criar Orçamento
        </button>
      </div>

      {/* Budgets Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        {loading ? (
          <p className="text-neutral-500 text-xs text-center py-12">Carregando propostas...</p>
        ) : budgets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3">Número</th>
                  <th className="py-2.5 px-3">Data Criação</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                {budgets.map((b) => {
                  const cli = clients.find(c => c.id === b.cliente_id);
                  return (
                    <tr key={b.id} className="hover:bg-neutral-800/20 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-300">{b.numero_orcamento}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{new Date(b.data_criacao).toLocaleString()}</td>
                      <td className="py-2.5 px-3">{cli?.nome_razao || "Cliente Desconhecido"}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-neutral-100">{formatBRL(b.total_final)}</td>
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(b.situacao)}</td>
                      <td className="py-2.5 px-3 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => downloadPdf(b.id, b.numero_orcamento)}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded transition text-[10px]"
                          title="Imprimir / Baixar PDF"
                        >
                          📄 PDF
                        </button>
                        {b.situacao === "ABERTO" && (
                          <>
                            <button
                              onClick={() => changeStatus(b.id, "APROVADO")}
                              className="px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 rounded font-bold transition text-[10px]"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => changeStatus(b.id, "REJEITADO")}
                              className="px-2 py-1 bg-red-950 text-red-400 border border-red-800 hover:bg-red-900 rounded font-bold transition text-[10px]"
                            >
                              Rejeitar
                            </button>
                          </>
                        )}
                        {b.situacao === "APROVADO" && (
                          <button
                            onClick={() => setConvertingBudgetId(b.id)}
                            className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded transition text-[10px]"
                          >
                            ⚡ Converter em Venda
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-xs text-center py-12">Nenhum orçamento cadastrado.</p>
        )}
      </div>

      {/* CREATE BUDGET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateBudget} className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-200">➕ Novo Orçamento / Proposta</h3>

            <div className="grid grid-cols-3 gap-4">
              {/* Client Selector */}
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Cliente</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(parseInt(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 text-xs text-neutral-300"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_razao}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Item Search inside Modal */}
            <div className="relative border-t border-neutral-800 pt-4">
              <label className="text-[10px] text-neutral-400 font-bold uppercase block mb-1">Adicionar Item</label>
              <input
                type="text"
                placeholder="🔎 Digite descrição de produto/serviço..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
              />
              
              {itemResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-40 overflow-hidden divide-y divide-neutral-800">
                  {itemResults.map(res => (
                    <button
                      key={`${res.tipo}-${res.id}`}
                      type="button"
                      onClick={() => addBudgetItem(res.tipo, res.id)}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-800 text-xs text-neutral-200"
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Grid list inside Modal */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950 text-neutral-500 font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="py-2 px-3">Cód</th>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-center">Qtd</th>
                    <th className="py-2 px-3 text-right">Valor Unit</th>
                    <th className="py-2 px-3 text-right">Desconto</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-center">X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {items.length > 0 ? (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-neutral-800/20">
                        <td className="py-2 px-3 font-mono">{it.codigo}</td>
                        <td className="py-2 px-3">{it.tipo_item === "PRODUTO" ? "📦" : "🛠️"} {it.descricao}</td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.quantidade}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].quantidade = parseInt(e.target.value) || 1;
                              setItems(updated);
                            }}
                            className="bg-neutral-950 border border-neutral-800 text-center w-12 py-0.5 rounded"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">R$ {it.valor_unitario.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={it.desconto}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].desconto = parseFloat(e.target.value) || 0;
                              setItems(updated);
                            }}
                            className="bg-neutral-950 border border-neutral-800 text-right w-16 py-0.5 px-1 rounded"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          R$ {((it.valor_unitario - it.desconto) * it.quantidade).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                            className="text-red-500 font-bold"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-neutral-600">Sem itens inseridos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Fees Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Desconto R$</label>
                <input
                  type="number"
                  value={desconto}
                  onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-right font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Frete R$</label>
                <input
                  type="number"
                  value={frete}
                  onChange={(e) => setFrete(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-right font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Acréscimo R$</label>
                <input
                  type="number"
                  value={acrescimo}
                  onChange={(e) => setAcrescimo(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-right font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 text-xs outline-none"
              ></textarea>
            </div>

            {/* Total Final summary */}
            <div className="bg-neutral-950 p-4 rounded-xl flex justify-between items-center">
              <span className="text-xs text-neutral-500 font-bold uppercase">Total Orçado</span>
              <span className="text-xl font-black text-emerald-400">{formatBRL(totalOrc)}</span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setItems([]);
                  setFrete(0);
                  setAcrescimo(0);
                  setDesconto(0);
                }}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Salvar Orçamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONVERT CONTEXT MODAL */}
      {convertingBudgetId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-200">⚡ Vincular Faturamento</h3>
            <p className="text-xs text-neutral-400">Selecione o vendedor que efetuou a negociação deste orçamento para comissionamento:</p>
            
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-500 uppercase font-bold">Vendedor</label>
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(parseInt(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300"
              >
                <option value={0}>Nenhum Vendedor</option>
                {sellers.map(v => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setConvertingBudgetId(null)}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={convertToSale}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Faturar PDV
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
