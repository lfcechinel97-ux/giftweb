import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { calcularPreco, getDesconto, formatarBRL, getPrecoMinimo, getMarkup } from "@/utils/price";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import HowItWorks from "@/components/HowItWorks";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Minus, Plus, ZoomIn, X, MessageCircle, Ruler, Weight, ArrowUpDown, MoveHorizontal } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;

const QUANTITIES = [20, 50, 100, 200, 300, 500, 1000];

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(20);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    supabase
      .from("products_cache")
      .select("*")
      .eq("slug", slug)
      .eq("ativo", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate("/404", { replace: true });
          return;
        }
        setProduct(data);

        // Fetch related
        supabase
          .from("products_cache")
          .select("*")
          .eq("categoria", data.categoria!)
          .eq("ativo", true)
          .gt("estoque", 0)
          .neq("slug", slug)
          .limit(4)
          .then(({ data: rel }) => setRelated(rel || []));

        setLoading(false);
      });
  }, [slug, navigate]);

  const precoBase = product?.preco_custo ? product.preco_custo * getMarkup(product.preco_custo) : 0;
  const precoAtual = product?.preco_custo ? calcularPreco(product.preco_custo, qty) : 0;
  const precoMin = product?.preco_custo ? getPrecoMinimo(product.preco_custo) : 0;

  const tableRows = useMemo(() => {
    if (!product?.preco_custo) return [];
    return QUANTITIES.map((q) => {
      const unit = calcularPreco(product.preco_custo!, q);
      const base = precoBase;
      const desc = getDesconto(q);
      return { qty: q, unit, base, desc, total: unit * q };
    });
  }, [product?.preco_custo, precoBase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const canonicalUrl = `https://giftweb.com.br/produto/${product.slug}`;
  const categorySlug = product.categoria || "outros";
  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no produto: ${product.nome} (Cód: ${product.codigo_amigavel}). Quantidade: ${qty} unidades. Podem me enviar um orçamento?`
  );

  return (
    <>
      <Helmet>
        <title>{product.nome} | Gift Web Brindes Personalizados</title>
        <meta name="description" content={`${product.nome} personalizado para empresas. Solicite orçamento.`} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={`${product.nome} | Gift Web Brindes Personalizados`} />
        <meta property="og:description" content={`${product.nome} personalizado para empresas. Solicite orçamento.`} />
        {product.image_url && <meta property="og:image" content={product.image_url} />}
        <meta property="og:url" content={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "Product",
            name: product.nome,
            image: product.image_url,
            description: product.descricao,
            sku: product.codigo_amigavel,
            brand: { "@type": "Brand", name: "Gift Web" },
            offers: {
              "@type": "Offer",
              priceCurrency: "BRL",
              price: product.preco_custo ? calcularPreco(product.preco_custo, 20).toFixed(2) : "0",
              availability: "https://schema.org/InStock",
              seller: { "@type": "Organization", name: "Gift Web Brindes" },
            },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-6 md:py-8">
            <Breadcrumbs
              items={[
                { label: "Início", href: "/" },
                { label: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1), href: `/${categorySlug}` },
                { label: product.nome },
              ]}
            />

            {/* Main layout */}
            <div className="grid md:grid-cols-[55%_45%] gap-6 md:gap-8">
              {/* Gallery */}
              <div className="relative">
                <div className="aspect-square rounded-2xl border border-border overflow-hidden bg-secondary relative group">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sem imagem</div>
                  )}
                  {product.image_url && (
                    <button
                      onClick={() => setLightbox(true)}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-card/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ZoomIn className="w-4 h-4 text-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col gap-4">
                <h1 className="font-black text-[28px] md:text-[32px] leading-tight text-foreground">{product.nome}</h1>
                <span className="text-[13px] text-muted-foreground">Código: {product.codigo_amigavel}</span>

                <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                  <Clock className="w-4 h-4" />
                  <span>Prazo de produção: 20 dias úteis</span>
                </div>

                {product.cor && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-muted-foreground border border-border" />
                    <span className="text-foreground text-sm font-medium">{product.cor}</span>
                  </div>
                )}

                {/* Stock badge */}
                {product.estoque != null && product.estoque > 0 ? (
                  <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-green-cta/15 text-green-cta text-xs font-semibold">
                    Em estoque
                  </span>
                ) : (
                  <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-semibold">
                    Indisponível
                  </span>
                )}

                {/* Min price highlight */}
                {product.preco_custo != null && product.preco_custo > 0 && (
                  <div className="mt-2">
                    <span className="text-green-cta font-bold text-[22px]">
                      A partir de {formatarBRL(precoMin)} / unidade
                    </span>
                    <p className="text-muted-foreground text-[13px]">Pedido mínimo: 20 unidades</p>
                  </div>
                )}

                {/* Dimensions */}
                {(product.altura || product.largura || product.profundidade || product.peso) && (
                  <div className="grid grid-cols-2 gap-2">
                    {product.altura != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Altura</span>
                          <span className="text-foreground text-sm font-medium">{product.altura} cm</span>
                        </div>
                      </div>
                    )}
                    {product.largura != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                        <MoveHorizontal className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Largura</span>
                          <span className="text-foreground text-sm font-medium">{product.largura} cm</span>
                        </div>
                      </div>
                    )}
                    {product.profundidade != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Comprimento</span>
                          <span className="text-foreground text-sm font-medium">{product.profundidade} cm</span>
                        </div>
                      </div>
                    )}
                    {product.peso != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                        <Weight className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Peso</span>
                          <span className="text-foreground text-sm font-medium">{product.peso} g</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing table */}
                {product.preco_custo != null && product.preco_custo > 0 && (
                  <div className="mt-4">
                    <h3 className="font-bold text-lg text-foreground mb-3">Compre com desconto</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary">
                            <th className="text-left p-3 text-muted-foreground font-medium">Qtd</th>
                            <th className="text-left p-3 text-muted-foreground font-medium">Preço/un</th>
                            <th className="text-left p-3 text-muted-foreground font-medium">Economia</th>
                            <th className="text-right p-3 text-muted-foreground font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row) => (
                            <tr key={row.qty} className="border-t border-border hover:bg-secondary/50 transition-colors">
                              <td className="p-3 text-foreground font-medium">
                                {row.qty}
                                {row.qty === 20 && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground">Mínimo</span>
                                )}
                                {row.qty === 100 && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-cta/15 text-green-cta">Mais popular</span>
                                )}
                              </td>
                              <td className="p-3">
                                {row.desc > 0 && (
                                  <span className="text-muted-foreground line-through text-xs mr-1.5">{formatarBRL(row.base)}</span>
                                )}
                                <span className="text-foreground font-medium">{formatarBRL(row.unit)}</span>
                              </td>
                              <td className="p-3">
                                {row.desc > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-cta/15 text-green-cta">
                                    Economize {Math.round(row.desc * 100)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right text-foreground font-semibold">{formatarBRL(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Quantity selector */}
                <div className="mt-4 p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQty(Math.max(20, qty - 10))}
                      className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:border-green-cta transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={20}
                      value={qty}
                      onChange={(e) => setQty(Math.max(20, parseInt(e.target.value) || 20))}
                      className="w-20 text-center py-2 rounded-lg bg-background border border-border text-foreground font-bold text-lg focus:outline-none focus:border-green-cta"
                    />
                    <button
                      onClick={() => setQty(qty + 10)}
                      className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:border-green-cta transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {product.preco_custo != null && product.preco_custo > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground">
                        {qty}x {product.nome} — {formatarBRL(precoAtual)} / unidade
                      </p>
                      <p className="text-foreground font-bold text-lg mt-1">
                        Total: {formatarBRL(precoAtual * qty)}
                      </p>
                    </div>
                  )}
                </div>

                {/* WhatsApp button */}
                <a
                  href={`https://wa.me/5548996525312?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full h-14 rounded-xl bg-green-cta text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  style={{ boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}
                >
                  <MessageCircle className="w-5 h-5" />
                  Solicitar orçamento no WhatsApp
                </a>
              </div>
            </div>

            {/* Description */}
            {product.descricao && (
              <div className="mt-10">
                <h3 className="font-bold text-xl text-foreground mb-3">Descrição</h3>
                <p className="text-muted-foreground text-[15px] leading-[1.7] whitespace-pre-line">{product.descricao}</p>
              </div>
            )}

            {/* Related products */}
            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="font-extrabold text-[24px] text-foreground mb-6">
                  Produtos <span className="text-highlight">relacionados</span>
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto">
                  {related.map((p) => (
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
              </div>
            )}
          </div>

          <HowItWorks />
        </main>
        <Footer />
        <FloatingWhatsApp />

        {/* Lightbox */}
        {lightbox && product.image_url && (
          <div
            className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center">
              <X className="w-5 h-5 text-foreground" />
            </button>
            <img src={product.image_url} alt={product.nome} className="max-w-full max-h-[90vh] object-contain rounded-xl" />
          </div>
        )}
      </div>
    </>
  );
};

export default ProductDetail;
