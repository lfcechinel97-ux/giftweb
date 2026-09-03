/**
 * Regra de preco por faixa de quantidade do catalogo de clientes.
 *
 * Vive fora das paginas de proposito: /catalogo-clientes e
 * /admin/catalogo-clientes precisam concordar sobre qual preco vale para qual
 * quantidade. Duplicar essa regra nos dois lados seria o caminho mais curto
 * para o admin mostrar um numero e o cliente ver outro.
 *
 * Aqui NAO existe multiplicador nem calculo de preco. Os valores sao lidos
 * como estao no Supabase (colunas preco_20 / preco_50 / preco_100), que e o
 * unico lugar onde eles moram. Este arquivo so decide QUAL dos valores
 * gravados se aplica a uma quantidade e como formata.
 */

/** Minimo de cada faixa. Uma quantidade pertence a maior faixa que ela alcanca. */
export const FAIXAS = [
  { min: 20, campo: "preco_20", rotulo: "20 un." },
  { min: 50, campo: "preco_50", rotulo: "50 un." },
  { min: 100, campo: "preco_100", rotulo: "100+ un." },
] as const;

export type CampoFaixa = (typeof FAIXAS)[number]["campo"];

/**
 * Os campos de faixa sao opcionais e nao apenas nullable: antes da migration
 * rodar, o select("*") volta sem eles. O codigo trata os dois casos igual.
 */
export interface ProdutoComPreco {
  preco: number | null;
  preco_20?: number | null;
  preco_50?: number | null;
  preco_100?: number | null;
}

export interface FaixaPreco {
  min: number;
  rotulo: string;
  valor: number;
  /** true na ultima faixa, a que recebe o destaque de melhor preco. */
  melhor: boolean;
}

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Devolve as tres faixas do produto, ou null quando ele nao esta configurado.
 *
 * Exige as tres preenchidas de proposito. Com uma ou duas, o card mostraria
 * celula vazia ou uma escada incompleta - pior do que cair no comportamento
 * antigo, que continua correto.
 */
export function faixasDoProduto(p: ProdutoComPreco): FaixaPreco[] | null {
  const valores = FAIXAS.map((f) => numero(p[f.campo]));
  if (valores.some((v) => v === null || v <= 0)) return null;
  return FAIXAS.map((f, i) => ({
    min: f.min,
    rotulo: f.rotulo,
    valor: valores[i] as number,
    melhor: i === FAIXAS.length - 1,
  }));
}

/**
 * Indice da faixa que vale para a quantidade, ou -1 abaixo da primeira faixa.
 * Abaixo de 20 un. nao existe preco de tabela - fica com o consultor.
 */
export function indiceDaFaixa(qtd: number): number {
  let idx = -1;
  FAIXAS.forEach((f, i) => {
    if (qtd >= f.min) idx = i;
  });
  return idx;
}

/** Preco unitario aplicavel a quantidade, ou null se nao ha faixa para ela. */
export function precoParaQtd(p: ProdutoComPreco, qtd: number): number | null {
  const faixas = faixasDoProduto(p);
  if (!faixas) return null;
  const i = indiceDaFaixa(qtd);
  return i < 0 ? null : faixas[i].valor;
}

/**
 * Simbolo e numero separados: dentro da celula de faixa o card desenha o "R$"
 * menor que o valor. Sem isso, um preco de tres digitos ("R$ 334,00") nao cabe
 * na coluna de ~49px que sobra em card de 2 colunas no celular.
 */
export const brlPartes = (v: number) => ({
  simbolo: "R$",
  valor: v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
});

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
