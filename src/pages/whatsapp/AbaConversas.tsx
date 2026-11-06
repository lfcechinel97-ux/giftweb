import { useState } from "react";
import { Download, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  COR_ORIGEM, ROTULO_ORIGEM, avisarErro, dataCurta, duracao, exportarCsv, exportarTranscricoes, exportarUma,
  type ConversaComOrigem,
} from "./comum";

/* Lista de conversas com seleção e exportação: planilha (CSV), todas as
   transcrições num .txt ou uma conversa por vez. Sem nada selecionado, as
   exportações valem para a lista inteira. Usada na aba do período e na
   busca por número/nome. */

const POR_PAGINA = 200;

export default function ListaConversas({ conversas, selecionadas, setSelecionadas, onAbrir, prefixoArquivo, vazio }: {
  conversas: ConversaComOrigem[];
  selecionadas: Set<string>;
  setSelecionadas: (s: Set<string>) => void;
  onAbrir: (c: ConversaComOrigem) => void;
  prefixoArquivo?: string;
  vazio?: string;
}) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const [exportando, setExportando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const selecionadasLista = conversas.filter((c) => selecionadas.has(c.id));
  const todasMarcadas = conversas.length > 0 && conversas.every((c) => selecionadas.has(c.id));
  const alvo = selecionadasLista.length ? selecionadasLista : conversas;

  const alternar = (id: string) => {
    const novo = new Set(selecionadas);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionadas(novo);
  };

  const baixarTxt = async () => {
    setExportando(true);
    try {
      await exportarTranscricoes(alvo, prefixoArquivo);
    } catch (e) {
      avisarErro(e);
    } finally {
      setExportando(false);
    }
  };

  const baixarUma = async (c: ConversaComOrigem) => {
    setBaixandoId(c.id);
    try {
      await exportarUma(c);
    } catch (e) {
      avisarErro(e);
    } finally {
      setBaixandoId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-emerald-900">
          {selecionadasLista.length
            ? `${selecionadasLista.length} selecionada(s)`
            : `Nenhuma selecionada — exporta as ${conversas.length} da lista`}
        </span>
        {selecionadasLista.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelecionadas(new Set())}><X className="h-4 w-4 mr-1" /> Limpar</Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="bg-white" onClick={() => exportarCsv(alvo, prefixoArquivo)} disabled={!alvo.length}>
          <Download className="h-4 w-4 mr-1" /> Planilha (CSV)
        </Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={baixarTxt} disabled={!alvo.length || exportando}>
          {exportando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Conversas (.txt)
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
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Como chegou</TableHead>
              <TableHead>1ª mensagem do cliente</TableHead>
              <TableHead>Consultor</TableHead>
              <TableHead>Início</TableHead>
              <TableHead className="text-right">1ª resposta</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversas.slice(0, limite).map((c) => (
              <TableRow key={c.id} className={cn("cursor-pointer align-top", selecionadas.has(c.id) && "bg-emerald-50/60")} onClick={() => onAbrir(c)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selecionadas.has(c.id)} onCheckedChange={() => alternar(c.id)} aria-label="Selecionar conversa" />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{c.contato_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.contato_telefone || ""}</div>
                </TableCell>
                <TableCell className="max-w-[260px]">
                  <Badge variant="outline" className={COR_ORIGEM[c.origem] ?? ""}>{ROTULO_ORIGEM[c.origem] ?? c.origem}</Badge>
                  {c.campanha && <div className="text-xs font-medium mt-0.5 truncate">{c.campanha}</div>}
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={c.motivo}>{c.motivo}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                  <span className="line-clamp-2" title={c.primeira_mensagem_cliente ?? ""}>{c.primeira_mensagem_cliente || "—"}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {c.atendente || <span className="text-muted-foreground">{c.mensagens_consultor === 0 ? "só SDR" : "—"}</span>}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{dataCurta(c.iniciada_em)}</TableCell>
                <TableCell className="text-right text-sm">
                  {duracao(c.tempo_primeira_resposta_seg)}
                  {c.cliente_sem_resposta && <div><Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300">sem resposta</Badge></div>}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700" title="Baixar esta conversa (.txt)" onClick={() => baixarUma(c)} disabled={baixandoId === c.id}>
                    {baixandoId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!conversas.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{vazio ?? "Nenhuma conversa."}</TableCell></TableRow>
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
    </div>
  );
}
