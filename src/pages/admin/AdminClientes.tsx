import { useState, useRef } from 'react';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Button } from '@/components/ui/button';
import { Upload, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminClientes() {
  const { rows, loading, updateValue, uploadImage, refetch } = useSiteContent('clientes');
  const [files, setFiles] = useState<Record<string, { file: File; preview: string }>>({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getVal = (id: string) => rows.find(r => r.id === id)?.value || null;

  const handleFile = (id: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setFiles(prev => ({ ...prev, [id]: { file, preview } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [id, { file }] of Object.entries(files)) {
        const url = await uploadImage(id, file);
        await updateValue(id, url);
      }
      setFiles({});
      await refetch();
      toast.success('Logos atualizados!');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(files).length > 0;

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
        <h1 className="text-2xl font-bold text-foreground">Logos de Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os logos da seção "Grandes clientes que confiam na Gift Web"
        </p>
        <p className="text-xs text-amber-600 mt-2 font-medium">
          ⚠️ Use PNG com fundo transparente para melhor resultado. Altura ideal: 60px.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 10 }, (_, i) => {
          const id = `client_logo_${i + 1}`;
          const imgSrc = files[id]?.preview || getVal(id);

          return (
            <div key={id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <span className="text-xs font-semibold text-muted-foreground">Slot {i + 1}</span>

              <div
                className="rounded-lg border border-border bg-muted/30 flex items-center justify-center cursor-pointer"
                style={{ height: '80px' }}
                onClick={() => fileRefs.current[id]?.click()}
              >
                {imgSrc ? (
                  <img src={imgSrc} alt={`Logo ${i + 1}`} className="max-h-[60px] max-w-full object-contain" />
                ) : (
                  <span className="text-muted-foreground text-xs">Vazio</span>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => fileRefs.current[id]?.click()}
              >
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
              <input
                ref={el => { fileRefs.current[id] = el; }}
                type="file" accept="image/png,image/svg+xml,image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(id, f);
                  e.target.value = '';
                }}
              />
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
