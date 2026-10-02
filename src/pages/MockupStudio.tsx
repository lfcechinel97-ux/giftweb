import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Settings } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSistemaProducts } from "@/pages/sistema/useSistemaProducts";
import type { LogoOriginal, LogoTratada, ProdutoMockup } from "./mockupStudio/types";
import EtapaConfiguracaoInicial from "./mockupStudio/EtapaConfiguracaoInicial";
import EtapaProduto from "./mockupStudio/EtapaProduto";
import MockupEditor from "./mockupStudio/MockupEditor";
import PromptsAdminDialog from "./mockupStudio/PromptsAdminDialog";

export default function MockupStudio() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  // Dispara a busca do catálogo (react-query) assim que o Mockup Studio
  // abre, não só quando o vendedor chega na etapa de produto -- aí, com
  // sorte, quando ele chegar lá (depois de subir a logo e escolher a
  // técnica) o catálogo já está no cache e a busca é instantânea.
  useSistemaProducts();
  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tratada, setTratada] = useState<LogoTratada | null>(null);
  const [produto, setProduto] = useState<ProdutoMockup | null>(null);
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

      {!tratada && (
        <EtapaConfiguracaoInicial onConcluir={(l, t) => { setLogo(l); setTratada(t); }} />
      )}

      {tratada && !produto && (
        <EtapaProduto onSelecionar={setProduto} />
      )}

      {tratada && produto && (
        <MockupEditor produto={produto} logoInicial={tratada} onTrocarProduto={() => setProduto(null)} />
      )}

      {showPrompts && <PromptsAdminDialog onClose={() => setShowPrompts(false)} />}
    </div>
  );
}
