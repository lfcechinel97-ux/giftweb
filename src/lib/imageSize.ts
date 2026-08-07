/**
 * Serve imagens do Storage já redimensionadas no tamanho em que aparecem na
 * tela (miniatura de 160px não precisa baixar o arquivo original).
 *
 * Usa a transformação de imagem do Storage:
 *   /storage/v1/object/public/...  →  /storage/v1/render/image/public/...?width=&quality=
 *
 * URLs de terceiros (fornecedores) são devolvidas sem alteração.
 */
export function sizedImage(url?: string | null, width = 160, quality = 70): string | undefined {
  if (!url) return undefined;
  if (!url.includes("/storage/v1/object/public/")) return url;
  const base = url.split("?")[0].replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${base}?width=${Math.round(width)}&quality=${quality}&resize=contain`;
}
