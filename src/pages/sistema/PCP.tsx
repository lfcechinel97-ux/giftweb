import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Loader2, RefreshCw, Boxes, Phone, Layers, ShoppingBag, Clock, History,
  Tag, X, MessageSquare, Send, Camera, Video, CheckCircle2, Upload, Download, Paperclip, FileText,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { uploadAnexoPcp, uploadAnexoGenerico, uploadArquivoPedido, MockupUploadError } from "@/lib/uploadMockup";
import { cn } from "@/lib/utils";
import { Money } from "@/components/sistema/ui/Money";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import { COLUNAS_PCP, corDaColuna, statusCanonicoDaColuna, colunaDoStatus, statusInfo } from "@/lib/statusPedido";
import { useSistema, type Pedido, type PedidoItem } from "@/contexts/SistemaContext";
import { gerarOrdemProducaoPDF } from "./ordemProducaoPDF";
import { obterPerfil, vendedorRestritoDe } from "@/hooks/useUserRole";
import type { RealtimeChannel } from "@supabase/supabase-js";


/* ── Types ───────────────────────────────────────────────────────────────── */

type PcpStatus =
  | "organizando_pedido" | "aguardando_mercadoria"
  | "teste_fisico" | "teste_enviado"
  | "em_producao" | "inserir_medidas"
  | "aguardando_coleta" | "enviado";

type LocalProducao = "interna" | "terceirizada" | "fornecedor_para_terceirizada";

interface PcpRow {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
  pedido_cor: string | null;
  pedido_vendedor_id: string | null;
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
  pedido_volumes_responsavel: string | null;
  pedido_pago_integral: boolean | null;
  pedido_comprovante_pagamento_url: string | null;
  item_volumes: { responsavel: string; itens: { comprimento: number; altura: number; largura: number; peso: number }[] } | null;
  grupo_id: string | null;
  arte_anexo_url: string | null;
  pedido_anexos: { url: string; nome: string; criadoEm: string }[] | null;
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

type AnexoCategoria = "logo" | "mockup" | "teste" | "producao" | "etiqueta" | "nota_fiscal" | "outro";

interface AnexoRow {
  id: string;
  producao_item_id: string;
  categoria: AnexoCategoria;
  tipo: "foto" | "video" | "pdf" | "outro";
  url: string;
  nome_arquivo: string | null;
  vendedor_id: string | null;
  created_at: string;
}

const ANEXO_CATEGORIA_LABEL: Record<AnexoCategoria, string> = {
  logo: "Logo",
  mockup: "Mockup",
  teste: "Teste",
  producao: "Produção",
  etiqueta: "Etiqueta",
  nota_fiscal: "Nota fiscal",
  outro: "Outro",
};

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

/* Etiquetas automáticas do fluxo — nomes fixos de propósito (não são texto
   livre do vendedor), o código procura essas strings exatas pra decidir o
   que mostrar/esconder em cada etapa. */
const TAG_TESTE_ENVIADO = "TESTE ENVIADO";
const TAG_TESTE_REFEITO = "TESTE REFEITO";
const TAG_TESTE_APROVADO = "TESTE APROVADO";
const TAG_TESTE_RECUSADO = "TESTE RECUSADO";
const TAG_PROD_GALPAO = "PROD. GALPÃO";
const TAG_TERCEIRIZADA_PREFIXO = "TERCEIRIZADA";
const TAG_COBRAR_RESTANTE = "COBRAR 50% RESTANTE";
const TAG_PAGO_CARTAO = "PAGO CARTÃO";
const TAG_DESPACHAR_PREFIXO = "DESPACHAR";

/* Tags do fluxo de teste — todas se excluem mutuamente, nunca coexistem no
   mesmo card (uma etapa por vez). */
const TAGS_FLUXO_TESTE = [TAG_TESTE_ENVIADO, TAG_TESTE_REFEITO, TAG_TESTE_APROVADO, TAG_TESTE_RECUSADO];
/* Tags de pagamento/expedição — também se excluem mutuamente; "todas as
   tags saem" ao confirmar o despacho vira só isso: filtrar essas fora. */
const TAGS_EXPEDICAO = [TAG_COBRAR_RESTANTE, TAG_PAGO_CARTAO];

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
/* Só variações das cores primárias — azul, verde, vermelho, roxo e
   laranja — todas fechadas o bastante para o texto branco. */
const TAG_PALETTE = [
  "#1D4ED8", "#1E40AF", "#0369A1", "#075985",
  "#15803D", "#047857", "#166534",
  "#B91C1C", "#DC2626",
  "#7E22CE", "#6D28D9", "#A21CAF",
  "#C2410C", "#9A3412",
];

/* Paleta EXATA de etiquetas fixas do fluxo (cores dadas pelo usuário) —
   tag que bate literalmente com uma destas usa a cor exata; texto livre
   (nome de terceirizada, nome de transportadora fora da lista) continua
   caindo no hash determinístico acima. "TERCEIRIZADA: X" é reconhecida
   pelo prefixo, não pelo texto inteiro (o nome muda por pedido). */
/* Todas aqui são tons FECHADOS de propósito: a etiqueta é sempre texto
   branco em negrito, e verde/laranja/ciano claros deixavam a palavra
   quase ilegível em cima da foto do produto. */
const TAG_COR_EXATA: Record<string, string> = {
  "COMPRADO XBZ": "#1D4ED8",
  "COMPRADO SP": "#6D28D9",
  "COMPRADO CHINA": "#6D28D9", // legado — tags já gravadas com esse texto continuam coloridas
  "TESTE ENVIADO": "#7E22CE",
  "TESTE REFEITO": "#6D28D9",
  "TESTE APROVADO": "#15803D",
  "TESTE RECUSADO": "#DC2626",
  "PROD. GALPÃO": "#1D4ED8",
  "TERCEIRIZADA": "#C2410C",
  "COBRAR 50% RESTANTE": "#DC2626",
  "PAGO CARTÃO": "#15803D",
  "DESPACHAR": "#0369A1",
  "PRODUZIR + MÍDIA": "#C2410C",
  "PRODUZIDO": "#15803D",
  "LASER": "#15803D",
  "DTF UV": "#1D4ED8",
  "MÍDIA ENVIADA": "#0E7490",
  "PAGO 100%": "#15803D",
  "PAGAMENTO PENDENTE": "#DC2626",
  "COLETADO": "#15803D",
  "ENVIADO": "#15803D",
  "COLETA BRASPRESS": "#1D4ED8",
  "BRASPRESS": "#1D4ED8",
  "COLETA MELHOR ENVIO": "#6D28D9",
  "MELHOR ENVIO": "#6D28D9",
  "ENVIO POR LALAMOVE": "#C2410C",
  "LALAMOVE": "#C2410C",
};

/* Ordem de prioridade quando o card tem mais etiquetas do que cabe —
   mostra as primeiras da lista e agrupa o resto em "+N" (hover revela). */
const TAG_PRIORIDADE = [
  "URGENTE", "TESTE RECUSADO", "COBRAR 50% RESTANTE", "DESPACHAR",
  "TESTE APROVADO", "TESTE REFEITO", "TESTE ENVIADO",
  "PROD. GALPÃO", "TERCEIRIZADA", "PAGO CARTÃO",
  "COMPRADO XBZ", "COMPRADO SP", "COMPRADO CHINA", "LASER", "DTF UV",
  "BRASPRESS", "MELHOR ENVIO", "LALAMOVE",
];

const prioridadeDaTag = (texto: string) => {
  const t = texto.toUpperCase();
  const i = TAG_PRIORIDADE.findIndex(p => t.startsWith(p) || t.includes(p));
  return i === -1 ? TAG_PRIORIDADE.length : i;
};

const ordenarTagsPorPrioridade = (tags: string[]) =>
  [...tags].sort((a, b) => prioridadeDaTag(a) - prioridadeDaTag(b));

const corDaTag = (texto: string) => {
  const exata = TAG_COR_EXATA[texto.toUpperCase()];
  if (exata) return exata;
  if (texto.toUpperCase().startsWith(TAG_TERCEIRIZADA_PREFIXO)) return TAG_COR_EXATA["TERCEIRIZADA"];
  if (texto.toUpperCase().startsWith(TAG_DESPACHAR_PREFIXO)) return TAG_COR_EXATA["DESPACHAR"];
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

/* Resumo compacto dos volumes da expedição — "2 volumes · 12kg" — pra
   caber numa linha do card sem precisar abrir o detalhe. */
const resumoVolumes = (volumes: unknown): string | null => {
  if (!Array.isArray(volumes) || volumes.length === 0) return null;
  const pesoTotal = volumes.reduce((s: number, v: any) => s + (Number(v?.peso) || 0), 0);
  const qtd = volumes.length;
  return `${qtd} ${qtd === 1 ? "volume" : "volumes"}${pesoTotal > 0 ? ` · ${pesoTotal}kg` : ""}`;
};

/* "os volumes que a produção preencheu acaba se tornando cada volume
   uma tag. TAG1 2V 50x40x30 / 7KG TAG2 1V 30x54x84 / 4KG" — agrupa
   volumes com as MESMAS dimensões/peso numa tag só, contando quantos
   são iguais; dimensões diferentes viram tags separadas. */
const agruparVolumesEmTags = (
  volumes: { comprimento: number; altura: number; largura: number; peso: number }[],
): string[] => {
  const grupos = new Map<string, number>();
  for (const v of volumes) {
    const chave = `${v.comprimento}X${v.altura}X${v.largura} / ${v.peso}KG`;
    grupos.set(chave, (grupos.get(chave) ?? 0) + 1);
  }
  return [...grupos.entries()].map(([medidas, qtd]) => `${qtd}V ${medidas}`);
};

/* Alerta de tempo — regra ÚNICA pra todas as etapas (pedido explícito do
   usuário, substitui os limites variados por coluna de antes):
     > 72 horas ÚTEIS (só dias de semana contam) na mesma etapa -> texto
       vermelho.
     > 5 dias CORRIDOS na mesma etapa -> fundo vermelho, número branco
       (mais grave, se sobrepõe ao alerta de texto). */
const LIMITE_ATENCAO_HORAS_UTEIS = 72;
const LIMITE_CRITICO_DIAS_CORRIDOS = 5;

/* Conta só as horas de dia útil (seg-sex) entre `desde` e agora —
   aproximação por hora corrida dentro de dias úteis, não por horário
   comercial exato (8h-18h): o que importa é não deixar um fim de semana
   inteiro contar como "tempo parado" igual a um dia de trabalho. */
const horasUteisDesde = (desde: string | null): number => {
  if (!desde) return 0;
  const inicio = new Date(desde).getTime();
  const fim = Date.now();
  if (!Number.isFinite(inicio) || fim <= inicio) return 0;
  const totalHoras = Math.min((fim - inicio) / 3600000, 24 * 60); // corte de segurança: 60 dias
  let horasUteis = 0;
  const cursor = new Date(inicio);
  for (let i = 0; i < totalHoras; i++) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) horasUteis++;
    cursor.setTime(cursor.getTime() + 3600000);
  }
  return horasUteis;
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

/** Iniciais do vendedor pro avatar (sem foto cadastrada ainda no sistema). */
const iniciaisVendedor = (nome: string | null) => {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
};

function VendedorAvatar({ nome }: { nome: string | null }) {
  if (!nome) return null;
  const cor = corDaTag(nome);
  return (
    <span
      className="group/av relative shrink-0 h-[24px] w-[24px] rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none"
      style={{ backgroundColor: cor }}
    >
      {iniciaisVendedor(nome)}
      <span
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#0F172A] text-white text-[11px] font-medium px-2 py-1 opacity-0 group-hover/av:opacity-100 transition-opacity z-10"
      >
        Vendedor / {nome}
      </span>
    </span>
  );
}

/** Combobox de etiquetas — busca no catálogo mestre; só oferece "criar
    nova" quando o texto digitado não bate com nenhuma existente
    (case-insensitive), pra não nascer duplicidade tipo "XBZ"/"xbz". */
function EtiquetaCombobox({ opcoes, onSelect }: { opcoes: string[]; onSelect: (nome: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const buscaLimpa = busca.trim();
  const existeExata = opcoes.some(o => o.toLowerCase() === buscaLimpa.toLowerCase());
  const filtradas = opcoes.filter(o => o.toLowerCase().includes(buscaLimpa.toLowerCase()));

  const escolher = (nome: string) => {
    onSelect(nome);
    setBusca("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Tag className="h-3.5 w-3.5 mr-1.5" /> Adicionar etiqueta
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou criar etiqueta…"
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            {filtradas.length === 0 && !buscaLimpa && (
              <CommandEmpty>Nenhuma etiqueta ainda.</CommandEmpty>
            )}
            <CommandGroup>
              {filtradas.map(o => (
                <CommandItem key={o} value={o} onSelect={() => escolher(o)}>
                  {o}
                </CommandItem>
              ))}
              {buscaLimpa && !existeExata && (
                <CommandItem value={`__criar__${buscaLimpa}`} onSelect={() => escolher(buscaLimpa)}>
                  Criar etiqueta "{buscaLimpa}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PcpCard({
  row, indice, total, dragging, saving, atrasado, critico, highlight, comFotos, vendedorNome,
  imprimindoOP,
  onDragStart, onDragEnd, onOpen, onHover, onComprado, onDespachar, onImprimirOP, onAgrupar, onDesagrupar, onInserirMedidas,
}: {
  row: PcpRow;
  indice: number;
  total: number;
  dragging: boolean;
  saving: boolean;
  atrasado: boolean;
  critico: boolean;
  highlight: boolean;
  comFotos: boolean;
  vendedorNome: string | null;
  imprimindoOP: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onHover: (pedidoId: string | null) => void;
  onComprado: (row: PcpRow, origem: "XBZ" | "SP") => void;
  onDespachar: (row: PcpRow) => void;
  onImprimirOP: (row: PcpRow) => void;
  onAgrupar: (row: PcpRow) => void;
  onDesagrupar: (row: PcpRow) => void;
  onInserirMedidas: (row: PcpRow) => void;
}) {
  const foto = row.mockup_url || row.imagem_catalogo_url;
  const cor = corDoPedido(row);
  const tempo = tempoNaEtapaCurto(row.horas_na_etapa);
  const tempoTotal = tempoTotalCurto(row.item_criado_em);
  const tagsOrdenadas = ordenarTagsPorPrioridade(row.tags ?? []);
  const tagsVisiveis = tagsOrdenadas.slice(0, 3);
  const tagsOcultas = tagsOrdenadas.slice(3);

  const Etiquetas = tagsOrdenadas.length > 0 && (
    <div className="flex flex-wrap gap-1 max-w-full">
      {tagsVisiveis.map(t => (
        <span
          key={t}
          className="gw-body text-[10px] leading-none rounded-[5px] px-[7px] py-[4px] whitespace-nowrap"
          style={{ backgroundColor: corDaTag(t), color: "#FFFFFF", fontWeight: 700, boxShadow: "0 1px 3px rgba(15,23,42,.45)" }}
        >
          {t}
        </span>
      ))}
      {tagsOcultas.length > 0 && (
        <span
          className="group/tags relative gw-body text-[10px] leading-none rounded-[5px] px-[6px] py-[4px]"
          style={{ backgroundColor: "rgba(15,23,42,.72)", color: "#FFFFFF", fontWeight: 700 }}
        >
          +{tagsOcultas.length}
          <span className="pointer-events-none absolute left-0 top-full mt-1 hidden group-hover/tags:flex flex-col gap-1 rounded-[6px] bg-[#0F172A] p-1.5 z-10 w-max max-w-[220px]">
            {tagsOcultas.map(t => (
              <span
                key={t}
                className="text-[10px] rounded-[4px] px-[6px] py-[3px]"
                style={{ backgroundColor: corDaTag(t), color: "#FFFFFF", fontWeight: 700 }}
              >
                {t}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );

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
        "w-[300px] rounded-[10px] overflow-hidden cursor-pointer select-none bg-white",
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
      {/* Cabeçalho — pedido / item / vendedor */}
      <div className="flex items-center gap-1.5 pl-3 pr-2.5 pt-2.5 pb-1.5">
        <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ backgroundColor: cor }} />
        <OrderNumber value={row.pedido_numero} className="text-[13px] shrink-0" />
        <span className="text-[var(--gw-text-muted)] text-[12px] shrink-0">·</span>
        <span className="gw-body text-[12px] font-medium text-[var(--gw-text-secondary)] shrink-0">
          Item {indice}/{total}
        </span>
        <span className="flex-1" />
        <VendedorAvatar nome={vendedorNome} />
      </div>

      {/* Imagem (modo "com fotos") */}
      {comFotos && (
        <div className="relative h-[150px] w-full mx-0">
          {foto ? (
            <img src={sizedImage(foto, 480)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover bg-[var(--gw-surface-alt)]" />
          ) : (
            <div className="w-full h-full bg-[var(--gw-surface-alt)] flex items-center justify-center">
              <Package className="h-9 w-9 text-[var(--gw-text-muted)]" />
            </div>
          )}
          {tagsOrdenadas.length > 0 && (
            <div className="absolute top-1.5 left-1.5 right-1.5">{Etiquetas}</div>
          )}
        </div>
      )}

      {/* Info — nome, tags (modo sem fotos), quantidade, timers */}
      <div className="px-3 pt-2 pb-2.5 space-y-1.5">
        <p className="gw-body text-[13px] font-semibold text-[#0F172A] truncate" title={row.produto_nome || undefined}>
          {row.produto_nome || "—"}
        </p>

        {!comFotos && tagsOrdenadas.length > 0 && Etiquetas}

        <div className="flex items-center justify-between">
          <span className="gw-num text-[16px] leading-none text-[#0F172A]" style={{ fontWeight: 700 }}>
            {row.quantidade ?? 0} <span className="text-[12px] font-medium text-[var(--gw-text-secondary)]">un.</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5 pt-0.5">
          <span
            className="gw-body flex items-center gap-1 text-[11px] font-semibold"
            style={
              critico
                ? { color: "#FFFFFF", backgroundColor: "var(--gw-danger)", borderRadius: 5, padding: "2px 6px" }
                : { color: atrasado ? "var(--gw-danger)" : "var(--gw-text-secondary)" }
            }
          >
            <Clock className="h-[12px] w-[12px]" /> {tempo || "—"} na etapa
          </span>
          {tempoTotal && (
            <span className="gw-body flex items-center gap-1 text-[11px] text-[var(--gw-text-muted)]">
              <History className="h-[11px] w-[11px]" /> {tempoTotal} total
            </span>
          )}
        </div>

        {/* Volumes da expedição — já aparecem como tag também (pedido do
            usuário), essa linha só reforça o peso total de forma curta. */}
        {colunaDoStatus(row) === "aguardando_coleta" && resumoVolumes(row.item_volumes?.itens) && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--gw-text-secondary)]">
            <Boxes className="h-[12px] w-[12px]" /> {resumoVolumes(row.item_volumes?.itens)}
          </div>
        )}

        {/* "IMPRIMIR O.P." — só o item 1 do pedido, só na 1a coluna. Baixa
            o PDF e já move pra Aguardando Mercadoria (o grupo inteiro,
            se tiver). "Agrupar" fica ao lado, também só aqui. */}
        {colunaDoStatus(row) === "organizando_pedido" && (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {indice === 1 && (
              <button
                type="button"
                onClick={() => onImprimirOP(row)}
                disabled={imprimindoOP}
                className="flex-1 h-6 rounded-[5px] text-white text-[10px] font-bold"
                style={{ backgroundColor: "#0B7CAF" }}
              >
                {imprimindoOP ? "Gerando…" : "Imprimir O.P."}
              </button>
            )}
            {row.grupo_id ? (
              <button
                type="button"
                onClick={() => onDesagrupar(row)}
                className="h-6 px-2 rounded-[5px] text-white text-[10px] font-bold"
                style={{ backgroundColor: "#7C3AED" }}
              >
                Agrupado ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAgrupar(row)}
                className="h-6 px-2 rounded-[5px] text-white text-[10px] font-bold"
                style={{ backgroundColor: "var(--gw-text-muted)" }}
              >
                Agrupar
              </button>
            )}
          </div>
        )}

        {colunaDoStatus(row) === "inserir_medidas" && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onInserirMedidas(row); }}
            className="h-6 rounded-[5px] text-white text-[10px] font-bold"
            style={{ backgroundColor: "#0B8177" }}
          >
            Inserir medidas
          </button>
        )}

        {/* "Confirmar despacho" — só na Expedição, só até a tag DESPACHAR
            já existir (ação feita uma vez por item). */}
        {colunaDoStatus(row) === "aguardando_coleta" &&
          !(row.tags ?? []).some(t => t.toUpperCase().startsWith(TAG_DESPACHAR_PREFIXO)) && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDespachar(row); }}
              className="h-6 rounded-[5px] text-white text-[10px] font-bold"
              style={{ backgroundColor: "#0EA5E9" }}
            >
              Confirmar despacho
            </button>
          )}

        {/* Registrar compra — só na etapa "Aguardando mercadoria", só até
            existir uma das duas tags (registrado uma vez, some da tela). */}
        {row.status === "aguardando_mercadoria" &&
          !(row.tags ?? []).some(t => t.toUpperCase() === "COMPRADO XBZ" || t.toUpperCase() === "COMPRADO SP") && (
            <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onComprado(row, "XBZ")}
                className="flex-1 h-6 rounded-[5px] text-white text-[10px] font-bold"
                style={{ backgroundColor: "#2563EB" }}
              >
                Comprado XBZ
              </button>
              <button
                type="button"
                onClick={() => onComprado(row, "SP")}
                className="flex-1 h-6 rounded-[5px] text-white text-[10px] font-bold"
                style={{ backgroundColor: "#7C3AED" }}
              >
                Comprado SP
              </button>
            </div>
          )}
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
  const { vendedores, currentVendedor, clientes, transportadoras: transportadorasCadastro } = useSistema();
  const vendedorNome = (id: string | null) => vendedores.find(v => v.id === id)?.nome || null;
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<PcpRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PcpStatus | null>(null);
  const [hoverPedido, setHoverPedido] = useState<string | null>(null);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  /* "Com fotos / Sem fotos" — preferência por usuário, local ao navegador
     (não é dado do pedido, é jeito de olhar o quadro). */
  const [comFotos, setComFotos] = useState<boolean>(() => {
    try { return localStorage.getItem("pcp_com_fotos") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("pcp_com_fotos", comFotos ? "1" : "0"); } catch { /* noop */ }
  }, [comFotos]);
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

  /* Popup obrigatório ao sair de "Organizando Anotações" pra "Aguardando
     Mercadoria": comprovante de pagamento anexado OU confirmação manual
     ("CONFIRMADO MARLON") — vale pro PEDIDO inteiro, não item por item. */
  const [pagamentoPedidoModal, setPagamentoPedidoModal] = useState<{ row: PcpRow; target: PcpStatus } | null>(null);
  const [pagamentoPedidoSaving, setPagamentoPedidoSaving] = useState(false);
  const comprovanteInputRef = useRef<HTMLInputElement | null>(null);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);

  /* Popup obrigatório ao entrar em "Aguardando Teste": produção no galpão
     ou terceirizada (com nome, se terceirizada) — a resposta vira tag,
     não muda mais a coluna (galpão/terceirizada não são mais colunas
     separadas). */
  const [galpaoTerceirizadaModal, setGalpaoTerceirizadaModal] = useState<{ row: PcpRow; target: PcpStatus } | null>(null);
  const [modalTipoProducao, setModalTipoProducao] = useState<"galpao" | "terceirizada">("galpao");
  const [modalFornecedorId, setModalFornecedorId] = useState("");
  const [modalTerceirizadaLivre, setModalTerceirizadaLivre] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  /* Popup de Expedição — abre quando o item arrastado fecha o conjunto
     (todos os itens do pedido chegam na coluna "aguardando_coleta" de uma
     vez). Volumes ficam no PEDIDO (sistema_pedidos.volumes), não no item:
     é a caixa física que carrega o pedido inteiro, não uma peça sozinha.
     Só pede volumes + responsável -- pagamento e transportadora saíram
     daqui (pagamento agora é tag automática; transportadora é perguntada
     só no "Confirmar despacho", junto da nota fiscal/etiqueta). */
  const [expedicaoModal, setExpedicaoModal] = useState<{ row: PcpRow; target: PcpStatus } | null>(null);
  const [expedicaoVolumes, setExpedicaoVolumes] = useState<
    { comprimento: string; altura: string; largura: string; peso: string }[]
  >([{ comprimento: "", altura: "", largura: "", peso: "" }]);
  const [expedicaoResponsavel, setExpedicaoResponsavel] = useState("");
  const [expedicaoSaving, setExpedicaoSaving] = useState(false);

  /* "Confirmar despacho" — ação separada dentro de Expedição: nota fiscal +
     etiqueta anexadas + transportadora informada. Ao confirmar, TODAS as
     tags do item saem e só fica "DESPACHAR + transportadora". */
  const [despachoModal, setDespachoModal] = useState<{ row: PcpRow } | null>(null);
  const [despachoTransportadora, setDespachoTransportadora] = useState("");
  const [despachoTransportadoraLivre, setDespachoTransportadoraLivre] = useState("");
  const [despachoNotaFiscalUrl, setDespachoNotaFiscalUrl] = useState<string | null>(null);
  const [despachoEtiquetaUrl, setDespachoEtiquetaUrl] = useState<string | null>(null);
  const [despachoSaving, setDespachoSaving] = useState(false);
  const [enviandoDespachoArquivo, setEnviandoDespachoArquivo] = useState<"nota_fiscal" | "etiqueta" | null>(null);
  const despachoNotaFiscalInputRef = useRef<HTMLInputElement | null>(null);
  const despachoEtiquetaInputRef = useRef<HTMLInputElement | null>(null);

  /* Anexos do PCP (teste físico + produção concluída) */
  const testeInputRef = useRef<HTMLInputElement | null>(null);
  const producaoAnexoInputRef = useRef<HTMLInputElement | null>(null);
  const testeAlvoRef = useRef<PcpRow | null>(null);
  const producaoAnexoAlvoRef = useRef<PcpRow | null>(null);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [enviandoProducaoAnexo, setEnviandoProducaoAnexo] = useState(false);
  const [recusaModal, setRecusaModal] = useState<PcpRow | null>(null);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [recusaSaving, setRecusaSaving] = useState(false);

  /* Anexos genéricos (seção "Anexos") — categoria escolhida antes do
     arquivo, guardada em ref pro handler do <input type=file> saber
     onde categorizar quando o navegador dispara o onChange. */
  const anexoGenericoInputRef = useRef<HTMLInputElement | null>(null);
  const anexoGenericoAlvoRef = useRef<{ row: PcpRow; categoria: AnexoCategoria } | null>(null);
  const [enviandoAnexoGenerico, setEnviandoAnexoGenerico] = useState(false);

  /* Dados cacheados (60s): voltar ao PCP mostra o quadro na hora e revalida em 2º plano */
  const pcpQuery = useQuery<PcpRow[]>({
    queryKey: ["sistema", "pcp", "rows"],
    staleTime: 60 * 1000,
    // Rede de segurança caso o realtime caia (aba em segundo plano, rede instável).
    refetchInterval: 20 * 1000,
    refetchOnWindowFocus: true,
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
      const restrito = vendedorRestritoDe(await obterPerfil(queryClient));
      let q = supabase
        .from("vw_pcp" as any)
        .select("*")
        .or(`coluna_pcp.neq.enviado,etapa_desde.gte.${cortaEnviadoAntes}`);
      if (restrito) q = q.eq("pedido_vendedor_id", restrito);
      const { data, error } = await q.order("data_entrega_item", { ascending: true, nullsFirst: false });
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

  /* Catálogo mestre de etiquetas (sistema_etiquetas) — se a migration
     ainda não rodou no banco, a tabela não existe: cai no catch e o
     combobox simplesmente nasce vazio (comportamento normal de "sem
     etiquetas ainda"), sem quebrar o resto da página. */
  const { data: etiquetasMestre = [] } = useQuery<{ nome: string }[]>({
    queryKey: ["sistema", "pcp", "etiquetas-mestre"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_etiquetas")
        .select("nome")
        .eq("ativo", true)
        .order("nome");
      if (error) return [];
      return (data ?? []) as { nome: string }[];
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
    // O merge abaixo é instantâneo mas parcial (a tabela crua não tem os
    // campos calculados da view); a releitura debounced traz o resto.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void loadItems(); }, 400);
    };
    const canal: RealtimeChannel = supabase
      .channel("pcp-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_pedidos" }, recarregar)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sistema_producao_itens" },
        (payload) => {
          recarregar();
          if (payload.eventType === "DELETE") {
            const idRemovido = (payload.old as { id?: string })?.id;
            if (idRemovido) setRows(prev => prev.filter(r => r.producao_id !== idRemovido));
            return;
          }
          const novo = payload.new as Record<string, unknown>;
          const id = novo.id as string;
          setRows(prev => {
            const existe = prev.some(r => r.producao_id === id);
            if (!existe) return prev;
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
    return () => { clearTimeout(timer); void supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Filtro do board = catálogo mestre + qualquer etiqueta que ainda não
     tenha sido migrada pra lá (ex.: banco sem a migration aplicada
     ainda) — nunca menos completo que a versão só-dos-cards-carregados
     que existia antes. */
  const todasTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of etiquetasMestre) set.add(e.nome);
    for (const r of rows) for (const t of r.tags ?? []) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, etiquetasMestre]);

  const rowsFiltradas = useMemo(() => {
    if (tagsFiltro.length === 0) return rows;
    return rows.filter(r => tagsFiltro.every(t => (r.tags ?? []).includes(t)));
  }, [rows, tagsFiltro]);

  const byStatus = useMemo(() => {
    const map: Record<string, PcpRow[]> = {};
    for (const col of STATUS_COLS) map[col.value] = [];
    /* Agrupa por COLUNA, não por status: status e coluna são vocabulários
       diferentes desde o catálogo editável. "conferir_pagamentos" é status e
       cai na coluna "produzido" — agrupar por status faria o card
       sumir do quadro. */
    for (const row of rowsFiltradas) (map[colunaDoStatus(row)] ??= []).push(row);
    /* "é importante que os produtos do mesmo pedido, se estiverem na
       mesma coluna, sempre fiquem juntos" — agrupa por pedido_id
       preservando a ordem original de quem chegou primeiro (não
       reordena por prazo/data, só agrupa os irmãos ao lado um do
       outro). */
    for (const col of Object.keys(map)) {
      const primeiraAparicao = new Map<string, number>();
      map[col].forEach((r, i) => {
        if (!primeiraAparicao.has(r.pedido_id)) primeiraAparicao.set(r.pedido_id, i);
      });
      map[col] = [...map[col]].sort((a, b) => {
        const pa = primeiraAparicao.get(a.pedido_id)!;
        const pb = primeiraAparicao.get(b.pedido_id)!;
        return pa !== pb ? pa - pb : 0;
      });
    }
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

  /* Anexos genéricos do item — se a migration ainda não rodou, a query
     falha e a lista fica vazia (mesma degradação graciosa das etiquetas). */
  const [anexos, setAnexos] = useState<AnexoRow[]>([]);
  const carregarAnexos = async (producaoId: string) => {
    const { data, error } = await (supabase as any)
      .from("sistema_producao_anexos")
      .select("id, producao_item_id, categoria, tipo, url, nome_arquivo, vendedor_id, created_at")
      .eq("producao_item_id", producaoId)
      .order("created_at", { ascending: false });
    if (error) { setAnexos([]); return; }
    setAnexos((data as AnexoRow[]) ?? []);
  };
  useEffect(() => {
    if (!detalheId) { setAnexos([]); return; }
    carregarAnexos(detalheId);
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

  /* Resolve contra o catálogo mestre (sistema_etiquetas) antes de criar
     etiqueta nova — é isso que impede "Comprado XBZ" e "comprado xbz"
     virarem duas etiquetas diferentes. Se já existe (mesmo nome, sem
     diferenciar maiúsc/minúsc), reusa a grafia canônica do catálogo; só
     cria uma linha nova se realmente não existir ainda. */
  const resolverOuCriarEtiquetaMestre = async (texto: string): Promise<string> => {
    const existente = etiquetasMestre.find(e => e.nome.toLowerCase() === texto.toLowerCase());
    if (existente) return existente.nome;
    const { data, error } = await (supabase as any)
      .from("sistema_etiquetas")
      .insert({ nome: texto })
      .select("nome")
      .single();
    if (!error && data) {
      queryClient.invalidateQueries({ queryKey: ["sistema", "pcp", "etiquetas-mestre"] });
      return (data as { nome: string }).nome;
    }
    // Conflito (outra aba criou ao mesmo tempo) ou tabela ainda não migrada
    // no banco — segue com o texto digitado, sem travar a ação do usuário.
    return texto;
  };

  const adicionarTag = async (row: PcpRow, valor: string) => {
    const bruto = valor.trim();
    if (!bruto) return;
    const t = await resolverOuCriarEtiquetaMestre(bruto);
    const atuais = row.tags ?? [];
    if (atuais.some(x => x.toLowerCase() === t.toLowerCase())) return;
    await salvarTags(row, [...atuais, t]);
  };

  const removerTag = async (row: PcpRow, valor: string) => {
    await salvarTags(row, (row.tags ?? []).filter(t => t !== valor));
  };

  /* "poder registrar a compra: comprado xbz / comprado china... cria
     automaticamente uma tag sobre a imagem" — ação de um clique, sem popup:
     é só marcar que a compra já foi feita e qual fornecedor. */
  const registrarCompra = async (row: PcpRow, origem: "XBZ" | "SP") => {
    await adicionarTag(row, origem === "XBZ" ? "COMPRADO XBZ" : "COMPRADO SP");
    await applyUpdate(row.producao_id, { compra_confirmada_em: new Date().toISOString() });
    await registrarNotaHistorico(row, `Compra registrada: ${origem === "XBZ" ? "Comprado XBZ" : "Comprado SP"}`);
  };

  /* ── "IMPRIMIR O.P." — só no item 1 do pedido, na 1a coluna. Baixa o
     PDF da ordem de produção e já move (o item e o grupo dele, se
     tiver) pra Aguardando Mercadoria, sem precisar arrastar. ────────── */
  const [imprimindoOP, setImprimindoOP] = useState<string | null>(null);
  const imprimirOP = async (row: PcpRow) => {
    setImprimindoOP(row.producao_id);
    try {
      const { data: p, error } = await supabase.from("sistema_pedidos").select("*").eq("id", row.pedido_id).maybeSingle();
      if (error || !p) throw error ?? new Error("Pedido não encontrado");
      const pedidoMapeado: Pedido = {
        id: p.id, numero: p.numero, orcamentoId: p.orcamento_id ?? "", clienteId: p.cliente_id ?? "",
        clienteSnapshot: (p.cliente_snapshot as never) ?? undefined,
        contatoNome: p.contato_nome ?? undefined, contatoTelefone: p.contato_telefone ?? undefined,
        contatoEmail: p.contato_email ?? undefined, vendedorId: p.vendedor_id ?? undefined,
        itens: (p.itens as unknown as PedidoItem[]) ?? [], subtotal: Number(p.subtotal) || 0,
        freteTipo: (p.frete_tipo as "CIF" | "FOB" | null) ?? null, freteValor: Number(p.frete_valor) || 0,
        total: Number(p.total) || 0, transportadoraId: p.transportadora_id ?? undefined,
        prazoEntrega: p.prazo_entrega ?? undefined, pagamentoId: p.pagamento_id ?? undefined,
        observacoes: p.observacoes ?? undefined, status: p.status as Pedido["status"],
        createdAt: p.created_at, updatedAt: p.updated_at,
        prazoProducaoDias: p.prazo_producao_dias ?? undefined,
        dataProduzirAte: p.data_produzir_ate ?? undefined,
        dataDespacharAte: p.data_despachar_ate ?? undefined,
      };
      await gerarOrdemProducaoPDF(pedidoMapeado, { clientes, vendedores, transportadoras: transportadorasCadastro });
      moverItem(row, "aguardando_mercadoria", "Ordem de produção impressa");
      toast.success("Ordem de produção baixada. Item movido para Aguardando Mercadoria.");
    } catch (err) {
      console.error("[PCP] imprimir O.P. falhou:", err);
      toast.error("Não foi possível gerar a ordem de produção.");
    } finally {
      setImprimindoOP(null);
    }
  };

  /* ── Agrupar produtos do mesmo pedido — só na 1a coluna. Itens no
     mesmo grupo se movem juntos pelo resto do fluxo (ver moverItem). */
  const [agrupamentoModal, setAgrupamentoModal] = useState<{ row: PcpRow } | null>(null);
  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set());

  const abrirAgrupamento = (row: PcpRow) => {
    setAgrupamentoModal({ row });
    setItensSelecionados(new Set(row.grupo_id ? rows.filter(r => r.grupo_id === row.grupo_id).map(r => r.producao_id) : [row.producao_id]));
  };

  const confirmarAgrupamento = async () => {
    if (!agrupamentoModal) return;
    const grupoId = agrupamentoModal.row.grupo_id ?? crypto.randomUUID();
    for (const id of itensSelecionados) await applyUpdate(id, { grupo_id: grupoId });
    setAgrupamentoModal(null);
    toast.success(`${itensSelecionados.size} itens agrupados — vão seguir o fluxo juntos.`);
  };

  const desfazerAgrupamento = async (row: PcpRow) => {
    if (!row.grupo_id) return;
    const irmaos = rows.filter(r => r.grupo_id === row.grupo_id);
    for (const irmao of irmaos) await applyUpdate(irmao.producao_id, { grupo_id: null });
    toast.success("Agrupamento desfeito.");
  };

  /* ── Anexo de teste físico ────────────────────────────────────────────
     "vai ter um campo no produto escrito 'teste' onde a produção anexa a
     foto p/ vendedor baixar e mandar p cliente. nesse mesmo tempo,
     automaticamente se a produção adiciona o anexo, já adiciona a tag
     TESTE ENVIADO". Reenviar um teste novo LIMPA a aprovação anterior — faz
     sentido: se a foto mudou, a aprovação antiga não vale mais pra essa. */
  /* Grava na tabela de anexos genéricos, além do campo automatizado
     (teste_anexo_url/producao_anexo_url) — não substitui a automação de
     tags, só espelha pra a seção "Anexos" mostrar tudo num lugar só.
     Se a migration ainda não rodou, falha em silêncio (não bloqueia o
     upload real, que já foi salvo no campo automatizado). */
  const registrarAnexoGenerico = async (
    row: PcpRow, categoria: AnexoCategoria, tipo: AnexoRow["tipo"], url: string, nomeArquivo?: string,
  ): Promise<boolean> => {
    const { error } = await (supabase as any).from("sistema_producao_anexos").insert({
      producao_item_id: row.producao_id,
      pedido_id: row.pedido_id,
      categoria, tipo, url,
      nome_arquivo: nomeArquivo ?? null,
      vendedor_id: currentVendedor?.id ?? null,
    });
    if (detalheIdRef.current === row.producao_id) await carregarAnexos(row.producao_id);
    return !error;
  };

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
      /* "caso anexem um novo teste depois, sai a tag TESTE RECUSADO pra
         TESTE REFEITO" — se já tinha sido recusado, essa é a segunda (ou
         mais) tentativa; senão é a primeira, TESTE ENVIADO mesmo. */
      const jaFoiRecusado = (row.tags ?? []).includes(TAG_TESTE_RECUSADO);
      const semFluxoTeste = (row.tags ?? []).filter(t => !TAGS_FLUXO_TESTE.includes(t));
      await salvarTags(row, [...new Set([...semFluxoTeste, jaFoiRecusado ? TAG_TESTE_REFEITO : TAG_TESTE_ENVIADO])]);
      await registrarAnexoGenerico(row, "teste", "foto", url, file.name);
      /* Anexar o teste move o card de "Aguardando Teste" pra "Teste
         Enviado" -- as duas colunas existem justamente pra separar
         quem ainda não tem teste feito de quem já mandou e espera
         resposta do cliente. Só avança se ainda estava em Aguardando
         Teste (reenviar um teste novo mais adiante no fluxo não deve
         voltar o card pra trás). */
      if (colunaDoStatus(row) === "teste_fisico") {
        await mudarStatus(row.producao_id, statusCanonicoDaColuna("teste_enviado"), "Teste físico anexado");
      }
      toast.success("Teste anexado. Baixe e mande para o cliente aprovar.");
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o anexo.");
    } finally {
      setEnviandoTeste(false);
    }
  };

  /* "se aprovar ele vai para a coluna A PRODUZIR e continua com a tag
     (galpão ou terceirizada) e adiciona também TESTE APROVADO" — ação do
     vendedor, não da produção (é ele quem sabe se o cliente aprovou). */
  const aprovarTeste = async (row: PcpRow) => {
    const semFluxoTeste = (row.tags ?? []).filter(t => !TAGS_FLUXO_TESTE.includes(t));
    await salvarTags(row, [...new Set([...semFluxoTeste, TAG_TESTE_APROVADO])]);
    await mudarStatus(row.producao_id, statusCanonicoDaColuna("em_producao"), "Teste aprovado pelo cliente");
    toast.success("Teste aprovado. Item movido para A Produzir.");
  };

  /* "se reprovado, volta para a coluna Aguardando Teste e adiciona a tag
     TESTE RECUSADO" — mantém a tag de galpão/terceirizada, só troca o
     status do teste. */
  const reprovarTeste = async () => {
    if (!recusaModal) return;
    const row = recusaModal;
    const motivo = recusaMotivo.trim();
    if (!motivo) { toast.error("Descreva o motivo da recusa."); return; }
    setRecusaSaving(true);

    // O motivo vira observação do produto no pedido, para ficar registrado junto do item.
    const { data: prod } = await supabase
      .from("sistema_producao_itens" as any).select("item_id").eq("id", row.producao_id).single();
    const { data: ped } = await supabase
      .from("sistema_pedidos").select("itens").eq("id", row.pedido_id).single();
    const itemId = (prod as any)?.item_id as string | undefined;
    const itens = ((ped as any)?.itens ?? []) as Record<string, any>[];
    if (itemId && itens.some(i => i.id === itemId)) {
      const nota = `TESTE RECUSADO (${new Date().toLocaleDateString("pt-BR")}): ${motivo}`;
      const novosItens = itens.map(i => i.id !== itemId ? i : {
        ...i, observacao: i.observacao ? `${i.observacao}\n${nota}` : nota,
      });
      const { error } = await supabase.from("sistema_pedidos").update({ itens: novosItens } as any).eq("id", row.pedido_id);
      if (error) {
        toast.error(`Não foi possível gravar o motivo no pedido. ${error.message || ""}`);
        setRecusaSaving(false);
        return;
      }
    }

    const semFluxoTeste = (row.tags ?? []).filter(t => !TAGS_FLUXO_TESTE.includes(t));
    await salvarTags(row, [...new Set([...semFluxoTeste, TAG_TESTE_RECUSADO])]);
    await mudarStatus(row.producao_id, statusCanonicoDaColuna("teste_fisico"), `Teste recusado pelo cliente: ${motivo}`);
    setRecusaSaving(false);
    setRecusaModal(null);
    void loadItems();
    toast.success("Teste recusado. Motivo registrado no pedido e item voltou para Aguardando Teste.");
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
      await registrarAnexoGenerico(row, "producao", tipo, url, file.name);
      /* "assim que adicionado automaticamente ele já vai para a coluna de
         Expedição" — mantém a tag de galpão/terceirizada e TESTE APROVADO
         (histórico de como chegou até aqui), só limpa o que já não serve
         mais (ENVIADO/REFEITO, caso sobrado). Usa uma cópia local do row
         (com a mídia já "anexada" nela) em vez de reler `rows` do estado —
         o state ainda não tinha sido commitado quando esse código roda
         logo após o applyUpdate, o que faria os gates abaixo verem o item
         como se a mídia não existisse. */
      /* A mídia sai antes de a caixa ser fechada e medida, então o item vai
         pra "Inserir Medidas" sem popup; os volumes são preenchidos lá. O
         pagamento vira tag aqui, que é quando o vendedor precisa cobrar. */
      const tagPagamento = tagPagamentoDoPedido(row.pagamento_nome);
      const tagsFinais = [...new Set([
        ...(row.tags ?? []).filter(t => t !== TAG_TESTE_ENVIADO && t !== TAG_TESTE_REFEITO),
        ...(tagPagamento ? [tagPagamento] : []),
      ])];
      await salvarTags(row, tagsFinais);

      const movido = colunaDoStatus(row) === "em_producao";
      if (movido) moverItem(row, "inserir_medidas", `${tipo === "video" ? "Vídeo" : "Foto"} da produção concluída anexado`);
      toast.success(`${tipo === "video" ? "Vídeo" : "Foto"} anexado.${movido ? " Item foi para Inserir Medidas." : ""}`);
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o anexo.");
    } finally {
      setEnviandoProducaoAnexo(false);
    }
  };

  const removerAnexo = async (anexo: AnexoRow) => {
    setAnexos(prev => prev.filter(a => a.id !== anexo.id));
    const { error } = await (supabase as any).from("sistema_producao_anexos").delete().eq("id", anexo.id);
    if (error) {
      toast.error(`Não foi possível remover o anexo. ${error.message || ""}`);
      await carregarAnexos(anexo.producao_item_id);
    }
  };

  const abrirSeletorAnexoGenerico = (row: PcpRow, categoria: AnexoCategoria) => {
    anexoGenericoAlvoRef.current = { row, categoria };
    anexoGenericoInputRef.current?.click();
  };

  const handleAnexoGenerico = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const alvo = anexoGenericoAlvoRef.current;
    e.target.value = "";
    if (!file || !alvo) return;
    setEnviandoAnexoGenerico(true);
    try {
      const { url, tipo } = await uploadAnexoGenerico(file, alvo.row.producao_id, alvo.categoria);
      const ok = await registrarAnexoGenerico(alvo.row, alvo.categoria, tipo, url, file.name);
      if (ok) toast.success("Anexo adicionado.");
      else toast.error("O arquivo foi enviado, mas o catálogo de anexos ainda não existe no banco (rode a migration).");
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o anexo.");
    } finally {
      setEnviandoAnexoGenerico(false);
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

  const openGalpaoTerceirizadaModal = (row: PcpRow, target: PcpStatus) => {
    setGalpaoTerceirizadaModal({ row, target });
    setModalTipoProducao(row.local_producao === "interna" ? "galpao" : "terceirizada");
    setModalFornecedorId(row.terceirizada_id || "");
    setModalTerceirizadaLivre(row.terceirizada_nome_livre || "");
  };

  /* Grava o gate de pagamento para todos os itens do pedido */
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

  /* "quero que o histórico seja bem detalhado" — para ações que não mudam
     de coluna (registrar compra, confirmar despacho, anexar arquivo) o
     RPC de mudar status não serve (não há status novo pra gravar); grava
     uma linha de histórico direto, sem mudar nada além do registro. */
  const registrarNotaHistorico = async (row: PcpRow, texto: string) => {
    const { data, error } = await supabase.from("sistema_producao_historico").insert({
      producao_item_id: row.producao_id,
      status_anterior: null,
      status_novo: row.status,
      vendedor_id: currentVendedor?.id ?? null,
      observacao: texto,
    } as any).select("id").single();
    if (!error && detalheIdRef.current === row.producao_id && data) {
      setHistorico(prev => [{
        id: (data as any).id, producao_item_id: row.producao_id, status_anterior: null,
        status_novo: row.status, usuario_id: null, vendedor_id: currentVendedor?.id ?? null,
        observacao: texto, created_at: new Date().toISOString(),
      }, ...prev]);
    }
  };

  const moverItem = (row: PcpRow, targetStatus: PcpStatus, observacao?: string) => {
    /* Grava o STATUS canônico da coluna. targetStatus é nome de coluna
       ("em_producao"); o banco espera slug de status ("a_produzir"). */
    mudarStatus(row.producao_id, statusCanonicoDaColuna(targetStatus), observacao);
    /* "se a produção quiser, ela pode agrupar os produtos... pra eles
       seguirem as etapas do pcp juntos" — item com grupo_id arrasta os
       irmãos do mesmo grupo junto, sem passar pelos gates de novo (a
       validação já foi feita no item que a produção arrastou). */
    if (row.grupo_id) {
      const irmaos = rows.filter(r => r.grupo_id === row.grupo_id && r.producao_id !== row.producao_id);
      for (const irmao of irmaos) mudarStatus(irmao.producao_id, statusCanonicoDaColuna(targetStatus), "Movido junto com o grupo");
    }
  };

  const handleDrop = (targetStatus: PcpStatus, id: string) => {
    setDragOverStatus(null);
    setDraggingId(null);
    if (!id) return;
    const row = rows.find(r => r.producao_id === id);
    if (!row || colunaDoStatus(row) === targetStatus) return;

    /* "para ir p/ aguardando mercadoria abre um popup e o vendedor tem
       que anexar o comprovante de pagamento ou clicar em CONFIRMADO
       MARLON" — vale pro pedido inteiro, não item por item. */
    if (colunaDoStatus(row) === "organizando_pedido" && targetStatus === "aguardando_mercadoria") {
      setPagamentoPedidoModal({ row, target: targetStatus });
      return;
    }

    /* "assim que a produção arrasta o produto para aguardando teste,
       automaticamente já abre um popup perguntando se o teste vai ser
       feito no galpão ou na terceirizada" — a resposta vira tag, a
       coluna final é sempre "teste_fisico". */
    if (targetStatus === "teste_fisico" && colunaDoStatus(row) !== "teste_enviado") {
      openGalpaoTerceirizadaModal(row, targetStatus);
      return;
    }

    /* A mídia de produção é o que garante que o item terminou antes de ir
       pra Expedição — arrastar direto de "A Produzir" sem anexo não pode
       pular essa checagem (o caminho normal é anexar a mídia, que já move
       sozinho). */
    if ((targetStatus === "inserir_medidas" || targetStatus === "aguardando_coleta")
      && colunaDoStatus(row) === "em_producao" && !row.producao_anexo_url) {
      toast.error("Anexe a foto/vídeo da produção concluída antes de avançar.");
      return;
    }

    /* "só sai do Aguardando Teste e vai pra Teste Enviado se anexar o
       teste" — sem o anexo, arrastar manualmente pra qualquer coluna
       seguinte fica bloqueado; só avança com a foto/vídeo do teste. */
    if (colunaDoStatus(row) === "teste_fisico" && targetStatus !== "teste_fisico" && !row.teste_anexo_url) {
      toast.error("Anexe o teste físico antes de mover este item.");
      return;
    }

    /* Cada item abre seu próprio popup de volumes/expedição — não espera
       mais o pedido inteiro chegar junto (uma caixa pode não levar todos
       os itens do pedido). */
    if (targetStatus === "aguardando_coleta") {
      setExpedicaoModal({ row, target: targetStatus });
      return;
    }

    /* "depois que a mercadoria já está aguardando teste, a tag comprado
       xbz já pode sair automaticamente" — cumpriu o propósito (avisar que
       a compra foi feita), não precisa mais poluir o card daqui em diante. */
    if (colunaDoStatus(row) === "aguardando_mercadoria" && targetStatus !== "aguardando_mercadoria") {
      const semCompra = (row.tags ?? []).filter(
        t => t.toUpperCase() !== "COMPRADO XBZ" && t.toUpperCase() !== "COMPRADO SP",
      );
      if (semCompra.length !== (row.tags ?? []).length) void salvarTags(row, semCompra);
    }

    moverItem(row, targetStatus);
  };

  /* "resposta se torna uma tag como TERCEIRIZADA + nome ou PROD. GALPÃO.
     e a tag COMPRADO já sai automaticamente" — confirma o local de
     produção e move pra Aguardando Teste. */
  const confirmarGalpaoTerceirizada = async () => {
    if (!galpaoTerceirizadaModal) return;
    const { row, target } = galpaoTerceirizadaModal;
    const fornecedor = terceirizadas.find(f => f.id === modalFornecedorId);
    const nomeLivre = modalTerceirizadaLivre.trim();
    if (modalTipoProducao === "terceirizada" && !modalFornecedorId && !nomeLivre) {
      toast.error("Selecione uma terceirizada cadastrada ou digite o nome dela");
      return;
    }
    setModalSaving(true);

    const localProducao: LocalProducao = modalTipoProducao === "galpao" ? "interna" : "terceirizada";
    await applyUpdate(row.producao_id, {
      local_producao: localProducao,
      terceirizada_id: modalTipoProducao === "terceirizada" ? (modalFornecedorId || null) : null,
      terceirizada_nome_livre: modalTipoProducao === "terceirizada" ? (fornecedor ? null : (nomeLivre || null)) : null,
    });

    const semCompra = (row.tags ?? []).filter(
      t => t.toUpperCase() !== "COMPRADO XBZ" && t.toUpperCase() !== "COMPRADO SP",
    );
    const nomeTerceirizada = fornecedor?.nome || nomeLivre;
    const novaTag = modalTipoProducao === "galpao" ? TAG_PROD_GALPAO : `${TAG_TERCEIRIZADA_PREFIXO} + ${nomeTerceirizada}`;
    await salvarTags(row, [...new Set([...semCompra, novaTag])]);

    await mudarStatus(row.producao_id, statusCanonicoDaColuna(target), `Produção definida: ${novaTag}`);

    setModalSaving(false);
    setGalpaoTerceirizadaModal(null);
  };

  /* ── Popup de pagamento (Organizando Anotações -> Aguardando Mercadoria) */
  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pagamentoPedidoModal) return;
    setEnviandoComprovante(true);
    try {
      const { url } = await uploadArquivoPedido(file, pagamentoPedidoModal.row.pedido_id);
      await confirmarPagamentoPedido(url);
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o comprovante.");
    } finally {
      setEnviandoComprovante(false);
    }
  };

  const confirmarPagamentoPedido = async (comprovanteUrl?: string) => {
    if (!pagamentoPedidoModal) return;
    const { row, target } = pagamentoPedidoModal;
    setPagamentoPedidoSaving(true);

    const { error } = await supabase
      .from("sistema_pedidos")
      .update({ comprovante_pagamento_url: comprovanteUrl ?? "confirmado-manualmente" } as any)
      .eq("id", row.pedido_id);
    if (error) {
      console.error("[PCP] gravar comprovante falhou:", error);
      toast.error(`Não foi possível salvar. ${error.message || ""}`);
      setPagamentoPedidoSaving(false);
      return;
    }

    await mudarStatus(
      row.producao_id, statusCanonicoDaColuna(target),
      comprovanteUrl ? "Comprovante de pagamento anexado" : "Pagamento confirmado manualmente",
    );
    setPagamentoPedidoSaving(false);
    setPagamentoPedidoModal(null);
    toast.success("Pagamento confirmado. Item movido para Aguardando Mercadoria.");
  };

  /* ── Popup de Expedição ────────────────────────────────────────────── */
  const addVolume = () =>
    setExpedicaoVolumes(prev => [...prev, { comprimento: "", altura: "", largura: "", peso: "" }]);

  const removerVolume = (idx: number) =>
    setExpedicaoVolumes(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const setVolumeCampo = (idx: number, campo: "comprimento" | "altura" | "largura" | "peso", valor: string) =>
    setExpedicaoVolumes(prev => prev.map((v, i) => (i === idx ? { ...v, [campo]: valor } : v)));

  /* Tag de pagamento automática — PIX 50%+50% cobra o restante, cartão
     (qualquer parcelamento) já está pago. Não pergunta mais nada pro
     vendedor, só lê a condição de pagamento que já está no pedido. */
  const tagPagamentoDoPedido = (nome: string | null) =>
    isPagamentoCartao(nome)
      ? TAG_PAGO_CARTAO
      : (isPagamentoPix(nome) && semAcento(nome ?? "").includes("50"))
        ? TAG_COBRAR_RESTANTE
        : null;

  /* "na transferência do a produzir para expedição, todas as tags são
     excluídas" — troca completa, não acumula com o que o item tinha
     (galpão/terceirizada, teste aprovado etc.): só o que interessa pra
     quem vai embalar/despachar. */
  const aplicarVolumesNoItem = async (
    row: PcpRow, target: PcpStatus,
    volumesPayload: { responsavel: string; itens: { comprimento: number; altura: number; largura: number; peso: number }[] },
    observacaoHistorico: string,
  ) => {
    setExpedicaoSaving(true);
    const { error } = await supabase
      .from("sistema_producao_itens" as any)
      .update({ volumes: volumesPayload })
      .eq("id", row.producao_id);
    if (error) {
      console.error("[PCP] gravar volumes falhou:", error);
      toast.error(`Não foi possível salvar a expedição. ${error.message || ""}`);
      setExpedicaoSaving(false);
      return;
    }

    await salvarTags(row, agruparVolumesEmTags(volumesPayload.itens));

    await mudarStatus(row.producao_id, statusCanonicoDaColuna(target), observacaoHistorico);

    setExpedicaoSaving(false);
    setExpedicaoModal(null);
    toast.success("Expedição registrada.");
  };

  const confirmarExpedicao = async () => {
    if (!expedicaoModal) return;
    if (!expedicaoResponsavel.trim()) {
      toast.error("Informe o nome do responsável pela medição.");
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

    const { row, target } = expedicaoModal;
    await aplicarVolumesNoItem(
      row, target,
      { responsavel: expedicaoResponsavel.trim(), itens: volumesNumericos },
      `Expedição registrada por ${expedicaoResponsavel.trim()}`,
    );
  };

  /* "se um produto já está com as informações o restante pode clicar em
     algo tipo JÁ PREENCHIDO" — reaproveita o volume de um item-irmão do
     mesmo pedido (mesma caixa), sem digitar tudo de novo. */
  const usarVolumeDeItemIrmao = async (origem: PcpRow) => {
    if (!expedicaoModal || !origem.item_volumes) return;
    const { row, target } = expedicaoModal;
    await aplicarVolumesNoItem(
      row, target, origem.item_volumes,
      `Expedição: mesma caixa do item "${origem.produto_nome}"`,
    );
  };

  /* Reseta o formulário sempre que o popup abre para um pedido novo —
     senão os volumes digitados no pedido anterior vazariam para este. */
  useEffect(() => {
    if (!expedicaoModal) return;
    setExpedicaoVolumes([{ comprimento: "", altura: "", largura: "", peso: "" }]);
    setExpedicaoResponsavel(currentVendedor?.nome ?? "");
  }, [expedicaoModal, currentVendedor]);

  /* ── "Confirmar despacho" — nota fiscal + etiqueta + transportadora.
     Ao confirmar, TODAS as tags do item saem e só fica "DESPACHAR + nome
     da transportadora" — é a última coisa que o vendedor precisa ver no
     card antes da coleta de verdade acontecer (que aí sim move pra
     "Coletado e Enviado", arrastando manualmente). ────────────────────── */
  const abrirDespachoModal = (row: PcpRow) => {
    setDespachoModal({ row });
    setDespachoTransportadora("");
    setDespachoTransportadoraLivre("");
    setDespachoNotaFiscalUrl(null);
    setDespachoEtiquetaUrl(null);
  };

  const handleDespachoArquivo = async (e: React.ChangeEvent<HTMLInputElement>, tipo: "nota_fiscal" | "etiqueta") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !despachoModal) return;
    setEnviandoDespachoArquivo(tipo);
    try {
      const { url } = await uploadArquivoPedido(file, despachoModal.row.pedido_id);
      if (tipo === "nota_fiscal") setDespachoNotaFiscalUrl(url); else setDespachoEtiquetaUrl(url);
      await registrarAnexoGenerico(despachoModal.row, tipo, "pdf", url, file.name);
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setEnviandoDespachoArquivo(null);
    }
  };

  const confirmarDespacho = async () => {
    if (!despachoModal) return;
    const transp = despachoTransportadoraLivre.trim() || despachoTransportadora;
    if (!transp) { toast.error("Informe a transportadora."); return; }
    if (!despachoNotaFiscalUrl) { toast.error("Anexe a nota fiscal."); return; }
    if (!despachoEtiquetaUrl) { toast.error("Anexe a etiqueta de envio."); return; }

    setDespachoSaving(true);
    const { row } = despachoModal;
    await salvarTags(row, [`${TAG_DESPACHAR_PREFIXO} ${transp}`]);
    await registrarNotaHistorico(row, `Despacho confirmado: nota fiscal e etiqueta anexadas, transportadora ${transp}`);
    setDespachoSaving(false);
    setDespachoModal(null);
    toast.success("Despacho confirmado.");
  };

  const totalItens = rowsFiltradas.length;

  return (
    <div className="space-y-4 min-w-0">
      {/* Inputs de arquivo escondidos — acionados pelos botões de anexo do
          modal de detalhe. Ficam montados sempre (não só quando o modal está
          aberto) pra não perder a seleção do usuário entre o clique e o
          re-render. */}
      <input ref={testeInputRef} type="file" accept="image/*" className="hidden" onChange={handleAnexoTeste} />
      <input ref={producaoAnexoInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleAnexoProducao} />
      <input ref={anexoGenericoInputRef} type="file" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleAnexoGenerico} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gw-display">PCP — Produção</h1>
          <p className="gw-meta">
            Acompanhe cada item de pedido pelo fluxo de produção. Arraste os cards entre as colunas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-[8px] border border-[var(--gw-border)] overflow-hidden text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => setComFotos(true)}
              className={cn("px-3 py-1.5 transition-colors", comFotos ? "text-white" : "bg-white text-[var(--gw-text-secondary)]")}
              style={comFotos ? { backgroundColor: "var(--gw-primary)" } : undefined}
            >
              Com fotos
            </button>
            <button
              type="button"
              onClick={() => setComFotos(false)}
              className={cn("px-3 py-1.5 transition-colors", !comFotos ? "text-white" : "bg-white text-[var(--gw-text-secondary)]")}
              style={!comFotos ? { backgroundColor: "var(--gw-primary)" } : undefined}
            >
              Sem fotos
            </button>
          </div>
          <span className="gw-meta">{totalItens} item(ns)</span>
          <Button variant="outline" size="sm" onClick={() => loadItems()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map(c => (
            <div key={c} className="w-[328px] shrink-0 space-y-3">
              <div className="animate-pulse h-8 rounded-lg bg-muted" />
              {[0, 1].map(i => (
                <div key={i} className="animate-pulse rounded-xl bg-muted" style={{ height: 230 }} />
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
                  style={{ width: 328, flexShrink: 0, height: "100%" }}
                  className={cn(
                    "rounded-xl border transition-colors flex flex-col overflow-hidden",
                    isOver ? "border-[#2563EB] bg-[#2563EB]/5" : "border-[var(--gw-border)] bg-white/60"
                  )}
                >
                  <div
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-white shrink-0"
                    style={{ backgroundColor: col.color }}
                  >
                    {/* Nome inteiro, sempre: quebra em duas linhas em vez de
                        virar "Aguardando Me…". */}
                    {/* A cor vai inline: .gw-title/.gw-body definem color no
                        index.css e ganham do text-white do Tailwind. */}
                    <span className="gw-title text-[14px] leading-tight" style={{ fontWeight: 700, color: "#FFFFFF" }}>{col.label}</span>
                    <span
                      className="gw-body text-[11px] rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap"
                      style={{ backgroundColor: "rgba(255,255,255,.28)", color: "#FFFFFF", fontWeight: 700 }}
                    >
                      {items.length} · {somaQtd} un.
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
                        atrasado={horasUteisDesde(row.etapa_desde) > LIMITE_ATENCAO_HORAS_UTEIS}
                        critico={(row.horas_na_etapa ?? 0) / 24 > LIMITE_CRITICO_DIAS_CORRIDOS}
                        highlight={!!hoverPedido && hoverPedido === row.pedido_id}
                        comFotos={comFotos}
                        vendedorNome={vendedorNome(row.pedido_vendedor_id)}
                        onHover={setHoverPedido}
                        onComprado={registrarCompra}
                        onDespachar={abrirDespachoModal}
                        onImprimirOP={imprimirOP}
                        onAgrupar={abrirAgrupamento}
                        onDesagrupar={desfazerAgrupamento}
                        onInserirMedidas={r => setExpedicaoModal({ row: r, target: "aguardando_coleta" })}
                        imprimindoOP={imprimindoOP === row.producao_id}
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

      {/* Painel de detalhe do item — popup centralizado, largo (landscape),
          3 colunas pra caber bastante informação sem precisar rolar tanto. */}
      <Dialog open={!!detalhe} onOpenChange={open => !open && setDetalheId(null)}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden rounded-[12px] border-[var(--gw-border)]"
          style={{ maxWidth: 1180, width: "94vw", maxHeight: "88vh", boxShadow: "var(--gw-shadow-lg)" }}
        >
          {detalhe && (
            <div className="grid grid-rows-[auto_1fr] max-h-[88vh]">
              <DialogHeader className="px-6 py-4 border-b border-[var(--gw-border)] text-left">
                <DialogTitle className="flex items-center gap-3 pr-8 text-left">
                  <OrderNumber value={detalhe.pedido_numero} />
                  <span className="gw-title text-[15px] truncate">{detalhe.cliente || "—"}</span>
                  <StatusPill status={detalhe.status} />
                  <span className="flex-1" />
                  <VendedorAvatar nome={vendedorNome(detalhe.pedido_vendedor_id)} />
                </DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-[300px_1fr_340px] min-h-0 overflow-hidden">
                {/* Coluna 1 — imagem */}
                <div className="bg-[var(--gw-surface-alt)] p-4 overflow-y-auto border-r border-[var(--gw-border)]">
                  {detalhe.mockup_url || detalhe.imagem_catalogo_url ? (
                    <>
                      <img
                        src={sizedImage(detalhe.mockup_url || detalhe.imagem_catalogo_url!, 640)}
                        alt={detalhe.produto_nome || ""}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-[260px] object-contain bg-white rounded-lg border border-[var(--gw-border)]"
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
                    <div className="w-full h-[260px] rounded-lg bg-white border border-[var(--gw-border)] flex items-center justify-center">
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

                  <div className="mt-4 space-y-3">
                    <p className="gw-title text-[15px]">{detalhe.produto_nome || "—"}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Quantidade", `${detalhe.quantidade ?? 0} un`],
                        ["Técnica", detalhe.tecnica_nome || "—"],
                        ["Local de produção", detalhe.local_producao.replace(/_/g, " ")],
                        ...((detalhe.terceirizada_nome || detalhe.terceirizada_nome_livre)
                          ? [["Terceirizada", detalhe.terceirizada_nome || detalhe.terceirizada_nome_livre]] : []),
                        ...(detalhe.previsao_retorno ? [["Previsão de retorno", formatDate(detalhe.previsao_retorno) || "—"]] : []),
                        ["Produzir até", formatDate(detalhe.data_entrega_item) || "—"],
                        ["Tempo na etapa", tempoNaEtapa(detalhe.horas_na_etapa) || "—"],
                      ].map(([k, v]) => (
                        <div key={k as string}>
                          <p className="gw-label">{k}</p>
                          <p className="gw-body text-[13px] text-[var(--gw-text)] capitalize truncate">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                    {TERCEIRIZADA_TRIGGER.includes(detalhe.local_producao) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDetalheId(null); openGalpaoTerceirizadaModal(detalhe, colunaDoStatus(detalhe) as PcpStatus); }}
                      >
                        <ShoppingBag className="h-4 w-4 mr-2" /> Dados da terceirizada
                      </Button>
                    )}
                  </div>
                </div>

                {/* Coluna 2 — etiquetas, teste, produção, observações */}
                <div className="overflow-y-auto border-r border-[var(--gw-border)]">
                  {/* Etiquetas */}
                  <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
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
                    <EtiquetaCombobox
                      opcoes={todasTags}
                      onSelect={nome => adicionarTag(detalhe, nome)}
                    />
                  </div>

                  {/* Teste físico — só aparece na etapa certa, ou depois de já
                      ter anexo (pra continuar visível como registro). */}
                  {(detalhe.coluna_pcp === "teste_fisico" || detalhe.coluna_pcp === "teste_enviado" || detalhe.teste_anexo_url) && (
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

                      {/* Aprovação/recusa é ação do VENDEDOR (ele que sabe se o
                          cliente aprovou), não da produção. */}
                      {(detalhe.tags ?? []).includes(TAG_TESTE_APROVADO) ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--gw-success)" }}>
                          <CheckCircle2 className="h-4 w-4" /> Teste aprovado pelo cliente
                        </span>
                      ) : (detalhe.tags ?? []).includes(TAG_TESTE_RECUSADO) ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--gw-danger)" }}>
                          <X className="h-4 w-4" /> Teste recusado — anexe um novo teste quando refeito
                        </span>
                      ) : (detalhe.coluna_pcp === "teste_enviado" || (detalhe.tags ?? []).includes(TAG_TESTE_ENVIADO) || (detalhe.tags ?? []).includes(TAG_TESTE_REFEITO)) && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => aprovarTeste(detalhe)} style={{ backgroundColor: "var(--gw-success)" }}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Cliente aprovou
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRecusaMotivo(""); setRecusaModal(detalhe); }} style={{ color: "var(--gw-danger)", borderColor: "var(--gw-danger)" }}>
                            <X className="h-4 w-4 mr-2" /> Cliente recusou
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Produção concluída — foto ou vídeo do pedido 100% pronto.
                      Aparece nas duas colunas de produção (galpão e
                      terceirizada) e também em Produzido, pra poder trocar o
                      anexo depois se precisar. */}
                  {(detalhe.coluna_pcp === "em_producao" || detalhe.coluna_pcp === "em_producao_terceirizada" ||
                    detalhe.coluna_pcp === "produzido" || detalhe.producao_anexo_url) && (
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
                  <div className="px-5 py-4 space-y-3">
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

                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
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
                </div>

                {/* Coluna 3 — anexos (unificados) + histórico */}
                <div className="overflow-y-auto">
                  {/* Anexos do pedido — o que já foi anexado na tela de criar/
                      editar pedido (arte de personalização do item + anexos
                      gerais do pedido). Só leitura aqui: pra trocar, edita no
                      pedido — é de lá que vem. */}
                  {(detalhe.arte_anexo_url || (detalhe.pedido_anexos?.length ?? 0) > 0) && (
                    <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                      <p className="gw-label flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" /> Anexos do pedido
                      </p>
                      <div className="space-y-1.5">
                        {detalhe.arte_anexo_url && (
                          <a
                            href={detalhe.arte_anexo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 rounded-[8px] border border-[var(--gw-border)] px-2.5 py-2 hover:border-[var(--gw-border-strong)]"
                          >
                            <FileText className="h-8 w-8 p-1.5 rounded bg-[var(--gw-surface-alt)] text-[var(--gw-text-secondary)] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-[var(--gw-text)] truncate">Arte de personalização</p>
                              <p className="text-[11px] text-[var(--gw-text-muted)]">Anexado no item do pedido</p>
                            </div>
                            <Download className="h-4 w-4 shrink-0 text-[var(--gw-primary)]" />
                          </a>
                        )}
                        {(detalhe.pedido_anexos ?? []).map(a => (
                          <a
                            key={a.url}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 rounded-[8px] border border-[var(--gw-border)] px-2.5 py-2 hover:border-[var(--gw-border-strong)]"
                          >
                            <FileText className="h-8 w-8 p-1.5 rounded bg-[var(--gw-surface-alt)] text-[var(--gw-text-secondary)] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-[var(--gw-text)] truncate">{a.nome}</p>
                              <p className="text-[11px] text-[var(--gw-text-muted)]">Anexo geral do pedido</p>
                            </div>
                            <Download className="h-4 w-4 shrink-0 text-[var(--gw-primary)]" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Despacho — nota fiscal + etiqueta de envio + transportadora.
                      Mesma ação do botão no card, só que acessível também
                      por quem já está com o painel aberto (não só arrastando
                      no quadro). */}
                  {detalhe.coluna_pcp === "inserir_medidas" && (
                    <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                      <p className="gw-label flex items-center gap-1.5">
                        <Boxes className="h-3.5 w-3.5" /> Medidas da caixa
                      </p>
                      <Button size="sm" onClick={() => { setDetalheId(null); setExpedicaoModal({ row: detalhe, target: "aguardando_coleta" }); }} style={{ backgroundColor: "#0B8177" }}>
                        <Boxes className="h-4 w-4 mr-2" /> Inserir medidas
                      </Button>
                    </div>
                  )}

                  {detalhe.coluna_pcp === "aguardando_coleta" && (
                    <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2">
                      <p className="gw-label flex items-center gap-1.5">
                        <Boxes className="h-3.5 w-3.5" /> Despacho
                      </p>
                      {(detalhe.tags ?? []).some(t => t.toUpperCase().startsWith(TAG_DESPACHAR_PREFIXO)) ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--gw-success)" }}>
                          <CheckCircle2 className="h-4 w-4" /> Despacho confirmado
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => { setDetalheId(null); abrirDespachoModal(detalhe); }} style={{ backgroundColor: "#0EA5E9" }}>
                          <Upload className="h-4 w-4 mr-2" /> Anexar nota fiscal e etiqueta
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Anexos do PCP — logo, mockup, etiqueta, nota fiscal e
                      qualquer outro arquivo adicionado aqui (independente da
                      automação de teste/produção, que continua funcionando
                      do jeito que já funcionava). */}
                  <div className="px-5 py-4 border-b border-[var(--gw-border)] space-y-2.5">
                    <p className="gw-label flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" /> Anexos do PCP
                    </p>
                    {anexos.length === 0 ? (
                      <p className="gw-body text-[13px] text-[var(--gw-text-muted)]">Nenhum anexo ainda.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {anexos.map(a => (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-[8px] border border-[var(--gw-border)] px-2.5 py-2">
                            {a.tipo === "foto" ? (
                              <img src={sizedImage(a.url, 80)} alt="" className="w-9 h-9 rounded object-cover border border-[var(--gw-border)] shrink-0" />
                            ) : a.tipo === "video" ? (
                              <Video className="h-9 w-9 p-2 rounded bg-[var(--gw-surface-alt)] text-[var(--gw-text-secondary)] shrink-0" />
                            ) : (
                              <FileText className="h-9 w-9 p-2 rounded bg-[var(--gw-surface-alt)] text-[var(--gw-text-secondary)] shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-[var(--gw-text)] truncate">
                                {ANEXO_CATEGORIA_LABEL[a.categoria]}{a.nome_arquivo ? ` · ${a.nome_arquivo}` : ""}
                              </p>
                              <p className="text-[11px] text-[var(--gw-text-muted)]">
                                {vendedorNome(a.vendedor_id) || "não identificado"} · {formatDateTime(a.created_at)}
                              </p>
                            </div>
                            <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0 text-[var(--gw-primary)]" aria-label="Abrir anexo">
                              <Download className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => removerAnexo(a)}
                              className="shrink-0 text-[var(--gw-text-muted)] hover:text-[var(--gw-danger)]"
                              aria-label="Remover anexo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={enviandoAnexoGenerico}>
                          {enviandoAnexoGenerico ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Adicionar anexo
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {(Object.keys(ANEXO_CATEGORIA_LABEL) as AnexoCategoria[]).map(cat => (
                          <DropdownMenuItem key={cat} onClick={() => abrirSeletorAnexoGenerico(detalhe, cat)}>
                            {ANEXO_CATEGORIA_LABEL[cat]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: agrupar itens do mesmo pedido (só na 1a coluna) */}
      <Dialog open={!!agrupamentoModal} onOpenChange={open => !open && setAgrupamentoModal(null)}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle>Agrupar produtos do pedido</DialogTitle>
          </DialogHeader>
          {agrupamentoModal && (
            <div className="space-y-2 py-1">
              <p className="text-[12px] text-[var(--gw-text-muted)]">
                Itens marcados seguem as etapas do PCP juntos — mover um move todos.
              </p>
              {rows.filter(r => r.pedido_id === agrupamentoModal.row.pedido_id
                && colunaDoStatus(r) === "organizando_pedido").map(item => (
                <label key={item.producao_id} className="flex items-center gap-2.5 rounded-lg border border-[var(--gw-border)] px-3 py-2 text-[13px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#2563EB]"
                    checked={itensSelecionados.has(item.producao_id)}
                    onChange={e => setItensSelecionados(prev => {
                      const novo = new Set(prev);
                      if (e.target.checked) novo.add(item.producao_id); else novo.delete(item.producao_id);
                      return novo;
                    })}
                  />
                  {item.produto_nome} — {item.quantidade} un.
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgrupamentoModal(null)}>Cancelar</Button>
            <Button onClick={confirmarAgrupamento} disabled={itensSelecionados.size < 2}>Agrupar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: galpão ou terceirizada (obrigatório ao entrar em "Aguardando Teste") */}
      <Dialog open={!!galpaoTerceirizadaModal} onOpenChange={open => !open && setGalpaoTerceirizadaModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Onde o teste vai ser feito?
            </DialogTitle>
          </DialogHeader>

          {galpaoTerceirizadaModal && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{galpaoTerceirizadaModal.row.produto_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {galpaoTerceirizadaModal.row.pedido_numero} · {galpaoTerceirizadaModal.row.cliente}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalTipoProducao("galpao")}
                  className={cn(
                    "h-16 rounded-lg text-sm font-semibold border transition-colors",
                    modalTipoProducao === "galpao" ? "text-white border-transparent" : "bg-white text-foreground border-border",
                  )}
                  style={modalTipoProducao === "galpao" ? { backgroundColor: "#2563EB" } : undefined}
                >
                  Produção no Galpão
                </button>
                <button
                  type="button"
                  onClick={() => setModalTipoProducao("terceirizada")}
                  className={cn(
                    "h-16 rounded-lg text-sm font-semibold border transition-colors",
                    modalTipoProducao === "terceirizada" ? "text-white border-transparent" : "bg-white text-foreground border-border",
                  )}
                  style={modalTipoProducao === "terceirizada" ? { backgroundColor: "#F97316" } : undefined}
                >
                  Terceirizada
                </button>
              </div>

              {modalTipoProducao === "terceirizada" && (
                <>
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
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGalpaoTerceirizadaModal(null)} disabled={modalSaving}>
              Cancelar
            </Button>
            <Button onClick={confirmarGalpaoTerceirizada} disabled={modalSaving}>
              {modalSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: pagamento (obrigatório ao sair de "Organizando Anotações" pra "Aguardando Mercadoria") */}
      <Dialog open={!!pagamentoPedidoModal} onOpenChange={open => !open && !pagamentoPedidoSaving && setPagamentoPedidoModal(null)}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento do pedido</DialogTitle>
          </DialogHeader>
          {pagamentoPedidoModal && (
            <div className="space-y-3 py-1">
              <p className="text-[13px] text-[var(--gw-text-secondary)]">
                Pedido {pagamentoPedidoModal.row.pedido_numero} — anexe o comprovante de pagamento ou confirme manualmente.
              </p>
              <input ref={comprovanteInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleComprovanteUpload} />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => comprovanteInputRef.current?.click()}
                disabled={enviandoComprovante || pagamentoPedidoSaving}
              >
                {enviandoComprovante ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Anexar comprovante de pagamento
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" /><span className="text-[11px] text-muted-foreground">ou</span><div className="h-px flex-1 bg-border" />
              </div>
              <Button
                className="w-full"
                style={{ backgroundColor: "var(--gw-success)" }}
                onClick={() => confirmarPagamentoPedido()}
                disabled={pagamentoPedidoSaving}
              >
                {pagamentoPedidoSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                CONFIRMADO MARLON
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar despacho (nota fiscal + etiqueta + transportadora, dentro de Expedição) */}
      <Dialog open={!!despachoModal} onOpenChange={open => !open && !despachoSaving && setDespachoModal(null)}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle>Confirmar despacho — Pedido {despachoModal?.row.pedido_numero}</DialogTitle>
          </DialogHeader>
          {despachoModal && (
            <div className="space-y-3 py-1">
              <input
                ref={despachoNotaFiscalInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => handleDespachoArquivo(e, "nota_fiscal")}
              />
              <input
                ref={despachoEtiquetaInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => handleDespachoArquivo(e, "etiqueta")}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => despachoNotaFiscalInputRef.current?.click()}
                disabled={enviandoDespachoArquivo === "nota_fiscal"}
              >
                {enviandoDespachoArquivo === "nota_fiscal" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {despachoNotaFiscalUrl ? "Nota fiscal anexada ✓" : "Anexar nota fiscal"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => despachoEtiquetaInputRef.current?.click()}
                disabled={enviandoDespachoArquivo === "etiqueta"}
              >
                {enviandoDespachoArquivo === "etiqueta" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {despachoEtiquetaUrl ? "Etiqueta anexada ✓" : "Anexar etiqueta de envio"}
              </Button>

              <div className="space-y-1.5">
                <Label>Transportadora</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TRANSPORTADORA_OPCOES.map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => { setDespachoTransportadora(op); setDespachoTransportadoraLivre(""); }}
                      className={cn(
                        "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
                        despachoTransportadora === op ? "text-white border-transparent" : "bg-white text-foreground border-border",
                      )}
                      style={despachoTransportadora === op ? { backgroundColor: corDaTag(op) } : undefined}
                    >
                      {op}
                    </button>
                  ))}
                </div>
                <Input
                  value={despachoTransportadoraLivre}
                  onChange={e => { setDespachoTransportadoraLivre(e.target.value); if (e.target.value) setDespachoTransportadora(""); }}
                  placeholder="Ou digite outra transportadora"
                  className="h-9"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDespachoModal(null)} disabled={despachoSaving}>Cancelar</Button>
            <Button onClick={confirmarDespacho} disabled={despachoSaving}>
              {despachoSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup de Expedição — abre por item (uma caixa pode não levar
          o pedido inteiro). Volumes (L/A/P/peso) + responsável; se um
          item-irmão do mesmo pedido já tiver volume preenchido, oferece
          "Já preenchido" pra reaproveitar sem digitar de novo. */}
      <Dialog open={!!recusaModal} onOpenChange={open => !open && !recusaSaving && setRecusaModal(null)}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5" style={{ color: "var(--gw-danger)" }} />
              Teste recusado — Pedido {recusaModal?.pedido_numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <p className="text-[12px] text-[var(--gw-text-muted)]">
              {recusaModal?.produto_nome} — o motivo fica registrado como observação deste produto no pedido.
            </p>
            <Label>Motivo da recusa <span className="text-[var(--gw-danger)]">*</span></Label>
            <Textarea
              autoFocus
              rows={4}
              value={recusaMotivo}
              onChange={e => setRecusaMotivo(e.target.value)}
              placeholder="Ex.: cliente pediu a logo 1 cm maior e mais centralizada"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaModal(null)} disabled={recusaSaving}>Cancelar</Button>
            <Button onClick={reprovarTeste} disabled={recusaSaving || !recusaMotivo.trim()} style={{ backgroundColor: "var(--gw-danger)" }}>
              {recusaSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expedicaoModal} onOpenChange={open => !open && !expedicaoSaving && setExpedicaoModal(null)}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Inserir medidas — Pedido {expedicaoModal?.row.pedido_numero}
            </DialogTitle>
          </DialogHeader>

          {expedicaoModal && (
            <div className="space-y-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
              <p className="text-[12px] text-[var(--gw-text-muted)]">
                Registre os volumes deste item. Ao confirmar, ele vai para Expedição e as etiquetas anteriores são trocadas pelas medidas de cada volume.
              </p>

              {/* Itens-irmãos do mesmo pedido que já têm volume — "foi na
                  mesma caixa" sem preencher tudo de novo. */}
              {rows.filter(r => r.pedido_id === expedicaoModal.row.pedido_id
                && r.producao_id !== expedicaoModal.row.producao_id && r.item_volumes).length > 0 && (
                <div className="rounded-lg border border-[var(--gw-primary)] bg-[var(--gw-primary-soft)]/40 p-3 space-y-2">
                  <p className="text-[12px] font-semibold text-[var(--gw-text)]">
                    Foi na mesma caixa de outro item deste pedido?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {rows.filter(r => r.pedido_id === expedicaoModal.row.pedido_id
                      && r.producao_id !== expedicaoModal.row.producao_id && r.item_volumes).map(irmao => (
                      <Button
                        key={irmao.producao_id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => usarVolumeDeItemIrmao(irmao)}
                        disabled={expedicaoSaving}
                      >
                        Já preenchido — mesma caixa de "{irmao.produto_nome}"
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Responsável pela medição */}
              <div className="space-y-1.5">
                <Label>Responsável pela medição <span className="text-[var(--gw-danger)]">*</span></Label>
                <Input
                  value={expedicaoResponsavel}
                  onChange={e => setExpedicaoResponsavel(e.target.value)}
                  placeholder="Nome de quem mediu/embalou"
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
              Confirmar medidas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
