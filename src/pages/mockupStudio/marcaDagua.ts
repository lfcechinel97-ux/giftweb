/**
 * Marca d'água leve (só a logo Gift Web) aplicada LOCALMENTE sobre o mockup
 * já gerado -- nunca pedida pra IA desenhar.
 */
const LOGO_URL = "/logos/giftweb-logo.png";

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
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}
