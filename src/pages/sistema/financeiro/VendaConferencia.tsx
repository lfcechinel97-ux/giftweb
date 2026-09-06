import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  fetchVendaDetalhe, salvarItemVenda, salvarVenda, salvarCustoProduto,
} from "./api";
import type { VendaDetalhe, VendaItem } from "./types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

/** Aceita "1.234,56" e "1234.56". Vazio devolve null (= herdar da cascata). */
const paraNumero = (v: string): number | null => {
  const limpo = v.trim().replace(/\s|R\$/gi, "");
  if (!limpo) return null;
  const norm = limpo.lastIndexOf(",") > limpo.lastIndexOf(".")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo.replace(/,/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: number | null | undefined) =>
  v == null ? "" : String(v).replace(".", ",");

/* Rascunho de edição de um item, antes de gravar. */
interface Rascunho {
  custoTexto: string;
  terceirizadaTexto: string;
  /** Propaga o custo para o catálogo do produto (vale para pedidos futuros). */
  aoCatalogo: boolean;
}

interface Props {
  vendaId: string | null;
  onOpenChange: (v: boolean) => void;
  onSalvo?: () => void;
}

export default function VendaConferencia({ vendaId, onOpenChange, onSalvo }: Props) {
  const aberto = vendaId !== null;

  const { data, isLoading, refetch } = useQuery<VendaDetalhe>({
    queryKey: ["sistema", "financeiro", "venda", vendaId],
    queryFn: () => fetchVendaDetalhe(vendaId as string),
    enabled: aberto,
  });

  const [meioId, setMeioId] = useState<string>("");
  const [impostoTexto, setImpostoTexto] = useState("");
  const [comissaoTexto, setComissaoTexto] = useState("");
  const [taxaTexto, setTaxaTexto] = useState("");
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [salvando, setSalvando] = useState(false);

  /* Recarrega o formulário sempre que outra venda entra em cena. */
  useEffect(() => {
    if (!data?.venda) return;
    setMeioId(data.venda.meio_pagamento_id ?? "");
    setImpostoTexto(texto(data.venda.imposto_pct));
    setComissaoTexto(texto(data.venda.comissao_pct));
    setTaxaTexto(texto(data.venda.taxa_cartao_pct));
    setRascunhos(Object.fromEntries(data.itens.map(i => [i.id, {
      custoTexto: texto(i.custo_override),
      terceirizadaTexto: texto(i.terceirizada_unit || null),
      aoCatalogo: true,
    }])));
  }, [data]);

  const meioSelecionado = data?.meios_pagamento.find(m => m.id === meioId);

  /* Percentuais em vigor. A cascata é a mesma da view sistema_venda_item_resultado:
     item → pedido → meio de pagamento → padrão. Aqui só falta o nível do item,
     que a tela não edita. */
  const impostoPct  = paraNumero(impostoTexto)  ?? data?.itens[0]?.imposto_pct  ?? 0;
  const comissaoPct = paraNumero(comissaoTexto) ?? data?.itens[0]?.comissao_pct ?? 0;
  const taxaPct     = paraNumero(taxaTexto) ?? meioSelecionado?.taxa_pct
                   ?? data?.itens[0]?.taxa_cartao_pct ?? 0;

  /* Recalcula como a view sistema_venda_item_resultado faz, para o número
     mudar enquanto se digita. Se a fórmula do SQL mudar, esta muda junto. */
  const linhas = useMemo(() => {
    const calcular = (item: VendaItem, r?: Rascunho) => {
      const digitado = paraNumero(r?.custoTexto ?? "");
      /* Campo vazio devolve o item à cascata. Quando o custo atual vinha de
         um override do próprio item, o valor do catálogo não está neste
         payload — ele reaparece depois de salvar, quando a view recalcula. */
      const custoUnit = digitado ?? (item.custo_fonte === "item" ? null : item.custo_unitario);
      const custoTotal = (custoUnit ?? 0) * item.quantidade;
      const tercTotal = (paraNumero(r?.terceirizadaTexto ?? "") ?? 0) * item.quantidade;
      const deducoes = item.valor_total * (impostoPct + comissaoPct + taxaPct) / 100;
      return {
        custoUnit,
        custoTotal,
        tercTotal,
        deducoes,
        lucro: item.valor_total - custoTotal - tercTotal - deducoes,
        semCusto: custoUnit == null,
      };
    };
    return (data?.itens ?? []).map(i => ({ item: i, calc: calcular(i, rascunhos[i.id]) }));
  }, [data?.itens, rascunhos, impostoPct, comissaoPct, taxaPct]);

  const totais = useMemo(() => {
    const t = { venda: 0, custo: 0, terc: 0, deducoes: 0, lucro: 0, semCusto: 0 };
    for (const { item, calc } of linhas) {
      t.venda += item.valor_total;
      t.custo += calc.custoTotal;
      t.terc += calc.tercTotal;
      t.deducoes += calc.deducoes;
      t.lucro += calc.lucro;
      if (calc.semCusto) t.semCusto += 1;
    }
    return t;
  }, [linhas]);

  const setRascunho = (id: string, patch: Partial<Rascunho>) =>
    setRascunhos(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const gravar = async (conferir: boolean) => {
    if (!data?.venda) return;
    setSalvando(true);
    try {
      await salvarVenda(data.venda.id, {
        meio_pagamento_id: meioId || null,
        imposto_pct: paraNumero(impostoTexto),
        comissao_pct: paraNumero(comissaoTexto),
        taxa_cartao_pct: paraNumero(taxaTexto),
        ...(conferir ? { conferido_em: new Date().toISOString() } : {}),
      });

      for (const { item, calc } of linhas) {
        const r = rascunhos[item.id];
        if (!r) continue;
        const custoDigitado = paraNumero(r.custoTexto);
        const tercDigitada = paraNumero(r.terceirizadaTexto);
        const mudouCusto = custoDigitado !== item.custo_override;
        const mudouTerc = (tercDigitada ?? 0) !== (item.terceirizada_unit ?? 0);
        if (mudouCusto || mudouTerc) {
          await salvarItemVenda(item.id, {
            ...(mudouCusto ? { custo_unitario: custoDigitado } : {}),
            ...(mudouTerc ? { terceirizada_unit: tercDigitada } : {}),
          });
        }
        /* Propaga para o catálogo: é o que faz o próximo pedido com o mesmo
           produto já nascer com custo, em vez de redigitar 608 vezes. */
        if (mudouCusto && custoDigitado != null && r.aoCatalogo && item.produto_nome) {
          await salvarCustoProduto(item.produto_nome, custoDigitado, item.calcme_produto_id);
        }
      }

      toast.success(conferir ? "Venda conferida." : "Alterações salvas.");
      await refetch();
      onSalvo?.();
      if (conferir) onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const v = data?.venda;
  const semItens = !isLoading && (data?.itens.length ?? 0) === 0;

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onOpenChange(false)}>
      <DialogContent className="sistema-theme sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pedido {v?.numero ?? "—"}
            {v?.conferido_em && (
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--gw-success-soft)", color: "var(--gw-success)" }}>
                <CheckCircle2 className="h-3 w-3" /> conferida
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {v?.cliente_nome ?? "—"} · {dataBR(v?.data)} · {brl(v?.valor_total ?? 0)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : semItens ? (
          <div className="flex gap-2 rounded-lg p-3 text-[13px]"
               style={{ background: "var(--gw-warning-soft)", color: "var(--gw-text)" }}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-px" style={{ color: "var(--gw-warning)" }} />
            <span>
              Os itens deste pedido ainda não foram sincronizados do Calcme. Volte ao Dashboard e
              clique em <strong>Sincronizar</strong> — os itens vêm em lotes de 120 por vez.
            </span>
          </div>
        ) : (
          <>
            {/* ── Pagamento e deduções ─────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="gw-label block mb-1">Forma de pagamento</label>
                <Select value={meioId} onValueChange={id => {
                  setMeioId(id);
                  /* Ao trocar a forma, a taxa dela passa a valer — some o valor
                     antigo do campo para não parecer que ainda está fixado. */
                  setTaxaTexto("");
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {data?.meios_pagamento.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                        {m.taxa_pct > 0 && (
                          <span style={{ color: "var(--gw-text-muted)" }}> · {m.taxa_pct}%</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="gw-label block mb-1">Imposto %</label>
                <Input inputMode="decimal" value={impostoTexto} placeholder="8,04"
                       onChange={e => setImpostoTexto(e.target.value)} />
              </div>
              <div>
                <label className="gw-label block mb-1">Comissão %</label>
                <Input inputMode="decimal" value={comissaoTexto} placeholder="0"
                       onChange={e => setComissaoTexto(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[12px] -mt-1" style={{ color: "var(--gw-text-secondary)" }}>
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                Taxa de cartão em vigor: <strong>{taxaPct}%</strong>
                {meioSelecionado && paraNumero(taxaTexto) == null && (
                  <> — vindo de <strong>{meioSelecionado.nome}</strong></>
                )}
              </span>
              <Input
                inputMode="decimal"
                value={taxaTexto}
                placeholder="sobrescrever"
                className="h-7 w-[130px] ml-auto"
                onChange={e => setTaxaTexto(e.target.value)}
              />
            </div>

            {/* ── Itens ────────────────────────────────────────────── */}
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--gw-border)" }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-muted)" }}>
                    <th className="text-left font-medium p-2">Produto</th>
                    <th className="text-right font-medium p-2 w-[56px]">Qtd</th>
                    <th className="text-right font-medium p-2 w-[92px]">Venda un.</th>
                    <th className="text-right font-medium p-2 w-[112px]">Custo un.</th>
                    <th className="text-right font-medium p-2 w-[112px]">Terceir. un.</th>
                    <th className="text-right font-medium p-2 w-[110px]">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ item, calc }) => {
                    const r = rascunhos[item.id];
                    return (
                      <tr key={item.id} style={{ borderTop: "1px solid var(--gw-border)" }}>
                        <td className="p-2 max-w-[260px]">
                          <div className="truncate" title={item.produto_nome ?? ""}>
                            {item.produto_nome ?? "—"}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {calc.semCusto ? (
                              <span className="text-[10px] px-1 rounded"
                                    style={{ background: "var(--gw-warning-soft)", color: "var(--gw-warning)" }}>
                                sem custo
                              </span>
                            ) : item.custo_fonte !== "item" && !paraNumero(r?.custoTexto ?? "") ? (
                              <span className="text-[10px]" style={{ color: "var(--gw-text-muted)" }}>
                                custo do catálogo
                              </span>
                            ) : null}
                            {paraNumero(r?.custoTexto ?? "") != null && (
                              <label className="flex items-center gap-1 text-[10px] cursor-pointer"
                                     style={{ color: "var(--gw-text-muted)" }}>
                                <Checkbox
                                  className="h-3 w-3"
                                  checked={r?.aoCatalogo ?? true}
                                  onCheckedChange={c => setRascunho(item.id, { aoCatalogo: c === true })}
                                />
                                salvar no catálogo
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right gw-tnum">{item.quantidade}</td>
                        <td className="p-2 text-right gw-tnum" style={{ color: "var(--gw-text-secondary)" }}>
                          {brl(item.valor_unitario)}
                        </td>
                        <td className="p-2">
                          <Input
                            inputMode="decimal"
                            className="h-8 text-right"
                            value={r?.custoTexto ?? ""}
                            placeholder={item.custo_unitario != null ? texto(item.custo_unitario) : "—"}
                            onChange={e => setRascunho(item.id, { custoTexto: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            inputMode="decimal"
                            className="h-8 text-right"
                            value={r?.terceirizadaTexto ?? ""}
                            placeholder="0"
                            onChange={e => setRascunho(item.id, { terceirizadaTexto: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-right gw-tnum"
                            style={{ color: calc.lucro < 0 ? "var(--gw-danger)" : "var(--gw-text)" }}>
                          {brl(calc.lucro)}
                          <div className="text-[10px]" style={{ color: "var(--gw-text-muted)" }}>
                            {item.valor_total > 0 ? `${((calc.lucro / item.valor_total) * 100).toFixed(0)}%` : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Fechamento ───────────────────────────────────────── */}
            <div className="rounded-lg border p-3 grid gap-1"
                 style={{ borderColor: "var(--gw-border)", background: "var(--gw-surface-alt)" }}>
              {[
                ["Venda", totais.venda, false],
                ["Custo dos produtos", totais.custo, true],
                ["Terceirização", totais.terc, true],
                [`Imposto + comissão + cartão (${(impostoPct + comissaoPct + taxaPct).toFixed(2)}%)`, totais.deducoes, true],
              ].map(([label, valor, neg]) => (
                <div key={label as string} className="flex justify-between text-[13px]">
                  <span style={{ color: "var(--gw-text-secondary)" }}>{neg ? "− " : ""}{label as string}</span>
                  <span className="gw-tnum">{brl(valor as number)}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline pt-2 mt-1"
                   style={{ borderTop: "1px solid var(--gw-border)" }}>
                <span className="gw-body-strong">Lucro do pedido</span>
                <span className="gw-num text-[17px]"
                      style={{ color: totais.lucro < 0 ? "var(--gw-danger)" : "var(--gw-text)" }}>
                  {brl(totais.lucro)}
                  <span className="ml-2 text-[13px]" style={{ color: "var(--gw-text-muted)" }}>
                    {totais.venda > 0 ? `${((totais.lucro / totais.venda) * 100).toFixed(1)}%` : "—"}
                  </span>
                </span>
              </div>
              {totais.semCusto > 0 && (
                <p className="text-[12px] mt-1" style={{ color: "var(--gw-warning)" }}>
                  {totais.semCusto} item(ns) sem custo — entram como zero, então este lucro está
                  otimista demais.
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          {v?.conferido_em && (
            <Button
              variant="ghost"
              onClick={async () => {
                await salvarVenda(v.id, { conferido_em: null });
                toast.success("Conferência desfeita.");
                await refetch();
                onSalvo?.();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Reabrir
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" onClick={() => void gravar(false)} disabled={salvando || semItens}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
          <Button onClick={() => void gravar(true)} disabled={salvando || semItens}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Salvar e conferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
