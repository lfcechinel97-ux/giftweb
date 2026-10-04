import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Geração final do mockup, numa ÚNICA chamada de IA via Lovable AI Gateway
   (LOVABLE_API_KEY já injetada no projeto, cobrança nos créditos do
   workspace Lovable). Recebe a foto do produto sem pré-processamento e a
   logo exatamente como o vendedor recortou na Etapa 3 (sem nenhum
   acabamento/remoção de fundo aplicado por IA antes). O prompt é curto e
   descritivo (sem listas de "não faça isso", sem pedir resolução
   específica), montado a partir de um template por técnica editável pelo
   admin. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

const TEMPLATES: Record<Tecnica, string> = {
  laser:
    "Coloque essa logo como se estivesse personalizada a fiber laser no {produto}. Aspecto prateado brilhante " +
    "homogêneo, como gravação real em metal. A logo deve ocupar cerca de {pct}% da largura visível do produto, " +
    "posicionada {posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o produto em um " +
    "cenário de mostruário B2B profissional, pronto para enviar ao cliente.",
  dtf_uv:
    "Coloque essa logo como se estivesse personalizada em DTF UV no {produto}: mantenha as cores originais da " +
    "logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF UV), com uma camada de " +
    "verniz bem visível por cima -- brilhante, com leve relevo 3D e reflexo de luz na superfície impressa. A logo " +
    "deve ocupar cerca de {pct}% da largura visível do produto, posicionada {posicao}. Mantenha as letras e o " +
    "desenho da logo idênticos ao original. Coloque o produto em um cenário de mostruário B2B profissional, " +
    "pronto para enviar ao cliente.",
  dtf_textil:
    "Coloque essa logo como se estivesse personalizada em DTF têxtil no {produto}: mantenha as cores originais " +
    "da logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF têxtil), acabamento " +
    "fosco (sem brilho de verniz) e com a trama do tecido levemente visível por baixo da estampa. A logo deve " +
    "ocupar cerca de {pct}% da largura visível do produto, posicionada {posicao}. Mantenha as letras e o desenho " +
    "da logo idênticos ao original. Coloque o produto em um cenário de mostruário B2B profissional, pronto para " +
    "enviar ao cliente.",
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
    nomeProduto?: string; pct?: number; posicao?: string;
  };
  const { produtoBase64, logoBase64, tecnica, nomeProduto, pct, posicao } = corpo;
  if (!produtoBase64?.startsWith("data:image/")) return json({ error: "Envie a foto do produto como data URL." }, 400);
  if (!logoBase64?.startsWith("data:image/")) return json({ error: "Envie a logo como data URL." }, 400);
  if (!tecnica || !TEMPLATES[tecnica]) return json({ error: "Técnica inválida." }, 400);
  if (!nomeProduto || pct == null || !posicao) return json({ error: "Faltam dados de produto/posição." }, 400);

  const chave = `final_${tecnica}`;
  const { data: linhaPrompt } = await admin.from("mockup_ia_prompts").select("prompt").eq("chave", chave).maybeSingle();
  const template = linhaPrompt?.prompt || TEMPLATES[tecnica];
  const prompt = template
    .replace(/\{produto\}/g, nomeProduto)
    .replace(/\{pct\}/g, String(Math.round(pct)))
    .replace(/\{posicao\}/g, posicao);

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
        model: "google/gemini-3.1-flash-lite-image",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeDaDataUrl(produtoBase64), data: base64DaDataUrl(produtoBase64) } },
              { inlineData: { mimeType: mimeDaDataUrl(logoBase64), data: base64DaDataUrl(logoBase64) } },
            ],
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

  return json({ url: imagemUrl });
});

function mimeDaDataUrl(dataUrl: string): string {
  return dataUrl.match(/data:(.*?);base64/)?.[1] || "image/png";
}

function base64DaDataUrl(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}
