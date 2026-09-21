/* Tipo de personalização do item — campo estruturado (não texto livre)
   para dar pra contar depois qual técnica sai mais. Fica dentro do jsonb
   `itens` do orçamento/pedido, sem coluna nova. */

export type TipoPersonalizacao = "laser" | "dtf_uv" | "dtf_textil" | "silk" | "sem";

export const OPCOES_PERSONALIZACAO: { valor: TipoPersonalizacao; rotulo: string }[] = [
  { valor: "laser", rotulo: "Laser" },
  { valor: "dtf_uv", rotulo: "DTF UV" },
  { valor: "dtf_textil", rotulo: "DTF Têxtil" },
  { valor: "silk", rotulo: "Silk" },
  { valor: "sem", rotulo: "Sem personalização" },
];

export const rotuloPersonalizacao = (tipo?: string | null) =>
  OPCOES_PERSONALIZACAO.find(o => o.valor === tipo)?.rotulo ?? "";

/** "Laser · 2 aplicações" — vazio quando o item ainda não tem o campo. */
export const resumoPersonalizacao = (item: { personalizacao?: string | null; aplicacoes?: number | null }) => {
  const rotulo = rotuloPersonalizacao(item.personalizacao);
  if (!rotulo) return "";
  if (item.personalizacao === "sem") return rotulo;
  const n = item.aplicacoes && item.aplicacoes > 0 ? item.aplicacoes : 1;
  return `${rotulo} · ${n} ${n === 1 ? "aplicação" : "aplicações"}`;
};
