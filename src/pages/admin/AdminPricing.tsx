import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Layers } from "lucide-react";
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
import { VOLUME_TIERS, getMarkup, getDesconto } from "@/utils/price";

type TierRow = { qty: number; multiplicador: number };

interface CategoryRow {
  id: string;
  slug: string;
  label: string;
  category_type: string;
  position: number;
  active: boolean;
  tabela_multiplicadores: TierRow[] | null;
}

interface CategoryWithCount extends CategoryRow {
  product_count: number;
}

const TIERS = VOLUME_TIERS as readonly number[];

/** Multiplicador padrão sugerido por faixa, usando markup médio (R$ 8 - faixa 3.8x). */
function defaultMultipliers(): TierRow[] {
  const baseMarkup = getMarkup(8); // 3.8x — faixa média
  return TIERS.map((qty) => ({
    qty,
    multiplicador: Math.round(baseMarkup * (1 - getDesconto(qty)) * 100) / 100,
  }));
}

function normalizeTabela(raw: unknown): TierRow[] {
  const fallback = defaultMultipliers();
  if (!Array.isArray(raw)) return fallback;
  const map = new Map<number, number>();
  for (const r of raw as any[]) {
    if (!r || typeof r !== "object") continue;
    const qty = Number(r.qty ?? r.quantidade);
    const mult = Number(r.multiplicador);
    if (isFinite(qty) && isFinite(mult) && mult > 0) map.set(qty, mult);
  }
  return TIERS.map((qty) => ({
    qty,
    multiplicador:
      map.get(qty) ?? fallback.find((f) => f.qty === qty)!.multiplicador,
  }));
}

export default function AdminPricing() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, TierRow[]>>({});
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CategoryWithCount | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pricing-categories"],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from("spotlight_categories")
        .select("id, slug, label, category_type, position, active, tabela_multiplicadores")
        .eq("active", true)
        .order("category_type", { ascending: true })
        .order("position", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;

      const { data: counts, error: cErr } = await supabase
        .from("product_spotlight_categories")
        .select("category_id");
      if (cErr) throw cErr;
      const countMap = new Map<string, number>();
      for (const r of counts ?? []) {
        countMap.set(r.category_id, (countMap.get(r.category_id) ?? 0) + 1);
      }

      return ((cats ?? []) as any[]).map<CategoryWithCount>((c) => ({
        ...c,
        tabela_multiplicadores: c.tabela_multiplicadores ?? null,
        product_count: countMap.get(c.id) ?? 0,
      }));
    },
    staleTime: 30_000,
  });

  // Inicializa edits com valores normalizados quando os dados chegam
  useEffect(() => {
    if (!data) return;
    setEdits((prev) => {
      const next = { ...prev };
      for (const c of data) {
        if (!next[c.id]) {
          next[c.id] = normalizeTabela(c.tabela_multiplicadores);
        }
      }
      return next;
    });
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) => c.label.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [data, search]);

  const updateTier = (catId: string, qty: number, mult: number) => {
    setEdits((prev) => {
      const current = prev[catId] ?? defaultMultipliers();
      return {
        ...prev,
        [catId]: current.map((t) => (t.qty === qty ? { ...t, multiplicador: mult } : t)),
      };
    });
  };

  const restoreDefaults = (catId: string) => {
    setEdits((prev) => ({ ...prev, [catId]: defaultMultipliers() }));
  };

  const restoreAllDefaults = () => {
    if (!data) return;
    const next: Record<string, TierRow[]> = {};
    for (const c of data) next[c.id] = defaultMultipliers();
    setEdits(next);
    toast("Multiplicadores padrão preenchidos. Clique em Aplicar para salvar.");
  };

  const applyToCategory = async (cat: CategoryWithCount) => {
    const tiers = edits[cat.id] ?? defaultMultipliers();
    setSavingId(cat.id);
    try {
      // 1. Salvar config na categoria
      const { error: catErr } = await supabase
        .from("spotlight_categories")
        .update({ tabela_multiplicadores: tiers as any })
        .eq("id", cat.id);
      if (catErr) throw catErr;

      // 2. Buscar IDs de produtos vinculados
      const { data: links, error: linkErr } = await supabase
        .from("product_spotlight_categories")
        .select("product_id")
        .eq("category_id", cat.id);
      if (linkErr) throw linkErr;

      const productIds = Array.from(new Set((links ?? []).map((l) => l.product_id)));

      if (productIds.length > 0) {
        // 3. Aplicar tabela_precos em massa (lotes de 200 IDs para evitar URLs gigantes)
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

      toast.success(
        `${productIds.length} produto(s) atualizados na categoria "${cat.label}"`,
      );
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-categories"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar multiplicadores");
    } finally {
      setSavingId(null);
      setConfirmTarget(null);
    }
  };

  const applyToAll = async () => {
    if (!data) return;
    setBulkRunning(true);
    let totalProducts = 0;
    let okCats = 0;
    try {
      for (const cat of data) {
        const tiers = edits[cat.id] ?? defaultMultipliers();
        const { error: catErr } = await supabase
          .from("spotlight_categories")
          .update({ tabela_multiplicadores: tiers as any })
          .eq("id", cat.id);
        if (catErr) continue;

        const { data: links } = await supabase
          .from("product_spotlight_categories")
          .select("product_id")
          .eq("category_id", cat.id);
        const productIds = Array.from(new Set((links ?? []).map((l) => l.product_id)));

        const CHUNK = 200;
        for (let i = 0; i < productIds.length; i += CHUNK) {
          const slice = productIds.slice(i, i + CHUNK);
          await supabase
            .from("products_cache")
            .update({ tabela_precos: tiers as any })
            .in("id", slice);
        }
        totalProducts += productIds.length;
        okCats++;
      }
      toast.success(
        `${okCats} categorias aplicadas — ${totalProducts} atualização(ões) de produto`,
      );
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-categories"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no bulk apply");
    } finally {
      setBulkRunning(false);
      setBulkOpen(false);
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
            Defina os multiplicadores por faixa de quantidade e aplique em massa aos produtos da categoria.
            O preço final = <strong>preço de custo × multiplicador</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={restoreAllDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setBulkOpen(true)}
            disabled={bulkRunning || isLoading}
          >
            <Save className="h-4 w-4 mr-1" />
            Aplicar a todas
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar categoria..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/50 z-10 min-w-[220px]">
                  Categoria
                </th>
                <th className="text-center font-medium px-3 py-3">Produtos</th>
                {TIERS.map((q) => (
                  <th key={q} className="text-center font-medium px-2 py-3 whitespace-nowrap">
                    {q === 1000 ? "1000+" : q}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3 sticky right-0 bg-muted/50 min-w-[160px]">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={3 + TIERS.length} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Carregando categorias...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3 + TIERS.length} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              )}
              {filtered.map((cat) => {
                const tiers = edits[cat.id] ?? normalizeTabela(cat.tabela_multiplicadores);
                const hasCustom = !!cat.tabela_multiplicadores;
                return (
                  <tr key={cat.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-foreground">{cat.label}</div>
                          <div className="text-xs text-muted-foreground">{cat.slug}</div>
                        </div>
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
                        {!hasCustom && (
                          <Badge variant="secondary" className="text-[10px]">padrão</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">
                      {cat.product_count}
                    </td>
                    {TIERS.map((q) => {
                      const tier = tiers.find((t) => t.qty === q);
                      return (
                        <td key={q} className="px-1 py-3 text-center">
                          <MultiplierStepper
                            value={tier?.multiplicador ?? 1}
                            onChange={(v) => updateTier(cat.id, q, v)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right sticky right-0 bg-card">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreDefaults(cat.id)}
                          title="Restaurar padrão nesta linha"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={savingId === cat.id || cat.product_count === 0}
                          onClick={() => setConfirmTarget(cat)}
                        >
                          {savingId === cat.id ? (
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
      </div>

      {/* Confirm single category */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar multiplicadores?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai sobrescrever a tabela de preços individual de{" "}
              <strong>{confirmTarget?.product_count ?? 0} produto(s)</strong> da categoria{" "}
              <strong>"{confirmTarget?.label}"</strong>. O preço de custo de cada produto é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTarget && applyToCategory(confirmTarget)}
              className="bg-green-600 hover:bg-green-700"
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar a TODAS as categorias?</AlertDialogTitle>
            <AlertDialogDescription>
              Os multiplicadores atualmente exibidos serão aplicados a todos os produtos vinculados em
              cada categoria ativa. Esta operação pode demorar alguns segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={applyToAll}
              disabled={bulkRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              {bulkRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Aplicando...
                </>
              ) : (
                "Aplicar a todas"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
