import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, Filter, Plus, Search, Trash2, ChevronDown, ChevronUp, FileText, Package, Printer
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

export default function Orcamentos() {
  const { orcamentos, removeOrcamento, aprovarOrcamento, clientes, vendedores, transportadoras, meiosPagamento, origens } = useSistema();
  const navigate = useNavigate();
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orcamentos.filter(o => {
      if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
      if (filtroCliente) {
        const c = clientes.find(cli => cli.id === o.clienteId);
        const nome = clienteDisplay(c).toLowerCase();
        if (!nome.includes(filtroCliente.toLowerCase())) return false;
      }
      if (filtroBusca) {
        const term = filtroBusca.toLowerCase();
        const matchNumero = String(o.numero).includes(term);
        const matchItem = o.itens.some(i => 
          i.nome.toLowerCase().includes(term) || 
          (i.codigoComposto || "").toLowerCase().includes(term)
        );
        if (!matchNumero && !matchItem) return false;
      }
      return true;
    });
  }, [orcamentos, filtroCliente, filtroBusca, filtroStatus, clientes]);

  const valorTotalFiltrado = filtered.reduce((s, o) => s + calcTotal(o), 0);

  const handleAprovar = (id: string) => {
    const p = aprovarOrcamento(id);
    if (p) toast.success(`Orçamento aprovado! Pedido #${p.numero} criado.`);
  };

  const handleDelete = (id: string) => {
    removeOrcamento(id);
    toast.success("Orçamento removido.");
    setDeleteId(null);
  };

  const handleImprimir = (o: Orcamento) => {
    const cliente = clientes.find(c => c.id === o.clienteId);
    gerarPDFOrcamento(o, { clientes, vendedores, meiosPagamento, transportadoras, origens }, cliente?.nome);
  };

  const getClienteNome = (clienteId: string) => {
    const c = clientes.find(cli => cli.id === clienteId);
    return clienteDisplay(c);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">Gerencie orçamentos e aprovações.</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate("/sistema/orcamentos/novo")}>
          <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar orçamento..." 
            value={filtroBusca} 
            onChange={e => setFiltroBusca(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Input 
          placeholder="Filtrar por cliente..." 
          value={filtroCliente} 
          onChange={e => setFiltroCliente(e.target.value)} 
          className="md:w-[240px]"
        />
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTS.map(s => (
              <SelectItem key={s} value={s}>{statusStyles[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Total */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filtered.length} orçamento(s)</p>
        <p className="text-sm font-medium">Total filtrado: <span className="text-green-600">{formatBRL(valorTotalFiltrado)}</span></p>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground">Nenhum orçamento. Clique em "Novo Orçamento".</p>
          </div>
        ) : filtered.map(o => (
          <div key={o.id} className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Header row */}
            <div 
              className="grid grid-cols-[100px_1fr_120px_140px_100px_140px_44px] items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
              onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
            >
              <span className="font-semibold text-foreground">#{o.numero}</span>
              <span className="text-sm truncate">{getClienteNome(o.clienteId)}</span>
              <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("pt-BR")}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit ${statusStyles[o.status].dot.replace("bg-", "bg-opacity-20 ")}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[o.status].dot}`} />
                {statusStyles[o.status].label}
              </span>
              <span className="text-right font-semibold">{formatBRL(calcTotal(o))}</span>
              <div className="flex gap-1">
                {o.status === "aberto" && (
                  <Button size="sm" className={statusStyles["aprovado"].btn} onClick={(e) => { e.stopPropagation(); handleAprovar(o.id); }}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteId(o.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === o.id ? null : o.id); }}>
                {expandedId === o.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {/* Expanded content */}
            {expandedId === o.id && (
              <div className="border-t border-border">
                {/* Items header */}
                <div className="grid grid-cols-[40px_1fr_80px_100px_120px] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                  <span /><span>Produto</span><span className="text-right">Qtd</span><span className="text-right">Unit.</span><span className="text-right">Total</span>
                </div>
                {/* Items */}
                {o.itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[40px_1fr_80px_100px_120px] items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-0">
                    <span>
                      {item.imagem ? (
                        <img src={item.imagem} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-foreground truncate">{item.nome}</span>
                      {item.codigoComposto && (
                        <span className="text-[10px] text-muted-foreground font-mono">{item.codigoComposto}</span>
                      )}
                    </span>
                    <span className="text-right text-foreground">{item.quantidade}</span>
                    <span className="text-right text-muted-foreground">{formatBRL(item.precoUnitario)}</span>
                    <span className="text-right font-medium">{formatBRL(item.precoUnitario * item.quantidade)}</span>
                  </div>
                ))}
                {/* Totals */}
                <div className="grid grid-cols-[40px_1fr_80px_100px_120px] items-center gap-3 px-4 py-3 bg-muted/10 text-sm">
                  <span /><span /><span /><span className="text-right text-muted-foreground">Subtotal:</span>
                  <span className="text-right font-semibold">{formatBRL(calcSubtotal(o))}</span>
                </div>
                {o.freteValor > 0 && (
                  <div className="grid grid-cols-[40px_1fr_80px_100px_120px] items-center gap-3 px-4 py-2 bg-muted/10 text-sm">
                    <span /><span /><span /><span className="text-right text-muted-foreground">Frete ({o.freteTipo}):</span>
                    <span className="text-right">{formatBRL(o.freteValor)}</span>
                  </div>
                )}
                <div className="grid grid-cols-[40px_1fr_80px_100px_120px] items-center gap-3 px-4 py-3 bg-muted/20 text-sm font-semibold">
                  <span /><span /><span /><span className="text-right">Total:</span>
                  <span className="text-right text-green-600">{formatBRL(calcTotal(o))}</span>
                </div>
                {/* Details */}
                <div className="grid grid-cols-4 gap-4 px-4 py-3 text-xs text-muted-foreground border-t border-border">
                  <div>
                    <span className="block font-medium">Vendedor</span>
                    {getVendedorNome(o.vendedorId)}
                  </div>
                  <div>
                    <span className="block font-medium">Prazo de Entrega</span>
                    {o.prazoEntrega ? `${o.prazoEntrega} dias úteis` : "À combinar"}
                  </div>
                  <div>
                    <span className="block font-medium">Transportadora</span>
                    {getTransportadoraNome(o.transportadoraId)}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleImprimir(o)}>
                      <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/sistema/orcamentos/${o.id}`)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
