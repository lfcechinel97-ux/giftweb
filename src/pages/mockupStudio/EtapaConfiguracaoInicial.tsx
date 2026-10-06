import { useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Upload, FileWarning, Check, ArrowRight, Zap, Sparkles, Shirt, Loader2, FileText, UserRound, type LucideIcon } from "lucide-react";
import { TECNICAS, type LogoOriginal, type Tecnica } from "./types";
import { COR_TECNICA, ui } from "./ui";
import { abrirPdf, renderizarPagina } from "./pdfLogo";

const ICONE_TECNICA: Record<Tecnica, LucideIcon> = { laser: Zap, dtf_uv: Sparkles, dtf_textil: Shirt };

const EXT_OK = /\.(png|jpe?g|pdf)$/i;
const EH_PDF = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const RASTER = /^image\/(png|jpe?g)$/i;
const MAX_BYTES = 15 * 1024 * 1024;
/** Abaixo disso (lado maior, px) a logo rasterizada costuma sair redesenhada
 * pela IA -- textos pequenos ficam ilegíveis e ela "inventa". */
const LADO_MIN_RECOMENDADO = 600;

interface Props {
  onConcluir: (logo: LogoOriginal, tecnica: Tecnica, cliente: string) => void;
}

/**
 * Etapa 1: só recolhe a logo, a técnica e (opcional) a identificação do
 * cliente -- nenhuma chamada de IA acontece aqui. PDF vira PNG da página
 * escolhida pelo vendedor, já recortada até a arte.
 */
export default function EtapaConfiguracaoInicial({ onConcluir }: Props) {
  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica | null>(null);
  const [cliente, setCliente] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pdf, setPdf] = useState<{ doc: PDFDocumentProxy; arquivo: File } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [renderizando, setRenderizando] = useState(false);

  const usarPagina = async (doc: PDFDocumentProxy, arquivo: File, numero: number) => {
    setPagina(numero);
    setRenderizando(true);
    setErro(null);
    try {
      const png = await renderizarPagina(doc, numero);
      setLogo({ file: arquivo, url: URL.createObjectURL(png), nome: `${arquivo.name} · página ${numero}` });
    } catch (e: any) {
      setLogo(null);
      setErro(e?.message || "Não foi possível ler essa página do PDF.");
    } finally {
      setRenderizando(false);
    }
  };

  const validarEUsar = async (file: File) => {
    setErro(null);
    setAviso(null);
    if (!(RASTER.test(file.type) || EXT_OK.test(file.name))) { setErro("Formato não suportado. Use PNG, JPG ou PDF."); return; }
    if (file.size > MAX_BYTES) { setErro(`Arquivo de ${(file.size / 1024 / 1024).toFixed(1)} MB excede o limite de 15 MB.`); return; }
    if (EH_PDF(file)) {
      setRenderizando(true);
      try {
        const doc = await abrirPdf(file);
        setPdf({ doc, arquivo: file });
        await usarPagina(doc, file, 1);
      } catch {
        setRenderizando(false);
        setErro("Não foi possível abrir o PDF.");
      }
      return;
    }
    setPdf(null);
    const url = URL.createObjectURL(file);
    setLogo({ file, url, nome: file.name });
    setAviso(null);
    const img = new Image();
    img.onload = () => {
      const lado = Math.max(img.naturalWidth, img.naturalHeight);
      if (lado < LADO_MIN_RECOMENDADO) {
        setAviso(
          `Logo em baixa resolução (${img.naturalWidth}×${img.naturalHeight}px). A IA pode redesenhar detalhes e textos ` +
          "-- se possível, peça ao cliente a logo em PDF/vetor ou PNG maior.",
        );
      }
    };
    img.src = url;
  };

  const handleFiles = (files: FileList | null) => { const f = files?.[0]; if (f) validarEUsar(f); };

  const trocarPagina = (valor: number) => {
    if (!pdf || !Number.isFinite(valor)) return;
    const n = Math.min(Math.max(1, Math.round(valor)), pdf.doc.numPages);
    if (n !== pagina || !logo) usarPagina(pdf.doc, pdf.arquivo, n);
  };

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
              {renderizando ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mb-2" />
                  <p className="text-sm text-[var(--gw-text-muted)]">Lendo o PDF...</p>
                </>
              ) : logo ? (
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
                  <p className="text-[11px] text-[var(--gw-text-muted)] mt-1">PNG, JPG ou PDF — até 15 MB</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {pdf && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--gw-border)] bg-[var(--gw-surface-alt)] px-3 py-2">
                <FileText className="w-4 h-4 text-[#E5484D] shrink-0" />
                <span className="text-sm text-[var(--gw-text-secondary)]">Página da logo</span>
                <input
                  type="number"
                  min={1}
                  max={pdf.doc.numPages}
                  value={pagina}
                  onChange={(e) => trocarPagina(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm font-semibold text-[var(--gw-text)] bg-white border border-[var(--gw-border)] rounded-lg text-center focus:outline-none focus:border-[#2563EB]"
                />
                <span className="text-sm text-[var(--gw-text-muted)]">de {pdf.doc.numPages}</span>
              </div>
            )}

            <label className="block mt-4">
              <span className={`${ui.rotulo} block`}>Cliente <span className="normal-case tracking-normal font-normal text-[var(--gw-text-muted)]">(opcional)</span></span>
              <div className="relative">
                <UserRound className="w-4 h-4 text-[var(--gw-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  maxLength={120}
                  placeholder="Nome ou telefone do cliente"
                  className="w-full pl-10 pr-3 py-2.5 bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] rounded-xl text-sm text-[var(--gw-text)] placeholder:text-[var(--gw-text-muted)] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all"
                />
              </div>
            </label>
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

        {aviso && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <FileWarning className="w-4 h-4 mt-0.5 shrink-0" /><span>{aviso}</span>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!logo || !tecnica || renderizando}
            onClick={() => logo && tecnica && onConcluir(logo, tecnica, cliente.trim())}
            className={ui.btnPrimario}
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
