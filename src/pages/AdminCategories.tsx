import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { autoCategorizeProducts, previewCategorization } from '@/lib/autoCategorize';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Zap, Eye, Layers, Tag, Loader2 } from 'lucide-react';

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<Record<string, number> | null>(null);

  // Fetch all spotlight categories
  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ['admin-spotlight-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spotlight_categories')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch product counts per category
  const { data: categoryCounts } = useQuery({
    queryKey: ['admin-category-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_spotlight_categories')
        .select('category_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.category_id] = (counts[row.category_id] || 0) + 1;
      }
      return counts;
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('spotlight_categories')
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spotlight-categories'] });
      toast.success('Status atualizado');
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-categorize all products
  const autoCategorizeMut = useMutation({
    mutationFn: async () => {
      // Fetch all parent products
      const { data: products, error } = await supabase
        .from('products_cache')
        .select('id, nome')
        .eq('is_variante', false)
        .eq('ativo', true);
      if (error) throw error;
      if (!products?.length) throw new Error('Nenhum produto encontrado');
      return autoCategorizeProducts(products);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-category-counts'] });
      toast.success(`${result.inserted} vínculos criados`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} erros encontrados`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Preview categorization
  const handlePreview = async () => {
    const { data: products, error } = await supabase
      .from('products_cache')
      .select('id, nome')
      .eq('is_variante', false)
      .eq('ativo', true);
    if (error || !products) {
      toast.error('Erro ao buscar produtos');
      return;
    }
    const result = previewCategorization(products);
    setPreviewData(result);
  };

  const baseCategories = categories?.filter((c) => c.category_type === 'base') ?? [];
  const marketingCategories = categories?.filter((c) => c.category_type === 'marketing') ?? [];

  if (loadingCats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie categorias base e de marketing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => autoCategorizeMut.mutate()}
            disabled={autoCategorizeMut.isPending}
          >
            {autoCategorizeMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            Auto-categorizar
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      {previewData && (
        <div className="bg-muted/60 border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Preview da auto-categorização</h3>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>
              Fechar
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(previewData)
              .sort(([, a], [, b]) => b - a)
              .map(([slug, count]) => (
                <div
                  key={slug}
                  className="flex items-center justify-between bg-background rounded px-3 py-2 text-sm"
                >
                  <span className="text-foreground truncate">{slug}</span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {count}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="base">
        <TabsList>
          <TabsTrigger value="base" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Base ({baseCategories.length})
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Marketing ({marketingCategories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="base" className="mt-4">
          <CategoryTable
            categories={baseCategories}
            counts={categoryCounts ?? {}}
            onToggleActive={(id, active) => toggleActive.mutate({ id, active })}
          />
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <CategoryTable
            categories={marketingCategories}
            counts={categoryCounts ?? {}}
            onToggleActive={(id, active) => toggleActive.mutate({ id, active })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoryTable({
  categories,
  counts,
  onToggleActive,
}: {
  categories: Array<{
    id: string;
    slug: string;
    label: string;
    description: string | null;
    position: number;
    active: boolean;
    category_type: string;
  }>;
  counts: Record<string, number>;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  return (
    <div className="bg-background border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Slug</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produtos</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 text-muted-foreground">{cat.position}</td>
              <td className="px-4 py-3 font-medium text-foreground">{cat.label}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{cat.slug}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{counts[cat.id] ?? 0}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={cat.active ? 'default' : 'outline'}>
                  {cat.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleActive(cat.id, !cat.active)}
                >
                  {cat.active ? 'Desativar' : 'Ativar'}
                </Button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                Nenhuma categoria encontrada
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
