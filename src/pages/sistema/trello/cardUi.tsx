import { memo } from "react";
import { format, isToday } from "date-fns";
import { AlignLeft, CheckSquare, Clock, Paperclip } from "lucide-react";
import { iniciais, nomeUsuario, type Card, type Label, type Usuario } from "./api";
import { estaAtrasado, formatarEntrega } from "./datas";

export function DueBadge({ card, compacto = false }: { card: Pick<Card, "due_at" | "has_time" | "completed">; compacto?: boolean }) {
  if (!card.due_at) return null;
  const atrasado = estaAtrasado(card);
  const hoje = isToday(new Date(card.due_at));
  const estilo = card.completed
    ? { background: "var(--gw-success)", color: "#fff" }
    : atrasado
      ? { background: "var(--gw-danger)", color: "#fff" }
      : hoje
        ? { background: "var(--gw-warning-soft)", color: "var(--gw-text)" }
        : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[12px] font-medium ${estilo ? "" : "text-[var(--gw-text-muted)]"}`}
      style={estilo}
      title={card.completed ? "Concluído" : atrasado ? "Atrasado" : "Data de entrega"}
    >
      <Clock className="h-3 w-3" />
      {compacto && card.has_time ? format(new Date(card.due_at), "HH:mm") : formatarEntrega(card)}
    </span>
  );
}

export function Avatar({ usuario, tamanho = 26 }: { usuario: Usuario | undefined; tamanho?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 select-none"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42, background: "var(--gw-primary)" }}
      title={nomeUsuario(usuario)}
    >
      {iniciais(nomeUsuario(usuario))}
    </span>
  );
}

export function LabelChips({ ids, labels, mini = false }: { ids: string[]; labels: Label[]; mini?: boolean }) {
  const mapa = new Map(labels.map((l) => [l.id, l]));
  const lista = ids.map((id) => mapa.get(id)).filter((l): l is Label => !!l);
  if (!lista.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {lista.map((l) =>
        mini || !l.name ? (
          <span key={l.id} className="h-2 w-10 rounded-full" style={{ background: l.color }} title={l.name || undefined} />
        ) : (
          <span key={l.id} className="rounded-[4px] px-2 py-0.5 text-[11.5px] font-semibold text-white leading-tight max-w-full truncate" style={{ background: l.color }}>
            {l.name}
          </span>
        ),
      )}
    </div>
  );
}

/** Face do cartão no Kanban (também usada no overlay de arrastar). */
export const CardFace = memo(function CardFace({
  card, labels, usuarios, coverUrl, arrastando = false,
}: {
  card: Card;
  labels: Label[];
  usuarios: Map<string, Usuario>;
  coverUrl?: string;
  arrastando?: boolean;
}) {
  const feitos = card.checklist.filter((i) => i.done).length;
  const total = card.checklist.length;
  const anexos = card.attachments[0]?.count ?? 0;
  const responsavel = card.assignee_id ? usuarios.get(card.assignee_id) : undefined;
  const temRodape = !!card.description || total > 0 || anexos > 0 || !!card.due_at || !!card.assignee_id;

  return (
    <div
      className={`rounded-[10px] bg-white overflow-hidden text-left transition-shadow ${
        arrastando ? "shadow-[var(--gw-shadow-lg)] rotate-[2deg]" : "shadow-[0_1px_1px_rgba(16,24,40,.08),0_1px_3px_rgba(16,24,40,.06)] hover:shadow-[var(--gw-shadow-md)]"
      }`}
    >
      {card.cover_url && (
        coverUrl
          ? <img src={coverUrl} alt="" className="w-full h-32 object-cover" loading="lazy" draggable={false} />
          : <div className="w-full h-32 bg-[var(--gw-surface-alt)] animate-pulse" />
      )}
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <LabelChips ids={card.labels.map((l) => l.label_id)} labels={labels} />
        <p className={`text-[14px] leading-snug text-[var(--gw-text)] break-words ${card.completed ? "line-through opacity-70" : ""}`}>
          {card.title}
        </p>
        {temRodape && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[var(--gw-text-muted)]">
            <DueBadge card={card} />
            {card.description && <AlignLeft className="h-3.5 w-3.5" aria-label="Tem descrição" />}
            {total > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-[4px] px-1 text-[12px]"
                style={feitos === total ? { background: "var(--gw-success)", color: "#fff" } : undefined}
              >
                <CheckSquare className="h-3.5 w-3.5" /> {feitos}/{total}
              </span>
            )}
            {anexos > 0 && (
              <span className="inline-flex items-center gap-1 text-[12px]"><Paperclip className="h-3.5 w-3.5" /> {anexos}</span>
            )}
            {responsavel && <span className="ml-auto"><Avatar usuario={responsavel} tamanho={24} /></span>}
          </div>
        )}
      </div>
    </div>
  );
});
