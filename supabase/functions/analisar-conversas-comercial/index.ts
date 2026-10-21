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
//   { acao: "diagnostico_geral", inicio, fim } -> síntese da IA sobre as
//       análises do período (pontos fracos recorrentes, por vendedor...).
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

O atendimento tem duas etapas: primeiro o "SDR" (Felipe, uma IA de pré-venda) qualifica o lead e manda o "Resumo do projeto"; depois o "Consultor" (vendedor humano) faz a prévia, o orçamento e fecha. As mensagens "Cliente:" vêm do cliente, "SDR:" da IA e "Consultor:" do vendedor humano; o horário vem entre colchetes -- use-o para avaliar o tempo de resposta. Se uma mensagem vier marcada só como "Atendente:", decida pelo contexto se foi o SDR ou o consultor.

Os campos nota, resultado, melhorias, objeções, oportunidades perdidas e próximo passo avaliam o CONSULTOR humano (o fechamento) -- se a conversa não chegou ao consultor, avalie a conversa como um todo e diga nas melhorias o que impediu a passagem. Os campos nota_sdr e sdr avaliam o SDR de IA contra as regras do prompt dele (abaixo): cada regra quebrada vira uma violação com o trecho e a mensagem correta; em sugestoes_prompt, proponha mudanças objetivas no prompt (o que acrescentar, tirar ou reescrever) que teriam evitado os problemas.

Seja específico e cite trechos reais. Para cada objeção do cliente (preço, prazo, quantidade mínima, frete, qualidade, "vou pensar", concorrente, aprovação interna, cliente que sumiu etc.), diga como o atendente lidou, se ela foi contornada, e escreva uma resposta curta e natural para WhatsApp que ele poderia ter usado para quebrá-la. Nas melhorias, priorize o que mais aumenta a chance de fechar: tempo de resposta, perguntas de qualificação (quantidade, data do evento, logo, orçamento), condução para o próximo passo, urgência pelo prazo de produção, ancoragem de valor e follow-up.

Não invente fatos que não estejam na transcrição. Se a transcrição for muito curta ou sem conteúdo comercial, use nota baixa e resultado "indefinido".`;

const SCHEMA_DIAGNOSTICO = {
  type: "object",
  properties: {
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
  required: ["resumo_geral", "pontos_fracos", "por_vendedor", "por_origem", "scripts_recomendados", "acoes_prioritarias", "prompt_sdr"],
  additionalProperties: false,
} as const;

const PROMPT_DIAGNOSTICO = `Você é o gestor comercial da Gift Web Brindes (brindes personalizados B2B, venda por WhatsApp). Abaixo estão as análises individuais das conversas do período (uma por linha, em JSON compacto) e métricas objetivas de atendimento. Faça um diagnóstico do time: quais pontos estão deixando a desejar com mais frequência e mais impacto em vendas, o que cada vendedor precisa melhorar, diferenças entre origens do lead (Google, Meta etc.), mensagens-modelo para as situações mais problemáticas e as ações prioritárias para a próxima semana. Baseie-se só nos dados; cite números quando houver.

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

const hora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const nomeAtendente = (m: MensagemDC) =>
  (m as { attendant?: { name?: string } }).attendant?.name ?? m.attendants?.find((a) => a?.name)?.name ?? null;

/** Mensagem marcada como automação/bot pelo Data Crazy (nome do campo não confirmado: aceita os comuns). */
const ehAutomacao = (m: MensagemDC) => {
  const o = m as Record<string, unknown>;
  return ["isAutomation", "automation", "fromAutomation", "isBot", "bot", "isAi", "fromAi"].some((k) => o[k] === true);
};

/** A mensagem "Resumo do projeto" do SDR dispara a transferência para o consultor. */
const ehResumoSdr = (m: MensagemDC) => !m.received && /resumo do projeto/i.test(m.body ?? "");

/**
 * Monta a transcrição legível: "[dd/mm hh:mm] Quem: mensagem", separando o
 * SDR de IA do consultor humano. Até o "Resumo do projeto", mensagem enviada
 * sem atendente identificado (ou marcada como automação) é do SDR; mensagem
 * com atendente é do consultor.
 */
function montarTranscricao(ordenadas: MensagemDC[]): { texto: string; atendente: string | null } {
  let atendente: string | null = null;
  let passouParaConsultor = false;
  const linhas = ordenadas.map((m) => {
    const nome = m.received ? null : nomeAtendente(m);
    if (nome && !atendente) atendente = nome;
    let quem = "Cliente";
    if (!m.received) {
      if (ehAutomacao(m) || (!nome && !passouParaConsultor)) quem = "SDR";
      else quem = nome ? `Consultor (${nome})` : "Consultor";
      if (ehResumoSdr(m)) passouParaConsultor = true;
    }
    let texto = (m.body ?? "").trim();
    const anexos = (m.attachments ?? []).map((a) => a?.fileName || a?.mimeType).filter(Boolean);
    if (anexos.length > 0) texto += (texto ? " " : "") + `[anexo: ${anexos.join(", ")}]`;
    return `[${hora(m.createdAt)}] ${quem}: ${texto}`;
  });
  let texto = linhas.join("\n");
  // Conversa longa: a negociação fecha (ou morre) no final -- guarda o final.
  if (texto.length > MAX_CARACTERES_TRANSCRICAO) texto = texto.slice(-MAX_CARACTERES_TRANSCRICAO);
  return { texto, atendente };
}

/** Métricas objetivas: tempo até a 1ª resposta, mediana das respostas e se o cliente ficou sem resposta. */
function metricasAtendimento(ordenadas: MensagemDC[]) {
  const tempos: number[] = [];
  let aguardandoDesde: number | null = null;
  for (const m of ordenadas) {
    const t = new Date(m.createdAt ?? 0).getTime();
    if (!t) continue;
    if (m.received) {
      if (aguardandoDesde == null) aguardandoDesde = t;
    } else if (aguardandoDesde != null) {
      tempos.push(Math.round((t - aguardandoDesde) / 1000));
      aguardandoDesde = null;
    }
  }
  const ordenados = [...tempos].sort((a, b) => a - b);
  return {
    tempo_primeira_resposta_seg: tempos[0] ?? null,
    tempo_mediano_resposta_seg: ordenados.length ? ordenados[Math.floor(ordenados.length / 2)] : null,
    cliente_sem_resposta: aguardandoDesde != null,
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
        reasoning: { effort: "medium", summary: "auto" },
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
  const mensagens = await buscarMensagens(conv.id, dcKey);
  const { texto: transcricao, atendente } = montarTranscricao(mensagens);
  const primeiraCliente = mensagens.find((m) => m.received);
  const linha = {
    id: conv.id,
    iniciada_em: conv.createdAt ?? mensagens[0]?.createdAt ?? null,
    atualizado_em: conv.updatedAt ?? new Date().toISOString(),
    ultima_mensagem_em: conv.lastMessageDate ?? mensagens.at(-1)?.createdAt ?? null,
    contato_nome: conv.contact?.name ?? conv.name ?? null,
    contato_telefone: conv.contact?.contactId ?? null,
    atendente,
    canal: conv.contact?.platform ?? conv.instance?.platform ?? "WHATSAPP",
    status: statusConversa(conv),
    total_mensagens: mensagens.length,
    transcricao,
    transcricao_hash: await sha256(transcricao),
    bruto: conv,
    primeira_mensagem_cliente: primeiraCliente?.body?.trim() || null,
    primeira_mensagem_em: primeiraCliente?.createdAt ?? null,
    primeira_mensagem_bruto: primeiraCliente ?? null,
    origem_detectada: detectarOrigem(conv, primeiraCliente),
    ...metricasAtendimento(mensagens),
  };
  const { error } = await admin.from("comercial_conversas").upsert(linha);
  if (error) throw new Error(`erro ao gravar conversa (${error.message})`);
  return linha;
}

/** Prompt atual do SDR de IA (salvo na tela /whatsapp), anexado às instruções da análise. */
async function blocoPromptSdr(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("comercial_configuracoes").select("valor").eq("chave", "prompt_sdr").maybeSingle();
  const prompt = (data?.valor ?? "").trim();
  return prompt
    ? `\n\nPROMPT ATUAL DO SDR DE IA (as regras que ele deveria seguir):\n<prompt_sdr>\n${prompt}\n</prompt_sdr>`
    : "\n\n(O prompt do SDR não foi cadastrado: avalie o SDR por boas práticas de pré-venda.)";
}

/** Analisa por IA uma conversa já gravada e salva em comercial_analises. */
async function analisarConversa(
  admin: SupabaseClient,
  req: Request,
  lovableKey: string,
  promptSdr: string,
  c: { id: string; transcricao: string; transcricao_hash: string; atendente: string | null; contato_nome: string | null },
) {
  const contexto = [c.contato_nome && `Cliente: ${c.contato_nome}`, c.atendente && `Atendente responsável: ${c.atendente}`]
    .filter(Boolean).join("\n");
  const ia = await chamarIA<AnaliseIA>(
    req, lovableKey, PROMPT_SISTEMA + promptSdr,
    `${contexto}\n\nAnalise a transcrição abaixo da conversa:\n\n${c.transcricao}`,
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
    acao?: "importar" | "analisar_pendentes" | "diagnostico_geral";
    inicio?: string;
    fim?: string;
    skip?: number;
    reanalizar?: boolean;
    /** Reimporta e reanalisa só esta conversa (já gravada). */
    conversaId?: string;
  };

  try {
    // ---- Reanálise de uma conversa ----
    if (corpo.conversaId) {
      const { data: gravada } = await admin.from("comercial_conversas").select("bruto").eq("id", corpo.conversaId).maybeSingle();
      if (!gravada) return json({ error: "Conversa não encontrada." }, 404);
      const linha = await importarConversa(admin, { ...(gravada.bruto as ConversaDC), id: corpo.conversaId }, dcKey);
      if (linha.transcricao.trim().length < MIN_CARACTERES_PARA_ANALISAR) return json({ ok: true, analisadas: 0 });
      await analisarConversa(admin, req, lovableKey, await blocoPromptSdr(admin), linha);
      return json({ ok: true, analisadas: 1 });
    }

    const per = periodo(corpo.inicio, corpo.fim);
    if (!per) return json({ error: "Informe o período (inicio e fim no formato AAAA-MM-DD)." }, 400);

    // ---- Importação (sem IA), em lotes com orçamento de tempo ----
    // A lista do Data Crazy vem da conversa mais recente para a mais antiga;
    // quando uma página inteira é anterior ao início do período, terminou.
    if (corpo.acao === "importar") {
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
            .select("id, ultima_mensagem_em, primeira_mensagem_em").in("id", ids);
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
            // Já gravada, sem mensagem nova e com os campos da importação atual.
            if (!corpo.reanalizar && g && g.primeira_mensagem_em && ultima &&
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

    // ---- Análise por IA das conversas do período que mudaram ----
    if (corpo.acao === "analisar_pendentes") {
      // Só os hashes aqui; a transcrição (pesada) é lida na hora de analisar cada uma.
      type Linha = { id: string; transcricao_hash: string | null; atendente: string | null; contato_nome: string | null; total_mensagens: number };
      const conversas = (await conversasDoPeriodo<Linha>(admin, "id, transcricao_hash, atendente, contato_nome, total_mensagens", per.inicioIso, per.fimIso))
        .filter((c) => c.transcricao_hash && c.total_mensagens >= 2);
      const analisadasHash = new Set<string>();
      for (let i = 0; i < conversas.length; i += 200) {
        const { data } = await admin.from("comercial_analises").select("conversa_id, transcricao_hash")
          .in("conversa_id", conversas.slice(i, i + 200).map((c) => c.id));
        for (const a of data ?? []) analisadasHash.add(`${a.conversa_id}|${a.transcricao_hash}`);
      }
      const pendentes = conversas.filter((c) => !analisadasHash.has(`${c.id}|${c.transcricao_hash}`));

      const promptSdr = await blocoPromptSdr(admin);
      let analisadas = 0;
      let curtas = 0;
      const erros: string[] = [];
      let proxima = 0;
      // Só começa uma análise nova enquanto houver tempo para ela terminar.
      await Promise.all(Array.from({ length: ANALISES_EM_PARALELO }, async () => {
        while (proxima < pendentes.length && Date.now() - inicioChamada < ORCAMENTO_ANALISAR_MS) {
          const c = pendentes[proxima++];
          try {
            const { data: t } = await admin.from("comercial_conversas").select("transcricao").eq("id", c.id).maybeSingle();
            const transcricao = (t?.transcricao as string | null) ?? "";
            if (transcricao.trim().length < MIN_CARACTERES_PARA_ANALISAR) { curtas++; continue; }
            await analisarConversa(admin, req, lovableKey, promptSdr, { ...c, transcricao, transcricao_hash: c.transcricao_hash! });
            analisadas++;
          } catch (e) {
            erros.push(`${c.contato_nome ?? c.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }));
      const restantes = pendentes.length - proxima;
      return json({ ok: true, analisadas, curtas, restantes, erros, terminou: restantes === 0 });
    }

    // ---- Diagnóstico geral do período ----
    if (corpo.acao === "diagnostico_geral") {
      type Linha = {
        id: string; atendente: string | null; origem_detectada: string | null; primeira_mensagem_cliente: string | null;
        tempo_primeira_resposta_seg: number | null; tempo_mediano_resposta_seg: number | null; cliente_sem_resposta: boolean | null;
      };
      const conversas = await conversasDoPeriodo<Linha>(admin,
        "id, atendente, origem_detectada, primeira_mensagem_cliente, tempo_primeira_resposta_seg, tempo_mediano_resposta_seg, cliente_sem_resposta",
        per.inicioIso, per.fimIso);
      const { data: regras } = await admin.from("comercial_origens_regras").select("padrao, origem, campanha");
      const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const origemDe = (c: Linha) => {
        const msg = normalizar(c.primeira_mensagem_cliente ?? "");
        const regra = (regras ?? []).find((r) => msg && msg.includes(normalizar(r.padrao)));
        return regra ? `${regra.origem}${regra.campanha ? ` (${regra.campanha})` : ""}` : c.origem_detectada ?? "nao_identificada";
      };

      const ultimas = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < conversas.length; i += 200) {
        const { data } = await admin.from("comercial_analises")
          .select("conversa_id, criado_em, nota, resultado, etapa_funil, resumo, melhorias, objecoes, oportunidades_perdidas, nota_sdr, sdr")
          .in("conversa_id", conversas.slice(i, i + 200).map((c) => c.id))
          .order("criado_em", { ascending: false });
        for (const a of data ?? []) if (!ultimas.has(a.conversa_id)) ultimas.set(a.conversa_id, a);
      }
      if (ultimas.size === 0) return json({ error: "Nenhuma conversa analisada no período." }, 400);

      const linhas = conversas.filter((c) => ultimas.has(c.id)).map((c) => {
        const a = ultimas.get(c.id)!;
        return JSON.stringify({
          vendedor: c.atendente, origem: origemDe(c), nota: a.nota, resultado: a.resultado, etapa: a.etapa_funil,
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
      // Limite para caber no contexto e no tempo da função; as linhas vêm da
      // conversa mais recente para a mais antiga, então corta as mais antigas.
      let entrada = linhas.join("\n");
      if (entrada.length > MAX_CARACTERES_DIAGNOSTICO) entrada = entrada.slice(0, entrada.lastIndexOf("\n", MAX_CARACTERES_DIAGNOSTICO));

      const ia = await chamarIA<Record<string, unknown>>(
        req, lovableKey, PROMPT_DIAGNOSTICO + (await blocoPromptSdr(admin)),
        `Período: ${corpo.inicio} a ${corpo.fim}. ${linhas.length} conversas analisadas.\n\n${entrada}`,
        "diagnostico_comercial", SCHEMA_DIAGNOSTICO,
      );
      if ("erro" in ia) return json({ error: `IA: ${ia.erro}` }, 502);
      const { data: salvo, error } = await admin.from("comercial_diagnosticos").insert({
        periodo_inicio: corpo.inicio, periodo_fim: corpo.fim, total_conversas: linhas.length, modelo: MODELO, conteudo: ia.resultado,
      }).select().single();
      if (error) throw new Error(`erro ao gravar diagnóstico (${error.message})`);
      return json({ ok: true, diagnostico: salvo });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("analisar-conversas-comercial:", e);
    if (e instanceof LimiteDataCrazy) return json({ ok: false, aguardarSeg: AGUARDAR_APOS_429_SEG, error: e.message }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
