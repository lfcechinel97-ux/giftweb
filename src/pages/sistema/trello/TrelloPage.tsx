import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { SquareKanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { db, lerFundo } from "./api";
import { useBoardMutations, useBoards, useBoardRealtime, useSignedUrls } from "./hooks";
import BoardHeader, { type Visao } from "./BoardHeader";
import KanbanView from "./KanbanView";
import CardDetailsDialog from "./CardDetailsDialog";
import NotificationBell from "./NotificationBell";

// Calendário em chunk separado: só baixa quando alguém abre essa visão.
const CalendarView = lazy(() => import("./CalendarView"));

/* Preferências por usuário no navegador (só conveniência; o banco não depende disso). */
const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bloqueado */ } };

export default function TrelloPage() {
  const { userId } = useUserRole();
  const { data: boards = [], isLoading } = useBoards();
  const { criar } = useBoardMutations();

  const chaveVisao = `trello_visao:${userId ?? "anon"}`;
  const chaveQuadro = `trello_quadro:${userId ?? "anon"}`;
  const [visao, setVisao] = useState<Visao>("quadro");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [cartaoAberto, setCartaoAberto] = useState<string | null>(null);

  // Restaura visão/quadro quando o usuário é conhecido.
  useEffect(() => {
    if (!userId) return;
    const v = ler(chaveVisao);
    if (v === "quadro" || v === "calendario") setVisao(v);
    const b = ler(chaveQuadro);
    if (b) setBoardId(b);
  }, [userId, chaveVisao, chaveQuadro]);

  // Quadro salvo que não existe mais (ou nenhum salvo) -> primeiro da lista.
  useEffect(() => {
    if (isLoading) return;
    if (boards.length === 0) { setBoardId(null); return; }
    if (!boardId || !boards.some((b) => b.id === boardId)) setBoardId(boards[0].id);
  }, [boards, boardId, isLoading]);

  const board = useMemo(() => boards.find((b) => b.id === boardId) ?? null, [boards, boardId]);
  useBoardRealtime(board?.id ?? null);

  const selecionar = (id: string) => { setBoardId(id); gravar(chaveQuadro, id); };

  /* Notificação pode ser de cartão de outro quadro: troca de quadro e abre. */
  const abrirCartaoDeQualquerQuadro = async (cardId: string) => {
    const { data } = await db.from("trello_cards").select("board_id").eq("id", cardId).maybeSingle();
    if (!data) { toast.error("Este cartão não existe mais."); return; }
    if (data.board_id !== boardId) selecionar(data.board_id);
    setCartaoAberto(cardId);
  };
  const mudarVisao = (v: Visao) => { setVisao(v); gravar(chaveVisao, v); };

  const fundo = lerFundo(board?.background);
  const urls = useSignedUrls([fundo?.tipo === "imagem" ? fundo.path : null]);
  const estiloFundo: React.CSSProperties =
    fundo?.tipo === "imagem" && urls[fundo.path]
      ? { backgroundImage: `url("${urls[fundo.path]}")`, backgroundSize: "cover", backgroundPosition: "center" }
      : fundo?.tipo === "cor"
        ? { background: fundo.valor }
        : { background: "var(--gw-surface-alt)" };

  return (
    <div className="flex flex-col gap-4 -mx-2 sm:mx-0">
      <BoardHeader
        boards={boards}
        board={board}
        onSelect={selecionar}
        visao={visao}
        onVisao={mudarVisao}
        extra={<NotificationBell userId={userId} onOpenCard={(id) => void abrirCartaoDeQualquerQuadro(id)} />}
      />

      {isLoading ? (
        <div className="animate-pulse h-[60vh] rounded-[var(--gw-radius-lg)] bg-muted" />
      ) : !board ? (
        <div className="rounded-[var(--gw-radius-lg)] border border-dashed border-[var(--gw-border-strong)] bg-white p-10 text-center">
          <SquareKanban className="mx-auto h-10 w-10 text-[var(--gw-text-muted)]" />
          <h2 className="mt-3">Nenhum quadro ainda</h2>
          <p className="text-[14px] text-[var(--gw-text-muted)] mt-1">Crie um quadro para organizar tarefas em colunas e no calendário.</p>
          <Button className="mt-4 gap-1.5" onClick={() => criar.mutate("Meu quadro", { onSuccess: (b) => selecionar(b.id) })} disabled={criar.isPending}>
            <Plus className="h-4 w-4" /> Criar primeiro quadro
          </Button>
        </div>
      ) : (
        <div
          className="relative rounded-[var(--gw-radius-lg)] overflow-hidden h-[calc(100vh-130px)] min-h-[420px]"
          style={estiloFundo}
        >
          {visao === "quadro" ? (
            <KanbanView board={board} onOpenCard={setCartaoAberto} />
          ) : (
            <Suspense fallback={<div className="m-3 h-[calc(100%-24px)] rounded-[var(--gw-radius-lg)] bg-white/70 animate-pulse" />}>
              <CalendarView board={board} onOpenCard={setCartaoAberto} />
            </Suspense>
          )}
        </div>
      )}

      {board && (
        <CardDetailsDialog boardId={board.id} cardId={cartaoAberto} onClose={() => setCartaoAberto(null)} />
      )}
    </div>
  );
}
