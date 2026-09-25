import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { etapaPcpDoStatus, opcoesEtapasPcp } from "@/lib/statusPedido";
import { cn } from "@/lib/utils";

/**
 * Badge de status — preenchimento SÓLIDO na cor da etapa, texto branco.
 *
 * Antes usava fundo suave + texto escuro (mais "seguro" tipograficamente),
 * mas o usuário pediu cor viva de propósito: é o primeiro coisa que o olho
 * deve achar na linha, e pastel some no meio da tela. Como contrapartida,
 * as cores do catálogo (`src/lib/statusPedido.ts`) foram escurecidas até
 * todas passarem de 4.5:1 contra branco — a cor continua saturada, só não
 * tão clara a ponto do texto branco sumir em cima dela.
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
  status, onSelect, size = "md", className,
}: StatusBadgeProps) {
  /* Mesmas etapas (nome e cor) das colunas do PCP: mudou lá, muda aqui. */
  const info = etapaPcpDoStatus(status);
  const alt = size === "sm" ? "h-[22px] text-[11px] px-2" : "h-[26px] text-[12px] px-2.5";

  const corpo = (
    <>
      <span className="truncate">{info.nome}</span>
      {onSelect && <ChevronDown className="h-3 w-3 shrink-0 opacity-90" />}
    </>
  );

  const estilo = {
    background: info.cor,
    color: "#FFFFFF",
    fontWeight: 700,
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
        <button type="button" className={cn(classes, "transition-opacity hover:opacity-90")} style={estilo}>
          {corpo}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {opcoesEtapasPcp().map(s => (
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
