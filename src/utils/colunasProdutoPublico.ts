import type { Tables } from "@/integrations/supabase/types";

/**
 * Colunas de products_cache que o site público pode ler. Sem preco_custo e
 * tabela_precos (visitante anônimo não tem permissão nessas colunas -- um
 * select("*") falharia). Coluna nova em products_cache que o site precise
 * mostrar entra aqui E num `grant select (coluna) ... to anon`.
 */
export const COLUNAS_PRODUTO_PUBLICO =
  "altura,ativo,busca,categoria,categoria_manual,codigo_amigavel,codigo_prefixo,cor,created_at,descricao,estoque,estoque_total,featured_position,has_image,id,image_url,image_urls,is_featured,is_hidden,is_variante,largura,marca,nome,peso,preco_base,preco_faixas,produto_pai,profundidade,site_link,slug,sort_estoque,ultima_sync,updated_at,variantes,variantes_count";

export type ProdutoPublico = Omit<Tables<"products_cache">, "preco_custo" | "preco_custo_manual" | "tabela_precos">;
