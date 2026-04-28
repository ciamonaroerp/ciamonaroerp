import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { modulosErpService } from "@/components/services/administracaoService";
import { useEmpresa } from "@/components/context/EmpresaContext";
import PageHeader from "@/components/admin/PageHeader";
import { format } from "date-fns";
import ModuloModal from "@/components/modulos/ModuloModal";
import { supabase } from "@/components/lib/supabaseClient";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import { GripVertical, Loader2, Pencil, Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function ModulosPage() {
  const { empresa_id, loading: empresaLoading } = useEmpresa();
  const qc = useQueryClient();
  const { showSuccess, showError, showConfirm } = useGlobalAlert();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [ordemLocal, setOrdemLocal] = useState([]);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [ordemAlterada, setOrdemAlterada] = useState(false);

  // Busca módulos já enriquecidos com ordem_modulo de modulo_paginas
  const { data: modulos = [], isLoading } = useQuery({
    queryKey: ["modulos-erp-ordenados", empresa_id],
    queryFn: async () => {
      if (!supabase || !empresa_id) return [];
      const { data } = await supabase.from("modulos_erp").select("*").eq("empresa_id", empresa_id).order("ordem_modulo", { ascending: true });
      return data || [];
    },
    enabled: !!empresa_id && !empresaLoading,
  });

  // Busca o menu completo para exibir páginas vinculadas por módulo
  const { data: menuCompleto = {} } = useQuery({
    queryKey: ["menu-completo", empresa_id],
    queryFn: async () => {
      if (!supabase || !empresa_id) return {};
      const { data } = await supabase.from("modulo_paginas").select("modulo_nome,pagina_nome,label_menu,ordem").eq("empresa_id", empresa_id);
      const mapa = {};
      (data || []).forEach(r => { if (!mapa[r.modulo_nome]) mapa[r.modulo_nome] = []; mapa[r.modulo_nome].push(r); });
      return mapa;
    },
    enabled: !!empresa_id && !empresaLoading,
  });

  // Sincroniza lista local sempre que modulos mudar (sem alteração local pendente)
  useEffect(() => {
    if (modulos.length > 0 && !ordemAlterada) {
      setOrdemLocal(modulos); // já vem ordenado do backend
    }
  }, [modulos]);

  const salvarOrdem = async (novaLista) => {
    setSalvandoOrdem(true);
    await Promise.all(novaLista.map((m, idx) => supabase.from("modulos_erp").update({ ordem_modulo: idx }).eq("id", m.id)));
    setSalvandoOrdem(false);
    showSuccess({ title: "Ordem atualizada", description: "A ordem dos módulos foi atualizada com sucesso." });
    setOrdemAlterada(false);
    qc.invalidateQueries({ queryKey: ["modulos-erp-ordenados"] });
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const novaLista = [...ordemLocal];
    const [movido] = novaLista.splice(result.source.index, 1);
    novaLista.splice(result.destination.index, 0, movido);
    setOrdemLocal(novaLista);
    setOrdemAlterada(true);
    await salvarOrdem(novaLista);
  };

  const moverItem = async (idx, direcao) => {
    const novaLista = [...ordemLocal];
    const alvo = idx + direcao;
    if (alvo < 0 || alvo >= novaLista.length) return;
    [novaLista[idx], novaLista[alvo]] = [novaLista[alvo], novaLista[idx]];
    setOrdemLocal(novaLista);
    setOrdemAlterada(true);
    await salvarOrdem(novaLista);
  };

  const criar = useMutation({
    mutationFn: (d) => modulosErpService.criar({ ...d, empresa_id }),
  });

  const editar = useMutation({
    mutationFn: ({ id, d }) => modulosErpService.atualizar(id, d),
  });

  const handleExcluir = async (row) => {
    const { count } = await supabase.from("modulo_paginas").select("id", { count: "exact" }).eq("modulo_nome", row.nome_modulo).eq("empresa_id", empresa_id);
    if (count > 0) {
      showError({ title: "Ação não permitida", description: "O módulo possui páginas vinculadas." });
      return;
    }
    showConfirm({
      title: "Deseja excluir?",
      description: "Esta ação não poderá ser desfeita.",
      onConfirm: async () => {
        await modulosErpService.deletar(row.id);
        qc.invalidateQueries({ queryKey: ["modulos-erp-ordenados"] });
      },
    });
  };

  const handleClose = () => { setModalOpen(false); setEditingRow(null); };

  const handleSubmit = async ({ dadosModulo, paginasSelecionadas }) => {
    try {
      if (editingRow) {
        await editar.mutateAsync({ id: editingRow.id, d: dadosModulo });
      } else {
        await criar.mutateAsync(dadosModulo);
      }
      if (empresa_id && dadosModulo.nome_modulo && paginasSelecionadas.length >= 0) {
        // Remove páginas antigas e insere novas
        await supabase.from("modulo_paginas").delete().eq("empresa_id", empresa_id).eq("modulo_nome", dadosModulo.nome_modulo);
        if (paginasSelecionadas.length > 0) {
          await supabase.from("modulo_paginas").insert(
            paginasSelecionadas.map((p, i) => ({ empresa_id, modulo_nome: dadosModulo.nome_modulo, pagina_nome: p.pagina_nome, label_menu: p.label_menu || p.pagina_nome, ordem: i }))
          );
        }
      }
      setOrdemAlterada(false);
      qc.invalidateQueries({ queryKey: ["modulos-erp-ordenados"] });
      qc.invalidateQueries({ queryKey: ["menu-completo"] });
      window.dispatchEvent(new Event("erp-menu-atualizado"));
      showSuccess({
        title: "Módulo salvo com sucesso",
        description: editingRow
          ? `O módulo "${dadosModulo.nome_modulo}" foi atualizado.`
          : `O módulo "${dadosModulo.nome_modulo}" foi criado.`,
      });
      handleClose();
    } catch (err) {
      showError({
        title: "Erro ao salvar módulo",
        description: err?.message || "Não foi possível salvar o módulo. Tente novamente.",
      });
    }
  };

  // Guard: aguarda contexto estar pronto
  if (empresaLoading || !empresa_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500">Carregando empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulos do ERP"
        description="Gerencie módulos, ordem no menu, status e páginas vinculadas."
        action={
          <Button onClick={() => { setEditingRow(null); setModalOpen(true); }} size="sm" className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Novo módulo
          </Button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Cabeçalho da tabela */}
        <div className="grid grid-cols-[40px_48px_1fr_1fr_120px_140px_100px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span></span>
          <span className="text-center">Ordem</span>
          <span>Nome do Módulo</span>
          <span>Páginas do Menu</span>
          <span className="text-center">Status</span>
          <span>Criado em</span>
          <span className="text-right">Ações</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando módulos...
          </div>
        ) : ordemLocal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <p className="text-sm">Nenhum módulo cadastrado.</p>
            <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro módulo
            </Button>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="modulos-lista">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {ordemLocal.map((m, idx) => (
                    <Draggable key={m.id} draggableId={m.id} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`grid grid-cols-[40px_48px_1fr_1fr_120px_140px_100px] gap-3 px-4 py-3 items-center border-b border-slate-100 transition-colors ${
                            snapshot.isDragging ? "bg-blue-50 shadow-md" : "hover:bg-slate-50"
                          }`}
                        >
                          {/* Drag handle */}
                          <div {...provided.dragHandleProps} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                            <GripVertical className="h-4 w-4" />
                          </div>

                          {/* Ordem + botões ↑↓ */}
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => moverItem(idx, -1)}
                              disabled={idx === 0 || salvandoOrdem}
                              className="text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-mono text-slate-500 leading-none">{idx + 1}</span>
                            <button
                              onClick={() => moverItem(idx, 1)}
                              disabled={idx === ordemLocal.length - 1 || salvandoOrdem}
                              className="text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Nome */}
                          <span className="text-sm font-medium text-slate-800 truncate">{m.nome_modulo}</span>

                          {/* Páginas do Menu */}
                          <div className="flex flex-wrap gap-1">
                            {(menuCompleto[m.nome_modulo] || []).length === 0 ? (
                              <span className="text-xs text-slate-400 italic">Nenhuma</span>
                            ) : (
                              (menuCompleto[m.nome_modulo] || []).map(p => (
                                <span
                                  key={p.pagina_nome}
                                  className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-md"
                                  title={p.pagina_nome}
                                >
                                  {p.label_menu || p.pagina_nome}
                                </span>
                              ))
                            )}
                          </div>

                          {/* Status badge discreta */}
                          <div className="flex justify-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              m.status === "Ativo"
                                ? "bg-slate-50 border-slate-300 text-slate-600"
                                : "bg-slate-50 border-slate-200 text-slate-400"
                            }`}>
                              {m.status ?? "—"}
                            </span>
                          </div>

                          {/* Data criação */}
                          <span className="text-xs text-slate-500">
                            {(m.created_date || m.created_at) ? format(new Date(m.created_date || m.created_at), "dd/MM/yyyy") : "—"}
                          </span>

                          {/* Ações */}
                          <div className="flex items-center justify-end gap-1">
                            {salvandoOrdem && idx === 0 && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 mr-1" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-700"
                              onClick={() => { setEditingRow(m); setModalOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-500"
                              onClick={() => handleExcluir(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <ModuloModal
        open={modalOpen}
        onClose={handleClose}
        editingRow={editingRow}
        empresa_id={empresa_id}
        onSubmit={handleSubmit}
        isSubmitting={criar.isPending || editar.isPending}
      />
    </div>
  );
}