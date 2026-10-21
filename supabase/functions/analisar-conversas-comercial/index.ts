import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Análise das conversas do comercial. Puxa as conversas do Datacrazy
   (GET /conversations e GET /conversations/{id}/messages, Bearer token do
   secret DATACRAZY_API_TOKEN), monta a transcrição VENDEDOR/CLIENTE e manda
   para a IA via Lovable AI Gateway (LOVABLE_API_KEY, mesmo gateway do
   mockup) avaliar: nota, pontos fortes, melhorias, objeções e como
   quebrá-las, oportunidades perdidas e próximo passo. Grava tudo em
   comercial_conversas / comercial_analises. Só admin.

   Ações (corpo JSON):
     { acao: "diagnostico" }  -> devolve a resposta crua da API (1ª página +
                                 mensagens da 1ª conversa) para conferir os
                                 campos que o Datacrazy está mandando.
     { acao: "sincronizar", dias?: 7, limite?: 20, reanalisar?: false }
                              -> importa as conversas com mensagem nos
                                 últimos N dias e analisa as novas/alteradas.
     { acao: "analisar", conversaId }  -> reimporta e reanalisa uma conversa.

   O formato de resposta do Datacrazy não está fixado aqui de propósito: os
   leitores abaixo aceitam os nomes de campo mais comuns (data/items,
   body/text, fromMe/direction...) e o JSON cru fica salvo em "bruto". */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELO_PADRAO = "google/gemini-2.5-flash";
const POR_PAGINA = 50;
const MAX_PAGINAS = 20;
const CONCORRENCIA = 4;
// Conversa muito longa: a IA recebe só o final (onde a negociação fecha ou morre).
const MAX_CARACTERES_TRANSCRICAO = 60_000;
const MIN_MENSAGENS_PARA_ANALISAR = 4;

type Obj = Record<string, unknown>;

/** Primeiro valor não vazio entre vários caminhos ("contact.name", "lead.name"...). */
function pegar(o: unknown, ...caminhos: string[]): unknown {
  for (const caminho of caminhos) {
    let atual: unknown = o;
    for (const parte of caminho.split(".")) {
      if (atual == null || typeof atual !== "object") { atual = undefined; break; }
      atual = (atual as Obj)[parte];
    }
    if (atual !== undefined && atual !== null && atual !== "") return atual;
  }
  return undefined;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Como pegar(), mas pula valores que não viram texto (ex.: "text" ser um objeto { body }). */
function pegarTexto(o: unknown, ...caminhos: string[]): string {
  for (const caminho of caminhos) {
    const v = texto(pegar(o, caminho));
    if (v) return v;
  }
  return "";
}

function data(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(String(v));
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}

/** A lista pode vir como array puro ou embrulhada em data/items/results/messages. */
function lista(resposta: unknown): Obj[] {
  if (Array.isArray(resposta)) return resposta as Obj[];
  for (const chave of ["data", "items", "results", "messages", "conversations", "rows"]) {
    const v = (resposta as Obj | null)?.[chave];
    if (Array.isArray(v)) return v as Obj[];
    if (v && typeof v === "object") {
      const dentro = lista(v);
      if (dentro.length) return dentro;
    }
  }
  return [];
}

interface Conversa {
  id: string;
  iniciadaEm: string | null;
  ultimaMensagemEm: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  atendente: string | null;
  canal: string | null;
  status: string | null;
  bruto: Obj;
}

function lerConversa(c: Obj): Conversa | null {
  const id = pegarTexto(c, "id", "_id", "conversationId");
  if (!id) return null;
  return {
    id,
    iniciadaEm: data(pegar(c, "createdAt", "created_at", "startedAt")),
    ultimaMensagemEm: data(pegar(c, "lastMessageDate", "lastMessageAt", "lastMessage.createdAt", "updatedAt", "updated_at")),
    contatoNome: pegarTexto(c, "contact.name", "lead.name", "client.name", "name") || null,
    contatoTelefone: pegarTexto(c, "contact.phone", "contact.number", "lead.phone", "lead.rawPhone", "phone", "number") || null,
    atendente: pegarTexto(c, "attendant.name", "user.name", "assignedUser.name", "agent.name", "responsible.name", "attendantName") || null,
    canal: pegarTexto(c, "instance.name", "channel.name", "channel", "instanceName", "source") || null,
    status: pegarTexto(c, "status", "state") || null,
    bruto: c,
  };
}

interface Mensagem { quando: string | null; doVendedor: boolean; autor: string | null; texto: string; interna: boolean }

function lerMensagem(m: Obj): Mensagem | null {
  const tipo = pegarTexto(m, "type", "messageType", "mediaType").toLowerCase();
  let corpo = pegarTexto(m, "body", "text", "content", "message", "caption", "text.body");
  const transcricaoAudio = pegarTexto(m, "transcription", "audioTranscription", "media.transcription");
  if (transcricaoAudio) corpo = `[áudio] ${transcricaoAudio}`;
  if (!corpo && tipo && tipo !== "text" && tipo !== "chat") corpo = `[${tipo}]`;
  if (!corpo) return null;

  const direcao = pegarTexto(m, "direction", "origin", "sender.type", "senderType", "from").toLowerCase();
  const fromMe = pegar(m, "fromMe", "isFromMe", "sentByMe", "key.fromMe");
  const recebida = pegar(m, "received", "isReceived", "incoming");
  const doVendedor = typeof fromMe === "boolean" ? fromMe
    : typeof recebida === "boolean" ? !recebida
    : /^(out|outbound|outgoing|sent|agent|attendant|user|operator|bot)/.test(direcao);

  return {
    quando: data(pegar(m, "createdAt", "created_at", "timestamp", "date", "sentAt")),
    doVendedor,
    autor: pegarTexto(m, "attendant.name", "user.name", "sender.name", "author.name") || null,
    texto: corpo,
    interna: pegar(m, "isInternal", "internal") === true,
  };
}

function montarTranscricao(mensagens: Mensagem[]): string {
  const linhas = mensagens.map((m) => {
    const hora = m.quando ? m.quando.slice(0, 16).replace("T", " ") : "";
    const quem = m.interna ? "NOTA INTERNA" : m.doVendedor ? `VENDEDOR${m.autor ? ` (${m.autor})` : ""}` : "CLIENTE";
    return `[${hora}] ${quem}: ${m.texto}`;
  });
  let saida = linhas.join("\n");
  if (saida.length > MAX_CARACTERES_TRANSCRICAO) {
    saida = "[... início da conversa omitido ...]\n" + saida.slice(-MAX_CARACTERES_TRANSCRICAO);
  }
  return saida;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PROMPT_SISTEMA =
  "Você é um coordenador comercial sênior da Gift Web, empresa B2B de brindes personalizados (garrafas, " +
  "copos, canecas, mochilas, canetas, kits) com gravação a laser, DTF UV e DTF têxtil. A venda acontece por " +
  "WhatsApp: o cliente pede orçamento, o vendedor entende a necessidade (quantidade, prazo, evento, logo, " +
  "orçamento disponível), apresenta opções, manda mockup e orçamento, negocia e fecha o pedido.\n\n" +
  "Avalie a conversa abaixo como um gestor que quer treinar o vendedor. Seja específico e cite trechos reais " +
  "da conversa. Não invente nada que não esteja na conversa. Para cada objeção do cliente (preço, prazo, " +
  "quantidade mínima, frete, qualidade, 'vou pensar', concorrente, aprovação interna, sumiço etc.), diga como " +
  "o vendedor lidou e escreva uma resposta pronta, curta e natural para WhatsApp, que ele poderia ter usado " +
  "para quebrar a objeção. Em melhorias, foque no que mais aumentaria a chance de fechar: tempo de resposta, " +
  "perguntas de qualificação, condução para o próximo passo, gatilhos de urgência (prazo de produção, data do " +
  "evento), ancoragem de valor, follow-up. Responda em português do Brasil.";

/** Formato que a IA devolve (via tool call, que o gateway aceita para todos os modelos). */
const FERRAMENTA = {
  type: "function",
  function: {
    name: "registrar_analise",
    description: "Registra a análise da conversa comercial.",
    parameters: {
      type: "object",
      properties: {
        nota: { type: "number", description: "Nota de 0 a 10 para a condução do vendedor." },
        resultado: { type: "string", enum: ["venda", "em_andamento", "perdida", "sem_interesse", "indefinido"] },
        etapa_funil: { type: "string", description: "Ex.: primeiro contato, qualificação, orçamento enviado, negociação, fechado, pós-venda." },
        resumo: { type: "string", description: "2 a 4 frases: o que o cliente queria e como a conversa terminou." },
        pontos_fortes: { type: "array", items: { type: "string" } },
        melhorias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              detalhe: { type: "string", description: "O que aconteceu (com trecho) e o que fazer diferente." },
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
            },
            required: ["titulo", "detalhe", "prioridade"],
          },
        },
        objecoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              categoria: { type: "string", enum: ["preco", "prazo", "quantidade_minima", "frete", "qualidade", "confianca", "concorrente", "aprovacao_interna", "vou_pensar", "sumiu", "outra"] },
              trecho_cliente: { type: "string" },
              como_vendedor_lidou: { type: "string" },
              foi_contornada: { type: "boolean" },
              resposta_sugerida: { type: "string", description: "Mensagem pronta para WhatsApp." },
            },
            required: ["categoria", "trecho_cliente", "como_vendedor_lidou", "foi_contornada", "resposta_sugerida"],
          },
        },
        oportunidades_perdidas: { type: "array", items: { type: "string" }, description: "Upsell, kit, maior quantidade, prazo, recompra..." },
        proximo_passo: { type: "string", description: "Ação concreta que o vendedor deve fazer agora com este cliente." },
      },
      required: ["nota", "resultado", "etapa_funil", "resumo", "pontos_fortes", "melhorias", "objecoes", "oportunidades_perdidas", "proximo_passo"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const tokenDatacrazy = Deno.env.get("DATACRAZY_API_TOKEN") ?? "";
  const baseDatacrazy = (Deno.env.get("DATACRAZY_API_URL") ?? "https://api.g1.datacrazy.io/api/v1").replace(/\/+$/, "");
  const modelo = Deno.env.get("MODELO_ANALISE_COMERCIAL") || MODELO_PADRAO;
  if (!tokenDatacrazy) return json({ error: "Cadastre o secret DATACRAZY_API_TOKEN (Datacrazy → Configurações → Chaves de API)." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: ehAdmin } = await admin.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
  if (!ehAdmin) return json({ error: "Apenas administradores podem analisar conversas." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    acao?: "diagnostico" | "sincronizar" | "analisar";
    dias?: number; limite?: number; reanalisar?: boolean; conversaId?: string;
  };

  async function datacrazy(caminho: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const u = new URL(baseDatacrazy + caminho);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    const r = await fetch(u, { headers: { Authorization: `Bearer ${tokenDatacrazy}`, Accept: "application/json" } });
    const bruto = await r.text();
    if (!r.ok) throw new Error(`Datacrazy ${r.status} em ${caminho}: ${bruto.slice(0, 300)}`);
    try { return JSON.parse(bruto); } catch { throw new Error(`Datacrazy devolveu algo que não é JSON em ${caminho}.`); }
  }

  async function buscarMensagens(conversaId: string): Promise<{ mensagens: Mensagem[]; bruto: unknown }> {
    const bruto = await datacrazy(`/conversations/${encodeURIComponent(conversaId)}/messages`);
    const mensagens = lista(bruto).map(lerMensagem).filter((m): m is Mensagem => !!m);
    // A API pode mandar da mais nova para a mais antiga.
    mensagens.sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? ""));
    return { mensagens, bruto };
  }

  async function analisarComIA(conversa: Conversa, transcricao: string) {
    if (!lovableKey) throw new Error("LOVABLE_API_KEY não encontrada neste projeto.");
    const contexto = [
      conversa.contatoNome && `Cliente: ${conversa.contatoNome}`,
      conversa.atendente && `Vendedor responsável: ${conversa.atendente}`,
      conversa.canal && `Canal: ${conversa.canal}`,
    ].filter(Boolean).join("\n");
    const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: PROMPT_SISTEMA },
          { role: "user", content: `${contexto}\n\nCONVERSA:\n${transcricao}` },
        ],
        tools: [FERRAMENTA],
        tool_choice: { type: "function", function: { name: "registrar_analise" } },
      }),
    });
    const textoBruto = await resposta.text();
    if (resposta.status === 429) throw new Error("Limite de requisições da IA atingido, tente de novo em instantes.");
    if (resposta.status === 402) throw new Error("Créditos de IA do workspace Lovable esgotados.");
    if (!resposta.ok) throw new Error(`IA recusou (${resposta.status}): ${textoBruto.slice(0, 300)}`);
    const dados = JSON.parse(textoBruto);
    const msg = dados?.choices?.[0]?.message;
    const args = msg?.tool_calls?.[0]?.function?.arguments ?? msg?.content ?? "";
    const analise = typeof args === "string"
      ? JSON.parse(args.replace(/^```(?:json)?\s*|\s*```$/g, ""))
      : args;
    return { analise, uso: dados?.usage ?? null };
  }

  /** Importa uma conversa e, se mudou desde a última análise (ou se forçado), analisa. */
  async function processar(conversa: Conversa, forcar: boolean): Promise<"analisada" | "sem_mudanca" | "curta"> {
    const { mensagens } = await buscarMensagens(conversa.id);
    const transcricao = montarTranscricao(mensagens);
    const hash = await sha256(transcricao);
    const doVendedor = mensagens.filter((m) => m.doVendedor && !m.interna);
    if (!conversa.atendente) conversa.atendente = doVendedor.find((m) => m.autor)?.autor ?? null;
    if (!conversa.ultimaMensagemEm) conversa.ultimaMensagemEm = mensagens.at(-1)?.quando ?? null;

    const { error: erroConversa } = await admin.from("comercial_conversas").upsert({
      id: conversa.id,
      atualizado_em: new Date().toISOString(),
      iniciada_em: conversa.iniciadaEm ?? mensagens[0]?.quando ?? null,
      ultima_mensagem_em: conversa.ultimaMensagemEm,
      contato_nome: conversa.contatoNome,
      contato_telefone: conversa.contatoTelefone,
      atendente: conversa.atendente,
      canal: conversa.canal,
      status: conversa.status,
      total_mensagens: mensagens.length,
      transcricao,
      transcricao_hash: hash,
      bruto: conversa.bruto,
    });
    if (erroConversa) throw new Error(`Falha ao salvar conversa: ${erroConversa.message}`);

    const temCliente = mensagens.some((m) => !m.doVendedor);
    if (mensagens.length < MIN_MENSAGENS_PARA_ANALISAR || !doVendedor.length || !temCliente) return "curta";

    if (!forcar) {
      const { data: ultima } = await admin.from("comercial_analises").select("transcricao_hash")
        .eq("conversa_id", conversa.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      if (ultima?.transcricao_hash === hash) return "sem_mudanca";
    }

    const { analise: a, uso } = await analisarComIA(conversa, transcricao);
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const nota = Number(a?.nota);
    const { error: erroAnalise } = await admin.from("comercial_analises").insert({
      conversa_id: conversa.id,
      transcricao_hash: hash,
      modelo,
      nota: Number.isFinite(nota) ? Math.min(10, Math.max(0, nota)) : null,
      resultado: texto(a?.resultado) || null,
      etapa_funil: texto(a?.etapa_funil) || null,
      resumo: texto(a?.resumo) || null,
      pontos_fortes: arr(a?.pontos_fortes),
      melhorias: arr(a?.melhorias),
      objecoes: arr(a?.objecoes),
      oportunidades_perdidas: arr(a?.oportunidades_perdidas),
      proximo_passo: texto(a?.proximo_passo) || null,
      tokens_entrada: uso?.prompt_tokens ?? null,
      tokens_saida: uso?.completion_tokens ?? null,
      bruto: a,
    });
    if (erroAnalise) throw new Error(`Falha ao salvar análise: ${erroAnalise.message}`);
    return "analisada";
  }

  try {
    if (corpo.acao === "diagnostico") {
      const pagina = await datacrazy("/conversations", { skip: 0, take: 3 });
      const primeira = lista(pagina)[0];
      const id = primeira ? pegarTexto(primeira, "id", "_id", "conversationId") : "";
      const mensagens = id ? await datacrazy(`/conversations/${encodeURIComponent(id)}/messages`) : null;
      const cortar = (v: unknown) => JSON.stringify(v, null, 2).slice(0, 15_000);
      return json({
        conversas: cortar(pagina),
        mensagens: mensagens ? cortar(mensagens) : null,
        leitura: primeira ? { conversa: lerConversa(primeira), mensagens: lista(mensagens).slice(0, 5).map(lerMensagem) } : null,
      });
    }

    if (corpo.acao === "analisar") {
      if (!corpo.conversaId) return json({ error: "Informe a conversa." }, 400);
      const { data: salva } = await admin.from("comercial_conversas").select("*").eq("id", corpo.conversaId).maybeSingle();
      if (!salva) return json({ error: "Conversa não encontrada." }, 404);
      const conversa: Conversa = {
        id: salva.id, iniciadaEm: salva.iniciada_em, ultimaMensagemEm: salva.ultima_mensagem_em,
        contatoNome: salva.contato_nome, contatoTelefone: salva.contato_telefone, atendente: salva.atendente,
        canal: salva.canal, status: salva.status, bruto: salva.bruto ?? {},
      };
      const status = await processar(conversa, true);
      return json({ ok: true, status });
    }

    // Sincronizar: pagina a lista até passar da janela de datas (ou do limite de páginas).
    const dias = Math.min(90, Math.max(1, Math.round(Number(corpo.dias) || 7)));
    const limite = Math.min(40, Math.max(1, Math.round(Number(corpo.limite) || 20)));
    const corte = new Date(Date.now() - dias * 86_400_000).toISOString();
    const vistas = new Map<string, Conversa>();
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const pagina = lista(await datacrazy("/conversations", { skip: p * POR_PAGINA, take: POR_PAGINA }));
      const novas = pagina.map(lerConversa).filter((c): c is Conversa => !!c && !vistas.has(c.id));
      // Página repetida = a API ignorou a paginação; não adianta continuar.
      if (!novas.length) break;
      for (const c of novas) vistas.set(c.id, c);
      if (pagina.length < POR_PAGINA) break;
      const datas = novas.map((c) => c.ultimaMensagemEm).filter((d): d is string => !!d);
      if (datas.length === novas.length && datas.every((d) => d < corte)) break;
    }

    const candidatas = [...vistas.values()]
      .filter((c) => !c.ultimaMensagemEm || c.ultimaMensagemEm >= corte)
      .sort((a, b) => (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? ""))
      .slice(0, limite);

    const contagem = { encontradas: vistas.size, processadas: 0, analisadas: 0, sem_mudanca: 0, curtas: 0, erros: [] as string[] };
    let proxima = 0;
    await Promise.all(Array.from({ length: CONCORRENCIA }, async () => {
      while (proxima < candidatas.length) {
        const c = candidatas[proxima++];
        try {
          const status = await processar(c, !!corpo.reanalisar);
          contagem.processadas++;
          if (status === "analisada") contagem.analisadas++;
          else if (status === "sem_mudanca") contagem.sem_mudanca++;
          else contagem.curtas++;
        } catch (e) {
          contagem.erros.push(`${c.contatoNome ?? c.id}: ${(e as Error).message}`);
        }
      }
    }));
    return json({ ok: true, ...contagem });
  } catch (e) {
    console.error("analisar-conversas-comercial:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
