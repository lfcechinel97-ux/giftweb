import { supabase } from "@/integrations/supabase/client";
import type { Tecnica } from "./types";

export interface Geracao {
  id: string;
  criado_em: string;
  user_id: string;
  vendedor_nome: string | null;
  cliente: string | null;
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

const COLUNAS =
  "id, criado_em, user_id, vendedor_nome, cliente, produto_nome, produto_codigo, tecnica, modelo, tokens_entrada, tokens_saida, tokens_total, imagem_path";

/** O RLS decide o escopo: vendedor recebe só as próprias, admin recebe todas.
 * `busca` filtra por cliente, produto, código ou vendedor. */
export async function listarGeracoes(busca = "", limite = 100): Promise<Geracao[]> {
  let q = (supabase as any)
    .from("mockup_geracoes")
    .select(COLUNAS)
    .order("criado_em", { ascending: false })
    .limit(limite);
  // Vírgula, parênteses e % quebram a sintaxe do filtro `or` do PostgREST.
  const termo = busca.replace(/[,()%*\\]/g, " ").trim();
  if (termo) {
    const p = `%${termo}%`;
    q = q.or(`cliente.ilike.${p},produto_nome.ilike.${p},produto_codigo.ilike.${p},vendedor_nome.ilike.${p}`);
  }
  const { data, error } = await q;
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
