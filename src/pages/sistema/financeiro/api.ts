/* Acesso ao banco do módulo financeiro.
 *
 * As tabelas novas ainda não constam do Database gerado em
 * integrations/supabase/types.ts, então o cast fica concentrado aqui — o
 * resto do módulo trabalha com os tipos de ./types. */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  CustoProduto,
  DashboardFinanceiro,
  Despesa,
  DespesaCategoria,
  DespesaInput,
  FinanceiroConfig,
  Recebimento,
  MeioPagamento,
  SyncFinanceiroResult,
  VendaDetalhe,
  VendasConferencia,
} from "./types";

interface ErroDb { message: string }
type RespostaDb = { data: unknown; error: ErroDb | null };

/** Encadeamento do PostgREST reduzido ao que este módulo usa. Toda chamada
 *  devolve `data: unknown` de propósito: quem consulta declara o formato no
 *  próprio ponto de uso, então um engano aparece ali e não no fim da linha. */
interface ConsultaDb extends PromiseLike<RespostaDb> {
  select: (colunas?: string) => ConsultaDb;
  insert: (valores: unknown) => ConsultaDb;
  update: (valores: unknown) => ConsultaDb;
  upsert: (valores: unknown, opcoes?: { onConflict?: string }) => ConsultaDb;
  delete: () => ConsultaDb;
  eq: (coluna: string, valor: unknown) => ConsultaDb;
  gte: (coluna: string, valor: unknown) => ConsultaDb;
  lte: (coluna: string, valor: unknown) => ConsultaDb;
  ilike: (coluna: string, valor: string) => ConsultaDb;
  is: (coluna: string, valor: unknown) => ConsultaDb;
  order: (coluna: string, opcoes?: { ascending?: boolean }) => ConsultaDb;
  limit: (n: number) => ConsultaDb;
  single: () => ConsultaDb;
  maybeSingle: () => ConsultaDb;
}

/** O client é tipado pelo Database gerado; as tabelas novas ainda não estão
 *  lá. O cast mora só aqui — o resto do módulo usa os tipos de ./types. */
const db = supabase as unknown as {
  from: (tabela: string) => ConsultaDb;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RespostaDb>;
  functions: { invoke: (nome: string, opts?: { body?: unknown }) => Promise<{ data: unknown; error: unknown }> };
};

/** Toda gravação passa por aqui: sem sessão o RLS rejeita em silêncio e o
 *  lançamento "some" no reload. Mesma proteção do SistemaContext. */
async function write(label: string, fn: () => PromiseLike<RespostaDb>): Promise<unknown | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    toast.error(`Não foi possível salvar (${label}): sessão expirada. Faça login novamente em /admin/login.`);
    return null;
  }
  try {
    const res = await fn();
    if (res.error) {
      console.error(`[Financeiro] ${label} falhou:`, res.error);
      toast.error(`Não foi possível salvar (${label}). ${res.error.message ?? ""}`);
      return null;
    }
    return res.data;
  } catch (e: unknown) {
    console.error(`[Financeiro] ${label} falhou:`, e);
    toast.error(`Não foi possível salvar (${label}). ${e instanceof Error ? e.message : ""}`);
    return null;
  }
}

/* ── Dashboard ────────────────────────────────────────────────────────── */

export async function fetchDashboard(inicio: string, fim: string): Promise<DashboardFinanceiro> {
  const { data, error } = await db.rpc("sistema_dashboard_financeiro", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new Error(error.message);
  return data as DashboardFinanceiro;
}

/* ── Categorias ───────────────────────────────────────────────────────── */

export async function fetchCategorias(): Promise<DespesaCategoria[]> {
  const { data, error } = await db
    .from("sistema_despesa_categorias")
    .select("id,nome,grupo,cor,ativo,ordem,deduzida_na_venda")
    .eq("ativo", true)
    .order("ordem");
  if (error) throw new Error(error.message);
  return (data ?? []) as DespesaCategoria[];
}

/* ── Despesas ─────────────────────────────────────────────────────────── */

export async function fetchDespesas(inicio: string, fim: string): Promise<Despesa[]> {
  const { data, error } = await db
    .from("sistema_despesas")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Despesa[];
}

export const criarDespesa = (d: DespesaInput) =>
  write("despesa", () => db.from("sistema_despesas").insert(d).select().single());

export const atualizarDespesa = (id: string, d: Partial<DespesaInput>) =>
  write("despesa", () => db.from("sistema_despesas").update(d).eq("id", id).select().single());

export const removerDespesa = (id: string) =>
  write("excluir despesa", () => db.from("sistema_despesas").delete().eq("id", id));

/* ── Recebimentos ─────────────────────────────────────────────────────── */

export async function fetchRecebimentos(inicio: string, fim: string): Promise<Recebimento[]> {
  const { data, error } = await db
    .from("sistema_recebimentos")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Recebimento[];
}

export const criarRecebimento = (r: Omit<Recebimento, "id" | "origem"> & { origem?: string }) =>
  write("recebimento", () => db.from("sistema_recebimentos").insert(r).select().single());

export const removerRecebimento = (id: string) =>
  write("excluir recebimento", () => db.from("sistema_recebimentos").delete().eq("id", id));

/* ── Custo de produto ─────────────────────────────────────────────────── */

/** Produtos vendidos que ainda não têm custo — a lista de pendências que o
 *  dashboard cobra. Vem da view, que já resolveu a cascata de custo. */
export async function fetchProdutosSemCusto(limite = 200): Promise<
  { produto_nome: string; calcme_produto_id: string | null; qtd: number; venda_total: number }[]
> {
  const { data, error } = await db
    .from("sistema_venda_item_resultado")
    .select("produto_nome,calcme_produto_id,quantidade,valor_total")
    .eq("sem_custo", true)
    .limit(5000);
  if (error) throw new Error(error.message);

  // Agrupa por produto no cliente: a view não agrega e criar outra RPC só
  // para isso não se paga com o volume atual.
  const porNome = new Map<string, { produto_nome: string; calcme_produto_id: string | null; qtd: number; venda_total: number }>();
  for (const r of (data ?? []) as {
    produto_nome: string | null; calcme_produto_id: string | null;
    quantidade: number; valor_total: number;
  }[]) {
    const nome = (r.produto_nome ?? "").trim();
    if (!nome) continue;
    const chave = nome.toLowerCase();
    const acc = porNome.get(chave) ?? {
      produto_nome: nome,
      calcme_produto_id: r.calcme_produto_id,
      qtd: 0,
      venda_total: 0,
    };
    acc.qtd += Number(r.quantidade) || 0;
    acc.venda_total += Number(r.valor_total) || 0;
    porNome.set(chave, acc);
  }
  return [...porNome.values()]
    .sort((a, b) => b.venda_total - a.venda_total)
    .slice(0, limite);
}

export async function fetchCustosProduto(): Promise<CustoProduto[]> {
  const { data, error } = await db
    .from("sistema_custo_produto")
    .select("id,produto_nome,calcme_produto_id,custo_unitario,origem,observacoes,updated_at")
    .order("produto_nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as CustoProduto[];
}

/** Grava o custo de um produto pelo nome. Um upsert por nome_chave faria o
 *  mesmo, mas o índice é sobre a coluna gerada e o PostgREST não a aceita
 *  como alvo de onConflict — daí o select antes. */
export async function salvarCustoProduto(
  produtoNome: string,
  custoUnitario: number,
  calcmeProdutoId?: string | null,
): Promise<boolean> {
  const nome = produtoNome.trim();
  const { data } = await db
    .from("sistema_custo_produto")
    .select("id")
    .ilike("produto_nome", nome)
    .maybeSingle();
  const existente = data as { id: string } | null;

  const res = existente?.id
    ? await write("custo do produto", () =>
        db.from("sistema_custo_produto")
          .update({ custo_unitario: custoUnitario, origem: "manual" })
          .eq("id", existente.id).select().single())
    : await write("custo do produto", () =>
        db.from("sistema_custo_produto")
          .insert({
            produto_nome: nome,
            custo_unitario: custoUnitario,
            calcme_produto_id: calcmeProdutoId ?? null,
            origem: "manual",
          }).select().single());
  return res !== null;
}

/* ── Parâmetros ───────────────────────────────────────────────────────── */

export async function fetchConfig(): Promise<FinanceiroConfig> {
  const { data, error } = await db
    .from("sistema_financeiro_config")
    .select("imposto_pct,comissao_pct,taxa_cartao_pct")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { imposto_pct: 0, comissao_pct: 0, taxa_cartao_pct: 0 }) as FinanceiroConfig;
}

export const salvarConfig = (c: Partial<FinanceiroConfig>) =>
  write("parâmetros do financeiro", () =>
    db.from("sistema_financeiro_config").update(c).eq("id", true).select().single());

/* ── Sincronização ────────────────────────────────────────────────────── */

export async function sincronizarFinanceiro(
  opts: { inicio?: string; fim?: string; itens?: boolean; reprocessarItens?: boolean } = {},
): Promise<SyncFinanceiroResult> {
  const { data, error } = await db.functions.invoke("sync-calcme-financeiro", { body: opts });
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(msg);
  }
  return data as SyncFinanceiroResult;
}

/* ── Fornecedores ─────────────────────────────────────────────────────── */

/** O SistemaContext não carrega fornecedores (só meios de pagamento), e o
 *  dashboard não justifica inflar o bootstrap dele. */
export async function fetchFornecedores(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db
    .from("sistema_fornecedores")
    .select("id,nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; nome: string }[];
}

/* ── Fluxo de vendas ──────────────────────────────────────────────────── */

export async function fetchVendasConferencia(
  inicio: string, fim: string,
  status: "todas" | "pendentes" | "conferidas" = "todas",
  busca = "", limite = 100,
): Promise<VendasConferencia> {
  const { data, error } = await db.rpc("sistema_vendas_conferencia", {
    p_inicio: inicio, p_fim: fim, p_status: status,
    p_busca: busca || null, p_limite: limite,
  });
  if (error) throw new Error(error.message);
  return data as VendasConferencia;
}

export async function fetchVendaDetalhe(vendaId: string): Promise<VendaDetalhe> {
  const { data, error } = await db.rpc("sistema_venda_detalhe", { p_venda_id: vendaId });
  if (error) throw new Error(error.message);
  return data as VendaDetalhe;
}

/** Cabeçalho da venda: forma de pagamento e percentuais do pedido inteiro. */
export const salvarVenda = (
  id: string,
  v: {
    meio_pagamento_id?: string | null;
    imposto_pct?: number | null;
    comissao_pct?: number | null;
    taxa_cartao_pct?: number | null;
    observacoes?: string | null;
    conferido_em?: string | null;
  },
) => write("venda", () =>
  db.from("sistema_calcme_vendas").update(v).eq("id", id).select().single());

/** Custo e terceirização de um item. `custo_unitario: null` devolve o item
 *  à cascata — volta a seguir o catálogo em vez de ficar preso no valor. */
export const salvarItemVenda = (
  id: string,
  v: { custo_unitario?: number | null; terceirizada_unit?: number | null },
) => write("item da venda", () =>
  db.from("sistema_calcme_venda_itens").update(v).eq("id", id).select().single());

export async function fetchMeiosPagamento(): Promise<MeioPagamento[]> {
  const { data, error } = await db
    .from("sistema_meios_pagamento")
    .select("id,nome,taxa_pct")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as MeioPagamento[];
}

export const salvarTaxaMeioPagamento = (id: string, taxa_pct: number) =>
  write("taxa da forma de pagamento", () =>
    db.from("sistema_meios_pagamento").update({ taxa_pct }).eq("id", id).select().single());
