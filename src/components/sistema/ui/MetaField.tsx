import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetaFieldProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "danger";
  className?: string;
}

const TONE_COLOR: Record<NonNullable<MetaFieldProps["tone"]>, string> = {
  default: "var(--gw-text)",
  warning: "var(--gw-warning)",
  danger: "var(--gw-danger)",
};

export function MetaField({ label, value, tone = "default", className }: MetaFieldProps) {
  return (
    <div className={cn("flex flex-col gap-[2px]", className)}>
      <span className="gw-label">{label}</span>
      <span className="gw-body" style={{ color: TONE_COLOR[tone] }}>
        {value}
      </span>
    </div>
  );
}

export default MetaField;
