import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
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

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const category = slug || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const urlCor = searchParams.get("cor") || "";
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);
  const [categoryLabel, setCategoryLabel] = useState<string>(category);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCor, setSelectedCor] = useState<string | null>(urlCor || null);
  const [apenasEstoque, setApenasEstoque] = useState(false);
  const [sortBy, setSortBy] = useState("relevancia");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Fetch label from spotlight_categories
  useEffect(() => {
    if (!category) return;
    supabase
      .from("spotlight_categories")
      .select("label")
      .eq("slug", category)
      .single()
      .then(({ data }) => {
        if (data) setCategoryLabel(data.label);
      });
  }, [category]);

  useEffect(() => {
    if (urlCor) setSelectedCor(urlCor);
  }, [urlCor]);

  // Fetch available colors via RPC
  useEffect(() => {
    if (!category) return;
    supabase.rpc("get_category_colors", { p_category_slug: category }).then(({ data }) => {
      if (data && Array.isArray(data)) {
        setCores(data.filter(Boolean).sort());
      }
    });
  }, [category]);

  const fetchProducts = useCallback(async () => {
    if (!category) return;
    setLoading(true);

    const corValues = selectedCor
      ? selectedCor.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean)
      : null;

    const { data, error } = await supabase.rpc("search_products_by_category", {
      p_category_slug: category,
      p_cor: corValues,
      p_search: searchTerm || null,
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
  }, [category, page, searchTerm, selectedCor, apenasEstoque, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handlePageChange = (p: number) => {
    const params: Record<string, string> = { page: p.toString() };
    if (selectedCor) params.cor = selectedCor;
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCor(null);
    setApenasEstoque(false);
  };

  const canonicalUrl = `${SITE_URL}/categoria/${category}${page > 1 ? `?page=${page}` : ""}`;

  return (
    <>
      <Helmet>
        <title>{categoryLabel} Personalizados | Gift Web Brindes</title>
        <meta name="description" content={`${categoryLabel} personalizados para empresas. Catálogo com preços para atacado.`} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-6 md:py-8">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: categoryLabel }]} />
            <h1 className="font-black text-[36px] md:text-[48px] leading-tight text-foreground mb-6">
              <span className="text-highlight">{categoryLabel}</span> Personalizados
            </h1>

            <CatalogFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">Nenhum produto encontrado nesta categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {products.map((p: any) => (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    nome={p.nome}
                    slug={p.slug}
                    image_url={p.image_url}
                    cor={p.cor}
                    preco_custo={p.preco_custo}
                    codigo_amigavel={p.codigo_amigavel}
                    image_urls={p.image_urls}
                    variantes={p.variantes}
                    estoque={p.estoque}
                  />
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

export default CategoryPage;
