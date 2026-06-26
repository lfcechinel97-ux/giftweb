import { useCallback, useEffect, useState } from "react";
import { Edit, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/contexts/SistemaContext";
import CustomProdutoDialog, { type CustomProduto } from "./CustomProdutoDialog";

export default function CustomProdutosList() {
  const [items, setItems] = useState<CustomProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomProduto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("sistema_list_custom_products" as any);
    if (error) toast.error("Erro ao carregar produtos: " + error.message);
    setItems((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("sistema_produtos_custom" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  const filtered = items.filter((p) => {
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return p.nome.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-md" />
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo produto
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Nenhum produto customizado cadastrado. Crie o primeiro para usá-lo nos orçamentos."
              : "Nenhum produto encontrado para essa busca."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border rounded-lg p-3 flex gap-3">
              <div className="w-16 h-16 rounded bg-secondary shrink-0 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{p.codigo}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-[9px] h-4">Personalizado</Badge>
                  {p.categoria && <Badge variant="outline" className="text-[9px] h-4">{p.categoria}</Badge>}
                  {p.cor && <Badge variant="outline" className="text-[9px] h-4">{p.cor}</Badge>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold">{formatBRL(p.preco_custo)}</p>
                  <p className="text-[11px] text-muted-foreground">Estoque: <span className={`font-semibold ${(p.estoque ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>{p.estoque ?? 0}</span></p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => p.id && handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomProdutoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        produto={editing}
        onSaved={load}
      />
    </div>
  );
}
