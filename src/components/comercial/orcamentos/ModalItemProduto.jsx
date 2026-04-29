/**
 * Modal de Item — Tipo Produto e Produto + Serviço
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/lib/supabaseClient";
import { useInvalidateOrcamentoItens } from "@/hooks/useOrcamentoItens";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, ChevronDown } from "lucide-react";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import ModalPersonalizacaoDependencias from "./ModalPersonalizacaoDependencias";
import ResumoTecnicoAccordion from "./ResumoTecnicoAccordion";
import ComposicaoCustos from "./ComposicaoCustos";
import ValoresItem from "./ValoresItem";

function fmtMoeda(v) {
  let n;
  if (typeof v === "number") {
    n = v;
  } else {
    n = parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  }
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoeda(str) {
  return parseFloat(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

// Combobox de busca genérico
function SearchCombobox({ options, value, onChange, placeholder = "Buscar...", getKey, getLabel, getSubLabel }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  const selecionado = options.find(o => getKey(o) === value);
  const filtrados = options.filter(o =>
    (getLabel(o) || "").toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (item) => {
    onChange(item);
    setAberto(false);
    setBusca("");
  };

  const handleLimpar = (e) => {
    e.stopPropagation();
    onChange(null);
    setBusca("");
  };

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center gap-2 h-9 border border-slate-200 rounded-md px-3 cursor-pointer hover:border-slate-300 bg-white focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setAberto(prev => !prev)}
      >
        {selecionado ? (
          <>
            <span className="flex-1 text-sm text-slate-800 truncate">{getLabel(selecionado)}</span>
            <button type="button" onClick={handleLimpar} className="text-slate-400 hover:text-slate-700 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-sm text-slate-400">{placeholder}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </>
        )}
      </div>

      {aberto && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Digite para filtrar..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">Nenhum resultado encontrado</p>
            ) : (
              filtrados.slice(0, 50).map(o => (
                <button
                  key={getKey(o)}
                  type="button"
                  onClick={() => handleSelect(o)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 flex items-center gap-2 ${value === getKey(o) ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-700"}`}
                >
                  <span className="flex-1 truncate">{getLabel(o)}</span>
                  {getSubLabel && getSubLabel(o) && (
                    <span className="text-xs font-mono text-slate-400 shrink-0">{getSubLabel(o)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Modal pequeno para valor variável de item adicional
function ModalValorItemAdicional({ open, onClose, item, onSalvar }) {
  const [valor, setValor] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSalvar = () => {
    if (!valor || parseMoeda(valor) <= 0) {
      alert("Insira um valor válido maior que zero");
      return;
    }
    onSalvar(parseMoeda(valor));
    setValor("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Valor — {item?.descricao || item?.tipo_dependencia || "Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Informe o valor unitário para este item adicional.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs text-slate-400 pointer-events-none">R$</span>
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={valor}
              onChange={e => setValor(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSalvar()}
              placeholder="0,00"
              className="h-9 text-sm pl-8 text-right font-mono"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="text-xs h-8">
            Cancelar
          </Button>
          <Button onClick={handleSalvar} className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ModalItemProduto({ open, onClose, onSalvar, empresaId, proximaSequencia, tipo = "Produto", itemEdicao = null, orcamentoId }) {
  const isProdutoServico = tipo === "Produto e Serviço";
  const { showError } = useGlobalAlert();
  const invalidateOrcamentoItens = useInvalidateOrcamentoItens();

  const [form, setForm] = useState({
    sequencia: proximaSequencia || 1,
    quantidade: "",
    produto_id: "",
    nome_produto: "",
    codigo_unico: "",
    nome_linha_comercial: "",
    artigo_nome: "",
    nome_cor: "",
    acabamentos: [],
    personalizacoes: [],
    itens_adicionais: [],
    operacoes: [],
    produto_percentual: isProdutoServico ? "50.00" : "",
    servico_percentual: isProdutoServico ? "50.00" : "",
    valor_unitario: "",
    subtotal: "0,00",
    observacoes: "",
  });

  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState("config");
  const [itemSalvo, setItemSalvo] = useState(!!itemEdicao?.id);
  const [itemDirty, setItemDirty] = useState(false);
  const [itemAtualizado, setItemAtualizado] = useState(itemEdicao || null);
  const acabouDeSalvarRef = useRef(false);
  const itemEdicaoIdRestoradoRef = useRef(null); // Rastreia qual itemEdicao foi restaurado

  // Estado de produto/tecido dependente
  const [produtoId, setProdutoId] = useState("");
  const [estruturaProduto, setEstruturaProduto] = useState({ tipo_produto: 'simples', tecidos: {} });
  const [loadingTecidos, setLoadingTecidos] = useState(false);
  const [tecidosSelecionados, setTecidosSelecionados] = useState({});

  // Ref para evitar chamadas duplicadas de carregarEstrutura
  const carregandoEstruturaProdutoRef = useRef(null);

  // Loading geral ao editar — aguarda estrutura + dados externos
  const [loadingEdicao, setLoadingEdicao] = useState(false);

  // Estado para modal de valor variável
  const [modalValorAberto, setModalValorAberto] = useState(false);
  const [itemAdicionalEmEdicao, setItemAdicionalEmEdicao] = useState(null);
  const [itensAdicionaisComValor, setItensAdicionaisComValor] = useState({});
  
  // IDs dos itens adicionais selecionados (normalizado para string)
  const [itensSelecionadosIds, setItensSelecionadosIds] = useState([]);

  // Personalizações: mapa id → {cores, posicoes, valor_variavel}
  const [personalizacoesSelecionadas, setPersonalizacoesSelecionadas] = useState({}); // {[id]: {cores, posicoes, valor_variavel}}
  const [modalPersAberto, setModalPersAberto] = useState(false);
  const [persEmEdicao, setPersEmEdicao] = useState(null); // config completa da personalização

  // Produtos via tabela_precos_sync (únicos por produto_id)
  const { data: produtos = [] } = useQuery({
    queryKey: ["orcamento-produtos-v2", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("tabela_precos_sync").select("produto_id,nome_produto,codigo_produto").eq("empresa_id", empresaId).is("deleted_at", null);
      const uniq = {}; (data || []).forEach(r => { if (!uniq[r.produto_id]) uniq[r.produto_id] = r; });
      return Object.values(uniq);
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: acabamentos = [] } = useQuery({
    queryKey: ["orcamento-acabamentos", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("config_acabamentos").select("*").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: personalizacoes = [] } = useQuery({
    queryKey: ["orcamento-personalizacoes-v2", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("config_personalizacoes").select("*").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: itensAdicionais = [] } = useQuery({
    queryKey: ["orcamento-itens-adicionais", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("config_dependencias").select("*").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: dependencias = [] } = useQuery({
    queryKey: ["orcamento-dependencias", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("config_dependencias").select("*").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });



  const carregarEstrutura = async (pid) => {
    if (!pid) { setEstruturaProduto({ tipo_produto: 'simples', tecidos: {} }); return; }
    
    // Evita chamadas duplicadas simultâneas
    if (carregandoEstruturaProdutoRef.current === pid) return;
    carregandoEstruturaProdutoRef.current = pid;
    
    setLoadingTecidos(true);
    try {
      // Busca estrutura do produto via tabela_precos_sync
      const { data: tps } = await supabase.from("tabela_precos_sync").select("*").eq("empresa_id", empresaId).eq("produto_id", pid).is("deleted_at", null);
      if (!tps || tps.length === 0) { setEstruturaProduto({ tipo_produto: 'simples', tecidos: {} }); return; }
      // Agrupa por variavel_index para montar estrutura de tecidos
      const grupos = {};
      tps.forEach(r => {
        const idx = r.variavel_index || 1;
        if (!grupos[idx]) grupos[idx] = { resumo: r.artigo_nome || '', opcoes: [] };
        grupos[idx].opcoes.push({ id: r.id, codigo_unico: r.codigo_unico, linha_nome: r.linha_nome || '', artigo_nome: r.artigo_nome || '', cor_nome: r.cor_nome || '' });
      });
      const tipo = Object.keys(grupos).length > 1 ? 'composto' : 'simples';
      setEstruturaProduto({ tipo_produto: tipo, tecidos: grupos });
    } catch (err) {
      console.error('[carregarEstrutura] Erro:', err.message);
      setEstruturaProduto({ tipo_produto: 'simples', tecidos: {} });
    } finally {
      setLoadingTecidos(false);
      carregandoEstruturaProdutoRef.current = null;
    }
  };

  // Reset ao abrir/fechar modal
  useEffect(() => {
    if (open) {
      setActiveTab("config");
      setItemSalvo(!!itemEdicao?.id);
      setItemDirty(false);
      setItemAtualizado(null);
      // Sempre reseta o ref ao abrir para forçar restauração dos dados do itemEdicao
      itemEdicaoIdRestoradoRef.current = null;
    }
  }, [open]);

  // Efeito principal de restauração — aguarda itemEdicao + todos os dados externos carregarem
  useEffect(() => {

    if (!itemEdicao) {
      // Novo item: limpa tudo
      setPersonalizacoesSelecionadas({});
      setItensSelecionadosIds([]);
      setItensAdicionaisComValor({});
      setLoadingEdicao(false);
      itemEdicaoIdRestoradoRef.current = null;
      return;
    }

    // Se o itemEdicao.id já foi restaurado antes, não restaura novamente
    if (itemEdicaoIdRestoradoRef.current === itemEdicao.id) {
      setLoadingEdicao(false);
      return;
    }

    // Aguarda produtos + acabamentos + itensAdicionais carregarem antes de restaurar
    // (useQuery pode ainda estar buscando os dados ao abrir o modal)
    const querysPendentes = empresaId && produtos.length === 0;
    // Só aguarda acabamentos/itensAdicionais se o itemEdicao tem esses dados salvos
    const temAcabSalvos = Array.isArray(itemEdicao.acabamentos) && itemEdicao.acabamentos.length > 0;
    const temAdicSalvos = Array.isArray(itemEdicao.itens_adicionais) && itemEdicao.itens_adicionais.length > 0;
    if (querysPendentes) { setLoadingEdicao(true); return; }
    if (temAcabSalvos && acabamentos.length === 0) { setLoadingEdicao(true); return; }
    if (temAdicSalvos && itensAdicionais.length === 0) { setLoadingEdicao(true); return; }



    // --- Acabamentos ---
    const acabSalvos = Array.isArray(itemEdicao.acabamentos) ? itemEdicao.acabamentos : [];
    let idsAcab = [];
    let nomesAcab = [];
    if (acabSalvos.length > 0 && typeof acabSalvos[0] === 'object' && acabSalvos[0]?.id) {
      // Formato JSONB: [{id, descricao}] — cruza com a lista de configs para garantir nomes corretos
      acabSalvos.forEach(aSalvo => {
        const cfg = acabamentos.find(a => String(a.id) === String(aSalvo.id));
        const nome = cfg?.nome_acabamento || aSalvo.descricao || aSalvo.nome_acabamento;
        if (nome) { idsAcab.push(aSalvo.id); nomesAcab.push(nome); }
      });
    } else if (acabSalvos.length > 0 && typeof acabSalvos[0] === 'string' && acabamentos.length > 0) {
      // Formato legado: array de nomes
      idsAcab = acabamentos.filter(a => acabSalvos.includes(a.nome_acabamento)).map(a => a.id);
      nomesAcab = idsAcab.map(id => acabamentos.find(a => a.id === id)?.nome_acabamento).filter(Boolean);
    }

    // --- Personalizações ---
    const persJsonb = Array.isArray(itemEdicao.personalizacoes) ? itemEdicao.personalizacoes : [];
    const novoMapaPers = {};
    const nomesRestaurados = [];
    const idsRestaurados = [];
    if (persJsonb.length > 0 && typeof persJsonb[0] === 'object' && personalizacoes.length > 0) {
      persJsonb.forEach(pSalvo => {
        const cfg = personalizacoes.find(p => String(p.id) === String(pSalvo.id));
        if (!cfg) return;
        const dep = cfg.dependencias_pers || {};
        novoMapaPers[cfg.id] = {
          cores: dep.usa_cores ? pSalvo.cores : null,
          posicoes: dep.usa_posicoes ? pSalvo.posicoes : null,
          valor_variavel: dep.usa_valor_variavel ? pSalvo.valor : null,
        };
        nomesRestaurados.push(cfg.tipo_personalizacao);
        idsRestaurados.push(cfg.id);
      });
    }
    setPersonalizacoesSelecionadas(novoMapaPers);

    // --- Itens adicionais ---
    const adicionaisSalvos = Array.isArray(itemEdicao.itens_adicionais) ? itemEdicao.itens_adicionais : [];
    const idsAdic = [];
    const valoresMapeados = {};
    if (adicionaisSalvos.length > 0 && itensAdicionais.length > 0) {
      const primeiro = adicionaisSalvos[0];
      if (typeof primeiro === 'object' && primeiro?.id !== undefined) {
        adicionaisSalvos.forEach(itemSalvo => {
          const config = itensAdicionais.find(i => String(i.id) === String(itemSalvo.id));
          if (config) {
            idsAdic.push(String(config.id));
            valoresMapeados[config.id] = { valor: itemSalvo.valor, tipo: itemSalvo.tipo || "fixo" };
          }
        });
      } else if (typeof primeiro === 'string') {
        adicionaisSalvos.forEach(nome => {
          const config = itensAdicionais.find(i => i.tipo_dependencia === nome);
          if (config) idsAdic.push(String(config.id));
        });
      }
    }
    setItensSelecionadosIds(idsAdic);
    setItensAdicionaisComValor(valoresMapeados);

    // --- Tecidos ---
    let tecidosRestaurados = {};
    if (itemEdicao.produto_id) {
      setProdutoId(itemEdicao.produto_id);
      setLoadingEdicao(true);
      carregarEstrutura(itemEdicao.produto_id).finally(() => setLoadingEdicao(false));

      const grupo = itemEdicao._grupo;
      if (grupo && grupo.length > 1) {
        grupo.forEach(reg => {
          if (reg.indice && reg.codigo_unico) tecidosRestaurados[reg.indice] = reg.codigo_unico;
        });
      }
      if (Object.keys(tecidosRestaurados).length === 0) {
        try {
          const saved = JSON.parse(itemEdicao.codigo_unico || 'null');
          if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            tecidosRestaurados = saved;
          } else if (itemEdicao.codigo_unico) {
            tecidosRestaurados = { 1: itemEdicao.codigo_unico };
          }
        } catch {
          if (itemEdicao.codigo_unico) tecidosRestaurados = { 1: itemEdicao.codigo_unico };
        }
      }
      setTecidosSelecionados(tecidosRestaurados);
    }

    // --- Form ---
    setForm({
      ...itemEdicao,
      quantidade: itemEdicao.quantidade != null ? String(itemEdicao.quantidade) : "",
      valor_unitario: fmtMoeda(itemEdicao.valor_unitario || 0),
      subtotal: fmtMoeda(itemEdicao.subtotal || 0),
      produto_percentual: itemEdicao.produto_percentual || (isProdutoServico ? "50.00" : ""),
      servico_percentual: itemEdicao.servico_percentual || (isProdutoServico ? "50.00" : ""),
      acabamentos: nomesAcab,
      acabamentos_ids: idsAcab,
      personalizacoes: nomesRestaurados,
      personalizacoes_ids: idsRestaurados,
    });

    // Termina o loading após restaurar todos os dados
    setLoadingEdicao(false);
    itemEdicaoIdRestoradoRef.current = itemEdicao.id;
  }, [itemEdicao, produtos, acabamentos, personalizacoes, itensAdicionais, isProdutoServico]);

  const setField = (key, val) => { setForm(prev => ({ ...prev, [key]: val })); setItemDirty(true); };

  const calcSubtotal = useCallback((qtd, vu) => {
    const q = parseInt(qtd) || 0;
    const v = parseMoeda(vu);
    return fmtMoeda(q * v);
  }, []);

  const handleQtd = (val) => {
    const qtd = val.replace(/\D/g, "").slice(0, 6);
    const sub = calcSubtotal(qtd, form.valor_unitario);
    setForm(prev => ({ ...prev, quantidade: qtd, subtotal: sub }));
    setItemDirty(true);
  };

  const handleValorUnitario = (raw) => {
    const digits = raw.replace(/\D/g, "");
    const cents = parseInt(digits || "0", 10);
    const formatted = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sub = calcSubtotal(form.quantidade, formatted);
    setForm(prev => ({ ...prev, valor_unitario: formatted, subtotal: sub }));
    setItemDirty(true);
  };

  const handleProdutoPercentual = (val) => {
    const p = parseFloat(val) || 0;
    const s = Math.max(0, 100 - p);
    setForm(prev => ({ ...prev, produto_percentual: val, servico_percentual: s.toFixed(2) }));
    setItemDirty(true);
  };

  const handleServicoPercentual = (val) => {
    const s = parseFloat(val) || 0;
    const p = Math.max(0, 100 - s);
    setForm(prev => ({ ...prev, servico_percentual: val, produto_percentual: p.toFixed(2) }));
    setItemDirty(true);
  };

  const toggleAcabamento = (id, nome) => {
    setForm(prev => {
      const nomes = prev.acabamentos || [];
      const ids = prev.acabamentos_ids || [];
      const jaTemNome = nomes.includes(nome);
      return {
        ...prev,
        acabamentos: jaTemNome ? nomes.filter(a => a !== nome) : [...nomes, nome],
        acabamentos_ids: jaTemNome ? ids.filter(a => a !== id) : [...ids, id],
      };
    });
    setItemDirty(true);
  };

  const togglePersonalizacao = (cfgItem) => {
    const id = cfgItem.id;
    const nome = cfgItem.tipo_personalizacao;
    const dep = cfgItem.dependencias_pers || {};
    const jatem = (form.personalizacoes_ids || []).map(String).includes(String(id));

    if (jatem) {
      // Desselecionar
      setForm(prev => ({
        ...prev,
        personalizacoes: (prev.personalizacoes || []).filter(n => n !== nome),
        personalizacoes_ids: (prev.personalizacoes_ids || []).filter(i => String(i) !== String(id)),
      }));
      setPersonalizacoesSelecionadas(prev => {
        const novo = { ...prev };
        delete novo[id];
        return novo;
      });
    } else {
      const temDep = dep.usa_cores || dep.usa_posicoes || dep.usa_valor_variavel;
      if (temDep) {
        // Abre modal para capturar inputs
        setPersEmEdicao(cfgItem);
        setModalPersAberto(true);
      } else {
        // Sem dependências interativas (apenas usa_valor_unitario fixo): seleciona direto
        setForm(prev => ({
          ...prev,
          personalizacoes: [...(prev.personalizacoes || []), nome],
          personalizacoes_ids: [...(prev.personalizacoes_ids || []), id],
        }));
        setPersonalizacoesSelecionadas(prev => ({ ...prev, [id]: {} }));
      }
    }
    setItemDirty(true);
  };

  const handleConfirmarPersonalizacao = (inputs) => {
    const cfg = persEmEdicao;
    if (!cfg) return;
    setForm(prev => ({
      ...prev,
      personalizacoes: [...(prev.personalizacoes || []), cfg.tipo_personalizacao],
      personalizacoes_ids: [...(prev.personalizacoes_ids || []), cfg.id],
    }));
    setPersonalizacoesSelecionadas(prev => ({ ...prev, [cfg.id]: inputs }));
    setModalPersAberto(false);
    setPersEmEdicao(null);
  };

  const toggleItemAdicional = (id, nome, item) => {
    const idString = String(id);
    const jatem = itensSelecionadosIds.includes(idString);
    setItemDirty(true);
    if (jatem) {
      // Desselecionar
      setItensSelecionadosIds(prev => prev.filter(x => x !== idString));
      setForm(prev => {
        const nomes = prev.itens_adicionais || [];
        const ids = prev.itens_adicionais_ids || [];
        return {
          ...prev,
          itens_adicionais: nomes.filter(n => n !== nome),
          itens_adicionais_ids: ids.filter(i => String(i) !== idString),
        };
      });
      setItensAdicionaisComValor(prev => {
        const novo = { ...prev };
        delete novo[id];
        return novo;
      });
    } else {
      // Selecionar
      if (item?.tipo_valor === false) {
        // Valor variável: abrir modal
        setItemAdicionalEmEdicao({ id, nome, ...item });
        setModalValorAberto(true);
      } else {
        // Valor fixo: selecionar direto
        setItensSelecionadosIds(prev => [...prev, idString]);
        setForm(prev => {
          const nomes = prev.itens_adicionais || [];
          const ids = prev.itens_adicionais_ids || [];
          return {
            ...prev,
            itens_adicionais: [...nomes, nome],
            itens_adicionais_ids: [...ids, id],
          };
        });
        if (item?.valor_un_adic !== null && item?.valor_un_adic !== undefined) {
          setItensAdicionaisComValor(prev => ({
            ...prev,
            [id]: { valor: item.valor_un_adic, tipo: "fixo" }
          }));
        }
      }
    }
  };

  const handleConfirmarValorAdicional = (valorDigitado) => {
    if (!itemAdicionalEmEdicao) return;
    
    const idString = String(itemAdicionalEmEdicao.id);
    
    setItensSelecionadosIds(prev => {
      if (!prev.includes(idString)) {
        return [...prev, idString];
      }
      return prev;
    });
    
    setForm(prev => {
      const nomes = prev.itens_adicionais || [];
      const ids = prev.itens_adicionais_ids || [];
      return {
        ...prev,
        itens_adicionais: [...nomes, itemAdicionalEmEdicao.nome],
        itens_adicionais_ids: [...ids, itemAdicionalEmEdicao.id],
      };
    });
    
    setItensAdicionaisComValor(prev => ({
      ...prev,
      [itemAdicionalEmEdicao.id]: { valor: valorDigitado, tipo: "variavel" }
    }));
    
    setModalValorAberto(false);
    setItemAdicionalEmEdicao(null);
  };

  const handleOperacaoQtd = (t, qtd) => {
    setForm(prev => {
      const ops = [...(prev.operacoes || [])];
      const idx = ops.findIndex(o => o.tipo === t);
      if (idx >= 0) {
        if (!qtd || parseInt(qtd) === 0) ops.splice(idx, 1);
        else ops[idx] = { tipo: t, quantidade: parseInt(qtd) };
      } else if (qtd && parseInt(qtd) > 0) {
        ops.push({ tipo: t, quantidade: parseInt(qtd) });
      }
      return { ...prev, operacoes: ops };
    });
  };

  const getOperacaoQtd = (t) => {
    const op = (form.operacoes || []).find(o => o.tipo === t);
    return op ? String(op.quantidade) : "";
  };

  const handleProdutoChange = (p) => {
    if (p) {
      const pid = p.produto_id;
      setProdutoId(pid);
      setTecidosSelecionados({});
      setForm(prev => ({ ...prev, produto_id: pid, nome_produto: p.nome_produto, codigo_unico: "", linha_nome: "", cor_nome: "" }));
      carregarEstrutura(pid);
    } else {
      setProdutoId("");
      setTecidosSelecionados({});
      setEstruturaProduto({ tipo_produto: 'simples', tecidos: {} });
      setForm(prev => ({ ...prev, produto_id: "", nome_produto: "", codigo_unico: "", nome_linha_comercial: "", artigo_nome: "", nome_cor: "" }));
    }
  };

  const handleTecidoChange = (indice, tecidoId) => {
    setTecidosSelecionados(prev => {
      const novo = { ...prev, [indice]: tecidoId };
      const codigoUnico = Object.keys(novo).length === 1 ? novo[Object.keys(novo)[0]] : JSON.stringify(novo);
      const grupo = estruturaProduto.tecidos[indice];
      const opcaoSelecionada = grupo?.opcoes?.find(o => o.id === tecidoId);
      const linha_nome = opcaoSelecionada?.linha_nome || '';
      const cor_nome = opcaoSelecionada?.cor_nome || '';
      const artigo_nome = opcaoSelecionada?.artigo_nome || '';
      setForm(f => ({ ...f, codigo_unico: codigoUnico, nome_linha_comercial: linha_nome, artigo_nome, nome_cor: cor_nome }));
      return novo;
    });
  };

  const validar = () => {
    const e = {};
    if (!form.quantidade || parseInt(form.quantidade) < 1) e.quantidade = "Obrigatório";
    if (!form.produto_id) e.produto_id = "Selecione um produto";
    // valor_unitario é opcional — pode ser preenchido na aba Valores
    if (isProdutoServico) {
      const pp = parseFloat(form.produto_percentual) || 0;
      const sp = parseFloat(form.servico_percentual) || 0;
      if (Math.abs(pp + sp - 100) > 0.01) e.percentuais = "Soma deve ser 100%";
      if (pp <= 0) e.percentuais = "% Produto não pode ser zero";
      if (sp <= 0) e.percentuais = "% Serviço não pode ser zero";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  // soma_cores e soma_posicoes: usa valores já salvos no item (quando existem) OU deriva das personalizações selecionadas no modal
  // ❌ Nenhum cálculo no frontend — apenas lê o valor consolidado do backend
  const custAcabamento = parseFloat(itemAtualizado?.custo_acabamento) || parseFloat(itemEdicao?.custo_acabamento) || 0;

  // ❌ Nenhum cálculo no frontend — apenas lê o valor consolidado do backend
  const valorPers1Operacional = parseFloat(itemAtualizado?.valor_personalizacao) || parseFloat(itemEdicao?.valor_personalizacao) || 0;

  // ❌ Nenhum cálculo no frontend — apenas lê o valor consolidado do backend
  const valorPers2Digital = parseFloat(itemAtualizado?.custo_personalizacao) || parseFloat(itemEdicao?.custo_personalizacao) || 0;

  const calcularCustoPersonalizacao = () => {
    // Soma valores das personalizações selecionadas (derivado do formulário local)
    return Object.entries(personalizacoesSelecionadas).reduce((acc, [_, inputs]) => {
      const cfg = personalizacoes.find(p => String(p.id) === String(_));
      if (!cfg) return acc;
      const dep = cfg.dependencias_pers || {};
      const valorUn = parseFloat(cfg.valor_pers_un) || 0;
      const cores = dep.usa_cores ? (parseInt(inputs?.cores) || 0) : 0;
      const posicoes = dep.usa_posicoes ? (parseInt(inputs?.posicoes) || 0) : 0;
      const valorVariavel = dep.usa_valor_variavel ? (parseFloat(inputs?.valor_variavel) || 0) : 0;
      let valorFinal = valorVariavel;
      if (dep.usa_valor_unitario) {
        if (cores > 0 && posicoes > 0) valorFinal += cores * posicoes * valorUn;
        else if (cores > 0) valorFinal += cores * valorUn;
        else if (posicoes > 0) valorFinal += posicoes * valorUn;
        else valorFinal += valorUn;
      }
      return acc + valorFinal;
    }, 0);
  };

  // ❌ Nenhum cálculo no frontend — apenas lê o valor consolidado do backend
  const somaItensAdicionais = parseFloat(itemAtualizado?.soma_itens_adicionais) || parseFloat(itemEdicao?.soma_itens_adicionais) || 0;

  const somaCoresCalc = useMemo(() => {
    // Soma cores das personalizações selecionadas no modal
    const doPersModal = Object.values(personalizacoesSelecionadas).reduce((acc, v) => acc + (Number(v?.cores) || 0), 0);
    if (doPersModal > 0) return doPersModal;
    // Fallback: valor salvo no itemEdicao (orcamento_itens.soma_cores)
    return Number(itemEdicao?.soma_cores) || null;
  }, [personalizacoesSelecionadas, itemEdicao]);

  const somaPosicoesCalc = useMemo(() => {
    const doPersModal = Object.values(personalizacoesSelecionadas).reduce((acc, v) => acc + (Number(v?.posicoes) || 0), 0);
    if (doPersModal > 0) return doPersModal;
    // Fallback: valor salvo no itemEdicao (orcamento_itens.soma_posicoes)
    return Number(itemEdicao?.soma_posicoes) || null;
  }, [personalizacoesSelecionadas, itemEdicao]);

  const handleSalvarEAtualizar = async () => {
    if (!validar()) return;
    setSalvando(true);
    const valorUnitario = parseMoeda(form.valor_unitario);
    const quantidade = parseInt(form.quantidade);

    const codigoUnicoFinal = estruturaProduto.tipo_produto === 'composto'
      ? JSON.stringify(tecidosSelecionados)
      : form.codigo_unico || null;

    let resumoLinhaArtigoCor = null;
    if (estruturaProduto.tipo_produto === 'composto') {
      const resumos = Object.keys(tecidosSelecionados)
        .sort((a, b) => Number(a) - Number(b))
        .map(indice => {
          const grupo = estruturaProduto.tecidos[indice];
          const opcao = grupo?.opcoes?.find(o => o.id === tecidosSelecionados[indice]);
          if (!opcao) return null;
          return `composicao ${indice}: ${opcao.linha_nome} | ${opcao.artigo_nome} | ${opcao.cor_nome}`;
        })
        .filter(Boolean);
      resumoLinhaArtigoCor = resumos.length > 0 ? resumos.join('\n  ') : null;
    }

    const itensAdicionaisJsonb = itensSelecionadosIds.map(idStr => {
      const itemConfig = itensAdicionais.find(i => String(i.id) === idStr);
      if (!itemConfig) return null;
      const itemComValor = itensAdicionaisComValor[itemConfig.id];
      return {
        id: itemConfig.id,
        descricao: itemConfig.tipo_dependencia,
        valor: itemComValor?.valor ?? itemConfig.valor_un_adic ?? 0,
        tipo: itemComValor?.tipo || (itemConfig.tipo_valor ? "fixo" : "variavel"),
      };
    }).filter(Boolean);

    const payload = {
      sequencia: parseInt(form.sequencia),
      tipo_item: tipo,
      quantidade,
      produto_id: form.produto_id,
      nome_produto: form.nome_produto,
      codigo_unico: codigoUnicoFinal,
      linha_nome: form.nome_linha_comercial || form.linha_nome || null,
      artigo_nome: form.artigo_nome || null,
      cor_nome: form.nome_cor || form.cor_nome || null,
      resumo_linha_artigo_cor: resumoLinhaArtigoCor,
      acabamentos: (form.acabamentos_ids || []).map(id => {
        const cfg = acabamentos.find(a => String(a.id) === String(id));
        return cfg ? { id: cfg.id, descricao: cfg.nome_acabamento } : { id };
      }),
      acabamentos_ids: form.acabamentos_ids || [],
      personalizacoes_payload: (form.personalizacoes_ids || []).map(id => ({
        id,
        ...(personalizacoesSelecionadas[id] || {}),
      })),
      personalizacoes_ids: form.personalizacoes_ids || [],
      itens_adicionais: itensAdicionaisJsonb,
      itens_adicionais_ids: form.itens_adicionais_ids || [],
      operacoes: form.operacoes,
      produto_percentual: isProdutoServico ? parseFloat(form.produto_percentual) : 100,
      servico_percentual: isProdutoServico ? parseFloat(form.servico_percentual) : 0,
      valor_unitario: valorUnitario,
      subtotal: valorUnitario * quantidade,
      observacoes: form.observacoes || null,
      orcamento_id: form.orcamento_id || null,
      grupo_ids: itemEdicao?._grupo ? itemEdicao._grupo.map(r => ({ id: r.id, indice: r.indice })) : null,
    };

    // 1️⃣ SALVA
    acabouDeSalvarRef.current = true;
    try {
      const resultado = await onSalvar(payload, itemEdicao?.id);
      
      // onSalvar retorna {id, item?} agora
      const idParaSalvar = resultado?.id || resultado || itemEdicao?.id;
      const itemDoSalvar = resultado?.item;

      if (!idParaSalvar) {
        showError({ title: "Erro", description: "Não foi possível obter o ID do item salvo" });
        setSalvando(false);
        return;
      }

      // 2️⃣ USA ITEM RETORNADO DO SALVAR (já com valores calculados)
      setItemAtualizado(itemDoSalvar || { id: idParaSalvar });

      setItemSalvo(true);
      setItemDirty(false);
      setActiveTab("valores");

      // 3️⃣ INVALIDA ITENS (React Query refetch automático)
      if (orcamentoId) {
        invalidateOrcamentoItens(orcamentoId);
      }
    } catch (err) {
      // Erros do garantirOrcamentoId (validação) já mostram toast em AbaConfiguracaoOrcamento
      // Para outros erros inesperados, mostra mensagem genérica
      const msg = err?.message || "Erro ao salvar item";
      if (!msg.includes("Preencha") && !msg.includes("obrigatórios")) {
        showError({ title: "Erro ao salvar", description: msg });
      }
    } finally {
      setSalvando(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[85vh] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="text-base font-bold text-slate-900">
            {itemEdicao ? "Editar Item —" : "Novo Item —"} {tipo}
          </DialogTitle>
          <div className="sr-only">Formulário para {itemEdicao ? "editar" : "criar"} item de orçamento</div>
        </div>

        {/* Loading overlay ao editar — aguarda estrutura + dados externos */}
        {loadingEdicao && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500">Carregando dados do item...</p>
          </div>
        )}

        <div style={{ display: loadingEdicao ? 'none' : undefined }} className="flex flex-col h-full overflow-hidden">
          <div className="bg-slate-100 px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-stretch p-0 h-auto bg-transparent rounded-none border-none gap-0">
                <TabsTrigger value="config" className="flex-1 text-xs uppercase tracking-wide rounded-t-lg bg-slate-100 data-[state=active]:bg-white px-3 py-2 text-center border-none">Configurar Item</TabsTrigger>
                <TabsTrigger value="resumo" className="flex-1 text-xs uppercase tracking-wide rounded-t-lg bg-slate-100 data-[state=active]:bg-white px-3 py-2 disabled:opacity-50 text-center border-none" disabled={!itemSalvo || itemDirty}>
                  Resumo Técnico{(!itemSalvo || itemDirty) && " 🔒"}
                </TabsTrigger>
                <TabsTrigger value="valores" className="flex-1 text-xs uppercase tracking-wide rounded-t-lg bg-slate-100 data-[state=active]:bg-white px-3 py-2 disabled:opacity-50 text-center border-none" disabled={!itemSalvo || itemDirty}>
                  Valores{(!itemSalvo || itemDirty) && " 🔒"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>

            {/* ── ABA 1: CONFIGURAR ITEM ── */}
            <TabsContent value="config" className="space-y-4 mt-0 py-4">
              {/* LINHA 1: Quantidade + Produto */}
              <div className="flex items-start gap-3">
                <div className="space-y-1 w-[100px] shrink-0">
                  <Label className="text-xs font-medium text-slate-600">Qtd *</Label>
                  <Input
                    value={form.quantidade}
                    onChange={e => handleQtd(e.target.value)}
                    className={`h-9 text-sm text-center font-mono ${erros.quantidade ? "border-red-400" : ""}`}
                    placeholder=""
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                  />
                  {erros.quantidade && <p className="text-xs text-red-500">{erros.quantidade}</p>}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <Label className="text-xs font-medium text-slate-600">Produto *</Label>
                  <SearchCombobox
                    options={produtos}
                    value={form.produto_id}
                    placeholder="Buscar produto..."
                    getKey={p => p.produto_id}
                    getLabel={p => `${p.codigo_produto ? p.codigo_produto + ' - ' : ''}${p.nome_produto}`}
                    onChange={handleProdutoChange}
                  />
                  {erros.produto_id && <p className="text-xs text-red-500">{erros.produto_id}</p>}
                </div>
              </div>

              {/* TECIDO(S) */}
              {loadingTecidos ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando tecidos...
                </div>
              ) : !produtoId ? (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Tecido</Label>
                  <div className="h-9 border border-slate-200 rounded-md px-3 flex items-center text-sm text-slate-400 bg-slate-50">
                    Selecione um produto primeiro
                  </div>
                </div>
              ) : estruturaProduto.tipo_produto === 'composto' ? (
                Object.keys(estruturaProduto.tecidos).sort((a, b) => Number(a) - Number(b)).map(indice => {
                  const grupo = estruturaProduto.tecidos[indice];
                  return (
                    <div key={indice} className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">
                        Tecido {indice}{grupo.resumo ? ` - ${grupo.resumo}` : ''}
                      </Label>
                      <SearchCombobox
                        options={grupo.opcoes}
                        value={tecidosSelecionados[indice] || ""}
                        placeholder="Buscar tecido..."
                        getKey={t => t.id}
                        getLabel={t => [t.codigo_unico, t.linha_nome, t.artigo_nome, t.cor_nome].filter(Boolean).join(' | ')}
                        onChange={t => handleTecidoChange(indice, t ? t.id : "")}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">
                    Tecido{estruturaProduto.tecidos[1]?.resumo ? ` - ${estruturaProduto.tecidos[1].resumo}` : ''}
                  </Label>
                  <SearchCombobox
                    options={estruturaProduto.tecidos[1]?.opcoes || []}
                    value={tecidosSelecionados[1] || ""}
                    placeholder="Buscar tecido..."
                    getKey={t => t.id}
                    getLabel={t => [t.codigo_unico, t.linha_nome, t.artigo_nome, t.cor_nome].filter(Boolean).join(' | ')}
                    onChange={t => handleTecidoChange(1, t ? t.id : "")}
                  />
                </div>
              )}

              {/* RESUMO DE COMPOSIÇÃO */}
              {(estruturaProduto.tipo_produto === 'composto' || form.resumo_linha_artigo_cor) && (Object.keys(tecidosSelecionados).length > 0 || form.resumo_linha_artigo_cor) && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Resumo de Composição</Label>
                  <div className="whitespace-pre-wrap text-xs text-slate-700 font-mono leading-relaxed">
                    {form.resumo_linha_artigo_cor || (Object.keys(tecidosSelecionados)
                      .sort((a, b) => Number(a) - Number(b))
                      .map(indice => {
                        const grupo = estruturaProduto.tecidos[indice];
                        const opcao = grupo?.opcoes?.find(o => o.id === tecidosSelecionados[indice]);
                        if (!opcao) return null;
                        return `composicao ${indice}: ${opcao.linha_nome} | ${opcao.artigo_nome} | ${opcao.cor_nome}`;
                      })
                      .filter(Boolean)
                      .join('\n  '))}
                  </div>
                </div>
              )}

              {/* Acabamentos */}
              {acabamentos.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Acabamentos</Label>
                  <div className="flex flex-wrap gap-2">
                    {acabamentos.map(a => {
                      const sel = (form.acabamentos || []).includes(a.nome_acabamento);
                      return (
                        <button key={a.id} type="button"
                          onClick={() => toggleAcabamento(a.id, a.nome_acabamento)}
                          className={`px-3 py-1 rounded-md text-sm font-medium border transition-all ${
                            sel
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {a.nome_acabamento}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Personalizações */}
              {personalizacoes.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo de Personalização</Label>
                  <div className="flex flex-wrap gap-2">
                    {personalizacoes.map(p => {
                      const sel = (form.personalizacoes_ids || []).map(String).includes(String(p.id));
                      const inputs = personalizacoesSelecionadas[p.id];
                      const dep = p.dependencias_pers || {};
                      const infoExtra = sel && inputs
                        ? [
                            dep.usa_cores && inputs.cores != null ? `${inputs.cores}cor` : null,
                            dep.usa_posicoes && inputs.posicoes != null ? `${inputs.posicoes}pos` : null,
                            dep.usa_valor_variavel && inputs.valor_variavel != null
                              ? `R$${Number(inputs.valor_variavel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
                          ].filter(Boolean).join(' · ')
                        : null;
                      return (
                        <button key={p.id} type="button"
                          onClick={() => togglePersonalizacao(p)}
                          className={`px-3 py-1 rounded-md text-sm font-medium border transition-all flex items-center gap-1 ${
                            sel
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {p.tipo_personalizacao}
                          {infoExtra && <span className="opacity-70 font-normal text-xs">({infoExtra})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Itens Adicionais */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Itens Adicionais</Label>
                <div className="flex flex-wrap gap-2">
                  {itensAdicionais.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum item adicional cadastrado</p>
                  ) : (
                    itensAdicionais.map(item => {
                      const idString = String(item.id);
                      const sel = itensSelecionadosIds.includes(idString);
                      return (
                        <button key={item.id} type="button"
                          onClick={() => toggleItemAdicional(item.id, item.tipo_dependencia, item)}
                          className={`px-3 py-1 rounded-md text-sm font-medium border transition-all ${
                            sel
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {item.tipo_dependencia}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Percentuais — apenas Produto + Serviço */}
              {isProdutoServico && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold text-amber-800">Rateio Produto / Serviço</Label>
                  {erros.percentuais && <p className="text-xs text-red-500">{erros.percentuais}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">% Produto</Label>
                      <div className="relative">
                        <Input
                          value={form.produto_percentual}
                          onChange={e => handleProdutoPercentual(e.target.value)}
                          className={`h-8 text-sm pr-6 ${erros.percentuais ? "border-red-400" : ""}`}
                          inputMode="decimal"
                        />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">% Serviço</Label>
                      <div className="relative">
                        <Input
                          value={form.servico_percentual}
                          onChange={e => handleServicoPercentual(e.target.value)}
                          className={`h-8 text-sm pr-6 ${erros.percentuais ? "border-red-400" : ""}`}
                          inputMode="decimal"
                        />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600">
                    Soma atual: {(parseFloat(form.produto_percentual || 0) + parseFloat(form.servico_percentual || 0)).toFixed(2)}%
                  </p>
                </div>
              )}

              {/* Observações — apenas Produto + Serviço */}
              {isProdutoServico && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Campo livre (Serviço)</Label>
                  <textarea
                    value={form.observacoes}
                    onChange={e => setField("observacoes", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Informações adicionais do serviço..."
                  />
                </div>
              )}

              {/* Footer da aba Config */}
              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
                <Button
                  onClick={handleSalvarEAtualizar}
                  disabled={salvando}
                  style={{ background: "#3B5CCC" }}
                  className="text-white min-w-[100px]"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </TabsContent>

            {/* ── ABA 2: RESUMO TÉCNICO ── */}
            <TabsContent value="resumo" className="space-y-4 mt-0 py-4">
              {!itemSalvo ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <p className="text-sm text-slate-400">Salve o item na aba <strong>Configurar Item</strong> para visualizar o resumo técnico.</p>
                </div>
              ) : (
                <>
                  <ResumoTecnicoAccordion
                    empresaId={empresaId}
                    quantidade={form.quantidade}
                    somaCores={somaCoresCalc}
                    somaPosicoes={somaPosicoesCalc}
                  />
                  <div className="flex justify-end pt-4 border-t mt-2">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── ABA 3: VALORES ── */}
            <TabsContent value="valores" className="space-y-4 mt-0 py-4">
              {!itemSalvo ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <p className="text-sm text-slate-400">Salve o item na aba <strong>Configurar Item</strong> para visualizar os valores calculados.</p>
                </div>
              ) : (
                <>
                  {/* Valor Unitário + Subtotal */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Valor Unitário</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400 pointer-events-none">R$</span>
                        <Input
                          value={form.valor_unitario}
                          onChange={e => handleValorUnitario(e.target.value)}
                          className="h-9 text-sm pl-8 text-right font-mono"
                          inputMode="numeric"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Subtotal</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400 pointer-events-none">R$</span>
                        <Input
                          value={form.subtotal}
                          readOnly
                          className="h-9 text-sm pl-8 text-right font-mono bg-slate-50 text-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                  <ComposicaoCustos item={itemAtualizado || itemEdicao} grupo={itemEdicao?._grupo} />
                  <ValoresItem item={itemAtualizado || itemEdicao} />
                  <div className="flex justify-end pt-4 border-t mt-2">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                  </div>
                </>
              )}
            </TabsContent>
            </Tabs>
          </div>
        </div>

      </DialogContent>

      <ModalValorItemAdicional
        open={modalValorAberto}
        onClose={() => {
          setModalValorAberto(false);
          setItemAdicionalEmEdicao(null);
        }}
        item={itemAdicionalEmEdicao}
        onSalvar={handleConfirmarValorAdicional}
      />

      <ModalPersonalizacaoDependencias
        open={modalPersAberto}
        onClose={() => {
          setModalPersAberto(false);
          setPersEmEdicao(null);
        }}
        personalizacao={persEmEdicao}
        valoresSalvos={persEmEdicao ? personalizacoesSelecionadas[persEmEdicao.id] : null}
        onConfirmar={handleConfirmarPersonalizacao}
      />
    </Dialog>
  );
}