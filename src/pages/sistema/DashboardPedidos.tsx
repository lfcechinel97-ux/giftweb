import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSistema } from "@/contexts/SistemaContext";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import PainelEmpate from "./financeiro/PainelEmpate";
import { CUSTO_FIXO_MENSAL_PADRAO, faixaDe } from "@/lib/financeiroRegras";
import { calcularPedido, carregarBaseResultado, type Fin, type ItemFin } from "@/lib/resultadoPedidos";

/* Dashboard por pedido (admin). Todo pedido lançado entra na hora.
   - Bruto (PV) = valor dos produtos, sem frete.
   - Imposto = % da config sobre o total do pedido.
   - Tx cartão = % da forma de pagamento do pedido (Cartão 1x…12x) sobre o
     total; editável por pedido. Cartão parcelado "sem juros" cadastrado com
     0% usa a tabela da maquininha pelo nº de parcelas (a empresa absorve).
   - Frete: CIF é custo da empresa e desconta do lucro; FOB é pago pelo
     cliente e só aparece para conferência.
   - Custo do produto e personalização são POR UNIDADE de cada produto.
   - Comissão: por vendedor no mês = soma(bruto − imposto − tx cartão) ×
     faixa escalonada, aplicada ao total (52 mil => 4% de tudo). Cada pedido
     desconta a comissão na faixa em que o vendedor está no mês.
   - Lucro líquido = lucro − comissão. O custo fixo do mês (sistema_financeiro_
     config; já inclui tráfego/aquisição) entra só no painel de empate.
   - Custo do produto, nesta ordem: o digitado aqui no item > preço lançado
     pelo admin na compra (página Compras) > custo do catálogo no item. */

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const aNum = (t: string) => {
  const n = Number(String(t).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const paraTexto = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const mesLabel = (ano: number, mes: number) =>
  new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

type Campo = "taxa_cartao_pct" | "frete" | "valor_recebido";
type CampoItem = "custo_unitario" | "custo_personalizacao_unit";

export default function DashboardPedidos() {
  const qc = useQueryClient();
  const { vendedores, clientes } = useSistema();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const inicio = new Date(ano, mes, 1).toISOString();
  const fim = new Date(ano, mes + 1, 1).toISOString();
  const chave = ["sistema", "dash-pedidos", ano, mes] as const;

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: chave,
    staleTime: 15 * 1000,
    // Rede de segurança do "ao vivo": se um evento do realtime se perder.
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const inicioHist = new Date(ano, mes - 3, 1).toISOString();
      const inicioPassado = new Date(ano, mes - 1, 1).toISOString();
      const [base, hist, orcs] = await Promise.all([
        carregarBaseResultado({ inicio, fim }),
        // Pedidos dos 3 meses anteriores: comparativo e dicas.
        supabase.from("sistema_pedidos").select("created_at,subtotal")
          .neq("status", "cancelado").gte("created_at", inicioHist).lt("created_at", inicio).limit(5000),
        supabase.from("sistema_orcamentos").select("created_at")
          .gte("created_at", inicioPassado).lt("created_at", fim).limit(5000),
      ]);
      return {
        ...base,
        historico: ((hist.data ?? []) as { created_at: string; subtotal: number | null }[])
          .map(h => ({ created_at: h.created_at, bruto: Number(h.subtotal) || 0 })),
        orcamentos: ((orcs.data ?? []) as { created_at: string }[]).map(o => o.created_at),
      };
    },
  });

  // Tempo real: pedido novo / custo lançado aparece na hora.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["sistema", "dash-pedidos"] }), 800);
    };
    const canal = supabase
      .channel("dash-pedidos-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_pedidos" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_pedido_financeiro" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_item_financeiro" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_compras_itens" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_compras_precos" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_orcamentos" }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [qc]);

  const linhas = useMemo(() => {
    if (!data) return [];
    return data.pedidos.map(p => {
      const r = calcularPedido(p, data);
      const cliente = clientes.find(c => c.id === p.cliente_id) as any;
      return {
        ...r,
        clienteNome: cliente?.nome || cliente?.razaoSocial || p.cliente_snapshot?.nome || "—",
        vendedorNome: vendedores.find(v => v.id === p.vendedor_id)?.nome ?? "Sem vendedor",
      };
    });
  }, [data, clientes, vendedores]);

  const totais = useMemo(() => {
    const t = { bruto: 0, imposto: 0, taxa: 0, custos: 0, frete: 0, lucro: 0, recebido: 0, aReceber: 0 };
    for (const l of linhas) {
      t.bruto += l.bruto; t.imposto += l.imposto; t.taxa += l.taxa;
      t.custos += l.custoProduto + l.custoPers; t.frete += l.frete; t.lucro += l.lucro;
      t.recebido += l.recebido; t.aReceber += l.aReceber;
    }
    return t;
  }, [linhas]);

  const comissoes = useMemo(() => {
    const por = new Map<string, { id: string; nome: string; base: number; pedidos: number }>();
    for (const l of linhas) {
      const k = l.p.vendedor_id ?? "—";
      const acc = por.get(k) ?? { id: k, nome: l.vendedorNome, base: 0, pedidos: 0 };
      acc.base += l.baseComissao; acc.pedidos += 1;
      por.set(k, acc);
    }
    return [...por.values()]
      .map(v => { const f = faixaDe(v.base); return { ...v, pct: f.pct, valor: v.base * f.pct / 100 }; })
      .sort((a, b) => b.base - a.base);
  }, [linhas]);
  const totalComissao = comissoes.reduce((s, c) => s + c.valor, 0);
  const custoFixo = data?.custoFixo ?? CUSTO_FIXO_MENSAL_PADRAO;

  /* Comissão do pedido = base dele × faixa do vendedor no mês. */
  const linhasLiq = useMemo(() => {
    const pctPor = new Map(comissoes.map(c => [c.id, c.pct]));
    return linhas.map(l => {
      const comissaoPct = pctPor.get(l.p.vendedor_id ?? "—") ?? 0;
      const comissao = l.baseComissao * comissaoPct / 100;
      const lucroLiquido = l.lucro - comissao;
      return {
        ...l, comissaoPct, comissao, lucroLiquido,
        margem: l.bruto > 0 ? lucroLiquido / l.bruto : 0,
        temCusto: l.custoProduto > 0,
        created_at: l.p.created_at,
      };
    });
  }, [linhas, comissoes]);
  const lucroFinal = totais.lucro - totalComissao;

  const salvarPremissas = async (novoFixo: number) => {
    const { error } = await (supabase as any).from("sistema_financeiro_config")
      .update({ custo_fixo_mensal: novoFixo }).eq("id", true);
    if (error) { toast.error(`Não foi possível salvar as premissas. ${error.message || ""}`); return; }
    toast.success("Premissas atualizadas.");
    qc.invalidateQueries({ queryKey: ["sistema", "dash-pedidos"] });
  };

  const salvar = async (pedidoId: string, campo: Campo, texto: string, atual: Fin | undefined) => {
    const valor = texto.trim() === "" ? null : aNum(texto);
    const linha = {
      pedido_id: pedidoId,
      taxa_cartao_pct: atual?.taxa_cartao_pct ?? null,
      frete: atual?.frete ?? null,
      valor_recebido: atual?.valor_recebido ?? 0,
      [campo]: campo === "valor_recebido" ? (valor ?? 0) : valor,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await (supabase as any).from("sistema_pedido_financeiro").upsert(linha);
    if (error) { toast.error(`Não foi possível salvar. ${error.message || ""}`); return; }
    qc.invalidateQueries({ queryKey: chave });
  };

  const salvarItem = async (pedidoId: string, itemId: string, campo: CampoItem, texto: string, atual: ItemFin | undefined) => {
    const valor = texto.trim() === "" ? null : aNum(texto);
    const linha = {
      pedido_id: pedidoId,
      item_id: itemId,
      custo_unitario: atual?.custo_unitario ?? null,
      custo_personalizacao_unit: atual?.custo_personalizacao_unit ?? 0,
      [campo]: campo === "custo_personalizacao_unit" ? (valor ?? 0) : valor,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await (supabase as any).from("sistema_item_financeiro").upsert(linha);
    if (error) { toast.error(`Não foi possível salvar. ${error.message || ""}`); return; }
    qc.invalidateQueries({ queryKey: chave });
  };

  const inputNumero = (k: string, valorAtual: number, casas: number, onSalvar: (texto: string) => void) => (
    <Input
      value={edicao[k] ?? paraTexto(Number(valorAtual.toFixed(casas)))}
      onChange={e => setEdicao(prev => ({ ...prev, [k]: e.target.value }))}
      onBlur={() => {
        const t = edicao[k];
        setEdicao(prev => { const n = { ...prev }; delete n[k]; return n; });
        if (t !== undefined && aNum(t) !== Number(valorAtual)) onSalvar(t);
      }}
      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      inputMode="decimal"
      className="h-8 w-[92px] text-right text-[12.5px] px-2"
    />
  );

  const alternar = (id: string) =>
    setAbertos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear()); setMes(d.getMonth());
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="gw-display text-[20px]">Dashboard</h1>
          <p className="gw-meta flex flex-wrap items-center gap-x-2">
            Pedidos lançados no mês
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-[1px] text-[11px] font-bold" style={{ color: "#047857", background: "#05966918" }}>
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Radio className="h-3 w-3" /> ao vivo
            </span>
            {dataUpdatedAt > 0 && <span className="text-[11px]">atualizado às {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-[150px] text-center gw-body font-semibold capitalize">{mesLabel(ano, mes)}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 py-12 justify-center gw-meta"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          <PainelEmpate
            ano={ano}
            mes={mes}
            linhas={linhasLiq}
            historico={data.historico}
            orcamentos={data.orcamentos}
            comissoes={comissoes}
            custoFixo={custoFixo}
            onSalvarPremissas={salvarPremissas}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
              <div>
                <span className="gw-label">Vendido bruto (sem frete)</span>
                <p className="gw-num text-[34px] leading-tight" style={{ color: "var(--gw-text)" }}>{brl(totais.bruto)}</p>
                <p className="gw-meta">{linhas.length} pedido(s) · ticket médio {brl(linhas.length ? totais.bruto / linhas.length : 0)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: "var(--gw-surface-alt)" }}>
                  <span className="gw-label">Já recebido</span>
                  <p className="gw-num text-[20px]" style={{ color: "var(--gw-success)" }}>{brl(totais.recebido)}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: "var(--gw-surface-alt)" }}>
                  <span className="gw-label">A receber</span>
                  <p className="gw-num text-[20px]" style={{ color: "#EA580C" }}>{brl(totais.aReceber)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-5 space-y-2" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
              <span className="gw-label">Descontos do mês</span>
              {([
                ["Impostos", totais.imposto],
                ["Taxa de cartão", totais.taxa],
                ["Comissões", totalComissao],
                ["Custo dos produtos + personalização", totais.custos],
                ["Frete (CIF)", totais.frete],
              ] as [string, number][]).map(([r, v]) => (
                <div key={r} className="flex items-center justify-between gw-body text-[13.5px]">
                  <span>{r}</span><span className="gw-num" style={{ color: "var(--gw-danger)" }}>− {brl(v)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: "var(--gw-border)" }}>
                <span className="gw-body font-bold">Lucro das vendas</span>
                <span className="gw-num text-[20px]" style={{ color: lucroFinal < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(lucroFinal)}</span>
              </div>
              <div className="flex items-center justify-between gw-body text-[13.5px]">
                <span>Custo fixo do mês</span><span className="gw-num" style={{ color: "var(--gw-danger)" }}>− {brl(custoFixo)}</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: "var(--gw-border)" }}>
                <span className="gw-body font-bold">Resultado do mês</span>
                <span className="gw-num text-[20px]" style={{ color: lucroFinal - custoFixo < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(lucroFinal - custoFixo)}</span>
              </div>
              <p className="gw-meta text-[11px]">Pedido sem custo lançado entra com custo zero aqui; o painel do topo estima pela margem média.</p>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="gw-body font-bold">Comissão por vendedor</span>
              <span className="gw-meta">Base = vendas sem frete − imposto − taxa de cartão · faixa escalonada sobre o total</span>
            </div>
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase" style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}>
                <tr>
                  <th className="text-left px-4 py-2">Vendedor</th>
                  <th className="px-3 py-2 text-right">Pedidos</th>
                  <th className="px-3 py-2 text-right">Base do mês</th>
                  <th className="px-3 py-2 text-right">Faixa</th>
                  <th className="px-4 py-2 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gw-border)" }}>
                {comissoes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center gw-meta">Sem vendas neste mês.</td></tr>}
                {comissoes.map(c => (
                  <tr key={c.nome}>
                    <td className="px-4 py-2 font-semibold">{c.nome}</td>
                    <td className="px-3 py-2 text-right">{c.pedidos}</td>
                    <td className="px-3 py-2 text-right">{brl(c.base)}</td>
                    <td className="px-3 py-2 text-right">{pct(c.pct)}</td>
                    <td className="px-4 py-2 text-right font-bold">{brl(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-x-4">
              <span className="gw-body font-bold">Pedido por pedido</span>
              <span className="gw-meta">Clique no pedido para ver os produtos (custo é por unidade). Taxa de cartão vem da forma de pagamento do pedido; frete CIF é descontado, FOB só aparece para conferência.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] whitespace-nowrap">
                <thead className="text-[11px] uppercase" style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}>
                  <tr>
                    <th className="text-left px-3 py-2">Pedido</th>
                    <th className="text-left px-3 py-2">Cliente / Vendedor</th>
                    <th className="px-3 py-2 text-right">PV</th>
                    <th className="px-3 py-2 text-right">Custo produtos</th>
                    <th className="px-3 py-2 text-right">Personaliz.</th>
                    <th className="px-3 py-2 text-right">Imposto</th>
                    <th className="px-3 py-2 text-right">Tx cartão %</th>
                    <th className="px-3 py-2 text-right">Tx cartão</th>
                    <th className="px-3 py-2 text-right">Frete</th>
                    <th className="px-3 py-2 text-right">Lucro</th>
                    <th className="px-3 py-2 text-right">Comissão</th>
                    <th className="px-3 py-2 text-right">Lucro líq.</th>
                    <th className="px-3 py-2 text-right">Margem</th>
                    <th className="px-3 py-2 text-right">Recebido</th>
                    <th className="px-3 py-2 text-right">A receber</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--gw-border)" }}>
                  {linhasLiq.length === 0 && <tr><td colSpan={15} className="px-4 py-8 text-center gw-meta">Nenhum pedido neste mês.</td></tr>}
                  {linhasLiq.map(l => {
                    const aberto = abertos.has(l.p.id);
                    return (
                      <Fragment key={l.p.id}>
                        <tr className="cursor-pointer hover:bg-[var(--gw-surface-alt)]" onClick={() => alternar(l.p.id)}>
                          <td className="px-3 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <OrderNumber value={l.p.numero} className="text-[12.5px]" />
                            </span>
                          </td>
                          <td className="px-3 py-1.5 max-w-[240px]">
                            <p className="truncate font-medium">{l.clienteNome}</p>
                            <p className="gw-meta text-[11px] truncate">{l.vendedorNome}{l.meio ? ` · ${l.meio.nome}` : " · sem forma de pagamento"} · {l.produtos.length} produto(s)</p>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold">{brl(l.bruto)}</td>
                          <td className="px-3 py-1.5 text-right">{brl(l.custoProduto)}</td>
                          <td className="px-3 py-1.5 text-right">{brl(l.custoPers)}</td>
                          <td className="px-3 py-1.5 text-right">{brl(l.imposto)}</td>
                          <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                            {inputNumero(`${l.p.id}:taxa`, l.taxaPct, 3, t => void salvar(l.p.id, "taxa_cartao_pct", t, l.f))}
                          </td>
                          <td className="px-3 py-1.5 text-right">{brl(l.taxa)}</td>
                          <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                            {l.p.frete_tipo === "FOB" ? (
                              <span className="gw-meta text-[11.5px]" title="FOB: o cliente paga o frete. Não entra no lucro, só para conferência.">FOB {brl(l.fob)}</span>
                            ) : inputNumero(`${l.p.id}:frete`, l.frete, 2, t => void salvar(l.p.id, "frete", t, l.f))}
                          </td>
                          <td className="px-3 py-1.5 text-right" style={{ color: l.lucro < 0 ? "var(--gw-danger)" : undefined }}>{brl(l.lucro)}</td>
                          <td className="px-3 py-1.5 text-right" title={`Faixa do vendedor no mês: ${pct(l.comissaoPct)}`}>{brl(l.comissao)}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{ color: l.lucroLiquido < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(l.lucroLiquido)}</td>
                          <td className="px-3 py-1.5 text-right">
                            {l.bruto > 0 ? (
                              <span
                                className="inline-block rounded-full px-2 py-[1px] text-[11px] font-bold"
                                style={l.margem < 0 ? { background: "#DB277720", color: "#BE185D" }
                                  : l.margem < 0.15 ? { background: "#D9770620", color: "#B45309" }
                                  : { background: "#05966920", color: "#047857" }}
                                title={l.temCusto ? undefined : "Sem custo de produto lançado — margem superestimada"}
                              >
                                {(l.margem * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{!l.temCusto && " *"}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {inputNumero(`${l.p.id}:recebido`, l.recebido, 2, t => void salvar(l.p.id, "valor_recebido", t, l.f))}
                              <button type="button" className="text-[10.5px] font-semibold rounded px-1.5 py-1 border" style={{ borderColor: "var(--gw-border)" }}
                                title="Metade recebida" onClick={() => salvar(l.p.id, "valor_recebido", paraTexto(Number((l.total / 2).toFixed(2))), l.f)}>50%</button>
                              <button type="button" className="text-[10.5px] font-semibold rounded px-1.5 py-1 border" style={{ borderColor: "var(--gw-border)" }}
                                title="Tudo recebido" onClick={() => salvar(l.p.id, "valor_recebido", paraTexto(Number(l.total.toFixed(2))), l.f)}>100%</button>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold" style={{ color: l.aReceber > 0 ? "#EA580C" : "var(--gw-text-muted)" }}>{brl(l.aReceber)}</td>
                        </tr>
                        {aberto && (
                          <tr>
                            <td colSpan={15} className="px-3 pb-3 pt-0" style={{ background: "var(--gw-surface-alt)" }}>
                              <table className="w-full text-[12px] mt-2">
                                <thead className="text-[10.5px] uppercase" style={{ color: "var(--gw-text-secondary)" }}>
                                  <tr>
                                    <th className="text-left py-1 px-2">Produto</th>
                                    <th className="text-right px-2">Qtd</th>
                                    <th className="text-right px-2">PV unit.</th>
                                    <th className="text-right px-2">Custo unit.</th>
                                    <th className="text-right px-2">Personaliz. unit.</th>
                                    <th className="text-right px-2">PV total</th>
                                    <th className="text-right px-2">Custo total</th>
                                    <th className="text-right px-2">Margem</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {l.produtos.map(x => {
                                    const atual = data.itemFin[`${l.p.id}:${x.itemId}`];
                                    return (
                                      <tr key={x.itemId} className="border-t" style={{ borderColor: "var(--gw-border)" }}>
                                        <td className="py-1.5 px-2 max-w-[280px] truncate font-medium">{x.nome}</td>
                                        <td className="text-right px-2">{x.qtd}</td>
                                        <td className="text-right px-2">{brl(x.pvUnit)}</td>
                                        <td className="text-right px-2">
                                          <span className="inline-flex items-center justify-end gap-1.5">
                                            <span
                                              className="text-[10px] font-semibold rounded-full px-1.5 py-[1px]"
                                              style={x.origemCusto === "compra" ? { background: "#05966920", color: "#047857" }
                                                : x.origemCusto === "editado" ? { background: "#2563EB1A", color: "#1D4ED8" }
                                                : x.origemCusto === "catalogo" ? { background: "#94A3B833", color: "#475569" }
                                                : x.origemCusto === "compra_sem_preco" ? { background: "#F59E0B26", color: "#B45309" }
                                                : { background: "#DB277720", color: "#BE185D" }}
                                              title={x.origemCusto === "editado" ? "Digitado aqui. Apague o campo para voltar ao preço da compra."
                                                : x.origemCusto === "compra_sem_preco" ? "A compra foi registrada sem valor unitário. Lance o preço em Compras → Pedido de compra."
                                                : x.origemCusto === "sem" ? "Nenhuma compra registrada para este produto deste pedido." : undefined}
                                            >
                                              {x.origemCusto === "compra" ? `compra${x.comprasNum.length ? ` nº ${x.comprasNum.join(", ")}` : ""}`
                                                : x.origemCusto === "editado" ? "editado" : x.origemCusto === "catalogo" ? "catálogo"
                                                : x.origemCusto === "compra_sem_preco" ? `compra nº ${x.comprasNum.join(", ")} sem preço` : "não comprado"}
                                            </span>
                                            {inputNumero(`${l.p.id}:${x.itemId}:cu`, x.custoUnit, 4, t => void salvarItem(l.p.id, x.itemId, "custo_unitario", t, atual))}
                                          </span>
                                        </td>
                                        <td className="text-right px-2">
                                          <span className="inline-flex items-center justify-end gap-1.5">
                                            {x.origemPers !== "galpao" && (
                                              <span
                                                className="text-[10px] font-semibold rounded-full px-1.5 py-[1px] whitespace-nowrap"
                                                style={x.origemPers === "editado" ? { background: "#2563EB1A", color: "#1D4ED8" }
                                                  : x.origemPers === "auto" ? { background: "#7C3AED1A", color: "#6D28D9" }
                                                  : { background: "#F59E0B26", color: "#B45309" }}
                                                title={x.origemPers === "auto" ? `Terceirizada: ${x.tecnica} × ${x.aplicacoes} aplicação(ões). Digite outro valor para trocar.`
                                                  : x.origemPers === "sem" ? "Item terceirizado sem técnica definida no pedido." : "Digitado aqui. Apague para voltar ao preço da técnica."}
                                              >
                                                {x.origemPers === "auto" ? `terceir. · ${x.tecnica}${x.aplicacoes > 1 ? ` ×${x.aplicacoes}` : ""}` : x.origemPers === "editado" ? "editado" : "terceir. s/ técnica"}
                                              </span>
                                            )}
                                            {inputNumero(`${l.p.id}:${x.itemId}:pu`, x.persUnit, 4, t => void salvarItem(l.p.id, x.itemId, "custo_personalizacao_unit", t, atual))}
                                          </span>
                                        </td>
                                        <td className="text-right px-2">{brl(x.pv)}</td>
                                        <td className="text-right px-2">{brl(x.custo)}</td>
                                        <td className="text-right px-2 font-semibold" style={{ color: x.pv - x.custo < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(x.pv - x.custo)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <p className="gw-meta text-[11px] mt-1.5 px-2">Custo unitário: o digitado aqui, senão o preço que você lançou na compra (Compras), senão o custo do catálogo. Apague o campo para voltar ao preço da compra. Personalização de item terceirizado já vem com o preço da técnica (DTF UV 3,50 · DTF têxtil 2,50 · laser 1,00 · silk 1,80, por aplicação). Frete, imposto e taxa de cartão são do pedido inteiro.</p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
