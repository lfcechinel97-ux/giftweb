import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusInfo, opcoesStatus, fundoSuave, textoForte } from "@/lib/statusPedido";
import { cn } from "@/lib/utils";

/**
 * Badge de status — bolinha cheia na cor da etapa, fundo suave da mesma matiz,
 * texto na variante escura.
 *
 * Preenchimento sólido com texto branco foi descartado de propósito: metade das
 * cores do fluxo (âmbar, teal, amarelo) não chega a 3:1 com branco em cima. O
 * fundo suave mantém a cor legível em qualquer etapa e não grita numa lista com
 * dezenas de linhas.
 */

interface StatusBadgeProps {
  status?: string | null;
  /** Ausente = badge estático; presente = abre o seletor de etapa. */
  onSelect?: (slug: string) => void;
  nivel?: "pedido" | "item";
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status, onSelect, nivel = "item", size = "md", className,
}: StatusBadgeProps) {
  const info = statusInfo(status);
  const alt = size === "sm" ? "h-[22px] text-[11px] px-2" : "h-[26px] text-[12px] px-2.5";

  const corpo = (
    <>
      <span
        className="inline-block h-[6px] w-[6px] rounded-full shrink-0"
        style={{ background: info.cor }}
      />
      <span className="truncate">{info.nome}</span>
      {onSelect && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />}
    </>
  );

  const estilo = {
    background: fundoSuave(info.cor),
    color: textoForte(info.cor),
    border: `1px solid ${fundoSuave(info.cor, 28)}`,
    fontWeight: 600,
  } as const;

  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full whitespace-nowrap max-w-full",
    alt,
    className,
  );

  if (!onSelect) {
    return <span className={classes} style={estilo}>{corpo}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(classes, "transition-shadow hover:shadow-[var(--gw-shadow-sm)]")} style={estilo}>
          {corpo}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {opcoesStatus(nivel).map(s => (
          <DropdownMenuItem key={s.slug} onClick={() => onSelect(s.slug)} className="gap-2">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: s.cor }} />
            <span className="truncate">{s.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default StatusBadge;
