import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Etapa C da nova arquitetura: aplica a logo no cenário (já gerado pela
   gerar-cenario-mockup) por INPAINTING COM MÁSCARA REAL -- não é mais
   "cole a logo e peça pra IA não mexer" (ela mexia de qualquer forma,
   inclusive "corrigindo" sozinha uma logo de cabeça pra baixo -- sinal de
   que o modelo resintetizava a imagem toda em vez de editar localmente).

   Com máscara, a área FORA do retângulo marcado é preservada pela própria
   API (contrato da Image Edit API), não pela boa vontade do modelo. Usa
   GPT Image 2 (OpenAI) via Lovable AI Gateway -- continua nos créditos do
   Lovable, não precisa de chave OpenAI separada. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

const TEMPLATES: Record<Tecnica, string> = {
  laser:
    "A logo deve parecer personalizada a fiber laser: aspecto prateado brilhante homogêneo, como gravação real " +
    "em metal.",
  dtf_uv:
    "A logo deve parecer personalizada em DTF UV: mantenha as cores originais da logo (não deixe monocromática " +
    "nem prateada, isso é acabamento de laser, não de DTF UV), com uma camada de verniz bem visível por cima -- " +
    "brilhante, com leve relevo 3D e reflexo de luz na superfície impressa.",
  dtf_textil:
    "A logo deve parecer personalizada em DTF têxtil: mantenha as cores originais da logo (não deixe " +
    "monocromática nem prateada, isso é acabamento de laser, não de DTF têxtil), acabamento fosco (sem brilho " +
    "de verniz) e com a trama do tecido levemente visível por baixo da estampa.",
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
    cenaBase64?: string; logoBase64?: string; maskBase64?: string; tecnica?: Tecnica; nomeProduto?: string;
  };
  const { cenaBase64, logoBase64, maskBase64, tecnica, nomeProduto } = corpo;
  if (!cenaBase64?.startsWith("data:image/")) return json({ error: "Envie o cenário como data URL." }, 400);
  if (!logoBase64?.startsWith("data:image/")) return json({ error: "Envie a logo como data URL." }, 400);
  if (!maskBase64?.startsWith("data:image/")) return json({ error: "Envie a máscara como data URL." }, 400);
  if (!tecnica || !TEMPLATES[tecnica]) return json({ error: "Técnica inválida." }, 400);

  const chave = `final_${tecnica}`;
  const { data: linhaPrompt } = await admin.from("mockup_ia_prompts").select("prompt").eq("chave", chave).maybeSingle();
  const acabamento = (linhaPrompt?.prompt || TEMPLATES[tecnica]).replace(/\{produto\}/g, nomeProduto || "produto");

  const prompt =
    "A segunda imagem é a arte EXATA que deve ser reproduzida -- mesmo que você reconheça essa marca de algum " +
    "outro lugar, NÃO substitua por uma versão 'oficial' ou da sua memória, não redesenhe, não complete texto " +
    "que não está na imagem, não troque o layout. Copie fielmente todas as letras, símbolos, cores e proporções " +
    "exatamente como estão na segunda imagem, já na orientação correta (ela já está no ângulo certo, não gire " +
    "de novo). Preencha a área editável (marcada pela máscara) por completo com essa cópia fiel, do tamanho que " +
    "a área editável permitir, sem sobrar nem faltar. " + acabamento +
    " Acompanhe a iluminação e a textura da superfície ao redor, com uma sombra de contato sutil onde a logo " +
    "encosta no produto.";

  // GPT Image 2 via Lovable AI Gateway -- formato OpenAI Image Edit API
  // (multipart/form-data): image[] = imagens de referência (a máscara se
  // aplica à PRIMEIRA), mask = máscara real (alpha transparente = área
  // editável). É a única forma de travar a posição por contrato de API,
  // não por obediência do modelo.
  let resposta: Response;
  try {
    const form = new FormData();
    form.append("model", "openai/gpt-image-2");
    form.append("prompt", prompt);
    form.append("image[]", dataUrlParaBlob(cenaBase64), "cenario.png");
    form.append("image[]", dataUrlParaBlob(logoBase64), "logo.png");
    form.append("mask", dataUrlParaBlob(maskBase64), "mascara.png");

    resposta = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}` },
      body: form,
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
    console.error("Lovable AI gateway recusou (inpainting):", resposta.status, textoBruto.slice(0, 2000));
    const msg =
      dados?.error?.message ||
      (typeof dados?.error === "string" ? dados.error : null) ||
      dados?.message ||
      textoBruto.slice(0, 300) ||
      "A IA recusou o pedido.";
    return json({ error: `IA (${resposta.status}): ${msg}` }, 502);
  }

  const item = dados?.data?.[0];
  const imagemUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || null;
  if (!imagemUrl) {
    console.error("Resposta sem imagem (inpainting):", textoBruto.slice(0, 2000));
    return json({ error: "A IA não retornou uma imagem." }, 502);
  }

  return json({ url: imagemUrl });
});

function dataUrlParaBlob(dataUrl: string): Blob {
  const [cabecalho, base64] = dataUrl.split(",");
  const mime = cabecalho.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
