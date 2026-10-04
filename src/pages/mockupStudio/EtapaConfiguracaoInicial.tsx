import { useRef, useState } from "react";
import { Upload, FileWarning, Check } from "lucide-react";
import { TECNICAS, type LogoOriginal, type Tecnica } from "./types";

const TIPOS_AVALIADOS = /^(image\/(png|jpe?g|svg\+xml)|application\/pdf)$/i;
const EXT_OK = /\.(png|jpe?g|svg|pdf)$/i;
const RASTERIZAVEL = /^image\/(png|jpe?g)$/i;
const MAX_BYTES = 15 * 1024 * 1024;

interface Props {
  onConcluir: (logo: LogoOriginal, tecnica: Tecnica) => void;
}

/**
 * Etapa 1 do novo fluxo: só recolhe a logo original e a técnica -- nenhuma
 * chamada de IA acontece aqui. O tratamento da logo (remover fundo,
 * acabamento) saiu inteiramente pra Etapa 4, numa única geração final que já
 * usa o arquivo original sem pré-processamento nenhum.
 */
export default function EtapaConfiguracaoInicial({ onConcluir }: Props) {
  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validarEUsar = (file: File) => {
    setErro(null);
    const tipoOk = TIPOS_AVALIADOS.test(file.type) || EXT_OK.test(file.name);
    if (!tipoOk) { setErro("Formato não suportado. Use PNG, JPG, JPEG, SVG ou PDF."); return; }
    if (file.size > MAX_BYTES) { setErro(`Arquivo de ${(file.size / 1024 / 1024).toFixed(1)} MB excede o limite de 15 MB.`); return; }
    if (!RASTERIZAVEL.test(file.type)) { setErro("Por enquanto o posicionamento só funciona com PNG ou JPG. Envie uma versão raster da logo."); return; }
    setLogo({ file, url: URL.createObjectURL(file), nome: file.name });
  };

  const handleFiles = (files: FileList | null) => { const f = files?.[0]; if (f) validarEUsar(f); };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Novo mockup</h2>
      <p className="text-sm text-slate-500 mb-6">Envie a logo do cliente e escolha a técnica de personalização.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Logo</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-48 ${
              arrastando ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
            }`}
          >
            {logo ? (
              <img src={logo.url} alt={logo.nome} className="max-h-32 object-contain" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">Arraste ou clique para enviar</p>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, JPEG, SVG ou PDF — até 15 MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Técnica de personalização</p>
          <div className="space-y-2">
            {TECNICAS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTecnica(t.id)}
                className={`w-full text-left border rounded-lg p-2.5 flex items-start justify-between gap-2 transition-colors ${
                  tecnica === t.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-300"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.nome}</p>
                  <p className="text-[11px] text-slate-500">{t.descricao}</p>
                </div>
                {tecnica === t.id && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <FileWarning className="w-4 h-4 mt-0.5 shrink-0" /><span>{erro}</span>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!logo || !tecnica}
          onClick={() => logo && tecnica && onConcluir(logo, tecnica)}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
