import { supabase } from "@/integrations/supabase/client";
import type { Tecnica } from "./types";

export interface Geracao {
  id: string;
  criado_em: string;
  produto_nome: string | null;
  produto_codigo: string | null;
  tecnica: Tecnica;
  modelo: string;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  tokens_total: number | null;
  imagem_path: string;
  /** Signed URL (bucket privado), preenchida no client. */
  imagemUrl?: string;
}

export async function listarGeracoes(limite = 50): Promise<Geracao[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];
  const { data, error } = await (supabase as any)
    .from("mockup_geracoes")
    .select("id, criado_em, produto_nome, produto_codigo, tecnica, modelo, tokens_entrada, tokens_saida, tokens_total, imagem_path")
    .eq("user_id", auth.user.id)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return assinar((data || []) as Geracao[]);
}

export async function assinar(geracoes: Geracao[]): Promise<Geracao[]> {
  if (geracoes.length === 0) return geracoes;
  const { data } = await supabase.storage
    .from("mockup-geracoes")
    .createSignedUrls(geracoes.map((g) => g.imagem_path), 60 * 60);
  const porPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return geracoes.map((g) => ({ ...g, imagemUrl: porPath.get(g.imagem_path) || undefined }));
}

export function nomeModelo(modelo: string): string {
  return modelo.replace(/^[^/]+\//, "");
}

export function formatarTokens(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("pt-BR");
}
