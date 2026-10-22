import { useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Bloco, mediana, numero, type ConversaComAnalise } from "./comum";

/* Estimativa de tokens e custo das chamadas de IA. Usa o que já foi gasto de
   verdade (tokens gravados em cada análise x tamanho da transcrição) quando
   há amostras suficientes; senão, ~3,6 caracteres por token. A saída inclui o
   raciocínio do modelo, por isso é bem maior que o JSON devolvido. */

// Instruções fixas da análise (prompt do sistema + esquema) em caracteres, fora o prompt do SDR e o processo.
const INSTRUCOES_FIXAS_CARACTERES = 9_000;
const CARACTERES_POR_TOKEN_PADRAO = 3.6;
const SAIDA_POR_ANALISE_PADRAO = 3_500;
const SAIDA_AVALIACAO_CONJUNTO = 9_000;
// Uma análise resumida (modo "análises" da avaliação em conjunto) ocupa ~1.200 caracteres.
const CARACTERES_POR_ANALISE_RESUMIDA = 1_200;
// Igual à edge function: até isto a avaliação em conjunto lê as transcrições inteiras.
export const MAX_CARACTERES_TRANSCRICOES_CONJUNTO = 150_000;

export interface BaseTokens {
  caracteresPorToken: number;
  saidaPorAnalise: number;
  instrucoesCaracteres: number;
  amostras: number;
  gastoEntrada: number;
  gastoSaida: number;
}

export function calcularBase(conversas: ConversaComAnalise[], caracteresContexto: number): BaseTokens {
  const instrucoesCaracteres = INSTRUCOES_FIXAS_CARACTERES + caracteresContexto;
  const comTokens = conversas.flatMap((c) => c.comercial_analises
    .filter((a) => a.tokens_entrada && c.transcricao_caracteres)
    .map((a) => ({ entrada: a.tokens_entrada!, saida: a.tokens_saida ?? 0, caracteres: c.transcricao_caracteres! })));
  const todas = conversas.flatMap((c) => c.comercial_analises);
  const gastoEntrada = todas.reduce((s, a) => s + (a.tokens_entrada ?? 0), 0);
  const gastoSaida = todas.reduce((s, a) => s + (a.tokens_saida ?? 0), 0);
  if (comTokens.length < 5) {
    return { caracteresPorToken: CARACTERES_POR_TOKEN_PADRAO, saidaPorAnalise: SAIDA_POR_ANALISE_PADRAO, instrucoesCaracteres, amostras: comTokens.length, gastoEntrada, gastoSaida };
  }
  return {
    caracteresPorToken: mediana(comTokens.map((x) => (x.caracteres + instrucoesCaracteres) / x.entrada)) ?? CARACTERES_POR_TOKEN_PADRAO,
    saidaPorAnalise: mediana(comTokens.map((x) => x.saida)) ?? SAIDA_POR_ANALISE_PADRAO,
    instrucoesCaracteres,
    amostras: comTokens.length,
    gastoEntrada,
    gastoSaida,
  };
}

export interface Estimativa { entrada: number; saida: number; chamadas: number; modo?: "transcricoes" | "analises" }

/** Analisar cada conversa individualmente (uma chamada por conversa). */
export function estimarAnalises(conversas: ConversaComAnalise[], base: BaseTokens): Estimativa {
  const entrada = conversas.reduce((s, c) => s + ((c.transcricao_caracteres ?? 0) + base.instrucoesCaracteres) / base.caracteresPorToken, 0);
  return { entrada: Math.round(entrada), saida: Math.round(conversas.length * base.saidaPorAnalise), chamadas: conversas.length };
}

/** Avaliar o conjunto numa chamada só (transcrições inteiras se couberem, senão as análises). */
export function estimarConjunto(conversas: ConversaComAnalise[], base: BaseTokens): Estimativa {
  const total = conversas.reduce((s, c) => s + (c.transcricao_caracteres ?? 0) + 150, 0);
  const modo = total <= MAX_CARACTERES_TRANSCRICOES_CONJUNTO ? "transcricoes" : "analises";
  const conteudo = modo === "transcricoes" ? total : Math.min(250_000, conversas.filter((c) => c.analise).length * CARACTERES_POR_ANALISE_RESUMIDA);
  return {
    entrada: Math.round((conteudo + base.instrucoesCaracteres) / base.caracteresPorToken),
    saida: SAIDA_AVALIACAO_CONJUNTO,
    chamadas: 1,
    modo,
  };
}

export interface Precos { entradaUsd: number; saidaUsd: number; dolar: number }
const CHAVE_PRECOS = "whatsapp-precos-tokens";

export function lerPrecos(): Precos {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PRECOS) ?? "null");
    if (salvo) return salvo;
  } catch { /* sem localStorage */ }
  return { entradaUsd: 0, saidaUsd: 0, dolar: 5.5 };
}

function salvarPrecos(p: Precos) {
  try { localStorage.setItem(CHAVE_PRECOS, JSON.stringify(p)); } catch { /* sem localStorage */ }
}

export const tokensCurto = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n);

export function custoTexto(e: { entrada: number; saida: number }, p: Precos) {
  if (!p.entradaUsd && !p.saidaUsd) return null;
  const usd = (e.entrada / 1e6) * p.entradaUsd + (e.saida / 1e6) * p.saidaUsd;
  return `US$ ${usd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (≈ R$ ${(usd * p.dolar).toLocaleString("pt-BR", { maximumFractionDigits: 2 })})`;
}

/** Linha curta: "~120 mil tokens (90 mil entrada + 30 mil saída) · US$ 0,40". */
export function ResumoEstimativa({ e, precos }: { e: Estimativa; precos: Precos }) {
  const custo = custoTexto(e, precos);
  return (
    <span>
      ~{tokensCurto(e.entrada + e.saida)} tokens
      <span className="text-muted-foreground"> ({tokensCurto(e.entrada)} entrada + {tokensCurto(e.saida)} saída{e.chamadas > 1 ? `, ${numero(e.chamadas)} chamadas` : ""})</span>
      {custo && <> · <b>{custo}</b></>}
    </span>
  );
}

export function CalculadoraTokens({ conversas, base, precos, onPrecos }: {
  conversas: ConversaComAnalise[]; base: BaseTokens; precos: Precos; onPrecos: (p: Precos) => void;
}) {
  const [qtd, setQtd] = useState<string>("");
  const media = conversas.length ? conversas.reduce((s, c) => s + (c.transcricao_caracteres ?? 0), 0) / conversas.length : 3000;
  const n = Number(qtd) || conversas.length;
  const porConversa = (media + base.instrucoesCaracteres) / base.caracteresPorToken;
  const e: Estimativa = { entrada: Math.round(n * porConversa), saida: Math.round(n * base.saidaPorAnalise), chamadas: n };
  const atualizar = (campo: keyof Precos, v: string) => {
    const novo = { ...precos, [campo]: Number(v.replace(",", ".")) || 0 };
    salvarPrecos(novo);
    onPrecos(novo);
  };
  const gasto = { entrada: base.gastoEntrada, saida: base.gastoSaida, chamadas: 0 };

  return (
    <Bloco titulo="Calculadora de tokens" icone={Calculator} cor="teal">
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <label className="block">
            <span className="text-muted-foreground">Quantas conversas analisar</span>
            <Input type="number" min={1} value={qtd} placeholder={String(conversas.length)} onChange={(ev) => setQtd(ev.target.value)} />
          </label>
          <p>Por conversa: ~{tokensCurto(Math.round(porConversa))} de entrada + ~{tokensCurto(Math.round(base.saidaPorAnalise))} de saída</p>
          <p className="text-base">Total: <ResumoEstimativa e={e} precos={precos} /></p>
          <p className="text-xs text-muted-foreground">
            {base.amostras >= 5
              ? `Baseado no gasto real de ${base.amostras} análises (${base.caracteresPorToken.toFixed(1)} caracteres por token).`
              : "Estimativa padrão (~3,6 caracteres por token); fica mais precisa depois das primeiras análises."}{" "}
            A saída inclui o raciocínio do modelo. Conversa média: {numero(Math.round(media))} caracteres.
          </p>
          <p className="text-sm">Já gasto nas análises carregadas: <ResumoEstimativa e={gasto} precos={precos} /></p>
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground">Preço por 1 milhão de tokens (veja na tabela do Lovable AI / do modelo usado):</p>
          <div className="grid grid-cols-3 gap-2">
            <label><span className="text-xs">Entrada (US$)</span><Input defaultValue={precos.entradaUsd || ""} onChange={(ev) => atualizar("entradaUsd", ev.target.value)} /></label>
            <label><span className="text-xs">Saída (US$)</span><Input defaultValue={precos.saidaUsd || ""} onChange={(ev) => atualizar("saidaUsd", ev.target.value)} /></label>
            <label><span className="text-xs">Dólar (R$)</span><Input defaultValue={precos.dolar || ""} onChange={(ev) => atualizar("dolar", ev.target.value)} /></label>
          </div>
          <p className="text-xs text-muted-foreground">Fica salvo neste navegador.</p>
        </div>
      </div>
    </Bloco>
  );
}
