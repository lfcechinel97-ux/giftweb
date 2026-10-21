// ============= analisar-conversas-comercial =============
// Sincroniza conversas do Data Crazy (WhatsApp comercial) para
// public.comercial_conversas e gera a análise de IA em
// public.comercial_analises (nota, resultado, resumo, pontos fortes,
// melhorias, objeções, oportunidades perdidas e próximo passo).
//
// A análise usa o Lovable AI Gateway (/v1/responses, modelo padrão de
// chat, saída JSON com json_schema estrito, LOVABLE_API_KEY já injetada
// no projeto). Escrita via service role; a chamada exige sessão da
// equipe interna (admin_users), como nas demais funções administrativas.
// Rate limit da rota de conversas do Data Crazy: 20 req/min — por isso
// as buscas de mensagens são sequenciais com pausa entre elas.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
// Rota de conversas: 20 req/min — pausa entre chamadas de mensagens.
const PAUSA_ENTRE_CONVERSAS_MS = 3300;
const PAUSA_APOS_429_MS = 65_000;
const MAX_CARACTERES_TRANSCRICAO = 60_000;

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
  createdAt?: string;
  body?: string;
  received?: boolean;
  deletedAt?: string | null;
  attachments?: { fileName?: string; mimeType?: string }[];
  attendants?: { name?: string }[];
};

type AnaliseIA = {
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

// json_schema estrito para o /v1/responses: objeto na raiz, todas as
// propriedades em required, opcionais como nullable, sem additionalProperties.
const SCHEMA_ANALISE = {
  name: "analise_conversa",
  type: "object",
  strict: true,
  properties: {
    nota: { type: ["number", "null"], description: "Nota de 0 a 10 para o atendimento" },
    resultado: { type: ["string", "null"], description: "venda | em_andamento | perdida | sem_interesse | indefinido" },
    etapa_funil: { type: ["string", "null"], description: "Etapa atual do funil, em poucas palavras" },
    resumo: { type: ["string", "null"], description: "Resumo objetivo em 2 a 4 frases" },
    pontos_fortes: { type: ["array", "null"], items: { type: "string" } },
    melhorias: { type: ["array", "null"], items: { type: "string" } },
    objecoes: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: { objecao: { type: ["string", "null"] }, como_quebrar: { type: ["string", "null"] } },
        required: ["objecao", "como_quebrar"],
        additionalProperties: false,
      },
    },
    oportunidades_perdidas: { type: ["array", "null"], items: { type: "string" } },
    proximo_passo: { type: ["string", "null"], description: "Ação concreta e imediata do atendente" },
  },
  required: ["nota", "resultado", "etapa_funil", "resumo", "pontos_fortes", "melhorias", "objecoes", "oportunidades_perdidas", "proximo_passo"],
  additionalProperties: false,
} as const;

const PROMPT_SISTEMA = `Você é um auditor de atendimento comercial B2B da Gift Web Brindes (brindes personalizados: canecas, garrafas, camisetas, sacolas, kit corporativo etc.). Analise a transcrição de uma conversa de WhatsApp entre um cliente e um atendente/vendedor da equipe.

Avalie o atendimento do ponto de vista comercial: o atendente qualificou o cliente, apresentou bem os produtos, lidou com preço e prazo, conduziu para o pedido/orçamento? As mensagens "Cliente:" vêm do cliente e "Atendente:" do vendedor.

Não invente fatos que não estejam na transcrição. Se a transcrição for muito curta ou sem conteúdo comercial, use nota baixa e resultado "indefinido".`;

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

/** GET no Data Crazy com retry em 429 (limite de 20 req/min na rota de conversas). */
async function dcGet(caminho: string, apiKey: string): Promise<Response> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const resposta = await fetch(`${DC_BASE}${caminho}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (resposta.status === 429 && tentativa === 0) {
      await aguardar(PAUSA_APOS_429_MS);
      continue;
    }
    return resposta;
  }
  return await fetch(`${DC_BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
}

/** Monta a transcrição legível das mensagens: "Quem: mensagem". */
function montarTranscricao(mensagens: MensagemDC[]): { texto: string; total: number; atendente: string | null } {
  const ordenadas = (mensagens ?? [])
    .filter((m) => m && !m.deletedAt)
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  let atendente: string | null = null;
  const linhas = ordenadas.map((m) => {
    if (!atendente) {
      const nome = m.attendants?.find((a) => a?.name)?.name;
      if (nome) atendente = nome;
    }
    const quem = m.received ? "Cliente" : "Atendente";
    let texto = (m.body ?? "").trim();
    const anexos = (m.attachments ?? []).map((a) => a?.fileName || a?.mimeType).filter(Boolean);
    if (anexos.length > 0) texto += (texto ? " " : "") + `[anexo: ${anexos.join(", ")}]`;
    return `${quem}: ${texto}`;
  });
  let texto = linhas.join("\n");
  if (texto.length > MAX_CARACTERES_TRANSCRICAO) texto = texto.slice(0, MAX_CARACTERES_TRANSCRICAO);
  return { texto, total: ordenadas.length, atendente };
}

function extrairLista(dados: unknown): unknown[] {
  if (Array.isArray(dados)) return dados;
  if (dados && typeof dados === "object" && Array.isArray((dados as { data?: unknown }).data)) {
    return (dados as { data: unknown[] }).data;
  }
  return [];
}

function statusConversa(conv: ConversaDC): string {
  if (typeof conv.status === "string" && conv.status) return conv.status;
  if (conv.finished) return "finished";
  if (conv.lastMessageIsAutomation) return "automation";
  return "opened";
}

/** Chama o Lovable AI (/v1/responses, stream) e devolve a análise JSON + uso de tokens. */
async function analisarComIA(
  request: Request,
  transcricao: string,
  apiKey: string,
): Promise<{ analise: AnaliseIA; modelo: string; tokensEntrada?: number; tokensSaida?: number } | { erro: string }> {
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
          { role: "system", content: PROMPT_SISTEMA },
          { role: "user", content: `Analise a transcrição JSON abaixo da conversa:\n\n${transcricao}` },
        ],
        text: { format: { type: "json_schema", ...SCHEMA_ANALISE } },
      }),
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
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
            const itens = (finalizada.response as { output?: { content?: { text?: string }[] }[] }).output ?? [];
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
    const analise = JSON.parse(limpo) as AnaliseIA;
    const notaBruta = soNumeros(analise?.nota);
    analise.nota = notaBruta > 10 ? 10 : Math.round(notaBruta * 10) / 10;
    return { analise, modelo: MODELO, tokensEntrada, tokensSaida };
  } catch {
    return { erro: `IA devolveu texto fora do JSON: ${limpo.slice(0, 200)}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const dcKey = Deno.env.get("DATACRAZY_API_KEY") ?? "";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!dcKey) return json({ error: "DATACRAZY_API_KEY não configurada no projeto." }, 500);
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY não encontrada neste projeto." }, 500);

  // Só equipe interna (mesmo gate das demais funções administrativas).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: souInterno } = await admin.from("admin_users").select("id").eq("id", quem.user.id).maybeSingle();
  if (!souInterno) return json({ error: "Acesso restrito à equipe interna." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    openWindow?: "last24h" | "all";
    limite?: number;
    skip?: number;
    reanalizar?: boolean;
    debug?: boolean;
  };
  const openWindow = corpo.openWindow === "all" ? "all" : "last24h";
  const limite = Math.min(30, Math.max(1, soNumeros(corpo.limite) || 10));
  const skip = Math.max(0, soNumeros(corpo.skip));
  const reanalizar = corpo.reanalizar === true;

  // ---- Etapa 1: lista de conversas no Data Crazy ----
  // Filtros na API do Data Crazy usam sintaxe colchetada: filter[campo]=valor.
  let resposta: Response;
  try {
    resposta = await dcGet(`/api/v1/conversations?take=${limite}&skip=${skip}&filter[openWindow]=${openWindow}`, dcKey);
  } catch {
    return json({ error: "Não foi possível falar com o Data Crazy agora." }, 502);
  }
  if (!resposta.ok) {
    return json({ error: `Data Crazy recusou a busca de conversas: ${resposta.status} ${(await resposta.text()).slice(0, 200)}` }, 502);
  }
  const payloadDC = await resposta.json().catch(() => null);
  const conversas = extrairLista(payloadDC) as ConversaDC[];
  if (conversas.length === 0) {
    return json({
      ok: true, recebidas: 0, sincronizadas: 0, analisadas: 0, puladas: 0, erros: [],
      mensagem: "Nenhuma conversa no período consultado.",
    });
  }

  // ---- Etapa 2: sincroniza cada conversa e analisa quando mudou ----
  // Conversas já gravadas: pula as cuja última mensagem não mudou.
  const ids = conversas.map((c) => c.id).filter(Boolean);
  const { data: gravadas } = await admin
    .from("comercial_conversas")
    .select("id, ultima_mensagem_em, transcricao_hash")
    .in("id", ids.length > 0 ? ids : ["—"]);
  const gravadasMap = new Map((gravadas ?? []).map((g) => [g.id as string, g]));

  let sincronizadas = 0;
  let analisadas = 0;
  let puladas = 0;
  const erros: string[] = [];

  for (const conv of conversas) {
    if (!conv?.id) continue;
    try {
      const jaGravada = gravadasMap.get(conv.id);
      const ultimaConhecida = jaGravada?.ultima_mensagem_em ?? null;
      const ultimaNova = conv.lastMessageDate ?? null;
      const semMudanca = !reanalizar && jaGravada && !!ultimaConhecida && !!ultimaNova &&
        new Date(ultimaConhecida).getTime() === new Date(ultimaNova).getTime();

      if (semMudanca && jaGravada?.transcricao_hash) {
        puladas++;
        continue;
      }

      // Busca das mensagens (rota de conversas: 20 req/min → pausa entre chamadas).
      if (sincronizadas > 0) await aguardar(PAUSA_ENTRE_CONVERSAS_MS);
      const respMsg = await dcGet(`/api/v1/conversations/${conv.id}/messages?take=100`, dcKey);
      if (!respMsg.ok) {
        erros.push(`${conv.id}: Data Crazy recusou as mensagens (${respMsg.status})`);
        continue;
      }
  const payloadMsg = await respMsg.json().catch(() => null);
  if (corpo.debug) {
    const amostra = JSON.stringify(payloadMsg)?.slice(0, 1500) ?? "null";
    return json({ debug: true, conversaId: conv.id, tipo: typeof payloadMsg, chaves: payloadMsg && typeof payloadMsg === "object" ? Object.keys(payloadMsg) : null, amostra });
  }
  const mensagens = extrairLista(payloadMsg) as MensagemDC[];
      const { texto: transcricao, total, atendente } = montarTranscricao(mensagens);

      const linha = {
        id: conv.id,
        iniciada_em: conv.createdAt ?? null,
        atualizado_em: conv.updatedAt ?? new Date().toISOString(),
        ultima_mensagem_em: ultimaNova,
        contato_nome: conv.contact?.name ?? conv.name ?? null,
        contato_telefone: conv.contact?.contactId ?? null,
        atendente,
        canal: conv.contact?.platform ?? conv.instance?.platform ?? "WHATSAPP",
        status: statusConversa(conv),
        total_mensagens: total,
        transcricao,
        transcricao_hash: await sha256(transcricao),
        bruto: conv,
      };
      const { error: erroUpsert } = await admin.from("comercial_conversas").upsert(linha);
      if (erroUpsert) {
        erros.push(`${conv.id}: erro ao gravar conversa (${erroUpsert.message})`);
        continue;
      }
      sincronizadas++;

      // ---- Etapa 3: análise de IA (só quando a transcrição mudou) ----
      if (transcricao.trim().length < 40) continue;
      const { data: analiseAnterior } = await admin
        .from("comercial_analises")
        .select("id")
        .eq("conversa_id", conv.id)
        .eq("transcricao_hash", linha.transcricao_hash)
        .limit(1);
      if (!reanalizar && (analiseAnterior?.length ?? 0) > 0) continue;

      const resultadoIA = await analisarComIA(req, transcricao, lovableKey);
      if ("erro" in resultadoIA) {
        erros.push(`${conv.id}: IA (${resultadoIA.erro})`);
        continue;
      }
      const a = resultadoIA.analise;
      const lista = (v: unknown) => (Array.isArray(v) ? v : []);
      const { error: erroAnalise } = await admin.from("comercial_analises").insert({
        conversa_id: conv.id,
        transcricao_hash: linha.transcricao_hash,
        modelo: resultadoIA.modelo,
        nota: a.nota ?? null,
        resultado: a.resultado ?? "indefinido",
        etapa_funil: a.etapa_funil ?? null,
        resumo: a.resumo ?? null,
        pontos_fortes: lista(a.pontos_fortes),
        melhorias: lista(a.melhorias),
        objecoes: lista(a.objecoes),
        oportunidades_perdidas: lista(a.oportunidades_perdidas),
        proximo_passo: a.proximo_passo ?? null,
        tokens_entrada: resultadoIA.tokensEntrada ?? null,
        tokens_saida: resultadoIA.tokensSaida ?? null,
        bruto: a,
      });
      if (erroAnalise) {
        erros.push(`${conv.id}: erro ao gravar análise (${erroAnalise.message})`);
        continue;
      }
      analisadas++;
    } catch (e) {
      erros.push(`${conv.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({
    ok: true,
    recebidas: conversas.length,
    sincronizadas,
    analisadas,
    puladas,
    erros,
  });
});
