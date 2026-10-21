import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, Search, ShieldAlert, TrendingUp, MessageSquareText, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* Análise das conversas do comercial (/whatsapp): conversas do Datacrazy avaliadas por IA (edge function
   analisar-conversas-comercial). Visão geral agrega as objeções (com as
   respostas sugeridas para quebrá-las), as melhorias de prioridade alta e a
   nota média por vendedor; a aba Conversas abre a análise de cada uma com a
   transcrição. Só admin. */

interface Objecao {
  categoria: string;
  trecho_cliente: string;
  como_vendedor_lidou: string;
  /** Ausente nas análises do formato antigo ({ objecao, como_quebrar }). */
  foi_contornada?: boolean;
  resposta_sugerida: string;
}
interface Melhoria { titulo: string; detalhe: string; prioridade: "alta" | "media" | "baixa" }
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
}
interface Conversa {
  id: string;
  ultima_mensagem_em: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  atendente: string | null;
  canal: string | null;
  total_mensagens: number;
  transcricao: string | null;
  comercial_analises: Analise[];
}
type ConversaComAnalise = Conversa & { analise: Analise | null };

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
  return { ...a, melhorias, objecoes, pontos_fortes: a.pontos_fortes ?? [], oportunidades_perdidas: a.oportunidades_perdidas ?? [] };
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

const ROTULO_RESULTADO: Record<string, string> = {
  venda: "Venda",
  em_andamento: "Em andamento",
  perdida: "Perdida",
  sem_interesse: "Sem interesse",
  indefinido: "Indefinido",
};

const SEM_VENDEDOR = "(sem vendedor)";

const corNota = (n: number | null) =>
  n == null ? "text-muted-foreground" : n >= 8 ? "text-emerald-600" : n >= 6 ? "text-amber-600" : "text-red-600";

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const media = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);

async function chamar(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("analisar-conversas-comercial", { body: corpo });
  if (error) {
    // A mensagem útil vem no corpo da resposta de erro da função.
    const detalhe = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalhe?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AnaliseConversas() {
  const qc = useQueryClient();
  const [janela, setJanela] = useState<"last24h" | "all">("last24h");
  const [limite, setLimite] = useState("10");
  const [rodando, setRodando] = useState(false);
  const [vendedor, setVendedor] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<ConversaComAnalise | null>(null);
  const [reanalisando, setReanalisando] = useState(false);

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ["sistema", "analise-comercial"],
    queryFn: async (): Promise<ConversaComAnalise[]> => {
      const { data, error } = await supabase
        .from("comercial_conversas")
        .select("id, ultima_mensagem_em, contato_nome, contato_telefone, atendente, canal, total_mensagens, transcricao, comercial_analises(*)")
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as unknown as Conversa[]).map((c) => {
        const ultima = [...(c.comercial_analises ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
        return { ...c, analise: ultima ? normalizar(ultima) : null };
      });
    },
  });

  const vendedores = useMemo(
    () => [...new Set(conversas.map((c) => c.atendente || SEM_VENDEDOR))].sort(),
    [conversas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) =>
      (vendedor === "todos" || (c.atendente || SEM_VENDEDOR) === vendedor) &&
      (!termo || [c.contato_nome, c.contato_telefone, c.atendente, c.analise?.resumo].some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [conversas, vendedor, busca]);

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
      .map(([categoria, itens]) => ({
        categoria,
        itens,
        contornadas: itens.filter((o) => o.foi_contornada).length,
      }))
      .sort((a, b) => b.itens.length - a.itens.length);

    const melhoriasAltas = analisadas.flatMap((c) =>
      (c.analise!.melhorias ?? []).filter((m) => m.prioridade === "alta").map((m) => ({ ...m, conversa: c })),
    );

    const porVendedor = new Map<string, ConversaComAnalise[]>();
    for (const c of analisadas) {
      const v = c.atendente || SEM_VENDEDOR;
      porVendedor.set(v, [...(porVendedor.get(v) ?? []), c]);
    }
    const ranking = [...porVendedor.entries()].map(([nome, cs]) => {
      const obj = cs.flatMap((c) => c.analise!.objecoes ?? []);
      return {
        nome,
        conversas: cs.length,
        nota: media(cs.map((c) => c.analise!.nota).filter((n): n is number => n != null)),
        vendas: cs.filter((c) => c.analise!.resultado === "venda").length,
        objecoes: obj.length,
        contornadas: obj.filter((o) => o.foi_contornada).length,
      };
    }).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));

    return {
      notaMedia: media(notas),
      totalObjecoes: objecoes.length,
      contornadas: objecoes.filter((o) => o.foi_contornada).length,
      vendas: analisadas.filter((c) => c.analise!.resultado === "venda").length,
      categorias,
      melhoriasAltas,
      ranking,
    };
  }, [analisadas]);

  const sincronizar = async () => {
    setRodando(true);
    try {
      const r = await chamar({ openWindow: janela, limite: Number(limite) });
      toast.success(r.mensagem ?? `${r.recebidas} conversa(s): ${r.analisadas} analisada(s), ${r.puladas} sem mensagem nova.`);
      if (r.erros?.length) toast.error(`${r.erros.length} erro(s): ${r.erros[0]}`);
      await qc.invalidateQueries({ queryKey: ["sistema", "analise-comercial"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRodando(false);
    }
  };

  const reanalisar = async (c: ConversaComAnalise) => {
    setReanalisando(true);
    try {
      const r = await chamar({ conversaId: c.id, reanalizar: true });
      if (r.erros?.length) toast.error(r.erros[0]);
      else if (!r.analisadas) toast.info("Conversa curta demais para analisar.");
      const atualizadas = await qc.fetchQuery({ queryKey: ["sistema", "analise-comercial"], staleTime: 0 }) as ConversaComAnalise[];
      setAberta(atualizadas.find((x) => x.id === c.id) ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReanalisando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Análise comercial</h2>
          <p className="text-sm text-muted-foreground">
            Conversas do Datacrazy avaliadas por IA: objeções, melhorias e nota de condução.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={janela} onValueChange={(v) => setJanela(v as "last24h" | "all")}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last24h">Janela aberta (24h)</SelectItem>
              <SelectItem value="all">Todas as conversas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limite} onValueChange={setLimite}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["10", "20", "30"].map((n) => <SelectItem key={n} value={n}>Até {n} conversas</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={sincronizar} disabled={rodando}>
            {rodando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Importar e analisar
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente, telefone, resumo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="objecoes">Objeções</TabsTrigger>
            <TabsTrigger value="conversas">Conversas ({filtradas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi rotulo="Conversas analisadas" valor={String(analisadas.length)} />
              <Kpi rotulo="Nota média" valor={resumo.notaMedia == null ? "—" : resumo.notaMedia.toFixed(1)} classe={corNota(resumo.notaMedia)} />
              <Kpi rotulo="Objeções contornadas" valor={resumo.totalObjecoes ? `${Math.round((resumo.contornadas / resumo.totalObjecoes) * 100)}%` : "—"} detalhe={`${resumo.contornadas} de ${resumo.totalObjecoes}`} />
              <Kpi rotulo="Vendas fechadas" valor={String(resumo.vendas)} />
            </div>

            <Bloco titulo="Por vendedor" icone={Star}>
              {resumo.ranking.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Conversas</TableHead>
                      <TableHead className="text-right">Nota média</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Objeções contornadas</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Vazio />}
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
                      <p className="text-sm text-muted-foreground mt-0.5">{m.detalhe}</p>
                    </li>
                  ))}
                </ul>
              ) : <Vazio />}
            </Bloco>
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

          <TabsContent value="conversas">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Última msg</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="text-right">Objeções</TableHead>
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
                      <TableCell className="text-sm">{c.atendente || "—"}</TableCell>
                      <TableCell>
                        {c.analise?.resultado
                          ? <Badge variant="outline">{ROTULO_RESULTADO[c.analise.resultado] ?? c.analise.resultado}</Badge>
                          : <span className="text-xs text-muted-foreground">{c.analise ? "—" : "não analisada"}</span>}
                      </TableCell>
                      <TableCell className="text-right">{c.analise?.objecoes?.length ?? "—"}</TableCell>
                      <TableCell className={cn("text-right font-semibold", corNota(c.analise?.nota ?? null))}>
                        {c.analise?.nota ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtradas.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma conversa ainda. Clique em "Importar e analisar".
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

              <Bloco titulo="Transcrição" icone={MessageSquareText}>
                <pre className="text-xs whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto">{aberta.transcricao || "—"}</pre>
              </Bloco>
            </>
          )}
        </DialogContent>
      </Dialog>

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
      {!!a.pontos_fortes?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Pontos fortes</h4>
          <ul className="list-disc pl-5 text-sm space-y-0.5">{a.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {!!a.melhorias?.length && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Melhorias</h4>
          <ul className="space-y-2">
            {a.melhorias.map((m, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={corPrioridade[m.prioridade] ?? ""}>{m.prioridade}</Badge>
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
