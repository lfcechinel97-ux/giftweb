import { toast } from "sonner";
import { Bot, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* Tipos, rótulos e peças visuais compartilhadas pelas abas do /whatsapp. */

export interface Objecao {
  categoria: string;
  trecho_cliente: string;
  como_vendedor_lidou: string;
  /** Ausente nas análises do formato antigo ({ objecao, como_quebrar }). */
  foi_contornada?: boolean;
  resposta_sugerida: string;
}
export interface Melhoria { categoria?: string; titulo: string; detalhe: string; prioridade: "alta" | "media" | "baixa" }
export interface AnaliseSdr {
  handoff_feito: boolean;
  lead_qualificado: boolean;
  catalogo_enviado: boolean;
  acertos: string[];
  violacoes: { regra: string; trecho: string; correcao: string }[];
  sugestoes_prompt: string[];
}
export interface Analise {
  id: string;
  criado_em: string;
  modelo: string;
  transcricao_hash: string | null;
  nota: number | null;
  resultado: string | null;
  etapa_funil: string | null;
  resumo: string | null;
  pontos_fortes: string[];
  melhorias: Melhoria[];
  objecoes: Objecao[];
  oportunidades_perdidas: string[];
  proximo_passo: string | null;
  nota_sdr: number | null;
  sdr: AnaliseSdr | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
}
export interface Conversa {
  id: string;
  iniciada_em: string | null;
  ultima_mensagem_em: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  atendente: string | null;
  total_mensagens: number;
  transcricao_hash: string | null;
  transcricao_caracteres: number | null;
  primeira_mensagem_cliente: string | null;
  origem_detectada: string | null;
  tempo_primeira_resposta_seg: number | null;
  tempo_mediano_resposta_seg: number | null;
  cliente_sem_resposta: boolean | null;
  mensagens_sdr: number | null;
  mensagens_consultor: number | null;
  handoff_em: string | null;
  consultor_entrou_em: string | null;
  comercial_analises: Analise[];
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
export type StatusAnalise = "analisada" | "nao_analisada" | "desatualizada";
export type ConversaComAnalise = Conversa & {
  analise: Analise | null;
  status: StatusAnalise;
  origem: string;
  campanha: string | null;
  lead: LeadMeta | null;
};
export interface Regra { id: string; padrao: string; origem: string; campanha: string | null }

// Tabelas/colunas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tabela = (nome: string) => (supabase as any).from(nome);

/* As primeiras análises (teste da edge function) gravaram melhorias como
   texto solto e objeções como { objecao, como_quebrar } -- converte para o
   formato atual para a tela não quebrar. */
export function normalizar(a: Analise): Analise {
  const melhorias = (a.melhorias ?? []).map((m: Melhoria | string) =>
    typeof m === "string" ? { titulo: m, detalhe: "", prioridade: "media" as const } : m);
  const objecoes = (a.objecoes ?? []).map((o: Objecao & { objecao?: string; como_quebrar?: string }) =>
    o.objecao !== undefined && o.trecho_cliente === undefined
      ? { categoria: "outra", trecho_cliente: o.objecao ?? "", como_vendedor_lidou: "", resposta_sugerida: o.como_quebrar ?? "" }
      : o);
  return {
    ...a, melhorias, objecoes,
    pontos_fortes: a.pontos_fortes ?? [], oportunidades_perdidas: a.oportunidades_perdidas ?? [],
    nota_sdr: a.nota_sdr ?? null, sdr: a.sdr ?? null,
  };
}

export const ROTULO_OBJECAO: Record<string, string> = {
  preco: "Preço",
  prazo: "Prazo",
  quantidade_minima: "Quantidade mínima",
  frete: "Frete",
  qualidade: "Qualidade",
  confianca: "Confiança",
  concorrente: "Concorrente",
  aprovacao_interna: "Aprovação interna",
  vou_pensar: "Vou pensar",
  sumiu: "Cliente sumiu",
  outra: "Outra",
};

export const ROTULO_MELHORIA: Record<string, string> = {
  tempo_resposta: "Tempo de resposta",
  qualificacao: "Qualificação",
  apresentacao_produto: "Apresentação do produto",
  preco_negociacao: "Preço e negociação",
  follow_up: "Follow-up",
  fechamento: "Condução ao fechamento",
  informacao_incorreta: "Informação incorreta",
  organizacao_atendimento: "Organização do atendimento",
  outra: "Outros",
};

export const ROTULO_RESULTADO: Record<string, string> = {
  venda: "Venda",
  em_andamento: "Em andamento",
  perdida: "Perdida",
  sem_interesse: "Sem interesse",
  indefinido: "Indefinido",
};

export const ROTULO_ORIGEM: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  organico: "Orgânico",
  indicacao: "Indicação",
  outro: "Outro",
  nao_identificada: "Não identificada",
};

export const COR_ORIGEM: Record<string, string> = {
  google: "bg-amber-100 text-amber-800 border-amber-200",
  meta: "bg-blue-100 text-blue-800 border-blue-200",
  organico: "bg-emerald-100 text-emerald-800 border-emerald-200",
  indicacao: "bg-violet-100 text-violet-800 border-violet-200",
  outro: "bg-slate-100 text-slate-700 border-slate-200",
  nao_identificada: "bg-slate-50 text-slate-500 border-slate-200",
};

export const ROTULO_STATUS: Record<StatusAnalise, string> = {
  analisada: "Analisada",
  nao_analisada: "Não analisada",
  desatualizada: "Desatualizada",
};

export const COR_STATUS: Record<StatusAnalise, string> = {
  analisada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  nao_analisada: "bg-slate-100 text-slate-600 border-slate-200",
  desatualizada: "bg-amber-100 text-amber-800 border-amber-200",
};

export const SEM_VENDEDOR = "(sem consultor)";

export const corNota = (n: number | null | undefined) =>
  n == null ? "text-muted-foreground" : n >= 8 ? "text-emerald-600" : n >= 6 ? "text-amber-600" : "text-rose-600";

export const dataCurta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export const media = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);
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

/** Sem acento, minúsculo, espaços simples -- para comparar textos. */
export const normalizarTexto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Lead da planilha do Meta > regra da 1ª mensagem > o que o Data Crazy mandou do anúncio. */
export function classificarOrigem(c: Conversa, regras: Regra[], lead: LeadMeta | null) {
  if (lead) return { origem: "meta", campanha: lead.campanha };
  const msg = normalizarTexto(c.primeira_mensagem_cliente ?? "");
  const regra = msg ? regras.find((r) => msg.includes(normalizarTexto(r.padrao))) : undefined;
  if (regra) return { origem: regra.origem, campanha: regra.campanha };
  return { origem: c.origem_detectada ?? "nao_identificada", campanha: null };
}

export function montarConversa(c: Conversa, regras: Regra[], lead: LeadMeta | null): ConversaComAnalise {
  const ultima = [...(c.comercial_analises ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
  const status: StatusAnalise = !ultima ? "nao_analisada"
    : c.transcricao_hash && !c.comercial_analises.some((a) => a.transcricao_hash === c.transcricao_hash) ? "desatualizada"
    : "analisada";
  return { ...c, analise: ultima ? normalizar(ultima) : null, status, lead, ...classificarOrigem(c, regras, lead) };
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

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

export const Vazio = ({ texto = "Nada analisado ainda." }: { texto?: string }) => <p className="text-sm text-muted-foreground">{texto}</p>;

export function CartaoObjecao({ objecao: o, conversa, onAbrir }: { objecao: Objecao; conversa?: ConversaComAnalise; onAbrir?: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="italic">“{o.trecho_cliente}”</p>
        {o.foi_contornada !== undefined && (
          <Badge variant="outline" className={cn("shrink-0", o.foi_contornada ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-rose-50 text-rose-700 border-rose-300")}>
            {o.foi_contornada ? "contornada" : "não contornada"}
          </Badge>
        )}
      </div>
      {o.como_vendedor_lidou && (
        <p className="text-muted-foreground"><span className="font-medium text-foreground">Como lidou:</span> {o.como_vendedor_lidou}</p>
      )}
      <p className="bg-emerald-50 rounded p-2"><span className="font-medium">Resposta sugerida:</span> {o.resposta_sugerida}</p>
      {conversa && onAbrir && (
        <button className="text-xs text-blue-700 hover:underline" onClick={onAbrir}>
          {conversa.contato_nome || "abrir conversa"} · {conversa.atendente || SEM_VENDEDOR}
        </button>
      )}
    </div>
  );
}

export function DetalheAnalise({ analise: a }: { analise: Analise }) {
  const corPrioridade = { alta: "bg-rose-50 text-rose-700 border-rose-300", media: "bg-amber-50 text-amber-700 border-amber-300", baixa: "text-muted-foreground" };
  return (
    <div className="space-y-4">
      {a.resumo && <p className="text-sm">{a.resumo}</p>}
      {a.proximo_passo && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
          <span className="font-semibold">Próximo passo:</span> {a.proximo_passo}
        </div>
      )}
      {a.sdr && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2 text-violet-800">
            <Bot className="h-4 w-4" /> SDR de IA (Felipe)
            {a.nota_sdr != null && <span className={corNota(a.nota_sdr)}>{a.nota_sdr}/10</span>}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {([["handoff_feito", "passou p/ consultor"], ["lead_qualificado", "lead qualificado"], ["catalogo_enviado", "mandou catálogo"]] as const).map(([k, r]) => (
              <Badge key={k} variant="outline" className={a.sdr![k] ? "bg-white text-emerald-700 border-emerald-300" : "bg-white text-rose-700 border-rose-300"}>
                {a.sdr![k] ? "✓" : "✗"} {r}
              </Badge>
            ))}
          </div>
          {!!a.sdr.violacoes?.length && (
            <ul className="space-y-1.5">
              {a.sdr.violacoes.map((v, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{v.regra}</span>
                  <p className="text-rose-700">✗ “{v.trecho}”</p>
                  <p className="text-emerald-700">✓ {v.correcao}</p>
                </li>
              ))}
            </ul>
          )}
          {!!a.sdr.sugestoes_prompt?.length && (
            <div className="text-sm">
              <span className="font-medium">Sugestões para o prompt:</span>
              <ul className="list-disc pl-5">{a.sdr.sugestoes_prompt.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {!!a.pontos_fortes?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-emerald-700">Pontos fortes</h4>
          <ul className="list-disc pl-5 text-sm space-y-0.5">{a.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {!!a.melhorias?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-rose-700">Melhorias (consultor)</h4>
          <ul className="space-y-2">
            {a.melhorias.map((m, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={corPrioridade[m.prioridade] ?? ""}>{m.prioridade}</Badge>
                  {m.categoria && <span className="text-xs text-muted-foreground">{ROTULO_MELHORIA[m.categoria] ?? m.categoria}</span>}
                  <span className="font-medium">{m.titulo}</span>
                </div>
                {m.detalhe && <p className="text-muted-foreground mt-0.5">{m.detalhe}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!a.objecoes?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-amber-700">Objeções</h4>
          <div className="space-y-2">
            {a.objecoes.map((o, i) => (
              <div key={i}>
                <div className="text-xs font-medium text-muted-foreground mb-1">{ROTULO_OBJECAO[o.categoria] ?? o.categoria}</div>
                <CartaoObjecao objecao={o} />
              </div>
            ))}
          </div>
        </div>
      )}
      {!!a.oportunidades_perdidas?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Oportunidades perdidas</h4>
          <ul className="list-disc pl-5 text-sm space-y-0.5">{a.oportunidades_perdidas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Analisado em {dataCurta(a.criado_em)} · {a.modelo}
        {a.tokens_entrada != null && ` · ${numero(a.tokens_entrada + (a.tokens_saida ?? 0))} tokens`}
      </p>
    </div>
  );
}

export const copiar = (texto: string) => navigator.clipboard.writeText(texto).then(() => toast.success("Copiado."));
