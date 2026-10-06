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
  /** Ausente no modo "cenario" (a IA não vê a logo). */
  logoUrl?: string;
  tecnica: Tecnica;
  nomeProduto: string;
  produtoCodigo?: string;
  cliente?: string;
  pct: number;
  posicao: string;
  /** "cenario": IA gera só produto liso + cenário; a logo é colada por cima depois, no navegador. */
  modo?: "acabamento" | "cenario";
}

/** Geração final -- manda a foto do produto sem pré-processamento e a logo
 * já recortada pelo vendedor na Etapa 3, mais um prompt curto montado a
 * partir do template da técnica. Essa é a ÚNICA chamada de IA do fluxo
 * inteiro. */
export async function gerarMockupFinal(params: GerarMockupParams): Promise<{ url: string; geracao: Geracao | null }> {
  const [produtoBase64, logoBase64] = await Promise.all([
    paraDataURL(params.produtoUrl),
    params.logoUrl ? paraDataURL(params.logoUrl) : Promise.resolve(undefined),
  ]);
  const { data, error } = await supabase.functions.invoke("gerar-mockup-final", {
    body: {
      produtoBase64,
      logoBase64,
      tecnica: params.tecnica,
      nomeProduto: params.nomeProduto,
      produtoCodigo: params.produtoCodigo,
      cliente: params.cliente,
      pct: params.pct,
      posicao: params.posicao,
      modo: params.modo ?? "acabamento",
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

/** Modo "cenario": troca a imagem guardada no histórico pela versão final,
 * com a logo que o vendedor colou por cima. */
export async function substituirImagemGeracao(geracaoId: string, imagemDataUrl: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("gerar-mockup-final", {
    body: { acao: "substituir_imagem", geracaoId, imagemBase64: imagemDataUrl },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
