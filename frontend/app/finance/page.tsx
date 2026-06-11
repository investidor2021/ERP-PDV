"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Client {
  id: number;
  nome_razao: string;
  cpf_cnpj: string;
  telefone?: string;
  whatsapp?: string;
}

interface Receivable {
  id: number;
  venda_id: number | null;
  cliente_id: number;
  valor: number;
  data_vencimento: string;
  situacao: string;
  saldo_devedor: number;
  taxa_valor?: number;
  valor_liquido?: number;
}

interface SettleLog {
  id: number;
  data_pagamento: string;
  valor_pago: number;
  forma_pagamento: string;
}

export default function FinancePage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedClientFilter, setSelectedClientFilter] = useState<number | "TODOS">("TODOS");
  const [statusFilter, setStatusFilter] = useState<"ABERTOS_VENCIDOS" | "VENCIDOS" | "PAGOS" | "TODOS">("ABERTOS_VENCIDOS");
  const [viewMode, setViewMode] = useState<"detalhado" | "devedores">("detalhado");

  // Settlement Form states
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [valorPago, setValorPago] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [settlingLogs, setSettlingLogs] = useState<SettleLog[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [recRes, cliRes] = await Promise.all([
        api.get("/finance/contas-receber"),
        api.get("/clients"),
      ]);
      setReceivables(recRes || []);
      setClients(cliRes || []);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros: ", err);
    } finally {
      setLoading(false);
    }
  }

  // Check if a title is overdue
  const isOverdue = (r: Receivable) => {
    return new Date(r.data_vencimento) < new Date() && r.situacao !== "PAGO";
  };

  // Filter logic
  const filteredReceivables = receivables.filter((r) => {
    // Client filter
    if (selectedClientFilter !== "TODOS" && r.cliente_id !== selectedClientFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === "ABERTOS_VENCIDOS" && r.situacao === "PAGO") return false;
    if (statusFilter === "VENCIDOS" && !isOverdue(r)) return false;
    if (statusFilter === "PAGOS" && r.situacao !== "PAGO") return false;

    return true;
  });

  // Consolidate debtors (Relatório Geral de Devedores)
  const consolidatedDebtors = clients.map((c) => {
    const clientTitles = receivables.filter((r) => r.cliente_id === c.id && r.situacao !== "PAGO");
    const totalOpen = clientTitles.reduce((sum, r) => sum + r.saldo_devedor, 0);
    const overdueTitles = clientTitles.filter((r) => isOverdue(r));
    const totalOverdue = overdueTitles.reduce((sum, r) => sum + r.saldo_devedor, 0);

    return {
      client: c,
      openTitlesCount: clientTitles.length,
      overdueTitlesCount: overdueTitles.length,
      totalOpen,
      totalOverdue,
    };
  }).filter((d) => d.openTitlesCount > 0) // Only show clients with outstanding debt
    .sort((a, b) => b.totalOpen - a.totalOpen); // Sort by highest debt first

  // Financial statistics calculated from active filtered list
  const totalOutstanding = filteredReceivables
    .filter(r => r.situacao !== "PAGO")
    .reduce((sum, r) => sum + r.saldo_devedor, 0);

  const totalOverdueAmount = filteredReceivables
    .filter(r => isOverdue(r))
    .reduce((sum, r) => sum + r.saldo_devedor, 0);

  const totalNetReceivable = filteredReceivables
    .filter(r => r.situacao !== "PAGO")
    .reduce((sum, r) => sum + (r.valor_liquido || r.saldo_devedor), 0);

  // Load payment logs for selected invoice
  const openSettlement = async (rec: Receivable) => {
    setSettlingId(rec.id);
    setValorPago(rec.saldo_devedor.toFixed(2));
    try {
      const logs = await api.get(`/finance/contas-receber/${rec.id}/logs`);
      setSettlingLogs(logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingId || !valorPago) return;

    try {
      await api.post(`/finance/contas-receber/${settlingId}/baixa`, {
        valor_pago: parseFloat(valorPago),
        forma_pagamento: formaPagamento,
      });
      alert("Baixa financeira efetuada com sucesso!");
      setSettlingId(null);
      setValorPago("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao efetuar baixa financeira.");
    }
  };

  const getStatusBadge = (r: Receivable) => {
    const s = r.situacao.toUpperCase();
    if (s === "PAGO") return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">PAGO</span>;
    if (s === "PARCIAL") return <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">PARCIAL</span>;
    if (isOverdue(r)) return <span className="bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">VENCIDO ⚠️</span>;
    return <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded text-[10px] font-bold">ABERTO</span>;
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const selectDebtor = (clientId: number) => {
    setSelectedClientFilter(clientId);
    setStatusFilter("ABERTOS_VENCIDOS");
    setViewMode("detalhado");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-2">
            💵 Gestão de Contas a Receber
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Controle cobranças, verifique históricos de devedores e realize baixas e amortizações.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-lg self-start md:self-center">
          <button
            onClick={() => setViewMode("detalhado")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
              viewMode === "detalhado"
                ? "bg-emerald-600 text-white font-extrabold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            📋 Títulos Detalhados
          </button>
          <button
            onClick={() => setViewMode("devedores")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
              viewMode === "devedores"
                ? "bg-emerald-600 text-white font-extrabold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            👥 Relatório Geral de Devedores
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <span className="text-[10px] text-neutral-500 font-black uppercase">Saldo Geral em Aberto</span>
          <div className="text-2xl font-black text-neutral-100 mt-1">
            {formatBRL(totalOutstanding)}
          </div>
          <span className="text-[9px] text-neutral-500 block mt-1">Soma de parcelas a receber pendentes</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl border-l-red-500/30">
          <span className="text-[10px] text-red-400/80 font-black uppercase">Total Vencido em Atraso</span>
          <div className="text-2xl font-black text-red-400 mt-1">
            {formatBRL(totalOverdueAmount)}
          </div>
          <span className="text-[9px] text-neutral-500 block mt-1">Cobranças com data de vencimento ultrapassada</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl border-l-teal-500/30">
          <span className="text-[10px] text-teal-400/80 font-black uppercase">Valor Líquido Estimado</span>
          <div className="text-2xl font-black text-teal-400 mt-1">
            {formatBRL(totalNetReceivable)}
          </div>
          <span className="text-[9px] text-neutral-500 block mt-1">Dedução de taxas de cartões e encargos</span>
        </div>
      </div>

      {/* Filter panel for detail view */}
      {viewMode === "detalhado" && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full md:w-auto">
            {/* Client selector */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[9px] text-neutral-500 font-bold uppercase">Filtrar por Cliente</label>
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-800 rounded py-1.5 px-3 text-xs text-neutral-300 font-medium outline-none focus:border-emerald-500"
              >
                <option value="TODOS">👥 Todos os Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_razao} ({c.cpf_cnpj})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-[9px] text-neutral-500 font-bold uppercase">Situação</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-neutral-950 border border-neutral-800 rounded py-1.5 px-3 text-xs text-neutral-300 font-medium outline-none focus:border-emerald-500"
              >
                <option value="ABERTOS_VENCIDOS">⚠️ Aberto / Parcial (Não pagos)</option>
                <option value="VENCIDOS">🚨 Apenas Vencidos</option>
                <option value="PAGOS">✅ Apenas Pagos</option>
                <option value="TODOS">🔍 Todos os Status</option>
              </select>
            </div>
          </div>

          {/* Quick Clear Filter */}
          {(selectedClientFilter !== "TODOS" || statusFilter !== "ABERTOS_VENCIDOS") && (
            <button
              onClick={() => {
                setSelectedClientFilter("TODOS");
                setStatusFilter("ABERTOS_VENCIDOS");
              }}
              className="text-xs text-neutral-400 hover:text-emerald-400 font-semibold self-start md:self-end py-1 px-3 border border-neutral-800 hover:border-emerald-900 rounded transition"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-neutral-500 text-xs text-center py-16">Carregando financeiro...</p>
        ) : viewMode === "detalhado" ? (
          /* Detailed Titles Table */
          filteredReceivables.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">ID / NF</th>
                    <th className="py-3 px-4">Cliente / Sacado</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4 text-right">Valor Bruto</th>
                    <th className="py-3 px-4 text-center">Taxa Adm</th>
                    <th className="py-3 px-4 text-right">Líquido Loja</th>
                    <th className="py-3 px-4 text-right">Saldo Devedor</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                  {filteredReceivables.map((r) => {
                    const cli = clients.find((c) => c.id === r.cliente_id);
                    return (
                      <tr key={r.id} className={`hover:bg-neutral-800/20 transition ${isOverdue(r) ? "bg-red-950/5" : ""}`}>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-400">REC#{r.id}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold block">{cli?.nome_razao || "Cliente Desconhecido"}</span>
                          <span className="text-[9px] text-neutral-500 block">
                            {cli?.telefone ? `📞 ${cli.telefone}` : ""} {cli?.whatsapp ? `💬 ${cli.whatsapp}` : ""}
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-medium ${isOverdue(r) ? "text-red-400" : "text-neutral-400"}`}>
                          {new Date(r.data_vencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-400">{formatBRL(r.valor)}</td>
                        <td className="py-3 px-4 text-center text-neutral-500 font-semibold">
                          {r.taxa_valor && r.taxa_valor > 0 ? (
                            <span className="text-amber-500">{formatBRL(r.taxa_valor)}</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-teal-400">
                          {r.valor_liquido !== undefined && r.valor_liquido !== null
                            ? formatBRL(r.valor_liquido)
                            : formatBRL(r.valor)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-neutral-100">
                          {formatBRL(r.saldo_devedor)}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(r)}</td>
                        <td className="py-3 px-4 text-center">
                          {r.situacao !== "PAGO" ? (
                            <button
                              onClick={() => openSettlement(r)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition text-[10px]"
                            >
                              Baixar / Receber
                            </button>
                          ) : (
                            <span className="text-neutral-500 text-[10px]">Liquidado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-xs text-center py-16">Nenhum recebível pendente encontrado para os filtros ativos.</p>
          )
        ) : (
          /* Consolidated Debtors Report */
          consolidatedDebtors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Devedor / Razão Social</th>
                    <th className="py-3 px-4">CPF / CNPJ</th>
                    <th className="py-3 px-4 text-center">Títulos Abertos</th>
                    <th className="py-3 px-4 text-center">Títulos Vencidos</th>
                    <th className="py-3 px-4 text-right">Valor Total Aberto</th>
                    <th className="py-3 px-4 text-right">Valor Total Vencido</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                  {consolidatedDebtors.map((d) => (
                    <tr key={d.client.id} className="hover:bg-neutral-800/20 transition">
                      <td className="py-3 px-4">
                        <span className="font-semibold block">{d.client.nome_razao}</span>
                        <span className="text-[9px] text-neutral-500 block">
                          {d.client.telefone ? `📞 ${d.client.telefone}` : ""} {d.client.whatsapp ? `💬 ${d.client.whatsapp}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-400 font-mono">{d.client.cpf_cnpj}</td>
                      <td className="py-3 px-4 text-center font-bold text-neutral-300">{d.openTitlesCount}</td>
                      <td className="py-3 px-4 text-center font-bold text-red-400">{d.overdueTitlesCount}</td>
                      <td className="py-3 px-4 text-right font-black text-neutral-100">{formatBRL(d.totalOpen)}</td>
                      <td className="py-3 px-4 text-right font-black text-red-400">{formatBRL(d.totalOverdue)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => selectDebtor(d.client.id)}
                          className="px-3 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded font-bold transition text-[10px]"
                        >
                          👁️ Histórico de Cobrança
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-xs text-center py-16">Nenhum cliente inadimplente na base atualmente.</p>
          )
        )}
      </div>

      {/* SETTLEMENT MODAL */}
      {settlingId !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-200">
                Baixar Recebimento: REC#{settlingId}
              </h3>
              <button
                onClick={() => setSettlingId(null)}
                className="text-neutral-400 hover:text-neutral-300 font-bold"
              >
                ×
              </button>
            </div>

            {/* Settle form */}
            <form onSubmit={handleSettle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 font-bold uppercase">Valor Pago R$</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 font-bold uppercase">Forma de Recebimento</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 text-xs text-neutral-300 outline-none focus:border-emerald-500"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão Débito">Cartão Débito</option>
                    <option value="Cartão Crédito">Cartão Crédito</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Transferência">Transferência Bancária</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition"
              >
                Registrar Amortização / Baixa
              </button>
            </form>

            {/* Payment history list */}
            <div className="space-y-3">
              <h4 className="text-[10px] text-neutral-500 uppercase font-bold border-b border-neutral-800 pb-1.5">Histórico de Quitações Parciais</h4>
              
              {settlingLogs.length > 0 ? (
                <div className="space-y-2">
                  {settlingLogs.map((log) => (
                    <div key={log.id} className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex justify-between text-xs">
                      <div>
                        <span className="font-semibold text-neutral-300">{log.forma_pagamento}</span>
                        <span className="text-[9px] text-neutral-500 block">{new Date(log.data_pagamento).toLocaleString("pt-BR")}</span>
                      </div>
                      <span className="font-bold text-emerald-400">{formatBRL(log.valor_pago)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-neutral-600 text-center py-4">Nenhuma amortização efetuada ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
