import type { Caixa } from "./calculo";
import type { Dims, MedidaResolvida } from "./fontes";
import { EPS } from "./regras";

/* Encaixe 3D ILUSTRATIVO de um volume: camadas (de baixo para cima), e em
   cada camada prateleiras 2D. Cada SKU testa as 6 orientações e fica com a
   que põe mais unidades. Não é o resultado oficial: o cálculo por volume
   (calculo.ts) continua valendo; isto serve para ver se faz sentido. */

export interface Forma {
  dims: Dims;
  /** true quando não há dimensões reais da unidade (só volume): paralelepípedo aproximado. */
  aproximada: boolean;
}

/** Forma da unidade para desenhar: dimensões reais ou um paralelepípedo
    com o volume efetivo e as proporções da caixa master (ou um cubo). */
export function formaParaDesenho(m: Pick<MedidaResolvida, "dims" | "proporcao" | "volEfetivoUn">): Forma | null {
  if (m.dims) return { dims: m.dims, aproximada: false };
  if (!m.volEfetivoUn) return null;
  const p = m.proporcao ?? [1, 1, 1];
  const k = Math.cbrt(m.volEfetivoUn / (p[0] * p[1] * p[2]));
  return { dims: [p[0] * k, p[1] * k, p[2] * k], aproximada: true };
}

export interface ItemEncaixe {
  id: string;
  qtd: number;
  dims: Dims;
}

/** Uma unidade posicionada: canto (x, y, z) e tamanho (w, h, d).
    x = largura da caixa, y = altura (vertical), z = comprimento. */
export interface Posicao {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
}

export interface ResultadoEncaixe {
  porItem: Map<string, Posicao[]>;
  colocadas: number;
  esperadas: number;
}

const ORIENTACOES = (d: Dims): [number, number, number][] => {
  const [a, b, c] = d;
  return [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
};

export function encaixar(itens: ItemEncaixe[], caixa: Caixa): ResultadoEncaixe {
  const L = caixa.largura, C = caixa.comprimento, A = caixa.altura;
  const porItem = new Map<string, Posicao[]>();
  let colocadas = 0;
  const esperadas = itens.reduce((s, i) => s + i.qtd, 0);

  // Estado: camada (yCamada, altura da camada), prateleira (zPrat, profundidade), cursor x
  let yCamada = 0, hCamada = 0;
  let zPrat = 0, dPrat = 0;
  let x = 0;
  let cheia = false;

  const ordenados = [...itens].sort((a, b) => b.dims[0] * b.dims[1] * b.dims[2] - a.dims[0] * a.dims[1] * a.dims[2]);
  for (const it of ordenados) {
    const lista: Posicao[] = [];
    porItem.set(it.id, lista);
    let resta = it.qtd;
    let ori: [number, number, number] | null = null; // [w, h, d]

    /** Melhor orientação para a camada atual (ou para encher o resto da caixa, se a camada estiver vazia). */
    const escolher = (): [number, number, number] | null => {
      const camadaVazia = hCamada === 0;
      let melhor: [number, number, number] | null = null;
      let melhorN = 0;
      for (const [w, h, d] of ORIENTACOES(it.dims)) {
        if (w > L + EPS || d > C + EPS) continue;
        if (camadaVazia ? yCamada + h > A + EPS : h > hCamada + EPS) continue;
        const porCamada = Math.floor(L / w + EPS) * Math.floor(C / d + EPS);
        const camadas = camadaVazia ? Math.floor((A - yCamada) / h + EPS) : 1;
        const n = porCamada * camadas;
        if (n > melhorN || (n === melhorN && melhor && h < melhor[1])) { melhor = [w, h, d]; melhorN = n; }
      }
      return melhor;
    };
    const novaCamada = () => { yCamada += hCamada; hCamada = 0; zPrat = 0; dPrat = 0; x = 0; };

    while (resta > 0 && !cheia) {
      if (!ori) {
        ori = escolher();
        if (!ori) {
          if (hCamada === 0) { cheia = true; break; } // não cabe nem numa camada nova
          novaCamada();
          continue;
        }
      }
      const [w, h, d] = ori;
      if (x + w > L + EPS) { zPrat += dPrat; dPrat = 0; x = 0; } // próxima prateleira
      if (zPrat + d > C + EPS) { novaCamada(); ori = null; continue; } // próxima camada
      if (hCamada === 0) {
        if (yCamada + h > A + EPS) { cheia = true; break; }
        hCamada = h;
      }
      lista.push({ x, y: yCamada, z: zPrat, w, h, d });
      x += w;
      dPrat = Math.max(dPrat, d);
      resta--;
      colocadas++;
    }
  }
  return { porItem, colocadas, esperadas };
}
