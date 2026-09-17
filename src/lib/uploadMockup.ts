import { supabase } from "@/integrations/supabase/client";

/**
 * Envia a foto/mockup de um item de pedido para o bucket `mockups` e devolve a
 * URL pública.
 *
 * Por que isto existe: o upload de mockup era feito com FileReader.readAsDataURL,
 * ou seja, a imagem inteira virava uma string base64 gravada DENTRO do jsonb
 * `sistema_pedidos.itens`. Uma foto de 2 MB vira ~2,7 MB de texto, multiplicado
 * por item, carregado em toda listagem de pedidos. O bucket `mockups` existe
 * desde a migration 05 e nunca tinha sido usado.
 *
 * Aqui a imagem vai para o storage e o jsonb guarda só a URL (~100 bytes).
 */

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS_OK = /^image\/(jpe?g|png|webp|gif)$/i;

export class MockupUploadError extends Error {}

export async function uploadMockup(file: File, pedidoId?: string): Promise<string> {
  if (!TIPOS_OK.test(file.type)) {
    throw new MockupUploadError("Formato não suportado. Use JPG, PNG, WebP ou GIF.");
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new MockupUploadError(`Imagem de ${mb} MB excede o limite de 8 MB.`);
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pasta = pedidoId ? `pedidos/${pedidoId}` : "avulsos";
  const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from("mockups")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new MockupUploadError(error.message);

  const { data } = supabase.storage.from("mockups").getPublicUrl(path);
  return data.publicUrl;
}

/** Uma imagem que ficou gravada como base64 dentro do jsonb (formato antigo). */
export const ehBase64 = (url?: string | null): boolean =>
  typeof url === "string" && url.startsWith("data:");

/**
 * Anexos do PCP (teste físico e produção concluída) — foto OU vídeo, mesmo
 * bucket `mockups`, path separado por card. O limite é maior que o de
 * mockup porque vídeo de "produto pronto" facilmente passa de 8 MB mesmo
 * curto; 60 MB cobre um clipe de alguns segundos em celular sem precisar de
 * compressão do lado do vendedor.
 */
const MAX_BYTES_ANEXO = 60 * 1024 * 1024;
const TIPOS_ANEXO_OK = /^(image\/(jpe?g|png|webp|heic)|video\/(mp4|quicktime|webm))$/i;

export async function uploadAnexoPcp(
  file: File,
  producaoId: string,
  pasta: "teste" | "producao",
): Promise<{ url: string; tipo: "foto" | "video" }> {
  if (!TIPOS_ANEXO_OK.test(file.type)) {
    throw new MockupUploadError("Formato não suportado. Use JPG, PNG, WebP, HEIC, MP4, MOV ou WebM.");
  }
  if (file.size > MAX_BYTES_ANEXO) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new MockupUploadError(`Arquivo de ${mb} MB excede o limite de 60 MB.`);
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `pcp/${pasta}/${producaoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from("mockups")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new MockupUploadError(error.message);

  const { data } = supabase.storage.from("mockups").getPublicUrl(path);
  return { url: data.publicUrl, tipo: file.type.startsWith("video/") ? "video" : "foto" };
}
