/**
 * Se a logo não tem transparência (JPG/PNG com fundo chapado, ex.: retângulo
 * preto em volta), tira o fundo por preenchimento a partir das bordas -- só
 * a cor contínua que encosta na borda sai, o miolo da arte fica. Com
 * `incluirMiolo`, sai também toda área da cor do fundo presa entre os
 * detalhes (vãos entre ferramentas, miolo de letras) -- opcional porque
 * apagaria partes da arte que sejam da mesma cor do fundo (ex.: texto
 * branco numa logo de fundo branco). Devolve null quando a imagem já tem
 * transparência (nada a fazer).
 */
export async function removerFundoSeOpaco(src: string, incluirMiolo = false): Promise<string | null> {
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

  // Cor do fundo = mediana da borda (o pixel do canto sozinho pode ser
  // ruído de JPG ou um detalhe da arte encostado na borda).
  const mediana = (canal: number) => {
    const v = borda.map((idx) => p[idx * 4 + canal]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const ref = [mediana(0), mediana(1), mediana(2)];
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
  if (incluirMiolo) {
    for (let idx = 0; idx < W * H; idx++) if (!fundo[idx] && dist(idx) < tol) fundo[idx] = 1;
  }

  // Distância (em px, até 2) de cada pixel da arte até o fundo -- a faixa
  // de borda é onde o antialias misturou a arte com a cor do fundo e
  // deixava aquele contorno/halo claro em volta dos detalhes.
  const pertoFundo = (idx: number, raio: number) => {
    const x = idx % W;
    const y = (idx - x) / W;
    for (let dy = -raio; dy <= raio; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -raio; dx <= raio; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < W && fundo[yy * W + xx]) return true;
      }
    }
    return false;
  };

  for (let idx = 0; idx < W * H; idx++) {
    const o = idx * 4;
    if (fundo[idx]) { p[o + 3] = 0; continue; }
    if (!pertoFundo(idx, 2)) continue;
    const d = dist(idx);
    // Alfa pela distância da cor do fundo: quase igual ao fundo -> some,
    // bem diferente -> opaco.
    const a = Math.min(1, Math.max(0, (d - tol * 0.6) / (tol * 1.6)));
    if (a < 0.12) { p[o + 3] = 0; continue; }
    if (a >= 1) continue;
    // Tira a "contaminação" da cor do fundo do pixel semi-transparente
    // (senão a borda fica clara/escura sobre o produto).
    for (let k = 0; k < 3; k++) p[o + k] = Math.min(255, Math.max(0, Math.round((p[o + k] - (1 - a) * ref[k]) / a)));
    p[o + 3] = Math.round(255 * a);
  }
  ctx.putImageData(dados, 0, 0);
  return c.toDataURL("image/png");
}
