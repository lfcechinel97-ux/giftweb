import { useState } from "react";
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
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
        />
      )}

      {showPrompts && <PromptsAdminDialog onClose={() => setShowPrompts(false)} />}
    </div>
  );
}
