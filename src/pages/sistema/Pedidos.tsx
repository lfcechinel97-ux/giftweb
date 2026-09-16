import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, SlidersHorizontal, Printer, Trash2, Copy, MoreHorizontal, Pencil,
  ChevronLeft, ChevronRight, X, ShoppingCart, RefreshCw, Plus, ArrowRight,
  CalendarDays, CreditCard, User as UserIcon, CheckCircle2, CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Thumb, StatusBadge } from "@/components/sistema/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusInfo, opcoesStatus } from "@/lib/statusPedido";
import { useSistema, clienteDisplay, type Pedido } from "@/contexts/SistemaContext";
import { supabase } from "@/integrations/supabase/client";
import { gerarOrdemProducaoPDF } from "./ordemProducaoPDF";

type PedidoStatus = Pedido["status"];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const dateBR = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHoraBR = (iso: string) => {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString("pt-BR"),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
};

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Abas do topo. Cada uma agrupa várias etapas pela COLUNA do PCP — assim um
 * status novo criado em Configurações já cai na aba certa, sem tocar aqui.
 */
const ABAS = [
  { id: "todos",      rotulo: "Todos",         colunas: null },
  { id: "produzir",   rotulo: "A produzir",    colunas: ["organizando_pedido", "pronto_producao", "teste_fisico", "preparacao"] },
  { id: "producao",   rotulo: "Em produção",   colunas: ["em_producao"] },
  { id: "transporte", rotulo: "Em transporte", colunas: ["embalagem_pagamento", "aguardando_coleta"] },
  { id: "entregues",  rotulo: "Entregues",     colunas: ["enviado"] },
  { id: "cancelados", rotulo: "Cancelados",    colunas: ["cancelado"] },
] as const;

type AbaId = typeof ABAS[number]["id"];

const colunasDaAba = (id: AbaId) => ABAS.find(a => a.id === id)?.colunas ?? null;

/** Linha ícone + texto da coluna de identificação. */
const Linha = ({
  icone: Icone, children, tom,
}: { icone: typeof CalendarDays; children: React.ReactNode; tom?: string }) => (
  <span className="flex items-center gap-2 min-w-0">
    <Icone className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--gw-text-muted)" }} />
    <span className="text-[13px] truncate" style={{ color: tom || "var(--gw-text)" }}>
      {children}
    </span>
  </span>
);

/** Rótulo pequeno sobre o número, nas colunas de Qtd/Unit./Total do item. */
const Numero = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <span className="flex flex-col items-end gap-0.5">
    <span className="gw-label">{rotulo}</span>
    {children}
  </span>
);

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Pedidos() {
  const navigate = useNavigate();
  const {
    pedidos, pedidosTotal, updatePedido, clientes, vendedores, meiosPagamento,
    refreshPedidos, ensureClientes,
  } = useSistema();

  useEffect(() => { void ensureClientes(); }, [ensureClientes]);

  const [searchParams] = useSearchParams();
  const [busca, setBusca] = useState(() => searchParams.get("busca") || "");

  const [aba, setAba] = useState<AbaId>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [criandoPedido, setCriandoPedido] = useState(false);

  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { data: lastCalcmeSync } = useQuery({
    queryKey: ["sistema", "calcme", "last-sync"],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("sistema_calcme_sync_log")
        .select("synced_at,imported,updated,ignored,errors")
        .order("synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const handleSyncCalcme = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-calcme-orders");
      if (error) throw error;
      const r = data as { success: boolean; imported?: number; updated?: number; ignored?: number; errors?: number; error?: string } | null;
      if (!r?.success) toast.error(`Sincronização Calcme falhou: ${r?.error || "erro desconhecido"}`);
      else toast.success(`Calcme: ${r.imported} importados, ${r.updated} atualizados, ${r.ignored} ignorados.`);
      await qc.invalidateQueries({ queryKey: ["sistema", "calcme", "last-sync"] });
      await qc.invalidateQueries({ queryKey: ["sistema", "pedidos"] });
      await refreshPedidos({ status: filtroStatus, search: busca, dataInicio: dataInicio || null, dataFim: dataFim || null, page, pageSize });
    } catch (e: unknown) {
      toast.error(`Sincronização Calcme falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  /* Contagem por aba. Traz SÓ a coluna status — a agregação por coluna do PCP
     não existe no PostgREST. Quando o volume crescer isso deve virar um
     `count(*) group by` dentro de sistema_list_pedidos. */
  const { data: contagens = {} } = useQuery<Record<AbaId, number>>({
    queryKey: ["sistema", "pedidos", "contagem-abas"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("sistema_pedidos").select("status");
      const zero = Object.fromEntries(ABAS.map(a => [a.id, 0])) as Record<AbaId, number>;
      if (error || !data) return zero;
      for (const r of data as { status: string }[]) {
        const coluna = statusInfo(r.status).colunaPcp;
        zero.todos += 1;
        for (const a of ABAS) {
          if (a.colunas && (a.colunas as readonly string[]).includes(coluna)) zero[a.id] += 1;
        }
      }
      return zero;
    },
  });

  /* Status de produção por item, só dos pedidos da página. */
  const pedidoIds = useMemo(() => pedidos.map(p => p.id).sort(), [pedidos]);
  const producaoKey = useMemo(() => ["sistema", "pedidos", "producao", pedidoIds] as const, [pedidoIds]);

  const { data: producao } = useQuery({
    queryKey: producaoKey,
    enabled: pedidoIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sistema_producao_itens")
        .select("pedido_id,item_id,status,pagamento_ok")
        .in("pedido_id", pedidoIds);
      const vazio = {
        porItem: {} as Record<string, string>,
        pagamento: {} as Record<string, { ok: number; total: number }>,
      };
      if (error || !data) return vazio;

      const porItem: Record<string, string> = {};
      const pagamento: Record<string, { ok: number; total: number }> = {};
      for (const r of data as { pedido_id: string; item_id: string; status: string; pagamento_ok: boolean }[]) {
        porItem[r.item_id] = r.status;
        const acc = pagamento[r.pedido_id] ?? { ok: 0, total: 0 };
        acc.total += 1;
        if (r.pagamento_ok) acc.ok += 1;
        pagamento[r.pedido_id] = acc;
      }
      return { porItem, pagamento };
    },
  });

  const statusDoItem = (itemId?: string) => (itemId ? producao?.porItem[itemId] : undefined);

  /* "Pago" / "Parcial" não existem como campo no pedido. São derivados do
     gate de pagamento que o PCP já marca por item (pagamento_ok). */
  const situacaoPagamento = (pedidoId: string) => {
    const p = producao?.pagamento[pedidoId];
    if (!p || p.total === 0) return null;
    if (p.ok === 0) return { texto: "Pendente", cor: "var(--gw-text-muted)", pago: false };
    if (p.ok === p.total) return { texto: "Pago", cor: "var(--gw-success)", pago: true };
    return { texto: "Parcial", cor: "var(--gw-warning)", pago: false };
  };

  const alterarStatusItem = async (pedidoId: string, itemId: string, slug: string) => {
    const anterior = producao?.porItem[itemId];
    qc.setQueryData(producaoKey, (old: typeof producao) =>
      old ? { ...old, porItem: { ...old.porItem, [itemId]: slug } } : old);

    const { error } = await supabase
      .from("sistema_producao_itens")
      .update({ status: slug })
      .eq("pedido_id", pedidoId)
      .eq("item_id", itemId);

    if (error) {
      qc.setQueryData(producaoKey, (old: typeof producao) =>
        old ? { ...old, porItem: { ...old.porItem, [itemId]: anterior ?? "" } } : old);
      toast.error(`Não foi possível mudar a etapa do item. ${error.message || ""}`);
    }
  };

  const getClienteNome = (p: Pedido) => {
    const c = clientes.find(cli => cli.id === p.clienteId);
    const nome = clienteDisplay(c);
    if (nome !== "—") return nome;
    return p.clienteSnapshot?.nome || p.contatoNome || "—";
  };

  const getVendedorNome = (p: Pedido) =>
    vendedores.find(v => v.id === p.vendedorId)?.nome || p.calcmeVendedorNome || null;

  const getPagamentoNome = (p: Pedido) =>
    meiosPagamento.find(m => m.id === p.pagamentoId)?.nome || null;

  /* Busca no SERVIDOR: filtros aplicados antes do recorte da página. */
  const [listLoading, setListLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setListLoading(true);
      try {
        await refreshPedidos({
          status: filtroStatus, search: busca,
          dataInicio: dataInicio || null, dataFim: dataFim || null,
          page, pageSize,
        });
      } catch { /* erro já reportado pelo contexto */ }
      finally { if (!cancelled) setListLoading(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [busca, filtroStatus, dataInicio, dataFim, page, pageSize, refreshPedidos]);

  /* A aba filtra a página já carregada — não é filtro de servidor, porque
     agrupa várias etapas e o backend só entende um status por vez. */
  const visiveis = useMemo(() => {
    const colunas = colunasDaAba(aba);
    if (!colunas) return pedidos;
    return pedidos.filter(p => (colunas as readonly string[]).includes(statusInfo(p.status).colunaPcp));
  }, [pedidos, aba]);

  const totalPages = Math.max(1, Math.ceil(pedidosTotal / pageSize));
  useEffect(() => { setPage(1); }, [busca, filtroStatus, dataInicio, dataFim, pageSize, aba]);
  const currentPage = Math.min(page, totalPages);
  const pageNumbers: (number | null)[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const nums = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: (number | null)[] = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push(null);
      out.push(n);
    });
    return out;
  })();

  const handleNovoPedido = async () => {
    setCriandoPedido(true);
    try {
      const { data: numero, error: errNum } = await supabase.rpc("sistema_next_pedido_numero");
      if (errNum) throw errNum;
      const { data, error } = await supabase
        .from("sistema_pedidos")
        .insert({ numero: numero as unknown as string, itens: [], status: "organizando_anotacoes" })
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/sistema/pedidos/${data.id}`);
    } catch (e: unknown) {
      toast.error(`Não foi possível criar o pedido. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCriandoPedido(false);
    }
  };

  const handlePrintPDF = (p: Pedido) => gerarOrdemProducaoPDF(p, { clientes, vendedores, transportadoras: [] });

  const handleCopiarNumero = async (p: Pedido) => {
    try {
      await navigator.clipboard.writeText(String(p.numero));
      toast.success(`Número ${p.numero} copiado.`);
    } catch { toast.error("Não foi possível copiar."); }
  };

  const itemTotal = (i: { total?: number; quantidade?: number; precoUnitario?: number }) =>
    num(i.total) || num(i.quantidade) * num(i.precoUnitario);

  const prazoVencido = (iso: string, status: string) => {
    const coluna = statusInfo(status).colunaPcp;
    if (coluna === "enviado" || coluna === "cancelado") return false;
    return new Date(`${iso.slice(0, 10)}T23:59:59`).getTime() < Date.now();
  };

  const chips: { key: string; label: string; clear: () => void }[] = [
    busca ? { key: "busca", label: `Busca: ${busca}`, clear: () => setBusca("") } : null,
    filtroStatus !== "todos" ? { key: "status", label: `Status: ${statusInfo(filtroStatus).nome}`, clear: () => setFiltroStatus("todos") } : null,
    dataInicio ? { key: "de", label: `De: ${dateBR(dataInicio)}`, clear: () => setDataInicio("") } : null,
    dataFim ? { key: "ate", label: `Até: ${dateBR(dataFim)}`, clear: () => setDataFim("") } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="space-y-4">
      {/* Painel de controle — titulo, abas e filtros num cartao branco so,
          para o topo da pagina ter o mesmo peso dos cartoes da lista. */}
      <div
        className="flex flex-col"
        style={{
          background: "var(--gw-surface)",
          border: "1px solid var(--gw-border)",
          borderRadius: "var(--gw-radius-lg)",
          boxShadow: "var(--gw-shadow-sm)",
        }}
      >
      <div className="flex items-start justify-between gap-4 flex-wrap" style={{ padding: "var(--gw-pad-card)", paddingBottom: 12 }}>
        <div>
          <h2 className="gw-display" style={{ fontSize: 28 }}>Pedidos</h2>
          <p className="gw-meta">Pedidos gerados a partir de orçamentos aprovados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncCalcme}
            disabled={syncing}
            title={lastCalcmeSync ? `Última sincronização: ${new Date(lastCalcmeSync.synced_at).toLocaleString("pt-BR")}` : undefined}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[10px] text-[13px] font-semibold disabled:opacity-60"
            style={{ border: "1px solid var(--gw-border)", color: "var(--gw-text-secondary)" }}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Calcme"}
          </button>
          <button
            type="button"
            onClick={handleNovoPedido}
            disabled={criandoPedido}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] text-[14px] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--gw-blue-vivid)", boxShadow: "0 2px 8px rgba(37,99,235,.28)" }}
          >
            <Plus className="h-4 w-4" />
            {criandoPedido ? "Criando..." : "Novo pedido"}
          </button>
        </div>
      </div>

      {/* Abas por etapa */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{ paddingLeft: "var(--gw-pad-card)", paddingRight: "var(--gw-pad-card)", borderBottom: "1px solid var(--gw-border)" }}
      >
        {ABAS.map(a => {
          const ativa = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className="inline-flex items-center gap-2 h-10 px-3.5 text-[14px] whitespace-nowrap transition-colors"
              style={{
                color: ativa ? "var(--gw-primary)" : "var(--gw-text-secondary)",
                fontWeight: ativa ? 600 : 500,
                borderBottom: `2px solid ${ativa ? "var(--gw-primary)" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {a.rotulo}
              <span
                className="gw-contador inline-flex items-center justify-center h-[22px] min-w-[22px] px-2 rounded-full"
                style={{
                  background: ativa ? "var(--gw-primary-soft)" : "var(--gw-surface-alt)",
                  color: ativa ? "var(--gw-primary)" : "var(--gw-text-muted)",
                }}
              >
                {contagens[a.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2" style={{ padding: "var(--gw-pad-card)" }}>
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
          <Input
            placeholder="Buscar por cliente, nº do pedido ou produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-10 w-[190px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {opcoesStatus("pedido").map(s => (
              <SelectItem key={s.slug} value={s.slug}>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: s.cor }} />
                  {s.nome}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="Data inicial" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-10 w-[150px]" />
        <ArrowRight className="h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
        <Input type="date" aria-label="Data final" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-10 w-[150px]" />

        {/* Limpa tudo de uma vez. Só fica ativo quando há o que limpar —
            um botão "Filtros" que abre um painel vazio seria pior que nada. */}
        <button
          type="button"
          onClick={() => { setBusca(""); setFiltroStatus("todos"); setDataInicio(""); setDataFim(""); setAba("todos"); }}
          disabled={chips.length === 0 && aba === "todos"}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[10px] text-[13.5px] font-medium disabled:opacity-40"
          style={{ border: "1px solid var(--gw-border)", color: "var(--gw-text-secondary)" }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {chips.length > 0 ? "Limpar filtros" : "Filtros"}
        </button>

        <span className="gw-meta w-full text-right lg:w-auto lg:ml-auto">
          {listLoading ? "Atualizando..." : `${pedidosTotal} pedido(s) • página ${currentPage} de ${totalPages}`}
        </span>
      </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => (
            <button key={c.key} type="button" onClick={c.clear}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium"
              style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}>
              {c.label}<X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-4">
        {visiveis.length === 0 ? (
          <div className="rounded-[12px] p-14 text-center gw-meta" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)" }}>
            <ShoppingCart className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--gw-text-muted)" }} />
            {pedidos.length === 0
              ? "Nenhum pedido ainda. Use “Novo pedido” ou aprove um orçamento."
              : "Nenhum pedido nesta aba para o filtro atual."}
          </div>
        ) : visiveis.map(p => {
          const itens = Array.isArray(p.itens) ? p.itens : [];
          const info = statusInfo(p.status);
          const despachar = p.dataDespacharAte ?? addDays(p.createdAt, p.prazoProducaoDias ?? 15);
          const atrasado = prazoVencido(despachar, p.status);
          const criado = dataHoraBR(p.createdAt);
          const pgto = situacaoPagamento(p.id);
          const meioPgto = getPagamentoNome(p);
          const vendedor = getVendedorNome(p);

          return (
            <div
              key={p.id}
              className="grid grid-cols-[312px_minmax(0,1fr)_262px] overflow-hidden"
              style={{
                background: "var(--gw-surface)",
                border: "1px solid var(--gw-border)",
                borderRadius: "var(--gw-radius-lg)",
                boxShadow: "var(--gw-shadow-sm)",
              }}
            >
              {/* ── Coluna 1: identificação ─────────────────────────────── */}
              <div
                className="relative flex flex-col gap-3"
                style={{ padding: "var(--gw-pad-card)", borderRight: "1px solid var(--gw-hairline)" }}
              >
                {/* Barra da etapa — a cor do status também marca a lateral */}
                <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: info.cor }} />

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="gw-num text-[15px]" style={{ color: "var(--gw-text)", fontWeight: 700 }}>
                    {p.numero}
                  </span>
                  <StatusBadge
                    status={p.status}
                    nivel="pedido"
                    size="sm"
                    onSelect={slug => updatePedido(p.id, { status: slug as PedidoStatus })}
                  />
                </div>

                <span className="gw-title text-[17px] leading-tight truncate" style={{ fontWeight: 700 }}>
                  {getClienteNome(p)}
                </span>

                <div className="flex flex-col gap-1.5 mt-0.5">
                  <Linha icone={CalendarDays}>
                    <span className="gw-tnum">{criado.data}</span>
                    <span className="gw-tnum ml-1.5" style={{ color: "var(--gw-text-muted)" }}>{criado.hora}</span>
                    <span className="ml-1.5 gw-meta">Pedido</span>
                  </Linha>

                  <Linha icone={CalendarDays} tom={atrasado ? "var(--gw-danger)" : undefined}>
                    <span className="gw-tnum" style={{ fontWeight: atrasado ? 700 : 500 }}>{dateBR(despachar)}</span>
                    <span className="ml-1.5 gw-meta">Despachar até</span>
                  </Linha>

                  {meioPgto && (
                    <Linha icone={CreditCard}>
                      {meioPgto}
                      {pgto && (
                        <span
                          className="inline-flex items-center gap-1 ml-2 h-[20px] px-2 rounded-full text-[11px] font-semibold align-middle"
                          style={{ background: `color-mix(in srgb, ${pgto.cor} 12%, #FFF)`, color: pgto.cor }}
                        >
                          {pgto.pago ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                          {pgto.texto}
                        </span>
                      )}
                    </Linha>
                  )}

                  {vendedor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center justify-center h-7 w-7 rounded-full cursor-default shrink-0 self-start"
                          style={{ background: "var(--gw-blue-soft)", color: "var(--gw-blue-deep)" }}
                          aria-label={`Vendedor: ${vendedor}`}
                        >
                          <UserIcon className="h-[15px] w-[15px]" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">{vendedor}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* ── Coluna 2: itens ─────────────────────────────────────── */}
              <div className="flex flex-col" style={{ background: "var(--gw-surface)" }}>
                {itens.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-8 gw-meta">
                    Nenhum item neste pedido. Abra “Editar pedido” para adicionar.
                  </div>
                ) : itens.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="px-4 py-2.5"
                    style={{ borderTop: idx === 0 ? undefined : "2px solid var(--gw-bg)" }}
                  >
                    {/* max-w puxa o bloco numérico para perto do produto. Sem
                        ele, o nome ocupa toda a sobra e os números vão parar na
                        borda do cartão, longe do que descrevem. A régua acima
                        continua na largura cheia. */}
                    <div className="grid grid-cols-[104px_minmax(0,1fr)_84px_116px_140px] items-center gap-3 max-w-[790px]">
                    <Thumb size="lg" className="!h-[104px] !w-[104px] !rounded-[12px]" src={item.mockupImagem || item.imagem} alt={item.nome} />

                    <span className="flex flex-col min-w-0 gap-1">
                      <span className="gw-title text-[14.5px] truncate" style={{ fontWeight: 700 }}>{item.nome}</span>
                      {item.observacao && (
                        <span className="text-[12.5px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
                          {item.observacao}
                        </span>
                      )}
                      <span onClick={e => e.stopPropagation()}>
                        <StatusBadge
                          status={statusDoItem(item.id)}
                          nivel="item"
                          size="sm"
                          onSelect={slug => alterarStatusItem(p.id, item.id, slug)}
                        />
                      </span>
                    </span>

                    <Numero rotulo="Qtd">
                      <span className="gw-qtd">{num(item.quantidade)}</span>
                    </Numero>
                    <Numero rotulo="Unit.">
                      <span className="gw-valor-sm">{brl(num(item.precoUnitario))}</span>
                    </Numero>
                    <Numero rotulo="Total">
                      <span className="gw-valor">{brl(itemTotal(item))}</span>
                    </Numero>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Coluna 3: total e ações ─────────────────────────────── */}
              <div
                className="flex flex-col gap-3"
                style={{ padding: "var(--gw-pad-card)", borderLeft: "1px solid var(--gw-hairline)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="gw-label">Total do pedido</span>
                    <span className="gw-valor-xl">{brl(num(p.total))}</span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Mais ações"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-colors hover:bg-[var(--gw-surface-alt)]"
                        style={{ color: "var(--gw-text-secondary)" }}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => handleCopiarNumero(p)}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Copiar número
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrintPDF(p)}>
                        <Printer className="h-3.5 w-3.5 mr-2" /> Ordem de produção
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updatePedido(p.id, { status: "cancelado" })} style={{ color: "var(--gw-danger)" }}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancelar pedido
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/sistema/pedidos/${p.id}`)}
                  className="inline-flex items-center justify-center gap-2 h-11 rounded-[10px] text-[14px] font-semibold text-white transition-colors"
                  style={{ background: "var(--gw-blue-vivid)" }}
                >
                  Ver detalhes <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/sistema/pedidos/${p.id}`)}
                  className="inline-flex items-center justify-center gap-2 h-11 rounded-[10px] text-[14px] font-medium transition-colors"
                  style={{ background: "var(--gw-blue-soft)", color: "var(--gw-blue-deep)" }}
                >
                  <Pencil className="h-4 w-4" /> Editar pedido
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {pedidos.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
          <span />
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
              className="inline-flex items-center justify-center h-9 w-9 rounded-[8px] disabled:opacity-40"
              style={{ border: "1px solid var(--gw-border)", color: "var(--gw-primary)" }} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((n, i) => n === null ? (
              <span key={`gap-${i}`} className="gw-meta px-1">…</span>
            ) : (
              <button key={n} type="button" onClick={() => setPage(n)}
                className="inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-[8px] text-[13px] font-semibold"
                style={n === currentPage
                  ? { background: "var(--gw-primary)", color: "#fff" }
                  : { border: "1px solid var(--gw-border)", color: "var(--gw-text-secondary)" }}>
                {n}
              </button>
            ))}
            <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
              className="inline-flex items-center justify-center h-9 w-9 rounded-[8px] disabled:opacity-40"
              style={{ border: "1px solid var(--gw-border)", color: "var(--gw-primary)" }} aria-label="Próxima página">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="gw-label">Por página</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-9 w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
