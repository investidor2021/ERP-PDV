"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !adminName || !username || !password) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register-company", {
        company_name: companyName,
        admin_name: adminName,
        username,
        password
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao registrar empresa. Tente outro e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-neutral-950 font-sans p-4">
      {/* Background design elements */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">🏢</div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Criar Conta ERP PEPS
          </h1>
          <p className="text-xs text-neutral-400">
            Cadastre sua empresa e comece a gerenciar seu negócio com banco de dados 100% isolado.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-3 rounded-lg text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4 text-center">
            <div className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-lg font-medium space-y-1">
              <p className="font-bold">Empresa cadastrada com sucesso!</p>
              <p className="text-[10px] text-neutral-400">O banco de dados de sua organização foi inicializado e já está pronto para uso.</p>
            </div>
            <Link
              href="/login"
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs text-center font-bold py-2.5 rounded-lg transition"
            >
              Ir para Tela de Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Nome da Empresa *</label>
              <input
                type="text"
                required
                placeholder="Ex: Minha Loja LTDA"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Seu Nome Completo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Andrade"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">E-mail do Administrador *</label>
              <input
                type="email"
                required
                placeholder="carlos@empresa.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Senha de Acesso *</label>
              <input
                type="password"
                required
                placeholder="Escolha uma senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold py-2.5 rounded-lg transition"
            >
              {loading ? "Criando Banco de Dados..." : "Criar Minha Empresa"}
            </button>
          </form>
        )}

        {!success && (
          <div className="border-t border-neutral-800/80 pt-4 text-center">
            <p className="text-xs text-neutral-400">
              Já possui uma empresa cadastrada?{" "}
              <Link href="/login" className="text-emerald-400 hover:underline font-bold transition">
                Fazer Login
              </Link>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
