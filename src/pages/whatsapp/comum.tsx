import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* Tipos, rótulos, origem do lead, exportação e peças visuais compartilhadas
   pelas abas do /whatsapp. Sem IA: tudo aqui vem do que foi importado do
   Data Crazy e da planilha de leads do Meta. */

export interface Conversa {
  id: string;
  iniciada_em: string | null;
  ultima_mensagem_em: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  atendente: string | null;
  total_mensagens: number;
  primeira_mensagem_cliente: string | null;
  origem_detectada: string | null;
  tempo_primeira_resposta_seg: number | null;
  cliente_sem_resposta: boolean | null;
  mensagens_sdr: number | null;
  mensagens_consultor: number | null;
  handoff_em: string | null;
  consultor_entrou_em: string | null;
}
export interface LeadMeta {
  id: string;
  chave: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  lead_criado_em: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  formulario: string | null;
  plataforma: string | null;
  conversa_id: string | null;
  vinculo_metodo: string | null;
  vinculo_score: number | null;
}
export type ConversaComOrigem = Conversa & {
  origem: string;
  campanha: string | null;
  /** Por que a conversa recebeu essa origem (para o usuário conferir). */
  motivo: string;
  lead: LeadMeta | null;
};
export interface Regra { id: string; padrao: string; origem: string; campanha: string | null }

export const COLUNAS_CONVERSA =
  "id, iniciada_em, ultima_mensagem_em, contato_nome, contato_telefone, atendente, total_mensagens, " +
  "primeira_mensagem_cliente, origem_detectada, tempo_primeira_resposta_seg, cliente_sem_resposta, " +
  "mensagens_sdr, mensagens_consultor, handoff_em, consultor_entrou_em";

// Tabelas/colunas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tabela = (nome: string) => (supabase as any).from(nome);

export const ROTULO_ORIGEM: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  organico: "Orgânico",
  indicacao: "Indicação",
  outro: "Outro",
  nao_identificada: "Sem sinal de anúncio",
};

export const COR_ORIGEM: Record<string, string> = {
  google: "bg-amber-100 text-amber-800 border-amber-200",
  meta: "bg-blue-100 text-blue-800 border-blue-200",
  organico: "bg-emerald-100 text-emerald-800 border-emerald-200",
  indicacao: "bg-violet-100 text-violet-800 border-violet-200",
  outro: "bg-slate-100 text-slate-700 border-slate-200",
  nao_identificada: "bg-slate-50 text-slate-500 border-slate-200",
};

const ROTULO_VINCULO: Record<string, string> = {
  telefone: "telefone",
  email: "e-mail",
  nome_horario: "nome e horário",
  horario: "só pelo horário (conferir)",
  manual: "manual",
};

export const SEM_VENDEDOR = "(sem consultor)";

export const dataCurta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const dataCompleta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const mediana = (ns: number[]) => {
  if (!ns.length) return null;
  const o = [...ns].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};
export const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "—");
export const numero = (n: number) => n.toLocaleString("pt-BR");

export function duracao(seg: number | null | undefined) {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.round(seg / 60)} min`;
  if (seg < 86400) return `${Math.floor(seg / 3600)}h${String(Math.round((seg % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.round(seg / 86400)} d`;
}

export const tempoAssumir = (c: Conversa) =>
  c.handoff_em && c.consultor_entrou_em ? Math.max(0, (new Date(c.consultor_entrou_em).getTime() - new Date(c.handoff_em).getTime()) / 1000) : null;

/** Sem acento, minúsculo, espaços simples -- para comparar textos. */
export const normalizarTexto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Lead da planilha do Meta > regra da 1ª mensagem > sinal de anúncio que o Data Crazy mandou. */
export function classificarOrigem(c: Conversa, regras: Regra[], lead: LeadMeta | null) {
  if (lead) {
    return {
      origem: "meta",
      campanha: lead.campanha,
      motivo: `Está na planilha de leads do Meta (ligado por ${ROTULO_VINCULO[lead.vinculo_metodo ?? ""] ?? "vínculo"})` +
        (lead.anuncio ? ` · anúncio: ${lead.anuncio}` : ""),
    };
  }
  const msg = normalizarTexto(c.primeira_mensagem_cliente ?? "");
  const regra = msg ? regras.find((r) => msg.includes(normalizarTexto(r.padrao))) : undefined;
  if (regra) return { origem: regra.origem, campanha: regra.campanha, motivo: `1ª mensagem contém "${regra.padrao}"` };
  if (c.origem_detectada === "meta") return { origem: "meta", campanha: null, motivo: "O Data Crazy marcou a conversa como vinda de anúncio do Meta (clique para WhatsApp)" };
  if (c.origem_detectada === "google") return { origem: "google", campanha: null, motivo: "Há um código de clique do Google Ads na conversa" };
  return {
    origem: "nao_identificada",
    campanha: null,
    motivo: "Nenhum sinal de anúncio: não está na planilha do Meta, nenhuma regra bate com a 1ª mensagem e o Data Crazy não marcou anúncio. Provável orgânico ou indicação.",
  };
}

export function montarConversa(c: Conversa, regras: Regra[], lead: LeadMeta | null): ConversaComOrigem {
  return { ...c, lead, ...classificarOrigem(c, regras, lead) };
}

export async function chamar(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("analisar-conversas-comercial", { body: corpo });
  if (error) {
    // A mensagem útil vem no corpo da resposta de erro da função; num
    // estouro de tempo o corpo nem é JSON.
    const resposta = (error as { context?: Response }).context;
    let detalhe: { error?: string; aguardarSeg?: number } | null = null;
    let texto = "";
    try {
      texto = (await resposta?.text?.()) ?? "";
      detalhe = JSON.parse(texto);
    } catch { /* corpo não é JSON */ }
    if (detalhe?.aguardarSeg) return detalhe;
    const status = resposta?.status;
    throw new Error(
      detalhe?.error
      ?? (status === 546 || status === 504 ? "A função passou do tempo limite. Tente de novo (o que já foi feito fica salvo)." : null)
      ?? (texto ? `${status}: ${texto.slice(0, 200)}` : error.message),
    );
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- exportação ---------- */

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const hoje = () => new Date().toISOString().slice(0, 10);
const nomeArquivo = (s: string) => normalizarTexto(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "conversa";

function csvCampo(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Planilha (CSV com ";" e BOM: o Excel em português abre direto, com acentos). */
export function exportarCsv(lista: ConversaComOrigem[], prefixo = "conversas-whatsapp") {
  const cabecalho = [
    "cliente", "telefone", "origem", "campanha", "como_chegou", "primeira_mensagem_cliente",
    "lead_meta_nome", "lead_meta_email", "lead_meta_anuncio", "lead_meta_chegou_em",
    "consultor", "iniciada_em", "ultima_mensagem_em", "mensagens", "mensagens_sdr", "mensagens_consultor",
    "primeira_resposta_min", "consultor_assumiu_em", "cliente_sem_resposta", "id_conversa",
  ];
  const linhas = lista.map((c) => [
    c.contato_nome, c.contato_telefone, ROTULO_ORIGEM[c.origem] ?? c.origem, c.campanha, c.motivo, c.primeira_mensagem_cliente,
    c.lead?.nome, c.lead?.email, c.lead?.anuncio, dataCompleta(c.lead?.lead_criado_em),
    c.atendente, dataCompleta(c.iniciada_em), dataCompleta(c.ultima_mensagem_em), c.total_mensagens, c.mensagens_sdr, c.mensagens_consultor,
    c.tempo_primeira_resposta_seg != null ? Math.round(c.tempo_primeira_resposta_seg / 60) : "", dataCompleta(c.consultor_entrou_em),
    c.cliente_sem_resposta ? "sim" : "não", c.id,
  ].map(csvCampo).join(";"));
  baixarArquivo(`${prefixo}-${hoje()}.csv`, "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n"), "text/csv;charset=utf-8");
}

function blocoTexto(c: ConversaComOrigem, transcricao: string) {
  return [
    "=".repeat(80),
    `Cliente: ${c.contato_nome ?? "—"} · Telefone: ${c.contato_telefone ?? "—"}`,
    `Origem: ${ROTULO_ORIGEM[c.origem] ?? c.origem}${c.campanha ? ` / ${c.campanha}` : ""}`,
    `Como chegou: ${c.motivo}`,
    `Consultor: ${c.atendente ?? "—"} · Início: ${dataCompleta(c.iniciada_em)} · Última mensagem: ${dataCompleta(c.ultima_mensagem_em)}`,
    "=".repeat(80),
    transcricao || "(sem mensagens)",
    "",
  ].join("\n");
}

async function buscarTranscricoes(ids: string[]) {
  const mapa = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await tabela("comercial_conversas").select("id, transcricao").in("id", ids.slice(i, i + 100));
    if (error) throw error;
    for (const d of (data ?? []) as { id: string; transcricao: string | null }[]) mapa.set(d.id, d.transcricao ?? "");
  }
  return mapa;
}

/** Todas as conversas num .txt só, uma depois da outra. */
export async function exportarTranscricoes(lista: ConversaComOrigem[], prefixo = "conversas-whatsapp") {
  const mapa = await buscarTranscricoes(lista.map((c) => c.id));
  baixarArquivo(`${prefixo}-${hoje()}.txt`, lista.map((c) => blocoTexto(c, mapa.get(c.id) ?? "")).join("\n"), "text/plain;charset=utf-8");
}

/** Uma conversa, num .txt com o nome do cliente. */
export async function exportarUma(c: ConversaComOrigem) {
  const mapa = await buscarTranscricoes([c.id]);
  baixarArquivo(`${nomeArquivo(c.contato_nome ?? c.contato_telefone ?? "conversa")}.txt`, blocoTexto(c, mapa.get(c.id) ?? ""), "text/plain;charset=utf-8");
}

/* ---------- Visual ---------- */

export type Cor = "blue" | "emerald" | "violet" | "amber" | "rose" | "sky" | "teal" | "slate";

const COR_KPI: Record<Cor, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  violet: "bg-violet-50 border-violet-200 text-violet-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  rose: "bg-rose-50 border-rose-200 text-rose-700",
  sky: "bg-sky-50 border-sky-200 text-sky-700",
  teal: "bg-teal-50 border-teal-200 text-teal-700",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
};

const COR_ICONE: Record<Cor, string> = {
  blue: "bg-blue-600", emerald: "bg-emerald-600", violet: "bg-violet-600", amber: "bg-amber-500",
  rose: "bg-rose-600", sky: "bg-sky-500", teal: "bg-teal-600", slate: "bg-slate-500",
};

export function Kpi({ rotulo, valor, detalhe, classe, cor = "slate", onClick, ativo }: {
  rotulo: string; valor: string; detalhe?: string; classe?: string; cor?: Cor; onClick?: () => void; ativo?: boolean;
}) {
  return (
    <div
      className={cn("rounded-xl border p-4 transition", COR_KPI[cor], onClick && "cursor-pointer hover:shadow-md", ativo && "ring-2 ring-offset-1 ring-current")}
      onClick={onClick}
    >
      <div className="text-xs font-medium opacity-80">{rotulo}</div>
      <div className={cn("text-2xl font-bold mt-1", classe)}>{valor}</div>
      {detalhe && <div className="text-xs opacity-70">{detalhe}</div>}
    </div>
  );
}

export function Bloco({ titulo, icone: Icone, cor = "blue", acao, children }: {
  titulo: string; icone: LucideIcon; cor?: Cor; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-white", COR_ICONE[cor])}>
            <Icone className="h-4 w-4" />
          </span>
          {titulo}
        </h3>
        {acao}
      </div>
      {children}
    </div>
  );
}

export const Vazio = ({ texto = "Nada por aqui ainda." }: { texto?: string }) => <p className="text-sm text-muted-foreground">{texto}</p>;

export const avisarErro = (e: unknown) => toast.error((e as Error).message);
