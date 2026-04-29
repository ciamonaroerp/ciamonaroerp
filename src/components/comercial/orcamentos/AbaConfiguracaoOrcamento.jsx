/**
 * Aba 2 — Configuração do Orçamento
 * Gerencia itens: Produto, Serviço, Produto e Serviço
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/lib/supabaseClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Package, Wrench, Layers, Loader2 } from "lucide-react";
import ModalItemProduto from "./ModalItemProduto";
import ModalItemServico from "./ModalItemServico";
import GrupoItem from "./GrupoItem";

function fmtMoeda(v) {
  const n = parseFloat(v) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Colunas do grid: [#seq] [tipo] [quant.] [produto] [item+linha] [artigo] [cor] [vl.unit] [subtotal] [ações]
const GRID = "grid grid-cols-[28px_30px_60px_3fr_0.9fr_1.2fr_0.9fr_1fr_1fr_80px] gap-x-3 items-center";

// ── Cabeçalho da tabela ───────────────────────────────────────────────────────
function TabelaHeader() {
  return (
    <div className={`${GRID} px-3 py-2 bg-slate-100 border border-slate-200 rounded-t-xl text-[10px] font-semibold text-slate-500 uppercase tracking-wide`}>
      <span>#</span>
      <span></span>
      <span>Quant.</span>
      <span>Produto / Serviço</span>
      <span>Item / Linha</span>
      <span>Artigo</span>
      <span>Cor</span>
      <span className="text-right">Vlr. Unit.</span>
      <span className="text-right">Subtotal</span>
      <span className="text-right">Ações</span>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
export default function AbaConfiguracaoOrcamento({ orcamentoId, empresaId, garantirOrcamentoId, readOnly = false }) {
  const qc = useQueryClient();
  const [modalTipo, setModalTipo] = useState(null);
  const [itemEdicao, setItemEdicao] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [idLocal, setIdLocal] = useState(orcamentoId || null);



  // Sincroniza prop orcamentoId → idLocal (cobre caso de edição onde prop chega depois)
  useEffect(() => {
    if (orcamentoId && orcamentoId !== idLocal) {
      setIdLocal(orcamentoId);
      qc.invalidateQueries(["orcamento-itens", orcamentoId]);
    }
  }, [orcamentoId]);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["orcamento-itens", idLocal],
    queryFn: async () => {
      if (!idLocal) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", idLocal)
        .order("sequencia");
      if (error) console.warn("[AbaConfig] Erro ao buscar itens:", error.message);
      const parseJson = (v) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
        return [];
      };
      return (data || []).map(item => ({
        ...item,
        acabamentos: parseJson(item.acabamentos),
        personalizacoes: parseJson(item.personalizacoes),
        itens_adicionais: parseJson(item.itens_adicionais),
        operacoes: parseJson(item.operacoes),
      }));
    },
    enabled: !!idLocal,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const itensValidos = itens.filter(i => i != null);
  const proximaSequencia = itensValidos.length > 0 ? Math.max(...itensValidos.map(i => i.sequencia || 0)) + 1 : 1;

  const subtotalGeral = itensValidos.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);

  // Campos que existem apenas no payload do frontend — não são colunas da tabela
  const CAMPOS_FRONTEND = ["acabamentos_ids", "personalizacoes_ids", "personalizacoes_payload", "itens_adicionais_ids", "grupo_ids", "resumo_linha_artigo_cor", "nome_cor", "nome_linha_comercial"];

  const sanitizarPayload = (payload) => {
    const limpo = { ...payload };
    CAMPOS_FRONTEND.forEach(k => delete limpo[k]);
    // Serializa arrays/objetos para JSON string apenas se a coluna for TEXT (não JSONB nativo)
    // acabamentos e itens_adicionais são JSONB — passamos como array diretamente
    ["personalizacoes", "operacoes"].forEach(k => {
      if (limpo[k] !== undefined && typeof limpo[k] !== "string") {
        limpo[k] = JSON.stringify(limpo[k]);
      }
    });
    return limpo;
  };

  const salvarMutation = useMutation({
    mutationFn: async ({ payload, editId }) => {
      // Garante que o orçamento existe antes de inserir item
      let id = idLocal;
      if (!id && garantirOrcamentoId) {
        id = await garantirOrcamentoId();
        setIdLocal(id);
      }
      if (!id) throw new Error("Orçamento não identificado");

      const payloadLimpo = sanitizarPayload(payload);

      if (editId) {
        const { data, error } = await supabase.from("orcamento_itens").update({ ...payloadLimpo, orcamento_id: id }).eq("id", editId).select().single();
        if (error) throw new Error(error.message);
        return { data: { data: data } };
      }
      const { data, error } = await supabase.from("orcamento_itens").insert({ ...payloadLimpo, orcamento_id: id, empresa_id: empresaId }).select().single();
      if (error) throw new Error(error.message);
      return { data: { data: [data] } };
    },
    onSuccess: (_, { editId }) => {
      qc.invalidateQueries(["orcamento-itens", idLocal]);
      // Nunca fecha o modal automaticamente — o usuário vê a aba Valores e fecha manualmente
      toast.success(editId ? "Item atualizado com sucesso." : "Item adicionado com sucesso.");
    },
    onError: (err, { editId }) => {
      toast.error(editId ? "Erro ao atualizar item." : "Erro ao adicionar item.", {
        description: err?.message || "Tente novamente.",
      });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (target) => {
      // Para produtos compostos, exclui todos os registros do grupo
      const grupo = target._grupo || [target];
      const ids = grupo.map(r => r.id);
      const { error } = await supabase.from("orcamento_itens").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries(["orcamento-itens", idLocal]);
      setDeleteTarget(null);
      toast.success("Item excluído com sucesso.");
    },
    onError: (err) => {
      toast.error("Erro ao excluir item.", { description: err?.message || "Tente novamente." });
    },
  });

  const handleSalvarItem = async (payload, editId) => {
    // Calcula soma_itens_adicionais: soma dos campos "valor" dentro de itens_adicionais
    const itensAdicionais = payload.itens_adicionais;
    let somaItensAdicionais = 0;
    if (Array.isArray(itensAdicionais)) {
      somaItensAdicionais = itensAdicionais.reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0);
    }

    // Verifica se o orçamento já existe antes de tentar salvar
    if (!idLocal && garantirOrcamentoId) {
      try {
        const novoId = await garantirOrcamentoId();
        setIdLocal(novoId);
      } catch (err) {
        toast.error("Preencha as Informações do orçamento antes de adicionar itens.", {
          description: "Vá para a aba Informações e preencha os campos obrigatórios.",
        });
        throw err;
      }
    }

    const result = await salvarMutation.mutateAsync({ 
      payload: { ...payload, soma_itens_adicionais: somaItensAdicionais }, 
      editId 
    });

    // Extrai o item retornado (inserir: array[0], atualizar: object)
    const itemData = result?.data?.data;
    const savedItem = Array.isArray(itemData) ? itemData[0] : itemData;
    const resultId = editId || savedItem?.id;

    if (resultId && savedItem) {
      return { id: resultId, item: savedItem };
    }

    return { id: resultId };
  };

  const handleEditar = (item, grupo) => {
    // Para produtos compostos, passa o grupo inteiro para o modal reconstruir tecidos
    const itemComGrupo = { ...item, _grupo: grupo };
    setItemEdicao(itemComGrupo);
    setModalTipo(item.tipo_item);
  };

  const fecharModal = () => {
    setModalTipo(null);
    setItemEdicao(null);
    qc.invalidateQueries(["orcamento-itens", idLocal]);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho: título + subtotal */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Configuração do orçamento</h3>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-xs text-blue-600 font-medium">Sub-total dos itens:</span>
          <span className="text-sm font-bold text-blue-800">R$ {fmtMoeda(subtotalGeral)}</span>
        </div>
      </div>

      {/* Botões de ação */}
      <div className={`flex flex-wrap gap-2 ${readOnly ? "hidden" : ""}`}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setItemEdicao(null); setModalTipo("Produto"); }}
          className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          <Package className="h-4 w-4" />
          + Produto
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setItemEdicao(null); setModalTipo("Serviço"); }}
          className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
        >
          <Wrench className="h-4 w-4" />
          + Serviço
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setItemEdicao(null); setModalTipo("Produto e Serviço"); }}
          className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
        >
          <Layers className="h-4 w-4" />
          + Produto e Serviço
        </Button>
      </div>

      {/* Lista de itens */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="text-sm text-slate-400">Carregando itens...</span>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-center gap-2">
          <Package className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400 font-medium">Nenhum item adicionado</p>
          <p className="text-xs text-slate-300">Clique em + Produto, + Serviço ou + Produto e Serviço para começar</p>
        </div>
      ) : (
       <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
         <div className="min-w-[700px]">
           <TabelaHeader />
           {(() => {
             // Estratégia de agrupamento para produtos compostos:
             // Itens com mesmo produto_id e sequências CONSECUTIVAS são agrupados.
             // Cada vez que aparece um item com indice=1, inicia um novo grupo.
             const itensPorSeq = [...itensValidos].sort((a, b) => (a.sequencia || 0) - (b.sequencia || 0));
             const grupos = [];
             let grupoAtual = null;

             for (const item of itensPorSeq) {
               const indice = item.indice || 1;
               if (indice === 1) {
                 // Inicia novo grupo
                 grupoAtual = [item];
                 grupos.push(grupoAtual);
               } else if (grupoAtual && item.produto_id === grupoAtual[0].produto_id) {
                 // Índice > 1 do mesmo produto: adiciona ao grupo atual
                 grupoAtual.push(item);
               } else {
                 // Caso inesperado: inicia novo grupo mesmo assim
                 grupoAtual = [item];
                 grupos.push(grupoAtual);
               }
             }

             return grupos.map((grupo, idx) => (
               <GrupoItem
                 key={`grupo-${idx}-${grupo[0].id}`}
                 grupo={grupo}
                 onEditar={(item) => handleEditar(item, grupo)}
                 onExcluir={(item, grp) => setDeleteTarget({ ...item, _grupo: grp })}
                 readOnly={readOnly}
               />
             ));
           })()}
         </div>
       </div>
      )}

      {/* Modais */}
      {(modalTipo === "Produto" || modalTipo === "Produto e Serviço") && (
        <ModalItemProduto
          open={true}
          onClose={fecharModal}
          onSalvar={handleSalvarItem}
          empresaId={empresaId}
          proximaSequencia={itemEdicao ? itemEdicao.sequencia : proximaSequencia}
          tipo={modalTipo}
          itemEdicao={itemEdicao}
          orcamentoId={idLocal}
        />
      )}

      {modalTipo === "Serviço" && (
        <ModalItemServico
          open={true}
          onClose={fecharModal}
          onSalvar={handleSalvarItem}
          empresaId={empresaId}
          proximaSequencia={itemEdicao ? itemEdicao.sequencia : proximaSequencia}
          itemEdicao={itemEdicao}
        />
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o item <strong>#{String(deleteTarget?.sequencia || 0).padStart(2, "0")}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => excluirMutation.mutate(deleteTarget)}
              disabled={excluirMutation.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}