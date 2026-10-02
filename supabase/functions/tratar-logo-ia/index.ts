import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Tratamento real da logo por IA, via Lovable AI Gateway -- o workspace já
   injeta LOVABLE_API_KEY automaticamente em todo projeto conectado ao
   Lovable (nada pra cadastrar manualmente), e o consumo é cobrado nos
   créditos do Lovable, não numa conta separada de IA.

   A IA só entra pra remover fundo / refinar o acabamento visual -- nunca
   pra redesenhar a logo. O prompt é explícito sobre preservar letras,
   proporções e contornos, e o front sempre mostra o resultado lado a lado
   com o original antes de aprovar. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

const QUALIDADE =
  "Output at the highest resolution and sharpness you can produce (at least 1024x1024, no upscale blur, no JPEG " +
  "compression artifacts, no plastic/AI-render look). This is for a real commercial product catalog, not a concept " +
  "or illustration -- it must look like an actual photograph.";

const INSTRUCAO_COMPOSICAO =
  "This image shows a real product with a logo already placed on top, as a mockup preview, photographed for a " +
  "corporate gifts catalog. Your ONLY job is to make the logo look physically applied to the product's surface: " +
  "add a subtle contact shadow where the logo meets the surface, match the logo's perspective and (if the surface " +
  "is curved, like a bottle or mug) wrap it slightly to follow that curve, and match the product's lighting and " +
  "color temperature. Do NOT change the product itself in any way (shape, color, material, size, position) and do " +
  "NOT redesign, move, resize, recolor, crop or reinterpret the logo -- its letters, symbols, proportions and " +
  "exact content must stay identical to the input. Do not add, remove or invent any element, text or background " +
  "detail that is not already in the image. " + QUALIDADE;

const INSTRUCAO_PRODUTO =
  "This is a product catalog photo with a plain white/flat studio background. Remove the background completely " +
  "(fully transparent, clean edges, no white halo or fringing around the product). Do NOT change the product " +
  "itself in any way -- shape, color, material, proportions, labels, logos already printed on it, reflections and " +
  "highlights must stay pixel-for-pixel identical. Do not add shadows, textures, reflections or any new element. " + QUALIDADE;

const INSTRUCOES: Record<Tecnica, string> = {
  laser:
    "This logo will be laser engraved on stainless steel. Remove the background completely (fully transparent, " +
    "clean edges). Do NOT redesign, reinterpret or recreate the logo -- keep every letter, symbol, line, proportion " +
    "and spacing exactly as in the original, pixel-for-pixel where possible. Convert the artwork to a clean " +
    "monochrome look with a bright brushed-steel/silver metallic finish, like a real laser engraving sample, " +
    "preserving all fine details and transparency where it already existed. " + QUALIDADE,
  dtf_uv:
    "This logo will be printed with DTF UV (full color, with a glossy surface and a slight raised varnish relief). " +
    "Remove the background completely (fully transparent, clean edges) if there is one. Do NOT redesign, " +
    "reinterpret or recreate the logo or its colors -- keep letters, symbols, proportions, contours and small " +
    "details exactly as in the original. Do not add any outline, element, text or effect that was not requested. " + QUALIDADE,
  dtf_textil:
    "This logo will be printed with DTF for fabric application. Remove the background completely (fully " +
    "transparent, clean edges) if there is one. Do NOT redesign, reinterpret or recreate the logo or its colors -- " +
    "keep letters, symbols, proportions, contours and small details exactly as in the original. Do not make it " +
    "look embroidered and do not add textures inside the artwork. " + QUALIDADE,
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

  const corpo = await req.json().catch(() => ({})) as { imagemBase64?: string; tecnica?: Tecnica; modo?: "logo" | "composicao" | "produto" };
  const { imagemBase64, tecnica, modo } = corpo;
  if (!imagemBase64?.startsWith("data:image/")) return json({ error: "Envie a imagem como data URL." }, 400);
  if (modo === "logo" || !modo) {
    if (!tecnica || !INSTRUCOES[tecnica]) return json({ error: "Técnica inválida." }, 400);
  }

  // Prompt editável pelo admin fica em mockup_ia_prompts; se a linha não
  // existir ainda (migration não rodada, ou chave nova), cai pro texto
  // padrão embutido aqui mesmo.
  const chave = modo === "composicao" ? "composicao" : modo === "produto" ? "produto" : `logo_${tecnica}`;
  const { data: linhaPrompt } = await admin.from("mockup_ia_prompts").select("prompt").eq("chave", chave).maybeSingle();
  const padrao = modo === "composicao" ? INSTRUCAO_COMPOSICAO : modo === "produto" ? INSTRUCAO_PRODUTO : INSTRUCOES[tecnica!];
  const instrucao = linhaPrompt?.prompt || padrao;

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
              { type: "text", text: instrucao },
              { type: "image_url", image_url: { url: imagemBase64 } },
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

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    return json({ error: dados?.error?.message || "A IA recusou o pedido." }, 502);
  }

  const imagemUrl = dados?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imagemUrl) return json({ error: "A IA não retornou uma imagem." }, 502);

  return json({ url: imagemUrl, aviso: dados?.choices?.[0]?.message?.content || null });
});
