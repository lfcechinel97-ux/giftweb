import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, LayoutGrid } from "lucide-react";

type Category = { slug: string; label: string };

interface Props {
  categories: Category[] | undefined;
  loading: boolean;
  value: string;
  onChange: (slug: string) => void;
}

const HeroCategoryPicker = ({ categories, loading, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = categories?.find((c) => c.slug === value);
  const filtered =
    query.trim() === ""
      ? categories ?? []
      : (categories ?? []).filter((c) =>
          c.label.toLowerCase().includes(query.trim().toLowerCase())
        );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex w-full items-center gap-2.5 rounded-xl border bg-card py-2.5 pl-3 pr-3 text-left text-sm transition-all duration-200 ${
          open
            ? "border-green-cta ring-2 ring-green-cta/15"
            : "border-border hover:border-green-cta/60"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selected ? "bg-green-cta/10 text-green-cta" : "bg-muted text-muted-foreground"
          }`}
        >
          <LayoutGrid size={14} />
        </span>
        <span
          className={`flex-1 truncate ${
            selected ? "font-semibold text-foreground" : "text-muted-foreground"
          }`}
        >
          {loading ? "Carregando..." : selected ? selected.label : "Escolha a categoria de brinde"}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-green-cta transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-border bg-card"
          style={{ boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}
        >
          {/* Search */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-green-cta focus:outline-none focus:ring-1 focus:ring-green-cta/30"
              />
            </div>
          </div>

          {/* Options */}
          <ul className="max-h-72 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {/* "Todas" option */}
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-green-cta/5 ${
                  value === "" ? "text-green-cta" : "text-muted-foreground"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {value === "" && <Check size={14} className="text-green-cta" />}
                </span>
                <span className="font-medium">Todas as categorias</span>
              </button>
            </li>

            {loading && (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                Carregando...
              </li>
            )}

            {!loading &&
              filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma categoria encontrada
                </li>
              )}

            {filtered.map((c) => {
              const active = c.slug === value;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.slug);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-green-cta/5 ${
                      active ? "bg-green-cta/5 text-green-cta" : "text-foreground"
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      {active && <Check size={14} className="text-green-cta" />}
                    </span>
                    <span className={active ? "font-semibold" : ""}>{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HeroCategoryPicker;
