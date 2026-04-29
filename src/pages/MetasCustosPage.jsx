import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/components/lib/supabaseClient";
import { useEmpresa } from "@/components/context/EmpresaContext";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Target, DollarSign, TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIAS_TERCEIROS = [
  'Corte', 'Confeccao interna', 'Confeccao externa',
  'Estamparia interna', 'Estamparia externa', 'Revisao', 'Embalagem', 'Logistica'
];

function fmtPct(v) {
  return `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
function fmtBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(v) {
  return Number(v || 0).toLocaleString("pt-BR");
}

// ── Card de KPI ────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-3", colors[color])}>
      <div className="h-10 w-10 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

// ── Aba Metas ───────────────────────────────────────────────────────────────
function AbaMetas({ empresa_id }) {
  const { showError, showSuccess } = useGlobalAlert();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ capacidade_private_label: "", ticket_medio_private_label: "", capacidade_eventos: "", ticket_medio_eventos: "" });

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("metas_operacionais").select("*").eq("empresa_id", empresa_id).maybeSingle();
    setMeta(data || null);
    setLoading(false);
  }, [empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirModal = () => {
    setForm({
      capacidade_private_label: meta?.capacidade_private_label ?? "",
      ticket_medio_private_label: meta?.ticket_medio_private_label ?? "",
      capacidade_eventos: meta?.capacidade_eventos ?? "",
      ticket_medio_eventos: meta?.ticket_medio_eventos ?? "",
    });
    setModalOpen(true);
  };

  const salvar = async () => {
    setSalvando(true);
    const payload = { empresa_id, capacidade_private_label: parseInt(form.capacidade_private_label) || 0, ticket_medio_private_label: parseFloat(form.ticket_medio_private_label) || 0, capacidade_eventos: parseInt(form.capacidade_eventos) || 0, ticket_medio_eventos: parseFloat(form.ticket_medio_eventos) || 0 };
    const { error } = meta?.id
      ? await supabase.from("metas_operacionais").update(payload).eq("id", meta.id)
      : await supabase.from("metas_operacionais").insert(payload);
    setSalvando(false);
    if (!error) { showSuccess({ title: "Meta salva!", description: "Dados atualizados com sucesso." }); setModalOpen(false); carregar(); }
    else showError({ title: "Erro", description: error.message });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Metas Operacionais</h2>
        <Button onClick={abrirModal} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Pencil className="h-4 w-4" />
          {meta ? "Editar Meta" : "Definir Meta"}
        </Button>
      </div>

      {!meta ? (
        <div className="text-center py-16 text-slate-400 text-sm">Nenhuma meta definida. Clique em "Definir Meta" para começar.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-slate-500">Capacidade Private Label / mês</p>
              <p className="text-2xl font-bold text-slate-800">{fmtInt(meta.capacidade_private_label)} <span className="text-sm font-normal text-slate-500">peças</span></p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-slate-500">Ticket Médio Private Label</p>
              <p className="text-2xl font-bold text-slate-800">{fmtBRL(meta.ticket_medio_private_label)}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-slate-500">Capacidade Eventos / mês</p>
              <p className="text-2xl font-bold text-slate-800">{fmtInt(meta.capacidade_eventos)} <span className="text-sm font-normal text-slate-500">peças</span></p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-slate-500">Ticket Médio Eventos</p>
              <p className="text-2xl font-bold text-slate-800">{fmtBRL(meta.ticket_medio_eventos)}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Meta Produção Anual" value={`${fmtInt(meta.meta_producao_anual)} pçs`} icon={Target} color="blue" />
            <KpiCard label="Fat. Private Label" value={fmtBRL(meta.faturamento_private_label)} icon={TrendingUp} color="green" />
            <KpiCard label="Fat. Eventos" value={fmtBRL(meta.faturamento_eventos)} icon={Package} color="purple" />
            <KpiCard label="Faturamento Total" value={fmtBRL(meta.faturamento_total)} icon={DollarSign} color="amber" />
          </div>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Meta Operacional</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Capacidade Private Label (peças/mês)</label>
              <Input type="number" min="0" value={form.capacidade_private_label} onChange={e => setForm(f => ({ ...f, capacidade_private_label: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Ticket Médio Private Label (R$)</label>
              <Input type="number" min="0" step="0.01" value={form.ticket_medio_private_label} onChange={e => setForm(f => ({ ...f, ticket_medio_private_label: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Capacidade Eventos (peças/mês)</label>
              <Input type="number" min="0" value={form.capacidade_eventos} onChange={e => setForm(f => ({ ...f, capacidade_eventos: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Ticket Médio Eventos (R$)</label>
              <Input type="number" min="0" step="0.01" value={form.ticket_medio_eventos} onChange={e => setForm(f => ({ ...f, ticket_medio_eventos: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tabela genérica com CRUD ────────────────────────────────────────────────
function TabelaCRUD({ titulo, colunas, dados, totais, loading, onNovo, onEditar, onDeletar, renderTotais }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
        <Button onClick={onNovo} className="gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" />Novo</Button>
      </div>
      {totais && renderTotais && renderTotais(totais)}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : dados.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Nenhum registro cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {colunas.map(c => <th key={c.key} className="px-4 py-3 text-left font-medium text-xs text-slate-500">{c.label}</th>)}
                  <th className="px-4 py-3 text-center font-medium text-xs text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    {colunas.map(c => (
                      <td key={c.key} className="px-4 py-3 text-xs text-slate-700">
                        {c.render ? c.render(row[c.key], row) : row[c.key]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" onClick={() => onEditar(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                        {onDeletar && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => onDeletar(row)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Aba Custos Fixos ────────────────────────────────────────────────────────
function AbaCustosFixos({ empresa_id }) {
  const { showError, showSuccess, showConfirm } = useGlobalAlert();
  const [dados, setDados] = useState([]);
  const [totais, setTotais] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ id: null, descricao: "", percentual: "", tipo: "direto", centro_custo_id: "" });
  const [centros, setCentros] = useState([]);

  useEffect(() => {
    supabase.from("centros_custo").select("*").eq("empresa_id", empresa_id).is("deleted_at", null)
      .then(({ data }) => setCentros(data || []));
  }, [empresa_id]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("despesas_variaveis").select("*,centros_custo(descricao)").eq("empresa_id", empresa_id).is("deleted_at", null);
    const dados = (data || []).map(r => ({ ...r, centro_custo_descricao: r.centros_custo?.descricao }));
    setDados(dados);
    const totalDireto = dados.filter(r => r.tipo === 'direto').reduce((s, r) => s + (r.percentual || 0), 0);
    const totalIndireto = dados.filter(r => r.tipo === 'indireto').reduce((s, r) => s + (r.percentual || 0), 0);
    setTotais({ total_direto: totalDireto, total_indireto: totalIndireto });
    setLoading(false);
  }, [empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setForm({ id: null, descricao: "", percentual: "", tipo: "direto", centro_custo_id: "" }); setModalOpen(true); };
  const abrirEditar = (row) => { setForm({ id: row.id, descricao: row.descricao, percentual: row.percentual, tipo: row.tipo, centro_custo_id: row.centro_custo_id || "" }); setModalOpen(true); };

  const salvar = async () => {
    setSalvando(true);
    const payload = { empresa_id, descricao: form.descricao, percentual: parseFloat(form.percentual) || 0, tipo: form.tipo, centro_custo_id: form.centro_custo_id || null };
    const { error } = form.id ? await supabase.from("despesas_variaveis").update(payload).eq("id", form.id) : await supabase.from("despesas_variaveis").insert(payload);
    setSalvando(false);
    if (!error) { showSuccess({ title: "Salvo!" }); setModalOpen(false); carregar(); }
    else showError({ title: "Erro", description: error.message });
  };

  const deletar = (row) => showConfirm({
    title: "Excluir custo fixo?",
    description: `"${row.descricao}" será removido.`,
    onConfirm: async () => {
      const { error } = await supabase.from("despesas_variaveis").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (!error) { showSuccess({ title: "Removido!" }); carregar(); }
      else showError({ title: "Erro", description: error.message });
    }
  });

  return (
    <>
      <TabelaCRUD
        titulo="Custos Fixos"
        dados={dados}
        totais={totais}
        loading={loading}
        onNovo={abrirNovo}
        onEditar={abrirEditar}
        onDeletar={null}
        renderTotais={(t) => (
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Total Direto" value={fmtPct(t.total_direto)} icon={TrendingUp} color="green" />
            <KpiCard label="Total Indireto" value={fmtPct(t.total_indireto)} icon={TrendingUp} color="amber" />
          </div>
        )}
        colunas={[
          { key: "descricao", label: "Descrição" },
          { key: "percentual", label: "Percentual", render: v => fmtPct(v) },
          { key: "tipo", label: "Tipo", render: v => <span className={cn("px-2 py-0.5 rounded text-xs font-medium", v === "direto" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{v}</span> },
          { key: "percentual_rateado", label: "% Rateado", render: v => v != null ? fmtPct(v) : <span className="text-slate-400">—</span> },
          { key: "percentual_total", label: "% Total", render: v => v != null ? fmtPct(v) : <span className="text-slate-400">—</span> },
          { key: "centro_custo_descricao", label: "Centro de Custo", render: v => v || <span className="text-slate-400">—</span> },
        ]}
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} Custo Fixo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} disabled={!!form.id} className={form.id ? "bg-slate-50 text-slate-500" : ""} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Percentual (%)</label>
              <Input type="number" min="0" step="0.01" value={form.percentual} onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))} disabled={!!form.id}>
                <SelectTrigger className={form.id ? "bg-slate-50 text-slate-500" : ""}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="direto">Direto</SelectItem><SelectItem value="indireto">Indireto</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Centro de Custo</label>
              <Select value={form.centro_custo_id || "_nenhum"} onValueChange={v => setForm(f => ({ ...f, centro_custo_id: v === "_nenhum" ? "" : v }))} disabled={!!form.id}>
                <SelectTrigger className={form.id ? "bg-slate-50 text-slate-500" : ""}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_nenhum">Nenhum</SelectItem>
                  {centros.filter(c => c.ativo !== false).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Aba Despesas Variáveis ──────────────────────────────────────────────────
function AbaDespesasVariaveis({ empresa_id }) {
  const { showError, showSuccess, showConfirm } = useGlobalAlert();
  const [dados, setDados] = useState([]);
  const [totais, setTotais] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ id: null, descricao: "", percentual: "" });

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("despesas_variaveis").select("*").eq("empresa_id", empresa_id).is("deleted_at", null);
    setDados(data || []);
    const total = (data || []).reduce((s, r) => s + (r.percentual || 0), 0);
    setTotais({ total_despesas: total });
    setLoading(false);
  }, [empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setForm({ id: null, descricao: "", percentual: "" }); setModalOpen(true); };
  const abrirEditar = (row) => { setForm({ id: row.id, descricao: row.descricao, percentual: row.percentual }); setModalOpen(true); };

  const salvar = async () => {
    setSalvando(true);
    const payload = { empresa_id, descricao: form.descricao, percentual: parseFloat(form.percentual) || 0 };
    const { error } = form.id ? await supabase.from("despesas_variaveis").update(payload).eq("id", form.id) : await supabase.from("despesas_variaveis").insert(payload);
    setSalvando(false);
    if (!error) { showSuccess({ title: "Salvo!" }); setModalOpen(false); carregar(); }
    else showError({ title: "Erro", description: error.message });
  };

  const deletar = (row) => showConfirm({
    title: "Excluir despesa?",
    description: `"${row.descricao}" será removida.`,
    onConfirm: async () => {
      const { error } = await supabase.from("despesas_variaveis").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (!error) { showSuccess({ title: "Removido!" }); carregar(); }
      else showError({ title: "Erro", description: error.message });
    }
  });

  return (
    <>
      <TabelaCRUD
        titulo="Despesas Variáveis"
        dados={dados}
        totais={totais}
        loading={loading}
        onNovo={abrirNovo}
        onEditar={abrirEditar}
        onDeletar={deletar}
        renderTotais={(t) => (
          <div className="grid grid-cols-1 max-w-xs">
            <KpiCard label="Total Despesas" value={fmtPct(t.total_despesas)} icon={TrendingUp} color="purple" />
          </div>
        )}
        colunas={[
          { key: "descricao", label: "Descrição" },
          { key: "percentual", label: "Percentual", render: v => fmtPct(v) },
        ]}
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} Despesa Variável</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Percentual (%)</label><Input type="number" min="0" step="0.01" value={form.percentual} onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Aba Informações Financeiras ─────────────────────────────────────────────
function AbaInfoFinanceiras({ empresa_id }) {
  const { showError, showSuccess, showConfirm } = useGlobalAlert();
  const [dados, setDados] = useState([]);
  const [totais, setTotais] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ id: null, descricao: "", percentual: "", tipo: "direto", opcao: "" });

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("informacoes_financeiras").select("*").eq("empresa_id", empresa_id).is("deleted_at", null);
    setDados(data || []);
    const totalDireto = (data || []).filter(r => r.tipo === 'direto').reduce((s, r) => s + (r.percentual || 0), 0);
    const totalIndireto = (data || []).filter(r => r.tipo === 'indireto').reduce((s, r) => s + (r.percentual || 0), 0);
    setTotais({ total_direto: totalDireto, total_indireto: totalIndireto });
    setLoading(false);
  }, [empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setForm({ id: null, descricao: "", percentual: "", tipo: "direto", opcao: "" }); setModalOpen(true); };
  const abrirEditar = (row) => { setForm({ id: row.id, descricao: row.descricao, percentual: row.percentual, tipo: row.tipo, opcao: row.opcao || "" }); setModalOpen(true); };

  const salvar = async () => {
    setSalvando(true);
    const payload = { empresa_id, descricao: form.descricao, percentual: parseFloat(form.percentual) || 0, tipo: form.tipo, opcao: form.opcao || null };
    const { error } = form.id ? await supabase.from("informacoes_financeiras").update(payload).eq("id", form.id) : await supabase.from("informacoes_financeiras").insert(payload);
    setSalvando(false);
    if (!error) { showSuccess({ title: "Salvo!" }); setModalOpen(false); carregar(); }
    else showError({ title: "Erro", description: error.message });
  };

  const deletar = (row) => showConfirm({
    title: "Excluir informação?",
    description: `"${row.descricao}" será removida.`,
    onConfirm: async () => {
      const { error } = await supabase.from("informacoes_financeiras").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (!error) { showSuccess({ title: "Removido!" }); carregar(); }
      else showError({ title: "Erro", description: error.message });
    }
  });

  return (
    <>
      <TabelaCRUD
        titulo="Informações Financeiras"
        dados={dados}
        totais={totais}
        loading={loading}
        onNovo={abrirNovo}
        onEditar={abrirEditar}
        onDeletar={deletar}
        renderTotais={(t) => (
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Total Direto" value={fmtPct(t.total_direto)} icon={DollarSign} color="green" />
            <KpiCard label="Total Indireto" value={fmtPct(t.total_indireto)} icon={DollarSign} color="amber" />
          </div>
        )}
        colunas={[
          { key: "descricao", label: "Descrição" },
          { key: "percentual", label: "Percentual", render: v => fmtPct(v) },
          { key: "tipo", label: "Tipo", render: v => <span className={cn("px-2 py-0.5 rounded text-xs font-medium", v === "direto" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{v}</span> },
          { key: "opcao", label: "Opção", render: v => { if (v === "produto") return "Produto"; if (v === "serviço") return "Serviço"; if (v === "nao_se_aplica") return "Não se aplica"; return "-"; } },
        ]}
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} Informação Financeira</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Percentual (%)</label><Input type="number" min="0" step="0.01" value={form.percentual} onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="direto">Direto</SelectItem><SelectItem value="indireto">Indireto</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Opção</label>
              <Select value={form.opcao || "_nenhuma"} onValueChange={v => setForm(f => ({ ...f, opcao: v === "_nenhuma" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_nenhuma">—</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="serviço">Serviço</SelectItem>
                  <SelectItem value="nao_se_aplica">Não se aplica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Aba Custos Terceiros ────────────────────────────────────────────────────
function AbaCustosTerceiros({ empresa_id }) {
  const { showError, showSuccess, showConfirm } = useGlobalAlert();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ id: null, descricao: "", valor: "", categoria: CATEGORIAS_TERCEIROS[0] });

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("metas_custos_terceiros").select("*").eq("empresa_id", empresa_id).is("deleted_at", null);
    setDados(data || []);
    setLoading(false);
  }, [empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setForm({ id: null, descricao: "", valor: "", categoria: CATEGORIAS_TERCEIROS[0] }); setModalOpen(true); };
  const abrirEditar = (row) => { setForm({ id: row.id, descricao: row.descricao, valor: row.valor, categoria: row.categoria }); setModalOpen(true); };

  const salvar = async () => {
    setSalvando(true);
    const payload = { empresa_id, descricao: form.descricao, valor: parseFloat(form.valor) || 0, categoria: form.categoria };
    const { error } = form.id ? await supabase.from("metas_custos_terceiros").update(payload).eq("id", form.id) : await supabase.from("metas_custos_terceiros").insert(payload);
    setSalvando(false);
    if (!error) { showSuccess({ title: "Salvo!" }); setModalOpen(false); carregar(); }
    else showError({ title: "Erro", description: error.message });
  };

  const deletar = (row) => showConfirm({
    title: "Excluir custo de terceiro?",
    description: `"${row.descricao}" será removido.`,
    onConfirm: async () => {
      const { error } = await supabase.from("metas_custos_terceiros").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
      if (!error) { showSuccess({ title: "Removido!" }); carregar(); }
      else showError({ title: "Erro", description: error.message });
    }
  });

  return (
    <>
      <TabelaCRUD
        titulo="Custos de Terceiros"
        dados={dados}
        loading={loading}
        onNovo={abrirNovo}
        onEditar={abrirEditar}
        onDeletar={deletar}
        colunas={[
          { key: "categoria", label: "Categoria", render: v => <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{v}</span> },
          { key: "descricao", label: "Descrição" },
          { key: "valor", label: "Valor", render: v => fmtBRL(v) },
        ]}
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} Custo de Terceiro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Categoria</label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_TERCEIROS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Valor (R$)</label><Input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Página Principal ────────────────────────────────────────────────────────
export default function MetasCustosPage() {
  const { empresa_id } = useEmpresa();

  if (!empresa_id) {
    return <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Empresa não identificada.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Metas e Custos Operacionais</h1>
        <p className="text-slate-500 text-sm mt-1">Configure metas, custos fixos, despesas variáveis e informações financeiras da empresa.</p>
      </div>

      <Tabs defaultValue="metas" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="custos_fixos">Custos Fixos</TabsTrigger>
          <TabsTrigger value="despesas">Despesas Variáveis</TabsTrigger>
          <TabsTrigger value="financeiro">Inf. Financeiras</TabsTrigger>
          <TabsTrigger value="terceiros">Custos Terceiros</TabsTrigger>
        </TabsList>

        <TabsContent value="metas"><AbaMetas empresa_id={empresa_id} /></TabsContent>
        <TabsContent value="custos_fixos"><AbaCustosFixos empresa_id={empresa_id} /></TabsContent>
        <TabsContent value="despesas"><AbaDespesasVariaveis empresa_id={empresa_id} /></TabsContent>
        <TabsContent value="financeiro"><AbaInfoFinanceiras empresa_id={empresa_id} /></TabsContent>
        <TabsContent value="terceiros"><AbaCustosTerceiros empresa_id={empresa_id} /></TabsContent>
      </Tabs>
    </div>
  );
}