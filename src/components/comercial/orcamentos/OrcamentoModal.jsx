/**
 * Modal de Orçamento — Framework V3 PRO
 * - Navegação livre entre abas
 * - Sem salvamento automático
 * - Registro criado APENAS ao "Salvar Orçamento" (aba Pagamento)
 * - Saída sem alerta se nada foi alterado ou já está salvo
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Users, UserX } from "lucide-react";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import AbaConfiguracaoOrcamento from "./AbaConfiguracaoOrcamento";
import AbaLogisticaOrcamento from "./AbaLogisticaOrcamento";
import AbaPagamentoOrcamento from "./AbaPagamentoOrcamento";


const VAZIO = {
  empresa_emitente: "",
  vendedor: "",
  titulo_orcamento: "",
  cliente_possui_cadastro: null,
  cliente_id: null,
  cliente_nome: "",
  cliente_email: "",
  cliente_telefone: "",
  cliente_whatsapp: "",
};

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OrcamentoModal({ open, onClose, editingId, empresaId, usuarioLogado, readOnly = false }) {
  const { showConfirm, showError } = useGlobalAlert();
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VAZIO });
  const [codigoGerado, setCodigoGerado] = useState(null);
  const [erros, setErros] = useState({});
  const [buscaCliente, setBuscaCliente] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("info");

  // ── Controle de estado ────────────────────────────────────────────────────
  const [isOrcamentoSalvo, setIsOrcamentoSalvo] = useState(false);
  const [hasAlteracoesNaoSalvas, setHasAlteracoesNaoSalvas] = useState(false);
  const [isCompleto, setIsCompleto] = useState(false);

  // ID do orçamento efetivo (editando ou recém criado ao salvar)
  const [orcamentoIdEfetivo, setOrcamentoIdEfetivo] = useState(null);

  // Estado da aba Logística (elevado para evitar perda ao trocar de aba)
  const [formLogistica, setFormLogistica] = useState({
    tipo_frete: "",
    modalidade_frete: "",
    valor_frete: 0,
    numero_cotacao: "",
    transportadora: "",
    local_entrega: "",
    observacoes_logistica: "",
  });

  // Refs para abas filhas
  const logisticaSaveRef = useRef(null);
  const pagamentoSaveRef = useRef(null);

  const isEditing = !!editingId;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_config")
        .select("id, razao_social, cnpj")
        .is("deleted_at", null)
        .neq("status", "Inativo")
        .order("razao_social");
      if (error) console.warn("[OrcamentoModal] empresas_config erro:", error.message);
      return data || [];
    },
  });

  const { data: erpUsuarios = [] } = useQuery({
    queryKey: ["erp-usuarios-orcamento"],
    queryFn: async () => {
      const { data } = await supabase.from("erp_usuarios").select("*").eq("status", "Ativo").is("deleted_at", null);
      return data || [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-orcamento", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: orcamentoExistente } = useQuery({
    queryKey: ["orcamento-editar", editingId],
    queryFn: async () => {
      const { data } = await supabase.from("com_orcamentos").select("*").eq("id", editingId).maybeSingle();
      return data || null;
    },
    enabled: !!editingId,
  });

  // ── Pré-população ao abrir ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // Reset ao abrir
    setCodigoGerado(null);
    setErros({});
    setBuscaCliente("");
    setAbaAtiva("info");
    setIsOrcamentoSalvo(false);
    setHasAlteracoesNaoSalvas(false);
    if (!editingId) {
      setOrcamentoIdEfetivo(null);
      setForm({ ...VAZIO });
      setFormLogistica({
        tipo_frete: "", modalidade_frete: "", valor_frete: 0,
        numero_cotacao: "", transportadora: "", local_entrega: "", observacoes_logistica: "",
      });
    }
  }, [open, editingId, qc]);

  useEffect(() => {
    if (orcamentoExistente) {
      setForm({ ...VAZIO, ...orcamentoExistente });
      setCodigoGerado(orcamentoExistente.codigo_orcamento || null);
      setOrcamentoIdEfetivo(orcamentoExistente.id);
      setHasAlteracoesNaoSalvas(false);
      setIsOrcamentoSalvo(!!orcamentoExistente.codigo_orcamento);
      setIsCompleto(orcamentoExistente.status === "pronto");
    }
  }, [orcamentoExistente]);

  useEffect(() => {
    if (!isEditing && empresas.length > 0) {
      setForm(prev => ({ ...prev, empresa_emitente: prev.empresa_emitente || empresas[0]?.razao_social || "" }));
    }
  }, [empresas, isEditing]);

  useEffect(() => {
    if (!isEditing && usuarioLogado) {
      setForm(prev => ({ ...prev, vendedor: prev.vendedor || usuarioLogado?.nome || "" }));
    }
  }, [usuarioLogado, isEditing]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setHasAlteracoesNaoSalvas(true);
    setIsOrcamentoSalvo(false);
  };

  const handleClienteSelecionado = (clienteId) => {
    const c = clientes.find(x => x.id === clienteId);
    if (!c) return;
    setForm(prev => ({
      ...prev,
      cliente_id: c.id,
      cliente_nome: c.nome_cliente || "",
      cliente_email: c.email || "",
      cliente_telefone: c.telefone || "",
      cliente_whatsapp: c.celular || "",
    }));
    setBuscaCliente("");
    setHasAlteracoesNaoSalvas(true);
    setIsOrcamentoSalvo(false);
  };

  const clientesFiltrados = clientes.filter(c => {
    const q = buscaCliente.toLowerCase();
    return (
      (c.nome_cliente || "").toLowerCase().includes(q) ||
      (c.documento || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.cidade || "").toLowerCase().includes(q)
    );
  });

  // ── Validação da aba Info (usada antes de salvar na aba Pagamento) ─────────
  const validarInfo = () => {
    const e = {};
    if (!form.empresa_emitente) e.empresa_emitente = "Obrigatório";
    if (!form.vendedor) e.vendedor = "Obrigatório";
    if (!form.titulo_orcamento) e.titulo_orcamento = "Obrigatório";

    if (!isEditing && !orcamentoIdEfetivo) {
      if (form.cliente_possui_cadastro === null || form.cliente_possui_cadastro === undefined) {
        e.cliente_possui_cadastro = "Selecione uma opção";
      } else if (form.cliente_possui_cadastro === true && !form.cliente_id) {
        e.cliente_id = "Selecione um cliente";
      } else if (form.cliente_possui_cadastro === false) {
        if (!form.cliente_nome) e.cliente_nome = "Nome obrigatório";
        if (!form.cliente_telefone) e.cliente_telefone = "Telefone obrigatório";
        if (!form.cliente_email) e.cliente_email = "Obrigatório";
        else if (!validarEmail(form.cliente_email)) e.cliente_email = "E-mail inválido";
      }
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  // ── Mutation para criar orçamento (ao salvar na aba Pagamento) ─────────────
  const criarOrcamentoMutation = useMutation({
    mutationFn: async (dados) => {
      const { data, error } = await supabase.from("com_orcamentos").insert({ ...dados, empresa_id: empresaId, status: "Em elaboração" }).select().single();
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("ID não retornado ao criar orçamento");
      return data.id;
    },
  });

  // Chamado pela aba Pagamento ao acionar "Salvar Orçamento"
  // Garante que o registro existe antes de prosseguir
  const garantirOrcamentoId = async () => {
    if (orcamentoIdEfetivo) return orcamentoIdEfetivo;
    if (!validarInfo()) {
      setAbaAtiva("info");
      throw new Error("Preencha os campos obrigatórios na aba Informações");
    }
    const id = await criarOrcamentoMutation.mutateAsync({
      empresa_emitente: form.empresa_emitente,
      vendedor: form.vendedor,
      titulo_orcamento: form.titulo_orcamento,
      cliente_id: form.cliente_id || null,
      cliente_nome: form.cliente_nome,
      cliente_email: form.cliente_email,
      cliente_telefone: form.cliente_telefone,
      cliente_whatsapp: form.cliente_whatsapp,
    });
    setOrcamentoIdEfetivo(id);
    return id;
  };

  // ── Tentativa de fechar ───────────────────────────────────────────────────
  const fechar = (savedOk = false) => {
    setForm({ ...VAZIO });
    setCodigoGerado(null);
    setOrcamentoIdEfetivo(null);
    setErros({});
    setAbaAtiva("info");
    setIsOrcamentoSalvo(false);
    setHasAlteracoesNaoSalvas(false);
    setIsCompleto(false);
    onClose(savedOk);
  };

  const tentarFechar = () => {
    // Pode sair sem alerta se: sem alterações pendentes ou nada foi criado ainda
    if (!hasAlteracoesNaoSalvas && !orcamentoIdEfetivo) {
      fechar(false);
      return;
    }
    if (isOrcamentoSalvo) {
      fechar(false);
      return;
    }
    // Orçamento existe mas não está completo
    if (!isCompleto) {
      showConfirm({
        title: "Orçamento incompleto",
        description: "Ainda existem informações obrigatórias não preenchidas. Deseja fechar mesmo assim?",
        confirmLabel: "Fechar mesmo assim",
        cancelLabel: "Continuar editando",
        confirmVariant: "destructive",
        onConfirm: () => fechar(false),
      });
      return;
    }
    fechar(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={tentarFechar} />

      {/* Modal + Resumo lateral */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3" style={{ width: "min(100vw - 32px, 1220px)", maxWidth: "100%" }}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? "Editar Orçamento" : "Novo Orçamento"}
              </h2>
              {codigoGerado && (
                <span className="font-mono text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1">
                  {codigoGerado}
                </span>
              )}
              {!codigoGerado && (
                <span className="text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-1">
                  Número gerado ao salvar
                </span>
              )}
              {readOnly && (
                <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
                  Modo visualização
                </span>
              )}
              {!readOnly && hasAlteracoesNaoSalvas && !isOrcamentoSalvo && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Alterações não salvas
                </span>
              )}
            </div>
            <button
              onClick={tentarFechar}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {/* Navegação entre abas */}
            <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
              {[
                { key: "info", label: "Informações" },
                { key: "configuracao", label: "Configuração" },
                { key: "logistica", label: "Logística" },
                { key: "pagamento", label: "Pagamento" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAbaAtiva(key)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    abaAtiva === key
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={readOnly ? "pointer-events-none select-none" : ""}>
              {/* ─── ABA 1: INFORMAÇÕES ─────────────────────────────────── */}
                <div className={`space-y-5 ${abaAtiva !== "info" ? "hidden" : ""}`}>

                {/* Empresa + Vendedor */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Empresa Emitente *</Label>
                    <Select value={form.empresa_emitente} onValueChange={v => setField("empresa_emitente", v)}>
                      <SelectTrigger className={`bg-white h-9 ${erros.empresa_emitente ? "border-red-400" : ""}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map(e => (
                          <SelectItem key={e.id} value={e.razao_social}>{e.razao_social}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {erros.empresa_emitente && <p className="text-xs text-red-500">{erros.empresa_emitente}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Vendedor *</Label>
                    <Select value={form.vendedor} onValueChange={v => setField("vendedor", v)}>
                      <SelectTrigger className={`bg-white h-9 ${erros.vendedor ? "border-red-400" : ""}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {erpUsuarios.map(u => (
                          <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {erros.vendedor && <p className="text-xs text-red-500">{erros.vendedor}</p>}
                  </div>
                </div>

                {/* Título */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Título do Orçamento *</Label>
                  <Input
                    value={form.titulo_orcamento}
                    onChange={e => setField("titulo_orcamento", e.target.value)}
                    className={`bg-white h-9 ${erros.titulo_orcamento ? "border-red-400" : ""}`}
                    placeholder=""
                  />
                  {erros.titulo_orcamento && <p className="text-xs text-red-500">{erros.titulo_orcamento}</p>}
                </div>

                {/* Toggle cliente com/sem cadastro (apenas criação de novo) */}
                {!isEditing && !orcamentoIdEfetivo && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-700">Cliente *</Label>

                    <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={() => {
                          setField("cliente_possui_cadastro", true);
                          setField("cliente_id", null);
                          setField("cliente_nome", "");
                          setField("cliente_email", "");
                          setField("cliente_telefone", "");
                          setBuscaCliente("");
                        }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                          form.cliente_possui_cadastro === true
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        Com cadastro
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setField("cliente_possui_cadastro", false);
                          setField("cliente_id", null);
                          setField("cliente_nome", "");
                          setField("cliente_email", "");
                          setField("cliente_telefone", "");
                          setBuscaCliente("");
                        }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                          form.cliente_possui_cadastro === false
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <UserX className="h-4 w-4" />
                        Sem cadastro
                      </button>
                    </div>
                    {erros.cliente_possui_cadastro && (
                      <p className="text-xs text-red-500">{erros.cliente_possui_cadastro}</p>
                    )}

                    {/* COM cadastro — autocomplete */}
                    {form.cliente_possui_cadastro === true && (
                      <div className={`bg-slate-50 rounded-xl p-4 ${erros.cliente_id ? "ring-1 ring-red-400" : ""}`}>
                        {erros.cliente_id && <p className="text-xs text-red-500 mb-2">{erros.cliente_id}</p>}
                        {form.cliente_id ? (
                          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                            <span className="flex-1 text-sm font-medium text-blue-800">{form.cliente_nome}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setField("cliente_id", null);
                                setField("cliente_nome", "");
                                setField("cliente_email", "");
                                setField("cliente_telefone", "");
                                setField("cliente_whatsapp", "");
                              }}
                              className="text-blue-400 hover:text-blue-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                className="pl-9 bg-white h-9"
                                placeholder=""
                                value={buscaCliente}
                                onChange={e => setBuscaCliente(e.target.value)}
                              />
                            </div>
                            {buscaCliente && (
                              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y">
                                {clientesFiltrados.slice(0, 10).map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleClienteSelecionado(c.id)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                                  >
                                    <span className="font-medium text-slate-800">{c.nome_cliente}</span>
                                    {c.documento && <span className="text-slate-400 ml-2 text-xs">{c.documento}</span>}
                                  </button>
                                ))}
                                {clientesFiltrados.length === 0 && (
                                  <p className="px-3 py-2 text-sm text-slate-400">Nenhum cliente encontrado</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SEM cadastro — campos manuais */}
                    {form.cliente_possui_cadastro === false && (
                      <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-slate-700">Nome do Cliente *</Label>
                          <Input
                            value={form.cliente_nome}
                            onChange={e => setField("cliente_nome", e.target.value)}
                            className={`bg-white h-9 ${erros.cliente_nome ? "border-red-400" : ""}`}
                            placeholder=""
                          />
                          {erros.cliente_nome && <p className="text-xs text-red-500">{erros.cliente_nome}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-slate-700">Telefone *</Label>
                          <Input
                            type="tel"
                            value={form.cliente_telefone}
                            onChange={e => {
                              let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                              if (v.length > 10) {
                                v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
                              } else if (v.length > 6) {
                                v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
                              } else if (v.length > 2) {
                                v = v.replace(/^(\d{2})(\d+)$/, "($1) $2");
                              } else if (v.length > 0) {
                                v = v.replace(/^(\d+)$/, "($1");
                              }
                              setField("cliente_telefone", v);
                            }}
                            className={`bg-white h-9 ${erros.cliente_telefone ? "border-red-400" : ""}`}
                          />
                          {erros.cliente_telefone && <p className="text-xs text-red-500">{erros.cliente_telefone}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-slate-700">E-mail *</Label>
                          <Input
                            type="email"
                            value={form.cliente_email}
                            onChange={e => setField("cliente_email", e.target.value)}
                            className={`bg-white h-9 ${erros.cliente_email ? "border-red-400" : ""}`}
                            placeholder=""
                          />
                          {erros.cliente_email && <p className="text-xs text-red-500">{erros.cliente_email}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Exibição do cliente ao editar ou após criação */}
                {(isEditing || orcamentoIdEfetivo) && form.cliente_nome && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Cliente</Label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-medium text-blue-800">{form.cliente_nome}</span>
                    </div>
                  </div>
                )}

              </div>

              {/* ─── ABA 2: CONFIGURAÇÃO ────────────────────────────────── */}
              <div className={abaAtiva !== "configuracao" ? "hidden" : ""}>
                <AbaConfiguracaoOrcamento orcamentoId={orcamentoIdEfetivo || editingId} empresaId={empresaId} garantirOrcamentoId={garantirOrcamentoId} readOnly={readOnly} />
              </div>

              {/* ─── ABA 3: LOGÍSTICA ───────────────────────────────────── */}
              <div className={abaAtiva !== "logistica" ? "hidden" : ""}>
                <AbaLogisticaOrcamento
                  orcamentoId={orcamentoIdEfetivo}
                  empresaId={empresaId}
                  clienteId={form.cliente_id}
                  garantirOrcamentoId={garantirOrcamentoId}
                  formExterno={formLogistica}
                  onFormChange={setFormLogistica}
                  onRegisterSave={fn => { logisticaSaveRef.current = fn; }}
                />
              </div>

              {/* ─── ABA 4: PAGAMENTO ───────────────────────────────────── */}
              <div className={abaAtiva !== "pagamento" ? "hidden" : ""}>
                <AbaPagamentoOrcamento
                  orcamentoId={orcamentoIdEfetivo}
                  empresaId={empresaId}
                  formInfo={form}
                  garantirOrcamentoId={garantirOrcamentoId}
                  readOnly={readOnly}
                  onRegisterSave={fn => { pagamentoSaveRef.current = fn; }}
                  onBeforeSave={async (idFinal) => {
                    if (logisticaSaveRef.current) {
                      await logisticaSaveRef.current(idFinal);
                    }
                  }}
                  onSalvoComSucesso={(codigo, id, completo) => {
                    setCodigoGerado(codigo);
                    if (id && !orcamentoIdEfetivo) setOrcamentoIdEfetivo(id);
                    setIsOrcamentoSalvo(true);
                    setHasAlteracoesNaoSalvas(false);
                    setIsCompleto(!!completo);
                    qc.invalidateQueries(["com-orcamentos"]);
                    setTimeout(() => fechar(true), 300);
                  }}
                />
              </div>
            </div>
          </div>
        </div>


      </div>
    </>
  );
}