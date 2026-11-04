import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlignLeft, Archive, ArchiveRestore, CheckSquare, Clock, CreditCard, ImageIcon, Loader2, MessageSquare,
  Paperclip, Pencil, Plus, Tag, Trash2, User as UserIcon, X, ExternalLink, Columns3,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useUserRole } from "@/hooks/useUserRole";
import {
  CORES_ETIQUETA, assinarUrls, db, fetchCardDetail, nomeUsuario, posicaoEntre, qk, removerArquivo, uploadArquivo,
  type Card, type CardDetail, type ChecklistItem, type Label, type Usuario,
} from "./api";
import { useKanban, useLabels, useSignedUrls, useUsers } from "./hooks";
import { useCardMutations, useLabelMutations } from "./mutations";
import { Avatar, DueBadge, LabelChips } from "./cardUi";
import { InlineInput } from "./KanbanView";

interface Props {
  boardId: string;
  cardId: string | null;
  onClose: () => void;
  /** Bloco de lembrete (injetado pela parte de lembretes). */
  renderLembrete?: (card: Card, detalhe: CardDetail) => React.ReactNode;
  /** Chamado depois que a data de entrega muda (para recalcular lembretes). */
  onDueChange?: (card: Card, novoDue: string | null) => void;
}

export default function CardDetailsDialog({ boardId, cardId, onClose, renderLembrete, onDueChange }: Props) {
  const { userId } = useUserRole();
  const { data, isLoading } = useQuery({
    queryKey: qk.card(cardId ?? "-"),
    queryFn: () => fetchCardDetail(cardId as string, userId),
    enabled: !!cardId,
    staleTime: 30 * 1000,
    placeholderData: undefined,
  });

  return (
    <Dialog open={!!cardId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sistema-theme max-w-[860px] w-[calc(100vw-16px)] p-0 gap-0 max-h-[92vh] overflow-y-auto">
        {!data || isLoading ? (
          <div className="p-8 space-y-3">
            <DialogTitle className="sr-only">Carregando cartão</DialogTitle>
            <DialogDescription className="sr-only">Detalhes do cartão</DialogDescription>
            <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <Conteudo
            key={data.card.id}
            boardId={boardId}
            detalhe={data}
            onClose={onClose}
            renderLembrete={renderLembrete}
            onDueChange={onDueChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Salvamento automático com debounce (e flush ao fechar)              */
/* ------------------------------------------------------------------ */
function useAutoSave(valor: string, original: string, salvar: (v: string) => void, atraso = 700) {
  const [status, setStatus] = useState<"" | "salvando" | "salvo">("");
  const pendente = useRef<string | null>(null);
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  useEffect(() => {
    if (valor === original) { pendente.current = null; return; }
    pendente.current = valor;
    setStatus("salvando");
    const t = setTimeout(() => {
      pendente.current = null;
      salvarRef.current(valor);
      setStatus("salvo");
    }, atraso);
    return () => clearTimeout(t);
  }, [valor, original, atraso]);

  // Fechou o modal antes do debounce: salva o que faltou.
  useEffect(() => () => { if (pendente.current !== null) salvarRef.current(pendente.current); }, []);
  return status;
}

function Conteudo({
  boardId, detalhe, onClose, renderLembrete, onDueChange,
}: {
  boardId: string;
  detalhe: CardDetail;
  onClose: () => void;
  renderLembrete?: Props["renderLembrete"];
  onDueChange?: Props["onDueChange"];
}) {
  const qc = useQueryClient();
  const { userId } = useUserRole();
  const { card, checklist, attachments, comments } = detalhe;
  const { data: kanban } = useKanban(boardId);
  const { data: labels = [] } = useLabels(boardId);
  const { data: usuarios = [] } = useUsers();
  const userMap = useMemo(() => new Map<string, Usuario>(usuarios.map((u) => [u.user_id, u])), [usuarios]);
  const cardMut = useCardMutations(boardId);
  const patch = (p: Parameters<typeof cardMut.atualizar.mutate>[0]["patch"]) => cardMut.atualizar.mutate({ id: card.id, patch: p });

  const invalidarCard = () => {
    qc.invalidateQueries({ queryKey: qk.card(card.id) });
    qc.invalidateQueries({ queryKey: qk.board(boardId) }); // contadores do cartão no quadro
  };

  /* Título e descrição: estado local + autosave. */
  const [titulo, setTitulo] = useState(card.title);
  const [descricao, setDescricao] = useState(card.description ?? "");
  const stTitulo = useAutoSave(titulo.trim() || card.title, card.title, (v) => patch({ title: v }));
  const stDesc = useAutoSave(descricao, card.description ?? "", (v) => patch({ description: v || null }));
  const statusSalvo = stTitulo === "salvando" || stDesc === "salvando" ? "Salvando…" : stTitulo === "salvo" || stDesc === "salvo" ? "Salvo" : "";

  const coluna = kanban?.columns.find((c) => c.id === card.column_id);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const capaInput = useRef<HTMLInputElement>(null);
  const anexoInput = useRef<HTMLInputElement>(null);
  const checklistInput = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<"" | "capa" | "anexo">("");

  const urls = useSignedUrls([card.cover_url, ...attachments.filter((a) => ehImagem(a.file_name)).map((a) => a.file_url)]);

  /* Capa */
  const enviarCapa = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("A capa precisa ser uma imagem"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem maior que 8 MB"); return; }
    setEnviando("capa");
    try {
      const path = await uploadArquivo(boardId, card.id, file);
      const antiga = card.cover_url;
      patch({ cover_url: path });
      if (antiga && !attachments.some((a) => a.file_url === antiga)) void removerArquivo(antiga);
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(""); }
  };
  const removerCapa = () => {
    const antiga = card.cover_url;
    patch({ cover_url: null });
    if (antiga && !attachments.some((a) => a.file_url === antiga)) void removerArquivo(antiga);
  };

  /* Anexos */
  const enviarAnexo = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo maior que 20 MB"); return; }
    setEnviando("anexo");
    try {
      const path = await uploadArquivo(boardId, card.id, file);
      const { error } = await db.from("trello_attachments").insert({ card_id: card.id, file_url: path, file_name: file.name });
      if (error) { void removerArquivo(path); throw new Error(error.message); }
      invalidarCard();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(""); }
  };
  const abrirAnexo = async (path: string) => {
    const janela = window.open("", "_blank"); // abre já no clique (evita bloqueio de pop-up)
    try {
      const mapa = await assinarUrls([path]);
      if (janela && mapa[path]) janela.location.href = mapa[path];
    } catch (e) { janela?.close(); toast.error((e as Error).message); }
  };
  const excluirAnexo = useMutation({
    mutationFn: async (a: { id: string; file_url: string }) => {
      const { error } = await db.from("trello_attachments").delete().eq("id", a.id);
      if (error) throw new Error(error.message);
      if (card.cover_url === a.file_url) patch({ cover_url: null });
      void removerArquivo(a.file_url);
    },
    onSuccess: invalidarCard,
    onError: (e: Error) => toast.error(e.message),
  });

  /* Checklist (otimista no detalhe) */
  const setChecklist = (fn: (l: ChecklistItem[]) => ChecklistItem[]) =>
    qc.setQueryData<CardDetail>(qk.card(card.id), (old) => (old ? { ...old, checklist: fn(old.checklist) } : old));
  const checklistMut = useMutation({
    mutationFn: async (op: { tipo: "add"; text: string } | { tipo: "upd"; id: string; campos: Partial<ChecklistItem> } | { tipo: "del"; id: string }) => {
      if (op.tipo === "add") {
        const ultimo = checklist[checklist.length - 1]?.position;
        const { error } = await db.from("trello_checklist_items").insert({ card_id: card.id, text: op.text, position: posicaoEntre(ultimo != null ? Number(ultimo) : null, null) });
        if (error) throw new Error(error.message);
      } else if (op.tipo === "upd") {
        const { error } = await db.from("trello_checklist_items").update(op.campos).eq("id", op.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("trello_checklist_items").delete().eq("id", op.id);
        if (error) throw new Error(error.message);
      }
    },
    onMutate: (op) => {
      const antes = qc.getQueryData<CardDetail>(qk.card(card.id));
      if (op.tipo === "upd") setChecklist((l) => l.map((i) => (i.id === op.id ? { ...i, ...op.campos } : i)));
      if (op.tipo === "del") setChecklist((l) => l.filter((i) => i.id !== op.id));
      if (op.tipo === "add") setChecklist((l) => [...l, { id: `temp-${Date.now()}`, card_id: card.id, text: op.text, done: false, position: Infinity }]);
      return { antes };
    },
    onError: (e: Error, _op, ctx) => { if (ctx?.antes) qc.setQueryData(qk.card(card.id), ctx.antes); toast.error(e.message); },
    onSettled: invalidarCard,
  });
  const [novoItem, setNovoItem] = useState("");
  const [editandoItem, setEditandoItem] = useState<string | null>(null);
  const feitos = checklist.filter((i) => i.done).length;

  /* Comentários */
  const [comentario, setComentario] = useState("");
  const comentarMut = useMutation({
    mutationFn: async (op: { tipo: "add"; text: string } | { tipo: "del"; id: string }) => {
      const { error } = op.tipo === "add"
        ? await db.from("trello_comments").insert({ card_id: card.id, text: op.text })
        : await db.from("trello_comments").delete().eq("id", op.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.card(card.id) }),
    onError: (e: Error) => toast.error(e.message),
  });

  /* Mover de coluna (vai para o fim da coluna escolhida) */
  const moverPara = (columnId: string) => {
    if (columnId === card.column_id) return;
    const naColuna = (kanban?.cards ?? []).filter((c) => c.column_id === columnId);
    const ultimo = naColuna[naColuna.length - 1]?.position;
    patch({ column_id: columnId, position: posicaoEntre(ultimo, null) });
  };

  const arquivar = () => {
    patch({ archived: true });
    onClose();
    toast("Cartão arquivado", { action: { label: "Desfazer", onClick: () => cardMut.atualizar.mutate({ id: card.id, patch: { archived: false } }) } });
  };

  const mudarEntrega = (due_at: string | null, has_time: boolean) => {
    patch({ due_at, has_time });
    onDueChange?.({ ...card, due_at, has_time }, due_at);
  };

  const capaUrl = card.cover_url ? urls[card.cover_url] : undefined;

  return (
    <div className="text-[var(--gw-text)]">
      {/* Capa */}
      {card.cover_url && (
        <div className="relative h-40 sm:h-48 bg-[var(--gw-surface-alt)]">
          {capaUrl && <img src={capaUrl} alt="" className="w-full h-full object-contain" />}
          <div className="absolute right-3 bottom-3 flex gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5 shadow" onClick={() => capaInput.current?.click()} disabled={enviando === "capa"}>
              {enviando === "capa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Trocar capa
            </Button>
            <Button size="sm" variant="secondary" className="gap-1.5 shadow" onClick={removerCapa}>
              <X className="h-4 w-4" /> Remover
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6">
        {/* Título */}
        <div className="flex items-start gap-3 pr-8">
          <CreditCard className="h-5 w-5 mt-1.5 shrink-0 text-[var(--gw-text-muted)]" />
          <div className="flex-1 min-w-0">
            <DialogTitle asChild>
              <textarea
                value={titulo}
                rows={1}
                maxLength={500}
                onChange={(e) => setTitulo(e.target.value.replace(/\n/g, " "))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                className="w-full resize-none bg-transparent rounded-[8px] px-1.5 -mx-1.5 py-1 text-[20px] font-semibold leading-tight outline-none focus:bg-white focus:ring-2 focus:ring-[var(--gw-primary)]/30 [field-sizing:content]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
              />
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[var(--gw-text-muted)] flex items-center gap-2 flex-wrap">
              <span>na coluna <b className="font-semibold text-[var(--gw-text-secondary)]">{coluna?.title ?? "—"}</b></span>
              {card.archived && <span className="rounded px-1.5 py-0.5 bg-[var(--gw-warning-soft)] text-[12px]">Arquivado</span>}
              {statusSalvo && <span className="text-[12px]">· {statusSalvo}</span>}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[1fr_190px]">
          {/* ---------- Principal ---------- */}
          <div className="min-w-0 space-y-6">
            {/* Meta: etiquetas, entrega, responsável, concluído */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {card.labels.length > 0 && (
                <Meta titulo="Etiquetas">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <LabelChips ids={card.labels.map((l) => l.label_id)} labels={labels} />
                    <EtiquetasPopover boardId={boardId} card={card} labels={labels}>
                      <button type="button" className="h-6 w-7 rounded-[4px] bg-[var(--gw-bg)] hover:bg-[var(--gw-border)] flex items-center justify-center" aria-label="Editar etiquetas">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </EtiquetasPopover>
                  </div>
                </Meta>
              )}
              {card.due_at && (
                <Meta titulo="Entrega">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={card.completed}
                      onCheckedChange={(v) => patch({ completed: !!v })}
                      aria-label="Marcar como concluído"
                    />
                    <EntregaPopover card={card} onSalvar={mudarEntrega}>
                      <button type="button" className="rounded-[6px] bg-[var(--gw-bg)] hover:bg-[var(--gw-border)] px-1.5 py-1">
                        <DueBadge card={card} />
                      </button>
                    </EntregaPopover>
                  </div>
                </Meta>
              )}
              {card.assignee_id && (
                <Meta titulo="Responsável">
                  <div className="flex items-center gap-2">
                    <Avatar usuario={userMap.get(card.assignee_id)} tamanho={28} />
                    <span className="text-[14px]">{nomeUsuario(userMap.get(card.assignee_id))}</span>
                  </div>
                </Meta>
              )}
              {!card.due_at && (
                <Meta titulo="Status">
                  <label className="flex items-center gap-2 text-[14px] cursor-pointer">
                    <Checkbox checked={card.completed} onCheckedChange={(v) => patch({ completed: !!v })} /> Concluído
                  </label>
                </Meta>
              )}
            </div>

            {renderLembrete?.(card, detalhe)}

            {/* Descrição */}
            <Secao icone={AlignLeft} titulo="Descrição / observações">
              <textarea
                value={descricao}
                maxLength={10000}
                placeholder="Adicione uma descrição mais detalhada…"
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full min-h-[96px] rounded-[10px] border border-[var(--gw-border)] bg-white px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[var(--gw-primary)] focus:ring-2 focus:ring-[var(--gw-primary)]/20 [field-sizing:content]"
              />
            </Secao>

            {/* Checklist */}
            <Secao icone={CheckSquare} titulo="Checklist">
              {checklist.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] w-9 text-[var(--gw-text-muted)]">{Math.round((feitos / checklist.length) * 100)}%</span>
                  <Progress
                    value={(feitos / checklist.length) * 100}
                    className={`h-2 flex-1 ${feitos === checklist.length ? "[&>div]:bg-[var(--gw-success)]" : "[&>div]:bg-[var(--gw-primary)]"}`}
                  />
                </div>
              )}
              <ul className="space-y-1">
                {checklist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 rounded-[8px] px-1 py-1 hover:bg-[var(--gw-surface-alt)]">
                    <Checkbox
                      checked={item.done}
                      disabled={item.id.startsWith("temp-")}
                      onCheckedChange={(v) => checklistMut.mutate({ tipo: "upd", id: item.id, campos: { done: !!v } })}
                    />
                    {editandoItem === item.id ? (
                      <InlineInput
                        valor={item.text}
                        className="text-[14px]"
                        onSalvar={(t) => { setEditandoItem(null); if (t && t !== item.text) checklistMut.mutate({ tipo: "upd", id: item.id, campos: { text: t } }); }}
                        onCancelar={() => setEditandoItem(null)}
                      />
                    ) : (
                      <span
                        className={`flex-1 min-w-0 text-[14px] break-words cursor-text ${item.done ? "line-through text-[var(--gw-text-muted)]" : ""}`}
                        onClick={() => !item.id.startsWith("temp-") && setEditandoItem(item.id)}
                      >
                        {item.text}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => checklistMut.mutate({ tipo: "del", id: item.id })}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-7 w-7 rounded-[6px] flex items-center justify-center text-[var(--gw-text-muted)] hover:bg-black/5"
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2 mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = novoItem.trim();
                  if (!t) return;
                  checklistMut.mutate({ tipo: "add", text: t });
                  setNovoItem("");
                }}
              >
                <input
                  ref={checklistInput}
                  value={novoItem}
                  maxLength={300}
                  onChange={(e) => setNovoItem(e.target.value)}
                  placeholder="Adicionar um item"
                  className="flex-1 min-w-0 rounded-[8px] border border-[var(--gw-border)] bg-white px-3 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={!novoItem.trim()}>Adicionar</Button>
              </form>
            </Secao>

            {/* Anexos */}
            {(attachments.length > 0 || enviando === "anexo") && (
              <Secao icone={Paperclip} titulo="Anexos">
                <ul className="space-y-2">
                  {attachments.map((a) => {
                    const img = ehImagem(a.file_name);
                    return (
                      <li key={a.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void abrirAnexo(a.file_url)}
                          className="h-14 w-20 shrink-0 rounded-[8px] bg-[var(--gw-bg)] overflow-hidden flex items-center justify-center text-[11px] font-bold uppercase text-[var(--gw-text-muted)]"
                        >
                          {img && urls[a.file_url] ? <img src={urls[a.file_url]} alt="" className="h-full w-full object-cover" /> : extensao(a.file_name)}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => void abrirAnexo(a.file_url)} className="block max-w-full truncate text-left text-[14px] font-semibold hover:underline">
                            {a.file_name} <ExternalLink className="inline h-3 w-3 ml-0.5 opacity-60" />
                          </button>
                          <div className="flex flex-wrap gap-x-3 text-[12px] text-[var(--gw-text-muted)]">
                            <span>{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</span>
                            {img && card.cover_url !== a.file_url && (
                              <button type="button" className="hover:underline" onClick={() => patch({ cover_url: a.file_url })}>Tornar capa</button>
                            )}
                            {card.cover_url === a.file_url && <span>É a capa</span>}
                            <button type="button" className="hover:underline text-[var(--gw-danger)]" onClick={() => excluirAnexo.mutate(a)}>Excluir</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {enviando === "anexo" && (
                    <li className="flex items-center gap-2 text-[13px] text-[var(--gw-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</li>
                  )}
                </ul>
              </Secao>
            )}

            {/* Comentários */}
            <Secao icone={MessageSquare} titulo="Comentários">
              <div className="flex gap-2 items-start">
                <Avatar usuario={userId ? userMap.get(userId) : undefined} tamanho={30} />
                <div className="flex-1 min-w-0">
                  <textarea
                    value={comentario}
                    maxLength={4000}
                    placeholder="Escrever um comentário…"
                    onChange={(e) => setComentario(e.target.value)}
                    className="w-full min-h-[40px] rounded-[10px] border border-[var(--gw-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--gw-primary)] [field-sizing:content]"
                  />
                  {comentario.trim() && (
                    <Button
                      size="sm"
                      className="mt-1.5"
                      disabled={comentarMut.isPending}
                      onClick={() => comentarMut.mutate({ tipo: "add", text: comentario.trim() }, { onSuccess: () => setComentario("") })}
                    >
                      Comentar
                    </Button>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-3">
                {[...comments].reverse().map((c) => (
                  <li key={c.id} className="flex gap-2 items-start">
                    <Avatar usuario={userMap.get(c.user_id)} tamanho={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <b className="font-semibold">{nomeUsuario(userMap.get(c.user_id))}</b>{" "}
                        <span className="text-[var(--gw-text-muted)]" title={format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}>
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </p>
                      <p className="mt-1 rounded-[10px] bg-white border border-[var(--gw-border)] px-3 py-2 text-[14px] whitespace-pre-wrap break-words">{c.text}</p>
                      {c.user_id === userId && (
                        <button type="button" className="text-[12px] text-[var(--gw-text-muted)] hover:underline mt-0.5" onClick={() => comentarMut.mutate({ tipo: "del", id: c.id })}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Secao>
          </div>

          {/* ---------- Ações ---------- */}
          <aside className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[var(--gw-text-label)]">Adicionar ao cartão</p>
              <EtiquetasPopover boardId={boardId} card={card} labels={labels}>
                <Acao icone={Tag}>Etiquetas</Acao>
              </EtiquetasPopover>
              <Acao icone={CheckSquare} onClick={() => checklistInput.current?.focus()}>Checklist</Acao>
              <EntregaPopover card={card} onSalvar={mudarEntrega}>
                <Acao icone={Clock}>Datas</Acao>
              </EntregaPopover>
              <Acao icone={ImageIcon} onClick={() => capaInput.current?.click()} carregando={enviando === "capa"}>
                {card.cover_url ? "Trocar capa" : "Capa"}
              </Acao>
              <Acao icone={Paperclip} onClick={() => anexoInput.current?.click()} carregando={enviando === "anexo"}>Anexo</Acao>
            </div>

            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[var(--gw-text-label)] flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Responsável</p>
              <Select value={card.assignee_id ?? "__nenhum"} onValueChange={(v) => patch({ assignee_id: v === "__nenhum" ? null : v })}>
                <SelectTrigger className="h-9 text-[13px] bg-[var(--gw-bg)] border-0"><SelectValue /></SelectTrigger>
                <SelectContent className="sistema-theme">
                  <SelectItem value="__nenhum">Ninguém</SelectItem>
                  {usuarios.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{nomeUsuario(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[var(--gw-text-label)] flex items-center gap-1"><Columns3 className="h-3.5 w-3.5" /> Mover para</p>
              <Select value={card.column_id} onValueChange={moverPara}>
                <SelectTrigger className="h-9 text-[13px] bg-[var(--gw-bg)] border-0"><SelectValue /></SelectTrigger>
                <SelectContent className="sistema-theme">
                  {(kanban?.columns ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[var(--gw-text-label)]">Ações</p>
              {card.archived ? (
                <Acao icone={ArchiveRestore} onClick={() => patch({ archived: false })}>Desarquivar</Acao>
              ) : (
                <Acao icone={Archive} onClick={arquivar}>Arquivar</Acao>
              )}
              <Acao icone={Trash2} perigo onClick={() => setConfirmarExclusao(true)}>Excluir</Acao>
            </div>
          </aside>
        </div>
      </div>

      <input ref={capaInput} type="file" accept="image/*" className="hidden" onChange={(e) => { void enviarCapa(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={anexoInput} type="file" className="hidden" onChange={(e) => { void enviarAnexo(e.target.files?.[0]); e.target.value = ""; }} />

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cartão?</AlertDialogTitle>
            <AlertDialogDescription>Checklist, anexos, comentários e lembretes também serão apagados. Para só tirar do quadro, use "Arquivar".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--gw-danger)] hover:bg-[var(--gw-danger)]/90"
              onClick={() => { cardMut.excluir.mutate({ id: card.id, cover_url: card.cover_url }); onClose(); }}
            >
              Excluir cartão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                              */
/* ------------------------------------------------------------------ */
const ehImagem = (nome: string) => /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(nome);
const extensao = (nome: string) => (nome.split(".").pop() ?? "").slice(0, 4) || "arq";

function Meta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--gw-text-label)] mb-1">{titulo}</p>
      {children}
    </div>
  );
}

function Secao({ icone: Icone, titulo, children }: { icone: typeof AlignLeft; titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 mb-2 text-[15px]"><Icone className="h-4 w-4 text-[var(--gw-text-muted)]" /> {titulo}</h3>
      {children}
    </section>
  );
}

type AcaoProps = {
  icone: typeof AlignLeft;
  children: React.ReactNode;
  perigo?: boolean;
  carregando?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/* forwardRef: o PopoverTrigger (asChild) precisa do ref para posicionar o popover. */
const Acao = forwardRef<HTMLButtonElement, AcaoProps>(function Acao(
  { icone: Icone, children, perigo, carregando, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={carregando || disabled}
      {...rest}
      className={`w-full flex items-center gap-2 rounded-[8px] px-3 h-9 text-[13.5px] font-medium bg-[var(--gw-bg)] hover:bg-[var(--gw-border)] transition-colors disabled:opacity-60 ${
        perigo ? "text-[var(--gw-danger)]" : "text-[var(--gw-text)]"
      }`}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icone className="h-4 w-4" />}
      {children}
    </button>
  );
});

/** Data + hora de entrega. Sem hora, grava ao meio-dia local (não muda de dia por fuso). */
export function EntregaPopover({
  card, onSalvar, children,
}: {
  card: Pick<Card, "due_at" | "has_time">;
  onSalvar: (due_at: string | null, has_time: boolean) => void;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = card.due_at ? new Date(card.due_at) : null;
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [comHora, setComHora] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setData(atual ? format(atual, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setHora(atual && card.has_time ? format(atual, "HH:mm") : "09:00");
    setComHora(atual ? card.has_time : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const salvar = () => {
    if (!data) return;
    const [y, m, d] = data.split("-").map(Number);
    const [hh, mm] = (comHora ? hora || "09:00" : "12:00").split(":").map(Number);
    onSalvar(new Date(y, m - 1, d, hh, mm).toISOString(), comHora);
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="sistema-theme w-64 space-y-3">
        <p className="text-[13px] font-semibold text-center">Data de entrega</p>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-full rounded-[8px] border border-[var(--gw-border)] px-2.5 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
        />
        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <Checkbox checked={comHora} onCheckedChange={(v) => setComHora(!!v)} /> Definir horário
        </label>
        {comHora && (
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-full rounded-[8px] border border-[var(--gw-border)] px-2.5 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={salvar} disabled={!data}>Salvar</Button>
          {card.due_at && (
            <Button size="sm" variant="outline" onClick={() => { onSalvar(null, false); setAberto(false); }}>Remover</Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EtiquetasPopover({
  boardId, card, labels, children,
}: {
  boardId: string;
  card: Card;
  labels: Label[];
  children: React.ReactNode;
}) {
  const mut = useLabelMutations(boardId);
  const [editando, setEditando] = useState<Label | "nova" | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_ETIQUETA[0].valor);
  const marcadas = new Set(card.labels.map((l) => l.label_id));

  const abrirEditor = (l: Label | "nova") => {
    setEditando(l);
    setNome(l === "nova" ? "" : l.name);
    setCor(l === "nova" ? CORES_ETIQUETA[0].valor : l.color);
  };
  const salvar = () => {
    if (editando === "nova") {
      mut.criar.mutate({ name: nome.trim(), color: cor }, {
        onSuccess: (l) => mut.alternarNoCartao.mutate({ cardId: card.id, labelId: l.id, ligar: true }),
      });
    } else if (editando) {
      mut.atualizar.mutate({ id: editando.id, name: nome.trim(), color: cor });
    }
    setEditando(null);
  };

  return (
    <Popover onOpenChange={(o) => !o && setEditando(null)}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="sistema-theme w-72">
        {editando ? (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-center">{editando === "nova" ? "Criar etiqueta" : "Editar etiqueta"}</p>
            <div className="h-8 rounded-[6px] flex items-center px-3 text-[13px] font-semibold text-white" style={{ background: cor }}>
              {nome || " "}
            </div>
            <input
              autoFocus
              value={nome}
              maxLength={40}
              placeholder="Nome (opcional)"
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") salvar(); }}
              className="w-full rounded-[8px] border border-[var(--gw-border)] px-2.5 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
            />
            <div className="grid grid-cols-5 gap-1.5">
              {CORES_ETIQUETA.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  title={c.nome}
                  onClick={() => setCor(c.valor)}
                  className={`h-8 rounded-[6px] ${cor === c.valor ? "ring-2 ring-offset-1 ring-[var(--gw-text)]" : ""}`}
                  style={{ background: c.valor }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={salvar}>{editando === "nova" ? "Criar" : "Salvar"}</Button>
              {editando !== "nova" && (
                <Button size="sm" variant="outline" className="text-[var(--gw-danger)]" onClick={() => { mut.excluir.mutate(editando.id); setEditando(null); }}>
                  Excluir
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Voltar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-center">Etiquetas</p>
            {labels.length === 0 && <p className="text-[13px] text-[var(--gw-text-muted)] text-center py-1">Nenhuma etiqueta neste quadro.</p>}
            <ul className="space-y-1">
              {labels.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={marcadas.has(l.id)}
                    onCheckedChange={(v) => mut.alternarNoCartao.mutate({ cardId: card.id, labelId: l.id, ligar: !!v })}
                  />
                  <button
                    type="button"
                    className="flex-1 min-w-0 h-8 rounded-[6px] px-3 text-left text-[13px] font-semibold text-white truncate"
                    style={{ background: l.color }}
                    onClick={() => mut.alternarNoCartao.mutate({ cardId: card.id, labelId: l.id, ligar: !marcadas.has(l.id) })}
                  >
                    {l.name}
                  </button>
                  <button type="button" onClick={() => abrirEditor(l)} className="h-8 w-8 rounded-[6px] flex items-center justify-center hover:bg-black/5" aria-label="Editar etiqueta">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => abrirEditor("nova")}>Criar nova etiqueta</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
