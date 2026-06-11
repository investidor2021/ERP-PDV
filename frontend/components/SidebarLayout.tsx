"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface UserSession {
  name: string;
  username: string;
  role: string;
  tenant_code: string;
  company_name: string;
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserSession | null>(null);
  const pathname = usePathname();

  // Load configuration and user session on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
    const savedUser = localStorage.getItem("user_info");
    if (savedUser) {
      try {
        setUserInfo(JSON.parse(savedUser));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    window.location.href = "/login";
  };

  const navItems = userInfo?.role === "SUPER_ADMIN"
    ? [
        { href: "/super-admin", label: "Controle SaaS", icon: "🏢" },
        { href: "/settings", label: "Configurações", icon: "⚙️" },
      ]
    : [
        { href: "/", label: "Dashboard Geral", icon: "📊" },
        { href: "/pdv", label: "Venda Rápida (PDV)", icon: "⚡", bold: true },
        { href: "/products", label: "Catálogo & Lotes", icon: "📦" },
        { href: "/services", label: "Cadastro de Serviços", icon: "🛠️" },
        { href: "/clients", label: "Cadastro de Clientes", icon: "👥" },
        { href: "/budgets", label: "Orçamentos", icon: "📋" },
        { href: "/sales", label: "Histórico de Vendas", icon: "🔄" },
        { href: "/finance", label: "Contas a Receber", icon: "💵" },
        { href: "/reports", label: "Relatórios & Logs", icon: "📉" },
        { href: "/settings", label: "Configurações", icon: "⚙️" },
      ];

  return (
    <div className="h-full flex overflow-hidden w-full">
      {/* Sidebar */}
      <aside
        className={`bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Logo and Collapse Toggle */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800 shrink-0">
          {!isCollapsed ? (
            <Link href={userInfo?.role === "SUPER_ADMIN" ? "/super-admin" : "/"} className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                📦 ERP PEPS
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium px-1.5 py-0.5 rounded">
                FIFO
              </span>
            </Link>
          ) : (
            <Link href={userInfo?.role === "SUPER_ADMIN" ? "/super-admin" : "/"} className="text-xl font-black text-emerald-400 mx-auto">
              📦
            </Link>
          )}

          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg hover:bg-neutral-800 transition"
              title="Ocultar Menu"
            >
              ◀
            </button>
          )}
        </div>

        {/* User Session Info / Enterprise Name */}
        <div className="border-b border-neutral-800/80 shrink-0">
          {!isCollapsed ? (
            userInfo?.role === "SUPER_ADMIN" ? (
              <div className="px-4 py-3 bg-neutral-950/25 flex flex-col space-y-1">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Sistema SaaS</span>
                <span className="text-xs font-bold text-emerald-400 truncate max-w-full" title="Painel Geral (SaaS)">
                  🏢 Painel Geral (SaaS)
                </span>
                <span className="text-[10px] text-neutral-400 truncate max-w-full mt-0.5">
                  👤 {userInfo?.name || "Operador"} (Super Admin)
                </span>
              </div>
            ) : (
              <div className="px-4 py-3 bg-neutral-950/25 flex flex-col space-y-1">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Empresa Conectada</span>
                <span className="text-xs font-bold text-emerald-400 truncate max-w-full" title={userInfo?.company_name || "Matriz (Padrão)"}>
                  🏢 {userInfo?.company_name || "Matriz (Padrão)"}
                </span>
                <span className="text-[10px] text-neutral-400 truncate max-w-full mt-0.5">
                  👤 {userInfo?.name || "Operador"} ({userInfo?.role === "ADMIN" ? "Admin" : "Usuário"})
                </span>
              </div>
            )
          ) : (
            <div 
              className="py-3 text-center text-xs font-black text-emerald-400 bg-neutral-950/20 cursor-pointer hover:bg-neutral-850 transition"
              title={userInfo?.role === "SUPER_ADMIN" ? "Painel Geral (SaaS) \nOperador: Super Admin" : `Empresa: ${userInfo?.company_name || "Matriz (Padrão)"} \nOperador: ${userInfo?.name || "Operador"}`}
            >
              🏢
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? item.bold
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-neutral-800 text-emerald-400 font-semibold"
                    : item.bold
                    ? "bg-emerald-600/5 text-emerald-500/80 border border-emerald-500/10 hover:bg-emerald-600/15"
                    : "text-neutral-300 hover:bg-neutral-850 hover:text-emerald-400"
                } ${isCollapsed ? "justify-center" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <span className="overflow-hidden whitespace-nowrap text-ellipsis">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Toggle when Collapsed */}
        {isCollapsed && (
          <div className="p-3 border-t border-neutral-800 flex justify-center shrink-0">
            <button
              onClick={toggleSidebar}
              className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg hover:bg-neutral-800 transition"
              title="Expandir Menu"
            >
              ▶
            </button>
          </div>
        )}

        {/* Footer Info & Logout */}
        <div className="border-t border-neutral-800 shrink-0 p-2 space-y-1">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Sair do Sistema"
          >
            <span className="text-sm shrink-0">🚪</span>
            {!isCollapsed && <span>Sair / Logout</span>}
          </button>
          {!isCollapsed && (
            <div className="text-[9px] text-neutral-600 text-center pt-1 block">
              ERP PEPS v1.2.0 SaaS &copy; 2026
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
        <div className="flex-1 overflow-y-auto p-8 relative w-full">
          {/* Collapsed floating toggle trigger */}
          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="absolute top-4 left-4 z-40 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-emerald-400 hover:border-emerald-800 p-2 rounded-lg text-xs font-bold transition shadow-xl flex items-center justify-center gap-1.5"
              title="Exibir Menu"
            >
              ▶ <span className="text-[10px]">Menu</span>
            </button>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
