import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Loader2, RefreshCw, Boxes, Phone, Layers, ShoppingBag, Clock, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────────────────────── */

type PcpStatus =
  | "organizando_pedido" | "pronto_producao" | "teste_fisico" | "preparacao"
  | "em_producao" | "embalagem_pagamento" | "aguardando_coleta" | "enviado";

type LocalProducao = "interna" | "terceirizada" | "fornecedor_para_terceirizada";

interface PcpRow {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
  pedido_cor: string | null;
  cliente: string | null;
  produto_nome: string | null;
  mockup_url: string | null;
  imagem_catalogo_url: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  status: PcpStatus;
  local_producao: LocalProducao;
  origem_estoque: "estoque" | "compra_especifica";
  data_entrega_item: string | null;
  tecnica_id: string | null;
  tecnica_nome: string | null;
  terceirizada_id: string | null;
  terceirizada_nome: string | null;
  terceirizada_telefone: string | null;
  enviado_terceiro_em: string | null;
  previsao_retorno: string | null;
  qtd_enviada: number | null;
  qtd_retornada: number | null;
  compra_confirmada_em: string | null;
  fornecedor_compra_id: string | null;
  medidas_ok: boolean | null;
  pagamento_ok: boolean | null;
  etiqueta_ok: boolean | null;
  coleta_solicitada_em: string | null;
  etapa_desde: string | null;
  horas_na_etapa: number | null;
  total_itens_pedido: number | null;
  itens_enviados_pedido: number | null;
}

interface Fornecedor {
  id: string;
  nome: string;
  tipo: string;
  telefone: string | null;
}

interface HistoricoRow {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  observacao: string | null;
  created_at: string;
}

/* ── Status columns config ──────────────────────────────────────────────── */

const STATUS_COLS: { value: PcpStatus; label: string; color: string }[] = [
  { value: "organizando_pedido",  label: "Organizando Pedido",    color: "#64748B" },
  { value: "pronto_producao",     label: "Pronto p/ Produção",    color: "#14B8A6" },
  { value: "teste_fisico",        label: "Teste Físico",          color: "#EAB308" },
  { value: "preparacao",          label: "Preparação",            color: "#F97316" },
  { value: "em_producao",         label: "Em Produção",           color: "#F97316" },
  { value: "embalagem_pagamento", label: "Embalagem & Pagamento", color: "#EAB308" },
  { value: "aguardando_coleta",   label: "Aguardando Coleta",     color: "#EAB308" },
  { value: "enviado",             label: "Enviado",               color: "#16A34A" },
];

const STATUS_MAP = Object.fromEntries(STATUS_COLS.map(c => [c.value, c])) as Record<string, typeof STATUS_COLS[number]>;

const TERCEIRIZADA_TRIGGER: LocalProducao[] = ["terceirizada", "fornecedor_para_terceirizada"];

/* Paleta estável por pedido (faixa de identificação) */
const PEDIDO_PALETTE = [
  "#2563EB", "#F97316", "#14B8A6", "#A855F7", "#EAB308",
  "#EC4899", "#0EA5E9", "#16A34A", "#F43F5E", "#8B5CF6",
];

const corDoPedido = (row: PcpRow) => {
  if (row.pedido_cor) return row.pedido_cor;
  const key = row.pedido_numero || row.pedido_id || "";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PEDIDO_PALETTE[h % PEDIDO_PALETTE.length];
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const prazoInfo = (dataStr: string | null) => {
  if (!dataStr) return { label: null as string | null, tone: "text-muted-foreground" };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataStr}T00:00:00`);
  const diffDias = Math.round((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return { label: `${Math.abs(diffDias)}d atrasado`, tone: "text-red-600" };
  if (diffDias <= 2) return { label: diffDias === 0 ? "Entrega hoje" : `${diffDias}d p/ entrega`, tone: "text-orange-600" };
  return { label: `${diffDias}d p/ entrega`, tone: "text-muted-foreground" };
};

const formatDate = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : null;
const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const tempoNaEtapa = (horas: number | null) => {
  if (horas == null) return null;
  if (horas < 1) return "menos de 1h nesta etapa";
  if (horas < 24) return `${Math.floor(horas)}h nesta etapa`;
  return `${Math.floor(horas / 24)}d nesta etapa`;
};

function StatusPill({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_MAP[status];
  if (!cfg) return null;
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white", className)}
      style={{ backgroundColor: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */

function PcpCard({
  row, indice, total, dragging, saving, onDragStart, onDragEnd, onOpen,
}: {
  row: PcpRow;
  indice: number;
  total: number;
  dragging: boolean;
  saving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const foto = row.mockup_url || row.imagem_catalogo_url;
  const cor = corDoPedido(row);
  const tempo = tempoNaEtapa(row.horas_na_etapa);
  const prazo = prazoInfo(row.data_entrega_item);

  return (
    <div
      draggable={!saving}
      onDragStart={e => {
        e.dataTransfer.setData("text/plain", row.producao_id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "group bg-card border border-border rounded-xl overflow-hidden cursor-pointer select-none",
        "shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_8px_20px_rgba(15,42,92,0.12)] transition-shadow",
        dragging && "opacity-40",
        saving && "opacity-60 pointer-events-none"
      )}
    >
      {foto ? (
        <img src={foto} alt="" className="w-full h-[180px] object-cover bg-white" />
      ) : (
        <div className="w-full h-[180px] bg-muted flex items-center justify-center">
          <Package className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <div className="h-[5px] w-full" style={{ backgroundColor: cor }} />

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-num text-[13px]">{row.pedido_numero}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            Item {indice}/{total}
          </span>
        </div>

        <p className="text-[13px] font-title truncate">{row.produto_nome || "—"}</p>

        <p className="text-[26px] leading-none font-title text-foreground">
          {row.quantidade ?? 0}
          <span className="text-[12px] font-normal text-muted-foreground ml-1">un</span>
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {row.tecnica_nome && (
            <span className="text-[10px] font-medium border border-border text-muted-foreground rounded-md px-1.5 py-0.5">
              {row.tecnica_nome}
            </span>
          )}
          <span className="text-[10px] font-medium border border-border text-muted-foreground rounded-md px-1.5 py-0.5">
            {row.origem_estoque === "estoque" ? "Em estoque" : "Compra específica"}
          </span>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {tempo || "—"}
          </span>
          {prazo.label && <span className={cn("text-[10px] font-medium", prazo.tone)}>{prazo.label}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Página ──────────────────────────────────────────────────────────────── */

export default function PCP() {
  const [rows, setRows] = useState<PcpRow[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PcpStatus | null>(null);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);

  const [terceiroModal, setTerceiroModal] = useState<{ row: PcpRow } | null>(null);
  const [modalFornecedorId, setModalFornecedorId] = useState("");
  const [modalQtdEnviada, setModalQtdEnviada] = useState("");
  const [modalPrevisao, setModalPrevisao] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("vw_pcp" as any)
      .select("*")
      .order("data_entrega_item", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("[PCP] carregar itens falhou:", error);
      toast.error(`Não foi possível carregar o PCP. ${error.message || ""}`);
      return;
    }
    setRows((data as any as PcpRow[]) ?? []);
  };

  const loadFornecedores = async () => {
    const { data, error } = await supabase
      .from("sistema_fornecedores")
      .select("id, nome, tipo, telefone")
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("[PCP] carregar fornecedores falhou:", error);
      return;
    }
    setFornecedores(data ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadItems(), loadFornecedores()]);
      setLoading(false);
    })();
  }, []);

  const byStatus = useMemo(() => {
    const map: Record<string, PcpRow[]> = {};
    for (const col of STATUS_COLS) map[col.value] = [];
    for (const row of rows) (map[row.status] ??= []).push(row);
    return map;
  }, [rows]);

  /* Índice do item dentro do pedido (Item n/total) */
  const indices = useMemo(() => {
    const grupos: Record<string, string[]> = {};
    for (const r of [...rows].sort((a, b) => a.producao_id.localeCompare(b.producao_id))) {
      (grupos[r.pedido_id] ??= []).push(r.producao_id);
    }
    const map: Record<string, { i: number; total: number }> = {};
    for (const r of rows) {
      const lista = grupos[r.pedido_id] || [];
      map[r.producao_id] = {
        i: lista.indexOf(r.producao_id) + 1,
        total: r.total_itens_pedido ?? lista.length,
      };
    }
    return map;
  }, [rows]);

  const terceirizadas = useMemo(
    () => fornecedores.filter(f => f.tipo === "terceirizada" || f.tipo === "ambos"),
    [fornecedores]
  );

  const detalhe = useMemo(
    () => rows.find(r => r.producao_id === detalheId) ?? null,
    [rows, detalheId]
  );

  useEffect(() => {
    if (!detalheId) { setHistorico([]); return; }
    (async () => {
      const { data } = await supabase
        .from("sistema_producao_historico")
        .select("id, status_anterior, status_novo, observacao, created_at")
        .eq("producao_item_id", detalheId)
        .order("created_at", { ascending: false });
      setHistorico((data as any as HistoricoRow[]) ?? []);
    })();
  }, [detalheId]);

  const applyUpdate = async (producaoId: string, patch: Record<string, any>) => {
    setSavingId(producaoId);
    setRows(prev => prev.map(r => (r.producao_id === producaoId ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("sistema_producao_itens" as any).update(patch).eq("id", producaoId);
    setSavingId(null);
    if (error) {
      console.error("[PCP] atualizar item falhou:", error);
      toast.error(`Não foi possível salvar. ${error.message || ""}`);
      await loadItems();
    }
  };

  const openTerceiroModal = (row: PcpRow) => {
    setTerceiroModal({ row });
    setModalFornecedorId(row.terceirizada_id || "");
    setModalQtdEnviada(String(row.quantidade ?? ""));
    setModalPrevisao(row.previsao_retorno || "");
  };

  const handleDrop = (targetStatus: PcpStatus, id: string) => {
    setDragOverStatus(null);
    setDraggingId(null);
    if (!id) return;
    const row = rows.find(r => r.producao_id === id);
    if (!row || row.status === targetStatus) return;

    // Preparação: se a etapa é feita por terceirizada (ou fornecedor->terceirizada),
    // pede os dados do envio antes de mover. Se for interna, entra direto (vetorização própria).
    if (targetStatus === "preparacao" && TERCEIRIZADA_TRIGGER.includes(row.local_producao)) {
      openTerceiroModal(row);
      return;
    }

    applyUpdate(id, { status: targetStatus });
  };

  const confirmEnvioTerceiro = async () => {
    if (!terceiroModal) return;
    if (!modalFornecedorId) {
      toast.error("Selecione a terceirizada");
      return;
    }
    setModalSaving(true);
    await applyUpdate(terceiroModal.row.producao_id, {
      status: "preparacao",
      terceirizada_id: modalFornecedorId,
      qtd_enviada: modalQtdEnviada ? Number(modalQtdEnviada) : null,
      previsao_retorno: modalPrevisao || null,
      enviado_terceiro_em: new Date().toISOString(),
    });
    setModalSaving(false);
    setTerceiroModal(null);
  };

  const totalItens = rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">PCP — Produção</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe cada item de pedido pelo fluxo de produção. Arraste os cards entre as colunas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalItens} item(ns)</span>
          <Button variant="outline" size="sm" onClick={() => loadItems()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center text-muted-foreground gap-2 py-24">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando PCP...
        </div>
      ) : totalItens === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Boxes className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">Nenhum item de produção encontrado.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-scroll overflow-y-hidden pb-3 pcp-scroll">
          <div className="flex gap-3 items-start w-max pb-2">
            {STATUS_COLS.map(col => {
              const items = byStatus[col.value] || [];
              const somaQtd = items.reduce((s, r) => s + Number(r.quantidade ?? 0), 0);
              const isOver = dragOverStatus === col.value;
              return (
                <div
                  key={col.value}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(col.value); }}
                  onDragLeave={() => setDragOverStatus(prev => (prev === col.value ? null : prev))}
                  onDrop={e => {
                    e.preventDefault();
                    handleDrop(col.value, e.dataTransfer.getData("text/plain"));
                  }}
                  className={cn(
                    "w-[280px] shrink-0 rounded-xl border bg-white/60 transition-colors max-h-[calc(100vh-230px)] flex flex-col",
                    isOver ? "border-[#2563EB] bg-[#2563EB]/5" : "border-border"
                  )}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-t-xl text-white sticky top-0 z-10"
                    style={{ backgroundColor: col.color }}
                  >
                    <span className="text-xs font-title truncate">{col.label}</span>
                    <span className="text-[10px] font-semibold bg-white/25 rounded-full px-2 py-0.5 shrink-0">
                      {items.length} · {somaQtd} un
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px] overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="text-center text-[11px] text-muted-foreground/60 py-6">Vazio</div>
                    ) : items.map(row => (
                      <PcpCard
                        key={row.producao_id}
                        row={row}
                        indice={indices[row.producao_id]?.i ?? 1}
                        total={indices[row.producao_id]?.total ?? 1}
                        dragging={draggingId === row.producao_id}
                        saving={savingId === row.producao_id}
                        onDragStart={() => setDraggingId(row.producao_id)}
                        onDragEnd={() => setDraggingId(null)}
                        onOpen={() => setDetalheId(row.producao_id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal grande de detalhe do item */}
      <Dialog open={!!detalhe} onOpenChange={open => !open && setDetalheId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 pr-6">
                  <span className="font-mono-num text-xl">{detalhe.pedido_numero}</span>
                  <span className="font-title truncate">{detalhe.cliente || "—"}</span>
                  <StatusPill status={detalhe.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  {detalhe.mockup_url || detalhe.imagem_catalogo_url ? (
                    <img
                      src={detalhe.mockup_url || detalhe.imagem_catalogo_url!}
                      alt={detalhe.produto_nome || ""}
                      className="w-full h-[400px] object-contain bg-white rounded-xl border border-border"
                    />
                  ) : (
                    <div className="w-full h-[400px] rounded-xl bg-muted flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="mt-3 h-[6px] rounded-full" style={{ backgroundColor: corDoPedido(detalhe) }} />
                </div>

                <div className="space-y-4">
                  <div>
                    <h2 className="text-foreground">{detalhe.produto_nome || "—"}</h2>
                    <p className="text-3xl font-title mt-1">
                      {detalhe.quantidade ?? 0}
                      <span className="text-sm font-normal text-muted-foreground ml-1">unidades</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["TÉCNICA", detalhe.tecnica_nome || "—"],
                      ["LOCAL DE PRODUÇÃO", detalhe.local_producao.replace(/_/g, " ")],
                      ["ENTREGA DO ITEM", formatDate(detalhe.data_entrega_item) || "—"],
                      ["TEMPO NA ETAPA", tempoNaEtapa(detalhe.horas_na_etapa) || "—"],
                      ["TERCEIRIZADA", detalhe.terceirizada_nome || "—"],
                      ["PREVISÃO DE RETORNO", formatDate(detalhe.previsao_retorno) || "—"],
                      ["QTD ENVIADA", detalhe.qtd_enviada ?? "—"],
                      ["QTD RETORNADA", detalhe.qtd_retornada ?? "—"],
                    ].map(([k, v]) => (
                      <div key={k as string} className="bg-muted/60 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">{k}</p>
                        <p className="text-sm text-foreground truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Origem do estoque</Label>
                    <Select
                      value={detalhe.origem_estoque}
                      onValueChange={v => applyUpdate(detalhe.producao_id, { origem_estoque: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estoque">Em estoque</SelectItem>
                        <SelectItem value="compra_especifica">Compra específica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Checklist de embalagem</Label>
                    <div className="flex flex-wrap gap-3">
                      {([
                        ["medidas_ok", "Medidas"],
                        ["pagamento_ok", "Pagamento"],
                        ["etiqueta_ok", "Etiqueta"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#2563EB]"
                            checked={!!detalhe[key]}
                            onChange={e => applyUpdate(detalhe.producao_id, { [key]: e.target.checked })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {TERCEIRIZADA_TRIGGER.includes(detalhe.local_producao) && (
                    <Button variant="outline" size="sm" onClick={() => { setDetalheId(null); openTerceiroModal(detalhe); }}>
                      <ShoppingBag className="h-4 w-4 mr-2" /> Dados da terceirizada
                    </Button>
                  )}

                  <div>
                    <p className="text-sm font-title flex items-center gap-2 mb-2">
                      <History className="h-4 w-4" /> Histórico de status
                    </p>
                    {historico.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem histórico registrado.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-[180px] overflow-y-auto">
                        {historico.map(h => (
                          <li key={h.id} className="text-xs flex items-center gap-2">
                            <span className="text-muted-foreground shrink-0">{formatDateTime(h.created_at)}</span>
                            <StatusPill status={h.status_novo} />
                            {h.observacao && <span className="text-muted-foreground truncate">{h.observacao}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: enviar para terceirizada (só quando a etapa "Preparação" é feita por terceiro) */}
      <Dialog open={!!terceiroModal} onOpenChange={open => !open && setTerceiroModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Enviar para terceirizada
            </DialogTitle>
          </DialogHeader>

          {terceiroModal && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{terceiroModal.row.produto_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {terceiroModal.row.pedido_numero} · {terceiroModal.row.cliente}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Terceirizada</Label>
                <Select value={modalFornecedorId} onValueChange={setModalFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a terceirizada" />
                  </SelectTrigger>
                  <SelectContent>
                    {terceirizadas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma terceirizada cadastrada
                      </div>
                    ) : terceirizadas.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          {f.nome}
                          {f.telefone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {f.telefone}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantidade enviada</Label>
                  <Input
                    type="number"
                    min={0}
                    value={modalQtdEnviada}
                    onChange={e => setModalQtdEnviada(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de retorno</Label>
                  <Input
                    type="date"
                    value={modalPrevisao}
                    onChange={e => setModalPrevisao(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTerceiroModal(null)} disabled={modalSaving}>
              Cancelar
            </Button>
            <Button onClick={confirmEnvioTerceiro} disabled={modalSaving}>
              {modalSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
