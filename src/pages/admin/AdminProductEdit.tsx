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
import { ArrowLeft, Save, Upload, GripVertical, X, Plus, ImageOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatarBRL } from '@/utils/price';
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
  mainImage,
  images,
  productId,
  onUpdate,
}: {
  mainImage: string | null;
  images: string[];
  productId: string;
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

  // Drag-to-reorder
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
              i === 0 ? 'border-green-500' : 'border-border hover:border-primary/40'
            } ${dragIdx === i ? 'opacity-50 scale-95' : ''}`}
            title={i === 0 ? 'Imagem principal' : 'Clique para tornar principal'}
            onClick={() => setMain(i)}
          >
            <img src={url} alt={`img ${i}`} className="w-full h-full object-contain p-1 bg-background" />
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-[9px] text-center py-0.5">Principal</span>
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
        Arraste para reordenar · Clique em uma miniatura para torná-la principal · Verde = imagem principal
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

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    is_featured: false,
    is_hidden: false,
    featured_position: 1,
  });
  const [imageMain, setImageMain] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        nome: product.nome ?? '',
        descricao: product.descricao ?? '',
        categoria: product.categoria ?? '',
        is_featured: product.is_featured ?? false,
        is_hidden: product.is_hidden ?? false,
        featured_position: product.featured_position ?? 1,
      });
      setImageMain(product.image_url ?? null);
      const imgs = (product.image_urls as string[] | null) ?? [];
      // ensure main is first
      if (product.image_url && !imgs.includes(product.image_url)) {
        setImageUrls([product.image_url, ...imgs]);
      } else {
        setImageUrls(imgs.length ? imgs : (product.image_url ? [product.image_url] : []));
      }
    }
  }, [product]);

  const handleImagesUpdate = (main: string | null, imgs: string[]) => {
    setImageMain(main);
    setImageUrls(imgs);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('products_cache')
      .update({
        nome: form.nome,
        descricao: form.descricao,
        categoria: form.categoria,
        image_url: imageMain,
        image_urls: imageUrls,
        is_featured: form.is_featured,
        is_hidden: form.is_hidden,
        featured_position: form.is_featured ? form.featured_position : null,
      })
      .eq('id', id!);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Produto atualizado!' });
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando produto...</div>;
  if (!product) return <div className="p-8 text-muted-foreground">Produto não encontrado.</div>;

  const variantes = parseVariantes(product.variantes);

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/produtos')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
        {/* Left column */}
        <div className="space-y-4">
          {/* Image gallery */}
          <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Imagens</h3>
            <ImageGallery
              mainImage={imageMain}
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

          {/* Variantes */}
          {variantes.length > 0 && (
            <div className="rounded-xl border bg-background p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Variantes ({variantes.length})</h3>
              <div className="space-y-2">
                {variantes.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {v.image && (
                      <img src={v.image} alt={v.cor ?? ''} className="w-8 h-8 rounded object-contain bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground">{v.cor ?? v.codigo_amigavel}</span>
                    </div>
                    <Badge variant="outline" className="text-[11px]">Est: {v.estoque ?? 0}</Badge>
                  </div>
                ))}
              </div>
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

            {/* Categoria editável */}
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

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
