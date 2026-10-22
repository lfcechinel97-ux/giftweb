import { useState } from "react";
import { AlertTriangle, Bot, Brain, Loader2, Megaphone, MessageSquareText, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bloco, Vazio, copiar, corNota, dataCurta, numero } from "./comum";
import { ResumoEstimativa, estimarConjunto, type BaseTokens, type Precos } from "./tokens";
import type { ConversaComAnalise } from "./comum";

/* Avaliações: avaliação geral de um conjunto de conversas (o filtro atual
   -- período, consultor, origem... -- ou a seleção feita na aba Conversas),
   com uma pergunta própria, e o histórico das avaliações já feitas. */

export interface Diagnostico {
  id: string;
  criado_em: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_conversas: number;
  titulo: string | null;
  instrucoes: string | null;
  modo: string | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  escopo: { selecao?: boolean; conversas?: number; vendedores?: string[] } | null;
  conteudo: {
    avaliacao_atendimento?: {
      nota_geral: number;
      esta_bom: boolean;
      veredito: string;
      criterios: { criterio: string; nota: number; avaliacao: string }[];
    };
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

export default function AbaAvaliacoes({ diagnosticos, conversas, descricaoFiltro, base, precos, ocupado, onAvaliar }: {
  diagnosticos: Diagnostico[];
  conversas: ConversaComAnalise[];
  descricaoFiltro: string;
  base: BaseTokens;
  precos: Precos;
  ocupado: boolean;
  onAvaliar: (ids: string[], titulo: string, instrucoes: string) => Promise<void>;
}) {
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [avaliando, setAvaliando] = useState(false);
  const aberta = diagnosticos.find((d) => d.id === abertaId) ?? diagnosticos[0];
  const e = estimarConjunto(conversas, base);

  const avaliar = async () => {
    setAvaliando(true);
    try {
      await onAvaliar(conversas.map((c) => c.id), titulo || descricaoFiltro, instrucoes);
      setTitulo("");
      setInstrucoes("");
      setAbertaId(null);
    } finally {
      setAvaliando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Bloco titulo="Nova avaliação" icone={Brain} cor="violet">
        <div className="space-y-2 text-sm">
          <p>
            Avalia as <b>{conversas.length}</b> conversas do filtro atual ({descricaoFiltro}). Para avaliar um consultor,
            escolha-o no filtro acima; para escolher conversas a dedo, use a seleção da aba Conversas.
          </p>
          <Input value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder={`Título (padrão: ${descricaoFiltro})`} />
          <Textarea value={instrucoes} onChange={(ev) => setInstrucoes(ev.target.value)} className="min-h-[90px]"
            placeholder="O que você quer saber? Ex.: o consultor pergunta quantidade e CEP antes de mandar orçamento? Por que os leads do Google fecham menos? (opcional)" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("rounded-md px-2 py-1", e.modo === "transcricoes" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
              {e.modo === "transcricoes" ? "Lê as transcrições completas" : "Grande: lê as análises individuais"} · <ResumoEstimativa e={e} precos={precos} />
            </span>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={avaliar} disabled={avaliando || ocupado || !conversas.length}>
              {avaliando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />} Avaliar
            </Button>
          </div>
        </div>
      </Bloco>

      {diagnosticos.length ? (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <div className="space-y-2">
            {diagnosticos.map((d) => {
              const av = d.conteudo.avaliacao_atendimento;
              return (
                <button key={d.id} onClick={() => setAbertaId(d.id)}
                  className={cn("w-full text-left rounded-xl border p-3 bg-white hover:shadow-sm", aberta?.id === d.id ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{d.titulo ?? (d.periodo_inicio ? "Diagnóstico do período" : "Seleção")}</span>
                    {av && <span className={cn("font-bold", corNota(av.nota_geral))}>{av.nota_geral}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{dataCurta(d.criado_em)} · {d.total_conversas} conversas</div>
                  {d.escopo?.vendedores?.length === 1 && <Badge variant="outline" className="mt-1 text-xs">{d.escopo.vendedores[0]}</Badge>}
                </button>
              );
            })}
          </div>
          <div>{aberta && <DetalheDiagnostico d={aberta} />}</div>
        </div>
      ) : <Vazio texto="Nenhuma avaliação feita ainda." />}
    </div>
  );
}

function DetalheDiagnostico({ d }: { d: Diagnostico }) {
  const c = d.conteudo;
  const fmt = (s: string | null) => s?.split("-").reverse().join("/");
  const corImpacto: Record<string, string> = { alto: "bg-rose-50 text-rose-700 border-rose-300", medio: "bg-amber-50 text-amber-700 border-amber-300", baixo: "" };
  const av = c.avaliacao_atendimento;
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Gerado em {dataCurta(d.criado_em)} · {d.periodo_inicio ? `período ${fmt(d.periodo_inicio)} a ${fmt(d.periodo_fim)}` : "seleção de conversas"} ·{" "}
        {d.total_conversas} conversas · {d.modo === "transcricoes" ? "leu as transcrições" : "leu as análises"}
        {d.tokens_entrada != null && ` · ${numero(d.tokens_entrada + (d.tokens_saida ?? 0))} tokens`}
      </p>
      {d.instrucoes && (
        <div className="rounded-lg bg-slate-50 border p-3 text-sm"><b>Pergunta:</b> {d.instrucoes}</div>
      )}

      {av && (
        <div className={cn("rounded-xl border p-4 space-y-3", av.esta_bom ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")}>
          <div className="flex items-center gap-3">
            <span className={cn("text-3xl font-bold", corNota(av.nota_geral))}>{av.nota_geral}</span>
            <div>
              <div className={cn("font-semibold", av.esta_bom ? "text-emerald-800" : "text-rose-800")}>
                {av.esta_bom ? "O atendimento está bom" : "O atendimento precisa melhorar"}
              </div>
              <p className="text-sm">{av.veredito}</p>
            </div>
          </div>
          {!!av.criterios?.length && (
            <div className="grid md:grid-cols-2 gap-2">
              {av.criterios.map((k, i) => (
                <div key={i} className="bg-white rounded-lg border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{k.criterio}</span>
                    <span className={cn("font-bold", corNota(k.nota))}>{k.nota}</span>
                  </div>
                  <p className="text-muted-foreground">{k.avaliacao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {c.resumo_geral && <p className="text-sm">{c.resumo_geral}</p>}

      {!!c.acoes_prioritarias?.length && (
        <Bloco titulo="Ações prioritárias" icone={TrendingUp} cor="emerald">
          <ol className="list-decimal pl-5 text-sm space-y-1">{c.acoes_prioritarias.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </Bloco>
      )}

      {!!c.pontos_fracos?.length && (
        <Bloco titulo="Pontos que estão deixando a desejar" icone={AlertTriangle} cor="rose">
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
                <p className="bg-emerald-50  rounded p-2"><b>Como corrigir:</b> {p.como_corrigir}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      {c.prompt_sdr && (
        <Bloco titulo="SDR de IA — mudanças no prompt" icone={Bot} cor="violet">
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
                        onClick={() => copiar(a.texto_sugerido)}>
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
        <Bloco titulo="Por consultor" icone={Star} cor="blue">
          <div className="grid md:grid-cols-2 gap-3">
            {c.por_vendedor.map((v, i) => (
              <div key={i} className="rounded-md border border-border p-3 text-sm space-y-1">
                <div className="font-semibold">{v.vendedor}</div>
                {!!v.deixa_a_desejar?.length && (
                  <div><span className="text-rose-700 font-medium">Deixa a desejar:</span>
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
        <Bloco titulo="Por origem do lead" icone={Megaphone} cor="amber">
          <ul className="text-sm space-y-1">{c.por_origem.map((o, i) => <li key={i}><b>{o.origem}:</b> {o.observacao}</li>)}</ul>
        </Bloco>
      )}

      {!!c.scripts_recomendados?.length && (
        <Bloco titulo="Mensagens recomendadas" icone={MessageSquareText} cor="teal">
          <div className="space-y-2">
            {c.scripts_recomendados.map((s, i) => (
              <div key={i} className="text-sm">
                <div className="font-medium">{s.situacao}</div>
                <p className="bg-emerald-50  rounded p-2">{s.mensagem}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}
    </div>
  );
}
