import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Cria a conta de login de um usuário do sistema. Existe para que o
   cadastro público do Supabase possa ficar DESLIGADO: só um admin logado
   consegue chamar isto, e a conta nasce já confirmada e já liberada no
   sistema (admin_users + papel). */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAPEIS = ["admin", "vendedor", "producao"];

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
  const { data: ehAdmin } = await admin.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
  if (!ehAdmin) return json({ error: "Apenas administradores podem criar usuários." }, 403);

  const corpo = await req.json().catch(() => ({})) as {
    email?: string; senha?: string; nome?: string; papel?: string; vendedorId?: string | null;
  };
  const email = (corpo.email ?? "").trim().toLowerCase();
  const senha = corpo.senha ?? "";
  const nome = (corpo.nome ?? "").trim();
  const papel = corpo.papel ?? "";
  if (!email || !nome) return json({ error: "Informe nome e e-mail." }, 400);
  if (senha.length < 6) return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
  if (!PAPEIS.includes(papel)) return json({ error: "Perfil inválido." }, 400);

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
  });

  let userId = criado?.user?.id ?? null;
  let jaExistia = false;
  if (erroCriar) {
    if (!/already|registered|exists/i.test(erroCriar.message)) return json({ error: erroCriar.message }, 400);
    // Conta já existia: só libera o acesso (a senha continua a antiga).
    jaExistia = true;
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = lista?.users.find(u => (u.email ?? "").toLowerCase() === email)?.id ?? null;
    if (!userId) return json({ error: "Conta existente não encontrada." }, 400);
  }

  const { error: erroAcesso } = await admin.from("admin_users").upsert(
    { id: userId, email, nome, vendedor_id: corpo.vendedorId ?? null },
    { onConflict: "id" },
  );
  if (erroAcesso) return json({ error: erroAcesso.message }, 500);

  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: erroPapel } = await admin.from("user_roles").insert({ user_id: userId, role: papel });
  if (erroPapel) return json({ error: erroPapel.message }, 500);

  return json({ success: true, userId, jaExistia });
});
