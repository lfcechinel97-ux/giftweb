import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { LogoOriginal, LogoTratada, ProdutoMockup } from "./mockupStudio/types";
import EtapaConfiguracaoInicial from "./mockupStudio/EtapaConfiguracaoInicial";
import EtapaProduto from "./mockupStudio/EtapaProduto";
import MockupEditor from "./mockupStudio/MockupEditor";

export default function MockupStudio() {
  const navigate = useNavigate();
  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tratada, setTratada] = useState<LogoTratada | null>(null);
  const [produto, setProduto] = useState<ProdutoMockup | null>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800">Gift Web Mockup Studio</h1>
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
    </div>
  );
}
