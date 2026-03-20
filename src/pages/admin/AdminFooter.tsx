import { useEffect, useState } from "react";
import { useSiteContent, SiteContentRow } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";

function ImageUploader({
  row,
  onUpload,
  recommended,
}: {
  row: SiteContentRow;
  onUpload: (id: string, file: File) => Promise<void>;
  recommended?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{row.label}</label>
      {recommended && <p className="text-xs text-muted-foreground">{recommended}</p>}
      {row.value && (
        <div className="h-16 bg-muted rounded-lg flex items-center justify-center p-2">
          <img src={row.value} alt={row.label || ""} className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="text-xs"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await onUpload(row.id, file);
        }}
      />
    </div>
  );
}

function TextEditor({
  row,
  onSave,
}: {
  row: SiteContentRow;
  onSave: (id: string, value: string) => Promise<void>;
}) {
  const [val, setVal] = useState(row.value || "");

  useEffect(() => {
    setVal(row.value || "");
  }, [row.value]);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{row.label}</label>
      <div className="flex gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} className="text-sm" />
        <Button size="sm" variant="outline" onClick={() => onSave(row.id, val)}>
          Salvar
        </Button>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/40 hover:bg-muted/70 transition-colors"
      >
        <h3 className="text-base font-semibold">{title}</h3>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </section>
  );
}

export default function AdminFooter() {
  const { rows, loading, refetch, updateValue, uploadImage } = useSiteContent("footer");

  const getRow = (id: string): SiteContentRow =>
    rows.find((r) => r.id === id) || { id, type: "text", label: id, section: "footer", value: null, width_desk: null, height_desk: null, width_mob: null, height_mob: null, updated_at: null };

  const handleUpload = async (id: string, file: File) => {
    try {
      const url = await uploadImage(id, file);
      await updateValue(id, url);
      toast.success("Imagem atualizada");
      refetch();
    } catch {
      toast.error("Erro ao enviar imagem");
    }
  };

  const handleSave = async (id: string, value: string) => {
    await updateValue(id, value);
    toast.success("Salvo com sucesso");
    refetch();
  };

  if (loading) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div className="max-w-3xl space-y-5">
      <h2 className="text-xl font-bold">Rodapé</h2>

      {/* Logo */}
      <CollapsibleSection title="Logo do Rodapé">
        <ImageUploader row={getRow("footer_logo")} onUpload={handleUpload} recommended="Recomendado: 160×40px, fundo transparente" />
      </CollapsibleSection>

      {/* Pagamento — colapsável, fechado por padrão */}
      <CollapsibleSection title="Logos de Pagamento (8)" defaultOpen={false}>
        <p className="text-xs text-muted-foreground">Recomendado: 80×30px cada, PNG/SVG</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ImageUploader key={i} row={getRow(`payment_logo_${i + 1}`)} onUpload={handleUpload} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Segurança — colapsável, fechado por padrão */}
      <CollapsibleSection title="Logos de Segurança (4)" defaultOpen={false}>
        <p className="text-xs text-muted-foreground">Recomendado: 80×40px cada, PNG/SVG</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <ImageUploader key={i} row={getRow(`security_${i + 1}`)} onUpload={handleUpload} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Textos */}
      <CollapsibleSection title="Textos e Links">
        <TextEditor row={getRow("footer_telefone_1")} onSave={handleSave} />
        <TextEditor row={getRow("footer_telefone_2")} onSave={handleSave} />
        <TextEditor row={getRow("footer_email")} onSave={handleSave} />
        <TextEditor row={getRow("footer_endereco_1")} onSave={handleSave} />
        <TextEditor row={getRow("footer_endereco_2")} onSave={handleSave} />
        <TextEditor row={getRow("footer_frase")} onSave={handleSave} />
        <TextEditor row={getRow("footer_link_instagram")} onSave={handleSave} />
        <TextEditor row={getRow("footer_link_facebook")} onSave={handleSave} />
        <TextEditor row={getRow("footer_link_whatsapp")} onSave={handleSave} />
      </CollapsibleSection>
    </div>
  );
}
