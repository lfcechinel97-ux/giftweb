import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, EyeOff, Star, ChevronLeft, ChevronRight, Pencil, ExternalLink, DollarSign, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { formatarBRL, VOLUME_TIERS, getMultiplierForQty, getCustomMultiplier, getMarkup } from '@/utils/price';
import { useToast } from '@/hooks/use-toast';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'hidden', label: 'Ocultos' },
  { value: 'featured', label: 'Destaques' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

type ProductRow = {
  id: string;
  nome: string;
  slug: string | null;
  image_url: string | null;
  codigo_amigavel: string;
  categoria: string | null;
  preco_custo: number | null;
  estoque: number | null;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  variantes_count: number | null;
  tabela_precos: any;
};

async function fetchProducts(search: string, category: string, status: string, page: number, pageSize: number) {
  const { data, error } = await supabase.rpc('admin_search_products' as any, {
    p_search: search || null,
    p_category_slug: category || null,
    p_status: status,
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw error;
  const result = data as any;
  return {
    data: (result?.rows ?? []) as ProductRow[],
    count: (result?.total_count ?? 0) as number,
  };
}

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [categories, setCategories] = useState<{ slug: string; label: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedPriceId, setExpandedPriceId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from('spotlight_categories')
      .select('slug, label, position')
      .eq('active', true)
      .order('position', { ascending: true })
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [category, status, pageSize, debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ['admin-products', debouncedSearch, category, status, page, pageSize];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchProducts(debouncedSearch, category, status, page, pageSize),
    placeholderData: keepPreviousData,
  });

  const products = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['homepage-data'] });
  }, [queryClient]);

  // Optimistic toggle for individual hide/feature
  const optimisticPatch = (id: string, patch: Partial<ProductRow>) => {
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return { ...old, data: old.data.map((p: ProductRow) => p.id === id ? { ...p, ...patch } : p) };
    });
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    optimisticPatch(id, { is_featured: !current });
    const { error } = await supabase.from('products_cache').update({ is_featured: !current }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); invalidateAll(); }
    else queryClient.invalidateQueries({ queryKey: ['homepage-data'] });
  };

  const toggleHidden = async (id: string, current: boolean) => {
    optimisticPatch(id, { is_hidden: !current });
    const { error } = await supabase.from('products_cache').update({ is_hidden: !current }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); invalidateAll(); return; }
    toast({ title: !current ? 'Produto ocultado' : 'Produto visível', description: 'O site público atualiza em até 1 minuto.' });
    queryClient.invalidateQueries({ queryKey: ['homepage-data'] });
  };

  const bulkToggleHidden = async (hidden: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from('products_cache').update({ is_hidden: hidden }).in('id', ids);
    setBulkLoading(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: hidden ? `${ids.length} produtos ocultados` : `${ids.length} produtos exibidos`, description: 'O site público atualiza em até 1 minuto.' });
    setSelectedIds(new Set());
    invalidateAll();
  };

  const allSelectedOnPage = products.length > 0 && products.every(p => selectedIds.has(p.id));
  const toggleAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelectedOnPage) products.forEach(p => next.delete(p.id));
      else products.forEach(p => next.add(p.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">Produtos</h2>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-sm text-muted-foreground">{totalCount} produtos encontrados</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === f.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)}>{n} / página</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl border overflow-hidden">
        {/* Header (desktop only) */}
        <div className="hidden md:grid grid-cols-[40px_60px_1fr_120px_100px_80px_140px] gap-4 px-4 py-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Checkbox checked={allSelectedOnPage} onCheckedChange={toggleAllOnPage} aria-label="Selecionar todos" />
          <span>Foto</span>
          <span>Produto</span>
          <span>Categoria</span>
          <span className="text-right">Preço</span>
          <span className="text-right">Estoque</span>
          <span className="text-center">Ações</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="border-b last:border-b-0">
              {/* Mobile card / Desktop row */}
              <div className="md:grid md:grid-cols-[40px_60px_1fr_120px_100px_80px_140px] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors flex flex-row flex-wrap">
                {/* Checkbox */}
                <div className="flex items-center">
                  <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleOne(p.id)} aria-label={`Selecionar ${p.nome}`} />
                </div>

                {/* Photo */}
                <div className="w-[52px] h-[52px] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.nome} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
                  )}
                </div>

                {/* Name + code + badges */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.codigo_amigavel}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {p.is_featured && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 text-[11px] px-2 py-0">⭐ Destaque</Badge>
                    )}
                    {p.is_hidden && (
                      <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 text-[11px] px-2 py-0">Oculto</Badge>
                    )}
                    {!p.is_hidden && !p.is_featured && (
                      <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 text-[11px] px-2 py-0">Ativo</Badge>
                    )}
                    {(p.variantes_count ?? 1) > 1 && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0">{p.variantes_count} variantes</Badge>
                    )}
                  </div>
                </div>

                {/* Category */}
                <span className="text-sm text-muted-foreground capitalize hidden md:inline">{p.categoria}</span>

                {/* Price */}
                <span className="text-sm text-foreground md:text-right font-medium">
                  {p.preco_custo ? formatarBRL(p.preco_custo) : '—'}
                </span>

                {/* Stock */}
                <span className={`text-sm md:text-right font-medium ${(p.estoque ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {p.estoque ?? 0}
                </span>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1 ml-auto md:ml-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar preços rápido"
                    onClick={() => setExpandedPriceId(expandedPriceId === p.id ? null : p.id)}>
                    <DollarSign className={`h-4 w-4 ${expandedPriceId === p.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title={p.is_featured ? 'Remover destaque' : 'Destacar'}
                    onClick={() => toggleFeatured(p.id, !!p.is_featured)}>
                    <Star className={`h-4 w-4 ${p.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title={p.is_hidden ? 'Mostrar' : 'Ocultar'}
                    onClick={() => toggleHidden(p.id, !!p.is_hidden)}>
                    {p.is_hidden ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => navigate(`/admin/produtos/${p.id}`)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  {p.slug && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver no site"
                      onClick={() => window.open(`/produto/${p.slug}`, '_blank')}>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline price editor */}
              {expandedPriceId === p.id && (
                <PriceEditor
                  product={p}
                  onSaved={(patch) => {
                    optimisticPatch(p.id, patch);
                    setExpandedPriceId(null);
                    queryClient.invalidateQueries({ queryKey: ['homepage-data'] });
                  }}
                  onClose={() => setExpandedPriceId(null)}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-3 border border-border/20">
          <span className="text-sm font-medium">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <span className="h-4 w-px bg-background/20" />
          <Button size="sm" variant="ghost" className="h-8 text-background hover:bg-background/10 hover:text-background"
            disabled={bulkLoading} onClick={() => bulkToggleHidden(true)}>
            <EyeOff className="h-3.5 w-3.5 mr-1.5" /> Ocultar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-background hover:bg-background/10 hover:text-background"
            disabled={bulkLoading} onClick={() => bulkToggleHidden(false)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Exibir
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-background/70 hover:text-background ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Inline price editor =====
function PriceEditor({
  product,
  onSaved,
  onClose,
}: {
  product: ProductRow;
  onSaved: (patch: Partial<ProductRow>) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [precoCusto, setPrecoCusto] = useState<string>(String(product.preco_custo ?? 0));
  const [saving, setSaving] = useState(false);

  const initialMultipliers = useMemo(() => {
    const cost = Number(product.preco_custo) || 0;
    const out: Record<number, string> = {};
    for (const qty of VOLUME_TIERS) {
      const custom = getCustomMultiplier(product.tabela_precos, cost, qty);
      const value = custom ?? getMultiplierForQty(cost, qty);
      out[qty] = value.toFixed(2);
    }
    return out;
  }, [product]);

  const [multipliers, setMultipliers] = useState<Record<number, string>>(initialMultipliers);

  const handleSave = async () => {
    const cost = parseFloat(precoCusto.replace(',', '.'));
    if (isNaN(cost) || cost < 0) { toast({ title: 'Preço de custo inválido', variant: 'destructive' }); return; }
    const tabela = VOLUME_TIERS.map(qty => ({
      qty,
      multiplicador: parseFloat((multipliers[qty] || '0').replace(',', '.')),
    }));
    const invalid = tabela.find(r => isNaN(r.multiplicador) || r.multiplicador <= 0);
    if (invalid) {
      toast({ title: 'Multiplicador inválido', description: `Verifique o valor para ${invalid.qty} un (deve ser > 0).`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('products_cache')
      .update({ preco_custo: cost, tabela_precos: tabela })
      .eq('id', product.id);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Preços atualizados' });
    onSaved({ preco_custo: cost, tabela_precos: tabela });
  };

  return (
    <div className="bg-muted/40 px-4 py-4 border-t">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase">Preço custo (R$)</label>
          <Input value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} className="h-9 w-28" inputMode="decimal" />
        </div>
        {VOLUME_TIERS.map((qty, i) => (
          <div key={qty} className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase">
              {qty}{i === VOLUME_TIERS.length - 1 ? '+' : ''} un (×)
            </label>
            <Input
              value={multipliers[qty]}
              onChange={(e) => setMultipliers(prev => ({ ...prev, [qty]: e.target.value }))}
              className="h-9 w-20"
              inputMode="decimal"
            />
          </div>
        ))}
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Multiplicador aplicado sobre o preço de custo (já considera desconto por volume). Markup base atual:{' '}
        <strong>{getMarkup(parseFloat(precoCusto.replace(',', '.')) || 0).toFixed(1)}×</strong>
      </p>
    </div>
  );
}
