"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Taxa {
  id: number;
  tipo: "CARTAO_CREDITO" | "CREDIARIO";
  bandeira: string;
  parcelas: number;
  taxa_percentual: number;
}

export default function SettingsPage() {
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [activeTab, setActiveTab] = useState<"CARTAO_CREDITO" | "CREDIARIO">("CARTAO_CREDITO");
  const [loading, setLoading] = useState(true);

  // Form states
  const [bandeira, setBandeira] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [taxaPercentual, setTaxaPercentual] = useState("");

  useEffect(() => {
    loadTaxas();
  }, []);

  async function loadTaxas() {
    try {
      setLoading(true);
      const res = await api.get("/settings/taxas");
      setTaxas(res || []);
    } catch (err) {
      console.error("Erro ao carregar taxas: ", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bandeira || !parcelas || taxaPercentual === "") return;

    try {
      const payload = {
        tipo: activeTab,
        bandeira: bandeira.trim(),
        parcelas: Number(parcelas),
        taxa_percentual: parseFloat(taxaPercentual.replace(",", ".")),
      };

      await api.post("/settings/taxas", payload);
      alert("Taxa configurada com sucesso!");
      
      // Reset form
      setBandeira("");
      setParcelas(1);
      setTaxaPercentual("");
      
      loadTaxas();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar configuração de taxa.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta taxa configurada?")) return;

    try {
      await api.delete(`/settings/taxas/${id}`);
      loadTaxas();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir taxa.");
    }
  };

  // Filter based on active tab
  const filteredTaxas = taxas.filter((t) => t.tipo === activeTab);

  // Group by brand for cleaner visualization
  const groupedTaxas: { [brand: string]: Taxa[] } = {};
  filteredTaxas.forEach((t) => {
    if (!groupedTaxas[t.bandeira]) {
      groupedTaxas[t.bandeira] = [];
    }
    groupedTaxas[t.bandeira].push(t);
  });
  // Sort parcelas inside groups
  Object.keys(groupedTaxas).forEach((brand) => {
    groupedTaxas[brand].sort((a, b) => a.parcelas - b.parcelas);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-2">
          ⚙️ Configurações de Taxas
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Defina as taxas administrativas para Cartão de Crédito e taxas de juros para Crediário de acordo com as parcelas.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800 pb-px shrink-0">
        <button
          onClick={() => setActiveTab("CARTAO_CREDITO")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === "CARTAO_CREDITO"
              ? "border-emerald-500 text-emerald-400 font-extrabold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          💳 Cartão de Crédito (Taxas Adm)
        </button>
        <button
          onClick={() => setActiveTab("CREDIARIO")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === "CREDIARIO"
              ? "border-emerald-500 text-emerald-400 font-extrabold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          📋 Crediário / A Prazo (Juros)
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Form to Add/Edit */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-neutral-200 text-sm">
            Configurar Nova Taxa para {activeTab === "CARTAO_CREDITO" ? "Cartão" : "Crediário"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Brand/Descriptor */}
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">
                {activeTab === "CARTAO_CREDITO" ? "Bandeira / Adquirente" : "Nome do Crediário"}
              </label>
              <input
                type="text"
                required
                placeholder={activeTab === "CARTAO_CREDITO" ? "Ex: Visa, Mastercard, Cielo" : "Ex: Crediário Loja, Boleto 30d"}
                value={bandeira}
                onChange={(e) => setBandeira(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
              />
            </div>

            {/* Installments and Tax rate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Parcelas</label>
                <select
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Taxa %</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2,99"
                  value={taxaPercentual}
                  onChange={(e) => setTaxaPercentual(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-bold transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-lg text-xs transition"
            >
              Salvar Configuração
            </button>
          </form>

          <div className="text-[11px] text-neutral-500 bg-neutral-950/40 p-3 rounded border border-neutral-850 space-y-1.5">
            <p className="font-semibold text-neutral-400">Como funciona?</p>
            {activeTab === "CARTAO_CREDITO" ? (
              <p>As taxas configuradas aqui serão descontadas dos seus recebíveis gerados no PDV, informando no Contas a Receber o valor bruto e o valor líquido que você realmente vai receber.</p>
            ) : (
              <p>As taxas do crediário servem como juros de parcelamento. No PDV, você terá a opção de repassar essa taxa ao cliente (adicionando como acréscimo) ou assumir o custo (reduzindo o valor líquido do seu caixa).</p>
            )}
          </div>
        </div>

        {/* Right Columns: List of configured rates */}
        <div className="xl:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-neutral-200 text-sm">
            Taxas Ativas para {activeTab === "CARTAO_CREDITO" ? "Cartão de Crédito" : "Crediário"}
          </h3>

          {loading ? (
            <p className="text-neutral-500 text-xs text-center py-12">Carregando configurações...</p>
          ) : Object.keys(groupedTaxas).length > 0 ? (
            <div className="space-y-6">
              {Object.keys(groupedTaxas).map((brand) => (
                <div key={brand} className="border border-neutral-850 rounded-xl overflow-hidden bg-neutral-950/20">
                  {/* Brand header banner */}
                  <div className="bg-neutral-950 px-4 py-2 border-b border-neutral-850 flex justify-between items-center">
                    <span className="text-xs font-black text-neutral-300 uppercase tracking-wide">
                      🏷️ {brand}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {groupedTaxas[brand].length} parcelamento(s) configurado(s)
                    </span>
                  </div>

                  {/* Installment list grid */}
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {groupedTaxas[brand].map((t) => (
                      <div
                        key={t.id}
                        className="bg-neutral-900 border border-neutral-800/80 p-2.5 rounded-lg flex justify-between items-center text-xs group hover:border-neutral-750 transition"
                      >
                        <div>
                          <span className="font-extrabold text-neutral-200 block">{t.parcelas}x</span>
                          <span className="text-[10px] text-emerald-400 font-bold">{t.taxa_percentual.toFixed(2)}% taxa</span>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-500 hover:text-red-400 font-bold px-1.5 opacity-0 group-hover:opacity-100 transition"
                          title="Excluir taxa"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-neutral-600 space-y-2">
              <span className="text-3xl">⚙️</span>
              <p className="text-xs">Nenhuma taxa de {activeTab === "CARTAO_CREDITO" ? "cartão" : "crediário"} configurada ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
