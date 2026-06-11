"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTenant, setActiveTenant] = useState("default");
  const pathname = usePathname();

  // Load from localStorage on client mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
    const savedTenant = localStorage.getItem("active_tenant_id") || "default";
    setActiveTenant(savedTenant);
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
  };

  const handleTenantChange = (newTenant: string) => {
    localStorage.setItem("active_tenant_id", newTenant);
    setActiveTenant(newTenant);
    window.location.reload();
  };

  const navItems = [
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
            <Link href="/" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                📦 ERP PEPS
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium px-1.5 py-0.5 rounded">
                FIFO
              </span>
            </Link>
          ) : (
            <Link href="/" className="text-xl font-black text-emerald-400 mx-auto">
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

        {/* Tenant / Empresa Selector */}
        <div className="border-b border-neutral-800/80 shrink-0">
          {!isCollapsed ? (
            <div className="px-4 py-3 bg-neutral-950/20">
              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Empresa / Banco Ativo</label>
              <select
                value={activeTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 focus:border-emerald-500 rounded px-2.5 py-1.5 text-[11px] outline-none text-neutral-300 font-semibold cursor-pointer transition"
              >
                <option value="default">Matriz (Padrão)</option>
                <option value="empresa_a">Empresa A</option>
                <option value="empresa_b">Empresa B</option>
                <option value="empresa_c">Empresa C</option>
              </select>
            </div>
          ) : (
            <div 
              className="py-3 text-center text-xs font-black text-emerald-400 bg-neutral-950/20 cursor-pointer hover:bg-neutral-800/30 transition"
              title={`Empresa: ${activeTenant === "default" ? "Matriz (Padrão)" : activeTenant}`}
              onClick={() => {
                const choices = ["default", "empresa_a", "empresa_b", "empresa_c"];
                const nextIdx = (choices.indexOf(activeTenant) + 1) % choices.length;
                handleTenantChange(choices[nextIdx]);
              }}
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

        {/* Footer Info */}
        {!isCollapsed && (
          <div className="p-4 border-t border-neutral-800 text-[10px] text-neutral-500 text-center whitespace-nowrap overflow-hidden">
            ERP PEPS v1.1.0 &copy; 2026
          </div>
        )}
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
