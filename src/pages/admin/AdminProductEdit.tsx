import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatarBRL } from '@/utils/price';
import type { Json } from '@/integrations/supabase/types';

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

export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    is_featured: false,
    is_hidden: false,
    featured_position: 1,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        nome: product.nome ?? '',
        descricao: product.descricao ?? '',
        is_featured: product.is_featured ?? false,
        is_hidden: product.is_hidden ?? false,
        featured_position: product.featured_position ?? 1,
      });
    }
  }, [product]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('products_cache')
      .update({
        nome: form.nome,
        descricao: form.descricao,
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
    }
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Carregando produto...</div>;
  }

  if (!product) {
    return <div className="p-8 text-muted-foreground">Produto não encontrado.</div>;
  }

  const variantes = parseVariantes(product.variantes);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/produtos')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
        {/* Left column — photo + readonly info */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-background overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.nome} className="w-full aspect-square object-contain p-4" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-muted-foreground">Sem imagem</div>
            )}
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
                <span className="text-muted-foreground">Categoria</span>
                <span className="font-medium text-foreground capitalize">{product.categoria}</span>
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
                    <Badge variant="outline" className="text-[11px]">
                      Est: {v.estoque ?? 0}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — editable fields */}
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
