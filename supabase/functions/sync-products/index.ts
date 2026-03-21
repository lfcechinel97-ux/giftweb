import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOCK_PRODUCTS = [
  {
    CodigoComposto: "9139A-AZU",
    CodigoAmigavel: "9139A",
    Nome: "Squeeze Alumínio 500ml",
    CorWebPrincipal: "Azul",
    ImageLink: "https://placehold.co/400",
    PrecoVenda: "15.00",
    QuantidadeDisponivel: "100",
  },
  {
    CodigoComposto: "9139A-VRM",
    CodigoAmigavel: "9139A",
    Nome: "Squeeze Alumínio 500ml",
    CorWebPrincipal: "Vermelho",
    ImageLink: "https://placehold.co/400",
    PrecoVenda: "15.00",
    QuantidadeDisponivel: "80",
  },
  {
    CodigoComposto: "9139A-PRE",
    CodigoAmigavel: "9139A",
    Nome: "Squeeze Alumínio 500ml",
    CorWebPrincipal: "Preto",
    ImageLink: "https://placehold.co/400",
    PrecoVenda: "15.00",
    QuantidadeDisponivel: "60",
  },
  {
    CodigoComposto: "00033-4GB-MAD",
    CodigoAmigavel: "00033-4GB",
    Nome: "Pen Drive Madeira 4GB",
    CorWebPrincipal: "Madeira",
    ImageLink: "https://placehold.co/400",
    PrecoVenda: "8.00",
    QuantidadeDisponivel: "200",
  },
  {
    CodigoComposto: "17011C-PRE",
    CodigoAmigavel: "17011C",
    Nome: "Garrafa Inox 750ml",
    CorWebPrincipal: "Preto",
    ImageLink: "https://placehold.co/400",
    PrecoVenda: "25.00",
    QuantidadeDisponivel: "50",
  },
];

function getCodigoPrefixo(codigo: string): string {
  if (codigo.includes('/')) return codigo.split('/')[0];
  const partes = codigo.split('-');
  if (partes.length >= 2) {
    const sufixo = partes[partes.length - 1];
    if (/^[A-Za-z]{1,4}[0-9]?$/.test(sufixo)) return partes.slice(0, -1).join('-');
  }
  return codigo;
}

function getCategoria(nome: string): string {
  const n = nome.toUpperCase();
  if (n.includes('CANECA') || n.includes('COPO') || n.includes('TACA') || n.includes('TAÇA')) return 'copos';
  if (n.includes('GARRAFA') || n.includes('SQUEEZE') || n.includes('TERMICA')) return 'garrafas';
  if (n.includes('MOCHILA')) return 'mochilas';
  if (n.includes('BOLSA') || n.includes('SACOLA')) return 'bolsas';
  if (n.includes('CANETA') || n.includes('BLOCO') || n.includes('CADERNO') || n.includes('AGENDA')) return 'escritorio';
  if (n.includes('KIT')) return 'kits';
  return 'outros';
}

function getSlug(nome: string, codigo: string): string {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const codigoSanitizado = codigo.toLowerCase().replace(/\//g, "-");
  return base + "-" + codigoSanitizado;
}

function getBusca(p: any): string {
  return [p.Nome ?? "", p.Descricao ?? "", p.CorWebPrincipal ?? "", p.CodigoAmigavel ?? ""].join(" ").toLowerCase();
}

function getImageUrls(p: any): string[] {
  return [p.ImageLink, p.ImageLink2, p.ImageLink3, p.ImageLink4, p.imageLink, p.imageLink2, p.imageLink3, p.imageLink4]
    .filter((url: any) => url && typeof url === "string" && url.trim() !== "")
    .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index)
    .slice(0, 4);
}

const CHUNK_SIZE = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let useMock = false;
  try {
    const body = await req.json();
    if (body && body.mock === true) useMock = true;
  } catch (_) {}

  try {
    let produtos: any[];
    if (useMock) {
      console.log("[SYNC] MOCK MODE - using fake data");
      produtos = MOCK_PRODUCTS;
    } else {
      console.log("[SYNC] Stage 1: Fetching from XBZ API...");
      const apiUrl = Deno.env.get("XBZ_API_URL");
      if (!apiUrl) throw new Error("XBZ_API_URL nao configurada");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);
      let apiResponse: Response;
      try {
        apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch (fetchErr) {
        clearTimeout(timeout);
        throw new Error("Falha ao chamar API XBZ: " + (fetchErr as Error).message);
      }
      if (!apiResponse.ok) {
        const txt = await apiResponse.text();
        throw new Error("API retornou status " + apiResponse.status + ": " + txt.slice(0, 200));
      }
      const data = await apiResponse.json();
      produtos = Array.isArray(data) ? data : (data.produtos ?? data.data ?? []);
    }
    console.log("[SYNC] Stage 1 OK - produtos:", produtos.length);
    if (!produtos.length) throw new Error("API retornou lista vazia");

    console.log("[SYNC] Stage 2: Deduplicating and grouping...");
    const produtosMap = new Map<string, any>();
    for (const p of produtos) {
      const codigoComposto = p.CodigoComposto ?? p.codigoComposto ?? "";
      const codigoAmigavel = p.CodigoAmigavel ?? p.codigoAmigavel ?? "";
      const chave = codigoComposto || codigoAmigavel;
      if (!chave) continue;
      produtosMap.set(chave, p);
    }

    const groups = new Map<string, string[]>();
    for (const [chave, p] of produtosMap.entries()) {
      const codigoPai = p.CodigoAmigavel ?? p.codigoAmigavel ?? chave;
      if (!groups.has(codigoPai)) groups.set(codigoPai, []);
      groups.get(codigoPai)!.push(chave);
    }

    const paiDeCodigo = new Map<string, string>();
    const isPai = new Set<string>();
    const isVariante = new Set<string>();

    for (const [codigoPai, codigos] of groups) {
      codigos.sort();
      const paiCodigo = codigos.find((c) => c === codigoPai) ?? codigos[0];
      isPai.add(paiCodigo);
      for (const c of codigos) {
        if (c !== paiCodigo) {
          isVariante.add(c);
          paiDeCodigo.set(c, paiCodigo);
        }
      }
    }
    console.log("[SYNC] Stage 2 OK - pais:", isPai.size, "variantes:", isVariante.size);

    console.log("[SYNC] Stage 3: Preparing records...");
    const agora = new Date().toISOString();
    const registros = Array.from(produtosMap.entries()).map(([chave, p]) => {
      const nome = p.Nome ?? p.nome ?? chave;
      const imageUrls = getImageUrls(p);
      const imageLink = imageUrls[0] ?? "";
      const hasImage = !!(imageLink && !imageLink.includes("placehold.co"));
      return {
        codigo_amigavel: chave,
        slug: getSlug(nome, chave),
        nome,
        descricao: p.Descricao ?? p.descricao ?? null,
        image_url: imageLink || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        has_image: hasImage,
        site_link: p.SiteLink ?? p.siteLink ?? null,
        cor: p.CorWebPrincipal ?? p.corWebPrincipal ?? null,
        categoria: getCategoria(nome),
        marca: p.Marca ?? p.marca ?? "XBZ",
        preco_custo: parseFloat(p.PrecoVenda ?? p.precoVenda ?? "0") || 0,
        estoque: parseInt(p.QuantidadeDisponivel ?? p.quantidadeDisponivel ?? "0") || 0,
        peso: parseFloat(p.Peso ?? p.peso ?? "0") || null,
        altura: parseFloat(p.Altura ?? p.altura ?? "0") || null,
        largura: parseFloat(p.Largura ?? p.largura ?? "0") || null,
        profundidade: parseFloat(p.Profundidade ?? p.profundidade ?? "0") || null,
        ativo: true,
        busca: getBusca(p),
        ultima_sync: agora,
        is_variante: isVariante.has(chave),
        produto_pai: null,
        codigo_prefixo: getCodigoPrefixo(chave),
      };
    });
    console.log("[SYNC] Stage 3 OK -", registros.length, "registros");

    console.log("[SYNC] Stage 3b: Removing old records...");
    const codigosNovos = new Set(registros.map((r) => r.codigo_amigavel));
    const antigosParaDeletar = Array.from(groups.keys()).filter((pai) => !codigosNovos.has(pai));
    if (antigosParaDeletar.length > 0) {
      await supabaseClient.from("products_cache").delete().in("codigo_amigavel", antigosParaDeletar);
      console.log("[SYNC] Stage 3b OK - deleted", antigosParaDeletar.length, "old records");
    }

    console.log("[SYNC] Stage 3c: Upserting...");
    for (let i = 0; i < registros.length; i += CHUNK_SIZE) {
      const chunk = registros.slice(i, i + CHUNK_SIZE);
      const { error } = await supabaseClient.from("products_cache").upsert(chunk, { onConflict: "codigo_amigavel" });
      if (error) throw new Error("Upsert falhou: " + JSON.stringify(error));
    }
    console.log("[SYNC] Stage 3c OK");

    console.log("[SYNC] Stage 4: Setting produto_pai via SQL join...");
    const { error: rpcError } = await supabaseClient.rpc("set_variantes_por_prefixo");
    if (rpcError) console.error("[SYNC] Stage 4 RPC error:", JSON.stringify(rpcError));
    console.log("[SYNC] Stage 4 OK");

    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabaseClient.from("products_cache").update({ ativo: false }).lt("ultima_sync", limite);

    await supabaseClient
      .from("sync_log")
      .insert({ total_products: registros.length, status: useMock ? "success-mock" : "success" });
    console.log("[SYNC] DONE - total:", registros.length);

    return new Response(JSON.stringify({ success: true, total: registros.length, mock: useMock }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[SYNC] FATAL:", err);
    try {
      await createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")
        .from("sync_log")
        .insert({ total_products: 0, status: "error", erro: (err as Error).message });
    } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
