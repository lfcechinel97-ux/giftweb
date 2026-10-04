import { useRef, useState } from "react";
import { Upload, FileWarning, Check, ArrowRight, Zap, Sparkles, Shirt, type LucideIcon } from "lucide-react";
import { TECNICAS, type LogoOriginal, type Tecnica } from "./types";
import { COR_TECNICA, ui } from "./ui";

const ICONE_TECNICA: Record<Tecnica, LucideIcon> = { laser: Zap, dtf_uv: Sparkles, dtf_textil: Shirt };

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
    <div className={ui.pagina}>
      <div className={`${ui.card} p-6 sm:p-8`}>
        <h2 className={ui.titulo}>Novo mockup</h2>
        <p className={ui.subtitulo}>Envie a logo do cliente e escolha a técnica de personalização.</p>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div>
            <p className={ui.rotulo}>Logo do cliente</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-56 ${
                arrastando
                  ? "border-[#2563EB] bg-[var(--gw-blue-soft)] scale-[1.01]"
                  : logo
                    ? "border-[#0EA36B]/50 bg-[var(--gw-success-soft)]/40"
                    : "border-[var(--gw-border-strong)] bg-[var(--gw-surface-alt)] hover:border-[#2563EB] hover:bg-[var(--gw-blue-soft)]"
              }`}
            >
              {logo ? (
                <>
                  <img src={logo.url} alt={logo.nome} className="max-h-36 max-w-full object-contain drop-shadow-sm" />
                  <p className="text-[11px] text-[var(--gw-text-muted)] mt-3 truncate max-w-full">{logo.nome} · clique pra trocar</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] flex items-center justify-center mb-3 shadow-[0_8px_20px_-8px_rgba(37,99,235,.8)]">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--gw-text)]">Arraste ou clique para enviar</p>
                  <p className="text-[11px] text-[var(--gw-text-muted)] mt-1">PNG ou JPG — até 15 MB</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>
          </div>

          <div>
            <p className={ui.rotulo}>Técnica de personalização</p>
            <div className="space-y-2.5">
              {TECNICAS.map((t) => {
                const cor = COR_TECNICA[t.id];
                const Icone = ICONE_TECNICA[t.id];
                const ativa = tecnica === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTecnica(t.id)}
                    className={`w-full text-left border-2 rounded-xl p-3 flex items-center gap-3 transition-all ${
                      ativa ? `${cor.borda} ${cor.fundo} shadow-[var(--gw-shadow-sm)]` : "border-[var(--gw-border)] bg-white hover:border-[var(--gw-border-strong)] hover:shadow-[var(--gw-shadow-sm)]"
                    }`}
                  >
                    <span className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${cor.solido} flex items-center justify-center text-white`}>
                      <Icone className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold ${ativa ? cor.texto : "text-[var(--gw-text)]"}`}>{t.nome}</span>
                      <span className="block text-[11px] text-[var(--gw-text-muted)]">{t.descricao}</span>
                    </span>
                    {ativa && (
                      <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${cor.solido} flex items-center justify-center shrink-0`}>
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {erro && (
          <div className={`${ui.erro} mt-5`}>
            <FileWarning className="w-4 h-4 mt-0.5 shrink-0" /><span>{erro}</span>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!logo || !tecnica}
            onClick={() => logo && tecnica && onConcluir(logo, tecnica)}
            className={ui.btnPrimario}
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
