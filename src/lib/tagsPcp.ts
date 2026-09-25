const TAG_TERCEIRIZADA_PREFIXO = "TERCEIRIZADA";
const TAG_DESPACHAR_PREFIXO = "DESPACHAR";

/* Etiquetas do PCP: cores, ordem e rótulo. Compartilhado com a tela de
   Pedidos para as etiquetas aparecerem iguais nos dois lugares. */
/* Paleta de etiquetas — cor viva, sólida, com texto branco. Mesmos 15 tons já
   validados em src/lib/statusPedido.ts (todos >= 4.5:1 de contraste contra
   branco), reaproveitados aqui: tag é texto livre, sem cor própria salva no
   banco, então a cor precisa ser determinística a partir do próprio texto —
   a mesma etiqueta sempre cai na mesma cor, em qualquer card. */
/* Só variações das cores primárias — azul, verde, vermelho, roxo e
   laranja — todas fechadas o bastante para o texto branco. */
const TAG_PALETTE = [
  "#1D4ED8", "#1E40AF", "#0369A1", "#075985",
  "#15803D", "#047857", "#166534",
  "#B91C1C", "#DC2626",
  "#7E22CE", "#6D28D9", "#A21CAF",
  "#EA580C", "#F97316",
];

/* Paleta EXATA de etiquetas fixas do fluxo (cores dadas pelo usuário) —
   tag que bate literalmente com uma destas usa a cor exata; texto livre
   (nome de terceirizada, nome de transportadora fora da lista) continua
   caindo no hash determinístico acima. "TERCEIRIZADA: X" é reconhecida
   pelo prefixo, não pelo texto inteiro (o nome muda por pedido). */
/* Todas aqui são tons FECHADOS de propósito: a etiqueta é sempre texto
   branco em negrito, e verde/laranja/ciano claros deixavam a palavra
   quase ilegível em cima da foto do produto. */
const TAG_COR_EXATA: Record<string, string> = {
  "COMPRADO XBZ": "#1D4ED8",
  "COMPRADO SP": "#6D28D9",
  "COMPRADO CHINA": "#6D28D9", // legado — tags já gravadas com esse texto continuam coloridas
  "TESTE ENVIADO": "#7E22CE",
  "TESTE REFEITO": "#6D28D9",
  "TESTE APROVADO": "#15803D",
  "TESTE RECUSADO": "#DC2626",
  "PROD. GALPÃO": "#1D4ED8",
  "TERCEIRIZADA": "#EA580C",
  "COBRAR 50% RESTANTE": "#DC2626",
  "PAGO CARTÃO": "#15803D",
  "DESPACHAR": "#0369A1",
  "PRODUZIR + MÍDIA": "#EA580C",
  "PRODUZIDO": "#15803D",
  "LASER": "#15803D",
  "DTF UV": "#1D4ED8",
  "MÍDIA ENVIADA": "#0E7490",
  "PAGO 100%": "#15803D",
  "PAGAMENTO PENDENTE": "#DC2626",
  "COLETADO": "#15803D",
  "ENVIADO": "#15803D",
  "COLETA BRASPRESS": "#1D4ED8",
  "BRASPRESS": "#1D4ED8",
  "COLETA MELHOR ENVIO": "#6D28D9",
  "MELHOR ENVIO": "#6D28D9",
  "ENVIO POR LALAMOVE": "#EA580C",
  "LALAMOVE": "#EA580C",
};

/* Ordem de prioridade quando o card tem mais etiquetas do que cabe —
   mostra as primeiras da lista e agrupa o resto em "+N" (hover revela). */
const TAG_PRIORIDADE = [
  "URGENTE", "TESTE RECUSADO", "COBRAR 50% RESTANTE", "DESPACHAR",
  "TESTE APROVADO", "TESTE REFEITO", "TESTE ENVIADO",
  "PROD. GALPÃO", "TERCEIRIZADA", "PAGO CARTÃO",
  "COMPRADO XBZ", "COMPRADO SP", "COMPRADO CHINA", "LASER", "DTF UV",
  "BRASPRESS", "MELHOR ENVIO", "LALAMOVE",
];

export const prioridadeDaTag = (texto: string) => {
  const t = texto.toUpperCase();
  const i = TAG_PRIORIDADE.findIndex(p => t.startsWith(p) || t.includes(p));
  return i === -1 ? TAG_PRIORIDADE.length : i;
};

export const ordenarTagsPorPrioridade = (tags: string[]) =>
  [...tags].sort((a, b) => prioridadeDaTag(a) - prioridadeDaTag(b));

/** Etiquetas antigas foram gravadas como "TERCEIRIZADA + nome"; o padrão agora é "TERCEIRIZADA - nome". */
export const rotuloTag = (t: string) => t.replace(/^(TERCEIRIZADA)\s*\+\s*/i, "$1 - ");

export const corDaTag = (texto: string) => {
  const exata = TAG_COR_EXATA[texto.toUpperCase()];
  if (exata) return exata;
  if (texto.toUpperCase().startsWith(TAG_TERCEIRIZADA_PREFIXO)) return TAG_COR_EXATA["TERCEIRIZADA"];
  if (texto.toUpperCase().startsWith(TAG_DESPACHAR_PREFIXO)) return TAG_COR_EXATA["DESPACHAR"];
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
};

