import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Loader2, RefreshCw, Boxes, Phone, Layers, ShoppingBag, Clock, History,
  Tag, X, MessageSquare, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { cn } from "@/lib/utils";
import { Money } from "@/components/sistema/ui/Money";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";


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
  pagamento_cartao_conferido_em: string | null;
  pix_recebido_integral_em: string | null;
  pagamento_nome: string | null;
  pedido_total: number | null;
  etapa_desde: string | null;
  horas_na_etapa: number | null;
  total_itens_pedido: number | null;
  itens_enviados_pedido: number | null;
  item_observacao: string | null;
  pedido_observacoes: string | null;
  tags: string[] | null;
}

interface ComentarioRow {
  id: string;
  mensagem: string;
  autor_email: string | null;
  created_at: string;
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
  usuario_id: string | null;
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

const tempoNaEtapaCurto = (horas: number | null) => {
  if (horas == null) return null;
  if (horas < 1) return "<1h";
  if (horas < 24) return `${Math.floor(horas)}h`;
  return `${Math.floor(horas / 24)}d`;
};

/* Limite (em horas) de permanência aceitável em cada etapa */
const LIMITE_ETAPA: Record<PcpStatus, number> = {
  organizando_pedido: 48,
  pronto_producao: 48,
  teste_fisico: 48,
  preparacao: 72,
  em_producao: 120,
  embalagem_pagamento: 48,
  aguardando_coleta: 48,
  enviado: 10000,
};

/* ── Gates de pagamento ──────────────────────────────────────────────────── */

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const isPagamentoCartao = (nome: string | null | undefined) => {
  if (!nome) return false;
  const n = semAcento(nome);
  return n.includes("cartao") || n.includes("credito");
};

const isPagamentoPix = (nome: string | null | undefined) =>
  !!nome && semAcento(nome).includes("pix");

const ORDEM_STATUS = STATUS_COLS.map(c => c.value);
const idxStatus = (s: PcpStatus) => ORDEM_STATUS.indexOf(s);

const precisaGateCartao = (row: PcpRow) =>
  isPagamentoCartao(row.pagamento_nome) && !row.pagamento_cartao_conferido_em;

const precisaGatePix = (row: PcpRow) =>
  isPagamentoPix(row.pagamento_nome) && !row.pix_recebido_integral_em;

const pagamentoGateOk = (row: PcpRow) => {
  if (isPagamentoCartao(row.pagamento_nome)) return !!row.pagamento_cartao_conferido_em;
  if (isPagamentoPix(row.pagamento_nome)) return !!row.pix_recebido_integral_em;
  return false;
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
/* Dimensões 1,7x maiores que a versão anterior (268 → 456px). */

function PcpCard({
  row, indice, total, dragging, saving, atrasado, highlight,
  onDragStart, onDragEnd, onOpen, onHover,
}: {
  row: PcpRow;
  indice: number;
  total: number;
  dragging: boolean;
  saving: boolean;
  atrasado: boolean;
  highlight: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onHover: (pedidoId: string | null) => void;
}) {
  const foto = row.mockup_url || row.imagem_catalogo_url;
  const cor = corDoPedido(row);
  const tempo = tempoNaEtapaCurto(row.horas_na_etapa);
  const tags = row.tags ?? [];

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
      onMouseEnter={() => onHover(row.pedido_id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "w-[456px] rounded-[12px] overflow-hidden cursor-pointer select-none bg-[var(--gw-surface)]",
        "border border-[var(--gw-border)] transition-shadow hover:shadow-[var(--gw-shadow-md)]",
        dragging && "opacity-40",
        saving && "opacity-60 pointer-events-none"
      )}
      style={{
        boxShadow: atrasado
          ? "0 0 0 2px var(--gw-danger)"
          : highlight
            ? `0 0 0 2px ${cor}`
            : undefined,
      }}
    >
      {/* Camada 1 — foto */}
      <div className="relative h-[286px] w-full">
        {foto ? (
          <img src={sizedImage(foto, 640)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover bg-white" />
        ) : (
          <div className="w-full h-full bg-[var(--gw-surface-alt)] flex items-center justify-center">
            <Package className="h-12 w-12 text-[var(--gw-text-muted)]" />
          </div>
        )}

        {/* gradiente inferior */}
        <div
          className="absolute inset-x-0 bottom-0 h-[92px] pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(11,18,32,0), rgba(11,18,32,.75))" }}
        />

        {/* etiquetas */}
        {tags.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[62%]">
            {tags.slice(0, 3).map(t => (
              <span
                key={t}
                className="gw-body text-white text-[12px] font-semibold rounded-[6px] px-2.5 py-[4px] truncate"
                style={{ backgroundColor: "rgba(37,99,235,.88)", backdropFilter: "blur(8px)" }}
              >
                {t}
              </span>
            ))}
            {tags.length > 3 && (
              <span
                className="gw-body text-white text-[12px] font-semibold rounded-[6px] px-2 py-[4px]"
                style={{ backgroundColor: "rgba(11,18,32,.72)", backdropFilter: "blur(8px)" }}
              >
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* técnica */}
        {row.tecnica_nome && (
          <span
            className="gw-body absolute top-2.5 right-2.5 text-white text-[12px] font-semibold rounded-[6px] px-2.5 py-[4px] max-w-[170px] truncate"
            style={{ backgroundColor: "rgba(11,18,32,.72)", backdropFilter: "blur(8px)" }}
          >
            {row.tecnica_nome}
          </span>
        )}

        {/* alerta de pagamento */}
        {(precisaGateCartao(row) ||
          (row.status === "embalagem_pagamento" && precisaGatePix(row))) && (
          <span
            className="gw-body absolute right-3 bottom-[52px] text-white text-[12px] font-bold uppercase rounded-[6px] px-2.5 py-[4px]"
            style={{ backgroundColor: "var(--gw-warning)" }}
          >
            {precisaGateCartao(row) ? "Conferir Stone" : "Aguarda PIX"}
          </span>
        )}

        {/* quantidade */}
        <span className="absolute bottom-2.5 right-3 flex items-baseline gap-1.5 text-white">
          <span className="gw-num text-[32px] leading-none" style={{ fontWeight: 700 }}>
            {row.quantidade ?? 0}
          </span>
          <span className="gw-body text-[14px] font-medium text-white/80">un</span>
        </span>

        {/* tempo na etapa */}
        <span
          className="gw-body absolute bottom-3.5 left-3 flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: atrasado ? "var(--gw-danger)" : "#FFFFFF" }}
        >
          <Clock className="h-[14px] w-[14px]" /> {tempo || "—"}
        </span>
      </div>

      {/* Camada 2 — rodapé */}
      <div className="relative h-[63px] bg-[var(--gw-surface)] flex items-center gap-2 pl-5 pr-3 whitespace-nowrap">
        <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: cor }} />
        <OrderNumber value={row.pedido_numero} className="text-[17px]" />
        <span className="text-[var(--gw-text-muted)] text-[14px]">·</span>
        <span className="gw-body text-[14px] font-medium text-[var(--gw-text-secondary)]">
          Item {indice}/{total}
        </span>
      </div>
    </div>
  );
}



/* ── Página ──────────────────────────────────────────────────────────────── */

export default function PCP() {
  const [rows, setRows] = useState<PcpRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PcpStatus | null>(null);
  const [hoverPedido, setHoverPedido] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  /* Shift+scroll e arrastar-para-rolar (botão do meio ou esquerdo em área vazia) */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    let panning = false;
    let startX = 0;
    let startScroll = 0;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      /* Botão esquerdo só rola quando o clique NÃO é em um card (o card tem drag-and-drop próprio) */
      const emCard = !!target?.closest("[draggable='true']");
      if (e.button !== 1 && !(e.button === 0 && !emCard)) return;
      if (e.button === 1) e.preventDefault();
      panning = true;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!panning) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => { panning = false; el.style.cursor = ""; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rows.length]);



  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);

  const [terceiroModal, setTerceiroModal] = useState<{ row: PcpRow } | null>(null);
  const [modalFornecedorId, setModalFornecedorId] = useState("");
  const [modalQtdEnviada, setModalQtdEnviada] = useState("");
  const [modalPrevisao, setModalPrevisao] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const [gateModal, setGateModal] = useState<{ row: PcpRow; target: PcpStatus; tipo: "cartao" | "pix" } | null>(null);
  const [gateSaving, setGateSaving] = useState(false);

  /* Dados cacheados (60s): voltar ao PCP mostra o quadro na hora e revalida em 2º plano */
  const pcpQuery = useQuery<PcpRow[]>({
    queryKey: ["sistema", "pcp", "rows"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_pcp" as any)
        .select("*")
        .order("data_entrega_item", { ascending: true, nullsFirst: false });
      if (error) {
        console.error("[PCP] carregar itens falhou:", error);
        toast.error(`Não foi possível carregar o PCP. ${error.message || ""}`);
        throw error;
      }
      return (data as any as PcpRow[]) ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ["sistema", "pcp", "fornecedores"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sistema_fornecedores")
        .select("id, nome, tipo, telefone")
        .eq("ativo", true)
        .order("nome");
      if (error) {
        console.error("[PCP] carregar fornecedores falhou:", error);
        return [];
      }
      return (data ?? []) as Fornecedor[];
    },
  });

  useEffect(() => {
    if (pcpQuery.data) setRows(pcpQuery.data);
  }, [pcpQuery.data]);

  const loadItems = async () => {
    const res = await pcpQuery.refetch();
    if (res.data) setRows(res.data);
  };

  // Loading só quando não há nada em cache para mostrar
  const loading = pcpQuery.isLoading && rows.length === 0;

  const todasTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const t of r.tags ?? []) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const rowsFiltradas = useMemo(() => {
    if (tagsFiltro.length === 0) return rows;
    return rows.filter(r => tagsFiltro.every(t => (r.tags ?? []).includes(t)));
  }, [rows, tagsFiltro]);

  const byStatus = useMemo(() => {
    const map: Record<string, PcpRow[]> = {};
    for (const col of STATUS_COLS) map[col.value] = [];
    for (const row of rowsFiltradas) (map[row.status] ??= []).push(row);
    return map;
  }, [rowsFiltradas]);


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
        .select("id, status_anterior, status_novo, usuario_id, observacao, created_at")
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

  /* Grava o gate de pagamento para todos os itens do pedido */
  const gravarGatePedido = async (pedidoId: string, campo: "pagamento_cartao_conferido_em" | "pix_recebido_integral_em") => {
    const agora = new Date().toISOString();
    const patch = { [campo]: agora, pagamento_ok: true };
    setRows(prev => prev.map(r => (r.pedido_id === pedidoId ? { ...r, ...patch } : r)));
    const { error } = await supabase
      .from("sistema_producao_itens" as any)
      .update(patch)
      .eq("pedido_id", pedidoId);
    if (error) {
      console.error("[PCP] gravar gate de pagamento falhou:", error);
      toast.error(`Não foi possível registrar a confirmação. ${error.message || ""}`);
      await loadItems();
      return false;
    }
    return true;
  };

  const moverItem = (row: PcpRow, targetStatus: PcpStatus) => {
    if (targetStatus === "preparacao" && TERCEIRIZADA_TRIGGER.includes(row.local_producao)) {
      openTerceiroModal(row);
      return;
    }
    applyUpdate(row.producao_id, { status: targetStatus });
  };

  const handleDrop = (targetStatus: PcpStatus, id: string) => {
    setDragOverStatus(null);
    setDraggingId(null);
    if (!id) return;
    const row = rows.find(r => r.producao_id === id);
    if (!row || row.status === targetStatus) return;

    // Gate de cartão: sair de "Pronto p/ Produção" para qualquer etapa seguinte
    if (
      row.status === "pronto_producao" &&
      idxStatus(targetStatus) > idxStatus("pronto_producao") &&
      precisaGateCartao(row)
    ) {
      setGateModal({ row, target: targetStatus, tipo: "cartao" });
      return;
    }

    // Gate de PIX: entrar em "Aguardando Coleta"
    if (targetStatus === "aguardando_coleta" && precisaGatePix(row)) {
      setGateModal({ row, target: targetStatus, tipo: "pix" });
      return;
    }

    moverItem(row, targetStatus);
  };

  const confirmarGate = async () => {
    if (!gateModal) return;
    setGateSaving(true);
    const campo = gateModal.tipo === "cartao" ? "pagamento_cartao_conferido_em" : "pix_recebido_integral_em";
    const ok = await gravarGatePedido(gateModal.row.pedido_id, campo);
    setGateSaving(false);
    if (!ok) { setGateModal(null); return; }
    const alvo = gateModal;
    setGateModal(null);
    moverItem(alvo.row, alvo.target);
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
    <div className="space-y-4 min-w-0">
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
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map(c => (
            <div key={c} className="w-[268px] shrink-0 space-y-3">
              <div className="animate-pulse h-8 rounded-lg bg-muted" />
              {[0, 1].map(i => (
                <div key={i} className="animate-pulse rounded-xl bg-muted" style={{ height: 205 }} />
              ))}
            </div>
          ))}
        </div>
      ) : totalItens === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Boxes className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">Nenhum item de produção encontrado.</p>
        </div>
      ) : (
        <div
          ref={boardRef}
          className="w-full pcp-scroll"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            width: "100%",
            paddingBottom: 12,
            /* Altura fixa do quadro: as colunas nunca empurram a barra para fora da tela */
            height: "calc(100vh - 220px)",
            minHeight: 480,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "stretch",
              width: "max-content",
              height: "100%",
            }}
          >

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
                  style={{ width: 300, flexShrink: 0, height: "100%" }}
                  className={cn(
                    "rounded-xl border transition-colors flex flex-col overflow-hidden",
                    isOver ? "border-[#2563EB] bg-[#2563EB]/5" : "border-[var(--gw-border)] bg-white/60"
                  )}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2.5 text-white shrink-0"
                    style={{ backgroundColor: col.color }}
                  >
                    <span className="text-[13px] font-bold truncate">{col.label}</span>
                    <span
                      className="text-[11px] font-semibold text-white rounded-full px-2 py-0.5 shrink-0"
                      style={{ backgroundColor: "rgba(255,255,255,.22)" }}
                    >
                      {items.length} · {somaQtd}un
                    </span>
                  </div>
                  {/* Rolagem vertical acontece por coluna */}
                  <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto pcp-col-scroll">

                    {items.length === 0 ? (
                      <div className="h-[96px] rounded-lg border border-dashed border-[var(--gw-border)] flex items-center justify-center gw-meta text-[11px] text-[var(--gw-text-muted)]">
                        Sem itens nesta etapa
                      </div>
                    ) : items.map(row => (
                      <PcpCard
                        key={row.producao_id}
                        row={row}
                        indice={indices[row.producao_id]?.i ?? 1}
                        total={indices[row.producao_id]?.total ?? 1}
                        dragging={draggingId === row.producao_id}
                        saving={savingId === row.producao_id}
                        atrasado={(row.horas_na_etapa ?? 0) > (LIMITE_ETAPA[row.status] ?? 9999)}
                        highlight={!!hoverPedido && hoverPedido === row.pedido_id}
                        onHover={setHoverPedido}
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

      {/* Modal de detalhe do item */}
      <Dialog open={!!detalhe} onOpenChange={open => !open && setDetalheId(null)}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden rounded-[10px] border-[var(--gw-border)]"
          style={{ maxWidth: 880, width: "94vw", maxHeight: "88vh", boxShadow: "var(--gw-shadow-lg)" }}
        >
          {detalhe && (
            <div className="grid md:grid-cols-[400px_1fr] max-h-[88vh]">
              {/* Coluna esquerda — imagens */}
              <div className="bg-[var(--gw-surface-alt)] p-4 overflow-y-auto">
                {detalhe.mockup_url || detalhe.imagem_catalogo_url ? (
                  <>
                    <img
                      src={sizedImage(detalhe.mockup_url || detalhe.imagem_catalogo_url!, 800)}
                      alt={detalhe.produto_nome || ""}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-[360px] object-contain bg-white rounded-lg border border-[var(--gw-border)]"
                    />
                    <a
                      href={detalhe.mockup_url || detalhe.imagem_catalogo_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[12px] font-medium text-[var(--gw-primary)] hover:underline"
                    >
                      Abrir imagem em tamanho original
                    </a>
                  </>
                ) : (
                  <div className="w-full h-[360px] rounded-lg bg-white border border-[var(--gw-border)] flex items-center justify-center">
                    <Package className="h-10 w-10 text-[var(--gw-text-muted)]" />
                  </div>
                )}

                {detalhe.mockup_url && detalhe.imagem_catalogo_url &&
                  detalhe.imagem_catalogo_url !== detalhe.mockup_url && (
                    <div className="mt-4">
                      <p className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)] mb-1">
                        Foto de catálogo
                      </p>
                      <img
                        src={sizedImage(detalhe.imagem_catalogo_url, 320)}
                        alt=""
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        className="w-[96px] h-[96px] object-contain bg-white rounded-lg border border-[var(--gw-border)]"
                      />
                    </div>
                  )}
              </div>

              {/* Coluna direita — dados */}
              <div className="overflow-y-auto">
                <DialogHeader className="px-5 py-4 border-b border-[var(--gw-border)] space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-3 pr-8 text-left">
                    <span
                      className="text-[15px] font-semibold text-[var(--gw-text)]"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {detalhe.pedido_numero}
                    </span>
                    <span className="text-[15px] font-bold truncate">{detalhe.cliente || "—"}</span>
                    <StatusPill status={detalhe.status} />
                  </DialogTitle>
                </DialogHeader>

                {/* Produto */}
                <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                  <p className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)]">Produto</p>
                  <p className="text-[15px] font-bold text-[var(--gw-text)]">{detalhe.produto_nome || "—"}</p>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {[
                      ["Quantidade", `${detalhe.quantidade ?? 0} un`],
                      ["Valor unitário", detalhe.valor_unitario != null
                        ? detalhe.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"],
                      ["Total", detalhe.valor_unitario != null
                        ? (detalhe.valor_unitario * (detalhe.quantidade ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] font-semibold uppercase text-[var(--gw-text-muted)]">{k}</p>
                        <p className="text-[13px] text-[var(--gw-text)]">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Produção */}
                <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-3">
                  <p className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)]">Produção</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Técnica", detalhe.tecnica_nome || "—"],
                      ["Local de produção", detalhe.local_producao.replace(/_/g, " ")],
                      ...(detalhe.terceirizada_nome ? [["Terceirizada", detalhe.terceirizada_nome]] : []),
                      ...(detalhe.previsao_retorno ? [["Previsão de retorno", formatDate(detalhe.previsao_retorno) || "—"]] : []),
                      ["Produzir até", formatDate(detalhe.data_entrega_item) || "—"],
                      ["Despachar até", formatDate(detalhe.data_entrega_item) || "—"],
                      ["Tempo na etapa", tempoNaEtapa(detalhe.horas_na_etapa) || "—"],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <p className="text-[10px] font-semibold uppercase text-[var(--gw-text-muted)]">{k}</p>
                        <p className="text-[13px] text-[var(--gw-text)] capitalize truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[10px] font-semibold uppercase text-[var(--gw-text-muted)]">
                      Origem do estoque
                    </Label>
                    <Select
                      value={detalhe.origem_estoque}
                      onValueChange={v => applyUpdate(detalhe.producao_id, { origem_estoque: v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estoque">Em estoque</SelectItem>
                        <SelectItem value="compra_especifica">Compra específica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {TERCEIRIZADA_TRIGGER.includes(detalhe.local_producao) && (
                    <Button variant="outline" size="sm" onClick={() => { setDetalheId(null); openTerceiroModal(detalhe); }}>
                      <ShoppingBag className="h-4 w-4 mr-2" /> Dados da terceirizada
                    </Button>
                  )}
                </div>

                {/* Checklist */}
                {detalhe.status === "embalagem_pagamento" && (
                  <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                    <p className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)]">Checklist</p>
                    <div className="flex flex-wrap gap-4">
                      {([
                        ["medidas_ok", "Medidas"],
                        ["pagamento_ok", "Pagamento"],
                        ["etiqueta_ok", "Etiqueta"],
                      ] as const).map(([key, label]) => {
                        const auto = key === "pagamento_ok" && pagamentoGateOk(detalhe);
                        return (
                          <label key={key} className="flex items-center gap-2 text-[13px]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#2563EB]"
                              checked={!!detalhe[key] || auto}
                              disabled={auto}
                              onChange={e => applyUpdate(detalhe.producao_id, { [key]: e.target.checked })}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Histórico */}
                <div className="px-5 py-4">
                  <p className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)] flex items-center gap-2 mb-3">
                    <History className="h-3.5 w-3.5" /> Histórico
                  </p>
                  {historico.length === 0 ? (
                    <p className="text-[12px] text-[var(--gw-text-muted)]">Sem histórico registrado.</p>
                  ) : (
                    <ul className="space-y-3 border-l border-[var(--gw-border)] pl-4">
                      {historico.map(h => (
                        <li key={h.id} className="relative">
                          <span
                            className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATUS_MAP[h.status_novo]?.color || "var(--gw-border-strong)" }}
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusPill status={h.status_novo} />
                            <span className="text-[11px] text-[var(--gw-text-secondary)]">
                              {formatDateTime(h.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--gw-text-muted)] mt-0.5">
                            {h.usuario_id ? "Responsável: usuário do sistema" : "Responsável: sistema"}
                            {h.observacao ? ` · ${h.observacao}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
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

      {/* Gate de pagamento (cartão / PIX) */}
      <Dialog open={!!gateModal} onOpenChange={open => !open && setGateModal(null)}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader>
            <DialogTitle>
              {gateModal?.tipo === "cartao" ? "Conferiu o pagamento na Stone?" : "Recebeu 100% do valor?"}
            </DialogTitle>
          </DialogHeader>

          {gateModal && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-[var(--gw-surface-alt)] px-3 py-2.5 space-y-1">
                <p className="text-[13px] font-semibold text-[var(--gw-text)]">
                  Pedido {gateModal.row.pedido_numero}
                </p>
                <p className="text-[12px] text-[var(--gw-text-secondary)]">
                  {gateModal.row.cliente || "Cliente não informado"}
                </p>
                {gateModal.row.pagamento_nome && (
                  <p className="text-[11px] text-[var(--gw-text-muted)]">{gateModal.row.pagamento_nome}</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="gw-meta text-[10px] font-bold uppercase text-[var(--gw-text-muted)]">
                  Valor total
                </span>
                <Money value={Number(gateModal.row.pedido_total ?? 0)} emphasis bold />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGateModal(null)} disabled={gateSaving}>
              {gateModal?.tipo === "cartao" ? "Cancelar" : "Ainda não"}
            </Button>
            <Button
              onClick={confirmarGate}
              disabled={gateSaving}
              style={{ backgroundColor: "var(--gw-primary)", color: "#fff" }}
            >
              {gateSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {gateModal?.tipo === "cartao" ? "Sim, pagamento confirmado" : "Sim, recebi o valor integral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
