import { AlertTriangle, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Bloco, Kpi, Vazio, corNota, media, normalizarTexto, pct, type AnaliseSdr, type ConversaComAnalise } from "./comum";

/* Aba SDR (IA): como o Felipe se sai contra o próprio prompt -- nota,
   passagem para o consultor, qualificação, catálogo, regras quebradas e
   sugestões de prompt de cada conversa. */

export default function AbaSdr({ analisadas, onAbrir }: { analisadas: ConversaComAnalise[]; onAbrir: (c: ConversaComAnalise) => void }) {
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
        <Kpi rotulo="Nota média do SDR" valor={media(notas)?.toFixed(1) ?? "—"} classe={corNota(media(notas))} detalhe={`${comSdr.length} conversa(s)`} cor="violet" />
        <Kpi rotulo="Passou para o consultor" valor={pct(conta((s) => s.handoff_feito), comSdr.length)} cor="emerald" />
        <Kpi rotulo="Lead bem qualificado" valor={pct(conta((s) => s.lead_qualificado), comSdr.length)} cor="blue" />
        <Kpi rotulo="Mandou catálogo" valor={pct(conta((s) => s.catalogo_enviado), comSdr.length)} cor="sky" />
        <Kpi rotulo="Regras quebradas" valor={String(ranking.reduce((s, g) => s + g.itens.length, 0))} cor="rose" />
      </div>

      <Bloco titulo="Regras do prompt mais quebradas" icone={AlertTriangle} cor="rose">
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

      <Bloco titulo="Sugestões para o prompt (por conversa)" icone={Bot} cor="violet">
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
          A versão consolidada (com texto pronto para colar no prompt) sai nas Avaliações. O prompt atual fica na aba Configuração.
        </p>
      </Bloco>

    </>
  );
}
