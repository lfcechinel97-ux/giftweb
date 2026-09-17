import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Loader2, RefreshCw, Boxes, Phone, Layers, ShoppingBag, Clock, History,
  Tag, X, MessageSquare, Send, Camera, Video, CheckCircle2, Upload, Download,
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
import { uploadAnexoPcp, MockupUploadError } from "@/lib/uploadMockup";
import { cn } from "@/lib/utils";
import { Money } from "@/components/sistema/ui/Money";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import { COLUNAS_PCP, corDaColuna, statusCanonicoDaColuna, colunaDoStatus, statusInfo } from "@/lib/statusPedido";
import { useSistema } from "@/contexts/SistemaContext";
import type { RealtimeChannel } from "@supabase/supabase-js";


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
  status: string;
  coluna_pcp: string | null;
  status_nome: string | null;
  status_cor: string | null;
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
  item_criado_em: string | null;
  terceirizada_nome_livre: string | null;
  teste_anexo_url: string | null;
  teste_enviado_em: string | null;
  producao_anexo_url: string | null;
  producao_anexo_tipo: "foto" | "video" | null;
  producao_anexo_em: string | null;
  itens_expedicao_pedido: number | null;
  pedido_volumes: unknown;
  pedido_pago_integral: boolean | null;
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
  producao_item_id: string;
  status_anterior: string | null;
  status_novo: string;
  usuario_id: string | null;
  vendedor_id: string | null;
  observacao: string | null;
  created_at: string;
}

/* ── Status columns config ──────────────────────────────────────────────── */

/* Colunas e cores vêm de src/lib/statusPedido.ts — mesma fonte que a lista de
   Pedidos e o Editar Pedido usam. Antes o PCP tinha paleta própria, com três
   colunas repetindo a mesma cor. */
const STATUS_COLS: { value: PcpStatus; label: string; color: string }[] =
  COLUNAS_PCP.map(c => ({
    value: c.coluna as PcpStatus,
    label: c.rotulo,
    color: corDaColuna(c.coluna),
  }));

const STATUS_MAP = Object.fromEntries(STATUS_COLS.map(c => [c.value, c])) as Record<string, typeof STATUS_COLS[number]>;

const TERCEIRIZADA_TRIGGER: LocalProducao[] = ["terceirizada", "fornecedor_para_terceirizada"];

/* Etiquetas automáticas do fluxo de teste físico. Nomes fixos de propósito
   (não são texto livre do vendedor) — o botão "Aprovar teste" procura essa
   string exata pra decidir se mostra ou não. */
const TAG_TESTE_ENVIADO = "TESTE ENVIADO";
const TAG_TESTE_APROVADO = "TESTE APROVADO";
const TAG_PRODUZIR_MIDIA = "PRODUZIR + MÍDIA";

/* "Ele também já coloca a tag de transportadora tipo: Coleta Braspress,
   Coleta Melhor Envio, Envio por Lalamove." — fixas por enquanto (as 3 que
   o usuário deu); o campo de texto livre no popup cobre o que fugir da
   lista sem exigir cadastro prévio, igual ao nome de terceirizada. */
const TRANSPORTADORA_OPCOES = ["Coleta Braspress", "Coleta Melhor Envio", "Envio por Lalamove"];

/* Paleta estável por pedido (faixa de identificação) */
const PEDIDO_PALETTE = [
  "#2563EB", "#F97316", "#14B8A6", "#A855F7", "#EAB308",
  "#EC4899", "#0EA5E9", "#16A34A", "#F43F5E", "#8B5CF6",
];

/* Paleta de etiquetas — cor viva, sólida, com texto branco. Mesmos 15 tons já
   validados em src/lib/statusPedido.ts (todos >= 4.5:1 de contraste contra
   branco), reaproveitados aqui: tag é texto livre, sem cor própria salva no
   banco, então a cor precisa ser determinística a partir do próprio texto —
   a mesma etiqueta sempre cai na mesma cor, em qualquer card. */
const TAG_PALETTE = [
  "#64748B", "#0B7CAF", "#A36907", "#9E42F6", "#C026D3", "#8452F5", "#2563EB",
  "#1D4ED8", "#0B8177", "#05875F", "#12883E", "#9D6B03", "#15803D", "#166534", "#DC2626",
];

const corDaTag = (texto: string) => {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
};

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

/* Timer 2 — desde que o item ENTROU no sistema (item_criado_em), não desde a
   última mudança de etapa. Formato "Xd Yh" quando passa de 1 dia, senão só
   horas — mais discreto que o timer de etapa, que é o que importa primeiro. */
const tempoTotalCurto = (criadoEm: string | null) => {
  if (!criadoEm) return null;
  const horas = (Date.now() - new Date(criadoEm).getTime()) / 3600000;
  if (horas < 1) return "<1h";
  if (horas < 24) return `${Math.floor(horas)}h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.floor(horas % 24);
  return resto > 0 ? `${dias}d ${resto}h` : `${dias}d`;
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


/* Bug pré-existente: usava STATUS_MAP, que só conhece as 8 COLUNAS do
   board (organizando_pedido, pronto_producao, ...). Os 3 lugares que
   chamam <StatusPill> sempre passaram um STATUS de verdade (15 valores
   possíveis no catálogo, ex.: "aguardando_mercadoria") — nunca batia com
   STATUS_MAP, então o badge nunca aparecia (renderizava null sem erro
   nenhum, por isso passou despercebido). statusInfo() resolve qualquer
   slug do catálogo, com fallback "Sem status" pro que não reconhecer. */
function StatusPill({ status, className }: { status: string | null; className?: string }) {
  if (!status) return null;
  const info = statusInfo(status);
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white", className)}
      style={{ backgroundColor: info.cor }}
    >
      {info.nome}
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
  const tempoTotal = tempoTotalCurto(row.item_criado_em);
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
                style={{ backgroundColor: corDaTag(t) }}
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
          (colunaDoStatus(row) === "embalagem_pagamento" && precisaGatePix(row))) && (
          <span
            className="gw-body absolute right-3 bottom-[52px] text-white text-[12px] font-bold uppercase rounded-[6px] px-2.5 py-[4px]"
            style={{ backgroundColor: "var(--gw-warning)" }}
          >
            {precisaGateCartao(row) ? "Conferir Stone" : "Aguarda PIX"}
          </span>
        )}

        {/* quantidade — fundo sólido de propósito: o gradiente do rodapé da
            foto nem sempre escurece o suficiente perto do canto quando a foto
            é clara ali, e "24 un" precisa ser legível sempre, não só às vezes. */}
        <span
          className="absolute bottom-2.5 right-3 flex items-baseline gap-1.5 text-white rounded-[8px] pl-2.5 pr-3 py-1"
          style={{ backgroundColor: "rgba(11,18,32,.82)", backdropFilter: "blur(8px)" }}
        >
          <span className="gw-num text-[26px] leading-none" style={{ fontWeight: 700 }}>
            {row.quantidade ?? 0}
          </span>
          <span className="gw-body text-[13px] font-medium text-white/80">un</span>
        </span>

        {/* Timer 1 (etapa atual) + Timer 2 (total desde a criação) — mesmo
            tratamento de fundo sólido da badge de quantidade: o gradiente do
            rodapé nem sempre escurece o bastante perto do canto esquerdo
            quando a foto é clara ali, e o número precisa ser legível sempre,
            não só quando a foto colabora. Timer 2 fica discreto (menor,
            opacidade reduzida) dentro do mesmo bloco — o que importa
            primeiro é quanto tempo o item está TRAVADO na etapa atual. */}
        <span
          className="absolute bottom-2.5 left-3 flex flex-col gap-0.5 rounded-[8px] px-2.5 py-1.5"
          style={{ backgroundColor: "rgba(11,18,32,.82)", backdropFilter: "blur(8px)" }}
        >
          <span
            className="gw-body flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: atrasado ? "#FF8A8A" : "#FFFFFF" }}
          >
            <Clock className="h-[14px] w-[14px]" /> {tempo || "—"}
          </span>
          {tempoTotal && (
            <span className="gw-body flex items-center gap-1.5 text-[11px] font-medium text-white/60">
              <History className="h-[11px] w-[11px]" /> {tempoTotal} no total
            </span>
          )}
        </span>
      </div>

      {/* Camada 2 — rodapé */}
      <div className="relative h-[63px] bg-[var(--gw-surface)] flex items-center gap-2 pl-5 pr-3 overflow-hidden">
        <span className="absolute left-0 top-0 bottom-0 w-[5px] shrink-0" style={{ backgroundColor: cor }} />
        <OrderNumber value={row.pedido_numero} className="text-[17px] shrink-0" />
        <span className="text-[var(--gw-text-muted)] text-[14px] shrink-0">·</span>
        <span className="gw-body text-[14px] font-medium text-[var(--gw-text-secondary)] shrink-0">
          Item {indice}/{total}
        </span>
        <span className="text-[var(--gw-text-muted)] text-[14px] shrink-0">·</span>
        <span className="gw-body text-[14px] font-semibold text-[var(--gw-text)] truncate">
          {row.produto_nome || "—"}
        </span>
      </div>
    </div>
  );
}



/* ── Página ──────────────────────────────────────────────────────────────── */

export default function PCP() {
  /* "Vendedor selecionado" é a única identidade individual que existe hoje
     — o sistema roda com um único login compartilhado (ver migration
     20260917130000). É essa identidade que carimba o histórico, não
     auth.uid(), que é sempre a mesma pessoa fisicamente logada. */
  const { vendedores, currentVendedor } = useSistema();
  const vendedorNome = (id: string | null) => vendedores.find(v => v.id === id)?.nome || null;

  const [rows, setRows] = useState<PcpRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PcpStatus | null>(null);
  const [hoverPedido, setHoverPedido] = useState<string | null>(null);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [novaTag, setNovaTag] = useState("");
  const [comentarios, setComentarios] = useState<ComentarioRow[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
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
  const [modalTerceirizadaLivre, setModalTerceirizadaLivre] = useState("");
  const [modalQtdEnviada, setModalQtdEnviada] = useState("");
  const [modalPrevisao, setModalPrevisao] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const [gateModal, setGateModal] = useState<{ row: PcpRow; target: PcpStatus; tipo: "cartao" | "pix" } | null>(null);
  const [gateSaving, setGateSaving] = useState(false);

  /* Popup de Expedição — abre quando o item arrastado fecha o conjunto
     (todos os itens do pedido chegam na coluna "aguardando_coleta" de uma
     vez). Volumes ficam no PEDIDO (sistema_pedidos.volumes), não no item:
     é a caixa física que carrega o pedido inteiro, não uma peça sozinha. */
  const [expedicaoModal, setExpedicaoModal] = useState<{ row: PcpRow; target: PcpStatus } | null>(null);
  const [expedicaoVolumes, setExpedicaoVolumes] = useState<
    { comprimento: string; altura: string; largura: string; peso: string }[]
  >([{ comprimento: "", altura: "", largura: "", peso: "" }]);
  const [expedicaoPago, setExpedicaoPago] = useState<"sim" | "nao" | null>(null);
  const [expedicaoTransportadora, setExpedicaoTransportadora] = useState("");
  const [expedicaoTransportadoraLivre, setExpedicaoTransportadoraLivre] = useState("");
  const [expedicaoSaving, setExpedicaoSaving] = useState(false);

  /* Anexos do PCP (teste físico + produção concluída) */
  const testeInputRef = useRef<HTMLInputElement | null>(null);
  const producaoAnexoInputRef = useRef<HTMLInputElement | null>(null);
  const testeAlvoRef = useRef<PcpRow | null>(null);
  const producaoAnexoAlvoRef = useRef<PcpRow | null>(null);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [enviandoProducaoAnexo, setEnviandoProducaoAnexo] = useState(false);

  /* Dados cacheados (60s): voltar ao PCP mostra o quadro na hora e revalida em 2º plano */
  const pcpQuery = useQuery<PcpRow[]>({
    queryKey: ["sistema", "pcp", "rows"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      /* Sem filtro, o board carrega TODO item de produção que já existiu,
         pra sempre — inclusive o que já foi "Coletado e enviado" há meses.
         Hoje são só 88 linhas (não dói), mas é a única query do sistema
         sem paginação nem corte, e cresce sem limite. Corta o que já saiu
         há mais de 14 dias: continua tudo visível enquanto for recente
         (times ainda quer ver o que "acabou de sair"), sem acumular pra
         sempre. Itens em qualquer OUTRA coluna sempre aparecem — só quem
         já terminou o fluxo é que expira do board. */
      const cortaEnviadoAntes = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("vw_pcp" as any)
        .select("*")
        .or(`coluna_pcp.neq.enviado,etapa_desde.gte.${cortaEnviadoAntes}`)
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

  /* ── Realtime ──────────────────────────────────────────────────────────
     Sem isto, mudar a etapa de um item numa aba só aparecia para outras
     abas/pessoas depois de um refresh manual (staleTime de 60s do React
     Query). Agora: mudança no banco -> todo mundo vê na hora, sem recarregar
     a página -- inclusive o próprio timer da nova etapa já nasce zerado.

     `sistema_producao_itens` é a tabela CRUA, não a view `vw_pcp`: o
     payload não traz produto_nome/mockup_url/cliente (esses só existem na
     view, calculados a partir do jsonb do pedido). Por isso o merge só
     atualiza os campos que existem em ambas — o resto da linha (foto, nome
     do produto, cliente) não muda quando o status muda, então não precisa
     vir de novo. */
  const detalheIdRef = useRef<string | null>(null);
  useEffect(() => { detalheIdRef.current = detalheId; }, [detalheId]);

  useEffect(() => {
    const canal: RealtimeChannel = supabase
      .channel("pcp-ao-vivo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sistema_producao_itens" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const idRemovido = (payload.old as { id?: string })?.id;
            if (idRemovido) setRows(prev => prev.filter(r => r.producao_id !== idRemovido));
            return;
          }
          const novo = payload.new as Record<string, unknown>;
          const id = novo.id as string;
          setRows(prev => {
            const existe = prev.some(r => r.producao_id === id);
            if (!existe) {
              // Item novo (pedido recém-criado): o merge não tem produto_nome
              // nem foto, que só a view resolve — busca a linha completa.
              void loadItems();
              return prev;
            }
            const statusNovo = String(novo.status ?? "");
            const info = statusInfo(statusNovo);
            return prev.map(r => (r.producao_id !== id ? r : {
              ...r,
              status: statusNovo,
              status_nome: info.nome,
              status_cor: info.cor,
              coluna_pcp: info.colunaPcp,
              local_producao: (novo.local_producao as PcpRow["local_producao"]) ?? r.local_producao,
              tags: (novo.tags as string[] | null) ?? r.tags,
              medidas_ok: (novo.medidas_ok as boolean | null) ?? r.medidas_ok,
              pagamento_ok: (novo.pagamento_ok as boolean | null) ?? r.pagamento_ok,
              etiqueta_ok: (novo.etiqueta_ok as boolean | null) ?? r.etiqueta_ok,
              terceirizada_id: (novo.terceirizada_id as string | null) ?? r.terceirizada_id,
              terceirizada_nome_livre: (novo.terceirizada_nome_livre as string | null) ?? r.terceirizada_nome_livre,
              qtd_enviada: (novo.qtd_enviada as number | null) ?? r.qtd_enviada,
              previsao_retorno: (novo.previsao_retorno as string | null) ?? r.previsao_retorno,
              teste_anexo_url: (novo.teste_anexo_url as string | null) ?? r.teste_anexo_url,
              teste_enviado_em: (novo.teste_enviado_em as string | null) ?? r.teste_enviado_em,
              producao_anexo_url: (novo.producao_anexo_url as string | null) ?? r.producao_anexo_url,
              producao_anexo_tipo: (novo.producao_anexo_tipo as PcpRow["producao_anexo_tipo"]) ?? r.producao_anexo_tipo,
              etapa_desde: statusNovo === r.status ? r.etapa_desde : new Date().toISOString(),
              horas_na_etapa: statusNovo === r.status ? r.horas_na_etapa : 0,
            }));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sistema_producao_historico" },
        (payload) => {
          const linha = payload.new as HistoricoRow;
          if (linha.producao_item_id !== detalheIdRef.current) return;
          setHistorico(prev => [linha, ...prev]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    /* Agrupa por COLUNA, não por status: status e coluna são vocabulários
       diferentes desde o catálogo editável. "conferir_pagamentos" é status e
       cai na coluna "embalagem_pagamento" — agrupar por status faria o card
       sumir do quadro. */
    for (const row of rowsFiltradas) (map[colunaDoStatus(row)] ??= []).push(row);
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
        .select("id, producao_item_id, status_anterior, status_novo, usuario_id, vendedor_id, observacao, created_at")
        .eq("producao_item_id", detalheId)
        .order("created_at", { ascending: false });
      setHistorico((data as any as HistoricoRow[]) ?? []);
    })();
  }, [detalheId]);

  const carregarComentarios = async (producaoId: string) => {
    const { data } = await supabase
      .from("sistema_producao_comentarios" as any)
      .select("id, mensagem, autor_email, created_at")
      .eq("producao_item_id", producaoId)
      .order("created_at", { ascending: true });
    setComentarios((data as any as ComentarioRow[]) ?? []);
  };

  useEffect(() => {
    setNovoComentario("");
    if (!detalheId) { setComentarios([]); return; }
    carregarComentarios(detalheId);
  }, [detalheId]);

  const enviarComentario = async () => {
    if (!detalhe) return;
    const texto = novoComentario.trim();
    if (!texto) return;
    setEnviandoComentario(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("sistema_producao_comentarios" as any).insert({
      producao_item_id: detalhe.producao_id,
      pedido_id: detalhe.pedido_id,
      mensagem: texto,
      autor_id: auth?.user?.id ?? null,
      autor_email: auth?.user?.email ?? null,
    });
    setEnviandoComentario(false);
    if (error) {
      console.error("[PCP] comentário falhou:", error);
      toast.error(`Não foi possível enviar. ${error.message || ""}`);
      return;
    }
    setNovoComentario("");
    await carregarComentarios(detalhe.producao_id);
  };

  /* Etiquetas do item */
  const salvarTags = async (row: PcpRow, tags: string[]) => {
    setRows(prev => prev.map(r => (r.producao_id === row.producao_id ? { ...r, tags } : r)));
    const { error } = await supabase
      .from("sistema_producao_itens" as any)
      .update({ tags })
      .eq("id", row.producao_id);
    if (error) {
      console.error("[PCP] salvar etiquetas falhou:", error);
      toast.error(`Não foi possível salvar as etiquetas. ${error.message || ""}`);
      await loadItems();
    }
  };

  const adicionarTag = async (row: PcpRow, valor: string) => {
    const t = valor.trim();
    if (!t) return;
    const atuais = row.tags ?? [];
    if (atuais.some(x => x.toLowerCase() === t.toLowerCase())) return;
    await salvarTags(row, [...atuais, t]);
  };

  const removerTag = async (row: PcpRow, valor: string) => {
    await salvarTags(row, (row.tags ?? []).filter(t => t !== valor));
  };

  /* ── Anexo de teste físico ────────────────────────────────────────────
     "vai ter um campo no produto escrito 'teste' onde a produção anexa a
     foto p/ vendedor baixar e mandar p cliente. nesse mesmo tempo,
     automaticamente se a produção adiciona o anexo, já adiciona a tag
     TESTE ENVIADO". Reenviar um teste novo LIMPA a aprovação anterior — faz
     sentido: se a foto mudou, a aprovação antiga não vale mais pra essa. */
  const abrirSeletorTeste = (row: PcpRow) => {
    testeAlvoRef.current = row;
    testeInputRef.current?.click();
  };

  const handleAnexoTeste = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const row = testeAlvoRef.current;
    e.target.value = "";
    if (!file || !row) return;
    setEnviandoTeste(true);
    try {
      const { url } = await uploadAnexoPcp(file, row.producao_id, "teste");
      await applyUpdate(row.producao_id, { teste_anexo_url: url, teste_enviado_em: new Date().toISOString() });
      const semAprovado = (row.tags ?? []).filter(t => t !== TAG_TESTE_APROVADO && t !== TAG_PRODUZIR_MIDIA);
      await salvarTags(row, [...new Set([...semAprovado, TAG_TESTE_ENVIADO])]);
      toast.success("Teste anexado. Baixe e mande para o cliente aprovar.");
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o anexo.");
    } finally {
      setEnviandoTeste(false);
    }
  };

  /* "se aprovado, ele altera a tag de teste enviado p/ TESTE APROVADO e
     junto também automaticamente aparece a tag PRODUZIR + MÍDIA" — ação do
     vendedor, não da produção (é ele quem sabe se o cliente aprovou). */
  const aprovarTeste = async (row: PcpRow) => {
    const outras = (row.tags ?? []).filter(t => t !== TAG_TESTE_ENVIADO);
    await salvarTags(row, [...new Set([...outras, TAG_TESTE_APROVADO, TAG_PRODUZIR_MIDIA])]);
    toast.success("Teste aprovado. A produção já vê a etiqueta de \"pode produzir\".");
  };

  /* ── Anexo de produção concluída (foto ou vídeo) ──────────────────────
     "Quando está no processo de produzir, abre um novo campo p/ anexo que
     suporte foto ou vídeo que a produção anexa do pedido 100% feito". */
  const abrirSeletorProducaoAnexo = (row: PcpRow) => {
    producaoAnexoAlvoRef.current = row;
    producaoAnexoInputRef.current?.click();
  };

  const handleAnexoProducao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const row = producaoAnexoAlvoRef.current;
    e.target.value = "";
    if (!file || !row) return;
    setEnviandoProducaoAnexo(true);
    try {
      const { url, tipo } = await uploadAnexoPcp(file, row.producao_id, "producao");
      await applyUpdate(row.producao_id, {
        producao_anexo_url: url,
        producao_anexo_tipo: tipo,
        producao_anexo_em: new Date().toISOString(),
      });
      toast.success(`${tipo === "video" ? "Vídeo" : "Foto"} anexado. Baixe e mande para o cliente.`);
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o anexo.");
    } finally {
      setEnviandoProducaoAnexo(false);
    }
  };



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
    setModalTerceirizadaLivre(row.terceirizada_nome_livre || "");
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

  /* Muda o status via RPC (não `.update()` direto): o servidor carimba o
     vendedor selecionado na MESMA linha de histórico que o gatilho acabou
     de criar, num único round-trip — sem isso haveria uma corrida entre
     "salvar o status" e "salvar quem mudou", e a mudança que já sai
     otimista na tela podia registrar o responsável errado se duas pessoas
     mexessem em itens diferentes ao mesmo tempo. */
  const mudarStatus = async (producaoId: string, status: string, observacao?: string) => {
    setSavingId(producaoId);
    setRows(prev => prev.map(r => (r.producao_id === producaoId ? { ...r, status } : r)));
    const { error } = await supabase.rpc("sistema_mudar_status_producao" as any, {
      p_producao_id: producaoId,
      p_status: status,
      p_vendedor_id: currentVendedor?.id ?? null,
      p_observacao: observacao ?? null,
    });
    setSavingId(null);
    if (error) {
      console.error("[PCP] mudar status falhou:", error);
      toast.error(`Não foi possível salvar. ${error.message || ""}`);
      await loadItems();
    }
  };

  const moverItem = (row: PcpRow, targetStatus: PcpStatus) => {
    if (targetStatus === "preparacao" && TERCEIRIZADA_TRIGGER.includes(row.local_producao)) {
      openTerceiroModal(row);
      return;
    }
    /* Grava o STATUS canônico da coluna. targetStatus é nome de coluna
       ("em_producao"); o banco espera slug de status ("a_produzir"). */
    mudarStatus(row.producao_id, statusCanonicoDaColuna(targetStatus));
  };

  const handleDrop = (targetStatus: PcpStatus, id: string) => {
    setDragOverStatus(null);
    setDraggingId(null);
    if (!id) return;
    const row = rows.find(r => r.producao_id === id);
    if (!row || colunaDoStatus(row) === targetStatus) return;

    // Gate de cartão: sair de "Pronto p/ Produção" para qualquer etapa seguinte
    if (
      colunaDoStatus(row) === "pronto_producao" &&
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

    /* "o pedido só abre o popup das medidas quando TODOS os produtos do
       pedido estão na expedição" — este item ainda não está lá (a checagem
       de coluna já passou acima), então +1 sobre o que a view já contou
       diz se ele fecha o conjunto. Se ainda falta item de fora, só move
       este, sem popup — os volumes só fazem sentido com o pacote inteiro
       reunido. */
    if (targetStatus === "aguardando_coleta") {
      const totalPedido = row.total_itens_pedido ?? 1;
      const jaNaExpedicao = row.itens_expedicao_pedido ?? 0;
      if (jaNaExpedicao + 1 >= totalPedido) {
        setExpedicaoModal({ row, target: targetStatus });
        return;
      }
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
    const fornecedor = terceirizadas.find(f => f.id === modalFornecedorId);
    const nomeLivre = modalTerceirizadaLivre.trim();
    if (!modalFornecedorId && !nomeLivre) {
      toast.error("Selecione uma terceirizada cadastrada ou digite o nome dela");
      return;
    }
    setModalSaving(true);

    /* Duas chamadas de propósito: a RPC muda o status (e carimba
       vendedor+histórico); o patch comum grava os dados da terceirizada,
       que não fazem parte do vocabulário de status.
       "preparacao" aqui é o nome da COLUNA, não um status — o valor
       gravável é o status canônico dela (statusCanonicoDaColuna). Gravar a
       string "preparacao" direto violava a FK de sistema_status; ninguém
       tinha notado porque este caminho não tinha sido testado com dado
       real ainda. */
    await mudarStatus(terceiroModal.row.producao_id, statusCanonicoDaColuna("preparacao"));
    await applyUpdate(terceiroModal.row.producao_id, {
      terceirizada_id: modalFornecedorId || null,
      terceirizada_nome_livre: fornecedor ? null : (nomeLivre || null),
      qtd_enviada: modalQtdEnviada ? Number(modalQtdEnviada) : null,
      previsao_retorno: modalPrevisao || null,
      enviado_terceiro_em: new Date().toISOString(),
    });

    // "que depois de respondido vai criar uma tag" — o nome da terceirizada
    // vira etiqueta do item, visível no card sem abrir o detalhe.
    const nomeParaTag = fornecedor?.nome || nomeLivre;
    if (nomeParaTag) await adicionarTag(terceiroModal.row, nomeParaTag);

    setModalSaving(false);
    setTerceiroModal(null);
  };

  /* ── Popup de Expedição ────────────────────────────────────────────── */
  const addVolume = () =>
    setExpedicaoVolumes(prev => [...prev, { comprimento: "", altura: "", largura: "", peso: "" }]);

  const removerVolume = (idx: number) =>
    setExpedicaoVolumes(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const setVolumeCampo = (idx: number, campo: "comprimento" | "altura" | "largura" | "peso", valor: string) =>
    setExpedicaoVolumes(prev => prev.map((v, i) => (i === idx ? { ...v, [campo]: valor } : v)));

  const confirmarExpedicao = async () => {
    if (!expedicaoModal) return;

    // "Pago 100%?" é obrigatório — sem resposta, nem tenta salvar.
    if (expedicaoPago === null) {
      toast.error("Confirme se o pedido foi pago 100% antes de continuar.");
      return;
    }
    const transp = expedicaoTransportadoraLivre.trim() || expedicaoTransportadora;
    if (!transp) {
      toast.error("Informe a transportadora.");
      return;
    }
    const volumesNumericos = expedicaoVolumes.map(v => ({
      comprimento: Number(v.comprimento) || 0,
      altura: Number(v.altura) || 0,
      largura: Number(v.largura) || 0,
      peso: Number(v.peso) || 0,
    }));
    if (volumesNumericos.some(v => !v.comprimento || !v.altura || !v.largura || !v.peso)) {
      toast.error("Preencha comprimento, altura, largura e peso de cada volume.");
      return;
    }

    setExpedicaoSaving(true);
    const { row, target } = expedicaoModal;

    const { error } = await supabase
      .from("sistema_pedidos")
      .update({
        volumes: volumesNumericos,
        pago_integral: expedicaoPago === "sim",
        pago_integral_em: new Date().toISOString(),
        pago_integral_por: currentVendedor?.id ?? null,
      } as any)
      .eq("id", row.pedido_id);

    if (error) {
      console.error("[PCP] gravar expedição falhou:", error);
      toast.error(`Não foi possível salvar a expedição. ${error.message || ""}`);
      setExpedicaoSaving(false);
      return;
    }

    // Transportadora vira etiqueta em TODOS os itens do pedido — é o pacote
    // inteiro que vai com aquela transportadora, não só o item arrastado.
    const itensDoPedido = rows.filter(r => r.pedido_id === row.pedido_id);
    for (const item of itensDoPedido) await adicionarTag(item, transp);

    await mudarStatus(row.producao_id, statusCanonicoDaColuna(target));

    setExpedicaoSaving(false);
    setExpedicaoModal(null);
    toast.success("Expedição registrada: volumes, pagamento e transportadora salvos.");
  };

  /* Reseta o formulário sempre que o popup abre para um pedido novo —
     senão os volumes digitados no pedido anterior vazariam para este. */
  useEffect(() => {
    if (!expedicaoModal) return;
    setExpedicaoVolumes([{ comprimento: "", altura: "", largura: "", peso: "" }]);
    setExpedicaoPago(null);
    setExpedicaoTransportadora("");
    setExpedicaoTransportadoraLivre("");
  }, [expedicaoModal]);

  const totalItens = rowsFiltradas.length;

  return (
    <div className="space-y-4 min-w-0">
      {/* Inputs de arquivo escondidos — acionados pelos botões de anexo do
          modal de detalhe. Ficam montados sempre (não só quando o modal está
          aberto) pra não perder a seleção do usuário entre o clique e o
          re-render. */}
      <input ref={testeInputRef} type="file" accept="image/*" className="hidden" onChange={handleAnexoTeste} />
      <input ref={producaoAnexoInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleAnexoProducao} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gw-display">PCP — Produção</h1>
          <p className="gw-meta">
            Acompanhe cada item de pedido pelo fluxo de produção. Arraste os cards entre as colunas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="gw-meta">{totalItens} item(ns)</span>
          <Button variant="outline" size="sm" onClick={() => loadItems()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtro por etiquetas */}
      {todasTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="gw-label flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Etiquetas
          </span>
          {todasTags.map(t => {
            const ativo = tagsFiltro.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setTagsFiltro(prev => (ativo ? prev.filter(x => x !== t) : [...prev, t]))
                }
                className={cn(
                  "gw-body text-[13px] font-semibold rounded-full px-3 py-1 border transition-colors",
                  !ativo && "bg-[var(--gw-surface)] text-[var(--gw-text-secondary)] border-[var(--gw-border)] hover:border-[var(--gw-border-strong)]"
                )}
                style={ativo ? { backgroundColor: corDaTag(t), color: "#fff", borderColor: "transparent" } : undefined}
              >
                {t}
              </button>
            );
          })}
          {tagsFiltro.length > 0 && (
            <button
              type="button"
              onClick={() => setTagsFiltro([])}
              className="gw-body text-[13px] text-[var(--gw-text-muted)] hover:underline"
            >
              limpar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map(c => (
            <div key={c} className="w-[490px] shrink-0 space-y-3">
              <div className="animate-pulse h-8 rounded-lg bg-muted" />
              {[0, 1].map(i => (
                <div key={i} className="animate-pulse rounded-xl bg-muted" style={{ height: 349 }} />
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
                  style={{ width: 490, flexShrink: 0, height: "100%" }}
                  className={cn(
                    "rounded-xl border transition-colors flex flex-col overflow-hidden",
                    isOver ? "border-[#2563EB] bg-[#2563EB]/5" : "border-[var(--gw-border)] bg-white/60"
                  )}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 text-white shrink-0"
                    style={{ backgroundColor: col.color }}
                  >
                    <span className="gw-title text-[15px] text-white truncate">{col.label}</span>
                    <span
                      className="gw-body text-[12px] font-semibold text-white rounded-full px-2.5 py-0.5 shrink-0"
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
                    <OrderNumber value={detalhe.pedido_numero} />
                    <span className="gw-title text-[15px] truncate">{detalhe.cliente || "—"}</span>
                    <StatusPill status={detalhe.status} />
                  </DialogTitle>
                </DialogHeader>

                {/* Produto */}
                <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                  <p className="gw-label">Produto</p>
                  <p className="gw-title text-[15px]">{detalhe.produto_nome || "—"}</p>
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
                        <p className="gw-label">{k}</p>
                        <p className="gw-body text-[13px] text-[var(--gw-text)]">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Produção */}
                <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-3">
                  <p className="gw-label">Produção</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Técnica", detalhe.tecnica_nome || "—"],
                      ["Local de produção", detalhe.local_producao.replace(/_/g, " ")],
                      ...((detalhe.terceirizada_nome || detalhe.terceirizada_nome_livre)
                        ? [["Terceirizada", detalhe.terceirizada_nome || detalhe.terceirizada_nome_livre]] : []),
                      ...(detalhe.previsao_retorno ? [["Previsão de retorno", formatDate(detalhe.previsao_retorno) || "—"]] : []),
                      ["Produzir até", formatDate(detalhe.data_entrega_item) || "—"],
                      ["Despachar até", formatDate(detalhe.data_entrega_item) || "—"],
                      ["Tempo na etapa", tempoNaEtapa(detalhe.horas_na_etapa) || "—"],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <p className="gw-label">{k}</p>
                        <p className="gw-body text-[13px] text-[var(--gw-text)] capitalize truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Etiquetas */}
                  <div className="space-y-2 pt-1">
                    <Label className="gw-label flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Etiquetas
                    </Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(detalhe.tags ?? []).map(t => (
                        <span
                          key={t}
                          className="gw-body inline-flex items-center gap-1 text-[13px] font-semibold rounded-full pl-3 pr-1.5 py-1 text-white"
                          style={{ backgroundColor: corDaTag(t) }}
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removerTag(detalhe, t)}
                            className="rounded-full p-0.5 hover:bg-white/20"
                            aria-label={`Remover etiqueta ${t}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {(detalhe.tags ?? []).length === 0 && (
                        <span className="gw-body text-[13px] text-[var(--gw-text-muted)]">Nenhuma etiqueta</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={novaTag}
                        onChange={e => setNovaTag(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            adicionarTag(detalhe, novaTag);
                            setNovaTag("");
                          }
                        }}
                        placeholder="Nova etiqueta (ex.: Comprado XBZ)"
                        className="h-9 max-w-[280px]"
                        list="pcp-tags-existentes"
                      />
                      <datalist id="pcp-tags-existentes">
                        {todasTags.map(t => <option key={t} value={t} />)}
                      </datalist>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { adicionarTag(detalhe, novaTag); setNovaTag(""); }}
                        disabled={!novaTag.trim()}
                      >
                        Criar
                      </Button>
                    </div>
                  </div>

                  {TERCEIRIZADA_TRIGGER.includes(detalhe.local_producao) && (
                    <Button variant="outline" size="sm" onClick={() => { setDetalheId(null); openTerceiroModal(detalhe); }}>
                      <ShoppingBag className="h-4 w-4 mr-2" /> Dados da terceirizada
                    </Button>
                  )}
                </div>

                {/* Teste físico — só aparece na etapa certa, ou depois de já
                    ter anexo (pra continuar visível como registro). */}
                {(detalhe.coluna_pcp === "teste_fisico" || detalhe.teste_anexo_url) && (
                  <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2.5">
                    <p className="gw-label flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Teste físico
                    </p>
                    {detalhe.teste_anexo_url ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={sizedImage(detalhe.teste_anexo_url, 96)}
                          alt="Foto do teste"
                          className="w-16 h-16 rounded-lg object-cover border border-[var(--gw-border)] shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-[12px] text-[var(--gw-text-muted)]">
                            Enviado {formatDateTime(detalhe.teste_enviado_em)}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={detalhe.teste_anexo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--gw-primary)] hover:underline"
                            >
                              <Download className="h-3 w-3" /> Baixar para enviar ao cliente
                            </a>
                            <button
                              type="button"
                              onClick={() => abrirSeletorTeste(detalhe)}
                              disabled={enviandoTeste}
                              className="text-[12px] font-medium text-[var(--gw-text-secondary)] hover:underline disabled:opacity-50"
                            >
                              Trocar foto
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => abrirSeletorTeste(detalhe)} disabled={enviandoTeste}>
                        {enviandoTeste ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Anexar foto do teste
                      </Button>
                    )}

                    {/* Aprovação é ação do VENDEDOR (ele que sabe se o cliente
                        aprovou), não da produção. */}
                    {(detalhe.tags ?? []).includes(TAG_TESTE_APROVADO) ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--gw-success)" }}>
                        <CheckCircle2 className="h-4 w-4" /> Teste aprovado pelo cliente
                      </span>
                    ) : (detalhe.tags ?? []).includes(TAG_TESTE_ENVIADO) && (
                      <Button size="sm" onClick={() => aprovarTeste(detalhe)} style={{ backgroundColor: "var(--gw-success)" }}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Cliente aprovou o teste
                      </Button>
                    )}
                  </div>
                )}

                {/* Produção concluída — foto ou vídeo do pedido 100% pronto. */}
                {(detalhe.coluna_pcp === "em_producao" || detalhe.producao_anexo_url) && (
                  <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2.5">
                    <p className="gw-label flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5" /> Produção concluída (foto ou vídeo)
                    </p>
                    {detalhe.producao_anexo_url ? (
                      <div className="flex items-center gap-3">
                        {detalhe.producao_anexo_tipo === "video" ? (
                          <video
                            src={detalhe.producao_anexo_url}
                            className="w-16 h-16 rounded-lg object-cover border border-[var(--gw-border)] shrink-0 bg-black"
                            muted
                          />
                        ) : (
                          <img
                            src={sizedImage(detalhe.producao_anexo_url, 96)}
                            alt="Produto pronto"
                            className="w-16 h-16 rounded-lg object-cover border border-[var(--gw-border)] shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-[12px] text-[var(--gw-text-muted)]">
                            Enviado {formatDateTime(detalhe.producao_anexo_em)}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={detalhe.producao_anexo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--gw-primary)] hover:underline"
                            >
                              <Download className="h-3 w-3" /> Baixar para enviar ao cliente
                            </a>
                            <button
                              type="button"
                              onClick={() => abrirSeletorProducaoAnexo(detalhe)}
                              disabled={enviandoProducaoAnexo}
                              className="text-[12px] font-medium text-[var(--gw-text-secondary)] hover:underline disabled:opacity-50"
                            >
                              Trocar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => abrirSeletorProducaoAnexo(detalhe)} disabled={enviandoProducaoAnexo}>
                        {enviandoProducaoAnexo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Anexar foto ou vídeo
                      </Button>
                    )}
                  </div>
                )}

                {/* Observações — histórico em formato de conversa */}
                <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-3">
                  <p className="gw-label flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Observações
                  </p>

                  {(detalhe.pedido_observacoes || detalhe.item_observacao) && (
                    <div className="space-y-2">
                      {detalhe.pedido_observacoes && (
                        <div className="rounded-[10px] bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] px-3 py-2">
                          <p className="gw-label mb-0.5">Observação do pedido</p>
                          <p className="gw-body text-[13px] text-[var(--gw-text)] whitespace-pre-wrap">
                            {detalhe.pedido_observacoes}
                          </p>
                        </div>
                      )}
                      {detalhe.item_observacao && (
                        <div className="rounded-[10px] bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] px-3 py-2">
                          <p className="gw-label mb-0.5">Observação do item</p>
                          <p className="gw-body text-[13px] text-[var(--gw-text)] whitespace-pre-wrap">
                            {detalhe.item_observacao}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {comentarios.length === 0 ? (
                      <p className="gw-body text-[13px] text-[var(--gw-text-muted)]">
                        Nenhuma mensagem ainda. Escreva a primeira abaixo.
                      </p>
                    ) : (
                      comentarios.map(c => (
                        <div
                          key={c.id}
                          className="rounded-[10px] bg-[var(--gw-primary-soft)]/60 border border-[var(--gw-border)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="gw-body text-[12px] font-semibold text-[var(--gw-text-secondary)] truncate">
                              {c.autor_email || "Sistema"}
                            </span>
                            <span className="gw-body text-[11px] text-[var(--gw-text-muted)] shrink-0">
                              {new Date(c.created_at).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="gw-body text-[13px] text-[var(--gw-text)] whitespace-pre-wrap mt-0.5">
                            {c.mensagem}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-end gap-2">
                    <Textarea
                      value={novoComentario}
                      onChange={e => setNovoComentario(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          enviarComentario();
                        }
                      }}
                      placeholder="Escreva uma observação…"
                      rows={2}
                      className="text-[13px] resize-none"
                    />
                    <Button
                      size="sm"
                      onClick={enviarComentario}
                      disabled={enviandoComentario || !novoComentario.trim()}
                    >
                      {enviandoComentario
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
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
                            style={{ backgroundColor: statusInfo(h.status_novo).cor }}
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {h.status_anterior && (
                              <>
                                <StatusPill status={h.status_anterior} className="opacity-60" />
                                <span className="text-[11px] text-[var(--gw-text-muted)]">→</span>
                              </>
                            )}
                            <StatusPill status={h.status_novo} />
                            <span className="text-[11px] text-[var(--gw-text-secondary)]">
                              {formatDateTime(h.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--gw-text-muted)] mt-0.5">
                            Alterado por: {vendedorNome(h.vendedor_id) || "não identificado"}
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
                <Select value={modalFornecedorId} onValueChange={v => { setModalFornecedorId(v); setModalTerceirizadaLivre(""); }}>
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

              <div className="space-y-1.5">
                <Label>Ou digite o nome (se não estiver cadastrada)</Label>
                <Input
                  value={modalTerceirizadaLivre}
                  onChange={e => { setModalTerceirizadaLivre(e.target.value); if (e.target.value) setModalFornecedorId(""); }}
                  placeholder="Ex.: Gráfica São Jorge"
                />
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

      {/* Popup de Expedição — abre quando o item arrastado fecha o pedido
          inteiro na coluna. Volumes (L/A/P/peso), "Pago 100%?" obrigatório,
          e transportadora, tudo de uma vez. */}
      <Dialog open={!!expedicaoModal} onOpenChange={open => !open && !expedicaoSaving && setExpedicaoModal(null)}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Expedição — Pedido {expedicaoModal?.row.pedido_numero}
            </DialogTitle>
          </DialogHeader>

          {expedicaoModal && (
            <div className="space-y-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
              <p className="text-[12px] text-[var(--gw-text-muted)]">
                Todos os {expedicaoModal.row.total_itens_pedido ?? 1} itens deste pedido chegaram na expedição.
                Registre os volumes antes de liberar para a coleta.
              </p>

              {/* Volumes */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label>Volumes ({expedicaoVolumes.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVolume}>
                    + Adicionar volume
                  </Button>
                </div>
                {expedicaoVolumes.map((v, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--gw-border)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[var(--gw-text-secondary)]">
                        Volume {idx + 1}
                      </span>
                      {expedicaoVolumes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerVolume(idx)}
                          className="text-[11px] text-[var(--gw-danger)] hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        ["comprimento", "Compr. (cm)"],
                        ["altura", "Altura (cm)"],
                        ["largura", "Largura (cm)"],
                        ["peso", "Peso (kg)"],
                      ] as const).map(([campo, label]) => (
                        <div key={campo} className="space-y-1">
                          <Label className="text-[11px]">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={v[campo]}
                            onChange={e => setVolumeCampo(idx, campo, e.target.value)}
                            className="h-8 text-[13px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pago 100%? — obrigatório, ação do vendedor */}
              <div className="space-y-1.5">
                <Label>Pago 100%? <span className="text-[var(--gw-danger)]">*</span></Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpedicaoPago("sim")}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-[13px] font-semibold border transition-colors",
                      expedicaoPago === "sim"
                        ? "text-white border-transparent"
                        : "bg-[var(--gw-surface)] text-[var(--gw-text-secondary)] border-[var(--gw-border)]"
                    )}
                    style={expedicaoPago === "sim" ? { backgroundColor: "var(--gw-success)" } : undefined}
                  >
                    Sim, pago integralmente
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpedicaoPago("nao")}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-[13px] font-semibold border transition-colors",
                      expedicaoPago === "nao"
                        ? "text-white border-transparent"
                        : "bg-[var(--gw-surface)] text-[var(--gw-text-secondary)] border-[var(--gw-border)]"
                    )}
                    style={expedicaoPago === "nao" ? { backgroundColor: "var(--gw-danger)" } : undefined}
                  >
                    Ainda não
                  </button>
                </div>
              </div>

              {/* Transportadora */}
              <div className="space-y-1.5">
                <Label>Transportadora</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TRANSPORTADORA_OPCOES.map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => { setExpedicaoTransportadora(op); setExpedicaoTransportadoraLivre(""); }}
                      className={cn(
                        "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
                        expedicaoTransportadora === op
                          ? "text-white border-transparent"
                          : "bg-[var(--gw-surface)] text-[var(--gw-text-secondary)] border-[var(--gw-border)]"
                      )}
                      style={expedicaoTransportadora === op ? { backgroundColor: corDaTag(op) } : undefined}
                    >
                      {op}
                    </button>
                  ))}
                </div>
                <Input
                  value={expedicaoTransportadoraLivre}
                  onChange={e => { setExpedicaoTransportadoraLivre(e.target.value); if (e.target.value) setExpedicaoTransportadora(""); }}
                  placeholder="Ou digite outra transportadora"
                  className="h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExpedicaoModal(null)} disabled={expedicaoSaving}>
              Cancelar
            </Button>
            <Button onClick={confirmarExpedicao} disabled={expedicaoSaving}>
              {expedicaoSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar expedição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
