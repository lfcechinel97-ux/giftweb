/* Mini interpretador de content stream: extrai as áreas pintadas da logo
   (preenchimentos e traços), com matriz (cm, q/Q), clip (W/W*) e Form
   XObjects aninhados. Curvas Bézier são achatadas em polilinhas. Cores são
   ignoradas: na camada TOYO tudo vira o mesmo spot, só a silhueta importa. */

import { tokenizar, type Operando } from "./conteudoPdf";

export type Pt = [number, number];
export type Matriz = [number, number, number, number, number, number];

const IDENT: Matriz = [1, 0, 0, 1, 0, 0];

/** m1 × m2 (convenção do PDF: ponto linha × matriz). */
export const multiplicar = (a: Matriz, b: Matriz): Matriz => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

export const aplicar = (m: Matriz, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Maior fator de escala da parte linear da matriz (norma espectral). */
export const escalaMaxima = (m: Matriz) => {
  const [a, b, c, d] = m;
  const s1 = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  return Math.sqrt((s1 + Math.sqrt(Math.max(0, s1 * s1 - 4 * det * det))) / 2) || 1;
};

export interface Subcaminho {
  pts: Pt[];
  fechado: boolean;
}

/** Região de clip: subcaminhos já no espaço da página. */
export interface Clip {
  subcaminhos: Pt[][];
  evenOdd: boolean;
}

export interface Preenchimento {
  tipo: "preenchimento";
  /** Espaço da página (já com a CTM aplicada). */
  subcaminhos: Pt[][];
  evenOdd: boolean;
  clips: Clip[];
}

export interface Traco {
  tipo: "traco";
  /** Espaço do usuário; `ctm` leva para o espaço da página. */
  subcaminhos: Subcaminho[];
  ctm: Matriz;
  largura: number;
  ponta: 0 | 1 | 2;
  juncao: 0 | 1 | 2;
  limiteQuina: number;
  clips: Clip[];
}

export type Pintura = Preenchimento | Traco;

export interface ExtGState {
  LW?: number;
  LC?: number;
  LJ?: number;
  ML?: number;
  tracejado?: boolean;
}

export type XObject =
  | { tipo: "form"; conteudo: string; matriz: Matriz; bbox: [number, number, number, number] | null; recursos: Recursos }
  | { tipo: "imagem" }
  | null;

/** Acesso aos recursos da página (implementado sobre o pdf-lib em gerarCartela.ts). */
export interface Recursos {
  xobject(nome: string): XObject;
  extgstate(nome: string): ExtGState | null;
}

export interface ResultadoGeometria {
  pinturas: Pintura[];
  temTexto: boolean;
  temImagem: boolean;
  temGradiente: boolean;
  temTracejado: boolean;
}

/* --------------------------------------------------------- Bézier */

/** Número de segmentos pela fórmula de Wang para cúbicas. */
function segmentosCubica(p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number) {
  const ax = p0[0] - 2 * p1[0] + p2[0], ay = p0[1] - 2 * p1[1] + p2[1];
  const bx = p1[0] - 2 * p2[0] + p3[0], by = p1[1] - 2 * p2[1] + p3[1];
  const M = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
  return Math.min(4096, Math.max(1, Math.ceil(Math.sqrt((0.75 * M) / tol))));
}

export function achatarCubica(p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number, saida: Pt[]) {
  const n = segmentosCubica(p0, p1, p2, p3, tol);
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    saida.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
}

/* ---------------------------------------------------------- estado */

interface Estado {
  ctm: Matriz;
  largura: number;
  ponta: 0 | 1 | 2;
  juncao: 0 | 1 | 2;
  limiteQuina: number;
  tracejado: boolean;
  clips: Clip[];
}

const num = (v: Operando | undefined) => (typeof v === "number" ? v : 0);

/**
 * Interpreta o content stream e devolve as pinturas.
 * `tolerancia` é a tolerância de achatamento no espaço da página.
 */
export function interpretar(conteudo: string, recursos: Recursos, tolerancia: number): ResultadoGeometria {
  const res: ResultadoGeometria = { pinturas: [], temTexto: false, temImagem: false, temGradiente: false, temTracejado: false };
  executar(conteudo, recursos, tolerancia, {
    ctm: IDENT, largura: 1, ponta: 0, juncao: 0, limiteQuina: 10, tracejado: false, clips: [],
  }, res, 0);
  return res;
}

function executar(conteudo: string, recursos: Recursos, tolerancia: number, inicial: Estado, res: ResultadoGeometria, profundidade: number) {
  let g: Estado = { ...inicial };
  const pilhaEstados: Estado[] = [];
  let ops: Operando[] = [];
  let caminho: Subcaminho[] = [];
  let atual: Subcaminho | null = null;
  let pontoAtual: Pt = [0, 0];
  let inicioSub: Pt = [0, 0];
  let clipPendente: boolean | null = null; // evenOdd do W/W* esperando o operador de pintura
  let dentroTexto = false;

  // tolerância no espaço do usuário (achatamos antes de aplicar a CTM)
  const tolUsuario = () => tolerancia / escalaMaxima(g.ctm);

  const novoSub = (p: Pt) => {
    atual = { pts: [p], fechado: false };
    caminho.push(atual);
    pontoAtual = p;
    inicioSub = p;
  };
  const linhaPara = (p: Pt) => {
    if (!atual) novoSub(pontoAtual);
    atual!.pts.push(p);
    pontoAtual = p;
  };
  const curvaPara = (p1: Pt, p2: Pt, p3: Pt) => {
    if (!atual) novoSub(pontoAtual);
    achatarCubica(pontoAtual, p1, p2, p3, tolUsuario(), atual!.pts);
    pontoAtual = p3;
  };
  const fechar = () => {
    if (atual) {
      atual.fechado = true;
      // depois do h o ponto atual volta ao início; um l seguinte abre outro subcaminho
      pontoAtual = inicioSub;
      atual = null;
    }
  };
  const noEspacoDaPagina = (subs: Subcaminho[]) =>
    subs.filter((s) => s.pts.length > 0).map((s) => s.pts.map((p) => aplicar(g.ctm, p)));

  const preencher = (evenOdd: boolean) => {
    const subs = noEspacoDaPagina(caminho).filter((s) => s.length >= 3);
    if (subs.length) res.pinturas.push({ tipo: "preenchimento", subcaminhos: subs, evenOdd, clips: g.clips });
  };
  const tracar = () => {
    if (g.largura <= 0) return; // linha "mais fina possível": sem área física
    if (g.tracejado) res.temTracejado = true;
    const subs = caminho.filter((s) => s.pts.length > 0).map((s) => ({ pts: s.pts.slice(), fechado: s.fechado }));
    if (subs.length) {
      res.pinturas.push({
        tipo: "traco", subcaminhos: subs, ctm: g.ctm, largura: g.largura,
        ponta: g.ponta, juncao: g.juncao, limiteQuina: g.limiteQuina, clips: g.clips,
      });
    }
  };
  const terminarCaminho = () => {
    if (clipPendente !== null) {
      const subs = noEspacoDaPagina(caminho);
      g.clips = [...g.clips, { subcaminhos: subs, evenOdd: clipPendente }];
      clipPendente = null;
    }
    caminho = [];
    atual = null;
  };

  for (const t of tokenizar(conteudo)) {
    if ("valor" in t) { ops.push(t.valor); continue; }
    const op = t.op;
    const a = ops;
    ops = [];

    if (dentroTexto) {
      if (op === "ET") dentroTexto = false;
      continue;
    }

    switch (op) {
      // estado gráfico
      case "q": pilhaEstados.push({ ...g }); break;
      case "Q": if (pilhaEstados.length) g = pilhaEstados.pop()!; break;
      case "cm":
        if (a.length >= 6) g.ctm = multiplicar(a.slice(-6).map(num) as Matriz, g.ctm);
        break;
      case "w": g.largura = num(a[0]); break;
      case "J": g.ponta = (Math.round(num(a[0])) as 0 | 1 | 2) ?? 0; break;
      case "j": g.juncao = (Math.round(num(a[0])) as 0 | 1 | 2) ?? 0; break;
      case "M": g.limiteQuina = num(a[0]) || 10; break;
      case "d": {
        const arr = a[0];
        g.tracejado = Array.isArray(arr) && arr.some((v) => typeof v === "number" && v > 0);
        break;
      }
      case "gs": {
        const nome = a[0] && typeof a[0] === "object" && "nome" in a[0] ? a[0].nome : null;
        const e = nome ? recursos.extgstate(nome) : null;
        if (e) {
          if (e.LW !== undefined) g.largura = e.LW;
          if (e.LC !== undefined) g.ponta = e.LC as 0 | 1 | 2;
          if (e.LJ !== undefined) g.juncao = e.LJ as 0 | 1 | 2;
          if (e.ML !== undefined) g.limiteQuina = e.ML;
          if (e.tracejado !== undefined) g.tracejado = e.tracejado;
        }
        break;
      }

      // construção de caminho
      case "m": novoSub([num(a[0]), num(a[1])]); break;
      case "l": linhaPara([num(a[0]), num(a[1])]); break;
      case "c": curvaPara([num(a[0]), num(a[1])], [num(a[2]), num(a[3])], [num(a[4]), num(a[5])]); break;
      case "v": curvaPara(pontoAtual, [num(a[0]), num(a[1])], [num(a[2]), num(a[3])]); break;
      case "y": {
        const p3: Pt = [num(a[2]), num(a[3])];
        curvaPara([num(a[0]), num(a[1])], p3, p3);
        break;
      }
      case "h": fechar(); break;
      case "re": {
        const [x, y, w, h] = [num(a[0]), num(a[1]), num(a[2]), num(a[3])];
        novoSub([x, y]);
        linhaPara([x + w, y]);
        linhaPara([x + w, y + h]);
        linhaPara([x, y + h]);
        fechar();
        break;
      }

      // pintura
      case "f": case "F": preencher(false); terminarCaminho(); break;
      case "f*": preencher(true); terminarCaminho(); break;
      case "S": tracar(); terminarCaminho(); break;
      case "s": fechar(); tracar(); terminarCaminho(); break;
      case "B": preencher(false); tracar(); terminarCaminho(); break;
      case "B*": preencher(true); tracar(); terminarCaminho(); break;
      case "b": fechar(); preencher(false); tracar(); terminarCaminho(); break;
      case "b*": fechar(); preencher(true); tracar(); terminarCaminho(); break;
      case "n": terminarCaminho(); break;
      case "W": clipPendente = false; break;
      case "W*": clipPendente = true; break;

      // o que não entra na contração
      case "BT": dentroTexto = true; res.temTexto = true; break;
      case "BI": res.temImagem = true; break;
      case "sh": res.temGradiente = true; break;
      case "Do": {
        const nome = a[0] && typeof a[0] === "object" && "nome" in a[0] ? a[0].nome : null;
        const x = nome ? recursos.xobject(nome) : null;
        if (!x) break;
        if (x.tipo === "imagem") { res.temImagem = true; break; }
        if (profundidade >= 12) break;
        const ctm = multiplicar(x.matriz, g.ctm);
        let clips = g.clips;
        if (x.bbox) {
          const [x0, y0, x1, y1] = x.bbox;
          const caixa = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]).map((p) => aplicar(ctm, p));
          clips = [...clips, { subcaminhos: [caixa], evenOdd: false }];
        }
        executar(x.conteudo, x.recursos, tolerancia, { ...g, ctm, clips }, res, profundidade + 1);
        break;
      }
      default:
        break;
    }
  }
}
