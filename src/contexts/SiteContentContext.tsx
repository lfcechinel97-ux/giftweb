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
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SiteContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("*")
      .then(({ data }) => {
        setRows((data as SiteContentRow[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  const getBySection = (section: string) =>
    rows.filter((r) => r.section === section);

  const getValue = (id: string) =>
    rows.find((r) => r.id === id)?.value ?? null;

  return (
    <SiteContentContext.Provider value={{ rows, loading, getBySection, getValue }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContentContext() {
  const ctx = useContext(SiteContentContext);
  if (!ctx) throw new Error("useSiteContentContext must be used within SiteContentProvider");
  return ctx;
}
