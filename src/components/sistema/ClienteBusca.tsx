import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { clienteDisplay, type Cliente } from "@/contexts/SistemaContext";

/* Campo de cliente com filtro enquanto digita: "Luiz Fel" mostra só quem
   tem palavras começando com "Luiz" e "Fel" (nome / razão social), sem
   diferenciar acento ou maiúscula. Também acha pelo CPF/CNPJ (só dígitos)
   e pelo nome dos contatos. Quem COMEÇA com o texto aparece primeiro. */

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const LIMITE = 50;

interface Props {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ClienteBusca({ clientes, value, onChange, placeholder = "Digite o nome ou razão social...", className }: Props) {
  const selecionado = useMemo(() => clientes.find(c => c.id === value) ?? null, [clientes, value]);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixaRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  /* A lista vai num portal com posição fixa: o card do pedido tem
     overflow-hidden e cortaria um dropdown absoluto. */
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const r = caixaRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", medir, true); window.removeEventListener("resize", medir); };
  }, [aberto]);

  // Fora de edição, o campo mostra o cliente escolhido.
  useEffect(() => {
    if (!aberto) setTexto(selecionado ? clienteDisplay(selecionado) : "");
  }, [selecionado, aberto]);

  const resultados = useMemo(() => {
    const q = normalizar(texto);
    // Ao abrir sem digitar (ou com o nome do selecionado), lista todos.
    if (!q || (selecionado && q === normalizar(clienteDisplay(selecionado)))) {
      return clientes.slice(0, LIMITE);
    }
    const termos = q.split(/\s+/).filter(Boolean);
    const digitos = q.replace(/\D/g, "");
    const pontuados: { c: Cliente; p: number }[] = [];
    for (const c of clientes) {
      const nome = normalizar(c.nome || "");
      const palavras = nome.split(/[\s.,/&()-]+/).filter(Boolean);
      const casaNome = termos.every(t => palavras.some(w => w.startsWith(t)));
      const casaContato = !casaNome && (c.contatos ?? []).some(ct => {
        const pc = normalizar(ct.nome || "").split(/\s+/).filter(Boolean);
        return termos.every(t => pc.some(w => w.startsWith(t)));
      });
      const casaDoc = digitos.length >= 3 && (c.documento || "").replace(/\D/g, "").includes(digitos);
      if (!casaNome && !casaContato && !casaDoc) continue;
      pontuados.push({ c, p: nome.startsWith(q) ? 0 : casaNome ? 1 : 2 });
    }
    pontuados.sort((a, b) => a.p - b.p || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
    return pontuados.slice(0, LIMITE).map(x => x.c);
  }, [texto, clientes, selecionado]);

  useEffect(() => { setAtivo(0); }, [texto]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixaRef.current?.contains(alvo) && !listaRef.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const escolher = (c: Cliente) => {
    onChange(c.id);
    setTexto(clienteDisplay(c));
    setAberto(false);
  };

  return (
    <div ref={caixaRef} className={cn("relative flex-1 min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={texto}
        placeholder={placeholder}
        onFocus={e => { setAberto(true); e.currentTarget.select(); }}
        onChange={e => { setTexto(e.target.value); setAberto(true); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setAtivo(i => Math.min(i + 1, resultados.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { if (aberto && resultados[ativo]) { e.preventDefault(); escolher(resultados[ativo]); } }
          else if (e.key === "Escape") { setAberto(false); }
          else if (e.key === "Tab") { setAberto(false); }
        }}
        className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
      {aberto && pos && createPortal(
        <ul
          ref={listaRef}
          className="sistema-theme fixed z-[100] max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ top: pos.top, left: pos.left, width: pos.width, background: "var(--gw-surface)" }}
        >
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</li>
          ) : resultados.map((c, i) => (
            <li
              key={c.id}
              data-idx={i}
              onMouseDown={e => { e.preventDefault(); escolher(c); }}
              onMouseEnter={() => setAtivo(i)}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-1.5 text-sm",
                i === ativo && "bg-accent text-accent-foreground",
                c.id === value && "font-semibold",
              )}
            >
              <span className="block truncate">{clienteDisplay(c)}</span>
              {c.documento && <span className="block text-[11px] text-muted-foreground">{c.documento}</span>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
