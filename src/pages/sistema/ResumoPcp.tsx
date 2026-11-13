import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, AlertTriangle, Flame, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { diasUteisAte } from "@/lib/diasUteis";
import { COLUNAS_PCP } from "@/lib/statusPedido";

/* ── Resumo do PCP ───────────────────────────────────────────────────────
   Botão flutuante (canto inferior direito) que monta, na hora e no próprio
   navegador, um resumo dos pedidos que estão no quadro — exceto "Coletado e
   Enviado". O quadro já chega filtrado por papel (vendedor só recebe os
   próprios pedidos; admin/gerente/produção recebem todos), então o mesmo
   componente vira "seus pedidos" ou "visão geral" sem consulta extra.

   Nada de IA: as frases saem das datas que o item já tem (etapa_desde,
   teste_enviado_em, enviado_terceiro_em, previsao_retorno…) e do prazo
   "despachar até" do pedido (data_despachar_ate ou criação + prazo de
   produção que o vendedor informou). Assim é instantâneo e nunca inventa
   data. */

/** Subconjunto de PcpRow que o resumo usa (PCP.tsx não exporta o tipo). */
export interface ResumoRow {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
  pedido_vendedor_id: string | null;
  pedido_vendedor_nome: string | null;
  cliente: string | null;
  produto_nome: string | null;
  quantidade: number | null;
  coluna_pcp: string | null;
  tags: string[] | null;
  terceirizada_nome: string | null;
  terceirizada_nome_livre: string | null;
  enviado_terceiro_em: string | null;
  previsao_retorno: string | null;
  compra_confirmada_em: string | null;
  teste_enviado_em: string | null;
  producao_anexo_em: string | null;
  coleta_solicitada_em: string | null;
  etapa_desde: string | null;
  horas_na_etapa: number | null;
  pedido_criado_em: string | null;
  pedido_data_despacho: string | null;
  total_itens_pedido: number | null;
  itens_enviados_pedido: number | null;
}

type Nivel = "atrasado" | "urgente" | "atencao" | "ok";
type Quem = "Comercial" | "Produção" | "Compras" | "Terceirizada" | "Expedição";

const NIVEL_INFO: Record<Nivel, { rotulo: string; cls: string; dot: string; emoji: string; Icon: typeof Flame }> = {
  atrasado: { rotulo: "ATRASADO", cls: "bg-red-600 text-white", dot: "bg-red-600", emoji: "🔴", Icon: Flame },
  urgente: { rotulo: "URGENTE", cls: "bg-orange-500 text-white", dot: "bg-orange-500", emoji: "🟠", Icon: AlertTriangle },
  atencao: { rotulo: "ATENÇÃO", cls: "bg-amber-400 text-amber-950", dot: "bg-amber-400", emoji: "🟡", Icon: Clock },
  ok: { rotulo: "NO PRAZO", cls: "bg-emerald-600 text-white", dot: "bg-emerald-600", emoji: "🟢", Icon: CheckCircle2 },
};
const ORDEM_NIVEL: Nivel[] = ["atrasado", "urgente", "atencao", "ok"];

/* Dias úteis que, no mínimo, ainda faltam de cada etapa até o despacho.
   Heurística conservadora: serve para acender "risco de atraso" quando o
   pedido está numa etapa cedo demais para a data que sobra. */
const DIAS_NECESSARIOS: Record<string, number> = {
  organizando_comercial: 6,
  organizando_pedido: 5,
  aguardando_mercadoria: 5,
  teste_fisico: 4,
  teste_fisico_terceirizada: 4,
  teste_enviado: 3,
  em_producao: 2,
  em_producao_terceirizada: 2,
  inserir_medidas: 1,
  aguardando_coleta: 0,
};
/* Ordem do fluxo, para saber qual item "segura" o pedido. */
const ORDEM_COLUNA = Object.fromEntries(COLUNAS_PCP.map((c, i) => [c.coluna, i])) as Record<string, number>;
const ROTULO_COLUNA = Object.fromEntries(COLUNAS_PCP.map(c => [c.coluna, c.rotulo])) as Record<string, string>;

/* ── datas ──────────────────────────────────────────────────────────── */

const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
/** Aceita "YYYY-MM-DD" (sem fuso) ou timestamp ISO. */
const paraData = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
};
const dm = (iso: string | null | undefined): string => {
  const d = paraData(iso);
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";
};
const diasCorridosAte = (iso: string): number => {
  const d = paraData(iso); if (!d) return 0;
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - hoje0().getTime()) / 86400000);
};
const haDias = (iso: string | null | undefined): string => {
  const d = paraData(iso); if (!d) return "";
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const n = Math.round((hoje0().getTime() - a.getTime()) / 86400000);
  return n <= 0 ? "hoje" : n === 1 ? "ontem" : `há ${n}d`;
};
/** Volta N dias úteis a partir de uma data YYYY-MM-DD. */
const menosDiasUteis = (iso: string, n: number): string => {
  const d = paraData(iso)!; let r = n;
  while (r > 0) { d.setDate(d.getDate() - 1); const w = d.getDay(); if (w !== 0 && w !== 6) r--; }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ── regras ─────────────────────────────────────────────────────────── */

const temTag = (r: ResumoRow, alvo: string) => (r.tags ?? []).some(t => t.toUpperCase() === alvo);
const tagComeca = (r: ResumoRow, prefixo: string) => (r.tags ?? []).find(t => t.toUpperCase().startsWith(prefixo));
const nomeTerceirizada = (r: ResumoRow): string | null => {
  if (r.terceirizada_nome) return r.terceirizada_nome;
  if (r.terceirizada_nome_livre) return r.terceirizada_nome_livre;
  const t = tagComeca(r, "TERCEIRIZADA");
  const nome = t?.replace(/^TERCEIRIZADA\s*[-–:]?\s*/i, "").trim();
  return nome || null;
};
const nomeItem = (r: ResumoRow) => `${r.produto_nome || "Produto"}${r.quantidade ? ` ×${r.quantidade}` : ""}`;

interface Acao { quem: Quem; texto: string }

/** O que precisa acontecer agora com o item, em frase curta e imperativa. */
const acaoDoItem = (r: ResumoRow, despacho: string | null): Acao => {
  const terc = nomeTerceirizada(r);
  switch (r.coluna_pcp) {
    case "organizando_comercial":
      return { quem: "Comercial", texto: "Completar anotações do pedido" };
    case "organizando_pedido":
      return { quem: "Produção", texto: "Imprimir ordem de produção" };
    case "aguardando_mercadoria": {
      const comprado = tagComeca(r, "COMPRADO");
      if (!comprado && !r.compra_confirmada_em) return { quem: "Compras", texto: "COMPRAR mercadoria" };
      return { quem: "Compras", texto: `Cobrar chegada da mercadoria${comprado ? ` (${comprado.replace(/^COMPRADO\s*/i, "")})` : ""}` };
    }
    case "teste_fisico":
      return { quem: "Produção", texto: "Fazer o teste no galpão" };
    case "teste_fisico_terceirizada":
      return { quem: "Terceirizada", texto: `Cobrar teste da ${terc || "terceirizada"}` };
    case "teste_enviado":
      if (temTag(r, "TESTE RECUSADO")) return { quem: "Produção", texto: "REFAZER teste (recusado)" };
      return { quem: "Comercial", texto: "Cobrar APROVAÇÃO do teste com o cliente" };
    case "em_producao":
      return { quem: "Produção", texto: `Produzir no galpão${despacho ? ` até ${dm(menosDiasUteis(despacho, 1))}` : ""}` };
    case "em_producao_terceirizada": {
      const limite = r.previsao_retorno ?? (despacho ? menosDiasUteis(despacho, 1) : null);
      return { quem: "Terceirizada", texto: `Cobrar ${terc || "terceirizada"} — entrega até ${dm(limite)}` };
    }
    case "inserir_medidas":
      return { quem: "Expedição", texto: "Inserir medidas e volumes" };
    case "aguardando_coleta":
      if (temTag(r, "COBRAR 50% RESTANTE")) return { quem: "Comercial", texto: "COBRAR 50% restante do cliente" };
      if (temTag(r, "CONFERIR PAGAMENTO")) return { quem: "Comercial", texto: "Conferir pagamento" };
      if (tagComeca(r, "DESPACHAR")) return { quem: "Expedição", texto: `Aguardando coleta — ${tagComeca(r, "DESPACHAR")!.replace(/^DESPACHAR\s*[-–:]?\s*/i, "") || "transportadora"}` };
      return { quem: "Expedição", texto: "Confirmar despacho (NF + etiqueta)" };
    default:
      return { quem: "Produção", texto: `Mover adiante (${ROTULO_COLUNA[r.coluna_pcp ?? ""] ?? "sem etapa"})` };
  }
};

/** Últimos acontecimentos do item, do mais recente pro mais antigo. */
const eventosDoItem = (r: ResumoRow): { em: string; texto: string }[] => {
  const ev: { em: string; texto: string }[] = [];
  const terc = nomeTerceirizada(r);
  const comprado = tagComeca(r, "COMPRADO");
  if (r.compra_confirmada_em) ev.push({ em: r.compra_confirmada_em, texto: `Mercadoria comprada${comprado ? ` (${comprado.replace(/^COMPRADO\s*/i, "")})` : ""}` });
  if (r.enviado_terceiro_em) ev.push({ em: r.enviado_terceiro_em, texto: `Encaminhado p/ ${terc || "terceirizada"}` });
  if (r.teste_enviado_em) ev.push({ em: r.teste_enviado_em, texto: "Teste enviado ao cliente" });
  if (r.producao_anexo_em) ev.push({ em: r.producao_anexo_em, texto: "Produção concluída (foto/vídeo)" });
  if (r.coleta_solicitada_em) ev.push({ em: r.coleta_solicitada_em, texto: "Coleta solicitada" });
  if (r.etapa_desde && r.coluna_pcp) {
    const naProducao = r.coluna_pcp === "em_producao" || r.coluna_pcp === "em_producao_terceirizada";
    ev.push({
      em: r.etapa_desde,
      texto: naProducao && temTag(r, "TESTE APROVADO") ? "Teste APROVADO → produção" : `Entrou em ${ROTULO_COLUNA[r.coluna_pcp] ?? r.coluna_pcp}`,
    });
  }
  ev.sort((a, b) => (paraData(b.em)?.getTime() ?? 0) - (paraData(a.em)?.getTime() ?? 0));
  /* "Entrou em <etapa>" no mesmo dia de um evento mais específico (teste
     enviado, mercadoria comprada…) só repete a informação. */
  const outrosDias = new Set(ev.filter(e => !e.texto.startsWith("Entrou em")).map(e => dm(e.em)));
  return ev.filter(e => !(e.texto.startsWith("Entrou em") && outrosDias.has(dm(e.em)))).slice(0, 3);
};

interface ItemResumo {
  row: ResumoRow;
  acao: Acao;
  eventos: { em: string; texto: string }[];
  diasNaEtapa: number;
  nivel: Nivel;
  motivo: string | null;
}
interface PedidoResumo {
  pedidoId: string;
  numero: string;
  cliente: string;
  vendedor: string | null;
  despacho: string | null;
  diasUteis: number | null;
  diasCorridos: number | null;
  nivel: Nivel;
  motivo: string | null;
  itens: ItemResumo[];
  enviados: number;
  total: number;
}

const piorNivel = (a: Nivel, b: Nivel): Nivel => (ORDEM_NIVEL.indexOf(a) <= ORDEM_NIVEL.indexOf(b) ? a : b);

const uteisTxt = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);

const classificar = (r: ResumoRow, despacho: string | null): { nivel: Nivel; motivo: string | null; diasNaEtapa: number } => {
  const diasNaEtapa = Math.floor((r.horas_na_etapa ?? 0) / 24);
  const parado = diasNaEtapa >= 3 && r.coluna_pcp !== "aguardando_coleta";
  if (!despacho) return { nivel: parado ? "atencao" : "ok", motivo: parado ? `Parado há ${diasNaEtapa}d na etapa` : "Sem data de despacho", diasNaEtapa };
  const corridos = diasCorridosAte(despacho);
  if (corridos < 0) return { nivel: "atrasado", motivo: `Despacho venceu há ${-corridos}d`, diasNaEtapa };
  const uteis = diasUteisAte(despacho);
  const folga = uteis - (DIAS_NECESSARIOS[r.coluna_pcp ?? ""] ?? 2);
  if (corridos === 0) return { nivel: "urgente", motivo: "Despacho é HOJE", diasNaEtapa };
  if (folga < 0) return { nivel: "urgente", motivo: `Risco de atraso: ${uteisTxt(uteis)} p/ despacho e ainda em ${ROTULO_COLUNA[r.coluna_pcp ?? ""] ?? "etapa inicial"}`, diasNaEtapa };
  if (uteis <= 2) return { nivel: "urgente", motivo: `Despacho em ${uteisTxt(uteis)}`, diasNaEtapa };
  if (folga <= 2) return { nivel: "atencao", motivo: `Folga curta: ${uteisTxt(uteis)} p/ despacho`, diasNaEtapa };
  if (parado) return { nivel: "atencao", motivo: `Parado há ${diasNaEtapa}d na etapa`, diasNaEtapa };
  return { nivel: "ok", motivo: null, diasNaEtapa };
};

function montarResumo(rows: ResumoRow[]): PedidoResumo[] {
  const porPedido = new Map<string, ResumoRow[]>();
  for (const r of rows) {
    if (!r.coluna_pcp || r.coluna_pcp === "enviado" || r.coluna_pcp === "cancelado") continue;
    const lista = porPedido.get(r.pedido_id) ?? [];
    lista.push(r); porPedido.set(r.pedido_id, lista);
  }
  const pedidos: PedidoResumo[] = [];
  for (const [pedidoId, lista] of porPedido) {
    const p = lista[0];
    const despacho = p.pedido_data_despacho;
    const itens: ItemResumo[] = lista
      .sort((a, b) => (ORDEM_COLUNA[a.coluna_pcp ?? ""] ?? 0) - (ORDEM_COLUNA[b.coluna_pcp ?? ""] ?? 0))
      .map(r => ({ row: r, acao: acaoDoItem(r, despacho), eventos: eventosDoItem(r), ...classificar(r, despacho) }));
    const pior = itens.reduce((acc, i) => (ORDEM_NIVEL.indexOf(i.nivel) < ORDEM_NIVEL.indexOf(acc.nivel) ? i : acc));
    pedidos.push({
      pedidoId,
      numero: String(p.pedido_numero ?? "").replace(/^[#\s]*(PED-)?/i, ""),
      cliente: p.cliente || "Cliente",
      vendedor: p.pedido_vendedor_nome,
      despacho,
      diasUteis: despacho ? diasUteisAte(despacho) : null,
      diasCorridos: despacho ? diasCorridosAte(despacho) : null,
      nivel: pior.nivel,
      motivo: pior.motivo,
      itens,
      enviados: p.itens_enviados_pedido ?? 0,
      total: p.total_itens_pedido ?? lista.length,
    });
  }
  return pedidos.sort((a, b) =>
    ORDEM_NIVEL.indexOf(a.nivel) - ORDEM_NIVEL.indexOf(b.nivel)
    || (paraData(a.despacho)?.getTime() ?? Infinity) - (paraData(b.despacho)?.getTime() ?? Infinity));
}

/** Ações agrupadas por pedido + texto (vários itens com a mesma pendência viram uma linha só). */
const acoesDoPedido = (p: PedidoResumo) => {
  const m = new Map<string, { acao: Acao; itens: string[]; nivel: Nivel }>();
  for (const i of p.itens) {
    const k = `${i.acao.quem}|${i.acao.texto}`;
    const atual = m.get(k);
    if (atual) { atual.itens.push(nomeItem(i.row)); atual.nivel = piorNivel(atual.nivel, i.nivel); }
    else m.set(k, { acao: i.acao, itens: [nomeItem(i.row)], nivel: i.nivel });
  }
  return [...m.values()];
};

const prazoTexto = (p: PedidoResumo) => {
  if (!p.despacho) return "sem data de despacho";
  if ((p.diasCorridos ?? 0) < 0) return `despacho ${dm(p.despacho)} · VENCIDO há ${-(p.diasCorridos ?? 0)}d`;
  if (p.diasCorridos === 0) return `despacho HOJE (${dm(p.despacho)})`;
  return `despacho ${dm(p.despacho)} · ${uteisTxt(p.diasUteis ?? 0)}`;
};

/* ── texto p/ copiar (WhatsApp) ─────────────────────────────────────── */

const gerarTexto = (pedidos: PedidoResumo[], titulo: string): string => {
  const l: string[] = [`*${titulo}* — ${new Date().toLocaleDateString("pt-BR")}`, ""];
  const prio = pedidos.filter(p => p.nivel !== "ok");
  if (prio.length) {
    l.push("*PRIORIDADES*");
    for (const p of prio) for (const a of acoesDoPedido(p)) {
      if (a.nivel === "ok") continue;
      l.push(`${NIVEL_INFO[a.nivel].emoji} #${p.numero} ${p.cliente} → ${a.acao.texto} (${a.acao.quem}) · ${prazoTexto(p)}`);
    }
    l.push("");
  }
  l.push("*PEDIDOS*");
  for (const p of pedidos) {
    l.push(`${NIVEL_INFO[p.nivel].emoji} *#${p.numero} ${p.cliente}*${p.vendedor ? ` · ${p.vendedor}` : ""} · ${prazoTexto(p)}`);
    for (const i of p.itens) {
      const ult = i.eventos.map(e => `${e.texto} ${dm(e.em)}`).join(" › ");
      l.push(`   • ${nomeItem(i.row)}: ${ult || ROTULO_COLUNA[i.row.coluna_pcp ?? ""]} → ${i.acao.texto}`);
    }
  }
  return l.join("\n");
};

/* ── UI ─────────────────────────────────────────────────────────────── */

const Selo = ({ nivel, className }: { nivel: Nivel; className?: string }) => (
  <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide shrink-0", NIVEL_INFO[nivel].cls, className)}>
    {NIVEL_INFO[nivel].rotulo}
  </span>
);

const SeloQuem = ({ quem, destaque }: { quem: Quem; destaque: boolean }) => (
  <span className={cn(
    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase shrink-0 border",
    destaque ? "bg-[var(--gw-primary)] text-white border-transparent" : "text-muted-foreground border-[var(--gw-border)]",
  )}>
    {destaque ? "VOCÊ" : quem}
  </span>
);

export default function ResumoPcp({ rows, geral }: { rows: ResumoRow[]; geral: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [geradoEm, setGeradoEm] = useState<Date | null>(null);
  /* Fotografa as linhas no clique — o quadro atualiza em tempo real e o
     resumo não deve se reorganizar enquanto a pessoa lê. */
  const [foto, setFoto] = useState<ResumoRow[]>([]);
  const pedidos = useMemo(() => montarResumo(foto), [foto]);
  const titulo = geral ? "Resumo geral do PCP" : "Resumo dos seus pedidos";

  const gerar = () => { setFoto(rows); setGeradoEm(new Date()); setAberto(true); };

  const contagem = useMemo(() => {
    const c: Record<Nivel, number> = { atrasado: 0, urgente: 0, atencao: 0, ok: 0 };
    for (const p of pedidos) c[p.nivel]++;
    return c;
  }, [pedidos]);

  const prioridades = useMemo(() => pedidos
    .filter(p => p.nivel !== "ok")
    .flatMap(p => acoesDoPedido(p).filter(a => a.nivel !== "ok").map(a => ({ p, ...a })))
    .sort((a, b) => ORDEM_NIVEL.indexOf(a.nivel) - ORDEM_NIVEL.indexOf(b.nivel)
      || (paraData(a.p.despacho)?.getTime() ?? Infinity) - (paraData(b.p.despacho)?.getTime() ?? Infinity)),
  [pedidos]);

  /* Para o vendedor, o que é dele (Comercial) sobe pro topo das prioridades. */
  const minhas = !geral ? prioridades.filter(a => a.acao.quem === "Comercial").length : 0;

  /* Gestor: quem tem mais pedidos pegando fogo. */
  const porVendedor = useMemo(() => {
    if (!geral) return [];
    const m = new Map<string, { nome: string; criticos: number; total: number }>();
    for (const p of pedidos) {
      const nome = p.vendedor || "Sem vendedor";
      const v = m.get(nome) ?? { nome, criticos: 0, total: 0 };
      v.total++; if (p.nivel === "atrasado" || p.nivel === "urgente") v.criticos++;
      m.set(nome, v);
    }
    return [...m.values()].sort((a, b) => b.criticos - a.criticos || b.total - a.total);
  }, [pedidos, geral]);

  const porEtapa = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pedidos) for (const i of p.itens) m.set(i.row.coluna_pcp ?? "", (m.get(i.row.coluna_pcp ?? "") ?? 0) + 1);
    return COLUNAS_PCP.filter(c => m.has(c.coluna)).map(c => ({ ...c, n: m.get(c.coluna)! }));
  }, [pedidos]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(gerarTexto(pedidos, titulo));
      toast.success("Resumo copiado — é só colar no WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <>
      <Button
        onClick={gerar}
        className="fixed bottom-5 right-5 z-40 h-11 rounded-full px-5 shadow-lg gap-2 bg-[var(--gw-primary)] hover:bg-[var(--gw-primary-hover)] text-white"
        title={geral ? "Resumo geral de todos os pedidos" : "Resumo dos seus pedidos"}
      >
        <Sparkles className="h-4 w-4" /> Gerar resumo
      </Button>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-[var(--gw-border)] space-y-1 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[var(--gw-primary)]" /> {titulo}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} em andamento (sem "Coletado e Enviado")
              {geradoEm && ` · gerado às ${geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {ORDEM_NIVEL.map(n => (
                <span key={n} className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold", NIVEL_INFO[n].cls, contagem[n] === 0 && "opacity-40")}>
                  {contagem[n]} {NIVEL_INFO[n].rotulo}
                </span>
              ))}
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copiar}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={gerar}><Sparkles className="h-3.5 w-3.5" /> Atualizar</Button>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {pedidos.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-600" />
                Nenhum pedido em andamento. Quadro limpo.
              </div>
            )}

            {/* PRIORIDADES */}
            {pedidos.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gw-danger)] mb-2 flex items-center gap-1.5">
                  <Flame className="h-4 w-4" /> Prioridades — o que fazer agora
                  {minhas > 0 && <span className="ml-1 normal-case font-semibold text-[var(--gw-primary)]">· {minhas} {minhas === 1 ? "é sua" : "são suas"}</span>}
                </h3>
                {prioridades.length === 0 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    ✅ Tudo no prazo. Nenhuma pendência crítica.
                  </div>
                ) : (
                  <ol className="space-y-1.5">
                    {[...prioridades]
                      .sort((a, b) => (geral ? 0 : Number(b.acao.quem === "Comercial") - Number(a.acao.quem === "Comercial")))
                      .map((a, idx) => (
                        <li key={`${a.p.pedidoId}-${a.acao.texto}-${idx}`} className="flex items-start gap-2 rounded-lg border border-[var(--gw-border)] px-3 py-2 bg-background">
                          <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", NIVEL_INFO[a.nivel].dot)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-sm">{a.acao.texto}</span>
                              <SeloQuem quem={a.acao.quem} destaque={!geral && a.acao.quem === "Comercial"} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-semibold text-foreground">#{a.p.numero} {a.p.cliente}</span>
                              {geral && a.p.vendedor && <> · {a.p.vendedor}</>}
                              {" · "}{a.itens.join(", ")}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Selo nivel={a.nivel} />
                            <div className="text-[11px] font-semibold mt-1 whitespace-nowrap">{a.p.despacho ? `Despachar ${dm(a.p.despacho)}` : "Sem data"}</div>
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </section>
            )}

            {/* PANORAMA */}
            {pedidos.length > 0 && (
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--gw-border)] p-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Itens por etapa</h4>
                  <ul className="space-y-1">
                    {porEtapa.map(e => (
                      <li key={e.coluna} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: e.cor }} />
                        <span className="flex-1 truncate">{e.rotulo}</span>
                        <span className="font-bold tabular-nums">{e.n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {geral ? (
                  <div className="rounded-lg border border-[var(--gw-border)] p-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Por vendedor</h4>
                    <ul className="space-y-1">
                      {porVendedor.map(v => (
                        <li key={v.nome} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 truncate">{v.nome}</span>
                          {v.criticos > 0 && <span className="rounded bg-red-600 text-white px-1.5 text-[10px] font-bold">{v.criticos} crítico{v.criticos > 1 ? "s" : ""}</span>}
                          <span className="font-bold tabular-nums">{v.total}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[var(--gw-border)] p-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Próximos despachos</h4>
                    <ul className="space-y-1">
                      {[...pedidos].filter(p => p.despacho).sort((a, b) => paraData(a.despacho)!.getTime() - paraData(b.despacho)!.getTime()).slice(0, 6).map(p => (
                        <li key={p.pedidoId} className="flex items-center gap-2 text-xs">
                          <span className={cn("h-2 w-2 rounded-full shrink-0", NIVEL_INFO[p.nivel].dot)} />
                          <span className="flex-1 truncate">#{p.numero} {p.cliente}</span>
                          <span className="font-bold tabular-nums">{dm(p.despacho)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* PEDIDOS */}
            {ORDEM_NIVEL.map(nivel => {
              const lista = pedidos.filter(p => p.nivel === nivel);
              if (!lista.length) return null;
              const { Icon } = NIVEL_INFO[nivel];
              return (
                <section key={nivel}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Icon className="h-4 w-4" /> {NIVEL_INFO[nivel].rotulo} <span className="text-muted-foreground font-semibold">({lista.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {lista.map(p => (
                      <article key={p.pedidoId} className="rounded-lg border border-[var(--gw-border)] overflow-hidden">
                        <header className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-[var(--gw-border)]">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm truncate">#{p.numero} · {p.cliente}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {geral && p.vendedor && <>{p.vendedor} · </>}
                              <span className={cn("font-semibold", (p.nivel === "atrasado" || p.nivel === "urgente") && "text-[var(--gw-danger)]")}>{prazoTexto(p)}</span>
                              {p.enviados > 0 && <> · {p.enviados}/{p.total} itens já enviados</>}
                            </div>
                          </div>
                          <Selo nivel={p.nivel} />
                        </header>
                        {p.motivo && p.nivel !== "ok" && (
                          <div className="px-3 pt-2 text-xs font-semibold text-[var(--gw-danger)]">⚠ {p.motivo}</div>
                        )}
                        <ul className="divide-y divide-[var(--gw-border)]">
                          {p.itens.map(i => (
                            <li key={i.row.producao_id} className="px-3 py-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold truncate">{nomeItem(i.row)}</span>
                                <span className="text-muted-foreground shrink-0">· {ROTULO_COLUNA[i.row.coluna_pcp ?? ""] ?? "—"}</span>
                                {i.diasNaEtapa >= 3 && <span className="shrink-0 text-[10px] font-bold text-amber-700 dark:text-amber-400">parado {i.diasNaEtapa}d</span>}
                              </div>
                              {i.eventos.length > 0 && (
                                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                                  {[...i.eventos].reverse().map((e, k) => (
                                    <span key={k} className="inline-flex items-center gap-1">
                                      {k > 0 && <ArrowRight className="h-3 w-3 opacity-50" />}
                                      <span><span className="font-semibold text-foreground">{dm(e.em)}</span> {e.texto}</span>
                                    </span>
                                  ))}
                                  <span className="opacity-70">({haDias(i.eventos[0].em)})</span>
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-1.5 text-xs">
                                <ArrowRight className="h-3.5 w-3.5 text-[var(--gw-primary)] shrink-0" />
                                <span className="font-bold">{i.acao.texto}</span>
                                <SeloQuem quem={i.acao.quem} destaque={!geral && i.acao.quem === "Comercial"} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
