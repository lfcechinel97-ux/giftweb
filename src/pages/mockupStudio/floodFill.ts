/**
 * Remoção de fundo local, por flood fill a partir das bordas -- NUNCA IA.
 * Serve só de guia visual na Etapa 3 (posicionamento); o arquivo que vai
 * pra geração final na Etapa 4 é sempre a logo original, intocada.
 *
 * Algoritmo: começa dos pixels da borda da imagem e "alaga" por pixels
 * vizinhos de cor parecida (BFS 4-direções), marcando tudo que alcançar
 * como fundo (alpha 0). Lida bem com fundo liso de qualquer cor (não só
 * branco) e com pequenos degradês/serrilhado nas bordas.
 */

export interface CaixaConteudo { x0: number; y0: number; x1: number; y1: number }

export interface ResultadoFloodFill {
  /** Data URL da logo com fundo removido -- só pra pré-visualização local. */
  previewUrl: string;
  /** Bounding box do conteúdo real (não-fundo), em pixels da imagem original. */
  caixa: CaixaConteudo;
  largura: number;
  altura: number;
}

async function carregarImagem(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível processar esta imagem."));
  });
  return img;
}

const TOLERANCIA = 28; // distância de cor (por canal, aprox.) pra considerar "mesmo fundo"

export async function removerFundoLocal(src: string): Promise<ResultadoFloodFill> {
  const img = await carregarImagem(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, w, h);
  const d = frame.data;

  const visitado = new Uint8Array(w * h);
  const fila: number[] = [];

  const idx = (x: number, y: number) => y * w + x;
  const corEm = (i: number): [number, number, number] => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const parecido = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < TOLERANCIA * 3;

  // Semeia com todos os pixels da borda (já são o próprio fundo, por definição).
  for (let x = 0; x < w; x++) { fila.push(idx(x, 0)); fila.push(idx(x, h - 1)); }
  for (let y = 0; y < h; y++) { fila.push(idx(0, y)); fila.push(idx(w - 1, y)); }
  for (const i of fila) visitado[i] = 1;

  let cursor = 0;
  while (cursor < fila.length) {
    const i = fila[cursor++];
    const x = i % w;
    const y = (i / w) | 0;
    const corAtual = corEm(i);

    const vizinhos = [
      x > 0 ? idx(x - 1, y) : -1,
      x < w - 1 ? idx(x + 1, y) : -1,
      y > 0 ? idx(x, y - 1) : -1,
      y < h - 1 ? idx(x, y + 1) : -1,
    ];
    for (const vi of vizinhos) {
      if (vi < 0 || visitado[vi]) continue;
      if (parecido(corAtual, corEm(vi))) {
        visitado[vi] = 1;
        fila.push(vi);
      }
    }
  }

  // Apaga o que foi alagado (fundo) e descobre a caixa do que sobrou (conteúdo real).
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  let achouConteudo = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (visitado[i]) {
        d[i * 4 + 3] = 0;
      } else {
        achouConteudo = true;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!achouConteudo) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }

  ctx.putImageData(frame, 0, 0);

  return {
    previewUrl: canvas.toDataURL("image/png"),
    caixa: { x0, y0, x1: x1 + 1, y1: y1 + 1 },
    largura: w,
    altura: h,
  };
}
