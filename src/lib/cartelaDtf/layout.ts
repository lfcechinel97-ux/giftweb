/* Cálculo do grid da cartela de DTF. Mesmas regras de
   scripts/carteladtf/gerar_cartela_dtf.py (referência em Python):
   unidade interna = ponto PDF, caixa da logo = MediaBox da página 1. */

export const CM = 72 / 2.54;

/** MediaBox da logo, com a origem real (PDFs do Corel costumam ter -1 -1). */
export interface CaixaLogo {
  left: number;
  bottom: number;
  width: number;
  height: number;
}

export type Distribuicao = "equilibrada" | "encher";

/** O que vale para a folha inteira. */
export interface ParametrosFolha {
  espacoCm: number;
  folhaMaxCm: number;
  margemCm: number;
  distribuicao: Distribuicao;
  /** Várias logos: a próxima aproveita a sobra da última linha da anterior
   *  (padrão). false = cada logo começa numa linha nova. */
  continuarNaLinha?: boolean;
}

export interface ParametrosLayout extends ParametrosFolha {
  larguraCm: number;
  qtd: number;
}

/** Uma logo da cartela: cada uma ocupa as suas linhas, uma embaixo da outra. */
export interface ItemLayout {
  caixa: CaixaLogo;
  larguraCm: number;
  qtd: number;
}

export interface LayoutItem {
  /** Largura e altura de cada logo na folha (pt). */
  W: number;
  H: number;
  /** Fator de escala da logo original para o tamanho impresso. */
  escala: number;
  cols: number;
  linhas: number;
  maxCols: number;
  /** Canto inferior esquerdo de cada logo na folha (pt). */
  posicoes: { x: number; y: number }[];
}

export interface LayoutCartela {
  larguraFolha: number;
  alturaFolha: number;
  itens: LayoutItem[];
}

/** Layout de uma logo só (formato da referência em Python). */
export type Layout = LayoutItem & { larguraFolha: number; alturaFolha: number };

/** Comprimento a partir do qual o PDF/RIP costuma dar problema. */
export const LIMITE_COMPRIMENTO_CM = 500;

export class ErroCartela extends Error {}

/**
 * Várias logos na mesma folha, em linhas da esquerda para a direita:
 * - cada logo tem o seu número de colunas (pela largura dela e pela
 *   distribuição) e enche as suas linhas com ele;
 * - com `continuarNaLinha` (padrão), a logo seguinte começa na sobra da
 *   última linha da anterior, enquanto couber na largura máxima da folha;
 *   senão começa numa linha nova;
 * - numa linha com logos de alturas diferentes, todas encostam no topo e a
 *   linha fica com a altura da maior.
 * A largura da folha é a da linha mais larga. Com uma logo só, o resultado é
 * idêntico ao da referência em Python.
 */
export function calcularLayoutCartela(itens: ItemLayout[], p: ParametrosFolha): LayoutCartela {
  if (!itens.length) throw new ErroCartela("Adicione pelo menos uma logo.");
  const G = p.espacoCm * CM;
  const M = p.margemCm * CM;
  const larguraUtil = p.folhaMaxCm * CM - 2 * M + 1e-6;
  const continuar = p.continuarNaLinha !== false;

  const grids = itens.map((it, i) => {
    const W = it.larguraCm * CM;
    const escala = W / it.caixa.width;
    const H = it.caixa.height * escala;
    const maxCols = Math.floor((p.folhaMaxCm * CM - 2 * M + G + 1e-6) / (W + G));
    if (maxCols < 1) {
      throw new ErroCartela(itens.length > 1 ? `A logo ${i + 1} não cabe na largura da folha.` : "A logo não cabe na largura da folha.");
    }
    let cols: number;
    if (p.distribuicao === "encher") {
      cols = Math.min(maxCols, it.qtd);
    } else {
      const linhasMin = Math.ceil(it.qtd / maxCols);
      cols = Math.ceil(it.qtd / linhasMin);
    }
    return { W, H, escala, cols, maxCols, qtd: it.qtd };
  });

  // monta as linhas: cada cópia guarda a linha e o x (a partir da margem)
  interface Linha { fim: number; altura: number; porItem: Map<number, number> }
  const linhas: Linha[] = [];
  const colocadas: { linha: number; x: number }[][] = grids.map(() => []);
  const novaLinha = () => { linhas.push({ fim: 0, altura: 0, porItem: new Map() }); };
  grids.forEach((g, k) => {
    if (!linhas.length || (!continuar && k > 0)) novaLinha();
    for (let i = 0; i < g.qtd; i++) {
      let L = linhas[linhas.length - 1];
      const vazia = L.altura === 0;
      const x = vazia ? 0 : L.fim + G;
      const nestaLinha = L.porItem.get(k) ?? 0;
      if (!vazia && (nestaLinha >= g.cols || x + g.W > larguraUtil)) {
        novaLinha();
        L = linhas[linhas.length - 1];
      }
      const xi = L.altura === 0 ? 0 : L.fim + G;
      colocadas[k].push({ linha: linhas.length - 1, x: xi });
      L.fim = xi + g.W;
      L.altura = Math.max(L.altura, g.H);
      L.porItem.set(k, (L.porItem.get(k) ?? 0) + 1);
    }
  });

  const larguraFolha = 2 * M + Math.max(...linhas.map((l) => l.fim));
  const alturaFolha = 2 * M + linhas.reduce((a, l) => a + l.altura, 0) + (linhas.length - 1) * G;
  const topos: number[] = [];
  let topo = alturaFolha - M;
  for (const l of linhas) { topos.push(topo); topo -= l.altura + G; }

  const out: LayoutItem[] = grids.map((g, k) => ({
    W: g.W, H: g.H, escala: g.escala, cols: g.cols, maxCols: g.maxCols,
    linhas: new Set(colocadas[k].map((c) => c.linha)).size,
    posicoes: colocadas[k].map((c) => ({ x: M + c.x, y: topos[c.linha] - g.H })),
  }));
  return { larguraFolha, alturaFolha, itens: out };
}

export function calcularLayout(caixa: CaixaLogo, p: ParametrosLayout): Layout {
  const L = calcularLayoutCartela([{ caixa, larguraCm: p.larguraCm, qtd: p.qtd }], p);
  return { ...L.itens[0], larguraFolha: L.larguraFolha, alturaFolha: L.alturaFolha };
}

/** `cartela_{qtd}x_{largura}cm[_toyo].pdf` (largura como o `:g` do Python).
 *  Com várias logos: `cartela_{qtdTotal}x_{n}logos[_toyo].pdf`. */
export function nomeArquivo(qtd: number, larguraCm: number, toyo: boolean, logos = 1) {
  const meio = logos > 1 ? `${logos}logos` : `${String(larguraCm)}cm`;
  return `cartela_${qtd}x_${meio}${toyo ? "_toyo" : ""}.pdf`;
}

/** Aceita vírgula ou ponto decimal ("0,15" e "0.15"). Vazio ou inválido = NaN. */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}
