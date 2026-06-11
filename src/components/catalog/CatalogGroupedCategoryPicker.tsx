import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, LayoutGrid, ChevronRight } from "lucide-react";
import { CATEGORY_GROUPS } from "@/config/categoryGroups";
import { useBaseCategories } from "@/hooks/useBaseCategories";

interface Props {
  value: string | null;
  onChange: (slug: string | null) => void;
  /** Visual variant: 'bar' = inline filter bar (no icon), 'block' = full card style. */
  variant?: "bar" | "block";
}

const CatalogGroupedCategoryPicker = ({ value, onChange, variant = "bar" }: Props) => {
  const { data: categories = [], isLoading } = useBaseCategories();
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

  const labelBySlug = new Map<string, string>();
  categories.forEach((c) => labelBySlug.set(c.slug, c.label));

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

  const selectSlug = (slug: string | null) => {
    onChange(slug);
    setOpen(false);
  };

  const triggerActive = !!value;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
          triggerActive
            ? "border-[#22C55E] text-[#0F172A] bg-[#22C55E]/5"
            : open
              ? "border-[#22C55E] text-[#0F172A] bg-white"
              : "border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A] bg-white"
        }`}
      >
        {variant === "block" && (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
              triggerActive ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#F1F5F9] text-[#94A3B8]"
            }`}
          >
            <LayoutGrid size={12} />
          </span>
        )}
        <span className={`flex-1 truncate text-left ${triggerActive ? "font-semibold" : ""}`}>
          {isLoading ? "Carregando..." : selectedLabel || "Todas as categorias"}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#22C55E] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white"
          style={{ boxShadow: "0 8px 24px rgba(15,23,42,0.10)" }}
        >
          {/* Search */}
          <div className="border-b border-[#E5E7EB] p-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full rounded-md border border-[#E5E7EB] bg-white py-1.5 pl-7 pr-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#22C55E] focus:outline-none"
              />
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {/* Todas */}
            <li>
              <button
                type="button"
                onClick={() => selectSlug(null)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F8FAFC] ${
                  !value ? "text-[#22C55E]" : "text-[#64748B]"
                }`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  {!value && <Check size={12} className="text-[#22C55E]" />}
                </span>
                <span className="font-semibold">Todas as categorias</span>
              </button>
            </li>

            {/* Search results */}
            {isSearching && flatMatches.length === 0 && (
              <li className="px-3 py-4 text-center text-[11px] text-[#94A3B8]">
                Nenhuma categoria encontrada
              </li>
            )}
            {isSearching &&
              flatMatches.map((it) => {
                const active = it.slug === value;
                return (
                  <li key={it.slug}>
                    <button
                      type="button"
                      onClick={() => selectSlug(it.slug)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F8FAFC] ${
                        active ? "bg-[#22C55E]/5 text-[#22C55E]" : "text-[#0F172A]"
                      }`}
                    >
                      <span className="flex h-3.5 w-3.5 items-center justify-center">
                        {active && <Check size={12} className="text-[#22C55E]" />}
                      </span>
                      <span className={active ? "font-semibold" : ""}>
                        {labelBySlug.get(it.slug) || it.name}
                      </span>
                    </button>
                  </li>
                );
              })}

            {/* Grouped */}
            {!isSearching &&
              CATEGORY_GROUPS.map((group) => {
                const groupOpen = openGroups.has(group.title);
                const hasActive = group.items.some((it) => it.slug === value);
                return (
                  <li key={group.title}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F8FAFC] ${
                        hasActive ? "text-[#22C55E]" : "text-[#0F172A]"
                      }`}
                    >
                      <ChevronRight
                        size={12}
                        className={`shrink-0 text-[#94A3B8] transition-transform ${groupOpen ? "rotate-90" : ""}`}
                      />
                      <span className="flex-1 font-semibold">{group.title}</span>
                      <span className="text-[10px] text-[#94A3B8]">{group.items.length}</span>
                    </button>
                    {groupOpen && (
                      <ul className="bg-[#F8FAFC]">
                        {group.items.map((it) => {
                          const active = it.slug === value;
                          return (
                            <li key={it.slug}>
                              <button
                                type="button"
                                onClick={() => selectSlug(it.slug)}
                                className={`flex w-full items-center gap-2 py-1.5 pl-8 pr-3 text-left text-xs transition-colors hover:bg-white ${
                                  active ? "text-[#22C55E]" : "text-[#64748B]"
                                }`}
                              >
                                <span className="flex h-3.5 w-3.5 items-center justify-center">
                                  {active && <Check size={12} className="text-[#22C55E]" />}
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

export default CatalogGroupedCategoryPicker;
