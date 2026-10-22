import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, Link2, Loader2, Megaphone, Unlink, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Bloco, Kpi, Vazio, chamar, dataCurta, media, numero, pct, tabela, type ConversaComAnalise, type LeadMeta } from "./comum";

/* Leads do Meta Ads (planilha) x conversas do WhatsApp. A planilha entra
   por arquivo CSV (Google Planilhas: Arquivo > Fazer download > .csv) ou
   pelo link (planilha compartilhada "qualquer pessoa com o link"). As
   colunas são reconhecidas pelo nome e podem ser ajustadas antes de
   importar. Depois a edge function liga cada lead a uma conversa por
   telefone, e-mail, nome + horário ou só horário. */

type Campo = "id" | "nome" | "telefone" | "email" | "data" | "campanha" | "conjunto" | "anuncio" | "formulario" | "plataforma";

const CAMPOS: { campo: Campo; rotulo: string; padrao: RegExp }[] = [
  { campo: "nome", rotulo: "Nome", padrao: /^(full[_ ]?name|nome[_ ]?completo|nome|name|first[_ ]?name)$|nome/i },
  { campo: "telefone", rotulo: "Telefone", padrao: /phone|telefone|whats|celular|fone/i },
  { campo: "email", rotulo: "E-mail", padrao: /e-?mail/i },
  { campo: "data", rotulo: "Data/hora do lead", padrao: /created[_ ]?time|carimbo|timestamp|data|hora|criado|date/i },
  { campo: "campanha", rotulo: "Campanha", padrao: /campaign[_ ]?name|campanha/i },
  { campo: "conjunto", rotulo: "Conjunto de anúncios", padrao: /adset[_ ]?name|conjunto/i },
  { campo: "anuncio", rotulo: "Anúncio", padrao: /^ad[_ ]?name$|an[uú]ncio/i },
  { campo: "formulario", rotulo: "Formulário", padrao: /form[_ ]?name|formul/i },
  { campo: "plataforma", rotulo: "Plataforma", padrao: /platform|plataforma/i },
  { campo: "id", rotulo: "ID do lead", padrao: /^(id|lead[_ ]?id|id[_ ]?do[_ ]?lead)$/i },
];

const ROTULO_METODO: Record<string, string> = {
  telefone: "Telefone",
  email: "E-mail",
  nome_horario: "Nome + horário",
  horario: "Só horário (conferir)",
  manual: "Manual",
};

/** CSV (vírgula, ponto e vírgula ou tab) com aspas -- RFC 4180. */
function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primeira = t.slice(0, t.indexOf("\n") >>> 0);
  const sep = [",", ";", "\t"].map((s) => ({ s, n: primeira.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((c) => c.trim())) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c.trim())) linhas.push(linha);
  return linhas;
}

/** "2026-09-03T14:22:10-0300", "03/09/2026 14:22:10", "2026-09-03 14:22" -> ISO (horário de Brasília quando não vem fuso). */
function lerData(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    const [, d, mes, a, h = "0", mi = "0", se = "0"] = m;
    return new Date(`${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${se.padStart(2, "0")}-03:00`).toISOString();
  }
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}-03:00`).toISOString();
  const d = new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function hash(texto: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AbaLeadsMeta({ leads, conversas, onAbrir }: {
  leads: LeadMeta[];
  conversas: ConversaComAnalise[];
  onAbrir: (c: ConversaComAnalise) => void;
}) {
  const qc = useQueryClient();
  const [link, setLink] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [planilha, setPlanilha] = useState<{ cabecalho: string[]; linhas: string[][] } | null>(null);
  const [mapa, setMapa] = useState<Partial<Record<Campo, number>>>({});
  const [importando, setImportando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "vinculados" | "sem" | "conferir">("todos");

  const porId = useMemo(() => new Map(conversas.map((c) => [c.id, c])), [conversas]);

  const abrirPlanilha = (texto: string) => {
    const linhas = lerCsv(texto);
    if (linhas.length < 2) { toast.error("A planilha está vazia ou não é um CSV."); return; }
    const [cabecalho, ...resto] = linhas;
    const auto: Partial<Record<Campo, number>> = {};
    const usados = new Set<number>();
    for (const { campo, padrao } of CAMPOS) {
      const i = cabecalho.findIndex((h, idx) => !usados.has(idx) && padrao.test(h.trim()));
      if (i >= 0) { auto[campo] = i; usados.add(i); }
    }
    setMapa(auto);
    setPlanilha({ cabecalho, linhas: resto });
  };

  const lerArquivo = async (arquivo?: File) => {
    if (!arquivo) return;
    if (/\.xlsx?$/i.test(arquivo.name)) {
      toast.error("Envie em CSV: no Google Planilhas, Arquivo > Fazer download > Valores separados por vírgula (.csv).");
      return;
    }
    abrirPlanilha(await arquivo.text());
  };

  const baixarLink = async () => {
    setCarregando(true);
    try {
      const r = await chamar({ acao: "baixar_planilha", url: link });
      abrirPlanilha(r.csv);
      await tabela("comercial_configuracoes").upsert({ chave: "planilha_meta_url", valor: link, atualizado_em: new Date().toISOString() });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  const vincular = async () => {
    setVinculando(true);
    try {
      const r = await chamar({ acao: "vincular_leads" });
      toast.success(`${r.vinculados} de ${r.leads} leads ligados a conversas (telefone ${r.porMetodo.telefone}, e-mail ${r.porMetodo.email}, nome+horário ${r.porMetodo.nome_horario}, só horário ${r.porMetodo.horario}).`);
      qc.invalidateQueries({ queryKey: ["whatsapp"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVinculando(false);
    }
  };

  const importar = async () => {
    if (!planilha) return;
    if (mapa.telefone == null && mapa.email == null && mapa.nome == null) {
      toast.error("Indique pelo menos a coluna de telefone, e-mail ou nome.");
      return;
    }
    setImportando(true);
    try {
      const valor = (l: string[], c: Campo) => (mapa[c] != null ? (l[mapa[c]!] ?? "").trim() || null : null);
      const linhas = await Promise.all(planilha.linhas.map(async (l) => {
        const telefone = valor(l, "telefone")?.replace(/^p:/, "") ?? null;
        const dados = Object.fromEntries(planilha.cabecalho.map((h, i) => [h || `coluna_${i + 1}`, l[i] ?? ""]));
        return {
          chave: valor(l, "id") ?? await hash(JSON.stringify(l)),
          nome: valor(l, "nome"),
          telefone,
          email: valor(l, "email")?.toLowerCase() ?? null,
          lead_criado_em: valor(l, "data") ? lerData(valor(l, "data")!) : null,
          campanha: valor(l, "campanha"),
          conjunto: valor(l, "conjunto"),
          anuncio: valor(l, "anuncio"),
          formulario: valor(l, "formulario"),
          plataforma: valor(l, "plataforma"),
          dados,
        };
      }));
      // Linha repetida na planilha: fica a última.
      const unicas = [...new Map(linhas.map((l) => [l.chave, l])).values()];
      for (let i = 0; i < unicas.length; i += 500) {
        const { error } = await tabela("comercial_leads_meta").upsert(unicas.slice(i, i + 500), { onConflict: "chave" });
        if (error) throw error;
      }
      toast.success(`${unicas.length} leads importados. Ligando às conversas…`);
      setPlanilha(null);
      await vincular();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportando(false);
    }
  };

  const desvincular = async (l: LeadMeta) => {
    const { error } = await tabela("comercial_leads_meta")
      .update({ conversa_id: null, vinculo_metodo: "manual", vinculo_score: null, vinculado_em: null }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["whatsapp"] });
  };

  const vinculados = leads.filter((l) => l.conversa_id);
  const conferir = leads.filter((l) => l.vinculo_metodo === "horario");
  const visiveis = leads.filter((l) =>
    filtro === "todos" || (filtro === "vinculados" && l.conversa_id) || (filtro === "sem" && !l.conversa_id) || (filtro === "conferir" && l.vinculo_metodo === "horario"));

  // Por campanha: leads, quantos viraram conversa, nota média e vendas.
  const porCampanha = useMemo(() => {
    const m = new Map<string, LeadMeta[]>();
    for (const l of leads) m.set(l.campanha ?? "(sem campanha)", [...(m.get(l.campanha ?? "(sem campanha)") ?? []), l]);
    return [...m.entries()].map(([campanha, ls]) => {
      const cs = ls.map((l) => (l.conversa_id ? porId.get(l.conversa_id) : undefined)).filter(Boolean) as ConversaComAnalise[];
      const an = cs.filter((c) => c.analise);
      return {
        campanha, leads: ls.length, conversas: cs.length,
        nota: media(an.map((c) => c.analise!.nota).filter((n): n is number => n != null)),
        vendas: an.filter((c) => c.analise!.resultado === "venda").length,
        analisadas: an.length,
      };
    }).sort((a, b) => b.leads - a.leads);
  }, [leads, porId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi rotulo="Leads do Meta" valor={numero(leads.length)} cor="blue" />
        <Kpi rotulo="Ligados a uma conversa" valor={pct(vinculados.length, leads.length)} detalhe={`${vinculados.length} leads`} cor="emerald" />
        <Kpi rotulo="Sem conversa" valor={numero(leads.length - vinculados.length)} detalhe="não chamaram ou não foi possível ligar" cor="rose" />
        <Kpi rotulo="Ligados só pelo horário" valor={numero(conferir.length)} detalhe="vale conferir" cor="amber" />
      </div>

      <Bloco titulo="Importar a planilha do Meta Ads" icone={FileSpreadsheet} cor="blue"
        acao={leads.length > 0 && (
          <Button size="sm" variant="outline" onClick={vincular} disabled={vinculando}>
            {vinculando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />} Ligar de novo às conversas
          </Button>
        )}>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <p className="font-semibold">Opção 1 — arquivo (recomendado, mais privado)</p>
            <p className="text-muted-foreground">No Google Planilhas, abra a aba dos leads e vá em <b>Arquivo → Fazer download → Valores separados por vírgula (.csv)</b>. Depois envie aqui:</p>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5">
              <Upload className="h-4 w-4" /> Escolher arquivo CSV
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} />
            </label>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <p className="font-semibold">Opção 2 — link da planilha</p>
            <p className="text-muted-foreground">
              Em <b>Compartilhar</b>, mude o acesso geral para <b>"Qualquer pessoa com o link — Leitor"</b> e cole o link da aba
              (com o <code>gid=</code>). Atenção: quem tiver o link vê os dados dos leads.
            </p>
            <div className="flex gap-2">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…" />
              <Button onClick={baixarLink} disabled={!link || carregando}>
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar"}
              </Button>
            </div>
          </div>
        </div>

        {planilha && (
          <div className="mt-4 space-y-3">
            <p className="text-sm"><b>{planilha.linhas.length}</b> linhas. Confira quais colunas correspondem a cada campo:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {CAMPOS.map(({ campo, rotulo }) => (
                <label key={campo} className="text-xs">
                  {rotulo}
                  <Select value={mapa[campo] != null ? String(mapa[campo]) : "-"} onValueChange={(v) => setMapa({ ...mapa, [campo]: v === "-" ? undefined : Number(v) })}>
                    <SelectTrigger className={cn("h-8", mapa[campo] != null && "border-emerald-400")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">(nenhuma)</SelectItem>
                      {planilha.cabecalho.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    {CAMPOS.filter((c) => mapa[c.campo] != null).map((c) => <TableHead key={c.campo}>{c.rotulo}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planilha.linhas.slice(0, 5).map((l, i) => (
                    <TableRow key={i}>
                      {CAMPOS.filter((c) => mapa[c.campo] != null).map((c) => (
                        <TableCell key={c.campo} className="text-xs">
                          {c.campo === "data" ? `${l[mapa[c.campo]!]} → ${dataCurta(lerData(l[mapa[c.campo]!] ?? ""))}` : l[mapa[c.campo]!]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={importar} disabled={importando}>
                {importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Importar {planilha.linhas.length} leads e ligar às conversas
              </Button>
              <Button variant="ghost" onClick={() => setPlanilha(null)}>Cancelar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Importar de novo a mesma planilha atualiza os leads (sem duplicar). A ligação usa, nesta ordem: telefone,
              e-mail citado na conversa, nome + horário (conversa começou até 3 h depois do lead) e, por último, só o
              horário (uma única conversa até 15 min depois).
            </p>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Por campanha" icone={Megaphone} cor="violet">
        {porCampanha.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Viraram conversa</TableHead>
                  <TableHead className="text-right">Analisadas</TableHead>
                  <TableHead className="text-right">Nota média</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCampanha.map((c) => (
                  <TableRow key={c.campanha}>
                    <TableCell className="font-medium">{c.campanha}</TableCell>
                    <TableCell className="text-right">{c.leads}</TableCell>
                    <TableCell className="text-right">{c.conversas} <span className="text-muted-foreground">({pct(c.conversas, c.leads)})</span></TableCell>
                    <TableCell className="text-right">{c.analisadas}</TableCell>
                    <TableCell className="text-right">{c.nota?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.vendas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <Vazio texto="Nenhum lead importado ainda." />}
      </Bloco>

      <Bloco titulo="Leads" icone={Users} cor="sky"
        acao={(
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos ({leads.length})</SelectItem>
              <SelectItem value="vinculados">Com conversa ({vinculados.length})</SelectItem>
              <SelectItem value="sem">Sem conversa ({leads.length - vinculados.length})</SelectItem>
              <SelectItem value="conferir">Conferir — só horário ({conferir.length})</SelectItem>
            </SelectContent>
          </Select>
        )}>
        {visiveis.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Lead</TableHead>
                  <TableHead>Chegou em</TableHead>
                  <TableHead>Campanha / anúncio</TableHead>
                  <TableHead>Conversa</TableHead>
                  <TableHead>Ligação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.slice(0, 300).map((l) => {
                  const c = l.conversa_id ? porId.get(l.conversa_id) : undefined;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{[l.telefone, l.email].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{dataCurta(l.lead_criado_em)}</TableCell>
                      <TableCell className="text-xs">
                        <div>{l.campanha ?? "—"}</div>
                        <div className="text-muted-foreground">{l.anuncio}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c ? (
                          <button className="text-blue-700 hover:underline text-left" onClick={() => onAbrir(c)}>
                            {c.contato_nome ?? "abrir"} · {dataCurta(c.iniciada_em)}
                          </button>
                        ) : l.conversa_id ? <span className="text-muted-foreground">fora do período</span> : "—"}
                      </TableCell>
                      <TableCell>
                        {l.vinculo_metodo && (
                          <Badge variant="outline" className={l.vinculo_metodo === "horario" ? "bg-amber-50 text-amber-800 border-amber-300" : l.vinculo_metodo === "manual" ? "" : "bg-emerald-50 text-emerald-800 border-emerald-300"}>
                            {ROTULO_METODO[l.vinculo_metodo] ?? l.vinculo_metodo}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.conversa_id && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" title="Desligar (não é esta conversa)" onClick={() => desvincular(l)}>
                            <Unlink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {visiveis.length > 300 && <p className="text-xs text-muted-foreground p-2">Mostrando 300 de {visiveis.length}.</p>}
          </div>
        ) : <Vazio texto="Nenhum lead aqui." />}
      </Bloco>
    </div>
  );
}
