import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Exclui o pedido de vez (some da lista, do PCP e das reservas de estoque).
 * Se era o único pedido do orçamento, o orçamento volta para "aberto" e pode
 * ser aprovado de novo. Devolve a mensagem de erro, ou null se deu certo.
 */
export async function excluirPedidoDefinitivo(pedido: {
  id: string;
  numero: string;
  orcamentoId?: string | null;
  detalhes?: Record<string, unknown>;
}): Promise<string | null> {
  await registrarAuditoria({
    entidade: "pedido", entidadeId: pedido.id, entidadeNumero: pedido.numero,
    acao: "pedido_excluido", detalhes: pedido.detalhes,
  });

  await supabase.from("sistema_producao_itens").delete().eq("pedido_id", pedido.id);
  // Sem isso a reserva de estoque do pedido excluído ficava presa.
  await supabase.from("sistema_ajustes_estoque").delete().eq("pedido_id", pedido.id).eq("tipo", "reserva");

  const { data: apagados, error } = await supabase
    .from("sistema_pedidos").delete().eq("id", pedido.id).select("id");
  if (error) return error.message;
  if (!apagados?.length) return "Sem permissão para excluir este pedido.";

  // Orçamento sem nenhum pedido restante volta a ficar aberto.
  let orcamentoId = pedido.orcamentoId || null;
  if (orcamentoId) {
    const { count } = await supabase
      .from("sistema_pedidos").select("id", { count: "exact", head: true }).eq("orcamento_id", orcamentoId);
    if (!count) {
      await supabase.from("sistema_orcamentos")
        .update({ status: "aberto", aprovado_em: null, updated_at: new Date().toISOString() })
        .eq("id", orcamentoId).eq("status", "aprovado");
    }
  }
  return null;
}
