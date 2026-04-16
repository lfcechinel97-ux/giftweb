import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL = "https://giftwebbrindes.com.br";

// Google Product Taxonomy mapping (Brazilian Portuguese categories → Google taxonomy IDs)
// Reference: https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt
const GOOGLE_CATEGORY_MAP: Record<string, string> = {
  "garrafas-e-squeezes": "Arts & Entertainment > Party & Celebration > Gift Giving > Promotional Give Aways",
  "copos-e-canecas": "Home & Garden > Kitchen & Dining > Tableware > Drinkware",
  "mochilas-e-sacochilas": "Luggage & Bags > Backpacks",
  "bolsas": "Luggage & Bags > Tote Bags",
  "canetas": "Office Supplies > Writing & Drawing Instruments > Pens & Pencils",
  "kits": "Arts & Entertainment > Party & Celebration > Gift Giving > Promotional Give Aways",
  "cadernos": "Office Supplies > Paper Products > Notebooks & Notepads",
  "cadernetas": "Office Supplies > Paper Products > Notebooks & Notepads",
  "agendas": "Office Supplies > Paper Products > Planners",
  "blocos": "Office Supplies > Paper Products > Notebooks & Notepads",
  "chaveiros": "Arts & Entertainment > Party & Celebration > Gift Giving > Promotional Give Aways",
  "caixas-de-som": "Electronics > Audio > Audio Players & Recorders > Portable Speakers",
  "fones": "Electronics > Audio > Headphones & Headsets",
  "power-banks": "Electronics > Electronics Accessories > Power > Power Adapters & Chargers",
  "pen-drives": "Electronics > Electronics Accessories > Computer Components > Storage > USB Flash Drives",
  "mouse-pads": "Electronics > Electronics Accessories > Computer Accessories > Mouse Pads",
  "guarda-chuvas": "Apparel & Accessories > Handbag & Wallet Accessories > Umbrellas",
  "toalhas": "Home & Garden > Linens & Bedding > Towels",
  "necessaires": "Luggage & Bags > Cosmetic & Toiletry Bags",
  "sacolas": "Luggage & Bags > Shopping Tote Bags",
  "estojos": "Office Supplies > Office Supply Holders & Dispensers",
  "pastas": "Office Supplies > Filing & Organization > File Folders",
  "malas": "Luggage & Bags > Suitcases",
  "cozinha-e-mesa": "Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils",
  "marmitas": "Home & Garden > Kitchen & Dining > Food Storage Containers",
  "suportes": "Electronics > Electronics Accessories > Computer Accessories > Laptop & Tablet Stands",
  "porta-objetos": "Home & Garden > Household Supplies > Storage & Organization",
  "porta-retratos": "Home & Garden > Decor > Picture Frames",
  "porta-joias": "Home & Garden > Decor > Jewelry Boxes & Organizers",
  "espelhos": "Health & Beauty > Personal Care > Cosmetic Tools > Mirrors",
};

const DEFAULT_GOOGLE_CATEGORY = "Arts & Entertainment > Party & Celebration > Gift Giving > Promotional Give Aways";

function calcDisplayPrice(precoCusto: number): number {
  let multiplier: number;
  if (precoCusto <= 1) multiplier = 6.0;
  else if (precoCusto <= 3) multiplier = 4.8;
  else if (precoCusto <= 8) multiplier = 3.8;
  else if (precoCusto <= 15) multiplier = 3.0;
  else if (precoCusto <= 25) multiplier = 2.5;
  else if (precoCusto <= 40) multiplier = 2.1;
  else if (precoCusto <= 70) multiplier = 1.8;
  else multiplier = 1.6;
  return Math.round(precoCusto * multiplier * (1 - 0.16) * 100) / 100;
}

function escapeXml(str: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all active parent products with images (paginate to get all)
  let allProducts: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("products_cache")
      .select("id, nome, descricao, slug, image_url, cor, categoria, marca, preco_custo, estoque, codigo_amigavel")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .or("is_hidden.is.null,is_hidden.eq.false")
      .order("nome")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }

    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  // Build XML
  const items = allProducts.map((p) => {
    const price = calcDisplayPrice(p.preco_custo || 0);
    const availability = (p.estoque || 0) > 0 ? "in_stock" : "out_of_stock";
    const link = `${SITE_URL}/catalogo/produto/${p.slug || p.codigo_amigavel}`;
    const googleCategory = GOOGLE_CATEGORY_MAP[p.categoria || ""] || DEFAULT_GOOGLE_CATEGORY;
    const description = p.descricao
      ? escapeXml(p.descricao.substring(0, 5000))
      : escapeXml(p.nome);

    return `    <item>
      <g:id>${escapeXml(p.codigo_amigavel)}</g:id>
      <g:title>${escapeXml(p.nome)}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(p.image_url)}</g:image_link>
      <g:price>${price.toFixed(2)} BRL</g:price>
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(p.marca || "Gift Web Brindes")}</g:brand>
      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
      <g:product_type>${escapeXml(p.categoria || "outros")}</g:product_type>
      <g:identifier_exists>false</g:identifier_exists>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Gift Web Brindes - Brindes Corporativos</title>
    <link>${SITE_URL}</link>
    <description>Catálogo de brindes corporativos personalizados</description>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
