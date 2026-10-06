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

export interface ParametrosLayout {
  larguraCm: number;
  qtd: number;
  espacoCm: number;
  folhaMaxCm: number;
  margemCm: number;
  distribuicao: Distribuicao;
}

export interface Layout {
  /** Largura e altura de cada logo na folha (pt). */
  W: number;
  H: number;
  /** Fator de escala da logo original para o tamanho impresso. */
  escala: number;
  cols: number;
  linhas: number;
  maxCols: number;
  larguraFolha: number;
  alturaFolha: number;
  /** Canto inferior esquerdo de cada logo na folha (pt). */
  posicoes: { x: number; y: number }[];
}

/** Comprimento a partir do qual o PDF/RIP costuma dar problema. */
export const LIMITE_COMPRIMENTO_CM = 500;

export class ErroCartela extends Error {}

export function calcularLayout(caixa: CaixaLogo, p: ParametrosLayout): Layout {
  const W = p.larguraCm * CM;
  const escala = W / caixa.width;
  const H = caixa.height * escala;
  const G = p.espacoCm * CM;
  const M = p.margemCm * CM;
  const maxCols = Math.floor((p.folhaMaxCm * CM - 2 * M + G + 1e-6) / (W + G));
  if (maxCols < 1) throw new ErroCartela("A logo não cabe na largura da folha.");

  let cols: number;
  if (p.distribuicao === "encher") {
    cols = Math.min(maxCols, p.qtd);
  } else {
    const linhasMin = Math.ceil(p.qtd / maxCols);
    cols = Math.ceil(p.qtd / linhasMin);
  }
  const linhas = Math.ceil(p.qtd / cols);
  const larguraFolha = 2 * M + cols * W + (cols - 1) * G;
  const alturaFolha = 2 * M + linhas * H + (linhas - 1) * G;

  const posicoes: { x: number; y: number }[] = [];
  for (let i = 0; i < p.qtd; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    posicoes.push({ x: M + c * (W + G), y: alturaFolha - M - H - r * (H + G) });
  }
  return { W, H, escala, cols, linhas, maxCols, larguraFolha, alturaFolha, posicoes };
}

/** `cartela_{qtd}x_{largura}cm[_toyo].pdf` (largura como o `:g` do Python). */
export function nomeArquivo(qtd: number, larguraCm: number, toyo: boolean) {
  return `cartela_${qtd}x_${String(larguraCm)}cm${toyo ? "_toyo" : ""}.pdf`;
}

/** Aceita vírgula ou ponto decimal ("0,15" e "0.15"). Vazio ou inválido = NaN. */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}
