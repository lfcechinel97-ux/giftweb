import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vendedor" | "producao";

export const ROTULO_PAPEL: Record<AppRole, string> = {
  admin: "Admin",
  vendedor: "Comercial",
  producao: "Produção",
};

/**
 * Papéis do usuário logado (tabela user_roles).
 * Nunca confie apenas nisto para segurança: as regras reais vivem no banco.
 */
export function useUserRole() {
  const { data, isLoading } = useQuery({
    queryKey: ["sistema", "user-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return { roles: [] as AppRole[], userId: null as string | null, email: null as string | null, nome: null as string | null, vendedorId: null as string | null };
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
    },
  });

  const roles = data?.roles ?? [];
  const papel: AppRole = roles.includes("admin") ? "admin" : roles.includes("producao") ? "producao" : "vendedor";
  return {
    roles,
    papel,
    isAdmin: roles.includes("admin"),
    isVendedor: roles.includes("vendedor"),
    isProducao: roles.includes("producao"),
    userId: data?.userId ?? null,
    email: data?.email ?? null,
    nome: data?.nome ?? null,
    vendedorId: data?.vendedorId ?? null,
    isLoading,
  };
}
