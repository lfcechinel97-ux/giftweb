/** Baixa via Blob + object URL: `<a download href="data:...">` com imagem
 * grande falha calado em alguns navegadores, e com URL de outro domínio
 * (signed URL do storage) o atributo download é ignorado. */
export async function baixarImagem(src: string, nomeArquivo: string): Promise<void> {
  const blob = await (await fetch(src)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
