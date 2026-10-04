import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Geração final do mockup, numa ÚNICA chamada de IA via Lovable AI Gateway
   (LOVABLE_API_KEY já injetada no projeto, cobrança nos créditos do
   workspace Lovable). Recebe a foto do produto com um retângulo tracejado
   marcando onde/quão grande a logo deve ficar (desenhado localmente na
   Etapa 3 -- pedir o tamanho só em % de texto fazia a IA ignorar completamente
   o tamanho/posição pedidos) e a logo exatamente como o vendedor recortou
   (sem nenhum acabamento/remoção de fundo aplicado por IA antes). O prompt
   por técnica é curto e descritivo (sem listas de "não faça isso", sem
   pedir resolução específica), editável pelo admin. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

const MODELO = "google/gemini-3.1-flash-lite-image";

const TEMPLATES: Record<Tecnica, string> = {
  laser:
    "A logo já colada no {produto} deve parecer personalizada a fiber laser: aspecto prateado brilhante " +
    "homogêneo, como gravação real em metal.",
  dtf_uv:
    "A logo já colada no {produto} deve parecer personalizada em DTF UV: mantenha as cores originais da logo " +
    "(não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF UV), com uma camada de verniz " +
    "bem visível por cima -- brilhante, com leve relevo 3D e reflexo de luz na superfície impressa.",
  dtf_textil:
    "A logo já colada no {produto} deve parecer personalizada em DTF têxtil: mantenha as cores originais da " +
    "logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF têxtil), acabamento " +
    "fosco (sem brilho de verniz) e com a trama do tecido levemente visível por baixo da estampa.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY não encontrada neste projeto." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: souInterno } = await admin.from("admin_users").select("id").eq("id", quem.user.id).maybeSingle();
  if (!souInterno) return json({ error: "Acesso restrito à equipe interna." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    produtoBase64?: string; logoBase64?: string; tecnica?: Tecnica;
    nomeProduto?: string; produtoCodigo?: string; pct?: number; posicao?: string;
  };
  const { produtoBase64, logoBase64, tecnica, nomeProduto, produtoCodigo, pct, posicao } = corpo;
  if (!produtoBase64?.startsWith("data:image/")) return json({ error: "Envie a foto do produto como data URL." }, 400);
  if (!logoBase64?.startsWith("data:image/")) return json({ error: "Envie a logo como data URL." }, 400);
  if (!tecnica || !TEMPLATES[tecnica]) return json({ error: "Técnica inválida." }, 400);
  if (!nomeProduto || pct == null || !posicao) return json({ error: "Faltam dados de produto/posição." }, 400);

  const chave = `final_${tecnica}`;
  const { data: linhaPrompt } = await admin.from("mockup_ia_prompts").select("prompt").eq("chave", chave).maybeSingle();
  const template = linhaPrompt?.prompt || TEMPLATES[tecnica];
  const promptTecnica = template
    .replace(/\{produto\}/g, nomeProduto)
    .replace(/\{pct\}/g, String(Math.round(pct)))
    .replace(/\{posicao\}/g, posicao);

  // Instrução fixa (não editável pelo admin -- é estrutural, não de
  // acabamento): a primeira imagem já mostra a logo colada no produto, no
  // tamanho/posição exatos (marcar só com texto ou com um retângulo não
  // bastava, a IA ainda tomava liberdade) -- a IA só pode dar acabamento,
  // nunca mover/redimensionar. Também permite um cenário rico e realista
  // de novo (antes tinha ficado genérico demais), mas trava a logo do
  // cliente só no produto principal -- se quiser decorar o fundo com
  // alguma marca, só pode ser a Gift Web (terceira imagem).
  const prompt =
    "A primeira imagem já mostra o produto com a logo do cliente colada exatamente no tamanho e na posição " +
    "corretos -- não mova, não redimensione, não reposicione e não gire essa logo de jeito nenhum (se ela está " +
    "inclinada, na vertical ou de cabeça pra baixo, é de propósito -- mantenha exatamente esse ângulo), ela já " +
    "está certa. Mantenha todos os textos e elementos da logo, letra por letra, como estão na segunda imagem -- " +
    "não remova nem resuma nada, e não troque por uma versão da marca que você conheça de memória. Sua " +
    "única tarefa é fazer ela parecer uma personalização real do produto (não um adesivo colado por cima): " +
    "acabamento, sombra de contato com a superfície, leve ajuste de perspectiva se a superfície for curva. A " +
    "segunda imagem é a logo do cliente em alta qualidade, use como referência de cor e nitidez. Capriche no " +
    "cenário: ambiente de mostruário profissional, com contexto realista ao fundo (prateleiras, outros produtos " +
    "desfocados, mesa, iluminação de estúdio). A logo do cliente só pode aparecer sobre o produto principal -- se " +
    "fizer sentido algum elemento de marca aparecer em outro lugar da cena (parede, sinalização, caixa ao fundo), " +
    "use a logo da Gift Web Brindes (terceira imagem), nunca a logo do cliente. " + promptTecnica;

  // Logo da Gift Web pra IA usar em elementos secundários do cenário (nunca
  // a logo do cliente) -- buscada aqui no servidor, não precisa vir do
  // client. Se falhar por algum motivo, segue sem ela (só perde esse
  // detalhe, não trava a geração).
  const partesImagens = [
    { inlineData: { mimeType: mimeDaDataUrl(produtoBase64), data: base64DaDataUrl(produtoBase64) } },
    { inlineData: { mimeType: mimeDaDataUrl(logoBase64), data: base64DaDataUrl(logoBase64) } },
  ];
  try {
    const logoGiftWeb = await fetch("https://giftwebbrindes.com.br/logos/giftweb-logo.png");
    if (logoGiftWeb.ok) {
      const buffer = await logoGiftWeb.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      partesImagens.push({ inlineData: { mimeType: "image/png", data: base64 } });
    }
  } catch { /* segue sem a logo da Gift Web */ }

  // Modelo Gemini: nem /v1/chat/completions (é só-de-imagem) nem
  // /v1/images/edits (esse é o formato OpenAI/DALL-E) -- é /v1/images/
  // generations com o corpo nativo do Gemini (contents/parts/inlineData).
  let resposta: Response;
  try {
    resposta = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...partesImagens],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
  } catch {
    return json({ error: "Não foi possível falar com a IA agora." }, 502);
  }

  if (resposta.status === 429) return json({ error: "Muitas requisições de IA agora -- aguarde um instante e tente de novo." }, 429);
  if (resposta.status === 402) return json({ error: "Créditos de IA do workspace Lovable esgotados." }, 402);

  const textoBruto = await resposta.text();
  let dados: any = null;
  try { dados = JSON.parse(textoBruto); } catch { /* resposta não era JSON */ }

  if (!resposta.ok) {
    console.error("Lovable AI gateway recusou:", resposta.status, textoBruto.slice(0, 2000));
    const msg =
      dados?.error?.message ||
      (typeof dados?.error === "string" ? dados.error : null) ||
      dados?.message ||
      textoBruto.slice(0, 300) ||
      "A IA recusou o pedido.";
    return json({ error: `IA (${resposta.status}): ${msg}` }, 502);
  }

  // Formato nativo do Gemini: candidates[0].content.parts[] -- a parte com
  // a imagem vem como inlineData (mimeType + base64), junto de uma parte
  // de texto que é ignorada aqui.
  // O gateway normaliza para data[0].b64_json; mantém fallback do formato nativo.
  const item = dados?.data?.[0];
  const partes = dados?.candidates?.[0]?.content?.parts ?? [];
  const parteImagem = partes.find((p: any) => p?.inlineData?.data);
  const imagemUrl = item?.b64_json
    ? `data:image/jpeg;base64,${item.b64_json}`
    : item?.url
      ? item.url
      : parteImagem
        ? `data:${parteImagem.inlineData.mimeType || "image/png"};base64,${parteImagem.inlineData.data}`
        : null;
  if (!imagemUrl) {
    console.error("Resposta sem imagem:", textoBruto.slice(0, 2000));
    return json({ error: "A IA não retornou uma imagem." }, 502);
  }

  // O gateway pode devolver o uso no formato OpenAI (usage) ou no nativo do
  // Gemini (usageMetadata) -- aceita os dois.
  const uso = dados?.usage ?? dados?.usageMetadata ?? null;
  const tokensEntrada = numeroOuNull(uso?.input_tokens ?? uso?.prompt_tokens ?? uso?.promptTokenCount);
  const tokensSaida = numeroOuNull(uso?.output_tokens ?? uso?.completion_tokens ?? uso?.candidatesTokenCount);
  const tokensTotal = numeroOuNull(uso?.total_tokens ?? uso?.totalTokenCount) ??
    (tokensEntrada != null && tokensSaida != null ? tokensEntrada + tokensSaida : null);
  if (!uso) console.warn("Resposta sem dados de uso. Chaves:", Object.keys(dados || {}).join(","));

  // Histórico: falha aqui não derruba a geração (o vendedor já tem a imagem).
  let geracao: unknown = null;
  try {
    const bytes = imagemUrl.startsWith("data:")
      ? Uint8Array.from(atob(base64DaDataUrl(imagemUrl)), (c) => c.charCodeAt(0))
      : new Uint8Array(await (await fetch(imagemUrl)).arrayBuffer());
    const id = crypto.randomUUID();
    const caminho = `${quem.user.id}/${id}.png`;
    const { error: erroUpload } = await admin.storage.from("mockup-geracoes")
      .upload(caminho, bytes, { contentType: imagemUrl.startsWith("data:") ? mimeDaDataUrl(imagemUrl) : "image/png" });
    if (erroUpload) throw erroUpload;
    const { data: linha, error: erroInsert } = await admin.from("mockup_geracoes").insert({
      id,
      user_id: quem.user.id,
      produto_nome: nomeProduto,
      produto_codigo: produtoCodigo || null,
      tecnica,
      modelo: MODELO,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      tokens_total: tokensTotal,
      uso,
      imagem_path: caminho,
    }).select().single();
    if (erroInsert) throw erroInsert;
    geracao = linha;
  } catch (e) {
    console.error("Falha ao salvar histórico:", e);
  }

  return json({ url: imagemUrl, geracao });
});

function numeroOuNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

function mimeDaDataUrl(dataUrl: string): string {
  return dataUrl.match(/data:(.*?);base64/)?.[1] || "image/png";
}

function base64DaDataUrl(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}
