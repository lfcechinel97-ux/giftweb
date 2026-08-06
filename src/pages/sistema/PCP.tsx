import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Loader2, RefreshCw, Boxes, Phone, Layers, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────────────────────── */

type PcpStatus =
  | "organizando_pedido" | "pronto_producao" | "teste_fisico" | "preparacao"
  | "em_producao" | "embalagem_pagamento" | "aguardando_coleta" | "enviado";

type LocalProducao = "interna" | "terceirizada" | "fornecedor_para_terceirizada";

interface PcpRow {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
  cliente: string | null;
  produto_nome: string | null;
  mockup_url: string | null;
  imagem_catalogo_url: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  status: PcpStatus;
  local_producao: LocalProducao;
  origem_estoque: "estoque" | "compra_especifica";
  data_entrega_item: string | null;
  tecnica_id: string | null;
  tecnica_nome: string | null;
  terceirizada_id: string | null;
  terceirizada_nome: string | null;
  terceirizada_telefone: string | null;
  enviado_terceiro_em: string | null;
  previsao_retorno: string | null;
  qtd_enviada: number | null;
  qtd_retornada: number | null;
  compra_confirmada_em: string | null;
  fornecedor_compra_id: string | null;
}

interface Fornecedor {
  id: string;
  nome: string;
  tipo: string;
  telefone: string | null;
}

/* ── Status columns config ──────────────────────────────────────────────── */

const STATUS_COLS: { value: PcpStatus; label: string; dot: string; header: string }[] = [
  { value: "organizando_pedido",  label: "Organizando Pedido",     dot: "bg-gray-400",    header: "bg-gray-50 text-gray-700" },
  { value: "pronto_producao",     label: "Pronto p/ Produção",     dot: "bg-amber-500",   header: "bg-amber-50 text-amber-700" },
  { value: "teste_fisico",        label: "Teste Físico",           dot: "bg-violet-500",  header: "bg-violet-50 text-violet-700" },
  { value: "preparacao",          label: "Preparação",             dot: "bg-sky-500",     header: "bg-sky-50 text-sky-700" },
  { value: "em_producao",         label: "Em Produção",            dot: "bg-blue-600",    header: "bg-blue-50 text-blue-700" },
  { value: "embalagem_pagamento", label: "Embalagem & Pagamento",  dot: "bg-indigo-500",  header: "bg-indigo-50 text-indigo-700" },
  { value: "aguardando_coleta",   label: "Aguardando Coleta",      dot: "bg-teal-500",    header: "bg-teal-50 text-teal-700" },
  { value: "enviado",             label: "Enviado",                dot: "bg-emerald-600", header: "bg-emerald-50 text-emerald-700" },
];

const TERCEIRIZADA_TRIGGER: LocalProducao[] = ["terceirizada", "fornecedor_para_terceirizada"];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const prazoInfo = (dataStr: string | null) => {
  if (!dataStr) return { border: "border-l-border", label: null as string | null, tone: "text-muted-foreground" };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataStr}T00:00:00`);
  const diffDias = Math.round((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return { border: "border-l-red-500", label: `${Math.abs(diffDias)}d atrasado`, tone: "text-red-600" };
  if (diffDias <= 2) return { border: "border-l-orange-500", label: diffDias === 0 ? "Entrega hoje" : `${diffDias}d p/ entrega`, tone: "text-orange-600" };
  return { border: "border-l-green-500", label: `${diffDias}d p/ entrega`, tone: "text-muted-foreground" };
};

const formatDate = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : null;

/* ── Card ────────────────────────────────────────────────────────────────── */

function PcpCard({
  row, dragging, saving, onDragStart, onDragEnd, onSetOrigem,
}: {
  row: PcpRow;
  dragging: boolean;
  saving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSetOrigem: (origem: "estoque" | "compra_especifica") => void;
}) {
  const prazo = prazoInfo(row.data_entrega_item);
  const foto = row.mockup_url || row.imagem_catalogo_url;

  return (
    <div
      draggable={!saving}
      onDragStart={e => {
        e.dataTransfer.setData("text/plain", row.producao_id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-card border border-l-4 border-border rounded-lg shadow-sm p-3 space-y-2 cursor-grab active:cursor-grabbing select-none transition-opacity",
        prazo.border,
        dragging && "opacity-40",
        saving && "opacity-60 pointer-events-none"
      )}
    >
      <div className="flex gap-2.5">
        {foto ? (
          <img src={foto} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
            <Package className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground truncate">{row.pedido_numero}</span>
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
          </div>
          <p className="text-xs text-foreground font-medium truncate">{row.cliente || "—"}</p>
          <p className="text-sm text-foreground font-semibold leading-tight line-clamp-2">{row.produto_nome || "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
          × {row.quantidade ?? 0}
        </span>
        {row.tecnica_nome && (
          <span className="text-[11px] font-medium bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
            {row.tecnica_nome}
          </span>
        )}
        {TERCEIRIZADA_TRIGGER.includes(row.local_producao) && (
          <span className="text-[11px] font-medium bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">
            Terceirizada
          </span>
        )}
        <button
          type="button"
          onClick={() => onSetOrigem(row.origem_estoque === "estoque" ? "compra_especifica" : "estoque")}
          title="Clique para alternar a origem do estoque"
          className={cn(
            "text-[11px] font-medium rounded-full px-2 py-0.5 transition-colors",
            row.origem_estoque === "estoque"
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          )}
        >
          {row.origem_estoque === "estoque" ? "Em estoque" : "Compra específica"}
        </button>
      </div>

      {row.terceirizada_nome && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-purple-50 rounded-md px-2 py-1">
          <span className="truncate">{row.terceirizada_nome}</span>
          {row.previsao_retorno && <span className="shrink-0">volta {formatDate(row.previsao_retorno)}</span>}
        </div>
      )}

      {prazo.label && (
        <p className={cn("text-[11px] font-medium", prazo.tone)}>{prazo.label}</p>
      )}
    </div>
  );
}

/* ── Página ──────────────────────────────────────────────────────────────── */

export default function PCP() {
  const [rows, setRows] = useState<PcpRow[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PcpStatus | null>(null);

  const [terceiroModal, setTerceiroModal] = useState<{ row: PcpRow } | null>(null);
  const [modalFornecedorId, setModalFornecedorId] = useState("");
  const [modalQtdEnviada, setModalQtdEnviada] = useState("");
  const [modalPrevisao, setModalPrevisao] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("vw_pcp" as any)
      .select("*")
      .order("data_entrega_item", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("[PCP] carregar itens falhou:", error);
      toast.error(`Não foi possível carregar o PCP. ${error.message || ""}`);
      return;
    }
    setRows((data as any as PcpRow[]) ?? []);
  };

  const loadFornecedores = async () => {
    const { data, error } = await supabase
      .from("sistema_fornecedores")
      .select("id, nome, tipo, telefone")
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("[PCP] carregar fornecedores falhou:", error);
      return;
    }
    setFornecedores(data ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadItems(), loadFornecedores()]);
      setLoading(false);
    })();
  }, []);

  const byStatus = useMemo(() => {
    const map: Record<string, PcpRow[]> = {};
    for (const col of STATUS_COLS) map[col.value] = [];
    for (const row of rows) (map[row.status] ??= []).push(row);
    return map;
  }, [rows]);

  const terceirizadas = useMemo(
    () => fornecedores.filter(f => f.tipo === "terceirizada" || f.tipo === "ambos"),
    [fornecedores]
  );

  const applyUpdate = async (producaoId: string, patch: Record<string, any>) => {
    setSavingId(producaoId);
    setRows(prev => prev.map(r => (r.producao_id === producaoId ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("sistema_producao_itens" as any).update(patch).eq("id", producaoId);
    setSavingId(null);
    if (error) {
      console.error("[PCP] atualizar item falhou:", error);
      toast.error(`Não foi possível salvar. ${error.message || ""}`);
      await loadItems();
    }
  };

  const openTerceiroModal = (row: PcpRow) => {
    setTerceiroModal({ row });
    setModalFornecedorId(row.terceirizada_id || "");
    setModalQtdEnviada(String(row.quantidade ?? ""));
    setModalPrevisao(row.previsao_retorno || "");
  };

  const handleDrop = (targetStatus: PcpStatus, id: string) => {
    setDragOverStatus(null);
    setDraggingId(null);
    if (!id) return;
    const row = rows.find(r => r.producao_id === id);
    if (!row || row.status === targetStatus) return;

    // Preparação: se a etapa é feita por terceirizada (ou fornecedor->terceirizada),
    // pede os dados do envio antes de mover. Se for interna, entra direto (vetorização própria).
    if (targetStatus === "preparacao" && TERCEIRIZADA_TRIGGER.includes(row.local_producao)) {
      openTerceiroModal(row);
      return;
    }

    applyUpdate(id, { status: targetStatus });
  };

  const confirmEnvioTerceiro = async () => {
    if (!terceiroModal) return;
    if (!modalFornecedorId) {
      toast.error("Selecione a terceirizada");
      return;
    }
    setModalSaving(true);
    await applyUpdate(terceiroModal.row.producao_id, {
      status: "preparacao",
      terceirizada_id: modalFornecedorId,
      qtd_enviada: modalQtdEnviada ? Number(modalQtdEnviada) : null,
      previsao_retorno: modalPrevisao || null,
      enviado_terceiro_em: new Date().toISOString(),
    });
    setModalSaving(false);
    setTerceiroModal(null);
  };

  const totalItens = rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">PCP — Produção</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe cada item de pedido pelo fluxo de produção. Arraste os cards entre as colunas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalItens} item(ns)</span>
          <Button variant="outline" size="sm" onClick={() => loadItems()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center text-muted-foreground gap-2 py-24">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando PCP...
        </div>
      ) : totalItens === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Boxes className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">Nenhum item de produção encontrado.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto overflow-y-visible pb-4 items-start">
          {STATUS_COLS.map(col => {
            const items = byStatus[col.value] || [];
            const isOver = dragOverStatus === col.value;
            return (
              <div
                key={col.value}
                onDragOver={e => { e.preventDefault(); setDragOverStatus(col.value); }}
                onDragLeave={() => setDragOverStatus(prev => (prev === col.value ? null : prev))}
                onDrop={e => {
                  e.preventDefault();
                  handleDrop(col.value, e.dataTransfer.getData("text/plain"));
                }}
                className={cn(
                  "w-[280px] shrink-0 rounded-xl border bg-muted/20 transition-colors",
                  isOver ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-xl sticky top-0", col.header)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", col.dot)} />
                    <span className="text-xs font-semibold truncate">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-bold bg-white/70 rounded-full px-1.5 py-0.5 shrink-0">
                    {items.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {items.length === 0 ? (
                    <div className="text-center text-[11px] text-muted-foreground/60 py-6">Vazio</div>
                  ) : items.map(row => (
                    <PcpCard
                      key={row.producao_id}
                      row={row}
                      dragging={draggingId === row.producao_id}
                      saving={savingId === row.producao_id}
                      onDragStart={() => setDraggingId(row.producao_id)}
                      onDragEnd={() => setDraggingId(null)}
                      onSetOrigem={origem => applyUpdate(row.producao_id, { origem_estoque: origem })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: enviar para terceirizada (só quando a etapa "Preparação" é feita por terceiro) */}
      <Dialog open={!!terceiroModal} onOpenChange={open => !open && setTerceiroModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Enviar para terceirizada
            </DialogTitle>
          </DialogHeader>

          {terceiroModal && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{terceiroModal.row.produto_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {terceiroModal.row.pedido_numero} · {terceiroModal.row.cliente}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Terceirizada</Label>
                <Select value={modalFornecedorId} onValueChange={setModalFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a terceirizada" />
                  </SelectTrigger>
                  <SelectContent>
                    {terceirizadas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma terceirizada cadastrada
                      </div>
                    ) : terceirizadas.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          {f.nome}
                          {f.telefone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {f.telefone}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantidade enviada</Label>
                  <Input
                    type="number"
                    min={0}
                    value={modalQtdEnviada}
                    onChange={e => setModalQtdEnviada(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de retorno</Label>
                  <Input
                    type="date"
                    value={modalPrevisao}
                    onChange={e => setModalPrevisao(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTerceiroModal(null)} disabled={modalSaving}>
              Cancelar
            </Button>
            <Button onClick={confirmEnvioTerceiro} disabled={modalSaving}>
              {modalSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
