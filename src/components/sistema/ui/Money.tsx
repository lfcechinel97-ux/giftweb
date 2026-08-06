import { cn } from "@/lib/utils";

interface MoneyProps {
  value: number;
  emphasis?: boolean;
  className?: string;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valor monetário — nunca verde. */
export function Money({ value, emphasis = false, className }: MoneyProps) {
  return (
    <span
      className={cn("gw-tnum", emphasis ? "text-[16px]" : "text-[14px]", className)}
      style={{
        fontWeight: emphasis ? 600 : 500,
        color: emphasis ? "var(--gw-text)" : "var(--gw-text-secondary)",
      }}
    >
      {BRL.format(Number.isFinite(value) ? value : 0)}
    </span>
  );
}

export default Money;
