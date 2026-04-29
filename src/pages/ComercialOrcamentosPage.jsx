/**
 * CIAMONARO ERP — Comercial > Orçamentos
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/lib/supabaseClient";
import { useEmpresa } from "@/components/context/EmpresaContext";
import { useSupabaseAuth } from "@/components/context/SupabaseAuthContext";
import ErpPageLayout from "@/components/design-system/ErpPageLayout";
import ErpTable from "@/components/erp/ErpTable";
import OrcamentoModal from "@/components/comercial/orcamentos/OrcamentoModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import { Plus, Trash2, Eye, FileText, Copy, Edit2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { gerarTextoWhatsApp, gerarHTMLOrcamento } from "@/components/comercial/orcamentos/orcamentoUtils";
import OrcamentoPreviewModal from "@/components/comercial/orcamentos/OrcamentoPreviewModal";
import { toast } from "sonner";

const STATUS_BADGE = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "em negociação": "bg-blue-50 text-blue-700 border-blue-200",
  inativo: "bg-red-50 text-red-700 border-red-200",
  cancelado: "bg-slate-100 text-slate-500 border-slate-200",
  pronto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  em_elaboracao: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABEL = {
  pronto: "Pronto",
  em_elaboracao: "Em Elaboração",
};

// Coluna "Título" com destaque e largura maior via className
const COLUNAS = [
  {
    key: "codigo_orcamento",
    label: "Código",
    render: (v) => <span className="font-mono text-xs font-semibold text-blue-700">{v || "—"}</span>,
  },
  {
    key: "titulo_orcamento",
    label: "Título",
    className: "min-w-[220px]",
    render: (v) => <span className="font-semibold text-slate-800 text-sm">{v || "—"}</span>,
  },
  { key: "vendedor", label: "Vendedor", render: (v) => v || "—" },
  { key: "cliente_nome", label: "Cliente", render: (v) => v || "—" },
  {
    key: "status",
    label: "Status",
    render: (v) => (
      <Badge className={`text-xs font-medium border ${STATUS_BADGE[(v || "").toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
        {STATUS_LABEL[(v || "").toLowerCase()] || v || "—"}
      </Badge>
    ),
  },
  {
    key: "created_at",
    label: "Data de Criação",
    render: (v) => (v ? format(new Date(v), "dd/MM/yyyy") : "—"),
  },
];

export default function ComercialOrcamentosPage() {
  const qc = useQueryClient();
  const { empresa_id, loading: empresaLoading } = useEmpresa();
  const { erpUsuario } = useSupabaseAuth();

  const { showDelete, showConfirm, showError, showSuccess } = useGlobalAlert();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [previewHTML, setPreviewHTML] = useState(null);
  const [previewCodigo, setPreviewCodigo] = useState("");

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["com-orcamentos", empresa_id],
    queryFn: async () => {
      if (!supabase || !empresa_id) return [];
      const { data, error } = await supabase
        .from("com_orcamentos")
        .select("*")
        .eq("empresa_id", empresa_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!empresa_id && !empresaLoading,
  });

  const deletarOrcamento = async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from("com_orcamentos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      showError({ title: "Erro ao excluir", description: error.message });
      return;
    }
    qc.invalidateQueries(["com-orcamentos"]);
    showSuccess({ title: "Excluído", description: "Orçamento excluído com sucesso." });
  };

  const handleEditar = (row) => {
    setReadOnly(false);
    setEditingId(row.id);
    setModalOpen(true);
  };

  const handleVisualizar = (row) => {
    setReadOnly(true);
    setEditingId(row.id);
    setModalOpen(true);
  };

  // Abre modal limpo — sem criar registro antecipado
  const handleNovoOrcamento = () => {
    setReadOnly(false);
    setEditingId(null);
    setModalOpen(true);
  };

  const handleModalClose = (savedSuccessfully = false) => {
    setModalOpen(false);
    setEditingId(null);
    setReadOnly(false);
    qc.invalidateQueries(["com-orcamentos"]);
    if (savedSuccessfully) {
      showSuccess({
        title: "Sucesso",
        description: editingId ? "Orçamento atualizado com sucesso." : "Orçamento salvo com sucesso.",
      });
    }
  };

  const buscarEmpresa = async () => {
    if (!supabase) return {};
    const { data } = await supabase
      .from("empresas_config")
      .select("id, razao_social, cnpj, endereco, numero, cep, bairro, cidade, estado, logo_url")
      .is("deleted_at", null)
      .neq("status", "Inativo")
      .limit(1)
      .maybeSingle();
    return data || {};
  };

  const buscarDadosCompletos = async (orcamento) => {
    const { data: itensData } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamento.id).order("created_at");
    const itens = itensData || [];
    const extra = {
      desconto: parseFloat(orcamento.desconto_pagamento) || 0,
      formaPagamento: orcamento.forma_pagamento || "",
      parcelas: orcamento.parcelas_pagamento || [],
      tipoFrete: orcamento.tipo_frete || "",
      valorFrete: parseFloat(orcamento.valor_frete) || 0,
      validadeProposta: orcamento.validade_proposta || "",
    };
    return { itens, extra };
  };

  const handleCopiarTexto = async (orcamento) => {
    const { itens, extra } = await buscarDadosCompletos(orcamento);
    gerarTextoWhatsApp({ orcamento, itens, extra });
    toast.success("Texto copiado para a área de transferência!");
  };

  const buscarVendedor = async (vendedorEmail) => {
    if (!vendedorEmail || !supabase) return {};
    const { data } = await supabase.from("erp_usuarios").select("nome, assinatura_url").eq("email", vendedorEmail).maybeSingle();
    return data || {};
  };

  const buscarClienteCompleto = async (clienteId) => {
    if (!clienteId || !supabase) return null;
    const { data } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
    return data || null;
  };

  const buscarInformacoes = async () => {
    if (!supabase) return { informacoesComplementares: [], condicoesComerciais: [] };
    const [{ data: completas }, { data: comerciais }] = await Promise.all([
      supabase.from("informacoes_complementares").select("*").is("deleted_at", null),
      supabase.from("informacoes_condicoes_comerciais").select("*").is("deleted_at", null).order("sequencia"),
    ]);
    return {
      informacoesComplementares: completas || [],
      condicoesComerciais: comerciais || [],
    };
  };

  const handleImprimir = async (orcamento) => {
    const [{ itens, extra }, empresa, vendedorInfo, clienteCompleto, informacoes] = await Promise.all([
      buscarDadosCompletos(orcamento),
      buscarEmpresa(),
      buscarVendedor(orcamento.vendedor_email),
      buscarClienteCompleto(orcamento.cliente_id),
      buscarInformacoes(),
    ]);
    const html = gerarHTMLOrcamento({
      orcamento,
      itens,
      extra,
      empresa,
      vendedorInfo,
      clienteCompleto,
      informacoesComplementares: informacoes.informacoesComplementares,
      condicoesComerciais: informacoes.condicoesComerciais,
    });
    setPreviewCodigo(orcamento.codigo_orcamento || "");
    setPreviewHTML(html);
  };

  // Guard: aguarda contexto estar pronto
  if (empresaLoading || !empresa_id) {
    return (
      <ErpPageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-slate-500">Carregando empresa...</p>
          </div>
        </div>
      </ErpPageLayout>
    );
  }

  return (
    <ErpPageLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
            <p className="text-sm text-slate-500">Gerencie os orçamentos comerciais</p>
          </div>
          <Button
            onClick={handleNovoOrcamento}
            style={{ background: "#3B5CCC" }}
            className="text-white gap-2"
          >
            <Plus className="h-4 w-4" /> Novo orçamento
          </Button>
        </div>

        <ErpTable
           titulo="Orçamentos"
           colunas={COLUNAS}
           dados={orcamentos}
           isLoading={isLoading}
           campoBusca="titulo_orcamento"
           showSearchBar={true}
           acoes={[
             {
               titulo: "Visualizar",
               icone: Eye,
               onClick: (row) => handleVisualizar(row),
             },
             {
               titulo: "Gerar PDF",
               icone: FileText,
               disabled: (row) => row.status !== "pronto",
               title: (row) => row.status !== "pronto" ? "Orçamento incompleto — salve com todos os dados preenchidos" : "Gerar PDF",
               onClick: (row) => row.status === "pronto" ? handleImprimir(row) : showError({ title: "Orçamento incompleto", description: "Salve o orçamento com todos os dados antes de gerar o PDF." }),
             },
             {
               titulo: "Copiar Texto",
               icone: Copy,
               disabled: (row) => row.status !== "pronto",
               title: (row) => row.status !== "pronto" ? "Orçamento incompleto — salve com todos os dados preenchidos" : "Copiar texto WhatsApp",
               onClick: (row) => row.status === "pronto" ? handleCopiarTexto(row) : showError({ title: "Orçamento incompleto", description: "Salve o orçamento com todos os dados antes de copiar o texto." }),
             },
             {
               titulo: "Editar",
               icone: Edit2,
               onClick: (row) => handleEditar(row),
             },
             {
               titulo: "Excluir",
               icone: Trash2,
               className: "hover:text-red-600",
               onClick: (row) =>
                 showDelete({
                   title: "Deseja excluir este orçamento?",
                   description: `O orçamento "${row.titulo_orcamento || row.codigo_orcamento}" será removido. Esta ação não poderá ser desfeita.`,
                   onConfirm: () => deletarOrcamento(row.id),
                 }),
             },
           ]}
         />
      </div>

      {modalOpen && (
        <OrcamentoModal
          open={modalOpen}
          onClose={handleModalClose}
          editingId={editingId}
          empresaId={empresa_id}
          usuarioLogado={erpUsuario}
          readOnly={readOnly}
        />
      )}

      {previewHTML && (
        <OrcamentoPreviewModal
          html={previewHTML}
          codigo={previewCodigo}
          onClose={() => setPreviewHTML(null)}
        />
      )}

    </ErpPageLayout>
  );
}