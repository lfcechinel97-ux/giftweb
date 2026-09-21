import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSistema } from "@/contexts/SistemaContext";
import { useUserRole, ROTULO_PAPEL, type AppRole } from "@/hooks/useUserRole";

interface UsuarioRow {
  user_id: string;
  email: string;
  nome: string | null;
  papel: AppRole;
  vendedor_id: string | null;
}

const PAPEIS: AppRole[] = ["admin", "vendedor", "producao"];
const SEM_VENDEDOR = "__nenhum__";

const DESCRICAO_PAPEL: Record<AppRole, string> = {
  admin: "Vê tudo, inclusive resultado, custos e despesas.",
  vendedor: "Pedidos, orçamentos, PCP e clientes. Sem resultado nem custos.",
  producao: "Mesmos acessos do comercial. Sem resultado nem custos.",
};

/* Cliente separado, sem sessão persistida: criar a conta de outra pessoa
   não pode trocar a sessão do admin que está logado. */
const clienteCadastro = () =>
  createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "gw-cadastro-usuario" },
  });

export default function UsuariosAdmin() {
  const { isAdmin, userId, isLoading: perfilCarregando } = useUserRole();
  const { vendedores } = useSistema();
  const qc = useQueryClient();

  const usuariosQuery = useQuery<UsuarioRow[]>({
    queryKey: ["sistema", "usuarios"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("sistema_listar_usuarios");
      if (error) throw error;
      return (data ?? []) as UsuarioRow[];
    },
  });

  const [novo, setNovo] = useState({ nome: "", email: "", senha: "", papel: "vendedor" as AppRole, vendedorId: SEM_VENDEDOR });
  const [criando, setCriando] = useState(false);
  const [edicoes, setEdicoes] = useState<Record<string, Partial<UsuarioRow>>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  if (perfilCarregando) return null;
  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Somente o administrador gerencia usuários.</p>;
  }

  const salvarNoBanco = async (email: string, nome: string, papel: AppRole, vendedorId: string | null) => {
    const { error } = await (supabase as any).rpc("sistema_salvar_usuario", {
      p_email: email, p_nome: nome, p_papel: papel, p_vendedor_id: vendedorId,
    });
    if (error) throw error;
  };

  const criar = async () => {
    const email = novo.email.trim().toLowerCase();
    const nome = novo.nome.trim();
    if (!nome || !email) { toast.error("Informe nome e e-mail."); return; }
    if (novo.senha.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres."); return; }
    setCriando(true);
    try {
      const vendedorId = novo.vendedorId === SEM_VENDEDOR ? null : novo.vendedorId;
      let jaExistia = false;

      /* Caminho principal: função no servidor, que funciona com o cadastro
         público DESLIGADO. Se ela ainda não foi publicada (404/rede), cai
         no cadastro público antigo para não travar a criação de usuários. */
      const { data: res, error: erroFn } = await supabase.functions.invoke("sistema-criar-usuario", {
        body: { email, senha: novo.senha, nome, papel: novo.papel, vendedorId },
      });
      const naoPublicada = !!erroFn
        && (erroFn.name === "FunctionsFetchError" || (erroFn as any).context?.status === 404);

      if (!erroFn) {
        jaExistia = !!(res as any)?.jaExistia;
      } else if (naoPublicada) {
        const { data, error } = await clienteCadastro().auth.signUp({ email, password: novo.senha });
        jaExistia = /already|registered|exists/i.test(error?.message ?? "")
          || (!!data?.user && (data.user.identities?.length ?? 0) === 0);
        if (error && !jaExistia) throw error;
        await salvarNoBanco(email, nome, novo.papel, vendedorId);
      } else {
        const detalhe = await (erroFn as any)?.context?.json?.().catch(() => null);
        throw new Error(detalhe?.error ?? erroFn.message);
      }

      toast.success(jaExistia
        ? "Esse e-mail já tinha conta: acesso liberado, mas a senha continua a antiga."
        : "Usuário criado. Ele já pode entrar com o e-mail e a senha informados.");
      setNovo({ nome: "", email: "", senha: "", papel: "vendedor", vendedorId: SEM_VENDEDOR });
      await qc.invalidateQueries({ queryKey: ["sistema", "usuarios"] });
    } catch (e: any) {
      toast.error(`Não foi possível criar o usuário. ${e?.message ?? ""}`);
    } finally {
      setCriando(false);
    }
  };

  const valor = <K extends keyof UsuarioRow>(u: UsuarioRow, k: K): UsuarioRow[K] =>
    (edicoes[u.user_id]?.[k] ?? u[k]) as UsuarioRow[K];

  const editar = (id: string, patch: Partial<UsuarioRow>) =>
    setEdicoes(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const salvar = async (u: UsuarioRow) => {
    setSalvandoId(u.user_id);
    try {
      await salvarNoBanco(u.email, valor(u, "nome") ?? "", valor(u, "papel"), valor(u, "vendedor_id"));
      setEdicoes(prev => { const p = { ...prev }; delete p[u.user_id]; return p; });
      await qc.invalidateQueries({ queryKey: ["sistema", "usuarios"] });
      toast.success("Usuário atualizado.");
    } catch (e: any) {
      toast.error(`Não foi possível salvar. ${e?.message ?? ""}`);
    } finally {
      setSalvandoId(null);
    }
  };

  const remover = async (u: UsuarioRow) => {
    if (!window.confirm(`Tirar o acesso de ${u.nome || u.email} ao sistema?`)) return;
    const { error } = await (supabase as any).rpc("sistema_remover_usuario", { p_user_id: u.user_id });
    if (error) { toast.error(`Não foi possível remover. ${error.message}`); return; }
    await qc.invalidateQueries({ queryKey: ["sistema", "usuarios"] });
    toast.success("Acesso removido.");
  };

  const SelectVendedor = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => (
    <Select value={value ?? SEM_VENDEDOR} onValueChange={v => onChange(v === SEM_VENDEDOR ? null : v)}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_VENDEDOR}>Nenhum</SelectItem>
        {vendedores.filter(v => v.ativo !== false).map(v => (
          <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const SelectPapel = ({ value, onChange, travado }: { value: AppRole; onChange: (v: AppRole) => void; travado?: boolean }) => (
    <Select value={value} onValueChange={v => onChange(v as AppRole)} disabled={travado}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {PAPEIS.map(p => <SelectItem key={p} value={p}>{ROTULO_PAPEL[p]}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Novo usuário</p>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={novo.nome} onChange={e => setNovo(p => ({ ...p, nome: e.target.value }))} placeholder="Ex.: Leandro Sanches" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail de login</Label>
            <Input type="email" value={novo.email} onChange={e => setNovo(p => ({ ...p, email: e.target.value }))} placeholder="nome@empresa.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha inicial</Label>
            <Input type="text" value={novo.senha} onChange={e => setNovo(p => ({ ...p, senha: e.target.value }))} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Perfil</Label>
            <SelectPapel value={novo.papel} onChange={papel => setNovo(p => ({ ...p, papel }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendedor vinculado</Label>
            <SelectVendedor
              value={novo.vendedorId === SEM_VENDEDOR ? null : novo.vendedorId}
              onChange={v => setNovo(p => ({ ...p, vendedorId: v ?? SEM_VENDEDOR }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{DESCRICAO_PAPEL[novo.papel]} O vendedor vinculado assina o histórico e os pedidos desse usuário.</p>
          <Button onClick={() => void criar()} disabled={criando} className="shrink-0">
            {criando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar usuário
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {usuariosQuery.isPending && !usuariosQuery.isError ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando usuários…</p>
        ) : usuariosQuery.isError ? (
          <p className="p-6 text-center text-sm text-destructive">
            Não foi possível carregar os usuários. Confira se a migration de perfis já foi rodada no banco.
          </p>
        ) : (usuariosQuery.data ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário.</p>
        ) : (
          <div className="divide-y divide-border">
            <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_150px_180px_110px] gap-3 px-4 py-2 text-xs text-muted-foreground">
              <span>Nome</span><span>E-mail</span><span>Perfil</span><span>Vendedor vinculado</span><span />
            </div>
            {(usuariosQuery.data ?? []).map(u => {
              const souEu = u.user_id === userId;
              const alterado = !!edicoes[u.user_id];
              return (
                <div key={u.user_id} className="grid gap-3 md:grid-cols-[1.2fr_1.4fr_150px_180px_110px] items-center px-4 py-2.5">
                  <Input
                    value={valor(u, "nome") ?? ""}
                    onChange={e => editar(u.user_id, { nome: e.target.value })}
                    placeholder="Sem nome"
                    className="h-9"
                  />
                  <span className="text-sm truncate" title={u.email}>
                    {u.email}{souEu && <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>}
                  </span>
                  <SelectPapel value={valor(u, "papel")} onChange={papel => editar(u.user_id, { papel })} travado={souEu} />
                  <SelectVendedor value={valor(u, "vendedor_id")} onChange={v => editar(u.user_id, { vendedor_id: v })} />
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant={alterado ? "default" : "ghost"} disabled={!alterado || salvandoId === u.user_id} onClick={() => void salvar(u)}>
                      {salvandoId === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    {!souEu && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void remover(u)} title="Tirar acesso">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
