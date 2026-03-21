import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/config/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import CatalogPagination from "@/components/CatalogPagination";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;
const PAGE_SIZE = 20;

const CATEGORIES = [
  { slug: "copos", label: "Copos" },
  { slug: "garrafas", label: "Garrafas" },
  { slug: "mochilas", label: "Mochilas" },
  { slug: "bolsas", label: "Bolsas" },
  { slug: "escritorio", label: "Escritório" },
  { slug: "kits", label: "Kits" },
  { slug: "squeezes", label: "Squeezes" },
  { slug: "brindes-baratos", label: "Brindes Baratos" },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchResults = useCallback(async () => {
    if (!q) { setProducts([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("products_cache")
      .select("*", { count: "exact" })
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .ilike("busca", `%${q}%`)
      .order("sort_estoque")
      .order("variantes_count", { ascending: false })
      .order("estoque", { ascending: false, nullsFirst: false })
      .range(from, to);

    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [q, page]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const handlePageChange = (p: number) => {
    setSearchParams({ q, page: p.toString() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Helmet>
        <title>Resultados para "{q}" | Gift Web Brindes</title>
        <meta name="description" content={`Brindes personalizados: resultados para "${q}".`} />
        <link rel="canonical" href={`${SITE_URL}/busca?q=${encodeURIComponent(q)}`} />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-6 md:py-8">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: `Busca: ${q}` }]} />
            <h1 className="font-black text-[28px] md:text-[36px] leading-tight text-foreground mb-2">
              Resultados para: <span className="text-highlight">"{q}"</span>
            </h1>
            <p className="text-muted-foreground mb-6">{total} produtos encontrados</p>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-6">Nenhum resultado encontrado para "{q}".</p>
                <p className="text-muted-foreground mb-4">Tente navegar por categorias:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/${c.slug}`}
                      className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:border-green-cta transition-colors"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} id={p.id} nome={p.nome} slug={p.slug} image_url={p.image_url} image_urls={p.image_urls} cor={p.cor} preco_custo={p.preco_custo} codigo_amigavel={p.codigo_amigavel} variantes={p.variantes as any} estoque={p.estoque} />
                ))}
              </div>
            )}
            <CatalogPagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </main>
        <Footer />
        <FloatingWhatsApp />
      </div>
    </>
  );
};

export default SearchPage;
