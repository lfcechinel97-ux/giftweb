import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;
const PAGE_SIZE = 20;

const BrindesBaratosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const urlCor = searchParams.get("cor") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCor, setSelectedCor] = useState<string | null>(urlCor || null);
  const [apenasEstoque, setApenasEstoque] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    if (urlCor) setSelectedCor(urlCor);
  }, [urlCor]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("products_cache")
      .select("*", { count: "exact" })
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .lte("preco_custo", 8)
      .gt("estoque", 0);

    if (searchTerm) query = query.ilike("busca", `%${searchTerm}%`);
    if (selectedCor) {
      const corValues = selectedCor.split(",").map(v => v.trim()).filter(Boolean);
      if (corValues.length > 1) query = query.in("cor", corValues);
      else query = query.ilike("cor", `%${corValues[0]}%`);
    }
    if (apenasEstoque) query = query.gt("estoque", 0);

    const { data, count } = await query.order("sort_estoque").order("variantes_count", { ascending: false }).order("estoque", { ascending: false, nullsFirst: false }).range(from, to);
    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, searchTerm, selectedCor, apenasEstoque]);

  useEffect(() => {
    supabase
      .from("products_cache")
      .select("cor")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .lte("preco_custo", 8)
      .gt("estoque", 0)
      .not("cor", "is", null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
        setCores(unique.sort());
      });
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handlePageChange = (p: number) => {
    const params: Record<string, string> = { page: p.toString() };
    if (selectedCor) params.cor = selectedCor;
    setSearchParams(params);
  };
  const clearFilters = () => { setSearchTerm(""); setSelectedCor(null); setApenasEstoque(false); };

  return (
    <>
      <Helmet>
        <title>Brindes Baratos Personalizados | Gift Web</title>
        <meta name="description" content="Brindes baratos e personalizados para empresas. Preços acessíveis a partir de R$ 1,00." />
        <link rel="canonical" href={`${SITE_URL}/brindes-baratos${page > 1 ? `?page=${page}` : ""}`} />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-6 md:py-8">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Brindes Baratos" }]} />
            <h1 className="font-black text-[36px] md:text-[48px] leading-tight text-foreground mb-6">
              Brindes <span className="text-highlight italic">baratos</span>
            </h1>

            <CatalogFilters
              searchTerm={searchTerm} onSearchChange={setSearchTerm}
              cores={cores} selectedCor={selectedCor} onCorChange={setSelectedCor}
              precoRange={[0, 100]} onPrecoRangeChange={() => {}} maxPreco={100}
              apenasEstoque={apenasEstoque} onApenasEstoqueChange={setApenasEstoque}
              onClearFilters={clearFilters} totalProducts={total}
            />

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16"><p className="text-muted-foreground text-lg">Nenhum brinde encontrado.</p></div>
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

export default BrindesBaratosPage;
