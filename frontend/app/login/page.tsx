"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Clear any residual session on loading login page
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { username, password });
      if (res && res.access_token) {
        localStorage.setItem("auth_token", res.access_token);
        localStorage.setItem("user_info", JSON.stringify(res.user));
        // Redirect to main page
        window.location.href = "/";
      } else {
        setError("Resposta de autenticação inválida.");
      }
    } catch (err: any) {
      setError(err.message || "E-mail ou senha incorretos.");
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
          <div className="text-4xl">📦</div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            ERP PEPS
          </h1>
          <p className="text-xs text-neutral-400">
            Acesse a conta de sua empresa para gerenciar estoque e faturamento.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-3 rounded-lg text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">E-mail de Acesso</label>
            <input
              type="email"
              required
              placeholder="exemplo@empresa.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 transition font-medium"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Senha</label>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
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
            {loading ? "Autenticando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="border-t border-neutral-800/80 pt-4 text-center">
          <p className="text-xs text-neutral-400">
            Nova empresa por aqui?{" "}
            <Link href="/register" className="text-emerald-400 hover:underline font-bold transition">
              Cadastre sua Empresa
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
