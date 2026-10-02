import { AlertTriangle } from "lucide-react";
import type { LogoOriginal, LogoTratada } from "./types";

interface Props {
  original: LogoOriginal;
  tratada: LogoTratada;
  onVoltar: () => void;
  onAprovar: () => void;
}

const FUNDOS = [
  { id: "claro", label: "Fundo claro", classe: "bg-slate-100" },
  { id: "escuro", label: "Fundo escuro", classe: "bg-slate-800" },
] as const;

export default function EtapaAprovacao({ original, tratada, onVoltar, onAprovar }: Props) {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Aprovação da logo tratada</h2>
      <p className="text-sm text-slate-500 mb-6">
        Compare a arte original com o resultado antes de continuar. Se algo não ficou certo, volte e ajuste a técnica ou envie outro arquivo.
      </p>

      {tratada.avisoQualidade && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tratada.avisoQualidade}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Original</p>
          {FUNDOS.map((f) => (
            <div key={f.id} className={`${f.classe} rounded-lg p-4 flex items-center justify-center h-40 mb-2`}>
              <img src={original.url} alt="Logo original" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Tratada</p>
          {FUNDOS.map((f) => (
            <div key={f.id} className={`${f.classe} rounded-lg p-4 flex items-center justify-center h-40 mb-2`}>
              <img src={tratada.url} alt="Logo tratada" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button type="button" onClick={onVoltar} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Voltar e ajustar
        </button>
        <button
          type="button"
          onClick={onAprovar}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Aprovar e continuar
        </button>
      </div>
    </div>
  );
}
