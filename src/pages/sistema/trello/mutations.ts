import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CARD_SELECT, db, normalizaCard, posicaoEntre, qk, removerArquivo,
  type Card, type CardDetail, type Column, type Label,
} from "./api";

type KanbanData = { columns: Column[]; cards: Card[] };
export type CardPatch = Partial<Pick<Card,
  "title" | "description" | "cover_url" | "due_at" | "has_time" | "completed" | "archived" | "assignee_id" | "column_id" | "position"
>>;

const falhou = (e: unknown) => toast.error((e as Error)?.message || "Não foi possível salvar. A alteração foi desfeita.");

/** Snapshot de tudo que é do quadro (Kanban, calendário, contagens) + detalhe do cartão. */
function snapshot(qc: QueryClient, boardId: string, cardId?: string) {
  const board = qc.getQueriesData({ queryKey: qk.board(boardId) });
  const card = cardId ? qc.getQueryData(qk.card(cardId)) : undefined;
  return { board, card, cardId };
}
function restaurar(qc: QueryClient, snap: ReturnType<typeof snapshot> | undefined) {
  if (!snap) return;
  for (const [key, data] of snap.board) qc.setQueryData(key, data);
  if (snap.cardId) qc.setQueryData(qk.card(snap.cardId), snap.card);
}

/** Aplica um patch no cartão em todos os caches que o mostram (atualização otimista). */
function aplicarNoCache(qc: QueryClient, boardId: string, cardId: string, patch: CardPatch) {
  qc.setQueriesData({ queryKey: qk.board(boardId) }, (old: unknown) => {
    if (!old || typeof old !== "object") return old;
    if (Array.isArray(old)) {
      // calendário: some do mês se arquivado (ou se a data saiu do intervalo — o refetch acerta)
      return (old as Card[])
        .map((c) => (c.id === cardId ? { ...c, ...patch } : c))
        .filter((c) => !c.archived);
    }
    const k = old as KanbanData;
    if (!k.cards) return old;
    return {
      ...k,
      cards: k.cards
        .map((c) => (c.id === cardId ? { ...c, ...patch } : c))
        .filter((c) => !c.archived)
        .sort((a, b) => a.position - b.position),
    };
  });
  qc.setQueryData<CardDetail>(qk.card(cardId), (old) => (old ? { ...old, card: { ...old.card, ...patch } } : old));
}

/* ------------------------------------------------------------------ */
/* Cartões                                                            */
/* ------------------------------------------------------------------ */
export function useCardMutations(boardId: string) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: qk.board(boardId) });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CardPatch }) => {
      const { error } = await db.from("trello_cards").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.board(boardId) });
      const snap = snapshot(qc, boardId, id);
      aplicarNoCache(qc, boardId, id, patch);
      return snap;
    },
    onError: (e, _v, snap) => { restaurar(qc, snap); falhou(e); },
    // Data mudou: o cartão pode ter entrado/saído de um mês do calendário.
    onSettled: (_d, _e, { patch }) => {
      if ("due_at" in patch || "archived" in patch) invalidar();
    },
  });

  const criar = useMutation({
    mutationFn: async (novo: { column_id: string; title: string; position: number; due_at?: string | null; has_time?: boolean }) => {
      const { data, error } = await db.from("trello_cards")
        .insert({ board_id: boardId, ...novo })
        .select(CARD_SELECT).single();
      if (error) throw new Error(error.message);
      return normalizaCard(data as Card);
    },
    onMutate: async (novo) => {
      await qc.cancelQueries({ queryKey: qk.kanban(boardId) });
      const snap = snapshot(qc, boardId);
      const temp: Card = {
        id: `temp-${Math.random().toString(36).slice(2)}`, board_id: boardId, description: null, cover_url: null,
        due_at: novo.due_at ?? null, has_time: novo.has_time ?? false, completed: false, archived: false, assignee_id: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        labels: [], checklist: [], attachments: [], ...novo,
      };
      qc.setQueryData<KanbanData>(qk.kanban(boardId), (old) => old ? { ...old, cards: [...old.cards, temp] } : old);
      return { snap, tempId: temp.id };
    },
    onSuccess: (card, _v, ctx) => {
      qc.setQueryData<KanbanData>(qk.kanban(boardId), (old) =>
        old ? { ...old, cards: old.cards.map((c) => (c.id === ctx?.tempId ? card : c)) } : old);
      if (card.due_at) invalidar();
    },
    onError: (e, _v, ctx) => { restaurar(qc, ctx?.snap); falhou(e); },
  });

  const excluir = useMutation({
    mutationFn: async (card: Pick<Card, "id" | "cover_url">) => {
      // Arquivos do cartão (capa e anexos) saem do bucket antes da linha.
      const { data: anexos } = await db.from("trello_attachments").select("file_url").eq("card_id", card.id);
      const paths = [card.cover_url, ...((anexos ?? []) as { file_url: string }[]).map((a) => a.file_url)].filter(Boolean) as string[];
      const { error } = await db.from("trello_cards").delete().eq("id", card.id);
      if (error) throw new Error(error.message);
      for (const p of paths) void removerArquivo(p);
    },
    onMutate: async (card) => {
      await qc.cancelQueries({ queryKey: qk.board(boardId) });
      const snap = snapshot(qc, boardId);
      aplicarNoCache(qc, boardId, card.id, { archived: true }); // some da tela na hora
      return snap;
    },
    onError: (e, _v, snap) => { restaurar(qc, snap); falhou(e); },
    onSettled: invalidar,
  });

  return { atualizar, criar, excluir };
}

/* ------------------------------------------------------------------ */
/* Colunas                                                            */
/* ------------------------------------------------------------------ */
export function useColumnMutations(boardId: string) {
  const qc = useQueryClient();
  const key = qk.kanban(boardId);

  const otimista = async (fn: (old: KanbanData) => KanbanData) => {
    await qc.cancelQueries({ queryKey: key });
    const antes = qc.getQueryData<KanbanData>(key);
    if (antes) qc.setQueryData<KanbanData>(key, fn(antes));
    return { antes };
  };
  const desfazer = (e: unknown, ctx?: { antes?: KanbanData }) => {
    if (ctx?.antes) qc.setQueryData(key, ctx.antes);
    falhou(e);
  };

  const criar = useMutation({
    mutationFn: async ({ title, position }: { title: string; position: number }) => {
      const { data, error } = await db.from("trello_columns")
        .insert({ board_id: boardId, title, position }).select("id,board_id,title,position").single();
      if (error) throw new Error(error.message);
      return { ...(data as Column), position: Number(data.position) };
    },
    onSuccess: (col) => qc.setQueryData<KanbanData>(key, (old) => old ? { ...old, columns: [...old.columns, col] } : old),
    onError: falhou,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: { id: string; title?: string; position?: number }) => {
      const { error } = await db.from("trello_columns").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: ({ id, ...campos }) => otimista((old) => ({
      ...old,
      columns: old.columns.map((c) => (c.id === id ? { ...c, ...campos } : c)).sort((a, b) => a.position - b.position),
    })),
    onError: (e, _v, ctx) => desfazer(e, ctx),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trello_columns").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: (id) => otimista((old) => ({
      columns: old.columns.filter((c) => c.id !== id),
      cards: old.cards.filter((c) => c.column_id !== id),
    })),
    onError: (e, _v, ctx) => desfazer(e, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });

  const arquivarTodos = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trello_cards").update({ archived: true }).eq("column_id", id).eq("archived", false);
      if (error) throw new Error(error.message);
    },
    onMutate: (id) => otimista((old) => ({ ...old, cards: old.cards.filter((c) => c.column_id !== id) })),
    onError: (e, _v, ctx) => desfazer(e, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });

  /** Renumera as posições (raro: só quando os "meios" esgotam a precisão). */
  const renumerar = async (tabela: "trello_columns" | "trello_cards", ids: string[]) => {
    let prev: number | null = null;
    await Promise.all(ids.map((id) => {
      const position = posicaoEntre(prev, null);
      prev = position;
      return db.from(tabela).update({ position }).eq("id", id);
    }));
    await qc.invalidateQueries({ queryKey: key });
  };

  return { criar, atualizar, excluir, arquivarTodos, renumerar };
}

/* ------------------------------------------------------------------ */
/* Etiquetas                                                          */
/* ------------------------------------------------------------------ */
export function useLabelMutations(boardId: string) {
  const qc = useQueryClient();
  const key = qk.labels(boardId);

  const criar = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await db.from("trello_labels").insert({ board_id: boardId, name, color }).select("*").single();
      if (error) throw new Error(error.message);
      return data as Label;
    },
    onSuccess: (l) => qc.setQueryData<Label[]>(key, (old) => [...(old ?? []), l]),
    onError: falhou,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: { id: string; name?: string; color?: string }) => {
      const { error } = await db.from("trello_labels").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, ...campos }) => {
      const antes = qc.getQueryData<Label[]>(key);
      qc.setQueryData<Label[]>(key, (old) => old?.map((l) => (l.id === id ? { ...l, ...campos } : l)));
      return { antes };
    },
    onError: (e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(key, ctx.antes); falhou(e); },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trello_labels").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<Label[]>(key, (old) => old?.filter((l) => l.id !== id));
      qc.invalidateQueries({ queryKey: qk.board(boardId) });
    },
    onError: falhou,
  });

  /** Liga/desliga a etiqueta no cartão (otimista em todas as visões). */
  const alternarNoCartao = useMutation({
    mutationFn: async ({ cardId, labelId, ligar }: { cardId: string; labelId: string; ligar: boolean }) => {
      const { error } = ligar
        ? await db.from("trello_card_labels").insert({ card_id: cardId, label_id: labelId })
        : await db.from("trello_card_labels").delete().eq("card_id", cardId).eq("label_id", labelId);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ cardId, labelId, ligar }) => {
      const snap = snapshot(qc, boardId, cardId);
      const mexe = (c: Card) => c.id !== cardId ? c : {
        ...c,
        labels: ligar ? [...c.labels, { label_id: labelId }] : c.labels.filter((l) => l.label_id !== labelId),
      };
      qc.setQueriesData({ queryKey: qk.board(boardId) }, (old: unknown) => {
        if (Array.isArray(old)) return (old as Card[]).map(mexe);
        const k = old as KanbanData | undefined;
        return k?.cards ? { ...k, cards: k.cards.map(mexe) } : old;
      });
      qc.setQueryData<CardDetail>(qk.card(cardId), (old) => (old ? { ...old, card: mexe(old.card) } : old));
      return snap;
    },
    onError: (e, _v, snap) => { restaurar(qc, snap); falhou(e); },
  });

  return { criar, atualizar, excluir, alternarNoCartao };
}
