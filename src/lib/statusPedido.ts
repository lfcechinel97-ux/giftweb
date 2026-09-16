/**
 * Fonte única dos status de pedido e de item.
 *
 * Hoje o catálogo vive aqui, em código. Quando a migration
 * `20260916120000_status_catalogo.sql` for aplicada, a tabela `sistema_status`
 * passa a ser a fonte e só este arquivo muda — as telas consomem `statusInfo()`
 * e não conhecem slug nenhum.
 *
 * Os slugs e as cores abaixo são EXATAMENTE os do seed daquela migration, para
 * a troca não mexer em pixel nenhum.
 */

export interface StatusInfo {
  slug: string;
  nome: string;
  /** Cor cheia — bolinha, barra lateral, borda. */
  cor: string;
  /** Variante escura, legível como texto sobre o fundo suave. */
  corTexto: string;
  /** Em qual das 8 colunas do Kanban do PCP este status cai. */
  colunaPcp: string;
  /** 'pedido' aparece só no status geral; 'ambos' nos dois níveis. */
  escopo: "pedido" | "item" | "ambos";
}

export const STATUS_CATALOGO: StatusInfo[] = [
  { slug: "organizando_anotacoes",   nome: "Organizando anotações",      cor: "#64748B", corTexto: "#334155", colunaPcp: "organizando_pedido",  escopo: "ambos" },
  { slug: "imprimir_ordem_producao", nome: "Imprimir ordem de produção", cor: "#0EA5E9", corTexto: "#0369A1", colunaPcp: "pronto_producao",     escopo: "ambos" },
  { slug: "aguardando_mercadoria",   nome: "Aguardando mercadoria",      cor: "#F59E0B", corTexto: "#B45309", colunaPcp: "pronto_producao",     escopo: "ambos" },
  { slug: "aguardando_teste",        nome: "Aguardando teste laser/DTF", cor: "#A855F7", corTexto: "#7E22CE", colunaPcp: "teste_fisico",        escopo: "ambos" },
  { slug: "preparar_dtf",            nome: "Preparar DTF/vetorização",   cor: "#8B5CF6", corTexto: "#6D28D9", colunaPcp: "preparacao",          escopo: "ambos" },
  { slug: "a_produzir",              nome: "A produzir",                 cor: "#2563EB", corTexto: "#1D4ED8", colunaPcp: "em_producao",         escopo: "ambos" },
  { slug: "a_produzir_terceirizada", nome: "A produzir terceirizada",    cor: "#1D4ED8", corTexto: "#1E40AF", colunaPcp: "em_producao",         escopo: "ambos" },
  { slug: "inserir_medidas",         nome: "Inserir medidas",            cor: "#0D9488", corTexto: "#0F766E", colunaPcp: "embalagem_pagamento", escopo: "ambos" },
  { slug: "conferir_pagamentos",     nome: "Conferir pagamentos",        cor: "#059669", corTexto: "#047857", colunaPcp: "embalagem_pagamento", escopo: "ambos" },
  { slug: "enviar_etiqueta",         nome: "Enviar etiqueta/expedição",  cor: "#16A34A", corTexto: "#15803D", colunaPcp: "embalagem_pagamento", escopo: "ambos" },
  { slug: "aguardando_coleta",       nome: "Aguardando coleta",          cor: "#CA8A04", corTexto: "#A16207", colunaPcp: "aguardando_coleta",   escopo: "ambos" },
  { slug: "coletado_enviado",        nome: "Coletado e enviado",         cor: "#15803D", corTexto: "#166534", colunaPcp: "enviado",             escopo: "ambos" },
  { slug: "entregue",                nome: "Entregue",                   cor: "#166534", corTexto: "#14532D", colunaPcp: "enviado",             escopo: "pedido" },
  { slug: "cancelado",               nome: "Cancelado",                  cor: "#DC2626", corTexto: "#B91C1C", colunaPcp: "cancelado",           escopo: "ambos" },
];

/**
 * Slugs que ainda existem no banco (9 status da migration 09 + os 6 do pedido)
 * apontando para a entrada equivalente do catálogo. Some quando a migration
 * rodar, mas até lá é o que faz a tela funcionar com os dados de hoje.
 */
const LEGADO: Record<string, string> = {
  // sistema_producao_itens (migration 09)
  organizando_pedido:  "organizando_anotacoes",
  pronto_producao:     "imprimir_ordem_producao",
  teste_fisico:        "aguardando_teste",
  preparacao:          "preparar_dtf",
  em_producao:         "a_produzir",
  embalagem_pagamento: "inserir_medidas",
  enviado:             "coletado_enviado",
  // sistema_pedidos
  novo:     "organizando_anotacoes",
  producao: "a_produzir",
  pronto:   "aguardando_coleta",
};

const POR_SLUG = new Map(STATUS_CATALOGO.map(s => [s.slug, s]));

const DESCONHECIDO: StatusInfo = {
  slug: "desconhecido",
  nome: "Sem status",
  cor: "#94A3B8",
  corTexto: "#475569",
  colunaPcp: "organizando_pedido",
  escopo: "ambos",
};

/** Resolve qualquer slug — novo, legado ou inesperado — sem quebrar a tela. */
export function statusInfo(slug?: string | null): StatusInfo {
  if (!slug) return DESCONHECIDO;
  return POR_SLUG.get(slug) ?? POR_SLUG.get(LEGADO[slug] ?? "") ?? DESCONHECIDO;
}

/** Opções do dropdown, já filtradas pelo nível em que o status aparece. */
export function opcoesStatus(nivel: "pedido" | "item"): StatusInfo[] {
  return STATUS_CATALOGO.filter(s => s.escopo === "ambos" || s.escopo === nivel);
}

/** Fundo suave do badge, derivado da cor cheia. */
export const fundoSuave = (cor: string, pct = 12) =>
  `color-mix(in srgb, ${cor} ${pct}%, #FFFFFF)`;

/**
 * As 8 colunas do Kanban do PCP, na ordem do fluxo do galpão.
 *
 * Diferente dos status, as colunas são ESTRUTURAIS — fazem parte do layout do
 * quadro e não são editáveis pelo usuário. Cada uma tem um status canônico: é
 * ele que dá a cor da coluna e é o valor gravado quando um card é arrastado
 * para lá.
 *
 * A cor sai daqui para o PCP parar de ter paleta própria. Na tabela antiga do
 * PCP, `preparacao` e `em_producao` dividiam o mesmo laranja, e `teste_fisico`,
 * `embalagem_pagamento` e `aguardando_coleta` dividiam o mesmo amarelo — três
 * colunas visualmente idênticas, o oposto de cor que informa.
 */
export const COLUNAS_PCP = [
  { coluna: "organizando_pedido",  rotulo: "Organizando Pedido",    canonico: "organizando_anotacoes" },
  { coluna: "pronto_producao",     rotulo: "Pronto p/ Produção",    canonico: "imprimir_ordem_producao" },
  { coluna: "teste_fisico",        rotulo: "Teste Físico",          canonico: "aguardando_teste" },
  { coluna: "preparacao",          rotulo: "Preparação",            canonico: "preparar_dtf" },
  { coluna: "em_producao",         rotulo: "Em Produção",           canonico: "a_produzir" },
  { coluna: "embalagem_pagamento", rotulo: "Embalagem & Pagamento", canonico: "inserir_medidas" },
  { coluna: "aguardando_coleta",   rotulo: "Aguardando Coleta",     canonico: "aguardando_coleta" },
  { coluna: "enviado",             rotulo: "Enviado",               canonico: "coletado_enviado" },
] as const;

/** Cor da coluna = cor do seu status canônico. */
export const corDaColuna = (coluna: string): string => {
  const c = COLUNAS_PCP.find(x => x.coluna === coluna);
  return c ? statusInfo(c.canonico).cor : DESCONHECIDO.cor;
};

/* ──────────────────────────────────────────────────────────────────────────
   PONTE TEMPORÁRIA — apagar quando 20260916120000_status_catalogo.sql rodar.

   `sistema_producao_itens.status` ainda carrega o check constraint dos 9
   status da migration 09. Gravar um slug do catálogo novo é rejeitado pelo
   banco. Até lá, a escrita converte para o valor aceito hoje.

   Quatro status do catálogo não têm valor próprio no banco atual e colapsam
   num irmão ao salvar — a tela avisa antes de deixar escolher.
   ────────────────────────────────────────────────────────────────────────── */
const PARA_BANCO: Record<string, string> = {
  organizando_anotacoes:   "organizando_pedido",
  imprimir_ordem_producao: "pronto_producao",
  aguardando_mercadoria:   "pronto_producao",
  aguardando_teste:        "teste_fisico",
  preparar_dtf:            "preparacao",
  a_produzir:              "em_producao",
  a_produzir_terceirizada: "em_producao",
  inserir_medidas:         "embalagem_pagamento",
  conferir_pagamentos:     "embalagem_pagamento",
  enviar_etiqueta:         "embalagem_pagamento",
  aguardando_coleta:       "aguardando_coleta",
  coletado_enviado:        "enviado",
  cancelado:               "cancelado",
};

/** Valor que o banco aceita hoje para um slug do catálogo. */
export const slugGravavel = (slug: string): string => PARA_BANCO[slug] ?? slug;

/** Status que ainda não sobrevivem a um refresh — precisam da migration. */
export const COLAPSA_SEM_MIGRATION = new Set([
  "aguardando_mercadoria",
  "a_produzir_terceirizada",
  "conferir_pagamentos",
  "enviar_etiqueta",
]);
