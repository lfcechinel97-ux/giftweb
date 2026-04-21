import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MultiplierStepper } from "@/components/admin/MultiplierStepper";
import { VOLUME_TIERS, getMarkup, getDesconto, type CostBand } from "@/utils/price";

type TierRow = { qty: number; multiplicador: number };
type BandConfig = { min: number; max: number; tiers: TierRow[] };

interface CategoryRow {
  id: string;
  slug: string;
  label: string;
  category_type: string;
  position: number;
  active: boolean;
  tabela_multiplicadores: unknown;
}

interface CategoryWithCount extends CategoryRow {
  product_count: number;
}

interface BandDistribution {
  bucket: string;
  min_val: number;
  max_val: number;
  total: number;
}

const TIERS = VOLUME_TIERS as readonly number[];

/** Multiplicador padrão por faixa, baseado no preço de custo médio da banda. */
function defaultTiersForCost(precoMedio: number): TierRow[] {
  const baseMarkup = getMarkup(precoMedio);
  return TIERS.map((qty) => ({
    qty,
    multiplicador: Math.round(baseMarkup * (1 - getDesconto(qty)) * 100) / 100,
  }));
}

/** Lê configuração salva (formato novo ou legado) e devolve por banda. */
function readSavedBand(raw: unknown, band: CostBand): TierRow[] | null {
  if (!Array.isArray(raw)) return null;
  // Formato novo: [{min,max,tiers:[...]}]
  for (const entry of raw as any[]) {
    if (entry && typeof entry === "object" && Array.isArray(entry.tiers)) {
      const min = Number(entry.min);
      const max = Number(entry.max);
      if (isFinite(min) && isFinite(max) && Math.abs(min - band.min) < 0.001 && Math.abs(max - band.max) < 0.001) {
        return normalizeTiers(entry.tiers);
      }
    }
  }
  // Formato legado: array plano de tiers — aplica a todas as bandas
  const looksFlat = (raw as any[]).every(
    (r) => r && typeof r === "object" && (r.qty !== undefined || r.quantidade !== undefined),
  );
  if (looksFlat) return normalizeTiers(raw as any[]);
  return null;
}

function normalizeTiers(rows: any[]): TierRow[] {
  const map = new Map<number, number>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const qty = Number(r.qty ?? r.quantidade);
    const mult = Number(r.multiplicador);
    if (isFinite(qty) && isFinite(mult) && mult > 0) map.set(qty, mult);
  }
  return TIERS.map((qty) => ({ qty, multiplicador: map.get(qty) ?? 1 }));
}

export default function AdminPricing() {
  const qc = useQueryClient();
  // edits[`${catId}::${bucket}`] = TierRow[]
  const [edits, setEdits] = useState<Record<string, TierRow[]>>({});
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    cat: CategoryWithCount;
    band?: BandDistribution;
    productCount: number;
  } | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-pricing-categories-v2"],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from("spotlight_categories")
        .select("id, slug, label, category_type, position, active, tabela_multiplicadores")
        .eq("active", true)
        .order("category_type", { ascending: true })
        .order("position", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;

      const { data: counts, error: cErr } = await supabase.rpc("get_category_product_counts");
      if (cErr) throw cErr;
      const countMap = new Map<string, number>();
      for (const r of (counts ?? []) as any[]) {
        countMap.set(r.category_id, Number(r.total) || 0);
      }

      return ((cats ?? []) as any[]).map<CategoryWithCount>((c) => ({
        ...c,
        product_count: countMap.get(c.id) ?? 0,
      }));
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!categories) return [];
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.label.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const toggleExpand = (catId: string) => {
    setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const updateTier = (catId: string, bucket: string, qty: number, mult: number) => {
    const key = `${catId}::${bucket}`;
    setEdits((prev) => {
      const current = prev[key] ?? TIERS.map((q) => ({ qty: q, multiplicador: 1 }));
      return {
        ...prev,
        [key]: current.map((t) => (t.qty === qty ? { ...t, multiplicador: mult } : t)),
      };
    });
  };

  const restoreBand = (catId: string, band: BandDistribution) => {
    const key = `${catId}::${band.bucket}`;
    const med = (Number(band.min_val) + Number(band.max_val)) / 2;
    setEdits((prev) => ({ ...prev, [key]: defaultTiersForCost(med) }));
  };

  const applyBand = async (cat: CategoryWithCount, band: BandDistribution) => {
    const key = `${cat.id}::${band.bucket}`;
    setSavingKey(key);
    try {
      // 1. Ler config atual e merge com a banda alterada
      const { data: catRow, error: rErr } = await supabase
        .from("spotlight_categories")
        .select("tabela_multiplicadores")
        .eq("id", cat.id)
        .maybeSingle();
      if (rErr) throw rErr;

      const tiers = edits[key] ?? defaultTiersForCost((Number(band.min_val) + Number(band.max_val)) / 2);
      const existing: BandConfig[] = Array.isArray(catRow?.tabela_multiplicadores)
        ? ((catRow!.tabela_multiplicadores as any[])
            .filter((e: any) => e && typeof e === "object" && Array.isArray(e.tiers))
            .map((e: any) => ({ min: Number(e.min), max: Number(e.max), tiers: normalizeTiers(e.tiers) })))
        : [];
      const min = Number(band.min_val);
      const max = Number(band.max_val);
      const filtered = existing.filter((b) => Math.abs(b.min - min) > 0.001 || Math.abs(b.max - max) > 0.001);
      filtered.push({ min, max, tiers });
      filtered.sort((a, b) => a.min - b.min);

      const { error: catErr } = await supabase
        .from("spotlight_categories")
        .update({ tabela_multiplicadores: filtered as any })
        .eq("id", cat.id);
      if (catErr) throw catErr;

      // 2. Buscar produtos vinculados nesta faixa
      const { data: links, error: linkErr } = await supabase
        .from("product_spotlight_categories")
        .select("product_id, products_cache!inner(id, preco_custo, ativo)")
        .eq("category_id", cat.id)
        .gte("products_cache.preco_custo", min)
        .lte("products_cache.preco_custo", max)
        .eq("products_cache.ativo", true);
      if (linkErr) throw linkErr;

      const productIds = Array.from(new Set((links ?? []).map((l: any) => l.product_id)));

      if (productIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < productIds.length; i += CHUNK) {
          const slice = productIds.slice(i, i + CHUNK);
          const { error: updErr } = await supabase
            .from("products_cache")
            .update({ tabela_precos: tiers as any })
            .in("id", slice);
          if (updErr) throw updErr;
        }
      }

      if (productIds.length > 0) {
        toast.success(
          `${productIds.length} produto(s) da faixa ${band.bucket} de "${cat.label}" atualizados`,
        );
      } else {
        toast.success(
          `Configuração salva para a faixa ${band.bucket}. 0 produtos nessa faixa atualmente — novos itens nessa faixa nascerão precificados.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-categories-v2"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar faixa");
    } finally {
      setSavingKey(null);
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Precificação por Categoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina multiplicadores por <strong>faixa de preço de custo</strong> e por quantidade.
            Preço final = <strong>preço de custo × multiplicador</strong>.
          </p>
        </div>
      </div>

      <Input
        placeholder="Buscar categoria..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="space-y-2">
        {isLoading && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Carregando categorias...
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-muted-foreground">
            Nenhuma categoria encontrada.
          </div>
        )}
        {filtered.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            expanded={!!expanded[cat.id]}
            onToggle={() => toggleExpand(cat.id)}
            edits={edits}
            setEditsForBand={(bucket, qty, mult) => updateTier(cat.id, bucket, qty, mult)}
            onRestoreBand={(band) => restoreBand(cat.id, band)}
            onApplyBand={(band, productCount) =>
              setConfirm({ cat, band, productCount })
            }
            savingKey={savingKey}
          />
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.band ? "Aplicar faixa de preço?" : "Aplicar categoria inteira?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai sobrescrever a tabela de preços individual de{" "}
              <strong>{confirm?.productCount ?? 0} produto(s)</strong>{" "}
              {confirm?.band ? (
                <>
                  na faixa <strong>R$ {confirm.band.bucket}</strong> da categoria{" "}
                </>
              ) : (
                "de TODAS as faixas da categoria "
              )}
              <strong>"{confirm?.cat.label}"</strong>. O preço de custo de cada produto é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.band) applyBand(confirm.cat, confirm.band);
                // applyEntireCategory recebe bands via card → será disparado lá
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- Sub-componente: card de categoria ----------------
function CategoryCard({
  cat,
  expanded,
  onToggle,
  edits,
  setEditsForBand,
  onRestoreBand,
  onApplyBand,
  savingKey,
}: {
  cat: CategoryWithCount;
  expanded: boolean;
  onToggle: () => void;
  edits: Record<string, TierRow[]>;
  setEditsForBand: (bucket: string, qty: number, mult: number) => void;
  onRestoreBand: (band: BandDistribution) => void;
  onApplyBand: (band: BandDistribution, productCount: number) => void;
  savingKey: string | null;
}) {
  const qc = useQueryClient();
  const [localConfirmBands, setLocalConfirmBands] = useState<BandDistribution[] | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  const { data: bands, isLoading: loadingBands } = useQuery({
    queryKey: ["category-cost-distribution", cat.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_category_cost_distribution", {
        p_category_id: cat.id,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map<BandDistribution>((d) => ({
        bucket: d.bucket,
        min_val: Number(d.min_val),
        max_val: Number(d.max_val),
        total: Number(d.total),
      }));
    },
    enabled: expanded,
    staleTime: 30_000,
  });

  // Inicializa edits para cada banda (lê config salva por banda ou padrão)
  useEffect(() => {
    if (!expanded || !bands) return;
    for (const b of bands) {
      const key = `${cat.id}::${b.bucket}`;
      if (edits[key]) continue;
      const band: CostBand = { bucket: b.bucket, min: b.min_val, max: b.max_val };
      const saved = readSavedBand(cat.tabela_multiplicadores, band);
      const initial = saved ?? defaultTiersForCost((b.min_val + b.max_val) / 2);
      setEditsForBand(b.bucket, -1, 0); // touch placeholder, sobrescrito abaixo
      // Hack: precisamos setar diretamente via prop; usamos cada qty
      for (const t of initial) {
        setEditsForBand(b.bucket, t.qty, t.multiplicador);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, bands]);

  const totalProducts = useMemo(
    () => (bands ?? []).reduce((acc, b) => acc + b.total, 0),
    [bands],
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{cat.label}</span>
            <Badge
              variant="outline"
              className={
                cat.category_type === "base"
                  ? "border-primary/30 text-primary text-[10px]"
                  : "text-[10px]"
              }
            >
              {cat.category_type === "base" ? "Base" : "Marketing"}
            </Badge>
            <span className="text-xs text-muted-foreground">{cat.slug}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {cat.product_count} produto(s)
          {expanded && bands && ` · ${bands.length} faixa(s)`}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/10">
          {loadingBands && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Carregando faixas de preço...
            </div>
          )}
          {!loadingBands && (!bands || bands.length === 0) && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum produto ativo com preço de custo definido.
            </div>
          )}
          {!loadingBands && bands && bands.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                        Faixa de custo (R$)
                      </th>
                      <th className="text-center font-medium px-2 py-2">Produtos</th>
                      {TIERS.map((q) => (
                        <th
                          key={q}
                          className="text-center font-medium px-1 py-2 whitespace-nowrap text-xs"
                        >
                          {q === 1000 ? "1000+" : q}
                        </th>
                      ))}
                      <th className="text-right font-medium px-3 py-2 whitespace-nowrap">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bands.map((band) => {
                      const key = `${cat.id}::${band.bucket}`;
                      const tiers =
                        edits[key] ??
                        defaultTiersForCost((band.min_val + band.max_val) / 2);
                      return (
                        <tr key={band.bucket} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-medium tabular-nums">
                            {band.bucket}
                          </td>
                          <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">
                            {band.total}
                          </td>
                          {TIERS.map((q) => {
                            const tier = tiers.find((t) => t.qty === q);
                            return (
                              <td key={q} className="px-1 py-2 text-center">
                                <MultiplierStepper
                                  value={tier?.multiplicador ?? 1}
                                  onChange={(v) => setEditsForBand(band.bucket, q, v)}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRestoreBand(band)}
                                title="Restaurar padrão desta faixa"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-8"
                                disabled={savingKey === key || band.total === 0}
                                onClick={() => onApplyBand(band, band.total)}
                              >
                                {savingKey === key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Aplicar"
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-muted/20">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocalConfirmBands(bands)}
                  disabled={savingCat || totalProducts === 0}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Aplicar categoria inteira
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirmação de aplicar categoria inteira (local ao card) */}
      <AlertDialog
        open={!!localConfirmBands}
        onOpenChange={(o) => !o && setLocalConfirmBands(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar categoria inteira?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai aplicar os multiplicadores de <strong>{bands?.length ?? 0} faixa(s)</strong>{" "}
              em <strong>{totalProducts} produto(s)</strong> da categoria{" "}
              <strong>"{cat.label}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingCat}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingCat}
              onClick={async () => {
                if (!localConfirmBands) return;
                setSavingCat(true);
                try {
                  const payload: BandConfig[] = localConfirmBands.map((b) => ({
                    min: b.min_val,
                    max: b.max_val,
                    tiers:
                      edits[`${cat.id}::${b.bucket}`] ??
                      defaultTiersForCost((b.min_val + b.max_val) / 2),
                  }));
                  const { error: catErr } = await supabase
                    .from("spotlight_categories")
                    .update({ tabela_multiplicadores: payload as any })
                    .eq("id", cat.id);
                  if (catErr) throw catErr;

                  let total = 0;
                  for (const b of localConfirmBands) {
                    const tiers =
                      edits[`${cat.id}::${b.bucket}`] ??
                      defaultTiersForCost((b.min_val + b.max_val) / 2);
                    const { data: links } = await supabase
                      .from("product_spotlight_categories")
                      .select("product_id, products_cache!inner(id, preco_custo, ativo)")
                      .eq("category_id", cat.id)
                      .gte("products_cache.preco_custo", b.min_val)
                      .lte("products_cache.preco_custo", b.max_val)
                      .eq("products_cache.ativo", true);
                    const productIds = Array.from(
                      new Set((links ?? []).map((l: any) => l.product_id)),
                    );
                    const CHUNK = 200;
                    for (let i = 0; i < productIds.length; i += CHUNK) {
                      const slice = productIds.slice(i, i + CHUNK);
                      await supabase
                        .from("products_cache")
                        .update({ tabela_precos: tiers as any })
                        .in("id", slice);
                    }
                    total += productIds.length;
                  }
                  toast.success(`${total} produto(s) atualizados em "${cat.label}"`);
                  qc.invalidateQueries({ queryKey: ["admin-products"] });
                  qc.invalidateQueries({ queryKey: ["admin-pricing-categories-v2"] });
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao aplicar categoria");
                } finally {
                  setSavingCat(false);
                  setLocalConfirmBands(null);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              {savingCat ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Aplicando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
