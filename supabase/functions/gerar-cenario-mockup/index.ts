import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Etapa A da nova arquitetura do Mockup Studio: gera só o CENÁRIO em volta
   do produto (sem logo nenhuma) -- aqui resíntese da IA é bem-vinda, é o
   oposto do problema de posicionamento. Resultado cacheado por visao_id
   (estável por produto+variante+foto) num bucket público, pra não gerar de
   novo em todo orçamento do mesmo item. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT_PADRAO =
  "Coloque esse {produto} em um cenário de mostruário B2B profissional e realista: prateleiras com outros " +
  "produtos desfocados ao fundo, mesa de madeira, iluminação de estúdio. Não altere o produto em si -- forma, " +
  "cor, material, proporções e qualquer personalização que já exista nele devem ficar exatamente iguais, só o " +
  "cenário ao redor muda.";

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
    produtoBase64?: string; nomeProduto?: string; visaoId?: string; forcarNovo?: boolean;
  };
  const { produtoBase64, nomeProduto, visaoId, forcarNovo } = corpo;
  if (!produtoBase64?.startsWith("data:image/")) return json({ error: "Envie a foto do produto como data URL." }, 400);
  if (!nomeProduto || !visaoId) return json({ error: "Faltam dados do produto." }, 400);

  if (!forcarNovo) {
    const { data: cache } = await admin.from("mockup_cenas").select("cena_url").eq("visao_id", visaoId).maybeSingle();
    if (cache?.cena_url) return json({ url: cache.cena_url, cache: true });
  }

  const { data: linhaPrompt } = await admin.from("mockup_ia_prompts").select("prompt").eq("chave", "cenario_padrao").maybeSingle();
  const prompt = (linhaPrompt?.prompt || PROMPT_PADRAO).replace(/\{produto\}/g, nomeProduto);

  let resposta: Response;
  try {
    resposta = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        contents: [
          { role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mimeDaDataUrl(produtoBase64), data: base64DaDataUrl(produtoBase64) } }] },
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
    console.error("Lovable AI gateway recusou (cenário):", resposta.status, textoBruto.slice(0, 2000));
    const msg = dados?.error?.message || (typeof dados?.error === "string" ? dados.error : null) || textoBruto.slice(0, 300) || "A IA recusou o pedido.";
    return json({ error: `IA (${resposta.status}): ${msg}` }, 502);
  }

  const item = dados?.data?.[0];
  const partes = dados?.candidates?.[0]?.content?.parts ?? [];
  const parteImagem = partes.find((p: any) => p?.inlineData?.data);
  const base64Gerado: string | null = item?.b64_json || parteImagem?.inlineData?.data || null;
  if (!base64Gerado) {
    console.error("Resposta sem imagem (cenário):", textoBruto.slice(0, 2000));
    return json({ error: "A IA não retornou uma imagem." }, 502);
  }

  // Sobe pro storage (bucket público) pra poder cachear -- devolver um data
  // URL gigante toda vez não serve de cache de verdade.
  const bytes = Uint8Array.from(atob(base64Gerado), (c) => c.charCodeAt(0));
  const caminho = `${visaoId}-${Date.now()}.png`;
  const { error: erroUpload } = await admin.storage.from("mockup-cenas").upload(caminho, bytes, { contentType: "image/png", upsert: true });
  if (erroUpload) return json({ error: `Falha ao salvar o cenário: ${erroUpload.message}` }, 500);
  const { data: pub } = admin.storage.from("mockup-cenas").getPublicUrl(caminho);

  await admin.from("mockup_cenas").upsert({ visao_id: visaoId, cena_url: pub.publicUrl, criado_em: new Date().toISOString() });

  return json({ url: pub.publicUrl, cache: false });
});

function mimeDaDataUrl(dataUrl: string): string {
  return dataUrl.match(/data:(.*?);base64/)?.[1] || "image/png";
}

function base64DaDataUrl(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}
