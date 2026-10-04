/**
 * Marca d'água leve (logo Gift Web + WhatsApp) aplicada LOCALMENTE sobre o
 * mockup já gerado -- nunca pedida pra IA desenhar (modelos de imagem são
 * ruins pra renderizar texto pequeno/telefone com precisão).
 */
const LOGO_URL = "/logos/giftweb-logo.png";
const WHATSAPP = "(11) 97016-9697";

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a marca d'água."));
    img.src = src;
  });
}

export async function aplicarMarcaDagua(src: string): Promise<string> {
  const [imgPrincipal, imgLogo] = await Promise.all([carregar(src), carregar(LOGO_URL)]);
  const canvas = document.createElement("canvas");
  canvas.width = imgPrincipal.naturalWidth;
  canvas.height = imgPrincipal.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(imgPrincipal, 0, 0);

  const tamanhoLogo = canvas.width * 0.09;
  const margem = canvas.width * 0.025;
  const x = canvas.width - tamanhoLogo - margem;
  const y = canvas.height - tamanhoLogo - margem;

  ctx.globalAlpha = 0.55;
  ctx.drawImage(imgLogo, x, y, tamanhoLogo, tamanhoLogo);

  const fontSize = Math.max(12, tamanhoLogo * 0.22);
  ctx.globalAlpha = 0.75;
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = fontSize * 0.35;
  ctx.fillText(WHATSAPP, x + tamanhoLogo, y - margem * 0.3);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}
