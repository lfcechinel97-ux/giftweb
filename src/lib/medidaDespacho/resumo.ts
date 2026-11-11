import type { Caixa, ResultadoCalculo } from "./calculo";

export const fmtKg = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtCm = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
/** Caixa no formato L×C×A (altura por último, como a equipe fala: 60×40×25 = 25 cm de altura). */
export const fmtCaixa = (c: Caixa) => `${fmtCm(c.largura)}×${fmtCm(c.comprimento)}×${fmtCm(c.altura)}`;

/** Texto limpo para colar no WhatsApp/orçamento. */
export function resumoTexto(r: ResultadoCalculo, caixa: Caixa): string {
  const vols = r.volumes;
  if (!vols.length) return "";
  const ultimo = vols[vols.length - 1];
  const parcial = ultimo.sugestao ? ultimo : null;
  const cheios = parcial ? vols.slice(0, -1) : vols;
  const n = vols.length;
  const partes: string[] = [];
  const faixaPeso = (lista: typeof vols) => {
    const pesos = lista.map((v) => v.pesoRealKg);
    const min = Math.min(...pesos), max = Math.max(...pesos);
    const txt = fmtKg(min) === fmtKg(max) ? `${fmtKg(min)} kg` : `${fmtKg(min)} a ${fmtKg(max)} kg`;
    return lista.length > 1 ? `${txt} cada` : txt;
  };
  if (cheios.length) partes.push(`${cheios.length} ${cheios.length > 1 ? "cheios" : "cheio"} (${faixaPeso(cheios)})`);
  if (parcial) partes.push(`1 parcial ${fmtCaixa(parcial.sugestao!.caixa)} (${fmtKg(parcial.pesoRealKg)} kg)`);
  const aprox = r.totais.pesoCompleto ? "" : " (sem o peso de alguns itens)";
  const linhas = [
    `${n} ${n > 1 ? "volumes" : "volume"} de ${fmtCaixa(caixa)} cm: ${partes.join(" + ")}.`,
    `Peso real total: ${fmtKg(r.totais.pesoRealKg)} kg${aprox} · cubado: ${fmtKg(r.totais.pesoCubadoKg)} kg.`,
  ];
  return linhas.join("\n");
}
