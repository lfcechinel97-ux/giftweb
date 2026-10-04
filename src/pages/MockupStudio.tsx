import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Settings } from "lucide-react";
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

interface Posicionamento { visao: VisaoProduto; box: CaixaPosicao; logoRecortada: string; composicao: string }

export default function MockupStudio() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  // Dispara a busca do catálogo assim que o Mockup Studio abre, não só
  // quando o vendedor chega na etapa de produto -- com sorte já está em
  // cache quando ele chegar lá.
  useSistemaProducts();

  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica | null>(null);
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

  // Volta uma etapa; só sai da página a partir da primeira.
  const voltar = () => {
    if (posicionamento) setPosicionamento(null);
    else if (produto) setProduto(null);
    else if (logo) { setLogo(null); setTecnica(null); }
    else navigate(-1);
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={voltar} className="flex items-center gap-1 pl-1 pr-3 py-1.5 hover:bg-slate-100 rounded-lg text-sm text-slate-600">
          <ChevronLeft className="w-5 h-5" /> Voltar
        </button>
        <h1 className="text-base font-semibold text-slate-800">Gift Web Mockup Studio</h1>
        {isAdmin && (
          <button
            onClick={() => setShowPrompts(true)}
            className="ml-auto p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            title="Configurar prompts de IA (admin)"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <HistoricoGeracoes geracoes={geracoes} carregando={carregandoHistorico} erro={erroHistorico} />

        {/* scrollbar-gutter fixo: sem ele a barra de rolagem aparecia/sumia
            conforme a altura do conteúdo mudava e a tela "balançava". */}
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {!logo && (
            <EtapaConfiguracaoInicial onConcluir={(l, t) => { setLogo(l); setTecnica(t); }} />
          )}

          {logo && tecnica && !produto && (
            <EtapaProduto onSelecionar={setProduto} />
          )}

          {logo && tecnica && produto && !posicionamento && (
            <EtapaPosicionamento
              produto={produto}
              logo={logo}
              onVoltar={() => setProduto(null)}
              onContinuar={(visao, box, logoRecortada, composicao) => setPosicionamento({ visao, box, logoRecortada, composicao })}
            />
          )}

          {logo && tecnica && produto && posicionamento && (
            <EtapaGeracaoFinal
              produto={produto}
              composicaoUrl={posicionamento.composicao}
              logoUrl={posicionamento.logoRecortada}
              tecnica={tecnica}
              box={posicionamento.box}
              onAjustarPosicao={() => setPosicionamento(null)}
              onGerado={registrarGeracao}
            />
          )}
        </main>
      </div>

      {showPrompts && <PromptsAdminDialog onClose={() => setShowPrompts(false)} />}
    </div>
  );
}
