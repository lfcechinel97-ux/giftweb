/* Painel do topo da aba "Pedidos e comissões": quanto falta pra empatar o
 * custo fixo do mês, KPIs comparados com o mês passado, gráficos por dia e
 * dicas tiradas das vendas. Recebe as linhas já calculadas pela tabela de
 * pedidos (DashboardPedidos) — os números aqui e lá são os mesmos. */

import { useMemo, useState } from "react";
import {
  Target, TrendingUp, TrendingDown, ShoppingCart, Receipt, FileText, Percent, Wallet,
  Lightbulb, Rocket, CalendarDays, CreditCard, Users, AlertTriangle, PartyPopper, Gauge, Pencil, Check, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarrasPorDia, LinhasAcumulado, type PontoDia } from "./GraficosVivos";
import { DIAS_SEMANA, diasUteisDoMes, MARGEM_PADRAO, proximaFaixa } from "@/lib/financeiroRegras";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const curto = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const pctTxt = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const diaDe = (iso: string) => new Date(iso).getDate();

const COR = {
  azul: "#2563EB",
  laranja: "#EA580C",
  cinza: "#94A3B8",
  verde: "#059669",
  violeta: "#7C3AED",
  rosa: "#DB2777",
  ciano: "#0891B2",
  ambar: "#D97706",
};

export interface LinhaPainel {
  created_at: string;
  bruto: number;
  total: number;
  taxa: number;
  cpa: number;
  lucroLiquido: number;
  temCusto: boolean;
}

export interface Comissionado { nome: string; base: number; pct: number }

interface Props {
  ano: number;
  mes: number;
  linhas: LinhaPainel[];
  /** Pedidos dos 3 meses anteriores (data + bruto), pra comparativo e dicas. */
  historico: { created_at: string; bruto: number }[];
  /** Datas de criação dos orçamentos do mês e do mês passado. */
  orcamentos: string[];
  comissoes: Comissionado[];
  custoFixo: number;
  cpa: number;
  onSalvarPremissas: (custoFixo: number, cpa: number) => Promise<void> | void;
}

export default function PainelEmpate({ ano, mes, linhas, historico, orcamentos, comissoes, custoFixo, cpa, onSalvarPremissas }: Props) {
  const agora = new Date();
  const mesAtual = agora.getFullYear() === ano && agora.getMonth() === mes;
  const mesFuturo = new Date(ano, mes, 1) > agora;
  const dias = diasUteisDoMes(ano, mes, agora);
  const hojeDia = mesAtual ? agora.getDate() : null;
  const ultimoDiaVisto = mesAtual ? agora.getDate() : dias.diasNoMes;

  const inicioMes = new Date(ano, mes, 1);
  const inicioPassado = new Date(ano, mes - 1, 1);
  const diasPassado = new Date(ano, mes, 0).getDate();

  const c = useMemo(() => {
    const bruto = linhas.reduce((s, l) => s + l.bruto, 0);
    const comCusto = linhas.filter(l => l.temCusto && l.bruto > 0);
    const brutoComCusto = comCusto.reduce((s, l) => s + l.bruto, 0);
    const lucroComCusto = comCusto.reduce((s, l) => s + l.lucroLiquido, 0);
    const margemReal = brutoComCusto > 0 ? lucroComCusto / brutoComCusto : null;
    const margem = margemReal != null && margemReal > 0.01 ? margemReal : MARGEM_PADRAO;
    const margemAntesCpa = brutoComCusto > 0
      ? (lucroComCusto + comCusto.reduce((s, l) => s + l.cpa, 0)) / brutoComCusto
      : null;
    // Pedido sem custo lançado entra com a margem média dos que têm.
    const contribuicao = lucroComCusto + linhas.filter(l => !(l.temCusto && l.bruto > 0)).reduce((s, l) => s + l.bruto * margem, 0);
    const empate = custoFixo / margem;
    const falta = Math.max(0, empate - bruto);
    const resultado = contribuicao - custoFixo;
    const mediaDiaUtil = dias.passados > 0 ? bruto / dias.passados : 0;
    const projecao = mesAtual ? mediaDiaUtil * dias.total : bruto;
    const necessarioDia = dias.restantes > 0 ? falta / dias.restantes : falta;
    const taxas = linhas.reduce((s, l) => s + l.taxa, 0);
    const prejuizo = linhas.filter(l => l.temCusto && l.lucroLiquido < 0).length;
    const semCusto = linhas.filter(l => !l.temCusto && l.bruto > 0).length;

    // Mês passado
    const passado = historico.filter(h => {
      const d = new Date(h.created_at);
      return d >= inicioPassado && d < inicioMes;
    });
    const passadoAteHoje = passado.filter(h => diaDe(h.created_at) <= ultimoDiaVisto);
    const brutoPassadoAteHoje = passadoAteHoje.reduce((s, h) => s + h.bruto, 0);
    const brutoPassado = passado.reduce((s, h) => s + h.bruto, 0);

    // Orçamentos
    const orcMes = orcamentos.filter(o => { const d = new Date(o); return d >= inicioMes; });
    const orcPassado = orcamentos.filter(o => { const d = new Date(o); return d >= inicioPassado && d < inicioMes; });
    const orcPassadoAteHoje = orcPassado.filter(o => diaDe(o) <= ultimoDiaVisto);
    const conversao = orcMes.length > 0 ? linhas.length / orcMes.length : null;
    const conversaoPassado = orcPassado.length > 0 ? passado.length / orcPassado.length : null;

    // Dia em que, no ritmo atual, o vendido cruza o empate.
    let diaEmpate: number | null = null;
    if (mesAtual && mediaDiaUtil > 0 && falta > 0) {
      let acc = bruto;
      for (let d = agora.getDate() + 1; d <= dias.diasNoMes; d++) {
        const wd = new Date(ano, mes, d).getDay();
        if (wd === 0 || wd === 6) continue;
        acc += mediaDiaUtil;
        if (acc >= empate) { diaEmpate = d; break; }
      }
    }

    // Melhor dia da semana (3 meses anteriores): média vendida por ocorrência.
    const porSemana = Array.from({ length: 7 }, () => ({ total: 0, dias: new Set<string>() }));
    for (const h of historico) {
      const d = new Date(h.created_at);
      if (d >= inicioMes) continue;
      porSemana[d.getDay()].total += h.bruto;
      porSemana[d.getDay()].dias.add(d.toDateString());
    }
    const inicioHist = new Date(ano, mes - 3, 1);
    const ocorrencias = Array(7).fill(0) as number[];
    for (let d = new Date(inicioHist); d < inicioMes; d.setDate(d.getDate() + 1)) ocorrencias[d.getDay()]++;
    const mediasSemana = porSemana.map((s, i) => ({ dia: i, media: ocorrencias[i] ? s.total / ocorrencias[i] : 0 }))
      .filter(s => s.dia !== 0 && s.dia !== 6);
    const melhorSemana = [...mediasSemana].sort((a, b) => b.media - a.media)[0];
    const piorSemana = [...mediasSemana].sort((a, b) => a.media - b.media)[0];

    return {
      bruto, margem, margemReal, margemAntesCpa, contribuicao, empate, falta, resultado, mediaDiaUtil, projecao,
      necessarioDia, taxas, prejuizo, semCusto, brutoPassadoAteHoje, brutoPassado, passado, passadoAteHoje,
      orcMes, orcPassadoAteHoje, conversao, conversaoPassado, diaEmpate, melhorSemana, piorSemana,
      ticket: linhas.length ? bruto / linhas.length : 0,
      ticketPassado: passadoAteHoje.length ? brutoPassadoAteHoje / passadoAteHoje.length : 0,
    };
  }, [linhas, historico, orcamentos, custoFixo, dias.passados, dias.total, dias.restantes, dias.diasNoMes, mesAtual, ano, mes, ultimoDiaVisto]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Séries dos gráficos ────────────────────────────────────────── */
  const serieDias = useMemo(() => {
    const pts: PontoDia[] = [];
    for (let d = 1; d <= dias.diasNoMes; d++) {
      const wd = new Date(ano, mes, d).getDay();
      pts.push({ dia: d, fimDeSemana: wd === 0 || wd === 6, orcamentos: 0, pedidos: 0, vendido: 0 });
    }
    for (const l of linhas) {
      const p = pts[diaDe(l.created_at) - 1];
      if (p) { p.pedidos = (Number(p.pedidos) || 0) + 1; p.vendido = (Number(p.vendido) || 0) + l.bruto; }
    }
    for (const o of c.orcMes) {
      const p = pts[diaDe(o) - 1];
      if (p) p.orcamentos = (Number(p.orcamentos) || 0) + 1;
    }
    return pts;
  }, [linhas, c.orcMes, dias.diasNoMes, ano, mes]);

  const acumulado = useMemo(() => {
    const n = Math.max(dias.diasNoMes, diasPassado);
    const este: (number | null)[] = Array(n).fill(null);
    const ant: (number | null)[] = Array(n).fill(null);
    const porDiaEste = Array(n + 1).fill(0) as number[];
    const porDiaAnt = Array(n + 1).fill(0) as number[];
    for (const l of linhas) porDiaEste[diaDe(l.created_at)] += l.bruto;
    for (const h of c.passado) porDiaAnt[diaDe(h.created_at)] += h.bruto;
    let a = 0, b = 0;
    for (let d = 1; d <= n; d++) {
      a += porDiaEste[d]; b += porDiaAnt[d];
      if (d <= dias.diasNoMes && (!mesAtual || d <= agora.getDate()) && !mesFuturo) este[d - 1] = a;
      if (d <= diasPassado) ant[d - 1] = b;
    }
    return { n, este, ant };
  }, [linhas, c.passado, dias.diasNoMes, diasPassado, mesAtual, mesFuturo]); // eslint-disable-line react-hooks/exhaustive-deps

  const metaDia = dias.total > 0 ? c.empate / dias.total : 0;
  const nomeMes = (m: number) => new Date(ano, m, 1).toLocaleDateString("pt-BR", { month: "long" });
  const rotuloDia = (d: number) => {
    const dt = new Date(ano, mes, d);
    return `${DIAS_SEMANA[dt.getDay()]}, ${String(d).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
  };

  /* ── Dicas ──────────────────────────────────────────────────────── */
  const dicas = useMemo(() => {
    const out: { icone: React.ElementType; cor: string; titulo: string; texto: string }[] = [];
    if (mesAtual && c.falta > 0) {
      out.push({
        icone: Gauge, cor: COR.azul, titulo: "Ritmo pra empatar",
        texto: dias.restantes > 0
          ? `Venda ${brl0(c.necessarioDia)} por dia útil nos ${dias.restantes} dias úteis que faltam. Sua média até agora é ${brl0(c.mediaDiaUtil)}/dia útil${c.diaEmpate ? ` — nesse ritmo você empata no dia ${c.diaEmpate}` : c.mediaDiaUtil > 0 ? " — nesse ritmo o mês fecha no vermelho" : ""}.`
          : `Faltam ${brl0(c.falta)} pra empatar e não há mais dias úteis no mês.`,
      });
    }
    if (c.falta <= 0 && c.bruto > 0) {
      out.push({
        icone: PartyPopper, cor: COR.verde, titulo: "Passou do empate!",
        texto: `Daqui pra frente cada R$ 1.000 vendido deixa cerca de ${brl0(1000 * c.margem)} de lucro no bolso.`,
      });
    }
    if (c.brutoPassadoAteHoje > 0 && !mesFuturo) {
      const dif = (c.bruto - c.brutoPassadoAteHoje) / c.brutoPassadoAteHoje;
      out.push({
        icone: dif >= 0 ? TrendingUp : TrendingDown, cor: dif >= 0 ? COR.verde : COR.rosa,
        titulo: dif >= 0 ? "À frente do mês passado" : "Atrás do mês passado",
        texto: `Até o dia ${ultimoDiaVisto} de ${nomeMes(mes - 1)} você tinha vendido ${brl0(c.brutoPassadoAteHoje)}; agora são ${brl0(c.bruto)} (${dif >= 0 ? "+" : ""}${pctTxt(dif)}).`,
      });
    }
    if (c.conversao != null) {
      const txt = `${c.orcMes.length} orçamentos viraram ${linhas.length} pedidos (${pctTxt(c.conversao)})`;
      out.push({
        icone: FileText, cor: COR.laranja, titulo: "Conversão de orçamentos",
        texto: c.conversaoPassado != null
          ? `${txt}. Mês passado foi ${pctTxt(c.conversaoPassado)}. ${c.conversao < c.conversaoPassado ? "Vale um follow-up nos orçamentos em aberto." : "Bom trabalho no fechamento!"}`
          : `${txt}.`,
      });
    }
    if (c.margemAntesCpa != null && c.margemAntesCpa > 0) {
      const ticketMin = cpa / c.margemAntesCpa;
      const abaixo = linhas.filter(l => l.bruto > 0 && l.bruto < ticketMin).length;
      out.push({
        icone: Target, cor: COR.violeta, titulo: "Ticket mínimo que paga o CPA",
        texto: `Com margem de ${pctTxt(c.margemAntesCpa)} antes do CPA, pedido abaixo de ${brl0(ticketMin)} não paga os ${brl0(cpa)} de aquisição.${abaixo ? ` Este mês ${abaixo} pedido(s) ficaram abaixo — tente kits ou quantidade mínima maior.` : ""}`,
      });
    }
    if (c.melhorSemana && c.melhorSemana.media > 0) {
      out.push({
        icone: CalendarDays, cor: COR.ciano, titulo: "Melhor dia da semana",
        texto: `Nos últimos 3 meses, ${DIAS_SEMANA[c.melhorSemana.dia]} vendeu em média ${brl0(c.melhorSemana.media)}${c.piorSemana && c.piorSemana.dia !== c.melhorSemana.dia ? ` e ${DIAS_SEMANA[c.piorSemana.dia]} só ${brl0(c.piorSemana.media)}` : ""}. Programe campanhas e retornos de orçamento pra véspera do dia forte.`,
      });
    }
    if (c.taxas > 0 && c.bruto > 0) {
      out.push({
        icone: CreditCard, cor: COR.ambar, titulo: "Custo do cartão",
        texto: `Taxas de cartão já levaram ${brl0(c.taxas)} este mês (${pctTxt(c.taxas / c.bruto)} do vendido). Um desconto no PIX menor que a taxa do parcelado ainda sai mais barato.`,
      });
    }
    const perto = comissoes
      .map(v => ({ ...v, prox: proximaFaixa(v.base) }))
      .filter(v => v.prox && v.prox.falta < 8000 && v.base > 0)
      .sort((a, b) => a.prox!.falta - b.prox!.falta)[0];
    if (perto?.prox) {
      out.push({
        icone: Users, cor: COR.azul, titulo: "Vendedor perto da próxima faixa",
        texto: `${perto.nome} está a ${brl0(perto.prox.falta)} da faixa de ${perto.prox.pct}% de comissão — bom momento pra passar leads quentes.`,
      });
    }
    if (c.prejuizo > 0) {
      out.push({
        icone: AlertTriangle, cor: COR.rosa, titulo: "Pedidos no prejuízo",
        texto: `${c.prejuizo} pedido(s) deram lucro negativo depois de comissão e CPA. Confira preço e frete na tabela abaixo (lucro em vermelho).`,
      });
    }
    if (c.semCusto > 0) {
      out.push({
        icone: Receipt, cor: COR.cinza, titulo: "Custo ainda não lançado",
        texto: `${c.semCusto} pedido(s) estão sem custo de produto — entram com a margem média (${pctTxt(c.margem)}). Quando o comprador registrar a compra, o número fica exato.`,
      });
    }
    return out;
  }, [c, linhas, cpa, comissoes, mesAtual, mesFuturo, dias.restantes, ultimoDiaVisto]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Premissas editáveis ────────────────────────────────────────── */
  const [editando, setEditando] = useState(false);
  const [fixoTxt, setFixoTxt] = useState("");
  const [cpaTxt, setCpaTxt] = useState("");
  const aNum = (t: string) => Number(t.replace(/\./g, "").replace(",", ".")) || 0;

  const progresso = c.empate > 0 ? Math.min(1, c.bruto / c.empate) : 0;
  const empatou = c.falta <= 0 && c.bruto > 0;
  const deltaPct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);

  return (
    <div className="space-y-4">
      {/* ── Hero: ponto de equilíbrio ───────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 text-white shadow-lg"
        style={{
          background: empatou
            ? "linear-gradient(135deg, #047857 0%, #059669 45%, #10B981 100%)"
            : "linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #7C3AED 100%)",
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-24 -bottom-20 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative grid gap-5 lg:grid-cols-[1.3fr_1fr] items-center">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/80">
              {empatou ? <Rocket className="h-4 w-4" /> : <Target className="h-4 w-4" />}
              {empatou ? "Empate batido — agora é lucro" : "Quanto falta pra empatar o mês"}
            </div>
            <p className="mt-1 text-[38px] md:text-[46px] font-extrabold leading-none tabular-nums">
              {empatou ? `+ ${brl0(c.resultado)}` : brl0(c.falta)}
            </p>
            <p className="mt-2 text-[14px] text-white/85">
              {empatou
                ? <>de lucro acima do custo fixo de {brl0(custoFixo)}</>
                : <>pra cobrir o custo fixo de {brl0(custoFixo)} — o faturamento do mês precisa chegar a <strong className="text-white">{brl0(c.empate)}</strong></>}
            </p>

            <div className="mt-4">
              <div className="relative h-4 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${progresso * 100}%`, background: empatou ? "#FFFFFF" : "linear-gradient(90deg, #FDE68A, #FBBF24)" }}
                />
                {mesAtual && c.projecao > 0 && c.empate > 0 && (
                  <span
                    className="absolute top-0 h-full w-[3px] bg-white"
                    style={{ left: `${Math.min(100, (c.projecao / c.empate) * 100)}%` }}
                    title={`Projeção do mês: ${brl0(c.projecao)}`}
                  />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[12px] text-white/80 tabular-nums">
                <span>Vendido {brl0(c.bruto)} · {(progresso * 100).toFixed(0)}%</span>
                <span>Empate {brl0(c.empate)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { r: mesAtual ? "Precisa por dia útil" : "Dias úteis no mês", v: mesAtual ? (c.falta > 0 ? brl0(c.necessarioDia) : "—") : String(dias.total), s: mesAtual ? `${dias.restantes} dias úteis restantes` : "" },
              { r: "Média por dia útil", v: brl0(c.mediaDiaUtil), s: `${dias.passados} de ${dias.total} dias úteis` },
              { r: mesAtual ? "Projeção do mês" : "Faturado no mês", v: brl0(c.projecao), s: mesAtual ? (c.projecao >= c.empate ? "✓ passa do empate" : `${brl0(c.empate - c.projecao)} abaixo do empate`) : "" },
              { r: "Resultado até agora", v: brl0(c.resultado), s: `margem de contribuição ${pctTxt(c.margem)}` },
            ].map(x => (
              <div key={x.r} className="rounded-xl bg-white/12 backdrop-blur-sm p-3" style={{ background: "rgba(255,255,255,.12)" }}>
                <p className="text-[11px] uppercase tracking-wide text-white/75">{x.r}</p>
                <p className="text-[20px] font-bold leading-tight tabular-nums">{x.v}</p>
                {x.s && <p className="text-[11px] text-white/75">{x.s}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-white/80">
          {editando ? (
            <>
              <span>Custo fixo/mês</span>
              <Input value={fixoTxt} onChange={e => setFixoTxt(e.target.value)} inputMode="decimal" className="h-7 w-[110px] bg-white text-black text-right" />
              <span>CPA por pedido</span>
              <Input value={cpaTxt} onChange={e => setCpaTxt(e.target.value)} inputMode="decimal" className="h-7 w-[80px] bg-white text-black text-right" />
              <button type="button" className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-[#1E3A8A]"
                onClick={async () => { await onSalvarPremissas(aNum(fixoTxt), aNum(cpaTxt)); setEditando(false); }}>
                <Check className="h-3.5 w-3.5" /> Salvar
              </button>
              <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/15" onClick={() => setEditando(false)}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </>
          ) : (
            <>
              <span>Premissas: custo fixo {brl0(custoFixo)}/mês (+ imposto de cada venda) · CPA {brl0(cpa)} por pedido · margem {c.margemReal != null ? "real dos pedidos com custo" : `padrão de ${pctTxt(MARGEM_PADRAO)} (ainda sem custo lançado)`}</span>
              <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-white/15"
                onClick={() => { setFixoTxt(String(custoFixo).replace(".", ",")); setCpaTxt(String(cpa).replace(".", ",")); setEditando(true); }}>
                <Pencil className="h-3 w-3" /> ajustar
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── KPIs coloridos ─────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icone={TrendingUp} cor={COR.azul} rotulo="Vendido (sem frete)" valor={curto(c.bruto)} titulo={brl(c.bruto)} delta={deltaPct(c.bruto, c.brutoPassadoAteHoje)} />
        <Kpi icone={ShoppingCart} cor={COR.violeta} rotulo="Pedidos" valor={String(linhas.length)} delta={deltaPct(linhas.length, c.passadoAteHoje.length)} />
        <Kpi icone={Receipt} cor={COR.ciano} rotulo="Ticket médio" valor={curto(c.ticket)} titulo={brl(c.ticket)} delta={deltaPct(c.ticket, c.ticketPassado)} />
        <Kpi icone={FileText} cor={COR.laranja} rotulo="Orçamentos" valor={String(c.orcMes.length)} sub={c.conversao != null ? `${pctTxt(c.conversao)} viram pedido` : undefined} delta={deltaPct(c.orcMes.length, c.orcPassadoAteHoje.length)} />
        <Kpi icone={Percent} cor={COR.rosa} rotulo="Margem de contribuição" valor={pctTxt(c.margem)} sub="após custos, imposto, cartão, comissão e CPA" />
        <Kpi icone={Wallet} cor={c.resultado >= 0 ? COR.verde : COR.rosa} rotulo="Resultado do mês" valor={curto(c.resultado)} titulo={brl(c.resultado)} sub={`contribuição ${curto(c.contribuicao)} − fixo`} />
      </div>
      <p className="gw-meta -mt-2 text-[11px]">▲▼ comparando com {nomeMes(mes - 1)} até o mesmo dia ({ultimoDiaVisto}).</p>

      {/* ── Gráficos ───────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Vendido por dia" subtitulo={`Linha verde = meta diária pra empatar (${brl0(metaDia)} por dia útil)`} cor={COR.azul}>
          <BarrasPorDia
            dados={serieDias}
            series={[{ chave: "vendido", label: "Vendido no dia", cor: COR.azul }]}
            formatar={brl0}
            eixo={curto}
            meta={{ valor: metaDia, label: "Meta do dia", cor: "var(--gw-success)" }}
            rotuloDia={rotuloDia}
          />
        </Cartao>
        <Cartao titulo="Orçamentos x pedidos por dia" subtitulo="Quantidade lançada em cada dia do mês" cor={COR.laranja}>
          <BarrasPorDia
            dados={serieDias}
            series={[
              { chave: "orcamentos", label: "Orçamentos", cor: COR.laranja },
              { chave: "pedidos", label: "Pedidos", cor: COR.azul },
            ]}
            formatar={v => String(Math.round(v))}
            eixo={v => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
            rotuloDia={rotuloDia}
          />
        </Cartao>
      </div>

      <Cartao titulo={`Acumulado: ${nomeMes(mes)} x ${nomeMes(mes - 1)}`} subtitulo="Montante vendido somado dia a dia — a linha verde é o faturamento que empata o mês" cor={COR.violeta}>
        <LinhasAcumulado
          dias={acumulado.n}
          series={[
            { chave: "este", label: `${nomeMes(mes)} (este mês)`, cor: COR.azul, valores: acumulado.este },
            { chave: "ant", label: `${nomeMes(mes - 1)} (mês passado)`, cor: COR.cinza, tracejada: true, valores: acumulado.ant },
          ]}
          empate={c.empate}
          hojeDia={hojeDia}
          rotuloDia={d => `Até o dia ${d}`}
        />
      </Cartao>

      {/* ── Dicas ──────────────────────────────────────────────────── */}
      {dicas.length > 0 && (
        <Cartao titulo="Dicas a partir das suas vendas" subtitulo="Calculadas na hora com os pedidos, orçamentos e os últimos 3 meses" cor={COR.ambar} icone={Lightbulb}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dicas.map(d => (
              <div key={d.titulo} className="flex gap-3 rounded-xl p-3 border" style={{ borderColor: `${d.cor}40`, background: `${d.cor}0D` }}>
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: d.cor }}>
                  <d.icone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="gw-body font-bold text-[13.5px]" style={{ color: "var(--gw-text)" }}>{d.titulo}</p>
                  <p className="text-[12.5px] leading-snug" style={{ color: "var(--gw-text-secondary)" }}>{d.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </Cartao>
      )}
    </div>
  );
}

function Kpi({ icone: Icone, cor, rotulo, valor, titulo, sub, delta }: {
  icone: React.ElementType; cor: string; rotulo: string; valor: string; titulo?: string; sub?: string; delta?: number | null;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-3.5 transition-transform hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}
      title={titulo}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: cor }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gw-text-secondary)" }}>{rotulo}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `${cor}1F` }}>
          <Icone className="h-3.5 w-3.5" style={{ color: cor }} />
        </span>
      </div>
      <p className="mt-1 text-[24px] font-extrabold leading-tight tabular-nums" style={{ color: "var(--gw-text)" }}>{valor}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--gw-text-muted)" }}>
        {delta != null && Number.isFinite(delta) && (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-[1px] font-bold"
            style={{ background: delta >= 0 ? "#05966922" : "#DB277722", color: delta >= 0 ? "#047857" : "#BE185D" }}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}%
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function Cartao({ titulo, subtitulo, cor, icone: Icone, children }: {
  titulo: string; subtitulo?: string; cor: string; icone?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-1 inline-block h-4 w-1.5 rounded-full shrink-0" style={{ background: cor }} />
        <div className="min-w-0">
          <h2 className="gw-title text-[15px] flex items-center gap-1.5 capitalize-first">
            {Icone && <Icone className="h-4 w-4" style={{ color: cor }} />}{titulo}
          </h2>
          {subtitulo && <p className="gw-meta text-[12px]">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
