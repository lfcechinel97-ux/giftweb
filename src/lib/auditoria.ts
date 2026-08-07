import { supabase } from "@/integrations/supabase/client";

export type AuditoriaEntidade = "pedido" | "orcamento";

/**
 * Registra uma alteração no histórico (sistema_auditoria).
 * Nunca quebra o fluxo do usuário: falhas apenas são logadas.
 */
export async function registrarAuditoria(params: {
  entidade: AuditoriaEntidade;
  entidadeId: string;
  entidadeNumero?: string;
  acao: string;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("sistema_auditoria").insert({
      entidade: params.entidade,
      entidade_id: params.entidadeId,
      entidade_numero: params.entidadeNumero ?? null,
      acao: params.acao,
      detalhes: (params.detalhes ?? {}) as never,
      usuario_id: auth?.user?.id ?? null,
      usuario_email: auth?.user?.email ?? null,
    });
    if (error) console.error("[auditoria]", error);
  } catch (e) {
    console.error("[auditoria]", e);
  }
}
