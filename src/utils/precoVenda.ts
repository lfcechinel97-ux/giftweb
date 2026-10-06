import { getDesconto, type PriceRow } from "./price";

/**
 * Preço de venda pro site público, a partir do que o banco já calculou
 * (preco_base e preco_faixas -- ver migration preco_venda_calculado_no_banco).
 * O site não recebe mais custo nem multiplicador. Cada função aqui devolve
 * exatamente o mesmo número que a versão antiga baseada em custo:
 *   precoUnitario  = getEffectiveUnitPrice
 *   precoMinimo    = getEffectiveMinPrice
 *   linhasDePreco  = getNormalizedPriceRows (ou a tabela padrão)
 */
export interface FaixaPreco { qty: number; unit: number; desc: number }

export interface PrecoVenda {
  preco_base?: number | null;
  preco_faixas?: unknown;
}

function faixas(p: PrecoVenda): FaixaPreco[] | null {
  const f = p.preco_faixas;
  return Array.isArray(f) && f.length ? (f as FaixaPreco[]) : null;
}

export function temPreco(p: PrecoVenda | null | undefined): boolean {
  return !!p && typeof p.preco_base === "number" && p.preco_base > 0;
}

export function precoUnitario(p: PrecoVenda | null | undefined, qty: number): number {
  if (!p || !temPreco(p)) return 0;
  const rows = faixas(p);
  if (rows) {
    let escolhida = rows[0];
    for (const r of rows) if (r.qty <= qty) escolhida = r;
    return escolhida.unit;
  }
  return (p.preco_base as number) * (1 - getDesconto(qty));
}

/** Fórmula padrão ignorando a tabela customizada (= calcularPreco antigo). */
export function precoPadrao(p: PrecoVenda | null | undefined, qty: number): number {
  if (!p || !temPreco(p)) return 0;
  return (p.preco_base as number) * (1 - getDesconto(qty));
}

export function precoMinimo(p: PrecoVenda | null | undefined): number {
  if (!p || !temPreco(p)) return 0;
  const rows = faixas(p);
  if (rows) return Math.min(...rows.map((r) => r.unit));
  return (p.preco_base as number) * (1 - getDesconto(1000));
}

/** Linhas da tabela de preços da página de produto. */
export function linhasDePreco(p: PrecoVenda | null | undefined, quantidadesPadrao: readonly number[]): PriceRow[] {
  if (!p || !temPreco(p)) return [];
  const base = p.preco_base as number;
  const custom = faixas(p);
  const rows: PriceRow[] = custom
    ? custom.map((r) => ({ qty: r.qty, unit: r.unit, base, desc: r.desc, descVsFirst: 0 }))
    : quantidadesPadrao.map((q) => ({ qty: q, unit: base * (1 - getDesconto(q)), base, desc: getDesconto(q), descVsFirst: 0 }));
  const firstUnit = rows[0]?.unit ?? 0;
  return rows.map((r) => ({ ...r, descVsFirst: firstUnit > 0 ? Math.max(0, 1 - r.unit / firstUnit) : 0 }));
}
