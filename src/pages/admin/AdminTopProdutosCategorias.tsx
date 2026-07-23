import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";

type MetaRow = {
  slug: string;
  imagem_capa: string | null;
  eyebrow: string | null;
};

async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `topprodutos/categorias/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("site-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("site-images").getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminTopProdutosCategorias() {
  const [meta, setMeta] = useState<Record<string, MetaRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("topprodutos_categorias_meta" as any)
      .select("*");
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    const map: Record<string, MetaRow> = {};
    TOPPRODUTOS_CATEGORIAS.forEach((c) => {
      map[c.slug] = { slug: c.slug, imagem_capa: null, eyebrow: null };
    });
    (data as any[] | null)?.forEach((r) => (map[r.slug] = r));
    setMeta(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (slug: string) => {
    setBusy(slug);
    const row = meta[slug];
    const { error } = await supabase
      .from("topprodutos_categorias_meta" as any)
      .upsert(
        { slug, imagem_capa: row.imagem_capa, eyebrow: row.eyebrow || null },
        { onConflict: "slug" }
      );
    setBusy(null);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Salvo" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/topprodutos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Capas de categoria — Top Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Imagem de capa e texto opcional (eyebrow) para o cabeçalho de cada categoria em <code>/topprodutos</code>. Se vazio,
          o cabeçalho volta ao estilo minimalista.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TOPPRODUTOS_CATEGORIAS.map((c) => {
            const row = meta[c.slug];
            return (
              <div key={c.slug} className="rounded-lg border bg-background p-4 flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{c.label}</h3>
                  <code className="text-[10px] text-muted-foreground">{c.slug}</code>
                </div>

                <div>
                  <Label>Eyebrow (opcional)</Label>
                  <Input
                    placeholder="Ex.: Coleção · Corporativa"
                    value={row.eyebrow ?? ""}
                    onChange={(e) => setMeta((m) => ({ ...m, [c.slug]: { ...m[c.slug], eyebrow: e.target.value } }))}
                  />
                </div>

                <div>
                  <Label>Imagem de capa (opcional)</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {row.imagem_capa ? (
                      <div className="relative w-40 h-24 rounded-lg overflow-hidden border bg-muted/30">
                        <img src={row.imagem_capa} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setMeta((m) => ({ ...m, [c.slug]: { ...m[c.slug], imagem_capa: null } }))}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-40 h-24 rounded-lg border border-dashed bg-muted/30 flex items-center justify-center text-muted-foreground">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-muted">
                      <Upload className="w-4 h-4" />
                      Enviar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await uploadImage(f);
                            setMeta((m) => ({ ...m, [c.slug]: { ...m[c.slug], imagem_capa: url } }));
                          } catch (err: any) {
                            toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                          } finally {
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => save(c.slug)} disabled={busy === c.slug}>
                    {busy === c.slug ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
