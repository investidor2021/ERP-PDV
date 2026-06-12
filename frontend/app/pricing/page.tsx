"use client";

import { useState, useEffect } from "react";
import { 
  BrainCircuit, 
  HelpCircle,
  Plus,
  X,
  TrendingUp,
  Percent,
  Coins,
  TrendingDown,
  Activity,
  AlertCircle,
  Play,
  ArrowLeftRight,
  ShieldCheck,
  Zap,
  Store,
  Globe
} from "lucide-react";
import { api } from "@/lib/api";

interface Product {
  id: number;
  codigo: string;
  descricao: string;
  preco_venda: number;
}

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isManualCost, setIsManualCost] = useState(false);
  const [customCost, setCustomCost] = useState<string>("");
  const [activeModule, setActiveModule] = useState<"online" | "physical" | "comparator" | "smart">("online");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded cost from database (PEPS)
  const [loadedPepsCost, setLoadedPepsCost] = useState<number>(0);
  const [productWeight, setProductWeight] = useState<number>(0.2);

  // Core configuration states
  const [category, setCategory] = useState<string>("eletronico");
  
  // 1. Online Simulator States
  const [onlineMarketplace, setOnlineMarketplace] = useState<string>("mercado_livre_classic");
  const [onlineMode, setOnlineMode] = useState<number>(1); // 1 = Selling Price, 2 = Margin, 3 = Profit
  const [onlineInputValue, setOnlineInputValue] = useState<string>("100.00");
  const [onlineReputation, setOnlineReputation] = useState<string>("verde");
  const [onlineShippingOverride, setOnlineShippingOverride] = useState<string>("");
  const [onlinePackagingCost, setOnlinePackagingCost] = useState<string>("1.50");
  const [onlineOperationalCost, setOnlineOperationalCost] = useState<string>("2.00");
  const [onlineTaxRate, setOnlineTaxRate] = useState<string>("4.0");
  const [onlineResult, setOnlineResult] = useState<any | null>(null);
  const [onlineDetailsExpanded, setOnlineDetailsExpanded] = useState<Record<string, boolean>>({
    purchase: false,
    fees: false,
    shipping: false
  });

  // 2. Physical Simulator States
  const [physMode, setPhysMode] = useState<number>(1);
  const [physInputValue, setPhysInputValue] = useState<string>("100.00");
  const [physTaxRate, setPhysTaxRate] = useState<string>("4.0");
  const [physCommissionRate, setPhysCommissionRate] = useState<string>("2.0");
  const [physPaymentFeeRate, setPhysPaymentFeeRate] = useState<string>("2.5");
  const [physPackagingCost, setPhysPackagingCost] = useState<string>("0.50");
  const [physOperationalCost, setPhysOperationalCost] = useState<string>("1.00");
  const [physResult, setPhysResult] = useState<any | null>(null);

  // 3. Comparator States
  const [compReferencePrice, setCompReferencePrice] = useState<string>("");
  const [compShippingOverride, setCompShippingOverride] = useState<string>("");
  const [compResult, setCompResult] = useState<any | null>(null);

  // 4. Smart Pricing States
  const [smartMinMargin, setSmartMinMargin] = useState<string>("15");
  const [competitorInput, setCompetitorInput] = useState<string>("");
  const [competitors, setCompetitors] = useState<number[]>([]);
  const [smartResult, setSmartResult] = useState<any | null>(null);
  const [smartActiveTab, setSmartActiveTab] = useState<"classic" | "premium" | "shopee" | "physical">("classic");

  // Load products list on mount
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const res = await api.get("/products");
        setProducts(res || []);
        if (res && res.length > 0) {
          setSelectedProductId(String(res[0].id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  // Fetch product cost dynamically when selected item changes
  useEffect(() => {
    if (!selectedProductId || isManualCost) return;
    
    async function fetchCost() {
      try {
        const costRes = await api.get(`/pricing/product-cost/${selectedProductId}`);
        setLoadedPepsCost(costRes.purchase_cost || 0.0);
        setProductWeight(costRes.weight || 0.2);
        
        // Populate online/comparator with product's standard selling price
        // For physical: only pre-fill when mode==1 (selling price), not margin/profit modes
        if (costRes.selling_price && costRes.selling_price > 0) {
          const priceStr = costRes.selling_price.toFixed(2);
          setOnlineInputValue(priceStr);
          setCompReferencePrice(priceStr);
          // Only set physical price input when mode is "Preço de Venda" (mode 1)
          if (physMode === 1) {
            setPhysInputValue(priceStr);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar custo PEPS do produto:", err);
      }
    }
    fetchCost();
  }, [selectedProductId, isManualCost]);

  // Clean results when mode or selections change to force recalculating
  useEffect(() => {
    setOnlineResult(null);
    setPhysResult(null);
    setCompResult(null);
    setSmartResult(null);
  }, [selectedProductId, isManualCost, activeModule, onlineMarketplace, category]);

  const parseFormFloat = (val: string | number) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    return parseFloat(val.replace(",", ".")) || 0;
  };

  const getActiveCost = () => {
    return isManualCost ? parseFormFloat(customCost) : loadedPepsCost;
  };

  // --- Handlers ---

  const handleSimulateOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        product_id: isManualCost ? undefined : parseInt(selectedProductId),
        custom_cost: isManualCost ? parseFormFloat(customCost) : undefined,
        marketplace: onlineMarketplace,
        mode: onlineMode,
        input_value: parseFormFloat(onlineInputValue),
        reputation: onlineReputation,
        shipping_override: onlineShippingOverride !== "" ? parseFormFloat(onlineShippingOverride) : undefined,
        category,
        packaging_cost: parseFormFloat(onlinePackagingCost),
        operational_cost: parseFormFloat(onlineOperationalCost),
        tax_rate: parseFormFloat(onlineTaxRate)
      };
      
      const res = await api.post("/pricing/simulate-online", payload);
      setOnlineResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao rodar simulador online.");
      setOnlineResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePhysical = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        product_id: isManualCost ? undefined : parseInt(selectedProductId),
        custom_cost: isManualCost ? parseFormFloat(customCost) : undefined,
        mode: physMode,
        input_value: parseFormFloat(physInputValue),
        tax_rate: parseFormFloat(physTaxRate),
        commission_rate: parseFormFloat(physCommissionRate),
        payment_fee_rate: parseFormFloat(physPaymentFeeRate),
        packaging_cost: parseFormFloat(physPackagingCost),
        operational_cost: parseFormFloat(physOperationalCost)
      };
      
      const res = await api.post("/pricing/simulate-physical", payload);
      setPhysResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao rodar simulador físico.");
      setPhysResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSuggestedPrice = async (price: number) => {
    if (!selectedProductId) return;
    try {
      await api.put(`/products/${selectedProductId}/preco-sugerido`, { preco_sugerido_venda: price });
      alert("Preço sugerido salvo com sucesso no cadastro do produto!");
    } catch (err: any) {
      alert(err.message || "Erro ao salvar preço sugerido.");
    }
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId && !isManualCost) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        product_id: parseInt(selectedProductId),
        reference_price: compReferencePrice !== "" ? parseFormFloat(compReferencePrice) : undefined,
        shipping_override: compShippingOverride !== "" ? parseFormFloat(compShippingOverride) : undefined,
        category,
        packaging_cost_online: parseFormFloat(onlinePackagingCost),
        operational_cost_online: parseFormFloat(onlineOperationalCost),
        tax_rate_online: parseFormFloat(onlineTaxRate),
        packaging_cost_physical: parseFormFloat(physPackagingCost),
        operational_cost_physical: parseFormFloat(physOperationalCost),
        tax_rate_physical: parseFormFloat(physTaxRate),
        commission_rate_physical: parseFormFloat(physCommissionRate),
        payment_fee_rate_physical: parseFormFloat(physPaymentFeeRate)
      };
      
      const res = await api.post("/pricing/compare", payload);
      setCompResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao realizar comparação de canais.");
      setCompResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSmart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        product_id: isManualCost ? undefined : parseInt(selectedProductId),
        custom_cost: isManualCost ? parseFormFloat(customCost) : undefined,
        category,
        competitors,
        min_desired_margin: smartMinMargin !== "" ? parseFormFloat(smartMinMargin) : undefined,
        packaging_cost_online: parseFormFloat(onlinePackagingCost),
        operational_cost_online: parseFormFloat(onlineOperationalCost),
        tax_rate_online: parseFormFloat(onlineTaxRate),
        packaging_cost_physical: parseFormFloat(physPackagingCost),
        operational_cost_physical: parseFormFloat(physOperationalCost),
        tax_rate_physical: parseFormFloat(physTaxRate),
        commission_rate_physical: parseFormFloat(physCommissionRate),
        payment_fee_rate_physical: parseFormFloat(physPaymentFeeRate)
      };
      
      const res = await api.post("/pricing/smart-pricing", payload);
      setSmartResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao calcular precificação inteligente.");
      setSmartResult(null);
    } finally {
      setLoading(false);
    }
  };

  const addCompetitorPrice = () => {
    const val = parseFloat(competitorInput.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      setCompetitors([...competitors, val]);
      setCompetitorInput("");
    }
  };

  const removeCompetitorPrice = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-3">
          🏷️ Precificação e Margens
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Simule custos de faturamento, comissões de marketplace e maquininha, e defina preços ideais integrados ao estoque PEPS.
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-neutral-800 bg-neutral-900/40 p-1 rounded-xl shadow-sm max-w-xl">
        <button
          onClick={() => setActiveModule("online")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeModule === "online"
              ? "bg-emerald-600 text-white shadow-md font-extrabold"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Simulador Online</span>
        </button>
        <button
          onClick={() => setActiveModule("physical")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeModule === "physical"
              ? "bg-emerald-600 text-white shadow-md font-extrabold"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Loja Física</span>
        </button>
        <button
          onClick={() => setActiveModule("comparator")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeModule === "comparator"
              ? "bg-emerald-600 text-white shadow-md font-extrabold"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Comparador</span>
        </button>
        <button
          onClick={() => setActiveModule("smart")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeModule === "smart"
              ? "bg-emerald-600 text-white shadow-md font-extrabold"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>Preço Inteligente</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Panel: Cost & Base Product configurations */}
        <div className="lg:col-span-2 space-y-6 bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
          <div>
            <h3 className="font-bold text-sm text-neutral-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Base do Produto</span>
            </h3>
            <p className="text-[10px] text-neutral-500 mt-0.5">Defina o custo de aquisição inicial para a precificação.</p>
          </div>

          {/* Product Selector */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Produto Cadastrado</label>
                <label className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isManualCost}
                    onChange={(e) => {
                      setIsManualCost(e.target.checked);
                      if (e.target.checked) setCustomCost("");
                    }}
                    className="rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Digitar custo manualmente</span>
                </label>
              </div>

              {!isManualCost ? (
                loadingProducts ? (
                  <div className="text-[11px] text-neutral-500">Buscando catálogo...</div>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                  >
                    {products.length === 0 ? (
                      <option value="">Nenhum produto cadastrado</option>
                    ) : (
                      products.map(p => (
                        <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
                      ))
                    )}
                  </select>
                )
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-2 text-neutral-500 text-xs font-semibold">R$</span>
                  <input
                    type="text" required
                    placeholder="0,00"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg text-xs outline-none text-neutral-200"
                  />
                </div>
              )}
            </div>

            {/* Display PEPS Cost indicator */}
            {!isManualCost && selectedProductId && (
              <div className="p-3 bg-neutral-950/40 border border-neutral-850 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-neutral-500 block uppercase">Custo Médio PEPS ativo</span>
                  <span className="text-sm font-black text-emerald-400">{formatBRL(loadedPepsCost)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-neutral-500 block uppercase">Peso do Lote</span>
                  <span className="text-xs font-bold text-neutral-300">{productWeight.toFixed(2)} kg</span>
                </div>
              </div>
            )}

            {/* Setup operational parameter templates */}
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Parâmetros Gerais do Canal</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Categoria Comissão (ML)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-[11px] outline-none text-neutral-200"
                  >
                    <option value="veiculo">Acessórios Veículos</option>
                    <option value="agro">Agro & Alimentos</option>
                    <option value="brinquedo">Brinquedos & Bebês</option>
                    <option value="sapato">Calçados & Moda</option>
                    <option value="casa">Casa, Móveis & Decoração</option>
                    <option value="eletronico">Celulares & Tecnologia</option>
                    <option value="esporte">Esportes & Fitness</option>
                    <option value="livro">Livros & Filmes</option>
                    <option value="beleza">Beleza & Perfumaria</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Imposto Faturamento (%)</label>
                  <input
                    type="number" step="0.1"
                    value={onlineTaxRate}
                    onChange={(e) => {
                      setOnlineTaxRate(e.target.value);
                      setPhysTaxRate(e.target.value);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-[11px] outline-none text-neutral-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Module Simulator Body */}
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MODULE 1: SIMULADOR ONLINE */}
          {activeModule === "online" && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
              <h3 className="font-bold text-sm text-neutral-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>Simulador de Vendas Online (Marketplaces)</span>
              </h3>

              <form onSubmit={handleSimulateOnline} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Marketplace</label>
                    <select
                      value={onlineMarketplace}
                      onChange={(e) => setOnlineMarketplace(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                    >
                      <option value="mercado_livre_classic">Mercado Livre Clássico</option>
                      <option value="mercado_livre_premium">Mercado Livre Premium</option>
                      <option value="shopee">Shopee</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Cálculo Baseado em</label>
                    <select
                      value={onlineMode}
                      onChange={(e) => setOnlineMode(parseInt(e.target.value))}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                    >
                      <option value={1}>Preço de Venda Desejado</option>
                      <option value={2}>Margem Desejada (%)</option>
                      <option value={3}>Lucro Líquido Desejado (R$)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">
                      {onlineMode === 1 ? "Preço de Venda (R$)" : onlineMode === 2 ? "Margem (%)" : "Lucro Líquido (R$)"}
                    </label>
                    <input
                      type="text" required
                      value={onlineInputValue}
                      onChange={(e) => setOnlineInputValue(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Embalagem (R$)</label>
                    <input
                      type="text"
                      value={onlinePackagingCost}
                      onChange={(e) => setOnlinePackagingCost(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Custo Operacional (R$)</label>
                    <input
                      type="text"
                      value={onlineOperationalCost}
                      onChange={(e) => setOnlineOperationalCost(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Sobrescrever Frete (R$)</label>
                    <input
                      type="text"
                      placeholder="Auto"
                      value={onlineShippingOverride}
                      onChange={(e) => setOnlineShippingOverride(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Reputação ML</label>
                    <select
                      value={onlineReputation}
                      onChange={(e) => setOnlineReputation(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    >
                      <option value="verde">Verde (Verde-Escuro)</option>
                      <option value="amarela">Amarela</option>
                      <option value="vermelha">Vermelha (Sem Termo)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{loading ? "Calculando..." : "Calcular Precificação Online"}</span>
                </button>
              </form>

              {/* Online Results View */}
              {onlineResult && (
                <div className="space-y-4 border-t border-neutral-800 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Preço Recomendado</span>
                      <span className="text-lg font-black text-neutral-100">{formatBRL(onlineResult.price)}</span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Lucro Líquido</span>
                      <span className={`text-lg font-black ${onlineResult.net_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatBRL(onlineResult.net_profit)}
                      </span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Margem Líquida</span>
                      <span className="text-lg font-black text-neutral-100">{onlineResult.margin.toFixed(1)}%</span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">ROI Operacional</span>
                      <span className="text-lg font-black text-neutral-100">{onlineResult.roi.toFixed(1)}%</span>
                    </div>
                    </div>
                  </div>

                  {selectedProductId && (
                    <button
                      onClick={() => handleSaveSuggestedPrice(onlineResult.price)}
                      className="w-full py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 rounded-lg font-bold text-xs transition"
                    >
                      💡 Salvar como Preço Sugerido no Produto
                    </button>
                  )}

                  {/* Breakeven line indicator */}
                  <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg text-xs flex justify-between items-center text-neutral-400">
                    <span>Preço de custo operacional mínimo (Breakeven):</span>
                    <span className="font-bold text-neutral-200">{formatBRL(onlineResult.breakeven_price)}</span>
                  </div>

                  {/* Collapsible details rows */}
                  <div className="space-y-2 text-xs">
                    {/* 1. Cost breakdown */}
                    <div className="border border-neutral-800/80 rounded-lg">
                      <button 
                        onClick={() => setOnlineDetailsExpanded(prev => ({...prev, purchase: !prev.purchase}))}
                        className="w-full p-3 flex justify-between items-center bg-neutral-950/20 text-neutral-300 font-bold"
                      >
                        <span>📦 Detalhamento do Custo Carregado ({formatBRL(onlineResult.unit_cost)})</span>
                        <span>{onlineDetailsExpanded.purchase ? "▲" : "▼"}</span>
                      </button>
                      {onlineDetailsExpanded.purchase && (
                        <div className="p-3 bg-neutral-950/40 border-t border-neutral-800 space-y-1.5 text-neutral-400 font-mono text-[11px]">
                          <div className="flex justify-between">
                            <span>Custo de Aquisição (Estoque PEPS):</span>
                            <span>{formatBRL(onlineResult.purchase_cost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Embalagens e Insumos:</span>
                            <span>{formatBRL(onlineResult.packaging_cost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Custos Operacionais Alocados:</span>
                            <span>{formatBRL(onlineResult.operational_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Fees breakdown */}
                    <div className="border border-neutral-800/80 rounded-lg">
                      <button 
                        onClick={() => setOnlineDetailsExpanded(prev => ({...prev, fees: !prev.fees}))}
                        className="w-full p-3 flex justify-between items-center bg-neutral-950/20 text-neutral-300 font-bold"
                      >
                        <span>⚡ Comissões & Tarifas de Canal ({formatBRL(onlineResult.marketplace_fees)})</span>
                        <span>{onlineDetailsExpanded.fees ? "▲" : "▼"}</span>
                      </button>
                      {onlineDetailsExpanded.fees && (
                        <div className="p-3 bg-neutral-950/40 border-t border-neutral-800 space-y-1.5 text-neutral-400 font-mono text-[11px]">
                          <div className="flex justify-between">
                            <span>Comissão Variável:</span>
                            <span>{formatBRL(onlineResult.commission_percent_val)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Taxa Fixa (CVFF/ ML / Shopee):</span>
                            <span>{formatBRL(onlineResult.fixed_fee_val)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 2: SIMULADOR LOJA FÍSICA */}
          {activeModule === "physical" && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
              <h3 className="font-bold text-sm text-neutral-200 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-500" />
                <span>Simulador de Precificação para Loja Física</span>
              </h3>

              <form onSubmit={handleSimulatePhysical} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Cálculo Baseado em</label>
                    <select
                      value={physMode}
                      onChange={(e) => {
                        const newMode = parseInt(e.target.value);
                        setPhysMode(newMode);
                        setPhysResult(null);
                        // Reset input to a sensible default for the selected mode
                        if (newMode === 1) {
                          // Selling price: use loaded product price or blank
                          const sp = loadedPepsCost > 0
                            ? (loadedPepsCost * 1.4).toFixed(2)  // 40% above cost as suggestion
                            : "100.00";
                          setPhysInputValue(sp);
                        } else if (newMode === 2) {
                          setPhysInputValue("20");  // 20% margin default
                        } else {
                          setPhysInputValue("10.00");  // R$ 10 profit default
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                    >
                      <option value={1}>Preço de Venda Desejado</option>
                      <option value={2}>Margem Desejada (%)</option>
                      <option value={3}>Lucro Líquido Desejado (R$)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase flex items-center gap-1.5">
                      {physMode === 1 ? "Preço de Venda (R$)" : physMode === 2 ? "Margem Desejada (%)" : "Lucro Líquido (R$)"}
                      {physMode === 2 && (
                        <span className="text-[8px] text-emerald-600 font-normal normal-case">(ex: 20 = 20%)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text" required
                        value={physInputValue}
                        placeholder={physMode === 1 ? "ex: 150.00" : physMode === 2 ? "ex: 20" : "ex: 10.00"}
                        onChange={(e) => setPhysInputValue(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 font-bold pr-8"
                      />
                      <span className="absolute right-3 top-2 text-neutral-600 text-[10px] font-semibold select-none">
                        {physMode === 2 ? "%" : "R$"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Sacola / Caixa de Presente (R$)</label>
                    <input
                      type="text"
                      value={physPackagingCost}
                      onChange={(e) => setPhysPackagingCost(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Comissão Vendedor (%)</label>
                    <input
                      type="text"
                      value={physCommissionRate}
                      onChange={(e) => setPhysCommissionRate(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Taxa Maquininha (%)</label>
                    <input
                      type="text"
                      value={physPaymentFeeRate}
                      onChange={(e) => setPhysPaymentFeeRate(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Custo Operacional Alocado (R$)</label>
                    <input
                      type="text"
                      value={physOperationalCost}
                      onChange={(e) => setPhysOperationalCost(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase">Aliquota Imposto (%)</label>
                    <input
                      type="text"
                      value={physTaxRate}
                      onChange={(e) => setPhysTaxRate(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-200"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{loading ? "Calculando..." : "Calcular Precificação Física"}</span>
                </button>
              </form>

              {/* Physical Results View */}
              {physResult && (
                <div className="space-y-4 border-t border-neutral-800 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Preço Recomendado</span>
                      <span className="text-lg font-black text-neutral-100">{formatBRL(physResult.price)}</span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Lucro Líquido</span>
                      <span className={`text-lg font-black ${physResult.net_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatBRL(physResult.net_profit)}
                      </span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">Margem Líquida</span>
                      <span className="text-lg font-black text-neutral-100">{physResult.margin.toFixed(1)}%</span>
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg">
                      <span className="text-[9px] text-neutral-500 block uppercase">ROI Operacional</span>
                      <span className="text-lg font-black text-neutral-100">{physResult.roi.toFixed(1)}%</span>
                    </div>
                  </div>

                  {selectedProductId && (
                    <button
                      onClick={() => handleSaveSuggestedPrice(physResult.price)}
                      className="w-full py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 rounded-lg font-bold text-xs transition"
                    >
                      💡 Salvar como Preço Sugerido no Produto
                    </button>
                  )}

                  <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg text-xs flex justify-between items-center text-neutral-400">
                    <span>Preço mínimo de venda (Breakeven):</span>
                    <span className="font-bold text-neutral-200">{formatBRL(physResult.breakeven_price)}</span>
                  </div>

                  {/* Physical breakdown table */}
                  <div className="bg-neutral-950 border border-neutral-850 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold text-[10px] uppercase">
                          <th className="py-2 px-3">Custo / Despesa</th>
                          <th className="py-2 px-3 text-right">Valor Alocado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-neutral-300 text-[11px]">
                        <tr>
                          <td className="py-2 px-3">Custo de Aquisição (Estoque PEPS):</td>
                          <td className="py-2 px-3 text-right">{formatBRL(physResult.purchase_cost)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">Sacola / Caixa de Presente:</td>
                          <td className="py-2 px-3 text-right">{formatBRL(physResult.packaging_cost)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">Despesa Operacional Alocada:</td>
                          <td className="py-2 px-3 text-right">{formatBRL(physResult.operational_cost)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">Imposto sobre Venda ({physTaxRate}%):</td>
                          <td className="py-2 px-3 text-right text-red-400">- {formatBRL(physResult.tax_cost)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">Comissão de Vendedores ({physCommissionRate}%):</td>
                          <td className="py-2 px-3 text-right text-red-400">- {formatBRL(physResult.commission_cost)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">Taxa Maquininha Cartão ({physPaymentFeeRate}%):</td>
                          <td className="py-2 px-3 text-right text-red-400">- {formatBRL(physResult.payment_fee_cost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 3: COMPARADOR DE CANAIS */}
          {activeModule === "comparator" && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
              <h3 className="font-bold text-sm text-neutral-200 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-emerald-500" />
                <span>Comparador Multicanais (Físico vs Canais Online)</span>
              </h3>

              <form onSubmit={handleCompare} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Preço de Referência (Opcional)</label>
                    <input
                      type="text"
                      placeholder={getActiveCost() > 0 ? `Padrão: R$ ${(getActiveCost() * 1.5).toFixed(2)}` : "0,00"}
                      value={compReferencePrice}
                      onChange={(e) => setCompReferencePrice(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Sobrescrever Frete ML (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Auto"
                      value={compShippingOverride}
                      onChange={(e) => setCompShippingOverride(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-200"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading || (!selectedProductId && !isManualCost)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{loading ? "Comparando..." : "Comparar Rentabilidades"}</span>
                </button>
              </form>

              {/* Comparisons output panel */}
              {compResult && (
                <div className="space-y-5 pt-4 border-t border-neutral-800">
                  {/* Winner Banner */}
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center justify-between text-xs max-w-lg mx-auto">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-900/30 border border-emerald-800/40 rounded-md text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[9px] uppercase block">Canal Recomendado</span>
                        <span className="font-extrabold text-neutral-200">{compResult.best_channel}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider rounded">
                      Mais Lucrativo
                    </span>
                  </div>

                  {/* Comparisons Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {compResult.comparisons.map((c: any, idx: number) => {
                      const isBest = c.channel_name === compResult.best_channel;
                      return (
                        <div 
                          key={idx}
                          className={`p-4 rounded-xl border relative transition ${
                            isBest 
                              ? "bg-neutral-900/60 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/10" 
                              : "bg-neutral-950/60 border-neutral-800 opacity-80"
                          }`}
                        >
                          {isBest && (
                            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5 fill-white" />
                              <span>Melhor</span>
                            </div>
                          )}

                          <div className="space-y-2">
                            <span className="text-[10px] text-neutral-500 uppercase font-black">{c.channel_name}</span>
                            
                            <div className="flex justify-between items-baseline pt-1">
                              <span className="text-[9px] text-neutral-400 uppercase">Lucro Líquido:</span>
                              <span className="text-xl font-black text-emerald-400">{formatBRL(c.profit)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-neutral-800 pt-2 text-neutral-400">
                              <div className="flex justify-between">
                                <span>Preço:</span>
                                <span className="text-neutral-300 font-semibold">{formatBRL(c.price)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Custos:</span>
                                <span className="text-red-400 font-semibold">-{formatBRL(c.fees + c.shipping)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Imposto:</span>
                                <span className="text-red-400 font-semibold">-{formatBRL(c.tax)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Margem:</span>
                                <span className="text-neutral-200 font-semibold">{c.margin.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 4: PREÇO INTELIGENTE */}
          {activeModule === "smart" && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
              <h3 className="font-bold text-sm text-neutral-200 flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-emerald-500" />
                <span>Preço Inteligente & Algoritmo Buybox</span>
              </h3>

              <form onSubmit={handleGenerateSmart} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Registrar Preço Concorrentes</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-neutral-500 text-xs font-semibold">R$</span>
                        <input
                          type="text"
                          value={competitorInput}
                          onChange={(e) => setCompetitorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCompetitorPrice();
                            }
                          }}
                          placeholder="0,00"
                          className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg text-xs outline-none text-neutral-200"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addCompetitorPrice}
                        className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase">Margem Segurança (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={smartMinMargin}
                        onChange={(e) => setSmartMinMargin(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg text-xs outline-none text-neutral-200 pr-7 font-bold"
                        placeholder="Ex: 15"
                      />
                      <span className="absolute right-3 top-2 text-neutral-500 text-xs font-semibold">%</span>
                    </div>
                  </div>
                </div>

                {/* Tags List */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950 rounded-lg border border-neutral-800 min-h-[48px]">
                  {competitors.length === 0 ? (
                    <span className="text-[10px] text-neutral-600 m-auto">Nenhum concorrente cadastrado.</span>
                  ) : (
                    competitors.map((price, idx) => (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-neutral-300 border border-neutral-800"
                      >
                        <span>R$ {price.toFixed(2)}</span>
                        <button 
                          type="button" 
                          onClick={() => removeCompetitorPrice(idx)}
                          className="text-neutral-500 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{loading ? "Processando Inteligência..." : "Processar Inteligência"}</span>
                </button>
              </form>

              {/* Smart Pricing Results View */}
              {smartResult && (() => {
                const currentTiers = smartActiveTab === "classic"
                  ? smartResult.mercado_livre_classic
                  : smartActiveTab === "premium"
                  ? smartResult.mercado_livre_premium
                  : smartActiveTab === "shopee"
                  ? smartResult.shopee
                  : smartResult.loja_fisica;

                return (
                  <div className="space-y-4 pt-4 border-t border-neutral-800">
                    {/* Inner Channels Switcher */}
                    <div className="flex border border-neutral-800 bg-neutral-950 p-0.5 rounded-lg max-w-sm">
                      <button
                        onClick={() => setSmartActiveTab("classic")}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                          smartActiveTab === "classic" ? "bg-emerald-600 text-white" : "text-neutral-500 hover:text-neutral-350"
                        }`}
                      >
                        ML Clássico
                      </button>
                      <button
                        onClick={() => setSmartActiveTab("premium")}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                          smartActiveTab === "premium" ? "bg-emerald-600 text-white" : "text-neutral-500 hover:text-neutral-350"
                        }`}
                      >
                        ML Premium
                      </button>
                      <button
                        onClick={() => setSmartActiveTab("shopee")}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                          smartActiveTab === "shopee" ? "bg-emerald-600 text-white" : "text-neutral-500 hover:text-neutral-350"
                        }`}
                      >
                        Shopee
                      </button>
                      <button
                        onClick={() => setSmartActiveTab("physical")}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                          smartActiveTab === "physical" ? "bg-emerald-600 text-white" : "text-neutral-500 hover:text-neutral-350"
                        }`}
                      >
                        Loja Física
                      </button>
                    </div>

                    {/* Strategies list */}
                    <div className="grid grid-cols-1 gap-4">
                      {currentTiers.map((tier: any, idx: number) => {
                        const isIdeal = tier.strategy === "Ideal";
                        const isAggr = tier.strategy === "Agressivo";
                        return (
                          <div 
                            key={idx}
                            className={`p-4 bg-neutral-950 border rounded-xl relative transition ${
                              isIdeal 
                                ? "border-emerald-600/80 shadow-md ring-1 ring-emerald-600/10" 
                                : isAggr
                                ? "border-orange-500/50"
                                : "border-neutral-850"
                            }`}
                          >
                            <div className="absolute top-4 right-4">
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${
                                isIdeal 
                                  ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/25"
                                  : isAggr
                                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/25"
                                  : "bg-neutral-800 text-neutral-400 border border-neutral-750"
                              }`}>
                                Estratégia {tier.strategy}
                              </span>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Preço Recomendado</span>
                                <h4 className="text-2xl font-black text-neutral-100">{formatBRL(tier.price)}</h4>
                              </div>

                              <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="p-2 bg-neutral-900/50 border border-neutral-900 rounded-lg">
                                  <span className="text-[9px] text-neutral-500 uppercase block">Lucro Esperado</span>
                                  <span className="font-bold text-emerald-400 text-[11px]">{formatBRL(tier.profit)}</span>
                                </div>
                                <div className="p-2 bg-neutral-900/50 border border-neutral-900 rounded-lg">
                                  <span className="text-[9px] text-neutral-500 uppercase block">Margem</span>
                                  <span className="font-bold text-neutral-200 text-[11px]">{tier.margin.toFixed(1)}%</span>
                                </div>
                                <div className="p-2 bg-neutral-900/50 border border-neutral-900 rounded-lg">
                                  <span className="text-[9px] text-neutral-500 uppercase block">ROI</span>
                                  <span className="font-bold text-neutral-200 text-[11px]">{tier.roi.toFixed(1)}%</span>
                                </div>
                              </div>

                              {tier.safety_triggered && (
                                <div className="p-2.5 bg-red-950/20 border border-red-900/40 rounded-lg text-red-400 flex items-center gap-1.5 text-[10px] font-bold">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Margem de segurança de {smartMinMargin}% aplicada (Preço Ajustado).</span>
                                </div>
                              )}

                              <p className="text-[10.5px] text-neutral-450 leading-relaxed">
                                {tier.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
