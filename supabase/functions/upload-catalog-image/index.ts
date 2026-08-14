import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-upload-secret",
};

const BUCKET = "catalogo-meta";

// Upload server-to-server para o bucket catalogo-meta, sem nunca expor a
// SUPABASE_SERVICE_ROLE_KEY para fora da Edge Function. Protegido por um
// segredo próprio (CATALOG_UPLOAD_SECRET) em vez de auth de usuário, porque
// quem chama isso é o script Python do pipeline de catálogo, não o site.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const segredoEsperado = Deno.env.get("CATALOG_UPLOAD_SECRET");
  const segredoRecebido = req.headers.get("x-upload-secret");
  if (!segredoEsperado || segredoRecebido !== segredoEsperado) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "ensure_bucket") {
      const { data: buckets } = await supabase.storage.listBuckets();
      const existe = buckets?.some((b) => b.name === BUCKET);
      if (!existe) {
        const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true, ensured: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload") {
      const { path, contentBase64, contentType } = body;
      if (!path || !contentBase64) {
        return new Response(JSON.stringify({ error: "path e contentBase64 são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: contentType || "image/jpeg", upsert: false });
      if (error) throw error;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return new Response(JSON.stringify({ success: true, url: pub.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida (use 'ensure_bucket' ou 'upload')" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
