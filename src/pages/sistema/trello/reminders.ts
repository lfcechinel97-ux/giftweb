/**
 * Lembretes: cada usuário tem no máximo um lembrete por cartão em
 * trello_reminders. O pg_cron (job "trello-lembretes", a cada minuto) vira
 * os vencidos em trello_notifications — aqui só gravamos remind_at.
 *
 * Não há coluna com a "opção" escolhida: ela é deduzida da diferença entre
 * due_at e remind_at (0, 15 min, 1 h, 1 dia). Qualquer outra = personalizado.
 */
import { db, type Card, type Reminder } from "./api";

export type OpcaoLembrete = "nenhum" | "na_hora" | "15min" | "1h" | "1d" | "personalizado";

export const OPCOES_LEMBRETE: { valor: OpcaoLembrete; rotulo: string; minutos?: number }[] = [
  { valor: "nenhum", rotulo: "Nenhum" },
  { valor: "na_hora", rotulo: "Na hora da entrega", minutos: 0 },
  { valor: "15min", rotulo: "15 minutos antes", minutos: 15 },
  { valor: "1h", rotulo: "1 hora antes", minutos: 60 },
  { valor: "1d", rotulo: "1 dia antes", minutos: 24 * 60 },
  { valor: "personalizado", rotulo: "Personalizado…" },
];

const MIN = 60 * 1000;
const PRESETS = new Set([0, 15, 60, 24 * 60]);

/** Minutos de antecedência do lembrete em relação à entrega (null se não dá para saber). */
function antecedencia(dueIso: string | null, remindIso: string): number | null {
  if (!dueIso) return null;
  return Math.round((new Date(dueIso).getTime() - new Date(remindIso).getTime()) / MIN);
}

export function opcaoAtual(card: Pick<Card, "due_at">, reminder: Reminder | null): OpcaoLembrete {
  if (!reminder) return "nenhum";
  const min = antecedencia(card.due_at, reminder.remind_at);
  return OPCOES_LEMBRETE.find((o) => o.minutos !== undefined && o.minutos === min)?.valor ?? "personalizado";
}

export function calcularRemindAt(dueIso: string, opcao: OpcaoLembrete): string | null {
  const o = OPCOES_LEMBRETE.find((x) => x.valor === opcao);
  if (o?.minutos === undefined) return null;
  return new Date(new Date(dueIso).getTime() - o.minutos * MIN).toISOString();
}

/** Lembrete no passado não deve disparar na hora (ex.: entrega antiga) — já nasce "enviado". */
const jaPassou = (iso: string) => new Date(iso).getTime() < Date.now() - MIN;

/** Grava (ou remove, com remindAt = null) o lembrete do usuário no cartão. */
export async function salvarLembrete(cardId: string, remindAt: string | null, existente: Reminder | null) {
  if (!remindAt) {
    if (!existente) return;
    const { error } = await db.from("trello_reminders").delete().eq("id", existente.id);
    if (error) throw new Error(error.message);
    return;
  }
  const campos = { remind_at: remindAt, sent: jaPassou(remindAt) };
  const { error } = existente
    ? await db.from("trello_reminders").update(campos).eq("id", existente.id)
    : await db.from("trello_reminders").insert({ card_id: cardId, ...campos });
  if (error) throw new Error(error.message);
}

/**
 * Entrega mudou (modal, arrastar no calendário, onde for): lembretes com
 * antecedência fixa acompanham a nova data; sem data, eles saem. Lembrete
 * personalizado (horário absoluto) fica como está. O RLS já limita aos
 * lembretes do próprio usuário.
 */
export async function ajustarLembretesAposEntrega(cardId: string, dueAntigo: string | null, dueNovo: string | null) {
  if (dueAntigo === dueNovo) return;
  const { data, error } = await db.from("trello_reminders").select("*").eq("card_id", cardId);
  if (error || !data?.length) return;
  await Promise.all((data as Reminder[]).map(async (r) => {
    const min = antecedencia(dueAntigo, r.remind_at);
    if (min === null || !PRESETS.has(min)) return; // personalizado
    if (!dueNovo) {
      await db.from("trello_reminders").delete().eq("id", r.id);
      return;
    }
    const remind_at = new Date(new Date(dueNovo).getTime() - min * MIN).toISOString();
    await db.from("trello_reminders").update({ remind_at, sent: jaPassou(remind_at) }).eq("id", r.id);
  }));
}

/** Pede permissão de notificação do navegador (só no primeiro lembrete). */
export function pedirPermissaoNotificacao() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch { /* navegador sem suporte */ }
}
