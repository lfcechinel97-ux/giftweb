import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { ETAPAS, type LogoOriginal, type LogoTratada, type ProdutoMockup, type Tecnica } from "./mockupStudio/types";
import EtapaUpload from "./mockupStudio/EtapaUpload";
import EtapaTecnica from "./mockupStudio/EtapaTecnica";
import EtapaTratamento from "./mockupStudio/EtapaTratamento";
import EtapaAprovacao from "./mockupStudio/EtapaAprovacao";
import EtapaProduto from "./mockupStudio/EtapaProduto";
import EtapaEditor from "./mockupStudio/EtapaEditor";

export default function MockupStudio() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [logo, setLogo] = useState<LogoOriginal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica | null>(null);
  const [tratada, setTratada] = useState<LogoTratada | null>(null);
  const [produto, setProduto] = useState<ProdutoMockup | null>(null);

  const irPara = (n: number) => setEtapa(n);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-4 py-3 flex items-center gap-4 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-800">Gift Web Mockup Studio</h1>
        </div>
        <nav className="ml-auto hidden md:flex items-center gap-1">
          {ETAPAS.map((e) => {
            const ativa = e.n === etapa;
            const concluida = e.n < etapa;
            return (
              <div key={e.n} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    ativa ? "bg-blue-600 text-white" : concluida ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {concluida ? <Check className="w-3 h-3" /> : <span>{e.n}</span>}
                  {e.titulo}
                </div>
                {e.n < ETAPAS.length && <div className="w-4 h-px bg-slate-200 mx-0.5" />}
              </div>
            );
          })}
        </nav>
      </header>

      {etapa === 1 && (
        <EtapaUpload logo={logo} onLogoChange={setLogo} onAvancar={() => irPara(2)} />
      )}

      {etapa === 2 && (
        <EtapaTecnica tecnica={tecnica} onTecnicaChange={setTecnica} onVoltar={() => irPara(1)} onAvancar={() => irPara(3)} />
      )}

      {etapa === 3 && logo && tecnica && (
        <EtapaTratamento
          logo={logo}
          tecnica={tecnica}
          onPronto={(t) => { setTratada(t); irPara(4); }}
          onVoltar={() => irPara(2)}
        />
      )}

      {etapa === 4 && logo && tratada && (
        <EtapaAprovacao original={logo} tratada={tratada} onVoltar={() => irPara(2)} onAprovar={() => irPara(5)} />
      )}

      {etapa === 5 && (
        <EtapaProduto onVoltar={() => irPara(4)} onSelecionar={(p) => { setProduto(p); irPara(6); }} />
      )}

      {etapa === 6 && produto && tratada && (
        <EtapaEditor produto={produto} logoTratada={tratada} onVoltar={() => irPara(5)} />
      )}
    </div>
  );
}
