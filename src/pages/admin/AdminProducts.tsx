import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, EyeOff, Star, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatarBRL } from '@/utils/price';

const CATEGORIES = [
  { value: '', label: 'Todas categorias' },
  { value: 'garrafas', label: 'Garrafas' },
  { value: 'copos', label: 'Copos' },
  { value: 'mochilas', label: 'Mochilas' },
  { value: 'bolsas', label: 'Bolsas' },
  { value: 'kits', label: 'Kits' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'outros', label: 'Outros' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'hidden', label: 'Ocultos' },
  { value: 'featured', label: 'Destaques' },
];

const PAGE_SIZE = 20;

async function fetchProducts(search: string, category: string, status: string, page: number) {
  let query = supabase
    .from('products_cache')
    .select('id, nome, slug, image_url, codigo_amigavel, categoria, preco_custo, estoque, is_featured, is_hidden, variantes_count', { count: 'exact' })
    .eq('is_variante', false)
    .order('nome', { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (search) query = query.ilike('nome', `%${search}%`);
  if (category) query = query.eq('categoria', category);
  if (status === 'featured') query = query.eq('is_featured', true);
  if (status === 'hidden') query = query.eq('is_hidden', true);
  if (status === 'active') query = query.eq('is_hidden', false);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', debouncedSearch, category, status, page],
    queryFn: () => fetchProducts(debouncedSearch, category, status, page),
  });

  const products = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  }, [queryClient]);

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from('products_cache').update({ is_featured: !current }).eq('id', id);
    refetch();
  };

  const toggleHidden = async (id: string, current: boolean) => {
    await supabase.from('products_cache').update({ is_hidden: !current }).eq('id', id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Produtos</h2>
        <p className="text-sm text-muted-foreground">{totalCount} produtos encontrados</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value || 'all'} value={c.value || 'all'}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === f.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[60px_1fr_120px_100px_80px_120px] gap-4 px-4 py-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
            <div
              key={p.id}
              className="grid grid-cols-[60px_1fr_120px_100px_80px_120px] gap-4 px-4 py-3 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors"
            >
              {/* Photo */}
              <div className="w-[52px] h-[52px] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.nome} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
                )}
              </div>

              {/* Name + code + badges */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground">SKU: {p.codigo_amigavel}</p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {p.is_featured && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 text-[11px] px-2 py-0">
                      ⭐ Destaque
                    </Badge>
                  )}
                  {p.is_hidden && (
                    <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 text-[11px] px-2 py-0">
                      Oculto
                    </Badge>
                  )}
                  {!p.is_hidden && !p.is_featured && (
                    <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 text-[11px] px-2 py-0">
                      Ativo
                    </Badge>
                  )}
                  {(p.variantes_count ?? 1) > 1 && (
                    <Badge variant="outline" className="text-[11px] px-2 py-0">
                      {p.variantes_count} variantes
                    </Badge>
                  )}
                </div>
              </div>

              {/* Category */}
              <span className="text-sm text-muted-foreground capitalize">{p.categoria}</span>

              {/* Price */}
              <span className="text-sm text-foreground text-right font-medium">
                {p.preco_custo ? formatarBRL(p.preco_custo) : '—'}
              </span>

              {/* Stock */}
              <span className={`text-sm text-right font-medium ${(p.estoque ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {p.estoque ?? 0}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title={p.is_featured ? 'Remover destaque' : 'Destacar'}
                  onClick={() => toggleFeatured(p.id, !!p.is_featured)}
                >
                  <Star className={`h-4 w-4 ${p.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title={p.is_hidden ? 'Mostrar' : 'Ocultar'}
                  onClick={() => toggleHidden(p.id, !!p.is_hidden)}
                >
                  {p.is_hidden ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
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
    </div>
  );
}
