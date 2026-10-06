import { supabase } from "@/integrations/supabase/client";
import type { Tecnica } from "./types";
import type { Geracao } from "./historico";

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

interface GerarMockupParams {
  produtoUrl: string;
  detalheUrl: string;
  tecnica: Tecnica;
  nomeProduto: string;
  produtoCodigo?: string;
  cliente?: string;
  pct: number;
  posicao: string;
}

/** Geração final -- manda a foto do produto com a logo já colada e um close
 * dessa região (ambos montados na Etapa 3), mais um prompt curto montado a
 * partir do template da técnica. Essa é a ÚNICA chamada de IA do fluxo
 * inteiro. */
export async function gerarMockupFinal(params: GerarMockupParams): Promise<{ url: string; geracao: Geracao | null }> {
  const [produtoBase64, detalheBase64] = await Promise.all([
    paraDataURL(params.produtoUrl),
    paraDataURL(params.detalheUrl),
  ]);
  const { data, error } = await supabase.functions.invoke("gerar-mockup-final", {
    body: {
      produtoBase64,
      detalheBase64,
      tecnica: params.tecnica,
      nomeProduto: params.nomeProduto,
      produtoCodigo: params.produtoCodigo,
      cliente: params.cliente,
      pct: params.pct,
      posicao: params.posicao,
    },
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
  return { url: data.url as string, geracao: (data.geracao as Geracao | null) ?? null };
}
