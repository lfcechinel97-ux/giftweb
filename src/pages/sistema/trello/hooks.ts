import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assinarUrls, db, fetchBoards, fetchDonos, fetchKanban, fetchLabels, fetchUsers, posicaoEntre, qk,
  type Board,
} from "./api";

/* staleTime alto + Realtime para atualizar: sem refetch a cada foco/montagem. */
const STALE = 60 * 1000;

export function useBoards(dono: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.boards(dono),
    queryFn: () => fetchBoards(dono),
    enabled,
    staleTime: 5 * STALE,
    // Trocar de colaborador não pode mostrar os quadros do anterior.
    placeholderData: undefined,
  });
}

export function useDonos(enabled: boolean) {
  return useQuery({ queryKey: qk.donos, queryFn: fetchDonos, enabled, staleTime: 5 * STALE });
}

export function useKanban(boardId: string | null) {
  return useQuery({
    queryKey: qk.kanban(boardId ?? "-"),
    queryFn: () => fetchKanban(boardId as string),
    enabled: !!boardId,
    staleTime: STALE,
    // Trocar de quadro não pode mostrar as colunas do quadro anterior.
    placeholderData: undefined,
  });
}

export function useLabels(boardId: string | null) {
  return useQuery({
    queryKey: qk.labels(boardId ?? "-"),
    queryFn: () => fetchLabels(boardId as string),
    enabled: !!boardId,
    staleTime: 5 * STALE,
    placeholderData: undefined,
  });
}

export function useUsers() {
  return useQuery({ queryKey: qk.users, queryFn: fetchUsers, staleTime: 30 * STALE });
}

/** URLs assinadas (bucket privado) em lote; valem 1h, cache de 50 min. */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const lista = useMemo(
    () => [...new Set(paths.filter((p): p is string => !!p))].sort(),
    [paths],
  );
  const q = useQuery({
    queryKey: qk.signed(lista),
    queryFn: () => assinarUrls(lista),
    enabled: lista.length > 0,
    staleTime: 50 * STALE,
    gcTime: 55 * STALE,
    placeholderData: (prev: Record<string, string> | undefined) => prev,
  });
  return q.data ?? {};
}

/**
 * Realtime do quadro ativo: qualquer mudança em colunas/cartões (de outra aba
 * ou de outro membro) invalida as consultas do quadro — com debounce, para
 * uma rajada de eventos virar um refetch só.
 */
export function useBoardRealtime(boardId: string | null) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!boardId) return;
    const invalidar = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
        qc.invalidateQueries({ queryKey: ["trello", "card"] });
      }, 500);
    };
    const ch = db
      .channel(`trello-board-${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trello_cards", filter: `board_id=eq.${boardId}` }, invalidar)
      .on("postgres_changes", { event: "*", schema: "public", table: "trello_columns", filter: `board_id=eq.${boardId}` }, invalidar)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      db.removeChannel(ch);
    };
  }, [boardId, qc]);
}

/* ------------------------------------------------------------------ */
/* Quadros                                                            */
/* ------------------------------------------------------------------ */
const COLUNAS_INICIAIS = ["A fazer", "Fazendo", "Concluído"];

/** dono: de quem é a lista aberta (null = meus quadros). Quadro novo nasce desse dono. */
export function useBoardMutations(dono: string | null = null) {
  const qc = useQueryClient();
  const lista = qk.boards(dono);
  const erro = (e: Error) => toast.error(e.message || "Não foi possível salvar");

  const criar = useMutation({
    mutationFn: async (title: string): Promise<Board> => {
      const { data, error } = await db.from("trello_boards")
        .insert({ title, background: "color:var(--gw-sidebar)", ...(dono ? { owner_id: dono } : {}) })
        .select("id,owner_id,title,background,created_at").single();
      if (error) throw new Error(error.message);
      let prev: number | null = null;
      const cols = COLUNAS_INICIAIS.map((t) => {
        const position = posicaoEntre(prev, null);
        prev = position;
        return { board_id: data.id, title: t, position };
      });
      await db.from("trello_columns").insert(cols);
      return data as Board;
    },
    onSuccess: (b) => {
      qc.setQueryData<Board[]>(lista, (old) => [...(old ?? []), b]);
      qc.invalidateQueries({ queryKey: qk.donos });
    },
    onError: erro,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: Partial<Board> & { id: string }) => {
      const { error } = await db.from("trello_boards").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, ...campos }) => {
      await qc.cancelQueries({ queryKey: lista });
      const antes = qc.getQueryData<Board[]>(lista);
      qc.setQueryData<Board[]>(lista, (old) => old?.map((b) => (b.id === id ? { ...b, ...campos } : b)));
      return { antes };
    },
    onError: (e: Error, _v, ctx) => { if (ctx?.antes) qc.setQueryData(lista, ctx.antes); erro(e); },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trello_boards").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<Board[]>(lista, (old) => old?.filter((b) => b.id !== id));
      qc.invalidateQueries({ queryKey: qk.donos });
      qc.removeQueries({ queryKey: qk.board(id) });
    },
    onError: erro,
  });

  return { criar, atualizar, excluir };
}
