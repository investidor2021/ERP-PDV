"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Product {
  id: number;
  codigo: string;
  codigo_fornecedor: string | null;
  codigo_barras: string | null;
  descricao: string;
  unidade: string;
  ncm: string | null;
  estoque_atual: number;
  preco_venda: number;
  estoque_minimo: number;
  estoque_maximo: number;
  marca: string | null;
  categoria: string | null;
  peso_liquido: number;
  peso_bruto: number;
  cfop_padrao: string | null;
  origem_mercadoria: number;
  localizacao: string | null;
}

interface Lot {
  id: number;
  data_entrada: string;
  quantidade_original: number;
  quantidade_saldo: number;
  custo_unitario: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  
  // Forms states
  const [newPrice, setNewPrice] = useState("");
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [xmlError, setXmlError] = useState("");
  const [xmlLoading, setXmlLoading] = useState(false);

  // Editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Manual product register/edit form states
  const [prodSku, setProdSku] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodBar, setProdBar] = useState("");
  const [prodUnit, setProdUnit] = useState("UN");
  const [prodNcm, setProdNcm] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodMinStock, setProdMinStock] = useState("0");
  const [prodMaxStock, setProdMaxStock] = useState("0");
  const [prodBrand, setProdBrand] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodNetWeight, setProdNetWeight] = useState("0");
  const [prodGrossWeight, setProdGrossWeight] = useState("0");
  const [prodCfop, setProdCfop] = useState("");
  const [prodOrigin, setProdOrigin] = useState("0");
  const [prodLocation, setProdLocation] = useState("");
  const [showManualProd, setShowManualProd] = useState(false);

  // Manual lot register form
  const [lotQty, setLotQty] = useState("");
  const [lotCost, setLotCost] = useState("");
  const [lotDate, setLotDate] = useState("");
  const [showManualLot, setShowManualLot] = useState(false);

  // Active product selected object
  const activeProduct = products.find(p => p.id === selectedProductId);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await api.get("/products");
      setProducts(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Load lots when selected product changes
  useEffect(() => {
    if (!selectedProductId) {
      setLots([]);
      return;
    }
    async function loadLots() {
      try {
        const res = await api.get(`/products/${selectedProductId}/lotes`);
        setLots(res || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadLots();
  }, [selectedProductId]);

  const updatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !newPrice) return;
    try {
      await api.put(`/products/${selectedProductId}`, { preco_venda: parseFloat(newPrice) });
      setNewPrice("");
      alert("Preço de venda atualizado com sucesso!");
      loadProducts();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar preço.");
    }
  };

  const handleXmlUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlFile) return;
    setXmlLoading(true);
    setXmlError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", xmlFile);

    try {
      const res = await api.post("/products/importar-xml", formData);
      setImportResult(res);
      setXmlFile(null);
      loadProducts();
    } catch (err: any) {
      console.error(err);
      setXmlError(err.message || "Erro ao processar importação de XML.");
    } finally {
      setXmlLoading(false);
    }
  };

  const handleAddProductClick = () => {
    setEditingProduct(null);
    setProdSku("");
    setProdDesc("");
    setProdBar("");
    setProdUnit("UN");
    setProdNcm("");
    setProdPrice("");
    setProdMinStock("0");
    setProdMaxStock("0");
    setProdBrand("");
    setProdCategory("");
    setProdNetWeight("0");
    setProdGrossWeight("0");
    setProdCfop("");
    setProdOrigin("0");
    setProdLocation("");
    setShowManualProd(true);
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setProdSku(product.codigo || "");
    setProdDesc(product.descricao || "");
    setProdBar(product.codigo_barras || "");
    setProdUnit(product.unidade || "UN");
    setProdNcm(product.ncm || "");
    setProdPrice(String(product.preco_venda || 0.0));
    setProdMinStock(String(product.estoque_minimo || 0));
    setProdMaxStock(String(product.estoque_maximo || 0));
    setProdBrand(product.marca || "");
    setProdCategory(product.categoria || "");
    setProdNetWeight(String(product.peso_liquido || 0.0));
    setProdGrossWeight(String(product.peso_bruto || 0.0));
    setProdCfop(product.cfop_padrao || "");
    setProdOrigin(String(product.origem_mercadoria || 0));
    setProdLocation(product.localizacao || "");
    setShowManualProd(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este produto do catálogo?")) return;
    try {
      await api.delete(`/products/${id}`);
      alert("Produto excluído com sucesso!");
      setSelectedProductId(null);
      loadProducts();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir produto.");
    }
  };

  const registerOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodSku || !prodDesc) {
      alert("SKU e Descrição são obrigatórios.");
      return;
    }
    const payload = {
      codigo: prodSku,
      codigo_fornecedor: prodSku,
      codigo_barras: prodBar || null,
      descricao: prodDesc,
      unidade: prodUnit,
      ncm: prodNcm || null,
      preco_venda: parseFloat(prodPrice) || 0.0,
      estoque_minimo: parseInt(prodMinStock) || 0,
      estoque_maximo: parseInt(prodMaxStock) || 0,
      marca: prodBrand || null,
      categoria: prodCategory || null,
      peso_liquido: parseFloat(prodNetWeight) || 0.0,
      peso_bruto: parseFloat(prodGrossWeight) || 0.0,
      cfop_padrao: prodCfop || null,
      origem_mercadoria: parseInt(prodOrigin) || 0,
      localizacao: prodLocation || null
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        alert("Produto updated com sucesso!");
      } else {
        await api.post("/products", payload);
        alert("Produto cadastrado com sucesso!");
      }
      setShowManualProd(false);
      setEditingProduct(null);
      loadProducts();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar produto.");
    }
  };

  const registerManualLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !lotQty || !lotCost) {
      alert("Selecione um produto e informe quantidade e custo.");
      return;
    }
    try {
      const dateIn = lotDate ? new Date(lotDate).toISOString() : new Date().toISOString();
      await api.post("/products/lotes-manual", {
        produto_id: selectedProductId,
        quantidade: parseInt(lotQty),
        custo_unitario: parseFloat(lotCost),
        data_entrada: dateIn,
        observacao: "Ajuste físico manual"
      });
      alert("Lote manual adicionado ao PEPS com sucesso!");
      setLotQty("");
      setLotCost("");
      setLotDate("");
      setShowManualLot(false);
      
      // Reload lots and products
      const res = await api.get(`/products/${selectedProductId}/lotes`);
      setLots(res || []);
      loadProducts();
    } catch (err: any) {
      alert(err.message || "Erro ao registrar lote.");
    }
  };

  const filteredProducts = products.filter(p => 
    p.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(searchQuery))
  );

  const getOrigemLabel = (val: number) => {
    switch (val) {
      case 0: return "0 - Nacional";
      case 1: return "1 - Estrangeira (Importação Direta)";
      case 2: return "2 - Estrangeira (Adquirida no Mercado Interno)";
      case 3: return "3 - Nacional (Conteúdo Importado > 40%)";
      case 4: return "4 - Nacional (Processo Básico)";
      default: return "Nacional";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
            📦 Catálogo de Produtos & Lotes
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gestão de SKUs, consulta de lotes de entrada e importador de XML de Notas Fiscais eletrônicas.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAddProductClick}
            className="px-4 py-2 border border-neutral-800 hover:bg-neutral-800 text-xs font-bold rounded-lg transition"
          >
            ➕ Cadastrar Manual
          </button>
          <button
            onClick={() => setShowXmlModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
          >
            📥 Importar XML NF-e
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left catalog list */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <input
            type="text"
            placeholder="🔍 Buscar por SKU, Descrição ou Código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none transition font-medium"
          />

          {loading ? (
            <p className="text-neutral-500 text-xs text-center py-12">Carregando catálogo...</p>
          ) : filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3">Unidade</th>
                    <th className="py-2.5 px-3">NCM</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-right">Preço Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`hover:bg-neutral-800/30 transition cursor-pointer ${
                        selectedProductId === p.id ? "bg-emerald-950/20 text-emerald-300 font-bold border-l-2 border-emerald-500" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono">{p.codigo}</td>
                      <td className="py-2.5 px-3">{p.descricao}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{p.unidade}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{p.ncm || "—"}</td>
                      <td className="py-2.5 px-3 text-right">{p.estoque_atual}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-neutral-200">
                        R$ {p.preco_venda.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-xs text-center py-12">Nenhum produto cadastrado.</p>
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="space-y-6">
          
          {activeProduct ? (
            <>
              {/* Product Info, Expanded Details & Price Form */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-neutral-200 text-sm">
                      {activeProduct.descricao}
                    </h3>
                    <span className="text-[10px] font-mono text-neutral-500 block mt-0.5">
                      SKU: {activeProduct.codigo}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProductClick(activeProduct)}
                      className="px-2 py-1 bg-neutral-800 text-[10px] text-emerald-400 font-bold rounded border border-neutral-700 hover:bg-neutral-750 transition"
                      title="Editar Completo"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(activeProduct.id)}
                      className="px-2 py-1 bg-neutral-800 text-[10px] text-red-400 font-bold rounded border border-neutral-700 hover:bg-neutral-750 transition"
                      title="Excluir Produto"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>

                {/* Expanded Fields Details Grid */}
                <div className="border-t border-b border-neutral-800 py-3 grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block">Marca</span>
                    <span className="text-neutral-300 font-medium">{activeProduct.marca || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Categoria</span>
                    <span className="text-neutral-300 font-medium">{activeProduct.categoria || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Estoque Min / Max</span>
                    <span className="text-neutral-300 font-mono">
                      {activeProduct.estoque_minimo || 0} / {activeProduct.estoque_maximo || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Localização</span>
                    <span className="text-neutral-300 font-medium">{activeProduct.localizacao || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Peso Líq / Bruto</span>
                    <span className="text-neutral-300 font-mono">
                      {activeProduct.peso_liquido || 0}kg / {activeProduct.peso_bruto || 0}kg
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">CFOP Padrão</span>
                    <span className="text-neutral-300 font-mono">{activeProduct.cfop_padrao || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 block">Origem Mercadoria</span>
                    <span className="text-neutral-300 font-medium text-[10px]">
                      {getOrigemLabel(activeProduct.origem_mercadoria)}
                    </span>
                  </div>
                </div>

                <form onSubmit={updatePrice} className="space-y-2">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Atualizar Preço de Venda (R$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 29.90"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-3 text-xs outline-none font-bold"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              </div>

              {/* Lotes PEPS list */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-neutral-200 text-xs uppercase tracking-wider">Lotes PEPS Ativos</h3>
                  <button
                    onClick={() => setShowManualLot(true)}
                    className="text-[10px] text-emerald-400 font-bold hover:underline"
                  >
                    Ajuste Físico (+)
                  </button>
                </div>

                {lots.length > 0 ? (
                  <div className="space-y-3">
                    {lots.map((l) => (
                      <div key={l.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold text-neutral-300">Lote #{l.id}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            Entrada: {new Date(l.data_entrada).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">{l.quantidade_saldo} / {l.quantidade_original} un</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">Custo: R$ {l.custo_unitario.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-600 text-center py-6">Sem lotes ativos. Adicione um lote manual.</p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 border-dashed rounded-xl p-10 text-center text-neutral-600 text-xs">
              Selecione um produto no catálogo para gerenciar preços e lotes.
            </div>
          )}

        </div>

      </div>

      {/* MANUAL PRODUCT REGISTER & EDIT MODAL */}
      {showManualProd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={registerOrUpdateProduct} className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-200">
              {editingProduct ? "✏️ Editar Cadastro de Produto" : "➕ Novo Cadastro de Produto"}
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Código SKU *</label>
                <input
                  type="text"
                  required
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Descrição / Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Código de Barras</label>
                <input
                  type="text"
                  value={prodBar}
                  onChange={(e) => setProdBar(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Marca</label>
                <input
                  type="text"
                  placeholder="Ex: Coca-cola, Samsung"
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Bebidas, Eletrônicos"
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Unidade</label>
                <input
                  type="text"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">NCM</label>
                <input
                  type="text"
                  value={prodNcm}
                  onChange={(e) => setProdNcm(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Preço Venda R$</label>
                <input
                  type="number"
                  step="0.01"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Localização Física</label>
                <input
                  type="text"
                  placeholder="Ex: Corredor A, Prateleira 3"
                  value={prodLocation}
                  onChange={(e) => setProdLocation(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-3">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase mb-3">Estoque & Logística</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Estoque Máximo</label>
                  <input
                    type="number"
                    value={prodMaxStock}
                    onChange={(e) => setProdMaxStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Peso Líquido (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={prodNetWeight}
                    onChange={(e) => setProdNetWeight(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Peso Bruto (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={prodGrossWeight}
                    onChange={(e) => setProdGrossWeight(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-3">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase mb-3">Dados Fiscais / Tributação</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">CFOP Padrão</label>
                  <input
                    type="text"
                    placeholder="Ex: 5102"
                    value={prodCfop}
                    onChange={(e) => setProdCfop(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Origem da Mercadoria</label>
                  <select
                    value={prodOrigin}
                    onChange={(e) => setProdOrigin(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none text-neutral-300"
                  >
                    <option value="0">0 - Nacional</option>
                    <option value="1">1 - Estrangeira - Importação Direta</option>
                    <option value="2">2 - Estrangeira - Adquirida no Mercado Interno</option>
                    <option value="3">3 - Nacional - Mercadoria com Conteúdo de Importação Superior a 40%</option>
                    <option value="4">4 - Nacional - Produção em Conformidade com Processos Básicos</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowManualProd(false);
                  setEditingProduct(null);
                }}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUAL LOT ADJUSTMENT MODAL */}
      {showManualLot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={registerManualLot} className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-neutral-200">➕ Lançar Ajuste Físico (Lote manual PEPS)</h3>
            <p className="text-[11px] text-neutral-400">Adicione um novo lote para regularizar o inventário ou registrar entrada manual.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={lotQty}
                  onChange={(e) => setLotQty(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Custo Unitário (R$) *</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  min="0"
                  value={lotCost}
                  onChange={(e) => setLotCost(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">Data de Entrada</label>
              <input
                type="date"
                value={lotDate}
                onChange={(e) => setLotDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none text-neutral-300"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowManualLot(false)}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Confirmar Lote
              </button>
            </div>
          </form>
        </div>
      )}

      {/* XML UPLOAD MODAL */}
      {showXmlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-neutral-200">📥 Importar XML de Compra (NF-e)</h3>
            
            {xmlError && (
              <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg">
                {xmlError}
              </div>
            )}

            {importResult && (
              <div className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-lg space-y-1">
                <p className="font-bold">NF nº {importResult.numero} importada com sucesso!</p>
                <p>Fornecedor: {importResult.fornecedor}</p>
                <p>Itens cadastrados/atualizados: {importResult.itens_processados}</p>
                <p>Novos SKUs inseridos no catálogo: {importResult.novos_produtos}</p>
              </div>
            )}

            <form onSubmit={handleXmlUpload} className="space-y-4">
              <div className="border-2 border-dashed border-neutral-800 rounded-xl p-8 text-center bg-neutral-950/30 flex flex-col items-center">
                <span className="text-2xl mb-2">📄</span>
                <input
                  type="file"
                  accept=".xml"
                  required
                  onChange={(e) => setXmlFile(e.target.files?.[0] || null)}
                  className="text-xs text-neutral-400 file:bg-neutral-900 file:border-neutral-800 file:text-neutral-300 file:px-3 file:py-1.5 file:rounded file:text-xs hover:file:bg-neutral-800 cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500 mt-2">O arquivo deve ser um XML de NF-e válido de compra com dígito verificador íntegro.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowXmlModal(false);
                    setXmlFile(null);
                    setImportResult(null);
                    setXmlError("");
                  }}
                  className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={xmlLoading || !xmlFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold rounded-lg transition"
                >
                  {xmlLoading ? "Processando tags e impostos..." : "Importar Nota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
