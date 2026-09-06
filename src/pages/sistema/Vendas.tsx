import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, CheckCircle2, AlertTriangle, Circle, RefreshCw, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import VendaConferencia from "./financeiro/VendaConferencia";
import { fetchVendasConferencia, sincronizarFinanceiro } from "./financeiro/api";
import type { VendasConferencia } from "./financeiro/types";
import { toast } from "sonner";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const hojeBR = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const iso = (d: Date) => d.toISOString().slice(0, 10);

type StatusFiltro = "todas" | "pendentes" | "conferidas";

export default function Vendas() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  const status = (params.get("status") as StatusFiltro) || "pendentes";
  const inicio = params.get("de") || iso(new Date(hojeBR().getFullYear(), hojeBR().getMonth(), 1));
  const fim = params.get("ate") || iso(hojeBR());
  const [buscaDraft, setBuscaDraft] = useState(params.get("busca") || "");
  const busca = params.get("busca") || "";

  const [vendaAberta, setVendaAberta] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const setParam = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  const { data, isLoading, refetch } = useQuery<VendasConferencia>({
    queryKey: ["sistema", "financeiro", "vendas", inicio, fim, status, busca],
    queryFn: () => fetchVendasConferencia(inicio, fim, status, busca, 200),
    staleTime: 30 * 1000,
    placeholderData: anterior => anterior,
  });

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await sincronizarFinanceiro({ inicio, fim });
      if (!r.success) toast.error(`Sincronização falhou: ${r.error ?? "erro desconhecido"}`);
      else if (r.itens_pendentes > 0) {
        toast.warning(`${r.itens} itens trazidos. Faltam ${r.itens_pendentes} pedidos — sincronize de novo.`);
      } else {
        toast.success(`${r.vendas} pedidos, ${r.itens} itens sincronizados.`);
      }
      await qc.invalidateQueries({ queryKey: ["sistema", "financeiro"] });
    } catch (e: unknown) {
      toast.error(`Sincronização falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSincronizando(false);
    }
  };

  const vendas = useMemo(() => data?.vendas ?? [], [data?.vendas]);

  const resumo = useMemo(() => {
    const t = { venda: 0, lucro: 0 };
    for (const v of vendas) { t.venda += v.valor_total; t.lucro += v.lucro; }
    return t;
  }, [vendas]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="gw-display text-[20px]">Fluxo de vendas</h1>
          <p className="gw-meta">
            Confira pagamento, imposto e custo de cada pedido — o lucro cai no Dashboard na hora.
          </p>
        </div>
        <Button variant="outline" onClick={() => void sincronizar()} disabled={sincronizando}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sincronizando ? "animate-spin" : ""}`} />
          {sincronizando ? "Sincronizando" : "Sincronizar"}
        </Button>
      </header>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--gw-text-muted)" }} />
          <Input
            className="pl-8 w-[240px]"
            placeholder="Pedido ou cliente"
            value={buscaDraft}
            onChange={e => setBuscaDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") setParam({ busca: buscaDraft }); }}
            onBlur={() => setParam({ busca: buscaDraft })}
          />
        </div>
        <Select value={status} onValueChange={v => setParam({ status: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">A conferir</SelectItem>
            <SelectItem value="conferidas">Conferidas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={inicio} onChange={e => setParam({ de: e.target.value })} className="w-[148px]" />
        <span style={{ color: "var(--gw-text-muted)" }}>a</span>
        <Input type="date" value={fim} onChange={e => setParam({ ate: e.target.value })} className="w-[148px]" />

        <div className="ml-auto flex items-center gap-4 text-[13px]">
          <span style={{ color: "var(--gw-text-secondary)" }}>
            {data?.pendentes ?? 0} a conferir
          </span>
          {(data?.sem_custo ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: "var(--gw-warning)" }}>
              <AlertTriangle className="h-3.5 w-3.5" /> {data?.sem_custo} com custo faltando
            </span>
          )}
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden"
           style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
        {isLoading && !data ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-10 rounded bg-muted" />)}
          </div>
        ) : vendas.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: "var(--gw-text-muted)" }}>
            {status === "pendentes"
              ? "Nenhuma venda pendente no período — tudo conferido."
              : "Nenhuma venda no período."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-muted)" }}>
                  <th className="text-left font-medium p-2.5 w-[40px]"></th>
                  <th className="text-left font-medium p-2.5">Pedido</th>
                  <th className="text-left font-medium p-2.5">Cliente</th>
                  <th className="text-left font-medium p-2.5">Data</th>
                  <th className="text-left font-medium p-2.5">Pagamento</th>
                  <th className="text-right font-medium p-2.5">Venda</th>
                  <th className="text-right font-medium p-2.5">Custo</th>
                  <th className="text-right font-medium p-2.5">Lucro</th>
                  <th className="w-[32px]"></th>
                </tr>
              </thead>
              <tbody>
                {vendas.map(v => {
                  const conferida = v.conferido_em !== null;
                  const semItens = v.itens_total === 0;
                  const alerta = semItens || v.itens_sem_custo > 0;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setVendaAberta(v.id)}
                      className="cursor-pointer hover:bg-[var(--gw-surface-alt)] transition-colors"
                      style={{ borderTop: "1px solid var(--gw-border)" }}
                    >
                      <td className="p-2.5">
                        {conferida ? (
                          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--gw-success)" }} />
                        ) : alerta ? (
                          <AlertTriangle className="h-4 w-4" style={{ color: "var(--gw-warning)" }} />
                        ) : (
                          <Circle className="h-4 w-4" style={{ color: "var(--gw-border-strong)" }} />
                        )}
                      </td>
                      <td className="p-2.5 gw-tnum">{v.calcme_order_idint ?? "—"}</td>
                      <td className="p-2.5 max-w-[220px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
                        {v.cliente_nome ?? "—"}
                      </td>
                      <td className="p-2.5 gw-tnum" style={{ color: "var(--gw-text-secondary)" }}>
                        {dataBR(v.data)}
                      </td>
                      <td className="p-2.5 truncate max-w-[150px]"
                          style={{ color: v.meio_pagamento_nome ? "var(--gw-text-secondary)" : "var(--gw-text-muted)" }}>
                        {v.meio_pagamento_nome ?? "não informado"}
                      </td>
                      <td className="p-2.5 text-right gw-tnum">{brl(v.valor_total)}</td>
                      <td className="p-2.5 text-right gw-tnum" style={{ color: "var(--gw-text-secondary)" }}>
                        {semItens
                          ? <span title="Itens ainda não sincronizados do Calcme.">—</span>
                          : <>
                              {brl(v.cmv)}
                              {v.itens_sem_custo > 0 && (
                                <span className="ml-1 text-[10px]" style={{ color: "var(--gw-warning)" }}
                                      title={`${v.itens_sem_custo} de ${v.itens_total} itens sem custo`}>
                                  {v.itens_sem_custo}/{v.itens_total}
                                </span>
                              )}
                            </>}
                      </td>
                      <td className="p-2.5 text-right gw-tnum"
                          style={{ color: v.lucro < 0 ? "var(--gw-danger)" : "var(--gw-text)" }}>
                        {semItens ? "—" : (
                          <>
                            {brl(v.lucro)}
                            <span className="ml-1.5 text-[11px]" style={{ color: "var(--gw-text-muted)" }}>
                              {v.valor_total > 0 ? `${((v.lucro / v.valor_total) * 100).toFixed(0)}%` : ""}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="p-2.5">
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--gw-surface-alt)", borderTop: "1px solid var(--gw-border-strong)" }}>
                  <td colSpan={5} className="p-2.5 gw-body-strong">
                    {vendas.length} pedido(s)
                  </td>
                  <td className="p-2.5 text-right gw-num">{brl(resumo.venda)}</td>
                  <td></td>
                  <td className="p-2.5 text-right gw-num">
                    {brl(resumo.lucro)}
                    <span className="ml-1.5 text-[11px]" style={{ color: "var(--gw-text-muted)" }}>
                      {resumo.venda > 0 ? `${((resumo.lucro / resumo.venda) * 100).toFixed(1)}%` : ""}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <VendaConferencia
        vendaId={vendaAberta}
        onOpenChange={o => !o && setVendaAberta(null)}
        onSalvo={() => { void refetch(); void qc.invalidateQueries({ queryKey: ["sistema", "financeiro", "dashboard"] }); }}
      />
    </div>
  );
}
