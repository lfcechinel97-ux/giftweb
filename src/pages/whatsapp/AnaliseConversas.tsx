import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Sparkles, RefreshCw, Search, ShieldAlert, TrendingUp, MessageSquareText, Star, Bot, Megaphone,
  AlertTriangle, Brain, Trash2, Save, X, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* Análise das conversas do comercial (/whatsapp): conversas do Data Crazy
   avaliadas por IA (edge function analisar-conversas-comercial).
   - Importa um período em lotes (a função tem limite de tempo e o Data
     Crazy, de 20 req/min): primeiro importa as conversas, depois analisa as
     que mudaram. A página fica chamando até terminar.
   - O atendimento começa com o SDR de IA (Felipe) e passa para o consultor
     humano no "Resumo do projeto": a análise avalia os dois separadamente e
     a aba SDR junta as regras quebradas e as sugestões para o prompt dele.
   - Origem: a 1ª mensagem do cliente identifica a campanha (texto
     pré-preenchido do anúncio); regras "contém X -> Google/Meta" aplicadas
     aqui na tela, então valem também para o que já foi importado.
   Só admin. */

interface Objecao {
  categoria: string;
  trecho_cliente: string;
  como_vendedor_lidou: string;
  /** Ausente nas análises do formato antigo ({ objecao, como_quebrar }). */
  foi_contornada?: boolean;
  resposta_sugerida: string;
}
interface Melhoria { categoria?: string; titulo: string; detalhe: string; prioridade: "alta" | "media" | "baixa" }
interface AnaliseSdr {
  handoff_feito: boolean;
  lead_qualificado: boolean;
  catalogo_enviado: boolean;
  acertos: string[];
  violacoes: { regra: string; trecho: string; correcao: string }[];
  sugestoes_prompt: string[];
}
interface Analise {
  id: string;
  criado_em: string;
  modelo: string;
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
}
interface Conversa {
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
  tempo_mediano_resposta_seg: number | null;
  cliente_sem_resposta: boolean | null;
  comercial_analises: Analise[];
}
type ConversaComAnalise = Conversa & { analise: Analise | null; origem: string; campanha: string | null };
interface Regra { id: string; padrao: string; origem: string; campanha: string | null }
interface Diagnostico {
  id: string;
  criado_em: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_conversas: number;
  conteudo: {
    resumo_geral?: string;
    pontos_fracos?: { titulo: string; frequencia: string; impacto: string; exemplos: string[]; como_corrigir: string }[];
    por_vendedor?: { vendedor: string; deixa_a_desejar: string[]; pontos_fortes: string[]; foco_de_treinamento: string }[];
    por_origem?: { origem: string; observacao: string }[];
    scripts_recomendados?: { situacao: string; mensagem: string }[];
    acoes_prioritarias?: string[];
    prompt_sdr?: {
      avaliacao_geral: string;
      problemas_recorrentes: { problema: string; frequencia: string; regra_relacionada: string; exemplo: string }[];
      alteracoes_sugeridas: { secao: string; mudanca: string; texto_sugerido: string }[];
    };
  };
}

// Tabelas/colunas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string) => (supabase as any).from(nome);

/* As primeiras análises (teste da edge function) gravaram melhorias como
   texto solto e objeções como { objecao, como_quebrar } -- converte para o
   formato atual para a tela não quebrar. */
function normalizar(a: Analise): Analise {
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

const ROTULO_OBJECAO: Record<string, string> = {
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

const ROTULO_MELHORIA: Record<string, string> = {
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

const ROTULO_RESULTADO: Record<string, string> = {
  venda: "Venda",
  em_andamento: "Em andamento",
  perdida: "Perdida",
  sem_interesse: "Sem interesse",
  indefinido: "Indefinido",
};

const ROTULO_ORIGEM: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  organico: "Orgânico",
  indicacao: "Indicação",
  outro: "Outro",
  nao_identificada: "Não identificada",
};

const SEM_VENDEDOR = "(sem consultor)";

const corNota = (n: number | null) =>
  n == null ? "text-muted-foreground" : n >= 8 ? "text-emerald-600" : n >= 6 ? "text-amber-600" : "text-red-600";

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const media = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);
const mediana = (ns: number[]) => {
  if (!ns.length) return null;
  const o = [...ns].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};
const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "—");

function duracao(seg: number | null) {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.round(seg / 60)} min`;
  if (seg < 86400) return `${Math.floor(seg / 3600)}h${String(Math.round((seg % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.round(seg / 86400)} d`;
}

/** Sem acento, minúsculo, espaços simples -- para comparar a 1ª mensagem com as regras. */
const normalizarTexto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function classificarOrigem(c: Conversa, regras: Regra[]) {
  const msg = normalizarTexto(c.primeira_mensagem_cliente ?? "");
  const regra = msg ? regras.find((r) => msg.includes(normalizarTexto(r.padrao))) : undefined;
  if (regra) return { origem: regra.origem, campanha: regra.campanha };
  return { origem: c.origem_detectada ?? "nao_identificada", campanha: null };
}

const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const inicioMesAnterior = () => {
  const [a, m] = hojeIso().split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

async function chamar(corpo: Record<string, unknown>) {
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

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Progresso { fase: "importando" | "aguardando" | "analisando"; texto: string; valor: number | null }

export default function AnaliseConversas() {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState(inicioMesAnterior);
  const [fim, setFim] = useState(hojeIso);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const cancelar = useRef(false);
  const [vendedor, setVendedor] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<ConversaComAnalise | null>(null);
  const [reanalisando, setReanalisando] = useState(false);
  const [gerandoDiagnostico, setGerandoDiagnostico] = useState(false);

  const chaveConversas = ["whatsapp", "conversas", inicio, fim];
  const { data: brutas = [], isLoading } = useQuery({
    queryKey: chaveConversas,
    queryFn: async (): Promise<Conversa[]> => {
      const inicioIso = new Date(`${inicio}T00:00:00-03:00`).toISOString();
      const fimIso = new Date(`${fim}T23:59:59.999-03:00`).toISOString();
      const todas: Conversa[] = [];
      // PostgREST devolve no máximo 1000 linhas por vez.
      for (let de = 0; ; de += 1000) {
        const { data, error } = await tabela("comercial_conversas")
          .select(
            "id, iniciada_em, ultima_mensagem_em, contato_nome, contato_telefone, atendente, total_mensagens, " +
            "primeira_mensagem_cliente, origem_detectada, tempo_primeira_resposta_seg, tempo_mediano_resposta_seg, cliente_sem_resposta, " +
            "comercial_analises(id, criado_em, modelo, nota, resultado, etapa_funil, resumo, pontos_fortes, melhorias, objecoes, oportunidades_perdidas, proximo_passo, nota_sdr, sdr)",
          )
          .gte("ultima_mensagem_em", inicioIso)
          .lte("iniciada_em", fimIso)
          .order("ultima_mensagem_em", { ascending: false })
          .range(de, de + 999);
        if (error) throw error;
        todas.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return todas;
      }
    },
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["whatsapp", "regras-origem"],
    queryFn: async (): Promise<Regra[]> => {
      const { data, error } = await tabela("comercial_origens_regras").select("id, padrao, origem, campanha").order("criado_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: diagnostico } = useQuery({
    queryKey: ["whatsapp", "diagnostico"],
    queryFn: async (): Promise<Diagnostico | null> => {
      const { data, error } = await tabela("comercial_diagnosticos").select("*").order("criado_em", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const conversas = useMemo<ConversaComAnalise[]>(() => brutas.map((c) => {
    const ultima = [...(c.comercial_analises ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
    return { ...c, analise: ultima ? normalizar(ultima) : null, ...classificarOrigem(c, regras) };
  }), [brutas, regras]);

  const vendedores = useMemo(
    () => [...new Set(conversas.map((c) => c.atendente || SEM_VENDEDOR))].sort(),
    [conversas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) =>
      (vendedor === "todos" || (c.atendente || SEM_VENDEDOR) === vendedor) &&
      (origemFiltro === "todas" || c.origem === origemFiltro) &&
      (!termo || [c.contato_nome, c.contato_telefone, c.atendente, c.primeira_mensagem_cliente, c.analise?.resumo]
        .some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [conversas, vendedor, origemFiltro, busca]);

  const analisadas = useMemo(() => filtradas.filter((c) => c.analise), [filtradas]);

  const resumo = useMemo(() => {
    const notas = analisadas.map((c) => c.analise!.nota).filter((n): n is number => n != null);
    const objecoes = analisadas.flatMap((c) => (c.analise!.objecoes ?? []).map((o) => ({ ...o, conversa: c })));
    const porCategoria = new Map<string, typeof objecoes>();
    for (const o of objecoes) {
      const chave = ROTULO_OBJECAO[o.categoria] ? o.categoria : "outra";
      porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), o]);
    }
    const categorias = [...porCategoria.entries()]
      .map(([categoria, itens]) => ({ categoria, itens, contornadas: itens.filter((o) => o.foi_contornada).length }))
      .sort((a, b) => b.itens.length - a.itens.length);

    // Pontos que deixam a desejar: em quantas conversas cada tipo de melhoria aparece.
    const pontosFracos = new Map<string, { conversas: Set<string>; altas: number; exemplos: { titulo: string; conversa: ConversaComAnalise }[] }>();
    for (const c of analisadas) {
      for (const m of c.analise!.melhorias ?? []) {
        const chave = m.categoria && ROTULO_MELHORIA[m.categoria] ? m.categoria : "outra";
        const p = pontosFracos.get(chave) ?? { conversas: new Set(), altas: 0, exemplos: [] };
        p.conversas.add(c.id);
        if (m.prioridade === "alta") p.altas++;
        if (p.exemplos.length < 4) p.exemplos.push({ titulo: m.titulo, conversa: c });
        pontosFracos.set(chave, p);
      }
    }
    const fracos = [...pontosFracos.entries()]
      .map(([categoria, p]) => ({ categoria, conversas: p.conversas.size, altas: p.altas, exemplos: p.exemplos }))
      .sort((a, b) => b.conversas - a.conversas);

    const melhoriasAltas = analisadas.flatMap((c) =>
      (c.analise!.melhorias ?? []).filter((m) => m.prioridade === "alta").map((m) => ({ ...m, conversa: c })),
    );

    const porVendedor = new Map<string, ConversaComAnalise[]>();
    for (const c of filtradas) {
      const v = c.atendente || SEM_VENDEDOR;
      porVendedor.set(v, [...(porVendedor.get(v) ?? []), c]);
    }
    const ranking = [...porVendedor.entries()].map(([nome, cs]) => {
      const comAnalise = cs.filter((c) => c.analise);
      const obj = comAnalise.flatMap((c) => c.analise!.objecoes ?? []);
      const contagem = new Map<string, number>();
      for (const c of comAnalise) {
        for (const cat of new Set((c.analise!.melhorias ?? []).map((m) => m.categoria ?? "outra"))) {
          contagem.set(cat, (contagem.get(cat) ?? 0) + 1);
        }
      }
      const pior = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        nome,
        conversas: cs.length,
        nota: media(comAnalise.map((c) => c.analise!.nota).filter((n): n is number => n != null)),
        vendas: comAnalise.filter((c) => c.analise!.resultado === "venda").length,
        objecoes: obj.length,
        contornadas: obj.filter((o) => o.foi_contornada).length,
        primeiraResposta: mediana(cs.map((c) => c.tempo_primeira_resposta_seg).filter((n): n is number => n != null)),
        semResposta: cs.filter((c) => c.cliente_sem_resposta).length,
        piorPonto: pior ? `${ROTULO_MELHORIA[pior[0]] ?? pior[0]} (${pior[1]})` : "—",
      };
    }).sort((a, b) => b.conversas - a.conversas);

    return {
      notaMedia: media(notas),
      totalObjecoes: objecoes.length,
      contornadas: objecoes.filter((o) => o.foi_contornada).length,
      vendas: analisadas.filter((c) => c.analise!.resultado === "venda").length,
      primeiraResposta: mediana(filtradas.map((c) => c.tempo_primeira_resposta_seg).filter((n): n is number => n != null)),
      semResposta: filtradas.filter((c) => c.cliente_sem_resposta).length,
      categorias,
      fracos,
      melhoriasAltas,
      ranking,
    };
  }, [analisadas, filtradas]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["whatsapp"] });

  /** Importa o período em lotes e depois analisa as conversas novas/alteradas. */
  const processarPeriodo = async () => {
    if (inicio > fim) { toast.error("O início do período é depois do fim."); return; }
    cancelar.current = false;
    let importadas = 0;
    let puladas = 0;
    const erros: string[] = [];
    try {
      let skip = 0;
      for (let lote = 1; !cancelar.current; lote++) {
        setProgresso({ fase: "importando", texto: `Importando conversas do Data Crazy… lote ${lote} · ${importadas} importadas, ${puladas} já estavam em dia`, valor: null });
        const r = await chamar({ acao: "importar", inicio, fim, skip });
        if (r.aguardarSeg) {
          for (let s = r.aguardarSeg; s > 0 && !cancelar.current; s--) {
            setProgresso({ fase: "aguardando", texto: `Limite do Data Crazy (20 req/min) — continuando em ${s}s…`, valor: null });
            await esperar(1000);
          }
        }
        importadas += r.importadas ?? 0;
        puladas += r.puladas ?? 0;
        erros.push(...(r.erros ?? []));
        skip = r.proximoSkip ?? skip;
        if (lote % 3 === 0) recarregar();
        if (r.terminou) break;
      }
      recarregar();

      let analisadasTotal = 0;
      let total: number | null = null;
      while (!cancelar.current) {
        setProgresso({
          fase: "analisando",
          texto: `Analisando com IA… ${analisadasTotal} analisadas${total != null ? ` de ${total}` : ""}`,
          valor: total ? Math.round((analisadasTotal / total) * 100) : null,
        });
        const r = await chamar({ acao: "analisar_pendentes", inicio, fim });
        analisadasTotal += r.analisadas ?? 0;
        erros.push(...(r.erros ?? []));
        total ??= (r.analisadas ?? 0) + (r.curtas ?? 0) + (r.erros?.length ?? 0) + (r.restantes ?? 0);
        recarregar();
        // Rodada sem nenhuma análise (só erros): para, senão repetiria os mesmos erros para sempre.
        if (r.terminou || !r.analisadas) break;
      }
      toast.success(`${importadas} conversa(s) importada(s), ${analisadasTotal} analisada(s).`);
      if (erros.length) toast.error(`${erros.length} erro(s). Primeiro: ${erros[0]}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgresso(null);
      recarregar();
    }
  };

  const reanalisar = async (c: ConversaComAnalise) => {
    setReanalisando(true);
    try {
      const r = await chamar({ conversaId: c.id, reanalizar: true });
      if (r.aguardarSeg) toast.info(`Limite do Data Crazy, tente de novo em ${r.aguardarSeg}s.`);
      else if (!r.analisadas) toast.info("Conversa curta demais para analisar.");
      await qc.invalidateQueries({ queryKey: chaveConversas });
      const atualizadas = qc.getQueryData<Conversa[]>(chaveConversas) ?? [];
      const nova = atualizadas.find((x) => x.id === c.id);
      if (nova) {
        const ultima = [...(nova.comercial_analises ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
        setAberta({ ...nova, analise: ultima ? normalizar(ultima) : null, ...classificarOrigem(nova, regras) });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReanalisando(false);
    }
  };

  const gerarDiagnostico = async () => {
    setGerandoDiagnostico(true);
    try {
      await chamar({ acao: "diagnostico_geral", inicio, fim });
      await qc.invalidateQueries({ queryKey: ["whatsapp", "diagnostico"] });
      toast.success("Diagnóstico gerado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerandoDiagnostico(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Análise comercial</h2>
          <p className="text-sm text-muted-foreground">
            Conversas do Data Crazy avaliadas por IA: SDR, consultores, objeções e origem dos leads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-[150px]" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!!progresso} />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" className="w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} disabled={!!progresso} />
          <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={processarPeriodo} disabled={!!progresso}>
            {progresso ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Importar e analisar período
          </Button>
        </div>
      </div>

      {progresso && (
        <div className="bg-card rounded-lg border border-blue-200 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {progresso.fase === "aguardando" ? <Clock className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-700" />}
              {progresso.texto}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { cancelar.current = true; }}>
              <X className="h-4 w-4 mr-1" /> Parar
            </Button>
          </div>
          <Progress value={progresso.valor ?? undefined} className={cn(progresso.valor == null && "animate-pulse")} />
          <p className="text-xs text-muted-foreground">
            Deixe esta aba aberta. O Data Crazy permite 20 requisições por minuto (~15 conversas/min). Se parar, o que já
            foi importado fica salvo e a próxima rodada continua de onde faltou.
          </p>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente, telefone, 1ª mensagem, resumo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os consultores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {Object.entries(ROTULO_ORIGEM).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="geral">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="sdr">SDR (IA)</TabsTrigger>
            <TabsTrigger value="origem">Origem</TabsTrigger>
            <TabsTrigger value="objecoes">Objeções</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
            <TabsTrigger value="conversas">Conversas ({filtradas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi rotulo="Conversas no período" valor={String(filtradas.length)} detalhe={`${analisadas.length} analisadas`} />
              <Kpi rotulo="Nota média (consultor)" valor={resumo.notaMedia == null ? "—" : resumo.notaMedia.toFixed(1)} classe={corNota(resumo.notaMedia)} />
              <Kpi rotulo="Vendas fechadas" valor={String(resumo.vendas)} detalhe={pct(resumo.vendas, analisadas.length) + " das analisadas"} />
              <Kpi rotulo="Objeções contornadas" valor={pct(resumo.contornadas, resumo.totalObjecoes)} detalhe={`${resumo.contornadas} de ${resumo.totalObjecoes}`} />
              <Kpi rotulo="1ª resposta (mediana)" valor={duracao(resumo.primeiraResposta)} />
              <Kpi
                rotulo="Cliente ficou sem resposta"
                valor={pct(resumo.semResposta, filtradas.length)}
                detalhe={`${resumo.semResposta} conversa(s)`}
                classe={resumo.semResposta ? "text-red-600" : undefined}
              />
            </div>

            <Bloco titulo="Pontos que estão deixando a desejar" icone={AlertTriangle}>
              {resumo.fracos.length ? (
                <div className="space-y-3">
                  {resumo.fracos.map((p) => (
                    <div key={p.categoria}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{ROTULO_MELHORIA[p.categoria] ?? p.categoria}</span>
                        <span className="text-muted-foreground">
                          {p.conversas} conversa(s) · {pct(p.conversas, analisadas.length)}{p.altas ? ` · ${p.altas} de prioridade alta` : ""}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-red-500/80" style={{ width: `${(p.conversas / Math.max(1, analisadas.length)) * 100}%` }} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {p.exemplos.map((ex, i) => (
                          <button key={i} className="text-xs text-blue-700 hover:underline text-left" onClick={() => setAberta(ex.conversa)}>
                            {ex.titulo}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Vazio />}
            </Bloco>

            <Bloco titulo="Por consultor" icone={Star}>
              {resumo.ranking.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consultor</TableHead>
                        <TableHead className="text-right">Conversas</TableHead>
                        <TableHead className="text-right">Nota média</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                        <TableHead className="text-right">Objeções contornadas</TableHead>
                        <TableHead className="text-right">1ª resposta</TableHead>
                        <TableHead className="text-right">Sem resposta</TableHead>
                        <TableHead>Ponto mais fraco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumo.ranking.map((r) => (
                        <TableRow key={r.nome}>
                          <TableCell className="font-medium">{r.nome}</TableCell>
                          <TableCell className="text-right">{r.conversas}</TableCell>
                          <TableCell className={cn("text-right font-semibold", corNota(r.nota))}>{r.nota == null ? "—" : r.nota.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{r.vendas}</TableCell>
                          <TableCell className="text-right">{r.objecoes ? `${r.contornadas}/${r.objecoes}` : "—"}</TableCell>
                          <TableCell className="text-right">{duracao(r.primeiraResposta)}</TableCell>
                          <TableCell className={cn("text-right", r.semResposta && "text-red-600")}>{r.semResposta}</TableCell>
                          <TableCell className="text-sm">{r.piorPonto}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <Vazio />}
              <p className="text-xs text-muted-foreground mt-2">
                1ª resposta = mediana do tempo entre a 1ª mensagem do cliente e a 1ª resposta (SDR ou consultor).
              </p>
            </Bloco>

            <Bloco titulo="Melhorias prioritárias" icone={TrendingUp}>
              {resumo.melhoriasAltas.length ? (
                <ul className="divide-y divide-border">
                  {resumo.melhoriasAltas.slice(0, 30).map((m, i) => (
                    <li key={i} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{m.titulo}</span>
                        <button className="text-xs text-blue-700 hover:underline shrink-0" onClick={() => setAberta(m.conversa)}>
                          {m.conversa.contato_nome || "conversa"} · {m.conversa.atendente || SEM_VENDEDOR}
                        </button>
                      </div>
                      {m.detalhe && <p className="text-sm text-muted-foreground mt-0.5">{m.detalhe}</p>}
                    </li>
                  ))}
                </ul>
              ) : <Vazio />}
            </Bloco>
          </TabsContent>

          <TabsContent value="sdr" className="space-y-6">
            <AbaSdr analisadas={analisadas} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="origem" className="space-y-6">
            <AbaOrigem conversas={filtradas} regras={regras} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="objecoes" className="space-y-4">
            {resumo.categorias.length ? resumo.categorias.map((cat) => (
              <Bloco
                key={cat.categoria}
                titulo={`${ROTULO_OBJECAO[cat.categoria]} — ${cat.itens.length}× (${cat.contornadas} contornada${cat.contornadas === 1 ? "" : "s"})`}
                icone={ShieldAlert}
              >
                <div className="space-y-3">
                  {cat.itens.slice(0, 15).map((o, i) => <CartaoObjecao key={i} objecao={o} onAbrir={() => setAberta(o.conversa)} conversa={o.conversa} />)}
                </div>
              </Bloco>
            )) : <Vazio />}
          </TabsContent>

          <TabsContent value="diagnostico" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                A IA lê todas as análises do período ({inicio.split("-").reverse().join("/")} a {fim.split("-").reverse().join("/")})
                e aponta os pontos fracos recorrentes, o que cada consultor precisa melhorar e as mudanças no prompt do SDR.
              </p>
              <Button onClick={gerarDiagnostico} disabled={gerandoDiagnostico || !!progresso}>
                {gerandoDiagnostico ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
                Gerar diagnóstico do período
              </Button>
            </div>
            {diagnostico ? <DetalheDiagnostico d={diagnostico} /> : <Vazio />}
          </TabsContent>

          <TabsContent value="conversas">
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Última msg</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="text-right">1ª resposta</TableHead>
                    <TableHead className="text-right">SDR</TableHead>
                    <TableHead className="text-right">Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setAberta(c)}>
                      <TableCell className="text-sm whitespace-nowrap">{dataCurta(c.ultima_mensagem_em)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c.contato_nome || "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.contato_telefone || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {ROTULO_ORIGEM[c.origem] ?? c.origem}
                        {c.campanha && <div className="text-xs text-muted-foreground">{c.campanha}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{c.atendente || "—"}</TableCell>
                      <TableCell>
                        {c.analise?.resultado
                          ? <Badge variant="outline">{ROTULO_RESULTADO[c.analise.resultado] ?? c.analise.resultado}</Badge>
                          : <span className="text-xs text-muted-foreground">{c.analise ? "—" : "não analisada"}</span>}
                        {c.cliente_sem_resposta && <Badge variant="outline" className="ml-1 text-red-700 border-red-300">sem resposta</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{duracao(c.tempo_primeira_resposta_seg)}</TableCell>
                      <TableCell className={cn("text-right", corNota(c.analise?.nota_sdr ?? null))}>{c.analise?.nota_sdr ?? "—"}</TableCell>
                      <TableCell className={cn("text-right font-semibold", corNota(c.analise?.nota ?? null))}>
                        {c.analise?.nota ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtradas.length && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma conversa no período. Clique em "Importar e analisar período".
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {aberta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {aberta.contato_nome || aberta.contato_telefone || "Conversa"}
                  {aberta.analise?.nota != null && (
                    <span className={cn("text-lg", corNota(aberta.analise.nota))}>{aberta.analise.nota}/10</span>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {aberta.atendente || SEM_VENDEDOR} · {aberta.total_mensagens} mensagens · {dataCurta(aberta.ultima_mensagem_em)}
                  {aberta.analise?.etapa_funil && <> · {aberta.analise.etapa_funil}</>}
                  {" · "}{ROTULO_ORIGEM[aberta.origem] ?? aberta.origem}{aberta.campanha && ` (${aberta.campanha})`}
                </p>
              </DialogHeader>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => reanalisar(aberta)} disabled={reanalisando}>
                  {reanalisando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {aberta.analise ? "Reanalisar" : "Analisar"}
                </Button>
              </div>

              {aberta.analise ? <DetalheAnalise analise={aberta.analise} /> : (
                <p className="text-sm text-muted-foreground">Ainda não analisada (conversa curta ou sem resposta dos dois lados).</p>
              )}

              <Transcricao conversaId={aberta.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A transcrição é pesada: só busca quando a conversa é aberta. */
function Transcricao({ conversaId }: { conversaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp", "transcricao", conversaId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await tabela("comercial_conversas").select("transcricao").eq("id", conversaId).maybeSingle();
      if (error) throw error;
      return data?.transcricao ?? null;
    },
  });
  return (
    <Bloco titulo="Transcrição" icone={MessageSquareText}>
      {isLoading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : <pre className="text-xs whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto">{data || "—"}</pre>}
    </Bloco>
  );
}

function AbaSdr({ analisadas, onAbrir }: { analisadas: ConversaComAnalise[]; onAbrir: (c: ConversaComAnalise) => void }) {
  const qc = useQueryClient();
  const { data: promptSalvo, isLoading } = useQuery({
    queryKey: ["whatsapp", "prompt-sdr"],
    queryFn: async (): Promise<string> => {
      const { data, error } = await tabela("comercial_configuracoes").select("valor").eq("chave", "prompt_sdr").maybeSingle();
      if (error) throw error;
      return data?.valor ?? "";
    },
  });
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const texto = rascunho ?? promptSalvo ?? "";

  const salvar = async () => {
    setSalvando(true);
    const { error } = await tabela("comercial_configuracoes")
      .upsert({ chave: "prompt_sdr", valor: texto, atualizado_em: new Date().toISOString() });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    setRascunho(null);
    qc.invalidateQueries({ queryKey: ["whatsapp", "prompt-sdr"] });
    toast.success("Prompt do SDR salvo. As próximas análises usam esta versão.");
  };

  const comSdr = analisadas.filter((c) => c.analise!.sdr);
  const notas = comSdr.map((c) => c.analise!.nota_sdr).filter((n): n is number => n != null);
  const conta = (f: (s: AnaliseSdr) => boolean) => comSdr.filter((c) => f(c.analise!.sdr!)).length;

  // Regras mais quebradas (agrupadas pelo texto da regra, que a IA cita do prompt).
  const violacoes = new Map<string, { regra: string; itens: { trecho: string; correcao: string; conversa: ConversaComAnalise }[] }>();
  for (const c of comSdr) {
    for (const v of c.analise!.sdr!.violacoes ?? []) {
      const chave = normalizarTexto(v.regra).slice(0, 80);
      const g = violacoes.get(chave) ?? { regra: v.regra, itens: [] };
      g.itens.push({ trecho: v.trecho, correcao: v.correcao, conversa: c });
      violacoes.set(chave, g);
    }
  }
  const ranking = [...violacoes.values()].sort((a, b) => b.itens.length - a.itens.length);
  const sugestoes = comSdr.flatMap((c) => (c.analise!.sdr!.sugestoes_prompt ?? []).map((s) => ({ s, conversa: c })));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi rotulo="Nota média do SDR" valor={media(notas)?.toFixed(1) ?? "—"} classe={corNota(media(notas))} detalhe={`${comSdr.length} conversa(s)`} />
        <Kpi rotulo="Passou para o consultor" valor={pct(conta((s) => s.handoff_feito), comSdr.length)} />
        <Kpi rotulo="Lead bem qualificado" valor={pct(conta((s) => s.lead_qualificado), comSdr.length)} />
        <Kpi rotulo="Mandou catálogo" valor={pct(conta((s) => s.catalogo_enviado), comSdr.length)} />
        <Kpi rotulo="Regras quebradas" valor={String(ranking.reduce((s, g) => s + g.itens.length, 0))} />
      </div>

      <Bloco titulo="Regras do prompt mais quebradas" icone={AlertTriangle}>
        {ranking.length ? (
          <div className="space-y-4">
            {ranking.slice(0, 15).map((g, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{g.regra}</span>
                  <Badge variant="outline" className="text-red-700 border-red-300 shrink-0">{g.itens.length}×</Badge>
                </div>
                <div className="mt-1 space-y-1.5">
                  {g.itens.slice(0, 3).map((it, j) => (
                    <div key={j} className="text-sm rounded-md border border-border p-2">
                      <p className="text-red-700">✗ “{it.trecho}”</p>
                      <p className="text-emerald-700">✓ {it.correcao}</p>
                      <button className="text-xs text-blue-700 hover:underline" onClick={() => onAbrir(it.conversa)}>
                        {it.conversa.contato_nome || "abrir conversa"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <Vazio />}
      </Bloco>

      <Bloco titulo="Sugestões para o prompt (por conversa)" icone={Bot}>
        {sugestoes.length ? (
          <ul className="divide-y divide-border">
            {sugestoes.slice(0, 40).map((x, i) => (
              <li key={i} className="py-2 text-sm flex items-start justify-between gap-2">
                <span>{x.s}</span>
                <button className="text-xs text-blue-700 hover:underline shrink-0" onClick={() => onAbrir(x.conversa)}>
                  {x.conversa.contato_nome || "conversa"}
                </button>
              </li>
            ))}
          </ul>
        ) : <Vazio />}
        <p className="text-xs text-muted-foreground mt-2">
          A versão consolidada (com texto pronto para colar no prompt) sai na aba Diagnóstico.
        </p>
      </Bloco>

      <Bloco titulo="Prompt atual do SDR" icone={Bot}>
        <p className="text-sm text-muted-foreground mb-2">
          Cole aqui o prompt do Felipe. A IA usa este texto para conferir as regras em cada conversa e sugerir mudanças.
          Mantenha atualizado quando alterar o agente.
        </p>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Textarea className="font-mono text-xs min-h-[260px]" value={texto} onChange={(e) => setRascunho(e.target.value)} placeholder="<system_instruction>…" />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={salvar} disabled={salvando || rascunho == null}>
                {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar prompt
              </Button>
            </div>
          </>
        )}
      </Bloco>
    </>
  );
}

function AbaOrigem({ conversas, regras, onAbrir }: { conversas: ConversaComAnalise[]; regras: Regra[]; onAbrir: (c: ConversaComAnalise) => void }) {
  const qc = useQueryClient();
  const [nova, setNova] = useState<{ padrao: string; origem: string; campanha: string } | null>(null);

  const porOrigem = useMemo(() => {
    const m = new Map<string, ConversaComAnalise[]>();
    for (const c of conversas) {
      const chave = c.campanha ? `${c.origem}|${c.campanha}` : c.origem;
      m.set(chave, [...(m.get(chave) ?? []), c]);
    }
    return [...m.entries()].map(([chave, cs]) => {
      const [origem, campanha] = chave.split("|");
      const an = cs.filter((c) => c.analise);
      return {
        chave, origem, campanha,
        leads: cs.length,
        analisadas: an.length,
        nota: media(an.map((c) => c.analise!.nota).filter((n): n is number => n != null)),
        vendas: an.filter((c) => c.analise!.resultado === "venda").length,
        semResposta: cs.filter((c) => c.cliente_sem_resposta).length,
      };
    }).sort((a, b) => b.leads - a.leads);
  }, [conversas]);

  // Mensagens iniciais agrupadas: o texto pré-preenchido de cada anúncio aparece muitas vezes igual.
  const grupos = useMemo(() => {
    const m = new Map<string, { texto: string; conversas: ConversaComAnalise[] }>();
    for (const c of conversas) {
      const texto = c.primeira_mensagem_cliente?.trim();
      if (!texto) continue;
      const chave = normalizarTexto(texto).slice(0, 140);
      const g = m.get(chave) ?? { texto, conversas: [] };
      g.conversas.push(c);
      m.set(chave, g);
    }
    return [...m.values()].sort((a, b) => b.conversas.length - a.conversas.length);
  }, [conversas]);

  const salvarRegra = async () => {
    if (!nova?.padrao.trim()) return;
    const { error } = await tabela("comercial_origens_regras")
      .insert({ padrao: nova.padrao.trim(), origem: nova.origem, campanha: nova.campanha.trim() || null });
    if (error) { toast.error(error.message); return; }
    setNova(null);
    qc.invalidateQueries({ queryKey: ["whatsapp", "regras-origem"] });
  };

  const excluirRegra = async (id: string) => {
    const { error } = await tabela("comercial_origens_regras").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["whatsapp", "regras-origem"] });
  };

  return (
    <>
      <Bloco titulo="Leads por origem" icone={Megaphone}>
        {porOrigem.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Analisadas</TableHead>
                  <TableHead className="text-right">Nota média</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Sem resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porOrigem.map((o) => (
                  <TableRow key={o.chave}>
                    <TableCell className="font-medium">
                      {ROTULO_ORIGEM[o.origem] ?? o.origem}
                      {o.campanha && <span className="text-muted-foreground font-normal"> · {o.campanha}</span>}
                    </TableCell>
                    <TableCell className="text-right">{o.leads}</TableCell>
                    <TableCell className="text-right">{o.analisadas}</TableCell>
                    <TableCell className={cn("text-right font-semibold", corNota(o.nota))}>{o.nota?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.vendas}</TableCell>
                    <TableCell className="text-right">{pct(o.vendas, o.analisadas)}</TableCell>
                    <TableCell className="text-right">{o.semResposta}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <Vazio />}
        <p className="text-xs text-muted-foreground mt-2">
          A origem vem das regras abaixo (1ª mensagem contém o texto). Sem regra, usa o que o Data Crazy mandar do anúncio
          (ex.: referral de anúncio do Meta); se não houver nada, fica "Não identificada".
        </p>
      </Bloco>

      <Bloco titulo="Regras de origem" icone={Megaphone}>
        {regras.length ? (
          <ul className="divide-y divide-border mb-3">
            {regras.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span>
                  contém <span className="font-mono bg-muted px-1 rounded">“{r.padrao}”</span> → <b>{ROTULO_ORIGEM[r.origem] ?? r.origem}</b>
                  {r.campanha && <span className="text-muted-foreground"> · {r.campanha}</span>}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => excluirRegra(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground mb-3">Nenhuma regra ainda. Use "Classificar" nas mensagens abaixo.</p>}
        {nova && (
          <div className="rounded-md border border-blue-200 p-3 space-y-2">
            <Input value={nova.padrao} onChange={(e) => setNova({ ...nova, padrao: e.target.value })} placeholder="Trecho que identifica a campanha" />
            <p className="text-xs text-muted-foreground">
              Deixe só o trecho fixo do texto do anúncio (ex.: "vi o anúncio no Google"). Não diferencia maiúsculas nem acentos.
            </p>
            <div className="flex flex-wrap gap-2">
              <Select value={nova.origem} onValueChange={(v) => setNova({ ...nova, origem: v })}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["google", "meta", "organico", "indicacao", "outro"].map((o) => <SelectItem key={o} value={o}>{ROTULO_ORIGEM[o]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="flex-1 min-w-[180px]" value={nova.campanha} onChange={(e) => setNova({ ...nova, campanha: e.target.value })} placeholder="Campanha (opcional)" />
              <Button onClick={salvarRegra}><Save className="h-4 w-4 mr-1" /> Salvar regra</Button>
              <Button variant="ghost" onClick={() => setNova(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Mensagens iniciais dos leads" icone={MessageSquareText}>
        {grupos.length ? (
          <ul className="divide-y divide-border">
            {grupos.slice(0, 80).map((g, i) => {
              const origem = g.conversas[0].origem;
              return (
                <li key={i} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words">“{g.texto.slice(0, 300)}”</p>
                    <p className="text-xs text-muted-foreground">
                      {g.conversas.length} lead(s) · {ROTULO_ORIGEM[origem] ?? origem}
                      {g.conversas[0].campanha && ` · ${g.conversas[0].campanha}`}
                      {" · "}
                      <button className="text-blue-700 hover:underline" onClick={() => onAbrir(g.conversas[0])}>ver conversa</button>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0"
                    onClick={() => setNova({ padrao: g.texto.slice(0, 120), origem: "meta", campanha: "" })}>
                    Classificar
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : <Vazio />}
      </Bloco>
    </>
  );
}

function DetalheDiagnostico({ d }: { d: Diagnostico }) {
  const c = d.conteudo;
  const fmt = (s: string) => s?.split("-").reverse().join("/");
  const corImpacto: Record<string, string> = { alto: "text-red-700 border-red-300", medio: "text-amber-700 border-amber-300", baixo: "" };
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Gerado em {dataCurta(d.criado_em)} · período {fmt(d.periodo_inicio)} a {fmt(d.periodo_fim)} · {d.total_conversas} conversas
      </p>
      {c.resumo_geral && <p className="text-sm">{c.resumo_geral}</p>}

      {!!c.acoes_prioritarias?.length && (
        <Bloco titulo="Ações prioritárias" icone={TrendingUp}>
          <ol className="list-decimal pl-5 text-sm space-y-1">{c.acoes_prioritarias.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </Bloco>
      )}

      {!!c.pontos_fracos?.length && (
        <Bloco titulo="Pontos que estão deixando a desejar" icone={AlertTriangle}>
          <div className="space-y-3">
            {c.pontos_fracos.map((p, i) => (
              <div key={i} className="rounded-md border border-border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.titulo}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{p.frequencia}</span>
                    <Badge variant="outline" className={corImpacto[p.impacto] ?? ""}>impacto {p.impacto}</Badge>
                  </span>
                </div>
                {!!p.exemplos?.length && <ul className="list-disc pl-5 text-muted-foreground">{p.exemplos.map((e, j) => <li key={j}>{e}</li>)}</ul>}
                <p className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2"><b>Como corrigir:</b> {p.como_corrigir}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      {c.prompt_sdr && (
        <Bloco titulo="SDR de IA — mudanças no prompt" icone={Bot}>
          <p className="text-sm mb-3">{c.prompt_sdr.avaliacao_geral}</p>
          {!!c.prompt_sdr.problemas_recorrentes?.length && (
            <>
              <h4 className="font-semibold text-sm mb-1">Problemas recorrentes</h4>
              <ul className="space-y-2 mb-4">
                {c.prompt_sdr.problemas_recorrentes.map((p, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{p.problema}</span>
                    <span className="text-muted-foreground"> · {p.frequencia} · regra: {p.regra_relacionada}</span>
                    {p.exemplo && <p className="text-muted-foreground italic">“{p.exemplo}”</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!!c.prompt_sdr.alteracoes_sugeridas?.length && (
            <>
              <h4 className="font-semibold text-sm mb-1">Alterações sugeridas</h4>
              <div className="space-y-3">
                {c.prompt_sdr.alteracoes_sugeridas.map((a, i) => (
                  <div key={i} className="rounded-md border border-border p-3 text-sm space-y-1">
                    <div><Badge variant="outline">{a.secao}</Badge> <span className="font-medium">{a.mudanca}</span></div>
                    <div className="relative">
                      <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-2 pr-16 font-mono">{a.texto_sugerido}</pre>
                      <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-7"
                        onClick={() => navigator.clipboard.writeText(a.texto_sugerido).then(() => toast.success("Copiado."))}>
                        Copiar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Bloco>
      )}

      {!!c.por_vendedor?.length && (
        <Bloco titulo="Por consultor" icone={Star}>
          <div className="grid md:grid-cols-2 gap-3">
            {c.por_vendedor.map((v, i) => (
              <div key={i} className="rounded-md border border-border p-3 text-sm space-y-1">
                <div className="font-semibold">{v.vendedor}</div>
                {!!v.deixa_a_desejar?.length && (
                  <div><span className="text-red-700 font-medium">Deixa a desejar:</span>
                    <ul className="list-disc pl-5">{v.deixa_a_desejar.map((x, j) => <li key={j}>{x}</li>)}</ul></div>
                )}
                {!!v.pontos_fortes?.length && (
                  <div><span className="text-emerald-700 font-medium">Pontos fortes:</span>
                    <ul className="list-disc pl-5">{v.pontos_fortes.map((x, j) => <li key={j}>{x}</li>)}</ul></div>
                )}
                <p><b>Foco de treinamento:</b> {v.foco_de_treinamento}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      {!!c.por_origem?.length && (
        <Bloco titulo="Por origem do lead" icone={Megaphone}>
          <ul className="text-sm space-y-1">{c.por_origem.map((o, i) => <li key={i}><b>{o.origem}:</b> {o.observacao}</li>)}</ul>
        </Bloco>
      )}

      {!!c.scripts_recomendados?.length && (
        <Bloco titulo="Mensagens recomendadas" icone={MessageSquareText}>
          <div className="space-y-2">
            {c.scripts_recomendados.map((s, i) => (
              <div key={i} className="text-sm">
                <div className="font-medium">{s.situacao}</div>
                <p className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">{s.mensagem}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, classe }: { rotulo: string; valor: string; detalhe?: string; classe?: string }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={cn("text-2xl font-bold mt-1", classe)}>{valor}</div>
      {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function Bloco({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Star; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Icone className="h-4 w-4 text-blue-700" />{titulo}</h3>
      {children}
    </div>
  );
}

const Vazio = () => <p className="text-sm text-muted-foreground">Nada analisado ainda.</p>;

function CartaoObjecao({ objecao: o, conversa, onAbrir }: { objecao: Objecao; conversa?: ConversaComAnalise; onAbrir?: () => void }) {
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="italic">“{o.trecho_cliente}”</p>
        {o.foi_contornada !== undefined && (
          <Badge variant="outline" className={cn("shrink-0", o.foi_contornada ? "text-emerald-700 border-emerald-300" : "text-red-700 border-red-300")}>
            {o.foi_contornada ? "contornada" : "não contornada"}
          </Badge>
        )}
      </div>
      {o.como_vendedor_lidou && (
        <p className="text-muted-foreground"><span className="font-medium text-foreground">Como lidou:</span> {o.como_vendedor_lidou}</p>
      )}
      <p className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2"><span className="font-medium">Resposta sugerida:</span> {o.resposta_sugerida}</p>
      {conversa && onAbrir && (
        <button className="text-xs text-blue-700 hover:underline" onClick={onAbrir}>
          {conversa.contato_nome || "abrir conversa"} · {conversa.atendente || SEM_VENDEDOR}
        </button>
      )}
    </div>
  );
}

function DetalheAnalise({ analise: a }: { analise: Analise }) {
  const corPrioridade = { alta: "text-red-700 border-red-300", media: "text-amber-700 border-amber-300", baixa: "text-muted-foreground" };
  return (
    <div className="space-y-4">
      {a.resumo && <p className="text-sm">{a.resumo}</p>}
      {a.proximo_passo && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
          <span className="font-semibold">Próximo passo:</span> {a.proximo_passo}
        </div>
      )}
      {a.sdr && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-700" /> SDR de IA
            {a.nota_sdr != null && <span className={corNota(a.nota_sdr)}>{a.nota_sdr}/10</span>}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {([["handoff_feito", "passou p/ consultor"], ["lead_qualificado", "lead qualificado"], ["catalogo_enviado", "mandou catálogo"]] as const).map(([k, r]) => (
              <Badge key={k} variant="outline" className={a.sdr![k] ? "text-emerald-700 border-emerald-300" : "text-red-700 border-red-300"}>
                {a.sdr![k] ? "✓" : "✗"} {r}
              </Badge>
            ))}
          </div>
          {!!a.sdr.violacoes?.length && (
            <ul className="space-y-1.5">
              {a.sdr.violacoes.map((v, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{v.regra}</span>
                  <p className="text-red-700">✗ “{v.trecho}”</p>
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
          <h4 className="font-semibold text-sm mb-1">Pontos fortes</h4>
          <ul className="list-disc pl-5 text-sm space-y-0.5">{a.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {!!a.melhorias?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Melhorias (consultor)</h4>
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
          <h4 className="font-semibold text-sm mb-1">Objeções</h4>
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
      <p className="text-xs text-muted-foreground">Analisado em {dataCurta(a.criado_em)} · {a.modelo}</p>
    </div>
  );
}
