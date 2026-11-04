import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, pointerWithin, rectIntersection,
  useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { posicaoEntre, precisaRenumerar, type Board, type Card, type Column, type Label, type Usuario } from "./api";
import { useKanban, useLabels, useSignedUrls, useUsers } from "./hooks";
import { useCardMutations, useColumnMutations } from "./mutations";
import { CardFace } from "./cardUi";

type Itens = Record<string, string[]>;

/* Cartões têm prioridade sobre colunas como alvo; coluna só conta quando o
   ponteiro está numa área vazia dela (lista vazia ou abaixo do último cartão). */
const colisao: CollisionDetection = (args) => {
  const tipo = args.active.data.current?.type;
  if (tipo === "column") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === "column"),
    });
  }
  const sob = pointerWithin(args);
  const hits = sob.length ? sob : rectIntersection(args);
  const deCartao = hits.filter((h) => args.droppableContainers.find((c) => c.id === h.id)?.data.current?.type === "card");
  if (deCartao.length) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => deCartao.some((h) => h.id === c.id)),
    });
  }
  return hits;
};

export default function KanbanView({ board, onOpenCard }: { board: Board; onOpenCard: (id: string) => void }) {
  const { data, isLoading } = useKanban(board.id);
  const { data: labels = [] } = useLabels(board.id);
  const { data: usuarios = [] } = useUsers();
  const colMut = useColumnMutations(board.id);
  const cardMut = useCardMutations(board.id);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const cards = useMemo(() => data?.cards ?? [], [data]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const userMap = useMemo(() => new Map<string, Usuario>(usuarios.map((u) => [u.user_id, u])), [usuarios]);
  const capas = useSignedUrls(useMemo(() => cards.map((c) => c.cover_url), [cards]));

  const baseCols = useMemo(() => columns.map((c) => c.id), [columns]);
  const baseItens = useMemo(() => {
    const out: Itens = {};
    for (const c of columns) out[c.id] = [];
    for (const card of cards) out[card.column_id]?.push(card.id); // já vêm ordenados por position
    return out;
  }, [columns, cards]);

  // Durante o arraste a ordem vive aqui; fora dele, vem direto do cache.
  const [dragCols, setDragCols] = useState<string[] | null>(null);
  const [dragItens, setDragItens] = useState<Itens | null>(null);
  const [ativo, setAtivo] = useState<{ id: string; type: "card" | "column" } | null>(null);
  const colOrder = dragCols ?? baseCols;
  const itens = dragItens ?? baseItens;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Espaço arrasta pelo teclado; Enter fica livre para abrir o cartão.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const containerDe = (id: UniqueIdentifier, mapa: Itens): string | undefined => {
    const s = String(id);
    if (s in mapa) return s;
    return Object.keys(mapa).find((k) => mapa[k].includes(s));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const type = active.data.current?.type as "card" | "column";
    setAtivo({ id: String(active.id), type });
    setDragCols(baseCols);
    setDragItens(structuredClone(baseItens));
  };

  // Cartão passando para outra coluna: move na hora (placeholder aparece lá).
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type !== "card") return;
    setDragItens((prev) => {
      if (!prev) return prev;
      const de = containerDe(active.id, prev);
      const para = containerDe(over.id, prev);
      if (!de || !para || de === para) return prev;
      const origem = prev[de].filter((id) => id !== active.id);
      const destino = [...prev[para]];
      const overEhColuna = String(over.id) in prev;
      let idx = overEhColuna ? destino.length : destino.indexOf(String(over.id));
      if (!overEhColuna) {
        const abaixo = active.rect.current.translated && over.rect &&
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        if (abaixo) idx += 1;
      }
      destino.splice(Math.max(0, idx), 0, String(active.id));
      return { ...prev, [de]: origem, [para]: destino };
    });
  };

  const limpar = () => { setAtivo(null); setDragCols(null); setDragItens(null); };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const tipo = active.data.current?.type;
    if (!over) { limpar(); return; }

    if (tipo === "column") {
      const de = colOrder.indexOf(String(active.id));
      const para = colOrder.indexOf(String(over.id));
      if (de >= 0 && para >= 0 && de !== para) {
        const nova = arrayMove(colOrder, de, para);
        const i = nova.indexOf(String(active.id));
        const prev = colById.get(nova[i - 1])?.position;
        const next = colById.get(nova[i + 1])?.position;
        if (precisaRenumerar(prev, next)) void colMut.renumerar("trello_columns", nova);
        else colMut.atualizar.mutate({ id: String(active.id), position: posicaoEntre(prev, next) });
      }
      limpar();
      return;
    }

    if (!dragItens) { limpar(); return; }
    const colFinal = containerDe(over.id, dragItens) ?? containerDe(active.id, dragItens);
    if (!colFinal) { limpar(); return; }
    let lista = dragItens[colFinal];
    const de = lista.indexOf(String(active.id));
    const para = String(over.id) in dragItens ? lista.length - 1 : lista.indexOf(String(over.id));
    if (de >= 0 && para >= 0 && de !== para) lista = arrayMove(lista, de, para);

    const card = cardById.get(String(active.id));
    const i = lista.indexOf(String(active.id));
    const original = baseItens[card?.column_id ?? ""] ?? [];
    const mudou = card && (card.column_id !== colFinal || original.indexOf(card.id) !== i || original.length !== lista.length);
    if (card && mudou) {
      const prev = cardById.get(lista[i - 1])?.position;
      const next = cardById.get(lista[i + 1])?.position;
      if (precisaRenumerar(prev, next)) {
        cardMut.atualizar.mutate({ id: card.id, patch: { column_id: colFinal } });
        void colMut.renumerar("trello_cards", lista);
      } else {
        cardMut.atualizar.mutate({ id: card.id, patch: { column_id: colFinal, position: posicaoEntre(prev, next) } });
      }
    }
    limpar();
  };

  const adicionarCartao = (columnId: string, title: string) => {
    const lista = baseItens[columnId] ?? [];
    const ultimo = cardById.get(lista[lista.length - 1])?.position;
    cardMut.criar.mutate({ column_id: columnId, title, position: posicaoEntre(ultimo, null) });
  };

  const adicionarColuna = (title: string) => {
    const ultimo = colById.get(baseCols[baseCols.length - 1])?.position;
    colMut.criar.mutate({ title, position: posicaoEntre(ultimo, null) });
  };

  if (isLoading && !data) {
    return (
      <div className="flex gap-3 p-3 h-full">
        {[0, 1, 2].map((i) => <div key={i} className="w-[272px] h-48 rounded-[12px] bg-white/60 animate-pulse shrink-0" />)}
      </div>
    );
  }

  const cardAtivo = ativo?.type === "card" ? cardById.get(ativo.id) : undefined;
  const colAtiva = ativo?.type === "column" ? colById.get(ativo.id) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={colisao} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={limpar}>
      <div className="pcp-scroll h-full overflow-x-auto overflow-y-hidden">
        <div className="flex items-start gap-3 p-3 h-full w-max">
          <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
            {colOrder.map((colId) => {
              const col = colById.get(colId);
              if (!col) return null;
              return (
                <KanbanColumn
                  key={colId}
                  column={col}
                  cardIds={itens[colId] ?? []}
                  cardById={cardById}
                  labels={labels}
                  usuarios={userMap}
                  capas={capas}
                  onOpenCard={onOpenCard}
                  onAddCard={(t) => adicionarCartao(colId, t)}
                  onRename={(t) => colMut.atualizar.mutate({ id: colId, title: t })}
                  onDelete={() => colMut.excluir.mutate(colId)}
                  onArchiveAll={() => colMut.arquivarTodos.mutate(colId)}
                />
              );
            })}
          </SortableContext>
          <AddColumn onAdd={adicionarColuna} />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {cardAtivo ? (
          <div className="w-[256px] cursor-grabbing">
            <CardFace card={cardAtivo} labels={labels} usuarios={userMap} coverUrl={cardAtivo.cover_url ? capas[cardAtivo.cover_url] : undefined} arrastando />
          </div>
        ) : colAtiva ? (
          <div className="w-[272px] rounded-[12px] bg-[var(--gw-bg)] p-3 shadow-[var(--gw-shadow-lg)] rotate-[2deg] cursor-grabbing">
            <p className="font-semibold text-[14px] text-[var(--gw-text)]">{colAtiva.title}</p>
            <p className="text-[12px] text-[var(--gw-text-muted)] mt-1">{(itens[colAtiva.id] ?? []).length} cartões</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ------------------------------------------------------------------ */
/* Coluna                                                             */
/* ------------------------------------------------------------------ */
interface ColumnProps {
  column: Column;
  cardIds: string[];
  cardById: Map<string, Card>;
  labels: Label[];
  usuarios: Map<string, Usuario>;
  capas: Record<string, string>;
  onOpenCard: (id: string) => void;
  onAddCard: (title: string) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onArchiveAll: () => void;
}

const KanbanColumn = memo(function KanbanColumn({
  column, cardIds, cardById, labels, usuarios, capas, onOpenCard, onAddCard, onRename, onDelete, onArchiveAll,
}: ColumnProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [compondo, setCompondo] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`w-[272px] shrink-0 max-h-full flex flex-col rounded-[12px] ${
        isDragging ? "bg-black/15" : "bg-[var(--gw-bg)] shadow-[var(--gw-shadow-sm)]"
      }`}
    >
      <div className={`flex flex-col max-h-full min-h-0 ${isDragging ? "invisible" : ""}`}>
        <div className="flex items-center gap-1 pl-3 pr-1.5 pt-2 pb-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          {editando ? (
            <InlineInput
              valor={column.title}
              onSalvar={(t) => { setEditando(false); if (t && t !== column.title) onRename(t); }}
              onCancelar={() => setEditando(false)}
              className="font-semibold text-[14px]"
            />
          ) : (
            <h3
              className="flex-1 min-w-0 truncate py-1.5 text-[14px] font-semibold text-[var(--gw-text)] cursor-text"
              onClick={() => setEditando(true)}
              title="Clique para renomear"
            >
              {column.title}
            </h3>
          )}
          <span className="text-[12px] text-[var(--gw-text-muted)] px-1">{cardIds.length}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="h-8 w-8 rounded-[8px] flex items-center justify-center text-[var(--gw-text-muted)] hover:bg-black/5" aria-label="Ações da coluna">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setEditando(true)} className="gap-2"><Pencil className="h-4 w-4" /> Renomear</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompondo(true)} className="gap-2"><Plus className="h-4 w-4" /> Adicionar cartão</DropdownMenuItem>
              <DropdownMenuItem onClick={onArchiveAll} disabled={cardIds.length === 0} className="gap-2">
                <Archive className="h-4 w-4" /> Arquivar todos os cartões
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmar(true)} className="gap-2 text-[var(--gw-danger)] focus:text-[var(--gw-danger)]">
                <Trash2 className="h-4 w-4" /> Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 min-h-[8px] overflow-y-auto px-2 pb-1">
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 min-h-[4px] pb-1">
              {cardIds.map((id) => {
                const card = cardById.get(id);
                if (!card) return null;
                return (
                  <SortableCard
                    key={id}
                    card={card}
                    labels={labels}
                    usuarios={usuarios}
                    coverUrl={card.cover_url ? capas[card.cover_url] : undefined}
                    onOpen={onOpenCard}
                  />
                );
              })}
            </div>
          </SortableContext>
        </div>

        <div className="px-2 pb-2">
          {compondo ? (
            <CardComposer onAdd={onAddCard} onClose={() => setCompondo(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setCompondo(true)}
              className="w-full flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[14px] text-[var(--gw-text-secondary)] hover:bg-black/5"
            >
              <Plus className="h-4 w-4" /> Adicionar cartão
            </button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a coluna "{column.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {cardIds.length > 0
                ? `Os ${cardIds.length} cartões desta coluna também serão excluídos. Para guardá-los, arquive ou mova antes.`
                : "A coluna está vazia."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-[var(--gw-danger)] hover:bg-[var(--gw-danger)]/90" onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

const SortableCard = memo(function SortableCard({
  card, labels, usuarios, coverUrl, onOpen,
}: {
  card: Card;
  labels: Label[];
  usuarios: Map<string, Usuario>;
  coverUrl?: string;
  onOpen: (id: string) => void;
}) {
  const temporario = card.id.startsWith("temp-");
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.column_id },
    disabled: temporario,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => { if (!temporario) onOpen(card.id); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !temporario) onOpen(card.id); listeners?.onKeyDown?.(e); }}
      className={`relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-primary)] rounded-[10px] ${temporario ? "opacity-60" : ""}`}
    >
      {/* Placeholder: mantém a altura do cartão enquanto ele está no overlay */}
      {isDragging && <div className="absolute inset-0 rounded-[10px] bg-black/10" />}
      <div className={isDragging ? "invisible" : ""}>
        <CardFace card={card} labels={labels} usuarios={usuarios} coverUrl={coverUrl} />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Pequenos editores inline                                           */
/* ------------------------------------------------------------------ */
export function InlineInput({
  valor, onSalvar, onCancelar, className = "", placeholder,
}: {
  valor: string;
  onSalvar: (v: string) => void;
  onCancelar: () => void;
  className?: string;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const cancelado = useRef(false);
  return (
    <input
      autoFocus
      value={texto}
      placeholder={placeholder}
      maxLength={200}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation(); // não deixa o dnd-kit tratar Enter/Espaço
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { cancelado.current = true; onCancelar(); }
      }}
      onBlur={() => { if (!cancelado.current) onSalvar(texto.trim()); }}
      className={`flex-1 min-w-0 rounded-[6px] border border-[var(--gw-primary)] bg-white px-2 py-1 text-[var(--gw-text)] outline-none ring-2 ring-[var(--gw-primary)]/20 ${className}`}
    />
  );
}

function CardComposer({ onAdd, onClose }: { onAdd: (t: string) => void; onClose: () => void }) {
  const [texto, setTexto] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onAdd(t);
    setTexto("");
    ref.current?.focus();
  };
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={texto}
        rows={3}
        maxLength={500}
        placeholder="Insira um título para este cartão…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          if (e.key === "Escape") onClose();
        }}
        className="w-full resize-none rounded-[10px] bg-white px-3 py-2 text-[14px] text-[var(--gw-text)] shadow-[0_1px_1px_rgba(16,24,40,.08),0_1px_3px_rgba(16,24,40,.06)] outline-none focus:ring-2 focus:ring-[var(--gw-primary)]/40"
      />
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={enviar} disabled={!texto.trim()}>Adicionar cartão</Button>
        <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] flex items-center justify-center text-[var(--gw-text-muted)] hover:bg-black/5" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (t: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onAdd(t);
    setTexto("");
  };
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-[272px] shrink-0 flex items-center gap-1.5 rounded-[12px] bg-white/25 hover:bg-white/35 backdrop-blur-sm px-3 py-3 text-[14px] font-semibold text-white"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}
      >
        <Plus className="h-4 w-4" /> Adicionar coluna
      </button>
    );
  }
  return (
    <div className="w-[272px] shrink-0 rounded-[12px] bg-[var(--gw-bg)] p-2 flex flex-col gap-2">
      <input
        autoFocus
        value={texto}
        maxLength={120}
        placeholder="Nome da coluna…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") enviar();
          if (e.key === "Escape") { setAberto(false); setTexto(""); }
        }}
        className="w-full rounded-[8px] border border-[var(--gw-primary)] bg-white px-2.5 py-1.5 text-[14px] text-[var(--gw-text)] outline-none ring-2 ring-[var(--gw-primary)]/20"
      />
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={enviar} disabled={!texto.trim()}>Adicionar coluna</Button>
        <button type="button" onClick={() => { setAberto(false); setTexto(""); }} className="h-8 w-8 rounded-[8px] flex items-center justify-center text-[var(--gw-text-muted)] hover:bg-black/5" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
