import { useEffect, useState } from "react";
import { Loader2, Download, Sparkles } from "lucide-react";
import type { ProdutoMockup, Tecnica } from "./types";
import type { ResultadoPosicionamento } from "./EtapaPosicionamento";
import { gerarMockupFinal } from "./gerarMockup";
import { aplicarMarcaDagua } from "./marcaDagua";
import { recortarDeVoltaDoBucket } from "./bucketImagem";
import { comporMockupLocal } from "./composicaoLocal";

interface Props {
  produto: ProdutoMockup;
  posicionamento: ResultadoPosicionamento;
  tecnica: Tecnica;
  onAjustarPosicao: () => void;
}

type Versao = "fiel" | "ia";

/**
 * Etapa 4. A versão padrão ("fiel") aplica a logo localmente, pixel a pixel,
 * exatamente onde/como o vendedor marcou -- a IA generativa redesenhava a
 * arte (trocava texto, puxava brasão de memória, ignorava rotação). A versão
 * com IA (inpainting com máscara, GPT Image 2) fica como opção sob demanda.
 */
export default function EtapaGeracaoFinal({ produto, posicionamento, tecnica, onAjustarPosicao }: Props) {
  const [versao, setVersao] = useState<Versao>("fiel");
  const [fiel, setFiel] = useState<string | null>(null);
  const [ia, setIa] = useState<string | null>(null);
  const [gerandoFiel, setGerandoFiel] = useState(true);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const composta = await comporMockupLocal({
          cenaUrl: posicionamento.cenaUrl,
          logoUrl: posicionamento.logoRecortada,
          box: posicionamento.box,
          tecnica,
        });
        setFiel(await aplicarMarcaDagua(composta));
      } catch (e: any) {
        setErro(e?.message || "Não foi possível montar o mockup.");
      } finally {
        setGerandoFiel(false);
      }
    })();
  }, [posicionamento, tecnica]);

  const gerarComIa = async () => {
    setVersao("ia");
    setGerandoIa(true);
    setErro(null);
    try {
      const r = await gerarMockupFinal({
        cenaUrl: posicionamento.cenaBucketUrl,
        logoUrl: posicionamento.logoReferencia,
        maskUrl: posicionamento.maskBucketUrl,
        tecnica,
        nomeProduto: produto.nome,
        tamanho: posicionamento.tamanhoBucket,
      });
      const semLetterbox = await recortarDeVoltaDoBucket(r.url, posicionamento.ajuste, posicionamento.cenaLargura, posicionamento.cenaAltura);
      setIa(await aplicarMarcaDagua(semLetterbox));
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar a versão com IA agora.");
    } finally {
      setGerandoIa(false);
    }
  };

  const carregando = versao === "fiel" ? gerandoFiel : gerandoIa;
  const resultado = versao === "fiel" ? fiel : ia;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col items-center">
      <h2 className="text-lg font-semibold text-slate-800 mb-1 self-start">Mockup final</h2>
      <p className="text-sm text-slate-500 mb-4 self-start">
        A versão fiel usa a arte original exatamente na posição, tamanho e ângulo marcados.
      </p>

      {(ia || gerandoIa) && (
        <div className="flex gap-1 mb-3 self-start bg-slate-100 rounded-lg p-1 text-sm">
          {(["fiel", "ia"] as Versao[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVersao(v)}
              className={`px-3 py-1.5 rounded-md ${versao === v ? "bg-white shadow-sm font-medium text-slate-800" : "text-slate-500"}`}
            >
              {v === "fiel" ? "Fiel" : "IA (experimental)"}
            </button>
          ))}
        </div>
      )}

      <div className="w-full border rounded-xl bg-slate-50 flex items-center justify-center min-h-[320px] overflow-hidden">
        {carregando && (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">{versao === "ia" ? "Gerando versão com IA..." : "Montando mockup..."}</p>
          </div>
        )}
        {!carregando && resultado && <img src={resultado} alt="Mockup gerado" className="w-full h-auto" />}
      </div>

      {versao === "ia" && ia && !gerandoIa && (
        <p className="mt-2 text-xs text-amber-700 self-start">
          A IA pode alterar texto, tamanho ou ângulo da logo -- confira antes de mandar pro cliente.
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
          onClick={gerarComIa}
          disabled={gerandoIa}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-sm font-medium disabled:opacity-50"
        >
          {gerandoIa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {ia ? "Gerar outra com IA" : "Tentar versão com IA"}
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
