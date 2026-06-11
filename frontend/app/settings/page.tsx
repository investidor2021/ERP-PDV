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

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  tenant_code: string;
  created_at: string;
}

export default function SettingsPage() {
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [activeTab, setActiveTab] = useState<"CARTAO_CREDITO" | "CREDIARIO" | "USUARIOS">("CARTAO_CREDITO");
  const [loading, setLoading] = useState(true);

  // Form states for rates
  const [bandeira, setBandeira] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [taxaPercentual, setTaxaPercentual] = useState("");

  // User management states
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("USER");

  useEffect(() => {
    loadTaxas();
    checkAdminRole();
  }, []);

  function checkAdminRole() {
    const savedUser = localStorage.getItem("user_info");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setIsAdmin(parsed.role === "ADMIN");
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Reload users when switching to the users tab
  useEffect(() => {
    if (activeTab === "USUARIOS") {
      loadUsers();
    }
  }, [activeTab]);

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

  async function loadUsers() {
    try {
      setUserLoading(true);
      const res = await api.get("/auth/users");
      setUsers(res || []);
    } catch (err) {
      console.error("Erro ao carregar colaboradores:", err);
    } finally {
      setUserLoading(false);
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !userPassword) {
      alert("Nome, E-mail e Senha são obrigatórios.");
      return;
    }
    try {
      await api.post("/auth/users", {
        name: userName.trim(),
        username: userEmail.trim(),
        password: userPassword,
        role: userRole
      });
      alert("Colaborador cadastrado com sucesso!");
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("USER");
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Erro ao cadastrar colaborador.");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar o acesso deste colaborador?")) return;
    try {
      await api.delete(`/auth/users/${id}`);
      alert("Acesso removido com sucesso!");
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Erro ao remover acesso.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "USUARIOS") return;
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
          ⚙️ Configurações Gerais
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Defina as taxas operacionais para Cartão de Crédito, Juros do Crediário e gerencie usuários de acesso.
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
        {isAdmin && (
          <button
            onClick={() => setActiveTab("USUARIOS")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              activeTab === "USUARIOS"
                ? "border-emerald-500 text-emerald-400 font-extrabold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            👥 Usuários e Acessos
          </button>
        )}
      </div>

      {activeTab === "USUARIOS" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Form to Add Users */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-neutral-200 text-sm">👥 Novo Colaborador</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Ferreira"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: mariana@empresa.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Senha Temporária</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Cargo / Nível de Acesso</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium cursor-pointer transition"
                >
                  <option value="USER">OPERADOR (Vendedor / PDV)</option>
                  <option value="ADMIN">ADMIN (Acesso Completo)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-lg text-xs transition"
              >
                Cadastrar Colaborador
              </button>
            </form>
          </div>

          {/* Right Column: List of users */}
          <div className="xl:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-neutral-200 text-sm">Colaboradores Habilitados</h3>

            {userLoading ? (
              <p className="text-neutral-500 text-xs text-center py-12">Carregando colaboradores...</p>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                    <tr>
                      <th className="py-2.5 px-3">Nome</th>
                      <th className="py-2.5 px-3">E-mail de Login</th>
                      <th className="py-2.5 px-3 text-center">Nível</th>
                      <th className="py-2.5 px-3">Criado em</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-800/20 transition">
                        <td className="py-2.5 px-3 font-semibold text-neutral-100">{u.name}</td>
                        <td className="py-2.5 px-3">{u.username}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === "ADMIN" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50" : "bg-neutral-950 text-neutral-400 border border-neutral-800"
                          }`}>
                            {u.role === "ADMIN" ? "ADMIN" : "OPERADOR"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 hover:bg-neutral-800 text-red-400 hover:text-red-300 rounded text-[10px] font-bold transition"
                            title="Remover Acesso"
                          >
                            🗑️ Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-neutral-500 text-xs text-center py-12 font-medium">Nenhum usuário cadastrado.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Form to Add/Edit Rates */}
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
                    <div className="bg-neutral-950 px-4 py-2 border-b border-neutral-850 flex justify-between items-center">
                      <span className="text-xs font-black text-neutral-300 uppercase tracking-wide">
                        🏷️ {brand}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {groupedTaxas[brand].length} parcelamento(s) configurado(s)
                      </span>
                    </div>

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
      )}
    </div>
  );
}
