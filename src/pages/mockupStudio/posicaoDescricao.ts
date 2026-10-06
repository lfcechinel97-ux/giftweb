import type { CaixaPosicao } from "./types";

/**
 * Descreve, em português, onde e de que tamanho a logo está -- em relação
 * ao PRODUTO (areaProduto) quando dá pra detectar, senão em relação à foto.
 * Vai SEMPRE no prompt fixo da geração final: a composição colada sozinha
 * não segura a IA, que reenquadra a cena e redesenha a logo grande no meio.
 * xPct/yPct já são o centro da logo.
 */
export function descreverPosicao(box: CaixaPosicao): string {
  const a = box.areaProduto;
  const largura = a ? a.x1Pct - a.x0Pct : 100;
  const altura = a ? a.y1Pct - a.y0Pct : 100;
  const rel = (v: number, ini: number, tam: number) => Math.min(100, Math.max(0, ((v - ini) / tam) * 100));
  const cx = rel(box.xPct, a?.x0Pct ?? 0, largura);
  const cy = rel(box.yPct, a?.y0Pct ?? 0, altura);
  const wRel = Math.round((box.wPct / largura) * 100);
  const hRel = Math.round((box.hPct / altura) * 100);

  const v = cy < 33 ? "na parte de cima" : cy > 66 ? "na parte de baixo" : "na altura do meio";
  const h = cx < 40 ? "deslocada para a esquerda" : cx > 60 ? "deslocada para a direita" : "centralizada na horizontal";
  const ref = a ? "do produto" : "da imagem";
  const tamanho = wRel <= 25 ? "pequena" : wRel <= 50 ? "média" : "grande";

  return (
    `${v} ${ref}, ${h} (centro da logo a ${Math.round(cy)}% da altura ${ref}, de cima pra baixo). ` +
    `Logo ${tamanho}: ocupa só ${wRel}% da largura e ${hRel}% da altura ${ref}`
  );
}

/** Largura da logo em % da largura do produto (ou da foto, sem areaProduto). */
export function larguraRelativa(box: CaixaPosicao): number {
  const a = box.areaProduto;
  return Math.round((box.wPct / (a ? a.x1Pct - a.x0Pct : 100)) * 100);
}
