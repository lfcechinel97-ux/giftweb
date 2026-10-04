import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Geração final do mockup, numa ÚNICA chamada de IA via Lovable AI Gateway
   (LOVABLE_API_KEY já injetada no projeto, cobrança nos créditos do
   workspace Lovable). Recebe a foto do produto e o arquivo da logo SEM
   nenhum pré-processamento -- nada de remoção de fundo local, nada de
   acabamento aplicado antes. O prompt é curto e descritivo (sem listas de
   "não faça isso", sem pedir resolução específica), montado a partir de um
   template por técnica editável pelo admin. */

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
    "Coloque essa logo como se estivesse personalizada em DTF UV no {produto}, cores originais da logo, leve " +
    "relevo e brilho de verniz. A logo deve ocupar cerca de {pct}% da largura visível do produto, posicionada " +
    "{posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o produto em um cenário de " +
    "mostruário B2B profissional, pronto para enviar ao cliente.",
  dtf_textil:
    "Coloque essa logo como se estivesse personalizada em DTF têxtil no {produto}, cores originais da logo, " +
    "acabamento fosco com a trama do tecido visível. A logo deve ocupar cerca de {pct}% da largura visível do " +
    "produto, posicionada {posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o " +
    "produto em um cenário de mostruário B2B profissional, pronto para enviar ao cliente.",
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

  let resposta: Response;
  try {
    resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: produtoBase64 } },
              { type: "image_url", image_url: { url: logoBase64 } },
            ],
          },
        ],
        modalities: ["image", "text"],
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

  const imagemUrl = dados?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imagemUrl) {
    console.error("Resposta sem imagem:", textoBruto.slice(0, 2000));
    const textoResposta = dados?.choices?.[0]?.message?.content;
    return json({ error: textoResposta ? `A IA respondeu sem imagem: "${textoResposta}"` : "A IA não retornou uma imagem." }, 502);
  }

  return json({ url: imagemUrl });
});
