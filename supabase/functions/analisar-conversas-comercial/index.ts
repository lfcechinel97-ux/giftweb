// ============= analisar-conversas-comercial =============
// Importa as conversas do Data Crazy (WhatsApp comercial) para
// public.comercial_conversas: transcrição com quem mandou cada mensagem
// (cliente, SDR de IA ou consultor), métricas de atendimento e a origem do
// lead. NÃO usa IA (a análise por IA foi removida por custo).
// Só admin ou gerente (is_gestor), como as tabelas.
//
// Tudo é feito em LOTES com orçamento de tempo (a edge function tem limite
// de wall-clock): a página /whatsapp chama em sequência até terminar.
//   { acao: "importar", inicio, fim, skip, atualizarTudo? } -> importa as
//       conversas com atividade no período; devolve proximoSkip/terminou.
//   { acao: "recalcular", skip } -> refaz transcrição/papéis a partir das
//       mensagens já gravadas (sem Data Crazy).
//   { acao: "amostra_mensagens", conversaId } -> JSON cru do Data Crazy.
//   { acao: "baixar_planilha", url } -> CSV de uma planilha Google.
//   { acao: "vincular_leads" } -> liga leads do Meta às conversas.
//   { conversaId } -> reimporta uma conversa do Data Crazy.
// Rate limit da rota de conversas do Data Crazy: 20 req/min -- toda
// chamada passa pelo dcGet, que espaça as requisições; num 429 a função
// devolve aguardarSeg para a página esperar antes do próximo lote.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DC_BASE = "https://api.g1.datacrazy.io";
// 20 req/min na rota de conversas -> uma requisição a cada ~3,1s.
const INTERVALO_DC_MS = 3100;
const AGUARDAR_APOS_429_SEG = 65;
const MAX_CARACTERES_TRANSCRICAO = 60_000;
const CONVERSAS_POR_PAGINA = 50;
const MENSAGENS_POR_PAGINA = 100;
const MAX_PAGINAS_MENSAGENS = 5;
// Orçamento de tempo por chamada (o limite da edge function é maior; a
// folga cobre a última requisição em andamento).
const ORCAMENTO_IMPORTAR_MS = 90_000;
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

class LimiteDataCrazy extends Error {}

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const inicioChamada = Date.now();

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const dcKey = Deno.env.get("DATACRAZY_API_KEY") ?? "";
  if (!dcKey) return json({ error: "DATACRAZY_API_KEY não configurada no projeto." }, 500);

  // Admin ou gerente (mesma regra das tabelas comercial_*).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: ehGestor } = await admin.rpc("is_gestor", { _user_id: quem.user.id });
  if (!ehGestor) return json({ error: "Acesso restrito a administradores e gerentes." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    acao?: "importar" | "recalcular" | "amostra_mensagens" | "baixar_planilha" | "vincular_leads";
    inicio?: string;
    fim?: string;
    skip?: number;
    /** importar: busca de novo as mensagens mesmo sem mudança (preenche as mensagens das importações antigas). */
    atualizarTudo?: boolean;
    url?: string;
    /** Reimporta só esta conversa (já gravada). */
    conversaId?: string;
  };

  try {

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

    // ---- Reimporta uma conversa ----
    if (corpo.conversaId && !corpo.acao) {
      const { data: gravada } = await admin.from("comercial_conversas").select("bruto").eq("id", corpo.conversaId).maybeSingle();
      if (!gravada) return json({ error: "Conversa não encontrada." }, 404);
      await importarConversa(admin, { ...(gravada.bruto as ConversaDC), id: corpo.conversaId }, dcKey);
      return json({ ok: true });
    }

    const per = periodo(corpo.inicio, corpo.fim);

    // ---- Importação (sem IA), em lotes com orçamento de tempo ----
    // A lista do Data Crazy vem da conversa mais recente para a mais antiga;
    // quando uma página inteira é anterior ao início do período, terminou.
    if (corpo.acao === "importar") {
      if (!per) return json({ error: "Informe o período (inicio e fim no formato AAAA-MM-DD)." }, 400);
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
            if (!(corpo.atualizarTudo && g?.mensagens_sdr == null) && g && g.primeira_mensagem_em && ultima &&
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

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("analisar-conversas-comercial:", e);
    if (e instanceof LimiteDataCrazy) return json({ ok: false, aguardarSeg: AGUARDAR_APOS_429_SEG, error: e.message }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
