/* Gráficos do painel de empate (aba "Pedidos e comissões"). SVG puro, como
 * financeiro/Graficos.tsx — o projeto não tem lib de charts. Todos têm
 * tooltip no hover (alvo = a coluna do dia inteira, maior que a barra),
 * legenda e eixo Y começando em zero. */

import { useEffect, useRef, useState, type ReactNode } from "react";

const BRL_CURTO = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});

/** Largura real do container, pra desenhar em pixels (texto não distorce). */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Topo "redondo" do eixo: 1, 2, 2.5, 5 × 10^n acima do máximo. */
function topoEixo(max: number) {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

export interface Serie { chave: string; label: string; cor: string; tracejada?: boolean }

function Legenda({ series, extra }: { series: Serie[]; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px]" style={{ color: "var(--gw-text-secondary)" }}>
      {series.map(s => (
        <span key={s.chave} className="inline-flex items-center gap-1.5">
          {s.tracejada
            ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: s.cor }} />
            : <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: s.cor }} />}
          {s.label}
        </span>
      ))}
      {extra}
    </div>
  );
}

function Tooltip({ x, largura, children }: { x: number; largura: number; children: ReactNode }) {
  const esquerda = x > largura - 190;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 rounded-lg px-3 py-2 text-[12px] shadow-lg"
      style={{
        left: esquerda ? undefined : x + 12,
        right: esquerda ? largura - x + 12 : undefined,
        background: "#0F172A", color: "#FFFFFF", minWidth: 150,
      }}
    >
      {children}
    </div>
  );
}

const LinhaTip = ({ cor, label, valor }: { cor: string; label: string; valor: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} />
      {label}
    </span>
    <span className="font-semibold tabular-nums">{valor}</span>
  </div>
);

/* ── Barras por dia do mês (agrupadas) ──────────────────────────────── */

export interface PontoDia { dia: number; fimDeSemana?: boolean; futuro?: boolean; [k: string]: number | boolean | undefined }

export function BarrasPorDia({
  dados, series, formatar, eixo = formatar, meta, rotuloDia, altura = 220,
}: {
  dados: PontoDia[];
  series: Serie[];
  formatar: (v: number) => string;
  eixo?: (v: number) => string;
  /** Linha de referência horizontal (ex.: meta diária pra empatar). */
  meta?: { valor: number; label: string; cor: string };
  rotuloDia?: (dia: number) => string;
  altura?: number;
}) {
  const [ref, W] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const L = 62, R = 8, T = 10, B = 22;
  const w = W - L - R, h = altura - T - B;
  const max = topoEixo(Math.max(meta?.valor ?? 0, ...dados.flatMap(d => series.map(s => Number(d[s.chave]) || 0))));
  const col = w / Math.max(1, dados.length);
  const gap = 2;
  const barra = Math.max(2, (col * 0.78 - gap * (series.length - 1)) / series.length);
  const y = (v: number) => T + h - (v / max) * h;
  const passo = dados.length > 20 ? (W < 520 ? 5 : 2) : 1;
  const d = foco != null ? dados[foco] : null;

  return (
    <div ref={ref} className="relative">
      <svg width={W} height={altura} role="img" aria-label={series.map(s => s.label).join(" e ") + " por dia"}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--gw-border)" strokeDasharray={f === 0 ? undefined : "2 4"} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10.5" fill="var(--gw-text-muted)">{eixo(max * f)}</text>
          </g>
        ))}
        {dados.map((p, i) => {
          const x0 = L + i * col + (col - (barra * series.length + gap * (series.length - 1))) / 2;
          return (
            <g key={p.dia} opacity={foco == null || foco === i ? 1 : 0.45}>
              {p.fimDeSemana && <rect x={L + i * col} y={T} width={col} height={h} fill="var(--gw-surface-alt)" opacity={0.6} />}
              {series.map((s, si) => {
                const v = Number(p[s.chave]) || 0;
                if (v <= 0) return null;
                const top = y(v);
                const r = Math.min(4, barra / 2);
                const x = x0 + si * (barra + gap);
                const alt = T + h - top;
                return (
                  <path
                    key={s.chave}
                    d={`M${x},${T + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${T + h} Z`}
                    fill={s.cor}
                    opacity={alt < r ? 0.9 : 1}
                  />
                );
              })}
              {(i % passo === 0 || i === dados.length - 1) && (
                <text x={L + i * col + col / 2} y={altura - 6} textAnchor="middle" fontSize="10.5" fill="var(--gw-text-muted)">{p.dia}</text>
              )}
              <rect
                x={L + i * col} y={T} width={col} height={h} fill="transparent"
                onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}
              />
            </g>
          );
        })}
        {meta && meta.valor > 0 && (
          <g pointerEvents="none">
            <line x1={L} x2={W - R} y1={y(meta.valor)} y2={y(meta.valor)} stroke={meta.cor} strokeWidth={2} strokeDasharray="6 4" />
            <text x={W - R - 4} y={y(meta.valor) - 5} textAnchor="end" fontSize="11" fontWeight={700} fill="var(--gw-text)">
              {meta.label}: {formatar(meta.valor)}
            </text>
          </g>
        )}
      </svg>
      {d && foco != null && (
        <Tooltip x={L + foco * col + col / 2} largura={W}>
          <div className="font-semibold mb-1">{rotuloDia ? rotuloDia(d.dia) : `Dia ${d.dia}`}</div>
          {series.map(s => <LinhaTip key={s.chave} cor={s.cor} label={s.label} valor={formatar(Number(d[s.chave]) || 0)} />)}
          {meta && meta.valor > 0 && series.length === 1 && !d.fimDeSemana && (
            <div className="mt-1 text-[11px] opacity-80">
              {(Number(d[series[0].chave]) || 0) >= meta.valor ? "✓ bateu a meta do dia" : `faltou ${formatar(meta.valor - (Number(d[series[0].chave]) || 0))} p/ a meta`}
            </div>
          )}
        </Tooltip>
      )}
      <Legenda
        series={series}
        extra={meta && meta.valor > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: meta.cor }} />{meta.label}
          </span>
        ) : undefined}
      />
    </div>
  );
}

/* ── Linhas acumuladas (este mês x mês passado) ─────────────────────── */

export function LinhasAcumulado({
  dias, series, empate, hojeDia, altura = 240, rotuloDia,
}: {
  dias: number;
  /** valores[d-1] = acumulado até o dia d; null = dia ainda não chegou. */
  series: (Serie & { valores: (number | null)[] })[];
  empate?: number;
  hojeDia?: number | null;
  altura?: number;
  rotuloDia?: (dia: number) => string;
}) {
  const [ref, W] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const L = 64, R = 10, T = 14, B = 22;
  const w = W - L - R, h = altura - T - B;
  const max = topoEixo(Math.max(empate ?? 0, ...series.flatMap(s => s.valores.map(v => v ?? 0))));
  const x = (dia: number) => L + ((dia - 1) / Math.max(1, dias - 1)) * w;
  const y = (v: number) => T + h - (v / max) * h;
  const passo = W < 520 ? 5 : 2;

  return (
    <div ref={ref} className="relative">
      <svg
        width={W} height={altura} role="img" aria-label="Vendido acumulado no mês"
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const dia = Math.round(((e.clientX - r.left - L) / w) * (dias - 1)) + 1;
          setFoco(dia >= 1 && dia <= dias ? dia : null);
        }}
        onMouseLeave={() => setFoco(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--gw-border)" strokeDasharray={f === 0 ? undefined : "2 4"} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10.5" fill="var(--gw-text-muted)">{BRL_CURTO.format(max * f)}</text>
          </g>
        ))}
        {Array.from({ length: dias }, (_, i) => i + 1).filter(d => d === 1 || d % passo === 0).map(d => (
          <text key={d} x={x(d)} y={altura - 6} textAnchor="middle" fontSize="10.5" fill="var(--gw-text-muted)">{d}</text>
        ))}
        {empate != null && empate > 0 && (
          <g>
            <line x1={L} x2={W - R} y1={y(empate)} y2={y(empate)} stroke="var(--gw-success)" strokeWidth={2} strokeDasharray="6 4" />
            <text x={L + 6} y={y(empate) - 6} fontSize="11" fontWeight={700} fill="var(--gw-text)">Empate: {BRL_CURTO.format(empate)}</text>
          </g>
        )}
        {series.map((s, si) => {
          const pts = s.valores.map((v, i) => (v == null ? null : [x(i + 1), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          if (pts.length === 0) return null;
          const linha = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
          return (
            <g key={s.chave}>
              {si === 0 && (
                <path d={`${linha} L${pts[pts.length - 1][0]},${T + h} L${pts[0][0]},${T + h} Z`} fill={s.cor} opacity={0.12} />
              )}
              <path d={linha} fill="none" stroke={s.cor} strokeWidth={2.5} strokeDasharray={s.tracejada ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {/* Rótulo direto no fim da linha */}
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill={s.cor} stroke="var(--gw-surface)" strokeWidth={2} />
            </g>
          );
        })}
        {hojeDia != null && hojeDia >= 1 && hojeDia <= dias && (
          <line x1={x(hojeDia)} x2={x(hojeDia)} y1={T} y2={T + h} stroke="var(--gw-text-muted)" strokeDasharray="2 3" />
        )}
        {foco != null && (
          <g pointerEvents="none">
            <line x1={x(foco)} x2={x(foco)} y1={T} y2={T + h} stroke="var(--gw-text-secondary)" />
            {series.map(s => {
              const v = s.valores[foco - 1];
              return v == null ? null : <circle key={s.chave} cx={x(foco)} cy={y(v)} r={4.5} fill={s.cor} stroke="var(--gw-surface)" strokeWidth={2} />;
            })}
          </g>
        )}
      </svg>
      {foco != null && (
        <Tooltip x={x(foco)} largura={W}>
          <div className="font-semibold mb-1">{rotuloDia ? rotuloDia(foco) : `Até o dia ${foco}`}</div>
          {series.map(s => {
            const v = s.valores[foco - 1];
            return <LinhaTip key={s.chave} cor={s.cor} label={s.label} valor={v == null ? "—" : BRL_CURTO.format(v)} />;
          })}
          {(() => {
            const a = series[0]?.valores[foco - 1], b = series[1]?.valores[foco - 1];
            if (a == null || b == null || b <= 0) return null;
            const dif = ((a - b) / b) * 100;
            return <div className="mt-1 text-[11px] opacity-80">{dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs mês passado</div>;
          })()}
        </Tooltip>
      )}
      <Legenda series={series} extra={empate ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--gw-success)" }} />Faturamento p/ empatar
        </span>
      ) : undefined} />
    </div>
  );
}
