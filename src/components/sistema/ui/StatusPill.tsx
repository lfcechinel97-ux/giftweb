import { cn } from "@/lib/utils";

export type GwStage =
  | "organizando"
  | "pronto"
  | "teste"
  | "preparacao"
  | "producao"
  | "embalagem"
  | "coleta"
  | "enviado"
  | "cancelado";

/** Cor cheia de cada etapa (via CSS custom properties do design system). */
export const STAGE_COLOR: Record<GwStage, string> = {
  organizando: "var(--gw-stage-organizando)",
  pronto: "var(--gw-stage-pronto)",
  teste: "var(--gw-stage-teste)",
  preparacao: "var(--gw-stage-preparacao)",
  producao: "var(--gw-stage-producao)",
  embalagem: "var(--gw-stage-embalagem)",
  coleta: "var(--gw-stage-coleta)",
  enviado: "var(--gw-stage-enviado)",
  cancelado: "var(--gw-stage-cancelado)",
};

interface StatusPillProps {
  status: GwStage;
  label?: string;
  variant?: "solid" | "soft";
  className?: string;
}

export function StatusPill({ status, label, variant = "soft", className }: StatusPillProps) {
  const color = STAGE_COLOR[status];
  const style =
    variant === "solid"
      ? { background: color, color: "#FFFFFF" }
      : { background: `color-mix(in srgb, ${color} 14%, #FFFFFF)`, color };

  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-[10px] rounded-full text-[12px] font-semibold whitespace-nowrap",
        className,
      )}
      style={style}
    >
      {label ?? status}
    </span>
  );
}

export default StatusPill;
