import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Troca rápida de perfil da PRODUÇÃO ("Quem está usando?", estilo Netflix).
 *
 * Cada operador tem o próprio usuário, mas no computador da produção ninguém
 * quer ficar saindo e entrando com senha. Quem já está logado como Produção
 * pode:
 *   - acao "listar": ver os usuários de Produção ativos;
 *   - acao "trocar": virar outro usuário de Produção. Gera um token de uso
 *     único (magic link, sem enviar e-mail) que o navegador troca por uma
 *     sessão daquele usuário -- sem senha e sem recarregar a página.
 *
 * Limites: só quem é Produção/admin/gerente (e não está pausado) chama; o
 * destino é SEMPRE um usuário de Produção ativo -- nunca dá pra virar admin
 * ou comercial por aqui.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);

  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);

  const admin = createClient(url, serviceKey);

  // has_role já devolve false para usuário pausado.
  const papeisPermitidos = ["producao", "admin", "gerente"];
  const checagens = await Promise.all(
    papeisPermitidos.map(r => admin.rpc("has_role", { _user_id: quem.user.id, _role: r })),
  );
  if (!checagens.some(c => c.data === true)) {
    return json({ error: "Só a produção pode trocar de perfil por aqui." }, 403);
  }

  /* Usuários de Produção ativos (sem admin/gerente, que não entram na troca). */
  const listarProducao = async () => {
    const { data: roles, error } = await admin.from("user_roles").select("user_id, role");
    if (error) throw error;
    const porUsuario = new Map<string, Set<string>>();
    for (const r of roles ?? []) {
      const s = porUsuario.get(r.user_id) ?? new Set<string>();
      s.add(String(r.role));
      porUsuario.set(r.user_id, s);
    }
    const ids = [...porUsuario.entries()]
      .filter(([, s]) => s.has("producao") && !s.has("admin") && !s.has("gerente"))
      .map(([id]) => id);
    if (ids.length === 0) return [];
    const { data: usuarios, error: e2 } = await admin.from("admin_users").select("*").in("id", ids);
    if (e2) throw e2;
    return (usuarios ?? [])
      .filter((u: { pausado?: boolean }) => u.pausado !== true)
      .map((u: { id: string; nome: string | null; email: string | null }) => ({
        id: u.id,
        nome: (u.nome ?? "").trim() || (u.email ?? "").split("@")[0],
        email: u.email ?? "",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  };

  const corpo = await req.json().catch(() => ({})) as { acao?: string; userId?: string };

  try {
    if (corpo.acao === "listar") {
      return json({ perfis: await listarProducao() });
    }

    if (corpo.acao === "trocar") {
      const perfis = await listarProducao();
      const alvo = perfis.find(p => p.id === corpo.userId);
      if (!alvo) return json({ error: "Perfil não encontrado ou sem acesso de Produção." }, 404);
      if (!alvo.email) return json({ error: "Esse usuário não tem e-mail de login." }, 400);

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: alvo.email });
      const tokenHash = data?.properties?.hashed_token;
      if (error || !tokenHash) return json({ error: error?.message ?? "Não foi possível gerar o acesso." }, 500);

      return json({ tokenHash, nome: alvo.nome });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Erro inesperado." }, 500);
  }
});
