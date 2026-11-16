/** Telefone BR no padrão "(48) 99652-5312" (celular) / "(48) 3333-4444" (fixo).
 *  Aceita o que vier digitado/importado: com ou sem máscara, com 55 na frente,
 *  com 0 de operadora. Enquanto digita, vai montando a máscara aos poucos.
 *  Se não parecer telefone BR (internacional, muitos dígitos), devolve como veio. */
export function formatTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  let d = String(valor).replace(/\D/g, "");
  if (!d) return "";
  // Número de fora (+1, +351...) fica como foi digitado
  if (/^\s*\+/.test(String(valor)) && !d.startsWith("55")) return String(valor).trim();
  // 55 + DDD + número (12 ou 13 dígitos) -> tira o código do país
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  // 0 + DDD (ex.: 041...) -> tira o zero
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  if (d.length > 11) return String(valor).trim();

  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Só os dígitos com 55 na frente -- pronto pra colar no WhatsApp/CRM. */
export function telefoneWhatsapp(valor: string | null | undefined): string {
  let d = String(valor ?? "").replace(/\D/g, "");
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}
