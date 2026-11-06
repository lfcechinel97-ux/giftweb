import { useMemo, useState } from "react";
import { Loader2, Megaphone, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ListaConversas from "./AbaConversas";
import {
  Bloco, COLUNAS_CONVERSA, COR_ORIGEM, ROTULO_ORIGEM, avisarErro, dataCurta, montarConversa, normalizarTexto, numero, tabela,
  type Conversa, type ConversaComOrigem, type LeadMeta, type Regra,
} from "./comum";

/* Buscar e exportar: cola números, nomes ou e-mails (um por linha ou
   separados por vírgula) e acha as conversas desses contatos em TODO o
   histórico importado (sem filtro de período), com a origem de cada lead
   e o motivo. Dá para exportar todas ou uma por uma. Leads da planilha do
   Meta que batem com a busca mas não têm conversa importada aparecem à
   parte. */

interface ResultadoTermo { termo: string; tipo: "telefone" | "email" | "nome"; ids: Set<string>; leadsSemConversa: LeadMeta[] }

const ultimos8 = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-8);
const semCuringa = (s: string) => s.replace(/[%_\\]/g, "");

export default function AbaBusca({ regras, leads, onAbrir }: {
  regras: Regra[];
  leads: LeadMeta[];
  onAbrir: (c: ConversaComOrigem) => void;
}) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoTermo[] | null>(null);
  const [conversas, setConversas] = useState<Map<string, Conversa>>(new Map());
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const leadPorConversa = useMemo(() => new Map(leads.filter((l) => l.conversa_id).map((l) => [l.conversa_id!, l])), [leads]);

  const buscar = async () => {
    const termos = [...new Set(texto.split(/[\n,;]+/).map((t) => t.trim()).filter((t) => t.length >= 2))];
    if (!termos.length) return;
    setBuscando(true);
    try {
      const achadas = new Map<string, Conversa>();
      const porTermo: ResultadoTermo[] = await Promise.all(termos.map(async (termo): Promise<ResultadoTermo> => {
        const digitos = termo.replace(/\D/g, "");
        const tipo = termo.includes("@") ? "email" : digitos.length >= 8 ? "telefone" : "nome";
        let query = tabela("comercial_conversas").select(COLUNAS_CONVERSA).limit(500);
        let leadsDoTermo: LeadMeta[];
        if (tipo === "telefone") {
          // Últimos 8 dígitos: ignora +55, DDD com ou sem zero e o 9º dígito.
          const fim = digitos.slice(-8);
          query = query.ilike("contato_telefone", `%${fim}%`);
          leadsDoTermo = leads.filter((l) => ultimos8(l.telefone) === fim);
        } else if (tipo === "email") {
          const email = termo.toLowerCase();
          query = query.contains("emails", [email]);
          leadsDoTermo = leads.filter((l) => l.email?.toLowerCase() === email);
        } else {
          query = query.ilike("contato_nome", `%${semCuringa(termo)}%`);
          const alvo = normalizarTexto(termo);
          leadsDoTermo = leads.filter((l) => l.nome && normalizarTexto(l.nome).includes(alvo));
        }
        const { data, error } = await query;
        if (error) throw error;
        const ids = new Set<string>();
        for (const c of (data ?? []) as Conversa[]) { achadas.set(c.id, c); ids.add(c.id); }
        // Conversas ligadas aos leads do Meta que bateram (o telefone da conversa pode estar diferente).
        const idsDeLeads = leadsDoTermo.map((l) => l.conversa_id).filter((id): id is string => !!id && !ids.has(id));
        if (idsDeLeads.length) {
          const { data: extra, error: e2 } = await tabela("comercial_conversas").select(COLUNAS_CONVERSA).in("id", idsDeLeads.slice(0, 200));
          if (e2) throw e2;
          for (const c of (extra ?? []) as Conversa[]) { achadas.set(c.id, c); ids.add(c.id); }
        }
        return { termo, tipo, ids, leadsSemConversa: leadsDoTermo.filter((l) => !l.conversa_id) };
      }));
      setConversas(achadas);
      setResultados(porTermo);
      setSelecionadas(new Set());
    } catch (e) {
      avisarErro(e);
    } finally {
      setBuscando(false);
    }
  };

  const lista = useMemo(() => [...conversas.values()]
    .map((c) => montarConversa(c, regras, leadPorConversa.get(c.id) ?? null))
    .sort((a, b) => (b.ultima_mensagem_em ?? "").localeCompare(a.ultima_mensagem_em ?? "")), [conversas, regras, leadPorConversa]);

  const porOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of lista) m.set(c.origem, (m.get(c.origem) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lista]);

  const naoEncontrados = resultados?.filter((r) => !r.ids.size && !r.leadsSemConversa.length) ?? [];
  const leadsSemConversa = resultados?.flatMap((r) => r.leadsSemConversa) ?? [];

  return (
    <div className="space-y-5">
      <Bloco titulo="Buscar contatos" icone={Search} cor="emerald">
        <div className="space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) buscar(); }}
            className="min-h-[110px]"
            placeholder={"Cole números, nomes ou e-mails — um por linha ou separados por vírgula.\nEx.: (48) 99912-3456, Mariana Souza, compras@empresa.com.br"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Procura em todas as conversas já importadas, de qualquer data. Telefone: basta o número com DDD (o +55 e o 9º dígito
              não importam). Nome: parte do nome serve.
            </p>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={buscar} disabled={buscando || !texto.trim()}>
              {buscando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />} Buscar
            </Button>
          </div>
        </div>
      </Bloco>

      {resultados && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{numero(lista.length)} conversa(s) encontrada(s)</span>
            {porOrigem.map(([o, n]) => (
              <Badge key={o} variant="outline" className={COR_ORIGEM[o] ?? ""}>{ROTULO_ORIGEM[o] ?? o}: {n}</Badge>
            ))}
          </div>

          {resultados.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {resultados.map((r) => (
                <Badge key={r.termo} variant="outline"
                  className={cn(r.ids.size ? "bg-emerald-50 text-emerald-800 border-emerald-200" : r.leadsSemConversa.length ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                  {r.termo}: {r.ids.size ? `${r.ids.size} conversa(s)` : r.leadsSemConversa.length ? "só na planilha do Meta" : "não encontrado"}
                </Badge>
              ))}
            </div>
          )}

          <ListaConversas
            conversas={lista} selecionadas={selecionadas} setSelecionadas={setSelecionadas} onAbrir={onAbrir}
            prefixoArquivo="busca-whatsapp" vazio="Nenhuma conversa encontrada."
          />

          {leadsSemConversa.length > 0 && (
            <Bloco titulo="Estão na planilha do Meta, mas sem conversa importada" icone={Megaphone} cor="blue">
              <ul className="divide-y divide-slate-100 text-sm">
                {leadsSemConversa.map((l) => (
                  <li key={l.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span><b>{l.nome ?? "—"}</b> <span className="text-muted-foreground">{[l.telefone, l.email].filter(Boolean).join(" · ")}</span></span>
                    <span className="text-muted-foreground">Meta Ads{l.campanha ? ` · ${l.campanha}` : ""} · chegou {dataCurta(l.lead_criado_em)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                O lead veio do anúncio, mas a conversa não está no sistema: talvez ainda não tenha sido importada (importe o período em
                que ele chegou) ou o cliente nunca chamou no WhatsApp.
              </p>
            </Bloco>
          )}

          {naoEncontrados.length > 0 && (
            <Bloco titulo="Não encontrados" icone={SearchX} cor="rose">
              <p className="text-sm">{naoEncontrados.map((r) => r.termo).join(" · ")}</p>
              <p className="text-xs text-muted-foreground mt-2">
                A busca só vê conversas já importadas do Data Crazy. Se o contato falou com a gente num período ainda não importado,
                importe esse período e busque de novo.
              </p>
            </Bloco>
          )}
        </>
      )}
    </div>
  );
}
