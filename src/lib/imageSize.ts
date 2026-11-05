/**
 * Serve imagens do Storage já redimensionadas no tamanho em que aparecem na
 * tela (miniatura de 160px não precisa baixar o arquivo original).
 *
 * Usa a transformação de imagem do Storage:
 *   /storage/v1/object/public/...  →  /storage/v1/render/image/public/...?width=&quality=
 *
 * Parâmetros que já existiam na URL (ex.: ?v=<versão> do CMS) são mantidos,
 * para a troca de imagem continuar furando o cache.
 *
 * URLs de terceiros (fornecedores) são devolvidas sem alteração.
 */
export function sizedImage(url?: string | null, width = 160, quality = 70): string | undefined {
  if (!url) return undefined;
  if (!url.includes("/storage/v1/object/public/")) return url;
  const [path, query] = url.split("?");
  const base = path.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const extra = query ? `&${query}` : "";
  return `${base}?width=${Math.round(width)}&quality=${quality}&resize=contain${extra}`;
}

/**
 * srcset com várias larguras para imagens do Storage (o navegador escolhe a
 * menor que atende a tela). Para URLs de terceiros devolve undefined — nesse
 * caso use só o src original.
 */
export function sizedSrcSet(url: string | null | undefined, widths: number[], quality = 75): string | undefined {
  if (!url || !url.includes("/storage/v1/object/public/")) return undefined;
  return widths.map((w) => `${sizedImage(url, w, quality)} ${w}w`).join(", ");
}
