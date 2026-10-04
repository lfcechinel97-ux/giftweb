import type { CaixaPosicao } from "./types";

/**
 * Converte a posição/tamanho do box (em %) numa frase curta em português,
 * usada no prompt da IA -- grade 3x3 simples a partir do centro do box.
 */
export function descreverPosicao(box: CaixaPosicao): string {
  const cx = box.xPct + box.wPct / 2;
  const cy = box.yPct + box.hPct / 2;

  const v = cy < 33 ? "topo" : cy > 66 ? "base" : "meio";
  const h = cx < 33 ? "esquerda" : cx > 66 ? "direita" : "centro";

  const FRASES: Record<string, string> = {
    "topo-esquerda": "no canto superior esquerdo",
    "topo-centro": "na parte superior, centralizada horizontalmente",
    "topo-direita": "no canto superior direito",
    "meio-esquerda": "no meio, deslocada para a esquerda",
    "meio-centro": "centralizada no meio do produto",
    "meio-direita": "no meio, deslocada para a direita",
    "base-esquerda": "no canto inferior esquerdo",
    "base-centro": "na parte inferior, centralizada horizontalmente",
    "base-direita": "no canto inferior direito",
  };
  return FRASES[`${v}-${h}`];
}
