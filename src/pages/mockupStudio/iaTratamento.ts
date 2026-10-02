import { supabase } from "@/integrations/supabase/client";
import type { Tecnica } from "./types";

async function paraDataURL(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const resp = await fetch(src);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo da logo."));
    reader.readAsDataURL(blob);
  });
}

async function chamarTratamento(imagemBase64: string, tecnica: Tecnica | undefined, modo?: "logo" | "composicao" | "produto") {
  const { data, error } = await supabase.functions.invoke("tratar-logo-ia", { body: { imagemBase64, tecnica, modo } });
  if (error) {
    let msg = error.message;
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      try { const body = await ctx.json(); if (body?.error) msg = body.error; } catch { /* mantém mensagem genérica */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { url: data.url as string, aviso: data.aviso as string | null | undefined };
}

/** Remove fundo / refina o acabamento da logo isolada via Lovable AI Gateway
 * (cobrado nos créditos do workspace Lovable, sem chave própria). Nunca
 * redesenha a logo -- o prompt do lado do servidor é explícito sobre isso. */
export async function refinarLogoComIA(src: string, tecnica: Tecnica) {
  const imagemBase64 = await paraDataURL(src);
  return chamarTratamento(imagemBase64, tecnica, "logo");
}

/** Refina a composição inteira (produto + logo já posicionada) -- usado no
 * editor, onde a IA precisa considerar os dois juntos (luz, perspectiva da
 * superfície), não só a logo isolada. */
export async function refinarComposicaoComIA(src: string, tecnica: Tecnica) {
  const imagemBase64 = await paraDataURL(src);
  return chamarTratamento(imagemBase64, tecnica, "composicao");
}

/** Remove o fundo branco da foto do produto (vem assim da XBZ) via IA,
 * preservando o produto em si -- sem perder nitidez. */
export async function refinarProdutoComIA(src: string) {
  const imagemBase64 = await paraDataURL(src);
  return chamarTratamento(imagemBase64, undefined, "produto");
}
