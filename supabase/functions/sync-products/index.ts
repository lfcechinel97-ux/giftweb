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

function normalizeNomeBase(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getCodigoPrefixo(codigoAmigavel: string, nome: string): string {
  return codigoAmigavel;
}

const COR_ABREV: Record<string, string> = {
  'AZU': 'AZUL', 'VRM': 'VERMELHO', 'VRD': 'VERDE', 'VD': 'VERDE',
  'AMR': 'AMARELO', 'PRE': 'PRETO', 'BRA': 'BRANCO', 'ROS': 'ROSA',
  'ROX': 'ROXO', 'LAR': 'LARANJA', 'CIN': 'CINZA', 'MAR': 'MARROM',
  'DOU': 'DOURADO', 'PRA': 'PRATA', 'VIN': 'VINHO', 'GRA': 'GRAFITE',
  'BEG': 'BEGE', 'PNK': 'ROSA', 'CHU': 'CHUMBO', 'MAD': 'MADEIRA',
  'INX': 'INOX', 'TRA': 'TRANSPARENTE', 'KRA': 'KRAFT', 'BAM': 'BAMBU',
  'BRO': 'BRONZE', 'RSE': 'ROSA', 'COB': 'COBRE',
};

function extrairCor(p: any): string | null {
  const corWeb = (p.CorWebPrincipal ?? p.corWebPrincipal ?? "").trim().toUpperCase();
  if (corWeb) return corWeb;
  const codigo = p.CodigoComposto ?? p.codigoComposto ?? "";
  const match = codigo.match(/-([A-Z]{2,4})(?:\/|$)/i);
  if (match) {
    const abrev = match[1].toUpperCase();
    if (COR_ABREV[abrev]) return COR_ABREV[abrev];
  }
  return null;
}

// Expanded: 32 granular categories matching spotlight_categories slugs
function getCategoria(nome: string): string {
  const n = nome.toUpperCase();

  // Specific matches first (order matters - more specific before generic)
  if (n.includes('AGENDA')) return 'agendas';
  if (n.includes('CADERNETA')) return 'cadernetas';
  if (n.includes('CADERNO')) return 'cadernos';
  if (n.includes('BLOCO')) return 'blocos';
  if (n.includes('CANETA') || n.includes('LAPISEIRA') || n.includes('MARCA TEXTO') || n.includes('MARCA-TEXTO')) return 'canetas';

  if (n.includes('CANECA') || n.includes('COPO') || n.includes('TACA') || n.includes('TAÇA') || n.includes('MUG')) return 'copos-e-canecas';
  if (n.includes('GARRAFA') || n.includes('SQUEEZE') || n.includes('TERMICA') || n.includes('TÉRMICA')) return 'garrafas-e-squeezes';

  if (n.includes('MOCHILA') || n.includes('SACOCHILA')) return 'mochilas-e-sacochilas';
  if (n.includes('NECESSAIRE')) return 'necessaires';
  if (n.includes('SACOLA')) return 'sacolas';
  if (n.includes('MALA') && !n.includes('MALABAR')) return 'malas';
  if (n.includes('PASTA')) return 'pastas';
  if (n.includes('ESTOJO')) return 'estojos';
  if (n.includes('BOLSA')) return 'bolsas';

  if (n.includes('PEN DRIVE') || n.includes('PENDRIVE')) return 'pen-drives';
  if (n.includes('POWER BANK') || n.includes('POWERBANK') || n.includes('CARREGADOR PORTATIL') || n.includes('CARREGADOR PORTÁTIL')) return 'power-banks';
  if (n.includes('FONE') || n.includes('HEADPHONE') || n.includes('EARPHONE') || n.includes('HEADSET')) return 'fones';
  if (n.includes('MOUSE PAD') || n.includes('MOUSEPAD')) return 'mouse-pads';
  if (n.includes('SUPORTE') && (n.includes('CELULAR') || n.includes('NOTEBOOK') || n.includes('TABLET'))) return 'suportes';

  if (n.includes('CHAVEIRO')) return 'chaveiros';
  if (n.includes('GUARDA-CHUVA') || n.includes('GUARDA CHUVA') || n.includes('SOMBRINHA')) return 'guarda-chuvas';
  if (n.includes('ESPELHO')) return 'espelhos';
  if (n.includes('PORTA-RETRATO') || n.includes('PORTA RETRATO')) return 'porta-retratos';
  if (n.includes('PORTA-JOIA') || n.includes('PORTA JOIA')) return 'porta-joias';
  if (n.includes('PORTA-OBJETO') || n.includes('PORTA OBJETO') || n.includes('ORGANIZADOR')) return 'porta-objetos';
  if (n.includes('CAIXA DE SOM') || n.includes('CAIXA SOM') || n.includes('SPEAKER')) return 'caixas-de-som';
  if (n.includes('CAIXA ORGANIZADORA')) return 'caixas-organizadoras';
  if (n.includes('MARMITA') || n.includes('LANCHEIRA') || n.includes('LUNCH')) return 'marmitas';
  if (n.includes('TOALHA')) return 'toalhas';
  if (n.includes('COZINHA') || n.includes('TABUA') || n.includes('TÁBUA') || n.includes('AVENTAL') || n.includes('ABRIDOR')) return 'cozinha-e-mesa';
  if (n.includes('KIT')) return 'kits';

  // Generic fallback
  return 'outros';
}

// Map getCategoria values to spotlight_categories slugs
// Most are already matching; this handles any discrepancies
const CATEGORIA_TO_SLUG: Record<string, string> = {
  'agendas': 'agendas',
  'blocos': 'blocos',
  'bolsas': 'bolsas',
  'cadernetas': 'cadernetas',
  'cadernos': 'cadernos',
  'caixas-de-som': 'caixas-de-som',
  'caixas-organizadoras': 'caixas-organizadoras',
  'canetas': 'canetas',
  'chaveiros': 'chaveiros',
  'copos-e-canecas': 'copos-e-canecas',
  'cozinha-e-mesa': 'cozinha-e-mesa',
  'espelhos': 'espelhos',
  'estojos': 'estojos',
  'fones': 'fones',
  'garrafas-e-squeezes': 'garrafas-e-squeezes',
  'guarda-chuvas': 'guarda-chuvas',
  'kits': 'kits',
  'malas': 'malas',
  'marmitas': 'marmitas',
  'mochilas-e-sacochilas': 'mochilas-e-sacochilas',
  'mouse-pads': 'mouse-pads',
  'necessaires': 'necessaires',
  'pastas': 'pastas',
  'pen-drives': 'pen-drives',
  'porta-joias': 'porta-joias',
  'porta-objetos': 'porta-objetos',
  'porta-retratos': 'porta-retratos',
  'power-banks': 'power-banks',
  'sacolas': 'sacolas',
  'suportes': 'suportes',
  'toalhas': 'toalhas',
};

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
    const chaveParaGrupoPai = new Map<string, string>();
    for (const [chave, p] of produtosMap.entries()) {
      const codigoAmigavel = p.CodigoAmigavel ?? p.codigoAmigavel ?? chave;
      const nome = p.Nome ?? p.nome ?? chave;
      const groupKey = getCodigoPrefixo(codigoAmigavel, nome);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(chave);
      chaveParaGrupoPai.set(chave, groupKey);
    }

    const paiDeCodigo = new Map<string, string>();
    const isPai = new Set<string>();
    const isVariante = new Set<string>();

    for (const [groupKey, codigos] of groups) {
      codigos.sort();
      const codigoAmigavelPart = groupKey.split("|")[0];
      const paiCodigo =
        codigos.find((c) => c === codigoAmigavelPart) ??
        codigos.reduce((a, b) => (a.length <= b.length ? a : b));
      isPai.add(paiCodigo);
      for (const c of codigos) {
        if (c !== paiCodigo) {
          isVariante.add(c);
          paiDeCodigo.set(c, paiCodigo);
        }
      }
    }
    console.log("[SYNC] Stage 2 OK - grupos:", groups.size, "pais:", isPai.size, "variantes:", isVariante.size);

    console.log("[SYNC] Stage 3: Preparing records...");
    const agora = new Date().toISOString();
    const registros = Array.from(produtosMap.entries()).map(([chave, p]) => {
      const nome = p.Nome ?? p.nome ?? chave;
      const codigoAmigavel = p.CodigoAmigavel ?? p.codigoAmigavel ?? chave;
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
        cor: extrairCor(p),
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
        codigo_prefixo: getCodigoPrefixo(codigoAmigavel, nome),
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

    // Stage 5: Auto-populate product_spotlight_categories
    console.log("[SYNC] Stage 5: Populating product_spotlight_categories...");
    try {
      // Fetch all spotlight_categories (base type)
      const { data: spotlightCats } = await supabaseClient
        .from("spotlight_categories")
        .select("id, slug")
        .eq("category_type", "base")
        .eq("active", true);

      if (spotlightCats && spotlightCats.length > 0) {
        const slugToId = new Map<string, string>();
        for (const sc of spotlightCats) {
          slugToId.set(sc.slug, sc.id);
        }

        // Fetch all active products with their categoria
        const allProducts: { id: string; categoria: string }[] = [];
        let offset = 0;
        const batchSize = 1000;
        while (true) {
          const { data: batch } = await supabaseClient
            .from("products_cache")
            .select("id, categoria")
            .eq("ativo", true)
            .range(offset, offset + batchSize - 1);
          if (!batch || batch.length === 0) break;
          allProducts.push(...batch);
          if (batch.length < batchSize) break;
          offset += batchSize;
        }
        console.log("[SYNC] Stage 5: Found", allProducts.length, "active products to map");

        // Map each product to its spotlight category
        const mappings: { product_id: string; category_id: string; position: number }[] = [];
        for (const prod of allProducts) {
          const cat = prod.categoria || "outros";
          // Try direct match first
          let spotlightSlug = CATEGORIA_TO_SLUG[cat] || cat;
          const catId = slugToId.get(spotlightSlug);
          if (catId) {
            mappings.push({ product_id: prod.id, category_id: catId, position: 0 });
          }
        }
        console.log("[SYNC] Stage 5: Mapped", mappings.length, "product-category pairs");

        // Upsert in chunks (on conflict do nothing via unique constraint)
        for (let i = 0; i < mappings.length; i += CHUNK_SIZE) {
          const chunk = mappings.slice(i, i + CHUNK_SIZE);
          const { error: mapError } = await supabaseClient
            .from("product_spotlight_categories")
            .upsert(chunk, { onConflict: "product_id,category_id", ignoreDuplicates: true });
          if (mapError) console.error("[SYNC] Stage 5 upsert error:", JSON.stringify(mapError));
        }
        console.log("[SYNC] Stage 5 OK");
      }
    } catch (stage5Err) {
      console.error("[SYNC] Stage 5 error (non-fatal):", (stage5Err as Error).message);
    }

    // Mark products not seen in this sync as inactive
    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabaseClient.from("products_cache").update({ ativo: false }).lt("ultima_sync", limite).eq("ativo", true);

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
