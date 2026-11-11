import type { Calibrado } from "./fontes";
import { confiancaCalibrado } from "./fontes";
import { mediana, normalizar } from "./regras";

/* Calibração pelo histórico real de despachos.
   - Despacho de 1 SKU: vira amostra (vol por unidade e peso por unidade).
   - Valor calibrado = mediana das últimas 10 amostras VALIDADAS; amostras que
     fogem > 50% da mediana ficam fora (sugere revisão).
   - Despacho com vários SKUs: só para medir o erro do modelo. */

export const ULTIMAS_N = 10;
export const LIMITE_DESVIO = 0.5;

export type StatusDespacho = "pendente" | "validado" | "descartado";

export interface ItemDespacho {
  codigo_amigavel: string;
  codigo_composto?: string | null;
  qtd: number;
}

/** Estimativa do modelo gravada no momento do registro. */
export interface Estimativa {
  /** ocupação estimada da caixa usada (0–1+), soma dos volumes equivalentes ÷ volume da caixa. */
  ocupacao: number | null;
  pesoKg: number | null;
  volumes: number;
  fontes: Record<string, string | null>;
  completa: boolean;
}

export interface Despacho {
  id: number;
  data: string;
  referencia_pedido: string | null;
  caixa_larg_cm: number;
  caixa_alt_cm: number;
  caixa_comp_cm: number;
  ocupacao_pct: number;
  peso_real_kg: number;
  status: StatusDespacho;
  observacao: string | null;
  estimativa: Estimativa | null;
  criado_por_nome: string | null;
  criado_em: string;
  validado_por_nome: string | null;
  validado_em: string | null;
  itens: ItemDespacho[];
}

export interface Amostra {
  despachoId: number;
  data: string;
  codigo: string;
  volUn: number;
  pesoUnG: number | null;
}

/** Só despacho de 1 SKU vira amostra: vol_un = vol_caixa × ocupação ÷ qtd; peso_un = (peso − tara) ÷ qtd. */
export function amostraDe(d: Pick<Despacho, "id" | "data" | "caixa_larg_cm" | "caixa_alt_cm" | "caixa_comp_cm" | "ocupacao_pct" | "peso_real_kg" | "itens">, taraKg: number): Amostra | null {
  const codigos = new Set(d.itens.map((i) => i.codigo_amigavel));
  if (codigos.size !== 1) return null;
  const qtd = d.itens.reduce((s, i) => s + i.qtd, 0);
  if (!(qtd > 0)) return null;
  const volCaixa = d.caixa_larg_cm * d.caixa_alt_cm * d.caixa_comp_cm;
  const liquido = d.peso_real_kg - taraKg;
  return {
    despachoId: d.id,
    data: d.data,
    codigo: d.itens[0].codigo_amigavel,
    volUn: (volCaixa * (d.ocupacao_pct / 100)) / qtd,
    pesoUnG: liquido > 0 ? (liquido * 1000) / qtd : null,
  };
}

export interface Calibracao extends Calibrado {
  codigo: string;
  minVol: number;
  maxVol: number;
  minPeso: number | null;
  maxPeso: number | null;
  ultimaData: string;
  /** amostras usadas na mediana. */
  usadas: number[];
  /** amostras recentes que fugiram > 50% da mediana (sugerir revisão). */
  foraDaCurva: number[];
}

const desvio = (v: number, m: number) => Math.abs(v - m) / m;

export function calibrar(despachos: Despacho[], taraKg: number): Map<string, Calibracao> {
  const porCodigo = new Map<string, Amostra[]>();
  for (const d of despachos) {
    if (d.status !== "validado") continue;
    const a = amostraDe(d, taraKg);
    if (!a) continue;
    porCodigo.set(a.codigo, [...(porCodigo.get(a.codigo) ?? []), a]);
  }
  const out = new Map<string, Calibracao>();
  for (const [codigo, todas] of porCodigo) {
    const recentes = [...todas].sort((a, b) => b.data.localeCompare(a.data) || b.despachoId - a.despachoId).slice(0, ULTIMAS_N);
    const m0 = mediana(recentes.map((a) => a.volUn))!;
    const p0 = mediana(recentes.flatMap((a) => (a.pesoUnG ? [a.pesoUnG] : [])));
    const fora = recentes.filter((a) => desvio(a.volUn, m0) > LIMITE_DESVIO || (p0 && a.pesoUnG && desvio(a.pesoUnG, p0) > LIMITE_DESVIO));
    const usadas = recentes.filter((a) => !fora.includes(a));
    if (!usadas.length) continue;
    const vols = usadas.map((a) => a.volUn);
    const pesos = usadas.flatMap((a) => (a.pesoUnG ? [a.pesoUnG] : []));
    out.set(codigo, {
      codigo,
      volUn: mediana(vols),
      pesoUnG: mediana(pesos),
      n: usadas.length,
      minVol: Math.min(...vols),
      maxVol: Math.max(...vols),
      minPeso: pesos.length ? Math.min(...pesos) : null,
      maxPeso: pesos.length ? Math.max(...pesos) : null,
      ultimaData: usadas[0].data,
      usadas: usadas.map((a) => a.despachoId),
      foraDaCurva: fora.map((a) => a.despachoId),
    });
  }
  return out;
}

export { confiancaCalibrado };

/** Erro relativo (estimado − real) ÷ real. */
export const erroRel = (estimado: number | null | undefined, real: number) =>
  estimado === null || estimado === undefined || !(real > 0) ? null : (estimado - real) / real;

export interface ErroDespacho {
  id: number;
  volume: number | null;
  peso: number | null;
}

export function errosDoDespacho(d: Despacho): ErroDespacho {
  const e = d.estimativa;
  return {
    id: d.id,
    volume: e ? erroRel(e.ocupacao, d.ocupacao_pct / 100) : null,
    peso: e && e.completa ? erroRel(e.pesoKg, d.peso_real_kg) : null,
  };
}

export interface LinhaErro {
  chave: string;
  n: number;
  /** média do erro (com sinal: + = modelo superestima). */
  volMedio: number | null;
  volAbsMedio: number | null;
  pesoMedio: number | null;
  pesoAbsMedio: number | null;
}

/** Palavra-chave do produto = primeira palavra do nome (CANETA, MOCHILA, COPO…). */
export const palavraChave = (nome: string) => normalizar(nome).split(/[^A-Z0-9-]+/).find((w) => w.length > 1) ?? "OUTROS";

/** Erro médio agrupado (por produto ou por palavra-chave). Só despachos validados com estimativa. */
export function agruparErros(despachos: Despacho[], chaveDe: (d: Despacho) => string): LinhaErro[] {
  const grupos = new Map<string, ErroDespacho[]>();
  for (const d of despachos) {
    if (d.status !== "validado" || !d.estimativa) continue;
    const k = chaveDe(d);
    grupos.set(k, [...(grupos.get(k) ?? []), errosDoDespacho(d)]);
  }
  const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return [...grupos].map(([chave, es]) => {
    const v = es.flatMap((e) => (e.volume === null ? [] : [e.volume]));
    const p = es.flatMap((e) => (e.peso === null ? [] : [e.peso]));
    return {
      chave, n: es.length,
      volMedio: media(v), volAbsMedio: media(v.map(Math.abs)),
      pesoMedio: media(p), pesoAbsMedio: media(p.map(Math.abs)),
    };
  }).sort((a, b) => (b.volAbsMedio ?? 0) - (a.volAbsMedio ?? 0) || b.n - a.n);
}
