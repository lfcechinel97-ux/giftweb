/* Content stream de PDF: conversão de bytes, troca de cores pelo spot
   (mesmas regex de spot_layer() da referência em Python) e um tokenizador
   usado pelo interpretador geométrico da contração. */

export const bytesParaLatin1 = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  }
  return s;
};

export const latin1ParaBytes = (s: string): Uint8Array => {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
};

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)`;
const re = (src: string) => new RegExp(src, "g");

/** O que existe no stream e não é recolorido pelo método de troca de cor. */
export function avisosTrocaDeCor(conteudo: string): string[] {
  const avisos: string[] = [];
  if (/\bBI\b/.test(conteudo)) avisos.push("A logo tem imagem embutida (inline): essa parte não é recolorida na camada TOYO.");
  if (/\/\S+\s+sh\b/.test(conteudo)) avisos.push("A logo tem gradiente (shading): essa parte não é recolorida na camada TOYO.");
  if (/\/\S+\s+Do\b/.test(conteudo)) avisos.push("A logo tem objeto externo (imagem ou grupo): essa parte não é recolorida na camada TOYO.");
  return avisos;
}

/** Troca todas as cores do content stream pelo spot a 100% e liga o overprint. */
export function trocarCoresPorSpot(conteudo: string): string {
  let c = conteudo;
  // cores diretas -> spot (fill minúsculo, stroke maiúsculo)
  c = c.replace(re(String.raw`(?:${NUM}\s+){4}k\b`), "/CSspot cs 1 scn");
  c = c.replace(re(String.raw`(?:${NUM}\s+){4}K\b`), "/CSspot CS 1 SCN");
  c = c.replace(re(String.raw`(?:${NUM}\s+){3}rg\b`), "/CSspot cs 1 scn");
  c = c.replace(re(String.raw`(?:${NUM}\s+){3}RG\b`), "/CSspot CS 1 SCN");
  c = c.replace(re(String.raw`(?<![\w/.])${NUM}\s+g\b`), "/CSspot cs 1 scn");
  c = c.replace(re(String.raw`(?<![\w/.])${NUM}\s+G\b`), "/CSspot CS 1 SCN");
  // espaço de cor nomeado + valores
  c = c.replace(re(String.raw`/[^\s/\[\]<>()]+\s+cs\s+(?:${NUM}\s+)+scn?\b`), "/CSspot cs 1 scn");
  c = c.replace(re(String.raw`/[^\s/\[\]<>()]+\s+CS\s+(?:${NUM}\s+)+SCN?\b`), "/CSspot CS 1 SCN");
  // overprint: no início e depois de cada gs (que poderia desligar)
  c = c.replace(/(\/\S+\s+gs\b)/g, "$1 /GSop gs");
  return "/GSop gs\n/CSspot cs 1 scn\n/CSspot CS 1 SCN\n" + c;
}

/* ---------------------------------------------------------------- tokens */

export type Operando = number | string | { nome: string } | Operando[] | { dict: true };
export type Token = { op: string } | { valor: Operando };

const ESPACO = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set("()<>[]{}/%".split("").map((c) => c.charCodeAt(0)));
const ehRegular = (c: number) => !ESPACO.has(c) && !DELIM.has(c);

/**
 * Tokeniza um content stream. Strings e dicionários viram valores opacos
 * (o interpretador só precisa da geometria). Imagem inline (BI ... ID ... EI)
 * vira o operador "BI" com os dados pulados.
 */
export function* tokenizar(s: string): Generator<Token> {
  let i = 0;
  const n = s.length;
  const pilha: Operando[][] = [];
  const emitir = function* (v: Operando): Generator<Token> {
    if (pilha.length) pilha[pilha.length - 1].push(v);
    else yield { valor: v };
  };

  while (i < n) {
    const c = s.charCodeAt(i);
    if (ESPACO.has(c)) { i++; continue; }
    const ch = s[i];
    if (ch === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (ch === "[") { pilha.push([]); i++; continue; }
    if (ch === "]") {
      i++;
      const arr = pilha.pop();
      if (arr) yield* emitir(arr);
      continue;
    }
    if (ch === "(") {
      let prof = 1, j = i + 1;
      while (j < n && prof > 0) {
        const d = s[j];
        if (d === "\\") j += 2;
        else { if (d === "(") prof++; else if (d === ")") prof--; j++; }
      }
      yield* emitir(s.slice(i + 1, j - 1));
      i = j;
      continue;
    }
    if (ch === "<" && s[i + 1] === "<") {
      // dicionário (ex.: operandos de BDC): pula até o >> correspondente
      let prof = 0, j = i;
      while (j < n) {
        if (s[j] === "<" && s[j + 1] === "<") { prof++; j += 2; continue; }
        if (s[j] === ">" && s[j + 1] === ">") { prof--; j += 2; if (prof === 0) break; continue; }
        if (s[j] === "(") { let p = 1; j++; while (j < n && p > 0) { if (s[j] === "\\") j++; else if (s[j] === "(") p++; else if (s[j] === ")") p--; j++; } continue; }
        j++;
      }
      yield* emitir({ dict: true });
      i = j;
      continue;
    }
    if (ch === "<") {
      const j = s.indexOf(">", i);
      yield* emitir(s.slice(i + 1, j < 0 ? n : j));
      i = j < 0 ? n : j + 1;
      continue;
    }
    if (ch === "/") {
      let j = i + 1;
      while (j < n && ehRegular(s.charCodeAt(j))) j++;
      yield* emitir({ nome: s.slice(i + 1, j) });
      i = j;
      continue;
    }
    if (ch === ">" || ch === ")" || ch === "{" || ch === "}") { i++; continue; }
    let j = i;
    while (j < n && ehRegular(s.charCodeAt(j))) j++;
    const palavra = s.slice(i, j);
    i = j;
    if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(palavra)) { yield* emitir(Number(palavra)); continue; }
    if (palavra === "true" || palavra === "false" || palavra === "null") { yield* emitir(palavra); continue; }
    if (palavra === "BI") {
      // pula o dicionário e os dados binários da imagem inline até " EI"
      const id = s.indexOf("ID", i);
      let k = id < 0 ? n : id + 3;
      while (k < n) {
        const e = s.indexOf("EI", k);
        if (e < 0) { k = n; break; }
        const antes = s.charCodeAt(e - 1), depois = e + 2 < n ? s.charCodeAt(e + 2) : 32;
        if (ESPACO.has(antes) && (ESPACO.has(depois) || DELIM.has(depois))) { k = e + 2; break; }
        k = e + 2;
      }
      i = k;
      yield { op: "BI" };
      continue;
    }
    pilha.length = 0; // operador nunca fica dentro de array
    yield { op: palavra };
  }
}
