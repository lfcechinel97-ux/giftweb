// =====================================================================
// sync-calcme-orders — Integração Calcme → Gift Web (Etapa 1)
//
// Importa pedidos do Calcme para o sistema Gift Web:
//   1. Autentica na API do Calcme (header X-CalcMe-Api-Token, via secret)
//   2. Busca os status de PCP no Calcme e resolve os 7 status permitidos
//   3. Percorre TODAS as páginas de pedidos (paginação page/size)
//   4. Filtra pelos status permitidos (demais são ignorados)
//   5. Upsert idempotente do pedido (chave: calcme_order_id)
//   6. Upsert idempotente dos itens (chave: calcme_item_id)
//   7. Upsert dos METADADOS dos arquivos anexados (não baixa o arquivo)
//   8. Registra log em sistema_calcme_sync_log
//   9. Erro em um pedido não interrompe os demais
//
// O token NUNCA sai do backend: não é retornado, logado nem salvo.
// =====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CALCME_BASE_URL = "https://serv.calcme.com.br";

/** Status de PCP do Calcme que devem ser importados (títulos de referência). */
const ALLOWED_STATUS_TITLES = [
  "Imprimir Ordem de Produção",
  "Aguardando Mercadoria",
  "Aguardando Teste (Laser/DTF)",
  "Aguardando Aprovação Teste",
  "Preparar DTF / Vetorização",
  "A Produzir",
  "A Produzir - Terceirizada",
];

/** Normaliza títulos para comparação tolerante (acentos, caixa, espaços). */
const norm = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const ALLOWED_NORM = new Set(ALLOWED_STATUS_TITLES.map(norm));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Chamada autenticada à API do Calcme. Lança erro com contexto em falhas. */
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

  // Modo diagnóstico (somente leitura): POST { "debugIdInt": 100667 }
  // mostra como um pedido específico aparece na listagem do Calcme.
  let debugIdInt: number | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.debugIdInt === "number") debugIdInt = body.debugIdInt;
  } catch { /* requisição sem corpo */ }
  let debugEntry: any = null;

  const summary = {
    success: true,
    found: 0,
    imported: 0,
    updated: 0,
    ignored: 0,
    errors: 0,
  };
  const detalhes: { erros: { pedido: string; erro: string }[]; avisos: string[] } = {
    erros: [],
    avisos: [],
  };

  try {
    // ---- 1) Resolve os status permitidos a partir do próprio Calcme --------
    // (preferência pelos IDs internos; os títulos ficam como referência)
    try {
      const titulosVistos = new Set<string>();
      // Pedidos usam o catálogo de status comercial e/ou de PCP — consulta os dois
      for (const grupo of ["sales", "pcp"]) {
        let page = 0;
        // paginação defensiva: status raramente passam de 1 página
        for (;;) {
          const resp = await calcmeGet(token, `/api/open/v1/status/${grupo}?page=${page}&size=100`);
          const content: any[] = resp?.data?.content ?? [];
          for (const st of content) {
            const n = norm(st?.titulo);
            if (ALLOWED_NORM.has(n)) titulosVistos.add(n);
          }
          if (!resp?.data || resp.data.last === true || content.length === 0) break;
          page += 1;
          if (page > 20) break;
        }
      }
      const naoEncontrados = ALLOWED_STATUS_TITLES.filter((t) => !titulosVistos.has(norm(t)));
      if (naoEncontrados.length > 0) {
        detalhes.avisos.push(
          `Status não localizados nos catálogos do Calcme (verifique os títulos): ${naoEncontrados.join(", ")}`,
        );
      }
    } catch (e) {
      detalhes.avisos.push(
        `Não foi possível consultar /status/pcp (${(e as Error).message}). Filtro aplicado pelos títulos.`,
      );
    }

    // ---- 2) Paginação completa dos pedidos ---------------------------------
    const candidatos: any[] = [];
    let page = 0;
    for (;;) {
      const resp = await calcmeGet(token, `/api/open/v1/orders?page=${page}&size=100`);
      const pageData = resp?.data;
      const content: any[] = pageData?.content ?? [];
      for (const o of content) {
        summary.found += 1;
        if (debugIdInt !== null && o?.idInt === debugIdInt) {
          debugEntry = {
            id: o?.id,
            idInt: o?.idInt,
            statusTitulo: o?.statusTitulo ?? null,
            clienteNome: o?.clienteNome ?? null,
            valorTotal: o?.valorTotal ?? null,
            data: o?.data ?? null,
            statusPermitido: ALLOWED_NORM.has(norm(o?.statusTitulo)),
          };
        }
        // Filtro por título (a listagem não expõe o id do status)
        if (ALLOWED_NORM.has(norm(o?.statusTitulo))) candidatos.push(o);
        else summary.ignored += 1;
      }
      if (!pageData || pageData.last === true || content.length === 0) break;
      page += 1;
      if (page > 200) throw new Error("Paginação excedeu 200 páginas — abortado por segurança.");
    }

    // ---- 3) Importação de cada pedido (erro isolado não aborta o lote) -----
    for (const ord of candidatos) {
      const calcmeOrderId = String(ord?.id ?? "");
      const ref = String(ord?.idInt ?? calcmeOrderId);
      if (!calcmeOrderId) {
        summary.errors += 1;
        detalhes.erros.push({ pedido: ref, erro: "Pedido sem id na resposta do Calcme." });
        continue;
      }
      try {
        // Detalhe do pedido. Alguns registros aparecem na listagem mas 404 no
        // detalhe (ex.: pedidos removidos/rascunho) — nesse caso usamos os
        // dados da própria listagem e seguimos com aviso.
        let detail: any;
        try {
          const detailResp = await calcmeGet(token, `/api/open/v1/orders/${encodeURIComponent(calcmeOrderId)}`);
          detail = detailResp?.data ?? ord;
        } catch (e) {
          if ((e as Error).message.includes("HTTP 404")) {
            detail = ord;
            detalhes.avisos.push(`Pedido ${ref}: detalhe indisponível no Calcme (404), importado com dados da listagem.`);
          } else {
            throw e;
          }
        }
        // Pedido sem itens retorna 404 no Calcme ("Registro não encontrado") —
        // tratamos como lista vazia, não como erro de sincronização.
        let rawItems: any[] = [];
        try {
          const itemsResp = await calcmeGet(
            token,
            `/api/open/v1/orders/${encodeURIComponent(calcmeOrderId)}/product-items`,
          );
          rawItems = itemsResp?.data ?? [];
        } catch (e) {
          if ((e as Error).message.includes("HTTP 404")) {
            detalhes.avisos.push(`Pedido ${ref}: sem itens de produto no Calcme.`);
          } else {
            throw e;
          }
        }

        const statusTitulo: string = detail?.statusTitulo ?? ord?.statusTitulo ?? "";
        const dataPedido: string | null = (detail?.data ?? ord?.data ?? null) as string | null;
        const dataEntrega: string | null = (detail?.dataEntrega ?? null) as string | null;
        const valorTotal = Number(detail?.valorTotal ?? ord?.valorTotal ?? 0) || 0;

        // Itens já importados (para reutilizar o uuid estável do item no jsonb)
        const { data: existingItems } = await supabase
          .from("sistema_calcme_itens")
          .select("calcme_item_id, item_id")
          .eq("calcme_item_id", "neq", "")
          .in("calcme_item_id", rawItems.map((i) => String(i?.id ?? "")).filter(Boolean));
        const stableId = new Map<string, string>();
        for (const r of existingItems ?? []) {
          if (r.calcme_item_id && r.item_id) stableId.set(r.calcme_item_id, r.item_id);
        }

        // Monta o jsonb itens (fonte da UI de pedidos e do futuro PCP)
        const itensJsonb = rawItems.map((it) => {
          const calcmeItemId = String(it?.id ?? "");
          const itemUuid = stableId.get(calcmeItemId) ?? crypto.randomUUID();
          if (calcmeItemId) stableId.set(calcmeItemId, itemUuid);
          const qtd = Number(it?.quantidade ?? 0) || 0;
          const vUnit = Number(it?.valorUnit ?? 0) || 0;
          const vTot = Number(it?.valorTotal ?? qtd * vUnit) || 0;
          const descricao = it?.descricao ?? it?.descricaoPersonalizacao ?? it?.observacao ?? null;
          return {
            id: itemUuid,
            nome: String(it?.produtoNome ?? "Item sem nome"),
            quantidade: qtd,
            precoUnitario: vUnit,
            total: vTot,
            observacao: descricao ? String(descricao) : undefined,
            calcmeItemId: calcmeItemId || undefined,
          };
        });

        // Pedido já importado?
        const { data: existing } = await supabase
          .from("sistema_pedidos")
          .select("id")
          .eq("calcme_order_id", calcmeOrderId)
          .maybeSingle();

        const payload: Record<string, unknown> = {
          contato_nome: detail?.clienteNome ?? ord?.clienteNome ?? null,
          observacoes: detail?.observacoes ?? null,
          subtotal: valorTotal,
          frete_valor: 0,
          total: valorTotal,
          itens: itensJsonb,
          calcme_order_id: calcmeOrderId,
          calcme_order_idint: Number.isInteger(detail?.idInt) ? detail.idInt : (ord?.idInt ?? null),
          calcme_status: statusTitulo || null,
          calcme_vendedor_nome: detail?.vendedorNome ?? null,
          calcme_data_entrega: dataEntrega,
          calcme_raw: detail,
          calcme_synced_at: new Date().toISOString(),
        };
        if (dataEntrega) payload.data_despachar_ate = dataEntrega;

        let pedidoId: string;
        if (existing?.id) {
          const { error } = await supabase
            .from("sistema_pedidos")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw new Error(`update sistema_pedidos: ${error.message}`);
          pedidoId = existing.id;
          summary.updated += 1;
        } else {
          const numero = `CM-${payload.calcme_order_idint ?? calcmeOrderId}`;
          const { data: inserted, error } = await supabase
            .from("sistema_pedidos")
            .insert({
              ...payload,
              numero,
              status: "producao", // status do fluxo Gift Web; o do Calcme fica em calcme_status
              prazo_producao_dias: 15,
              ...(dataPedido ? { created_at: dataPedido } : {}),
            })
            .select("id")
            .single();
          if (error) throw new Error(`insert sistema_pedidos: ${error.message}`);
          pedidoId = inserted.id;
          summary.imported += 1;
        }

        // ---- Itens (upsert por calcme_item_id) + remoção de itens sumidos --
        const seenItemIds: string[] = [];
        for (const it of rawItems) {
          const calcmeItemId = String(it?.id ?? "");
          if (!calcmeItemId) continue;
          seenItemIds.push(calcmeItemId);
          const qtd = Number(it?.quantidade ?? 0) || 0;
          const vUnit = Number(it?.valorUnit ?? 0) || 0;
          const itemRow = {
            pedido_id: pedidoId,
            item_id: stableId.get(calcmeItemId) ?? null,
            calcme_item_id: calcmeItemId,
            calcme_item_idint: Number.isInteger(it?.idInt) ? it.idInt : null,
            calcme_produto_id: it?.produtoId ? String(it.produtoId) : null,
            calcme_produto_idint: Number.isInteger(it?.produtoIdInt) ? it.produtoIdInt : null,
            nome: String(it?.produtoNome ?? "Item sem nome"),
            descricao: it?.descricao ?? it?.descricaoPersonalizacao ?? null,
            observacoes: it?.observacao ?? it?.observacoes ?? null,
            quantidade: qtd,
            valor_unitario: vUnit,
            valor_total: Number(it?.valorTotal ?? qtd * vUnit) || 0,
            raw: it,
            updated_at: new Date().toISOString(),
          };
          const { data: upItem, error: itemErr } = await supabase
            .from("sistema_calcme_itens")
            .upsert(itemRow, { onConflict: "calcme_item_id" })
            .select("id")
            .single();
          if (itemErr) throw new Error(`upsert item ${calcmeItemId}: ${itemErr.message}`);

          // ---- Metadados dos arquivos anexados ao item (sem download) ------
          const arquivos: any[] = Array.isArray(it?.arquivos) ? it.arquivos : [];
          for (const arq of arquivos) {
            const fileHash = String(arq?.hash ?? "");
            if (!fileHash) continue;
            const { error: arqErr } = await supabase
              .from("sistema_calcme_item_arquivos")
              .upsert(
                {
                  item_id: upItem.id,
                  pedido_id: pedidoId,
                  calcme_item_id: calcmeItemId,
                  file_name: arq?.nome ? String(arq.nome) : null,
                  file_hash: fileHash,
                  categoria: arq?.categoria ? String(arq.categoria) : null,
                  is_operation_file: Boolean(arq?.op),
                  is_order_file: Boolean(arq?.ped),
                  is_production_file: Boolean(arq?.pro),
                  raw: arq,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "item_id,file_hash" },
              );
            if (arqErr) throw new Error(`upsert arquivo ${fileHash}: ${arqErr.message}`);
          }
        }
        if (seenItemIds.length > 0) {
          await supabase
            .from("sistema_calcme_itens")
            .delete()
            .eq("pedido_id", pedidoId)
            .not("calcme_item_id", "in", `(${seenItemIds.map((s) => `"${s}"`).join(",")})`);
        }
      } catch (e) {
        summary.errors += 1;
        detalhes.erros.push({ pedido: ref, erro: (e as Error).message });
      }
    }

    // ---- 4) Log da sincronização -------------------------------------------
    const status = summary.errors > 0 ? "partial" : "success";
    await supabase.from("sistema_calcme_sync_log").insert({
      status,
      found: summary.found,
      imported: summary.imported,
      updated: summary.updated,
      ignored: summary.ignored,
      errors: summary.errors,
      detalhes,
    });

    return json({
      ...summary,
      detalhes: (detalhes.erros.length || detalhes.avisos.length) ? detalhes : undefined,
      debug: debugIdInt !== null ? (debugEntry ?? { idInt: debugIdInt, encontradoNaListagem: false }) : undefined,
    });
  } catch (e) {
    // Erro fatal (API fora, autenticação recusada etc.)
    await supabase.from("sistema_calcme_sync_log").insert({
      status: "error",
      found: summary.found,
      imported: summary.imported,
      updated: summary.updated,
      ignored: summary.ignored,
      errors: summary.errors + 1,
      detalhes: { erros: [{ pedido: "-", erro: (e as Error).message }], avisos: detalhes.avisos },
    });
    return json(
      { ...summary, success: false, error: (e as Error).message },
      500,
    );
  }
});
