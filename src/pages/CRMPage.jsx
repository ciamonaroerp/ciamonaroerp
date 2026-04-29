import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/lib/supabaseClient';
import { useSupabaseAuth } from '@/components/context/SupabaseAuthContext';
import { useEmpresa } from '@/components/context/EmpresaContext';
import { useGlobalAlert } from '@/components/GlobalAlertDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, BarChart2, Settings, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import CRMCardOportunidade from '@/components/crm/CRMCardOportunidade';
import CRMNovaOportunidadeModal from '@/components/crm/CRMNovaOportunidadeModal';
import CRMConfigModal from '@/components/crm/CRMConfigModal';

const LIMITE = 50;

export default function CRMPage() {
  const { empresa_id } = useEmpresa();
  const { erpUsuario } = useSupabaseAuth();
  const isAdmin = erpUsuario?.perfil === 'Administrador';
  const { showError } = useGlobalAlert();

  const [etapas, setEtapas] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [funil, setFunil] = useState(null);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [mostrarFechados, setMostrarFechados] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState('30');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');

  // Modais
  const [showNova, setShowNova] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Drag and drop
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (erpUsuario) setCurrentUser(erpUsuario);
  }, [erpUsuario]);

  const carregarEtapasEFunil = useCallback(async () => {
    if (!empresa_id || !supabase) return;
    const [{ data: funis }, { data: etapasData }] = await Promise.all([
      supabase.from('crm_funis').select('id,nome').eq('empresa_id', empresa_id).order('created_at'),
      supabase.from('crm_etapas').select('id,nome,ordem,percentual,funil_id').eq('empresa_id', empresa_id).order('ordem'),
    ]);
    const funilPrimeiro = (funis || [])[0] || null;
    setFunil(funilPrimeiro);
    const etapasAll = etapasData || [];
    const filtradas = funilPrimeiro
      ? etapasAll.filter(e => e.funil_id === funilPrimeiro.id).sort((a, b) => a.ordem - b.ordem)
      : etapasAll.sort((a, b) => a.ordem - b.ordem);
    setEtapas(filtradas);
    return filtradas;
  }, [empresa_id]);

  const montarFiltros = useCallback(() => {
    const filtros = { empresa_id };
    if (!mostrarFechados) filtros.status = 'aberto';
    if (!isAdmin) filtros.responsavel_id = erpUsuario?.id;
    else if (filtroResponsavel !== 'todos') filtros.responsavel_id = filtroResponsavel;
    return filtros;
  }, [empresa_id, mostrarFechados, isAdmin, erpUsuario, filtroResponsavel]);

  const carregarOportunidades = useCallback(async (paginaNum = 1, acumular = false) => {
    if (!empresa_id) return;
    if (paginaNum === 1) setLoading(true); else setCarregandoMais(true);

    const filtros = montarFiltros();
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(filtroPeriodo));

    try {
      let query = supabase
        .from('crm_oportunidades')
        .select('id,titulo,valor,etapa_id,status,responsavel_nome,responsavel_id,created_at,cliente_nome,artigo_nome,cor_nome,quantidade')
        .eq('empresa_id', empresa_id)
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false })
        .range((paginaNum - 1) * LIMITE, paginaNum * LIMITE - 1);

      if (!mostrarFechados) query = query.eq('status', 'aberto');
      if (!isAdmin && erpUsuario?.id) query = query.eq('responsavel_id', erpUsuario.id);
      else if (isAdmin && filtroResponsavel !== 'todos') query = query.eq('responsavel_id', filtroResponsavel);

      const { data: dados, error } = await query;
      if (error) throw new Error(error.message);

      const lista = dados || [];
      setTemMais(lista.length === LIMITE);
      if (acumular) setOportunidades(prev => [...prev, ...lista]);
      else setOportunidades(lista);

      if (isAdmin && paginaNum === 1) {
        const usuarios = [...new Map(lista.filter(o => o.responsavel_id).map(o => [o.responsavel_id, { id: o.responsavel_id, nome: o.responsavel_nome }])).values()];
        setVendedores(prev => {
          const ids = new Set(prev.map(v => v.id));
          return [...prev, ...usuarios.filter(u => !ids.has(u.id))];
        });
      }
    } catch (e) {
      showError({ title: 'Erro ao carregar dados', description: e.message });
    } finally {
      setLoading(false);
      setCarregandoMais(false);
    }
  }, [empresa_id, montarFiltros, filtroPeriodo, isAdmin]);

  const carregar = useCallback(async () => {
    setPagina(1);
    setVendedores([]);
    await carregarEtapasEFunil();
    await carregarOportunidades(1, false);
  }, [carregarEtapasEFunil, carregarOportunidades]);

  useEffect(() => { carregar(); }, [empresa_id, mostrarFechados, filtroPeriodo, filtroResponsavel]);

  const carregarMais = async () => {
    const nova = pagina + 1;
    setPagina(nova);
    await carregarOportunidades(nova, true);
  };

  // Drag and drop
  const onDragStart = (e, op) => {
    if (op.status !== 'aberto') { e.preventDefault(); return; }
    setDragging(op);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, etapaId) => { e.preventDefault(); setDragOver(etapaId); };
  const onDrop = async (e, etapa) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.status !== 'aberto' || dragging.etapa_id === etapa.id) { setDragging(null); return; }
    try {
      await supabase.from('crm_oportunidades').update({ etapa_id: etapa.id, updated_at: new Date().toISOString() }).eq('id', dragging.id);
      await supabase.from('crm_oportunidade_historico').insert({ oportunidade_id: dragging.id, acao: 'mover_etapa', descricao: `Movido para etapa "${etapa.nome}"` });
      setOportunidades(prev => prev.map(o => o.id === dragging.id ? { ...o, etapa_id: etapa.id } : o));
    } catch (err) {
      showError({ title: 'Erro ao mover oportunidade', description: err.message });
    }
    setDragging(null);
  };

  const opPorEtapa = etapa => {
    let lista = oportunidades.filter(o => o.etapa_id === etapa.id);
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(o => o.titulo?.toLowerCase().includes(b) || o.cliente_nome?.toLowerCase().includes(b));
    }
    return lista;
  };

  const totalValor = oportunidades.filter(o => o.status === 'aberto').reduce((s, o) => s + (o.valor || 0), 0);
  const formatVal = v => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header fixo */}
      <div className="flex-shrink-0 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CRM — Funil de Vendas</h1>
            <p className="text-sm text-slate-500">
              {oportunidades.filter(o => o.status === 'aberto').length} abertas · {formatVal(totalValor)} em pipeline
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button variant="outline" size="icon" onClick={() => setShowConfig(true)} title="Configurações">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={carregar} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link to="/CRMRelatoriosPage">
              <Button variant="outline"><BarChart2 className="h-4 w-4 mr-2" /> Relatórios</Button>
            </Link>
            <Button onClick={() => setShowNova(true)} style={{ background: '#3B5CCC' }} className="text-white gap-2">
              <Plus className="h-4 w-4" /> Nova Oportunidade
            </Button>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 w-44" />
          </div>

          <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && vendedores.length > 0 && (
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos vendedores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <button
            onClick={() => setMostrarFechados(p => !p)}
            className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              mostrarFechados ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {mostrarFechados ? '✓ Mostrar fechados' : 'Mostrar fechados'}
          </button>
        </div>
      </div>

      {/* Kanban com scroll lateral */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-4 h-full pb-2">
            {etapas.map(etapa => {
              const cards = opPorEtapa(etapa);
              const totalEtapa = cards.filter(o => o.status === 'aberto').reduce((s, o) => s + (o.valor || 0), 0);
              return (
                <div
                  key={etapa.id}
                  className={`flex-shrink-0 w-72 rounded-xl border flex flex-col transition-colors ${
                    dragOver === etapa.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'
                  }`}
                  onDragOver={e => onDragOver(e, etapa.id)}
                  onDrop={e => onDrop(e, etapa)}
                  onDragLeave={() => setDragOver(null)}
                >
                  {/* Cabeçalho coluna */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-700">{etapa.nome}</span>
                      <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{cards.length}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatVal(totalEtapa)}</p>
                    <div className="w-full bg-slate-200 rounded-full h-1 mt-2">
                      <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${etapa.percentual || 0}%` }} />
                    </div>
                  </div>

                  {/* Cards com scroll vertical */}
                  <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {cards.map(op => (
                      <CRMCardOportunidade
                        key={op.id}
                        oportunidade={op}
                        onDragStart={onDragStart}
                        onClick={() => window.location.href = `/CRMDetalhePage?id=${op.id}`}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-8">Nenhuma oportunidade</div>
                    )}
                  </div>
                </div>
              );
            })}

            {etapas.length === 0 && (
              <div className="flex items-center justify-center w-full text-slate-400 text-sm">
                Nenhuma etapa configurada. Use o botão de configurações.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Carregar mais */}
      {temMais && !loading && (
        <div className="flex-shrink-0 pt-3 flex justify-center">
          <Button variant="outline" onClick={carregarMais} disabled={carregandoMais}>
            {carregandoMais ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}

      {showNova && (
        <CRMNovaOportunidadeModal
          empresaId={empresa_id}
          etapas={etapas}
          funil={funil}
          currentUser={currentUser}
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); carregar(); }}
        />
      )}

      {showConfig && (
        <CRMConfigModal
          empresaId={empresa_id}
          funil={funil}
          onClose={() => { setShowConfig(false); carregar(); }}
        />
      )}
    </div>
  );
}