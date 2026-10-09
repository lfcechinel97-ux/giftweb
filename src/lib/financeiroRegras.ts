/* Regras de dinheiro do dashboard (admin). Ficam num lugar só pra tabela,
   hero do empate e dicas usarem os mesmos números. */

/** Comissão escalonada: a faixa em que o vendedor está no mês vale pra TODA
 *  a base dele (52 mil => 4% de tudo), não por degrau. */
export const FAIXAS_COMISSAO: { ate: number; pct: number }[] = [
  { ate: 20000, pct: 0 },
  { ate: 30000, pct: 2 },
  { ate: 40000, pct: 3 },
  { ate: 50000, pct: 3.5 },
  { ate: 70000, pct: 4 },
  { ate: Infinity, pct: 5 },
];
export const faixaDe = (base: number) => FAIXAS_COMISSAO.find(f => base <= f.ate)!;
/** Próxima faixa acima da atual (null se já está na última). */
export const proximaFaixa = (base: number) => {
  const i = FAIXAS_COMISSAO.findIndex(f => base <= f.ate);
  return i >= 0 && i < FAIXAS_COMISSAO.length - 1
    ? { falta: FAIXAS_COMISSAO[i].ate - base + 0.01, pct: FAIXAS_COMISSAO[i + 1].pct }
    : null;
};

/** Tabela da maquininha (Mastercard, Visa, Elo e Amex), 1x..12x. A empresa
 *  absorve a taxa no parcelado sem juros — então "3x s/ juros" custa 5,47%. */
export const TAXA_CARTAO_PARCELAS: Record<number, number> = {
  1: 3.66, 2: 4.58, 3: 5.47, 4: 6.36, 5: 7.25, 6: 8.14,
  7: 10.23, 8: 11.12, 9: 12.01, 10: 12.9, 11: 13.79, 12: 14.68,
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Taxa do meio de pagamento. Meio de cartão cadastrado sem taxa (ex.:
 *  "Cartão 3x s/ Juros" com 0%) usa a tabela pelo nº de parcelas do nome. */
export function taxaCartaoDoMeio(nome: string | null | undefined, taxaCadastrada: number): number {
  if (taxaCadastrada > 0 || !nome) return taxaCadastrada;
  const n = semAcento(nome);
  if (!n.includes("cart") && !n.includes("credito")) return taxaCadastrada;
  if (n.includes("debito")) return taxaCadastrada;
  const m = n.match(/(\d{1,2})\s*x/);
  const parcelas = m ? Number(m[1]) : 1;
  return TAXA_CARTAO_PARCELAS[parcelas] ?? taxaCadastrada;
}

/** Premissas do empate (sobrescritas por sistema_financeiro_config quando
 *  as colunas existem). */
export const CUSTO_FIXO_MENSAL_PADRAO = 50000;
export const CPA_PADRAO = 200;
/** Margem de contribuição usada quando ainda não há pedido com custo no mês. */
export const MARGEM_PADRAO = 0.35;

/* ── Dias úteis (seg-sex, sem feriados) ─────────────────────────────── */

const ehUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** Dias úteis do mês: total, já corridos (até hoje, inclusive) e restantes. */
export function diasUteisDoMes(ano: number, mes: number, hoje = new Date()) {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const hojeNum = hoje.getFullYear() * 10000 + hoje.getMonth() * 100 + hoje.getDate();
  let total = 0, passados = 0;
  for (let dia = 1; dia <= ultimo; dia++) {
    const d = new Date(ano, mes, dia, 12);
    if (!ehUtil(d)) continue;
    total++;
    if (ano * 10000 + mes * 100 + dia <= hojeNum) passados++;
  }
  return { total, passados, restantes: total - passados, diasNoMes: ultimo };
}

export const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
