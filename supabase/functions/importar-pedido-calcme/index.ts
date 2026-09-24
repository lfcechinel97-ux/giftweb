import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Importação MANUAL de um pedido específico do Calcme, pelo número
   (idInt) que o vendedor vê lá — diferente do antigo sync-calcme-orders
   (removido em 17/09/2026), que trazia em massa e gerava numeração
   própria (CM-xxxxx). Aqui:
     - só admin chama, um pedido por vez, pelo número exato;
     - o pedido nasce com o MESMO número do Calcme;
     - os itens entram com o nome bruto do Calcme, SEM produto do
       catálogo vinculado e SEM personalização — a tela de Pedidos já
       destaca em vermelho todo item sem personalização definida, então
       o item importado aparece marcado para revisão sozinho; quem
       revisa abre "Editar item" e troca pelo produto certo do /sistema,
       mantendo quantidade e preço já trazidos do Calcme. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALCME_BASE_URL = "https://serv.calcme.com.br";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function calcmeGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${CALCME_BASE_URL}${path}`, {
    headers: { "X-CalcMe-Api-Token": token, Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Autenticação recusada pela API do Calcme (HTTP ${res.status}). Verifique o token.`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Calcme HTTP ${res.status} em ${path}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

const FRETE_RE = /(^|\s)fretes?(\s|$)/i;
const ehItemFrete = (it: any): boolean => FRETE_RE.test(String(it?.produtoNome ?? ""));
const tipoDoFrete = (it: any): string | null => {
  const resto = String(it?.produtoNome ?? "").replace(/^\s*fretes?\s*/i, "").trim();
  return resto || null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Autenticação necessária." }, 401);
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ success: false, error: "Sessão inválida. Faça login novamente." }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: ehAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!ehAdmin) return json({ success: false, error: "Apenas administradores podem importar do Calcme." }, 403);

  const token = Deno.env.get("CALCME_API_TOKEN");
  if (!token) return json({ success: false, error: "Secret CALCME_API_TOKEN não configurado." }, 500);

  const body = await req.json().catch(() => ({})) as { numero?: string | number };
  const numeroBusca = Number(body.numero);
  if (!Number.isInteger(numeroBusca) || numeroBusca <= 0) {
    return json({ success: false, error: "Informe o número do pedido no Calcme." }, 400);
  }
  const numeroStr = String(numeroBusca);

  // Já existe pedido com esse número? Não sobrescreve.
  const { data: existente } = await admin.from("sistema_pedidos").select("id").eq("numero", numeroStr).maybeSingle();
  if (existente) return json({ success: false, error: `Já existe um pedido com o número ${numeroStr} no sistema.` }, 409);

  try {
    // ---- 1) Acha o pedido na listagem do Calcme pelo idInt (a API não
    // tem busca direta por número; percorre as páginas até achar). ------
    let achado: any = null;
    for (let page = 0; page < 200 && !achado; page++) {
      const resp = await calcmeGet(token, `/api/open/v1/orders?page=${page}&size=100`);
      const content: any[] = resp?.data?.content ?? [];
      achado = content.find((o) => o?.idInt === numeroBusca) ?? null;
      if (!resp?.data || resp.data.last === true || content.length === 0) break;
    }
    if (!achado) return json({ success: false, error: `Pedido ${numeroStr} não encontrado no Calcme.` }, 404);

    const calcmeOrderId = String(achado.id ?? "");
    let detail: any = achado;
    try {
      const detailResp = await calcmeGet(token, `/api/open/v1/orders/${encodeURIComponent(calcmeOrderId)}`);
      detail = detailResp?.data ?? achado;
    } catch { /* usa os dados da listagem */ }

    let rawItems: any[] = [];
    try {
      const itemsResp = await calcmeGet(token, `/api/open/v1/orders/${encodeURIComponent(calcmeOrderId)}/product-items`);
      rawItems = itemsResp?.data ?? [];
    } catch { /* pedido sem itens de produto */ }

    const itensFrete = rawItems.filter(ehItemFrete);
    const itensProduto = rawItems.filter((it) => !ehItemFrete(it));
    const freteValor = itensFrete.reduce((soma, it) => {
      const qtd = Number(it?.quantidade ?? 0) || 0;
      const vUnit = Number(it?.valorUnit ?? 0) || 0;
      return soma + (Number(it?.valorTotal ?? qtd * vUnit) || 0);
    }, 0);
    const freteTipo = itensFrete.length > 0 ? tipoDoFrete(itensFrete[0]) : null;
    const valorTotal = Number(detail?.valorTotal ?? achado?.valorTotal ?? 0) || 0;

    const itensJsonb = itensProduto.map((it) => {
      const qtd = Number(it?.quantidade ?? 0) || 0;
      const vUnit = Number(it?.valorUnit ?? 0) || 0;
      const vTot = Number(it?.valorTotal ?? qtd * vUnit) || 0;
      const descricao = it?.descricao ?? it?.descricaoPersonalizacao ?? it?.observacao ?? null;
      return {
        id: crypto.randomUUID(),
        // Sem produtoId/codigoComposto de propósito: o nome vem do Calcme,
        // não bate com o catálogo do /sistema — fica para revisão manual
        // ("Editar item" > trocar pelo produto certo).
        nome: String(it?.produtoNome ?? "Item sem nome"),
        quantidade: qtd,
        precoUnitario: vUnit,
        total: vTot,
        observacao: descricao ? String(descricao) : undefined,
      };
    });

    const clienteNome = detail?.clienteNome ?? achado?.clienteNome ?? null;
    const dataPedido: string | null = detail?.data ?? achado?.data ?? null;
    const dataEntrega: string | null = detail?.dataEntrega ?? null;

    const { data: inserido, error: erroInsert } = await admin
      .from("sistema_pedidos")
      .insert({
        numero: numeroStr,
        status: "organizando_anotacoes",
        contato_nome: clienteNome,
        cliente_snapshot: clienteNome ? { nome: clienteNome, origem: "calcme" } : null,
        observacoes: detail?.observacoes ?? null,
        itens: itensJsonb,
        subtotal: valorTotal - freteValor,
        frete_tipo: freteTipo,
        frete_valor: freteValor,
        total: valorTotal,
        prazo_producao_dias: 15,
        ...(dataEntrega ? { data_despachar_ate: dataEntrega } : {}),
        ...(dataPedido ? { created_at: dataPedido } : {}),
        calcme_order_id: calcmeOrderId || null,
        calcme_order_idint: numeroBusca,
        calcme_status: detail?.statusTitulo ?? achado?.statusTitulo ?? null,
        calcme_vendedor_nome: detail?.vendedorNome ?? null,
        calcme_data_entrega: dataEntrega,
        calcme_raw: detail,
        calcme_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (erroInsert) throw new Error(`insert sistema_pedidos: ${erroInsert.message}`);

    await admin.from("sistema_auditoria").insert({
      entidade: "pedido", entidade_id: inserido.id, entidade_numero: numeroStr,
      acao: "pedido_importado_calcme",
      detalhes: { itens: itensJsonb.length, cliente: clienteNome },
      usuario_id: userData.user.id, usuario_email: userData.user.email,
    });

    return json({
      success: true,
      pedidoId: inserido.id,
      numero: numeroStr,
      cliente: clienteNome,
      itensImportados: itensJsonb.length,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
