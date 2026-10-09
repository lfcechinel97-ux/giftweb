/* Dias úteis (seg-sex) de amanhã até `dataIso` (YYYY-MM-DD), inclusive.
   Hoje não conta — é o dia em que o pedido está sendo lançado. Feriados
   não entram (sem calendário de feriados no sistema). Data no passado ou
   hoje → 0. */
export const diasUteisAte = (dataIso: string, hoje: Date = new Date()): number => {
  const alvo = new Date(`${dataIso.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(alvo.getTime())) return 0;
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  let dias = 0;
  for (let i = 0; i < 366; i++) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > alvo) break;
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) dias++;
  }
  return dias;
};

/** "23/10" — data curta (dd/mm) a partir de YYYY-MM-DD, sem fuso. */
export const dataCurta = (dataIso: string | null | undefined): string => {
  if (!dataIso) return "";
  const [, m, d] = dataIso.slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : "";
};
