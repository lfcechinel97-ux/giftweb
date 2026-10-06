import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Settings } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSistemaProducts } from "@/pages/sistema/useSistemaProducts";
import type { CaixaPosicao, LogoOriginal, ProdutoMockup, Tecnica, VisaoProduto } from "./mockupStudio/types";
import EtapaConfiguracaoInicial from "./mockupStudio/EtapaConfiguracaoInicial";
import EtapaProduto from "./mockupStudio/EtapaProduto";
import EtapaPosicionamento from "./mockupStudio/EtapaPosicionamento";
import EtapaGeracaoFinal from "./mockupStudio/EtapaGeracaoFinal";
import PromptsAdminDialog from "./mockupStudio/PromptsAdminDialog";
import HistoricoGeracoes from "./mockupStudio/HistoricoGeracoes";
import { assinar, listarGeracoes, type Geracao } from "./mockupStudio/historico";
import { useProdutosRecentes } from "./mockupStudio/useProdutosRecentes";

interface Posicionamento { visao: VisaoProduto; box: CaixaPosicao; detalhe: string; composicao: string }

const ETAPAS = ["Logo e técnica", "Produto", "Posição", "Mockup"];

export default function MockupStudio() {
  const navigate = useNavigate();
  const { isAdmin, userId } = useUserRole();
  // Dispara a busca do catálogo assim que o Mockup Studio abre, não só
  // quando o vendedor chega na etapa de produto -- com sorte já está em
  // cache quando ele chegar lá.
  useSistemaProducts();

  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica | null>(null);
  const [cliente, setCliente] = useState("");
  const [produto, setProduto] = useState<ProdutoMockup | null>(null);
  const [posicionamento, setPosicionamento] = useState<Posicionamento | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);

  const [geracoes, setGeracoes] = useState<Geracao[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  useEffect(() => {
    listarGeracoes()
      .then(setGeracoes)
      .catch((e) => setErroHistorico(e?.message || "Não foi possível carregar o histórico."))
      .finally(() => setCarregandoHistorico(false));
  }, []);

  const registrarGeracao = async (g: Geracao) => {
    const [assinada] = await assinar([g]);
    setGeracoes((atual) => [assinada, ...atual.filter((x) => x.id !== g.id)]);
  };

  // Produtos mais usados nas gerações DO PRÓPRIO vendedor (admin recebe as
  // de todos no histórico), por frequência com desempate pela mais recente,
  // um por grupo de prefixo -- é o que aparece antes de digitar.
  const codigosRecentes = useMemo(() => {
    const porPrefixo = new Map<string, { codigo: string; n: number; ultimo: string }>();
    for (const g of geracoes) {
      if (!g.produto_codigo || g.user_id !== userId) continue;
      const prefixo = g.produto_codigo.split("-")[0];
      const atual = porPrefixo.get(prefixo);
      if (!atual) porPrefixo.set(prefixo, { codigo: g.produto_codigo, n: 1, ultimo: g.criado_em });
      else atual.n++;
    }
    return [...porPrefixo.values()]
      .sort((a, b) => b.n - a.n || b.ultimo.localeCompare(a.ultimo))
      .slice(0, 12)
      .map((x) => x.codigo);
  }, [geracoes, userId]);
  const { recentes, carregando: carregandoRecentes } = useProdutosRecentes(codigosRecentes, carregandoHistorico || !userId);

  const etapaAtual = !logo ? 0 : !produto ? 1 : !posicionamento ? 2 : 3;

  // Volta uma etapa; só sai da página a partir da primeira.
  const voltar = () => {
    if (posicionamento) setPosicionamento(null);
    else if (produto) setProduto(null);
    else if (logo) { setLogo(null); setTecnica(null); }
    else navigate(-1);
  };

  const novoMockup = () => {
    setPosicionamento(null);
    setProduto(null);
    setLogo(null);
    setTecnica(null);
    setCliente("");
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--gw-bg)] font-['Inter',system-ui,sans-serif] text-[var(--gw-text)]">
      <header className="shrink-0 bg-gradient-to-r from-[#0B1D42] via-[#0E2450] to-[#1A3A7A] text-white">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={voltar}
            className="flex items-center gap-1 pl-1.5 pr-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="h-6 w-px bg-white/15" />
          <img src="/logos/giftweb-logo.png" alt="Gift Web Brindes" className="h-10 w-10 drop-shadow" />
          <div className="leading-tight">
            <h1 className="font-['Plus_Jakarta_Sans',Inter,sans-serif] font-bold text-base tracking-tight text-white">Mockup Studio</h1>
            <p className="text-[11px] text-white/60">Gift Web Brindes</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowPrompts(true)}
              className="ml-auto p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Configurar prompts de IA (admin)"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="h-[3px] bg-gradient-to-r from-[#2563EB] via-[#7C5CFF] to-[#0EA36B]" />
      </header>

      <div className="flex flex-1 min-h-0">
        <HistoricoGeracoes geracoes={geracoes} carregando={carregandoHistorico} erro={erroHistorico} meuId={userId} isAdmin={isAdmin} />

        {/* scrollbar-gutter fixo: sem ele a barra de rolagem aparecia/sumia
            conforme a altura do conteúdo mudava e a tela "balançava". */}
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <Etapas atual={etapaAtual} />

          {!logo && (
            <EtapaConfiguracaoInicial onConcluir={(l, t, c) => { setLogo(l); setTecnica(t); setCliente(c); }} />
          )}

          {logo && tecnica && !produto && (
            <EtapaProduto onSelecionar={setProduto} recentes={recentes} carregandoRecentes={carregandoRecentes} />
          )}

          {logo && tecnica && produto && !posicionamento && (
            <EtapaPosicionamento
              produto={produto}
              logo={logo}
              onVoltar={() => setProduto(null)}
              onContinuar={(visao, box, detalhe, composicao) => setPosicionamento({ visao, box, detalhe, composicao })}
            />
          )}

          {logo && tecnica && produto && posicionamento && (
            <EtapaGeracaoFinal
              produto={produto}
              composicaoUrl={posicionamento.composicao}
              detalheUrl={posicionamento.detalhe}
              tecnica={tecnica}
              box={posicionamento.box}
              onAjustarPosicao={() => setPosicionamento(null)}
              onGerado={registrarGeracao}
              onNovoMockup={novoMockup}
              cliente={cliente}
              isAdmin={isAdmin}
            />
          )}
        </main>
      </div>

      {showPrompts && <PromptsAdminDialog onClose={() => setShowPrompts(false)} />}
    </div>
  );
}

function Etapas({ atual }: { atual: number }) {
  return (
    <ol className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 flex items-center gap-2">
      {ETAPAS.map((nome, i) => {
        const feita = i < atual;
        const ativa = i === atual;
        return (
          <li key={nome} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  feita
                    ? "bg-gradient-to-br from-[#0EA36B] to-[#10B981] text-white shadow-[0_4px_10px_-4px_rgba(14,163,107,.7)]"
                    : ativa
                      ? "bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,.8)] ring-4 ring-[#2563EB]/15"
                      : "bg-white text-[var(--gw-text-muted)] border border-[var(--gw-border-strong)]"
                }`}
              >
                {feita ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`hidden sm:inline text-sm ${ativa ? "font-semibold text-[var(--gw-text)]" : feita ? "text-[#0E8A5C] font-medium" : "text-[var(--gw-text-muted)]"}`}>
                {nome}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className={`h-[2px] flex-1 rounded-full ${feita ? "bg-gradient-to-r from-[#0EA36B] to-[#10B981]" : "bg-[var(--gw-border-strong)]"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
