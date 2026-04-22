import { useEffect, useRef, useState } from 'react';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Upload, Save, Loader2, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { getVersionedRowValue } from '@/utils/siteContentImage';

interface SlideState {
  deskFile: File | null;
  deskPreview: string | null;
  mobFile: File | null;
  mobPreview: string | null;
}

interface BannerUploadFieldProps {
  label: string;
  hint: string;
  icon: typeof Monitor;
  imageSrc: string | null;
  emptyLabel: string;
  inputKey: string;
  onUpload: () => void;
  registerInput: (element: HTMLInputElement | null) => void;
  onChange: (file: File | null) => void;
  previewClassName?: string;
  aspectRatio: number;
  frameClassName?: string;
}

const CAROUSEL_SLIDES = [1, 2, 3] as const;
const BANNER_SEPARATOR_KEY = 10;

function BannerUploadField({
  label,
  hint,
  icon: Icon,
  imageSrc,
  emptyLabel,
  inputKey,
  onUpload,
  registerInput,
  onChange,
  previewClassName = 'object-cover',
  aspectRatio,
  frameClassName,
}: BannerUploadFieldProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/70 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>

        <>
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={onUpload}>
            <Upload className="mr-2 h-4 w-4" /> Upload
          </Button>
          <input
            ref={registerInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onChange(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </>
      </div>

      <div className={frameClassName}>
        <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-md border border-border bg-muted/40">
          {imageSrc ? (
            <img src={imageSrc} alt={label} className={`h-full w-full ${previewClassName}`} />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          )}
        </AspectRatio>
      </div>
    </div>
  );
}

export default function AdminBanners() {
  const { rows, loading, updateValue, uploadImage, refetch } = useSiteContent('banners');
  const [slides, setSlides] = useState<Record<number, SlideState>>({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewUrlsRef = useRef<string[]>([]);

  const getRow = (id: string) => rows.find((row) => row.id === id);

  const revokePreviewUrl = (url?: string | null) => {
    if (!url?.startsWith('blob:')) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current = previewUrlsRef.current.filter((item) => item !== url);
  };

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const handleFile = (slideIdx: number, variant: 'desk' | 'mob', file: File | null) => {
    if (!file) return;

    setSlides((prev) => {
      const current = prev[slideIdx];
      const currentPreview = current?.[`${variant}Preview` as const];
      revokePreviewUrl(currentPreview);

      const preview = URL.createObjectURL(file);
      previewUrlsRef.current.push(preview);

      return {
        ...prev,
        [slideIdx]: {
          deskFile: current?.deskFile ?? null,
          deskPreview: current?.deskPreview ?? null,
          mobFile: current?.mobFile ?? null,
          mobPreview: current?.mobPreview ?? null,
          [`${variant}File`]: file,
          [`${variant}Preview`]: preview,
        } as SlideState,
      };
    });
  };

  const clearLocalPreviews = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const slideIdx of CAROUSEL_SLIDES) {
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

      const separator = slides[BANNER_SEPARATOR_KEY];
      if (separator?.deskFile) {
        const url = await uploadImage('banner_marca_desk', separator.deskFile);
        await updateValue('banner_marca_desk', url);
      }
      if (separator?.mobFile) {
        const url = await uploadImage('banner_marca_mob', separator.mobFile);
        await updateValue('banner_marca_mob', url);
      }

      clearLocalPreviews();
      setSlides({});
      await refetch();
      toast.success('Banners atualizados com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.values(slides).some((state) => state?.deskFile || state?.mobFile);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando banners...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Banners do site</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Atualize as capas do carrossel e a faixa institucional com preview imediato e persistência correta após salvar.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          size="lg"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="space-y-5">
          {CAROUSEL_SLIDES.map((slideIdx) => {
            const deskRow = getRow(`banner_${slideIdx}_desk`);
            const mobRow = getRow(`banner_${slideIdx}_mob`);
            const state = slides[slideIdx];
            const deskSrc = state?.deskPreview || getVersionedRowValue(deskRow, `slide-${slideIdx}-desk`) || null;
            const mobSrc = state?.mobPreview || getVersionedRowValue(mobRow, `slide-${slideIdx}-mob`) || null;

            return (
              <section key={slideIdx} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Slide {slideIdx}</h2>
                  <span className="text-xs text-muted-foreground">Carrossel principal da homepage</span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.9fr)]">
                  <BannerUploadField
                    label="Desktop"
                    hint="Formato recomendado: 853×608 px"
                    icon={Monitor}
                    imageSrc={deskSrc}
                    emptyLabel="Nenhuma imagem desktop enviada"
                    inputKey={`${slideIdx}_desk`}
                    onUpload={() => fileRefs.current[`${slideIdx}_desk`]?.click()}
                    registerInput={(element) => {
                      fileRefs.current[`${slideIdx}_desk`] = element;
                    }}
                    onChange={(file) => handleFile(slideIdx, 'desk', file)}
                    aspectRatio={853 / 608}
                  />

                  <BannerUploadField
                    label="Mobile"
                    hint="Formato recomendado: 305×258 px"
                    icon={Smartphone}
                    imageSrc={mobSrc}
                    emptyLabel="Nenhuma imagem mobile enviada"
                    inputKey={`${slideIdx}_mob`}
                    onUpload={() => fileRefs.current[`${slideIdx}_mob`]?.click()}
                    registerInput={(element) => {
                      fileRefs.current[`${slideIdx}_mob`] = element;
                    }}
                    onChange={(file) => handleFile(slideIdx, 'mob', file)}
                    aspectRatio={305 / 258}
                    frameClassName="mx-auto w-full max-w-[320px] lg:max-w-none"
                  />
                </div>
              </section>
            );
          })}
        </div>

        {(() => {
          const separatorDesk = slides[BANNER_SEPARATOR_KEY]?.deskPreview || getVersionedRowValue(getRow('banner_marca_desk'), 'marca-desk') || null;
          const separatorMob = slides[BANNER_SEPARATOR_KEY]?.mobPreview || getVersionedRowValue(getRow('banner_marca_mob'), 'marca-mob') || null;

          return (
            <aside className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:sticky xl:top-6 xl:self-start">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Banner faixa</h2>
                <p className="text-sm text-muted-foreground">
                  Faixa horizontal entre a vitrine e o catálogo.
                </p>
              </div>

              <BannerUploadField
                label="Desktop"
                hint="Formato recomendado: 1920×512 px"
                icon={Monitor}
                imageSrc={separatorDesk}
                emptyLabel="Nenhuma imagem desktop enviada"
                inputKey="marca_desk"
                onUpload={() => fileRefs.current['marca_desk']?.click()}
                registerInput={(element) => {
                  fileRefs.current['marca_desk'] = element;
                }}
                onChange={(file) => handleFile(BANNER_SEPARATOR_KEY, 'desk', file)}
                aspectRatio={1920 / 512}
              />

              <BannerUploadField
                label="Mobile"
                hint="Formato recomendado: 390×140 px"
                icon={Smartphone}
                imageSrc={separatorMob}
                emptyLabel="Nenhuma imagem mobile enviada"
                inputKey="marca_mob"
                onUpload={() => fileRefs.current['marca_mob']?.click()}
                registerInput={(element) => {
                  fileRefs.current['marca_mob'] = element;
                }}
                onChange={(file) => handleFile(BANNER_SEPARATOR_KEY, 'mob', file)}
                aspectRatio={390 / 140}
              />
            </aside>
          );
        })()}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
