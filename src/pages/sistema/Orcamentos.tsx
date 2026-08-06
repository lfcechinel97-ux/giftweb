import { OrderNumber, StatusPill, MetaField, Thumb, Money, type GwStage } from "@/components/sistema/ui";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, Filter, Plus, Search, Trash2, FileText, Package, Printer, X, MoreHorizontal,
  Pencil, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSistema, formatBRL, calcSubtotal, calcTotal, clienteDisplay,
  type Orcamento, type OrcamentoStatus
} from "@/contexts/SistemaContext";
import { gerarPDFOrcamento } from "./pdf";

const STATUS_OPTS: OrcamentoStatus[] = ["aberto", "aprovado", "cancelado"];

const statusStyles: Record<OrcamentoStatus, { btn: string; dot: string; label: string }> = {
  "aberto":    { btn: "bg-blue-600 hover:bg-blue-700 text-white", dot: "bg-blue-400", label: "Aberto" },
  "aprovado":  { btn: "bg-green-600 hover:bg-green-700 text-white", dot: "bg-green-400", label: "Aprovado" },
  "cancelado": { btn: "bg-red-600 hover:bg-red-700 text-white",   dot: "bg-red-400",   label: "Cancelado" },
};

const STATUS_STAGE: Record<OrcamentoStatus, GwStage> = {
  "aberto": "pronto",
  "aprovado": "enviado",
  "cancelado": "cancelado",
};

const STATUS_SOLID: Record<OrcamentoStatus, string> = {
  "aberto": "var(--gw-indigo)",
  "aprovado": "var(--gw-success)",
  "cancelado": "var(--gw-danger)",
};



/* ─── Modal de confirmação de aprovação ─────────────────────────────────── */

interface AprovarModalProps {
  orcamento: Orcamento;
  onClose: () => void;
  onConfirm: (orcId: string, itens: { itemId: string; quantidade: number }[]) => void;
}

function AprovarModal({ orcamento, onClose, onConfirm }: AprovarModalProps) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>(
    () => Object.fromEntries(orcamento.itens.map(it => [it.id, true]))
  );
  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    () => Object.fromEntries(orcamento.itens.map(it => [it.id, it.quantidade]))
  );

  const toggleItem = (id: string) =>
    setSelecionados(prev => ({ ...prev, [id]: !prev[id] }));

  const setQtd = (id: string, val: number) =>
    setQuantidades(prev => ({ ...prev, [id]: Math.max(1, val) }));

  const itensSel = orcamento.itens.filter(it => selecionados[it.id]);
  const podeConfirmar = itensSel.length > 0;

  const handleConfirm = () => {
    onConfirm(
      orcamento.id,
      itensSel.map(it => ({ itemId: it.id, quantidade: quantidades[it.id] }))
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">Confirmar Aprovação</h2>
            <p className="text-sm text-gray-500">Orçamento {orcamento.numero} — selecione os itens e ajuste quantidades</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {orcamento.itens.map(it => (
            <div
              key={it.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selecionados[it.id] ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={!!selecionados[it.id]}
                onChange={() => toggleItem(it.id)}
                className="w-4 h-4 accent-green-600 cursor-pointer flex-shrink-0"
              />
              {(it.mockupImagem || it.imagem) ? (
                <img src={it.mockupImagem || it.imagem} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <Package className="w-10 h-10 p-2 text-gray-300 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.nome}</p>
                {it.codigoComposto && (
                  <p className="text-xs text-gray-400 font-mono">{it.codigoComposto}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" disabled={!selecionados[it.id]} onClick={() => setQtd(it.id, quantidades[it.id] - 1)}
                  className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30">−</button>
                <input
                  type="number" min="1" disabled={!selecionados[it.id]}
                  value={quantidades[it.id]}
                  onChange={e => setQtd(it.id, parseInt(e.target.value) || 1)}
                  className="w-14 text-center border rounded px-1 py-0.5 text-sm disabled:opacity-30"
                />
                <button type="button" disabled={!selecionados[it.id]} onClick={() => setQtd(it.id, quantidades[it.id] + 1)}
                  className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500">{itensSel.length} de {orcamento.itens.length} item(s) selecionado(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm">Cancelar</button>
            <button type="button" disabled={!podeConfirmar} onClick={handleConfirm}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              <Check className="w-4 h-4 inline mr-1" /> Confirmar Aprovação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Orcamentos() {
  const {
    orcamentos,
    removeOrcamento,
    updateOrcamento,
    aprovarOrcamento,
    clientes,
    vendedores,
    transportadoras,
    meiosPagamento,
    origens,
    currentVendedor,
    loading,
    refreshOrcamentos,
    fetchOrcamentoCompleto,
  } = useSistema();
  const navigate = useNavigate();
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroVendedor, setFiltroVendedor] = useState<string>(() => currentVendedor?.id || "todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aprovarOrc, setAprovarOrc] = useState<Orcamento | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (currentVendedor?.id) setFiltroVendedor(currentVendedor.id);
  }, [currentVendedor?.id]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setListLoading(true);
      try {
        await refreshOrcamentos({
          vendedorId: filtroVendedor === "todos" ? null : filtroVendedor,
          status: filtroStatus,
          search: filtroBusca,
          cliente: filtroCliente,
          limit: 300,
        });
      } catch {
        // Erro já exibido pelo contexto; mantém a lista anterior na tela.
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filtroVendedor, filtroStatus, filtroBusca, filtroCliente, refreshOrcamentos]);

  const filtered = useMemo(() => {
    return orcamentos.filter(o => {
      if (filtroVendedor !== "todos" && o.vendedorId !== filtroVendedor) return false;
      if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
      if (filtroCliente) {
        const c = clientes.find(cli => cli.id === o.clienteId);
        const nome = (clienteDisplay(c) !== "—" ? clienteDisplay(c) : (o.clienteSnapshot?.nome || "")).toLowerCase();
        if (!nome.includes(filtroCliente.toLowerCase())) return false;
      }
      if (dataInicio || dataFim) {
        const d = new Date(o.createdAt);
        if (dataInicio && d < new Date(`${dataInicio}T00:00:00`)) return false;
        if (dataFim && d > new Date(`${dataFim}T23:59:59`)) return false;
      }
      if (filtroBusca) {
        const term = filtroBusca.toLowerCase();
        const matchNumero = String(o.numero).includes(term);
        const matchCliente = (o.clienteSnapshot?.nome || "").toLowerCase().includes(term);
        const matchItem = o.itens.some(i =>
          i.nome.toLowerCase().includes(term) ||
          (i.codigoComposto || "").toLowerCase().includes(term)
        );
        if (!matchNumero && !matchCliente && !matchItem) return false;
      }
      return true;
    });
  }, [orcamentos, filtroCliente, filtroBusca, filtroStatus, filtroVendedor, clientes, dataInicio, dataFim]);

  // Usa o subtotal armazenado (a listagem leve não traz os itens em detalhe)
  const calcOrcTotal = (o: Orcamento) =>
    (o.itens.length > 0 ? calcSubtotal(o) : Number(o.subtotal || 0)) + (Number(o.freteValor) || 0);

  const valorTotalFiltrado = filtered.reduce((s, o) => s + calcOrcTotal(o), 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [filtroBusca, filtroCliente, filtroStatus, filtroVendedor, dataInicio, dataFim, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* Todos os orçamentos ficam abertos: carrega itens dos que estão na página */
  const fetchedItensRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    pageItems.forEach(o => {
      if (o.itens.length === 0 && !fetchedItensRef.current.has(o.id)) {
        fetchedItensRef.current.add(o.id);
        fetchOrcamentoCompleto(o.id);
      }
    });
  }, [pageItems]);

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

  const handleStatusChange = async (o: Orcamento, novo: OrcamentoStatus) => {
    if (novo === o.status) return;
    if (novo === "aprovado") { handleAprovar(o.id); return; }
    await updateOrcamento(o.id, { status: novo });
  };

  const ensureItens = async (o: Orcamento): Promise<Orcamento> => {
    if (o.itens.length > 0) return o;
    const full = await fetchOrcamentoCompleto(o.id);
    return full ?? o;
  };

  const handleAprovar = async (id: string) => {
    const orc = orcamentos.find(o => o.id === id);
    if (!orc) return;
    const full = await ensureItens(orc);
    setAprovarOrc(full);
  };

  const handleConfirmarAprovacao = (orcId: string, itensSelecionados: { itemId: string; quantidade: number }[]) => {
    const orc = orcamentos.find(o => o.id === orcId);
    if (!orc) return;
    const itensAprovados = orc.itens
      .filter(it => itensSelecionados.some(s => s.itemId === it.id))
      .map(it => {
        const sel = itensSelecionados.find(s => s.itemId === it.id)!;
        return { ...it, quantidade: sel.quantidade };
      });
    const orcModificado = { ...orc, itens: itensAprovados };
    aprovarOrcamento(orcModificado.id).then((p) => {
      if (p) toast.success(`Orçamento aprovado! Pedido ${p.numero} criado.`);
    });
    setAprovarOrc(null);
  };

  const handleDelete = (id: string) => {
    removeOrcamento(id);
    toast.success("Orçamento removido.");
    setDeleteId(null);
  };

  const handleImprimir = async (o: Orcamento) => {
    const full = await ensureItens(o);
    const cliente = clientes.find(c => c.id === full.clienteId);
    gerarPDFOrcamento(full, { clientes, vendedores, meiosPagamento, transportadoras, origens }, cliente?.nome);
  };

  const getClienteNome = (o: Orcamento) => {
    const c = clientes.find(cli => cli.id === o.clienteId);
    const nome = clienteDisplay(c);
    if (nome !== "—") return nome;
    return o.clienteSnapshot?.nome || "—";
  };

  const getVendedorNome = (vendedorId?: string) => {
    if (!vendedorId) return "—";
    const v = vendedores.find(v => v.id === vendedorId);
    return v?.nome || "—";
  };

  const getTransportadoraNome = (transportadoraId?: string) => {
    if (!transportadoraId) return "—";
    const t = transportadoras.find(tr => tr.id === transportadoraId);
    return t?.nome || "—";
  };

  const dateBR = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

  const addDays = (iso: string, days: number) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const getDatas = (o: Orcamento) => {
    const prazo = o.prazoProducaoDias ?? 15;
    const despachar = o.dataDespacharAte ?? addDays(o.createdAt, prazo);
    const produzir = o.dataProduzirAte ?? addDays(despachar, -2);
    return { produzir, despachar };
  };

  const dateTone = (iso: string, status: OrcamentoStatus): "default" | "warning" | "danger" => {
    if (status === "aprovado" || status === "cancelado") return "default";
    const target = new Date(`${iso.slice(0, 10)}T23:59:59`).getTime();
    const diff = Math.ceil((target - Date.now()) / 86400000);
    if (diff < 0) return "danger";
    if (diff <= 2) return "warning";
    return "default";
  };

  const chips: { key: string; label: string; clear: () => void }[] = [
    filtroBusca ? { key: "busca", label: `Busca: ${filtroBusca}`, clear: () => setFiltroBusca("") } : null,
    filtroCliente ? { key: "cliente", label: `Cliente: ${filtroCliente}`, clear: () => setFiltroCliente("") } : null,
    filtroStatus !== "todos" ? { key: "status", label: `Status: ${statusStyles[filtroStatus as OrcamentoStatus].label}`, clear: () => setFiltroStatus("todos") } : null,
    filtroVendedor !== "todos" ? { key: "vendedor", label: `Vendedor: ${getVendedorNome(filtroVendedor)}`, clear: () => setFiltroVendedor("todos") } : null,
    dataInicio ? { key: "de", label: `De: ${dateBR(dataInicio)}`, clear: () => setDataInicio("") } : null,
    dataFim ? { key: "ate", label: `Até: ${dateBR(dataFim)}`, clear: () => setDataFim("") } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="gw-display">Orçamentos</h2>
          <p className="gw-meta">Gerencie orçamentos e aprovações.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/sistema/orcamentos/novo")}
          className="inline-flex items-center h-9 px-4 rounded-md text-sm font-semibold text-white transition-colors"
          style={{ background: "var(--gw-primary)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--gw-primary-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--gw-primary)")}
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
        </button>
      </div>

      {/* Filtros */}
      <div
        className="rounded-[10px] p-3 flex flex-wrap items-center gap-2"
        style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)", boxShadow: "var(--gw-shadow-sm)" }}
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
          <Input
            placeholder="Buscar orçamento..."
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Input
          placeholder="Cliente..."
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          className="h-9 w-[200px]"
        />
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-[150px]">
            <Filter className="h-4 w-4 mr-2" style={{ color: "var(--gw-text-muted)" }} />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTS.map(s => (
              <SelectItem key={s} value={s}>{statusStyles[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {vendedores.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
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
        {(loading || listLoading) && filtered.length === 0 ? (
          <div className="rounded-[10px] p-12 text-center gw-meta" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)" }}>
            Carregando histórico de orçamentos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[10px] p-12 text-center gw-meta" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border)" }}>
            Nenhum orçamento. Clique em "Novo Orçamento".
          </div>
        ) : pageItems.map(o => {
          return (
            <div
              key={o.id}
              className="rounded-[12px] overflow-hidden"
              style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)", boxShadow: "var(--gw-shadow-sm)" }}
            >
              {/* Cabeçalho do orçamento */}
              <div
                className="grid grid-cols-[88px_1fr_100px_140px_120px_140px] items-center gap-3 px-4 h-[56px]"
                style={{ background: "var(--gw-surface-alt)", borderBottom: "1px solid var(--gw-border)" }}
              >
                <OrderNumber value={o.numero} />
                <span className="gw-title truncate text-[15px]" style={{ fontWeight: 700 }}>{getClienteNome(o)}</span>
                <span className="gw-meta">{new Date(o.createdAt).toLocaleDateString("pt-BR")}</span>
                <div onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-[26px] px-[12px] rounded-full text-[12px] whitespace-nowrap"
                        style={{
                          background: `color-mix(in srgb, ${STATUS_SOLID[o.status]} 12%, #FFFFFF)`,
                          color: STATUS_SOLID[o.status],
                          border: `1px solid color-mix(in srgb, ${STATUS_SOLID[o.status]} 30%, #FFFFFF)`,
                          fontWeight: 600,
                        }}
                      >
                        {o.status === "aprovado" && <Check className="h-3.5 w-3.5" />}
                        {statusStyles[o.status].label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      {STATUS_OPTS.map(s => (
                        <DropdownMenuItem key={s} onClick={() => handleStatusChange(o, s)}>
                          <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: STATUS_SOLID[s] }} />
                          {statusStyles[s].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="text-right">
                  <Money value={calcOrcTotal(o)} emphasis bold />
                </span>
                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                  {o.status === "aberto" && (
                    <button
                      type="button"
                      onClick={() => handleAprovar(o.id)}
                      className="inline-flex items-center h-8 px-3 rounded-md text-[13px] font-semibold text-white transition-colors"
                      style={{ background: "var(--gw-success)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#0C8D5C")}
                      onMouseLeave={e => (e.currentTarget.style.background = "var(--gw-success)")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Editar"
                    onClick={() => navigate(`/sistema/orcamentos/${o.id}`)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors"
                    style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
                  >
                    <Pencil className="h-4 w-4" />
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
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => navigate(`/sistema/orcamentos/${o.id}`)} style={{ color: "var(--gw-primary)" }}>
                        <FileText className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(o)} style={{ color: "var(--gw-violet)" }}>
                        <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(o.id)} style={{ color: "var(--gw-danger)" }}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Conteúdo do orçamento (sempre visível) */}
              <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: "var(--gw-surface)" }}>
                  {/* Itens */}
                  <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--gw-border)" }}>
                    <div className="min-w-[760px]">
                    <div
                      className="grid grid-cols-[176px_1fr_80px_110px_130px] items-center gap-3 px-3 h-9"
                      style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
                    >
                      <span />
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Produto</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Qtd</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Unit.</span>
                      <span className="gw-label text-right" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Total</span>
                    </div>
                    {o.itens.length === 0 ? (
                      <div className="px-3 py-6 text-center gw-meta">Carregando itens...</div>
                    ) : o.itens.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[176px_1fr_80px_110px_130px] items-center gap-3 px-3 py-4"
                        style={{ background: idx % 2 === 1 ? "color-mix(in srgb, var(--gw-surface-alt) 40%, var(--gw-surface))" : "var(--gw-surface)" }}
                      >
                        <Thumb size="xl" src={item.mockupImagem || item.imagem} alt={item.nome} />
                        <span className="flex flex-col min-w-0 leading-tight">
                          <span className="gw-title text-[12.5px] truncate" style={{ fontWeight: 600 }}>{item.nome}</span>
                          {item.observacao && (
                            <span className="text-[12px] truncate" style={{ color: "var(--gw-text-secondary)" }}>{item.observacao}</span>
                          )}
                          {item.codigoComposto && (
                            <span className="gw-tnum text-[11px]" style={{ color: "var(--gw-text-muted)" }}>{item.codigoComposto}</span>
                          )}
                        </span>
                        <span className="text-right gw-tnum text-[13px]" style={{ color: "var(--gw-text)" }}>{item.quantidade}</span>
                        <span className="text-right"><Money value={item.precoUnitario} /></span>
                        <span className="text-right"><Money value={item.precoUnitario * item.quantidade} emphasis /></span>
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* Totais */}
                  <div
                    className="h-11 rounded-lg px-4 flex items-center justify-end gap-6"
                    style={{ background: "var(--gw-primary-soft)" }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Subtotal</span>
                      <Money value={o.itens.length > 0 ? calcSubtotal(o) : Number(o.subtotal || 0)} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Frete{o.freteTipo ? ` (${o.freteTipo})` : ""}</span>
                      <Money value={Number(o.freteValor) || 0} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Total</span>
                      <Money value={calcOrcTotal(o)} emphasis bold />
                    </span>
                  </div>

                  {/* Metadados */}
                  <div className="h-14 grid grid-cols-4 gap-4 items-center">
                    <MetaField label="Vendedor" value={getVendedorNome(o.vendedorId)} />
                    <MetaField label="Transportadora" value={getTransportadoraNome(o.transportadoraId)} />
                    <MetaField label="Criado em" value={new Date(o.createdAt).toLocaleDateString("pt-BR")} />
                    <MetaField label="Contato" value={o.contatoNome || o.contatoTelefone || "—"} />
                  </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
          <span className="gw-meta">{listLoading ? "Atualizando..." : ""}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, currentPage - 1))}
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
              onClick={() => setPage(p => Math.min(totalPages, currentPage + 1))}
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



      {/* Modal Aprovação */}
      {aprovarOrc && (
        <AprovarModal
          orcamento={aprovarOrc}
          onClose={() => setAprovarOrc(null)}
          onConfirm={handleConfirmarAprovacao}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este orçamento?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && handleDelete(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

