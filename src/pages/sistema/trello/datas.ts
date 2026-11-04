import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Card } from "./api";

/** Atrasado = tem data, passou do prazo e não foi concluído. Sem hora, vale o fim do dia. */
export function estaAtrasado(c: Pick<Card, "due_at" | "has_time" | "completed">, agora = new Date()): boolean {
  if (!c.due_at || c.completed) return false;
  const due = new Date(c.due_at);
  if (!c.has_time) due.setHours(23, 59, 59, 999);
  return isBefore(due, agora);
}

export function formatarEntrega(c: Pick<Card, "due_at" | "has_time">, comAno = false): string {
  if (!c.due_at) return "";
  const d = new Date(c.due_at);
  const dia = format(d, comAno ? "d 'de' MMM 'de' yyyy" : "d 'de' MMM", { locale: ptBR });
  return c.has_time ? `${dia}, ${format(d, "HH:mm")}` : dia;
}
