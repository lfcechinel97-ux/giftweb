/**
 * GPT Image 2 (via /v1/images/edits) só aceita um conjunto fechado de
 * tamanhos de saída. Se a imagem de entrada não tiver exatamente essa
 * proporção, a API reamostra por conta própria -- e a máscara (calculada
 * em cima da resolução original) deixa de bater com o que o modelo
 * realmente desenha. É provavelmente a causa da mochila saindo com a logo
 * gigante e deslocada enquanto o copo (quase quadrado, já perto de
 * 1024x1024) saiu certo.
 *
 * Aqui a gente escolhe o bucket mais parecido com a proporção real da
 * imagem, e PREENCHE (letterbox) até caber exato nele -- nunca corta
 * conteúdo. Depois da geração, recorta de volta só a parte real (ver
 * recortarDeVoltaDoBucket).
 */

export interface Bucket { w: number; h: number; tamanho: string }

export const BUCKETS: Bucket[] = [
  { w: 1024, h: 1024, tamanho: "1024x1024" },
  { w: 1536, h: 1024, tamanho: "1536x1024" },
  { w: 1024, h: 1536, tamanho: "1024x1536" },
];

export function escolherBucket(w: number, h: number): Bucket {
  const aspecto = w / h;
  let melhor = BUCKETS[0];
  let menorDist = Infinity;
  for (const b of BUCKETS) {
    const dist = Math.abs(Math.log(aspecto) - Math.log(b.w / b.h));
    if (dist < menorDist) { menorDist = dist; melhor = b; }
  }
  return melhor;
}

export interface AjusteBucket {
  dataUrl: string;
  bucket: Bucket;
  escala: number;
  offsetX: number;
  offsetY: number;
  larguraReal: number;
  alturaReal: number;
}

/** Encaixa `img` dentro do bucket, centralizada, preenchendo a sobra com
 * `corFundo` (sem cortar nada da imagem original). */
export function ajustarParaBucket(img: HTMLImageElement, bucket: Bucket, corFundo: string): AjusteBucket {
  const canvas = document.createElement("canvas");
  canvas.width = bucket.w;
  canvas.height = bucket.h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = corFundo;
  ctx.fillRect(0, 0, bucket.w, bucket.h);

  const escala = Math.min(bucket.w / img.naturalWidth, bucket.h / img.naturalHeight);
  const larguraReal = img.naturalWidth * escala;
  const alturaReal = img.naturalHeight * escala;
  const offsetX = (bucket.w - larguraReal) / 2;
  const offsetY = (bucket.h - alturaReal) / 2;
  ctx.drawImage(img, offsetX, offsetY, larguraReal, alturaReal);

  return { dataUrl: canvas.toDataURL("image/png"), bucket, escala, offsetX, offsetY, larguraReal, alturaReal };
}

/** Depois que a IA devolve a imagem (do tamanho do bucket), recorta de
 * volta só a região real (tira o letterbox) e escala pra resolução
 * original do cenário. */
export async function recortarDeVoltaDoBucket(resultadoUrl: string, ajuste: AjusteBucket, larguraOriginal: number, alturaOriginal: number): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = resultadoUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível reler o resultado da IA."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = larguraOriginal;
  canvas.height = alturaOriginal;
  const ctx = canvas.getContext("2d");
  if (!ctx) return resultadoUrl;
  ctx.drawImage(
    img,
    ajuste.offsetX, ajuste.offsetY, ajuste.larguraReal, ajuste.alturaReal,
    0, 0, larguraOriginal, alturaOriginal,
  );
  return canvas.toDataURL("image/png");
}
