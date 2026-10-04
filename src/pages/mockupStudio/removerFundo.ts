/**
 * Se a logo não tem transparência (JPG/PNG com fundo chapado, ex.: retângulo
 * preto em volta), tira o fundo por preenchimento a partir das bordas -- só
 * a cor contínua que encosta na borda sai, o miolo da arte fica. Devolve
 * null quando a imagem já tem transparência (nada a fazer).
 */
export async function removerFundoSeOpaco(src: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Não foi possível ler a logo."));
    el.src = src;
  });
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const dados = ctx.getImageData(0, 0, W, H);
  const p = dados.data;

  const borda: number[] = [];
  for (let x = 0; x < W; x++) borda.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) borda.push(y * W, y * W + W - 1);
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
    // Suaviza o antialias dos pixels da arte encostados no fundo.
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
