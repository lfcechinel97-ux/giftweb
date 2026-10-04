import type { Tecnica } from "./types";

/* Linguagem visual do Mockup Studio -- reaproveita os tokens --gw-* do
   design system do /sistema, com acentos mais vivos nas ações. */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none";

export const ui = {
  pagina: "max-w-4xl mx-auto py-8 px-4 sm:px-6",
  card: "bg-white rounded-2xl border border-[var(--gw-border)] shadow-[var(--gw-shadow-md)]",
  titulo: "font-['Plus_Jakarta_Sans',Inter,sans-serif] font-bold tracking-tight text-xl text-[var(--gw-text)]",
  subtitulo: "text-sm text-[var(--gw-text-muted)] mt-1",
  rotulo: "text-[11px] font-semibold uppercase tracking-wider text-[var(--gw-text-label)] mb-2",
  btnPrimario:
    `${btnBase} text-white bg-gradient-to-r from-[#2563EB] to-[#5B52E8] shadow-[0_6px_16px_-6px_rgba(37,99,235,.6)] ` +
    "hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,.75)] hover:brightness-110",
  btnSecundario:
    `${btnBase} bg-white text-[var(--gw-text)] border border-[var(--gw-border-strong)] hover:bg-[var(--gw-surface-alt)] hover:border-[#2563EB]/40`,
  btnIA:
    `${btnBase} text-[#6D28D9] bg-[var(--gw-violet-soft)] border border-[#7C5CFF]/30 hover:bg-[#E9E2FF]`,
  btnSucesso:
    `${btnBase} text-white bg-gradient-to-r from-[#0EA36B] to-[#10B981] shadow-[0_6px_16px_-6px_rgba(14,163,107,.6)] hover:brightness-110`,
  erro: "flex items-start gap-2 text-sm text-[var(--gw-danger)] bg-[var(--gw-danger-soft)] border border-[#E5484D]/25 rounded-xl px-3 py-2",
} as const;

export const COR_TECNICA: Record<Tecnica, { fundo: string; texto: string; borda: string; solido: string }> = {
  laser: { fundo: "bg-slate-100", texto: "text-slate-700", borda: "border-slate-400", solido: "from-slate-500 to-slate-700" },
  dtf_uv: { fundo: "bg-[#F1EDFF]", texto: "text-[#6D28D9]", borda: "border-[#7C5CFF]", solido: "from-[#7C5CFF] to-[#C026D3]" },
  dtf_textil: { fundo: "bg-[#FFF1E6]", texto: "text-[#C2410C]", borda: "border-[#F76B15]", solido: "from-[#F76B15] to-[#F5A524]" },
};
