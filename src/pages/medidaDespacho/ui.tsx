import type { ReactNode } from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import type { Alerta, Confianca, Fonte } from "@/lib/medidaDespacho/fontes";
import { ROTULO_FONTE } from "@/lib/medidaDespacho/fontes";

export const AZUL_ESCURO = "#0E2A57";
export const AZUL = "#1464D2";
export const VERDE = "#19A84A";

export const inputCls = (erro = false, compacto = false) =>
  `${compacto ? "h-10 rounded-lg px-2.5 text-[14px]" : "h-11 rounded-xl px-3.5 text-[15px]"} w-full border bg-slate-50 text-slate-900 outline-none transition focus:bg-white focus:ring-4 placeholder:text-slate-400 ${
    erro ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-[#1464D2] focus:ring-[#1464D2]/10"
  }`;

export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{children}</span>;
}

export function Bloco({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold tracking-tight" style={{ color: AZUL_ESCURO }}>{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function CampoNumero(props: {
  rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; erro?: boolean; compacto?: boolean; sufixo?: string;
}) {
  return (
    <label className="block min-w-0">
      <Rotulo>{props.rotulo}</Rotulo>
      <div className="relative">
        <input
          inputMode="decimal"
          value={props.valor}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
          className={inputCls(props.erro, props.compacto) + (props.sufixo ? " pr-9" : "")}
        />
        {props.sufixo && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{props.sufixo}</span>}
      </div>
    </label>
  );
}

const COR_FONTE: Record<Fonte, string> = {
  calibrado: "bg-green-100 text-green-800",
  override: "bg-purple-100 text-purple-800",
  master: "bg-blue-100 text-blue-800",
  api: "bg-slate-100 text-slate-700",
  manual: "bg-amber-100 text-amber-800",
};

export function BadgeFonte({ fonte }: { fonte: Fonte | null }) {
  if (!fonte) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Sem medida</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_FONTE[fonte]}`}>{ROTULO_FONTE[fonte]}</span>;
}

const COR_CONF: Record<Confianca, string> = { alta: "bg-green-500", media: "bg-amber-400", baixa: "bg-red-400" };
const ROT_CONF: Record<Confianca, string> = { alta: "alta", media: "média", baixa: "baixa" };

export function BadgeConfianca({ confianca }: { confianca: Confianca }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600" title="Confiança da medida">
      <span className={`h-2 w-2 rounded-full ${COR_CONF[confianca]}`} /> confiança {ROT_CONF[confianca]}
    </span>
  );
}

export function ListaAlertas({ alertas }: { alertas: Pick<Alerta, "tipo" | "texto">[] }) {
  if (!alertas.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {alertas.map((a, i) => {
        const estilo = a.tipo === "erro" ? "bg-red-50 text-red-700" : a.tipo === "aviso" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600";
        const Icone = a.tipo === "erro" ? XCircle : a.tipo === "aviso" ? AlertTriangle : Info;
        return (
          <li key={i} className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] ${estilo}`}>
            <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.texto}
          </li>
        );
      })}
    </ul>
  );
}

/** "12,5" → 12.5; vazio → null. */
export const lerNum = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined) return null;
  const t = s.trim().replace(/\./g, (m, i, str) => (str.includes(",") ? "" : m)).replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const fmtN = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
