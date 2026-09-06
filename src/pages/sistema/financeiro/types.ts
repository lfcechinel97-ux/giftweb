/* Tipos do módulo financeiro.
 *
 * As tabelas novas ainda não estão em integrations/supabase/types.ts, que é
 * gerado. Em vez de espalhar `as any` pelas telas, os tipos vivem aqui e o
 * cast acontece uma vez só, em financeiro/api.ts. */

export type GrupoDespesa = "pessoal" | "fixa" | "variavel";

export interface DespesaCategoria {
  id: string;
  nome: string;
  grupo: GrupoDespesa;
  cor: string | null;
  ativo: boolean;
  ordem: number;
  /** Já é deduzida por item da venda (imposto, comissão, taxa de cartão).
   *  Lançar à mão contaria o mesmo dinheiro duas vezes. */
  deduzida_na_venda: boolean;
}

export interface Despesa {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  venda_id: string | null;
  fornecedor_id: string | null;
  meio_pagamento_id: string | null;
  documento: string | null;
  observacoes: string | null;
  pago: boolean;
  origem: "manual" | "calcme";
  created_at: string;
}

export type DespesaInput = Omit<Despesa, "id" | "created_at" | "origem"> & {
  origem?: Despesa["origem"];
};

export interface Recebimento {
  id: string;
  data: string;
  valor: number;
  venda_id: string | null;
  descricao: string | null;
  meio_pagamento_id: string | null;
  documento: string | null;
  observacoes: string | null;
  origem: "manual" | "calcme";
}

export interface CustoProduto {
  id: string;
  produto_nome: string;
  calcme_produto_id: string | null;
  custo_unitario: number;
  origem: string;
  observacoes: string | null;
  updated_at: string;
}

export interface FinanceiroConfig {
  imposto_pct: number;
  comissao_pct: number;
  taxa_cartao_pct: number;
}

/* ── Retorno da RPC sistema_dashboard_financeiro ──────────────────────── */

export interface DrePeriodo {
  receita_bruta: number;
  imposto: number;
  comissao: number;
  taxa_cartao: number;
  deducoes: number;
  cmv: number;
  terceirizada: number;
  /** Receita − deduções − CMV − terceirização. É o "lucro" da planilha. */
  margem_contribuicao: number;
  despesa_pessoal: number;
  despesa_fixa: number;
  despesa_variavel: number;
  despesas: number;
  /** Margem de contribuição − despesas do período. */
  resultado: number;
}

export interface DashboardSerie {
  dia: string;
  vendido: number;
  lucro: number;
  recebido: number;
  despesas: number;
}

export interface LinhaOrcamento {
  id: string;
  categoria: string;
  grupo: GrupoDespesa;
  cor: string | null;
  ordem: number;
  deduzida_na_venda: boolean;
  previsto: number;
  realizado: number;
}

export interface TopVenda {
  id: string;
  numero: number | null;
  cliente_nome: string | null;
  data: string;
  valor_total: number;
  cmv: number;
  lucro: number;
  itens_sem_custo: number;
  sem_itens: boolean;
  status_titulo: string | null;
}

export interface DashboardFinanceiro {
  periodo: { inicio: string; fim: string; hoje: string };
  dre: DrePeriodo;
  totais: {
    vendido: number;
    pedidos: number;
    ticket: number;
    recebido: number;
    despesas: number;
    /** Recebido − despesas: o caixa do período, não o lucro. */
    caixa: number;
    itens_sem_custo: number;
    itens_total: number;
    pedidos_sem_itens: number;
  };
  hoje: {
    vendido: number;
    pedidos: number;
    lucro: number;
    recebido: number;
    despesas: number;
  };
  serie: DashboardSerie[];
  orcamento: LinhaOrcamento[];
  orcamento_competencia: string | null;
  despesas_por_categoria: {
    categoria: string;
    cor: string;
    grupo: GrupoDespesa;
    valor: number;
  }[];
  top_vendas: TopVenda[];
  ultimas_despesas: {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    origem: string;
    categoria: string | null;
    cor: string | null;
    grupo: GrupoDespesa | null;
  }[];
  geral: {
    vendido_total: number;
    recebido_total: number;
    produtos_sem_custo: number;
    ultima_sync: string | null;
  };
}

export interface SyncFinanceiroResult {
  success: boolean;
  vendas: number;
  itens: number;
  contas: number;
  errors: number;
  itens_pendentes: number;
  periodo?: { inicio: string; fim: string };
  detalhes?: { erros: string[]; avisos: string[] };
  error?: string;
}

/* ── Fluxo de vendas (conferência) ────────────────────────────────────── */

export interface MeioPagamento {
  id: string;
  nome: string;
  /** Taxa da maquininha, descontada da venda. Pix/dinheiro = 0. */
  taxa_pct: number;
}

/** Linha da lista de conferência. */
export interface VendaLinha {
  id: string;
  calcme_order_idint: number | null;
  cliente_nome: string | null;
  data: string;
  valor_total: number;
  status_titulo: string | null;
  conferido_em: string | null;
  meio_pagamento_id: string | null;
  meio_pagamento_nome: string | null;
  itens_sincronizados_em: string | null;
  cmv: number;
  lucro: number;
  itens_total: number;
  itens_sem_custo: number;
}

export interface VendasConferencia {
  periodo: { inicio: string; fim: string };
  total: number;
  pendentes: number;
  sem_custo: number;
  vendas: VendaLinha[];
}

export interface VendaItem {
  id: string;
  calcme_produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  /** Custo já resolvido pela cascata (item → catálogo). Null = sem custo. */
  custo_unitario: number | null;
  custo_fonte: "item" | "produto" | "nome" | "ausente";
  custo_total: number;
  /** Só o que foi digitado NESTE item; null significa "herdado do catálogo". */
  custo_override: number | null;
  terceirizada_unit: number;
  terceirizada_total: number;
  imposto_pct: number;
  comissao_pct: number;
  taxa_cartao_pct: number;
  imposto_valor: number;
  comissao_valor: number;
  taxa_cartao_valor: number;
  lucro: number;
  sem_custo: boolean;
}

export interface VendaDetalhe {
  venda: {
    id: string;
    numero: number | null;
    cliente_nome: string | null;
    data: string;
    valor_total: number;
    status_titulo: string | null;
    conferido_em: string | null;
    observacoes: string | null;
    meio_pagamento_id: string | null;
    imposto_pct: number | null;
    comissao_pct: number | null;
    taxa_cartao_pct: number | null;
    itens_sincronizados_em: string | null;
  } | null;
  itens: VendaItem[];
  totais: {
    cmv: number; terceirizada: number; imposto: number; comissao: number;
    taxa_cartao: number; lucro: number; itens_total: number; itens_sem_custo: number;
  } | null;
  meios_pagamento: MeioPagamento[];
}
