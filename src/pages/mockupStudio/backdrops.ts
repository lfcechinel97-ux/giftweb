/**
 * Fundos de "estúdio" atrás da foto do produto no editor -- fica fixo feito
 * papel de parede (nunca é apagado nem recriado quando o vendedor troca de
 * vista ou de produto, só quando ele escolhe outro fundo). Dois tipos:
 * fotos reais (enviadas pela Gift Web) e gradientes com bokeh gerados por
 * canvas, pros casos sem foto de ambiente ainda.
 */
export interface FundoPreset {
  id: string;
  nome: string;
  cores: [string, string, string];
  /** Quando presente, usa essa foto (centralizada e cortada em quadrado) em
   * vez de gerar o gradiente procedural. */
  foto?: string;
}

export const FUNDOS_PRESET: FundoPreset[] = [
  { id: "marmore-preto", nome: "Estúdio Mármore Preto", cores: ["#3b4049", "#262a31", "#15171b"], foto: "/mockup-fundos/estudio-marmore-preto.webp" },
  { id: "marmore-bege", nome: "Estúdio Mármore Bege", cores: ["#fbf6ee", "#ecdcc0", "#c9a977"], foto: "/mockup-fundos/estudio-marmore-bege.webp" },
  { id: "cinza", nome: "Estúdio Cinza", cores: ["#f4f5f7", "#d7dbe2", "#9aa3b2"] },
  { id: "azul", nome: "Azul Suave", cores: ["#eef5ff", "#c9ddfb", "#6f9adb"] },
  { id: "verde", nome: "Verde Gift Web", cores: ["#eefaf2", "#c7ead4", "#5fb983"] },
];

function manchaBokeh(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string, alpha: number) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, cor);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function rngDe(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function gerarGradiente(preset: FundoPreset, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const base = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  base.addColorStop(0, preset.cores[0]);
  base.addColorStop(1, preset.cores[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const rng = rngDe(preset.id.length * 97 + w);
  for (let i = 0; i < 6; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = (0.25 + rng() * 0.35) * Math.max(w, h);
    manchaBokeh(ctx, x, y, r, i % 2 === 0 ? preset.cores[2] : preset.cores[1], 0.18 + rng() * 0.15);
  }

  const vinheta = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.7);
  vinheta.addColorStop(0, "rgba(0,0,0,0)");
  vinheta.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL("image/png");
}

/** Recorta uma foto (qualquer proporção) num quadrado w×h, tipo object-fit:cover. */
async function recortarFotoQuadrada(src: string, w: number, h: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível carregar o fundo."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const destW = img.naturalWidth * escala;
  const destH = img.naturalHeight * escala;
  ctx.drawImage(img, (w - destW) / 2, (h - destH) / 2, destW, destH);
  return canvas.toDataURL("image/png");
}

export async function gerarFundo(presetId: string, w: number, h: number): Promise<string> {
  const preset = FUNDOS_PRESET.find((p) => p.id === presetId) || FUNDOS_PRESET[0];
  if (preset.foto) return recortarFotoQuadrada(preset.foto, w, h);
  return gerarGradiente(preset, w, h);
}
