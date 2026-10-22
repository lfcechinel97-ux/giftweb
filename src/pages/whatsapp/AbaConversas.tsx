import { useState } from "react";
import { toast } from "sonner";
import { Brain, Download, FileText, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  COR_ORIGEM, COR_STATUS, ROTULO_ORIGEM, ROTULO_RESULTADO, ROTULO_STATUS,
  baixarArquivo, corNota, dataCurta, duracao, tabela, type ConversaComAnalise,
} from "./comum";
import { ResumoEstimativa, estimarAnalises, estimarConjunto, type BaseTokens, type Precos } from "./tokens";

/* Aba Conversas: lista filtrada com seleção. Com as selecionadas dá para
   exportar (planilha CSV ou transcrições em .txt), analisar uma a uma e
   avaliar o conjunto numa chamada só, com instruções próprias. */

const POR_PAGINA = 200;

const MODELOS_INSTRUCAO = [
  { rotulo: "O atendimento segue o processo?", texto: "Avalie se o atendimento destas conversas segue o nosso processo, etapa por etapa: o que o consultor perguntou, o que esqueceu de perguntar (produto, quantidade, onde mora/CEP, prazo, personalização) e se conduziu para o orçamento e o fechamento." },
  { rotulo: "Dificuldades de cada consultor", texto: "Compare os consultores: onde cada um tem mais dificuldade, quais erros se repetem e o que cada um deveria treinar primeiro. Cite exemplos das conversas." },
  { rotulo: "Por que não fecharam?", texto: "Para as conversas que não viraram venda, identifique em que momento o lead esfriou e o principal motivo (preço, demora, falta de follow-up, qualificação fraca etc.). Diga o que teria salvado a venda." },
  { rotulo: "SDR x consultor", texto: "Avalie a passagem do SDR de IA para o consultor: o resumo chegou completo? O consultor aproveitou o que o SDR coletou ou repetiu perguntas? Quanto tempo o consultor levou para assumir?" },
];

function csvCampo(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportarCsv(lista: ConversaComAnalise[]) {
  const cabecalho = [
    "id", "cliente", "telefone", "consultor", "origem", "campanha", "lead_meta_nome", "lead_meta_email",
    "iniciada_em", "ultima_mensagem_em", "mensagens", "mensagens_sdr", "mensagens_consultor", "primeira_mensagem_cliente",
    "primeira_resposta_min", "consultor_assumiu_em", "cliente_sem_resposta", "status_analise", "nota_consultor", "nota_sdr",
    "resultado", "etapa_funil", "resumo", "melhorias", "objecoes", "proximo_passo",
  ];
  const linhas = lista.map((c) => {
    const a = c.analise;
    return [
      c.id, c.contato_nome, c.contato_telefone, c.atendente, ROTULO_ORIGEM[c.origem] ?? c.origem, c.campanha, c.lead?.nome, c.lead?.email,
      c.iniciada_em, c.ultima_mensagem_em, c.total_mensagens, c.mensagens_sdr, c.mensagens_consultor, c.primeira_mensagem_cliente,
      c.tempo_primeira_resposta_seg != null ? Math.round(c.tempo_primeira_resposta_seg / 60) : "", c.consultor_entrou_em,
      c.cliente_sem_resposta ? "sim" : "não", ROTULO_STATUS[c.status], a?.nota, a?.nota_sdr,
      a?.resultado ? ROTULO_RESULTADO[a.resultado] ?? a.resultado : "", a?.etapa_funil, a?.resumo,
      (a?.melhorias ?? []).map((m) => `[${m.prioridade}] ${m.titulo}`).join(" | "),
      (a?.objecoes ?? []).map((o) => `${o.categoria}: ${o.trecho_cliente}`).join(" | "),
      a?.proximo_passo,
    ].map(csvCampo).join(";");
  });
  // BOM + ";" -> o Excel em português abre direto com acentos e colunas certas.
  baixarArquivo(`conversas-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n"), "text/csv;charset=utf-8");
}

async function exportarTranscricoes(lista: ConversaComAnalise[]) {
  const partes: string[] = [];
  for (let i = 0; i < lista.length; i += 100) {
    const bloco = lista.slice(i, i + 100);
    const { data, error } = await tabela("comercial_conversas").select("id, transcricao").in("id", bloco.map((c) => c.id));
    if (error) throw error;
    const mapa = new Map<string, string>((data ?? []).map((d: { id: string; transcricao: string | null }) => [d.id, d.transcricao ?? ""]));
    for (const c of bloco) {
      partes.push([
        "=".repeat(80),
        `Cliente: ${c.contato_nome ?? "—"} (${c.contato_telefone ?? "—"}) · Consultor: ${c.atendente ?? "—"} · Origem: ${ROTULO_ORIGEM[c.origem] ?? c.origem}${c.campanha ? ` / ${c.campanha}` : ""}`,
        `Início: ${dataCurta(c.iniciada_em)} · Última mensagem: ${dataCurta(c.ultima_mensagem_em)}${c.analise?.nota != null ? ` · Nota: ${c.analise.nota}` : ""}`,
        "=".repeat(80),
        mapa.get(c.id) || "(sem mensagens)",
        "",
      ].join("\n"));
    }
  }
  baixarArquivo(`transcricoes-whatsapp-${new Date().toISOString().slice(0, 10)}.txt`, partes.join("\n"), "text/plain;charset=utf-8");
}

export default function AbaConversas({
  conversas, selecionadas, setSelecionadas, onAbrir, base, precos, ocupado, onAnalisar, onAvaliar,
}: {
  conversas: ConversaComAnalise[];
  selecionadas: Set<string>;
  setSelecionadas: (s: Set<string>) => void;
  onAbrir: (c: ConversaComAnalise) => void;
  base: BaseTokens;
  precos: Precos;
  ocupado: boolean;
  onAnalisar: (ids: string[], forcar: boolean) => void;
  onAvaliar: (ids: string[], titulo: string, instrucoes: string) => Promise<void>;
}) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const [exportando, setExportando] = useState(false);
  const [dialogo, setDialogo] = useState<"analisar" | "avaliar" | null>(null);
  const [forcar, setForcar] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [avaliando, setAvaliando] = useState(false);

  const selecionadasLista = conversas.filter((c) => selecionadas.has(c.id));
  // Seleção que ficou fora do filtro atual continua valendo.
  const foraDoFiltro = selecionadas.size - selecionadasLista.length;
  const todasMarcadas = conversas.length > 0 && conversas.every((c) => selecionadas.has(c.id));
  const alvo = selecionadasLista.length ? selecionadasLista : conversas;
  const paraAnalisar = forcar ? alvo : alvo.filter((c) => c.status !== "analisada");

  const alternar = (id: string) => {
    const novo = new Set(selecionadas);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionadas(novo);
  };

  const baixarTxt = async () => {
    setExportando(true);
    try {
      await exportarTranscricoes(alvo);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  const avaliar = async () => {
    setAvaliando(true);
    try {
      await onAvaliar(alvo.map((c) => c.id), titulo, instrucoes);
      setDialogo(null);
    } finally {
      setAvaliando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-emerald-900">
          {selecionadasLista.length
            ? `${selecionadasLista.length} selecionada(s)`
            : `Nenhuma selecionada — as ações valem para as ${conversas.length} do filtro`}
          {foraDoFiltro > 0 && <span className="text-emerald-700"> (+{foraDoFiltro} fora do filtro)</span>}
        </span>
        {selecionadas.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelecionadas(new Set())}><X className="h-4 w-4 mr-1" /> Limpar</Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="bg-white" onClick={() => exportarCsv(alvo)} disabled={!alvo.length}>
          <Download className="h-4 w-4 mr-1" /> Planilha (CSV)
        </Button>
        <Button size="sm" variant="outline" className="bg-white" onClick={baixarTxt} disabled={!alvo.length || exportando}>
          {exportando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Transcrições (.txt)
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setDialogo("analisar")} disabled={!alvo.length || ocupado}>
          <Sparkles className="h-4 w-4 mr-1" /> Analisar uma a uma
        </Button>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setDialogo("avaliar")} disabled={!alvo.length || ocupado}>
          <Brain className="h-4 w-4 mr-1" /> Avaliar em conjunto
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-10">
                <Checkbox
                  checked={todasMarcadas}
                  onCheckedChange={(v) => {
                    const novo = new Set(selecionadas);
                    for (const c of conversas) if (v) novo.add(c.id); else novo.delete(c.id);
                    setSelecionadas(novo);
                  }}
                  aria-label="Selecionar todas do filtro"
                />
              </TableHead>
              <TableHead>Última msg</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Consultor</TableHead>
              <TableHead>Análise</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">1ª resposta</TableHead>
              <TableHead className="text-right">SDR</TableHead>
              <TableHead className="text-right">Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversas.slice(0, limite).map((c) => (
              <TableRow key={c.id} className={cn("cursor-pointer", selecionadas.has(c.id) && "bg-emerald-50/60")} onClick={() => onAbrir(c)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selecionadas.has(c.id)} onCheckedChange={() => alternar(c.id)} aria-label="Selecionar conversa" />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{dataCurta(c.ultima_mensagem_em)}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.contato_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.contato_telefone || ""}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline" className={COR_ORIGEM[c.origem] ?? ""}>{ROTULO_ORIGEM[c.origem] ?? c.origem}</Badge>
                  {c.campanha && <div className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate">{c.campanha}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {c.atendente || <span className="text-muted-foreground">{c.mensagens_consultor === 0 ? "só SDR" : "—"}</span>}
                </TableCell>
                <TableCell><Badge variant="outline" className={COR_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Badge></TableCell>
                <TableCell>
                  {c.analise?.resultado ? <Badge variant="outline">{ROTULO_RESULTADO[c.analise.resultado] ?? c.analise.resultado}</Badge> : "—"}
                  {c.cliente_sem_resposta && <Badge variant="outline" className="ml-1 bg-rose-50 text-rose-700 border-rose-300">sem resposta</Badge>}
                </TableCell>
                <TableCell className="text-right text-sm">{duracao(c.tempo_primeira_resposta_seg)}</TableCell>
                <TableCell className={cn("text-right", corNota(c.analise?.nota_sdr))}>{c.analise?.nota_sdr ?? "—"}</TableCell>
                <TableCell className={cn("text-right font-semibold", corNota(c.analise?.nota))}>{c.analise?.nota ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!conversas.length && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma conversa com esses filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {conversas.length > limite && (
          <div className="p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setLimite(limite + POR_PAGINA)}>
              Mostrar mais ({conversas.length - limite} restantes)
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogo === "analisar"} onOpenChange={(v) => !v && setDialogo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Analisar uma a uma</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              {alvo.length} conversa(s) no alvo; {alvo.filter((c) => c.status === "nao_analisada").length} nunca analisada(s),{" "}
              {alvo.filter((c) => c.status === "desatualizada").length} desatualizada(s).
            </p>
            <label className="flex items-center gap-2">
              <Switch checked={forcar} onCheckedChange={setForcar} />
              Reanalisar também as que já estão analisadas (ex.: depois de mudar o processo ou o prompt)
            </label>
            <div className="rounded-lg bg-slate-50 border p-3">
              <b>{paraAnalisar.length}</b> análise(s): <ResumoEstimativa e={estimarAnalises(paraAnalisar, base)} precos={precos} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(null)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!paraAnalisar.length}
              onClick={() => { onAnalisar(paraAnalisar.map((c) => c.id), forcar); setDialogo(null); }}>
              Analisar {paraAnalisar.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "avaliar"} onOpenChange={(v) => !v && setDialogo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Avaliar {alvo.length} conversa(s) em conjunto</DialogTitle></DialogHeader>
          {(() => {
            const e = estimarConjunto(alvo, base);
            const semAnalise = alvo.filter((c) => !c.analise).length;
            return (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  A IA diz se o atendimento deste conjunto está bom, critério a critério, comparando com o processo de
                  atendimento (aba Configuração), e aponta as dificuldades de cada consultor e do SDR.
                </p>
                <Input value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder="Título (ex.: Guilherme — setembro)" />
                <div>
                  <Textarea value={instrucoes} onChange={(ev) => setInstrucoes(ev.target.value)} className="min-h-[120px]"
                    placeholder="O que você quer saber deste conjunto? (opcional — sem nada, faz a avaliação padrão)" />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {MODELOS_INSTRUCAO.map((m) => (
                      <Button key={m.rotulo} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setInstrucoes(m.texto)}>{m.rotulo}</Button>
                    ))}
                  </div>
                </div>
                <div className={cn("rounded-lg border p-3", e.modo === "transcricoes" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
                  {e.modo === "transcricoes"
                    ? "Cabe inteiro: a IA vai ler as transcrições completas."
                    : `Grande demais para ler as transcrições: a IA vai ler as análises individuais${semAnalise ? ` — ${semAnalise} conversa(s) sem análise ficam de fora (analise-as antes, ou selecione menos)` : ""}.`}
                  <div className="mt-1"><ResumoEstimativa e={e} precos={precos} /></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(null)}>Cancelar</Button>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={avaliar} disabled={avaliando}>
              {avaliando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />} Avaliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selecionadas.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Dica: filtre por consultor e use "Avaliar em conjunto" para ver onde cada um tem mais dificuldade.
          A seleção continua valendo ao trocar de aba.
        </p>
      )}
    </div>
  );
}
