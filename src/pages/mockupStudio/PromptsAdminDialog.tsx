import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CHAVES = [
  { chave: "final_laser", label: "Gravação a Laser" },
  { chave: "final_dtf_uv", label: "DTF UV" },
  { chave: "final_dtf_textil", label: "DTF Têxtil" },
] as const;

interface Props {
  onClose: () => void;
}

export default function PromptsAdminDialog({ onClose }: Props) {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).from("mockup_ia_prompts").select("chave, prompt");
      if (error) { setErro(error.message); setCarregando(false); return; }
      const mapa: Record<string, string> = {};
      for (const row of (data || []) as { chave: string; prompt: string }[]) mapa[row.chave] = row.prompt;
      setPrompts(mapa);
      setCarregando(false);
    })();
  }, []);

  const salvar = async (chave: string) => {
    setSalvando(chave);
    setErro(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("mockup_ia_prompts").upsert({
        chave,
        prompt: prompts[chave] || "",
        atualizado_por: auth?.user?.id,
        atualizado_em: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-medium">Prompts de geração do Mockup Studio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-5">
          <p className="text-[11px] text-slate-400">
            Use <code className="bg-slate-100 px-1 rounded">{"{produto}"}</code> pro nome do produto. Tamanho/posição/ângulo da logo já
            vêm garantidos (a Etapa 3 cola a logo de verdade na foto antes de mandar pra IA) -- esse prompt só descreve o ACABAMENTO
            (textura, brilho, relevo). Escreva curto e descritivo: listas de "não faça isso" e pedidos de resolução específica pioram o
            resultado.
          </p>
          {carregando ? (
            <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</p>
          ) : (
            CHAVES.map((c) => (
              <div key={c.chave}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">{c.label}</label>
                  <button
                    onClick={() => salvar(c.chave)}
                    disabled={salvando === c.chave}
                    className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvando === c.chave ? "Salvando..." : "Salvar"}
                  </button>
                </div>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={prompts[c.chave] || ""}
                  onChange={(e) => setPrompts((p) => ({ ...p, [c.chave]: e.target.value }))}
                />
              </div>
            ))
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
