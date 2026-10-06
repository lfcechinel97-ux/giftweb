import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Custo de IA em R$ a partir dos tokens salvos em cada geração. As tarifas
 * ficam numa linha `custo_ia` da tabela mockup_ia_prompts (JSON no campo
 * `prompt`) -- reaproveita o RLS de admin dela e dispensa migration. O
 * gateway do Lovable cobra em créditos próprios, então o valor é uma
 * estimativa: o admin ajusta tarifa e câmbio pela engrenagem (prompts).
 */
export interface TarifaIa {
  /** US$ por 1 milhão de tokens de entrada (texto + imagens enviadas). */
  usdPorMilhaoEntrada: number;
  /** US$ por 1 milhão de tokens de saída (a imagem gerada). */
  usdPorMilhaoSaida: number;
  /** R$ por US$ 1. */
  cambio: number;
}

export const CHAVE_TARIFA = "custo_ia";

/** Referência pública do gemini-3.1-flash-lite-image (saída de imagem). */
export const TARIFA_PADRAO: TarifaIa = { usdPorMilhaoEntrada: 0.25, usdPorMilhaoSaida: 30, cambio: 5.4 };

export function lerTarifa(texto: string | null | undefined): TarifaIa {
  try {
    const t = JSON.parse(texto || "{}");
    const num = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : padrao);
    return {
      usdPorMilhaoEntrada: num(t.usdPorMilhaoEntrada, TARIFA_PADRAO.usdPorMilhaoEntrada),
      usdPorMilhaoSaida: num(t.usdPorMilhaoSaida, TARIFA_PADRAO.usdPorMilhaoSaida),
      cambio: num(t.cambio, TARIFA_PADRAO.cambio),
    };
  } catch {
    return TARIFA_PADRAO;
  }
}

export async function carregarTarifa(): Promise<TarifaIa> {
  const { data } = await supabase.from("mockup_ia_prompts").select("prompt").eq("chave", CHAVE_TARIFA).maybeSingle();
  return lerTarifa(data?.prompt);
}

/** Tarifa vigente (só o admin consegue ler a linha; vendedor fica no padrão,
 * mas o custo nem aparece pra ele). */
export function useTarifaIa(ativo: boolean): [TarifaIa, (t: TarifaIa) => void] {
  const [tarifa, setTarifa] = useState<TarifaIa>(TARIFA_PADRAO);
  useEffect(() => {
    if (ativo) carregarTarifa().then(setTarifa).catch(() => { /* fica no padrão */ });
  }, [ativo]);
  return [tarifa, setTarifa];
}

interface ComTokens { tokens_entrada: number | null; tokens_saida: number | null; tokens_total: number | null }

/** Custo em R$ de uma geração; null se ela não registrou tokens. Sem a
 * separação entrada/saída, conta tudo como saída (pior caso). */
export function custoReais(g: ComTokens, t: TarifaIa): number | null {
  const usd =
    g.tokens_entrada != null && g.tokens_saida != null
      ? (g.tokens_entrada * t.usdPorMilhaoEntrada + g.tokens_saida * t.usdPorMilhaoSaida) / 1e6
      : g.tokens_total != null
        ? (g.tokens_total * t.usdPorMilhaoSaida) / 1e6
        : null;
  return usd == null ? null : usd * t.cambio;
}

export function formatarReais(v: number | null): string {
  if (v == null) return "—";
  // Geração custa centavos -- mostra 3 casas abaixo de R$ 1 pra não virar "R$ 0,00".
  const casas = v < 1 ? 3 : 2;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Soma o custo de todas as gerações do mês corrente (RLS: admin vê todas). */
export async function gastoDoMes(t: TarifaIa): Promise<{ total: number; quantidade: number }> {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from("mockup_geracoes")
    .select("tokens_entrada, tokens_saida, tokens_total")
    .gte("criado_em", inicio)
    .limit(20000);
  if (error) throw new Error(error.message);
  const linhas = (data || []) as ComTokens[];
  return { total: linhas.reduce((s, g) => s + (custoReais(g, t) ?? 0), 0), quantidade: linhas.length };
}
