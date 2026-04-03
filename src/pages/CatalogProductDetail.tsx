import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { calcularPreco, getDesconto, formatarBRL, getPrecoMinimo, getMarkup } from "@/utils/price";
import { getCorHex } from "@/utils/colorHex";
import { WHATSAPP_NUMBER } from "@/config/site";
import CatalogHeader from "@/components/catalog/CatalogHeader";
import CatalogFooter from "@/components/catalog/CatalogFooter";
import QuotationDrawer from "@/components/catalog/QuotationDrawer";
import QuotationBar from "@/components/catalog/QuotationBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuotation } from "@/contexts/QuotationContext";
import { toast } from "sonner";
import { Clock, Minus, Plus, X, Ruler, Weight, ArrowUpDown, MoveHorizontal, ZoomIn, ChevronLeft, ChevronRight, ShoppingCart, ArrowLeft, Send } from "lucide-react";
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

const CatalogProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, items, totalItems } = useQuotation();

  const [product, setProduct] = useState<Product | null>(null);
  const [currentVariantData, setCurrentVariantData] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<VariantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(20);
  const [selectedRow, setSelectedRow] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lbActive, setLbActive] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const qtySelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setShowSuccess(false);
    supabase
      .from("products_cache")
      .select("*")
      .eq("slug", slug)
      .eq("ativo", true)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { navigate("/catalogo", { replace: true }); return; }
        setCurrentVariantData(data);
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
        setSelectedVariant({
          slug: data.slug || '',
          cor: data.cor,
          codigo_amigavel: data.codigo_amigavel,
          image: data.image_url,
          estoque: data.estoque,
        });
        setActiveImg(0);
        setLoading(false);
      });
  }, [slug, navigate]);

  const mainImage = useMemo(() => {
    return selectedVariant?.image || product?.image_url || '';
  }, [selectedVariant, product]);

  const [variantExtraImages, setVariantExtraImages] = useState<string[]>([]);
  useEffect(() => {
    const isBase = !selectedVariant || selectedVariant.slug === product?.slug;
    if (isBase) { setVariantExtraImages([]); return; }
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
        setVariantExtraImages(merged.slice(1));
      });
  }, [selectedVariant?.slug, product?.slug]);

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

  const allVariants = useMemo((): VariantInfo[] => {
    if (!product) return [];
    const baseOption: VariantInfo = {
      slug: product.slug || '',
      cor: product.cor,
      codigo_amigavel: product.codigo_amigavel,
      image: product.image_url,
      estoque: product.estoque,
    };
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
    const all: VariantInfo[] = [baseOption, ...othersFromJson];
    const seen = new Set<string>();
    const merged = all.filter(v => {
      if (!v.slug || seen.has(v.slug)) return false;
      seen.add(v.slug);
      return true;
    });
    if (currentVariantData && currentVariantData.is_variante) {
      const s = currentVariantData.slug || '';
      if (s && !seen.has(s)) {
        merged.push({
          slug: s,
          cor: currentVariantData.cor,
          codigo_amigavel: currentVariantData.codigo_amigavel,
          image: currentVariantData.image_url,
          estoque: currentVariantData.estoque,
        });
      }
    }
    return merged;
  }, [product, currentVariantData]);

  const activeVariantSlug = selectedVariant?.slug || product?.slug || '';

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

  const handleAddToQuotation = () => {
    if (!product) return;
    addItem(
      {
        id: currentVariantData?.id || product.id,
        name: displayNome,
        image: displayedMain || product.image_url || "/placeholder-product.webp",
        price: displayPrecoCusto,
        codigo_amigavel: displayCodigo,
      },
      qty
    );
    toast.success(`${displayNome} adicionado ao orçamento`);
    setShowSuccess(true);
  };

  const handleSendWhatsApp = () => {
    const allItems = items;
    const lines = allItems.map((item, i) => {
      const price = item.price ? formatarBRL(calcularPreco(item.price, item.quantity)) : "sob consulta";
      return `${i + 1}. ${item.name} (Cód: ${item.codigo_amigavel}) — Qtd: ${item.quantity} — ${price}/un`;
    });
    const msg = `Olá! Gostaria de solicitar um orçamento:\n\n${lines.join("\n")}\n\nTotal de itens: ${totalItems}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <CatalogHeader />
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

  return (
    <>
      <Helmet>
        <title>{product.nome} | Catálogo Gift Web</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <CatalogHeader />
        <QuotationBar />
        <main className="flex-1">
          <div className="w-full max-w-5xl mx-auto px-4 py-4 md:py-8">
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </button>

            <div className="flex flex-col md:grid md:grid-cols-2 gap-5 md:gap-8">
              {/* LEFT column */}
              <div className="flex flex-col gap-3 w-full min-w-0">
                {/* Gallery */}
                <div
                  className="relative w-full rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden flex items-center justify-center cursor-zoom-in"
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
                    className="absolute bottom-3 left-3 w-8 h-8 rounded-lg bg-white/90 border border-[#E5E7EB] flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                  >
                    <ZoomIn className="w-4 h-4 text-[#64748B]" />
                  </button>
                </div>

                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {allImages.map((src, i) => (
                      <button
                        key={src + i}
                        onClick={() => handleThumbClick(src, i)}
                        className="shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all duration-150 bg-white"
                        style={{ borderColor: displayedMain === src ? '#22C55E' : '#E5E7EB' }}
                      >
                        <img src={src} alt={`foto ${i + 1}`} className="w-full h-full object-contain p-1 pointer-events-none" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Description + Dimensions — DESKTOP ONLY */}
                <div className="hidden md:flex flex-col gap-3">
                  {product.descricao && (
                    <div className="mt-1 p-3 rounded-xl bg-white border border-[#E5E7EB]">
                      <h3 className="font-semibold text-sm text-[#0F172A] mb-1.5">Descrição</h3>
                      <p className="text-[#64748B] text-xs leading-relaxed whitespace-pre-line">{product.descricao}</p>
                    </div>
                  )}

                  {(product.altura || product.largura || product.profundidade || product.peso) && (
                    <div className="grid grid-cols-2 gap-2">
                      {product.altura != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Altura</span><span className="text-[#0F172A] text-xs font-medium">{product.altura} cm</span></div>
                        </div>
                      )}
                      {product.largura != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <MoveHorizontal className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Largura</span><span className="text-[#0F172A] text-xs font-medium">{product.largura} cm</span></div>
                        </div>
                      )}
                      {product.profundidade != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <Ruler className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Comprimento</span><span className="text-[#0F172A] text-xs font-medium">{product.profundidade} cm</span></div>
                        </div>
                      )}
                      {product.peso != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <Weight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Peso</span><span className="text-[#0F172A] text-xs font-medium">{product.peso} g</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT column */}
              <div className="flex flex-col gap-3 w-full min-w-0">
                {/* Name */}
                <h1 className="font-black text-xl md:text-2xl leading-snug text-[#0F172A] break-words">{displayNome}</h1>

                {/* Prazo */}
                <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{PRAZO_PRODUCAO}</span>
                </div>

                {/* Variant selector */}
                {allVariants.length > 1 ? (
                  <TooltipProvider delayDuration={200}>
                    <div className="flex flex-col gap-2">
                      <span className="text-[#0F172A] text-sm font-semibold">
                        Cor: <span className="text-[#64748B] font-normal">{selectedVariant?.cor || product.cor || ''}</span>
                        <span className="ml-1.5 text-xs text-[#94A3B8]">({allVariants.length} opções)</span>
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
                                    setShowSuccess(false);
                                    if (v.image && v.image !== displayedMain) {
                                      setIsTransitioning(true);
                                      setTimeout(() => {
                                        setDisplayedMain(v.image!);
                                        setActiveImg(0);
                                        setIsTransitioning(false);
                                      }, 150);
                                    }
                                    if (v.slug) {
                                      window.history.replaceState(null, '', `/catalogo/produto/${v.slug}`);
                                    }
                                  }}
                                  className="relative w-14 h-14 rounded-xl shrink-0 overflow-hidden transition-all duration-150 cursor-pointer bg-white"
                                  style={{
                                    border: isCurrent ? '2px solid #22C55E' : '2px solid #E5E7EB',
                                    opacity: outOfStock ? 0.45 : 1,
                                    boxShadow: isCurrent ? '0 0 0 2px rgba(34,197,94,0.25)' : undefined,
                                  }}
                                >
                                  {v.image ? (
                                    <img
                                      src={v.image}
                                      alt={v.cor || 'variante'}
                                      className="w-full h-full object-contain p-1 pointer-events-none"
                                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.webp'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#F1F5F9]">
                                      <span className="text-[9px] text-[#94A3B8] text-center leading-tight px-0.5">{v.cor || '—'}</span>
                                    </div>
                                  )}
                                  {outOfStock && (
                                    <span className="absolute inset-0 flex items-center justify-center">
                                      <span className="w-0.5 h-full bg-red-500/70 rotate-45 absolute" />
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
                    <div className="w-5 h-5 rounded-full border border-[#E5E7EB] shrink-0" style={{ backgroundColor: getCorHex(product.cor) }} />
                    <span className="text-[#0F172A] text-sm font-medium">{product.cor}</span>
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
                      <span className="text-[#22C55E] font-bold text-lg md:text-xl block leading-tight">
                        A partir de {formatarBRL(precoMin)} / unidade
                      </span>
                      <p className="text-[#64748B] text-xs mt-1">💲 No PIX: {formatarBRL(precoPix)} (economia de 3%)</p>
                      <p className="text-[#64748B] text-xs">ou 2x de {formatarBRL(parcela2x)} sem juros no cartão</p>
                      <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        Pedido mínimo: 20 unidades
                      </span>
                    </div>
                  );
                })()}

                {/* Qty selector + Add to quotation */}
                <div ref={qtySelectorRef} className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(Math.max(20, qty - 10))}
                      className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#E5E7EB] flex items-center justify-center text-[#0F172A] hover:border-[#22C55E] transition-colors shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={20}
                      value={qty}
                      onChange={(e) => setQty(Math.max(20, parseInt(e.target.value) || 20))}
                      className="flex-1 min-w-0 text-center py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#0F172A] font-bold text-base focus:outline-none focus:border-[#22C55E]"
                    />
                    <button
                      onClick={() => setQty(qty + 10)}
                      className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#E5E7EB] flex items-center justify-center text-[#0F172A] hover:border-[#22C55E] transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                    <div className="mt-2">
                      <p className="text-[#64748B] text-xs">{qty}x — {formatarBRL(precoAtual)} / un</p>
                      <p className="text-[#0F172A] font-bold text-sm mt-0.5">Total: {formatarBRL(precoAtual * qty)}</p>
                    </div>
                  )}
                </div>

                {/* Add to quotation CTA */}
                {!showSuccess ? (
                  <button
                    type="button"
                    onClick={handleAddToQuotation}
                    className="w-full rounded-xl flex items-center justify-center gap-2 text-white font-semibold text-sm py-3.5 px-4 transition-all duration-200 hover:opacity-90 active:scale-[0.98] bg-[#22C55E]"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Adicionar ao orçamento
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-center text-sm font-semibold text-[#22C55E] py-2">
                      ✓ Adicionado ao orçamento!
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex-1 rounded-xl flex items-center justify-center gap-2 text-[#0F172A] font-semibold text-sm py-3 px-4 border border-[#E5E7EB] hover:bg-[#F1F5F9] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Continuar escolhendo
                      </button>
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        className="flex-1 rounded-xl flex items-center justify-center gap-2 text-white font-semibold text-sm py-3 px-4 bg-[#25D366] hover:opacity-90 transition-opacity"
                      >
                        <Send className="w-4 h-4" />
                        Enviar WhatsApp
                      </button>
                    </div>
                  </div>
                )}

                {/* Pricing table */}
                {displayPrecoCusto != null && displayPrecoCusto > 0 && (
                  <div className="mt-1">
                    <h3 className="font-bold text-base text-[#0F172A] mb-2">Compre com desconto</h3>
                    <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                      <table className="w-full text-xs" style={{ minWidth: 280 }}>
                        <thead>
                          <tr className="bg-[#F1F5F9]">
                            <th className="text-left px-3 py-2 text-[#64748B] font-medium whitespace-nowrap">Qtd</th>
                            <th className="text-left px-3 py-2 text-[#64748B] font-medium whitespace-nowrap">Preço/un</th>
                            <th className="text-left px-3 py-2 text-[#64748B] font-medium whitespace-nowrap">Economia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, i) => (
                            <tr
                              key={row.qty}
                              className="border-t border-[#E5E7EB] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                              style={{
                                backgroundColor: selectedRow === i ? "rgba(34,197,94,0.06)" : undefined,
                                borderLeft: selectedRow === i ? "3px solid #22C55E" : "3px solid transparent",
                              }}
                              onClick={() => handleSelectRow(i)}
                            >
                              <td className="px-3 py-2 text-[#0F172A] font-semibold whitespace-nowrap">
                                {row.qty}
                                {row.qty === 20 && <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-[#F1F5F9] text-[#64748B]">Mín</span>}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.desc > 0 && <span className="text-[#94A3B8] line-through text-[10px] mr-1">{formatarBRL(row.base)}</span>}
                                <span className="text-[#0F172A] font-medium">{formatarBRL(row.unit)}</span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.desc > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#22C55E]/15 text-[#22C55E]">-{Math.round(row.desc * 100)}%</span>
                                ) : <span className="text-[#94A3B8]">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Trust text */}
                <div className="text-[#64748B] text-xs leading-relaxed">
                  <p>✓ Personalização com sua logo inclusa</p>
                  <p>✓ Entrega para todo o Brasil</p>
                </div>

                {/* Description + Dimensions — MOBILE ONLY */}
                <div className="md:hidden flex flex-col gap-3">
                  {product.descricao && (
                    <div className="mt-1 p-3 rounded-xl bg-white border border-[#E5E7EB]">
                      <h3 className="font-semibold text-sm text-[#0F172A] mb-1.5">Descrição</h3>
                      <p className="text-[#64748B] text-xs leading-relaxed whitespace-pre-line">{product.descricao}</p>
                    </div>
                  )}

                  {(product.altura || product.largura || product.profundidade || product.peso) && (
                    <div className="grid grid-cols-2 gap-2">
                      {product.altura != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Altura</span><span className="text-[#0F172A] text-xs font-medium">{product.altura} cm</span></div>
                        </div>
                      )}
                      {product.largura != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <MoveHorizontal className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Largura</span><span className="text-[#0F172A] text-xs font-medium">{product.largura} cm</span></div>
                        </div>
                      )}
                      {product.profundidade != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <Ruler className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Comprimento</span><span className="text-[#0F172A] text-xs font-medium">{product.profundidade} cm</span></div>
                        </div>
                      )}
                      {product.peso != null && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E5E7EB] min-w-0">
                          <Weight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <div className="min-w-0"><span className="text-[10px] text-[#94A3B8] block">Peso</span><span className="text-[#0F172A] text-xs font-medium">{product.peso} g</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
        <CatalogFooter />
        <QuotationDrawer />

        {/* Lightbox */}
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
                <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors" onClick={goPrev}>
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
                <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors" onClick={goNext}>
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

export default CatalogProductDetail;
