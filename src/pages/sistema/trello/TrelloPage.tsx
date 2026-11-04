import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Eye, SquareKanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { db, lerFundo, nomeUsuario } from "./api";
import { useBoardMutations, useBoards, useBoardRealtime, useSignedUrls, useUsers } from "./hooks";
import ColaboradorSelect from "./ColaboradorSelect";
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
  const { userId, isGestor, isLoading: perfilCarregando } = useUserRole();
  const { data: usuarios = [] } = useUsers();

  /* Gestor (admin/gerente) escolhe de quem é o Trello aberto; os demais só
     veem o próprio (o RLS garante). Para o gestor a lista sempre filtra por
     dono, senão misturaria os quadros de todo mundo. */
  const chaveVendo = `trello_vendo:${userId ?? "anon"}`;
  const [vendo, setVendo] = useState<string | null>(null);
  const dono = isGestor ? vendo || userId : null;
  const ehOutro = !!dono && dono !== userId;
  const nomeDono = ehOutro ? nomeUsuario(usuarios.find((u) => u.user_id === dono)) : null;

  // Gestor nunca busca sem dono (o RLS dele devolveria os quadros de todos).
  const { data: boards = [], isLoading: carregandoQuadros } = useBoards(dono, !perfilCarregando && !!userId && (!isGestor || !!dono));
  const isLoading = perfilCarregando || carregandoQuadros;
  const { criar } = useBoardMutations(dono);

  const chaveVisao = `trello_visao:${userId ?? "anon"}`;
  const chaveQuadro = `trello_quadro:${userId ?? "anon"}:${dono ?? "eu"}`;
  const [visao, setVisao] = useState<Visao>("quadro");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [cartaoAberto, setCartaoAberto] = useState<string | null>(null);

  // Restaura visão e colaborador quando o usuário é conhecido.
  useEffect(() => {
    if (!userId) return;
    const v = ler(chaveVisao);
    if (v === "quadro" || v === "calendario") setVisao(v);
    if (isGestor) setVendo(ler(chaveVendo) || null); // "" = "Meu Trello"
  }, [userId, isGestor, chaveVisao, chaveVendo]);

  // Quadro lembrado para o colaborador aberto.
  useEffect(() => {
    if (!userId) return;
    setBoardId(ler(chaveQuadro));
  }, [userId, chaveQuadro]);

  // Quadro salvo que não existe mais (ou nenhum salvo) -> primeiro da lista.
  useEffect(() => {
    if (isLoading) return;
    if (boards.length === 0) { setBoardId(null); return; }
    if (!boardId || !boards.some((b) => b.id === boardId)) setBoardId(boards[0].id);
  }, [boards, boardId, isLoading]);

  const board = useMemo(() => boards.find((b) => b.id === boardId) ?? null, [boards, boardId]);
  useBoardRealtime(board?.id ?? null);

  const selecionar = (id: string) => { setBoardId(id); gravar(chaveQuadro, id); };
  const trocarColaborador = (id: string) => {
    const novo = id === userId ? null : id;
    setVendo(novo);
    gravar(chaveVendo, novo ?? "");
    setCartaoAberto(null);
  };

  /* Notificação pode ser de cartão de outro quadro (ou de outro colaborador,
     no caso do gestor): troca para lá e abre o cartão. */
  const abrirCartaoDeQualquerQuadro = async (cardId: string) => {
    const { data } = await db.from("trello_cards")
      .select("board_id, board:trello_boards(owner_id)").eq("id", cardId).maybeSingle();
    if (!data) { toast.error("Este cartão não existe mais."); return; }
    const donoDoQuadro = (data.board as { owner_id: string } | null)?.owner_id ?? null;
    if (isGestor && donoDoQuadro && donoDoQuadro !== dono) {
      trocarColaborador(donoDoQuadro);
      gravar(`trello_quadro:${userId ?? "anon"}:${donoDoQuadro === userId ? "eu" : donoDoQuadro}`, data.board_id);
    } else if (data.board_id !== boardId) {
      selecionar(data.board_id);
    }
    setBoardId(data.board_id);
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
        colaborador={isGestor && userId ? <ColaboradorSelect userId={userId} valor={dono ?? userId} onChange={trocarColaborador} /> : null}
        nomeDono={nomeDono}
        dono={dono}
        podeExcluir={!!board && board.owner_id === userId}
      />

      {ehOutro && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--gw-blue-soft-strong)] bg-[var(--gw-blue-soft)] px-3 py-2 text-[13px] text-[var(--gw-text)]">
          <Eye className="h-4 w-4 shrink-0 text-[var(--gw-primary)]" />
          <span>
            Você está no Trello de <b>{nomeDono}</b>. Cartões e comentários que você criar aqui avisam {nomeDono} no sino,
            e a resposta volta para o seu.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse h-[60vh] rounded-[var(--gw-radius-lg)] bg-muted" />
      ) : !board ? (
        <div className="rounded-[var(--gw-radius-lg)] border border-dashed border-[var(--gw-border-strong)] bg-white p-10 text-center">
          <SquareKanban className="mx-auto h-10 w-10 text-[var(--gw-text-muted)]" />
          <h2 className="mt-3">{ehOutro ? `${nomeDono} ainda não tem quadros` : "Nenhum quadro ainda"}</h2>
          <p className="text-[14px] text-[var(--gw-text-muted)] mt-1">
            {ehOutro
              ? `Crie um quadro para ${nomeDono}; ele aparece no Trello dele(a) na hora.`
              : "Crie um quadro para organizar tarefas em colunas e no calendário."}
          </p>
          <Button
            className="mt-4 gap-1.5"
            onClick={() => criar.mutate(ehOutro ? `Quadro de ${nomeDono}` : "Meu quadro", { onSuccess: (b) => selecionar(b.id) })}
            disabled={criar.isPending}
          >
            <Plus className="h-4 w-4" /> {ehOutro ? `Criar quadro para ${nomeDono}` : "Criar primeiro quadro"}
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
