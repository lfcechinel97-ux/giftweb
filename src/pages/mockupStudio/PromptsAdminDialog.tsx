import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CHAVE_TARIFA, type TarifaIa } from "./custoIa";

const CHAVES = [
  { chave: "final_laser", label: "Gravação a Laser" },
  { chave: "final_dtf_uv", label: "DTF UV" },
  { chave: "final_dtf_textil", label: "DTF Têxtil" },
] as const;

interface Props {
  onClose: () => void;
  tarifa: TarifaIa;
  onTarifaSalva: (t: TarifaIa) => void;
}

export default function PromptsAdminDialog({ onClose, tarifa, onTarifaSalva }: Props) {
  const [formTarifa, setFormTarifa] = useState({
    entrada: String(tarifa.usdPorMilhaoEntrada),
    saida: String(tarifa.usdPorMilhaoSaida),
    cambio: String(tarifa.cambio),
  });
  const numero = (v: string) => Number(v.replace(",", "."));
  const tarifaValida = [formTarifa.entrada, formTarifa.saida, formTarifa.cambio].every((v) => Number.isFinite(numero(v)) && numero(v) >= 0 && v.trim() !== "");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
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

  const salvar = async (chave: string, texto = prompts[chave] || "") => {
    setSalvando(chave);
    setSalvo(null);
    setErro(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from("mockup_ia_prompts").upsert({
        chave,
        prompt: texto,
        atualizado_por: auth?.user?.id,
        atualizado_em: new Date().toISOString(),
      }).select("chave");
      if (error) throw error;
      // RLS pode "aceitar" sem gravar nada -- só confirma se a linha voltou.
      if (!data?.length) throw new Error("O banco não gravou o prompt (sem permissão de admin?).");
      return true;
      setSalvo(chave);
      setTimeout(() => setSalvo((s) => (s === chave ? null : s)), 2500);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar.");
      return false;
    } finally {
      setSalvando(null);
    }
  };

  const salvarTarifa = async () => {
    const t: TarifaIa = { usdPorMilhaoEntrada: numero(formTarifa.entrada), usdPorMilhaoSaida: numero(formTarifa.saida), cambio: numero(formTarifa.cambio) };
    if (await salvar(CHAVE_TARIFA, JSON.stringify(t))) onTarifaSalva(t);
  };

  return (
    <div className="fixed inset-0 bg-[#0B1D42]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-[var(--gw-shadow-lg)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#0B1D42] to-[#1A3A7A] text-white">
          <h3 className="font-bold font-['Plus_Jakarta_Sans',Inter,sans-serif]">Prompts de geração do Mockup Studio</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
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
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gw-text-label)]">{c.label}</label>
                  <button
                    onClick={() => salvar(c.chave)}
                    disabled={salvando === c.chave}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 bg-gradient-to-r ${salvo === c.chave ? "from-[#0EA36B] to-[#10B981]" : "from-[#2563EB] to-[#5B52E8] hover:brightness-110"}`}
                  >
                    {salvando === c.chave ? "Salvando..." : salvo === c.chave ? "Salvo ✓" : "Salvar"}
                  </button>
                </div>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 text-sm text-[var(--gw-text)] bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] rounded-xl focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  value={prompts[c.chave] || ""}
                  onChange={(e) => setPrompts((p) => ({ ...p, [c.chave]: e.target.value }))}
                />
              </div>
            ))
          )}
          <div className="pt-4 border-t border-[var(--gw-hairline)]">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gw-text-label)]">Custo da IA (estimativa em R$)</label>
              <button
                onClick={salvarTarifa}
                disabled={!tarifaValida || salvando === CHAVE_TARIFA}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 bg-gradient-to-r ${salvo === CHAVE_TARIFA ? "from-[#0EA36B] to-[#10B981]" : "from-[#2563EB] to-[#5B52E8] hover:brightness-110"}`}
              >
                {salvando === CHAVE_TARIFA ? "Salvando..." : salvo === CHAVE_TARIFA ? "Salvo ✓" : "Salvar"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Usado pra converter os tokens de cada geração em R$. O Lovable cobra em créditos próprios -- ajuste até bater com o gasto real do workspace.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["entrada", "US$ / 1M tokens entrada"],
                ["saida", "US$ / 1M tokens saída"],
                ["cambio", "Câmbio (R$ por US$)"],
              ] as const).map(([campo, rotulo]) => (
                <label key={campo} className="text-[11px] text-[var(--gw-text-secondary)]">
                  {rotulo}
                  <input
                    inputMode="decimal"
                    value={formTarifa[campo]}
                    onChange={(e) => setFormTarifa((f) => ({ ...f, [campo]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm text-[var(--gw-text)] bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] rounded-xl focus:outline-none focus:bg-white focus:border-[#2563EB]"
                  />
                </label>
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
