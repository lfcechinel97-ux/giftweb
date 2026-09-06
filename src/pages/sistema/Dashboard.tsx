import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RefreshCw, Plus, TrendingUp, TrendingDown, Wallet, Receipt, AlertTriangle,
  ArrowDownRight, ArrowUpRight, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DespesaDialog from "./financeiro/DespesaDialog";
import { BarraOrcamento, BarrasCategoria, GraficoDiario } from "./financeiro/Graficos";
import { useDashboardFinanceiro } from "./financeiro/useFinanceiro";
import type { GrupoDespesa, LinhaOrcamento } from "./financeiro/types";

/* ── Formatação ───────────────────────────────────────────────────────── */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
const pct = (parte: number, total: number) =>
  total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—";
const dataBR = (iso: string) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

/* ── Períodos ─────────────────────────────────────────────────────────── */

const hojeBR = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

const iso = (d: Date) => d.toISOString().slice(0, 10);

type PeriodoId = "hoje" | "7dias" | "mes" | "mes_passado" | "ano" | "custom";

function intervaloDe(id: PeriodoId): { inicio: string; fim: string } {
  const h = hojeBR();
  switch (id) {
    case "hoje":
      return { inicio: iso(h), fim: iso(h) };
    case "7dias": {
      const i = new Date(h); i.setDate(i.getDate() - 6);
      return { inicio: iso(i), fim: iso(h) };
    }
    case "mes_passado": {
      const i = new Date(h.getFullYear(), h.getMonth() - 1, 1);
      const f = new Date(h.getFullYear(), h.getMonth(), 0);
      return { inicio: iso(i), fim: iso(f) };
    }
    case "ano":
      return { inicio: iso(new Date(h.getFullYear(), 0, 1)), fim: iso(h) };
    case "mes":
    default:
      return { inicio: iso(new Date(h.getFullYear(), h.getMonth(), 1)), fim: iso(h) };
  }
}

const PERIODO_LABEL: Record<Exclude<PeriodoId, "custom">, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  mes: "Este mês",
  mes_passado: "Mês passado",
  ano: "Este ano",
};

const GRUPO_LABEL: Record<GrupoDespesa, string> = {
  pessoal: "Pessoal",
  fixa: "Fixas",
  variavel: "Variáveis",
};

/* ── Peças ────────────────────────────────────────────────────────────── */

interface CardProps {
  label: string;
  valor: number;
  icone: React.ElementType;
  cor: string;
  rodape?: React.ReactNode;
  destaque?: boolean;
}

function CardKpi({ label, valor, icone: Icone, cor, rodape, destaque }: CardProps) {
  const negativo = valor < 0;
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        background: "var(--gw-surface)",
        borderColor: destaque ? cor : "var(--gw-border)",
        borderWidth: destaque ? 1.5 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="gw-label">{label}</span>
        <span className="rounded-md p-1" style={{ background: `${cor}1A` }}>
          <Icone className="h-3.5 w-3.5" style={{ color: cor }} />
        </span>
      </div>
      <span
        className="gw-num text-[22px] leading-none"
        style={{ color: negativo ? "var(--gw-danger)" : "var(--gw-text)" }}
      >
        {brl(valor)}
      </span>
      {rodape && <div className="text-[11px]" style={{ color: "var(--gw-text-muted)" }}>{rodape}</div>}
    </div>
  );
}

/** Uma linha do DRE. `recuo` marca as subtraídas; `total` fecha um bloco. */
function LinhaDre({
  label, valor, recuo, total, negativo, nota,
}: {
  label: string; valor: number; recuo?: boolean; total?: boolean;
  negativo?: boolean; nota?: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-1.5"
      style={total ? { borderTop: "1px solid var(--gw-border)", marginTop: 2, paddingTop: 8 } : undefined}
    >
      <span
        className={total ? "gw-body-strong" : "text-[13px]"}
        style={{
          color: total ? "var(--gw-text)" : "var(--gw-text-secondary)",
          paddingLeft: recuo ? 14 : 0,
        }}
      >
        {recuo && <span style={{ color: "var(--gw-text-muted)" }}>− </span>}
        {label}
        {nota && (
          <span className="ml-1.5 text-[11px]" style={{ color: "var(--gw-text-muted)" }}>{nota}</span>
        )}
      </span>
      <span
        className={total ? "gw-num text-[15px]" : "gw-tnum text-[13px]"}
        style={{
          color: valor < 0 ? "var(--gw-danger)"
               : negativo ? "var(--gw-text-secondary)"
               : "var(--gw-text)",
        }}
      >
        {negativo && valor > 0 ? `(${brl(valor)})` : brl(valor)}
      </span>
    </div>
  );
}

function Painel({ titulo, acao, children }: {
  titulo: string; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="gw-title text-[15px]">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/* ── Página ───────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const periodoId = (params.get("periodo") as PeriodoId) || "mes";
  const [despesaAberta, setDespesaAberta] = useState(false);

  const { inicio, fim } = useMemo(() => {
    if (periodoId === "custom") {
      const padrao = intervaloDe("mes");
      return {
        inicio: params.get("de") || padrao.inicio,
        fim: params.get("ate") || padrao.fim,
      };
    }
    return intervaloDe(periodoId);
  }, [periodoId, params]);

  const { data, isLoading, isError, error, sincronizar, sincronizando } =
    useDashboardFinanceiro(inicio, fim);

  const setPeriodo = (id: PeriodoId) => {
    const p = new URLSearchParams(params);
    p.set("periodo", id);
    if (id !== "custom") { p.delete("de"); p.delete("ate"); }
    else { p.set("de", inicio); p.set("ate", fim); }
    setParams(p, { replace: true });
  };

  const setDataCustom = (campo: "de" | "ate", valor: string) => {
    const p = new URLSearchParams(params);
    p.set("periodo", "custom");
    p.set("de", campo === "de" ? valor : inicio);
    p.set("ate", campo === "ate" ? valor : fim);
    setParams(p, { replace: true });
  };

  /* Orçamento agrupado como na previsão orçamentária da empresa. */
  const orcamentoPorGrupo = useMemo(() => {
    const g: Record<GrupoDespesa, LinhaOrcamento[]> = { pessoal: [], fixa: [], variavel: [] };
    for (const l of data?.orcamento ?? []) g[l.grupo]?.push(l);
    return g;
  }, [data?.orcamento]);

  if (isError) {
    return (
      <div className="rounded-xl border p-6" style={{ background: "var(--gw-danger-soft)", borderColor: "var(--gw-danger)" }}>
        <h2 className="gw-title mb-1" style={{ color: "var(--gw-danger)" }}>Não foi possível carregar o dashboard</h2>
        <p className="text-sm" style={{ color: "var(--gw-text-secondary)" }}>
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  const dre = data?.dre;
  const totais = data?.totais;
  const hoje = data?.hoje;
  const receita = dre?.receita_bruta ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="gw-display text-[20px]">Dashboard</h1>
          <p className="gw-meta">
            {dataBR(inicio)} a {dataBR(fim)}
            <span className="inline-flex items-center gap-1 ml-2" style={{ color: "var(--gw-success)" }}>
              <Radio className="h-3 w-3" /> ao vivo
            </span>
          </p>
        </div>

        <Select value={periodoId} onValueChange={v => setPeriodo(v as PeriodoId)}>
          <SelectTrigger className="w-[168px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODO_LABEL) as (keyof typeof PERIODO_LABEL)[]).map(k => (
              <SelectItem key={k} value={k}>{PERIODO_LABEL[k]}</SelectItem>
            ))}
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {periodoId === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={inicio} onChange={e => setDataCustom("de", e.target.value)} className="w-[148px]" />
            <span style={{ color: "var(--gw-text-muted)" }}>a</span>
            <Input type="date" value={fim} onChange={e => setDataCustom("ate", e.target.value)} className="w-[148px]" />
          </div>
        )}

        <Button variant="outline" onClick={() => void sincronizar()} disabled={sincronizando}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sincronizando ? "animate-spin" : ""}`} />
          {sincronizando ? "Sincronizando" : "Sincronizar"}
        </Button>
        <Button onClick={() => setDespesaAberta(true)}>
          <Plus className="h-4 w-4 mr-2" /> Lançar despesa
        </Button>
      </header>

      {isLoading && !data ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-28 rounded-xl bg-muted" />)}
        </div>
      ) : (
        <>
          {/* ── KPIs ──────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <CardKpi
              label="Vendido" valor={receita} icone={TrendingUp} cor="var(--gw-primary)"
              rodape={<>{totais?.pedidos ?? 0} pedidos · ticket {brl(totais?.ticket ?? 0)}</>}
            />
            <CardKpi
              label="Entrou no caixa" valor={totais?.recebido ?? 0} icone={ArrowDownRight} cor="var(--gw-violet)"
              rodape={<>hoje {brl(hoje?.recebido ?? 0)}</>}
            />
            <CardKpi
              label="Lucro das vendas" valor={dre?.margem_contribuicao ?? 0} icone={Wallet} cor="var(--gw-indigo)"
              rodape={<>margem {pct(dre?.margem_contribuicao ?? 0, receita)} · já sem imposto e custo</>}
            />
            <CardKpi
              label="Despesas" valor={dre?.despesas ?? 0} icone={ArrowUpRight} cor="var(--gw-warning)"
              rodape={<>hoje {brl(hoje?.despesas ?? 0)}</>}
            />
            <CardKpi
              label="Resultado" valor={dre?.resultado ?? 0} icone={Receipt}
              cor={(dre?.resultado ?? 0) >= 0 ? "var(--gw-success)" : "var(--gw-danger)"}
              destaque
              rodape={<>lucro das vendas menos despesas</>}
            />
          </div>

          {/* ── Aviso de cobertura de custo ───────────────────────── */}
          {((totais?.itens_sem_custo ?? 0) > 0 || (totais?.pedidos_sem_itens ?? 0) > 0) && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-[13px]"
              style={{ background: "var(--gw-warning-soft)", borderColor: "var(--gw-warning)", color: "var(--gw-text)" }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--gw-warning)" }} />
              <span>
                {(totais?.itens_sem_custo ?? 0) > 0 && (
                  <>
                    <strong>{totais?.itens_sem_custo}</strong> de {totais?.itens_total} itens vendidos
                    ainda não têm custo cadastrado{" "}
                    ({data?.geral.produtos_sem_custo} produto(s) distintos).{" "}
                  </>
                )}
                {(totais?.pedidos_sem_itens ?? 0) > 0 && (
                  <><strong>{totais?.pedidos_sem_itens}</strong> pedido(s) ainda sem itens sincronizados. </>
                )}
                O lucro acima está <strong>superestimado</strong> enquanto isso — item sem custo entra como zero.
              </span>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              {/* ── Gráfico diário ──────────────────────────────── */}
              <Painel titulo="Movimento diário">
                <GraficoDiario
                  dados={(data?.serie ?? []) as unknown as Record<string, number | string>[]}
                  series={[
                    { chave: "vendido", label: "Vendido", cor: "var(--gw-primary)", preenchida: true },
                    { chave: "recebido", label: "Entrou", cor: "var(--gw-violet)" },
                    { chave: "despesas", label: "Despesas", cor: "var(--gw-danger)" },
                  ]}
                />
              </Painel>

              {/* ── Previsto x realizado ────────────────────────── */}
              <Painel
                titulo="Orçamento do mês"
                acao={
                  data?.orcamento_competencia && (
                    <span className="gw-meta">
                      previsão de {dataBR(data.orcamento_competencia).slice(3)}
                    </span>
                  )
                }
              >
                {(data?.orcamento?.length ?? 0) === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--gw-text-muted)" }}>
                    Nenhuma previsão cadastrada e nenhuma despesa lançada no período.
                  </p>
                ) : (
                  <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                    {(["pessoal", "fixa", "variavel"] as GrupoDespesa[]).map(g => (
                      orcamentoPorGrupo[g].length > 0 && (
                        <div key={g} className={g === "variavel" ? "md:col-span-2" : ""}>
                          <h3 className="gw-label mt-2 mb-1">{GRUPO_LABEL[g]}</h3>
                          <div className={g === "variavel" ? "grid gap-x-8 md:grid-cols-2" : ""}>
                            {orcamentoPorGrupo[g].map(l => (
                              <BarraOrcamento
                                key={l.id}
                                label={l.categoria}
                                realizado={l.realizado}
                                previsto={l.previsto}
                                cor={l.cor}
                                automatica={l.deduzida_na_venda}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </Painel>

              {/* ── Maiores pedidos ─────────────────────────────── */}
              <Painel titulo="Maiores pedidos do período">
                {(data?.top_vendas?.length ?? 0) === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--gw-text-muted)" }}>
                    Nenhum pedido no período.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr style={{ color: "var(--gw-text-muted)" }}>
                          <th className="text-left font-medium pb-2">Pedido</th>
                          <th className="text-left font-medium pb-2">Cliente</th>
                          <th className="text-right font-medium pb-2">Venda</th>
                          <th className="text-right font-medium pb-2">Custo</th>
                          <th className="text-right font-medium pb-2">Lucro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.top_vendas.map(v => (
                          <tr key={v.id} style={{ borderTop: "1px solid var(--gw-border)" }}>
                            <td className="py-2 gw-tnum">{v.numero ?? "—"}</td>
                            <td className="py-2 max-w-[220px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
                              {v.cliente_nome ?? "—"}
                            </td>
                            <td className="py-2 text-right gw-tnum">{brl(v.valor_total)}</td>
                            <td className="py-2 text-right gw-tnum" style={{ color: "var(--gw-text-secondary)" }}>
                              {v.sem_itens || v.itens_sem_custo > 0
                                ? <span title="Custo incompleto: há itens sem custo cadastrado.">
                                    {brl(v.cmv)} <AlertTriangle className="h-3 w-3 inline" style={{ color: "var(--gw-warning)" }} />
                                  </span>
                                : brl(v.cmv)}
                            </td>
                            <td className="py-2 text-right gw-tnum"
                                style={{ color: v.lucro < 0 ? "var(--gw-danger)" : "var(--gw-text)" }}>
                              {brl(v.lucro)}
                              <span className="ml-1.5" style={{ color: "var(--gw-text-muted)" }}>
                                {pct(v.lucro, v.valor_total)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Painel>
            </div>

            {/* ── Coluna direita ─────────────────────────────────── */}
            <div className="space-y-4">
              {/* DRE */}
              <Painel titulo="Como o resultado se forma">
                <LinhaDre label="Receita bruta" valor={receita} />
                <LinhaDre label="Imposto" valor={dre?.imposto ?? 0} recuo negativo
                          nota={receita > 0 ? pct(dre?.imposto ?? 0, receita) : undefined} />
                <LinhaDre label="Comissão" valor={dre?.comissao ?? 0} recuo negativo />
                <LinhaDre label="Taxa de cartão" valor={dre?.taxa_cartao ?? 0} recuo negativo />
                <LinhaDre label="Custo dos produtos" valor={dre?.cmv ?? 0} recuo negativo
                          nota={receita > 0 ? pct(dre?.cmv ?? 0, receita) : undefined} />
                <LinhaDre label="Terceirização" valor={dre?.terceirizada ?? 0} recuo negativo />
                <LinhaDre label="Lucro das vendas" valor={dre?.margem_contribuicao ?? 0} total />

                <div className="h-2" />
                <LinhaDre label="Pessoal" valor={dre?.despesa_pessoal ?? 0} recuo negativo />
                <LinhaDre label="Despesas fixas" valor={dre?.despesa_fixa ?? 0} recuo negativo />
                <LinhaDre label="Despesas variáveis" valor={dre?.despesa_variavel ?? 0} recuo negativo />
                <LinhaDre label="Resultado do período" valor={dre?.resultado ?? 0} total />

                <p className="gw-meta mt-3 pt-3" style={{ borderTop: "1px dashed var(--gw-border)" }}>
                  Imposto, comissão e taxa de cartão saem do lucro de cada item, com o percentual
                  do pedido — não são despesas a lançar.
                </p>
              </Painel>

              {/* Caixa */}
              <Painel titulo="Caixa do período">
                <LinhaDre label="Entrou" valor={totais?.recebido ?? 0} />
                <LinhaDre label="Saiu" valor={totais?.despesas ?? 0} recuo negativo />
                <LinhaDre label="Saldo" valor={totais?.caixa ?? 0} total />
                <p className="gw-meta mt-2">
                  Dinheiro que de fato entrou e saiu — diferente do vendido, que conta o pedido
                  na data em que foi fechado.
                </p>
              </Painel>

              {/* Despesas por categoria */}
              <Painel titulo="Para onde foi o dinheiro">
                <BarrasCategoria dados={data?.despesas_por_categoria ?? []} />
              </Painel>

              {/* Últimos lançamentos */}
              <Painel
                titulo="Últimos lançamentos"
                acao={
                  <Button size="sm" variant="ghost" onClick={() => setDespesaAberta(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Lançar
                  </Button>
                }
              >
                {(data?.ultimas_despesas?.length ?? 0) === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--gw-text-muted)" }}>
                    Nada lançado ainda.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data?.ultimas_despesas.map(d => (
                      <li key={d.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate flex items-center gap-2 min-w-0">
                          <span className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ background: d.cor ?? "var(--gw-text-muted)" }} />
                          <span className="truncate">{d.descricao}</span>
                          {d.origem === "calcme" && (
                            <span className="text-[10px] px-1 rounded shrink-0"
                                  style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-muted)" }}>
                              Calcme
                            </span>
                          )}
                        </span>
                        <span className="gw-tnum shrink-0" style={{ color: "var(--gw-text-secondary)" }}>
                          {dataBR(d.data).slice(0, 5)} · {brl(d.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Painel>

              {/* Rodapé de contexto */}
              <div className="rounded-xl border p-3 text-[12px] space-y-1"
                   style={{ background: "var(--gw-surface-alt)", borderColor: "var(--gw-border)", color: "var(--gw-text-secondary)" }}>
                <div className="flex justify-between gap-3">
                  <span>Vendido acumulado</span>
                  <span className="gw-tnum">{brl(data?.geral.vendido_total ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Recebido acumulado</span>
                  <span className="gw-tnum">{brl(data?.geral.recebido_total ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Última sincronização</span>
                  <span className="gw-tnum">
                    {data?.geral.ultima_sync
                      ? new Date(data.geral.ultima_sync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "nunca"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <DespesaDialog open={despesaAberta} onOpenChange={setDespesaAberta} />
    </div>
  );
}
