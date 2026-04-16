import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { calcularPreco, getDesconto, formatarBRL, getPrecoMinimo, getMarkup } from "@/utils/price";
import { getCorHex } from "@/utils/colorHex";
import { PRAZO_PRODUCAO, WHATSAPP_NUMBER, SITE_URL } from "@/config/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import HowItWorks from "@/components/HowItWorks";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Minus, Plus, X, Ruler, Weight, ArrowUpDown, MoveHorizontal, Truck, Palette, Building2, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;

interface VariantInfo {
  slug: string;
  cor: string | null;
  codigo_amigavel: string;
  image: string | null;
  estoque: number | null;
}

const QUANTITIES = [20, 50, 100, 200, 300, 500, 1000];

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [currentVariantData, setCurrentVariantData] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<VariantInfo | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(20);
  const [selectedRow, setSelectedRow] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lbActive, setLbActive] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const qtySelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase
      .from("products_cache")
      .select("*")
      .eq("slug", slug)
      .eq("ativo", true)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { navigate("/404", { replace: true }); return; }

        setCurrentVariantData(data);

        // If this is a variant, load the parent product so we can get all variantes JSONB
        let baseProduct = data;
        if (data.is_variante && data.produto_pai) {
          const { data: parentData } = await supabase
            .from("products_cache")
            .select("*")
            .eq("id", data.produto_pai)
            .single();
          if (parentData) baseProduct = parentData;
        }

        setProduct(baseProduct);
        // Set the initial selected variant based on the URL slug
        setSelectedVariant({
          slug: data.slug || '',
          cor: data.cor,
          codigo_amigavel: data.codigo_amigavel,
          image: data.image_url,
          estoque: data.estoque,
        });
        setActiveImg(0);

        const { data: relatedData } = await supabase
          .from("products_cache")
          .select("*")
          .eq("categoria", baseProduct.categoria!)
          .eq("ativo", true)
          .eq("has_image", true)
          .eq("is_variante", false)
          .gt("estoque", 0)
          .neq("slug", baseProduct.slug)
          .order("variantes_count", { ascending: false })
          .limit(4);

        setRelated(relatedData || []);
        setLoading(false);
      });
  }, [slug, navigate]);

  // The main image is from the selected variant (or base product)
  const mainImage = useMemo(() => {
    return selectedVariant?.image || product?.image_url || '';
  }, [selectedVariant, product]);

  // When a non-base variant is selected, fetch its own image_urls from the DB
  const [variantExtraImages, setVariantExtraImages] = useState<string[]>([]);
  useEffect(() => {
    const isBase = !selectedVariant || selectedVariant.slug === product?.slug;
    if (isBase) { setVariantExtraImages([]); return; }
    // Fetch the variant row to get its image_urls
    supabase
      .from('products_cache')
      .select('image_url, image_urls')
      .eq('slug', selectedVariant.slug)
      .single()
      .then(({ data }) => {
        if (!data) { setVariantExtraImages([]); return; }
        const urls = Array.isArray(data.image_urls) ? (data.image_urls as string[]) : [];
        const merged = data.image_url && !urls.includes(data.image_url)
          ? [data.image_url, ...urls]
          : (urls.length ? urls : (data.image_url ? [data.image_url] : []));
        // Extra = everything except the first (which is already mainImage)
        setVariantExtraImages(merged.slice(1));
      });
  }, [selectedVariant?.slug, product?.slug]);

  // Build ALL images:
  // - When base product is selected → show all images (API + admin-uploaded)
  // - When a variant is selected → show variant image + variant's own extra images
  const allImages = useMemo(() => {
    if (!product) return [];
    const isBaseSelected = !selectedVariant || selectedVariant.slug === product.slug;

    let extra: string[];
    if (isBaseSelected) {
      const urls = Array.isArray(product.image_urls) ? (product.image_urls as string[]) : [];
      extra = urls;
    } else {
      extra = variantExtraImages;
    }

    const all = [mainImage, ...extra].filter((img): img is string => !!img && img.trim() !== '' && img !== 'null');
    return all.filter((img, i, arr) => arr.indexOf(img) === i);
  }, [product?.image_urls, mainImage, selectedVariant?.slug, product?.slug, variantExtraImages]);

  // Thumbnail images = all except the active main (shown below main image)
  const [displayedMain, setDisplayedMain] = useState('');
  useEffect(() => {
    setDisplayedMain(mainImage);
    setActiveImg(0);
  }, [mainImage]);

  const handleThumbClick = (src: string, idx: number) => {
    if (src === displayedMain || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setDisplayedMain(src);
      setActiveImg(idx);
      setIsTransitioning(false);
    }, 150);
  };

  // Build variants list from the JSONB `variantes` field on the base product.
  // The base product's `variantes` JSON contains all OTHER colors.
  // We add the base product itself as the first option, then merge the others.
  // If we navigated to a variant that is NOT in the list (e.g. it's the base product
  // displayed as a variant), we also ensure the currentVariantData is always present.
  const allVariants = useMemo((): VariantInfo[] => {
    if (!product) return [];

    // Build base option (the parent/current product itself)
    const baseOption: VariantInfo = {
      slug: product.slug || '',
      cor: product.cor,
      codigo_amigavel: product.codigo_amigavel,
      image: product.image_url,
      estoque: product.estoque,
    };

    // Parse variantes JSON — may come as array of objects
    const rawVariantes = product.variantes;
    const variantesArray: any[] = Array.isArray(rawVariantes)
      ? rawVariantes
      : (rawVariantes && typeof rawVariantes === 'object' ? Object.values(rawVariantes) : []);

    const othersFromJson: VariantInfo[] = variantesArray.map((v: any) => ({
      slug: v.slug || '',
      cor: v.cor || null,
      codigo_amigavel: v.codigo_amigavel || '',
      image: v.image || null,
      estoque: typeof v.estoque === 'number' ? v.estoque : null,
    }));

    // Merge: parent first, then others (deduplicated by slug)
    const all: VariantInfo[] = [baseOption, ...othersFromJson];
    const seen = new Set<string>();
    const merged = all.filter(v => {
      if (!v.slug || seen.has(v.slug)) return false;
      seen.add(v.slug);
      return true;
    });

    // If the current page slug is a variant not yet in the list, add it
    if (currentVariantData && currentVariantData.is_variante) {
      const slug = currentVariantData.slug || '';
      if (slug && !seen.has(slug)) {
        merged.push({
          slug,
          cor: currentVariantData.cor,
          codigo_amigavel: currentVariantData.codigo_amigavel,
          image: currentVariantData.image_url,
          estoque: currentVariantData.estoque,
        });
      }
    }

    return merged;
  }, [product, currentVariantData]);

  // Active variant = the one selected locally (defaults to the URL slug on load)
  const activeVariantSlug = selectedVariant?.slug || product?.slug || '';

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightbox(false); return; }
      if (e.key === 'ArrowLeft') setLbActive(i => (i - 1 + allImages.length) % allImages.length);
      if (e.key === 'ArrowRight') setLbActive(i => (i + 1) % allImages.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, allImages.length]);

  const displayCodigo = selectedVariant?.codigo_amigavel || product?.codigo_amigavel || '';
  const displayEstoque = selectedVariant?.estoque ?? product?.estoque;
  const displayPrecoCusto = product?.preco_custo;
  const displayNome = product?.nome || '';

  const precoBase = displayPrecoCusto ? displayPrecoCusto * getMarkup(displayPrecoCusto) : 0;
  const precoAtual = displayPrecoCusto ? calcularPreco(displayPrecoCusto, qty) : 0;
  const precoMin = displayPrecoCusto ? getPrecoMinimo(displayPrecoCusto) : 0;

  const tableRows = useMemo(() => {
    if (!displayPrecoCusto) return [];
    // Use custom price table if available, otherwise fall back to global defaults
    const customTable = product?.tabela_precos;
    const customRows = Array.isArray(customTable) ? (customTable as { qty: number; desconto: number }[]) : null;
    if (customRows && customRows.length > 0) {
      const markup = getMarkup(displayPrecoCusto);
      return customRows.map(r => ({
        qty: r.qty,
        unit: displayPrecoCusto * markup * (1 - r.desconto),
        base: precoBase,
        desc: r.desconto,
      }));
    }
    return QUANTITIES.map(q => ({
      qty: q,
      unit: calcularPreco(displayPrecoCusto, q),
      base: precoBase,
      desc: getDesconto(q),
    }));
  }, [displayPrecoCusto, precoBase, product?.tabela_precos]);

  const handleSelectRow = (index: number) => {
    setSelectedRow(index);
    const rowQty = tableRows[index]?.qty ?? QUANTITIES[index];
    setQty(rowQty);
    qtySelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
            <Skeleton className="aspect-square rounded-2xl w-full" />
            <div className="space-y-3">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const canonicalSlug = product.slug;
  const canonicalUrl = `${SITE_URL}/produto/${canonicalSlug}`;
  const categorySlug = product.categoria || "outros";
  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no produto: ${displayNome} (Cód: ${displayCodigo}). Quantidade: ${qty} unidades. Podem me enviar um orçamento?`
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
          <div className="w-full max-w-5xl mx-auto px-4 py-4 md:py-8">
            <Breadcrumbs
              items={[
                { label: "Início", href: "/" },
                { label: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1), href: `/${categorySlug}` },
                { label: product.nome },
              ]}
            />

            {/* ── Main area: stacked on mobile, 2 cols on md+ ── */}
            <div className="flex flex-col md:grid md:grid-cols-2 gap-5 md:gap-8 mt-4">

              {/* LEFT: Gallery + Description */}
              <div className="flex flex-col gap-3 w-full min-w-0">
                {/* Main image */}
                <div
                  className="relative w-full rounded-2xl border border-border bg-white overflow-hidden flex items-center justify-center cursor-zoom-in"
                  style={{ aspectRatio: '1/1' }}
                  onClick={() => { setLbActive(activeImg); setLightbox(true); }}
                >
                  {displayedMain && (
                    <img
                      src={displayedMain}
                      alt={product.nome}
                      className="w-full h-full object-contain p-3 md:p-6"
                      style={{ opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.15s ease' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.webp"; }}
                    />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setLbActive(activeImg); setLightbox(true); }}
                    className="absolute bottom-3 left-3 w-8 h-8 rounded-lg bg-white/90 border border-border flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                    title="Ampliar imagem"
                  >
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Thumbnail row — all images (API + admin), excluding the currently displayed main */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {allImages.map((src, i) => (
                      <button
                        key={src + i}
                        onClick={() => handleThumbClick(src, i)}
                        className="shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all duration-150 bg-white"
                        style={{ borderColor: displayedMain === src ? 'hsl(142,71%,45%)' : 'hsl(var(--border))' }}
                      >
                        <img src={src} alt={`foto ${i + 1}`} className="w-full h-full object-contain p-1 pointer-events-none" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Description — inside left column, below gallery */}
                {product.descricao && (
                  <div className="mt-1 p-3 rounded-xl bg-secondary border border-border">
                    <h3 className="font-semibold text-sm text-foreground mb-1.5">Descrição</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-line">{product.descricao}</p>
                  </div>
                )}

                {/* Payment — desktop only, below description */}
                <div className="hidden md:flex gap-2 items-stretch p-3 rounded-xl bg-secondary divide-x divide-border">
                  {/* PIX */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" className="w-6 h-6 text-muted-foreground" fill="currentColor">
                      <path d="M 15 1.0996094 C 13.975 1.0996094 12.949922 1.4895313 12.169922 2.2695312 L 7.1894531 7.25 L 7.3398438 7.25 C 8.6098437 7.25 9.7992188 7.740625 10.699219 8.640625 L 14.189453 12.130859 C 14.639453 12.570859 15.360547 12.570859 15.810547 12.130859 L 19.300781 8.640625 C 20.200781 7.740625 21.390156 7.25 22.660156 7.25 L 22.810547 7.25 L 17.830078 2.2695312 C 17.050078 1.4895313 16.025 1.0996094 15 1.0996094 z M 5.6894531 8.75 L 2.2695312 12.169922 C 0.70953125 13.729922 0.70953125 16.270078 2.2695312 17.830078 L 5.6894531 21.25 L 7.3398438 21.25 C 8.2098438 21.25 9.030625 20.910781 9.640625 20.300781 L 13.130859 16.810547 C 14.160859 15.780547 15.839141 15.780547 16.869141 16.810547 L 20.359375 20.300781 C 20.969375 20.910781 21.790156 21.25 22.660156 21.25 L 24.310547 21.25 L 27.730469 17.830078 C 29.290469 16.270078 29.290469 13.729922 27.730469 12.169922 L 24.310547 8.75 L 22.660156 8.75 C 21.790156 8.75 20.969375 9.0892188 20.359375 9.6992188 L 16.869141 13.189453 C 16.359141 13.699453 15.68 13.960938 15 13.960938 C 14.32 13.960938 13.640859 13.699453 13.130859 13.189453 L 9.640625 9.6992188 C 9.030625 9.0892187 8.2098437 8.75 7.3398438 8.75 L 5.6894531 8.75 z M 15 17.539062 C 14.7075 17.539062 14.414453 17.649141 14.189453 17.869141 L 10.699219 21.359375 C 9.7992188 22.259375 8.6098437 22.75 7.3398438 22.75 L 7.1894531 22.75 L 12.169922 27.730469 C 13.729922 29.290469 16.270078 29.290469 17.830078 27.730469 L 22.810547 22.75 L 22.660156 22.75 C 21.390156 22.75 20.200781 22.259375 19.300781 21.359375 L 15.810547 17.869141 C 15.585547 17.649141 15.2925 17.539062 15 17.539062 z"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">PIX</span>
                    <span className="text-[9px] text-muted-foreground">3% off</span>
                  </div>
                  {/* Cartão */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"/>
                      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"/>
                      <rect x="5" y="14" width="4" height="2" rx="0.5" fill="currentColor" className="text-muted-foreground"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">Cartão 2x</span>
                    <span className="text-[9px] text-muted-foreground">sem juros</span>
                  </div>
                  {/* Boleto */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="5" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="7.5" y="4" width="2" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="11" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="13.5" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="16.5" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="19" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="21" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">Boleto</span>
                    <span className="text-[9px] text-muted-foreground">para PJ</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Info */}
              <div className="flex flex-col gap-3 w-full min-w-0">
                <h1 className="font-black text-xl md:text-2xl leading-snug text-foreground break-words">{displayNome}</h1>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{PRAZO_PRODUCAO}</span>
                </div>

                {/* Variant selector — image thumbnails */}
                {allVariants.length > 1 ? (
                  <TooltipProvider delayDuration={200}>
                    <div className="flex flex-col gap-2">
                      <span className="text-foreground text-sm font-semibold">
                        Cor: <span className="text-muted-foreground font-normal">{selectedVariant?.cor || product.cor || ''}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">({allVariants.length} opções)</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {allVariants.map((v) => {
                          const isCurrent = v.slug === activeVariantSlug;
                          const outOfStock = v.estoque === 0 || v.estoque === null;
                          return (
                            <Tooltip key={v.slug}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVariant(v);
                                    if (v.image && v.image !== displayedMain) {
                                      setIsTransitioning(true);
                                      setTimeout(() => {
                                        setDisplayedMain(v.image!);
                                        setActiveImg(0);
                                        setIsTransitioning(false);
                                      }, 150);
                                    }
                                  }}
                                  className="relative w-14 h-14 rounded-xl shrink-0 overflow-hidden transition-all duration-150 cursor-pointer bg-white"
                                  style={{
                                    border: isCurrent
                                      ? '2px solid hsl(142,71%,45%)'
                                      : '2px solid hsl(var(--border))',
                                    opacity: outOfStock ? 0.45 : 1,
                                    boxShadow: isCurrent
                                      ? '0 0 0 2px hsl(142,71%,45% / 0.25)'
                                      : undefined,
                                  }}
                                  title={v.cor || 'Cor'}
                                >
                                  {v.image ? (
                                    <img
                                      src={v.image}
                                      alt={v.cor || 'variante'}
                                      className="w-full h-full object-contain p-1 pointer-events-none"
                                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.webp'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                                      <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">{v.cor || '—'}</span>
                                    </div>
                                  )}
                                  {outOfStock && (
                                    <span className="absolute inset-0 flex items-center justify-center">
                                      <span className="w-0.5 h-full bg-destructive/70 rotate-45 absolute" />
                                    </span>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {v.cor || 'Cor'}{outOfStock ? ' — Indisponível' : ''}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  </TooltipProvider>
                ) : product.cor ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border border-border shrink-0" style={{ backgroundColor: getCorHex(product.cor) }} />
                    <span className="text-foreground text-sm font-medium">{product.cor}</span>
                  </div>
                ) : null}

                {/* Stock badge */}
                {displayEstoque != null && displayEstoque > 0 ? (
                  <span className="inline-flex items-center self-start gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" /> Em estoque
                  </span>
                ) : (
                  <span className="inline-flex items-center self-start gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-700" /> Indisponível
                  </span>
                )}

                {/* Price */}
                {displayPrecoCusto != null && displayPrecoCusto > 0 && (() => {
                  const precoPix = precoMin * 0.97;
                  const parcela2x = precoMin / 2;
                  return (
                    <div>
                      <span className="text-green-cta font-bold text-lg md:text-xl block leading-tight">
                        A partir de {formatarBRL(precoMin)} / unidade
                      </span>
                      <p className="text-muted-foreground text-xs mt-1">💲 No PIX: {formatarBRL(precoPix)} (economia de 3%)</p>
                      <p className="text-muted-foreground text-xs">ou 2x de {formatarBRL(parcela2x)} sem juros no cartão</p>
                      <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                        Pedido mínimo: 20 unidades
                      </span>
                    </div>
                  );
                })()}

                {/* WhatsApp CTA */}
                <a
                  href={WHATSAPP_REDIRECT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl flex items-center justify-center gap-2 text-white font-semibold text-sm py-3 px-4 transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Solicitar orçamento no WhatsApp
                </a>

                {/* Micro copy */}
                <div className="text-muted-foreground text-xs leading-relaxed">
                  <p>✓ Atendimento exclusivo para empresas</p>
                  <p>✓ Personalização com sua logo inclusa</p>
                  <p>✓ Entrega para todo o Brasil</p>
                </div>


                {/* Dimensions */}
                {(product.altura || product.largura || product.profundidade || product.peso) && (
                  <div className="grid grid-cols-2 gap-2">
                    {product.altura != null && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary border border-border min-w-0">
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0"><span className="text-[10px] text-muted-foreground block">Altura</span><span className="text-foreground text-xs font-medium">{product.altura} cm</span></div>
                      </div>
                    )}
                    {product.largura != null && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary border border-border min-w-0">
                        <MoveHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0"><span className="text-[10px] text-muted-foreground block">Largura</span><span className="text-foreground text-xs font-medium">{product.largura} cm</span></div>
                      </div>
                    )}
                    {product.profundidade != null && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary border border-border min-w-0">
                        <Ruler className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0"><span className="text-[10px] text-muted-foreground block">Comprimento</span><span className="text-foreground text-xs font-medium">{product.profundidade} cm</span></div>
                      </div>
                    )}
                    {product.peso != null && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary border border-border min-w-0">
                        <Weight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0"><span className="text-[10px] text-muted-foreground block">Peso</span><span className="text-foreground text-xs font-medium">{product.peso} g</span></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing table */}
                {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                  <div className="mt-1">
                    <h3 className="font-bold text-base text-foreground mb-2">Compre com desconto</h3>
                    <div className="rounded-xl border border-border overflow-x-auto">
                      <table className="w-full text-xs" style={{ minWidth: 280 }}>
                        <thead>
                          <tr className="bg-secondary">
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Qtd</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Preço/un</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Economia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, i) => (
                            <tr
                              key={row.qty}
                              className="border-t border-border cursor-pointer hover:bg-secondary/50 transition-colors"
                              style={{
                                backgroundColor: selectedRow === i ? "hsl(142,71%,45%,0.06)" : undefined,
                                borderLeft: selectedRow === i ? "3px solid hsl(142,71%,45%)" : "3px solid transparent",
                              }}
                              onClick={() => handleSelectRow(i)}
                            >
                              <td className="px-3 py-2 text-foreground font-semibold whitespace-nowrap">
                                {row.qty}
                                {row.qty === 20 && <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-secondary text-muted-foreground">Mín</span>}
                                {row.qty === 100 && <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-green-cta/15 text-green-cta">Popular</span>}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.desc > 0 && <span className="text-muted-foreground line-through text-[10px] mr-1">{formatarBRL(row.base)}</span>}
                                <span className="text-foreground font-medium">{formatarBRL(row.unit)}</span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.desc > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-cta/15 text-green-cta">-{Math.round(row.desc * 100)}%</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payment — mobile only (desktop version is in left column) */}
                <div className="flex md:hidden gap-2 items-stretch p-3 rounded-xl bg-secondary divide-x divide-border">
                  {/* PIX */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" className="w-6 h-6 text-muted-foreground" fill="currentColor">
                      <path d="M 15 1.0996094 C 13.975 1.0996094 12.949922 1.4895313 12.169922 2.2695312 L 7.1894531 7.25 L 7.3398438 7.25 C 8.6098437 7.25 9.7992188 7.740625 10.699219 8.640625 L 14.189453 12.130859 C 14.639453 12.570859 15.360547 12.570859 15.810547 12.130859 L 19.300781 8.640625 C 20.200781 7.740625 21.390156 7.25 22.660156 7.25 L 22.810547 7.25 L 17.830078 2.2695312 C 17.050078 1.4895313 16.025 1.0996094 15 1.0996094 z M 5.6894531 8.75 L 2.2695312 12.169922 C 0.70953125 13.729922 0.70953125 16.270078 2.2695312 17.830078 L 5.6894531 21.25 L 7.3398438 21.25 C 8.2098438 21.25 9.030625 20.910781 9.640625 20.300781 L 13.130859 16.810547 C 14.160859 15.780547 15.839141 15.780547 16.869141 16.810547 L 20.359375 20.300781 C 20.969375 20.910781 21.790156 21.25 22.660156 21.25 L 24.310547 21.25 L 27.730469 17.830078 C 29.290469 16.270078 29.290469 13.729922 27.730469 12.169922 L 24.310547 8.75 L 22.660156 8.75 C 21.790156 8.75 20.969375 9.0892188 20.359375 9.6992188 L 16.869141 13.189453 C 16.359141 13.699453 15.68 13.960938 15 13.960938 C 14.32 13.960938 13.640859 13.699453 13.130859 13.189453 L 9.640625 9.6992188 C 9.030625 9.0892187 8.2098437 8.75 7.3398438 8.75 L 5.6894531 8.75 z M 15 17.539062 C 14.7075 17.539062 14.414453 17.649141 14.189453 17.869141 L 10.699219 21.359375 C 9.7992188 22.259375 8.6098437 22.75 7.3398438 22.75 L 7.1894531 22.75 L 12.169922 27.730469 C 13.729922 29.290469 16.270078 29.290469 17.830078 27.730469 L 22.810547 22.75 L 22.660156 22.75 C 21.390156 22.75 20.200781 22.259375 19.300781 21.359375 L 15.810547 17.869141 C 15.585547 17.649141 15.2925 17.539062 15 17.539062 z"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">PIX</span>
                    <span className="text-[9px] text-muted-foreground">3% off</span>
                  </div>
                  {/* Cartão */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"/>
                      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"/>
                      <rect x="5" y="14" width="4" height="2" rx="0.5" fill="currentColor" className="text-muted-foreground"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">Cartão 2x</span>
                    <span className="text-[9px] text-muted-foreground">sem juros</span>
                  </div>
                  {/* Boleto */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="5" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="7.5" y="4" width="2" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="11" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="13.5" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="16.5" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="19" y="4" width="1.5" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                      <rect x="21" y="4" width="1" height="16" rx="0.5" className="text-muted-foreground" fill="currentColor"/>
                    </svg>
                    <span className="text-[10px] text-foreground font-semibold">Boleto</span>
                    <span className="text-[9px] text-muted-foreground">para PJ</span>
                  </div>
                </div>

                {/* Qty selector */}
                <div ref={qtySelectorRef} className="p-3 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(Math.max(20, qty - 10))}
                      className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:border-green-cta transition-colors shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={20}
                      value={qty}
                      onChange={(e) => setQty(Math.max(20, parseInt(e.target.value) || 20))}
                      className="flex-1 min-w-0 text-center py-2 rounded-lg bg-card border border-border text-foreground font-bold text-base focus:outline-none focus:border-green-cta"
                    />
                    <button
                      onClick={() => setQty(qty + 10)}
                      className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:border-green-cta transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                    <div className="mt-2">
                      <p className="text-muted-foreground text-xs">{qty}x — {formatarBRL(precoAtual)} / un</p>
                      <p className="text-foreground font-bold text-sm mt-0.5">Total: {formatarBRL(precoAtual * qty)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-10">
                <h2 className="font-extrabold text-xl text-foreground mb-4">
                  Produtos <span className="text-highlight">relacionados</span>
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {related.map((p) => (
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

        {/* Lightbox — shows all images (API + admin) */}
        {lightbox && (() => {
          const lbImages = allImages.length > 0 ? allImages : [mainImage].filter(Boolean);
          const safeLbActive = Math.min(lbActive, lbImages.length - 1);
          const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setLbActive(i => (i - 1 + lbImages.length) % lbImages.length); };
          const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setLbActive(i => (i + 1) % lbImages.length); };
          return (
            <div
              className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
              onClick={() => setLightbox(false)}
            >
              <button
                className="absolute top-4 right-4 z-[201] w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                onClick={() => setLightbox(false)}
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {lbImages.length > 1 && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                  onClick={goPrev}
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}

              <div className="flex flex-col items-center gap-4 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                <img
                  src={lbImages[safeLbActive] ?? mainImage}
                  alt={product.nome}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl bg-white p-4"
                />
                {lbImages.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
                    {lbImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setLbActive(i)}
                        className="w-2 h-2 rounded-full transition-all duration-150"
                        style={{ backgroundColor: i === safeLbActive ? 'white' : 'rgba(255,255,255,0.3)' }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {lbImages.length > 1 && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                  onClick={goNext}
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
};

export default ProductDetail;
