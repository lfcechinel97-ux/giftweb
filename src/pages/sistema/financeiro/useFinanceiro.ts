import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategorias, fetchDashboard, sincronizarFinanceiro } from "./api";
import type { DashboardFinanceiro, DespesaCategoria } from "./types";

/* Tabelas cuja mudança altera algum número da tela. */
const TABELAS_AO_VIVO = [
  "sistema_despesas",
  "sistema_recebimentos",
  "sistema_calcme_vendas",
  "sistema_calcme_venda_itens",
  "sistema_custo_produto",
] as const;

/** De quanto em quanto tempo o Calcme é consultado sozinho. */
const INTERVALO_SYNC_MS = 5 * 60 * 1000;

export const chaveDashboard = (inicio: string, fim: string) =>
  ["sistema", "financeiro", "dashboard", inicio, fim] as const;

/**
 * Dados do dashboard, mantidos vivos por dois caminhos:
 *
 *  • Realtime  — lançar uma despesa ou terminar uma sync reflete na hora,
 *                em qualquer aba aberta, sem recarregar.
 *  • Auto-sync — o Calcme é puxado a cada 5 min enquanto a aba está
 *                visível. Aba em segundo plano não gasta requisição; ao
 *                voltar ao foco, sincroniza se já passou do intervalo.
 */
export function useDashboardFinanceiro(inicio: string, fim: string) {
  const qc = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  /* Evita duas syncs simultâneas: o intervalo e o retorno de foco podem
     disparar juntos, e a função é cara (7+ requisições ao Calcme). */
  const syncEmCurso = useRef(false);

  const query = useQuery<DashboardFinanceiro>({
    queryKey: chaveDashboard(inicio, fim),
    queryFn: () => fetchDashboard(inicio, fim),
    staleTime: 30 * 1000,
    placeholderData: (anterior) => anterior,
  });

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["sistema", "financeiro"] });
  }, [qc]);

  /* ── Realtime ─────────────────────────────────────────────────────── */
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

  /* ── Sincronização com o Calcme ───────────────────────────────────── */
  const sincronizar = useCallback(
    async (opts: { silencioso?: boolean; reprocessarItens?: boolean } = {}) => {
      if (syncEmCurso.current) return;
      syncEmCurso.current = true;
      setSincronizando(true);
      try {
        const r = await sincronizarFinanceiro({
          inicio,
          fim,
          reprocessarItens: opts.reprocessarItens,
        });
        setUltimaSync(new Date());
        if (!opts.silencioso) {
          if (!r.success) {
            toast.error(`Sincronização falhou: ${r.error ?? "erro desconhecido"}`);
          } else {
            const partes = [
              `${r.vendas} pedidos`,
              r.itens > 0 ? `${r.itens} itens` : null,
              r.contas > 0 ? `${r.contas} contas` : null,
            ].filter(Boolean).join(", ");
            if (r.itens_pendentes > 0) {
              toast.warning(
                `Calcme: ${partes}. Faltam ${r.itens_pendentes} pedidos com itens — sincronize de novo para continuar.`,
              );
            } else if (r.errors > 0) {
              toast.warning(`Calcme: ${partes}, ${r.errors} erro(s).`);
            } else {
              toast.success(`Calcme: ${partes}.`);
            }
          }
        }
        invalidar();
      } catch (e: unknown) {
        if (!opts.silencioso) {
          toast.error(`Sincronização falhou: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        syncEmCurso.current = false;
        setSincronizando(false);
      }
    },
    [inicio, fim, invalidar],
  );

  /* Guarda a versão corrente para o efeito do timer não reiniciar a cada
     mudança de período — o intervalo continua correndo. */
  const sincronizarRef = useRef(sincronizar);
  useEffect(() => { sincronizarRef.current = sincronizar; }, [sincronizar]);

  useEffect(() => {
    let ultimaTentativa = 0;
    const talvezSincronizar = () => {
      if (document.visibilityState !== "visible") return;
      const agora = Date.now();
      if (agora - ultimaTentativa < INTERVALO_SYNC_MS) return;
      ultimaTentativa = agora;
      void sincronizarRef.current({ silencioso: true });
    };

    talvezSincronizar();                       // ao abrir a tela
    const timer = window.setInterval(talvezSincronizar, 60 * 1000);
    document.addEventListener("visibilitychange", talvezSincronizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", talvezSincronizar);
    };
  }, []);

  return { ...query, sincronizar, sincronizando, ultimaSync };
}

export function useCategoriasDespesa() {
  return useQuery<DespesaCategoria[]>({
    queryKey: ["sistema", "financeiro", "categorias"],
    queryFn: fetchCategorias,
    staleTime: 10 * 60 * 1000,
  });
}
