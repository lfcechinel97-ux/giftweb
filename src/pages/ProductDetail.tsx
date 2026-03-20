import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { calcularPreco, getDesconto, formatarBRL, getPrecoMinimo, getMarkup } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { PRAZO_PRODUCAO, WHATSAPP_NUMBER, SITE_URL } from "@/config/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import HowItWorks from "@/components/HowItWorks";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Minus, Plus, X, Ruler, Weight, ArrowUpDown, MoveHorizontal, Truck, Palette, Building2, CreditCard } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;

interface VariantInfo {
  id: string;
  slug: string | null;
  cor: string | null;
  codigo_amigavel: string;
  image_url: string | null;
  image_urls: string[] | null;
  estoque: number | null;
  preco_custo: number | null;
  nome: string;
}

const QUANTITIES = [20, 50, 100, 200, 300, 500, 1000];

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(20);
  const [selectedRow, setSelectedRow] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [imgFading, setImgFading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const qtySelectorRef = useRef<HTMLDivElement>(null);

  // Construir lista de imagens válidas
  const allImages = [
    product?.image_url,
    product?.image_urls?.[0],
    product?.image_urls?.[1],
    product?.image_urls?.[2],
  ]
  .filter(img =>
    img &&
    typeof img === 'string' &&
    img.trim() !== '' &&
    img !== 'null' &&
    img !== 'undefined'
  )
  .filter((img, index, self) => self.indexOf(img) === index); // remove duplicadas

  // Estados da galeria
  const [mainImage, setMainImage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sincronizar imagem principal quando o produto carregar
  useEffect(() => {
    if (allImages.length > 0) {
      setMainImage(allImages[0]);
    }
  }, [product?.image_url]);

  // Função de troca de imagem
  const handleThumbChange = (src: string) => {
    if (src === mainImage || isTransitioning) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setMainImage(src);
      setIsTransitioning(false);
    }, 150);
  };

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
        if (error || !data) {
          navigate("/404", { replace: true });
          return;
        }
        setProduct(data);

        const imgs: string[] = [];
        if (data.image_urls && Array.isArray(data.image_urls)) {
          for (const u of data.image_urls) {
            if (u && (u as string).trim()) imgs.push(u as string);
          }
        }
        if (imgs.length === 0 && data.image_url) {
          imgs.push(data.image_url);
        }
        setImageUrls(imgs);
        setActiveImg(0);

        const isVariante = (data as any).is_variante === true;
        const produtoPaiId = isVariante ? (data as any).produto_pai : data.id;

        const [variantsRes, relatedRes] = await Promise.all([
          produtoPaiId
            ? supabase
                .from("products_cache")
                .select("id,slug,cor,codigo_amigavel,image_url,image_urls,estoque,preco_custo,nome")
                .or(`id.eq.${produtoPaiId},produto_pai.eq.${produtoPaiId}`)
                .eq("ativo", true)
                .eq("has_image", true)
                .order("codigo_amigavel")
            : Promise.resolve({ data: [] }),
          supabase
            .from("products_cache")
            .select("*")
            .eq("categoria", data.categoria!)
            .eq("ativo", true)
            .eq("has_image", true)
            .eq("is_variante", false)
            .gt("estoque", 0)
            .neq("slug", slug)
            .order("variantes_count", { ascending: false })
            .order("estoque", { ascending: false })
            .limit(4),
        ]);

        setVariants((variantsRes.data || []) as VariantInfo[]);
        setActiveVariantId(data.id);
        setRelated(relatedRes.data || []);

        if (isVariante && produtoPaiId) {
          const { data: paiData } = await supabase
            .from("products_cache")
            .select("slug")
            .eq("id", produtoPaiId)
            .single();
          setParentSlug(paiData?.slug || null);
        } else {
          setParentSlug(null);
        }

        setLoading(false);
      });
  }, [slug, navigate]);

  // Derive active variant data
  const activeVariant = useMemo(() => {
    if (!activeVariantId || variants.length === 0) return null;
    return variants.find(v => v.id === activeVariantId) || null;
  }, [activeVariantId, variants]);

  // Use active variant's data for pricing/display, fallback to product
  const displayCodigo = activeVariant?.codigo_amigavel || product?.codigo_amigavel || '';
  const displayEstoque = activeVariant?.estoque ?? product?.estoque;
  const displayPrecoCusto = activeVariant?.preco_custo ?? product?.preco_custo;
  const displayNome = activeVariant?.nome || product?.nome || '';

  const precoBase = displayPrecoCusto ? displayPrecoCusto * getMarkup(displayPrecoCusto) : 0;
  const precoAtual = displayPrecoCusto ? calcularPreco(displayPrecoCusto, qty) : 0;
  const precoMin = displayPrecoCusto ? getPrecoMinimo(displayPrecoCusto) : 0;

  const tableRows = useMemo(() => {
    if (!displayPrecoCusto) return [];
    return QUANTITIES.map((q) => {
      const unit = calcularPreco(displayPrecoCusto, q);
      const base = precoBase;
      const desc = getDesconto(q);
      return { qty: q, unit, base, desc };
    });
  }, [displayPrecoCusto, precoBase]);

  const handleSelectRow = (index: number) => {
    setSelectedRow(index);
    setQty(QUANTITIES[index]);
    qtySelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const fadeToImage = (index: number) => {
    setImgFading(true);
    setTimeout(() => {
      setActiveImg(index);
      setImgFading(false);
    }, 150);
  };

  const handleSwitchVariant = (variant: VariantInfo) => {
    if (variant.id === activeVariantId) return;
    // Build image list from variant
    const imgs: string[] = [];
    if (variant.image_urls && Array.isArray(variant.image_urls)) {
      for (const u of variant.image_urls) {
        if (u && (u as string).trim()) imgs.push(u as string);
      }
    }
    if (imgs.length === 0 && variant.image_url) {
      imgs.push(variant.image_url);
    }
    // Fade transition
    setImgFading(true);
    setIsTransitioning(true);
    setTimeout(() => {
      setImageUrls(imgs);
      setActiveImg(0);
      setActiveVariantId(variant.id);
      // Resetar galeria para a primeira imagem da nova variante
      setMainImage(variant.image_url || '');
      setImgFading(false);
      setIsTransitioning(false);
    }, 150);
    // Update URL without reload
    if (variant.slug) {
      window.history.replaceState(null, '', `/produto/${variant.slug}`);
    }
  };

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

  const isVariante = (product as any).is_variante === true;
  const canonicalSlug = isVariante && parentSlug ? parentSlug : product.slug;
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
          <div className="container px-4 py-4 md:py-8">
            <Breadcrumbs
              items={[
                { label: "Início", href: "/" },
                { label: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1), href: `/${categorySlug}` },
                { label: product.nome },
              ]}
            />

            {/* Main layout — single col on mobile, 2-col on md+ */}
            <div className="flex flex-col md:grid md:grid-cols-2 gap-5 md:gap-10 mt-4">
              {/* Gallery */}
              <div className="flex flex-col gap-3 w-full">

                {/* IMAGEM PRINCIPAL */}
                <div className="w-full rounded-2xl border-2 border-border bg-white overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1' }}>
                  {mainImage && (
                    <img
                      src={mainImage}
                      alt={product?.nome || 'Produto'}
                      className="w-full h-full object-contain p-4"
                      style={{
                        opacity: isTransitioning ? 0 : 1,
                        transition: 'opacity 0.15s ease'
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.webp"; }}
                    />
                  )}
                </div>

                {/* MINIATURAS */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {allImages.map((src, index) => {
                      const isActive = mainImage === src;
                      return (
                        <button
                          key={index}
                          onClick={() => handleThumbChange(src)}
                          onMouseEnter={() => handleThumbChange(src)}
                          className="rounded-xl border-2 bg-white flex items-center justify-center p-1.5 transition-all duration-150 shrink-0"
                          style={{
                            width: 64,
                            height: 64,
                            borderColor: isActive ? '#22C55E' : '#E5E7EB',
                            boxShadow: isActive ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                          }}
                        >
                          <img
                            src={src}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-4">
                <h1 className="font-black text-2xl md:text-[28px] leading-tight text-foreground">{displayNome}</h1>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{PRAZO_PRODUCAO}</span>
                </div>

                {/* Color variant selector — shows ALL variants with image thumbnails */}
                {variants.length > 1 ? (
                  <TooltipProvider delayDuration={200}>
                    <div className="flex flex-col gap-2">
                      <span className="text-foreground text-sm font-semibold">
                        Cor: <span className="text-muted-foreground font-normal">{activeVariant?.cor || product.cor || ''}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({variants.length} opções)</span>
                      </span>
                      <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                        {variants.map((v) => {
                          const hex = getCorHex(v.cor);
                          const isCurrent = v.id === activeVariantId;
                          const outOfStock = v.estoque === 0 || v.estoque === null;
                          const thumbSrc = v.image_url || '';
                          return (
                            <Tooltip key={v.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleSwitchVariant(v)}
                                  className="relative rounded-xl overflow-hidden transition-colors duration-150 shrink-0 bg-white"
                                  style={{
                                    width: 52,
                                    height: 52,
                                    border: isCurrent ? '2px solid hsl(142,71%,45%)' : '2px solid hsl(var(--border))',
                                    opacity: outOfStock ? 0.5 : 1,
                                    cursor: isCurrent ? 'default' : 'pointer',
                                    padding: 3,
                                  }}
                                >
                                  {thumbSrc ? (
                                    <img
                                      src={thumbSrc}
                                      alt={v.cor || 'variante'}
                                      className="w-full h-full object-contain rounded-lg"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        const fb = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fb) fb.style.display = 'block';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="w-full h-full rounded-lg"
                                    style={{ display: thumbSrc ? 'none' : 'block', backgroundColor: hex }}
                                  />
                                  {outOfStock && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                                      <span className="text-[8px] font-bold text-destructive leading-tight text-center">Sem<br/>estoque</span>
                                    </div>
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
                    <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: getCorHex(product.cor) }} />
                    <span className="text-foreground text-sm font-medium">{product.cor}</span>
                  </div>
                ) : null}

                {/* Stock badge */}
                {displayEstoque != null && displayEstoque > 0 ? (
                  <span className="inline-flex items-center self-start gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span className="w-2 h-2 rounded-full animate-pulse bg-green-500" />
                    Em estoque
                  </span>
                ) : (
                  <span className="inline-flex items-center self-start gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-700" />
                    Indisponível
                  </span>
                )}

                {/* Price highlight */}
                {displayPrecoCusto != null && displayPrecoCusto > 0 && (() => {
                  const precoPix = precoMin * 0.97;
                  const parcela2x = precoMin / 2;
                  return (
                    <div>
                      <span className="text-green-cta font-bold text-xl">
                        A partir de {formatarBRL(precoMin)} / unidade
                      </span>
                      <p className="text-muted-foreground text-[13px] mt-1">
                        💲 No PIX: {formatarBRL(precoPix)} (economia de 3%)
                      </p>
                      <p className="text-muted-foreground text-[13px]">
                        ou 2x de {formatarBRL(parcela2x)} sem juros no cartão
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-[13px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                        Pedido mínimo: 20 unidades
                      </span>
                    </div>
                  );
                })()}

                {/* WhatsApp CTA */}
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 w-full rounded-xl flex items-center justify-center gap-2.5 text-white font-semibold text-sm py-3 px-5 transition-colors duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Solicitar orçamento no WhatsApp
                </a>

                {/* Micro copy */}
                <div className="text-muted-foreground text-xs leading-[1.8] mt-2.5">
                  <p>✓ Atendimento exclusivo para empresas</p>
                  <p>✓ Personalização com sua logo inclusa</p>
                  <p>✓ Entrega para todo o Brasil</p>
                </div>

                {/* Trust bar */}
                <div className="flex gap-3 py-3 my-2 border-t border-b border-border">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <Truck className="w-5 h-5 text-green-cta" />
                    <span className="text-[11px] text-muted-foreground text-center">Entrega para<br/>todo o Brasil</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <Palette className="w-5 h-5 text-green-cta" />
                    <span className="text-[11px] text-muted-foreground text-center">Arte grátis<br/>inclusa</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <Building2 className="w-5 h-5 text-green-cta" />
                    <span className="text-[11px] text-muted-foreground text-center">+5 anos de<br/>mercado</span>
                  </div>
                </div>
                {(product.altura || product.largura || product.profundidade || product.peso) && (
                  <div className="grid grid-cols-2 gap-2">
                    {product.altura != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Altura</span>
                          <span className="text-foreground text-sm font-medium">{product.altura} cm</span>
                        </div>
                      </div>
                    )}
                    {product.largura != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
                        <MoveHorizontal className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Largura</span>
                          <span className="text-foreground text-sm font-medium">{product.largura} cm</span>
                        </div>
                      </div>
                    )}
                    {product.profundidade != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Comprimento</span>
                          <span className="text-foreground text-sm font-medium">{product.profundidade} cm</span>
                        </div>
                      </div>
                    )}
                    {product.peso != null && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
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
                {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                  <div className="mt-4">
                    <h3 className="font-bold text-lg text-foreground mb-3">Compre com desconto</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary">
                            <th className="text-left p-3 text-muted-foreground font-medium">Qtd</th>
                            <th className="text-left p-3 text-muted-foreground font-medium">Preço/un</th>
                            <th className="text-left p-3 text-muted-foreground font-medium">Economia</th>
                            <th className="p-3 text-muted-foreground font-medium text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, i) => (
                            <tr
                              key={row.qty}
                              className="border-t border-border transition-colors cursor-pointer hover:bg-secondary/50"
                              style={{
                                backgroundColor: selectedRow === i ? "hsl(142,71%,45%,0.06)" : undefined,
                                borderLeft: selectedRow === i ? "3px solid hsl(142,71%,45%)" : "3px solid transparent",
                              }}
                              onClick={() => handleSelectRow(i)}
                            >
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
                              <td className="p-3 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectRow(i); }}
                                  className="px-3 py-1 rounded-lg text-[13px] font-semibold border transition-colors"
                                  style={{
                                    borderColor: selectedRow === i ? "hsl(142,71%,45%)" : "hsl(220,13%,91%)",
                                    color: selectedRow === i ? "hsl(142,71%,45%)" : "hsl(var(--muted-foreground))",
                                  }}
                                >
                                  {selectedRow === i ? "Selecionado" : "Selecionar"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payment methods */}
                <div className="flex gap-4 items-center p-3 rounded-[10px] bg-secondary mt-3">
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <img src="/logos/pix.png" alt="PIX" className="h-6 w-auto object-contain" />
                    <span className="text-[11px] text-foreground font-medium">PIX</span>
                    <span className="text-[10px] text-muted-foreground">3% desconto</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <CreditCard className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[11px] text-foreground font-medium">Cartão 2x</span>
                    <span className="text-[10px] text-muted-foreground">sem juros</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <img src="/logos/boleto.png" alt="Boleto" className="h-6 w-auto object-contain" />
                    <span className="text-[11px] text-foreground font-medium">Boleto</span>
                    <span className="text-[10px] text-muted-foreground">para PJ</span>
                  </div>
                </div>

                {/* Quantity selector */}
                <div ref={qtySelectorRef} className="mt-4 p-4 rounded-xl bg-card border border-border">
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
                      className="w-20 text-center py-2 rounded-lg bg-card border border-border text-foreground font-bold text-lg focus:outline-none focus:border-green-cta"
                    />
                    <button
                      onClick={() => setQty(qty + 10)}
                      className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:border-green-cta transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground">
                        {qty}x {displayNome} — {formatarBRL(precoAtual)} / unidade
                      </p>
                      <p className="text-foreground font-bold text-lg mt-1">
                        Total: {formatarBRL(precoAtual * qty)}
                      </p>
                    </div>
                  )}
                </div>
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

        {/* Lightbox */}
        {lightbox && imageUrls.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center">
              <X className="w-5 h-5 text-foreground" />
            </button>
            <img src={imageUrls[activeImg]} alt={product.nome} className="max-w-full max-h-[90vh] object-contain rounded-xl" />
          </div>
        )}
      </div>
    </>
  );
};

export default ProductDetail;
