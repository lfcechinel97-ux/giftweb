import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(200),
  codigo: z.string().trim().min(1, "Código obrigatório").max(50).regex(/^[A-Za-z0-9._\-]+$/, "Use apenas letras, números, hífen, ponto ou underscore"),
  preco_custo: z.number().min(0, "Preço inválido"),
  estoque: z.number().int().min(0, "Estoque inválido"),
  cor: z.string().max(60).optional(),
  categoria: z.string().max(100).optional(),
  observacoes: z.string().max(1000).optional(),
});

export type CustomProduto = {
  id?: string;
  nome: string;
  codigo: string;
  preco_custo: number;
  estoque: number;
  cor?: string | null;
  categoria?: string | null;
  observacoes?: string | null;
  image_url?: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  produto?: CustomProduto | null;
  onSaved: () => void;
}

export default function CustomProdutoDialog({ open, onClose, produto, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precoStr, setPrecoStr] = useState("");
  const [estoqueStr, setEstoqueStr] = useState("0");
  const [cor, setCor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setNome(produto?.nome ?? "");
    setCodigo(produto?.codigo ?? "");
    setPrecoStr(produto?.preco_custo ? String(produto.preco_custo).replace(".", ",") : "");
    setEstoqueStr(String(produto?.estoque ?? 0));
    setCor(produto?.cor ?? "");
    setCategoria(produto?.categoria ?? "");
    setObservacoes(produto?.observacoes ?? "");
    setImageUrl(produto?.image_url ?? null);
  }, [open, produto]);

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      toast.error("Use JPG, PNG ou WebP");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `sistema-produtos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("site-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (e: any) {
      toast.error("Erro no upload: " + (e?.message || e));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const parsed = schema.safeParse({
      nome, codigo,
      preco_custo: parseFloat(precoStr.replace(",", ".")) || 0,
      estoque: parseInt(estoqueStr, 10) || 0,
      cor: cor || undefined,
      categoria: categoria || undefined,
      observacoes: observacoes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...parsed.data, image_url: imageUrl };
      if (produto?.id) {
        const { error } = await supabase.from("sistema_produtos_custom" as any).update(payload).eq("id", produto.id);
        if (error) throw error;
        toast.success("Produto atualizado");
      } else {
        const { data: session } = await supabase.auth.getUser();
        const { error } = await supabase.from("sistema_produtos_custom" as any).insert({ ...payload, created_by: session.user?.id });
        if (error) {
          if (error.code === "23505") throw new Error("Já existe um produto com esse código");
          throw error;
        }
        toast.success("Produto criado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{produto?.id ? "Editar produto" : "Novo produto customizado"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
          {/* Imagem */}
          <div className="space-y-2">
            <Label>Imagem</Label>
            <div className="relative w-40 h-40 rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" className="w-40" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {imageUrl ? "Trocar" : "Enviar imagem"}
            </Button>
          </div>

          {/* Campos */}
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Caneca personalizada acrílica" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: CUST-001" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Personalizados" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Preço (R$) *</Label>
                <Input value={precoStr} onChange={(e) => setPrecoStr(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input value={estoqueStr} onChange={(e) => setEstoqueStr(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex: Azul" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Detalhes, fornecedor, prazo..." />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
