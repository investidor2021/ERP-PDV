"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DashboardSummary {
  vendas_dia: number;
  vendas_mes: number;
  lucro_mes: number;
  ticket_medio: number;
  contas_receber_abertas: number;
  contas_receber_vencidas: number;
}

interface TopProduct {
  nome: string;
  quantidade: number;
}

interface TopClient {
  nome: string;
  total: number;
}

interface DailyChartData {
  data: string;
  vendas: number;
  lucro: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [chartData, setChartData] = useState<DailyChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [sumRes, prodRes, clientRes, chartRes] = await Promise.all([
          api.get("/dashboard/summary"),
          api.get("/dashboard/top-products?limit=5"),
          api.get("/dashboard/top-clients?limit=5"),
          api.get("/dashboard/charts/sales-by-day?days=15"),
        ]);
        setSummary(sumRes);
        setTopProducts(prodRes || []);
        setTopClients(clientRes || []);
        setChartData(chartRes || []);
        setError("");
      } catch (err: any) {
        console.error(err);
        setError("Não foi possível conectar ao backend. Certifique-se de que o servidor FastAPI está rodando na porta 8000.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-neutral-400 text-sm">Carregando indicadores do ERP...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-xl max-w-2xl mx-auto mt-10">
        <h3 className="text-red-400 font-bold text-lg mb-2">Erro de Conectividade</h3>
        <p className="text-neutral-300 text-sm mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded-lg text-xs font-bold transition"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  // Find max value in chart to scale SVG chart heights
  const maxVal = Math.max(...chartData.map(d => Math.max(d.vendas, d.lucro)), 100);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
          📊 Dashboard Geral
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Visão consolidada do faturamento, lucros pelo método PEPS e saúde financeira do negócio.
        </p>
      </div>

      {/* KPI Cards Grid */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          <div className="kpi-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Vendas do Dia</span>
            <div className="text-xl font-extrabold text-neutral-100 mt-2">{formatBRL(summary.vendas_dia)}</div>
          </div>
          <div className="kpi-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Vendas do Mês</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-2">{formatBRL(summary.vendas_mes)}</div>
          </div>
          <div className="kpi-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Lucro Bruto (PEPS)</span>
            <div className="text-xl font-extrabold text-teal-400 mt-2">{formatBRL(summary.lucro_mes)}</div>
            <div className="text-[10px] text-neutral-500 mt-1">
              Margem: {summary.vendas_mes > 0 ? ((summary.lucro_mes / summary.vendas_mes) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="kpi-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Ticket Médio</span>
            <div className="text-xl font-extrabold text-neutral-100 mt-2">{formatBRL(summary.ticket_medio)}</div>
          </div>
          <div className="kpi-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Contas a Receber</span>
            <div className="text-xl font-extrabold text-neutral-100 mt-2">{formatBRL(summary.contas_receber_abertas)}</div>
          </div>
          <div className="kpi-card border-red-500/20 hover:border-red-500/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">A Receber Vencido</span>
            <div className="text-xl font-extrabold text-red-400 mt-2">{formatBRL(summary.contas_receber_vencidas)}</div>
            {summary.contas_receber_vencidas > 0 && (
              <div className="text-[9px] text-red-500 font-semibold mt-1">Requer Cobrança ⚠️</div>
            )}
          </div>
        </div>
      )}

      {/* Main Charts & Rankings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-neutral-100 text-lg">📈 Fluxo de Vendas & Lucros Diários</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Histórico dos últimos 15 dias de movimentação</p>
          </div>

          {chartData.length > 0 ? (
            <div className="h-64 mt-6 flex items-end justify-between gap-2 border-b border-neutral-800 pb-2">
              {chartData.map((d, i) => {
                const salesHeight = (d.vendas / maxVal) * 100;
                const profitHeight = (d.lucro / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 bg-neutral-950 border border-neutral-800 text-[10px] p-2 rounded shadow-xl hidden group-hover:block z-20 min-w-[120px]">
                      <div className="font-bold text-neutral-300">{d.data}</div>
                      <div className="text-emerald-400 mt-1">Vendas: {formatBRL(d.vendas)}</div>
                      <div className="text-teal-400">Lucro: {formatBRL(d.lucro)}</div>
                    </div>

                    {/* Bars Container */}
                    <div className="w-full flex items-end justify-center gap-[2px] h-full">
                      {/* Sales Bar */}
                      <div 
                        style={{ height: `${Math.max(salesHeight, 2)}%` }} 
                        className="w-1/2 bg-emerald-500 rounded-t-[2px] hover:bg-emerald-400 transition-all duration-300"
                      ></div>
                      {/* Profit Bar */}
                      <div 
                        style={{ height: `${Math.max(profitHeight, 2)}%` }} 
                        className="w-1/2 bg-teal-500 rounded-t-[2px] hover:bg-teal-400 transition-all duration-300"
                      ></div>
                    </div>
                    
                    {/* Date label */}
                    <span className="text-[9px] text-neutral-500 mt-2 block">{d.data}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-neutral-800 rounded-xl mt-6">
              <span className="text-neutral-600 text-xs">Sem dados de faturamento recentes</span>
            </div>
          )}

          {/* Chart Legends */}
          <div className="flex gap-4 mt-4 text-[10px] text-neutral-400 justify-end">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> Faturamento Total
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-teal-500 rounded"></span> Lucro PEPS
            </div>
          </div>
        </div>

        {/* Top items & Clients */}
        <div className="space-y-6">
          {/* Top Products */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-bold text-neutral-100 text-sm mb-4">🏆 Produtos Mais Vendidos</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/40 last:border-0">
                    <span className="text-neutral-300 truncate max-w-[200px]" title={p.nome}>{p.nome}</span>
                    <span className="font-bold text-emerald-400">{p.quantidade} un</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-600 text-center py-6">Nenhum produto vendido no período.</p>
            )}
          </div>

          {/* Top Clients */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-bold text-neutral-100 text-sm mb-4">👑 Clientes Mais Relevantes</h3>
            {topClients.length > 0 ? (
              <div className="space-y-3">
                {topClients.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/40 last:border-0">
                    <span className="text-neutral-300 truncate max-w-[200px]" title={c.nome}>{c.nome}</span>
                    <span className="font-bold text-teal-400">{formatBRL(c.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-600 text-center py-6">Nenhuma compra registrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
