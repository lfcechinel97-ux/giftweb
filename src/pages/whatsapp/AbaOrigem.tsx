import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, MessageSquareText, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Bloco, ROTULO_ORIGEM, Vazio, corNota, media, normalizarTexto, pct, tabela, type ConversaComAnalise, type Regra } from "./comum";

/* Aba Origem: leads por origem/campanha e as mensagens iniciais agrupadas,
   para criar regras "1ª mensagem contém X -> Google/Meta (campanha)". */

export default function AbaOrigem({ conversas, regras, onAbrir }: { conversas: ConversaComAnalise[]; regras: Regra[]; onAbrir: (c: ConversaComAnalise) => void }) {
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
      <Bloco titulo="Leads por origem" icone={Megaphone} cor="blue">
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
          A origem vem, nesta ordem: lead da planilha do Meta (aba Leads Meta), regras abaixo (1ª mensagem contém o texto) e o que o Data Crazy mandar do anúncio
          (ex.: referral de anúncio do Meta); se não houver nada, fica "Não identificada".
        </p>
      </Bloco>

      <Bloco titulo="Regras de origem (pela 1ª mensagem)" icone={Megaphone} cor="amber">
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

      <Bloco titulo="Mensagens iniciais dos leads" icone={MessageSquareText} cor="teal">
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
