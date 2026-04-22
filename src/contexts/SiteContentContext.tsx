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

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SiteContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.from("site_content").select("*");
    setRows((data as SiteContentRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();

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
