import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuotationItem {
  id: string;
  name: string;
  image: string;
  /** Preço unitário de venda sem desconto (products_cache.preco_base). */
  precoBase: number | null;
  quantity: number;
  codigo_amigavel: string;
}

interface QuotationContextType {
  items: QuotationItem[];
  totalItems: number;
  addItem: (item: Omit<QuotationItem, "quantity">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearAll: () => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const QuotationContext = createContext<QuotationContextType | null>(null);

const STORAGE_KEY = "giftweb_quotation";

// Carrinhos salvos antes guardavam o custo em `price`; o custo não é mais
// usado no site, então esses itens têm o preço de venda buscado de novo.
type ItemSalvo = Omit<QuotationItem, "precoBase"> & { precoBase?: number | null; price?: number | null };

function loadItems(): ItemSalvo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function QuotationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuotationItem[]>(() =>
    loadItems().map(({ price: _legado, ...i }) => ({ ...i, precoBase: i.precoBase ?? null })),
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const legados = loadItems().filter((i) => i.precoBase === undefined && i.price).map((i) => i.id);
    if (!legados.length) return;
    supabase
      .from("products_cache")
      .select("id,preco_base")
      .in("id", legados)
      .then(({ data }) => {
        if (!data?.length) return;
        const porId = new Map(data.map((d) => [d.id, d.preco_base]));
        setItems((prev) => prev.map((i) => (porId.has(i.id) ? { ...i, precoBase: porId.get(i.id) ?? null } : i)));
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<QuotationItem, "quantity">, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <QuotationContext.Provider value={{ items, totalItems, addItem, removeItem, updateQty, clearAll, isOpen, setIsOpen }}>
      {children}
    </QuotationContext.Provider>
  );
}

export function useQuotation() {
  const ctx = useContext(QuotationContext);
  if (!ctx) throw new Error("useQuotation must be used within QuotationProvider");
  return ctx;
}
