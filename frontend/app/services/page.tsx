"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Service {
  id: number;
  codigo: string;
  descricao: string;
  valor_padrao: number;
  categoria: string | null;
  aliquota_iss: number;
  codigo_lc116: string | null;
  unidade_medida: string;
  custo_estimado: number;
  observacoes: string | null;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form states
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorPadrao, setValorPadrao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("");
  const [codigoLc116, setCodigoLc116] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("UN");
  const [custoEstimado, setCustoEstimado] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      const res = await api.get("/services");
      setServices(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddClick = () => {
    setEditingService(null);
    setCodigo("");
    setDescricao("");
    setValorPadrao("");
    setCategoria("");
    setAliquotaIss("");
    setCodigoLc116("");
    setUnidadeMedida("UN");
    setCustoEstimado("");
    setObs("");
    setShowAddModal(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setCodigo(service.codigo || "");
    setDescricao(service.descricao || "");
    setValorPadrao(String(service.valor_padrao || 0.0));
    setCategoria(service.categoria || "");
    setAliquotaIss(String(service.aliquota_iss || 0.0));
    setCodigoLc116(service.codigo_lc116 || "");
    setUnidadeMedida(service.unidade_medida || "UN");
    setCustoEstimado(String(service.custo_estimado || 0.0));
    setObs(service.observacoes || "");
    setShowAddModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      await api.delete(`/services/${id}`);
      alert("Serviço excluído com sucesso!");
      loadServices();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir serviço.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !descricao) {
      alert("Código e Descrição são obrigatórios.");
      return;
    }

    const payload = {
      codigo,
      descricao,
      valor_padrao: parseFloat(valorPadrao) || 0.0,
      categoria: categoria || null,
      aliquota_iss: parseFloat(aliquotaIss) || 0.0,
      codigo_lc116: codigoLc116 || null,
      unidade_medida: unidadeMedida || "UN",
      custo_estimado: parseFloat(custoEstimado) || 0.0,
      observacoes: obs || null
    };

    try {
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
        alert("Serviço atualizado com sucesso!");
      } else {
        await api.post("/services", payload);
        alert("Serviço cadastrado com sucesso!");
      }
      setShowAddModal(false);
      setEditingService(null);
      loadServices();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar serviço.");
    }
  };

  const filteredServices = services.filter(s =>
    s.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.categoria && s.categoria.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
            🛠️ Cadastro de Serviços
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gerencie os serviços disponíveis no sistema para vincular em orçamentos, ordens e vendas rápidas.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
        >
          ➕ Adicionar Serviço
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <input
          type="text"
          placeholder="🔍 Pesquisar por Código, Descrição ou Categoria..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none transition font-medium"
        />

        {loading ? (
          <p className="text-neutral-500 text-xs text-center py-12">Carregando serviços...</p>
        ) : filteredServices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Unidade</th>
                  <th className="py-2.5 px-3 text-right">Valor Padrão</th>
                  <th className="py-2.5 px-3 text-right">Custo Estimado</th>
                  <th className="py-2.5 px-3 text-center">ISS (%)</th>
                  <th className="py-2.5 px-3">LC 116</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                {filteredServices.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-800/20 transition">
                    <td className="py-2.5 px-3 font-mono text-neutral-400">{s.codigo}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-100">{s.descricao}</td>
                    <td className="py-2.5 px-3 text-neutral-450">{s.categoria || "—"}</td>
                    <td className="py-2.5 px-3 text-neutral-450">{s.unidade_medida || "UN"}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-neutral-200">
                      R$ {s.valor_padrao.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-neutral-400">
                      R$ {(s.custo_estimado || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-400">
                      {(s.aliquota_iss || 0).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 font-mono text-[10px]">
                      {s.codigo_lc116 || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center space-x-2">
                      <button
                        onClick={() => handleEdit(s)}
                        className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 rounded transition"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded transition"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-xs text-center py-12">Nenhum serviço cadastrado.</p>
        )}
      </div>

      {/* ADD/EDIT SERVICE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-200">
              {editingService ? "✏️ Editar Cadastro de Serviço" : "➕ Novo Cadastro de Serviço"}
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Código/SKU *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SRV004"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Descrição do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação de Equipamentos de Climatização"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Consultoria, Suporte"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Unidade Medida</label>
                <input
                  type="text"
                  placeholder="Ex: UN, H, KM"
                  value={unidadeMedida}
                  onChange={(e) => setUnidadeMedida(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Valor de Venda (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={valorPadrao}
                  onChange={(e) => setValorPadrao(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none font-bold"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-3">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase mb-3">Tributação & Custos</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="5.0"
                    value={aliquotaIss}
                    onChange={(e) => setAliquotaIss(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Código LC 116</label>
                  <input
                    type="text"
                    placeholder="Ex: 07.02"
                    value={codigoLc116}
                    onChange={(e) => setCodigoLc116(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Custo Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={custoEstimado}
                    onChange={(e) => setCustoEstimado(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">Observações</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                placeholder="Detalhes adicionais sobre os requisitos ou escopo deste serviço..."
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingService(null);
                }}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                {editingService ? "Salvar Alterações" : "Salvar Cadastro"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
