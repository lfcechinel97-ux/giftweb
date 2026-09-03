/**
 * Regra de preco por faixa de quantidade do catalogo de clientes.
 *
 * Vive fora das paginas de proposito: /catalogo-clientes e
 * /admin/catalogo-clientes precisam concordar sobre qual preco vale para qual
 * quantidade. Duplicar essa regra nos dois lados seria o caminho mais curto
 * para o admin mostrar um numero e o cliente ver outro.
 *
 * Aqui NAO existe multiplicador nem calculo de preco. Valores e quantidades
 * saem como estao no Supabase (faixa1..3_qtd / faixa1..3_preco), que e o unico
 * lugar onde eles moram. Este arquivo so decide QUAL degrau se aplica a uma
 * quantidade e como formata.
 */

/** Escada usada quando o produto nao tem quantidade propria gravada. */
export const QTD_PADRAO = [20, 50, 100] as const;

export const CAMPOS_FAIXA = [
  { qtd: "faixa1_qtd", preco: "faixa1_preco" },
  { qtd: "faixa2_qtd", preco: "faixa2_preco" },
  { qtd: "faixa3_qtd", preco: "faixa3_preco" },
] as const;

/**
 * Os campos sao opcionais e nao apenas nullable: antes da migration rodar, o
 * select("*") volta sem eles. O codigo trata os dois casos igual.
 *
 * preco_20/50/100 sao os nomes antigos das colunas de preco. Ficam aceitos so
 * para a janela entre o deploy e a migration rodar no Lovable Cloud, para o
 * card nao perder a escada nesse intervalo. Podem sair depois disso.
 */
export interface ProdutoComPreco {
  preco: number | null;
  faixa1_qtd?: number | null; faixa1_preco?: number | null;
  faixa2_qtd?: number | null; faixa2_preco?: number | null;
  faixa3_qtd?: number | null; faixa3_preco?: number | null;
  preco_20?: number | null; preco_50?: number | null; preco_100?: number | null;
}

export interface FaixaPreco {
  min: number;
  rotulo: string;
  valor: number;
  /** true no ultimo degrau, o que recebe o destaque de melhor preco. */
  melhor: boolean;
}

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const PRECOS_ANTIGOS = ["preco_20", "preco_50", "preco_100"] as const;

/**
 * Devolve os tres degraus do produto, ou null quando ele nao esta configurado.
 *
 * Exige os tres precos de proposito. Com um ou dois, o card mostraria celula
 * vazia ou uma escada incompleta - pior do que cair no comportamento antigo,
 * que continua correto. Tambem exige quantidade crescente: escada fora de
 * ordem seria pior que nao mostrar escada nenhuma.
 */
export function faixasDoProduto(p: ProdutoComPreco): FaixaPreco[] | null {
  const valores = CAMPOS_FAIXA.map(
    (c, i) => numero(p[c.preco]) ?? numero(p[PRECOS_ANTIGOS[i]]),
  );
  if (valores.some((v) => v === null || v <= 0)) return null;

  const qtds = CAMPOS_FAIXA.map((c, i) => numero(p[c.qtd]) ?? QTD_PADRAO[i]);
  if (qtds.some((q) => q === null || q < 1)) return null;
  if (!(qtds[0]! < qtds[1]! && qtds[1]! < qtds[2]!)) return null;

  return qtds.map((q, i) => ({
    min: q as number,
    // o ultimo degrau vale dali para cima, dai o "+"
    rotulo: i === qtds.length - 1 ? `${q}+ un.` : `${q} un.`,
    valor: valores[i] as number,
    melhor: i === qtds.length - 1,
  }));
}

/** Quantidade minima do produto: o primeiro degrau, ou 20 se nao houver escada. */
export function quantidadeInicial(p: ProdutoComPreco): number {
  return faixasDoProduto(p)?.[0].min ?? QTD_PADRAO[0];
}

/**
 * Passo do +/-. Produto de minimo alto (caneta, sacola) andaria de 5 em 5 a
 * partir de 100, o que sao 20 cliques ate o degrau seguinte.
 */
export function passoDaQuantidade(p: ProdutoComPreco): number {
  return quantidadeInicial(p) >= 100 ? 50 : 5;
}

/**
 * Indice do degrau que vale para a quantidade, ou -1 abaixo do primeiro.
 * Abaixo do minimo nao existe preco de tabela - fica com o consultor.
 */
export function indiceDaFaixa(faixas: FaixaPreco[], qtd: number): number {
  let idx = -1;
  faixas.forEach((f, i) => {
    if (qtd >= f.min) idx = i;
  });
  return idx;
}

/** Preco unitario aplicavel a quantidade, ou null se nao ha degrau para ela. */
export function precoParaQtd(p: ProdutoComPreco, qtd: number): number | null {
  const faixas = faixasDoProduto(p);
  if (!faixas) return null;
  const i = indiceDaFaixa(faixas, qtd);
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
