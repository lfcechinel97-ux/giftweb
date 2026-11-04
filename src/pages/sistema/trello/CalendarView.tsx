import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchCalendar, fetchSemData, qk, type Board, type Card, type Label } from "./api";
import { useLabels } from "./hooks";
import { useCardMutations } from "./mutations";
import { estaAtrasado } from "./datas";
import DayAgenda, { DayAgendaSheet } from "./DayAgenda";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAX_POR_DIA = 3;
const chaveDia = (d: Date) => format(d, "yyyy-MM-dd");

/** Ordem da agenda: "dia inteiro" primeiro, depois por horário. */
function ordenarDoDia(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.has_time !== b.has_time) return a.has_time ? 1 : -1;
    return new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime() || a.title.localeCompare(b.title);
  });
}

/** Mesma hora/minuto, outro dia (arrastar no calendário). */
function moverParaDia(dueIso: string, dia: Date): string {
  const atual = new Date(dueIso);
  const novo = new Date(dia);
  novo.setHours(atual.getHours(), atual.getMinutes(), 0, 0);
  return novo.toISOString();
}

export default function CalendarView({ board, onOpenCard }: { board: Board; onOpenCard: (id: string) => void }) {
  const isMobile = useIsMobile();
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);
  const [diaMobile, setDiaMobile] = useState<Date>(() => new Date());
  const [arrastando, setArrastando] = useState<Card | null>(null);

  // Intervalo da grade visível (inclui os dias dos meses vizinhos que aparecem).
  const inicio = useMemo(() => startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }), [mes]);
  const fim = useMemo(() => endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }), [mes]);
  const dias = useMemo(() => {
    const out: Date[] = [];
    for (let d = inicio; d <= fim; d = addDays(d, 1)) out.push(d);
    return out;
  }, [inicio, fim]);
  // [from, to): meia-noite local do 1º dia da grade até a meia-noite seguinte ao último.
  const from = inicio.toISOString();
  const to = startOfDay(addDays(fim, 1)).toISOString();

  const { data: cards = [], isFetching } = useQuery({
    queryKey: qk.calendar(board.id, from, to),
    queryFn: () => fetchCalendar(board.id, from, to),
    staleTime: 60 * 1000,
  });
  const { data: semData = 0 } = useQuery({
    queryKey: qk.semData(board.id),
    queryFn: () => fetchSemData(board.id),
    staleTime: 60 * 1000,
  });
  const { data: labels = [] } = useLabels(board.id);
  const cardMut = useCardMutations(board.id);

  const porDia = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of cards) {
      if (!c.due_at) continue;
      const k = chaveDia(new Date(c.due_at));
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    for (const [k, lista] of m) m.set(k, ordenarDoDia(lista));
    return m;
  }, [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  const onDragStart = ({ active }: DragStartEvent) => setArrastando(cards.find((c) => c.id === active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setArrastando(null);
    const card = cards.find((c) => c.id === active.id);
    if (!card?.due_at || !over) return;
    const dia = dias.find((d) => chaveDia(d) === over.id);
    if (!dia || isSameDay(dia, new Date(card.due_at))) return;
    cardMut.atualizar.mutate({ id: card.id, patch: { due_at: moverParaDia(card.due_at, dia) } });
  };

  const hoje = new Date();
  const tituloMes = format(mes, "MMMM 'de' yyyy", { locale: ptBR });

  const cabecalho = (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <h2 className="mr-auto first-letter:uppercase">{tituloMes}</h2>
      {isFetching && <span className="text-[12px] text-[var(--gw-text-muted)]">Atualizando…</span>}
      <Button variant="outline" size="sm" onClick={() => { setMes(startOfMonth(new Date())); setDiaMobile(new Date()); }}>Hoje</Button>
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMes((m) => subMonths(m, 1))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMes((m) => addMonths(m, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const avisoSemData = semData > 0 && (
    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--gw-text-muted)]">
      <CalendarX2 className="h-3.5 w-3.5" />
      {semData === 1 ? "1 cartão sem data não aparece no calendário." : `${semData} cartões sem data não aparecem no calendário.`}
    </p>
  );

  /* ---------- Mobile: mês compacto + lista do dia ---------- */
  if (isMobile) {
    const doDia = porDia.get(chaveDia(diaMobile)) ?? [];
    return (
      <div className="h-full overflow-y-auto p-2">
        <div className="rounded-[var(--gw-radius-lg)] bg-white p-3">
          {cabecalho}
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-[var(--gw-text-muted)] mb-1">
            {SEMANA.map((s) => <span key={s}>{s}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {dias.map((d) => {
              const lista = porDia.get(chaveDia(d)) ?? [];
              const selecionado = isSameDay(d, diaMobile);
              const ehHoje = isSameDay(d, hoje);
              return (
                <button
                  key={chaveDia(d)}
                  type="button"
                  onClick={() => { setDiaMobile(d); if (!isSameMonth(d, mes)) setMes(startOfMonth(d)); }}
                  className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-[14px] ${
                    selecionado ? "bg-[var(--gw-primary)] text-white" : ehHoje ? "text-[var(--gw-primary)] font-bold" : isSameMonth(d, mes) ? "text-[var(--gw-text)]" : "text-[var(--gw-text-muted)]/60"
                  }`}
                >
                  {format(d, "d")}
                  <span className="flex gap-0.5 h-1.5 mt-0.5">
                    {lista.slice(0, 3).map((c) => (
                      <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: selecionado ? "#fff" : corDoCartao(c, labels) }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {avisoSemData}
        </div>
        <div className="mt-2 rounded-[var(--gw-radius-lg)] bg-white p-3">
          <DayAgenda board={board} dia={diaMobile} cards={doDia} labels={labels} onOpenCard={onOpenCard} />
        </div>
      </div>
    );
  }

  /* ---------- Desktop: grade mensal ---------- */
  const semanas = dias.length / 7;
  return (
    <div className="h-full p-3">
      <div className="h-full flex flex-col rounded-[var(--gw-radius-lg)] bg-white p-4 shadow-[var(--gw-shadow-md)]">
        {cabecalho}
        <div className="grid grid-cols-7 border-b border-[var(--gw-border)] pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--gw-text-muted)]">
          {SEMANA.map((s) => <span key={s} className="px-2">{s}</span>)}
        </div>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setArrastando(null)}>
          <div className="flex-1 min-h-0 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${semanas}, minmax(0, 1fr))` }}>
            {dias.map((d) => (
              <DiaCelula
                key={chaveDia(d)}
                dia={d}
                foraDoMes={!isSameMonth(d, mes)}
                ehHoje={isSameDay(d, hoje)}
                cards={porDia.get(chaveDia(d)) ?? []}
                labels={labels}
                onAbrirDia={() => setDiaAberto(d)}
                onOpenCard={onOpenCard}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {arrastando && (
              <div className="w-[150px] cursor-grabbing">
                <ChipCartao card={arrastando} labels={labels} flutuando />
              </div>
            )}
          </DragOverlay>
        </DndContext>
        {avisoSemData}
      </div>

      <DayAgendaSheet
        board={board}
        dia={diaAberto}
        cards={diaAberto ? porDia.get(chaveDia(diaAberto)) ?? [] : []}
        labels={labels}
        onClose={() => setDiaAberto(null)}
        onOpenCard={onOpenCard}
      />
    </div>
  );
}

/** Cor do cartão no calendário = cor da primeira etiqueta (ou a primária do sistema). */
function corDoCartao(c: Card, labels: Label[]): string {
  const primeira = c.labels[0] && labels.find((l) => l.id === c.labels[0].label_id);
  return primeira?.color ?? "var(--gw-primary)";
}

const DiaCelula = memo(function DiaCelula({
  dia, foraDoMes, ehHoje, cards, labels, onAbrirDia, onOpenCard,
}: {
  dia: Date;
  foraDoMes: boolean;
  ehHoje: boolean;
  cards: Card[];
  labels: Label[];
  onAbrirDia: () => void;
  onOpenCard: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chaveDia(dia) });
  const extras = cards.length - MAX_POR_DIA;
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onAbrirDia}
      onKeyDown={(e) => { if (e.key === "Enter") onAbrirDia(); }}
      aria-label={format(dia, "d 'de' MMMM", { locale: ptBR })}
      className={`min-h-0 overflow-hidden border-b border-r border-[var(--gw-hairline)] p-1 flex flex-col gap-0.5 cursor-pointer transition-colors [&:nth-child(7n+1)]:border-l ${
        isOver ? "bg-[var(--gw-blue-soft)]" : foraDoMes ? "bg-[var(--gw-surface-alt)]" : "hover:bg-[var(--gw-surface-alt)]"
      }`}
    >
      <span
        className={`self-start inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12.5px] font-semibold ${
          ehHoje ? "bg-[var(--gw-primary)] text-white" : foraDoMes ? "text-[var(--gw-text-muted)]/60" : "text-[var(--gw-text-secondary)]"
        }`}
      >
        {format(dia, "d")}
      </span>
      {cards.slice(0, MAX_POR_DIA).map((c) => (
        <ChipArrastavel key={c.id} card={c} labels={labels} onOpenCard={onOpenCard} />
      ))}
      {extras > 0 && (
        <span className="px-1.5 text-[12px] font-semibold text-[var(--gw-text-secondary)] hover:underline">+{extras} mais</span>
      )}
    </div>
  );
});

function ChipArrastavel({ card, labels, onOpenCard }: { card: Card; labels: Label[]; onOpenCard: (id: string) => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: card.id, disabled: card.id.startsWith("temp-") });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onOpenCard(card.id); }}
      className={isDragging ? "opacity-30" : ""}
    >
      <ChipCartao card={card} labels={labels} />
    </div>
  );
}

function ChipCartao({ card, labels, flutuando = false }: { card: Card; labels: Label[]; flutuando?: boolean }) {
  const atrasado = estaAtrasado(card);
  return (
    <div
      className={`flex items-center gap-1 rounded-[6px] pl-1 pr-1.5 py-0.5 text-[12px] leading-tight bg-[var(--gw-surface-alt)] hover:bg-[var(--gw-blue-soft)] ${
        flutuando ? "shadow-[var(--gw-shadow-lg)] bg-white" : ""
      }`}
      title={card.title}
    >
      <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: corDoCartao(card, labels) }} />
      {card.has_time && card.due_at && (
        <span className={`shrink-0 tabular-nums ${atrasado ? "text-[var(--gw-danger)]" : "text-[var(--gw-text-muted)]"}`}>
          {format(new Date(card.due_at), "HH:mm")}
        </span>
      )}
      <span
        className={`truncate ${card.completed ? "line-through text-[var(--gw-text-muted)]" : atrasado ? "text-[var(--gw-danger)] font-semibold" : "text-[var(--gw-text)]"}`}
      >
        {card.title}
      </span>
    </div>
  );
}
