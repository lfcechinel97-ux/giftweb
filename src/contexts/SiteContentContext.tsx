import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteContentRow {
  id: string;
  type: string;
  label: string | null;
  section: string | null;
  value: string | null;
  width_desk: number | null;
  height_desk: number | null;
  width_mob: number | null;
  height_mob: number | null;
  updated_at: string | null;
}

interface SiteContentContextValue {
  rows: SiteContentRow[];
  loading: boolean;
  getBySection: (section: string) => SiteContentRow[];
  getValue: (id: string) => string | null;
  refresh: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

/* Cópia local do conteúdo do site: na segunda visita o banner e os textos já
   aparecem na primeira pintura, sem esperar a consulta ao banco (que roda em
   seguida e atualiza o que tiver mudado). */
const CACHE_KEY = "gw_site_content_v1";

function readCache(): SiteContentRow[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(rows: SiteContentRow[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch { /* sem espaço / modo privado */ }
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SiteContentRow[]>(readCache);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data, error } = await supabase.from("site_content").select("*");
    if (!error && data) {
      setRows(data as SiteContentRow[]);
      writeCache(data as SiteContentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    // Atualização ao vivo só interessa a quem edita o conteúdo (painel /admin).
    // Para o visitante isso abria um WebSocket a cada página — custo sem ganho.
    if (!window.location.pathname.startsWith("/admin")) return;

    const channel = supabase
      .channel("site-content-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_content" },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getBySection = (section: string) =>
    rows.filter((r) => r.section === section);

  const getValue = (id: string) =>
    rows.find((r) => r.id === id)?.value ?? null;

  return (
    <SiteContentContext.Provider value={{ rows, loading, getBySection, getValue, refresh }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContentContext() {
  const ctx = useContext(SiteContentContext);
  if (!ctx) throw new Error("useSiteContentContext must be used within SiteContentProvider");
  return ctx;
}
