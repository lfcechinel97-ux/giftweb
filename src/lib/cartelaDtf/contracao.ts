/* Contração da camada TOYO: une todas as áreas pintadas da logo numa
   silhueta e aplica offset negativo (Clipper, juntas redondas). Tudo em
   coordenadas inteiras: 1 unidade = 0,0001 mm no tamanho final impresso. */

import type { ClipperLibWrapper, Path, Paths } from "js-angusj-clipper/web";
import { CM } from "./layout";
import { aplicar, escalaMaxima, type Clip, type Pintura, type Pt, type Traco } from "./geometria";

type Lib = typeof import("js-angusj-clipper/web");

let carregando: Promise<{ lib: Lib; clipper: ClipperLibWrapper }> | null = null;

/** Clipper (WebAssembly embutido no bundle, sem CDN) carregado sob demanda. */
export function carregarClipper() {
  if (!carregando) {
    carregando = import("js-angusj-clipper/web").then(async (lib) => ({
      lib,
      clipper: await lib.loadNativeClipperLibInstanceAsync(lib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback),
    }));
    carregando.catch(() => { carregando = null; });
  }
  return carregando;
}

/** Resolução interna: unidades inteiras por mm impresso. */
const UNIDADES_POR_MM = 10000;

export interface ResultadoContracao {
  /** Content stream da camada TOYO (sem o cabeçalho de cor/overprint). */
  caminhos: string;
  vazio: boolean;
  /** Partes mais finas que 2 × distância desapareceram. */
  perdeuPartesFinas: boolean;
  /** Área (mm²) antes e depois, para conferência. */
  areaOriginalMm2: number;
  areaContraidaMm2: number;
}

/**
 * @param escala fator da logo original para o tamanho impresso (pt/pt)
 * @param distanciaMm contração física, no tamanho impresso
 */
export async function contrairSilhueta(pinturas: Pintura[], escala: number, distanciaMm: number): Promise<ResultadoContracao> {
  const { lib, clipper } = await carregarClipper();
  const { ClipType, PolyFillType, JoinType, EndType } = lib;

  // espaço da página da logo -> inteiros
  const mmPorUnidade = (escala * 10) / CM;
  const S = mmPorUnidade * UNIDADES_POR_MM;
  const paraInt = (pts: Pt[]): Path => {
    const out: Path = [];
    for (const [x, y] of pts) {
      const p = { x: Math.round(x * S), y: Math.round(y * S) };
      const u = out[out.length - 1];
      if (!u || u.x !== p.x || u.y !== p.y) out.push(p);
    }
    if (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (a.x === b.x && a.y === b.y) out.pop();
    }
    return out;
  };
  const poligonosValidos = (ps: Paths) => ps.filter((p) => p.length >= 3 && Math.abs(clipper.area(p)) > 0.5);

  const uniao = (ps: Paths, fill = PolyFillType.NonZero): Paths => {
    const validos = poligonosValidos(ps);
    if (!validos.length) return [];
    return clipper.clipToPaths({ clipType: ClipType.Union, subjectFillType: fill, subjectInputs: [{ data: validos, closed: true }] });
  };
  const intersecao = (a: Paths, b: Paths): Paths => {
    const va = poligonosValidos(a), vb = poligonosValidos(b);
    if (!va.length || !vb.length) return [];
    return clipper.clipToPaths({
      clipType: ClipType.Intersection, subjectFillType: PolyFillType.NonZero,
      subjectInputs: [{ data: va, closed: true }], clipFillType: PolyFillType.NonZero, clipInputs: [{ data: vb }],
    });
  };
  const diferenca = (a: Paths, b: Paths): Paths => {
    const va = poligonosValidos(a), vb = poligonosValidos(b);
    if (!va.length) return [];
    if (!vb.length) return va;
    return clipper.clipToPaths({
      clipType: ClipType.Difference, subjectFillType: PolyFillType.NonZero,
      subjectInputs: [{ data: va, closed: true }], clipFillType: PolyFillType.NonZero, clipInputs: [{ data: vb }],
    });
  };
  const arcTol = 0.0005 * UNIDADES_POR_MM; // 0,0005 mm
  const offset = (ps: Paths, delta: number): Paths => {
    const validos = poligonosValidos(ps);
    if (!validos.length) return [];
    return clipper.offsetToPaths({
      delta, arcTolerance: arcTol,
      offsetInputs: [{ data: validos, joinType: JoinType.Round, endType: EndType.ClosedPolygon }],
    }) ?? [];
  };
  const areaMm2 = (ps: Paths) => ps.reduce((s, p) => s + clipper.area(p), 0) / (UNIDADES_POR_MM * UNIDADES_POR_MM);

  // clips: cada cadeia é calculada uma vez (as pinturas compartilham o array)
  const cacheClip = new Map<Clip[], Paths | null>();
  const regiaoClip = (clips: Clip[]): Paths | null => {
    if (!clips.length) return null;
    if (cacheClip.has(clips)) return cacheClip.get(clips)!;
    let r: Paths | null = null;
    for (const c of clips) {
      const area = uniao(c.subcaminhos.map(paraInt), c.evenOdd ? PolyFillType.EvenOdd : PolyFillType.NonZero);
      r = r === null ? area : intersecao(r, area);
    }
    cacheClip.set(clips, r);
    return r;
  };

  const areas: Paths = [];
  for (const p of pinturas) {
    let a = p.tipo === "preenchimento"
      ? uniao(p.subcaminhos.map(paraInt), p.evenOdd ? PolyFillType.EvenOdd : PolyFillType.NonZero)
      : contornoDoTraco(p, S, lib, clipper, poligonosValidos);
    const clip = regiaoClip(p.clips);
    if (clip) a = intersecao(a, clip);
    areas.push(...a);
  }

  const silhueta = uniao(areas);
  const D = distanciaMm * UNIDADES_POR_MM;
  const contraida = offset(silhueta, -D);

  // partes finas: o que a abertura (contrai e reexpande) não recupera. Cada
  // pedaço perdido conta se tiver área de peça de verdade (> 8·d², depois de
  // uma erosão leve que tira as lascas de arredondamento); ponta aguda de
  // canto perde só uns 2·d² e não dispara o aviso.
  const reaberta = offset(contraida, D);
  const perdido = offset(diferenca(silhueta, reaberta), -0.1 * D);
  const perdeuPartesFinas = perdido.some((p) => clipper.area(p) > 8 * D * D);

  let caminhos = "";
  const f = (v: number) => (v / S).toFixed(4).replace(/\.?0+$/, "") || "0";
  for (const p of contraida) {
    if (p.length < 3) continue;
    caminhos += `${f(p[0].x)} ${f(p[0].y)} m\n`;
    for (let i = 1; i < p.length; i++) caminhos += `${f(p[i].x)} ${f(p[i].y)} l\n`;
    caminhos += "h\n";
  }
  if (caminhos) caminhos += "f*\n";

  return {
    caminhos,
    vazio: contraida.length === 0,
    perdeuPartesFinas,
    areaOriginalMm2: areaMm2(silhueta),
    areaContraidaMm2: areaMm2(contraida),
  };
}

/** Converte um traço em área preenchida (offset de metade da espessura). */
function contornoDoTraco(t: Traco, S: number, lib: Lib, clipper: ClipperLibWrapper, validos: (p: Paths) => Paths): Paths {
  const { ClipType, PolyFillType, JoinType, EndType } = lib;
  // traça no espaço do usuário (onde a espessura é uniforme) e depois leva
  // o contorno para o espaço da página com a CTM: correto até para CTM não uniforme
  const Su = S * escalaMaxima(t.ctm);
  const meia = (t.largura / 2) * Su;
  const intPts = (pts: Pt[]): Path => {
    const out: Path = [];
    for (const [x, y] of pts) {
      const p = { x: Math.round(x * Su), y: Math.round(y * Su) };
      const u = out[out.length - 1];
      if (!u || u.x !== p.x || u.y !== p.y) out.push(p);
    }
    return out;
  };

  const resultado: Paths = [];
  for (const sub of t.subcaminhos) {
    let pts = intPts(sub.pts);
    if (sub.fechado && pts.length > 1) {
      const a = pts[0], b = pts[pts.length - 1];
      if (a.x === b.x && a.y === b.y) pts = pts.slice(0, -1);
    }
    if (pts.length === 1) {
      // subcaminho de um ponto só: com ponta redonda/quadrada desenha um ponto
      if (t.ponta === 0) continue;
    }
    if (t.juncao === 2) {
      resultado.push(...tracoChanfrado(pts, sub.fechado, meia, t.ponta, lib, clipper));
      continue;
    }
    const endType = sub.fechado && pts.length >= 3 ? EndType.ClosedLine
      : t.ponta === 1 ? EndType.OpenRound : t.ponta === 2 ? EndType.OpenSquare : EndType.OpenButt;
    const joinType = t.juncao === 1 ? JoinType.Round : JoinType.Miter;
    const r = clipper.offsetToPaths({
      delta: meia, arcTolerance: Math.max(1, 0.0005 * UNIDADES_POR_MM * (Su / S)),
      miterLimit: Math.max(2, t.limiteQuina),
      offsetInputs: [{ data: pts, joinType, endType }],
    });
    if (r) resultado.push(...r);
  }
  const unido = validos(resultado).length
    ? clipper.clipToPaths({ clipType: ClipType.Union, subjectFillType: PolyFillType.NonZero, subjectInputs: [{ data: validos(resultado), closed: true }] })
    : [];
  // volta para o espaço da página
  return unido.map((p) => p.map((q) => {
    const [x, y] = aplicar(t.ctm, [q.x / Su, q.y / Su]);
    return { x: Math.round(x * S), y: Math.round(y * S) };
  }));
}

/** Junta chanfrada (bevel): cada segmento vira um retângulo e cada vértice
 *  ganha os dois triângulos do chanfro. O Clipper não tem bevel nativo. */
function tracoChanfrado(pts: Path, fechado: boolean, meia: number, ponta: 0 | 1 | 2, lib: Lib, clipper: ClipperLibWrapper): Paths {
  const { JoinType, EndType } = lib;
  const out: Paths = [];
  const n = pts.length;
  if (n < 2) return out;
  const segs: [Path[number], Path[number]][] = [];
  for (let i = 0; i < n - 1; i++) segs.push([pts[i], pts[i + 1]]);
  if (fechado && n >= 3) segs.push([pts[n - 1], pts[0]]);
  const normal = (a: Path[number], b: Path[number]) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    return { x: (-dy / L) * meia, y: (dx / L) * meia };
  };
  for (const [a, b] of segs) {
    const nn = normal(a, b);
    out.push([
      { x: Math.round(a.x + nn.x), y: Math.round(a.y + nn.y) },
      { x: Math.round(b.x + nn.x), y: Math.round(b.y + nn.y) },
      { x: Math.round(b.x - nn.x), y: Math.round(b.y - nn.y) },
      { x: Math.round(a.x - nn.x), y: Math.round(a.y - nn.y) },
    ]);
  }
  const juntas = fechado && n >= 3 ? segs.length : segs.length - 1;
  for (let k = 0; k < juntas; k++) {
    const s1 = segs[k], s2 = segs[(k + 1) % segs.length];
    const v = s1[1], n1 = normal(s1[0], s1[1]), n2 = normal(s2[0], s2[1]);
    for (const sinal of [1, -1]) {
      out.push([
        v,
        { x: Math.round(v.x + sinal * n1.x), y: Math.round(v.y + sinal * n1.y) },
        { x: Math.round(v.x + sinal * n2.x), y: Math.round(v.y + sinal * n2.y) },
      ]);
    }
  }
  if (!fechado && ponta !== 0) {
    // pontas redondas/quadradas: só o trecho das extremidades
    const endType = ponta === 1 ? EndType.OpenRound : EndType.OpenSquare;
    for (const [p, q] of [[pts[0], pts[1]], [pts[n - 1], pts[n - 2]]] as const) {
      const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const passo = { x: Math.round(p.x + ((q.x - p.x) / L) * 2), y: Math.round(p.y + ((q.y - p.y) / L) * 2) };
      const r = clipper.offsetToPaths({
        delta: meia, arcTolerance: Math.max(1, meia / 1000),
        offsetInputs: [{ data: [p, passo], joinType: JoinType.Round, endType }],
      });
      if (r) out.push(...r);
    }
  }
  // orientações misturadas: normaliza cada peça para somar no NonZero
  return out.map((p) => (clipper.area(p) < 0 ? p.slice().reverse() : p));
}
