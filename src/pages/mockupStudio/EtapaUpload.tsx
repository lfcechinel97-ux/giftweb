import { useRef, useState } from "react";
import { Upload, FileWarning } from "lucide-react";
import type { LogoOriginal } from "./types";

const TIPOS_AVALIADOS = /^(image\/(png|jpe?g|svg\+xml)|application\/pdf)$/i;
const EXT_OK = /\.(png|jpe?g|svg|pdf)$/i;
const MAX_BYTES = 15 * 1024 * 1024;

/** PDF e SVG chegam na próxima etapa só como arquivo armazenado — a pré-visualização
 * e o editor nesta primeira versão trabalham com imagem raster (PNG/JPG). */
const RASTERIZAVEL = /^image\/(png|jpe?g)$/i;

interface Props {
  logo: LogoOriginal | null;
  onLogoChange: (logo: LogoOriginal | null) => void;
  onAvancar: () => void;
}

export default function EtapaUpload({ logo, onLogoChange, onAvancar }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validarEUsar = (file: File) => {
    setErro(null);
    const tipoOk = TIPOS_AVALIADOS.test(file.type) || EXT_OK.test(file.name);
    if (!tipoOk) {
      setErro("Formato não suportado. Use PNG, JPG, JPEG, SVG ou PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro(`Arquivo de ${(file.size / 1024 / 1024).toFixed(1)} MB excede o limite de 15 MB.`);
      return;
    }
    if (!RASTERIZAVEL.test(file.type)) {
      setErro("Arquivo recebido, mas a pré-visualização e o editor desta versão só trabalham com PNG ou JPG. Envie uma versão raster da logo para continuar.");
      return;
    }
    const url = URL.createObjectURL(file);
    onLogoChange({ file, url, nome: file.name });
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) validarEUsar(file);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Envie a logo do cliente</h2>
      <p className="text-sm text-slate-500 mb-6">PNG, JPG, JPEG, SVG ou PDF — até 15 MB.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
          arrastando ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        }`}
      >
        {logo ? (
          <img src={logo.url} alt={logo.nome} className="max-h-48 object-contain mb-3" />
        ) : (
          <Upload className="w-10 h-10 text-slate-400 mb-3" />
        )}
        <p className="text-sm text-slate-600">{logo ? logo.nome : "Arraste a logo aqui ou clique para selecionar"}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <FileWarning className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!logo}
          onClick={onAvancar}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
