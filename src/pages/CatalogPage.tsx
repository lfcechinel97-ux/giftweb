import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/config/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import CatalogPagination from "@/components/CatalogPagination";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import CatalogMobileFilters from "@/components/catalog/CatalogMobileFilters";
import QuotationBar from "@/components/catalog/QuotationBar";
import QuotationDrawer from "@/components/catalog/QuotationDrawer";
import { Plus } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";
import { calcularPreco } from "@/utils/price";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;
const PAGE_SIZE = 24;
const MAX_PRECO = 400;

interface Filters {
  search: string;
  categoria: string | null;
  corValues: string[];
  precoMin: number;
  precoMax: number;
  apenasEstoque: boolean;
  sort: string;
}

const defaultFilters: Filters = {
  search: "",
  categoria: null,
  corValues: [],
  precoMin: 0,
  precoMax: MAX_PRECO,
  apenasEstoque: false,
  sort: "relevancia",
};

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");

  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("q") || "",
    categoria: searchParams.get("categoria") || null,
    corValues: searchParams.get("cor") ? searchParams.get("cor")!.split(",") : [],
    precoMin: Number(searchParams.get("preco_min") || 0),
    precoMax: Number(searchParams.get("preco_max") || MAX_PRECO),
    apenasEstoque: searchParams.get("estoque") === "1",
    sort: searchParams.get("sort") || "relevancia",
  }));

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const { addItem } = useQuotation();

  // Fetch available colors
  useEffect(() => {
    supabase
      .from("products_cache")
      .select("cor")
      .eq("ativo", true)
      .eq("has_image", true)
      .not("cor", "is", null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(d => d.cor).filter(Boolean))] as string[];
        setCores(unique.sort());
      });
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const corValues = filters.corValues.length > 0
      ? filters.corValues.map(v => v.trim().toUpperCase()).filter(Boolean)
      : null;

    // Use category-specific or global RPC
    if (filters.categoria) {
      const { data, error } = await supabase.rpc("search_products_by_category", {
        p_category_slug: filters.categoria,
        p_cor: corValues,
        p_search: filters.search || null,
        p_apenas_estoque: filters.apenasEstoque,
        p_sort: filters.sort,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_preco_min: filters.precoMin > 0 ? filters.precoMin : null,
        p_preco_max: filters.precoMax < MAX_PRECO ? filters.precoMax : null,
      } as any);

      if (error) { console.error(error); setProducts([]); setTotal(0); }
      else if (data) {
        const result = data as unknown as { rows: any[]; total_count: number };
        setProducts((result.rows || []) as Product[]);
        setTotal(result.total_count || 0);
      }
    } else {
      const { data, error } = await supabase.rpc("search_products_global", {
        p_cor: corValues,
        p_search: filters.search || null,
        p_apenas_estoque: filters.apenasEstoque,
        p_sort: filters.sort,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_preco_min: filters.precoMin > 0 ? filters.precoMin : null,
        p_preco_max: filters.precoMax < MAX_PRECO ? filters.precoMax : null,
      } as any);

      if (error) { console.error(error); setProducts([]); setTotal(0); }
      else if (data) {
        const result = data as unknown as { rows: any[]; total_count: number };
        setProducts((result.rows || []) as Product[]);
        setTotal(result.total_count || 0);
      }
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = page.toString();
    if (filters.search) params.q = filters.search;
    if (filters.categoria) params.categoria = filters.categoria;
    if (filters.corValues.length) params.cor = filters.corValues.join(",");
    if (filters.precoMin > 0) params.preco_min = filters.precoMin.toString();
    if (filters.precoMax < MAX_PRECO) params.preco_max = filters.precoMax.toString();
    if (filters.apenasEstoque) params.estoque = "1";
    if (filters.sort !== "relevancia") params.sort = filters.sort;
    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const handleFilterChange = useCallback((partial: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
    // Reset to page 1 on filter change
    if (Object.keys(partial).some(k => k !== "sort")) {
      setSearchParams(prev => { prev.delete("page"); return prev; }, { replace: true });
    }
  }, [setSearchParams]);

  const handleClear = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const handlePageChange = (p: number) => {
    setSearchParams(prev => { prev.set("page", p.toString()); return prev; }, { replace: true });
  };

  const handleAddToQuote = (product: Product) => {
    addItem({
      id: product.id,
      name: product.nome,
      image: product.image_url || "/placeholder-product.webp",
      price: product.preco_custo,
      codigo_amigavel: product.codigo_amigavel,
    });
  };

  return (
    <>
      <Helmet>
        <title>Catálogo de Brindes Personalizados | Gift Web</title>
        <meta name="description" content="Explore nosso catálogo completo de brindes personalizados. Filtre por categoria, preço e cor para encontrar o brinde perfeito para sua marca." />
        <link rel="canonical" href={`${SITE_URL}/catalogo`} />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          {/* Hero compacto */}
          <section className="bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy-dark))] to-[hsl(222,47%,10%)] py-10 md:py-14">
            <div className="container text-center">
              <h1 className="font-black text-3xl md:text-5xl text-primary-foreground leading-tight mb-3">
                Explore nosso catálogo de <span className="text-green-cta italic">brindes</span>
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
                Filtre por categoria, preço e cor para encontrar o brinde perfeito para sua marca.
              </p>
            </div>
          </section>

          <div className="container py-6 md:py-8">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Catálogo" }]} />

            {/* Mobile filter trigger + count */}
            <div className="flex items-center justify-between lg:hidden mb-4">
              <CatalogMobileFilters
                filters={filters}
                onChange={handleFilterChange}
                onClear={handleClear}
                onApply={() => {}}
                cores={cores}
                maxPreco={MAX_PRECO}
                totalProducts={total}
              />
              <span className="text-sm text-muted-foreground">{total} produtos</span>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-8">
              <CatalogSidebar
                filters={filters}
                onChange={handleFilterChange}
                onClear={handleClear}
                cores={cores}
                maxPreco={MAX_PRECO}
              />

              <div className="flex-1 min-w-0">
                {/* Desktop count */}
                <div className="hidden lg:flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{total} produtos encontrados</p>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground text-lg">Nenhum produto encontrado.</p>
                    <p className="text-muted-foreground text-sm mt-1">Tente ajustar os filtros.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map(p => (
                      <div key={p.id} className="relative group/card">
                        <ProductCard
                          id={p.id}
                          nome={p.nome}
                          slug={p.slug}
                          image_url={p.image_url}
                          image_urls={p.image_urls}
                          cor={p.cor}
                          preco_custo={p.preco_custo}
                          codigo_amigavel={p.codigo_amigavel}
                          variantes={p.variantes as any}
                          estoque={p.estoque}
                        />
                        <button
                          onClick={() => handleAddToQuote(p)}
                          title="Adicionar ao orçamento"
                          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-green-cta text-primary-foreground flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg hover:brightness-110"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <CatalogPagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
        <FloatingWhatsApp />
        <QuotationBar />
        <QuotationDrawer />
      </div>
    </>
  );
};

export default CatalogPage;
