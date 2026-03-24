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
import CatalogFilters from "@/components/CatalogFilters";
import CatalogPagination from "@/components/CatalogPagination";

const PAGE_SIZE = 20;

const CATEGORIES = [
  { slug: "copos-e-canecas", label: "Copos e Canecas" },
  { slug: "garrafas-e-squeezes", label: "Garrafas e Squeezes" },
  { slug: "mochilas-e-sacochilas", label: "Mochilas" },
  { slug: "bolsas", label: "Bolsas" },
  { slug: "canetas", label: "Canetas" },
  { slug: "kits", label: "Kits" },
  { slug: "chaveiros", label: "Chaveiros" },
  { slug: "guarda-chuvas", label: "Guarda-chuvas" },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const urlCor = searchParams.get("cor") || "";
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);

  const [selectedCor, setSelectedCor] = useState<string | null>(urlCor || null);
  const [apenasEstoque, setApenasEstoque] = useState(false);
  const [sortBy, setSortBy] = useState("relevancia");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    if (urlCor) setSelectedCor(urlCor);
  }, [urlCor]);

  // Fetch available colors for the search results
  useEffect(() => {
    if (!q) return;
    supabase
      .from("products_cache")
      .select("cor")
      .eq("ativo", true)
      .eq("has_image", true)
      .ilike("busca", `%${q}%`)
      .not("cor", "is", null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
        setCores(unique.sort());
      });
  }, [q]);

  const fetchResults = useCallback(async () => {
    if (!q && !selectedCor) { setProducts([]); setTotal(0); setLoading(false); return; }
    setLoading(true);

    const corValues = selectedCor
      ? selectedCor.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean)
      : null;

    const { data, error } = await supabase.rpc("search_products_global", {
      p_cor: corValues,
      p_search: q || null,
      p_apenas_estoque: apenasEstoque,
      p_sort: sortBy,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });

    if (error) {
      console.error("RPC error:", error);
      setProducts([]);
      setTotal(0);
    } else if (data) {
      setProducts(data.rows || []);
      setTotal(data.total_count || 0);
    }
    setLoading(false);
  }, [q, page, selectedCor, apenasEstoque, sortBy]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const handlePageChange = (p: number) => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    params.page = p.toString();
    if (selectedCor) params.cor = selectedCor;
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    setSelectedCor(null);
    setApenasEstoque(false);
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

            <CatalogFilters
              searchTerm=""
              onSearchChange={() => {}}
              cores={cores}
              selectedCor={selectedCor}
              onCorChange={setSelectedCor}
              precoRange={[0, 100]}
              onPrecoRangeChange={() => {}}
              maxPreco={100}
              apenasEstoque={apenasEstoque}
              onApenasEstoqueChange={setApenasEstoque}
              onClearFilters={clearFilters}
              totalProducts={total}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

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
                      to={`/categoria/${c.slug}`}
                      className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:border-green-cta transition-colors"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {products.map((p: any) => (
                  <ProductCard key={p.id} id={p.id} nome={p.nome} slug={p.slug} image_url={p.image_url} image_urls={p.image_urls} cor={p.cor} preco_custo={p.preco_custo} codigo_amigavel={p.codigo_amigavel} variantes={p.variantes} estoque={p.estoque} />
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
