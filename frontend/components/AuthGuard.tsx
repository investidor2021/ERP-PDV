"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const isPublicPath = pathname === "/login" || pathname === "/register";

    if (!token && !isPublicPath) {
      setAuthorized(false);
      window.location.href = "/login";
    } else {
      setAuthorized(true);
    }
  }, [pathname]);

  const isPublicPath = pathname === "/login" || pathname === "/register";

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (!authorized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-400 text-xs font-semibold">
        Carregando sessão...
      </div>
    );
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}
