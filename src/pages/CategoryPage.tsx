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

// Maps spotlight slug → real products_cache.categoria values
const SPOTLIGHT_TO_CATEGORIA: Record<string, string[]> = {
  "copos-e-canecas": ["copos"],
  "garrafas-e-squeezes": ["garrafas"],
  "mochilas-e-sacochilas": ["mochilas"],
  "bolsas": ["bolsas"],
  "canetas": ["escritorio"],
  "cadernetas": ["escritorio"],
  "cadernos": ["escritorio"],
  "blocos": ["escritorio"],
  "agendas": ["escritorio"],
  "kits": ["kits"],
  "escritorio": ["escritorio"],
  "sacolas": ["bolsas"],
  "necessaires": ["bolsas"],
  "estojos": ["bolsas"],
  "pastas": ["bolsas"],
  "malas": ["bolsas"],
  "chaveiros": ["outros"],
  "guarda-chuvas": ["outros"],
  "pen-drives": ["outros"],
  "power-banks": ["outros"],
  "fones": ["outros"],
  "mouse-pads": ["outros"],
  "suportes": ["outros"],
  "espelhos": ["outros"],
  "porta-retratos": ["outros"],
  "porta-joias": ["outros"],
  "porta-objetos": ["outros"],
  "cozinha-e-mesa": ["outros"],
  "marmitas": ["outros"],
  "toalhas": ["outros"],
  "caixas-de-som": ["outros"],
  "caixas-organizadoras": ["outros"],
  "casa-e-decoracao": ["outros"],
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const category = slug || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const urlCor = searchParams.get("cor") || "";
  const [products, setProducts] = useState<Product[]>([]);
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

  const applySort = (query: any, sort: string) => {
    if (sort === "menor_preco") return query.order("preco_custo", { ascending: true, nullsFirst: false });
    if (sort === "maior_preco") return query.order("preco_custo", { ascending: false, nullsFirst: false });
    if (sort === "maior_estoque") return query.order("estoque", { ascending: false, nullsFirst: false });
    if (sort === "az") return query.order("nome", { ascending: true });
    return query.order("sort_estoque").order("variantes_count", { ascending: false }).order("estoque", { ascending: false, nullsFirst: false });
  };

  const fetchProducts = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const hasActiveFilters = !!(selectedCor || searchTerm || apenasEstoque);
    const categoriasReais = SPOTLIGHT_TO_CATEGORIA[category];

    // When filters are active AND we have a direct category mapping,
    // bypass the join table and query products_cache directly
    if (hasActiveFilters && categoriasReais) {
      let query = supabase
        .from("products_cache")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .eq("has_image", true)
        .in("categoria", categoriasReais);

      // Don't filter out variants when color filter is active
      if (!selectedCor) {
        query = query.eq("is_variante", false);
      }

      if (searchTerm) query = query.ilike("busca", `%${searchTerm}%`);
      if (selectedCor) {
        const corValues = selectedCor.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
        query = query.in("cor", corValues);
      }
      if (apenasEstoque) query = query.gt("estoque", 0);
      query = applySort(query, sortBy);

      const { data, count } = await query.range(from, to);
      setProducts(data || []);
      setTotal(count || 0);
      setLoading(false);
      return;
    }

    // Default flow: use join table for curated display
    const { data: catData } = await supabase
      .from("spotlight_categories")
      .select("id")
      .eq("slug", category)
      .single();

    if (!catData) {
      setProducts([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const { data: idData } = await supabase
      .from("product_spotlight_categories")
      .select("product_id")
      .eq("category_id", catData.id)
      .range(0, 4999);

    const productIds = (idData || []).map((d) => d.product_id);
    if (productIds.length === 0) {
      setProducts([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("products_cache")
      .select("*", { count: "exact" })
      .in("id", productIds)
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false);

    if (searchTerm) query = query.ilike("busca", `%${searchTerm}%`);
    if (apenasEstoque) query = query.gt("estoque", 0);
    query = applySort(query, sortBy);

    const { data, count } = await query.range(from, to);
    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [category, page, searchTerm, selectedCor, apenasEstoque, sortBy]);

  // Fetch available colors for filters — use direct category when mapping exists
  useEffect(() => {
    if (!category) return;
    (async () => {
      const categoriasReais = SPOTLIGHT_TO_CATEGORIA[category];

      if (categoriasReais) {
        // Direct query on products_cache by real categoria values
        const { data } = await supabase
          .from("products_cache")
          .select("cor")
          .in("categoria", categoriasReais)
          .eq("ativo", true)
          .eq("has_image", true)
          .not("cor", "is", null);

        const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
        setCores(unique.sort());
        return;
      }

      // Fallback: use join table
      const { data: catData } = await supabase
        .from("spotlight_categories")
        .select("id")
        .eq("slug", category)
        .single();
      if (!catData) return;

      const { data: idData } = await supabase
        .from("product_spotlight_categories")
        .select("product_id")
        .eq("category_id", catData.id)
        .range(0, 4999);

      const productIds = (idData || []).map((d) => d.product_id);
      if (productIds.length === 0) return;

      const { data } = await supabase
        .from("products_cache")
        .select("cor")
        .in("id", productIds)
        .eq("ativo", true)
        .eq("has_image", true)
        .not("cor", "is", null);

      const unique = [...new Set((data || []).map((d) => d.cor).filter(Boolean))] as string[];
      setCores(unique.sort());
    })();
  }, [category]);

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
                    image_urls={p.image_urls}
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
