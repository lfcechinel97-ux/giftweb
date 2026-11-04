import { useState } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { posicaoEntre, type Board, type Card, type Label } from "./api";
import { useKanban } from "./hooks";
import { useCardMutations } from "./mutations";
import { LabelChips } from "./cardUi";
import { estaAtrasado } from "./datas";

interface AgendaProps {
  board: Board;
  dia: Date;
  cards: Card[]; // já ordenados: dia inteiro primeiro, depois por horário
  labels: Label[];
  onOpenCard: (id: string) => void;
}

/** Agenda de um dia: "Dia inteiro" no topo, depois por horário; criar tarefa já com data/hora. */
export default function DayAgenda({ board, dia, cards, labels, onOpenCard }: AgendaProps) {
  const cardMut = useCardMutations(board.id);
  const diaInteiro = cards.filter((c) => !c.has_time);
  const comHora = cards.filter((c) => c.has_time);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold first-letter:uppercase text-[var(--gw-text)]">
          {isToday(dia) ? "Hoje, " : ""}{format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
        <p className="text-[12px] text-[var(--gw-text-muted)]">
          {cards.length === 0 ? "Nenhuma tarefa neste dia." : `${cards.length} ${cards.length === 1 ? "tarefa" : "tarefas"}`}
        </p>
      </div>

      {diaInteiro.length > 0 && (
        <Grupo titulo="Dia inteiro">
          {diaInteiro.map((c) => (
            <Item key={c.id} card={c} labels={labels} onOpen={onOpenCard}
              onToggle={(v) => cardMut.atualizar.mutate({ id: c.id, patch: { completed: v } })} />
          ))}
        </Grupo>
      )}
      {comHora.length > 0 && (
        <Grupo titulo="Por horário">
          {comHora.map((c) => (
            <Item key={c.id} card={c} labels={labels} onOpen={onOpenCard}
              onToggle={(v) => cardMut.atualizar.mutate({ id: c.id, patch: { completed: v } })} />
          ))}
        </Grupo>
      )}

      <NovaTarefa board={board} dia={dia} />
    </div>
  );
}

export function DayAgendaSheet({ dia, onClose, ...rest }: Omit<AgendaProps, "dia"> & { dia: Date | null; onClose: () => void }) {
  return (
    <Sheet open={!!dia} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sistema-theme w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>Agenda do dia</SheetTitle>
          <SheetDescription>Tarefas com entrega neste dia</SheetDescription>
        </SheetHeader>
        {dia && <DayAgenda dia={dia} {...rest} />}
      </SheetContent>
    </Sheet>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--gw-text-label)]">{titulo}</p>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Item({ card, labels, onOpen, onToggle }: { card: Card; labels: Label[]; onOpen: (id: string) => void; onToggle: (v: boolean) => void }) {
  const atrasado = estaAtrasado(card);
  return (
    <li className="flex items-start gap-2.5 rounded-[10px] border border-[var(--gw-border)] bg-white px-3 py-2 hover:border-[var(--gw-border-strong)]">
      <Checkbox
        className="mt-0.5"
        checked={card.completed}
        disabled={card.id.startsWith("temp-")}
        onCheckedChange={(v) => onToggle(!!v)}
        aria-label="Marcar como concluída"
      />
      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => !card.id.startsWith("temp-") && onOpen(card.id)}>
        <span className="flex items-baseline gap-2">
          {card.has_time && card.due_at && (
            <span className={`text-[13px] font-semibold tabular-nums ${atrasado ? "text-[var(--gw-danger)]" : "text-[var(--gw-text-secondary)]"}`}>
              {format(new Date(card.due_at), "HH:mm")}
            </span>
          )}
          <span className={`text-[14px] break-words ${card.completed ? "line-through text-[var(--gw-text-muted)]" : atrasado ? "text-[var(--gw-danger)]" : "text-[var(--gw-text)]"}`}>
            {card.title}
          </span>
        </span>
        {card.labels.length > 0 && (
          <span className="mt-1 block"><LabelChips ids={card.labels.map((l) => l.label_id)} labels={labels} mini /></span>
        )}
      </button>
    </li>
  );
}

function NovaTarefa({ board, dia }: { board: Board; dia: Date }) {
  const { data: kanban } = useKanban(board.id);
  const cardMut = useCardMutations(board.id);
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [coluna, setColuna] = useState<string>("");
  const colunas = kanban?.columns ?? [];
  const colunaId = coluna || colunas[0]?.id || "";

  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = titulo.trim();
    if (!t || !colunaId) return;
    const quando = new Date(dia);
    if (hora) {
      const [h, m] = hora.split(":").map(Number);
      quando.setHours(h, m, 0, 0);
    } else {
      quando.setHours(12, 0, 0, 0); // dia inteiro: meio-dia local (não troca de dia por fuso)
    }
    const naColuna = (kanban?.cards ?? []).filter((c) => c.column_id === colunaId);
    cardMut.criar.mutate({
      column_id: colunaId,
      title: t,
      position: posicaoEntre(naColuna[naColuna.length - 1]?.position, null),
      due_at: quando.toISOString(),
      has_time: !!hora,
    });
    setTitulo("");
  };

  if (!colunas.length) {
    return <p className="text-[13px] text-[var(--gw-text-muted)]">Crie uma coluna no quadro para adicionar tarefas.</p>;
  }

  return (
    <form onSubmit={criar} className="rounded-[10px] bg-[var(--gw-surface-alt)] p-3 space-y-2">
      <p className="text-[13px] font-semibold text-[var(--gw-text)]">Nova tarefa neste dia</p>
      <input
        value={titulo}
        maxLength={500}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da tarefa"
        className="w-full rounded-[8px] border border-[var(--gw-border)] bg-white px-3 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
      />
      <div className="flex gap-2">
        <input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          aria-label="Horário (opcional)"
          className="w-[110px] rounded-[8px] border border-[var(--gw-border)] bg-white px-2 h-9 text-[14px] outline-none focus:border-[var(--gw-primary)]"
        />
        <Select value={colunaId} onValueChange={setColuna}>
          <SelectTrigger className="h-9 flex-1 min-w-0 bg-white text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent className="sistema-theme">
            {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" className="w-full gap-1.5" disabled={!titulo.trim()}>
        <Plus className="h-4 w-4" /> Criar tarefa{hora ? ` às ${hora}` : " (dia inteiro)"}
      </Button>
    </form>
  );
}
