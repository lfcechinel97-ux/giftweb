import { useEffect, useState } from "react";
import { Loader2, Download, Sparkles } from "lucide-react";
import type { ProdutoMockup, Tecnica } from "./types";
import { gerarMockupFinal } from "./gerarMockup";
import { aplicarMarcaDagua } from "./marcaDagua";

interface Props {
  produto: ProdutoMockup;
  /** Cenário já gerado na Etapa 3 (produto no ambiente, sem logo). */
  cenaUrl: string;
  /** Máscara real (alpha transparente = área editável) -- é ela que garante
   * a posição/tamanho/ângulo, não mais texto nem composição "colada". */
  maskUrl: string;
  /** Logo já recortada na Etapa 3 (o que o vendedor manteve dentro do box). */
  logoUrl: string;
  tecnica: Tecnica;
  onAjustarPosicao: () => void;
}

/**
 * Etapa 4: a única chamada de IA que ainda falta -- aplica a logo no
 * cenário por INPAINTING COM MÁSCARA (GPT Image 2). A área fora da máscara
 * é preservada pela própria API, não por instrução -- é isso que resolve o
 * problema de posição/tamanho/ângulo que nem composição colada resolvia
 * sozinha (o modelo anterior resintetizava a imagem toda e recentralizava).
 * Depois só entra uma marca d'água leve (Gift Web), aplicada localmente.
 */
export default function EtapaGeracaoFinal({ produto, cenaUrl, maskUrl, logoUrl, tecnica, onAjustarPosicao }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const gerar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await gerarMockupFinal({ cenaUrl, maskUrl, logoUrl, tecnica, nomeProduto: produto.nome });
      const comMarca = await aplicarMarcaDagua(r.url);
      setResultado(comMarca);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar o mockup agora.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { gerar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col items-center">
      <h2 className="text-lg font-semibold text-slate-800 mb-1 self-start">Mockup final</h2>
      <p className="text-sm text-slate-500 mb-6 self-start">
        Logo aplicada por IA na área exata marcada na etapa anterior -- sem edição manual depois.
      </p>

      <div className="w-full border rounded-xl bg-slate-50 flex items-center justify-center min-h-[320px] overflow-hidden">
        {carregando && (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Gerando mockup...</p>
          </div>
        )}
        {!carregando && resultado && (
          <img src={resultado} alt="Mockup gerado" className="w-full h-auto" />
        )}
      </div>

      {erro && (
        <div className="mt-4 w-full text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 justify-end w-full">
        <button type="button" onClick={onAjustarPosicao} className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Ajustar posição
        </button>
        <button
          type="button"
          onClick={gerar}
          disabled={carregando}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-sm font-medium disabled:opacity-50"
        >
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Gerar novamente
        </button>
        {resultado && !carregando && (
          <a
            href={resultado}
            download={`mockup-${produto.codigoAmigavel || "produto"}.png`}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            <Download className="w-4 h-4" /> Baixar
          </a>
        )}
      </div>
    </div>
  );
}
