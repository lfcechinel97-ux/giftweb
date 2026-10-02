import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Cotação de frete via Melhor Envio, pro orçamento sugerir o valor
   automaticamente a partir das dimensões dos produtos (products_cache,
   sincronizado da XBZ) e do CEP do cliente. O token é fixo (gerado uma
   vez no painel do Melhor Envio, escopo "shipping-calculate"), guardado
   só como secret -- nunca chega no navegador. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Origem fixa: Guarulhos/SP, onde a mercadoria sai de verdade.
const CEP_ORIGEM = "07111080";

interface ItemFrete {
  altura: number;
  largura: number;
  comprimento: number;
  peso: number;
  quantidade: number;
  valor?: number;
}

const soDigitos = (v: string) => (v || "").replace(/\D/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const token = Deno.env.get("MELHOR_ENVIO_TOKEN") ?? "";
  if (!token) return json({ error: "MELHOR_ENVIO_TOKEN não configurado." }, 500);

  // Só equipe interna (qualquer papel) pode cotar -- mesmo gate usado nas
  // outras funções administrativas do sistema.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const chamador = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: quem, error: erroQuem } = await chamador.auth.getUser();
  if (erroQuem || !quem?.user) return json({ error: "Sessão inválida." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: souInterno } = await admin.from("admin_users").select("id").eq("id", quem.user.id).maybeSingle();
  if (!souInterno) return json({ error: "Acesso restrito à equipe interna." }, 403);

  const corpo = await req.json().catch(() => ({})) as { cepDestino?: string; itens?: ItemFrete[] };
  const cepDestino = soDigitos(corpo.cepDestino ?? "");
  const itens = corpo.itens ?? [];
  if (cepDestino.length !== 8) return json({ error: "CEP de destino inválido." }, 400);
  if (itens.length === 0) return json({ error: "Nenhum item com dimensões pra cotar." }, 400);
  if (itens.some(i => !i.altura || !i.largura || !i.comprimento || !i.peso)) {
    return json({ error: "Todo item precisa de altura, largura, comprimento e peso." }, 400);
  }

  const payload = {
    from: { postal_code: CEP_ORIGEM },
    to: { postal_code: cepDestino },
    products: itens.map((i, idx) => ({
      id: String(idx + 1),
      width: Math.max(11, Math.round(i.largura)),
      height: Math.max(2, Math.round(i.altura)),
      length: Math.max(16, Math.round(i.comprimento)),
      weight: Math.max(0.01, i.peso),
      insurance_value: i.valor ?? 0,
      quantity: Math.max(1, Math.round(i.quantidade)),
    })),
    options: { receipt: false, own_hand: false },
  };

  let resposta: Response;
  try {
    resposta = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // Melhor Envio exige um User-Agent identificando a aplicação.
        "User-Agent": "Gift Web Brindes (contato@giftwebbrindes.com.br)",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: "Não foi possível falar com o Melhor Envio agora." }, 502);
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !Array.isArray(dados)) {
    return json({ error: (dados as any)?.message || "Melhor Envio recusou a cotação.", detalhes: dados }, 502);
  }

  // Só as opções que voltaram com preço (sem erro por transportadora).
  const opcoes = dados
    .filter((o: any) => o?.price && !o?.error)
    .map((o: any) => ({
      id: o.id,
      transportadora: o.company?.name ?? "—",
      servico: o.name,
      preco: Number(o.price),
      prazoDias: o.delivery_time ?? null,
    }))
    .sort((a: any, b: any) => a.preco - b.preco);

  return json({ opcoes });
});
