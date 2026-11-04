/**
 * Camada de dados do Trello do /sistema.
 *
 * Regras de performance (já tivemos queda em produção por excesso de
 * requisições): nada de buscar tudo de uma vez. O Kanban busca só o quadro
 * ativo; o calendário busca só os cartões do intervalo do mês visível;
 * detalhes do cartão só quando o modal abre. Tudo via React Query com
 * staleTime, e as chaves ficam sob ["trello", "b", boardId] para que uma
 * invalidação do quadro atualize Kanban e calendário juntos.
 */
import { supabase } from "@/integrations/supabase/client";

/* As tabelas trello_* ainda não estão no types.ts gerado; o cliente sem
   tipo evita espalhar `as any` pelo código. Os tipos ficam aqui. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export const BUCKET = "trello";

export interface Board {
  id: string;
  owner_id: string;
  title: string;
  background: string | null;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  position: number;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

/** Cartão como aparece no quadro/calendário (com contadores leves). */
export interface Card {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  due_at: string | null;
  has_time: boolean;
  completed: boolean;
  archived: boolean;
  assignee_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  labels: { label_id: string }[];
  checklist: { done: boolean }[];
  attachments: { count: number }[];
}

export interface ChecklistItem { id: string; card_id: string; text: string; done: boolean; position: number }
export interface Attachment { id: string; card_id: string; file_url: string; file_name: string; created_at: string }
export interface Comment { id: string; card_id: string; user_id: string; text: string; created_at: string }
export interface Reminder { id: string; card_id: string; user_id: string; remind_at: string; sent: boolean }
export interface Notification {
  id: string; user_id: string; card_id: string | null; title: string; body: string | null; read: boolean; created_at: string;
}
export interface Usuario { user_id: string; nome: string | null; email: string | null }

export interface CardDetail {
  card: Card;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  comments: Comment[];
  reminder: Reminder | null;
}

/* ------------------------------------------------------------------ */
/* Chaves do React Query                                              */
/* ------------------------------------------------------------------ */
export const qk = {
  all: ["trello"] as const,
  boardsAll: ["trello", "boards"] as const,
  /** Lista de quadros: do colaborador `dono` (visão do gestor) ou os meus (null). */
  boards: (dono: string | null) => ["trello", "boards", dono ?? "meus"] as const,
  donos: ["trello", "donos"] as const,
  board: (boardId: string) => ["trello", "b", boardId] as const,
  kanban: (boardId: string) => ["trello", "b", boardId, "kanban"] as const,
  labels: (boardId: string) => ["trello", "b", boardId, "labels"] as const,
  calendar: (boardId: string, from: string, to: string) => ["trello", "b", boardId, "cal", from, to] as const,
  semData: (boardId: string) => ["trello", "b", boardId, "semData"] as const,
  card: (cardId: string) => ["trello", "card", cardId] as const,
  users: ["trello", "users"] as const,
  notifications: ["trello", "notifications"] as const,
  signed: (paths: string[]) => ["trello", "signed", ...paths] as const,
};

/** Campos leves de um cartão + contadores (sem trazer textos de checklist/anexos). */
export const CARD_SELECT =
  "id,board_id,column_id,title,description,cover_url,due_at,has_time,completed,archived,assignee_id,position,created_at,updated_at," +
  "labels:trello_card_labels(label_id),checklist:trello_checklist_items(done),attachments:trello_attachments(count)";

const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data;
};

/* ------------------------------------------------------------------ */
/* Leitura                                                            */
/* ------------------------------------------------------------------ */
/**
 * dono = null: tudo que o RLS libera (os meus + os que sou membro).
 * dono = id: só os quadros daquele colaborador (gestor vê todos pelo RLS,
 * então ele SEMPRE filtra por dono — inclusive para ver os próprios).
 */
export async function fetchBoards(dono: string | null): Promise<Board[]> {
  let q = db.from("trello_boards").select("id,owner_id,title,background,created_at");
  if (dono) q = q.eq("owner_id", dono);
  return ok(await q.order("created_at"));
}

/** Quantos quadros cada colaborador tem (só para o seletor do gestor; consulta leve). */
export async function fetchDonos(): Promise<Record<string, number>> {
  const rows = ok(await db.from("trello_boards").select("owner_id")) as { owner_id: string }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.owner_id] = (out[r.owner_id] ?? 0) + 1;
  return out;
}

export async function fetchKanban(boardId: string): Promise<{ columns: Column[]; cards: Card[] }> {
  const [cols, cards] = await Promise.all([
    db.from("trello_columns").select("id,board_id,title,position").eq("board_id", boardId).order("position"),
    db.from("trello_cards").select(CARD_SELECT).eq("board_id", boardId).eq("archived", false).order("position"),
  ]);
  return { columns: ok(cols) as Column[], cards: (ok(cards) as Card[]).map(normalizaCard) };
}

export async function fetchLabels(boardId: string): Promise<Label[]> {
  return ok(await db.from("trello_labels").select("id,board_id,name,color").eq("board_id", boardId).order("name"));
}

/** Cartões com entrega no intervalo [from, to) — só o mês visível. */
export async function fetchCalendar(boardId: string, from: string, to: string): Promise<Card[]> {
  const rows = ok(
    await db.from("trello_cards").select(CARD_SELECT)
      .eq("board_id", boardId).eq("archived", false)
      .gte("due_at", from).lt("due_at", to)
      .order("due_at"),
  ) as Card[];
  return rows.map(normalizaCard);
}

/** Quantos cartões do quadro não têm data (aviso discreto no calendário). */
export async function fetchSemData(boardId: string): Promise<number> {
  const { count, error } = await db.from("trello_cards")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId).eq("archived", false).is("due_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchCardDetail(cardId: string, userId: string | null): Promise<CardDetail> {
  const [card, checklist, attachments, comments, reminder] = await Promise.all([
    db.from("trello_cards").select(CARD_SELECT).eq("id", cardId).single(),
    db.from("trello_checklist_items").select("*").eq("card_id", cardId).order("position"),
    db.from("trello_attachments").select("*").eq("card_id", cardId).order("created_at"),
    db.from("trello_comments").select("*").eq("card_id", cardId).order("created_at"),
    userId
      ? db.from("trello_reminders").select("*").eq("card_id", cardId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    card: normalizaCard(ok(card) as Card),
    checklist: ok(checklist) as ChecklistItem[],
    attachments: ok(attachments) as Attachment[],
    comments: ok(comments) as Comment[],
    reminder: ok(reminder) as Reminder | null,
  };
}

export async function fetchUsers(): Promise<Usuario[]> {
  return ok(await db.rpc("trello_listar_usuarios")) as Usuario[];
}

export async function fetchNotifications(): Promise<Notification[]> {
  return ok(
    await db.from("trello_notifications").select("*").order("created_at", { ascending: false }).limit(30),
  ) as Notification[];
}

/** numeric chega como string em alguns casos; contadores vêm aninhados. */
export function normalizaCard(c: Card): Card {
  return {
    ...c,
    position: Number(c.position),
    labels: c.labels ?? [],
    checklist: c.checklist ?? [],
    attachments: c.attachments ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Posições: fractional indexing                                      */
/* ------------------------------------------------------------------ */
export const PASSO_POSICAO = 1024;

/** Ponto médio entre os vizinhos (prev/next podem faltar nas pontas). */
export function posicaoEntre(prev?: number | null, next?: number | null): number {
  if (prev == null && next == null) return PASSO_POSICAO;
  if (prev == null) return (next as number) - PASSO_POSICAO;
  if (next == null) return prev + PASSO_POSICAO;
  return (prev + next) / 2;
}

/** Depois de muitos "meios", a diferença some na precisão do double; aí renumera. */
export function precisaRenumerar(prev?: number | null, next?: number | null): boolean {
  return prev != null && next != null && Math.abs(next - prev) < 1e-6;
}

/* ------------------------------------------------------------------ */
/* Storage (bucket privado -> URLs assinadas)                          */
/* ------------------------------------------------------------------ */
const nomeSeguro = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);

/** Sobe um arquivo em <board_id>/<pasta>/<timestamp>-<nome>; devolve o caminho. */
export async function uploadArquivo(boardId: string, pasta: string, file: File): Promise<string> {
  const path = `${boardId}/${pasta}/${Date.now()}-${nomeSeguro(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function removerArquivo(path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Uma chamada para várias URLs (capas do quadro inteiro de uma vez). */
export async function assinarUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/* ------------------------------------------------------------------ */
/* Visual                                                             */
/* ------------------------------------------------------------------ */
/** Cores de etiqueta: tokens que o /sistema já usa (nada de cor nova). */
export const CORES_ETIQUETA: { valor: string; nome: string }[] = [
  { valor: "var(--gw-success)", nome: "Verde" },
  { valor: "var(--gw-warning)", nome: "Amarelo" },
  { valor: "var(--gw-stage-producao)", nome: "Laranja" },
  { valor: "var(--gw-danger)", nome: "Vermelho" },
  { valor: "var(--gw-stage-preparacao)", nome: "Roxo" },
  { valor: "var(--gw-blue-vivid)", nome: "Azul" },
  { valor: "var(--gw-stage-embalagem)", nome: "Turquesa" },
  { valor: "var(--gw-stage-coleta)", nome: "Rosa" },
  { valor: "var(--gw-stage-organizando)", nome: "Cinza" },
];

/** Fundos de quadro em cor sólida (paleta navy/azul/verde do sistema). */
export const FUNDOS_COR = [
  "var(--gw-sidebar)",
  "var(--gw-blue-vivid)",
  "var(--gw-blue-deep)",
  "var(--gw-success)",
  "var(--gw-stage-embalagem)",
  "var(--gw-violet)",
  "var(--gw-stage-organizando)",
  "var(--gw-bg)",
];

/** background: "color:<css>" ou "image:<caminho no bucket>". */
export type Fundo = { tipo: "cor"; valor: string } | { tipo: "imagem"; path: string } | null;
export function lerFundo(bg: string | null | undefined): Fundo {
  if (!bg) return null;
  if (bg.startsWith("image:")) return { tipo: "imagem", path: bg.slice(6) };
  if (bg.startsWith("color:")) return { tipo: "cor", valor: bg.slice(6) };
  return { tipo: "cor", valor: bg };
}

export const iniciais = (nome: string | null | undefined) => {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

export const nomeUsuario = (u: Usuario | undefined) => u?.nome || u?.email?.split("@")[0] || "Usuário";
