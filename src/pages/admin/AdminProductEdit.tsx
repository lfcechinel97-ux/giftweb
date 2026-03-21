import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Upload, GripVertical, X, Plus, ImageOff, Images } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatarBRL } from '@/utils/price';
import { getCorHex } from '@/utils/colorHex';
import type { Json } from '@/integrations/supabase/types';
import { toast as sonnerToast } from 'sonner';

interface Variante {
  slug?: string;
  cor?: string;
  image?: string;
  estoque?: number;
  codigo_amigavel?: string;
}

function parseVariantes(v: Json | null): Variante[] {
  if (!v || !Array.isArray(v)) return [];
  return v as unknown as Variante[];
}

const CATEGORIES = [
  'garrafas', 'copos', 'mochilas', 'bolsas', 'escritorio', 'kits',
  'squeezes', 'brindes-baratos', 'outros',
];

// ─── Image gallery manager ────────────────────────────────────────────────────
function ImageGallery({
  images,
  productId,
  label,
  onUpdate,
}: {
  images: string[];
  productId: string;
  label?: string;
  onUpdate: (main: string | null, imgs: string[]) => void;
}) {
  const [list, setList] = useState<string[]>(images);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setList(images); }, [images]);

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `products/${productId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('site-images').upload(path, file, { upsert: true });
    if (error) { sonnerToast.error('Erro no upload'); setUploading(false); return; }
    const { data } = supabase.storage.from('site-images').getPublicUrl(path);
    const newList = [...list, data.publicUrl];
    setList(newList);
    onUpdate(newList[0] ?? null, newList);
    setUploading(false);
  };

  const remove = (idx: number) => {
    const newList = list.filter((_, i) => i !== idx);
    setList(newList);
    onUpdate(newList[0] ?? null, newList);
  };

  const setMain = (idx: number) => {
    if (idx === 0) return;
    const newList = [list[idx], ...list.filter((_, i) => i !== idx)];
    setList(newList);
    onUpdate(newList[0], newList);
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const newList = [...list];
    const [item] = newList.splice(dragIdx, 1);
    newList.splice(i, 0, item);
    setList(newList);
    setDragIdx(i);
  };
  const onDragEnd = () => {
    setDragIdx(null);
    onUpdate(list[0] ?? null, list);
  };

  return (
    <div className="space-y-3">
      {label && <p className="text-xs text-muted-foreground font-medium">{label}</p>}
      {/* Main preview */}
      <div className="rounded-xl border bg-background overflow-hidden relative group">
        {list[0] ? (
          <img src={list[0]} alt="Principal" className="w-full aspect-square object-contain p-4" />
        ) : (
          <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10 opacity-30" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="text-white text-sm font-medium flex items-center gap-1">
            <Upload className="h-4 w-4" /> Trocar imagem principal
          </span>
        </button>
      </div>

      {/* Thumbnails with drag */}
      <div className="flex flex-wrap gap-2">
        {list.map((url, i) => (
          <div
            key={url + i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            className={`relative group w-16 h-16 rounded-lg border-2 cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
              i === 0 ? 'border-primary' : 'border-border hover:border-primary/40'
            } ${dragIdx === i ? 'opacity-50 scale-95' : ''}`}
            title={i === 0 ? 'Imagem principal' : 'Clique para tornar principal'}
            onClick={() => setMain(i)}
          >
            <img src={url} alt={`img ${i}`} className="w-full h-full object-contain p-1 bg-background" />
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] text-center py-0.5">Principal</span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full items-center justify-center hidden group-hover:flex"
            >
              <X className="h-2.5 w-2.5" />
            </button>
            <GripVertical className="absolute bottom-4 left-1/2 -translate-x-1/2 h-3 w-3 text-white/70 hidden group-hover:block pointer-events-none" />
          </div>
        ))}

        {/* Add button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/60 transition-colors"
        >
          {uploading ? (
            <span className="text-[10px] text-muted-foreground">...</span>
          ) : (
            <Plus className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Arraste para reordenar · Clique na miniatura para definir como principal
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_cache')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all variants by codigo_prefixo (produto_pai may be null in DB)
  const codigoPrefixo = product?.codigo_prefixo ?? null;

  const { data: variantRows, refetch: refetchVariants } = useQuery({
    queryKey: ['admin-product-variants', codigoPrefixo],
    queryFn: async () => {
      if (!codigoPrefixo) return [];
      const { data } = await supabase
        .from('products_cache')
        .select('id, slug, cor, image_url, image_urls, codigo_amigavel, estoque')
        .eq('codigo_prefixo', codigoPrefixo)
        .eq('ativo', true)
        .neq('id', product?.id ?? ''); // exclude the product being edited (it's the parent)
      return data ?? [];
    },
    enabled: !!codigoPrefixo,
  });

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    is_featured: false,
    is_hidden: false,
    featured_position: 1,
  });

  // Base product images
  const [imageMain, setImageMain] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imageMainRef = useRef<string | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  // Selected variant for editing its images
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [savingVariant, setSavingVariant] = useState(false);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (product && !initialized.current) {
      initialized.current = true;
      setForm({
        nome: product.nome ?? '',
        descricao: product.descricao ?? '',
        categoria: product.categoria ?? '',
        is_featured: product.is_featured ?? false,
        is_hidden: product.is_hidden ?? false,
        featured_position: product.featured_position ?? 1,
      });
      const imgs = (product.image_urls as string[] | null) ?? [];
      const finalImgs = product.image_url && !imgs.includes(product.image_url)
        ? [product.image_url, ...imgs]
        : (imgs.length ? imgs : (product.image_url ? [product.image_url] : []));
      setImageMain(product.image_url ?? null);
      setImageUrls(finalImgs);
      imageMainRef.current = product.image_url ?? null;
      imageUrlsRef.current = finalImgs;
    }
  }, [product]);

  // When a variant is selected, populate its images
  useEffect(() => {
    if (!selectedVariantId || !variantRows) return;
    const row = variantRows.find(v => v.id === selectedVariantId);
    if (!row) return;
    const imgs = (row.image_urls as string[] | null) ?? [];
    const finalImgs = row.image_url && !imgs.includes(row.image_url)
      ? [row.image_url, ...imgs]
      : (imgs.length ? imgs : (row.image_url ? [row.image_url] : []));
    setVariantImages(finalImgs);
  }, [selectedVariantId, variantRows]);

  const handleImagesUpdate = (main: string | null, imgs: string[]) => {
    setImageMain(main);
    setImageUrls(imgs);
    imageMainRef.current = main;
    imageUrlsRef.current = imgs;
    setDirty(true);
  };

  const handleVariantImagesUpdate = (_main: string | null, imgs: string[]) => {
    setVariantImages(imgs);
  };

  const handleSaveVariantImages = async () => {
    if (!selectedVariantId) return;
    setSavingVariant(true);
    const newMain = variantImages[0] ?? null;
    const { error } = await supabase
      .from('products_cache')
      .update({
        image_url: newMain,
        image_urls: variantImages,
        has_image: !!newMain,
      })
      .eq('id', selectedVariantId);
    setSavingVariant(false);
    if (error) {
      toast({ title: 'Erro ao salvar imagens da variante', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Imagens da variante salvas!' });
      refetchVariants();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const currentMain = imageMainRef.current;
    const currentImgs = imageUrlsRef.current;
    const { error } = await supabase
      .from('products_cache')
      .update({
        nome: form.nome,
        descricao: form.descricao,
        categoria: form.categoria,
        image_url: currentMain,
        image_urls: currentImgs,
        has_image: !!currentMain,
        is_featured: form.is_featured,
        is_hidden: form.is_hidden,
        featured_position: form.is_featured ? form.featured_position : null,
      })
      .eq('id', id!);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      setDirty(false);
      toast({ title: '✅ Produto atualizado com sucesso!' });
      initialized.current = false;
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando produto...</div>;
  if (!product) return <div className="p-8 text-muted-foreground">Produto não encontrado.</div>;

  const variantes = parseVariantes(product.variantes);
  const selectedVariantRow = variantRows?.find(v => v.id === selectedVariantId);

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/produtos')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
        {/* Left column */}
        <div className="space-y-4">
          {/* Image gallery — base product */}
          <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Imagens do produto
              {product.cor && <span className="ml-2 text-xs text-muted-foreground font-normal">({product.cor})</span>}
            </h3>
            <ImageGallery
              images={imageUrls}
              productId={id!}
              onUpdate={handleImagesUpdate}
            />
          </div>

          {/* Readonly fields */}
          <div className="rounded-xl border bg-background p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Informações (API)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Código</span>
                <span className="font-medium text-foreground">{product.codigo_amigavel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço Custo</span>
                <span className="font-medium text-foreground">{product.preco_custo ? formatarBRL(product.preco_custo) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estoque</span>
                <span className={`font-medium ${(product.estoque ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {product.estoque ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cor</span>
                <span className="font-medium text-foreground">{product.cor ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Variantes with image editing */}
          {variantes.length > 0 && (
            <div className="rounded-xl border bg-background p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Images className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Imagens por variante</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clique em uma cor para gerenciar as fotos específicas daquela variante.
              </p>

              {/* Color dot selector */}
              <div className="flex flex-wrap gap-2">
                {variantRows?.map((v) => {
                  const hex = getCorHex(v.cor ?? '');
                  const isSelected = v.id === selectedVariantId;
                  const hasCustomImg = (v.image_urls as string[] | null)?.some(u => u.includes('supabase.co/storage'));
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(isSelected ? null : v.id)}
                      title={v.cor ?? v.codigo_amigavel ?? ''}
                      className="relative w-9 h-9 rounded-full transition-all duration-150 shrink-0"
                      style={{
                        backgroundColor: hex,
                        border: isSelected ? '3px solid hsl(142,71%,45%)' : '2px solid hsl(var(--border))',
                        boxShadow: isSelected ? '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)' : undefined,
                      }}
                    >
                      {hasCustomImg && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border border-background" title="Tem imagem personalizada" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Variant image editor */}
              {selectedVariantId && selectedVariantRow && (
                <div className="mt-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Editando: <span className="text-primary">{selectedVariantRow.cor ?? selectedVariantRow.codigo_amigavel}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">Est: {selectedVariantRow.estoque ?? 0}</Badge>
                  </div>

                  <ImageGallery
                    images={variantImages}
                    productId={selectedVariantRow.id}
                    onUpdate={handleVariantImagesUpdate}
                  />

                  <Button
                    size="sm"
                    onClick={handleSaveVariantImages}
                    disabled={savingVariant}
                    className="w-full"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {savingVariant ? 'Salvando...' : `Salvar imagens — ${selectedVariantRow.cor ?? selectedVariantRow.codigo_amigavel}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-background p-6 space-y-5">
            <h3 className="text-base font-semibold text-foreground">Editar Produto</h3>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome exibido no site</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Ocultar do catálogo</Label>
                <p className="text-xs text-muted-foreground">Produto não aparecerá no site</p>
              </div>
              <Switch
                checked={form.is_hidden}
                onCheckedChange={(v) => setForm({ ...form, is_hidden: v })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Produto em Destaque</Label>
                  <p className="text-xs text-muted-foreground">Aparece na seção "Mais Procurados"</p>
                </div>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
              </div>

              {form.is_featured && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                  <Label>Posição nos destaques</Label>
                  <Select
                    value={String(form.featured_position)}
                    onValueChange={(v) => setForm({ ...form, featured_position: Number(v) })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}ª posição</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className={`w-full ${dirty ? 'ring-2 ring-yellow-400' : ''}`}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : dirty ? '⚠️ Salvar Alterações (não salvo)' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
