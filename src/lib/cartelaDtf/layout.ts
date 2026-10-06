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
 * Várias logos na mesma folha: cada logo forma um bloco com o seu próprio
 * grid (colunas pela largura dela) e o bloco seguinte começa embaixo, a um
 * espaçamento de distância. A largura da folha é a do bloco mais largo.
 * Com uma logo só, o resultado é idêntico ao da referência em Python.
 */
export function calcularLayoutCartela(itens: ItemLayout[], p: ParametrosFolha): LayoutCartela {
  if (!itens.length) throw new ErroCartela("Adicione pelo menos uma logo.");
  const G = p.espacoCm * CM;
  const M = p.margemCm * CM;

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
    const linhas = Math.ceil(it.qtd / cols);
    return { W, H, escala, cols, linhas, maxCols, qtd: it.qtd };
  });

  const larguraFolha = 2 * M + Math.max(...grids.map((g) => g.cols * g.W + (g.cols - 1) * G));
  const alturaBlocos = grids.map((g) => g.linhas * g.H + (g.linhas - 1) * G);
  const alturaFolha = 2 * M + alturaBlocos.reduce((a, b) => a + b, 0) + (grids.length - 1) * G;

  let topo = alturaFolha - M; // topo do bloco atual
  const out: LayoutItem[] = grids.map((g, k) => {
    const posicoes: { x: number; y: number }[] = [];
    for (let i = 0; i < g.qtd; i++) {
      const r = Math.floor(i / g.cols);
      const c = i % g.cols;
      posicoes.push({ x: M + c * (g.W + G), y: topo - g.H - r * (g.H + G) });
    }
    topo -= alturaBlocos[k] + G;
    return { W: g.W, H: g.H, escala: g.escala, cols: g.cols, linhas: g.linhas, maxCols: g.maxCols, posicoes };
  });
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
