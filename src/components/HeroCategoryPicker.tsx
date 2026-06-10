import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, LayoutGrid, ChevronRight } from "lucide-react";
import { CATEGORY_GROUPS } from "@/config/categoryGroups";

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
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
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
    if (!open) {
      setQuery("");
      setOpenGroups(new Set());
    }
  }, [open]);

  // Build a label map from the DB categories (fallback to group item name)
  const labelBySlug = new Map<string, string>();
  (categories ?? []).forEach((c) => labelBySlug.set(c.slug, c.label));

  const selectedLabel = (() => {
    if (!value) return null;
    for (const g of CATEGORY_GROUPS) {
      const it = g.items.find((i) => i.slug === value);
      if (it) return labelBySlug.get(it.slug) || it.name;
    }
    return labelBySlug.get(value) || value;
  })();

  const q = query.trim().toLowerCase();
  const isSearching = q !== "";

  // Filtered flat items when searching
  const flatMatches = isSearching
    ? CATEGORY_GROUPS.flatMap((g) =>
        g.items
          .filter((it) => (labelBySlug.get(it.slug) || it.name).toLowerCase().includes(q))
          .map((it) => ({ ...it, group: g.title }))
      )
    : [];

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectSlug = (slug: string) => {
    onChange(slug);
    setOpen(false);
  };

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
            selectedLabel ? "bg-green-cta/10 text-green-cta" : "bg-muted text-muted-foreground"
          }`}
        >
          <LayoutGrid size={14} />
        </span>
        <span
          className={`flex-1 truncate ${
            selectedLabel ? "font-semibold text-foreground" : "text-muted-foreground"
          }`}
        >
          {loading ? "Carregando..." : selectedLabel ? selectedLabel : "Escolha a categoria de brinde"}
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
          <ul className="max-h-80 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {/* "Todas" option */}
            <li>
              <button
                type="button"
                onClick={() => selectSlug("")}
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

            {/* Search results (flat) */}
            {!loading && isSearching && flatMatches.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma categoria encontrada
              </li>
            )}
            {!loading && isSearching &&
              flatMatches.map((it) => {
                const active = it.slug === value;
                return (
                  <li key={it.slug}>
                    <button
                      type="button"
                      onClick={() => selectSlug(it.slug)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-green-cta/5 ${
                        active ? "bg-green-cta/5 text-green-cta" : "text-foreground"
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        {active && <Check size={14} className="text-green-cta" />}
                      </span>
                      <span className={active ? "font-semibold" : ""}>
                        {labelBySlug.get(it.slug) || it.name}
                      </span>
                    </button>
                  </li>
                );
              })}

            {/* Grouped list */}
            {!loading && !isSearching &&
              CATEGORY_GROUPS.map((group) => {
                const groupOpen = openGroups.has(group.title);
                const hasActive = group.items.some((it) => it.slug === value);
                return (
                  <li key={group.title}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-green-cta/5 ${
                        hasActive ? "text-green-cta" : "text-foreground"
                      }`}
                    >
                      <ChevronRight
                        size={14}
                        className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                          groupOpen ? "rotate-90" : ""
                        }`}
                      />
                      <span className="flex-1 font-semibold">{group.title}</span>
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </button>
                    {groupOpen && (
                      <ul className="bg-muted/30">
                        {group.items.map((it) => {
                          const active = it.slug === value;
                          return (
                            <li key={it.slug}>
                              <button
                                type="button"
                                onClick={() => selectSlug(it.slug)}
                                className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-sm transition-colors hover:bg-green-cta/5 ${
                                  active ? "text-green-cta" : "text-muted-foreground"
                                }`}
                              >
                                <span className="flex h-4 w-4 items-center justify-center">
                                  {active && <Check size={14} className="text-green-cta" />}
                                </span>
                                <span className={active ? "font-semibold" : ""}>
                                  {labelBySlug.get(it.slug) || it.name}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
