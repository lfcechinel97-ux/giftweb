import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
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

const CATEGORIES: Record<string, string> = {
  copos: "Copos",
  garrafas: "Garrafas",
  mochilas: "Mochilas",
  bolsas: "Bolsas",
  escritorio: "Escritório",
  kits: "Kits",
};

interface CategoryPageProps {
  category: string;
}

const CategoryPage = ({ category }: CategoryPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cores, setCores] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCor, setSelectedCor] = useState<string | null>(null);
  const [apenasEstoque, setApenasEstoque] = useState(false);

  const categoryLabel = CATEGORIES[category] || category;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("products_cache")
      .select("*", { count: "exact" })
      .eq("categoria", category)
      .eq("ativo", true);

    if (searchTerm) query = query.ilike("busca", `%${searchTerm}%`);
    if (selectedCor) query = query.eq("cor", selectedCor);
    if (apenasEstoque) query = query.gt("estoque", 0);

    const { data, count } = await query.order("nome").range(from, to);
    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [category, page, searchTerm, selectedCor, apenasEstoque]);

  // Fetch unique colors for this category
  useEffect(() => {
    supabase
      .from("products_cache")
      .select("cor")
      .eq("categoria", category)
      .eq("ativo", true)
      .not("cor", "is", null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
        setCores(unique.sort());
      });
  }, [category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handlePageChange = (p: number) => {
    setSearchParams({ page: p.toString() });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCor(null);
    setApenasEstoque(false);
  };

  const canonicalUrl = `https://giftweb.com.br/${category}${page > 1 ? `?page=${page}` : ""}`;

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
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    nome={p.nome}
                    slug={p.slug}
                    image_url={p.image_url}
                    cor={p.cor}
                    preco_custo={p.preco_custo}
                    codigo_amigavel={p.codigo_amigavel}
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
