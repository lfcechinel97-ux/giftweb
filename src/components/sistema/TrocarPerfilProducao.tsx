/* Botão "Trocar perfil" da produção (topo direito do /sistema).
 *
 * Cada operador entra uma vez com o próprio login neste computador; depois é
 * só clicar no perfil para trocar -- sem senha e sem recarregar a página.
 * A sessão é validada num cliente Supabase descartável antes de trocar: se
 * o login de alguém tiver expirado, a sessão atual continua intacta e só
 * pedimos a senha daquela pessoa de novo.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, PERFIL_QUERY_KEY } from "@/hooks/useUserRole";
import { clearAdminAccess, rememberAdminAccess } from "@/lib/adminAccessCache";
import {
  atualizarTokens, lerPerfisSalvos, removerPerfil, salvarPerfil, type PerfilSalvo,
} from "@/lib/perfisProducao";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CORES = ["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#DB2777", "#CA8A04"];
const corDoPerfil = (id: string) => CORES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length];
const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

/** Cliente sem persistência: testa/renova a sessão sem mexer na sessão atual. */
const clienteDescartavel = () =>
  createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "gw-troca-perfil" },
  });

/** É usuário da produção, ativo? (lido com a sessão dele, no cliente descartável) */
async function ehProducaoAtivo(cli: ReturnType<typeof clienteDescartavel>, userId: string) {
  const [{ data: roles }, { data: adm }] = await Promise.all([
    cli.from("user_roles").select("role").eq("user_id", userId),
    cli.from("admin_users").select("*").eq("id", userId).maybeSingle(),
  ]);
  const papeis = (roles ?? []).map((r: { role: string }) => r.role);
  if (!adm || (adm as { pausado?: boolean }).pausado === true) return { ok: false, nome: "" };
  return {
    ok: papeis.includes("producao") && !papeis.includes("admin") && !papeis.includes("gerente"),
    nome: ((adm as { nome?: string | null }).nome ?? "").trim(),
  };
}

export default function TrocarPerfilProducao() {
  const qc = useQueryClient();
  const { papel, nome, userId, isLoading } = useUserRole();
  const [perfis, setPerfis] = useState<PerfilSalvo[]>(() => lerPerfisSalvos());
  const [aberto, setAberto] = useState(false);
  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [gerenciar, setGerenciar] = useState(false);

  /* Lista sempre em dia (outra aba, renovação de token, remoção). */
  useEffect(() => {
    const ler = () => setPerfis(lerPerfisSalvos());
    window.addEventListener("gw-perfis-producao", ler);
    window.addEventListener("storage", ler);
    return () => { window.removeEventListener("gw-perfis-producao", ler); window.removeEventListener("storage", ler); };
  }, []);

  /* Operador da produção logado entra na lista sozinho; token novo atualiza. */
  useEffect(() => {
    if (isLoading || papel !== "producao" || !userId) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && data.session.user.id === userId) salvarPerfil(data.session, nome ?? "");
    });
  }, [isLoading, papel, userId, nome]);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      if (session && (evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN")) atualizarTokens(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const atual = useMemo(() => perfis.find(p => p.userId === userId), [perfis, userId]);
  if (isLoading || (papel !== "producao" && !atual)) return null;

  /** Põe a sessão (já validada) no cliente principal e recarrega os dados. */
  const aplicarSessao = async (s: Session, nomePerfil: string) => {
    const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    if (error) throw error;
    salvarPerfil(s, nomePerfil);
    clearAdminAccess();
    rememberAdminAccess(s.user.id);
    try { localStorage.removeItem("sistema_vendedor_v1"); } catch { /* armazenamento bloqueado */ }
    // Tudo que depende de quem está logado volta a ser buscado (sem reload).
    qc.removeQueries({ queryKey: PERFIL_QUERY_KEY });
    await qc.invalidateQueries();
  };

  const trocarPara = async (p: PerfilSalvo) => {
    if (p.userId === userId) { setAberto(false); return; }
    setTrocandoId(p.userId);
    try {
      const cli = clienteDescartavel();
      const { data, error } = await cli.auth.setSession({ access_token: p.accessToken, refresh_token: p.refreshToken });
      if (error || !data.session) {
        toast.error(`O acesso de ${p.nome} expirou. Entre de novo com a senha dele(a).`);
        removerPerfil(p.userId);
        setEmail(p.email);
        setAdicionando(true);
        return;
      }
      const verif = await ehProducaoAtivo(cli, data.session.user.id);
      if (!verif.ok) {
        toast.error(`${p.nome} não tem mais acesso de Produção.`);
        removerPerfil(p.userId);
        return;
      }
      await aplicarSessao(data.session, verif.nome || p.nome);
      setAberto(false);
      toast.success(`Agora é ${verif.nome || p.nome}.`);
    } catch (e) {
      toast.error(`Não foi possível trocar de perfil. ${(e as Error)?.message ?? ""}`);
    } finally {
      setTrocandoId(null);
    }
  };

  const adicionarPerfil = async () => {
    if (!email.trim() || !senha) return;
    setEntrando(true);
    try {
      const cli = clienteDescartavel();
      const { data, error } = await cli.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error || !data.session) { toast.error("E-mail ou senha inválidos."); return; }
      const verif = await ehProducaoAtivo(cli, data.session.user.id);
      if (!verif.ok) {
        toast.error("Só usuários de Produção (ativos) podem ser adicionados aqui.");
        await cli.auth.signOut({ scope: "local" });
        return;
      }
      await aplicarSessao(data.session, verif.nome);
      setSenha(""); setEmail(""); setAdicionando(false); setAberto(false);
      toast.success(`Perfil de ${verif.nome || data.session.user.email} adicionado.`);
    } catch (e) {
      toast.error(`Não foi possível entrar. ${(e as Error)?.message ?? ""}`);
    } finally {
      setEntrando(false);
    }
  };

  const nomeAtual = atual?.nome || nome || "Perfil";

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); setGerenciar(false); setAdicionando(false); }}
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

          {!adicionando ? (
            <>
              <div className="flex flex-wrap justify-center gap-5 py-3">
                {perfis.map(p => {
                  const eu = p.userId === userId;
                  return (
                    <div key={p.userId} className="relative flex flex-col items-center gap-1.5 w-[96px]">
                      <button
                        type="button"
                        disabled={!!trocandoId}
                        onClick={() => void trocarPara(p)}
                        className="h-[84px] w-[84px] rounded-[14px] flex items-center justify-center text-white text-[26px] font-bold transition-transform hover:scale-105 disabled:opacity-70"
                        style={{
                          backgroundColor: corDoPerfil(p.userId),
                          boxShadow: eu ? "0 0 0 3px #FFFFFF, 0 0 0 6px #0F172A" : undefined,
                        }}
                      >
                        {trocandoId === p.userId ? <Loader2 className="h-7 w-7 animate-spin" /> : iniciais(p.nome)}
                      </button>
                      <span className="text-[13px] font-semibold text-center leading-tight">{p.nome}</span>
                      {eu && <span className="text-[11px] text-[var(--gw-text-muted)] -mt-1">em uso</span>}
                      {gerenciar && !eu && (
                        <button
                          type="button"
                          title={`Remover ${p.nome} deste computador`}
                          onClick={() => removerPerfil(p.userId)}
                          className="absolute -top-2 -right-1 h-6 w-6 rounded-full bg-white border border-[var(--gw-border)] flex items-center justify-center text-[#DC2626] shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-col items-center gap-1.5 w-[96px]">
                  <button
                    type="button"
                    onClick={() => setAdicionando(true)}
                    className="h-[84px] w-[84px] rounded-[14px] border-2 border-dashed border-[var(--gw-border)] flex items-center justify-center text-[var(--gw-text-muted)] hover:border-[var(--gw-primary)] hover:text-[var(--gw-primary)]"
                  >
                    <Plus className="h-8 w-8" />
                  </button>
                  <span className="text-[13px] font-semibold text-[var(--gw-text-muted)]">Adicionar</span>
                </div>
              </div>
              {perfis.length > 1 && (
                <button
                  type="button"
                  onClick={() => setGerenciar(v => !v)}
                  className="mx-auto flex items-center gap-1.5 text-[12px] text-[var(--gw-text-muted)] hover:text-[#0F172A]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {gerenciar ? "Concluir" : "Remover perfis deste computador"}
                </button>
              )}
            </>
          ) : (
            <form
              className="space-y-3 py-2"
              onSubmit={e => { e.preventDefault(); void adicionarPerfil(); }}
            >
              <p className="text-[13px] text-[var(--gw-text-secondary)]">
                Entre uma vez com o seu login de Produção. Depois é só tocar no seu perfil para trocar, sem senha.
              </p>
              <Input type="email" placeholder="E-mail de login" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="username" />
              <Input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" />
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => { setAdicionando(false); setSenha(""); }}>Voltar</Button>
                <Button type="submit" disabled={entrando || !email.trim() || !senha}>
                  {entrando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Entrar e adicionar
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
