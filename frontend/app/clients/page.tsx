"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Client {
  id: number;
  codigo: string;
  nome_razao: string;
  cpf_cnpj: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [codigo, setCodigo] = useState("");
  const [nomeRazao, setNomeRazao] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      const res = await api.get("/clients");
      setClients(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !nomeRazao || !cpfCnpj) {
      alert("Código, Nome/Razão Social e CPF/CNPJ são obrigatórios.");
      return;
    }

    const payload = {
      codigo,
      nome_razao: nomeRazao,
      cpf_cnpj: cpfCnpj,
      inscricao_estadual: ie || null,
      telefone: telefone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      logradouro: logradouro || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      observacoes: obs || null
    };

    try {
      await api.post("/clients", payload);
      alert("Cliente cadastrado com sucesso!");
      setShowAddModal(false);
      // Reset form
      setCodigo("");
      setNomeRazao("");
      setCpfCnpj("");
      setIe("");
      setTelefone("");
      setWhatsapp("");
      setEmail("");
      setLogradouro("");
      setNumero("");
      setComplemento("");
      setBairro("");
      setCidade("");
      setEstado("");
      setCep("");
      setObs("");
      loadClients();
    } catch (err: any) {
      alert(err.message || "Erro ao cadastrar cliente.");
    }
  };

  const filteredClients = clients.filter(c =>
    c.nome_razao.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cpf_cnpj.includes(searchQuery) ||
    (c.telefone && c.telefone.includes(searchQuery)) ||
    (c.whatsapp && c.whatsapp.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
            👥 Cadastro de Clientes
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gerencie os clientes do sistema para vincular em orçamentos, vendas e contas a receber.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
        >
          ➕ Adicionar Cliente
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <input
          type="text"
          placeholder="🔍 Pesquisar por Nome, CPF/CNPJ ou telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none transition font-medium"
        />

        {loading ? (
          <p className="text-neutral-500 text-xs text-center py-12">Carregando clientes...</p>
        ) : filteredClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nome / Razão Social</th>
                  <th className="py-2.5 px-3">CPF/CNPJ</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3">WhatsApp</th>
                  <th className="py-2.5 px-3">E-mail</th>
                  <th className="py-2.5 px-3">Cidade / UF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-neutral-200">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-800/20 transition">
                    <td className="py-2.5 px-3 font-mono text-neutral-400">{c.codigo}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-100">{c.nome_razao}</td>
                    <td className="py-2.5 px-3">{c.cpf_cnpj}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{c.telefone || "—"}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{c.whatsapp || "—"}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{c.email || "—"}</td>
                    <td className="py-2.5 px-3 text-neutral-400">
                      {c.cidade ? `${c.cidade}/${c.estado || ""}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-xs text-center py-12">Nenhum cliente cadastrado.</p>
        )}
      </div>

      {/* ADD CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-200">➕ Novo Cadastro de Cliente</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Código *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CLI002"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={nomeRazao}
                  onChange={(e) => setNomeRazao(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">CPF / CNPJ *</label>
                <input
                  type="text"
                  required
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Inscrição Estadual</label>
                <input
                  type="text"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">Telefone</label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">WhatsApp</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-3">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase mb-3">Endereço Completo</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1 col-span-3">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Logradouro / Rua</label>
                  <input
                    type="text"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Número</label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Complemento</label>
                  <input
                    type="text"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Bairro</label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Cidade</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 font-bold uppercase">CEP</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
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
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs outline-none"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-bold border border-neutral-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Salvar Cadastro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
