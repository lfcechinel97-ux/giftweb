import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Search, MessageSquareText, Star, X, Clock, Download, Database, Megaphone, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Bloco, COLUNAS_CONVERSA, COR_ORIGEM, Kpi, ROTULO_ORIGEM, SEM_VENDEDOR, Vazio, avisarErro, chamar, dataCurta, duracao, esperar,
  exportarUma, mediana, montarConversa, pct, tabela, tempoAssumir,
  type Conversa, type ConversaComOrigem, type LeadMeta, type Regra,
} from "./comum";
import ListaConversas from "./AbaConversas";
import AbaBusca from "./AbaBusca";
import AbaOrigem from "./AbaOrigem";
import AbaLeadsMeta from "./AbaLeadsMeta";

/* Conversas do comercial (/whatsapp), importadas do Data Crazy pela edge
   function analisar-conversas-comercial. Sem IA (removida por custo):
   - Buscar e exportar: números, nomes ou e-mails -> conversas, origem do
     lead e exportação (todas ou uma por uma).
   - Conversas do período, visão geral com métricas de atendimento (tempo
     de resposta, consultor que não entrou, cliente sem resposta).
   - Origem: lead da planilha do Meta > regra da 1ª mensagem > sinal de
     anúncio do Data Crazy > "sem sinal de anúncio".
   Admin ou gerente. */

const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const inicioMesAnterior = () => {
  const [a, m] = hojeIso().split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

interface Progresso { texto: string; aguardando?: boolean }

export default function AnaliseConversas() {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState(inicioMesAnterior);
  const [fim, setFim] = useState(hojeIso);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const cancelar = useRef(false);
  const [aba, setAba] = useState("busca");
  const [vendedor, setVendedor] = useState("todos");
  const [origemFiltro, setOrigemFiltro] = useState("todas");
  const [etapaFiltro, setEtapaFiltro] = useState<"todas" | "so_sdr" | "consultor" | "sem_resposta">("todas");
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState<ConversaComOrigem | null>(null);

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

  const leadPorConversa = useMemo(() => new Map(leads.filter((l) => l.conversa_id).map((l) => [l.conversa_id!, l])), [leads]);
  const conversas = useMemo<ConversaComOrigem[]>(
    () => brutas.map((c) => montarConversa(c, regras, leadPorConversa.get(c.id) ?? null)),
    [brutas, regras, leadPorConversa],
  );

  const vendedores = useMemo(() => [...new Set(conversas.map((c) => c.atendente || SEM_VENDEDOR))].sort(), [conversas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) =>
      (vendedor === "todos" || (c.atendente || SEM_VENDEDOR) === vendedor) &&
      (origemFiltro === "todas" || c.origem === origemFiltro) &&
      (etapaFiltro === "todas"
        || (etapaFiltro === "so_sdr" && !c.mensagens_consultor)
        || (etapaFiltro === "consultor" && !!c.mensagens_consultor)
        || (etapaFiltro === "sem_resposta" && !!c.cliente_sem_resposta)) &&
      (!termo || [c.contato_nome, c.contato_telefone, c.atendente, c.primeira_mensagem_cliente, c.campanha, c.lead?.nome, c.lead?.email]
        .some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [conversas, vendedor, origemFiltro, etapaFiltro, busca]);

  const resumo = useMemo(() => {
    const porOrigem = new Map<string, number>();
    for (const c of filtradas) porOrigem.set(c.origem, (porOrigem.get(c.origem) ?? 0) + 1);
    const porVendedor = new Map<string, ConversaComOrigem[]>();
    for (const c of filtradas) {
      const v = c.atendente || SEM_VENDEDOR;
      porVendedor.set(v, [...(porVendedor.get(v) ?? []), c]);
    }
    const ranking = [...porVendedor.entries()].map(([nome, cs]) => ({
      nome,
      conversas: cs.length,
      primeiraResposta: mediana(cs.map((c) => c.tempo_primeira_resposta_seg).filter((n): n is number => n != null)),
      assumir: mediana(cs.map(tempoAssumir).filter((n): n is number => n != null)),
      semResposta: cs.filter((c) => c.cliente_sem_resposta).length,
      meta: cs.filter((c) => c.origem === "meta").length,
      google: cs.filter((c) => c.origem === "google").length,
    })).sort((a, b) => b.conversas - a.conversas);
    return {
      porOrigem: [...porOrigem.entries()].sort((a, b) => b[1] - a[1]),
      primeiraResposta: mediana(filtradas.map((c) => c.tempo_primeira_resposta_seg).filter((n): n is number => n != null)),
      assumir: mediana(filtradas.map(tempoAssumir).filter((n): n is number => n != null)),
      semResposta: filtradas.filter((c) => c.cliente_sem_resposta).length,
      soSdr: filtradas.filter((c) => !c.mensagens_consultor).length,
      ranking,
    };
  }, [filtradas]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["whatsapp"] });

  /** Espera o limite do Data Crazy com contagem regressiva. */
  const aguardarLimite = async (seg: number) => {
    for (let s = seg; s > 0 && !cancelar.current; s--) {
      setProgresso({ texto: `Limite do Data Crazy (20 req/min) — continuando em ${s}s…`, aguardando: true });
      await esperar(1000);
    }
  };

  /** Roda uma tarefa em lotes com a barra de progresso; erros viram toast. */
  const rodar = async (tarefa: () => Promise<void>) => {
    cancelar.current = false;
    try {
      await tarefa();
    } catch (e) {
      avisarErro(e);
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
      setProgresso({ texto: `${atualizarTudo ? "Reimportando" : "Importando"} do Data Crazy… lote ${lote} · ${importadas} importadas, ${puladas} já em dia` });
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

  const recalcular = () => rodar(async () => {
    let skip = 0;
    let total = 0;
    while (!cancelar.current) {
      setProgresso({ texto: `Recalculando a marcação SDR × consultor… ${total}` });
      const r = await chamar({ acao: "recalcular", skip });
      total += r.recalculadas ?? 0;
      skip = r.proximoSkip ?? skip;
      if (r.terminou) break;
    }
    toast.success(`${total} conversa(s) recalculada(s).`);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Conversas do comercial</h2>
          <p className="text-sm text-slate-500">WhatsApp importado do Data Crazy: busque contatos, veja como cada lead chegou e exporte as conversas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-[150px]" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!!progresso} />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" className="w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} disabled={!!progresso} />
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => importarPeriodo()} disabled={!!progresso}>
            <Download className="h-4 w-4 mr-1" /> Importar período
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
          <Progress className="animate-pulse" />
          <p className="text-xs text-blue-900/70">Deixe esta aba aberta. O que já foi importado fica salvo; se parar, a próxima rodada continua de onde faltou.</p>
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex-wrap h-auto bg-slate-100 p-1 gap-1">
          {[
            ["busca", "Buscar e exportar", "data-[state=active]:bg-emerald-600"],
            ["conversas", `Conversas do período (${filtradas.length})`, "data-[state=active]:bg-teal-600"],
            ["geral", "Visão geral", "data-[state=active]:bg-blue-600"],
            ["origem", "Origem", "data-[state=active]:bg-amber-500"],
            ["leads", `Leads Meta (${leads.length})`, "data-[state=active]:bg-sky-600"],
            ["ferramentas", "Ferramentas", "data-[state=active]:bg-slate-700"],
          ].map(([v, r, cor]) => (
            <TabsTrigger key={v} value={v} className={cn("data-[state=active]:text-white", cor)}>{r}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="busca">
          <AbaBusca regras={regras} leads={leads} onAbrir={setAberta} />
        </TabsContent>

        {["conversas", "geral", "origem"].includes(aba) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Filtrar por cliente, telefone, e-mail, 1ª mensagem, campanha..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os consultores</SelectItem>
                {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {Object.entries(ROTULO_ORIGEM).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={etapaFiltro} onValueChange={(v) => setEtapaFiltro(v as typeof etapaFiltro)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todo atendimento</SelectItem>
                <SelectItem value="so_sdr">Só o SDR atendeu</SelectItem>
                <SelectItem value="consultor">Consultor entrou</SelectItem>
                <SelectItem value="sem_resposta">Cliente sem resposta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="conversas">
          {isLoading ? <Carregando /> : (
            <ListaConversas conversas={filtradas} selecionadas={selecionadas} setSelecionadas={setSelecionadas} onAbrir={setAberta}
              vazio='Nenhuma conversa com esses filtros. Para trazer outro período, escolha as datas e clique em "Importar período".' />
          )}
        </TabsContent>

        <TabsContent value="geral" className="space-y-5">
          {isLoading ? <Carregando /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Kpi rotulo="Conversas no período" valor={String(filtradas.length)} cor="blue" />
                <Kpi rotulo="1ª resposta (mediana)" valor={duracao(resumo.primeiraResposta)} cor="sky" />
                <Kpi rotulo="Consultor assume após o SDR" valor={duracao(resumo.assumir)} detalhe="mediana" cor="amber" />
                <Kpi rotulo="Só o SDR atendeu" valor={pct(resumo.soSdr, filtradas.length)} detalhe={`${resumo.soSdr} conversa(s)`} cor="violet"
                  onClick={() => { setEtapaFiltro("so_sdr"); setAba("conversas"); }} />
                <Kpi rotulo="Cliente ficou sem resposta" valor={pct(resumo.semResposta, filtradas.length)} detalhe={`${resumo.semResposta} conversa(s)`} cor="rose"
                  onClick={() => { setEtapaFiltro("sem_resposta"); setAba("conversas"); }} />
              </div>

              <Bloco titulo="Como os leads chegaram" icone={Megaphone} cor="amber">
                {resumo.porOrigem.length ? (
                  <div className="space-y-2">
                    {resumo.porOrigem.map(([o, n]) => (
                      <div key={o} className="flex items-center gap-3 text-sm">
                        <Badge variant="outline" className={cn("w-[170px] justify-center", COR_ORIGEM[o] ?? "")}>{ROTULO_ORIGEM[o] ?? o}</Badge>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${(n / Math.max(1, filtradas.length)) * 100}%` }} />
                        </div>
                        <span className="w-24 text-right">{n} · {pct(n, filtradas.length)}</span>
                      </div>
                    ))}
                  </div>
                ) : <Vazio />}
                <p className="text-xs text-muted-foreground mt-3">
                  "Sem sinal de anúncio" = não está na planilha do Meta, nenhuma regra de origem bate com a 1ª mensagem e o Data Crazy não
                  marcou anúncio: provável orgânico ou indicação. Crie regras na aba Origem e importe a planilha do Meta para afinar.
                </p>
              </Bloco>

              <Bloco titulo="Por consultor" icone={Star} cor="blue">
                {resumo.ranking.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Consultor</TableHead>
                          <TableHead className="text-right">Conversas</TableHead>
                          <TableHead className="text-right">Meta Ads</TableHead>
                          <TableHead className="text-right">Google Ads</TableHead>
                          <TableHead className="text-right">1ª resposta</TableHead>
                          <TableHead className="text-right">Assume após SDR</TableHead>
                          <TableHead className="text-right">Sem resposta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumo.ranking.map((r) => (
                          <TableRow key={r.nome} className="cursor-pointer" onClick={() => { setVendedor(r.nome); setAba("conversas"); }}>
                            <TableCell className="font-medium">{r.nome}</TableCell>
                            <TableCell className="text-right">{r.conversas}</TableCell>
                            <TableCell className="text-right">{r.meta}</TableCell>
                            <TableCell className="text-right">{r.google}</TableCell>
                            <TableCell className="text-right">{duracao(r.primeiraResposta)}</TableCell>
                            <TableCell className="text-right">{duracao(r.assumir)}</TableCell>
                            <TableCell className={cn("text-right", r.semResposta && "text-rose-600")}>{r.semResposta}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <Vazio />}
                <p className="text-xs text-muted-foreground mt-2">Clique num consultor para ver as conversas dele.</p>
              </Bloco>
            </>
          )}
        </TabsContent>

        <TabsContent value="origem" className="space-y-5">
          <AbaOrigem conversas={filtradas} regras={regras} onAbrir={setAberta} />
        </TabsContent>

        <TabsContent value="leads">
          <AbaLeadsMeta leads={leads} conversas={conversas} onAbrir={setAberta} />
        </TabsContent>

        <TabsContent value="ferramentas">
          <Bloco titulo="Separar SDR (IA) de consultor (humano)" icone={Wrench} cor="slate">
            <div className="text-sm space-y-3">
              <p>
                Cada mensagem enviada é marcada como <b>SDR (IA)</b> ou <b>Consultor</b>: é do consultor a mensagem com atendente
                humano identificado pelo Data Crazy, a mensagem em que alguém se apresenta ("sou o Guilherme") e tudo o que a
                empresa manda depois disso ou depois do "Resumo do projeto". Para conferir numa conversa, abra-a e use
                <b> "Ver dados do Data Crazy"</b>.
              </p>
              <p>
                <b>Reimportar</b> busca de novo no Data Crazy todas as conversas do período escolhido acima (~15 por minuto).
                <b> Recalcular</b> refaz a marcação em segundos, a partir das mensagens já guardadas.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => importarPeriodo(true)} disabled={!!progresso}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reimportar mensagens do período
                </Button>
                <Button variant="outline" onClick={recalcular} disabled={!!progresso}>
                  <Wrench className="h-4 w-4 mr-1" /> Recalcular marcação
                </Button>
              </div>
            </div>
          </Bloco>
        </TabsContent>
      </Tabs>

      <DialogoConversa conversa={aberta} onFechar={() => setAberta(null)} onAtualizada={async (id) => {
        await qc.invalidateQueries({ queryKey: ["whatsapp"] });
        const { data } = await tabela("comercial_conversas").select(COLUNAS_CONVERSA).eq("id", id).maybeSingle();
        if (data) setAberta(montarConversa(data as Conversa, regras, leadPorConversa.get(id) ?? null));
      }} />
    </div>
  );
}

const Carregando = () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

function DialogoConversa({ conversa, onFechar, onAtualizada }: {
  conversa: ConversaComOrigem | null; onFechar: () => void; onAtualizada: (id: string) => Promise<void>;
}) {
  const [reimportando, setReimportando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [bruto, setBruto] = useState<{ atribuicao: { quando: string; papel: string; nome: string | null; atendente_dc: string | null; automacao: boolean; texto: string }[]; bruto: string } | null>(null);
  const [carregandoBruto, setCarregandoBruto] = useState(false);

  const reimportar = async () => {
    if (!conversa) return;
    setReimportando(true);
    try {
      const r = await chamar({ conversaId: conversa.id });
      if (r.aguardarSeg) toast.info(`Limite do Data Crazy, tente de novo em ${r.aguardarSeg}s.`);
      else await onAtualizada(conversa.id);
    } catch (e) {
      avisarErro(e);
    } finally {
      setReimportando(false);
    }
  };

  const baixar = async () => {
    if (!conversa) return;
    setBaixando(true);
    try { await exportarUma(conversa); } catch (e) { avisarErro(e); } finally { setBaixando(false); }
  };

  const verBruto = async () => {
    if (!conversa) return;
    setCarregandoBruto(true);
    try {
      setBruto(await chamar({ acao: "amostra_mensagens", conversaId: conversa.id }));
    } catch (e) {
      avisarErro(e);
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
                <Badge variant="outline" className={COR_ORIGEM[c.origem] ?? ""}>{ROTULO_ORIGEM[c.origem] ?? c.origem}{c.campanha && ` · ${c.campanha}`}</Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {c.contato_telefone} · Consultor: {c.atendente || "não entrou"} · {c.total_mensagens} mensagens ({c.mensagens_sdr ?? "?"} do SDR,
                {" "}{c.mensagens_consultor ?? "?"} do consultor) · início {dataCurta(c.iniciada_em)} · última {dataCurta(c.ultima_mensagem_em)}
              </p>
            </DialogHeader>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-amber-900 flex items-center gap-1"><Megaphone className="h-4 w-4" /> Como chegou</div>
              <p>{c.motivo}</p>
              {c.primeira_mensagem_cliente && <p className="text-muted-foreground">1ª mensagem do cliente: “{c.primeira_mensagem_cliente}”</p>}
              {c.lead && (
                <p className="text-muted-foreground">
                  Lead do Meta: {c.lead.nome}{c.lead.email && ` · ${c.lead.email}`} · chegou {dataCurta(c.lead.lead_criado_em)}
                  {c.lead.campanha && ` · campanha ${c.lead.campanha}`}{c.lead.anuncio && ` · anúncio ${c.lead.anuncio}`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={verBruto} disabled={carregandoBruto}>
                {carregandoBruto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />} Ver dados do Data Crazy
              </Button>
              <Button variant="outline" size="sm" onClick={reimportar} disabled={reimportando}>
                {reimportando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Reimportar do Data Crazy
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={baixar} disabled={baixando}>
                {baixando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Baixar conversa (.txt)
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
    <Bloco titulo="Conversa" icone={MessageSquareText} cor="teal"
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
