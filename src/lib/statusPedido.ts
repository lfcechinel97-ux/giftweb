import { supabase } from "@/integrations/supabase/client";

/**
 * Fonte única dos status de pedido e de item.
 *
 * O catálogo real é a tabela `sistema_status` — o usuário adiciona, renomeia,
 * recolore e desativa status em Configurações. A lista abaixo é a semente:
 * idêntica ao seed da migration 20260916120000, serve de fallback no primeiro
 * render e se a consulta falhar, e é substituída por `carregarCatalogoStatus()`.
 *
 * `statusInfo()` é síncrona de propósito — é chamada dentro do render de cada
 * linha, e transformar isso em consulta assíncrona significaria um estado de
 * carregamento por badge.
 */

interface LinhaStatus {
  slug: string; nome: string; cor: string;
  coluna_pcp: string; escopo: string; ordem: number;
}

export interface StatusInfo {
  slug: string;
  nome: string;
  /** Cor cheia — bolinha, barra lateral, cabeçalho de coluna. */
  cor: string;
  /** Em qual das 8 colunas do Kanban do PCP este status cai. */
  colunaPcp: string;
  /** 'pedido' aparece só no status geral; 'ambos' nos dois níveis. */
  escopo: "pedido" | "item" | "ambos";
  ordem: number;
}

const SEMENTE: StatusInfo[] = [
  { slug: "organizando_anotacoes",   nome: "Organizando Pedido",         cor: "#64748B", colunaPcp: "organizando_comercial", escopo: "ambos", ordem: 10 },
  { slug: "imprimir_ordem_producao", nome: "Imprimir ordem de produção", cor: "#0B7CAF", colunaPcp: "organizando_pedido",  escopo: "ambos",  ordem: 20 },
  { slug: "aguardando_mercadoria",   nome: "Aguardando mercadoria",      cor: "#A36907", colunaPcp: "aguardando_mercadoria", escopo: "ambos", ordem: 30 },
  { slug: "aguardando_teste",        nome: "Aguardando teste laser/DTF", cor: "#7E22CE", colunaPcp: "teste_fisico",        escopo: "ambos",  ordem: 40 },
  { slug: "aguardando_aprovacao_teste", nome: "Teste enviado",           cor: "#A21CAF", colunaPcp: "teste_enviado",       escopo: "ambos",  ordem: 45 },
  { slug: "preparar_dtf",            nome: "Preparar DTF/vetorização",   cor: "#8452F5", colunaPcp: "em_producao",         escopo: "ambos",  ordem: 50 },
  { slug: "a_produzir",              nome: "A produzir",                 cor: "#1D4ED8", colunaPcp: "em_producao",         escopo: "ambos",  ordem: 60 },
  { slug: "a_produzir_terceirizada", nome: "A produzir terceirizada",    cor: "#1D4ED8", colunaPcp: "em_producao",         escopo: "ambos",  ordem: 70 },
  { slug: "produzido",               nome: "Produzido",                  cor: "#15803D", colunaPcp: "inserir_medidas",     escopo: "ambos",  ordem: 75 },
  { slug: "inserir_medidas",         nome: "Inserir medidas",            cor: "#0B8177", colunaPcp: "inserir_medidas",     escopo: "ambos",  ordem: 80 },
  { slug: "conferir_pagamentos",     nome: "Conferir pagamentos",        cor: "#05875F", colunaPcp: "aguardando_coleta",   escopo: "ambos",  ordem: 90 },
  { slug: "enviar_etiqueta",         nome: "Enviar etiqueta/expedição",  cor: "#12883E", colunaPcp: "aguardando_coleta",   escopo: "ambos",  ordem: 100 },
  { slug: "aguardando_coleta",       nome: "Aguardando coleta",          cor: "#9D6B03", colunaPcp: "aguardando_coleta",   escopo: "ambos",  ordem: 110 },
  { slug: "coletado_enviado",        nome: "Coletado e enviado",         cor: "#15803D", colunaPcp: "enviado",             escopo: "ambos",  ordem: 120 },
  { slug: "entregue",                nome: "Entregue",                   cor: "#166534", colunaPcp: "enviado",             escopo: "pedido", ordem: 130 },
  { slug: "cancelado",               nome: "Cancelado",                  cor: "#DC2626", colunaPcp: "cancelado",           escopo: "ambos",  ordem: 140 },
];

const DESCONHECIDO: StatusInfo = {
  slug: "desconhecido",
  nome: "Sem status",
  cor: "#94A3B8",
  colunaPcp: "organizando_pedido",
  escopo: "ambos",
  ordem: 999,
};

let catalogo: StatusInfo[] = SEMENTE;
let porSlug = new Map(catalogo.map(s => [s.slug, s]));

/**
 * Carrega o catálogo do banco. Chamada uma vez pelo bootstrap do
 * SistemaContext; depois disso as edições feitas em Configurações aparecem no
 * próximo carregamento da aplicação.
 */
export async function carregarCatalogoStatus(): Promise<void> {
  /* `as any`: types.ts é gerado e ainda não conhece sistema_status — mesmo
     padrão que o código já usa para vw_pcp. Regenerar os tipos remove o cast. */
  const { data, error } = await (supabase as any)
    .from("sistema_status")
    .select("slug,nome,cor,coluna_pcp,escopo,ativo,ordem")
    .eq("ativo", true)
    .order("ordem");

  if (error || !data?.length) {
    // Mantém a semente: uma lista vazia deixaria todo badge como "Sem status".
    if (error) console.error("[Status] carregar catálogo falhou:", error);
    return;
  }

  catalogo = (data as LinhaStatus[]).map(r => ({
    slug: r.slug,
    nome: r.nome,
    cor: r.cor,
    colunaPcp: r.coluna_pcp,
    escopo: r.escopo as StatusInfo["escopo"],
    ordem: r.ordem,
  }));
  porSlug = new Map(catalogo.map(s => [s.slug, s]));
}

/** Resolve qualquer slug — inclusive um desativado ou inesperado. */
export function statusInfo(slug?: string | null): StatusInfo {
  if (!slug) return DESCONHECIDO;
  return porSlug.get(slug) ?? DESCONHECIDO;
}

/** Opções do dropdown, filtradas pelo nível em que o status aparece. */
export function opcoesStatus(nivel: "pedido" | "item"): StatusInfo[] {
  return catalogo.filter(s => s.escopo === "ambos" || s.escopo === nivel);
}

/**
 * As 8 colunas do Kanban do PCP, na ordem do fluxo do galpão.
 *
 * Diferente dos status, as colunas são ESTRUTURAIS — fazem parte do layout do
 * quadro e não são editáveis. Cada uma tem um status canônico: é ele que dá a
 * cor da coluna e é o valor gravado quando um card é arrastado para lá.
 */
/* Fluxo final de 7 colunas (evolução de 19/09/2026):
   Imprimir Ordem de Produção -> Aguardando Mercadoria -> Aguardando
   Teste -> Teste Enviado -> A Produzir -> Expedição -> Coletado e
   Enviado.

   "Organizando Pedido" (organizando_anotacoes) NÃO aparece mais aqui —
   virou uma etapa só da tela de Pedidos (comercial/vendedor), antes do
   pedido entrar no radar da produção. Ela deixa de existir pro PCP no
   momento em que o vendedor manda "Imprimir Ordem de Produção" (esta
   é a primeira coluna que a produção vê). Duas classes de usuário,
   mesmo catálogo de status por trás: COMERCIAL usa a tela de Pedidos
   (que tem uma etapa a mais), PRODUÇÃO usa o PCP.

   Outras simplificações (nenhum status apagado, só coluna_pcp
   remapeado):
   - "Preparação" (preparar_dtf) cai em "A Produzir".
   - Galpão e Terceirizada deixam de ser colunas separadas -- viram UMA
     coluna só ("A Produzir"), com a distinção feita por TAG
     ("PROD. GALPÃO" / "TERCEIRIZADA + nome") escolhida num popup ao
     entrar em Aguardando Teste, não mais ao entrar em produção. */
export const COLUNAS_PCP = [
  { coluna: "organizando_pedido",    rotulo: "Imprimir Ordem de Produção", canonico: "imprimir_ordem_producao" },
  { coluna: "aguardando_mercadoria", rotulo: "Aguardando Mercadoria",  canonico: "aguardando_mercadoria" },
  { coluna: "teste_fisico",          rotulo: "Aguardando Teste",       canonico: "aguardando_teste" },
  { coluna: "teste_enviado",         rotulo: "Teste Enviado",          canonico: "aguardando_aprovacao_teste" },
  { coluna: "em_producao",           rotulo: "A Produzir",             canonico: "a_produzir" },
  { coluna: "inserir_medidas",       rotulo: "Inserir Medidas",        canonico: "inserir_medidas" },
  { coluna: "aguardando_coleta",     rotulo: "Expedição",              canonico: "aguardando_coleta" },
  { coluna: "enviado",               rotulo: "Coletado e Enviado",     canonico: "coletado_enviado" },
] as const;

/** Cor da coluna = cor do seu status canônico. */
export const corDaColuna = (coluna: string): string => {
  const c = COLUNAS_PCP.find(x => x.coluna === coluna);
  return c ? statusInfo(c.canonico).cor : DESCONHECIDO.cor;
};

/**
 * Status gravado quando um card é solto numa coluna.
 *
 * Coluna e status são vocabulários DIFERENTES: "em_producao" é coluna,
 * "a_produzir" é status. Gravar o nome da coluna viola a FK de sistema_status.
 */
export const statusCanonicoDaColuna = (coluna: string): string =>
  COLUNAS_PCP.find(x => x.coluna === coluna)?.canonico ?? coluna;

/** Em que coluna do Kanban uma linha do PCP cai. */
export const colunaDoStatus = (
  linha: { coluna_pcp?: string | null; status?: string | null },
): string => linha.coluna_pcp || statusInfo(linha.status).colunaPcp;
