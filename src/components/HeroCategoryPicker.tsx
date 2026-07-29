import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, LayoutGrid, Plus, Minus } from "lucide-react";
import { CATEGORY_GROUPS } from "@/config/categoryGroups";
import { useIsMobile } from "@/hooks/use-mobile";

import imgCopos from "@/assets/cat-copos.jpg";
import imgMochilas from "@/assets/cat-mochilas.jpg";
import imgNecessaires from "@/assets/cat-necessaires.jpg";
import imgCadernetas from "@/assets/cat-cadernetas.jpg";
import imgChaveiros from "@/assets/cat-chaveiros.jpg";
import imgEletronicos from "@/assets/cat-eletronicos.jpg";
import imgSacolas from "@/assets/cat-sacolas.jpg";
import imgChurrasco from "@/assets/cat-churrasco.jpg";
import imgMarmitas from "@/assets/cat-marmitas.jpg";
import imgGuardaChuvas from "@/assets/cat-guarda-chuvas.jpg";

const GROUP_IMAGES: Record<string, string> = {
  "Copos, Garrafas e Canecas": imgCopos,
  "Mochilas, Bolsas Térmicas e Malas": imgMochilas,
  "Necessaires, Porta Joias e Kit Manicure": imgNecessaires,
  "Cadernetas, Agendas, Blocos e Canetas": imgCadernetas,
  "Chaveiros, Mouse Pad e Kit Executivo": imgChaveiros,
  "Caixas de Som, Fones e Power Bank": imgEletronicos,
  "Sacola de Algodão e TNT": imgSacolas,
  "Kit Churrasco e Kit Vinho": imgChurrasco,
  "Marmitas e Tábuas de Madeira": imgMarmitas,
  "Guarda-Chuvas": imgGuardaChuvas,
};

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
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

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
    } else if (!isMobile) {
      // Foco automático apenas no desktop (no mobile abriria o teclado)
      inputRef.current?.focus();
    }
  }, [open, isMobile]);

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
            selectedLabel ? "text-foreground" : "text-muted-foreground"
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
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-card"
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
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-sm font-light text-foreground placeholder:text-muted-foreground focus:border-green-cta focus:outline-none focus:ring-1 focus:ring-green-cta/30"
              />
            </div>
          </div>

          {/* Options */}
          <ul className="max-h-[22rem] overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {/* "Todas" option */}
            <li>
              <button
                type="button"
                onClick={() => selectSlug("")}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/40 ${
                  value === "" ? "text-green-cta" : "text-muted-foreground"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                  <LayoutGrid size={16} />
                </span>
                <span className="flex-1 font-light tracking-tight">Todas as categorias</span>
                {value === "" && <Check size={15} className="shrink-0 text-green-cta" />}
              </button>
            </li>

            {loading && (
              <li className="px-3 py-3 text-center text-xs font-light text-muted-foreground">
                Carregando...
              </li>
            )}

            {/* Search results (flat) */}
            {!loading && isSearching && flatMatches.length === 0 && (
              <li className="px-3 py-6 text-center text-xs font-light text-muted-foreground">
                Nenhuma categoria encontrada
              </li>
            )}
            {!loading && isSearching &&
              flatMatches.map((it) => {
                const active = it.slug === value;
                return (
                  <li key={it.slug} className="border-t border-border/50 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => selectSlug(it.slug)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/40 ${
                        active ? "text-green-cta" : "text-foreground"
                      }`}
                    >
                      <img
                        src={GROUP_IMAGES[it.group]}
                        alt=""
                        loading="lazy"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                      <span className="flex-1 font-light tracking-tight">
                        {labelBySlug.get(it.slug) || it.name}
                      </span>
                      {active && <Check size={15} className="shrink-0 text-green-cta" />}
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
                  <li key={group.title} className="border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/40 ${
                        hasActive ? "text-green-cta" : "text-foreground"
                      }`}
                    >
                      <img
                        src={GROUP_IMAGES[group.title]}
                        alt=""
                        loading="lazy"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                      <span className="flex-1 font-light leading-snug tracking-tight">
                        {group.title}
                      </span>
                      {groupOpen ? (
                        <Minus size={14} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <Plus size={14} className="shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {groupOpen && (
                      <ul className="pb-1">
                        {group.items.map((it) => {
                          const active = it.slug === value;
                          return (
                            <li key={it.slug}>
                              <button
                                type="button"
                                onClick={() => selectSlug(it.slug)}
                                className={`flex w-full items-center gap-2 py-2 pl-16 pr-3 text-left text-[13px] transition-colors hover:bg-muted/40 ${
                                  active ? "text-green-cta" : "text-muted-foreground"
                                }`}
                              >
                                <span className="flex-1 font-light tracking-tight">
                                  {labelBySlug.get(it.slug) || it.name}
                                </span>
                                {active && <Check size={14} className="shrink-0 text-green-cta" />}
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
