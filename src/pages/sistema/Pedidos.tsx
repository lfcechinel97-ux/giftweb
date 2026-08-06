import { useEffect, useMemo, useState } from "react";
import {
  Search, Filter, Printer, Trash2, Copy, MoreHorizontal, ChevronDown,
  ChevronLeft, ChevronRight, X, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderNumber, MetaField, Thumb, Money } from "@/components/sistema/ui";
import { useSistema, clienteDisplay, type Pedido } from "@/contexts/SistemaContext";
import { supabase } from "@/integrations/supabase/client";
import { gerarOrdemProducaoPDF } from "./ordemProducaoPDF";

/* ── Status ──────────────────────────────────────────────────────────────── */

type PedidoStatus = Pedido["status"];

const STATUS_OPTS: PedidoStatus[] = ["novo", "producao", "pronto", "enviado", "entregue", "cancelado"];

const STATUS_LABEL: Record<PedidoStatus, string> = {
  novo: "Novo",
  producao: "Em produção",
  pronto: "Pronto",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Cor cheia (sólida) de cada etapa — nunca cinza sobre cinza. */
const STATUS_SOLID: Record<PedidoStatus, string> = {
  novo: "var(--gw-indigo)",
  producao: "var(--gw-stage-producao)",
  pronto: "var(--gw-stage-pronto)",
  enviado: "var(--gw-stage-enviado)",
  entregue: "var(--gw-success)",
  cancelado: "var(--gw-stage-cancelado)",
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const dateBR = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const waLink = (tel: string) => {
  const d = onlyDigits(tel);
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Pedidos() {
  const { pedidos, updatePedido, clientes, vendedores, transportadoras } = useSistema();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prazoDraft, setPrazoDraft] = useState<Record<string, string>>({});
  const [progresso, setProgresso] = useState<Record<string, { enviados: number; total: number }>>({});

  /* Progresso de produção (sistema_producao_itens) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sistema_producao_itens")
        .select("pedido_id,status");
      if (cancelled || error || !data) return;
      const acc: Record<string, { enviados: number; total: number }> = {};
      for (const r of data as { pedido_id: string; status: string }[]) {
        const e = acc[r.pedido_id] ?? { enviados: 0, total: 0 };
        e.total += 1;
        if (r.status === "expedido" || r.status === "enviado_terceiro") e.enviados += 1;
        acc[r.pedido_id] = e;
      }
      setProgresso(acc);
    })();
    return () => { cancelled = true; };
  }, [pedidos.length]);

  const getClienteNome = (p: Pedido) => {
    const c = clientes.find(cli => cli.id === p.clienteId);
    const nome = clienteDisplay(c);
    if (nome !== "—") return nome;
    return p.clienteSnapshot?.nome || "—";
  };

  const getVendedorNome = (id?: string) => vendedores.find(v => v.id === id)?.nome || "—";
  const getTransportadoraNome = (id?: string) => transportadoras.find(t => t.id === id)?.nome || "—";

  const filtered = useMemo(() => {
    return pedidos
      .filter(p => {
        if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
        if (dataInicio || dataFim) {
          const d = new Date(p.createdAt);
          if (dataInicio && d < new Date(`${dataInicio}T00:00:00`)) return false;
          if (dataFim && d > new Date(`${dataFim}T23:59:59`)) return false;
        }
        if (busca.trim()) {
          const t = busca.toLowerCase();
          const matchNum = String(p.numero).toLowerCase().includes(t);
          const matchCliente = getClienteNome(p).toLowerCase().includes(t);
          const matchItem = (p.itens || []).some(i =>
            (i.nome || "").toLowerCase().includes(t) ||
            (i.codigoComposto || "").toLowerCase().includes(t)
          );
          if (!matchNum && !matchCliente && !matchItem) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pedidos, busca, filtroStatus, dataInicio, dataFim, clientes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [busca, filtroStatus, dataInicio, dataFim, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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


  const handlePrintPDF = async (p: Pedido) => {
    await gerarOrdemProducaoPDF(p, { clientes, vendedores, transportadoras });
  };

  const handleCopiarNumero = async (p: Pedido) => {
    try {
      await navigator.clipboard.writeText(String(p.numero));
      toast.success(`Número ${p.numero} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const getDatas = (p: Pedido) => {
    const prazo = p.prazoProducaoDias ?? 15;
    const despachar = p.dataDespacharAte ?? addDays(p.createdAt, prazo);
    const produzir = p.dataProduzirAte ?? addDays(despachar, -2);
    return { prazo, despachar, produzir };
  };

  const commitPrazo = (p: Pedido, raw: string) => {
    const prazo = Math.max(0, parseInt(raw, 10) || 0);
    if (prazo === (p.prazoProducaoDias ?? 15)) return;
    const despachar = addDays(p.createdAt, prazo);
    updatePedido(p.id, {
      prazoProducaoDias: prazo,
      dataDespacharAte: despachar,
      dataProduzirAte: addDays(despachar, -2),
    });
    toast.success("Prazo de produção atualizado.");
  };

  const dateTone = (iso: string, status: PedidoStatus): "default" | "warning" | "danger" => {
    if (status === "entregue" || status === "enviado" || status === "cancelado") return "default";
    const diff = Math.ceil((new Date(`${iso.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86400000);
    if (diff < 0) return "danger";
    if (diff <= 2) return "warning";
    return "default";
  };

  const itemTotal = (i: { total?: number; quantidade?: number; precoUnitario?: number }) =>
    num(i.total) || num(i.quantidade) * num(i.precoUnitario);

  const chips: { key: string; label: string; clear: () => void }[] = [
    busca ? { key: "busca", label: `Busca: ${busca}`, clear: () => setBusca("") } : null,
    filtroStatus !== "todos"
      ? { key: "status", label: `Status: ${STATUS_LABEL[filtroStatus as PedidoStatus]}`, clear: () => setFiltroStatus("todos") }
      : null,
    dataInicio ? { key: "de", label: `De: ${dateBR(dataInicio)}`, clear: () => setDataInicio("") } : null,
    dataFim ? { key: "ate", label: `Até: ${dateBR(dataFim)}`, clear: () => setDataFim("") } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="gw-display">Pedidos</h2>
          <p className="gw-meta">Pedidos gerados a partir de orçamentos aprovados.</p>
        </div>
        <span className="gw-meta">{filtered.length} pedido(s)</span>
      </div>

      {/* Filtros */}
      <div
        className="rounded-[10px] p-3 flex flex-wrap items-center gap-2"
        style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)", boxShadow: "var(--gw-shadow-sm)" }}
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
          <Input
            placeholder="Buscar por cliente, nº ou produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-[180px]">
            <Filter className="h-4 w-4 mr-2" style={{ color: "var(--gw-text-muted)" }} />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTS.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="Data inicial" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 w-[140px]" />
        <Input type="date" aria-label="Data final" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 w-[140px]" />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium"
              style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-5">
        {filtered.length === 0 ? (
          <div className="rounded-[10px] p-12 text-center gw-meta" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)" }}>
            <ShoppingCart className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--gw-text-muted)" }} />
            {pedidos.length === 0
              ? "Aprove um orçamento para criar pedidos automaticamente."
              : "Nenhum pedido encontrado para o filtro atual."}
          </div>
        ) : pageItems.map(p => {
          const itens = Array.isArray(p.itens) ? p.itens : [];
          const prog = progresso[p.id];
          const { prazo, despachar, produzir } = getDatas(p);
          const subtotal = itens.length > 0
            ? itens.reduce((s, i) => s + itemTotal(i), 0)
            : num(p.subtotal);
          const total = subtotal + num(p.freteValor);

          return (
            <div
              key={p.id}
              className="rounded-[12px] overflow-hidden"
              style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)", boxShadow: "var(--gw-shadow-sm)" }}
            >
              {/* Cabeçalho do pedido */}
              <div
                className="grid grid-cols-[88px_1fr_100px_150px_120px_120px] items-center gap-3 px-4 h-[56px]"
                style={{ background: "var(--gw-surface-alt)", borderBottom: "1px solid var(--gw-border)" }}
              >
                <OrderNumber value={p.numero} />

                <span className="flex flex-col min-w-0">
                  <span className="gw-title truncate text-[15px]" style={{ fontWeight: 700 }}>
                    {getClienteNome(p)}
                  </span>
                  {itens.length > 1 && prog && prog.total > 0 && (
                    <span className="gw-meta">{prog.enviados}/{prog.total} itens enviados</span>
                  )}
                </span>

                <span className="gw-meta">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>

                {/* StatusPill sólido clicável */}
                <div onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-[26px] px-[12px] rounded-full text-[12px] whitespace-nowrap text-white"
                        style={{ background: STATUS_SOLID[p.status], fontWeight: 700 }}
                      >
                        {STATUS_LABEL[p.status]}
                        <ChevronDown className="h-3.5 w-3.5 opacity-90" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {STATUS_OPTS.map(s => (
                        <DropdownMenuItem key={s} onClick={() => updatePedido(p.id, { status: s })}>
                          <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: STATUS_SOLID[s] }} />
                          {STATUS_LABEL[s]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <span className="text-right">
                  <Money value={num(p.total) || total} emphasis bold />
                </span>

                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label="Imprimir ordem de produção"
                    onClick={() => handlePrintPDF(p)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full"
                    style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Mais ações"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors hover:bg-[var(--gw-primary-soft)] hover:text-[var(--gw-primary)]"
                        style={{ color: "var(--gw-text-secondary)" }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleCopiarNumero(p)} style={{ color: "var(--gw-violet)" }}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Copiar número
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updatePedido(p.id, { status: "cancelado" })} style={{ color: "var(--gw-danger)" }}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancelar pedido
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Conteúdo do pedido (sempre visível) */}
              <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: "var(--gw-surface)" }}>
                  <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--gw-border)" }}>
                    <div className="min-w-[760px]">
                    <div
                      className="grid grid-cols-[176px_1fr_80px_110px_130px] items-center gap-3 px-3 h-9"
                      style={{ background: "var(--gw-primary-soft)" }}
                    >
                      <span />
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Produto</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Qtd</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Unit.</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Total</span>
                    </div>
                    {itens.length === 0 ? (
                      <div className="px-3 py-6 text-center gw-meta">Este pedido não possui itens registrados.</div>
                    ) : itens.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="grid grid-cols-[176px_1fr_80px_110px_130px] items-center gap-3 px-3 py-4"
                        style={{ background: idx % 2 === 1 ? "color-mix(in srgb, var(--gw-surface-alt) 40%, var(--gw-surface))" : "var(--gw-surface)" }}
                      >
                        <Thumb size="xl" src={item.mockupImagem || item.imagem} alt={item.nome} />
                        <span className="flex flex-col min-w-0 leading-tight">
                          <span className="gw-title text-[13px] truncate" style={{ fontWeight: 600 }}>{item.nome}</span>
                          {item.observacao && (
                            <span className="text-[12px] truncate" style={{ color: "var(--gw-text-secondary)" }}>{item.observacao}</span>
                          )}
                          {item.codigoComposto && (
                            <span className="gw-tnum text-[11px]" style={{ color: "var(--gw-text-secondary)" }}>{item.codigoComposto}</span>
                          )}
                        </span>
                        <span className="text-right gw-tnum text-[13px]" style={{ color: "var(--gw-text)" }}>{num(item.quantidade)}</span>
                        <span className="text-right"><Money value={num(item.precoUnitario)} /></span>
                        <span className="text-right"><Money value={itemTotal(item)} emphasis /></span>
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* Totais */}
                  <div className="h-11 rounded-lg px-4 flex items-center justify-end gap-6" style={{ background: "var(--gw-primary-soft)" }}>
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Subtotal</span>
                      <Money value={subtotal} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>
                        Frete{p.freteTipo ? ` (${p.freteTipo})` : ""}
                      </span>
                      <Money value={num(p.freteValor)} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Total</span>
                      <Money value={num(p.total) || total} emphasis bold />
                    </span>
                  </div>

                  {/* Metadados */}
                  <div className="grid grid-cols-6 gap-4 items-start">
                    <MetaField label="Vendedor" value={getVendedorNome(p.vendedorId)} />
                    <MetaField label="Transportadora" value={getTransportadoraNome(p.transportadoraId)} />
                    <MetaField label="Criado em" value={new Date(p.createdAt).toLocaleDateString("pt-BR")} />
                    <MetaField
                      label="Despachar até"
                      value={dateBR(despachar)}
                      tone={dateTone(despachar, p.status)}
                    />
                    <div className="flex flex-col gap-[2px]">
                      <span className="gw-label">Prazo de produção</span>
                      <span className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={prazoDraft[p.id] ?? String(prazo)}
                          onChange={e => setPrazoDraft(d => ({ ...d, [p.id]: e.target.value }))}
                          onBlur={e => { commitPrazo(p, e.target.value); setPrazoDraft(d => { const n = { ...d }; delete n[p.id]; return n; }); }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="h-8 w-[56px] rounded-md px-2 gw-tnum text-[13px]"
                          style={{ border: "1px solid var(--gw-border)", color: "var(--gw-text)" }}
                        />
                        <span className="gw-meta">dias</span>
                      </span>
                      <span className="gw-meta">Produzir até {dateBR(produzir)}</span>
                    </div>
                    <div className="flex flex-col gap-[2px] min-w-0">
                      <span className="gw-label">Contato</span>
                      <span className="gw-body truncate" style={{ color: "var(--gw-text)" }}>
                        {p.contatoNome || "—"}
                      </span>
                      {p.contatoTelefone && (
                        <a
                          href={waLink(p.contatoTelefone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
                          style={{ color: "var(--gw-success)" }}
                        >
                          <img src="/logos/whatsapp-white.svg" alt="" width={14} height={14} />
                          {p.contatoTelefone}
                        </a>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
          <span />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md disabled:opacity-40"
              style={{ border: "1px solid var(--gw-border)", color: "var(--gw-primary)" }}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} className="gw-meta px-1">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className="inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-[13px] font-semibold"
                  style={
                    n === currentPage
                      ? { background: "var(--gw-primary)", color: "#fff" }
                      : { border: "1px solid var(--gw-border)", color: "var(--gw-text-secondary)" }
                  }
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md disabled:opacity-40"
              style={{ border: "1px solid var(--gw-border)", color: "var(--gw-primary)" }}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="gw-label">Por página</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-9 w-[84px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
