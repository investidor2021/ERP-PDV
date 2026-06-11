"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface Product {
  id: number;
  codigo: string;
  codigo_barras: string | null;
  descricao: string;
  unidade: string;
  ncm: string | null;
  estoque_atual: number;
  preco_venda: number;
}

interface Service {
  id: number;
  codigo: string;
  descricao: string;
  valor_padrao: number;
  categoria: string | null;
}

interface Client {
  id: number;
  nome_razao: string;
  cpf_cnpj: string;
}

interface Seller {
  id: number;
  nome: string;
  comissao_percentual: number;
}

interface CartItem {
  id: string; // unique cart uuid
  tipo_item: "PRODUTO" | "SERVICO";
  produto_id?: number;
  servico_id?: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto: number; // unit discount
  estoque_disponivel?: number;
}

export default function PDVPage() {
  // Master lists
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);

  // Selection states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [selectedSeller, setSelectedSeller] = useState<number>(0);
  
  // Search inputs
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{tipo: "PRODUTO" | "SERVICO", id: number, label: string}[]>([]);
  const [barcodeQuery, setBarcodeQuery] = useState("");

  // Payment inputs
  const [frete, setFrete] = useState(0);
  const [acrescimo, setAcrescimo] = useState(0);
  const [descontoVenda, setDescontoVenda] = useState(0);

  // Múltiplos pagamentos
  const [pagamentosLançados, setPagamentosLançados] = useState<{forma_pagamento: string, valor: number, data_vencimento?: string, parcelas?: number, bandeira?: string, taxa_percentual?: number, repassado?: boolean, taxa_valor_repassado?: number}[]>([]);
  const [formaAtual, setFormaAtual] = useState("PIX");
  const [valorPagamentoAtual, setValorPagamentoAtual] = useState(0);
  const [dataVencimentoAtual, setDataVencimentoAtual] = useState("");

  // Configurações de taxas
  const [taxasConfig, setTaxasConfig] = useState<any[]>([]);
  const [selectedBandeira, setSelectedBandeira] = useState("");
  const [selectedParcelas, setSelectedParcelas] = useState(1);
  const [taxaPercentualAtual, setTaxaPercentualAtual] = useState(0);
  const [repassarTaxa, setRepassarTaxa] = useState(false);

  // Modal / Success summary
  const [successVenda, setSuccessVenda] = useState<any | null>(null);
  const [errorVenda, setErrorVenda] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load masters on startup
  useEffect(() => {
    async function loadData() {
      try {
        const [prodList, servList, clientList, sellerList, taxasList] = await Promise.all([
          api.get("/products"),
          api.get("/services"),
          api.get("/clients"),
          api.get("/sales/vendedores"),
          api.get("/settings/taxas"),
        ]);
        setProducts(prodList || []);
        setServices(servList || []);
        setClients(clientList || []);
        setSellers(sellerList || []);
        setTaxasConfig(taxasList || []);

        // Set default client if exists
        const defaultCli = (clientList || []).find((c: Client) => c.nome_razao.includes("Consumidor Final") || c.cpf_cnpj === "99999999999");
        if (defaultCli) setSelectedClient(defaultCli.id);
        else if (clientList && clientList.length > 0) setSelectedClient(clientList[0].id);

        // Set default seller
        if (sellerList && sellerList.length > 0) setSelectedSeller(sellerList[0].id);

        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      } catch (err) {
        console.error("Erro ao carregar dados do PDV: ", err);
      }
    }
    loadData();
  }, []);

  // Sync available brands when payment method changes
  useEffect(() => {
    const tipo = formaAtual === "Cartão Crédito" ? "CARTAO_CREDITO" : formaAtual === "Crediário" ? "CREDIARIO" : null;
    if (tipo) {
      const filtered = taxasConfig.filter(t => t.tipo === tipo);
      const uniqueBandeiras = Array.from(new Set(filtered.map(t => t.bandeira))) as string[];
      if (uniqueBandeiras.length > 0) {
        setSelectedBandeira(uniqueBandeiras[0]);
      } else {
        setSelectedBandeira("");
      }
    } else {
      setSelectedBandeira("");
      setSelectedParcelas(1);
      setTaxaPercentualAtual(0);
      setRepassarTaxa(false);
    }
  }, [formaAtual, taxasConfig]);

  // Update available installments and current tax percentage when brand changes
  useEffect(() => {
    const tipo = formaAtual === "Cartão Crédito" ? "CARTAO_CREDITO" : formaAtual === "Crediário" ? "CREDIARIO" : null;
    if (tipo && selectedBandeira) {
      const filtered = taxasConfig.filter(t => t.tipo === tipo && t.bandeira === selectedBandeira);
      const sorted = [...filtered].sort((a, b) => a.parcelas - b.parcelas);
      if (sorted.length > 0) {
        const exists = sorted.some(s => s.parcelas === selectedParcelas);
        if (!exists) {
          setSelectedParcelas(sorted[0].parcelas);
          setTaxaPercentualAtual(sorted[0].taxa_percentual);
        } else {
          const matched = sorted.find(s => s.parcelas === selectedParcelas);
          setTaxaPercentualAtual(matched ? matched.taxa_percentual : 0);
        }
      } else {
        setSelectedParcelas(1);
        setTaxaPercentualAtual(0);
      }
    } else {
      setTaxaPercentualAtual(0);
    }
  }, [selectedBandeira, selectedParcelas, formaAtual, taxasConfig]);

  // Update payment amount default on cart change
  const subtotal = cart.reduce((sum, item) => sum + (item.valor_unitario - item.desconto) * item.quantidade, 0);
  const totalFinal = subtotal - descontoVenda + frete + acrescimo;
  const totalPagoLançado = pagamentosLançados.reduce((sum, p) => sum + p.valor, 0);
  const valorRestante = Math.max(totalFinal - totalPagoLançado, 0);

  useEffect(() => {
    setValorPagamentoAtual(parseFloat(valorRestante.toFixed(2)));
    // Set default due date as D+30
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDataVencimentoAtual(d.toISOString().substring(0, 10));
  }, [totalFinal, pagamentosLançados]);

  // Search product or service logic
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    
    const matchedProducts = products
      .filter(p => p.descricao.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query))
      .map(p => ({
        tipo: "PRODUTO" as const,
        id: p.id,
        label: `📦 ${p.codigo} - ${p.descricao} (Estoque: ${p.estoque_atual} | R$ ${p.preco_venda.toFixed(2)})`
      }));

    const matchedServices = services
      .filter(s => s.descricao.toLowerCase().includes(query) || s.codigo.toLowerCase().includes(query))
      .map(s => ({
        tipo: "SERVICO" as const,
        id: s.id,
        label: `🛠️ ${s.codigo} - ${s.descricao} (R$ ${s.valor_padrao.toFixed(2)})`
      }));

    setSearchResults([...matchedProducts, ...matchedServices].slice(0, 10));
  }, [searchQuery, products, services]);

  // Handle barcode submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    // Search product by barcode or SKU
    const match = products.find(p => p.codigo_barras === barcodeQuery || p.codigo.toLowerCase() === barcodeQuery.toLowerCase());
    if (match) {
      addItemToCart("PRODUTO", match.id);
      setBarcodeQuery("");
    } else {
      alert(`Código/EAN "${barcodeQuery}" não encontrado.`);
    }
  };

  // Add selected item to cart
  const addItemToCart = (tipo: "PRODUTO" | "SERVICO", id: number) => {
    const isProd = tipo === "PRODUTO";
    const cartItemId = `${tipo}-${id}`;

    // Check if already in cart
    const existing = cart.find(item => item.id === cartItemId);
    if (existing) {
      updateQuantity(cartItemId, existing.quantidade + 1);
      return;
    }

    if (isProd) {
      const p = products.find(p => p.id === id);
      if (p) {
        setCart([
          ...cart,
          {
            id: cartItemId,
            tipo_item: "PRODUTO",
            produto_id: p.id,
            codigo: p.codigo,
            descricao: p.descricao,
            quantidade: 1,
            unidade: p.unidade,
            valor_unitario: p.preco_venda,
            desconto: 0,
            estoque_disponivel: p.estoque_atual
          }
        ]);
      }
    } else {
      const s = services.find(s => s.id === id);
      if (s) {
        setCart([
          ...cart,
          {
            id: cartItemId,
            tipo_item: "SERVICO",
            servico_id: s.id,
            codigo: s.codigo,
            descricao: s.descricao,
            quantidade: 1,
            unidade: "UN",
            valor_unitario: s.valor_padrao,
            desconto: 0
          }
        ]);
      }
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  // Modify cart quantity
  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    setCart(
      cart.map(item => {
        if (item.id === id) {
          if (item.tipo_item === "PRODUTO" && item.estoque_disponivel !== undefined && qty > item.estoque_disponivel) {
            alert(`Estoque físico indisponível! Estoque atual: ${item.estoque_disponivel} un.`);
            return item;
          }
          return { ...item, quantidade: qty };
        }
        return item;
      })
    );
  };

  // Modify item unit discount
  const updateItemDiscount = (id: string, desc: number) => {
    if (desc < 0) return;
    setCart(
      cart.map(item => {
        if (item.id === id) {
          if (desc > item.valor_unitario) return item;
          return { ...item, desconto: desc };
        }
        return item;
      })
    );
  };

  // Remove cart item
  const removeCartItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Add payments to split lists
  const lançarPagamento = () => {
    if (valorPagamentoAtual <= 0) return;
    
    const requiresDate = !["Dinheiro", "PIX", "Cartão Débito"].includes(formaAtual);
    const isCreditOrCrediario = ["Cartão Crédito", "Crediário"].includes(formaAtual);

    let finalVal = valorPagamentoAtual;
    let taxaVal = 0.0;
    
    if (isCreditOrCrediario && taxaPercentualAtual > 0) {
      taxaVal = parseFloat((valorPagamentoAtual * (taxaPercentualAtual / 100)).toFixed(2));
      if (repassarTaxa) {
        // Add to acréscimo
        setAcrescimo(prev => parseFloat((prev + taxaVal).toFixed(2)));
        finalVal = parseFloat((valorPagamentoAtual + taxaVal).toFixed(2));
      }
    }

    setPagamentosLançados([
      ...pagamentosLançados,
      {
        forma_pagamento: formaAtual,
        valor: finalVal,
        data_vencimento: requiresDate ? dataVencimentoAtual : undefined,
        parcelas: isCreditOrCrediario ? selectedParcelas : 1,
        bandeira: isCreditOrCrediario ? selectedBandeira || undefined : undefined,
        taxa_percentual: isCreditOrCrediario ? taxaPercentualAtual : 0.0,
        repassado: isCreditOrCrediario ? repassarTaxa : false,
        taxa_valor_repassado: isCreditOrCrediario && repassarTaxa ? taxaVal : 0.0
      }
    ]);

    // Reset settings
    setRepassarTaxa(false);
  };

  // Remove payments
  const removerPagamento = (index: number) => {
    const p = pagamentosLançados[index];
    if (p && p.repassado && p.taxa_valor_repassado) {
      setAcrescimo(prev => Math.max(0, parseFloat((prev - (p.taxa_valor_repassado || 0)).toFixed(2))));
    }
    setPagamentosLançados(pagamentosLançados.filter((_, i) => i !== index));
  };

  // Clear PDV
  const resetPDV = () => {
    setCart([]);
    setPagamentosLançados([]);
    setFrete(0);
    setAcrescimo(0);
    setDescontoVenda(0);
    setSuccessVenda(null);
    setErrorVenda("");
    setSearchQuery("");
    setBarcodeQuery("");
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  // Submit sale to API
  const finalizarVenda = async () => {
    if (cart.length === 0) {
      alert("Adicione pelo menos um item ao carrinho.");
      return;
    }

    if (totalPagoLançado < totalFinal - 0.01) {
      alert("O total dos pagamentos lançados é inferior ao valor final da venda.");
      return;
    }

    setIsSubmitting(true);
    setErrorVenda("");

    const payload = {
      cliente_id: selectedClient,
      vendedor_id: selectedSeller || null,
      observacoes: "Venda rápida no PDV",
      itens: cart.map(item => ({
        tipo_item: item.tipo_item,
        produto_id: item.produto_id || null,
        servico_id: item.servico_id || null,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        desconto: item.desconto
      })),
      pagamentos: pagamentosLançados.map(p => ({
        forma_pagamento: p.forma_pagamento,
        valor: p.valor,
        data_vencimento: p.data_vencimento || null,
        parcelas: p.parcelas || 1,
        bandeira: p.bandeira || null,
        taxa_percentual: p.taxa_percentual || 0.0
      })),
      frete,
      acrescimo,
      desconto: descontoVenda
    };

    try {
      const response = await api.post("/sales", payload);
      
      // Calculate profit real using PEPS returned totals
      const custoTotalPEPS = response.itens
        .filter((it: any) => it.tipo_item === "PRODUTO")
        .reduce((sum: number, it: any) => sum + it.custo_peps_total, 0);

      const subtotalVendido = response.total_final;
      const lucroBruto = subtotalVendido - custoTotalPEPS;
      const margem = subtotalVendido > 0 ? (lucroBruto / subtotalVendido) * 100 : 0.0;

      setSuccessVenda({
        numero: response.numero_venda,
        total: subtotalVendido,
        custo_peps: custoTotalPEPS,
        lucro: lucroBruto,
        margem: margem,
        pagamentos: response.pagamentos
      });
      
      // Reload products catalog stock values
      const updatedProds = await api.get("/products");
      setProducts(updatedProds || []);
    } catch (err: any) {
      console.error(err);
      setErrorVenda(err.message || "Erro desconhecido ao finalizar venda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* PDV Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-2">
            ⚡ PDV Venda Rápida
          </h1>
          <p className="text-xs text-neutral-400">
            Faturamento simplificado de balcão com controle de lotes PEPS (FIFO) automático.
          </p>
        </div>
        <button
          onClick={resetPDV}
          className="px-4 py-2 border border-neutral-800 hover:bg-neutral-800 text-xs font-bold rounded-lg transition"
        >
          Limpar Tela (Esc)
        </button>
      </div>

      {/* Main PDV split grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Columns: Search, Barcode reader and Cart list */}
        <div className="xl:col-span-2 flex flex-col space-y-4 min-h-0">
          
          {/* Inputs Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            {/* Barcode Form */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="🔍 Código de Barras / SKU..."
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2.5 px-4 text-xs font-semibold placeholder-neutral-500 outline-none transition"
              />
              <button type="submit" className="absolute right-3 top-2.5 text-xs text-neutral-500">⏎</button>
            </form>

            {/* General Description Search */}
            <div className="relative md:col-span-2">
              <input
                type="text"
                placeholder="🔎 Digite a descrição do produto ou serviço..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2.5 px-4 text-xs font-semibold placeholder-neutral-500 outline-none transition"
              />
              
              {/* Dropdown results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-neutral-800">
                  {searchResults.map((res) => (
                    <button
                      key={`${res.tipo}-${res.id}`}
                      onClick={() => addItemToCart(res.tipo, res.id)}
                      className="w-full text-left px-4 py-3 text-xs hover:bg-neutral-800 text-neutral-200 transition"
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table Container */}
          <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Cód / SKU</th>
                    <th className="py-3 px-4">Item / Descrição</th>
                    <th className="py-3 px-4 text-center">Qtd</th>
                    <th className="py-3 px-4 text-right">Preço Unit.</th>
                    <th className="py-3 px-4 text-right">Desc (Un.)</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Excluir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {cart.length > 0 ? (
                    cart.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-mono text-neutral-400">{item.codigo}</td>
                        <td className="py-3 px-4 font-medium text-neutral-200">
                          {item.tipo_item === "PRODUTO" ? "📦" : "🛠️"} {item.descricao}
                          {item.tipo_item === "PRODUTO" && (
                            <span className="text-[10px] text-neutral-500 block">Estoque Fis.: {item.estoque_disponivel} {item.unidade}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantidade}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="bg-neutral-950 border border-neutral-800 text-center w-14 py-1 rounded text-xs outline-none focus:border-emerald-500 transition"
                          />
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-300">R$ {item.valor_unitario.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.desconto}
                            onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                            className="bg-neutral-950 border border-neutral-800 text-right w-16 py-1 px-1 rounded text-xs outline-none focus:border-emerald-500 transition"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-neutral-100">
                          R$ {((item.valor_unitario - item.desconto) * item.quantidade).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => removeCartItem(item.id)}
                            className="text-red-500 hover:text-red-400 text-base font-bold transition px-2"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-20 text-neutral-600">
                        Carrinho de compras vazio. Passe o leitor ou busque itens acima.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Bar */}
            <div className="bg-neutral-950 border-t border-neutral-800 p-4 shrink-0 flex justify-between items-center">
              <span className="text-neutral-400 text-xs font-medium">Itens no PDV: {cart.length}</span>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Subtotal</span>
                  <div className="text-lg font-bold text-neutral-300">R$ {subtotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Header definitions, Fees, Split payments & final checkout */}
        <div className="flex flex-col space-y-4">
          
          {/* Header config details */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 shrink-0">
            <h3 className="font-bold text-neutral-200 text-xs uppercase tracking-wider">Configurações do Faturamento</h3>
            
            {/* Client selector */}
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-500 font-bold uppercase">Cliente</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(parseInt(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_razao} ({c.cpf_cnpj})</option>
                ))}
              </select>
            </div>

            {/* Seller selector */}
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-500 font-bold uppercase">Vendedor / Comissão</label>
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(parseInt(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300 font-medium transition"
              >
                <option value={0}>Nenhum Vendedor</option>
                {sellers.map(v => (
                  <option key={v.id} value={v.id}>{v.nome} ({v.comissao_percentual}%)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkout pricing adjustments */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3 shrink-0">
            <h3 className="font-bold text-neutral-200 text-xs uppercase tracking-wider">Ajustes Financeiros</h3>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-bold">Desconto R$</label>
                <input
                  type="number"
                  min="0"
                  value={descontoVenda}
                  onChange={(e) => setDescontoVenda(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs text-right outline-none transition font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-bold">Frete R$</label>
                <input
                  type="number"
                  min="0"
                  value={frete}
                  onChange={(e) => setFrete(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs text-right outline-none transition font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-bold">Acréscimo R$</label>
                <input
                  type="number"
                  min="0"
                  value={acrescimo}
                  onChange={(e) => setAcrescimo(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs text-right outline-none transition font-semibold"
                />
              </div>
            </div>

            {/* Total final banner */}
            <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-lg flex justify-between items-center mt-2">
              <span className="text-xs text-neutral-400 font-bold uppercase">Total Líquido</span>
              <span className="text-2xl font-black text-emerald-400">R$ {totalFinal.toFixed(2)}</span>
            </div>
          </div>

          {/* Split payments ledger */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-4 flex flex-col min-h-0">
              <h3 className="font-bold text-neutral-200 text-xs uppercase tracking-wider shrink-0">Lançamento de Recebimentos</h3>
              
              {/* Payment input row */}
              <div className="space-y-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formaAtual}
                    onChange={(e) => setFormaAtual(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded py-1.5 px-2 text-xs outline-none text-neutral-300 font-medium focus:border-emerald-500"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão Débito">Cartão Débito</option>
                    <option value="Cartão Crédito">Cartão Crédito</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Crediário">Crediário (A Prazo)</option>
                  </select>
                  
                  <input
                    type="number"
                    value={valorPagamentoAtual}
                    onChange={(e) => setValorPagamentoAtual(parseFloat(e.target.value) || 0)}
                    className="bg-neutral-950 border border-neutral-800 rounded py-1.5 px-2 text-xs text-right outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Due Date input if not immediate */}
                {!["Dinheiro", "PIX", "Cartão Débito"].includes(formaAtual) && (
                  <div className="flex items-center justify-between gap-2 bg-neutral-950 p-2 border border-neutral-800 rounded">
                    <span className="text-[9px] text-neutral-500 uppercase font-bold">Vencimento da Parcela</span>
                    <input
                      type="date"
                      value={dataVencimentoAtual}
                      onChange={(e) => setDataVencimentoAtual(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs py-0.5 px-2 rounded outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Card/Crediário Options */}
                {["Cartão Crédito", "Crediário"].includes(formaAtual) && (
                  <div className="bg-neutral-950 p-3 border border-neutral-800 rounded space-y-2.5">
                    {/* Brand / Selector */}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] text-neutral-500 uppercase font-bold">
                        {formaAtual === "Cartão Crédito" ? "Bandeira" : "Opção de Crediário"}
                      </span>
                      <select
                        value={selectedBandeira}
                        onChange={(e) => setSelectedBandeira(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-neutral-255 text-[10px] py-0.5 px-2 rounded outline-none focus:border-emerald-500 min-w-[120px]"
                      >
                        {Array.from(new Set(taxasConfig.filter(t => t.tipo === (formaAtual === "Cartão Crédito" ? "CARTAO_CREDITO" : "CREDIARIO")).map(t => t.bandeira))).map(brand => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                        {Array.from(new Set(taxasConfig.filter(t => t.tipo === (formaAtual === "Cartão Crédito" ? "CARTAO_CREDITO" : "CREDIARIO")).map(t => t.bandeira))).length === 0 && (
                          <option value="">Sem taxas cadastradas</option>
                        )}
                      </select>
                    </div>

                    {/* Installments Select */}
                    {selectedBandeira && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[9px] text-neutral-500 uppercase font-bold">Nº de Parcelas</span>
                        <select
                          value={selectedParcelas}
                          onChange={(e) => setSelectedParcelas(Number(e.target.value))}
                          className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-[10px] py-0.5 px-2 rounded outline-none focus:border-emerald-500 min-w-[120px]"
                        >
                          {taxasConfig
                            .filter(t => t.tipo === (formaAtual === "Cartão Crédito" ? "CARTAO_CREDITO" : "CREDIARIO") && t.bandeira === selectedBandeira)
                            .sort((a, b) => a.parcelas - b.parcelas)
                            .map(t => (
                              <option key={t.id} value={t.parcelas}>{t.parcelas}x ({t.taxa_percentual.toFixed(2)}% taxa)</option>
                            ))
                          }
                        </select>
                      </div>
                    )}

                    {/* Tax fee summary */}
                    {taxaPercentualAtual > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-neutral-400 font-semibold border-t border-neutral-850 pt-2">
                        <span>Taxa calculada ({taxaPercentualAtual.toFixed(2)}%):</span>
                        <span className="text-emerald-400">
                          R$ {(valorPagamentoAtual * (taxaPercentualAtual / 100)).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Repassar fee checkbox */}
                    {taxaPercentualAtual > 0 && (
                      <label className="flex items-center gap-2 text-[10px] text-neutral-400 select-none cursor-pointer border-t border-neutral-850 pt-1">
                        <input
                          type="checkbox"
                          checked={repassarTaxa}
                          onChange={(e) => setRepassarTaxa(e.target.checked)}
                          className="rounded border-neutral-800 text-emerald-600 bg-neutral-950 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>Repassar juros ao cliente</span>
                      </label>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={lançarPagamento}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded text-xs transition"
                >
                  Lançar Pagamento
                </button>
              </div>

              {/* Payments Ledger List */}
              <div className="flex-1 overflow-y-auto border border-neutral-800 rounded-lg p-2 bg-neutral-950/40 space-y-1">
                {pagamentosLançados.length > 0 ? (
                  pagamentosLançados.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-800/40 last:border-0">
                      <div className="font-semibold text-neutral-300">
                        {p.forma_pagamento}
                        {p.bandeira && (
                          <span className="text-[10px] text-emerald-400 font-bold block">
                            {p.bandeira} - {p.parcelas}x ({p.taxa_percentual?.toFixed(2)}% taxa{p.repassado ? " repassada" : ""})
                          </span>
                        )}
                        {p.data_vencimento && (
                          <span className="text-[9px] text-neutral-500 block font-normal">Vencimento: {p.data_vencimento}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-100">R$ {p.valor.toFixed(2)}</span>
                        <button
                          onClick={() => removerPagamento(idx)}
                          className="text-red-500 hover:text-red-400 font-bold px-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-neutral-600 text-center py-6">Aguardando lançamentos financeiros...</p>
                )}
              </div>
            </div>

            {/* Bottom Actions checkout button */}
            <div className="pt-4 border-t border-neutral-800 space-y-2 shrink-0">
              <div className="flex justify-between text-xs font-semibold text-neutral-400 px-1">
                <span>Total Lançado:</span>
                <span className={totalPagoLançado >= totalFinal - 0.01 ? "text-emerald-400" : "text-neutral-300"}>
                  R$ {totalPagoLançado.toFixed(2)} / R$ {totalFinal.toFixed(2)}
                </span>
              </div>
              
              {totalPagoLançado > totalFinal && (
                <div className="text-[11px] bg-emerald-950/20 text-emerald-400 border border-emerald-800/40 p-2 rounded text-center font-bold">
                  Troco a devolver: R$ {(totalPagoLançado - totalFinal).toFixed(2)}
                </div>
              )}

              {errorVenda && (
                <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg">
                  {errorVenda}
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting || totalPagoLançado < totalFinal - 0.01 || cart.length === 0}
                onClick={finalizarVenda}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 text-white font-extrabold py-3.5 rounded-lg text-sm transition hover:shadow-[0_4px_16px_rgba(16,185,129,0.2)] hover:from-emerald-400 hover:to-teal-400"
              >
                {isSubmitting ? "Finalizando e Consumindo Lotes PEPS..." : "FECHAR VENDA (F10)"}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* SUCCESS MODAL SUMMARY (PEPS LUCRO BREAKDOWN) */}
      {successVenda && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-8 space-y-6 shadow-2xl relative">
            <div className="text-center space-y-1">
              <span className="text-4xl">🎉</span>
              <h2 className="text-2xl font-black text-emerald-400">Venda Finalizada!</h2>
              <p className="text-xs text-neutral-400">Código de controle: {successVenda.numero}</p>
            </div>
            
            <div className="bg-neutral-950 p-5 border border-neutral-800 rounded-xl space-y-3">
              <h4 className="text-xs text-neutral-500 uppercase font-bold border-b border-neutral-800 pb-2">Demonstrativo Financeiro (Método PEPS)</h4>
              
              <div className="flex justify-between text-xs py-1 border-b border-neutral-800/40">
                <span className="text-neutral-400">Faturamento da Venda:</span>
                <span className="font-semibold text-neutral-200">R$ {successVenda.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-neutral-800/40">
                <span className="text-neutral-400">Custo de Aquisição PEPS (Lotes Consumidos):</span>
                <span className="font-semibold text-red-400">R$ {successVenda.custo_peps.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm py-2 font-bold text-neutral-100">
                <span>Lucro Bruto Real:</span>
                <span className="text-emerald-400">R$ {successVenda.lucro.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 text-neutral-400">
                <span>Margem de Lucro:</span>
                <span className="text-teal-400 font-semibold">{successVenda.margem.toFixed(1)}%</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-neutral-500 bg-neutral-950/40 py-2.5 rounded border border-neutral-800/30">
              💡 Os lotes mais antigos foram esgotados fisicamente no banco de dados.
            </div>

            <button
              onClick={resetPDV}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-xs transition"
            >
              Nova Venda (Enter)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
