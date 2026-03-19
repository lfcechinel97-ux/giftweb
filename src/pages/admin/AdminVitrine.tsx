import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Slot {
  id: number;
  position: number;
  title: string;
  price_text: string;
  image_url: string;
  link_url: string;
  badge_text: string;
  is_active: boolean;
}

export default function AdminVitrine() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("homepage_featured_showcase")
      .select("*")
      .order("position", { ascending: true })
      .then(({ data }) => {
        setSlots(
          (data || []).map((d: any) => ({
            id: d.id,
            position: d.position,
            title: d.title || "",
            price_text: d.price_text || "",
            image_url: d.image_url || "",
            link_url: d.link_url || "",
            badge_text: d.badge_text || "Mais Vendido",
            is_active: d.is_active ?? false,
          }))
        );
        setLoading(false);
      });
  }, []);

  const update = (id: number, field: keyof Slot, value: any) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const save = async (slot: Slot) => {
    setSaving(slot.id);
    const { error } = await supabase
      .from("homepage_featured_showcase")
      .update({
        title: slot.title || null,
        price_text: slot.price_text || null,
        image_url: slot.image_url || null,
        link_url: slot.link_url || null,
        badge_text: slot.badge_text || null,
        is_active: slot.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id);
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success(`Slot ${slot.position} salvo!`);
    }
  };

  const uploadImage = async (slot: Slot, file: File) => {
    setUploading(slot.id);
    const ext = file.name.split(".").pop();
    const path = `vitrine/slot-${slot.position}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("site-images")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      setUploading(null);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("site-images")
      .getPublicUrl(path);
    update(slot.id, "image_url", urlData.publicUrl);
    setUploading(null);
    toast.success("Imagem enviada!");
  };

  if (loading) {
    return <p className="text-muted-foreground p-8">Carregando slots…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Vitrine — Mais Procurados</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure os 8 produtos exibidos na seção "Brindes mais procurados" da homepage.
        Recomendação de imagem: 400×400px.
      </p>

      <div className="space-y-4">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="border rounded-xl p-4 bg-background flex flex-col gap-3"
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">
                #{slot.position}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch
                  checked={slot.is_active}
                  onCheckedChange={(v) => update(slot.id, "is_active", v)}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex gap-4">
              {/* Image preview */}
              <div className="shrink-0">
                <div
                  className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden"
                >
                  {slot.image_url ? (
                    <img
                      src={slot.image_url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem img</span>
                  )}
                </div>
                <label className="block mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(slot, f);
                    }}
                  />
                  <span className="text-xs text-primary cursor-pointer hover:underline">
                    {uploading === slot.id ? "Enviando…" : "Upload"}
                  </span>
                </label>
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Título do produto"
                  value={slot.title}
                  onChange={(e) => update(slot.id, "title", e.target.value)}
                  className="col-span-2"
                />
                <Input
                  placeholder="Texto do preço (ex: A partir de R$ 10,05 no PIX)"
                  value={slot.price_text}
                  onChange={(e) => update(slot.id, "price_text", e.target.value)}
                />
                <Input
                  placeholder="Link do produto"
                  value={slot.link_url}
                  onChange={(e) => update(slot.id, "link_url", e.target.value)}
                />
                <Input
                  placeholder="Badge (ex: Mais Vendido)"
                  value={slot.badge_text}
                  onChange={(e) => update(slot.id, "badge_text", e.target.value)}
                />
                <div className="flex justify-end items-end">
                  <Button
                    size="sm"
                    onClick={() => save(slot)}
                    disabled={saving === slot.id}
                  >
                    {saving === slot.id ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
