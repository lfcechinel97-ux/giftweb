import { useEffect, useState } from "react";
import { Loader2, Download, Sparkles, Plus, Move, Check, Pencil } from "lucide-react";
import { TECNICAS, type CaixaPosicao, type ProdutoExtra, type ProdutoMockup, type Tecnica } from "./types";
import { COR_TECNICA, ui } from "./ui";
import { registrarDuracao, tempoMedioMs, useProgressoEstimado } from "./tempoGeracao";
import { descreverPosicao } from "./posicaoDescricao";
import { gerarMockupFinal, substituirImagemGeracao } from "./gerarMockup";
import EditorLogoPorCima, { type EstadoEditor } from "./EditorLogoPorCima";
import { aplicarMarcaDagua } from "./marcaDagua";
import { baixarImagem } from "./baixarImagem";
import { formatarTokens, nomeModelo, type Geracao } from "./historico";
import { custoReais, formatarReais, type TarifaIa } from "./custoIa";

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
  onNovoMockup: () => void;
  cliente: string;
  isAdmin: boolean;
  /** Modo "colar por cima": a IA gera só produto + cenário e o vendedor
   * posiciona `logoFiel` (original, sem girar) por cima. */
  colarPorCima: boolean;
  logoFiel: string;
  /** Foto do produto sem a logo (o modo "colar por cima" manda essa pra IA). */
  fotoProdutoUrl: string;
  /** Só no modo "colar por cima": unidades do principal e outros produtos. */
  quantidadePrincipal: number;
  extras: ProdutoExtra[];
  tarifa: TarifaIa;
}

/**
 * Etapa 4: a única chamada de IA do fluxo inteiro. Substitui por completo o
 * antigo editor com filtros locais (wrap around, brilho, rotação, cor) --
 * a IA já devolve o mockup pronto e fotorrealista. Depois disso só entra
 * uma marca d'água leve (logo Gift Web), aplicada localmente.
 */
export default function EtapaGeracaoFinal({ produto, composicaoUrl, logoUrl, tecnica, box, onAjustarPosicao, onGerado, onNovoMockup, cliente, isAdmin, colarPorCima, logoFiel, fotoProdutoUrl, quantidadePrincipal, extras, tarifa }: Props) {
  const cor = COR_TECNICA[tecnica];
  const nomeTecnica = TECNICAS.find((t) => t.id === tecnica)?.nome ?? tecnica;
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<Geracao | null>(null);
  const [baixando, setBaixando] = useState(false);
  // Modo "colar por cima": cenário cru da IA + o último ajuste da logo.
  const [cenario, setCenario] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [estadoEditor, setEstadoEditor] = useState<EstadoEditor[] | null>(null);

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

  const [mediaMs, setMediaMs] = useState(tempoMedioMs);
  const progresso = useProgressoEstimado(carregando, mediaMs);

  const gerar = async () => {
    setMediaMs(tempoMedioMs());
    setCarregando(true);
    setErro(null);
    const inicio = performance.now();
    try {
      const r = await gerarMockupFinal({
        produtoUrl: colarPorCima ? fotoProdutoUrl : composicaoUrl,
        logoUrl: colarPorCima ? undefined : logoUrl,
        modo: colarPorCima ? "cenario" : "acabamento",
        quantidadePrincipal: colarPorCima ? quantidadePrincipal : 1,
        produtosExtras: colarPorCima
          ? extras.map((e) => ({ fotoUrl: e.produto.visoes[0].fotoUrl, nome: e.produto.nome, quantidade: e.quantidade }))
          : [],
        tecnica,
        nomeProduto: produto.nome,
        produtoCodigo: produto.codigoAmigavel,
        cliente: cliente || undefined,
        pct,
        posicao,
      });
      registrarDuracao(performance.now() - inicio);
      setGeracao(r.geracao);
      if (r.geracao) onGerado(r.geracao);
      if (colarPorCima) {
        setCenario(r.url);
        setResultado(null);
        setEditando(true);
      } else {
        setResultado(await aplicarMarcaDagua(r.url));
      }
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar o mockup agora.");
    } finally {
      setCarregando(false);
    }
  };

  const concluirEdicao = async (imagem: string, estado: EstadoEditor[]) => {
    setEstadoEditor(estado);
    setEditando(false);
    setResultado(await aplicarMarcaDagua(imagem));
    // Histórico guarda a versão com a logo (sem marca d'água, como as outras).
    if (geracao) substituirImagemGeracao(geracao.id, imagem).catch(() => setErro("Mockup pronto, mas não deu pra atualizar a imagem no histórico."));
  };

  useEffect(() => { gerar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className={ui.pagina}>
      <div className={`${ui.card} p-6 sm:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={ui.titulo}>Mockup final</h2>
            <p className={ui.subtitulo}>{produto.nome} · {produto.codigoAmigavel}{colarPorCima && extras.length > 0 && <> + {extras.map((e) => e.produto.nome).join(" + ")}</>}{cliente && <> · <span className="font-semibold text-[var(--gw-text-secondary)]">{cliente}</span></>}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cor.fundo} ${cor.texto}`}>
            <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${cor.solido}`} />
            {nomeTecnica}
          </span>
        </div>

        <div className="mt-6 rounded-2xl overflow-hidden border border-[var(--gw-border)] bg-[var(--gw-surface-alt)] flex items-center justify-center min-h-[360px] shadow-[var(--gw-shadow-sm)]">
          {carregando && (
            <div className="flex flex-col items-center gap-3 py-20">
              <AnelProgresso progresso={progresso} />
              <p className="text-sm font-semibold text-[var(--gw-text)]">Gerando seu mockup...</p>
              <p className="text-xs text-[var(--gw-text-muted)]">Costuma levar uns {Math.round(mediaMs / 1000)} segundos</p>
            </div>
          )}
          {!carregando && editando && cenario && (
            <div className="w-full py-5 px-3 bg-white">
              <EditorLogoPorCima cenarioUrl={cenario} logoUrl={logoFiel} tecnica={tecnica} box={box} inicial={estadoEditor} copiasIniciais={quantidadePrincipal + extras.reduce((t, e) => t + e.quantidade, 0)} onConcluir={concluirEdicao} />
            </div>
          )}
          {!carregando && !editando && resultado && (
            <img src={resultado} alt="Mockup gerado" className="w-full h-auto" />
          )}
        </div>

        {geracao && !carregando && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {isAdmin && (
              <>
                <span className="px-2 py-0.5 rounded-full bg-[var(--gw-blue-soft)] text-[#1D4ED8] font-medium">{nomeModelo(geracao.modelo)}</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--gw-violet-soft)] text-[#6D28D9] font-medium">{formatarReais(custoReais(geracao, tarifa))} · {formatarTokens(geracao.tokens_total)} tokens</span>
              </>
            )}
            <span className="px-2 py-0.5 rounded-full bg-[var(--gw-success-soft)] text-[#0E8A5C] font-medium inline-flex items-center gap-1">
              <Check className="w-3 h-3" strokeWidth={3} /> Salvo no histórico
            </span>
          </div>
        )}

        {erro && <div className={`${ui.erro} mt-4`}>{erro}</div>}

        <div className="mt-8 flex flex-wrap gap-3 justify-between items-center">
          <button type="button" onClick={onNovoMockup} className={ui.btnSecundario}>
            <Plus className="w-4 h-4" /> Gerar outro mockup
          </button>
          <div className="flex flex-wrap gap-3">
            {colarPorCima && cenario && !editando && !carregando && (
              <button type="button" onClick={() => setEditando(true)} className={ui.btnSecundario}>
                <Pencil className="w-4 h-4" /> Mover/redimensionar logo
              </button>
            )}
            <button type="button" onClick={onAjustarPosicao} className={ui.btnSecundario}>
              <Move className="w-4 h-4" /> Ajustar posição
            </button>
            <button type="button" onClick={gerar} disabled={carregando} className={ui.btnIA}>
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar novamente
            </button>
            {resultado && !carregando && !editando && (
              <button type="button" onClick={baixar} disabled={baixando} className={ui.btnSucesso}>
                {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Anel que enche no tempo médio de geração -- só referência visual, sem número. */
function AnelProgresso({ progresso }: { progresso: number }) {
  const raio = 34;
  const circ = 2 * Math.PI * raio;
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <defs>
          <linearGradient id="anel-mockup" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={raio} fill="none" stroke="var(--gw-border)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={raio} fill="none" stroke="url(#anel-mockup)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progresso)}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
      <div className="absolute inset-[14px] rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(124,92,255,.8)]">
        <Sparkles className="w-5 h-5 text-white animate-pulse" />
      </div>
    </div>
  );
}
