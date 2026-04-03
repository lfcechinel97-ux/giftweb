import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/config/site";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import CatalogHeader from "@/components/catalog/CatalogHeader";
import CatalogFooter from "@/components/catalog/CatalogFooter";
import CatalogStoryCategories from "@/components/catalog/CatalogStoryCategories";
import CatalogPagination from "@/components/CatalogPagination";
import CatalogFilterBar from "@/components/catalog/CatalogFilterBar";
import CatalogMobileFilters from "@/components/catalog/CatalogMobileFilters";
import CatalogProductCard, { CatalogProductCardSkeleton } from "@/components/catalog/CatalogProductCard";
import QuotationBar from "@/components/catalog/QuotationBar";
import QuotationDrawer from "@/components/catalog/QuotationDrawer";
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
    apenasEstoque: false,
    sort: searchParams.get("sort") || "relevancia",
  }));

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

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

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = page.toString();
    if (filters.search) params.q = filters.search;
    if (filters.categoria) params.categoria = filters.categoria;
    if (filters.corValues.length) params.cor = filters.corValues.join(",");
    if (filters.precoMin > 0) params.preco_min = filters.precoMin.toString();
    if (filters.precoMax < MAX_PRECO) params.preco_max = filters.precoMax.toString();
    if (filters.sort !== "relevancia") params.sort = filters.sort;
    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const handleFilterChange = useCallback((partial: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
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

  const handleCategorySelect = (slug: string) => {
    setFilters(prev => ({
      ...prev,
      categoria: slug || null,
    }));
    // removed scrollIntoView to prevent unwanted scroll
  };

  return (
    <>
      <Helmet>
        <title>Catálogo Digital de Brindes Personalizados | Gift Web</title>
        <meta name="description" content="Explore nosso catálogo digital de brindes personalizados. Filtre por categoria, preço e cor para encontrar o brinde perfeito para sua marca." />
        <link rel="canonical" href={`${SITE_URL}/catalogo`} />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <CatalogHeader />

        <main className="flex-1">
          {/* Hero title */}
          <section className="bg-gradient-to-b from-[#0B0F1A] to-background pt-6 pb-2 md:pt-8 md:pb-4">
            <div className="container text-center">
              <h1 className="text-2xl md:text-4xl font-bold text-white">
                Explore nosso catálogo de{" "}
                <span className="text-[hsl(var(--green-cta))] italic">brindes</span>
              </h1>
              <p className="text-sm md:text-base text-gray-400 mt-2">
                Filtre por categoria, preço e cor para encontrar o brinde perfeito
              </p>
            </div>
          </section>

          {/* MOBILE: filters inline → stories → products */}
          <div className="lg:hidden container py-4 space-y-4">
            <CatalogMobileFilters
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClear}
              onApply={() => {}}
              cores={cores}
              maxPreco={MAX_PRECO}
              totalProducts={total}
            />
            <CatalogStoryCategories
              selected={filters.categoria}
              onSelect={handleCategorySelect}
            />
          </div>

          {/* DESKTOP: stories → filter bar → products */}
          <div className="hidden lg:block">
            <div className="container">
              <CatalogStoryCategories
                selected={filters.categoria}
                onSelect={handleCategorySelect}
              />
            </div>

            <div className="container py-4 md:py-6">
              <CatalogFilterBar
                filters={filters}
                onChange={handleFilterChange}
                onClear={handleClear}
                cores={cores}
                maxPreco={MAX_PRECO}
                totalProducts={total}
              />
            </div>
          </div>

          {/* Product grid */}
          <div className="container pb-6">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {Array.from({ length: 12 }).map((_, i) => <CatalogProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">Nenhum produto encontrado.</p>
                <p className="text-muted-foreground text-sm mt-1">Tente ajustar os filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {products.map(p => (
                  <CatalogProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            <CatalogPagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </main>

        <CatalogFooter />
        <FloatingWhatsApp />
        <QuotationBar />
        <QuotationDrawer />
      </div>
    </>
  );
};

export default CatalogPage;
