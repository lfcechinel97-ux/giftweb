// ============= analisar-conversas-comercial =============
// Sincroniza conversas do Data Crazy (WhatsApp comercial) para
// public.comercial_conversas e gera a análise de IA em
// public.comercial_analises (nota, resultado, resumo, pontos fortes,
// melhorias, objeções, oportunidades perdidas e próximo passo).
//
// A análise usa o Lovable AI Gateway (/v1/responses, saída JSON com
// json_schema estrito, LOVABLE_API_KEY já injetada no projeto). Escrita via
// service role; só admin chama.
//
// Tudo é feito em LOTES com orçamento de tempo (a edge function tem limite
// de wall-clock): a página /whatsapp chama em sequência até terminar.
//   { acao: "importar", inicio, fim, skip }  -> importa conversas com
//       atividade no período (sem IA); devolve proximoSkip/terminou.
//   { acao: "analisar_pendentes", inicio, fim } -> analisa por IA as
//       conversas do período que mudaram desde a última análise.
//       (ou só das conversaIds; forcar=true reanalisa mesmo sem mudança).
//   { acao: "avaliar_conjunto", inicio, fim | conversaIds, instrucoes, titulo }
//       -> avaliação geral de um conjunto (período, vendedor, seleção): lê
//       as transcrições inteiras quando cabem, senão as análises.
//   { acao: "recalcular", skip } -> refaz transcrição/papéis a partir das
//       mensagens já gravadas (sem Data Crazy).
//   { acao: "amostra_mensagens", conversaId } -> JSON cru do Data Crazy.
//   { acao: "baixar_planilha", url } -> CSV de uma planilha Google.
//   { acao: "vincular_leads" } -> liga leads do Meta às conversas.
//   { acao: "perguntar", pergunta, historico } -> assistente: responde
//       perguntas sobre os leads/conversas ("como foram os leads de ontem?").
//   { conversaId, reanalizar: true } -> reimporta e reanalisa uma conversa.
// Rate limit da rota de conversas do Data Crazy: 20 req/min -- toda
// chamada passa pelo dcGet, que espaça as requisições; num 429 a função
// devolve aguardarSeg para a página esperar antes do próximo lote.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_BASE = "https://ai.gateway.lovable.dev";
const MODELO = "openai/gpt-6-astra";
const DC_BASE = "https://api.g1.datacrazy.io";
// 20 req/min na rota de conversas -> uma requisição a cada ~3,1s.
const INTERVALO_DC_MS = 3100;
const AGUARDAR_APOS_429_SEG = 65;
const MAX_CARACTERES_TRANSCRICAO = 60_000;
const CONVERSAS_POR_PAGINA = 50;
const MENSAGENS_POR_PAGINA = 100;
const MAX_PAGINAS_MENSAGENS = 5;
// Orçamento de tempo por chamada (o limite da edge function é maior; a
// folga cobre a última requisição/análise em andamento).
const ORCAMENTO_IMPORTAR_MS = 90_000;
const ORCAMENTO_ANALISAR_MS = 55_000;
const ANALISES_EM_PARALELO = 4;
const MIN_CARACTERES_PARA_ANALISAR = 40;
const MAX_CARACTERES_DIAGNOSTICO = 250_000;
// Avaliação em conjunto lê as transcrições inteiras até este tamanho.
const MAX_CARACTERES_TRANSCRICOES_CONJUNTO = 150_000;
const ORCAMENTO_RECALCULAR_MS = 60_000;

type ConversaDC = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  contact?: { contactId?: string; name?: string; platform?: string } | null;
  instance?: { platform?: string } | null;
  status?: string;
  finished?: boolean;
  lastMessageIsAutomation?: boolean;
  lastMessageDate?: string;
};

type MensagemDC = {
  id?: string;
  createdAt?: string;
  body?: string;
  received?: boolean;
  deletedAt?: string | null;
  attachments?: { fileName?: string; mimeType?: string }[];
  attendants?: { name?: string }[];
};

type AnaliseSdr = {
  handoff_feito?: boolean;
  lead_qualificado?: boolean;
  catalogo_enviado?: boolean;
  acertos?: string[];
  violacoes?: { regra: string; trecho: string; correcao: string }[];
  sugestoes_prompt?: string[];
};

type AnaliseIA = {
  nota_sdr?: number | null;
  sdr?: AnaliseSdr | null;
  nota?: number | null;
  resultado?: string | null;
  etapa_funil?: string | null;
  resumo?: string | null;
  pontos_fortes?: unknown[] | null;
  melhorias?: unknown[] | null;
  objecoes?: unknown[] | null;
  oportunidades_perdidas?: unknown[] | null;
  proximo_passo?: string | null;
};

class LimiteDataCrazy extends Error {}

const CATEGORIAS_MELHORIA = [
  "tempo_resposta", "qualificacao", "apresentacao_produto", "preco_negociacao",
  "follow_up", "fechamento", "informacao_incorreta", "organizacao_atendimento", "outra",
];

// json_schema estrito para o /v1/responses: objeto na raiz, todas as
// propriedades em required, opcionais como nullable, sem additionalProperties.
const SCHEMA_ANALISE = {
  type: "object",
  properties: {
    nota: { type: ["number", "null"], description: "Nota de 0 a 10 para o atendimento" },
    resultado: { type: ["string", "null"], description: "venda | em_andamento | perdida | sem_interesse | indefinido" },
    etapa_funil: { type: ["string", "null"], description: "Etapa atual do funil, em poucas palavras" },
    resumo: { type: ["string", "null"], description: "Resumo objetivo em 2 a 4 frases" },
    pontos_fortes: { type: ["array", "null"], items: { type: "string" } },
    melhorias: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          categoria: { type: "string", enum: CATEGORIAS_MELHORIA },
          titulo: { type: "string" },
          detalhe: { type: "string", description: "O que aconteceu (com trecho) e o que fazer diferente" },
          prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["categoria", "titulo", "detalhe", "prioridade"],
        additionalProperties: false,
      },
    },
    objecoes: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            enum: ["preco", "prazo", "quantidade_minima", "frete", "qualidade", "confianca", "concorrente", "aprovacao_interna", "vou_pensar", "sumiu", "outra"],
          },
          trecho_cliente: { type: "string" },
          como_vendedor_lidou: { type: "string" },
          foi_contornada: { type: "boolean" },
          resposta_sugerida: { type: "string", description: "Mensagem pronta para WhatsApp que quebra a objeção" },
        },
        required: ["categoria", "trecho_cliente", "como_vendedor_lidou", "foi_contornada", "resposta_sugerida"],
        additionalProperties: false,
      },
    },
    oportunidades_perdidas: { type: ["array", "null"], items: { type: "string" } },
    proximo_passo: { type: ["string", "null"], description: "Ação concreta e imediata do consultor" },
    nota_sdr: { type: ["number", "null"], description: "Nota de 0 a 10 para o SDR de IA; null se ele não participou" },
    sdr: {
      type: ["object", "null"],
      description: "Avaliação do SDR de IA contra o prompt dele; null se ele não participou",
      properties: {
        handoff_feito: { type: "boolean", description: "Mandou o 'Resumo do projeto' e passou para o consultor" },
        lead_qualificado: { type: "boolean", description: "Coletou produto, quantidade, orçamento, personalização, prazo e CEP (ou 'a confirmar')" },
        catalogo_enviado: { type: "boolean" },
        acertos: { type: "array", items: { type: "string" } },
        violacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              regra: { type: "string", description: "Regra do prompt que foi quebrada" },
              trecho: { type: "string", description: "Mensagem do SDR que quebrou a regra" },
              correcao: { type: "string", description: "Como deveria ter sido a mensagem" },
            },
            required: ["regra", "trecho", "correcao"],
            additionalProperties: false,
          },
        },
        sugestoes_prompt: {
          type: "array",
          items: { type: "string" },
          description: "Mudanças concretas no prompt do SDR que teriam evitado os problemas desta conversa",
        },
      },
      required: ["handoff_feito", "lead_qualificado", "catalogo_enviado", "acertos", "violacoes", "sugestoes_prompt"],
      additionalProperties: false,
    },
  },
  required: ["nota", "resultado", "etapa_funil", "resumo", "pontos_fortes", "melhorias", "objecoes", "oportunidades_perdidas", "proximo_passo", "nota_sdr", "sdr"],
  additionalProperties: false,
} as const;

const PROMPT_SISTEMA = `Você é um auditor de atendimento comercial B2B da Gift Web Brindes (brindes personalizados: canecas, garrafas, camisetas, sacolas, kit corporativo etc.). Analise a transcrição de uma conversa de WhatsApp entre um cliente e um atendente/vendedor da equipe.

O atendimento tem duas etapas: primeiro o "SDR (IA)" (Felipe, uma IA de pré-venda) qualifica o lead e manda o "Resumo do projeto"; depois o "Consultor" (vendedor humano) entra, se apresenta pelo nome e assume. As mensagens "Cliente:" vêm do cliente, "SDR (IA):" da IA e "Consultor (nome):" do vendedor humano; o horário vem entre colchetes -- use-o para avaliar o tempo de resposta. A marcação de quem enviou é automática: se o conteúdo deixar claro que uma mensagem foi do outro papel (ex.: alguém se apresentando pelo nome, que não é o Felipe), considere o conteúdo. Nunca atribua ao consultor um erro do SDR, nem o contrário.

Os campos nota, resultado, melhorias, objeções, oportunidades perdidas e próximo passo avaliam o CONSULTOR humano (o fechamento) -- se a conversa não chegou ao consultor, avalie a conversa como um todo e diga nas melhorias o que impediu a passagem. Os campos nota_sdr e sdr avaliam o SDR de IA contra as regras do prompt dele (abaixo): cada regra quebrada vira uma violação com o trecho e a mensagem correta; em sugestoes_prompt, proponha mudanças objetivas no prompt (o que acrescentar, tirar ou reescrever) que teriam evitado os problemas.

Seja específico e cite trechos reais. Para cada objeção do cliente (preço, prazo, quantidade mínima, frete, qualidade, "vou pensar", concorrente, aprovação interna, cliente que sumiu etc.), diga como o atendente lidou, se ela foi contornada, e escreva uma resposta curta e natural para WhatsApp que ele poderia ter usado para quebrá-la. Nas melhorias, priorize o que mais aumenta a chance de fechar: tempo de resposta, perguntas de qualificação (quantidade, data do evento, logo, orçamento), condução para o próximo passo, urgência pelo prazo de produção, ancoragem de valor e follow-up.

Não invente fatos que não estejam na transcrição. Se a transcrição for muito curta ou sem conteúdo comercial, use nota baixa e resultado "indefinido".`;

const SCHEMA_DIAGNOSTICO = {
  type: "object",
  properties: {
    avaliacao_atendimento: {
      type: "object",
      description: "O atendimento deste conjunto está bom? Avaliado contra o processo de atendimento da empresa",
      properties: {
        nota_geral: { type: "number", description: "0 a 10" },
        esta_bom: { type: "boolean" },
        veredito: { type: "string", description: "2 a 4 frases, direto ao ponto" },
        criterios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterio: { type: "string", description: "Etapa ou exigência do processo (ex.: perguntou a quantidade)" },
              nota: { type: "number", description: "0 a 10" },
              avaliacao: { type: "string", description: "Como o time se saiu, com números/exemplos" },
            },
            required: ["criterio", "nota", "avaliacao"],
            additionalProperties: false,
          },
        },
      },
      required: ["nota_geral", "esta_bom", "veredito", "criterios"],
      additionalProperties: false,
    },
    prompt_sdr: {
      type: "object",
      properties: {
        avaliacao_geral: { type: "string" },
        problemas_recorrentes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              problema: { type: "string" },
              frequencia: { type: "string" },
              regra_relacionada: { type: "string" },
              exemplo: { type: "string" },
            },
            required: ["problema", "frequencia", "regra_relacionada", "exemplo"],
            additionalProperties: false,
          },
        },
        alteracoes_sugeridas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              secao: { type: "string", description: "Seção do prompt (ex.: <regras>, <fluxo>, <objecoes>)" },
              mudanca: { type: "string", description: "O que mudar e por quê" },
              texto_sugerido: { type: "string", description: "Texto pronto para colar no prompt" },
            },
            required: ["secao", "mudanca", "texto_sugerido"],
            additionalProperties: false,
          },
        },
      },
      required: ["avaliacao_geral", "problemas_recorrentes", "alteracoes_sugeridas"],
      additionalProperties: false,
    },
    resumo_geral: { type: "string", description: "3 a 5 frases sobre a saúde do atendimento no período" },
    pontos_fracos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          frequencia: { type: "string", description: "Em quantas conversas aparece (aprox.)" },
          impacto: { type: "string", enum: ["alto", "medio", "baixo"] },
          exemplos: { type: "array", items: { type: "string" } },
          como_corrigir: { type: "string" },
        },
        required: ["titulo", "frequencia", "impacto", "exemplos", "como_corrigir"],
        additionalProperties: false,
      },
    },
    por_vendedor: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vendedor: { type: "string" },
          deixa_a_desejar: { type: "array", items: { type: "string" } },
          pontos_fortes: { type: "array", items: { type: "string" } },
          foco_de_treinamento: { type: "string" },
        },
        required: ["vendedor", "deixa_a_desejar", "pontos_fortes", "foco_de_treinamento"],
        additionalProperties: false,
      },
    },
    por_origem: {
      type: "array",
      items: {
        type: "object",
        properties: { origem: { type: "string" }, observacao: { type: "string" } },
        required: ["origem", "observacao"],
        additionalProperties: false,
      },
    },
    scripts_recomendados: {
      type: "array",
      items: {
        type: "object",
        properties: { situacao: { type: "string" }, mensagem: { type: "string" } },
        required: ["situacao", "mensagem"],
        additionalProperties: false,
      },
    },
    acoes_prioritarias: { type: "array", items: { type: "string" } },
  },
  required: ["avaliacao_atendimento", "resumo_geral", "pontos_fracos", "por_vendedor", "por_origem", "scripts_recomendados", "acoes_prioritarias", "prompt_sdr"],
  additionalProperties: false,
} as const;

const PROMPT_DIAGNOSTICO = `Você é o gestor comercial da Gift Web Brindes (brindes personalizados B2B, venda por WhatsApp). Abaixo vem um conjunto de conversas para avaliar -- ou as transcrições completas, ou as análises individuais de cada conversa (uma por linha, em JSON compacto) com métricas objetivas de atendimento. Primeiro diga se o atendimento deste conjunto está bom, critério a critério, comparando com o processo de atendimento da empresa (abaixo). Depois faça o diagnóstico do time: quais pontos estão deixando a desejar com mais frequência e mais impacto em vendas, o que cada vendedor precisa melhorar, diferenças entre origens do lead (Google, Meta etc.), mensagens-modelo para as situações mais problemáticas e as ações prioritárias para a próxima semana. Baseie-se só nos dados; cite números quando houver.

O atendimento começa com um SDR de IA (Felipe) que qualifica e passa para o consultor humano; "por_vendedor" é sobre os consultores humanos. Em "prompt_sdr", avalie o SDR a partir das violações e sugestões de cada conversa e proponha alterações no prompt dele (que vem abaixo) com o texto pronto para colar -- priorize o que mais faz lead morrer ou chegar mal qualificado ao consultor.`;

const soNumeros = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const paraHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return paraHex(digest);
}

const aguardar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);

/** GET no Data Crazy respeitando o limite de 20 req/min; 429 vira LimiteDataCrazy. */
let ultimaChamadaDC = 0;
async function dcGet(caminho: string, apiKey: string): Promise<unknown> {
  const espera = ultimaChamadaDC + INTERVALO_DC_MS - Date.now();
  if (espera > 0) await aguardar(espera);
  ultimaChamadaDC = Date.now();
  const resposta = await fetch(`${DC_BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (resposta.status === 429) throw new LimiteDataCrazy("Limite de requisições do Data Crazy");
  if (!resposta.ok) throw new Error(`Data Crazy ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  return await resposta.json().catch(() => null);
}

function extrairLista(dados: unknown): unknown[] {
  if (Array.isArray(dados)) return dados;
  if (dados && typeof dados === "object") {
    const obj = dados as Record<string, unknown>;
    for (const chave of ["data", "messages"]) {
      if (Array.isArray(obj[chave])) return obj[chave] as unknown[];
    }
  }
  return [];
}

/** Todas as mensagens da conversa (paginadas), sem as apagadas, da mais antiga para a mais nova. */
async function buscarMensagens(conversaId: string, apiKey: string): Promise<MensagemDC[]> {
  const todas: MensagemDC[] = [];
  const vistas = new Set<string>();
  for (let p = 0; p < MAX_PAGINAS_MENSAGENS; p++) {
    const pagina = extrairLista(
      await dcGet(`/api/v1/conversations/${conversaId}/messages?take=${MENSAGENS_POR_PAGINA}&skip=${p * MENSAGENS_POR_PAGINA}`, apiKey),
    ) as MensagemDC[];
    const novas = pagina.filter((m) => {
      const chave = m?.id ?? `${m?.createdAt}|${m?.body}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
    todas.push(...novas);
    // Página incompleta ou repetida (a API ignorou o skip): acabou.
    if (pagina.length < MENSAGENS_POR_PAGINA || novas.length === 0) break;
  }
  return todas
    .filter((m) => m && !m.deletedAt)
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
}

const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const nomeAtendente = (m: MensagemDC) =>
  (m as { attendant?: { name?: string } }).attendant?.name ?? m.attendants?.find((a) => a?.name)?.name ?? null;

/** Campos que o Data Crazy pode usar para marcar automação/IA (nome não confirmado: aceita os comuns). */
const CAMPOS_AUTOMACAO = ["isAutomation", "automation", "fromAutomation", "isBot", "bot", "isAi", "fromAi", "isAgent", "sentByAi"];

/** Mensagem compacta guardada em comercial_conversas.mensagens: dá para recalcular quem mandou o quê sem o Data Crazy. */
type Msg = { t: string | null; r: boolean; b: string; a: string | null; auto: boolean; anx?: string[] };

function compactar(m: MensagemDC): Msg {
  const o = m as Record<string, unknown>;
  const anexos = (m.attachments ?? []).map((a) => a?.fileName || a?.mimeType).filter(Boolean) as string[];
  return {
    t: m.createdAt ?? null,
    r: !!m.received,
    b: (m.body ?? "").trim(),
    a: m.received ? null : nomeAtendente(m),
    auto: CAMPOS_AUTOMACAO.some((k) => o[k] === true),
    ...(anexos.length ? { anx: anexos } : {}),
  };
}

const NOME_SDR = /\bfelipe\b/i;
const RE_APRESENTACAO_SDR = /\b(?:sou o|aqui (?:é|e) o|me chamo|meu nome (?:é|e))\s+felipe\b/i;
// Prefixo em qualquer caixa, mas o nome tem de vir com inicial maiúscula (evita "sou o responsável").
// "Sou o Guilherme", "aqui é a Priscila", "me chamo...", "meu nome é..." -- o consultor se apresenta ao entrar.
const RE_APRESENTACAO = /\b(?:[Ss]ou [oa]|[Aa]qui (?:é|e) [oa]|[Mm]e chamo|[Mm]eu nome (?:é|e))\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/;
/** A mensagem "Resumo do projeto" do SDR dispara a transferência para o consultor. */
const ehResumo = (m: Msg) => !m.r && /resumo do projeto/i.test(m.b);

type Papel = { papel: "cliente" | "sdr" | "consultor"; nome: string | null };

/**
 * Quem mandou cada mensagem. O SDR de IA sempre começa; o consultor humano
 * entra depois e se apresenta. É consultor a mensagem enviada:
 *  - com atendente identificado que não seja uma conta usada pelo SDR
 *    (conta que aparece em mensagem claramente do SDR: automação, "Resumo do
 *    projeto" ou "sou o Felipe");
 *  - com apresentação de alguém que não é o Felipe;
 *  - depois que o consultor já entrou ou depois do "Resumo do projeto".
 * Fora isso, é do SDR.
 */
function atribuirPapeis(msgs: Msg[]) {
  const doSdr = (m: Msg) => m.auto || ehResumo(m) || RE_APRESENTACAO_SDR.test(m.b);
  const contasSdr = new Set<string>();
  for (const m of msgs) if (!m.r && m.a && (doSdr(m) || NOME_SDR.test(m.a))) contasSdr.add(m.a);

  let consultor: string | null = null;
  let consultorAtivo = false;
  let handoffEm: string | null = null;
  let consultorEntrouEm: string | null = null;
  const papeis: Papel[] = msgs.map((m) => {
    if (m.r) return { papel: "cliente", nome: null };
    if (doSdr(m)) {
      if (ehResumo(m)) handoffEm ??= m.t;
      return { papel: "sdr", nome: "Felipe" };
    }
    const humano = m.a && !contasSdr.has(m.a) ? m.a : null;
    const apresentado = RE_APRESENTACAO.exec(m.b)?.[1];
    const nomeApresentado = apresentado && !NOME_SDR.test(apresentado) ? apresentado : null;
    if (humano || nomeApresentado || consultorAtivo || handoffEm) {
      consultorAtivo = true;
      consultor ??= humano ?? nomeApresentado;
      consultorEntrouEm ??= m.t;
      return { papel: "consultor", nome: humano ?? consultor };
    }
    return { papel: "sdr", nome: "Felipe" };
  });
  return { papeis, consultor, handoffEm, consultorEntrouEm };
}

/** Transcrição legível ("[dd/mm hh:mm] Quem: mensagem"), papéis e métricas a partir das mensagens compactas. */
function camposDasMensagens(msgs: Msg[]) {
  const { papeis, consultor, handoffEm, consultorEntrouEm } = atribuirPapeis(msgs);
  const linhas = msgs.map((m, i) => {
    const p = papeis[i];
    const quem = p.papel === "cliente" ? "Cliente" : p.papel === "sdr" ? "SDR (IA)" : `Consultor${p.nome ? ` (${p.nome})` : ""}`;
    const texto = [m.b, m.anx?.length ? `[anexo: ${m.anx.join(", ")}]` : ""].filter(Boolean).join(" ");
    return `[${hora(m.t)}] ${quem}: ${texto}`;
  });
  let transcricao = linhas.join("\n");
  // Conversa longa: a negociação fecha (ou morre) no final -- guarda o final.
  if (transcricao.length > MAX_CARACTERES_TRANSCRICAO) transcricao = transcricao.slice(-MAX_CARACTERES_TRANSCRICAO);

  // Tempos de resposta (a qualquer resposta da empresa, SDR ou consultor).
  const tempos: number[] = [];
  let aguardandoDesde: number | null = null;
  for (const m of msgs) {
    const t = ms(m.t);
    if (Number.isNaN(t)) continue;
    if (m.r) {
      if (aguardandoDesde == null) aguardandoDesde = t;
    } else if (aguardandoDesde != null) {
      tempos.push(Math.round((t - aguardandoDesde) / 1000));
      aguardandoDesde = null;
    }
  }
  const ordenados = [...tempos].sort((a, b) => a - b);
  const primeiraCliente = msgs.find((m) => m.r);
  const emails = [...new Set(msgs.filter((m) => m.r).flatMap((m) => m.b.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? []))];

  return {
    transcricao,
    atendente: consultor,
    total_mensagens: msgs.length,
    primeira_mensagem_cliente: primeiraCliente?.b || null,
    primeira_mensagem_em: primeiraCliente?.t ?? null,
    tempo_primeira_resposta_seg: tempos[0] ?? null,
    tempo_mediano_resposta_seg: ordenados.length ? ordenados[Math.floor(ordenados.length / 2)] : null,
    cliente_sem_resposta: aguardandoDesde != null,
    mensagens_sdr: papeis.filter((p) => p.papel === "sdr").length,
    mensagens_consultor: papeis.filter((p) => p.papel === "consultor").length,
    handoff_em: handoffEm,
    consultor_entrou_em: consultorEntrouEm,
    emails: emails.length ? emails : null,
  };
}

/** Anúncio de clique-para-WhatsApp do Meta manda "referral"/ctwa; links do Google levam gclid. */
function detectarOrigem(...brutos: unknown[]): string | null {
  const texto = JSON.stringify(brutos).toLowerCase();
  if (/ctwa|referral|fbclid|facebook\.com|instagram\.com|"source_?type":"ad"/.test(texto)) return "meta";
  if (/gclid|gbraid|wbraid|googleads|google\.com\/aclk/.test(texto)) return "google";
  return null;
}

function statusConversa(conv: ConversaDC): string {
  if (typeof conv.status === "string" && conv.status) return conv.status;
  if (conv.finished) return "finished";
  if (conv.lastMessageIsAutomation) return "automation";
  return "opened";
}

/** Chama o Lovable AI (/v1/responses, stream) com saída JSON estrita e devolve o objeto + uso de tokens. */
async function chamarIA<T>(
  request: Request,
  apiKey: string,
  sistema: string,
  entrada: string,
  nomeSchema: string,
  schema: unknown,
  esforco: "low" | "medium" = "medium",
): Promise<{ resultado: T; tokensEntrada?: number; tokensSaida?: number } | { erro: string }> {
  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  let resposta: Response;
  try {
    resposta = await gateway.fetch(`${GATEWAY_BASE}/v1/responses`, {
      method: "POST",
      signal: request.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODELO,
        stream: true,
        store: false,
        reasoning: { effort: esforco, summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: sistema },
          { role: "user", content: entrada },
        ],
        text: {
          format: { type: "json_schema", name: nomeSchema, strict: true, schema },
        },
      }),
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
  if (resposta.status === 429) return { erro: "limite de requisições da IA, tente de novo em instantes" };
  if (resposta.status === 402) return { erro: "créditos de IA do workspace esgotados" };
  if (!resposta.ok) {
    return { erro: `${resposta.status} ${(await resposta.text()).slice(0, 400)}` };
  }

  // Lê o stream SSE: junta os deltas de texto e captura o uso no evento final.
  let texto = "";
  let tokensEntrada: number | undefined;
  let tokensSaida: number | undefined;
  try {
    const reader = resposta.body?.getReader();
    if (!reader) return { erro: "resposta do gateway sem corpo" };
    const decoder = new TextDecoder();
    let pendente = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pendente += decoder.decode(value, { stream: true });
      const linhas = pendente.split("\n");
      pendente = linhas.pop() ?? "";
      for (const linha of linhas) {
        const data = linha.startsWith("data: ") ? linha.slice(6).trim() : "";
        if (!data || data === "[DONE]") continue;
        let evento: Record<string, unknown>;
        try {
          evento = JSON.parse(data);
        } catch {
          continue;
        }
        if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
          texto += evento.delta;
        } else if (evento.type === "response.completed" && evento.response && typeof evento.response === "object") {
          const finalizada = evento.response as { usage?: { input_tokens?: number; output_tokens?: number } };
          tokensEntrada = finalizada.usage?.input_tokens;
          tokensSaida = finalizada.usage?.output_tokens;
          if (!texto) {
            // Fallback: extrai o texto completo do evento final.
            const itens = (finalizada as { output?: { content?: { text?: string }[] }[] }).output ?? [];
            texto = itens.flatMap((i) => (i.content ?? []).map((c) => c.text ?? "")).join("");
          }
        }
      }
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }

  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  if (!limpo) return { erro: "IA não devolveu texto" };
  try {
    return { resultado: JSON.parse(limpo) as T, tokensEntrada, tokensSaida };
  } catch {
    return { erro: `IA devolveu texto fora do JSON: ${limpo.slice(0, 200)}` };
  }
}

/** Busca as mensagens de uma conversa e grava (sem IA). */
async function importarConversa(admin: SupabaseClient, conv: ConversaDC, dcKey: string) {
  const brutas = await buscarMensagens(conv.id, dcKey);
  const msgs = brutas.map(compactar);
  const campos = camposDasMensagens(msgs);
  const primeiraCliente = brutas.find((m) => m.received);
  const linha = {
    id: conv.id,
    iniciada_em: conv.createdAt ?? brutas[0]?.createdAt ?? null,
    atualizado_em: conv.updatedAt ?? new Date().toISOString(),
    ultima_mensagem_em: conv.lastMessageDate ?? brutas.at(-1)?.createdAt ?? null,
    contato_nome: conv.contact?.name ?? conv.name ?? null,
    contato_telefone: conv.contact?.contactId ?? null,
    canal: conv.contact?.platform ?? conv.instance?.platform ?? "WHATSAPP",
    status: statusConversa(conv),
    bruto: conv,
    primeira_mensagem_bruto: primeiraCliente ?? null,
    origem_detectada: detectarOrigem(conv, primeiraCliente),
    mensagens: msgs,
    ...campos,
    transcricao_hash: await sha256(campos.transcricao),
  };
  const { error } = await admin.from("comercial_conversas").upsert(linha);
  if (error) throw new Error(`erro ao gravar conversa (${error.message})`);
  return linha;
}

async function lerConfig(admin: SupabaseClient, chave: string): Promise<string> {
  const { data } = await admin.from("comercial_configuracoes").select("valor").eq("chave", chave).maybeSingle();
  return (data?.valor ?? "").trim();
}

/** Prompt do SDR e processo de atendimento (salvos na tela /whatsapp), anexados às instruções da IA. */
async function blocoContexto(admin: SupabaseClient): Promise<string> {
  const [prompt, processo] = await Promise.all([lerConfig(admin, "prompt_sdr"), lerConfig(admin, "processo_atendimento")]);
  return (processo
    ? `\n\nPROCESSO DE ATENDIMENTO DA EMPRESA (critério de avaliação):\n<processo>\n${processo}\n</processo>`
    : "") +
    (prompt
      ? `\n\nPROMPT ATUAL DO SDR DE IA (as regras que ele deveria seguir):\n<prompt_sdr>\n${prompt}\n</prompt_sdr>`
      : "\n\n(O prompt do SDR não foi cadastrado: avalie o SDR por boas práticas de pré-venda.)");
}

/** Analisa por IA uma conversa já gravada e salva em comercial_analises. */
async function analisarConversa(
  admin: SupabaseClient,
  req: Request,
  lovableKey: string,
  contexto: string,
  c: { id: string; transcricao: string; transcricao_hash: string; atendente: string | null; contato_nome: string | null },
) {
  const cabecalho = [c.contato_nome && `Cliente: ${c.contato_nome}`, c.atendente && `Consultor responsável: ${c.atendente}`]
    .filter(Boolean).join("\n");
  const ia = await chamarIA<AnaliseIA>(
    req, lovableKey, PROMPT_SISTEMA + contexto,
    `${cabecalho}\n\nAnalise a transcrição abaixo da conversa:\n\n${c.transcricao}`,
    "analise_conversa", SCHEMA_ANALISE,
  );
  if ("erro" in ia) throw new Error(`IA (${ia.erro})`);
  const a = ia.resultado;
  const notaBruta = soNumeros(a?.nota);
  const notaSdr = a?.nota_sdr == null ? null : Math.min(10, Math.max(0, Math.round(soNumeros(a.nota_sdr) * 10) / 10));
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);
  const { error } = await admin.from("comercial_analises").insert({
    conversa_id: c.id,
    transcricao_hash: c.transcricao_hash,
    modelo: MODELO,
    nota: notaBruta > 10 ? 10 : Math.round(notaBruta * 10) / 10,
    resultado: a.resultado ?? "indefinido",
    etapa_funil: a.etapa_funil ?? null,
    resumo: a.resumo ?? null,
    pontos_fortes: lista(a.pontos_fortes),
    melhorias: lista(a.melhorias),
    objecoes: lista(a.objecoes),
    oportunidades_perdidas: lista(a.oportunidades_perdidas),
    proximo_passo: a.proximo_passo ?? null,
    nota_sdr: notaSdr,
    sdr: a.sdr ?? null,
    tokens_entrada: ia.tokensEntrada ?? null,
    tokens_saida: ia.tokensSaida ?? null,
    bruto: a,
  });
  if (error) throw new Error(`erro ao gravar análise (${error.message})`);
}

/** Período [inicio, fim] em datas (YYYY-MM-DD), fim inclusivo, horário de Brasília. */
function periodo(inicio?: string, fim?: string) {
  const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!ok(inicio) || !ok(fim)) return null;
  return {
    inicioMs: ms(`${inicio}T00:00:00-03:00`),
    fimMs: ms(`${fim}T23:59:59.999-03:00`),
    inicioIso: new Date(`${inicio}T00:00:00-03:00`).toISOString(),
    fimIso: new Date(`${fim}T23:59:59.999-03:00`).toISOString(),
  };
}

/** Conversas gravadas com atividade no período (paginado: o PostgREST limita a 1000 linhas). */
async function conversasDoPeriodo<T>(admin: SupabaseClient, colunas: string, inicioIso: string, fimIso: string): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from("comercial_conversas").select(colunas)
      .gte("ultima_mensagem_em", inicioIso).lte("iniciada_em", fimIso)
      .order("ultima_mensagem_em", { ascending: false }).range(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return todas;
  }
}

/** Conversas por id (em blocos: a URL do .in() tem limite de tamanho). */
async function conversasPorIds<T>(admin: SupabaseClient, colunas: string, ids: string[]): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await admin.from("comercial_conversas").select(colunas).in("id", ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    todas.push(...((data ?? []) as T[]));
  }
  return todas;
}

/** Todas as linhas de uma tabela (paginado). */
async function todasAsLinhas<T>(admin: SupabaseClient, tabela: string, colunas: string): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from(tabela).select(colunas).order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return todas;
  }
}

// ---------- Leads do Meta x conversas ----------

/** DDD + 8 últimos dígitos (ignora +55 e o 9º dígito, que às vezes falta). */
function chaveTelefone(v?: string | null): string | null {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return d.slice(0, 2) + d.slice(-8);
}

const PALAVRAS_IGNORADAS = new Set(["de", "da", "do", "das", "dos", "e"]);
const tokensNome = (v?: string | null) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ")
    .split(/\s+/).filter((t) => t.length > 1 && !PALAVRAS_IGNORADAS.has(t));

type LeadLinha = { id: string; chave: string; nome: string | null; telefone: string | null; email: string | null; lead_criado_em: string | null; vinculo_metodo: string | null };
type ConversaVinculo = { id: string; contato_nome: string | null; contato_telefone: string | null; iniciada_em: string | null; primeira_mensagem_em: string | null; emails: string[] | null };

function vincularLeads(leads: LeadLinha[], conversas: ConversaVinculo[]) {
  const porTelefone = new Map<string, ConversaVinculo[]>();
  const porEmail = new Map<string, ConversaVinculo[]>();
  for (const c of conversas) {
    const k = chaveTelefone(c.contato_telefone);
    if (k) porTelefone.set(k, [...(porTelefone.get(k) ?? []), c]);
    for (const e of c.emails ?? []) porEmail.set(e, [...(porEmail.get(e) ?? []), c]);
  }
  const inicio = (c: ConversaVinculo) => ms(c.iniciada_em ?? c.primeira_mensagem_em);
  const maisProxima = (cs: ConversaVinculo[], t: number) =>
    Number.isNaN(t) ? cs[0] : [...cs].sort((a, b) => Math.abs(inicio(a) - t) - Math.abs(inicio(b) - t))[0];
  const porInicio = conversas.filter((c) => !Number.isNaN(inicio(c))).sort((a, b) => inicio(a) - inicio(b));

  const resultado: { id: string; chave: string; conversa_id: string | null; vinculo_metodo: string | null; vinculo_score: number | null }[] = [];
  for (const l of leads) {
    if (l.vinculo_metodo === "manual") continue;
    const t = ms(l.lead_criado_em);
    let achou: { c: ConversaVinculo; metodo: string; score: number } | null = null;

    const tel = chaveTelefone(l.telefone);
    if (tel && porTelefone.has(tel)) achou = { c: maisProxima(porTelefone.get(tel)!, t), metodo: "telefone", score: 100 };

    const email = l.email?.trim().toLowerCase();
    if (!achou && email && porEmail.has(email)) achou = { c: maisProxima(porEmail.get(email)!, t), metodo: "email", score: 95 };

    if (!achou && !Number.isNaN(t)) {
      // Conversa que começou de 30 min antes até 3 h depois do lead.
      const janela = porInicio.filter((c) => inicio(c) >= t - 30 * 60_000 && inicio(c) <= t + 180 * 60_000);
      const nomeLead = tokensNome(l.nome);
      let melhor: { c: ConversaVinculo; score: number } | null = null;
      for (const c of janela) {
        const nomeConversa = tokensNome(c.contato_nome);
        if (!nomeLead.length || !nomeConversa.length || nomeLead[0] !== nomeConversa[0]) continue;
        const sobrenome = nomeLead.slice(1).some((x) => nomeConversa.slice(1).includes(x));
        const score = (sobrenome ? 85 : 70) - Math.min(15, Math.abs(inicio(c) - t) / 60_000 / 12);
        if (!melhor || score > melhor.score) melhor = { c, score: Math.round(score) };
      }
      if (melhor) achou = { ...melhor, metodo: "nome_horario" };
      else {
        // Só pelo horário: uma única conversa começando até 15 min depois do lead.
        const proximas = janela.filter((c) => inicio(c) >= t - 2 * 60_000 && inicio(c) <= t + 15 * 60_000);
        if (proximas.length === 1) achou = { c: proximas[0], metodo: "horario", score: 40 };
      }
    }
    resultado.push({
      id: l.id, chave: l.chave,
      conversa_id: achou?.c.id ?? null, vinculo_metodo: achou?.metodo ?? null, vinculo_score: achou?.score ?? null,
    });
  }
  return resultado;
}

/** Link de planilha Google -> URL de download em CSV (aba indicada pelo gid). */
function urlCsvGoogle(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/docs\.google\.com$/.test(u.hostname)) return null;
    const gid = u.searchParams.get("gid") ?? /gid=(\d+)/.exec(u.hash)?.[1] ?? "0";
    const publicada = /\/spreadsheets\/d\/e\/([^/]+)/.exec(u.pathname);
    if (publicada) return `https://docs.google.com/spreadsheets/d/e/${publicada[1]}/pub?output=csv&gid=${gid}`;
    const id = /\/spreadsheets\/d\/([^/]+)/.exec(u.pathname)?.[1];
    return id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}` : null;
  } catch {
    return null;
  }
}

// ---------- Assistente (perguntas livres sobre os dados) ----------

const SCHEMA_PLANO = {
  type: "object",
  properties: {
    inicio: { type: ["string", "null"], description: "Data inicial AAAA-MM-DD (inclusiva) ou null se a pergunta não fala de período" },
    fim: { type: ["string", "null"], description: "Data final AAAA-MM-DD (inclusiva)" },
    campo_data: { type: "string", enum: ["inicio_conversa", "atividade"], description: "inicio_conversa para 'leads que chegaram'; atividade para 'conversas/atendimentos do período'" },
    origem: { type: ["string", "null"], enum: ["google", "meta", "organico", "indicacao", "outro", "nao_identificada", null] },
    consultor: { type: ["string", "null"], description: "Nome do consultor exatamente como na lista, ou null" },
    precisa_transcricoes: { type: "boolean", description: "true se a resposta exige ler as conversas em si (poucas conversas)" },
  },
  required: ["inicio", "fim", "campo_data", "origem", "consultor", "precisa_transcricoes"],
  additionalProperties: false,
} as const;

const SCHEMA_RESPOSTA = {
  type: "object",
  properties: {
    resposta: { type: "string", description: "Resposta em markdown simples (parágrafos, listas com '-', **negrito**, títulos com ###)" },
    conversas_citadas: { type: "array", items: { type: "string" }, description: "ids das conversas citadas na resposta (no máximo 10)" },
  },
  required: ["resposta", "conversas_citadas"],
  additionalProperties: false,
} as const;

const PROMPT_ASSISTENTE = `Você é o assistente comercial da Gift Web Brindes (brindes personalizados B2B, venda por WhatsApp). O dono da empresa faz perguntas sobre os leads e os atendimentos; você responde só com base nos dados fornecidos (conversas importadas do Data Crazy, análises feitas por IA e leads da planilha do Meta Ads). O atendimento começa sempre pelo SDR de IA (Felipe) e passa para um consultor humano. Responda em português, direto, com números (quantidades, porcentagens, médias) e cite clientes/consultores pelo nome quando ajudar. Se os dados não bastarem para responder (ex.: conversas ainda não analisadas), diga exatamente o que falta. Nunca invente números.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const inicioChamada = Date.now();

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const dcKey = Deno.env.get("DATACRAZY_API_KEY") ?? "";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!dcKey) return json({ error: "DATACRAZY_API_KEY não configurada no projeto." }, 500);
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY não encontrada neste projeto." }, 500);

  // Só admin por enquanto (as tabelas também só são legíveis por admin).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: ehAdmin } = await admin.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
  if (!ehAdmin) return json({ error: "Apenas administradores podem analisar conversas." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    acao?: "importar" | "analisar_pendentes" | "avaliar_conjunto" | "diagnostico_geral" | "recalcular"
      | "amostra_mensagens" | "baixar_planilha" | "vincular_leads" | "perguntar";
    pergunta?: string;
    historico?: { papel: "usuario" | "assistente"; texto: string }[];
    inicio?: string;
    fim?: string;
    skip?: number;
    reanalizar?: boolean;
    /** importar: busca de novo as mensagens mesmo sem mudança (preenche as mensagens das importações antigas). */
    atualizarTudo?: boolean;
    /** analisar_pendentes/avaliar_conjunto: restringe a estas conversas. */
    conversaIds?: string[];
    /** analisar_pendentes: reanalisa mesmo sem mudança (só com conversaIds). */
    forcar?: boolean;
    /** analisar_pendentes: inclui as já analisadas cuja conversa mudou depois. */
    incluirDesatualizadas?: boolean;
    instrucoes?: string;
    titulo?: string;
    url?: string;
    /** Reimporta e reanalisa só esta conversa (já gravada). */
    conversaId?: string;
  };
  const conversaIds = Array.isArray(corpo.conversaIds) ? corpo.conversaIds.filter((x) => typeof x === "string") : null;

  try {
    // ---- Assistente ----
    if (corpo.acao === "perguntar") {
      const pergunta = (corpo.pergunta ?? "").trim();
      if (!pergunta) return json({ error: "Faça uma pergunta." }, 400);
      const historico = (corpo.historico ?? []).slice(-6)
        .map((h) => `${h.papel === "usuario" ? "Usuário" : "Assistente"}: ${String(h.texto).slice(0, 2000)}`).join("\n");
      const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const diaSemana = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });

      const { data: consultoresRows } = await admin.from("comercial_conversas").select("atendente").not("atendente", "is", null).limit(5000);
      const consultores = [...new Set((consultoresRows ?? []).map((r) => r.atendente as string))];

      // 1) Entende a pergunta: período, origem, consultor.
      const plano = await chamarIA<{ inicio: string | null; fim: string | null; campo_data: string; origem: string | null; consultor: string | null; precisa_transcricoes: boolean }>(
        req, lovableKey,
        `Converta a pergunta em filtros. Hoje é ${hoje} (${diaSemana}), fuso de Brasília. "Ontem" = o dia anterior; "esta semana" = de segunda até hoje; "mês passado" = o mês calendário anterior. Sem período na pergunta (nem no histórico): últimos 30 dias. Consultores existentes: ${consultores.join(", ") || "nenhum"}.`,
        `${historico ? `Conversa até aqui:\n${historico}\n\n` : ""}Pergunta: ${pergunta}`,
        "plano_pergunta", SCHEMA_PLANO, "low",
      );
      if ("erro" in plano) return json({ error: `IA: ${plano.erro}` }, 502);
      const pl = plano.resultado;
      const per2 = periodo(pl.inicio ?? undefined, pl.fim ?? undefined) ?? periodo(
        new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), hoje)!;

      // 2) Carrega os dados do recorte.
      type Linha = {
        id: string; contato_nome: string | null; atendente: string | null; iniciada_em: string | null; ultima_mensagem_em: string | null;
        primeira_mensagem_cliente: string | null; origem_detectada: string | null; tempo_primeira_resposta_seg: number | null;
        cliente_sem_resposta: boolean | null; mensagens_sdr: number | null; mensagens_consultor: number | null;
        consultor_entrou_em: string | null; handoff_em: string | null; total_mensagens: number; transcricao_hash: string | null;
      };
      const colunas = "id, contato_nome, atendente, iniciada_em, ultima_mensagem_em, primeira_mensagem_cliente, origem_detectada, tempo_primeira_resposta_seg, cliente_sem_resposta, mensagens_sdr, mensagens_consultor, consultor_entrou_em, handoff_em, total_mensagens, transcricao_hash";
      let conversas: Linha[] = [];
      for (let de = 0; ; de += 1000) {
        let q = admin.from("comercial_conversas").select(colunas);
        q = pl.campo_data === "inicio_conversa"
          ? q.gte("iniciada_em", per2.inicioIso).lte("iniciada_em", per2.fimIso)
          : q.gte("ultima_mensagem_em", per2.inicioIso).lte("iniciada_em", per2.fimIso);
        const { data, error } = await q.order("iniciada_em", { ascending: false }).range(de, de + 999);
        if (error) throw new Error(error.message);
        conversas.push(...((data ?? []) as Linha[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      if (pl.consultor) conversas = conversas.filter((c) => c.atendente === pl.consultor);

      const { data: regras } = await admin.from("comercial_origens_regras").select("padrao, origem, campanha");
      const leadsVinc = new Map<string, { campanha: string | null; anuncio: string | null }>();
      for (let i = 0; i < conversas.length; i += 150) {
        const { data } = await admin.from("comercial_leads_meta").select("conversa_id, campanha, anuncio").in("conversa_id", conversas.slice(i, i + 150).map((c) => c.id));
        for (const l of data ?? []) leadsVinc.set(l.conversa_id as string, { campanha: l.campanha, anuncio: l.anuncio });
      }
      const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const origemDe = (c: Linha) => {
        const lead = leadsVinc.get(c.id);
        if (lead) return { origem: "meta", campanha: lead.campanha };
        const msg = normalizar(c.primeira_mensagem_cliente ?? "");
        const regra = (regras ?? []).find((r) => msg && msg.includes(normalizar(r.padrao)));
        return regra ? { origem: regra.origem as string, campanha: regra.campanha as string | null } : { origem: c.origem_detectada ?? "nao_identificada", campanha: null };
      };
      const comOrigem = conversas.map((c) => ({ c, ...origemDe(c) })).filter((x) => !pl.origem || x.origem === pl.origem);

      const ultimas = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < comOrigem.length; i += 150) {
        const { data } = await admin.from("comercial_analises")
          .select("conversa_id, criado_em, nota, nota_sdr, resultado, etapa_funil, resumo, objecoes, melhorias, proximo_passo, sdr")
          .in("conversa_id", comOrigem.slice(i, i + 150).map((x) => x.c.id)).order("criado_em", { ascending: false });
        for (const a of data ?? []) if (!ultimas.has(a.conversa_id)) ultimas.set(a.conversa_id, a);
      }

      // Leads do Meta que chegaram no período (inclusive os que nunca viraram conversa).
      const { data: leadsPeriodo } = await admin.from("comercial_leads_meta").select("campanha, conversa_id")
        .gte("lead_criado_em", per2.inicioIso).lte("lead_criado_em", per2.fimIso).limit(10000);

      const conta = <K extends string>(xs: K[]) => xs.reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {} as Record<string, number>);
      const notas = [...ultimas.values()].map((a) => a.nota as number | null).filter((n): n is number => n != null);
      const totais = {
        periodo: `${hora(per2.inicioIso)} a ${hora(per2.fimIso)}`,
        filtro_data: pl.campo_data,
        conversas: comOrigem.length,
        analisadas: ultimas.size,
        por_origem: conta(comOrigem.map((x) => x.origem)),
        por_campanha: conta(comOrigem.filter((x) => x.campanha).map((x) => x.campanha!)),
        por_consultor: conta(comOrigem.map((x) => x.c.atendente ?? "sem consultor (só SDR)")),
        por_resultado: conta([...ultimas.values()].map((a) => (a.resultado as string) ?? "indefinido")),
        nota_media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
        consultor_nao_assumiu: comOrigem.filter((x) => !x.c.mensagens_consultor).length,
        cliente_sem_resposta: comOrigem.filter((x) => x.c.cliente_sem_resposta).length,
        leads_meta_no_periodo: leadsPeriodo?.length ?? 0,
        leads_meta_sem_conversa: (leadsPeriodo ?? []).filter((l) => !l.conversa_id).length,
        leads_meta_por_campanha: conta((leadsPeriodo ?? []).map((l) => (l.campanha as string) ?? "(sem campanha)")),
      };
      const linhas = comOrigem.map(({ c, origem, campanha }) => {
        const a = ultimas.get(c.id);
        return JSON.stringify({
          id: c.id, cliente: c.contato_nome, inicio: hora(c.iniciada_em), ultima: hora(c.ultima_mensagem_em), origem, campanha,
          consultor: c.atendente, msgs: c.total_mensagens, msgs_sdr: c.mensagens_sdr, msgs_consultor: c.mensagens_consultor,
          consultor_assumiu: hora(c.consultor_entrou_em) || null,
          primeira_resposta_min: c.tempo_primeira_resposta_seg != null ? Math.round(c.tempo_primeira_resposta_seg / 60) : null,
          sem_resposta: c.cliente_sem_resposta, primeira_msg: (c.primeira_mensagem_cliente ?? "").slice(0, 120),
          analise: a ? {
            nota: a.nota, nota_sdr: a.nota_sdr, resultado: a.resultado, etapa: a.etapa_funil, resumo: a.resumo,
            objecoes: ((a.objecoes as { categoria?: string; foi_contornada?: boolean }[]) ?? []).map((o) => `${o.categoria}${o.foi_contornada ? "(contornada)" : ""}`),
            melhorias: ((a.melhorias as { titulo?: string }[]) ?? []).map((m) => m.titulo).slice(0, 4),
            proximo_passo: a.proximo_passo,
          } : "não analisada",
        });
      });
      let dados = linhas.join("\n");
      if (dados.length > MAX_CARACTERES_DIAGNOSTICO) dados = dados.slice(0, dados.lastIndexOf("\n", MAX_CARACTERES_DIAGNOSTICO)) + "\n(… lista cortada; use os totais)";

      let transcricoes = "";
      if (pl.precisa_transcricoes && comOrigem.length && comOrigem.length <= 15) {
        const { data } = await admin.from("comercial_conversas").select("id, contato_nome, transcricao").in("id", comOrigem.map((x) => x.c.id));
        transcricoes = (data ?? []).map((d) => `### ${d.contato_nome ?? d.id} (id ${d.id})\n${d.transcricao ?? ""}`).join("\n\n").slice(0, 120_000);
      }

      // 3) Responde.
      const resposta = await chamarIA<{ resposta: string; conversas_citadas: string[] }>(
        req, lovableKey, PROMPT_ASSISTENTE + `\nHoje é ${hoje} (${diaSemana}).`,
        `${historico ? `Conversa até aqui:\n${historico}\n\n` : ""}PERGUNTA: ${pergunta}\n\n` +
          `FILTRO APLICADO: ${JSON.stringify({ ...pl, periodo: totais.periodo })}\n\n` +
          `TOTAIS (calculados, confiáveis):\n${JSON.stringify(totais)}\n\nCONVERSAS (uma por linha):\n${dados || "(nenhuma)"}` +
          (transcricoes ? `\n\nTRANSCRIÇÕES:\n${transcricoes}` : ""),
        "resposta_assistente", SCHEMA_RESPOSTA,
      );
      if ("erro" in resposta) return json({ error: `IA: ${resposta.erro}` }, 502);
      return json({
        ok: true,
        resposta: resposta.resultado.resposta,
        conversas: (resposta.resultado.conversas_citadas ?? []).filter((id) => comOrigem.some((x) => x.c.id === id)).slice(0, 10),
        filtro: { ...pl, inicio: per2.inicioIso, fim: per2.fimIso, conversas: comOrigem.length },
        tokens: (plano.tokensEntrada ?? 0) + (plano.tokensSaida ?? 0) + (resposta.tokensEntrada ?? 0) + (resposta.tokensSaida ?? 0),
      });
    }

    // ---- JSON cru do Data Crazy de uma conversa (para conferir os campos) ----
    if (corpo.acao === "amostra_mensagens") {
      if (!corpo.conversaId) return json({ error: "Informe a conversa." }, 400);
      const bruto = await dcGet(`/api/v1/conversations/${corpo.conversaId}/messages?take=40&skip=0`, dcKey);
      const msgs = (extrairLista(bruto) as MensagemDC[])
        .filter((m) => m && !m.deletedAt)
        .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
      const compactas = msgs.map(compactar);
      const { papeis } = atribuirPapeis(compactas);
      return json({
        ok: true,
        atribuicao: compactas.map((m, i) => ({ quando: hora(m.t), papel: papeis[i].papel, nome: papeis[i].nome, atendente_dc: m.a, automacao: m.auto, texto: m.b.slice(0, 160) })),
        bruto: JSON.stringify(bruto, null, 2).slice(0, 40_000),
      });
    }

    // ---- Planilha Google em CSV (precisa estar compartilhada por link ou publicada) ----
    if (corpo.acao === "baixar_planilha") {
      const csvUrl = urlCsvGoogle(corpo.url ?? "");
      if (!csvUrl) return json({ error: "Link de planilha Google inválido." }, 400);
      const r = await fetch(csvUrl, { redirect: "follow" });
      const tipo = r.headers.get("content-type") ?? "";
      const texto = await r.text();
      if (!r.ok || tipo.includes("text/html")) {
        return json({ error: "A planilha não está acessível pelo link. Compartilhe como \"Qualquer pessoa com o link: leitor\" ou publique na Web, ou envie o arquivo CSV." }, 400);
      }
      if (texto.length > 15_000_000) return json({ error: "Planilha grande demais (máx. 15 MB)." }, 400);
      return json({ ok: true, csv: texto });
    }

    // ---- Liga os leads do Meta às conversas ----
    if (corpo.acao === "vincular_leads") {
      const leads = await todasAsLinhas<LeadLinha>(admin, "comercial_leads_meta", "id, chave, nome, telefone, email, lead_criado_em, vinculo_metodo");
      const conversas = await todasAsLinhas<ConversaVinculo>(admin, "comercial_conversas", "id, contato_nome, contato_telefone, iniciada_em, primeira_mensagem_em, emails");
      // Importações antigas não têm a coluna emails: procura na transcrição.
      const semEmails = conversas.filter((c) => c.emails == null);
      for (let i = 0; i < semEmails.length; i += 100) {
        const { data } = await admin.from("comercial_conversas").select("id, transcricao").in("id", semEmails.slice(i, i + 100).map((c) => c.id));
        for (const row of data ?? []) {
          const achados = ((row.transcricao as string | null) ?? "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g);
          const c = conversas.find((x) => x.id === row.id);
          if (c && achados) c.emails = [...new Set(achados)];
        }
      }
      const resultado = vincularLeads(leads, conversas);
      const agora = new Date().toISOString();
      for (let i = 0; i < resultado.length; i += 500) {
        const { error } = await admin.from("comercial_leads_meta")
          .upsert(resultado.slice(i, i + 500).map((r) => ({ ...r, vinculado_em: r.conversa_id ? agora : null })));
        if (error) throw new Error(`erro ao gravar vínculos (${error.message})`);
      }
      const conta = (m: string) => resultado.filter((r) => r.vinculo_metodo === m).length;
      return json({
        ok: true, leads: leads.length, vinculados: resultado.filter((r) => r.conversa_id).length,
        porMetodo: { telefone: conta("telefone"), email: conta("email"), nome_horario: conta("nome_horario"), horario: conta("horario") },
      });
    }

    // ---- Recalcula transcrição e papéis a partir das mensagens já gravadas ----
    if (corpo.acao === "recalcular") {
      let skip = Math.max(0, soNumeros(corpo.skip));
      let recalculadas = 0;
      while (Date.now() - inicioChamada < ORCAMENTO_RECALCULAR_MS) {
        const { data, error } = await admin.from("comercial_conversas").select("id, mensagens")
          .not("mensagens", "is", null).order("id").range(skip, skip + 49);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
          const campos = camposDasMensagens(row.mensagens as Msg[]);
          const { error: e2 } = await admin.from("comercial_conversas")
            .update({ ...campos, transcricao_hash: await sha256(campos.transcricao) }).eq("id", row.id);
          if (e2) throw new Error(e2.message);
          recalculadas++;
        }
        skip += data?.length ?? 0;
        if ((data?.length ?? 0) < 50) return json({ ok: true, terminou: true, proximoSkip: skip, recalculadas });
      }
      return json({ ok: true, terminou: false, proximoSkip: skip, recalculadas });
    }

    // ---- Reanálise de uma conversa ----
    if (corpo.conversaId && !corpo.acao) {
      const { data: gravada } = await admin.from("comercial_conversas").select("bruto").eq("id", corpo.conversaId).maybeSingle();
      if (!gravada) return json({ error: "Conversa não encontrada." }, 404);
      const linha = await importarConversa(admin, { ...(gravada.bruto as ConversaDC), id: corpo.conversaId }, dcKey);
      if (linha.transcricao.trim().length < MIN_CARACTERES_PARA_ANALISAR) return json({ ok: true, analisadas: 0 });
      await analisarConversa(admin, req, lovableKey, await blocoContexto(admin), linha);
      return json({ ok: true, analisadas: 1 });
    }

    const per = periodo(corpo.inicio, corpo.fim);
    if (!per && !conversaIds) return json({ error: "Informe o período (inicio e fim no formato AAAA-MM-DD) ou as conversas." }, 400);

    // ---- Importação (sem IA), em lotes com orçamento de tempo ----
    // A lista do Data Crazy vem da conversa mais recente para a mais antiga;
    // quando uma página inteira é anterior ao início do período, terminou.
    if (corpo.acao === "importar") {
      if (!per) return json({ error: "Informe o período." }, 400);
      let skip = Math.max(0, soNumeros(corpo.skip));
      let importadas = 0;
      let puladas = 0;
      let foraDoPeriodo = 0;
      const erros: string[] = [];
      try {
        while (Date.now() - inicioChamada < ORCAMENTO_IMPORTAR_MS) {
          const pagina = extrairLista(
            await dcGet(`/api/v1/conversations?take=${CONVERSAS_POR_PAGINA}&skip=${skip}&filter[openWindow]=all`, dcKey),
          ) as ConversaDC[];
          if (pagina.length === 0) return json({ ok: true, terminou: true, proximoSkip: skip, importadas, puladas, foraDoPeriodo, erros });

          const datas = pagina.map((c) => ms(c.lastMessageDate)).filter((d) => !Number.isNaN(d));
          if (datas.length === pagina.length && datas.every((d) => d < per.inicioMs)) {
            return json({ ok: true, terminou: true, proximoSkip: skip, importadas, puladas, foraDoPeriodo, erros });
          }

          const ids = pagina.map((c) => c.id).filter(Boolean);
          const { data: gravadas } = await admin.from("comercial_conversas")
            .select("id, ultima_mensagem_em, primeira_mensagem_em, mensagens_sdr").in("id", ids);
          const gravadasMap = new Map((gravadas ?? []).map((g) => [g.id as string, g]));

          let i = 0;
          for (; i < pagina.length; i++) {
            if (Date.now() - inicioChamada > ORCAMENTO_IMPORTAR_MS) break;
            const conv = pagina[i];
            if (!conv?.id) continue;
            const ultima = conv.lastMessageDate ?? conv.updatedAt ?? null;
            const comeco = conv.createdAt ?? ultima;
            if (ms(ultima) < per.inicioMs || ms(comeco) > per.fimMs) { foraDoPeriodo++; continue; }
            const g = gravadasMap.get(conv.id);
            // Já gravada, sem mensagem nova e no formato atual (mensagens_sdr só existe a partir dele).
            if (!corpo.reanalizar && !(corpo.atualizarTudo && g?.mensagens_sdr == null) && g && g.primeira_mensagem_em && ultima &&
              ms(g.ultima_mensagem_em) === ms(ultima)) { puladas++; continue; }
            try {
              await importarConversa(admin, conv, dcKey);
              importadas++;
            } catch (e) {
              if (e instanceof LimiteDataCrazy) throw e;
              erros.push(`${conv.contact?.name ?? conv.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          skip += i;
          if (i < pagina.length) break; // estourou o tempo no meio da página
          if (pagina.length < CONVERSAS_POR_PAGINA) {
            return json({ ok: true, terminou: true, proximoSkip: skip, importadas, puladas, foraDoPeriodo, erros });
          }
        }
        return json({ ok: true, terminou: false, proximoSkip: skip, importadas, puladas, foraDoPeriodo, erros });
      } catch (e) {
        if (e instanceof LimiteDataCrazy) {
          return json({ ok: true, terminou: false, proximoSkip: skip, importadas, puladas, foraDoPeriodo, erros, aguardarSeg: AGUARDAR_APOS_429_SEG });
        }
        throw e;
      }
    }

    // ---- Análise por IA (período ou seleção) ----
    if (corpo.acao === "analisar_pendentes") {
      // Só os hashes aqui; a transcrição (pesada) é lida na hora de analisar cada uma.
      type Linha = { id: string; transcricao_hash: string | null; atendente: string | null; contato_nome: string | null; total_mensagens: number };
      const colunas = "id, transcricao_hash, atendente, contato_nome, total_mensagens";
      const conversas = (conversaIds
        ? await conversasPorIds<Linha>(admin, colunas, conversaIds)
        : await conversasDoPeriodo<Linha>(admin, colunas, per!.inicioIso, per!.fimIso))
        .filter((c) => c.transcricao_hash && c.total_mensagens >= 2);
      const hashesAnalisados = new Map<string, Set<string>>();
      for (let i = 0; i < conversas.length; i += 150) {
        const { data } = await admin.from("comercial_analises").select("conversa_id, transcricao_hash")
          .in("conversa_id", conversas.slice(i, i + 150).map((c) => c.id));
        for (const a of data ?? []) {
          hashesAnalisados.set(a.conversa_id, (hashesAnalisados.get(a.conversa_id) ?? new Set()).add(a.transcricao_hash));
        }
      }
      const forcar = !!corpo.forcar && !!conversaIds;
      const pendentes = conversas.filter((c) => {
        if (forcar) return true;
        const hashes = hashesAnalisados.get(c.id);
        if (!hashes) return true; // nunca analisada
        return !!corpo.incluirDesatualizadas && !hashes.has(c.transcricao_hash!);
      });

      const contexto = await blocoContexto(admin);
      let analisadas = 0;
      let curtas = 0;
      const erros: string[] = [];
      const processados: string[] = [];
      let proxima = 0;
      // Só começa uma análise nova enquanto houver tempo para ela terminar.
      await Promise.all(Array.from({ length: ANALISES_EM_PARALELO }, async () => {
        while (proxima < pendentes.length && Date.now() - inicioChamada < ORCAMENTO_ANALISAR_MS) {
          const c = pendentes[proxima++];
          try {
            const { data: t } = await admin.from("comercial_conversas").select("transcricao").eq("id", c.id).maybeSingle();
            const transcricao = (t?.transcricao as string | null) ?? "";
            if (transcricao.trim().length < MIN_CARACTERES_PARA_ANALISAR) { curtas++; continue; }
            await analisarConversa(admin, req, lovableKey, contexto, { ...c, transcricao, transcricao_hash: c.transcricao_hash! });
            analisadas++;
          } catch (e) {
            erros.push(`${c.contato_nome ?? c.id}: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            processados.push(c.id);
          }
        }
      }));
      const restantes = pendentes.length - proxima;
      return json({ ok: true, analisadas, curtas, restantes, erros, processados, terminou: restantes === 0 });
    }

    // ---- Avaliação em conjunto (período inteiro, um vendedor, uma seleção) ----
    if (corpo.acao === "avaliar_conjunto" || corpo.acao === "diagnostico_geral") {
      type Linha = {
        id: string; atendente: string | null; contato_nome: string | null; origem_detectada: string | null; primeira_mensagem_cliente: string | null;
        tempo_primeira_resposta_seg: number | null; cliente_sem_resposta: boolean | null; transcricao_caracteres: number | null;
        iniciada_em: string | null;
      };
      const colunas = "id, atendente, contato_nome, origem_detectada, primeira_mensagem_cliente, tempo_primeira_resposta_seg, cliente_sem_resposta, transcricao_caracteres, iniciada_em";
      const conversas = conversaIds
        ? await conversasPorIds<Linha>(admin, colunas, conversaIds)
        : await conversasDoPeriodo<Linha>(admin, colunas, per!.inicioIso, per!.fimIso);
      if (!conversas.length) return json({ error: "Nenhuma conversa no conjunto." }, 400);

      const { data: regras } = await admin.from("comercial_origens_regras").select("padrao, origem, campanha");
      const { data: leads } = await admin.from("comercial_leads_meta").select("conversa_id, campanha").not("conversa_id", "is", null);
      const campanhaMeta = new Map((leads ?? []).map((l) => [l.conversa_id as string, l.campanha as string | null]));
      const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const origemDe = (c: Linha) => {
        if (campanhaMeta.has(c.id)) return `meta${campanhaMeta.get(c.id) ? ` (${campanhaMeta.get(c.id)})` : ""}`;
        const msg = normalizar(c.primeira_mensagem_cliente ?? "");
        const regra = (regras ?? []).find((r) => msg && msg.includes(normalizar(r.padrao)));
        return regra ? `${regra.origem}${regra.campanha ? ` (${regra.campanha})` : ""}` : c.origem_detectada ?? "nao_identificada";
      };

      // Cabe inteiro? Então a IA lê as transcrições (melhor avaliação); senão, as análises de cada conversa.
      const totalCaracteres = conversas.reduce((s, c) => s + (c.transcricao_caracteres ?? 0) + 150, 0);
      const modo = totalCaracteres <= MAX_CARACTERES_TRANSCRICOES_CONJUNTO ? "transcricoes" : "analises";
      let entrada = "";
      let usadas = 0;
      if (modo === "transcricoes") {
        const partes: string[] = [];
        for (let i = 0; i < conversas.length; i += 50) {
          const { data } = await admin.from("comercial_conversas").select("id, transcricao").in("id", conversas.slice(i, i + 50).map((c) => c.id));
          const mapa = new Map((data ?? []).map((d) => [d.id as string, d.transcricao as string | null]));
          for (const c of conversas.slice(i, i + 50)) {
            const t = mapa.get(c.id);
            if (!t?.trim()) continue;
            usadas++;
            partes.push(`### Conversa ${usadas} — cliente: ${c.contato_nome ?? "?"} — consultor: ${c.atendente ?? "não identificado"} — origem: ${origemDe(c)} — início: ${hora(c.iniciada_em)}\n${t}`);
          }
        }
        entrada = partes.join("\n\n");
      } else {
        const ultimas = new Map<string, Record<string, unknown>>();
        for (let i = 0; i < conversas.length; i += 150) {
          const { data } = await admin.from("comercial_analises")
            .select("conversa_id, criado_em, nota, resultado, etapa_funil, resumo, melhorias, objecoes, oportunidades_perdidas, nota_sdr, sdr")
            .in("conversa_id", conversas.slice(i, i + 150).map((c) => c.id))
            .order("criado_em", { ascending: false });
          for (const a of data ?? []) if (!ultimas.has(a.conversa_id)) ultimas.set(a.conversa_id, a);
        }
        if (ultimas.size === 0) return json({ error: "O conjunto é grande demais para ler as transcrições e nenhuma conversa dele foi analisada ainda. Analise as conversas primeiro ou selecione menos." }, 400);
        const linhas = conversas.filter((c) => ultimas.has(c.id)).map((c) => {
          const a = ultimas.get(c.id)!;
          return JSON.stringify({
            consultor: c.atendente, origem: origemDe(c), nota: a.nota, resultado: a.resultado, etapa: a.etapa_funil,
            resumo: a.resumo, melhorias: a.melhorias, objecoes: (a.objecoes as { categoria?: string; foi_contornada?: boolean; trecho_cliente?: string }[] ?? [])
              .map((o) => ({ categoria: o.categoria, contornada: o.foi_contornada, trecho: o.trecho_cliente })),
            oportunidades_perdidas: a.oportunidades_perdidas,
            nota_sdr: a.nota_sdr,
            sdr: a.sdr ? {
              handoff: (a.sdr as AnaliseSdr).handoff_feito,
              qualificado: (a.sdr as AnaliseSdr).lead_qualificado,
              catalogo: (a.sdr as AnaliseSdr).catalogo_enviado,
              violacoes: ((a.sdr as AnaliseSdr).violacoes ?? []).map((v) => v.regra),
              sugestoes: (a.sdr as AnaliseSdr).sugestoes_prompt,
            } : null,
            primeira_resposta_min: c.tempo_primeira_resposta_seg != null ? Math.round(c.tempo_primeira_resposta_seg / 60) : null,
            cliente_sem_resposta: c.cliente_sem_resposta,
          });
        });
        usadas = linhas.length;
        // Limite para caber no contexto e no tempo da função; corta as mais antigas.
        entrada = linhas.join("\n");
        if (entrada.length > MAX_CARACTERES_DIAGNOSTICO) {
          entrada = entrada.slice(0, entrada.lastIndexOf("\n", MAX_CARACTERES_DIAGNOSTICO));
          usadas = entrada.split("\n").length;
        }
      }

      const instrucoes = (corpo.instrucoes ?? "").trim();
      const escopoTexto = conversaIds
        ? `${conversas.length} conversas selecionadas`
        : `Período: ${corpo.inicio} a ${corpo.fim}, ${conversas.length} conversas`;
      const ia = await chamarIA<Record<string, unknown>>(
        req, lovableKey, PROMPT_DIAGNOSTICO + (await blocoContexto(admin)),
        `${escopoTexto}. ${modo === "transcricoes" ? `Transcrições completas de ${usadas} conversas` : `Análises de ${usadas} conversas`}.` +
          (instrucoes ? `\n\nINSTRUÇÕES DESTA AVALIAÇÃO (prioridade sobre o resto):\n${instrucoes}` : "") +
          `\n\n${entrada}`,
        "diagnostico_comercial", SCHEMA_DIAGNOSTICO,
      );
      if ("erro" in ia) return json({ error: `IA: ${ia.erro}` }, 502);
      const vendedores = [...new Set(conversas.map((c) => c.atendente).filter(Boolean))];
      const { data: salvo, error } = await admin.from("comercial_diagnosticos").insert({
        periodo_inicio: per ? corpo.inicio : null, periodo_fim: per ? corpo.fim : null,
        total_conversas: usadas, modelo: MODELO, conteudo: ia.resultado,
        titulo: (corpo.titulo ?? "").trim() || null,
        instrucoes: instrucoes || null,
        escopo: { selecao: !!conversaIds, conversas: conversas.length, vendedores, conversaIds: conversaIds?.slice(0, 2000) ?? null },
        modo,
        tokens_entrada: ia.tokensEntrada ?? null,
        tokens_saida: ia.tokensSaida ?? null,
      }).select().single();
      if (error) throw new Error(`erro ao gravar avaliação (${error.message})`);
      return json({ ok: true, diagnostico: salvo });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("analisar-conversas-comercial:", e);
    if (e instanceof LimiteDataCrazy) return json({ ok: false, aguardarSeg: AGUARDAR_APOS_429_SEG, error: e.message }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
