export function getMarkup(precoCusto: number): number {
  if (precoCusto <= 1.0) return 6.0;
  if (precoCusto <= 3.0) return 4.8;
  if (precoCusto <= 8.0) return 3.8;
  if (precoCusto <= 15.0) return 3.0;
  if (precoCusto <= 25.0) return 2.5;
  if (precoCusto <= 40.0) return 2.1;
  if (precoCusto <= 70.0) return 1.8;
  return 1.6;
}

export function getDesconto(quantidade: number): number {
  if (quantidade >= 1000) return 0.16;
  if (quantidade >= 500) return 0.12;
  if (quantidade >= 300) return 0.09;
  if (quantidade >= 200) return 0.07;
  if (quantidade >= 100) return 0.04;
  return 0;
}

export function calcularPreco(precoCusto: number, quantidade: number): number {
  const precoBase = precoCusto * getMarkup(precoCusto);
  return precoBase * (1 - getDesconto(quantidade));
}

export function getPrecoMinimo(precoCusto: number): number {
  return calcularPreco(precoCusto, 1000);
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const VOLUME_TIERS = [20, 50, 100, 200, 300, 500, 1000] as const;

/**
 * Calcula o multiplicador efetivo para uma quantidade específica
 * Multiplicador = markup_base * (1 - desconto_volume)
 */
export function getMultiplierForQty(precoCusto: number, qty: number): number {
  return getMarkup(precoCusto) * (1 - getDesconto(qty));
}

/**
 * Lê multiplicador customizado da tabela_precos (jsonb).
 * Suporta dois formatos:
 *  - [{qty, multiplicador}] (novo)
 *  - [{quantidade, desconto}] (legado — converte para multiplicador)
 */
export function getCustomMultiplier(
  tabelaPrecos: any,
  precoCusto: number,
  qty: number
): number | null {
  if (!Array.isArray(tabelaPrecos)) return null;
  const toNum = (v: any): number | null => {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      return isFinite(n) ? n : null;
    }
    return null;
  };
  for (const row of tabelaPrecos) {
    if (!row || typeof row !== 'object') continue;
    const rowQty = toNum(row.qty ?? row.quantidade);
    if (rowQty !== qty) continue;
    const mult = toNum(row.multiplicador);
    if (mult != null && mult > 0) return mult;
    const desc = toNum(row.desconto);
    if (desc != null) {
      const m = getMarkup(precoCusto) * (1 - desc);
      if (m > 0) return m;
    }
  }
  return null;
}

/**
 * Normaliza a tabela de preços do produto retornando rows válidas.
 * Suporta formatos `{qty, multiplicador}` e `{quantidade, desconto}`,
 * valores em string ou número, e descarta linhas inválidas.
 * Se nada válido existir, retorna null para usar o fallback padrão.
 */
export interface PriceRow {
  qty: number;
  unit: number;
  base: number;
  desc: number;
  /** Desconto fracional comparado ao preço unitário da primeira faixa (menor qty). 0 para a primeira faixa. */
  descVsFirst: number;
}

/** Formata uma fração (0.0263) como percentual pt-BR com 2 casas decimais ("2,63%"). */
export function formatPercent2(frac: number): string {
  return (
    (frac * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  );
}

export function getNormalizedPriceRows(
  tabelaPrecos: any,
  precoCusto: number
): PriceRow[] | null {
  if (!precoCusto || precoCusto <= 0) return null;
  if (!Array.isArray(tabelaPrecos) || tabelaPrecos.length === 0) return null;
  const markup = getMarkup(precoCusto);
  const base = precoCusto * markup;
  const rows: PriceRow[] = [];
  for (const r of tabelaPrecos) {
    if (!r || typeof r !== 'object') continue;
    const qtyRaw = (r as any).qty ?? (r as any).quantidade;
    const qty = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw), 10);
    if (!qty || !isFinite(qty) || qty <= 0) continue;
    const mult = getCustomMultiplier([r], precoCusto, qty);
    if (mult == null || !isFinite(mult) || mult <= 0) continue;
    const unit = precoCusto * mult;
    if (!isFinite(unit) || unit <= 0) continue;
    const desc = Math.max(0, 1 - mult / markup);
    rows.push({ qty, unit, base, desc, descVsFirst: 0 });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.qty - b.qty);
  const firstUnit = rows[0].unit;
  for (const r of rows) {
    r.descVsFirst = firstUnit > 0 ? Math.max(0, 1 - r.unit / firstUnit) : 0;
  }
  return rows;
}

/**
 * Calcula o preço unitário para uma quantidade levando em conta a tabela
 * customizada (se válida) ou caindo no cálculo padrão. Nunca retorna NaN.
 */
export function getEffectiveUnitPrice(
  tabelaPrecos: any,
  precoCusto: number,
  qty: number
): number {
  if (!precoCusto || precoCusto <= 0) return 0;
  const rows = getNormalizedPriceRows(tabelaPrecos, precoCusto);
  if (rows && rows.length) {
    // pega a maior faixa <= qty; se qty < menor faixa, usa a menor
    let chosen = rows[0];
    for (const r of rows) {
      if (r.qty <= qty) chosen = r;
    }
    return chosen.unit;
  }
  return calcularPreco(precoCusto, qty);
}

/**
 * Menor preço unitário disponível para um produto (usado em "A partir de").
 */
export function getEffectiveMinPrice(tabelaPrecos: any, precoCusto: number): number {
  if (!precoCusto || precoCusto <= 0) return 0;
  const rows = getNormalizedPriceRows(tabelaPrecos, precoCusto);
  if (rows && rows.length) {
    return Math.min(...rows.map(r => r.unit));
  }
  return getPrecoMinimo(precoCusto);
}
