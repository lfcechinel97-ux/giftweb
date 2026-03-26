import { useState, useRef } from "react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const categories = [
  { key: "garrafas-e-squeezes", label: "Garrafas e Squeezes" },
  { key: "copos-e-canecas", label: "Copos e Canecas" },
  { key: "mochilas-e-sacochilas", label: "Mochilas e Sacochilas" },
  { key: "kits", label: "Kits Corporativos" },
  { key: "bolsas", label: "Bolsas e Sacolas" },
  { key: "canetas", label: "Canetas" },
  { key: "chaveiros", label: "Chaveiros" },
];

export default function AdminCategoryImages() {
  const { rows, loading, updateValue, uploadImage, refetch } = useSiteContent("categorias");
  const [files, setFiles] = useState<Record<string, { file: File; preview: string }>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getRow = (id: string) => rows.find((r) => r.id === id);

  const handleFile = (key: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setFiles((prev) => ({ ...prev, [key]: { file, preview } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const cat of categories) {
        const fileState = files[cat.key];
        if (fileState) {
          const url = await uploadImage(`cat_img_${cat.key}`, fileState.file);
          await upsertValue(`cat_img_${cat.key}`, url, "categorias");
        }

        const linkVal = links[cat.key];
        if (linkVal !== undefined) {
          await upsertValue(`cat_link_${cat.key}`, linkVal, "categorias");
        }
      }

      setFiles({});
      setLinks({});
      await refetch();
      toast.success("Categorias atualizadas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(files).length > 0 || Object.keys(links).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Imagens das Categorias</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as imagens e links das categorias exibidas na homepage (140×140px, circular).
        </p>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => {
          const imgRow = getRow(`cat_img_${cat.key}`);
          const linkRow = getRow(`cat_link_${cat.key}`);
          const fileState = files[cat.key];
          const imgSrc = fileState?.preview || imgRow?.value || null;
          const linkValue = links[cat.key] ?? linkRow?.value ?? "";

          return (
            <div key={cat.key} className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-5 items-start">
              {/* Image preview */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-[100px] h-[100px] rounded-full border-2 border-border bg-muted/30 overflow-hidden">
                  {imgSrc ? (
                    <img src={imgSrc} alt={cat.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      Sem imagem
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRefs.current[cat.key]?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                </Button>
                <input
                  ref={(el) => { fileRefs.current[cat.key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(cat.key, f);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Info + Link */}
              <div className="flex-1 space-y-3 w-full">
                <h3 className="font-semibold text-foreground">{cat.label}</h3>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Link da categoria</label>
                  <Input
                    value={linkValue}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                    placeholder={`/${cat.key}`}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
