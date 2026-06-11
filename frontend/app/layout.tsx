import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SidebarLayout from "@/components/SidebarLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ERP PEPS | Gestão de Estoque e Vendas",
  description: "Sistema ERP profissional com controle de estoque FIFO/PEPS, PDV e Orçamentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-neutral-950 text-neutral-100 font-sans flex overflow-hidden">
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
