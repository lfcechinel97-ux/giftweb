import { cn } from "@/lib/utils";

interface OrderNumberProps {
  value: string | number;
  className?: string;
}

/** Número puro do pedido/orçamento — sem "#" e sem prefixos. */
export function OrderNumber({ value, className }: OrderNumberProps) {
  return (
    <span
      className={cn("gw-num text-[15px]", className)}
      style={{ color: "var(--gw-text)" }}
    >
      {String(value).replace(/^[#\s]*(PED-)?/i, "")}
    </span>
  );
}

export default OrderNumber;
