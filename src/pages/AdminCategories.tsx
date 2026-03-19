import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { autoCategorizeProducts, previewCategorization } from '@/lib/autoCategorize';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Zap, Eye, Layers, Tag, Loader2, AlertTriangle, Check } from 'lucide-react';

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<{
    counts: Record<string, number>;
    samples: Record<string, string[]>;
    total: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Auto-categorize
  const autoCategorizeMut = useMutation({
    mutationFn: autoCategorizeProducts,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-category-counts'] });
      setPreviewData(null);
      toast.success(`${result.inserted} vínculos criados`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} erros encontrados`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Preview
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await previewCategorization();
      setPreviewData(result);
    } catch {
      toast.error('Erro ao gerar preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const baseCategories = categories?.filter((c) => c.category_type === 'base') ?? [];
  const marketingCategories = categories?.filter((c) => c.category_type === 'marketing') ?? [];

  // Build slug→label map for preview
  const slugLabelMap: Record<string, string> = {};
  for (const c of categories ?? []) {
    slugLabelMap[c.slug] = c.label;
  }

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
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
            {previewLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            Preview
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      {previewData && (
        <div className="bg-background border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Pré-visualização da Auto-categorização
              </h3>
              <p className="text-xs text-muted-foreground">
                Total de produtos: {previewData.total.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>
                Cancelar
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
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirmar e executar
              </Button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Categoria</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-20">Qtd</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Exemplos</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(previewData.counts)
                .sort(([, a], [, b]) => b - a)
                .map(([slug, count]) => {
                  const isDiversos = slug === 'diversos';
                  return (
                    <tr
                      key={slug}
                      className={`border-b last:border-0 ${isDiversos ? 'bg-amber-50 dark:bg-amber-950/20' : 'hover:bg-muted/10'}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {isDiversos && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          {slugLabelMap[slug] || slug}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={isDiversos ? 'outline' : 'secondary'}>{count}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs truncate max-w-[300px]">
                        {previewData.samples[slug]?.join(', ') || '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {(previewData.counts['diversos'] ?? 0) > 0 && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-t text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {previewData.counts['diversos']} produtos em "Diversos" — revisar manualmente
            </div>
          )}
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
