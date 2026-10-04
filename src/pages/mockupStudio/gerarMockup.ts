import { supabase } from "@/integrations/supabase/client";
import type { Tecnica } from "./types";

async function paraDataURL(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const resp = await fetch(src);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}

/** Etapa A -- gera (ou reaproveita do cache) o cenário em volta do produto,
 * sem logo nenhuma. Cacheado no servidor por visaoId. */
export async function gerarCenario(params: {
  produtoUrl: string; nomeProduto: string; visaoId: string; forcarNovo?: boolean;
}): Promise<{ url: string; cache: boolean }> {
  const produtoBase64 = await paraDataURL(params.produtoUrl);
  const { data, error } = await supabase.functions.invoke("gerar-cenario-mockup", {
    body: { produtoBase64, nomeProduto: params.nomeProduto, visaoId: params.visaoId, forcarNovo: !!params.forcarNovo },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      try { const body = await ctx.json(); if (body?.error) msg = body.error; } catch { /* mantém mensagem genérica */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { url: data.url as string, cache: !!data.cache };
}

/** Etapa C -- aplica a logo no cenário por inpainting com máscara real
 * (GPT Image 2). A posição é garantida pela máscara, não por instrução.
 * `tamanho` é o bucket (ex. "1024x1024") que o cenário/máscara já foram
 * encaixados pra bater com o que a API realmente aceita como saída. */
export async function gerarMockupFinal(params: {
  cenaUrl: string; logoUrl: string; maskUrl: string; tecnica: Tecnica; nomeProduto: string; tamanho: string;
}): Promise<{ url: string }> {
  const [cenaBase64, logoBase64, maskBase64] = await Promise.all([
    paraDataURL(params.cenaUrl),
    paraDataURL(params.logoUrl),
    paraDataURL(params.maskUrl),
  ]);
  const { data, error } = await supabase.functions.invoke("gerar-mockup-final", {
    body: { cenaBase64, logoBase64, maskBase64, tecnica: params.tecnica, nomeProduto: params.nomeProduto, tamanho: params.tamanho },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      try { const body = await ctx.json(); if (body?.error) msg = body.error; } catch { /* mantém mensagem genérica */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { url: data.url as string };
}
