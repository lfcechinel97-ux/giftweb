import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, PackageCheck, PackageX, Printer, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";

/* Conferência de recebimento do pedido de compra: a produção vai
   assinalando item a item — "Chegou certo" ou "Falta" (com quantas
   chegaram). Cada clique já grava; no fim, "Finalizar" fecha o pedido como
   RECEBIDO OK ou RECEBIDO C/ FALTAS. Colunas da migration 20261009140000. */

export interface ItemCompra {
  id: string;
  produto_nome: string;
  pedido_numero: string | null;
  cliente: string | null;
  quantidade: number;
  ordem: number;
  sku: string | null;
  variacao: string | null;
  foto_url: string | null;
  qtd_recebida?: number | null;
  conferido_em?: string | null;
  conferido_por?: string | null;
}

export interface CompraConferivel {
  id: string;
  numero: number;
  impresso_em?: string | null;
  impresso_por?: string | null;
  recebido_em?: string | null;
  recebido_por?: string | null;
  itens: ItemCompra[];
}

export type StatusCompra = "aguardando" | "conferindo" | "ok" | "faltas";

const conferido = (i: ItemCompra) => !!i.conferido_em && i.qtd_recebida != null;
const faltaDe = (i: ItemCompra) => (conferido(i) ? Math.max(0, Number(i.quantidade) - Number(i.qtd_recebida)) : 0);

export function statusCompra(c: CompraConferivel): StatusCompra {
  if (c.recebido_em) return c.itens.some(i => faltaDe(i) > 0) ? "faltas" : "ok";
  return c.itens.some(conferido) ? "conferindo" : "aguardando";
}

export const ROTULO_STATUS: Record<StatusCompra, string> = {
  aguardando: "Aguardando recebimento",
  conferindo: "Conferindo",
  ok: "Recebido OK",
  faltas: "Recebido c/ faltas",
};

const ESTILO_STATUS: Record<StatusCompra, { bg: string; fg: string; icone: React.ElementType }> = {
  aguardando: { bg: "#FEF3C7", fg: "#92400E", icone: Clock },
  conferindo: { bg: "#DBEAFE", fg: "#1E40AF", icone: PackageCheck },
  ok: { bg: "#D1FAE5", fg: "#065F46", icone: CheckCircle2 },
  faltas: { bg: "#DC2626", fg: "#FFFFFF", icone: AlertTriangle },
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function StatusCompraChip({ compra }: { compra: CompraConferivel }) {
  const st = statusCompra(compra);
  const { bg, fg, icone: Icone } = ESTILO_STATUS[st];
  const feitos = compra.itens.filter(conferido).length;
  const faltam = compra.itens.reduce((s, i) => s + faltaDe(i), 0);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ background: bg, color: fg }}
      title={st === "faltas" ? `${faltam} un. não chegaram` : compra.recebido_em ? `Conferido por ${compra.recebido_por ?? "—"} em ${dataHora(compra.recebido_em)}` : undefined}
    >
      <Icone className="h-3.5 w-3.5" />
      {ROTULO_STATUS[st]}
      {st === "conferindo" && ` ${feitos}/${compra.itens.length}`}
      {st === "faltas" && ` · falta ${faltam} un.`}
    </span>
  );
}

export function ImpressoChip({ compra }: { compra: CompraConferivel }) {
  return compra.impresso_em ? (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] font-semibold whitespace-nowrap"
      style={{ borderColor: "#A7F3D0", background: "#ECFDF5", color: "#047857" }}
      title={compra.impresso_por ? `Impresso por ${compra.impresso_por}` : undefined}
    >
      <Printer className="h-3 w-3" /> Impresso {dataHora(compra.impresso_em)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-[2px] text-[11px] font-semibold whitespace-nowrap"
      style={{ borderColor: "var(--gw-border-strong, #CBD5E1)", color: "var(--gw-text-muted)" }}>
      <Printer className="h-3 w-3" /> Não impresso
    </span>
  );
}

export default function ConferenciaCompra({ compra, nomeLogado, onMudou }: {
  compra: CompraConferivel;
  nomeLogado: string | null;
  onMudou: () => void;
}) {
  const [salvando, setSalvando] = useState<string | null>(null);
  const [faltaAberta, setFaltaAberta] = useState<Record<string, string>>({});
  const st = statusCompra(compra);
  const finalizado = !!compra.recebido_em;
  const pendentes = compra.itens.filter(i => !conferido(i)).length;

  const gravarItem = async (item: ItemCompra, qtd: number | null) => {
    setSalvando(item.id);
    const { data, error } = await (supabase as any)
      .from("sistema_compras_itens")
      .update(qtd == null
        ? { qtd_recebida: null, conferido_em: null, conferido_por: null }
        : { qtd_recebida: qtd, conferido_em: new Date().toISOString(), conferido_por: nomeLogado })
      .eq("id", item.id)
      .select("id");
    setSalvando(null);
    if (error || !data?.length) {
      toast.error(`Não foi possível salvar. ${error?.message || "Permissão negada pelo banco (RLS)."}`);
      return false;
    }
    onMudou();
    return true;
  };

  const confirmarFalta = async (item: ItemCompra) => {
    const txt = faltaAberta[item.id] ?? "";
    const qtd = Number(txt.replace(",", "."));
    if (txt.trim() === "" || !Number.isFinite(qtd) || qtd < 0) { toast.error("Informe quantas unidades chegaram."); return; }
    if (await gravarItem(item, qtd)) setFaltaAberta(p => { const n = { ...p }; delete n[item.id]; return n; });
  };

  const finalizar = async (reabrir = false) => {
    setSalvando("finalizar");
    const { data, error } = await (supabase as any)
      .from("sistema_compras")
      .update(reabrir ? { recebido_em: null, recebido_por: null } : { recebido_em: new Date().toISOString(), recebido_por: nomeLogado })
      .eq("id", compra.id)
      .select("id");
    setSalvando(null);
    if (error || !data?.length) {
      toast.error(`Não foi possível ${reabrir ? "reabrir" : "finalizar"}. ${error?.message || "Permissão negada pelo banco (RLS)."}`);
      return;
    }
    if (!reabrir) {
      const faltas = compra.itens.filter(i => faltaDe(i) > 0).length;
      if (faltas) toast.warning(`Pedido de compra nº ${String(compra.numero).padStart(4, "0")} recebido com faltas em ${faltas} produto(s).`);
      else toast.success(`Pedido de compra nº ${String(compra.numero).padStart(4, "0")} recebido OK.`);
    }
    onMudou();
  };

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--gw-border)" }}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide"
          style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}>
          <PackageCheck className="h-4 w-4" /> Conferência do recebimento
          <span className="ml-auto normal-case font-medium tracking-normal">
            {finalizado
              ? `Finalizada por ${compra.recebido_por ?? "—"} em ${dataHora(compra.recebido_em!)}`
              : pendentes ? `${pendentes} de ${compra.itens.length} produto(s) para conferir` : "Tudo conferido — finalize abaixo"}
          </span>
        </div>

        <ul className="divide-y" style={{ borderColor: "var(--gw-border)" }}>
          {compra.itens.map(i => {
            const ok = conferido(i);
            const falta = faltaDe(i);
            const sobra = ok && Number(i.qtd_recebida) > Number(i.quantidade) ? Number(i.qtd_recebida) - Number(i.quantidade) : 0;
            const editandoFalta = faltaAberta[i.id] !== undefined;
            const fundo = !ok ? undefined : falta > 0 ? "#FEF2F2" : sobra > 0 ? "#FFFBEB" : "#F0FDF4";
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={{ background: fundo }}>
                {i.foto_url ? (
                  <img src={sizedImage(i.foto_url, 120)} alt="" className="h-11 w-11 rounded-md object-cover bg-[var(--gw-surface-alt)] shrink-0" />
                ) : <span className="h-11 w-11 rounded-md bg-[var(--gw-surface-alt)] shrink-0" />}
                <div className="min-w-[220px] flex-1">
                  <p className="gw-body text-[13.5px]"><b>{Number(i.quantidade)}×</b> {i.produto_nome}</p>
                  <p className="gw-meta text-[11.5px]">
                    {[i.sku, i.variacao].filter(Boolean).join(" · ")}
                    {i.pedido_numero && ` · #${i.pedido_numero}`}{i.cliente && ` · ${i.cliente}`}
                  </p>
                </div>

                {ok && !editandoFalta ? (
                  <div className="flex items-center gap-2">
                    {falta > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: "#DC2626" }}>
                        <PackageX className="h-3.5 w-3.5" /> Chegaram {Number(i.qtd_recebida)} de {Number(i.quantidade)} · falta {falta}
                      </span>
                    ) : sobra > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                        <AlertTriangle className="h-3.5 w-3.5" /> Chegaram {Number(i.qtd_recebida)} · {sobra} a mais
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: "#059669" }}>
                        <Check className="h-3.5 w-3.5" /> Chegou certo
                      </span>
                    )}
                    {!finalizado && (
                      <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold rounded-md px-2 py-1 hover:bg-black/5"
                        style={{ color: "var(--gw-text-secondary)" }} disabled={salvando === i.id}
                        onClick={() => void gravarItem(i, null)} title="Desfazer a conferência deste produto">
                        <Undo2 className="h-3.5 w-3.5" /> desfazer
                      </button>
                    )}
                  </div>
                ) : finalizado ? (
                  <span className="gw-meta text-[12px]">não conferido</span>
                ) : editandoFalta ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="gw-body text-[13px] font-semibold" style={{ color: "#B91C1C" }}>Chegaram</span>
                    <Input
                      autoFocus
                      value={faltaAberta[i.id]}
                      onChange={e => setFaltaAberta(p => ({ ...p, [i.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                      onKeyDown={e => { if (e.key === "Enter") void confirmarFalta(i); if (e.key === "Escape") setFaltaAberta(p => { const n = { ...p }; delete n[i.id]; return n; }); }}
                      inputMode="numeric"
                      className="h-9 w-[84px] text-right font-bold"
                    />
                    <span className="gw-body text-[13px]">de {Number(i.quantidade)}</span>
                    {faltaAberta[i.id] !== "" && Number(faltaAberta[i.id].replace(",", ".")) < Number(i.quantidade) && (
                      <span className="text-[12px] font-bold" style={{ color: "#B91C1C" }}>
                        falta {Number(i.quantidade) - Number(faltaAberta[i.id].replace(",", "."))}
                      </span>
                    )}
                    <Button size="sm" disabled={salvando === i.id} onClick={() => void confirmarFalta(i)} style={{ background: "#DC2626" }}>
                      {salvando === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFaltaAberta(p => { const n = { ...p }; delete n[i.id]; return n; })}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={salvando === i.id} onClick={() => void gravarItem(i, Number(i.quantidade))}
                      className="text-white" style={{ background: "#059669" }}>
                      {salvando === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Chegou certo
                    </Button>
                    <Button size="sm" variant="outline" disabled={salvando === i.id}
                      onClick={() => setFaltaAberta(p => ({ ...p, [i.id]: ok ? String(Number(i.qtd_recebida)) : "" }))}
                      style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>
                      <PackageX className="h-4 w-4 mr-1" /> Falta / quantidade diferente
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={{ background: "var(--gw-surface-alt)" }}>
          {finalizado ? (
            <>
              <StatusCompraChip compra={compra} />
              <Button size="sm" variant="ghost" className="ml-auto" disabled={salvando === "finalizar"} onClick={() => void finalizar(true)}
                title="Reabre a conferência (ex.: chegou o restante que faltava)">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reabrir conferência
              </Button>
            </>
          ) : (
            <>
              <span className="gw-meta text-[12px]">
                {st === "aguardando" ? "Assinale cada produto quando a mercadoria chegar." : pendentes ? "Confira todos os produtos para finalizar." : "Pronto pra finalizar."}
              </span>
              <Button size="sm" className="ml-auto text-white" disabled={pendentes > 0 || salvando === "finalizar"} onClick={() => void finalizar()}
                style={{ background: compra.itens.some(i => faltaDe(i) > 0) ? "#DC2626" : "#059669" }}>
                {salvando === "finalizar" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                {compra.itens.some(i => faltaDe(i) > 0) ? "Finalizar — recebido c/ faltas" : "Finalizar — recebido OK"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
