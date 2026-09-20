import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vendedor" | "producao";

export const ROTULO_PAPEL: Record<AppRole, string> = {
  admin: "Admin",
  vendedor: "Comercial",
  producao: "Produção",
};

export interface Perfil {
  roles: AppRole[];
  userId: string | null;
  email: string | null;
  nome: string | null;
  vendedorId: string | null;
}

export const PERFIL_QUERY_KEY = ["sistema", "user-roles"] as const;

async function buscarPerfil(): Promise<Perfil> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { roles: [], userId: null, email: null, nome: null, vendedorId: null };
  const [{ data: rows }, { data: perfil }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", uid),
    (supabase as any).from("admin_users").select("nome, vendedor_id").eq("id", uid).maybeSingle(),
  ]);
  return {
    roles: ((rows ?? []) as { role: AppRole }[]).map(r => r.role),
    userId: uid,
    email: auth?.user?.email ?? null,
    nome: (perfil?.nome as string | null) ?? null,
    vendedorId: (perfil?.vendedor_id as string | null) ?? null,
  };
}

const papelDe = (roles: AppRole[]): AppRole =>
  roles.includes("admin") ? "admin" : roles.includes("producao") ? "producao" : "vendedor";

/* Comercial só enxerga as próprias vendas; sem vendedor vinculado não enxerga
   nenhuma (id que nunca casa), em vez de cair no "ver tudo". */
const NENHUM_VENDEDOR = "00000000-0000-0000-0000-000000000000";
export const vendedorRestritoDe = (p: Perfil): string | null =>
  papelDe(p.roles) === "vendedor" ? (p.vendedorId ?? NENHUM_VENDEDOR) : null;

/** Perfil garantido (do cache ou do banco) para usar antes de uma consulta. */
export const obterPerfil = (qc: QueryClient) =>
  qc.fetchQuery({ queryKey: PERFIL_QUERY_KEY, queryFn: buscarPerfil, staleTime: 5 * 60 * 1000 });

/**
 * Papéis do usuário logado (tabela user_roles).
 * Nunca confie apenas nisto para segurança: as regras reais vivem no banco.
 */
export function useUserRole() {
  const { data, isLoading } = useQuery({
    queryKey: PERFIL_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: buscarPerfil,
  });

  const roles = data?.roles ?? [];
  return {
    roles,
    papel: papelDe(roles),
    isAdmin: roles.includes("admin"),
    isVendedor: roles.includes("vendedor"),
    isProducao: roles.includes("producao"),
    userId: data?.userId ?? null,
    email: data?.email ?? null,
    nome: data?.nome ?? null,
    vendedorId: data?.vendedorId ?? null,
    vendedorRestrito: data ? vendedorRestritoDe(data) : null,
    isLoading,
  };
}
