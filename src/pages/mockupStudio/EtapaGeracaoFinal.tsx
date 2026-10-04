import { useEffect, useState } from "react";
import { Loader2, Download, Sparkles } from "lucide-react";
import type { CaixaPosicao, ProdutoMockup, Tecnica } from "./types";
import { descreverPosicao } from "./posicaoDescricao";
import { gerarMockupFinal } from "./gerarMockup";
import { aplicarMarcaDagua } from "./marcaDagua";
import { baixarImagem } from "./baixarImagem";
import { formatarTokens, nomeModelo, type Geracao } from "./historico";

interface Props {
  produto: ProdutoMockup;
  /** Produto com a logo já colada (de verdade, por nós) no tamanho/posição
   * exatos escolhidos na Etapa 3 -- a IA só dá acabamento, não decide mais
   * tamanho/posição (pedir isso só em % de texto ou só um retângulo
   * marcado não funcionava, a IA ainda tomava liberdade). */
  composicaoUrl: string;
  /** Logo já recortada na Etapa 3 (o que o vendedor manteve dentro do box) --
   * não é mais o arquivo original intocado. */
  logoUrl: string;
  tecnica: Tecnica;
  box: CaixaPosicao;
  onAjustarPosicao: () => void;
  onGerado: (geracao: Geracao) => void;
}

/**
 * Etapa 4: a única chamada de IA do fluxo inteiro. Substitui por completo o
 * antigo editor com filtros locais (wrap around, brilho, rotação, cor) --
 * a IA já devolve o mockup pronto e fotorrealista. Depois disso só entra
 * uma marca d'água leve (logo Gift Web), aplicada localmente.
 */
export default function EtapaGeracaoFinal({ produto, composicaoUrl, logoUrl, tecnica, box, onAjustarPosicao, onGerado }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<Geracao | null>(null);
  const [baixando, setBaixando] = useState(false);

  const baixar = async () => {
    if (!resultado) return;
    setBaixando(true);
    try {
      await baixarImagem(resultado, `mockup-${produto.codigoAmigavel || "produto"}.png`);
    } catch {
      setErro("Não foi possível baixar a imagem.");
    } finally {
      setBaixando(false);
    }
  };

  const posicao = descreverPosicao(box);
  const pct = Math.round(box.wPct);

  const gerar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await gerarMockupFinal({
        produtoUrl: composicaoUrl,
        logoUrl,
        tecnica,
        nomeProduto: produto.nome,
        produtoCodigo: produto.codigoAmigavel,
        pct,
        posicao,
      });
      const comMarca = await aplicarMarcaDagua(r.url);
      setResultado(comMarca);
      setGeracao(r.geracao);
      if (r.geracao) onGerado(r.geracao);
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
        Gerado por IA a partir da foto original do produto e da logo recortada na etapa anterior -- sem edição manual depois.
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

      {geracao && !carregando && (
        <p className="mt-2 text-xs text-slate-400 self-start">
          {nomeModelo(geracao.modelo)} · {formatarTokens(geracao.tokens_total)} tokens · salvo no histórico
        </p>
      )}

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
          <button
            type="button"
            onClick={baixar}
            disabled={baixando}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar
          </button>
        )}
      </div>
    </div>
  );
}
