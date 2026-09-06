// =====================================================================
// sync-calcme-financeiro — espelho financeiro do Calcme
//
// Diferente da sync-calcme-orders, que importa apenas os 7 status de PCP
// (é o que o Pedidos/PCP precisam), esta traz TODOS os pedidos. Sem isso
// o dashboard enxergaria ~4% do faturamento: dos 608 pedidos, 571 estão
// em "Coletado e Enviado" e nunca entram em sistema_pedidos.
//
// O que faz:
//   1. Pagina /orders inteiro → upsert em sistema_calcme_vendas (leve:
//      só o cabeçalho financeiro do pedido)
//   2. Busca os ITENS apenas dos pedidos do período pedido — a API cobra
//      uma requisição por pedido, então 608 de uma vez seria abusivo
//   3. Espelha contas a pagar/receber já liquidadas
//   4. Registra em sistema_financeiro_sync_log
//
// O token NUNCA sai do backend: não é retornado, logado nem salvo.
//
// Corpo (todos opcionais):
//   { "inicio": "2026-09-01", "fim": "2026-09-30" }  período dos itens
//   { "itens": false }                               pula a etapa 2
//   { "reprocessarItens": true }                     rebusca itens já sincronizados
// =====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CALCME_BASE_URL = "https://serv.calcme.com.br";

/** Quantos pedidos podem ter os itens buscados em uma única execução.
 *  Cada um é uma requisição ao Calcme; o resto fica para a próxima. */
const MAX_ITENS_POR_SYNC = 120;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Chamada autenticada à API do Calcme. */
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

/** Percorre todas as páginas de um endpoint paginado do Calcme. */
async function calcmeAll(token: string, path: string, maxPages = 200): Promise<any[]> {
  const out: any[] = [];
  let page = 0;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const resp = await calcmeGet(token, `${path}${sep}page=${page}&size=100`);
    const data = resp?.data;
    const content: any[] = data?.content ?? [];
    out.push(...content);
    if (!data || data.last === true || content.length === 0) break;
    page += 1;
    if (page > maxPages) {
      throw new Error(`Paginação de ${path} excedeu ${maxPages} páginas — abortado por segurança.`);
    }
  }
  return out;
}

/** Grava em lotes: um upsert de 600 linhas estoura o limite da requisição. */
async function upsertEmLotes(
  supabase: any,
  tabela: string,
  linhas: Record<string, unknown>[],
  onConflict: string,
  tamanho = 200,
): Promise<void> {
  for (let i = 0; i < linhas.length; i += tamanho) {
    const { error } = await supabase
      .from(tabela)
      .upsert(linhas.slice(i, i + tamanho), { onConflict });
    if (error) throw new Error(`upsert ${tabela}: ${error.message}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- Auth do chamador: exige usuário autenticado do sistema --------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Autenticação necessária." }, 401);
  }
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ success: false, error: "Sessão inválida. Faça login novamente." }, 401);
  }

  // ---- Token do Calcme (secret de backend — nunca exposto) -----------------
  const token = Deno.env.get("CALCME_API_TOKEN");
  if (!token) {
    return json({ success: false, error: "Secret CALCME_API_TOKEN não configurado." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ---- Parâmetros ---------------------------------------------------------
  const body = await req.json().catch(() => ({})) as {
    inicio?: string; fim?: string; itens?: boolean; reprocessarItens?: boolean;
  };
  const buscarItens = body.itens !== false;
  const reprocessar = body.reprocessarItens === true;
  // Sem período informado, usa o mês corrente em horário de Brasília.
  const hojeBR = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const inicio = body.inicio ??
    `${hojeBR.getFullYear()}-${String(hojeBR.getMonth() + 1).padStart(2, "0")}-01`;
  const fim = body.fim ?? hojeBR.toISOString().slice(0, 10);

  const resumo = { success: true, vendas: 0, itens: 0, contas: 0, errors: 0, itens_pendentes: 0 };
  const detalhes: { erros: string[]; avisos: string[] } = { erros: [], avisos: [] };

  try {
    // =================================================================
    // 1) Cabeçalho de TODOS os pedidos
    // =================================================================
    const orders = await calcmeAll(token, "/api/open/v1/orders");
    resumo.vendas = orders.length;

    // Pedidos de produção já importados: permite ligar venda → pedido
    const { data: pedidosExistentes } = await supabase
      .from("sistema_pedidos")
      .select("id, calcme_order_id")
      .not("calcme_order_id", "is", null);
    const pedidoPorCalcmeId = new Map<string, string>();
    for (const p of pedidosExistentes ?? []) {
      if (p.calcme_order_id) pedidoPorCalcmeId.set(p.calcme_order_id, p.id);
    }

    const agora = new Date().toISOString();
    const linhasVenda = orders
      .filter((o) => o?.id)
      .map((o) => {
        const calcmeId = String(o.id);
        const status = String(o?.statusTitulo ?? "");
        return {
          calcme_order_id: calcmeId,
          calcme_order_idint: Number.isInteger(o?.idInt) ? o.idInt : null,
          cliente_nome: o?.clienteNome ? String(o.clienteNome).trim() : null,
          data: o?.data ? String(o.data).slice(0, 10) : null,
          valor_total: num(o?.valorTotal),
          status_titulo: status || null,
          // O Calcme não devolve pedidos cancelados na listagem, mas se um dia
          // devolver, ele não pode entrar como faturamento.
          cancelado: /cancel/i.test(status),
          pedido_id: pedidoPorCalcmeId.get(calcmeId) ?? null,
          raw: o,
          synced_at: agora,
        };
      });

    await upsertEmLotes(supabase, "sistema_calcme_vendas", linhasVenda, "calcme_order_id");

    // =================================================================
    // 2) Itens dos pedidos do período (base do CMV)
    // =================================================================
    if (buscarItens) {
      let q = supabase
        .from("sistema_calcme_vendas")
        .select("id, calcme_order_id, calcme_order_idint, itens_sincronizados_em")
        .gte("data", inicio)
        .lte("data", fim)
        .eq("cancelado", false)
        .order("data", { ascending: false });
      if (!reprocessar) q = q.is("itens_sincronizados_em", null);

      const { data: alvos, error: alvosErr } = await q;
      if (alvosErr) throw new Error(`consulta de vendas do período: ${alvosErr.message}`);

      const lote = (alvos ?? []).slice(0, MAX_ITENS_POR_SYNC);
      resumo.itens_pendentes = Math.max(0, (alvos?.length ?? 0) - lote.length);

      for (const venda of lote) {
        const ref = String(venda.calcme_order_idint ?? venda.calcme_order_id);
        try {
          let brutos: any[] = [];
          try {
            const resp = await calcmeGet(
              token,
              `/api/open/v1/orders/${encodeURIComponent(venda.calcme_order_id)}/product-items`,
            );
            brutos = resp?.data ?? [];
          } catch (e) {
            // Pedido sem itens responde 404 no Calcme — é lista vazia, não erro.
            if (!(e as Error).message.includes("HTTP 404")) throw e;
          }

          const linhasItem = brutos
            .filter((it) => it?.id)
            .map((it) => {
              const qtd = num(it?.quantidade);
              const vUnit = num(it?.valorUnit);
              return {
                venda_id: venda.id,
                calcme_item_id: String(it.id),
                calcme_produto_id: it?.produtoId ? String(it.produtoId) : null,
                produto_nome: it?.produtoNome ? String(it.produtoNome).trim() : null,
                quantidade: qtd,
                valor_unitario: vUnit,
                valor_total: num(it?.valorTotal) || qtd * vUnit,
                raw: it,
              };
            });

          if (linhasItem.length > 0) {
            // Upsert preserva custo_unitario, terceirizada_unit e os
            // percentuais já ajustados à mão: não estão no payload.
            await upsertEmLotes(
              supabase,
              "sistema_calcme_venda_itens",
              linhasItem,
              "calcme_item_id",
            );
            resumo.itens += linhasItem.length;
          }

          await supabase
            .from("sistema_calcme_vendas")
            .update({ itens_sincronizados_em: new Date().toISOString() })
            .eq("id", venda.id);
        } catch (e) {
          resumo.errors += 1;
          detalhes.erros.push(`Itens do pedido ${ref}: ${(e as Error).message}`);
        }
      }
    }

    // =================================================================
    // 3) Contas a receber / a pagar já liquidadas
    //    Só as liquidadas viram lançamento: conta em aberto é previsão,
    //    não dinheiro que entrou ou saiu.
    // =================================================================
    try {
      const [receber, pagar] = await Promise.all([
        calcmeAll(token, "/api/open/v1/financial/bills-to-receive", 50),
        calcmeAll(token, "/api/open/v1/financial/bills-to-pay", 50),
      ]);

      // A API não devolve a data de baixa, apenas o vencimento. É a melhor
      // data disponível para posicionar o lançamento no tempo.
      const recebimentos = receber
        .filter((b) => b?.id && b?.liquidado === true)
        .map((b) => ({
          calcme_bill_id: String(b.id),
          data: b?.dataVencimento ? String(b.dataVencimento).slice(0, 10)
              : (b?.dataCompetencia ? String(b.dataCompetencia).slice(0, 10) : null),
          valor: num(b?.valorConta),
          descricao: [b?.personNome, b?.descricao].filter(Boolean).join(" — ") || "Conta a receber (Calcme)",
          origem: "calcme",
        }))
        .filter((r) => r.data !== null);

      const despesas = pagar
        .filter((b) => b?.id && b?.liquidado === true)
        .map((b) => ({
          calcme_bill_id: String(b.id),
          data: b?.dataVencimento ? String(b.dataVencimento).slice(0, 10)
              : (b?.dataCompetencia ? String(b.dataCompetencia).slice(0, 10) : null),
          valor: num(b?.valorConta),
          descricao: [b?.personNome, b?.descricao].filter(Boolean).join(" — ") || "Conta a pagar (Calcme)",
          origem: "calcme",
          pago: true,
        }))
        .filter((d) => d.data !== null);

      if (recebimentos.length > 0) {
        await upsertEmLotes(supabase, "sistema_recebimentos", recebimentos, "calcme_bill_id");
      }
      if (despesas.length > 0) {
        await upsertEmLotes(supabase, "sistema_despesas", despesas, "calcme_bill_id");
      }
      resumo.contas = recebimentos.length + despesas.length;

      const abertas = receber.filter((b) => b?.liquidado !== true).length
                    + pagar.filter((b) => b?.liquidado !== true).length;
      if (abertas > 0) {
        detalhes.avisos.push(
          `${abertas} conta(s) em aberto no Calcme não foram lançadas — só entram quando liquidadas.`,
        );
      }
    } catch (e) {
      resumo.errors += 1;
      detalhes.erros.push(`Contas a pagar/receber: ${(e as Error).message}`);
    }

    if (resumo.itens_pendentes > 0) {
      detalhes.avisos.push(
        `${resumo.itens_pendentes} pedido(s) do período ainda sem itens — rode a sincronização de novo para continuar.`,
      );
    }

    // ---- Log ---------------------------------------------------------
    await supabase.from("sistema_financeiro_sync_log").insert({
      status: resumo.errors > 0 ? "partial" : "success",
      vendas: resumo.vendas,
      itens: resumo.itens,
      contas: resumo.contas,
      errors: resumo.errors,
      detalhes: (detalhes.erros.length || detalhes.avisos.length) ? detalhes : null,
    });

    return json({
      ...resumo,
      periodo: { inicio, fim },
      detalhes: (detalhes.erros.length || detalhes.avisos.length) ? detalhes : undefined,
    });
  } catch (e) {
    await supabase.from("sistema_financeiro_sync_log").insert({
      status: "error",
      vendas: resumo.vendas,
      itens: resumo.itens,
      contas: resumo.contas,
      errors: resumo.errors + 1,
      detalhes: { erros: [...detalhes.erros, (e as Error).message], avisos: detalhes.avisos },
    });
    return json({ ...resumo, success: false, error: (e as Error).message }, 500);
  }
});
