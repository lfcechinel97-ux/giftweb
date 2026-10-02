/**
 * Fundos "estúdio" gerados por canvas (gradiente radial + manchas de luz
 * desfocadas, tipo bokeh) -- procedurais e determinísticos, sem depender de
 * nenhuma foto externa. Servem de pano de fundo atrás da foto do produto no
 * editor, pra não ficar a imagem crua do catálogo sobre fundo branco.
 */
export interface FundoPreset {
  id: string;
  nome: string;
  cores: [string, string, string];
}

export const FUNDOS_PRESET: FundoPreset[] = [
  { id: "cinza", nome: "Estúdio Cinza", cores: ["#f4f5f7", "#d7dbe2", "#9aa3b2"] },
  { id: "azul", nome: "Azul Suave", cores: ["#eef5ff", "#c9ddfb", "#6f9adb"] },
  { id: "verde", nome: "Verde Gift Web", cores: ["#eefaf2", "#c7ead4", "#5fb983"] },
  { id: "areia", nome: "Areia Quente", cores: ["#fbf6ee", "#ecdcc0", "#c9a977"] },
  { id: "escuro", nome: "Estúdio Escuro", cores: ["#3b4049", "#262a31", "#15171b"] },
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

/** Semente fixa por preset -- mesmo fundo toda vez pro mesmo produto, sem
 * precisar guardar a imagem gerada em lugar nenhum. */
function rngDe(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function gerarFundo(presetId: string, w: number, h: number): string {
  const preset = FUNDOS_PRESET.find((p) => p.id === presetId) || FUNDOS_PRESET[0];
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

  // Leve vinheta nas bordas pra dar profundidade.
  const vinheta = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.7);
  vinheta.addColorStop(0, "rgba(0,0,0,0)");
  vinheta.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL("image/png");
}
