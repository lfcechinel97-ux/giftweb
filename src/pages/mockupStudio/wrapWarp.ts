/**
 * Simula a curvatura de um produto cilíndrico de eixo vertical (garrafa,
 * caneca, squeeze) sobre a logo.
 *
 * Estratégia (reescrita -- a primeira versão fatiava a imagem em tiras e
 * redimensionava a ALTURA de cada uma, que é o efeito certo pra um cilindro
 * deitado, não pra uma garrafa em pé; o resultado ficava com costuras
 * visíveis entre as tiras). A versão correta pra um cilindro vertical é
 * remapear a LARGURA: cada coluna de saída busca sua coluna de origem por
 * uma projeção ortográfica do cilindro (arcoseno), o que concentra colunas
 * perto das bordas (compressão) sem deixar buracos, e aplica sombreamento
 * proporcional ao cosseno do ângulo -- sem nenhuma tira, sem costura.
 *
 * `intensidade` vai de 0 (plano) a 1 (envolve até ~108° do cilindro, limite
 * antes da distorção virar ilegível).
 */
export async function aplicarCurvatura(src: string, intensidade: number): Promise<string> {
  if (intensidade <= 0) return src;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível aplicar a curvatura nesta imagem."));
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  const thetaMax = (Math.PI / 180) * 54 * intensidade; // até 54° de cada lado
  const sinThetaMax = Math.sin(thetaMax);
  const brilhoPorColuna = new Float32Array(w);

  // Passo 1: remapeamento geométrico, coluna a coluna (sem gaps nem costuras).
  for (let x = 0; x < w; x++) {
    const sx = Math.max(-1, Math.min(1, (x / w - 0.5) * 2));
    const u = Math.asin(sx * sinThetaMax);
    const srcCol = Math.round(w / 2 + (u / thetaMax) * (w / 2));
    const srcColClamp = Math.max(0, Math.min(w - 1, srcCol));
    brilhoPorColuna[x] = Math.cos(u);
    ctx.drawImage(img, srcColClamp, 0, 1, h, x, 0, 1, h);
  }

  // Passo 2: sombreamento (mais escuro perto das bordas), num único pass de
  // pixels -- preserva o alpha original (não escurece o que já é transparente).
  const frame = ctx.getImageData(0, 0, w, h);
  const d = frame.data;
  for (let y = 0; y < h; y++) {
    const linha = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = linha + x * 4;
      if (d[i + 3] === 0) continue;
      const fator = 0.45 + 0.55 * brilhoPorColuna[x];
      d[i] *= fator;
      d[i + 1] *= fator;
      d[i + 2] *= fator;
    }
  }
  ctx.putImageData(frame, 0, 0);

  return canvas.toDataURL("image/png");
}
