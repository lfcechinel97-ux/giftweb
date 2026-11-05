import { supabase } from "@/integrations/supabase/client";

/** Uma geração registrada em catalogo_whatsapp_historico. */
export interface GeracaoCatalogo {
  id: string;
  created_at: string;
  usuario: string | null;
  titulo: string;
  codigos: string[];
  nao_encontrados: string[];
  paginas: number;
}

// tabela nova, ainda fora dos tipos gerados do Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Últimas gerações (mais recente primeiro). */
export async function carregarHistorico(limite = 200): Promise<GeracaoCatalogo[]> {
  const { data, error } = await db
    .from("catalogo_whatsapp_historico")
    .select("id,created_at,usuario,titulo,codigos,nao_encontrados,paginas")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as GeracaoCatalogo[];
}

export async function registrarGeracao(g: { titulo: string; codigos: string[]; naoEncontrados: string[]; paginas: number }) {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  const { error } = await db.from("catalogo_whatsapp_historico").insert({
    user_id: user?.id,
    usuario: user?.email ?? null,
    titulo: g.titulo,
    codigos: g.codigos,
    nao_encontrados: g.naoEncontrados,
    paginas: g.paginas,
  });
  if (error) throw new Error(error.message);
}
