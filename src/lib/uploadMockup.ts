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
