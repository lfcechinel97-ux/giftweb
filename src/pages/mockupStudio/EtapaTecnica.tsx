import { Check } from "lucide-react";
import { TECNICAS, type Tecnica } from "./types";

interface Props {
  tecnica: Tecnica | null;
  onTecnicaChange: (t: Tecnica) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}

export default function EtapaTecnica({ tecnica, onTecnicaChange, onVoltar, onAvancar }: Props) {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Técnica de personalização</h2>
      <p className="text-sm text-slate-500 mb-6">Isso define como a logo vai ser tratada na próxima etapa.</p>

      <div className="grid gap-3">
        {TECNICAS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTecnicaChange(t.id)}
            className={`text-left border rounded-xl p-4 flex items-start justify-between gap-3 transition-colors ${
              tecnica === t.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-300"
            }`}
          >
            <div>
              <p className="font-medium text-slate-800">{t.nome}</p>
              <p className="text-sm text-slate-500 mt-0.5">{t.descricao}</p>
            </div>
            {tecnica === t.id && <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button type="button" onClick={onVoltar} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Voltar
        </button>
        <button
          type="button"
          disabled={!tecnica}
          onClick={onAvancar}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
