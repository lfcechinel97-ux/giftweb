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

const CATEGORY_NAME_FILTERS: Record<string, string> = {
  garrafas: "nome.ilike.GARRAFA%",
  copos: "nome.ilike.COPO%,nome.ilike.CANECA%",
  mochilas: "nome.ilike.MOCHILA%",
  bolsas: "nome.ilike.BOLSA%,nome.ilike.SACOLA%",
  escritorio: "nome.ilike.CANETA%,nome.ilike.BLOCO%,nome.ilike.CADERNO%,nome.ilike.AGENDA%",
  kits: "nome.ilike.KIT%",
};

interface CategoryPageProps {
  category?: string;
}

const CategoryPage = ({ category: categoryProp }: CategoryPageProps) => {
  const { slug } = useParams<{ slug: string }>();
  const category = categoryProp || slug || "";
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

  const categoryLabel = CATEGORIES[category] || category;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const nameFilter = CATEGORY_NAME_FILTERS[category] || "";
  const isSpotlightCategory = !nameFilter && !CATEGORIES[category];

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
      .eq("is_variante", false);

    if (nameFilter) query = query.or(nameFilter);

    if (searchTerm) query = query.ilike("busca", `%${searchTerm}%`);
    if (selectedCor) query = query.ilike("cor", `%${selectedCor}%`);
    if (apenasEstoque) query = query.gt("estoque", 0);

    const { data, count } = await query.order("sort_estoque").order("variantes_count", { ascending: false }).order("estoque", { ascending: false, nullsFirst: false }).range(from, to);
    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [category, page, searchTerm, selectedCor, apenasEstoque, nameFilter]);

  useEffect(() => {
    let q = supabase
      .from("products_cache")
      .select("cor")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .not("cor", "is", null);

    if (nameFilter) q = q.or(nameFilter);

    q.then(({ data }) => {
      const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
      setCores(unique.sort());
    });
  }, [category, nameFilter]);

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

  const canonicalUrl = `${SITE_URL}/${category}${page > 1 ? `?page=${page}` : ""}`;

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
                    id={p.id}
                    nome={p.nome}
                    slug={p.slug}
                    image_url={p.image_url}
                    cor={p.cor}
                    preco_custo={p.preco_custo}
                    codigo_amigavel={p.codigo_amigavel}
                    variantes={p.variantes as any}
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
