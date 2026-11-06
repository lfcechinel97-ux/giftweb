/* Resultado financeiro dos pedidos (custo, imposto, taxa de cartão, frete e
   lucro) — lido e calculado num lugar só para o Dashboard por pedido e o
   Relatório geral de pedidos mostrarem exatamente os mesmos números.

   Regras (as mesmas descritas no topo de DashboardPedidos.tsx):
   - Bruto (PV) = valor dos produtos, sem frete.
   - Imposto = % da config sobre o total do pedido.
   - Tx cartão = % da forma de pagamento (ou a digitada no pedido) sobre o total.
   - Frete: CIF é custo da empresa e desconta do lucro; FOB é pago pelo cliente.
   - Custo do produto, nesta ordem: digitado no item > preço lançado em
     Compras > custo do catálogo no item.
   - Personalização: digitada no item ou, se terceirizado, preço da técnica. */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CUSTO_FIXO_MENSAL_PADRAO, custoPersonalizacaoTerceirizada, faixaDe, taxaCartaoDoMeio,
} from "@/lib/financeiroRegras";
import { rotuloPersonalizacao } from "@/lib/personalizacao";
import type { ClienteSnapshot } from "@/contexts/SistemaContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** `.in()` em lotes: lista grande de ids estoura o tamanho da URL. */
export async function lerEmLotes<T>(
  valores: string[],
  consulta: (lote: string[]) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  tamanho = 150,
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const out: T[] = [];
  for (let i = 0; i < valores.length; i += tamanho) {
    const { data, error } = await consulta(valores.slice(i, i + tamanho));
    if (error) return { data: out, error };
    out.push(...(data ?? []));
  }
  return { data: out, error: null };
}

export interface PedidoItemRow {
  id?: string;
  nome?: string;
  quantidade?: number;
  precoUnitario?: number;
  precoCusto?: number;
  personalizacao?: string;
  aplicacoes?: number;
}

export interface PedidoRow {
  id: string;
  numero: string;
  created_at: string;
  status: string | null;
  total: number | null;
  subtotal: number | null;
  frete_tipo: string | null;
  frete_valor: number | null;
  vendedor_id: string | null;
  pagamento_id: string | null;
  cliente_id: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  cliente_snapshot: (Partial<ClienteSnapshot> & { nome?: string }) | null;
  itens: PedidoItemRow[] | null;
}
export interface ItemFin {
  pedido_id: string;
  item_id: string;
  custo_unitario: number | null;
  custo_personalizacao_unit: number;
}
export interface Fin {
  pedido_id: string;
  taxa_cartao_pct: number | null;
  frete: number | null;
  valor_recebido: number;
}

export interface BaseResultado {
  pedidos: PedidoRow[];
  fin: Record<string, Fin>;
  meios: Record<string, { nome: string; taxa: number }>;
  imposto: number;
  custoFixo: number;
  custoCompras: Record<string, number>;
  compraDoItem: Record<string, number[]>;
  compraSemPreco: Record<string, number[]>;
  terceirizado: Record<string, boolean>;
  itemFin: Record<string, ItemFin>;
}

const COLUNAS_PEDIDO =
  "id,numero,created_at,status,total,subtotal,frete_tipo,frete_valor,vendedor_id,pagamento_id,cliente_id,contato_nome,contato_telefone,cliente_snapshot,itens";

/** Lê os pedidos de [inicio, fim) (ISO) e tudo que o cálculo precisa. */
export async function carregarBaseResultado(opts: {
  inicio: string;
  fim: string;
  incluirCancelados?: boolean;
}): Promise<BaseResultado> {
  // Paginado: o PostgREST devolve no máximo 1000 linhas por consulta.
  const pedidos: PedidoRow[] = [];
  for (let de = 0; ; de += 1000) {
    let q = db
      .from("sistema_pedidos")
      .select(COLUNAS_PEDIDO)
      .gte("created_at", opts.inicio)
      .lt("created_at", opts.fim);
    if (!opts.incluirCancelados) q = q.neq("status", "cancelado");
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .order("id")
      .range(de, de + 999);
    if (error) throw error;
    pedidos.push(...((data ?? []) as unknown as PedidoRow[]));
    if (!data || data.length < 1000) break;
  }
  const ids = pedidos.map(p => p.id);
  const numeros = pedidos.map(p => String(p.numero));

  const [fin, meios, cfg, custos, prod, itemFin] = await Promise.all([
    lerEmLotes<Fin>(ids, lote => db.from("sistema_pedido_financeiro").select("*").in("pedido_id", lote)),
    db.from("sistema_meios_pagamento").select("id,nome,taxa_pct"),
    db.from("sistema_financeiro_config").select("*").limit(1),
    lerEmLotes<{
      id: string; producao_item_id: string | null; pedido_numero: string | null;
      produto_nome: string; quantidade: number; compra: { numero: number } | null;
    }>(numeros, lote => db.from("sistema_compras_itens")
      .select("id,producao_item_id,pedido_numero,produto_nome,quantidade,compra:sistema_compras(numero)").in("pedido_numero", lote)),
    lerEmLotes<{ id: string; pedido_id: string; item_id: string; local_producao: string | null; terceirizada_id: string | null; tags: string[] | null; status: string | null }>(
      ids, lote => db.from("sistema_producao_itens").select("id,pedido_id,item_id,local_producao,terceirizada_id,tags,status").in("pedido_id", lote), 50),
    lerEmLotes<ItemFin>(ids, lote => db.from("sistema_item_financeiro").select("*").in("pedido_id", lote), 50),
  ]);

  /* Custo real de compra por (pedido, item do pedido): preço que o admin
     lançou em Compras, média ponderada se o item foi comprado mais de uma
     vez. Lido direto das tabelas (sem depender da view) e com erro
     visível — antes uma falha aqui virava custo zero em silêncio. */
  if (custos.error) toast.error(`Não foi possível ler as compras. ${custos.error.message || ""}`);
  const compraItens = custos.data;
  const precos = compraItens.length
    ? await lerEmLotes<{ compra_item_id: string; valor_unitario: number }>(compraItens.map(c => c.id), lote => db
        .from("sistema_compras_precos").select("compra_item_id,valor_unitario").in("compra_item_id", lote))
    : { data: [], error: null };
  if (precos.error) toast.error(`Não foi possível ler os preços de compra. ${precos.error.message || ""}`);
  const precoPor = new Map<string, number>(precos.data.map(x => [x.compra_item_id, Number(x.valor_unitario)]));
  const prodRows = prod.data;
  const itemDoProd = new Map<string, string>(prodRows.map(r => [r.id, `${r.pedido_id}:${r.item_id}`]));
  // Item que vai (ou foi) pra terceirizada: a personalização é custo de fora.
  const terceirizado: Record<string, boolean> = {};
  for (const r of prodRows) {
    terceirizado[`${r.pedido_id}:${r.item_id}`] =
      r.local_producao === "terceirizada" || r.local_producao === "fornecedor_para_terceirizada"
      || !!r.terceirizada_id
      || (r.status ?? "").includes("terceirizada")
      || (r.tags ?? []).some(t => t.toUpperCase().startsWith("TERCEIRIZADA"));
  }
  const pedidoPorNumero = new Map(pedidos.map(p => [String(p.numero), p]));
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const acc: Record<string, { valor: number; qtd: number; compras: Set<number> }> = {};
  // Item com linha de compra mas sem preço lançado — mostrado no dashboard.
  const compraSemPreco: Record<string, number[]> = {};
  for (const ci of compraItens) {
    const preco = precoPor.get(ci.id);
    let chaveItem = ci.producao_item_id ? itemDoProd.get(ci.producao_item_id) : undefined;
    // Linha de compra sem vínculo com o card: casa pelo nº do pedido + nome.
    if (!chaveItem && ci.pedido_numero) {
      const ped = pedidoPorNumero.get(String(ci.pedido_numero));
      const alvo = norm(ci.produto_nome || "");
      const idx = (ped?.itens ?? []).findIndex(it => {
        const n = norm(it.nome || "");
        return n && alvo && (n === alvo || n.startsWith(alvo) || alvo.startsWith(n));
      });
      if (ped && idx >= 0) chaveItem = `${ped.id}:${String(ped.itens![idx].id ?? idx)}`;
    }
    if (!chaveItem) continue;
    if (preco == null) {
      if (ci.compra?.numero != null) (compraSemPreco[chaveItem] ??= []).push(ci.compra.numero);
      continue;
    }
    const a = (acc[chaveItem] ??= { valor: 0, qtd: 0, compras: new Set() });
    const q = Number(ci.quantidade) || 0;
    a.valor += q * preco; a.qtd += q;
    if (ci.compra?.numero != null) a.compras.add(ci.compra.numero);
  }
  const custoCompras: Record<string, number> = {};
  const compraDoItem: Record<string, number[]> = {};
  for (const [k, a] of Object.entries(acc)) {
    if (a.qtd > 0) { custoCompras[k] = a.valor / a.qtd; compraDoItem[k] = [...a.compras]; }
  }
  const itemFinMap: Record<string, ItemFin> = {};
  for (const f of itemFin.data) itemFinMap[`${f.pedido_id}:${f.item_id}`] = f;

  return {
    pedidos,
    fin: Object.fromEntries(fin.data.map(f => [f.pedido_id, f])),
    meios: Object.fromEntries(((meios.data ?? []) as { id: string; nome: string; taxa_pct: number }[])
      .map(m => [m.id, { nome: m.nome, taxa: Number(m.taxa_pct) || 0 }])),
    imposto: Number(cfg.data?.[0]?.imposto_pct) || 0,
    // Colunas novas (migration 20261009120000); sem elas, valem os padrões.
    custoFixo: Number(cfg.data?.[0]?.custo_fixo_mensal) || CUSTO_FIXO_MENSAL_PADRAO,
    custoCompras,
    compraDoItem,
    compraSemPreco,
    terceirizado,
    itemFin: itemFinMap,
  };
}

export type OrigemCusto = "editado" | "compra" | "catalogo" | "compra_sem_preco" | "sem";
export type OrigemPers = "editado" | "auto" | "sem" | "galpao";

export interface ProdutoResultado {
  itemId: string;
  nome: string;
  qtd: number;
  pvUnit: number;
  custoUnit: number;
  persUnit: number;
  origemCusto: OrigemCusto;
  comprasNum: number[];
  origemPers: OrigemPers;
  tecnica: string;
  personalizacao: string | null;
  aplicacoes: number;
  pv: number;
  custo: number;
}

/** Resultado de um pedido, sem comissão (que depende do mês do vendedor). */
export function calcularPedido(p: PedidoRow, base: BaseResultado) {
  const f = base.fin[p.id];
  const bruto = Number(p.subtotal) || 0;
  const total = Number(p.total) || 0;
  const meio = p.pagamento_id ? base.meios[p.pagamento_id] : undefined;
  const taxaPct = f?.taxa_cartao_pct ?? (meio ? taxaCartaoDoMeio(meio.nome, meio.taxa) : 0);
  const taxa = total * taxaPct / 100;
  const imposto = total * base.imposto / 100;

  const produtos: ProdutoResultado[] = (p.itens ?? []).map((it, idx) => {
    const itemId = String(it.id ?? idx);
    const chaveItem = `${p.id}:${itemId}`;
    const fi = base.itemFin[chaveItem];
    const qtd = Number(it.quantidade) || 0;
    const pvUnit = Number(it.precoUnitario) || 0;
    const compra = base.custoCompras[chaveItem];
    const catalogo = Number(it.precoCusto) || 0;
    // Um 0 salvo aqui não esconde o preço lançado na compra.
    const editado = fi?.custo_unitario != null && (fi.custo_unitario > 0 || compra == null) ? Number(fi.custo_unitario) : null;
    const custoUnit = editado ?? compra ?? catalogo;
    const origemCusto: OrigemCusto = editado != null ? "editado" : compra != null ? "compra" : catalogo > 0 ? "catalogo"
      : base.compraSemPreco[chaveItem] ? "compra_sem_preco" : "sem";
    const comprasNum = base.compraDoItem[chaveItem] ?? base.compraSemPreco[chaveItem] ?? [];
    // Personalização: digitada aqui (> 0) ou, se o item é terceirizado,
    // o preço da técnica × aplicações. Galpão = 0 (custo interno).
    const persEditada = Number(fi?.custo_personalizacao_unit) || 0;
    const persAuto = base.terceirizado[chaveItem] ? custoPersonalizacaoTerceirizada(it.personalizacao, it.aplicacoes) : 0;
    const persUnit = persEditada > 0 ? persEditada : persAuto;
    const origemPers: OrigemPers = persEditada > 0 ? "editado" : persAuto > 0 ? "auto" : base.terceirizado[chaveItem] ? "sem" : "galpao";
    return {
      itemId, nome: it.nome ?? "—", qtd, pvUnit, custoUnit, persUnit, origemCusto, comprasNum, origemPers,
      tecnica: rotuloPersonalizacao(it.personalizacao), personalizacao: it.personalizacao ?? null,
      aplicacoes: Number(it.aplicacoes) || 1,
      pv: qtd * pvUnit, custo: qtd * (custoUnit + persUnit),
    };
  });
  const custoProduto = produtos.reduce((s, x) => s + x.qtd * x.custoUnit, 0);
  const custoPers = produtos.reduce((s, x) => s + x.qtd * x.persUnit, 0);

  const fob = p.frete_tipo === "FOB" ? Number(p.frete_valor) || 0 : 0;
  const frete = p.frete_tipo === "FOB" ? 0 : (f?.frete ?? (p.frete_tipo === "CIF" ? Number(p.frete_valor) || 0 : 0));
  const lucro = bruto - custoProduto - custoPers - imposto - taxa - frete;
  const recebido = f?.valor_recebido ?? 0;
  return {
    p, f, bruto, total, meio, taxaPct, taxa, imposto, custoProduto, custoPers, frete, fob, produtos, lucro, recebido,
    aReceber: Math.max(0, total - recebido),
    baseComissao: bruto - imposto - taxa,
  };
}

export type ResultadoPedido = ReturnType<typeof calcularPedido>;

/** Mês local do pedido ("2026-11"): a comissão é por vendedor e por mês. */
export const mesDoPedido = (createdAt: string) => {
  const d = new Date(createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Faixa de comissão de cada vendedor em cada mês: chave `${vendedor}|${mes}`.
 *  Pedidos cancelados não entram na base. */
export function faixasComissao(linhas: ResultadoPedido[]): Map<string, { base: number; pct: number }> {
  const bases = new Map<string, number>();
  for (const l of linhas) {
    if (l.p.status === "cancelado") continue;
    const k = `${l.p.vendedor_id ?? "—"}|${mesDoPedido(l.p.created_at)}`;
    bases.set(k, (bases.get(k) ?? 0) + l.baseComissao);
  }
  return new Map([...bases].map(([k, base]) => [k, { base, pct: faixaDe(base).pct }]));
}
