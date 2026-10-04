import type { PDFDocumentProxy } from "pdfjs-dist";

const LADO_MAXIMO = 2400;

/** pdf.js carregado só quando o vendedor manda um PDF (é pesado). */
export async function abrirPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

/**
 * Rasteriza a página com fundo transparente (arte vetorial sai sem o
 * branco da folha) e recorta até o conteúdo -- a logo costuma ocupar um
 * pedaço pequeno de uma página A4.
 */
export async function renderizarPagina(pdf: PDFDocumentProxy, numero: number): Promise<Blob> {
  const pagina = await pdf.getPage(numero);
  const base = pagina.getViewport({ scale: 1 });
  const escala = Math.min(4, LADO_MAXIMO / Math.max(base.width, base.height));
  const viewport = pagina.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  await pagina.render({ canvasContext: ctx, viewport, background: "rgba(0,0,0,0)" }).promise;

  const recorte = limitesDoConteudo(ctx, canvas.width, canvas.height);
  if (!recorte) throw new Error(`A página ${numero} está em branco.`);
  const margem = Math.round(Math.max(recorte.w, recorte.h) * 0.02);
  const x = Math.max(0, recorte.x - margem);
  const y = Math.max(0, recorte.y - margem);
  const w = Math.min(canvas.width - x, recorte.w + margem * 2);
  const h = Math.min(canvas.height - y, recorte.h + margem * 2);
  const saida = document.createElement("canvas");
  saida.width = w;
  saida.height = h;
  saida.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    saida.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível converter a página."))), "image/png"),
  );
}

/** Caixa do conteúdo: por transparência; se a página tiver um fundo
 * pintado (opaca inteira), pela diferença em relação à cor do canto. */
function limitesDoConteudo(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const p = ctx.getImageData(0, 0, W, H).data;
  const porAlpha = caixa(W, H, (i) => p[i + 3] > 8);
  const cheia = porAlpha && porAlpha.w >= W - 1 && porAlpha.h >= H - 1;
  if (!cheia) return porAlpha;
  const [r, g, b] = [p[0], p[1], p[2]];
  return caixa(W, H, (i) => Math.abs(p[i] - r) + Math.abs(p[i + 1] - g) + Math.abs(p[i + 2] - b) > 30);
}

function caixa(W: number, H: number, ehConteudo: (i: number) => boolean) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ehConteudo((y * W + x) * 4)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
