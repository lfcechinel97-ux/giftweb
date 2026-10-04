import type { CaixaPosicao, Tecnica } from "./types";

/**
 * Aplica a logo no cenário 100% local (canvas), sem IA. Modelo generativo
 * REDESENHA a logo (troca texto, puxa brasão "oficial" da memória, ignora
 * rotação); aqui os pixels são os da arte original, então posição, tamanho,
 * ângulo e escrita saem exatamente como o vendedor marcou. O realismo vem de
 * efeitos determinísticos: luz/textura da superfície por baixo da arte,
 * sombra e acabamento específico de cada técnica.
 */
export async function comporMockupLocal(params: {
  cenaUrl: string; logoUrl: string; box: CaixaPosicao; tecnica: Tecnica;
}): Promise<string> {
  const { box, tecnica } = params;
  const [cena, logo] = await Promise.all([carregarImagem(params.cenaUrl), carregarImagem(params.logoUrl)]);
  const W = cena.naturalWidth;
  const H = cena.naturalHeight;
  const cx = (box.xPct / 100) * W;
  const cy = (box.yPct / 100) * H;
  const w = Math.max(2, (box.wPct / 100) * W);
  const h = Math.max(2, (box.hPct / 100) * H);
  const rad = ((box.anguloGraus || 0) * Math.PI) / 180;

  const base = novoCanvas(W, H);
  const bctx = base.getContext("2d")!;
  bctx.drawImage(cena, 0, 0, W, H);

  const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const rx = Math.max(0, Math.floor(cx - bw / 2));
  const ry = Math.max(0, Math.floor(cy - bh / 2));
  const rw = Math.max(1, Math.min(W - rx, Math.ceil(bw) + 1));
  const rh = Math.max(1, Math.min(H - ry, Math.ceil(bh) + 1));
  const regiao = bctx.getImageData(rx, ry, rw, rh);
  const { lumMedia, corMedia } = estatisticas(regiao);

  const arte = prepararArte(logo, Math.round(w), Math.round(h), tecnica, lumMedia, corMedia);

  const camada = novoCanvas(W, H);
  const cctx = camada.getContext("2d")!;
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  cctx.translate(cx, cy);
  cctx.rotate(rad);
  if (tecnica === "dtf_textil") cctx.filter = `blur(${Math.max(0.3, W / 2500)}px)`;
  cctx.drawImage(arte, -w / 2, -h / 2, w, h);
  cctx.filter = "none";

  if (tecnica === "dtf_uv") {
    // Brilho do verniz: reflexo suave no canto superior da arte.
    const grad = cctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.38)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.06)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    cctx.globalCompositeOperation = "source-atop";
    cctx.fillStyle = grad;
    cctx.fillRect(-w / 2, -h / 2, w, h);
    cctx.globalCompositeOperation = "source-over";
  }
  cctx.setTransform(1, 0, 0, 1, 0, 0);

  const alphaOriginal = novoCanvas(W, H);
  alphaOriginal.getContext("2d")!.drawImage(camada, 0, 0);

  // Luz/textura da superfície por baixo, normalizada em torno do cinza
  // médio -- só transfere sombreamento e trama, não a cor do produto.
  const ganho = tecnica === "dtf_textil" ? 1.7 : 1.25;
  const luz = novoCanvas(W, H);
  const lctx = luz.getContext("2d")!;
  lctx.putImageData(mapaSombreamento(regiao, lumMedia, ganho), rx, ry);
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(camada, 0, 0);

  cctx.globalCompositeOperation = "soft-light";
  cctx.globalAlpha = tecnica === "dtf_textil" ? 0.9 : tecnica === "laser" ? 0.6 : 0.35;
  cctx.drawImage(luz, 0, 0);
  cctx.globalAlpha = 1;
  cctx.globalCompositeOperation = "destination-in";
  cctx.drawImage(alphaOriginal, 0, 0);
  cctx.globalCompositeOperation = "source-over";

  const escalaSombra = W / 1000;
  bctx.save();
  if (tecnica === "dtf_uv") {
    bctx.shadowColor = "rgba(0,0,0,0.35)";
    bctx.shadowBlur = 3 * escalaSombra;
    bctx.shadowOffsetX = 1 * escalaSombra;
    bctx.shadowOffsetY = 1.5 * escalaSombra;
  } else if (tecnica === "dtf_textil") {
    bctx.shadowColor = "rgba(0,0,0,0.15)";
    bctx.shadowBlur = 1.2 * escalaSombra;
  }
  bctx.globalAlpha = tecnica === "dtf_textil" ? 0.96 : tecnica === "laser" ? 0.92 : 1;
  bctx.drawImage(camada, 0, 0);
  bctx.restore();

  return base.toDataURL("image/png");
}

/** Arte na resolução final. Laser vira um tom só (gravação): prateado em
 * superfície escura, queimado/escurecido em superfície clara (inox, bambu). */
function prepararArte(logo: HTMLImageElement, w: number, h: number, tecnica: Tecnica, lumSuperficie: number, corSuperficie: [number, number, number]): HTMLCanvasElement {
  const c = novoCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, 0, 0, w, h);
  if (tecnica !== "laser") return c;

  const dados = ctx.getImageData(0, 0, w, h);
  const p = dados.data;
  let somaLum = 0;
  let somaA = 0;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3] / 255;
    somaLum += luminancia(p[i], p[i + 1], p[i + 2]) * a;
    somaA += a;
  }
  // Logo toda clara (ex.: branca, feita pra fundo escuro) grava o claro.
  const logoClara = somaA > 0 && somaLum / somaA > 0.7;
  const superficieEscura = lumSuperficie < 0.5;
  const cor: [number, number, number] = superficieEscura
    ? [212, 212, 215]
    : [corSuperficie[0] * 0.3, corSuperficie[1] * 0.3, corSuperficie[2] * 0.3];
  for (let i = 0; i < p.length; i += 4) {
    const lum = luminancia(p[i], p[i + 1], p[i + 2]);
    const base = logoClara ? lum : 1 - lum;
    const intensidade = (p[i + 3] / 255) * suave(0.2, 0.6, base);
    p[i] = cor[0];
    p[i + 1] = cor[1];
    p[i + 2] = cor[2];
    p[i + 3] = Math.round(intensidade * 255);
  }
  ctx.putImageData(dados, 0, 0);
  return c;
}

function estatisticas(regiao: ImageData): { lumMedia: number; corMedia: [number, number, number] } {
  const p = regiao.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < p.length; i += 4) { r += p[i]; g += p[i + 1]; b += p[i + 2]; n++; }
  if (!n) return { lumMedia: 0.5, corMedia: [128, 128, 128] };
  const corMedia: [number, number, number] = [r / n, g / n, b / n];
  return { lumMedia: luminancia(...corMedia), corMedia };
}

function mapaSombreamento(regiao: ImageData, lumMedia: number, ganho: number): ImageData {
  const saida = new ImageData(regiao.width, regiao.height);
  const p = regiao.data;
  const s = saida.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.max(0, Math.min(255, 128 + (luminancia(p[i], p[i + 1], p[i + 2]) - lumMedia) * 255 * ganho));
    s[i] = s[i + 1] = s[i + 2] = v;
    s[i + 3] = 255;
  }
  return saida;
}

/**
 * Se a logo não tem transparência (JPG/PNG com fundo chapado), tira o fundo
 * por preenchimento a partir das bordas -- só a cor contínua que encosta na
 * borda sai, o miolo da arte fica. Devolve null quando a imagem já tem
 * transparência (nada a fazer).
 */
export async function removerFundoSeOpaco(src: string): Promise<string | null> {
  const img = await carregarImagem(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = novoCanvas(W, H);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const dados = ctx.getImageData(0, 0, W, H);
  const p = dados.data;

  const borda: number[] = [];
  for (let x = 0; x < W; x++) { borda.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { borda.push(y * W, y * W + W - 1); }
  if (borda.some((idx) => p[idx * 4 + 3] < 250)) return null;

  const ref = [p[0], p[1], p[2]];
  const tol = 42;
  const dist = (idx: number) => {
    const o = idx * 4;
    return Math.hypot(p[o] - ref[0], p[o + 1] - ref[1], p[o + 2] - ref[2]);
  };

  const fundo = new Uint8Array(W * H);
  const fila: number[] = [];
  for (const idx of borda) {
    if (!fundo[idx] && dist(idx) < tol) { fundo[idx] = 1; fila.push(idx); }
  }
  while (fila.length) {
    const idx = fila.pop()!;
    const x = idx % W;
    const y = (idx - x) / W;
    const vizinhos = [x > 0 ? idx - 1 : -1, x < W - 1 ? idx + 1 : -1, y > 0 ? idx - W : -1, y < H - 1 ? idx + W : -1];
    for (const v of vizinhos) {
      if (v >= 0 && !fundo[v] && dist(v) < tol) { fundo[v] = 1; fila.push(v); }
    }
  }

  for (let idx = 0; idx < W * H; idx++) {
    if (fundo[idx]) { p[idx * 4 + 3] = 0; continue; }
    // Suaviza a borda (antialias) dos pixels da arte encostados no fundo.
    const x = idx % W;
    const encostaFundo = (x > 0 && fundo[idx - 1]) || (x < W - 1 && fundo[idx + 1]) || (idx >= W && fundo[idx - W]) || (idx + W < W * H && fundo[idx + W]);
    if (encostaFundo) {
      const d = dist(idx);
      if (d < tol * 2) p[idx * 4 + 3] = Math.round(255 * Math.min(1, (d - tol) / tol + 0.15));
    }
  }
  ctx.putImageData(dados, 0, 0);
  return c.toDataURL("image/png");
}

function luminancia(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function suave(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function novoCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
  });
}
