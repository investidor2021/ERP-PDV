"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Tenant {
  id: number;
  tenant_code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  admin_email: string | null;
  admin_name: string | null;
  db_size_kb: number;
}

interface Stats {
  total_tenants: number;
  active_tenants: number;
  inactive_tenants: number;
  total_db_size_kb: number;
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // New Company form states
  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantsRes, statsRes] = await Promise.all([
        api.get("/super-admin/tenants"),
        api.get("/super-admin/stats"),
      ]);
      setTenants(tenantsRes || []);
      setStats(statsRes || null);
      setError("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao carregar dados do painel SaaS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (tenant: Tenant) => {
    setActionLoading(tenant.id);
    try {
      const newStatus = !tenant.is_active;
      await api.put(`/super-admin/tenants/${tenant.tenant_code}/status`, { is_active: newStatus });
      // Update local state
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, is_active: newStatus } : t));
      // Reload stats
      const statsRes = await api.get("/super-admin/stats");
      setStats(statsRes);
    } catch (err: any) {
      alert(err.message || "Erro ao alterar status da licença.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      setModalError("Por favor, preencha todos os campos.");
      return;
    }

    setModalLoading(true);
    try {
      const res = await api.post("/super-admin/tenants", {
        company_name: companyName,
        admin_name: adminName,
        username: adminEmail,
        password: adminPassword,
      });

      setModalSuccess(`Empresa cadastrada! Código do Inquilino: ${res.tenant_code}`);
      setCompanyName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      
      // Reload everything
      await loadData();
      
      // Close modal after delay
      setTimeout(() => {
        setShowModal(false);
        setModalSuccess("");
      }, 2000);
    } catch (err: any) {
      setModalError(err.message || "Erro ao provisionar empresa.");
    } finally {
      setModalLoading(false);
    }
  };

  const formatSize = (kb: number) => {
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(2)} MB`;
    }
    return `${kb.toFixed(1)} KB`;
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  if (loading && tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-neutral-400 text-sm">Carregando painel administrativo SaaS...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-2">
            🏢 Controle SaaS & Licenças
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gere, ative, suspenda licenças e gerencie todos os bancos de dados dos clientes da plataforma.
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setModalError("");
            setModalSuccess("");
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-lg shadow-emerald-900/20"
        >
          ➕ Provisionar Nova Empresa
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="kpi-card bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total de Empresas</span>
            <div className="text-2xl font-black text-neutral-100 mt-2">{stats.total_tenants}</div>
          </div>
          <div className="kpi-card bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between border-l-emerald-500/50">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Empresas Ativas</span>
            <div className="text-2xl font-black text-emerald-400 mt-2">{stats.active_tenants}</div>
          </div>
          <div className="kpi-card bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between border-l-red-500/50">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Licenças Suspensas</span>
            <div className="text-2xl font-black text-red-400 mt-2">{stats.inactive_tenants}</div>
          </div>
          <div className="kpi-card bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Armazenamento Total</span>
            <div className="text-2xl font-black text-teal-400 mt-2">{formatSize(stats.total_db_size_kb)}</div>
          </div>
        </div>
      )}

      {/* Tenant Table Container */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-neutral-800/80 bg-neutral-900/50 flex justify-between items-center">
          <h3 className="font-bold text-sm text-neutral-200">Listagem de Inquilinos (Clientes Ativos)</h3>
          <span className="text-[10px] text-neutral-500 font-semibold">{tenants.length} empresas provisionadas</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 bg-neutral-950/20 font-semibold tracking-wider">
                <th className="p-4">Empresa</th>
                <th className="p-4">Código (slug)</th>
                <th className="p-4">Administrador</th>
                <th className="p-4 text-center">Tamanho BD</th>
                <th className="p-4">Data Cadastro</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-medium">
              {tenants.length > 0 ? (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-850/35 transition-colors">
                    <td className="p-4 font-bold text-neutral-100">{t.name}</td>
                    <td className="p-4 text-neutral-400 font-mono text-[11px]">{t.tenant_code}</td>
                    <td className="p-4 space-y-0.5">
                      <div className="text-neutral-300 font-bold">{t.admin_name || "N/A"}</div>
                      <div className="text-neutral-500 text-[10px]">{t.admin_email || "N/A"}</div>
                    </td>
                    <td className="p-4 text-center text-teal-400 font-semibold">{formatSize(t.db_size_kb)}</td>
                    <td className="p-4 text-neutral-400">{formatDate(t.created_at)}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.is_active
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : "bg-red-950 text-red-400 border border-red-900/40"
                        }`}
                      >
                        {t.is_active ? "ATIVO" : "SUSPENSO"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(t)}
                        disabled={actionLoading === t.id}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition border outline-none ${
                          t.is_active
                            ? "border-red-900/50 hover:bg-red-950/20 text-red-400"
                            : "border-emerald-800/50 hover:bg-emerald-950/20 text-emerald-400"
                        } disabled:opacity-50`}
                      >
                        {actionLoading === t.id
                          ? "Processando..."
                          : t.is_active
                          ? "⛔ Suspender"
                          : "✅ Ativar"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-600">
                    Nenhuma empresa cadastrada no SaaS.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-1.5">
                🏢 Novo Inquilino SaaS
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Ao salvar, o sistema provisionará automaticamente um banco SQLite dedicado e o respectivo administrador.
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-red-400 text-xs font-semibold">
                ⚠️ {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg text-emerald-400 text-xs font-semibold">
                🎉 {modalSuccess}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Padaria do Bairro Ltda"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Nome do Proprietário/Admin</label>
                <input
                  type="text"
                  required
                  placeholder="ex: João da Silva"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">E-mail Administrativo</label>
                <input
                  type="email"
                  required
                  placeholder="ex: admin@padaria.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Senha de Acesso Inicial</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-xs font-bold text-neutral-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {modalLoading ? "Processando..." : "Criar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
