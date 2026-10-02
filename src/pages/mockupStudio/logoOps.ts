/**
 * Operações determinísticas sobre a logo (sem IA), aplicadas localmente via
 * canvas 2D. Cada função recebe um data URL/URL e devolve um novo data URL
 * -- a fonte original nunca é sobrescrita, só o layer exibido no editor.
 */

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

async function comContexto(src: string, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Promise<string> {
  const img = await carregarImagem(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  fn(ctx, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Torna transparentes os pixels próximos do branco (tolerância ajustável). */
export function removerFundoBranco(src: string, tolerancia = 235): Promise<string> {
  return comContexto(src, (ctx, w, h) => {
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] >= tolerancia && d[i + 1] >= tolerancia && d[i + 2] >= tolerancia) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(frame, 0, 0);
  });
}

export function paraCinza(src: string): Promise<string> {
  return comContexto(src, (ctx, w, h) => {
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const cinza = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = cinza;
    }
    ctx.putImageData(frame, 0, 0);
  });
}

export function paraPretoEBranco(src: string, limiar = 128): Promise<string> {
  return comContexto(src, (ctx, w, h) => {
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const cinza = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = cinza >= limiar ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(frame, 0, 0);
  });
}

/** Mantém só a luminância, tingida por uma cor única (mantém o alpha). */
export function paraCorUnica(src: string, hex: string): Promise<string> {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return comContexto(src, (ctx, w, h) => {
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(frame, 0, 0);
  });
}
