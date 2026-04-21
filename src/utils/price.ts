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

export const VOLUME_TIERS = [20, 50, 100, 200, 500, 1000] as const;

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
  for (const row of tabelaPrecos) {
    if (row?.qty === qty && typeof row.multiplicador === 'number') {
      return row.multiplicador;
    }
    if (row?.quantidade === qty && typeof row.desconto === 'number') {
      return getMarkup(precoCusto) * (1 - row.desconto);
    }
  }
  return null;
}
