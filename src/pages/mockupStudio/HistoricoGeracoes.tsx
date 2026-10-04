import { useEffect, useState } from "react";
import { Download, History, Loader2, X } from "lucide-react";
import { TECNICAS } from "./types";
import { formatarTokens, nomeModelo, type Geracao } from "./historico";
import { aplicarMarcaDagua } from "./marcaDagua";
import { baixarImagem } from "./baixarImagem";

interface Props {
  geracoes: Geracao[];
  carregando: boolean;
  erro: string | null;
}

const rotuloTecnica = (t: string) => TECNICAS.find((x) => x.id === t)?.nome ?? t;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoricoGeracoes({ geracoes, carregando, erro }: Props) {
  const [aberta, setAberta] = useState<Geracao | null>(null);
  const totalTokens = geracoes.reduce((s, g) => s + (g.tokens_total ?? 0), 0);

  return (
    <aside className="hidden md:flex w-72 shrink-0 border-r bg-slate-50 flex-col min-h-0">
      <div className="px-4 py-3 border-b bg-white">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <History className="w-4 h-4" /> Histórico de gerações
        </h2>
        {geracoes.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            {geracoes.length} gerações · {formatarTokens(totalTokens)} tokens
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {carregando && <p className="text-xs text-slate-400 flex items-center gap-1.5 p-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</p>}
        {erro && <p className="text-xs text-red-600 p-2">{erro}</p>}
        {!carregando && !erro && geracoes.length === 0 && <p className="text-xs text-slate-400 p-2">Nenhuma geração ainda.</p>}
        {geracoes.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setAberta(g)}
            className="w-full flex gap-2 p-2 rounded-lg bg-white border hover:border-blue-300 text-left"
          >
            <div className="w-14 h-14 shrink-0 rounded bg-slate-100 overflow-hidden">
              {g.imagemUrl && <img src={g.imagemUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{g.produto_nome || "Produto"}</p>
              <p className="text-[11px] text-slate-500 truncate">{rotuloTecnica(g.tecnica)} · {dataHora(g.criado_em)}</p>
              <p className="text-[10px] text-slate-400 truncate" title={g.modelo}>{nomeModelo(g.modelo)}</p>
              <p className="text-[10px] text-slate-400">
                {formatarTokens(g.tokens_total)} tokens
                {g.tokens_entrada != null && g.tokens_saida != null && ` (${formatarTokens(g.tokens_entrada)} in / ${formatarTokens(g.tokens_saida)} out)`}
              </p>
            </div>
          </button>
        ))}
      </div>

      {aberta && <VisualizadorGeracao geracao={aberta} onFechar={() => setAberta(null)} />}
    </aside>
  );
}

function VisualizadorGeracao({ geracao, onFechar }: { geracao: Geracao; onFechar: () => void }) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!geracao.imagemUrl) { setErro("Imagem indisponível."); return; }
    aplicarMarcaDagua(geracao.imagemUrl).then(setImagem).catch(() => setImagem(geracao.imagemUrl!));
  }, [geracao]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{geracao.produto_nome}</p>
            <p className="text-xs text-slate-500">
              {rotuloTecnica(geracao.tecnica)} · {dataHora(geracao.criado_em)} · {nomeModelo(geracao.modelo)} · {formatarTokens(geracao.tokens_total)} tokens
            </p>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="rounded-lg bg-slate-50 min-h-[240px] flex items-center justify-center overflow-hidden">
          {erro ? <p className="text-sm text-red-600">{erro}</p> : imagem ? <img src={imagem} alt="" className="w-full h-auto" /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
        </div>
        {imagem && (
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={() => baixarImagem(imagem, `mockup-${geracao.produto_codigo || "produto"}.png`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              <Download className="w-4 h-4" /> Baixar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
