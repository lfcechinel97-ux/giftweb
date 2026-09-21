import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ShoppingCart, FileText, Percent, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GraficoDiario } from "./financeiro/Graficos";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

interface PainelComercial {
  inicio: string;
  fim: string;
  vendido_bruto: number;
  vendido_liquido: number;
  pedidos: number;
  ticket: number;
  orcamentos: number;
  orcamentos_aprovados: number;
  orcamentos_valor: number;
  serie: { dia: string; vendido: number; pedidos: number }[];
  maiores: { numero: string | null; cliente_nome: string | null; valor_liquido: number }[];
}

function Kpi({ label, valor, icone: Icone, cor, rodape }: {
  label: string; valor: string; icone: typeof TrendingUp; cor: string; rodape?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icone className="h-4 w-4" style={{ color: cor }} />
        <span className="gw-label">{label}</span>
      </div>
      <p className="gw-num text-[22px] leading-none" style={{ color: cor, fontWeight: 700 }}>{valor}</p>
      {rodape && <p className="gw-meta mt-1.5">{rodape}</p>}
    </div>
  );
}

/* Sempre o mês corrente: vira no dia 1, sem seletor de período. */
export default function DashboardComercial() {
  const { data, isLoading, isError } = useQuery<PainelComercial>({
    queryKey: ["sistema", "dashboard-comercial"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("sistema_dashboard_comercial");
      if (error) throw error;
      return data as PainelComercial;
    },
  });

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const conversao = data && data.orcamentos > 0
    ? `${Math.round((data.orcamentos_aprovados / data.orcamentos) * 100)}%`
    : "—";

  if (isError) {
    return (
      <div className="rounded-xl border p-6" style={{ background: "var(--gw-danger-soft)", borderColor: "var(--gw-danger)" }}>
        <h2 className="gw-title mb-1" style={{ color: "var(--gw-danger)" }}>Não foi possível carregar o painel</h2>
        <p className="text-sm" style={{ color: "var(--gw-text-secondary)" }}>Tente recarregar a página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="gw-display text-[20px]">Meu mês</h1>
        <p className="gw-meta">
          {mes.charAt(0).toUpperCase() + mes.slice(1)}
          {data && <> · {dataBR(data.inicio)} a {dataBR(data.fim)}</>}
        </p>
      </header>

      {isLoading && !data ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-28 rounded-xl bg-muted" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi
              label="Vendido no mês" valor={brl(data?.vendido_liquido ?? 0)} icone={TrendingUp} cor="var(--gw-primary)"
              rodape={<>{data?.pedidos ?? 0} pedido(s)</>}
            />
            <Kpi label="Ticket médio" valor={brl(data?.ticket ?? 0)} icone={Receipt} cor="var(--gw-indigo)" />
            <Kpi
              label="Orçamentos" valor={String(data?.orcamentos ?? 0)} icone={FileText} cor="var(--gw-violet)"
              rodape={<>{brl(data?.orcamentos_valor ?? 0)} em propostas</>}
            />
            <Kpi
              label="Aprovados" valor={String(data?.orcamentos_aprovados ?? 0)} icone={ShoppingCart} cor="var(--gw-success)"
              rodape={<>de {data?.orcamentos ?? 0} enviados</>}
            />
            <Kpi
              label="Conversão" valor={conversao} icone={Percent} cor="var(--gw-warning)"
              rodape={<>orçamentos que viraram pedido</>}
            />
          </div>

          <section className="rounded-xl border p-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
            <h2 className="gw-title text-[15px] mb-3">Vendas por dia</h2>
            <GraficoDiario
              dados={(data?.serie ?? []) as unknown as Record<string, number | string>[]}
              series={[{ chave: "vendido", label: "Vendido", cor: "var(--gw-primary)", preenchida: true }]}
            />
          </section>

          <section className="rounded-xl border p-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
            <h2 className="gw-title text-[15px] mb-3">Maiores pedidos do mês</h2>
            {(data?.maiores?.length ?? 0) === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--gw-text-muted)" }}>
                Nenhum pedido fechado neste mês ainda.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--gw-text-muted)" }}>
                    <th className="text-left font-medium pb-2">Pedido</th>
                    <th className="text-left font-medium pb-2">Cliente</th>
                    <th className="text-right font-medium pb-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.maiores.map((m, i) => (
                    <tr key={`${m.numero}-${i}`} style={{ borderTop: "1px solid var(--gw-border)" }}>
                      <td className="py-2 gw-tnum">{m.numero ?? "—"}</td>
                      <td className="py-2 max-w-[260px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
                        {m.cliente_nome ?? "—"}
                      </td>
                      <td className="py-2 text-right gw-tnum">{brl(m.valor_liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
