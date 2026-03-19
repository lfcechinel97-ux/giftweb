import { useState, useRef } from 'react';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCatalogs() {
  const { rows, loading, updateValue, uploadImage, refetch } = useSiteContent('catalogs');
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, { file: File; preview: string }>>({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getVal = (id: string) => changes[id] ?? rows.find(r => r.id === id)?.value ?? '';

  const handleText = (id: string, val: string) => {
    setChanges(prev => ({ ...prev, [id]: val }));
  };

  const handleFile = (id: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setFiles(prev => ({ ...prev, [id]: { file, preview } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Text fields
      for (const [id, val] of Object.entries(changes)) {
        await updateValue(id, val);
      }
      // Image uploads
      for (const [id, { file }] of Object.entries(files)) {
        const url = await uploadImage(id, file);
        await updateValue(id, url);
      }
      setChanges({});
      setFiles({});
      await refetch();
      toast.success('Catálogos atualizados!');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(changes).length > 0 || Object.keys(files).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Seção Catálogos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie título, imagens e links da seção "Baixe nosso catálogo"
        </p>
      </div>

      {/* Título da seção */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <Label className="text-sm font-semibold">Título da seção</Label>
        <Input
          value={getVal('catalog_title')}
          onChange={e => handleText('catalog_title', e.target.value)}
          placeholder="Baixe nosso catálogo"
        />
        <p className="text-xs text-muted-foreground">Deixe vazio para usar o padrão</p>
      </div>

      {/* 3 catalog slots */}
      {[1, 2, 3].map(idx => {
        const imgId = `catalog_${idx}_img`;
        const titleId = `catalog_${idx}_title`;
        const linkId = `catalog_${idx}_link`;
        const imgSrc = files[imgId]?.preview || getVal(imgId) || null;

        return (
          <div key={idx} className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold text-lg text-foreground">Catálogo {idx}</h2>

            {/* Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Imagem <span className="text-xs">(600×400px recomendado)</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => fileRefs.current[imgId]?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
                <input
                  ref={el => { fileRefs.current[imgId] = el; }}
                  type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(imgId, f);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden w-[200px]" style={{ aspectRatio: '3/2' }}>
                {imgSrc ? (
                  <img src={imgSrc} alt={`Catálogo ${idx}`} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Nenhuma imagem</div>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Título</Label>
              <Input
                value={getVal(titleId)}
                onChange={e => handleText(titleId, e.target.value)}
                placeholder={`Ex: Catálogo Geral`}
              />
            </div>

            {/* Link */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Link (URL do PDF ou página)</Label>
              <Input
                value={getVal(linkId)}
                onChange={e => handleText(linkId, e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        );
      })}

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
