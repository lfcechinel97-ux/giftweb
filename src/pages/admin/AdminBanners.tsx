import { useState, useRef } from 'react';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Button } from '@/components/ui/button';
import { Upload, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SlideState {
  deskFile: File | null;
  deskPreview: string | null;
  mobFile: File | null;
  mobPreview: string | null;
}

export default function AdminBanners() {
  const { rows, loading, updateValue, uploadImage, refetch } = useSiteContent('banners');
  const [slides, setSlides] = useState<Record<number, SlideState>>({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getRow = (id: string) => rows.find(r => r.id === id);

  const handleFile = (slideIdx: number, variant: 'desk' | 'mob', file: File) => {
    const preview = URL.createObjectURL(file);
    setSlides(prev => ({
      ...prev,
      [slideIdx]: {
        ...prev[slideIdx],
        [`${variant}File`]: file,
        [`${variant}Preview`]: preview,
      } as SlideState,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const slideIdx of [1, 2, 3]) {
        const state = slides[slideIdx];
        if (!state) continue;
        if (state.deskFile) {
          const url = await uploadImage(`banner_${slideIdx}_desk`, state.deskFile);
          await updateValue(`banner_${slideIdx}_desk`, url);
        }
        if (state.mobFile) {
          const url = await uploadImage(`banner_${slideIdx}_mob`, state.mobFile);
          await updateValue(`banner_${slideIdx}_mob`, url);
        }
      }

      // Banner faixa
      const marca = slides[10];
      if (marca) {
        if (marca.deskFile) {
          const url = await uploadImage('banner_marca_desk', marca.deskFile);
          await updateValue('banner_marca_desk', url);
        }
        if (marca.mobFile) {
          const url = await uploadImage('banner_marca_mob', marca.mobFile);
          await updateValue('banner_marca_mob', url);
        }
      }

      setSlides({});
      await refetch();
      toast.success('Banners atualizados com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.values(slides).some(s => s?.deskFile || s?.mobFile);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando banners...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banners do Carrossel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as imagens do carrossel principal da homepage.
        </p>
      </div>

      {/* Banner faixa "Brindes que fortalecem sua marca" */}
      {(() => {
        const deskSrc = slides[10]?.deskPreview || getRow('banner_marca_desk')?.value || null;
        const mobSrc = slides[10]?.mobPreview || getRow('banner_marca_mob')?.value || null;
        return (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg text-foreground">Banner Faixa — "Brindes que fortalecem sua marca"</h2>
              <p className="text-xs text-muted-foreground mt-1">Faixa horizontal entre a vitrine de produtos e o catálogo</p>
            </div>

            {/* Desktop */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Desktop <span className="text-xs">(1920×512px)</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => fileRefs.current['marca_desk']?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
                <input
                  ref={el => { fileRefs.current['marca_desk'] = el; }}
                  type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(10, 'desk', f); e.target.value = ''; }}
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden" style={{ aspectRatio: '1920/512' }}>
                {deskSrc ? (
                  <img src={deskSrc} alt="Banner faixa desktop" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Nenhuma imagem</div>
                )}
              </div>
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Mobile <span className="text-xs">(390×140px)</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => fileRefs.current['marca_mob']?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
                <input
                  ref={el => { fileRefs.current['marca_mob'] = el; }}
                  type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(10, 'mob', f); e.target.value = ''; }}
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden max-w-[300px]" style={{ aspectRatio: '390/140' }}>
                {mobSrc ? (
                  <img src={mobSrc} alt="Banner faixa mobile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Nenhuma imagem</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
