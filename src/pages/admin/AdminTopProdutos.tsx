import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Upload, X } from "lucide-react";
import { TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";

type Cor = { nome: string; imagem: string; referencia?: string | null };

type Row = {
  id: string;
  nome: string;
  descricao_curta: string | null;
  descricao_longa: string | null;
  preco_exibicao: number | null;
  categoria: string;
  moq: number;
  mais_vendido: boolean;
  ordem: number;
  imagem_principal: string | null;
  imagem_hover: string | null;
  galeria: string[];
  ativo: boolean;
  destaque: "padrao" | "medio" | "grande";
  imagem_editorial: string | null;
  cores: Cor[];
};

const empty: Omit<Row, "id"> = {
  nome: "",
  descricao_curta: "",
  descricao_longa: "",
  preco_exibicao: null,
  categoria: TOPPRODUTOS_CATEGORIAS[0].slug,
  moq: 20,
  mais_vendido: false,
  ordem: 0,
  imagem_principal: null,
  imagem_hover: null,
  galeria: [],
  ativo: true,
  destaque: "padrao",
  imagem_editorial: null,
  cores: [],
};

const DESTAQUE_HINTS: Record<"padrao" | "medio" | "grande", string> = {
  padrao: "Ideal: 600×600px (quadrada)",
  medio: "Ideal: 900×900px (quadrada)",
  grande: "Ideal: 1200×1200px (quadrada)",
};

async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `topprodutos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("site-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("site-images").getPublicUrl(path);
  return data.publicUrl;
}

function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted/30">
            <img src={value} alt="" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
              aria-label="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border border-dashed bg-muted/30 flex items-center justify-center text-muted-foreground">
            <Upload className="w-5 h-5" />
          </div>
        )}
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-muted">
          <Upload className="w-4 h-4" />
          {busy ? "Enviando..." : "Enviar imagem"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const url = await uploadImage(f);
                onChange(url);
              } catch (err: any) {
                toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function GaleriaField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label>Galeria (fotos adicionais)</Label>
      <div className="flex flex-wrap items-center gap-3">
        {value.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted/30">
            <img src={url} alt="" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
              aria-label="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-muted">
          <Plus className="w-4 h-4" />
          {busy ? "Enviando..." : "Adicionar"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length === 0) return;
              setBusy(true);
              try {
                const urls: string[] = [];
                for (const f of files) urls.push(await uploadImage(f));
                onChange([...value, ...urls]);
              } catch (err: any) {
                toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

export default function AdminTopProdutos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | (Omit<Row, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("topprodutos_curadoria" as any)
      .select("*")
      .order("categoria", { ascending: true })
      .order("ordem", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setRows(
        (data as any[]).map((r) => ({
          ...r,
          galeria: Array.isArray(r.galeria) ? r.galeria : [],
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      nome: editing.nome.trim(),
      descricao_curta: editing.descricao_curta || null,
      descricao_longa: editing.descricao_longa || null,
      preco_exibicao: editing.preco_exibicao,
      categoria: editing.categoria,
      moq: editing.moq,
      mais_vendido: editing.mais_vendido,
      ordem: editing.ordem,
      imagem_principal: editing.imagem_principal,
      imagem_hover: editing.imagem_hover,
      galeria: editing.galeria,
      ativo: editing.ativo,
      destaque: editing.destaque,
      imagem_editorial: editing.imagem_editorial,
    };
    const q =
      "id" in editing && editing.id
        ? supabase.from("topprodutos_curadoria" as any).update(payload).eq("id", editing.id)
        : supabase.from("topprodutos_curadoria" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo com sucesso" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este produto?")) return;
    const { error } = await supabase.from("topprodutos_curadoria" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.categoria === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Top Produtos — Curadoria</h1>
          <p className="text-sm text-muted-foreground">
            Produtos manuais exibidos em <code>/topprodutos</code>. Isolado do catálogo principal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/admin/topprodutos/categorias">Capas de categoria</a>
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {TOPPRODUTOS_CATEGORIAS.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setEditing({ ...empty })}>
            <Plus className="w-4 h-4 mr-1" /> Novo produto
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 w-16">Img</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Preço</th>
              <th className="px-3 py-2">MOQ</th>
              <th className="px-3 py-2">Ordem</th>
              <th className="px-3 py-2">Mais vendido</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum produto.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    {r.imagem_principal ? (
                      <img src={r.imagem_principal} alt="" className="w-10 h-10 object-contain rounded bg-muted/30" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.nome}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === r.categoria)?.label ?? r.categoria}
                  </td>
                  <td className="px-3 py-2">{r.preco_exibicao != null ? `R$ ${Number(r.preco_exibicao).toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2">{r.moq}</td>
                  <td className="px-3 py-2">{r.ordem}</td>
                  <td className="px-3 py-2">{r.mais_vendido ? "Sim" : "—"}</td>
                  <td className="px-3 py-2">{r.ativo ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing && "id" in editing && editing.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex flex-col gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label>Descrição curta (card)</Label>
                <Input
                  value={editing.descricao_curta ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao_curta: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição longa (popup)</Label>
                <Textarea
                  rows={4}
                  value={editing.descricao_longa ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao_longa: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço de exibição (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.preco_exibicao ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, preco_exibicao: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={editing.categoria}
                    onValueChange={(v) => setEditing({ ...editing, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPPRODUTOS_CATEGORIAS.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade mínima (MOQ)</Label>
                  <Input
                    type="number"
                    value={editing.moq}
                    onChange={(e) => setEditing({ ...editing, moq: Number(e.target.value || 0) })}
                  />
                </div>
                <div>
                  <Label>Ordem de exibição</Label>
                  <Input
                    type="number"
                    value={editing.ordem}
                    onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value || 0) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.mais_vendido}
                    onCheckedChange={(v) => setEditing({ ...editing, mais_vendido: !!v })}
                  />
                  Aparece em "Mais vendidos"
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.ativo}
                    onCheckedChange={(v) => setEditing({ ...editing, ativo: !!v })}
                  />
                  Ativo
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ImageField
                  label="Imagem principal"
                  value={editing.imagem_principal}
                  onChange={(v) => setEditing({ ...editing, imagem_principal: v })}
                />
                <ImageField
                  label="Imagem hover"
                  value={editing.imagem_hover}
                  onChange={(v) => setEditing({ ...editing, imagem_hover: v })}
                />
              </div>
              <GaleriaField
                value={editing.galeria}
                onChange={(v) => setEditing({ ...editing, galeria: v })}
              />

              <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-3">
                <div>
                  <Label>Destaque no grid da categoria</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Controla o tamanho do card no mosaico editorial da página /topprodutos.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["padrao", "medio", "grande"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditing({ ...editing, destaque: lvl })}
                        className={
                          "px-3 py-1.5 rounded-md border text-sm capitalize transition-colors " +
                          (editing.destaque === lvl
                            ? "bg-navy text-white border-navy"
                            : "bg-background hover:bg-muted")
                        }
                      >
                        {lvl === "padrao" ? "Padrão" : lvl === "medio" ? "Destaque médio" : "Destaque grande"}
                      </button>
                    ))}
                  </div>
                </div>
                <ImageField
                  label="Imagem editorial (usada quando destaque = médio ou grande)"
                  value={editing.imagem_editorial}
                  onChange={(v) => setEditing({ ...editing, imagem_editorial: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
