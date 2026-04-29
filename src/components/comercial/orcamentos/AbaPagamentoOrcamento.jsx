/**
 * Aba Pagamento — OrcamentoModal
 * Framework V3 PRO
 */
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGlobalAlert } from "@/components/GlobalAlertDialog";
import { toast } from "sonner";
import { Loader2, Copy, Printer, Save, Check } from "lucide-react";
import { format } from "date-fns";
import { gerarTextoWhatsApp, gerarHTMLOrcamento } from "./orcamentoUtils";
import * as pagamentoService from "@/services/pagamentoService";
import OrcamentoPreviewModal from "./OrcamentoPreviewModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseMoeda(str) {
  if (!str && str !== 0) return 0;
  const limpo = String(str).replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

function fmtMoeda(v) {
  const n = parseFloat(v) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateInput(dateStr) {
  if (!dateStr) return "";
  try { return format(new Date(dateStr), "yyyy-MM-dd"); } catch { return ""; }
}

// Mantido como fallback temporário — não remover ainda
function gerarParcelasLegado(total, quantidade, dataBase) {
  if (!quantidade || quantidade < 1) return [];
  const valorBase = Math.floor((total / quantidade) * 100) / 100;
  const resto = Math.round((total - valorBase * quantidade) * 100) / 100;
  const hoje = dataBase ? new Date(dataBase) : new Date();
  return Array.from({ length: quantidade }, (_, i) => {
    const data = new Date(hoje);
    data.setMonth(data.getMonth() + i + 1);
    return {
      numero: i + 1,
      valor: i === quantidade - 1 ? +(valorBase + resto).toFixed(2) : +valorBase.toFixed(2),
      data: format(data, "yyyy-MM-dd"),
      foiEditada: false,
      displayValor: fmtMoeda(i === quantidade - 1 ? +(valorBase + resto).toFixed(2) : +valorBase.toFixed(2)),
    };
  });
}

function redistribuirSaldo(parcelas, total) {
  const somaEditadas = parcelas.filter(p => p.foiEditada).reduce((s, p) => s + p.valor, 0);
  const saldo = +((total - somaEditadas)).toFixed(2);
  const naoEditadas = parcelas.filter(p => !p.foiEditada);
  if (naoEditadas.length === 0) return parcelas;
  const valorBase = Math.floor((saldo / naoEditadas.length) * 100) / 100;
  const resto = +(saldo - valorBase * naoEditadas.length).toFixed(2);
  let idx = 0;
  return parcelas.map(p => {
    if (p.foiEditada) return p;
    const isLast = idx === naoEditadas.length - 1;
    const valor = isLast ? +(valorBase + resto).toFixed(2) : +valorBase.toFixed(2);
    idx++;
    return { ...p, valor, displayValor: fmtMoeda(valor) };
  });
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AbaPagamentoOrcamento({ orcamentoId, empresaId, onRegisterSave, onSalvoComSucesso, garantirOrcamentoId, readOnly = false, onBeforeSave, formInfo = {} }) {
  const qc = useQueryClient();
  const { showError } = useGlobalAlert();

  const [carregado, setCarregado] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [isOrcamentoSalvo, setIsOrcamentoSalvo] = useState(false);

  // Datas
  const [dataProposta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [modoEntrega, setModoEntrega] = useState("data"); // "data" | "prazo"
  const [dataEntrega, setDataEntrega] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [validadeProposta, setValidadeProposta] = useState("");

  // Resumo
  const [desconto, setDesconto] = useState(0);
  const [descontoDisplay, setDescontoDisplay] = useState("0,00");

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState("");

  // Parcelas
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [parcelas, setParcelas] = useState([]);

  // ── Busca dados do orçamento (itens + logística) ──────────────────────────
  const { data: orcamento } = useQuery({
    queryKey: ["orcamento-pagamento", orcamentoId],
    queryFn: async () => {
      const { data } = await supabase.from("com_orcamentos").select("*").eq("id", orcamentoId).maybeSingle();
      return data || null;
    },
    enabled: !!orcamentoId,
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["orcamento-itens", orcamentoId],
    queryFn: async () => {
      const { data } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("sequencia");
      return data || [];
    },
    enabled: !!orcamentoId,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas-pagamento", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("fin_formas_pagamento").select("id,forma_pagamento").eq("empresa_id", empresaId).is("deleted_at", null);
      return data || [];
    },
    enabled: !!empresaId,
  });

  // ── Valores calculados ────────────────────────────────────────────────────
  const itensValidos = itens.filter(i => i != null);
  const subtotalItens = itensValidos.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
  const tipoFrete = orcamento?.tipo_frete || "";
  const valorFrete = tipoFrete === "FOB" ? (parseFloat(orcamento?.valor_frete) || 0) : 0;
  const totalOrcamento = Math.max(0, subtotalItens + valorFrete - desconto);

  // ── Pré-popula ao carregar orcamento ──────────────────────────────────────
  useEffect(() => {
    if (orcamento && !carregado) {
      setModoEntrega(orcamento.prazo_entrega ? "prazo" : "data");
      setDataEntrega(fmtDateInput(orcamento.data_entrega_pagamento || ""));
      setPrazoEntrega(orcamento.prazo_entrega || "");
      setValidadeProposta(fmtDateInput(orcamento.validade_proposta || ""));
      const desc = parseFloat(orcamento.desconto_pagamento) || 0;
      setDesconto(desc);
      setDescontoDisplay(fmtMoeda(desc));
      setFormaPagamento(orcamento.forma_pagamento || "");

      const savedParcelas = orcamento.parcelas_pagamento;
      if (savedParcelas && Array.isArray(savedParcelas) && savedParcelas.length > 0) {
        const p = savedParcelas.map(p => ({ ...p, displayValor: fmtMoeda(p.valor), foiEditada: false }));
        setParcelas(p);
        setQtdParcelas(p.length);
      }
      setCarregado(true);
      setIsOrcamentoSalvo(true); // dados já persistidos no banco → habilita botões
    }
  }, [orcamento, carregado]);

  // ── Gera / recalcula parcelas quando total ou qtd mudam ──────────────────
  useEffect(() => {
    if (!carregado) return;
    if (qtdParcelas > 0 && totalOrcamento > 0) {
      setParcelas(prev => {
        // Se quantidade mudou, regenera do zero via service
        if (prev.length !== qtdParcelas) {
          pagamentoService.gerarParcelas({
            total: totalOrcamento,
            quantidadeParcelas: qtdParcelas,
            dataPrimeiroVencimento: dataProposta,
          }).then(response => {
            const novasParcelas = response.data.map(p => ({
              numero: p.numero,
              valor: p.valor,
              data: p.vencimento ? p.vencimento.slice(0, 10) : "",
              foiEditada: false,
              displayValor: fmtMoeda(p.valor),
            }));
            setParcelas(novasParcelas);
          }).catch(() => {
            // fallback temporário
            setParcelas(gerarParcelasLegado(totalOrcamento, qtdParcelas, dataProposta));
          });
          return prev; // mantém estado atual enquanto a promise resolve
        }
        // Caso contrário redistribui saldo
        return redistribuirSaldo(prev, totalOrcamento);
      });
    }
  }, [totalOrcamento, qtdParcelas, carregado]);

  // ── Edição de parcela ─────────────────────────────────────────────────────
  const handleParcelaValorChange = (idx, raw) => {
    const cleaned = raw.replace(/[^\d,]/g, "");
    setParcelas(prev => prev.map((p, i) => i === idx ? { ...p, displayValor: cleaned } : p));
  };

  const handleParcelaValorBlur = (idx) => {
    setParcelas(prev => {
      const updated = prev.map((p, i) => {
        if (i !== idx) return p;
        const valor = parseMoeda(p.displayValor);
        return { ...p, valor, displayValor: fmtMoeda(valor), foiEditada: true };
      });
      return redistribuirSaldo(updated, totalOrcamento);
    });
  };

  const handleParcelaDataChange = (idx, val) => {
    setParcelas(prev => prev.map((p, i) => i === idx ? { ...p, data: val, foiEditada: true } : p));
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const buildPayload = useCallback(() => ({
    data_proposta: dataProposta,
    data_entrega_pagamento: modoEntrega === "data" ? dataEntrega || null : null,
    prazo_entrega: modoEntrega === "prazo" ? prazoEntrega || null : null,
    validade_proposta: validadeProposta || null,
    desconto_pagamento: desconto,
    forma_pagamento: formaPagamento || null,
    parcelas_pagamento: parcelas.map(p => ({ numero: p.numero, valor: p.valor, data: p.data })),
    updated_at: new Date().toISOString(),
  }), [dataProposta, modoEntrega, dataEntrega, prazoEntrega, validadeProposta, desconto, formaPagamento, parcelas]);

  useEffect(() => {
    if (onRegisterSave) onRegisterSave(() => salvarDados());
  }, [buildPayload]);

  const validarPagamento = () => {
    const erros = [];
    if (!dataEntrega && !prazoEntrega) erros.push("Entrega (data ou prazo)");
    if (!validadeProposta) erros.push("Validade da proposta");
    if (!formaPagamento) erros.push("Forma de pagamento");
    return erros;
  };

  const salvarDados = async () => {
    if (!orcamentoId) return;
    const errosValidacao = validarPagamento();
    if (errosValidacao.length > 0) {
      showError({
        title: "Campos obrigatórios",
        description: `Preencha: ${errosValidacao.join(", ")}`,
      });
      return Promise.reject(new Error("Validação falhou"));
    }
    const { error } = await supabase.from("com_orcamentos").update(buildPayload()).eq("id", orcamentoId);
    if (error) throw new Error(error.message);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const errosValidacao = validarPagamento();
      if (errosValidacao.length > 0) {
        throw new Error(`Preencha: ${errosValidacao.join(", ")}`);
      }
      // Garante que o orçamento existe no banco antes de salvar pagamento
      const idFinal = garantirOrcamentoId ? await garantirOrcamentoId() : orcamentoId;
      if (!idFinal) throw new Error("Não foi possível identificar o orçamento.");

      // Salva logística em paralelo
      if (onBeforeSave) await onBeforeSave(idFinal);

      const { data: itensAtuais } = await supabase.from("orcamento_itens").select("id").eq("orcamento_id", idFinal).limit(1);
      const temItens = Array.isArray(itensAtuais) && itensAtuais.length > 0;
      const statusFinal = temItens ? "pronto" : "em_elaboracao";
      const { data: res, error } = await supabase.from("com_orcamentos").update({ ...buildPayload(), status: statusFinal }).eq("id", idFinal).select().single();
      if (error) throw new Error(error.message);
      return { res, idFinal, completo: temItens };
    },
    onSuccess: ({ res, idFinal, completo }) => {
      qc.invalidateQueries(["orcamento-pagamento", idFinal]);
      setSalvo(true);
      setIsOrcamentoSalvo(true);
      toast.success("Orçamento salvo com sucesso!");
      setTimeout(() => setSalvo(false), 3000);
      const codigo = res?.codigo_orcamento;
      if (onSalvoComSucesso) onSalvoComSucesso(codigo, idFinal, completo);
    },
    onError: (err) => {
      setIsOrcamentoSalvo(false);
      showError({ title: "Erro ao salvar", description: err?.message || "Erro desconhecido" });
    },
  });

  // ── Copiar texto WhatsApp ─────────────────────────────────────────────────
  const handleCopiarTexto = () => {
    gerarTextoWhatsApp({
      orcamento,
      itens,
      extra: { desconto, formaPagamento, parcelas, tipoFrete, valorFrete, subtotalItens, totalOrcamento, validadeProposta },
    });
    toast.success("Texto copiado! Cole no WhatsApp para enviar ao cliente.");
  };

  // ── Preview / Imprimir ───────────────────────────────────────────────────
  const [previewHTML, setPreviewHTML] = useState(null);
  const [previewCodigo, setPreviewCodigo] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleImprimir = async () => {
    setLoadingPreview(true);
    const extra = { desconto, formaPagamento, parcelas, tipoFrete, valorFrete, subtotalItens, totalOrcamento, validadeProposta };

    const [empresaResp, vendedorResp, clienteResp, complResp, comResp] = await Promise.all([
      supabase.from("empresas_config").select("id,razao_social,cnpj,endereco,numero,cep,bairro,cidade,estado,logo_url").is("deleted_at", null),
      orcamento?.vendedor_email ? supabase.from("erp_usuarios").select("nome,assinatura_url").eq("email", orcamento.vendedor_email).maybeSingle() : Promise.resolve(null),
      orcamento?.cliente_id ? supabase.from("clientes").select("*").eq("id", orcamento.cliente_id).maybeSingle() : Promise.resolve(null),
      supabase.from("informacoes_complementares").select("*").is("deleted_at", null),
      supabase.from("informacoes_condicoes_comerciais").select("*").is("deleted_at", null).order("sequencia"),
    ]);

    const empresa = (empresaResp?.data || []).filter(e => e.status !== "Inativo")[0] || {};
    const vendedorInfo = vendedorResp?.data || {};
    const clienteCompleto = clienteResp?.data || null;
    const informacoesComplementares = complResp?.data || [];
    const condicoesComerciais = (comResp?.data || []).sort((a, b) => (a.sequencia || 0) - (b.sequencia || 0));

    const html = gerarHTMLOrcamento({ orcamento, itens, extra, empresa, vendedorInfo, clienteCompleto, informacoesComplementares, condicoesComerciais });
    setPreviewCodigo(orcamento?.codigo_orcamento || "");
    setPreviewHTML(html);
    setLoadingPreview(false);
  };

  return (
    <div className="space-y-6">
      {previewHTML && (
        <OrcamentoPreviewModal
          html={previewHTML}
          codigo={previewCodigo}
          onClose={() => setPreviewHTML(null)}
        />
      )}

      {/* ── BLOCO 1: DATAS ─────────────────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Datas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Data da proposta — somente leitura */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Data da Proposta</Label>
            <Input
              type="date"
              value={dataProposta}
              readOnly
              className="bg-slate-100 h-9 text-slate-500 cursor-not-allowed"
            />
          </div>

          {/* Data OU Prazo de entrega */}
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center gap-4 mb-1.5">
              <Label className="text-sm font-medium text-slate-700">Entrega *</Label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={() => { setModoEntrega("data"); setIsOrcamentoSalvo(false); }}
                   className={`px-2.5 py-1 rounded-full border transition-colors ${modoEntrega === "data" ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-300 hover:border-slate-400"}`}
                  >
                   Data fixa
                  </button>
                  <button
                   onClick={() => { setModoEntrega("prazo"); setIsOrcamentoSalvo(false); }}
                  className={`px-2.5 py-1 rounded-full border transition-colors ${modoEntrega === "prazo" ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-300 hover:border-slate-400"}`}
                >
                  Prazo (dias)
                </button>
              </div>
            </div>
            {modoEntrega === "data" ? (
              <Input
                type="date"
                value={dataEntrega}
                onChange={e => { setDataEntrega(e.target.value); setIsOrcamentoSalvo(false); }}
                className="bg-white h-9"
              />
            ) : (
              <Input
                placeholder="Ex: 30 dias, 60 dias..."
                value={prazoEntrega}
                onChange={e => { setPrazoEntrega(e.target.value); setIsOrcamentoSalvo(false); }}
                className="bg-white h-9"
              />
            )}
          </div>

          {/* Validade da proposta */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Validade da Proposta *</Label>
            <Input
              type="date"
              value={validadeProposta}
              onChange={e => { setValidadeProposta(e.target.value); setIsOrcamentoSalvo(false); }}
              className="bg-white h-9"
            />
          </div>

        </div>
      </div>

      {/* ── BLOCO 2: RESUMO ─────────────────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resumo do Orçamento</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Valor do orçamento (itens) */}
          <div className="flex justify-between items-center bg-white rounded-lg px-4 py-2.5 border border-slate-200">
            <span className="text-sm text-slate-600">Subtotal dos itens</span>
            <span className="font-semibold text-slate-800 font-mono">R$ {fmtMoeda(subtotalItens)}</span>
          </div>

          {/* Frete */}
          <div className="flex justify-between items-center bg-white rounded-lg px-4 py-2.5 border border-slate-200">
            <span className="text-sm text-slate-600">Frete</span>
            <span className="font-semibold text-slate-800 font-mono">
              {!tipoFrete ? "—" : tipoFrete === "CIF" ? "CIF" : `R$ ${fmtMoeda(valorFrete)}`}
            </span>
          </div>

          {/* Desconto */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Desconto (R$)</Label>
            <Input
              className="bg-white h-9 text-right font-mono"
              value={descontoDisplay}
              onChange={e => { setDescontoDisplay(e.target.value.replace(/[^\d,]/g, "")); setIsOrcamentoSalvo(false); }}
              onBlur={() => {
                const v = parseMoeda(descontoDisplay);
                setDesconto(v);
                setDescontoDisplay(fmtMoeda(v));
              }}
              onFocus={() => { if (desconto === 0) setDescontoDisplay(""); }}
            />
          </div>

          {/* Total */}
          <div className="flex justify-between items-center bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-200">
            <span className="text-sm font-semibold text-blue-700">Total do Orçamento</span>
            <span className="text-lg font-bold text-blue-800 font-mono">R$ {fmtMoeda(totalOrcamento)}</span>
          </div>
        </div>
      </div>

      {/* ── BLOCO 3: FORMA DE PAGAMENTO ───────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Forma de Pagamento *</h3>
        <div className="max-w-xs">
          <Select value={formaPagamento} onValueChange={v => { setFormaPagamento(v); setIsOrcamentoSalvo(false); }}>
            <SelectTrigger className="bg-white h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {formasPagamento.map((f, idx) => (
                <SelectItem key={f.id || idx} value={f.forma_pagamento}>
                  {f.forma_pagamento}
                </SelectItem>
              ))}
              {formasPagamento.length === 0 && (
                <SelectItem value="__none__" disabled>Nenhuma forma cadastrada</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── BLOCO 4: PARCELAMENTO ─────────────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Parcelamento</h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-600">Nº de parcelas</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={qtdParcelas}
              onChange={e => {
                const n = Math.max(1, parseInt(e.target.value) || 1);
                setQtdParcelas(n);
                pagamentoService.gerarParcelas({
                  total: totalOrcamento,
                  quantidadeParcelas: n,
                  dataPrimeiroVencimento: dataProposta,
                }).then(response => {
                  const novasParcelas = response.data.map(p => ({
                    numero: p.numero,
                    valor: p.valor,
                    data: p.vencimento ? p.vencimento.slice(0, 10) : "",
                    foiEditada: false,
                    displayValor: fmtMoeda(p.valor),
                  }));
                  setParcelas(novasParcelas);
                }).catch(() => {
                  // fallback temporário
                  setParcelas(gerarParcelasLegado(totalOrcamento, n, dataProposta));
                });
                setIsOrcamentoSalvo(false);
              }}
              className="bg-white h-9 w-20 text-center"
            />
          </div>
        </div>

        {parcelas.length > 0 && (
          <div className="space-y-2">
            {/* Cabeçalho */}
            <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Vencimento</div>
              <div className="col-span-5 text-right">Valor (R$)</div>
              <div className="col-span-1" />
            </div>

            {parcelas.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white rounded-lg px-2 py-1.5 border border-slate-200">
                <div className="col-span-1 text-xs font-bold text-slate-500">{p.numero}ª</div>
                <div className="col-span-5">
                  <Input
                    type="date"
                    value={p.data}
                    onChange={e => handleParcelaDataChange(idx, e.target.value)}
                    className="h-8 text-sm bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="col-span-5">
                  <Input
                    value={p.displayValor}
                    onChange={e => handleParcelaValorChange(idx, e.target.value)}
                    onBlur={() => handleParcelaValorBlur(idx)}
                    className={`h-8 text-sm text-right font-mono ${p.foiEditada ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {p.foiEditada && <div className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Editada manualmente" />}
                </div>
              </div>
            ))}

            {/* Totalizador */}
            <div className="flex justify-between items-center px-2 pt-1 border-t border-slate-200">
              <span className="text-xs text-slate-500">Total das parcelas</span>
              <span className={`text-sm font-bold font-mono ${
                Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - totalOrcamento) < 0.02
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}>
                R$ {fmtMoeda(parcelas.reduce((s, p) => s + p.valor, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── BLOCO 5: AÇÕES ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isOrcamentoSalvo}
            onClick={handleCopiarTexto}
            title={!isOrcamentoSalvo ? "Salve o orçamento primeiro" : ""}
            className={`gap-1.5 text-slate-600 ${!isOrcamentoSalvo ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Copy className="h-4 w-4" />
            Copiar Texto
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!isOrcamentoSalvo}
            onClick={handleImprimir}
            title={!isOrcamentoSalvo ? "Salve o orçamento primeiro" : ""}
            className={`gap-1.5 text-slate-600 ${!isOrcamentoSalvo ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir
          </Button>
        </div>

        {!readOnly && (
          <Button
            size="sm"
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending}
            className={`gap-1.5 min-w-[160px] transition-colors ${salvo ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-700 hover:bg-blue-800"} text-white`}
          >
            {salvarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : salvo ? (
              <><Check className="h-4 w-4" /> Salvo!</>
            ) : (
              <><Save className="h-4 w-4" /> Salvar Orçamento</>
            )}
          </Button>
        )}
      </div>

    </div>
  );
}