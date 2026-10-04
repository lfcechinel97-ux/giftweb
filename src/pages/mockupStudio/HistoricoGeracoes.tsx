import { useEffect, useRef, useState } from "react";
import { Download, History, Loader2, Search, UserRound, X } from "lucide-react";
import { TECNICAS } from "./types";
import { COR_TECNICA, ui } from "./ui";
import { formatarTokens, listarGeracoes, nomeModelo, type Geracao } from "./historico";
import { aplicarMarcaDagua } from "./marcaDagua";
import { baixarImagem } from "./baixarImagem";

interface Props {
  geracoes: Geracao[];
  carregando: boolean;
  erro: string | null;
  /** Pra mostrar o vendedor nas gerações de outros (só o admin as recebe). */
  meuId: string | null;
  /** Modelo de IA e tokens só aparecem pro admin. */
  isAdmin: boolean;
}

const rotuloTecnica = (t: string) => TECNICAS.find((x) => x.id === t)?.nome ?? t;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoricoGeracoes({ geracoes: todas, carregando: carregandoTodas, erro: erroTodas, meuId, isAdmin }: Props) {
  const [aberta, setAberta] = useState<Geracao | null>(null);
  const [busca, setBusca] = useState("");
  const [encontradas, setEncontradas] = useState<Geracao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const timer = useRef<number>();
  const buscaId = useRef(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!busca.trim()) { setBuscando(false); setErroBusca(null); return; }
    setBuscando(true);
    const id = ++buscaId.current;
    timer.current = window.setTimeout(() => {
      listarGeracoes(busca)
        .then((r) => { if (id === buscaId.current) { setEncontradas(r); setErroBusca(null); } })
        .catch((e) => { if (id === buscaId.current) setErroBusca(e?.message || "Falha na busca."); })
        .finally(() => { if (id === buscaId.current) setBuscando(false); });
    }, 300);
    return () => window.clearTimeout(timer.current);
  }, [busca]);

  const filtrando = busca.trim().length > 0;
  const geracoes = filtrando ? encontradas : todas;
  const carregando = filtrando ? buscando : carregandoTodas;
  const erro = filtrando ? erroBusca : erroTodas;
  const totalTokens = geracoes.reduce((s, g) => s + (g.tokens_total ?? 0), 0);

  return (
    <aside className="hidden md:flex w-72 shrink-0 border-r border-[var(--gw-border)] bg-white flex-col min-h-0">
      <div className="px-4 py-4 border-b border-[var(--gw-hairline)]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--gw-text)] font-['Plus_Jakarta_Sans',Inter,sans-serif]">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] flex items-center justify-center">
            <History className="w-4 h-4 text-white" />
          </span>
          Histórico de gerações
        </h2>
        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 text-[var(--gw-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, produto ou código..."
            className="w-full pl-8 pr-8 py-2 bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] rounded-lg text-xs text-[var(--gw-text)] placeholder:text-[var(--gw-text-muted)] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--gw-text-muted)] hover:text-[var(--gw-text)]" title="Limpar busca">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {geracoes.length > 0 && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 rounded-xl bg-[var(--gw-blue-soft)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]/80">Gerações</p>
              <p className="text-base font-bold text-[#1D4ED8]">{geracoes.length}</p>
            </div>
            {isAdmin && (
              <div className="flex-1 rounded-xl bg-[var(--gw-violet-soft)] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6D28D9]/80">Tokens</p>
                <p className="text-base font-bold text-[#6D28D9]">{formatarTokens(totalTokens)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--gw-surface-alt)]">
        {carregando && <p className="text-xs text-[var(--gw-text-muted)] flex items-center gap-1.5 p-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</p>}
        {erro && <p className="text-xs text-[var(--gw-danger)] p-2">{erro}</p>}
        {!carregando && !erro && geracoes.length === 0 && (
          <div className="text-center px-4 py-10">
            <History className="w-8 h-8 mx-auto text-[var(--gw-border-strong)] mb-2" />
            <p className="text-xs text-[var(--gw-text-muted)]">{filtrando ? "Nada encontrado." : "Seus mockups gerados aparecem aqui."}</p>
          </div>
        )}
        {geracoes.map((g) => {
          const cor = COR_TECNICA[g.tecnica] ?? COR_TECNICA.laser;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setAberta(g)}
              className="w-full flex gap-2.5 p-2 rounded-xl bg-white border border-[var(--gw-border)] hover:border-[#2563EB]/50 hover:shadow-[var(--gw-shadow-md)] text-left transition-all"
            >
              <div className="w-16 h-16 shrink-0 rounded-lg bg-[var(--gw-surface-alt)] overflow-hidden">
                {g.imagemUrl && <img src={g.imagemUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--gw-text)] truncate">{g.produto_nome || "Produto"}</p>
                {g.cliente && (
                  <p className="text-[11px] font-medium text-[var(--gw-text-secondary)] truncate flex items-center gap-1 mt-0.5">
                    <UserRound className="w-3 h-3 shrink-0" /> {g.cliente}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <span className={`px-1.5 py-px rounded-md text-[10px] font-semibold ${cor.fundo} ${cor.texto}`}>{rotuloTecnica(g.tecnica)}</span>
                  <span className="text-[10px] text-[var(--gw-text-muted)]">{dataHora(g.criado_em)}</span>
                </div>
                {g.user_id !== meuId && g.vendedor_nome && (
                  <p className="text-[10px] font-semibold text-[#C2410C] truncate mt-1">{g.vendedor_nome}</p>
                )}
                {isAdmin && (
                  <>
                    <p className="text-[10px] text-[var(--gw-text-muted)] truncate mt-1" title={g.modelo}>{nomeModelo(g.modelo)}</p>
                    <p
                      className="text-[10px] font-semibold text-[#6D28D9]"
                      title={g.tokens_entrada != null && g.tokens_saida != null ? `${formatarTokens(g.tokens_entrada)} entrada / ${formatarTokens(g.tokens_saida)} saída` : undefined}
                    >
                      {formatarTokens(g.tokens_total)} tokens
                    </p>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {aberta && <VisualizadorGeracao geracao={aberta} isAdmin={isAdmin} onFechar={() => setAberta(null)} />}
    </aside>
  );
}

function VisualizadorGeracao({ geracao, isAdmin, onFechar }: { geracao: Geracao; isAdmin: boolean; onFechar: () => void }) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!geracao.imagemUrl) { setErro("Imagem indisponível."); return; }
    aplicarMarcaDagua(geracao.imagemUrl).then(setImagem).catch(() => setImagem(geracao.imagemUrl!));
  }, [geracao]);

  return (
    <div className="fixed inset-0 bg-[#0B1D42]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-[var(--gw-shadow-lg)] max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-[var(--gw-text)]">
              {geracao.produto_nome}
              {geracao.cliente && <span className="font-medium text-[var(--gw-text-secondary)]"> · {geracao.cliente}</span>}
            </p>
            <p className="text-xs text-[var(--gw-text-muted)]">
              {rotuloTecnica(geracao.tecnica)} · {dataHora(geracao.criado_em)}{geracao.vendedor_nome ? ` · ${geracao.vendedor_nome}` : ""}
              {isAdmin && ` · ${nomeModelo(geracao.modelo)} · ${formatarTokens(geracao.tokens_total)} tokens`}
            </p>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="rounded-xl bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] min-h-[240px] flex items-center justify-center overflow-hidden">
          {erro ? <p className="text-sm text-red-600">{erro}</p> : imagem ? <img src={imagem} alt="" className="w-full h-auto" /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
        </div>
        {imagem && (
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={() => baixarImagem(imagem, `mockup-${geracao.produto_codigo || "produto"}.png`)}
              className={ui.btnSucesso}
            >
              <Download className="w-4 h-4" /> Baixar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
