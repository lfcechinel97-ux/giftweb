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
  };

  return (
    <>
      <Helmet>
        <title>Catálogo Digital de Brindes Personalizados | Gift Web</title>
        <meta name="description" content="Explore nosso catálogo digital de brindes personalizados. Filtre por categoria, preço e cor para encontrar o brinde perfeito para sua marca." />
        <link rel="canonical" href={`${SITE_URL}/catalogo`} />
      </Helmet>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F8FAFC" }}>
        <CatalogHeader />

        <main className="flex-1">
          {/* Compact hero with catalog branding */}
          <section className="bg-white border-b border-[#E5E7EB] py-4 md:py-6">
            <div className="container flex flex-col md:flex-row items-center justify-center md:justify-between gap-3 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black italic text-[#0F172A] tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                  catálogo
                </h1>
                <div className="flex flex-col items-start">
                  <span className="text-xs md:text-sm font-bold text-[#0F172A] tracking-wide uppercase">GIFT WEB</span>
                  <span className="text-[9px] md:text-[10px] text-[#64748B] tracking-wide uppercase">BRINDES PERSONALIZADOS</span>
                </div>
              </div>
              <p className="text-[11px] md:text-xs text-[#94A3B8] text-center md:text-right max-w-xs">
                Valores de referência. Melhores condições pelo WhatsApp
              </p>
            </div>
          </section>

          {/* MOBILE: filters inline → products (no stories) */}
          <div className="lg:hidden container py-3 space-y-3">
            <CatalogMobileFilters
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClear}
              onApply={() => {}}
              cores={cores}
              maxPreco={MAX_PRECO}
              totalProducts={total}
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

            <div className="container py-4">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 12 }).map((_, i) => <CatalogProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#64748B] text-base">Nenhum produto encontrado.</p>
                <p className="text-[#94A3B8] text-sm mt-1">Tente ajustar os filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
