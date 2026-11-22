/* Botão "Trocar perfil" da produção (topo direito do /sistema).
 *
 * Mostra todos os usuários de Produção ("Quem está usando?", estilo
 * Netflix). Tocar num perfil troca a sessão na hora -- sem senha, sem sair e
 * entrar, sem recarregar a página. A edge function sistema-trocar-perfil
 * só deixa trocar entre usuários de Produção ativos.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, PERFIL_QUERY_KEY } from "@/hooks/useUserRole";
import { clearAdminAccess, rememberAdminAccess } from "@/lib/adminAccessCache";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PerfilProducao { id: string; nome: string; email: string }

const CORES = ["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#DB2777", "#CA8A04"];
const corDoPerfil = (id: string) => CORES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length];
const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

/** Mensagem de erro legível de uma chamada de edge function. */
async function erroDaFuncao(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  try {
    const corpo = ctx ? await ctx.json() : null;
    if (corpo?.error) return String(corpo.error);
  } catch { /* corpo não é JSON */ }
  return (error as Error)?.message ?? "Erro inesperado.";
}

export default function TrocarPerfilProducao() {
  const qc = useQueryClient();
  const { papel, nome, userId, isLoading } = useUserRole();
  const [aberto, setAberto] = useState(false);
  const [trocandoId, setTrocandoId] = useState<string | null>(null);

  const ehProducao = papel === "producao";

  const { data: perfis = [], isLoading: carregandoPerfis, error: erroPerfis } = useQuery<PerfilProducao[]>({
    queryKey: ["sistema", "perfis-producao"],
    enabled: ehProducao && aberto,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sistema-trocar-perfil", { body: { acao: "listar" } });
      if (error) throw new Error(await erroDaFuncao(error));
      return ((data as { perfis?: PerfilProducao[] })?.perfis ?? []);
    },
  });

  if (isLoading || !ehProducao) return null;

  const trocarPara = async (p: PerfilProducao) => {
    if (p.id === userId) { setAberto(false); return; }
    setTrocandoId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("sistema-trocar-perfil", {
        body: { acao: "trocar", userId: p.id },
      });
      if (error) throw new Error(await erroDaFuncao(error));
      const tokenHash = (data as { tokenHash?: string })?.tokenHash;
      if (!tokenHash) throw new Error("Resposta inválida do servidor.");

      // Troca a sessão no próprio navegador (sem reload).
      const { data: ses, error: erroOtp } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (erroOtp || !ses.session) throw new Error(erroOtp?.message ?? "Não foi possível entrar no perfil.");

      clearAdminAccess();
      rememberAdminAccess(ses.session.user.id);
      try { localStorage.removeItem("sistema_vendedor_v1"); } catch { /* armazenamento bloqueado */ }
      // Tudo que depende de quem está logado é buscado de novo.
      qc.removeQueries({ queryKey: PERFIL_QUERY_KEY });
      await qc.invalidateQueries();

      setAberto(false);
      toast.success(`Agora é ${p.nome}.`);
    } catch (e) {
      toast.error(`Não foi possível trocar de perfil. ${(e as Error)?.message ?? ""}`);
    } finally {
      setTrocandoId(null);
    }
  };

  const nomeAtual = nome || "Perfil";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Trocar de perfil"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--gw-border)] bg-white pl-1 pr-3 py-1 shadow-sm hover:shadow transition-shadow"
      >
        <span
          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
          style={{ backgroundColor: corDoPerfil(userId ?? "x") }}
        >
          {iniciais(nomeAtual)}
        </span>
        <span className="text-[13px] font-semibold text-[#0F172A] max-w-[140px] truncate">{nomeAtual}</span>
        <RefreshCw className="h-3.5 w-3.5 text-[var(--gw-text-muted)]" />
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-center text-[20px]">Quem está usando?</DialogTitle>
            <DialogDescription className="text-center">
              Toque no seu perfil. O histórico do PCP passa a sair no seu nome.
            </DialogDescription>
          </DialogHeader>

          {carregandoPerfis ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--gw-text-muted)]" /></div>
          ) : erroPerfis ? (
            <p className="text-center text-[13px] text-[var(--gw-danger)] py-6">
              Não foi possível carregar os perfis. {(erroPerfis as Error).message}
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-5 py-3">
              {perfis.map(p => {
                const eu = p.id === userId;
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1.5 w-[96px]">
                    <button
                      type="button"
                      disabled={!!trocandoId}
                      onClick={() => void trocarPara(p)}
                      className="h-[84px] w-[84px] rounded-[14px] flex items-center justify-center text-white text-[26px] font-bold transition-transform hover:scale-105 disabled:opacity-70"
                      style={{
                        backgroundColor: corDoPerfil(p.id),
                        boxShadow: eu ? "0 0 0 3px #FFFFFF, 0 0 0 6px #0F172A" : undefined,
                      }}
                    >
                      {trocandoId === p.id ? <Loader2 className="h-7 w-7 animate-spin" /> : iniciais(p.nome)}
                    </button>
                    <span className="text-[13px] font-semibold text-center leading-tight">{p.nome}</span>
                    {eu && <span className="text-[11px] text-[var(--gw-text-muted)] -mt-1">em uso</span>}
                  </div>
                );
              })}
              {perfis.length === 0 && (
                <p className="text-[13px] text-[var(--gw-text-muted)] py-6">Nenhum usuário de Produção cadastrado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
