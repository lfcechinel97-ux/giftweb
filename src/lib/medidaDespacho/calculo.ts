import type { Dims, MedidaResolvida } from "./fontes";
import { EPS } from "./regras";

/* Cálculo oficial dos volumes: por VOLUME efetivo e PESO (o 3D é só ilustração).
   Itens do maior para o menor; cada caixa recebe o que couber, de um ou mais
   SKUs, até acabar o volume (com o fator de aproveitamento) ou o peso. */

export interface Caixa {
  largura: number;
  altura: number;
  comprimento: number;
}

export interface ParamsCalculo {
  caixa: Caixa;
  pesoMaxKg: number;
  taraKg: number;
  /** kg/m³ (300 rodoviário, 167 aéreo). */
  fatorCubagem: number;
}

export interface ItemCalculo {
  id: string;
  rotulo: string;
  qtd: number;
  medida: Pick<MedidaResolvida, "volEquivalente" | "dims" | "pesoG">;
}

export interface ConteudoVolume {
  id: string;
  rotulo: string;
  qtd: number;
}

export interface Volume {
  numero: number;
  conteudo: ConteudoVolume[];
  /** soma dos volumes equivalentes (cm³). */
  volUsado: number;
  ocupacao: number;
  pesoRealKg: number;
  /** false quando algum item do volume está sem peso. */
  pesoCompleto: boolean;
  pesoCubadoKg: number;
  pesoTarifavelKg: number;
  /** só no último volume parcial: caixa com a altura reduzida. */
  sugestao: { caixa: Caixa; pesoCubadoKg: number } | null;
}

export interface ErroItem {
  id: string;
  texto: string;
}

export interface ResultadoCalculo {
  volumes: Volume[];
  erros: ErroItem[];
  /** itens sem medida (não entraram no cálculo). */
  pendentes: string[];
  semPeso: string[];
  totais: { volumes: number; pesoRealKg: number; pesoCubadoKg: number; pesoTarifavelKg: number; pesoCompleto: boolean };
}

export const LIMITE_VOLUMES = 5000;

export const volumeCaixa = (c: Caixa) => c.largura * c.altura * c.comprimento;
export const pesoCubado = (c: Caixa, fatorCubagem: number) => (volumeCaixa(c) / 1e6) * fatorCubagem;

/** O item (dimensões reais) cabe na caixa em alguma orientação? */
export function cabeNaCaixa(item: Dims, caixa: Caixa): boolean {
  const a = [...item].sort((x, y) => x - y);
  const b = [caixa.largura, caixa.altura, caixa.comprimento].sort((x, y) => x - y);
  return a.every((v, i) => v <= b[i] + EPS);
}

/** Altura reduzida para o último volume: proporcional à ocupação, de 5 em 5 cm, mínimo 10. */
export function alturaSugerida(alturaCaixa: number, ocupacao: number): number {
  const h = Math.max(10, Math.ceil((alturaCaixa * ocupacao - EPS) / 5) * 5);
  return Math.min(h, alturaCaixa);
}

export function calcularVolumes(itens: ItemCalculo[], p: ParamsCalculo): ResultadoCalculo {
  const erros: ErroItem[] = [];
  const pendentes: string[] = [];
  const semPeso: string[] = [];
  const volCaixa = volumeCaixa(p.caixa);
  const capPesoKg = p.pesoMaxKg - p.taraKg;
  const cubado = pesoCubado(p.caixa, p.fatorCubagem);

  const validos: { item: ItemCalculo; volEq: number; pesoKg: number | null }[] = [];
  for (const it of itens) {
    if (!(it.qtd > 0)) continue;
    const volEq = it.medida.volEquivalente;
    if (!volEq || volEq <= 0) { pendentes.push(it.id); continue; }
    const pesoKg = it.medida.pesoG && it.medida.pesoG > 0 ? it.medida.pesoG / 1000 : null;
    if (!pesoKg) semPeso.push(it.id);
    if (it.medida.dims && !cabeNaCaixa(it.medida.dims, p.caixa)) {
      erros.push({ id: it.id, texto: `${it.rotulo} não cabe na caixa informada.` });
      continue;
    }
    if (volEq > volCaixa + EPS) {
      erros.push({ id: it.id, texto: `${it.rotulo} não cabe na caixa informada (volume da unidade maior que o da caixa).` });
      continue;
    }
    if (pesoKg && pesoKg > capPesoKg + EPS) {
      erros.push({ id: it.id, texto: `${it.rotulo}: uma unidade pesa mais que o peso máximo por volume.` });
      continue;
    }
    validos.push({ item: it, volEq, pesoKg });
  }
  validos.sort((a, b) => b.volEq - a.volEq);

  const restante = validos.map((v) => v.item.qtd);
  const volumes: Volume[] = [];
  while (restante.some((r) => r > 0)) {
    if (volumes.length >= LIMITE_VOLUMES) {
      erros.push({ id: "", texto: `Mais de ${LIMITE_VOLUMES} volumes: confira as quantidades.` });
      break;
    }
    let remVol = volCaixa;
    let remPeso = capPesoKg;
    const conteudo: ConteudoVolume[] = [];
    let pesoKg = 0;
    let completo = true;
    for (let i = 0; i < validos.length; i++) {
      if (restante[i] <= 0) continue;
      const v = validos[i];
      const porVol = Math.floor(remVol / v.volEq + EPS);
      const porPeso = v.pesoKg ? Math.floor(remPeso / v.pesoKg + EPS) : Infinity;
      const n = Math.min(restante[i], porVol, porPeso);
      if (n <= 0) continue;
      conteudo.push({ id: v.item.id, rotulo: v.item.rotulo, qtd: n });
      restante[i] -= n;
      remVol -= n * v.volEq;
      if (v.pesoKg) { remPeso -= n * v.pesoKg; pesoKg += n * v.pesoKg; } else completo = false;
    }
    if (!conteudo.length) break; // não deveria acontecer (cada unidade cabe sozinha)
    const volUsado = volCaixa - remVol;
    const pesoReal = pesoKg + p.taraKg;
    volumes.push({
      numero: volumes.length + 1, conteudo, volUsado,
      ocupacao: Math.min(1, volUsado / volCaixa),
      pesoRealKg: pesoReal, pesoCompleto: completo,
      pesoCubadoKg: cubado, pesoTarifavelKg: Math.max(pesoReal, cubado), sugestao: null,
    });
  }

  const ultimo = volumes[volumes.length - 1];
  if (ultimo && volumes.length && ultimo.ocupacao < 1 - 1e-6) {
    const h = alturaSugerida(p.caixa.altura, ultimo.ocupacao);
    if (h < p.caixa.altura) {
      const caixa = { ...p.caixa, altura: h };
      ultimo.sugestao = { caixa, pesoCubadoKg: pesoCubado(caixa, p.fatorCubagem) };
    }
  }

  const soma = (f: (v: Volume) => number) => volumes.reduce((s, v) => s + f(v), 0);
  return {
    volumes, erros, pendentes, semPeso,
    totais: {
      volumes: volumes.length,
      pesoRealKg: soma((v) => v.pesoRealKg),
      pesoCubadoKg: soma((v) => v.pesoCubadoKg),
      pesoTarifavelKg: soma((v) => v.pesoTarifavelKg),
      pesoCompleto: volumes.every((v) => v.pesoCompleto),
    },
  };
}
