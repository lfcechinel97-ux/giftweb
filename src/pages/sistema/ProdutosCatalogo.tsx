import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchProductGroup, useSistemaProducts, type SistemaProduct } from "./useSistemaProducts";
import { formatBRL } from "@/contexts/SistemaContext";

function VarianteRow({ v }: { v: SistemaProduct }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs bg-muted/20 border-t border-border">
      <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center shrink-0">
        {v.image_url
          ? <img src={v.image_url} alt="" className="w-full h-full object-cover rounded" />
          : <Package className="h-3 w-3 text-muted-foreground" />}
      </span>
      <span className="font-mono text-muted-foreground w-28 shrink-0">{v.codigo_amigavel}</span>
      {v.cor && <Badge variant="outline" className="text-[9px] h-4">{v.cor}</Badge>}
      <span className="flex-1 truncate text-foreground">{v.nome}</span>
      <span className="shrink-0 text-right">
        <span className={`font-semibold ${(v.estoque ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>
          {v.estoque ?? 0}
        </span>
        <span className="text-muted-foreground"> un</span>
      </span>
    </div>
  );
}

function ProdutoCard({ parent, pvariants }: { parent: SistemaProduct; pvariants: SistemaProduct[] }) {
  const [expanded, setExpanded] = useState(false);
  const [loadedVariants, setLoadedVariants] = useState<SistemaProduct[]>(pvariants);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const variantsToShow = loadedVariants.length ? loadedVariants : pvariants;
  const variantCount = Math.max(parent.variantes_count ? parent.variantes_count - 1 : 0, variantsToShow.length);
  const hasVariants = variantCount > 0;
  const totalStock = parent.estoque_total ?? parent.estoque ?? 0;

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && loadedVariants.length === 0 && hasVariants) {
      setLoadingVariants(true);
      fetchProductGroup(parent.codigo_amigavel)
        .then((rows) => setLoadedVariants(rows.filter((p) => p.id !== parent.id)))
        .catch((error) => console.error("Erro ao carregar variantes", error))
        .finally(() => setLoadingVariants(false));
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-14 h-14 rounded bg-secondary shrink-0 overflow-hidden">
          {parent.image_url
            ? <img src={parent.image_url} alt={parent.nome} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium line-clamp-2">{parent.nome}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{parent.codigo_amigavel}</p>
          <div className="flex items-center gap-2 mt-1">
            {parent.categoria && <Badge variant="secondary" className="text-[9px] h-4 px-1">{parent.categoria}</Badge>}
            {!parent.has_image && <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-400">Sem foto</Badge>}
            {parent.is_hidden && <Badge variant="outline" className="text-[9px] h-4 px-1 text-gray-500">Oculto</Badge>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold">{parent.preco_custo ? formatBRL(parent.preco_custo) : "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Estoque: <span className={`font-semibold ${totalStock > 0 ? "text-green-600" : "text-red-500"}`}>{totalStock}</span>
          </p>
          {hasVariants && (
            <button
              className="flex items-center gap-1 text-[10px] text-primary mt-1 ml-auto"
              onClick={toggleExpanded}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {variantCount} variante{variantCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {expanded && hasVariants && (
        <div>
          {loadingVariants && <div className="px-3 py-2 text-xs text-muted-foreground">Carregando variantes...</div>}
          {variantsToShow.map(v => <VarianteRow key={v.id} v={v} />)}
        </div>
      )}
    </div>
  );
}

export default function ProdutosCatalogo() {
  const { parentProducts, variants, isLoading, searchParents } = useSistemaProducts();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SistemaProduct[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [categoria, setCategoria] = useState("todas");
  const [mostrar, setMostrar] = useState<"todos" | "com_foto" | "sem_foto">("todos");
  useMemo(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchParents(term, 80)
        .then((rows) => { if (!cancelled) setSearchResults(rows); })
        .catch((error) => {
          console.error("Erro ao buscar produtos", error);
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, searchParents]);


  const categorias = useMemo(() => {
    const s = new Set<string>();
    parentProducts.forEach(p => p.categoria && s.add(p.categoria));
    return Array.from(s).sort();
  }, [parentProducts]);

  const variantesByParent = useMemo(() => {
    const map = new Map<string, SistemaProduct[]>();
    for (const v of variants) {
      if (!v.produto_pai) continue;
      const arr = map.get(v.produto_pai) ?? [];
      arr.push(v);
      map.set(v.produto_pai, arr);
    }
    return map;
  }, [variants]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = searchResults ?? parentProducts;
    return source.filter(p => {
      if (categoria !== "todas" && p.categoria !== categoria) return false;
      if (mostrar === "com_foto" && !p.has_image) return false;
      if (mostrar === "sem_foto" && p.has_image) return false;
      if (!term) return true;
      // busca por nome, codigo, ou codigo de variante
      if (p.nome.toLowerCase().includes(term)) return true;
      if (p.codigo_amigavel.toLowerCase().includes(term)) return true;
      const pvars = variantesByParent.get(p.id) ?? [];
      return pvars.some(v => v.codigo_amigavel.toLowerCase().includes(term));
    });
  }, [parentProducts, searchResults, variantesByParent, search, categoria, mostrar]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Produtos</h2>
        <p className="text-sm text-muted-foreground">Catálogo completo — todos os produtos ativos da XBZ, incluindo variantes.</p>
      </div>

      <div className="bg-card rounded-lg border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou código (ex: 08338-BCO)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="md:w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mostrar} onValueChange={v => setMostrar(v as any)}>
          <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="com_foto">Com foto</SelectItem>
            <SelectItem value="sem_foto">Sem foto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || searching ? (
        <div className="text-center py-16 text-muted-foreground">Carregando catálogo...</div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} pai
            {" "}· {variants.length} variante{variants.length !== 1 ? "s" : ""} no total
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(p => (
              <ProdutoCard
                key={p.id}
                parent={p}
                pvariants={variantesByParent.get(p.id) ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
