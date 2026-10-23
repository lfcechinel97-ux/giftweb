import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

// Proxy de foto do gerador de catálogo de WhatsApp (/catalogo-whatsapp).
//
// As fotos vêm do fornecedor sem CORS, e o html2canvas não consegue desenhar
// imagem de outra origem sem CORS (o PNG sai sem foto ou o download falha).
// Aqui a foto é buscada no servidor, reduzida para 600x600 (fundo branco,
// "contain") e devolvida com Access-Control-Allow-Origin.
//
// Não é proxy aberto: só serve URL que esteja em products_cache (image_url /
// image_urls) ou no Storage público deste projeto. verify_jwt=false porque o
// <img> não manda Authorization.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LADO = 600;
const MAX_BYTES = 15 * 1024 * 1024;

const erro = (status: number, msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function urlPermitida(url: string): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (base && url.startsWith(`${base}/storage/v1/object/public/`)) return true;

  const supabase = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const [principal, galeria] = await Promise.all([
    supabase.from("products_cache").select("id").eq("image_url", url).limit(1),
    supabase.from("products_cache").select("id").contains("image_urls", [url]).limit(1),
  ]);
  return !!(principal.data?.length || galeria.data?.length);
}

/** 600x600, fundo branco, imagem inteira centralizada (object-fit: contain). */
async function reduzir(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  const s = Math.min(LADO / img.width, LADO / img.height);
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  img.resize(w, h);
  const fundo = new Image(LADO, LADO).fill(0xffffffff);
  fundo.composite(img, Math.round((LADO - w) / 2), Math.round((LADO - h) / 2));
  return await fundo.encodeJPEG(90);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return erro(405, "Use GET");

  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!/^https?:\/\//i.test(url)) return erro(400, "Parâmetro url inválido");

  try {
    if (!(await urlPermitida(url))) return erro(403, "URL não pertence a nenhum produto");

    const resp = await fetch(url, { headers: { "User-Agent": "GiftWeb-Catalogo/1.0" } });
    if (!resp.ok) return erro(502, `Origem respondeu ${resp.status}`);
    const original = new Uint8Array(await resp.arrayBuffer());
    if (original.byteLength > MAX_BYTES) return erro(413, "Imagem grande demais");

    let corpo = original;
    let tipo = resp.headers.get("content-type") ?? "image/jpeg";
    try {
      corpo = await reduzir(original);
      tipo = "image/jpeg";
    } catch (e) {
      // formato que o decoder não lê (ex.: webp): devolve a original com CORS;
      // o navegador reduz para 600x600 no canvas
      console.warn("catalogo-imagem: sem redimensionar", url, e instanceof Error ? e.message : e);
    }

    return new Response(corpo, {
      headers: {
        ...corsHeaders,
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return erro(500, e instanceof Error ? e.message : String(e));
  }
});
