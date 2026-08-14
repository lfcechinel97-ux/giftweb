import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vendedor" | "producao";

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
      if (!uid) return { roles: [] as AppRole[], userId: null as string | null, email: null as string | null };
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return {
        roles: ((rows ?? []) as { role: AppRole }[]).map(r => r.role),
        userId: uid,
        email: auth?.user?.email ?? null,
      };
    },
  });

  const roles = data?.roles ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isVendedor: roles.includes("vendedor"),
    isProducao: roles.includes("producao"),
    userId: data?.userId ?? null,
    email: data?.email ?? null,
    isLoading,
  };
}
