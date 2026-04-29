import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/components/lib/supabaseClient';
import { useGlobalAlert } from '@/components/GlobalAlertDialog';
import { useEmpresa } from '@/components/context/EmpresaContext';
import { useSupabaseAuth } from '@/components/context/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CheckCircle2, XCircle, Plus } from 'lucide-react';

const formatVal = v => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—';
const formatDate = d => d ? new Date(d).toLocaleString('pt-BR') : '—';
const statusColor = s => ({ aberto: 'bg-blue-100 text-blue-700', ganho: 'bg-green-100 text-green-700', perdido: 'bg-red-100 text-red-700' }[s] || 'bg-slate-100 text-slate-600');

export default function CRMDetalhePage() {
  const navigate = useNavigate();
  const { empresa_id } = useEmpresa();
  const { erpUsuario } = useSupabaseAuth();
  const { showConfirm, showError, showSuccess } = useGlobalAlert();

  const urlParams = new URLSearchParams(window.location.search);
  const oportunidadeId = urlParams.get('id');

  const [op, setOp] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [motivosPerda, setMotivosPerda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [motivoSelecionado, setMotivoSelecionado] = useState('');
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', tipo: 'Ligação', data_execucao: '' });
  const [showTarefaForm, setShowTarefaForm] = useState(false);

  const carregar = useCallback(async () => {
    if (!oportunidadeId || !empresa_id) return;
    setLoading(true);
    try {
      const [opRes, histRes, tarefasRes, motivosRes] = await Promise.all([
        supabase.from('crm_oportunidades').select('id,titulo,valor,etapa_id,status,responsavel_nome,responsavel_id,created_at,cliente_nome,artigo_nome,cor_nome,quantidade,observacoes,motivo_perda_id,motivo_perda_nome,orcamento_id').eq('id', oportunidadeId).maybeSingle(),
        supabase.from('crm_oportunidade_historico').select('*').eq('oportunidade_id', oportunidadeId).order('created_at', { ascending: false }),
        supabase.from('crm_tarefas').select('*').eq('oportunidade_id', oportunidadeId).order('data_execucao'),
        supabase.from('crm_motivos_perda').select('*').eq('empresa_id', empresa_id).is('deleted_at', null),
      ]);
      setOp(opRes.data || null);
      setHistorico(histRes.data || []);
      setTarefas(tarefasRes.data || []);
      setMotivosPerda(motivosRes.data || []);
    } catch (e) {
      showError({ title: 'Erro ao carregar oportunidade', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [oportunidadeId, empresa_id]);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarGanho = () => {
    showConfirm({
      title: 'Marcar como Ganho?',
      description: 'A oportunidade será encerrada como GANHO.',
      onConfirm: async () => {
        await supabase.from('crm_oportunidades').update({ status: 'ganho', updated_at: new Date().toISOString() }).eq('id', oportunidadeId);
        await supabase.from('crm_oportunidade_historico').insert({ oportunidade_id: oportunidadeId, acao: 'ganho', descricao: 'Oportunidade marcada como GANHO' });
        showSuccess({ title: 'Sucesso', description: 'Oportunidade marcada como GANHO!' });
        carregar();
      },
    });
  };

  const marcarPerda = () => {
    if (!motivoSelecionado) {
      showError({ title: 'Selecione um motivo', description: 'Informe o motivo da perda antes de continuar.' });
      return;
    }
    const motivo = motivosPerda.find(m => m.id === motivoSelecionado);
    showConfirm({
      title: 'Marcar como Perdido?',
      description: `Motivo: "${motivo?.nome}". Esta ação encerrará a oportunidade.`,
      onConfirm: async () => {
        await supabase.from('crm_oportunidades').update({ status: 'perdido', motivo_perda_id: motivoSelecionado, motivo_perda_nome: motivo?.nome, updated_at: new Date().toISOString() }).eq('id', oportunidadeId);
        await supabase.from('crm_oportunidade_historico').insert({ oportunidade_id: oportunidadeId, acao: 'perdido', descricao: `Oportunidade PERDIDA. Motivo: ${motivo?.nome}` });
        showSuccess({ title: 'Sucesso', description: 'Oportunidade encerrada como perdida.' });
        carregar();
      },
    });
  };

  const gerarOrcamento = async () => {
    try {
      const { data: orc } = await supabase.from('orcamentos').insert({ empresa_id, crm_oportunidade_id: oportunidadeId, cliente_nome: op.cliente_nome, valor_total: op.valor, status: 'Rascunho' }).select().single();
      const orcId = orc?.id;
      if (orcId) {
        await supabase.from('crm_oportunidades').update({ orcamento_id: orcId, updated_at: new Date().toISOString() }).eq('id', oportunidadeId);
        showSuccess({ title: 'Orçamento gerado', description: 'Orçamento criado com sucesso.' });
        carregar();
      }
    } catch (e) {
      showError({ title: 'Erro ao gerar orçamento', description: e.message });
    }
  };

  const salvarTarefa = async () => {
    if (!novaTarefa.titulo) { showError({ title: 'Informe o título da tarefa', description: '' }); return; }
    try {
      await supabase.from('crm_tarefas').insert({ ...novaTarefa, empresa_id, oportunidade_id: oportunidadeId, status: 'pendente', responsavel_id: erpUsuario?.id || null });
      showSuccess({ title: 'Sucesso', description: 'Tarefa criada.' });
      setNovaTarefa({ titulo: '', tipo: 'Ligação', data_execucao: '' });
      setShowTarefaForm(false);
      carregar();
    } catch (e) {
      showError({ title: 'Erro ao salvar tarefa', description: e.message });
    }
  };

  const concluirTarefa = async (tarefa) => {
    try {
      await supabase.from('crm_tarefas').update({ status: 'concluida', updated_at: new Date().toISOString() }).eq('id', tarefa.id);
      carregar();
    } catch (e) {
      showError({ title: 'Erro', description: e.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        <p className="text-slate-500">Oportunidade não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{op.titulo}</h1>
            {op.cliente_nome && <p className="text-slate-500 mt-0.5">{op.cliente_nome}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor(op.status)}`}>
              {op.status?.toUpperCase()}
            </span>
            {op.valor > 0 && (
              <span className="text-lg font-bold text-green-600">{formatVal(op.valor)}</span>
            )}
          </div>
        </div>

        {/* Ações */}
        {op.status === 'aberto' && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</p>
            <div className="flex flex-wrap gap-2 items-end">
              {!op.orcamento_id && (
                <Button variant="outline" size="sm" onClick={gerarOrcamento}>
                  <Plus className="h-4 w-4 mr-1" /> Gerar Orçamento
                </Button>
              )}
              <div className="flex items-end gap-2 flex-1 min-w-[220px]">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">Motivo de perda</label>
                  <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {motivosPerda.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="destructive" size="sm" onClick={marcarPerda}>
                  <XCircle className="h-4 w-4 mr-1" /> Perdido
                </Button>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={marcarGanho}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Ganho
              </Button>
            </div>
          </div>
        )}

        {op.status === 'perdido' && op.motivo_perda_nome && (
          <p className="mt-3 text-sm text-red-600">Motivo de perda: <strong>{op.motivo_perda_nome}</strong></p>
        )}
        {op.orcamento_id && (
          <p className="mt-3 text-sm text-blue-600">Orçamento vinculado: <strong>{op.orcamento_id}</strong></p>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas ({tarefas.length})</TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4 space-y-2">
            {historico.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Sem histórico registrado</p>}
            {historico.map(h => (
              <div key={h.id} className="flex gap-3 text-sm border-l-2 border-blue-200 pl-3 py-1">
                <div>
                  <p className="text-slate-700">{h.descricao}</p>
                  <p className="text-xs text-slate-400">{formatDate(h.created_at)}</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="tarefas" className="mt-4 space-y-2">
            <Button variant="outline" size="sm" onClick={() => setShowTarefaForm(v => !v)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
            </Button>
            {showTarefaForm && (
              <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
                <Input placeholder="Título da tarefa" value={novaTarefa.titulo} onChange={e => setNovaTarefa(p => ({ ...p, titulo: e.target.value }))} />
                <Select value={novaTarefa.tipo} onValueChange={v => setNovaTarefa(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Ligação', 'E-mail', 'Reunião', 'Visita', 'Proposta'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={novaTarefa.data_execucao} onChange={e => setNovaTarefa(p => ({ ...p, data_execucao: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={salvarTarefa}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowTarefaForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            {tarefas.map(t => (
              <div key={t.id} className={`flex items-start justify-between p-3 rounded-lg border ${t.status === 'concluida' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                <div>
                  <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.titulo}</p>
                  <p className="text-xs text-slate-400">{t.tipo} · {t.data_execucao ? new Date(t.data_execucao).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
                {t.status !== 'concluida' && (
                  <Button variant="ghost" size="sm" onClick={() => concluirTarefa(t)}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                )}
              </div>
            ))}
            {tarefas.length === 0 && !showTarefaForm && <p className="text-sm text-slate-400 text-center py-6">Nenhuma tarefa criada</p>}
          </TabsContent>

          <TabsContent value="dados" className="mt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-400 mb-0.5">Responsável</p><p className="font-medium text-slate-800">{op.responsavel_nome || '—'}</p></div>
              <div><p className="text-xs text-slate-400 mb-0.5">Criado em</p><p className="font-medium text-slate-800">{formatDate(op.created_at)}</p></div>
              {op.observacoes && (
                <div className="col-span-2"><p className="text-xs text-slate-400 mb-0.5">Observações</p><p className="text-slate-700">{op.observacoes}</p></div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}