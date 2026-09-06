/* Gráficos do financeiro em SVG puro.
 *
 * O projeto não tem biblioteca de charts e um dashboard de 3 gráficos não
 * justifica somar ~100 kB ao bundle. Tudo aqui usa as variáveis --gw-* do
 * design system do sistema. */

import { useId, useMemo, useState } from "react";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_CURTO = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});

const diaDoMes = (iso: string) => Number(String(iso).slice(8, 10));

export interface SerieConfig {
  chave: string;
  label: string;
  cor: string;
  /** Área preenchida sob a linha. Só a série principal usa, senão vira sopa. */
  preenchida?: boolean;
}

interface GraficoDiarioProps {
  dados: Record<string, number | string>[];
  series: SerieConfig[];
  altura?: number;
}

/**
 * Linhas diárias com foco no ponto sob o cursor.
 *
 * O eixo Y começa sempre em zero: um eixo truncado faz uma variação de 2%
 * parecer um desabamento, e aqui os números viram decisão de dinheiro.
 */
export function GraficoDiario({ dados, series, altura = 220 }: GraficoDiarioProps) {
  const id = useId();
  const [foco, setFoco] = useState<number | null>(null);

  const L = 52, R = 12, T = 12, B = 26;   // margens internas
  const W = 720;                           // largura do viewBox
  const H = altura;
  const larguraPlot = W - L - R;
  const alturaPlot = H - T - B;

  const max = useMemo(() => {
    let m = 0;
    for (const p of dados) {
      for (const s of series) m = Math.max(m, Number(p[s.chave]) || 0);
    }
    // Teto com folga de 10% para a linha não encostar no topo.
    return m > 0 ? m * 1.1 : 1;
  }, [dados, series]);

  if (dados.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height: altura, color: "var(--gw-text-muted)" }}>
        Sem movimento no período.
      </div>
    );
  }

  const x = (i: number) =>
    L + (dados.length === 1 ? larguraPlot / 2 : (i / (dados.length - 1)) * larguraPlot);
  const y = (v: number) => T + alturaPlot - (v / max) * alturaPlot;

  const linha = (chave: string) =>
    dados.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(p[chave]) || 0).toFixed(1)}`).join(" ");

  const area = (chave: string) =>
    `${linha(chave)} L${x(dados.length - 1).toFixed(1)},${(T + alturaPlot).toFixed(1)} L${x(0).toFixed(1)},${(T + alturaPlot).toFixed(1)} Z`;

  const grade = [0, 0.25, 0.5, 0.75, 1];
  const pontoFoco = foco != null ? dados[foco] : null;

  /* Rótulos do eixo X sem sobreposição em meses de 31 dias. */
  const passoRotulo = Math.max(1, Math.ceil(dados.length / 10));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: altura }}
        role="img"
        aria-label={`Evolução diária de ${series.map(s => s.label).join(", ")}`}
        onMouseLeave={() => setFoco(null)}
      >
        <defs>
          {series.filter(s => s.preenchida).map(s => (
            <linearGradient key={s.chave} id={`${id}-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.cor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.cor} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* grade horizontal + eixo Y */}
        {grade.map(g => {
          const gy = T + alturaPlot - g * alturaPlot;
          return (
            <g key={g}>
              <line x1={L} y1={gy} x2={W - R} y2={gy} stroke="var(--gw-border)" strokeWidth="1" />
              <text x={L - 8} y={gy + 4} textAnchor="end" fontSize="10" fill="var(--gw-text-muted)">
                {BRL_CURTO.format(max * g)}
              </text>
            </g>
          );
        })}

        {/* eixo X */}
        {dados.map((p, i) => (
          i % passoRotulo === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--gw-text-muted)">
              {diaDoMes(String(p.dia))}
            </text>
          ) : null
        ))}

        {series.filter(s => s.preenchida).map(s => (
          <path key={`a-${s.chave}`} d={area(s.chave)} fill={`url(#${id}-${s.chave})`} />
        ))}
        {series.map(s => (
          <path
            key={`l-${s.chave}`}
            d={linha(s.chave)}
            fill="none"
            stroke={s.cor}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* marcador do dia sob o cursor */}
        {foco != null && (
          <>
            <line x1={x(foco)} y1={T} x2={x(foco)} y2={T + alturaPlot} stroke="var(--gw-border-strong)" strokeWidth="1" />
            {series.map(s => (
              <circle
                key={`p-${s.chave}`}
                cx={x(foco)}
                cy={y(Number(dados[foco][s.chave]) || 0)}
                r="3.5"
                fill="var(--gw-surface)"
                stroke={s.cor}
                strokeWidth="2"
              />
            ))}
          </>
        )}

        {/* faixas invisíveis de captura do cursor */}
        {dados.map((_, i) => (
          <rect
            key={`h-${i}`}
            x={x(i) - larguraPlot / Math.max(1, dados.length) / 2}
            y={T}
            width={larguraPlot / Math.max(1, dados.length)}
            height={alturaPlot}
            fill="transparent"
            onMouseEnter={() => setFoco(i)}
          />
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-4 px-1 pt-1">
        {series.map(s => (
          <span key={s.chave} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--gw-text-secondary)" }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.cor }} />
            {s.label}
            {pontoFoco && (
              <strong className="gw-tnum ml-1" style={{ color: "var(--gw-text)" }}>
                {BRL.format(Number(pontoFoco[s.chave]) || 0)}
              </strong>
            )}
          </span>
        ))}
        {pontoFoco && (
          <span className="text-[11px] ml-auto" style={{ color: "var(--gw-text-muted)" }}>
            dia {diaDoMes(String(pontoFoco.dia))}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Barra realizado × previsto ───────────────────────────────────────── */

interface BarraOrcamentoProps {
  label: string;
  realizado: number;
  previsto: number;
  cor?: string | null;
  /** Categoria já deduzida por item: o realizado vem da venda, não de lançamento. */
  automatica?: boolean;
}

export function BarraOrcamento({ label, realizado, previsto, cor, automatica }: BarraOrcamentoProps) {
  const base = previsto > 0 ? previsto : realizado;
  const pct = base > 0 ? (realizado / base) * 100 : 0;
  const estourou = previsto > 0 && realizado > previsto;
  const corBarra = estourou ? "var(--gw-danger)" : (cor || "var(--gw-primary)");

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[13px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
          {label}
          {automatica && (
            <span className="ml-1.5 text-[10px] px-1 py-px rounded"
                  style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-muted)" }}>
              por item
            </span>
          )}
        </span>
        <span className="gw-tnum text-[12px] shrink-0" style={{ color: estourou ? "var(--gw-danger)" : "var(--gw-text)" }}>
          {BRL.format(realizado)}
          {previsto > 0 && (
            <span style={{ color: "var(--gw-text-muted)" }}> / {BRL.format(previsto)}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gw-surface-alt)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: corBarra }}
        />
      </div>
    </div>
  );
}

/* ── Composição do resultado (barras horizontais) ─────────────────────── */

export function BarrasCategoria({
  dados,
}: {
  dados: { categoria: string; cor: string; valor: number }[];
}) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: "var(--gw-text-muted)" }}>
        Nenhuma despesa lançada no período.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {dados.map(d => (
        <div key={d.categoria}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[13px] truncate" style={{ color: "var(--gw-text-secondary)" }}>{d.categoria}</span>
            <span className="gw-tnum text-[12px] shrink-0" style={{ color: "var(--gw-text)" }}>
              {BRL.format(d.valor)}
              <span className="ml-1.5" style={{ color: "var(--gw-text-muted)" }}>
                {((d.valor / total) * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gw-surface-alt)" }}>
            <div className="h-full rounded-full" style={{ width: `${(d.valor / total) * 100}%`, background: d.cor }} />
          </div>
        </div>
      ))}
    </div>
  );
}
