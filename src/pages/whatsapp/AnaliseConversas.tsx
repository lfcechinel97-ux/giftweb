import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Sparkles, RefreshCw, Search, ShieldAlert, TrendingUp, MessageSquareText, Star,
  AlertTriangle, X, Clock, Download, Database, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Bloco, CartaoObjecao, COR_ORIGEM, DetalheAnalise, Kpi, ROTULO_MELHORIA, ROTULO_OBJECAO, ROTULO_ORIGEM, ROTULO_RESULTADO,
  SEM_VENDEDOR, Vazio, chamar, corNota, dataCurta, duracao, esperar, media, mediana, montarConversa, pct, tabela,
  type Conversa, type ConversaComAnalise, type LeadMeta, type Regra, type StatusAnalise,
} from "./comum";
import { CalculadoraTokens, ResumoEstimativa, calcularBase, estimarAnalises, lerPrecos } from "./tokens";
import AbaConversas from "./AbaConversas";
import AbaSdr from "./AbaSdr";
import AbaOrigem from "./AbaOrigem";
import AbaLeadsMeta from "./AbaLeadsMeta";
import AbaAvaliacoes, { type Diagnostico } from "./AbaAvaliacoes";
import AbaConfiguracao from "./AbaConfiguracao";
import AbaAssistente from "./AbaAssistente";

/* Análise das conversas do comercial (/whatsapp): conversas do Data Crazy
   avaliadas por IA (edge function analisar-conversas-comercial).
   - Importa um período em lotes (a função tem limite de tempo e o Data
     Crazy, de 20 req/min); a análise por IA é um passo separado, com
     estimativa de tokens antes de rodar.
   - O atendimento começa com o SDR de IA (Felipe) e passa para o consultor
     humano: cada mensagem é marcada como SDR ou consultor e os dois são
     avaliados separadamente.
   - Origem: lead da planilha do Meta > regra da 1ª mensagem > referral.
   - Seleção de conversas para exportar, analisar e avaliar em conjunto;
     assistente para perguntas livres.
   Só admin. */

const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const inicioMesAnterior = () => {
  const [a, m] = hojeIso().split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

interface Progresso { texto: string; valor: number | null; aguardando?: boolean }

const COLUNAS_CONVERSA =
  "id, iniciada_em, ultima_mensagem_em, contato_nome, contato_telefone, atendente, total_mensagens, transcricao_hash, transcricao_caracteres, " +
  "primeira_mensagem_cliente, origem_detectada, tempo_primeira_resposta_seg, tempo_mediano_resposta_seg, cliente_sem_resposta, " +
  "mensagens_sdr, mensagens_consultor, handoff_em, consultor_entrou_em, " +
  "comercial_analises(id, criado_em, modelo, transcricao_hash, nota, resultado, etapa_funil, resumo, pontos_fortes, melhorias, objecoes, oportunidades_perdidas, proximo_passo, nota_sdr, sdr, tokens_entrada, tokens_saida)";

export default function AnaliseConversas() {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState(inicioMesAnterior);
  const [fim, setFim] = useState(hojeIso);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const cancelar = useRef(false);
  const [aba, setAba] = useState("geral");
  const [vendedor, setVendedor] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | StatusAnalise>("todas");
  const [etapaFiltro, setEtapaFiltro] = useState<"todas" | "so_sdr" | "consultor">("todas");
  const [resultadoFiltro, setResultadoFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState<ConversaComAnalise | null>(null);
  const [confirmarPendentes, setConfirmarPendentes] = useState(false);
  const [incluirDesatualizadas, setIncluirDesatualizadas] = useState(false);
  const [precos, setPrecos] = useState(lerPrecos);

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
          .select(COLUNAS_CONVERSA)
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

  const { data: leads = [] } = useQuery({
    queryKey: ["whatsapp", "leads-meta"],
    queryFn: async (): Promise<LeadMeta[]> => {
      const todos: LeadMeta[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await tabela("comercial_leads_meta")
          .select("id, chave, nome, telefone, email, lead_criado_em, campanha, conjunto, anuncio, formulario, plataforma, conversa_id, vinculo_metodo, vinculo_score")
          .order("lead_criado_em", { ascending: false }).range(de, de + 999);
        if (error) throw error;
        todos.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return todos;
      }
    },
  });

  const { data: diagnosticos = [] } = useQuery({
    queryKey: ["whatsapp", "diagnosticos"],
    queryFn: async (): Promise<Diagnostico[]> => {
      const { data, error } = await tabela("comercial_diagnosticos").select("*").order("criado_em", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tamanho do prompt do SDR + processo: entram em toda chamada de análise.
  const { data: caracteresContexto = 12_000 } = useQuery({
    queryKey: ["whatsapp", "config", "tamanho"],
    queryFn: async (): Promise<number> => {
      const { data } = await tabela("comercial_configuracoes").select("valor").in("chave", ["prompt_sdr", "processo_atendimento"]);
      return (data ?? []).reduce((s: number, r: { valor: string }) => s + (r.valor?.length ?? 0), 0);
    },
  });

  const conversas = useMemo<ConversaComAnalise[]>(() => {
    const leadPorConversa = new Map(leads.filter((l) => l.conversa_id).map((l) => [l.conversa_id!, l]));
    return brutas.map((c) => montarConversa(c, regras, leadPorConversa.get(c.id) ?? null));
  }, [brutas, regras, leads]);

  const base = useMemo(() => calcularBase(conversas, caracteresContexto), [conversas, caracteresContexto]);

  const vendedores = useMemo(
    () => [...new Set(conversas.map((c) => c.atendente || SEM_VENDEDOR))].sort(),
    [conversas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) =>
      (vendedor === "todos" || (c.atendente || SEM_VENDEDOR) === vendedor) &&
      (origemFiltro === "todas" || c.origem === origemFiltro) &&
      (statusFiltro === "todas" || c.status === statusFiltro) &&
      (etapaFiltro === "todas" || (etapaFiltro === "so_sdr" ? !c.mensagens_consultor : !!c.mensagens_consultor)) &&
      (resultadoFiltro === "todos" || c.analise?.resultado === resultadoFiltro) &&
      (!termo || [c.contato_nome, c.contato_telefone, c.atendente, c.primeira_mensagem_cliente, c.analise?.resumo, c.campanha, c.lead?.nome, c.lead?.email]
        .some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [conversas, vendedor, origemFiltro, statusFiltro, etapaFiltro, resultadoFiltro, busca]);

  const descricaoFiltro = [
    `${inicio.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}`,
    vendedor !== "todos" && vendedor,
    origemFiltro !== "todas" && (ROTULO_ORIGEM[origemFiltro] ?? origemFiltro),
    statusFiltro !== "todas" && statusFiltro.replace("_", " "),
    etapaFiltro === "so_sdr" && "só SDR",
    etapaFiltro === "consultor" && "consultor entrou",
    resultadoFiltro !== "todos" && (ROTULO_RESULTADO[resultadoFiltro] ?? resultadoFiltro),
  ].filter(Boolean).join(" · ");

  const analisadas = useMemo(() => filtradas.filter((c) => c.analise), [filtradas]);
  const contagemStatus = useMemo(() => ({
    nao_analisada: conversas.filter((c) => c.status === "nao_analisada").length,
    desatualizada: conversas.filter((c) => c.status === "desatualizada").length,
    analisada: conversas.filter((c) => c.status === "analisada").length,
    so_sdr: conversas.filter((c) => !c.mensagens_consultor).length,
  }), [conversas]);

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

    const tempoAssumir = (c: ConversaComAnalise) =>
      c.handoff_em && c.consultor_entrou_em ? Math.max(0, (new Date(c.consultor_entrou_em).getTime() - new Date(c.handoff_em).getTime()) / 1000) : null;

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
        assumir: mediana(cs.map(tempoAssumir).filter((n): n is number => n != null)),
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
      assumir: mediana(filtradas.map(tempoAssumir).filter((n): n is number => n != null)),
      semResposta: filtradas.filter((c) => c.cliente_sem_resposta).length,
      categorias,
      fracos,
      melhoriasAltas,
      ranking,
    };
  }, [analisadas, filtradas]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["whatsapp"] });

  /** Espera o limite do Data Crazy com contagem regressiva. */
  const aguardarLimite = async (seg: number) => {
    for (let s = seg; s > 0 && !cancelar.current; s--) {
      setProgresso({ texto: `Limite do Data Crazy (20 req/min) — continuando em ${s}s…`, valor: null, aguardando: true });
      await esperar(1000);
    }
  };

  /** Roda uma tarefa em lotes com a barra de progresso; erros viram toast. */
  const rodar = async (tarefa: () => Promise<void>) => {
    cancelar.current = false;
    try {
      await tarefa();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgresso(null);
      recarregar();
    }
  };

  const importarPeriodo = (atualizarTudo = false) => rodar(async () => {
    if (inicio > fim) throw new Error("O início do período é depois do fim.");
    let importadas = 0;
    let puladas = 0;
    const erros: string[] = [];
    let skip = 0;
    for (let lote = 1; !cancelar.current; lote++) {
      setProgresso({ texto: `${atualizarTudo ? "Reimportando" : "Importando"} do Data Crazy… lote ${lote} · ${importadas} importadas, ${puladas} já em dia`, valor: null });
      const r = await chamar({ acao: "importar", inicio, fim, skip, atualizarTudo });
      if (r.aguardarSeg) await aguardarLimite(r.aguardarSeg);
      importadas += r.importadas ?? 0;
      puladas += r.puladas ?? 0;
      erros.push(...(r.erros ?? []));
      skip = r.proximoSkip ?? skip;
      if (lote % 3 === 0) recarregar();
      if (r.terminou) break;
    }
    toast.success(`${importadas} conversa(s) importada(s), ${puladas} já estavam em dia.`);
    if (erros.length) toast.error(`${erros.length} erro(s). Primeiro: ${erros[0]}`);
  });

  /** Analisa as pendentes do período (o servidor escolhe quais). */
  const analisarPendentesPeriodo = () => rodar(async () => {
    let feitas = 0;
    let total: number | null = null;
    const erros: string[] = [];
    while (!cancelar.current) {
      setProgresso({ texto: `Analisando com IA… ${feitas}${total != null ? ` de ${total}` : ""}`, valor: total ? Math.round((feitas / total) * 100) : null });
      const r = await chamar({ acao: "analisar_pendentes", inicio, fim, incluirDesatualizadas });
      feitas += r.analisadas ?? 0;
      erros.push(...(r.erros ?? []));
      total ??= (r.processados?.length ?? 0) + (r.restantes ?? 0);
      recarregar();
      // Rodada sem nenhuma análise (só erros/curtas): para, senão repetiria para sempre.
      if (r.terminou || !r.analisadas) break;
    }
    toast.success(`${feitas} conversa(s) analisada(s).`);
    if (erros.length) toast.error(`${erros.length} erro(s). Primeiro: ${erros[0]}`);
  });

  /** Analisa conversas escolhidas: a fila fica aqui, a função devolve as que processou. */
  const analisarIds = (ids: string[], forcar: boolean) => rodar(async () => {
    let fila = [...ids];
    let feitas = 0;
    const erros: string[] = [];
    while (fila.length && !cancelar.current) {
      setProgresso({ texto: `Analisando com IA… ${feitas} de ${ids.length}`, valor: Math.round(((ids.length - fila.length) / ids.length) * 100) });
      const lote = fila.slice(0, 12);
      const r = await chamar({ acao: "analisar_pendentes", conversaIds: lote, forcar, incluirDesatualizadas: true });
      feitas += r.analisadas ?? 0;
      erros.push(...(r.erros ?? []));
      const processados = new Set<string>(r.processados ?? []);
      // Lote encerrado: as que nem entraram (já analisadas, sem mensagens) também saem da fila.
      fila = fila.filter((id) => !processados.has(id) && !(r.terminou && lote.includes(id)));
      recarregar();
      if (!processados.size && !r.terminou) break;
    }
    toast.success(`${feitas} conversa(s) analisada(s).`);
    if (erros.length) toast.error(`${erros.length} erro(s). Primeiro: ${erros[0]}`);
  });

  const recalcular = () => rodar(async () => {
    let skip = 0;
    let total = 0;
    while (!cancelar.current) {
      setProgresso({ texto: `Recalculando a marcação SDR × consultor… ${total}`, valor: null });
      const r = await chamar({ acao: "recalcular", skip });
      total += r.recalculadas ?? 0;
      skip = r.proximoSkip ?? skip;
      if (r.terminou) break;
    }
    toast.success(`${total} conversa(s) recalculada(s).`);
  });

  const avaliar = async (ids: string[], titulo: string, instrucoes: string) => {
    try {
      setProgresso({ texto: `A IA está avaliando ${ids.length} conversa(s)… pode levar alguns minutos`, valor: null });
      await chamar({ acao: "avaliar_conjunto", conversaIds: ids, titulo, instrucoes });
      await qc.invalidateQueries({ queryKey: ["whatsapp", "diagnosticos"] });
      setAba("avaliacoes");
      toast.success("Avaliação pronta.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgresso(null);
    }
  };

  const pendentesPeriodo = conversas.filter((c) => c.status === "nao_analisada" || (incluirDesatualizadas && c.status === "desatualizada"));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Análise comercial</h2>
          <p className="text-sm text-slate-500">Conversas do Data Crazy: SDR de IA, consultores, objeções e origem dos leads.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-[150px]" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!!progresso} />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" className="w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} disabled={!!progresso} />
          <Button variant="outline" onClick={() => importarPeriodo()} disabled={!!progresso}>
            <Download className="h-4 w-4 mr-1" /> Importar período
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setConfirmarPendentes(true)} disabled={!!progresso}>
            <Sparkles className="h-4 w-4 mr-1" /> Analisar pendentes ({contagemStatus.nao_analisada})
          </Button>
        </div>
      </div>

      {progresso && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {progresso.aguardando ? <Clock className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-700" />}
              {progresso.texto}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { cancelar.current = true; }}>
              <X className="h-4 w-4 mr-1" /> Parar
            </Button>
          </div>
          <Progress value={progresso.valor ?? undefined} className={cn(progresso.valor == null && "animate-pulse")} />
          <p className="text-xs text-blue-900/70">Deixe esta aba aberta. O que já foi feito fica salvo; se parar, a próxima rodada continua de onde faltou.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi rotulo="Conversas no período" valor={String(conversas.length)} cor="blue" onClick={() => setStatusFiltro("todas")} ativo={statusFiltro === "todas"} />
        <Kpi rotulo="Analisadas" valor={String(contagemStatus.analisada)} cor="emerald" onClick={() => setStatusFiltro("analisada")} ativo={statusFiltro === "analisada"} />
        <Kpi rotulo="Não analisadas" valor={String(contagemStatus.nao_analisada)} cor="slate" onClick={() => setStatusFiltro("nao_analisada")} ativo={statusFiltro === "nao_analisada"} />
        <Kpi rotulo="Desatualizadas" valor={String(contagemStatus.desatualizada)} detalhe="mudaram depois da análise" cor="amber" onClick={() => setStatusFiltro("desatualizada")} ativo={statusFiltro === "desatualizada"} />
        <Kpi rotulo="Consultor não entrou" valor={String(contagemStatus.so_sdr)} detalhe="só o SDR atendeu" cor="rose"
          onClick={() => setEtapaFiltro(etapaFiltro === "so_sdr" ? "todas" : "so_sdr")} ativo={etapaFiltro === "so_sdr"} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente, telefone, e-mail, 1ª mensagem, campanha, resumo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os consultores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {Object.entries(ROTULO_ORIGEM).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Analisadas ou não</SelectItem>
            <SelectItem value="analisada">Analisadas</SelectItem>
            <SelectItem value="nao_analisada">Não analisadas</SelectItem>
            <SelectItem value="desatualizada">Desatualizadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={etapaFiltro} onValueChange={(v) => setEtapaFiltro(v as typeof etapaFiltro)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">SDR e consultor</SelectItem>
            <SelectItem value="so_sdr">Só SDR atendeu</SelectItem>
            <SelectItem value="consultor">Consultor entrou</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resultadoFiltro} onValueChange={setResultadoFiltro}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo resultado</SelectItem>
            {Object.entries(ROTULO_RESULTADO).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="flex-wrap h-auto bg-slate-100 p-1 gap-1">
            {[
              ["geral", "Visão geral", "data-[state=active]:bg-blue-600"],
              ["conversas", `Conversas (${filtradas.length})`, "data-[state=active]:bg-emerald-600"],
              ["assistente", "Assistente", "data-[state=active]:bg-teal-600"],
              ["avaliacoes", "Avaliações", "data-[state=active]:bg-violet-600"],
              ["sdr", "SDR (IA)", "data-[state=active]:bg-fuchsia-600"],
              ["origem", "Origem", "data-[state=active]:bg-amber-500"],
              ["leads", `Leads Meta (${leads.length})`, "data-[state=active]:bg-sky-600"],
              ["objecoes", "Objeções", "data-[state=active]:bg-rose-600"],
              ["config", "Configuração", "data-[state=active]:bg-slate-700"],
            ].map(([v, r, cor]) => (
              <TabsTrigger key={v} value={v} className={cn("data-[state=active]:text-white", cor)}>{r}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="geral" className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi rotulo="Nota média (consultor)" valor={resumo.notaMedia == null ? "—" : resumo.notaMedia.toFixed(1)} classe={corNota(resumo.notaMedia)} detalhe={`${analisadas.length} analisadas`} cor="blue" />
              <Kpi rotulo="Vendas fechadas" valor={String(resumo.vendas)} detalhe={pct(resumo.vendas, analisadas.length) + " das analisadas"} cor="emerald" />
              <Kpi rotulo="Objeções contornadas" valor={pct(resumo.contornadas, resumo.totalObjecoes)} detalhe={`${resumo.contornadas} de ${resumo.totalObjecoes}`} cor="violet" />
              <Kpi rotulo="1ª resposta (mediana)" valor={duracao(resumo.primeiraResposta)} cor="sky" />
              <Kpi rotulo="Consultor assume após o SDR" valor={duracao(resumo.assumir)} detalhe="mediana" cor="amber" />
              <Kpi rotulo="Cliente ficou sem resposta" valor={pct(resumo.semResposta, filtradas.length)} detalhe={`${resumo.semResposta} conversa(s)`} cor="rose" />
            </div>

            <Bloco titulo="Pontos que estão deixando a desejar" icone={AlertTriangle} cor="rose">
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
                      <div className="h-2.5 rounded-full bg-rose-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${(p.conversas / Math.max(1, analisadas.length)) * 100}%` }} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {p.exemplos.map((ex, i) => (
                          <button key={i} className="text-xs text-blue-700 hover:underline text-left" onClick={() => setAberta(ex.conversa)}>{ex.titulo}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Vazio />}
            </Bloco>

            <Bloco titulo="Por consultor" icone={Star} cor="blue">
              {resumo.ranking.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Consultor</TableHead>
                        <TableHead className="text-right">Conversas</TableHead>
                        <TableHead className="text-right">Nota média</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                        <TableHead className="text-right">Objeções contornadas</TableHead>
                        <TableHead className="text-right">Assume após SDR</TableHead>
                        <TableHead className="text-right">Sem resposta</TableHead>
                        <TableHead>Ponto mais fraco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumo.ranking.map((r) => (
                        <TableRow key={r.nome} className="cursor-pointer" onClick={() => setVendedor(r.nome)}>
                          <TableCell className="font-medium">{r.nome}</TableCell>
                          <TableCell className="text-right">{r.conversas}</TableCell>
                          <TableCell className={cn("text-right font-semibold", corNota(r.nota))}>{r.nota == null ? "—" : r.nota.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{r.vendas}</TableCell>
                          <TableCell className="text-right">{r.objecoes ? `${r.contornadas}/${r.objecoes}` : "—"}</TableCell>
                          <TableCell className="text-right">{duracao(r.assumir)}</TableCell>
                          <TableCell className={cn("text-right", r.semResposta && "text-rose-600")}>{r.semResposta}</TableCell>
                          <TableCell className="text-sm">{r.piorPonto}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <Vazio />}
              <p className="text-xs text-muted-foreground mt-2">Clique num consultor para filtrar tudo por ele (e avaliar só as conversas dele na aba Avaliações).</p>
            </Bloco>

            <Bloco titulo="Melhorias prioritárias" icone={TrendingUp} cor="amber">
              {resumo.melhoriasAltas.length ? (
                <ul className="divide-y divide-slate-100">
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

            <CalculadoraTokens conversas={filtradas} base={base} precos={precos} onPrecos={setPrecos} />
          </TabsContent>

          <TabsContent value="conversas">
            <AbaConversas
              conversas={filtradas} selecionadas={selecionadas} setSelecionadas={setSelecionadas} onAbrir={setAberta}
              base={base} precos={precos} ocupado={!!progresso} onAnalisar={analisarIds} onAvaliar={avaliar}
            />
          </TabsContent>

          <TabsContent value="assistente">
            <AbaAssistente conversas={conversas} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="avaliacoes">
            <AbaAvaliacoes diagnosticos={diagnosticos} conversas={filtradas} descricaoFiltro={descricaoFiltro}
              base={base} precos={precos} ocupado={!!progresso} onAvaliar={avaliar} />
          </TabsContent>

          <TabsContent value="sdr" className="space-y-5">
            <AbaSdr analisadas={analisadas} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="origem" className="space-y-5">
            <AbaOrigem conversas={filtradas} regras={regras} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="leads">
            <AbaLeadsMeta leads={leads} conversas={conversas} onAbrir={setAberta} />
          </TabsContent>

          <TabsContent value="objecoes" className="space-y-4">
            {resumo.categorias.length ? resumo.categorias.map((cat) => (
              <Bloco key={cat.categoria} icone={ShieldAlert} cor="rose"
                titulo={`${ROTULO_OBJECAO[cat.categoria]} — ${cat.itens.length}× (${cat.contornadas} contornada${cat.contornadas === 1 ? "" : "s"})`}>
                <div className="space-y-3">
                  {cat.itens.slice(0, 15).map((o, i) => <CartaoObjecao key={i} objecao={o} onAbrir={() => setAberta(o.conversa)} conversa={o.conversa} />)}
                </div>
              </Bloco>
            )) : <Vazio />}
          </TabsContent>

          <TabsContent value="config">
            <AbaConfiguracao ocupado={!!progresso} onReimportar={() => importarPeriodo(true)} onRecalcular={recalcular} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={confirmarPendentes} onOpenChange={setConfirmarPendentes}>
        <DialogContent>
          <DialogHeader><DialogTitle>Analisar pendentes do período</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              {contagemStatus.nao_analisada} nunca analisada(s) e {contagemStatus.desatualizada} desatualizada(s) (mudaram depois
              da análise) entre {inicio.split("-").reverse().join("/")} e {fim.split("-").reverse().join("/")}.
            </p>
            <label className="flex items-center gap-2">
              <Switch checked={incluirDesatualizadas} onCheckedChange={setIncluirDesatualizadas} /> Incluir as desatualizadas
            </label>
            <div className="rounded-lg bg-slate-50 border p-3">
              <b>{pendentesPeriodo.length}</b> análise(s): <ResumoEstimativa e={estimarAnalises(pendentesPeriodo, base)} precos={precos} />
            </div>
            <p className="text-xs text-muted-foreground">Para analisar só algumas, selecione-as na aba Conversas.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmarPendentes(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!pendentesPeriodo.length}
              onClick={() => { setConfirmarPendentes(false); analisarPendentesPeriodo(); }}>
              Analisar {pendentesPeriodo.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoConversa conversa={aberta} onFechar={() => setAberta(null)} onAtualizada={async (id) => {
        await qc.invalidateQueries({ queryKey: chaveConversas });
        const nova = qc.getQueryData<Conversa[]>(chaveConversas)?.find((x) => x.id === id);
        const lead = leads.find((l) => l.conversa_id === id) ?? null;
        if (nova) setAberta(montarConversa(nova, regras, lead));
      }} />
    </div>
  );
}

function DialogoConversa({ conversa, onFechar, onAtualizada }: {
  conversa: ConversaComAnalise | null; onFechar: () => void; onAtualizada: (id: string) => Promise<void>;
}) {
  const [reanalisando, setReanalisando] = useState(false);
  const [bruto, setBruto] = useState<{ atribuicao: { quando: string; papel: string; nome: string | null; atendente_dc: string | null; automacao: boolean; texto: string }[]; bruto: string } | null>(null);
  const [carregandoBruto, setCarregandoBruto] = useState(false);

  const reanalisar = async () => {
    if (!conversa) return;
    setReanalisando(true);
    try {
      const r = await chamar({ conversaId: conversa.id, reanalizar: true });
      if (r.aguardarSeg) toast.info(`Limite do Data Crazy, tente de novo em ${r.aguardarSeg}s.`);
      else if (!r.analisadas) toast.info("Conversa curta demais para analisar.");
      await onAtualizada(conversa.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReanalisando(false);
    }
  };

  const verBruto = async () => {
    if (!conversa) return;
    setCarregandoBruto(true);
    try {
      setBruto(await chamar({ acao: "amostra_mensagens", conversaId: conversa.id }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregandoBruto(false);
    }
  };

  const c = conversa;
  return (
    <Dialog open={!!c} onOpenChange={(v) => { if (!v) { setBruto(null); onFechar(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        {c && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {c.contato_nome || c.contato_telefone || "Conversa"}
                {c.analise?.nota != null && <span className={cn("text-lg", corNota(c.analise.nota))}>{c.analise.nota}/10</span>}
                <Badge variant="outline" className={COR_ORIGEM[c.origem] ?? ""}>{ROTULO_ORIGEM[c.origem] ?? c.origem}{c.campanha && ` · ${c.campanha}`}</Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Consultor: {c.atendente || "não entrou"} · {c.total_mensagens} mensagens ({c.mensagens_sdr ?? "?"} do SDR, {c.mensagens_consultor ?? "?"} do consultor)
                · início {dataCurta(c.iniciada_em)} · última {dataCurta(c.ultima_mensagem_em)}
                {c.analise?.etapa_funil && <> · {c.analise.etapa_funil}</>}
              </p>
            </DialogHeader>

            {c.lead && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold text-blue-800 flex items-center gap-1"><Megaphone className="h-4 w-4" /> Lead do Meta</span>
                <span>{c.lead.nome}</span>
                {c.lead.email && <span>{c.lead.email}</span>}
                <span>chegou {dataCurta(c.lead.lead_criado_em)}</span>
                {c.lead.campanha && <span>campanha: {c.lead.campanha}</span>}
                {c.lead.anuncio && <span>anúncio: {c.lead.anuncio}</span>}
                <span className="text-muted-foreground">ligado por {c.lead.vinculo_metodo}</span>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={verBruto} disabled={carregandoBruto}>
                {carregandoBruto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />} Ver dados do Data Crazy
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={reanalisar} disabled={reanalisando}>
                {reanalisando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {c.analise ? "Reimportar e reanalisar" : "Analisar"}
              </Button>
            </div>

            {bruto && (
              <Bloco titulo="Como cada mensagem foi marcada (primeiras 40)" icone={Database} cor="slate">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Quando</TableHead><TableHead>Marcado como</TableHead><TableHead>Atendente no Data Crazy</TableHead><TableHead>Texto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bruto.atribuicao.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">{m.quando}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={m.papel === "sdr" ? "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200" : m.papel === "consultor" ? "bg-blue-50 text-blue-800 border-blue-200" : ""}>
                              {m.papel === "sdr" ? "SDR (IA)" : m.papel === "consultor" ? `Consultor${m.nome ? ` (${m.nome})` : ""}` : "Cliente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{m.atendente_dc ?? "—"}{m.automacao && " · automação"}</TableCell>
                          <TableCell className="text-xs max-w-[360px]">{m.texto}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-muted-foreground">JSON cru (para ajustar a regra, se a marcação estiver errada)</summary>
                  <pre className="text-[11px] bg-slate-50 rounded p-2 max-h-[300px] overflow-auto">{bruto.bruto}</pre>
                </details>
              </Bloco>
            )}

            {c.analise ? <DetalheAnalise analise={c.analise} /> : (
              <p className="text-sm text-muted-foreground">Ainda não analisada.</p>
            )}

            <Transcricao conversaId={c.id} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A transcrição é pesada: só busca quando a conversa é aberta. Cores por papel. */
function Transcricao({ conversaId }: { conversaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp", "transcricao", conversaId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await tabela("comercial_conversas").select("transcricao").eq("id", conversaId).maybeSingle();
      if (error) throw error;
      return data?.transcricao ?? null;
    },
  });
  const cor = (linha: string) =>
    /^\[[^\]]*\] SDR/.test(linha) ? "bg-fuchsia-50 border-l-4 border-fuchsia-400"
      : /^\[[^\]]*\] (Consultor|Atendente)/.test(linha) ? "bg-blue-50 border-l-4 border-blue-400"
      : /^\[[^\]]*\] Cliente/.test(linha) ? "bg-white border-l-4 border-slate-300"
      : "";
  return (
    <Bloco titulo="Transcrição" icone={MessageSquareText} cor="teal"
      acao={<span className="text-xs flex gap-2"><span className="px-1.5 rounded bg-fuchsia-100 text-fuchsia-800">SDR (IA)</span><span className="px-1.5 rounded bg-blue-100 text-blue-800">Consultor</span><span className="px-1.5 rounded bg-slate-100">Cliente</span></span>}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
        <div className="max-h-[420px] overflow-y-auto space-y-1">
          {(data || "—").split("\n").map((l, i) => (
            <p key={i} className={cn("text-xs whitespace-pre-wrap px-2 py-1 rounded-r", cor(l))}>{l}</p>
          ))}
        </div>
      )}
    </Bloco>
  );
}
