import { useMemo, useState } from "react";
import { Package, Search, Warehouse, Box } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSistemaProducts, stockLevel, type SistemaProduct } from "./useSistemaProducts";
import { useSistema } from "@/contexts/SistemaContext";

const levelMeta = {
  alto: { color: "bg-green-100 text-green-700 border-green-300", dot: "bg-green-500", label: "Alto" },
  medio: { color: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500", label: "Médio" },
  baixo: { color: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-500", label: "Baixo" },
  zero: { color: "bg-gray-100 text-gray-600 border-gray-300", dot: "bg-gray-400", label: "Sem estoque" },
};

/** Extrai o prefixo: "02087-AZU" → "02087", "02087" → "02087" */
function extractPrefixo(codigo: string): string {
  if (!codigo) return "";
  const idx = codigo.indexOf("-");
  return idx > 0 ? codigo.slice(0, idx) : codigo;
}

// ─── Aba: Estoque XBZ ─────────────────────────────────────────────────────────
function EstoqueXBZ({ search, categoria }: { search: string; categoria: string }) {
  const { parentProducts, allProducts, isLoading } = useSistemaProducts();

  /** Agrupa TODOS os produtos por prefixo do código */
  const variantesByPrefixo = useMemo(() => {
    const map = new Map<string, SistemaProduct[]>();
    for (const p of allProducts) {
      const prefixo = extractPrefixo(p.codigo_amigavel);
      const arr = map.get(prefixo) ?? [];
      arr.push(p);
      map.set(prefixo, arr);
    }
    return map;
  }, [allProducts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parentProducts.filter((p) => {
      if (categoria !== "todas" && p.categoria !== categoria) return false;
      if (!term) return true;
      if (p.nome.toLowerCase().includes(term)) return true;
      if (p.codigo_amigavel.toLowerCase().includes(term)) return true;
      const prefixo = extractPrefixo(p.codigo_amigavel);
      const pvars = variantesByPrefixo.get(prefixo) ?? [];
      return pvars.some((v) => v.codigo_amigavel.toLowerCase().includes(term));
    });
  }, [parentProducts, variantesByPrefixo, search, categoria]);

  if (isLoading) return <p className="text-center py-16 text-muted-foreground">Carregando...</p>;

  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""} pai
        {search && ` — busca inclui variantes`}
      </p>
      <div className="space-y-1">
        {filtered.map((p) => {
          const prefixo = extractPrefixo(p.codigo_amigavel);
          const grupo = variantesByPrefixo.get(prefixo) ?? [];
          // Variantes = todos do grupo exceto o representante (pai)
          const pvars = grupo.filter((v) => v.id !== p.id);
          const totalStock = p.estoque_total ?? p.estoque ?? 0;
          const lvl = stockLevel(totalStock);
          const m = levelMeta[lvl];
          return (
            <div key={p.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Linha do produto pai */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-9 h-9 rounded bg-secondary shrink-0 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.nome}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{p.codigo_amigavel}</p>
                </div>
                {p.categoria && (
                  <Badge variant="secondary" className="text-[9px] h-4 shrink-0">
                    {p.categoria}
                  </Badge>
                )}
                <div className="shrink-0 text-right min-w-[90px]">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${m.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                    {totalStock} un
                  </span>
                </div>
              </div>
              {/* Linhas de variantes */}
              {pvars.map((v) => {
                const vs = v.estoque ?? 0;
                const vl = stockLevel(vs);
                const vm = levelMeta[vl];
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-4 py-1.5 bg-muted/10 border-t border-dashed border-border text-xs"
                  >
                    <div className="w-9 shrink-0" />
                    <span className="font-mono text-muted-foreground w-24 shrink-0">{v.codigo_amigavel}</span>
                    {v.cor && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        {v.cor}
                      </Badge>
                    )}
                    <span className="flex-1 truncate text-muted-foreground">{v.nome}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${vm.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${vm.dot}`} />
                      {vs} un
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Aba: Estoque Próprio ─────────────────────────────────────────────────────
function EstoqueProprio({ search, categoria }: { search: string; categoria: string }) {
  const { parentProducts, allProducts, isLoading } = useSistemaProducts();
  const { ajustesEstoque } = useSistema();

  const getReserva = (produtoId: string, codigoComposto?: string): number => {
    return ajustesEstoque
      .filter((a) => a.produtoId === produtoId || (codigoComposto && a.codigoComposto === codigoComposto))
      .reduce((sum, a) => sum + Math.abs(a.quantidade), 0);
  };

  /** Agrupa TODOS os produtos por prefixo do código */
  const variantesByPrefixo = useMemo(() => {
    const map = new Map<string, SistemaProduct[]>();
    for (const p of allProducts) {
      const prefixo = extractPrefixo(p.codigo_amigavel);
      const arr = map.get(prefixo) ?? [];
      arr.push(p);
      map.set(prefixo, arr);
    }
    return map;
  }, [allProducts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parentProducts.filter((p) => {
      if (categoria !== "todas" && p.categoria !== categoria) return false;
      if (!term) return true;
      if (p.nome.toLowerCase().includes(term)) return true;
      if (p.codigo_amigavel.toLowerCase().includes(term)) return true;
      const prefixo = extractPrefixo(p.codigo_amigavel);
      const pvars = variantesByPrefixo.get(prefixo) ?? [];
      return pvars.some((v) => v.codigo_amigavel.toLowerCase().includes(term));
    });
  }, [parentProducts, variantesByPrefixo, search, categoria]);

  const comReserva = useMemo(
    () =>
      filtered.filter((p) => {
        if (getReserva(p.id) > 0) return true;
        const prefixo = extractPrefixo(p.codigo_amigavel);
        const pvars = variantesByPrefixo.get(prefixo) ?? [];
        return pvars.some((v) => getReserva(v.id, v.codigo_amigavel) > 0);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, variantesByPrefixo, ajustesEstoque],
  );

  if (isLoading) return <p className="text-center py-16 text-muted-foreground">Carregando...</p>;

  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">
        {comReserva.length > 0
          ? `${comReserva.length} produto(s) com estoque reservado em orçamentos aprovados`
          : "Nenhum produto com reserva de estoque no momento."}
      </p>

      {comReserva.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Warehouse className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum estoque reservado.</p>
          <p className="text-xs text-muted-foreground mt-1">Reservas são criadas ao aprovar orçamentos.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {comReserva.map((p) => {
            const baseStock = p.estoque_total ?? p.estoque ?? 0;
            const ajuste = getReserva(p.id);
            const disponivel = Math.max(0, baseStock - ajuste);
            const lvl = stockLevel(baseStock, ajuste);
            const m = levelMeta[lvl];
            const prefixo = extractPrefixo(p.codigo_amigavel);
            const pvars = (variantesByPrefixo.get(prefixo) ?? []).filter((v) => v.id !== p.id);

            return (
              <div key={p.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-9 h-9 rounded bg-secondary shrink-0 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.nome}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{p.codigo_amigavel}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <div
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${m.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                      {disponivel} disponível
                    </div>
                    {ajuste > 0 && <p className="text-[10px] text-red-600 font-medium">−{ajuste} reservado</p>}
                  </div>
                </div>
                {pvars
                  .filter((v) => getReserva(v.id, v.codigo_amigavel) > 0)
                  .map((v) => {
                    const va = getReserva(v.id, v.codigo_amigavel);
                    const vStock = v.estoque ?? 0;
                    const vDisp = Math.max(0, vStock - va);
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 px-4 py-1.5 bg-muted/10 border-t border-dashed border-border text-xs"
                      >
                        <div className="w-9 shrink-0" />
                        <span className="font-mono text-muted-foreground w-24 shrink-0">{v.codigo_amigavel}</span>
                        {v.cor && (
                          <Badge variant="outline" className="text-[9px] h-4">
                            {v.cor}
                          </Badge>
                        )}
                        <span className="flex-1 truncate text-muted-foreground">{v.nome}</span>
                        <span className="text-muted-foreground">{vDisp} disp.</span>
                        <span className="text-red-600 font-medium">−{va} res.</span>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Estoque() {
  const { parentProducts } = useSistemaProducts();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const categorias = useMemo(() => {
    const s = new Set<string>();
    parentProducts.forEach((p) => p.categoria && s.add(p.categoria));
    return Array.from(s).sort();
  }, [parentProducts]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Estoque</h2>
        <p className="text-sm text-muted-foreground">
          Consulte disponibilidade XBZ e acompanhe reservas dos seus orçamentos.
        </p>
      </div>

      {/* Filtros globais */}
      <div className="bg-card rounded-lg border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código (ex: 08338-BCO)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="md:w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Abas */}
      <Tabs defaultValue="xbz">
        <TabsList>
          <TabsTrigger value="xbz" className="flex items-center gap-1.5">
            <Box className="h-4 w-4" /> Estoque XBZ
          </TabsTrigger>
          <TabsTrigger value="proprio" className="flex items-center gap-1.5">
            <Warehouse className="h-4 w-4" /> Estoque Próprio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="xbz" className="mt-4">
          <EstoqueXBZ search={search} categoria={categoria} />
        </TabsContent>

        <TabsContent value="proprio" className="mt-4">
          <EstoqueProprio search={search} categoria={categoria} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
