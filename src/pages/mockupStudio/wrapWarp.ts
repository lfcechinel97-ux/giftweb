/**
 * Simula a curvatura de um produto cilíndrico (garrafa, caneca, squeeze) sobre
 * a logo, fatiando a imagem em tiras verticais finas e escalando a altura de
 * cada tira por cos(ângulo) -- a mesma lógica usada por geradores de mockup
 * comerciais pra "embrulhar" uma arte plana num cilindro. É processamento
 * determinístico local (canvas 2D), não IA -- por isso roda em tempo real
 * enquanto o vendedor arrasta o slider de curvatura.
 *
 * `intensidade` vai de 0 (plano, sem curvatura) a 1 (envolve ~120° do
 * cilindro, o máximo antes da distorção virar ilegível).
 */
export async function aplicarCurvatura(src: string, intensidade: number): Promise<string> {
  if (intensidade <= 0) return src;

  const img = new Image();
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

  const FATIAS = 90;
  const fatiaW = w / FATIAS;
  const meioAnguloMax = (Math.PI / 3) * intensidade; // até 60° de cada lado

  for (let i = 0; i < FATIAS; i++) {
    const sx = i * fatiaW;
    const t = (i + 0.5) / FATIAS - 0.5; // -0.5..0.5
    const angulo = t * 2 * meioAnguloMax;
    const fatorAltura = Math.cos(angulo);
    const destH = h * fatorAltura;
    const destY = (h - destH) / 2;
    // Sombreamento leve nas bordas reforça a leitura de superfície curva.
    ctx.globalAlpha = 0.55 + 0.45 * fatorAltura;
    ctx.drawImage(img, sx, 0, fatiaW + 0.5, h, sx, destY, fatiaW + 0.5, destH);
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}
