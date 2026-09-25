import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSistema } from "@/contexts/SistemaContext";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import { cn } from "@/lib/utils";

/* Dashboard por pedido (admin). Todo pedido lançado entra na hora.
   Regras:
   - Bruto = valor dos produtos (sem frete).
   - Imposto = % da config sobre o total do pedido.
   - Tx cartão = % do meio de pagamento (1x…12x) sobre o total, editável por pedido.
   - Frete = frete CIF do pedido (custo da empresa), editável. FOB é pago pelo cliente.
   - Comissão: por vendedor no mês = soma(bruto − imposto − tx cartão) × faixa
     escalonada, aplicada ao total (52 mil => 4% de tudo). */

const FAIXAS_COMISSAO: { ate: number; pct: number; rotulo: string }[] = [
  { ate: 20000, pct: 0, rotulo: "até 20.000" },
  { ate: 30000, pct: 2, rotulo: "20.001 a 30.000" },
  { ate: 40000, pct: 3, rotulo: "30.001 a 40.000" },
  { ate: 50000, pct: 3.5, rotulo: "40.001 a 50.000" },
  { ate: 70000, pct: 4, rotulo: "50.001 a 70.000" },
  { ate: Infinity, pct: 5, rotulo: "acima de 70.000" },
];
const faixaDe = (base: number) => FAIXAS_COMISSAO.find(f => base <= f.ate)!;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const aNum = (t: string) => {
  const n = Number(String(t).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const paraTexto = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const mesLabel = (ano: number, mes: number) =>
  new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

interface PedidoRow {
  id: string;
  numero: string;
  created_at: string;
  total: number | null;
  subtotal: number | null;
  frete_tipo: string | null;
  frete_valor: number | null;
  vendedor_id: string | null;
  pagamento_id: string | null;
  cliente_id: string | null;
  cliente_snapshot: { nome?: string } | null;
  itens: { quantidade?: number; precoCusto?: number }[] | null;
}
interface Fin {
  pedido_id: string;
  custo_produto: number | null;
  custo_personalizacao: number;
  taxa_cartao_pct: number | null;
  frete: number | null;
  valor_recebido: number;
}
type Campo = "custo_produto" | "custo_personalizacao" | "taxa_cartao_pct" | "frete" | "valor_recebido";

export default function DashboardPedidos() {
  const qc = useQueryClient();
  const { vendedores, clientes } = useSistema();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [edicao, setEdicao] = useState<Record<string, string>>({});

  const inicio = new Date(ano, mes, 1).toISOString();
  const fim = new Date(ano, mes + 1, 1).toISOString();
  const chave = ["sistema", "dash-pedidos", ano, mes] as const;

  const { data, isLoading } = useQuery({
    queryKey: chave,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data: peds, error } = await supabase
        .from("sistema_pedidos")
        .select("id,numero,created_at,total,subtotal,frete_tipo,frete_valor,vendedor_id,pagamento_id,cliente_id,cliente_snapshot,itens")
        .neq("status", "cancelado")
        .gte("created_at", inicio)
        .lt("created_at", fim)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const pedidos = (peds ?? []) as unknown as PedidoRow[];
      const ids = pedidos.map(p => p.id);
      const numeros = pedidos.map(p => String(p.numero));

      const [fin, meios, cfg, custos] = await Promise.all([
        ids.length ? (supabase as any).from("sistema_pedido_financeiro").select("*").in("pedido_id", ids) : { data: [] },
        (supabase as any).from("sistema_meios_pagamento").select("id,nome,taxa_pct"),
        (supabase as any).from("sistema_financeiro_config").select("imposto_pct").limit(1),
        numeros.length ? (supabase as any).from("vw_custo_compras_por_item").select("pedido_numero,custo_total").in("pedido_numero", numeros) : { data: [] },
      ]);
      const custoCompras: Record<string, number> = {};
      for (const c of custos.data ?? []) custoCompras[c.pedido_numero] = (custoCompras[c.pedido_numero] ?? 0) + Number(c.custo_total);
      return {
        pedidos,
        fin: Object.fromEntries((fin.data ?? []).map((f: Fin) => [f.pedido_id, f])) as Record<string, Fin>,
        meios: Object.fromEntries((meios.data ?? []).map((m: any) => [m.id, { nome: m.nome as string, taxa: Number(m.taxa_pct) || 0 }])) as Record<string, { nome: string; taxa: number }>,
        imposto: Number(cfg.data?.[0]?.imposto_pct) || 0,
        custoCompras,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_compras_itens" }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [qc]);

  const linhas = useMemo(() => {
    if (!data) return [];
    return data.pedidos.map(p => {
      const f = data.fin[p.id];
      const bruto = Number(p.subtotal) || 0;
      const total = Number(p.total) || 0;
      const meio = p.pagamento_id ? data.meios[p.pagamento_id] : undefined;
      const taxaPct = f?.taxa_cartao_pct ?? meio?.taxa ?? 0;
      const taxa = total * taxaPct / 100;
      const imposto = total * data.imposto / 100;
      const custoCatalogo = (p.itens ?? []).reduce((s, i) => s + (Number(i.precoCusto) || 0) * (Number(i.quantidade) || 0), 0);
      const custoProduto = f?.custo_produto ?? (data.custoCompras[String(p.numero)] ?? custoCatalogo);
      const custoPers = f?.custo_personalizacao ?? 0;
      const frete = f?.frete ?? (p.frete_tipo === "CIF" ? Number(p.frete_valor) || 0 : 0);
      const lucro = bruto - custoProduto - custoPers - imposto - taxa - frete;
      const recebido = f?.valor_recebido ?? 0;
      const cliente = clientes.find(c => c.id === p.cliente_id);
      return {
        p, f, bruto, total, meio, taxaPct, taxa, imposto, custoProduto, custoPers, frete, lucro, recebido,
        aReceber: Math.max(0, total - recebido),
        baseComissao: bruto - imposto - taxa,
        clienteNome: (cliente as any)?.nome || (cliente as any)?.razaoSocial || p.cliente_snapshot?.nome || "—",
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
    const por = new Map<string, { nome: string; base: number; pedidos: number }>();
    for (const l of linhas) {
      const k = l.p.vendedor_id ?? "—";
      const acc = por.get(k) ?? { nome: l.vendedorNome, base: 0, pedidos: 0 };
      acc.base += l.baseComissao; acc.pedidos += 1;
      por.set(k, acc);
    }
    return [...por.values()]
      .map(v => { const f = faixaDe(v.base); return { ...v, pct: f.pct, valor: v.base * f.pct / 100 }; })
      .sort((a, b) => b.base - a.base);
  }, [linhas]);
  const totalComissao = comissoes.reduce((s, c) => s + c.valor, 0);
  const lucroFinal = totais.lucro - totalComissao;

  const salvar = async (pedidoId: string, campo: Campo, texto: string, atual: Fin | undefined) => {
    const vazio = texto.trim() === "";
    const valor = vazio ? null : aNum(texto);
    const linha = {
      pedido_id: pedidoId,
      custo_produto: atual?.custo_produto ?? null,
      custo_personalizacao: atual?.custo_personalizacao ?? 0,
      taxa_cartao_pct: atual?.taxa_cartao_pct ?? null,
      frete: atual?.frete ?? null,
      valor_recebido: atual?.valor_recebido ?? 0,
      [campo]: campo === "custo_personalizacao" || campo === "valor_recebido" ? (valor ?? 0) : valor,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await (supabase as any).from("sistema_pedido_financeiro").upsert(linha);
    if (error) { toast.error(`Não foi possível salvar. ${error.message || ""}`); return; }
    qc.invalidateQueries({ queryKey: chave });
  };

  const campoEditavel = (l: typeof linhas[number], campo: Campo, valorAtual: number, ehPct = false) => {
    const k = `${l.p.id}:${campo}`;
    return (
      <Input
        value={edicao[k] ?? paraTexto(ehPct ? Number(valorAtual.toFixed(3)) : Number(valorAtual.toFixed(2)))}
        onChange={e => setEdicao(prev => ({ ...prev, [k]: e.target.value }))}
        onBlur={() => {
          const t = edicao[k];
          setEdicao(prev => { const n = { ...prev }; delete n[k]; return n; });
          if (t !== undefined && aNum(t) !== Number(valorAtual)) void salvar(l.p.id, campo, t, l.f);
        }}
        onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="decimal"
        className="h-8 w-[92px] text-right text-[12.5px] px-2"
      />
    );
  };

  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear()); setMes(d.getMonth());
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="gw-display text-[20px]">Dashboard</h1>
          <p className="gw-meta">
            Pedidos lançados no mês
            <span className="inline-flex items-center gap-1 ml-2" style={{ color: "var(--gw-success)" }}>
              <Radio className="h-3 w-3" /> ao vivo
            </span>
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
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            {/* Esquerda: vendido bruto */}
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

            {/* Direita: descontos */}
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
                <span className="gw-body font-bold">Lucro estimado</span>
                <span className="gw-num text-[20px]" style={{ color: lucroFinal < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(lucroFinal)}</span>
              </div>
            </div>
          </div>

          {/* Comissão por vendedor */}
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

          {/* Pedido por pedido */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-x-4">
              <span className="gw-body font-bold">Pedido por pedido</span>
              <span className="gw-meta">Campos em branco usam o valor automático (compras, taxa do meio de pagamento, frete CIF). Edite para ajustar.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] whitespace-nowrap">
                <thead className="text-[11px] uppercase" style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}>
                  <tr>
                    <th className="text-left px-3 py-2">Pedido</th>
                    <th className="text-left px-3 py-2">Cliente / Vendedor</th>
                    <th className="px-3 py-2 text-right">PV</th>
                    <th className="px-3 py-2 text-right">Custo produto</th>
                    <th className="px-3 py-2 text-right">Custo personaliz.</th>
                    <th className="px-3 py-2 text-right">Imposto</th>
                    <th className="px-3 py-2 text-right">Tx cartão %</th>
                    <th className="px-3 py-2 text-right">Tx cartão</th>
                    <th className="px-3 py-2 text-right">Frete</th>
                    <th className="px-3 py-2 text-right">Lucro</th>
                    <th className="px-3 py-2 text-right">Recebido</th>
                    <th className="px-3 py-2 text-right">A receber</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--gw-border)" }}>
                  {linhas.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center gw-meta">Nenhum pedido neste mês.</td></tr>}
                  {linhas.map(l => (
                    <tr key={l.p.id}>
                      <td className="px-3 py-1.5"><OrderNumber value={l.p.numero} className="text-[12.5px]" /></td>
                      <td className="px-3 py-1.5 max-w-[210px]">
                        <p className="truncate font-medium">{l.clienteNome}</p>
                        <p className="gw-meta text-[11px] truncate">{l.vendedorNome}{l.meio ? ` · ${l.meio.nome}` : ""}</p>
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">{brl(l.bruto)}</td>
                      <td className="px-3 py-1.5 text-right">{campoEditavel(l, "custo_produto", l.custoProduto)}</td>
                      <td className="px-3 py-1.5 text-right">{campoEditavel(l, "custo_personalizacao", l.custoPers)}</td>
                      <td className="px-3 py-1.5 text-right">{brl(l.imposto)}</td>
                      <td className="px-3 py-1.5 text-right">{campoEditavel(l, "taxa_cartao_pct", l.taxaPct, true)}</td>
                      <td className="px-3 py-1.5 text-right">{brl(l.taxa)}</td>
                      <td className="px-3 py-1.5 text-right">{campoEditavel(l, "frete", l.frete)}</td>
                      <td className={cn("px-3 py-1.5 text-right font-bold")} style={{ color: l.lucro < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(l.lucro)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {campoEditavel(l, "valor_recebido", l.recebido)}
                          <button type="button" className="text-[10.5px] font-semibold rounded px-1.5 py-1 border" style={{ borderColor: "var(--gw-border)" }}
                            title="Metade recebida" onClick={() => salvar(l.p.id, "valor_recebido", paraTexto(Number((l.total / 2).toFixed(2))), l.f)}>50%</button>
                          <button type="button" className="text-[10.5px] font-semibold rounded px-1.5 py-1 border" style={{ borderColor: "var(--gw-border)" }}
                            title="Tudo recebido" onClick={() => salvar(l.p.id, "valor_recebido", paraTexto(Number(l.total.toFixed(2))), l.f)}>100%</button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold" style={{ color: l.aReceber > 0 ? "#EA580C" : "var(--gw-text-muted)" }}>{brl(l.aReceber)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
