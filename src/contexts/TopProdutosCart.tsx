import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface TopCartItem {
  id: string;
  nome: string;
  image: string | null;
  preco: number | null;
  quantidade: number;
  categoria?: string;
}

interface Ctx {
  items: TopCartItem[];
  totalItems: number;
  addItem: (item: Omit<TopCartItem, "quantidade">, qty: number) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  getQty: (id: string) => number;
}

const TopCartContext = createContext<Ctx | null>(null);
const KEY = "topprodutos_cart_v1";

function load(): TopCartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function TopProdutosCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TopCartItem[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<TopCartItem, "quantidade">, qty: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantidade: qty } : i));
      }
      return [...prev, { ...item, quantidade: qty }];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantidade: Math.max(1, qty) } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);
  const getQty = useCallback((id: string) => items.find((i) => i.id === id)?.quantidade ?? 0, [items]);

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantidade, 0), [items]);

  return (
    <TopCartContext.Provider value={{ items, totalItems, addItem, setQty, removeItem, clearAll, getQty }}>
      {children}
    </TopCartContext.Provider>
  );
}

export function useTopCart() {
  const ctx = useContext(TopCartContext);
  if (!ctx) throw new Error("useTopCart must be used within TopProdutosCartProvider");
  return ctx;
}
