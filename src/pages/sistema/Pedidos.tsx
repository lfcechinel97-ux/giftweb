import { useMemo, useState } from "react";
import {
  ShoppingCart, Search, Filter, Printer, ChevronDown, ChevronUp, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSistema, formatBRL, type Pedido } from "@/contexts/SistemaContext";
import { gerarOrdemProducaoPDF } from "./ordemProducaoPDF";

/* ── Status config ───────────────────────────────────────────────────────── */

type PedidoStatus = Pedido["status"];

const STATUS_OPTS: { value: PedidoStatus; label: string }[] = [
  { value: "novo",      label: "Novo" },
  { value: "producao",  label: "Em produção" },
  { value: "pronto",    label: "Pronto" },
  { value: "enviado",   label: "Enviado" },
  { value: "entregue",  label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const statusStyle: Record<PedidoStatus, string> = {
  novo:      "bg-gray-100 text-gray-700",
  producao:  "bg-amber-100 text-amber-700",
  pronto:    "bg-blue-100 text-blue-700",
  enviado:   "bg-purple-100 text-purple-700",
  entregue:  "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-600",
};

const statusLabel: Record<PedidoStatus, string> = {
  novo:      "Novo",
  producao:  "Em produção",
  pronto:    "Pronto",
  enviado:   "Enviado",
  entregue:  "Entregue",
  cancelado: "Cancelado",
};

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Pedidos() {
  const { pedidos, updatePedido, clientes, vendedores, transportadoras } = useSistema();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getClienteNome = (clienteId: string) =>
    clientes.find(c => c.id === clienteId)?.nome || "—";

  const getVendedorNome = (id?: string) =>
    vendedores.find(v => v.id === id)?.nome || "—";

  const getTransportadoraNome = (id?: string) =>
    transportadoras.find(t => t.id === id)?.nome || "—";

  const filtered = useMemo(() => {
    return pedidos
      .filter(p => {
        if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
        if (busca.trim()) {
          const t = busca.toLowerCase();
          const nomeCliente = getClienteNome(p.clienteId).toLowerCase();
          const matchNum = p.numero.includes(t);
          const matchCliente = nomeCliente.includes(t);
          const matchItem = p.itens.some(i =>
            i.nome.toLowerCase().includes(t) ||
            (i.codigoComposto || "").toLowerCase().includes(t)
          );
          if (!matchNum && !matchCliente && !matchItem) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pedidos, busca, filtroStatus, clientes]);

  const handleStatusChange = (pedidoId: string, status: PedidoStatus) => {
    updatePedido(pedidoId, { status });
  };

  const handlePrintPDF = async (p: Pedido) => {
    await gerarOrdemProducaoPDF(p, { clientes, vendedores, transportadoras });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Pedidos gerados automaticamente a partir de orçamentos aprovados.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} pedido(s)</span>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, nº ou produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {pedidos.length === 0
                ? "Aprove um orçamento para criar pedidos automaticamente."
                : "Nenhum pedido encontrado para o filtro atual."}
            </p>
          </div>
        ) : filtered.map(p => {
          const expanded = expandedId === p.id;
          const clienteNome = getClienteNome(p.clienteId);
          const primeiroProduto = p.itens[0];

          return (
            <div key={p.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => setExpandedId(expanded ? null : p.id)}
              >
                {/* Nº */}
                <span className="font-mono text-sm font-semibold text-foreground w-20 shrink-0">
                  #{p.numero}
                </span>

                {/* Cliente */}
                <span className="font-medium text-sm text-foreground w-44 shrink-0 truncate">
                  {clienteNome}
                </span>

                {/* Produto principal + qtd */}
                <div className="flex-1 min-w-0">
                  {primeiroProduto ? (
                    <div className="flex items-center gap-2">
                      {primeiroProduto.mockupImagem ? (
                        <img
                          src={primeiroProduto.mockupImagem}
                          alt=""
                          className="w-7 h-7 rounded object-cover shrink-0"
                        />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm text-foreground truncate">
                        {primeiroProduto.nome}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        × {primeiroProduto.quantidade}
                      </span>
                      {p.itens.length > 1 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          +{p.itens.length - 1} mais
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Data */}
                <span className="text-xs text-muted-foreground w-24 shrink-0 text-right">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </span>

                {/* Total */}
                <span className="font-semibold text-sm w-24 shrink-0 text-right">
                  {formatBRL(p.total)}
                </span>

                {/* Status select */}
                <div className="shrink-0" onClick={e => e.stopPropagation()}>
                  <Select
                    value={p.status}
                    onValueChange={v => handleStatusChange(p.id, v as PedidoStatus)}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <Badge className={`${statusStyle[p.status]} text-xs`}>
                        {statusLabel[p.status]}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* PDF button */}
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  title="Imprimir Ordem de Produção"
                  onClick={e => { e.stopPropagation(); handlePrintPDF(p); }}
                >
                  <Printer className="h-4 w-4" />
                </Button>

                {/* Expand */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : p.id); }}
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="border-t border-border divide-y divide-border">
                  {/* Items */}
                  <div className="grid grid-cols-[32px_1fr_60px_100px_110px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/10">
                    <span />
                    <span>Produto</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Unit.</span>
                    <span className="text-right">Total</span>
                  </div>
                  {p.itens.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[32px_1fr_60px_100px_110px] gap-3 px-4 py-2 text-sm items-center"
                    >
                      <span>
                        {item.mockupImagem ? (
                          <img src={item.mockupImagem} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-foreground">{item.nome}</span>
                        {item.codigoComposto && (
                          <span className="text-[10px] text-muted-foreground font-mono">{item.codigoComposto}</span>
                        )}
                      </span>
                      <span className="text-right">{item.quantidade}</span>
                      <span className="text-right text-muted-foreground">{formatBRL(item.precoUnitario)}</span>
                      <span className="text-right font-medium">{formatBRL(item.total)}</span>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="grid grid-cols-[32px_1fr_60px_100px_110px] gap-3 px-4 py-2 text-sm bg-muted/10">
                    <span /><span /><span />
                    <span className="text-right text-muted-foreground">Subtotal:</span>
                    <span className="text-right font-medium">{formatBRL(p.subtotal)}</span>
                  </div>
                  {p.freteValor > 0 && (
                    <div className="grid grid-cols-[32px_1fr_60px_100px_110px] gap-3 px-4 py-2 text-sm bg-muted/10">
                      <span /><span /><span />
                      <span className="text-right text-muted-foreground">Frete ({p.freteTipo}):</span>
                      <span className="text-right">{formatBRL(p.freteValor)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-[32px_1fr_60px_100px_110px] gap-3 px-4 py-2 text-sm font-semibold bg-muted/20">
                    <span /><span /><span />
                    <span className="text-right">Total:</span>
                    <span className="text-right text-green-600">{formatBRL(p.total)}</span>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-3 gap-4 px-4 py-3 text-xs text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground mb-0.5">Vendedor</span>
                      {getVendedorNome(p.vendedorId)}
                    </div>
                    <div>
                      <span className="block font-medium text-foreground mb-0.5">Transportadora</span>
                      {getTransportadoraNome(p.transportadoraId)}
                    </div>
                    <div>
                      <span className="block font-medium text-foreground mb-0.5">Prazo de Entrega</span>
                      {p.prazoEntrega ? `${p.prazoEntrega} dias úteis` : "A combinar"}
                    </div>
                    {p.observacoes && (
                      <div className="col-span-3">
                        <span className="block font-medium text-foreground mb-0.5">Observações</span>
                        {p.observacoes}
                      </div>
                    )}
                    {p.contatoNome && (
                      <div>
                        <span className="block font-medium text-foreground mb-0.5">Contato</span>
                        {p.contatoNome}
                        {p.contatoTelefone && ` · ${p.contatoTelefone}`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
