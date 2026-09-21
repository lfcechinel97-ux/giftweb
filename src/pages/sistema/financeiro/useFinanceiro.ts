import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategorias, fetchDashboard } from "./api";
import type { DashboardFinanceiro, DespesaCategoria } from "./types";

/* Tabelas cuja mudança altera algum número da tela. */
const TABELAS_AO_VIVO = [
  "sistema_despesas",
  "sistema_recebimentos",
  "sistema_calcme_vendas",
  "sistema_calcme_venda_itens",
  "sistema_custo_produto",
] as const;

export const chaveDashboard = (inicio: string, fim: string) =>
  ["sistema", "financeiro", "dashboard", inicio, fim] as const;

/** Dados do dashboard, atualizados na hora por realtime (lançar uma
 *  despesa reflete em qualquer aba aberta, sem recarregar). */
export function useDashboardFinanceiro(inicio: string, fim: string) {
  const qc = useQueryClient();

  const query = useQuery<DashboardFinanceiro>({
    queryKey: chaveDashboard(inicio, fim),
    queryFn: () => fetchDashboard(inicio, fim),
    staleTime: 30 * 1000,
    placeholderData: (anterior) => anterior,
  });

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["sistema", "financeiro"] });
  }, [qc]);

  useEffect(() => {
    const canal = supabase.channel("financeiro-ao-vivo");
    for (const tabela of TABELAS_AO_VIVO) {
      canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabela },
        invalidar,
      );
    }
    canal.subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [invalidar]);

  return query;
}

export function useCategoriasDespesa() {
  return useQuery<DespesaCategoria[]>({
    queryKey: ["sistema", "financeiro", "categorias"],
    queryFn: fetchCategorias,
    staleTime: 10 * 60 * 1000,
  });
}
