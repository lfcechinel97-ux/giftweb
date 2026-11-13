import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { FileText, Copy, Printer, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { diasUteisAte } from "@/lib/diasUteis";
import { COLUNAS_PCP, statusInfo } from "@/lib/statusPedido";

/* ── Resumo do PCP ───────────────────────────────────────────────────────
   Botão flutuante (canto inferior direito). Monta um resumo por PEDIDO, em
   ordem de número, no formato de ficha: um quadro com logo, nº, cliente,
   vendedor, criação e "Produzir até", e logo abaixo o que já aconteceu
   (histórico de etapas + chat) e o que falta fazer, com caixinhas para
   riscar na folha impressa.

   Recebe as linhas JÁ filtradas do quadro (vendedor só tem os próprios
   pedidos; filtros de busca/etiqueta/"Produzir até" também valem), e
   descarta "Coletado e Enviado" e cancelados.

   Sem IA: as frases saem das datas do item, de sistema_producao_historico
   (quanto tempo ficou em cada etapa) e de sistema_producao_comentarios
   (últimas mensagens do chat). Pouca cor de propósito — é para imprimir. */

/** Subconjunto de PcpRow que o resumo usa (PCP.tsx não exporta o tipo). */
export interface ResumoRow {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
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
  mockup_url: string | null;
  imagem_catalogo_url: string | null;
  arte_anexo_url: string | null;
  artes_anexos: { url: string; nome: string }[] | null;
}

interface HistRow { producao_item_id: string; status_novo: string; observacao: string | null; created_at: string }
interface ChatRow { producao_item_id: string; mensagem: string; autor_id: string | null; autor_nome?: string | null; autor_email: string | null; created_at: string }

const ROTULO_COLUNA = Object.fromEntries(COLUNAS_PCP.map(c => [c.coluna, c.rotulo])) as Record<string, string>;
const ORDEM_COLUNA = Object.fromEntries(COLUNAS_PCP.map((c, i) => [c.coluna, i])) as Record<string, number>;

/* Dias úteis que, no mínimo, ainda faltam de cada etapa até o despacho —
   acende "prazo em risco" quando o pedido está cedo demais no fluxo para a
   data que sobra. */
const DIAS_NECESSARIOS: Record<string, number> = {
  organizando_comercial: 6, organizando_pedido: 5, aguardando_mercadoria: 5,
  teste_fisico: 4, teste_fisico_terceirizada: 4, teste_enviado: 3,
  em_producao: 2, em_producao_terceirizada: 2, inserir_medidas: 1, aguardando_coleta: 0,
};

/* ── datas ──────────────────────────────────────────────────────────── */

const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const paraData = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
};
const dm = (iso: string | null | undefined): string => {
  const d = paraData(iso);
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";
};
const dma = (iso: string | null | undefined): string => {
  const d = paraData(iso);
  return d ? d.toLocaleDateString("pt-BR") : "—";
};
const zerar = (d: Date) => { const a = new Date(d); a.setHours(0, 0, 0, 0); return a; };
const diasEntre = (de: string | null | undefined, ate: string | Date | null | undefined): number | null => {
  const a = paraData(de); const b = ate instanceof Date ? ate : paraData(ate ?? null);
  if (!a || !b) return null;
  return Math.round((zerar(b).getTime() - zerar(a).getTime()) / 86400000);
};
const diasCorridosAte = (iso: string) => diasEntre(hoje0().toISOString(), iso) ?? 0;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const uteisTxt = (n: number) => plural(n, "dia útil", "dias úteis");
const diasTxt = (n: number) => plural(n, "dia", "dias");
/** Dias úteis entre duas datas (exclusive o início). */
const uteisEntre = (de: string | null, ate: string | null): number | null => {
  const a = paraData(de); const b = paraData(ate);
  if (!a || !b) return null;
  const c = zerar(a); let n = 0;
  for (let i = 0; i < 400 && c < zerar(b); i++) { c.setDate(c.getDate() + 1); const w = c.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
};
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
  const nome = tagComeca(r, "TERCEIRIZADA")?.replace(/^TERCEIRIZADA\s*[-–:]?\s*/i, "").trim();
  return nome || null;
};
const nomeItem = (r: ResumoRow) => `${r.produto_nome || "Produto"}${r.quantidade ? ` ×${r.quantidade}` : ""}`;
const ehImagem = (url: string | null | undefined) => !!url && !/\.(pdf|ai|eps|cdr|psd|zip|rar)(\?|$)/i.test(url);
const logoDoPedido = (itens: ResumoRow[]): string | null => {
  for (const r of itens) {
    const arte = (r.artes_anexos ?? []).map(a => a.url).find(ehImagem) ?? (ehImagem(r.arte_anexo_url) ? r.arte_anexo_url : null);
    if (arte) return arte;
  }
  const r = itens[0];
  return r?.mockup_url || r?.imagem_catalogo_url || null;
};

/** Próximo passo do item, em frase curta e imperativa. */
const proximoPasso = (r: ResumoRow, produzirAte: string | null): string => {
  const terc = nomeTerceirizada(r);
  switch (r.coluna_pcp) {
    case "organizando_comercial": return "Comercial: completar anotações do pedido";
    case "organizando_pedido": return "Imprimir ordem de produção";
    case "aguardando_mercadoria": {
      const comprado = tagComeca(r, "COMPRADO");
      if (!comprado && !r.compra_confirmada_em) return "Comprar mercadoria";
      return `Cobrar chegada da mercadoria${comprado ? ` (${comprado.replace(/^COMPRADO\s*/i, "")})` : ""}`;
    }
    case "teste_fisico": return "Fazer teste no galpão";
    case "teste_fisico_terceirizada": return `Cobrar teste da ${terc || "terceirizada"}`;
    case "teste_enviado":
      return temTag(r, "TESTE RECUSADO") ? "Refazer teste (recusado pelo cliente)" : "Cobrar aprovação do teste com o cliente";
    case "em_producao": return `Produzir no galpão${produzirAte ? ` até ${dm(produzirAte)}` : ""}`;
    case "em_producao_terceirizada": {
      const limite = r.previsao_retorno ?? (produzirAte ? menosDiasUteis(produzirAte, 1) : null);
      return `Cobrar ${terc || "terceirizada"} — entregar até ${dm(limite)}`;
    }
    case "inserir_medidas": return "Inserir medidas e volumes";
    case "aguardando_coleta":
      if (temTag(r, "COBRAR 50% RESTANTE")) return "Cobrar 50% restante do cliente";
      if (temTag(r, "CONFERIR PAGAMENTO")) return "Conferir pagamento";
      if (tagComeca(r, "DESPACHAR")) return "Aguardar coleta da transportadora";
      return "Confirmar despacho (NF + etiqueta)";
    default: return "Mover para a próxima etapa";
  }
};

/** Linha do tempo de etapas (coluna + quando entrou), a partir do histórico. */
const etapasDoItem = (hist: HistRow[]): { coluna: string; em: string }[] => {
  const out: { coluna: string; em: string }[] = [];
  for (const h of [...hist].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const coluna = statusInfo(h.status_novo).colunaPcp;
    if (out.length && out[out.length - 1].coluna === coluna) continue;
    out.push({ coluna, em: h.created_at });
  }
  return out;
};

/** Frases curtas do que já aconteceu com o item. */
const relatoDoItem = (r: ResumoRow, hist: HistRow[]): { em: string; texto: string }[] => {
  const ev: { em: string; texto: string }[] = [];
  const etapas = etapasDoItem(hist);
  const saida = (coluna: string) => {
    const i = etapas.findIndex(e => e.coluna === coluna);
    return i >= 0 && i < etapas.length - 1 ? { entrou: etapas[i].em, saiu: etapas[i + 1].em } : null;
  };
  const terc = nomeTerceirizada(r);
  const comprado = tagComeca(r, "COMPRADO");

  if (r.compra_confirmada_em) ev.push({ em: r.compra_confirmada_em, texto: `Mercadoria comprada${comprado ? ` (${comprado.replace(/^COMPRADO\s*/i, "")})` : ""}` });
  const merc = saida("aguardando_mercadoria");
  if (merc) {
    const base = r.compra_confirmada_em ?? merc.entrou;
    const n = diasEntre(base, merc.saiu);
    if (n != null) ev.push({ em: merc.saiu, texto: `Mercadoria chegou — levou ${diasTxt(Math.max(0, n))}` });
  }
  if (r.enviado_terceiro_em) ev.push({ em: r.enviado_terceiro_em, texto: `Encaminhado para ${terc || "terceirizada"}` });
  if (r.teste_enviado_em) ev.push({ em: r.teste_enviado_em, texto: "Teste enviado ao cliente" });
  const teste = saida("teste_enviado");
  if (teste) {
    const n = diasEntre(r.teste_enviado_em ?? teste.entrou, teste.saiu);
    const recusado = temTag(r, "TESTE RECUSADO") && r.coluna_pcp !== "em_producao" && r.coluna_pcp !== "em_producao_terceirizada";
    ev.push({ em: teste.saiu, texto: `Teste ${recusado ? "recusado" : "aprovado"}${n != null ? ` — cliente levou ${diasTxt(Math.max(0, n))}` : ""}` });
  }
  const prodTerc = saida("em_producao_terceirizada");
  if (prodTerc) {
    const n = diasEntre(prodTerc.entrou, prodTerc.saiu);
    ev.push({ em: prodTerc.saiu, texto: `${terc || "Terceirizada"} entregou a produção${n != null ? ` em ${diasTxt(Math.max(0, n))}` : ""}` });
  }
  if (r.producao_anexo_em) ev.push({ em: r.producao_anexo_em, texto: "Produção concluída (foto/vídeo anexado)" });
  if (r.coleta_solicitada_em) ev.push({ em: r.coleta_solicitada_em, texto: "Coleta solicitada" });
  /* Observações escritas à mão nas mudanças de etapa (ex.: motivo da recusa). */
  for (const h of hist) {
    const obs = h.observacao?.trim();
    if (obs && obs.length > 3 && !/^(mudou|status|movido)/i.test(obs)) ev.push({ em: h.created_at, texto: `Obs.: ${obs.length > 110 ? `${obs.slice(0, 110)}…` : obs}` });
  }
  ev.sort((a, b) => a.em.localeCompare(b.em));
  return ev.slice(-5);
};

interface ItemResumo { row: ResumoRow; relato: { em: string; texto: string }[]; proximo: string; diasNaEtapa: number }
interface PedidoResumo {
  pedidoId: string;
  numero: string;
  numeroOrdem: number;
  cliente: string;
  vendedor: string | null;
  criadoEm: string | null;
  produzirAte: string | null;
  logo: string | null;
  itens: ItemResumo[];
  enviados: number;
  total: number;
  prazo: { situacao: "atrasado" | "risco" | "ok" | "sem_data"; texto: string };
  chat: { em: string; autor: string; texto: string; item: string }[];
}

const avaliarPrazo = (produzirAte: string | null, colunaMaisAtrasada: string): PedidoResumo["prazo"] => {
  if (!produzirAte) return { situacao: "sem_data", texto: "Sem data de produção" };
  const corridos = diasCorridosAte(produzirAte);
  if (corridos < 0) return { situacao: "atrasado", texto: `ATRASADO — venceu há ${diasTxt(-corridos)}` };
  if (corridos === 0) return { situacao: "risco", texto: "Vence HOJE" };
  const uteis = diasUteisAte(produzirAte);
  const folga = uteis - (DIAS_NECESSARIOS[colunaMaisAtrasada] ?? 2);
  if (folga < 0) return { situacao: "risco", texto: `EM RISCO — faltam ${uteisTxt(uteis)} e ainda está em ${ROTULO_COLUNA[colunaMaisAtrasada] ?? "etapa inicial"}` };
  return { situacao: "ok", texto: `No prazo — faltam ${uteisTxt(uteis)}` };
};

function montarResumo(rows: ResumoRow[], hist: HistRow[], chat: ChatRow[], nomeUsuario: (id: string | null) => string | null): PedidoResumo[] {
  const histPorItem = new Map<string, HistRow[]>();
  for (const h of hist) (histPorItem.get(h.producao_item_id) ?? histPorItem.set(h.producao_item_id, []).get(h.producao_item_id)!).push(h);
  const porPedido = new Map<string, ResumoRow[]>();
  for (const r of rows) {
    if (!r.coluna_pcp || r.coluna_pcp === "enviado" || r.coluna_pcp === "cancelado") continue;
    (porPedido.get(r.pedido_id) ?? porPedido.set(r.pedido_id, []).get(r.pedido_id)!).push(r);
  }
  const pedidos: PedidoResumo[] = [];
  for (const [pedidoId, lista] of porPedido) {
    lista.sort((a, b) => (ORDEM_COLUNA[a.coluna_pcp ?? ""] ?? 0) - (ORDEM_COLUNA[b.coluna_pcp ?? ""] ?? 0));
    const p = lista[0];
    const numero = String(p.pedido_numero ?? "").replace(/^[#\s]*(PED-)?/i, "");
    const ids = new Set(lista.map(r => r.producao_id));
    const nomePorItem = new Map(lista.map(r => [r.producao_id, r.produto_nome || "Produto"]));
    pedidos.push({
      pedidoId,
      numero,
      numeroOrdem: Number(numero.replace(/\D/g, "")) || Number.MAX_SAFE_INTEGER,
      cliente: p.cliente || "Cliente",
      vendedor: p.pedido_vendedor_nome,
      criadoEm: p.pedido_criado_em,
      produzirAte: p.pedido_data_despacho,
      logo: logoDoPedido(lista),
      itens: lista.map(r => ({
        row: r,
        relato: relatoDoItem(r, histPorItem.get(r.producao_id) ?? []),
        proximo: proximoPasso(r, p.pedido_data_despacho),
        diasNaEtapa: Math.floor((r.horas_na_etapa ?? 0) / 24),
      })),
      enviados: p.itens_enviados_pedido ?? 0,
      total: p.total_itens_pedido ?? lista.length,
      prazo: avaliarPrazo(p.pedido_data_despacho, p.coluna_pcp ?? ""),
      chat: chat
        .filter(c => ids.has(c.producao_item_id) && c.mensagem?.trim())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 3)
        .reverse()
        .map(c => {
          const texto = c.mensagem.replace(/\s+/g, " ").trim();
          return {
            em: c.created_at,
            autor: c.autor_nome || nomeUsuario(c.autor_id) || c.autor_email?.split("@")[0] || "Alguém",
            texto: texto.length > 140 ? `${texto.slice(0, 140)}…` : texto,
            item: lista.length > 1 ? nomePorItem.get(c.producao_item_id) ?? "" : "",
          };
        }),
    });
  }
  return pedidos.sort((a, b) => a.numeroOrdem - b.numeroOrdem || a.numero.localeCompare(b.numero));
}

/* ── carga do histórico e do chat (em lotes, para não estourar a URL) ── */

async function carregarEmLotes<T>(tabela: string, colunas: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas fora do types.ts gerado
    const { data, error } = await (supabase as any).from(tabela).select(colunas).in("producao_item_id", ids.slice(i, i + 80));
    if (error) { console.error(`[Resumo PCP] ${tabela}:`, error); continue; }
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/* ── texto para copiar (WhatsApp) ───────────────────────────────────── */

const gerarTexto = (pedidos: PedidoResumo[], titulo: string, periodo: string | null): string => {
  const l: string[] = [`*${titulo}* — ${new Date().toLocaleDateString("pt-BR")}${periodo ? ` · ${periodo}` : ""}`, ""];
  for (const p of pedidos) {
    l.push(`*Pedido ${p.numero} — ${p.cliente}*${p.vendedor ? ` (${p.vendedor})` : ""}`);
    l.push(`Criado ${dm(p.criadoEm)} · Produzir até ${dm(p.produzirAte)} · ${p.prazo.texto}`);
    for (const i of p.itens) {
      const ult = i.relato[i.relato.length - 1];
      l.push(`• ${nomeItem(i.row)} — ${ROTULO_COLUNA[i.row.coluna_pcp ?? ""] ?? "—"}${ult ? ` (${dm(ult.em)} ${ult.texto})` : ""}`);
      l.push(`  ☐ ${i.proximo}`);
    }
    for (const c of p.chat) l.push(`  💬 ${dm(c.em)} ${c.autor}: ${c.texto}`);
    l.push("");
  }
  return l.join("\n");
};

/* ── ficha de um pedido (mesma marcação na tela e na impressão) ─────── */

function FichaPedido({ p }: { p: PedidoResumo }) {
  const alerta = p.prazo.situacao === "atrasado" || p.prazo.situacao === "risco";
  const prazoTotal = uteisEntre(p.criadoEm, p.produzirAte);
  return (
    <article className="resumo-ficha border border-neutral-400 rounded-md overflow-hidden bg-white text-neutral-900">
      {/* Quadro "bateu o olho" */}
      <div className="flex gap-3 p-3 border-b border-neutral-300">
        <div className="h-16 w-16 shrink-0 rounded border border-neutral-300 bg-neutral-50 flex items-center justify-center overflow-hidden">
          {p.logo
            ? <img src={sizedImage(p.logo, 160)} alt="" className="max-h-full max-w-full object-contain" />
            : <span className="text-[10px] text-neutral-400">sem logo</span>}
        </div>
        <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[11px] leading-tight">
          <Campo rotulo="Pedido" valor={p.numero} forte />
          <Campo rotulo="Cliente" valor={p.cliente} forte className="col-span-1 sm:col-span-3" />
          <Campo rotulo="Vendedor" valor={p.vendedor || "—"} />
          <Campo rotulo="Criado em" valor={dma(p.criadoEm)} />
          <Campo rotulo="Produzir até" valor={dma(p.produzirAte)} forte />
          <Campo rotulo="Prazo de produção" valor={prazoTotal != null ? uteisTxt(prazoTotal) : "—"} />
        </div>
      </div>
      <div className={`px-3 py-1.5 text-[11px] font-bold border-b border-neutral-300 ${alerta ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}>
        {alerta ? "⚠ " : ""}{p.prazo.texto}
        {p.enviados > 0 && <span className="font-normal"> · {p.enviados}/{p.total} itens já enviados</span>}
      </div>

      {/* Itens: o que aconteceu + o que falta */}
      <ul className="divide-y divide-neutral-200">
        {p.itens.map(i => (
          <li key={i.row.producao_id} className="px-3 py-2 text-[11px] leading-snug">
            <div className="flex items-baseline gap-2">
              <span className="font-bold">{nomeItem(i.row)}</span>
              <span className="text-neutral-500">· {ROTULO_COLUNA[i.row.coluna_pcp ?? ""] ?? "—"}{i.diasNaEtapa > 0 ? ` há ${diasTxt(i.diasNaEtapa)}` : ""}</span>
            </div>
            {i.relato.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-neutral-700">
                {i.relato.map((e, k) => (
                  <li key={k}><span className="tabular-nums font-semibold">{dm(e.em)}</span> — {e.texto}</li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex items-start gap-1.5 font-semibold">
              <span className="mt-[1px] inline-block h-3 w-3 shrink-0 border border-neutral-700 rounded-[2px]" />
              <span>Falta: {i.proximo}</span>
            </div>
          </li>
        ))}
      </ul>

      {p.chat.length > 0 && (
        <div className="px-3 py-2 border-t border-neutral-300 bg-neutral-50 text-[11px] leading-snug">
          <div className="font-bold uppercase tracking-wide text-[10px] text-neutral-500 mb-0.5">Últimas do chat</div>
          <ul className="space-y-0.5">
            {p.chat.map((c, k) => (
              <li key={k}>
                <span className="tabular-nums font-semibold">{dm(c.em)}</span> <span className="font-semibold">{c.autor}</span>
                {c.item && <span className="text-neutral-500"> ({c.item})</span>}: “{c.texto}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

const Campo = ({ rotulo, valor, forte, className }: { rotulo: string; valor: string; forte?: boolean; className?: string }) => (
  <div className={`min-w-0 ${className ?? ""}`}>
    <div className="text-[9px] uppercase tracking-wide text-neutral-500">{rotulo}</div>
    <div className={`truncate ${forte ? "font-bold text-[13px]" : "font-medium"}`}>{valor}</div>
  </div>
);

/* Impressão: só a área do resumo aparece; o resto da página some. */
const CSS_IMPRESSAO = `
.resumo-print-root { display: none; }
@media print {
  @page { size: A4; margin: 10mm; }
  html.imprimindo-resumo body > *:not(.resumo-print-root) { display: none !important; }
  html.imprimindo-resumo .resumo-print-root { display: block !important; }
  html.imprimindo-resumo body { background: #fff !important; }
  .resumo-print-root .resumo-ficha { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
  .resumo-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

export default function ResumoPcp({
  rows, geral, periodo, nomeUsuario,
}: {
  rows: ResumoRow[];
  geral: boolean;
  /** Texto do filtro "Produzir até" ativo, se houver — sai no cabeçalho. */
  periodo: string | null;
  nomeUsuario: (id: string | null) => string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [geradoEm, setGeradoEm] = useState<Date | null>(null);
  /* Fotografa as linhas no clique: o quadro é tempo real e o resumo não
     deve se reorganizar enquanto a pessoa lê. */
  const [foto, setFoto] = useState<{ rows: ResumoRow[]; hist: HistRow[]; chat: ChatRow[] }>({ rows: [], hist: [], chat: [] });
  const pedidos = useMemo(() => montarResumo(foto.rows, foto.hist, foto.chat, nomeUsuario), [foto, nomeUsuario]);
  const titulo = geral ? "Resumo geral da produção" : "Resumo dos seus pedidos";

  const gerar = async () => {
    setAberto(true);
    setCarregando(true);
    const ativos = rows.filter(r => r.coluna_pcp && r.coluna_pcp !== "enviado" && r.coluna_pcp !== "cancelado");
    const ids = ativos.map(r => r.producao_id);
    const [hist, chat] = await Promise.all([
      carregarEmLotes<HistRow>("sistema_producao_historico", "producao_item_id, status_novo, observacao, created_at", ids),
      carregarEmLotes<ChatRow>("sistema_producao_comentarios", "producao_item_id, mensagem, autor_id, autor_nome, autor_email, created_at", ids),
    ]);
    setFoto({ rows: ativos, hist, chat });
    setGeradoEm(new Date());
    setCarregando(false);
  };

  useEffect(() => {
    const limpar = () => document.documentElement.classList.remove("imprimindo-resumo");
    window.addEventListener("afterprint", limpar);
    return () => window.removeEventListener("afterprint", limpar);
  }, []);

  const imprimir = () => {
    document.documentElement.classList.add("imprimindo-resumo");
    /* Um frame para o navegador aplicar a classe antes do diálogo. */
    requestAnimationFrame(() => window.print());
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(gerarTexto(pedidos, titulo, periodo));
      toast.success("Resumo copiado — é só colar no WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const cabecalho = (
    <div className="text-[11px] text-neutral-600">
      {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} em produção (sem "Coletado e Enviado"), em ordem de número
      {periodo && <> · {periodo}</>}
      {geradoEm && <> · gerado em {geradoEm.toLocaleDateString("pt-BR")} às {geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
    </div>
  );

  const lista = (
    <div className="space-y-3">
      {pedidos.map(p => <FichaPedido key={p.pedidoId} p={p} />)}
    </div>
  );

  return (
    <>
      <style>{CSS_IMPRESSAO}</style>
      <Button
        onClick={gerar}
        className="fixed bottom-5 right-5 z-40 h-11 rounded-full px-5 shadow-lg gap-2 bg-neutral-900 hover:bg-neutral-800 text-white print:hidden"
        title={geral ? "Resumo de todos os pedidos em produção" : "Resumo dos seus pedidos"}
      >
        <FileText className="h-4 w-4" /> Gerar resumo
      </Button>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col gap-0 bg-neutral-50">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-neutral-300 bg-white space-y-1 text-left">
            <SheetTitle className="text-lg text-neutral-900">{titulo}</SheetTitle>
            <SheetDescription asChild>{cabecalho}</SheetDescription>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" className="h-8 gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white" onClick={imprimir} disabled={carregando || pedidos.length === 0}>
                <Printer className="h-3.5 w-3.5" /> Imprimir / PDF (A4)
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copiar} disabled={carregando || pedidos.length === 0}>
                <Copy className="h-3.5 w-3.5" /> Copiar texto
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void gerar()} disabled={carregando}>
                <RefreshCw className="h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-16 text-neutral-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Montando o resumo…
              </div>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-sm">Nenhum pedido em produção para esse filtro.</div>
            ) : lista}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cópia só para impressão — fora do Sheet, direto no <body>. */}
      {aberto && !carregando && pedidos.length > 0 && createPortal(
        <div className="resumo-print-root text-neutral-900 bg-white">
          <div className="mb-3 pb-2 border-b-2 border-neutral-900">
            <div className="text-[16px] font-bold">{titulo}</div>
            {cabecalho}
          </div>
          {lista}
        </div>,
        document.body,
      )}
    </>
  );
}
