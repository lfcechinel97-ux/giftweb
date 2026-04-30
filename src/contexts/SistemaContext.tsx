import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export const formatBRL = (valor: number | null | undefined): string => {
  if (valor == null || isNaN(valor)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
};

export type Product = Tables<"products_cache">;

export type TipoPessoa = "PF" | "PJ";

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoPessoa;
  documento: string; // CPF ou CNPJ
  ie?: string; // Inscricao estadual (PJ)
  contatos: { nome?: string; telefone: string; email?: string }[];
  enderecos: Endereco[];
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LookupItem {
  id: string;
  nome: string;
  ativo?: boolean;
  meta?: Record<string, any>;
}

export interface Transportadora extends LookupItem {
  tipoFrete?: "CIF" | "FOB";
  prazoEntrega?: number; // dias
}

export interface QuoteItem {
  id: string;
  tipo: "produto" | "manual";
  produtoId?: string;
  codigoComposto?: string; // produto_pai + variante
  varianteSlug?: string; // slug da variante selecionada
  nome: string;
  descricao?: string;
  quantidade: number;
  precoUnitario: number; // preco final (pode ser manual)
  precoOriginal: number; // preco calculado automatico
  precoManual: boolean; // flag se foi alterado manualmente
  precoCusto?: number; // custo do produto
  tabelaPrecos?: any; // tabela de precos do produto
  imagem?: string; // imagem do produto (mockup ou original)
  mockupImagem?: string; // imagem mockup enviada pelo vendedor
  altura?: number;
  diametro?: number;
}

export type OrcamentoStatus = "aberto" | "aprovado" | "cancelado";

export interface Orcamento {
  id: string;
  numero: string;
  clienteId: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  vendedorId?: string;
  origemId?: string;
  itens: QuoteItem[];
  subtotal: number;
  freteTipo: "CIF" | "FOB" | null;
  freteValor: number;
  transportadoraId?: string;
  prazoEntrega?: number;
  pagamentoId?: string;
  observacoes?: string;
  status: "aberto" | "aprovado" | "cancelado";
  createdAt: string;
  updatedAt: string;
  aprovadoEm?: string;
  anexoUrl?: string;
}

export interface PedidoItem {
  id: string;
  produtoId?: string;
  codigoComposto?: string;
  varianteSlug?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  mockupImagem?: string;
}

export interface Pedido {
  id: string;
  numero: string;
  orcamentoId: string;
  clienteId: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  vendedorId?: string;
  itens: PedidoItem[];
  subtotal: number;
  freteTipo: "CIF" | "FOB" | null;
  freteValor: number;
  total: number;
  transportadoraId?: string;
  prazoEntrega?: number;
  pagamentoId?: string;
  observacoes?: string;
  status: "novo" | "producao" | "pronto" | "enviado" | "entregue" | "cancelado";
  createdAt: string;
  updatedAt: string;
}

export interface StockAdjustment {
  id: string;
  produtoId: string;
  codigoComposto: string;
  varianteSlug?: string;
  tipo: "reserva" | "ajuste";
  quantidade: number; // positivo = entrada, negativo = saida
  motivo: string;
  orcamentoId?: string;
  pedidoId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface SistemaData {
  orcamentos: Orcamento[];
  pedidos: Pedido[];
  clientes: Cliente[];
  vendedores: LookupItem[];
  meiosPagamento: LookupItem[];
  transportadoras: Transportadora[];
  origens: LookupItem[];
  ajustesEstoque: StockAdjustment[];
}

interface SistemaContextType extends SistemaData {
  // Orcamentos
  addOrcamento: (o: Omit<Orcamento, "id" | "numero" | "createdAt" | "updatedAt">) => Orcamento;
  updateOrcamento: (id: string, changes: Partial<Orcamento>) => void;
  removeOrcamento: (id: string) => void;
  aprovarOrcamento: (id: string) => Pedido | null;
  // Pedidos
  updatePedido: (id: string, changes: Partial<Pedido>) => void;
  // Clientes
  addCliente: (c: Omit<Cliente, "id" | "createdAt" | "updatedAt">) => Cliente;
  updateCliente: (id: string, changes: Partial<Cliente>) => void;
  removeCliente: (id: string) => void;
  // Vendedores
  addVendedor: (nome: string) => LookupItem;
  updateVendedor: (id: string, nome: string) => void;
  removeVendedor: (id: string) => void;
  toggleVendedorAtivo: (id: string) => void;
  // Meios de Pagamento
  addMeioPagamento: (nome: string) => LookupItem;
  updateMeioPagamento: (id: string, nome: string) => void;
  removeMeioPagamento: (id: string) => void;
  toggleMeioPagamentoAtivo: (id: string) => void;
  // Transportadoras
  addTransportadora: (nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => Transportadora;
  updateTransportadora: (id: string, nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => void;
  removeTransportadora: (id: string) => void;
  toggleTransportadoraAtivo: (id: string) => void;
  // Origens
  addOrigem: (nome: string) => LookupItem;
  updateOrigem: (id: string, nome: string) => void;
  removeOrigem: (id: string) => void;
  toggleOrigemAtivo: (id: string) => void;
  // Utils
  currentVendedor: LookupItem | null;
  setCurrentVendedor: (v: LookupItem | null) => void;
  getEstoqueDisponivel: (produtoId: string, codigoComposto: string) => number;
  gerarNumeroOrcamento: () => string;
  gerarNumeroPedido: () => string;
}

const STORAGE_VERSION = 1;
const STORAGE_KEY = `sistema_data_v${STORAGE_VERSION}`;
const VENDEDOR_KEY = `sistema_vendedor_v${STORAGE_VERSION}`;

const initialData: SistemaData = {
  orcamentos: [],
  pedidos: [],
  clientes: [],
  vendedores: [
    { id: "v1", nome: "Vendedor 1", ativo: true },
    { id: "v2", nome: "Vendedor 2", ativo: true },
  ],
  meiosPagamento: [
    { id: "p1", nome: "Boleto 30 dias", ativo: true },
    { id: "p2", nome: "Cartão de Crédito", ativo: true },
    { id: "p3", nome: "PIX", ativo: true },
    { id: "p4", nome: "Transferência", ativo: true },
  ],
  transportadoras: [
    { id: "t1", nome: "Transportadora A", ativo: true, tipoFrete: "FOB", prazoEntrega: 5 },
    { id: "t2", nome: "Transportadora B", ativo: true, tipoFrete: "CIF", prazoEntrega: 7 },
  ],
  origens: [
    { id: "o1", nome: "Telefone", ativo: true },
    { id: "o2", nome: "WhatsApp", ativo: true },
    { id: "o3", nome: "E-mail", ativo: true },
    { id: "o4", nome: "Indicação", ativo: true },
    { id: "o5", nome: "Site", ativo: true },
  ],
  ajustesEstoque: [],
};

const SUPABASE_ROW_KEY = "giftweb_sistema_v1";

function loadFromLocalStorage(): SistemaData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialData, ...JSON.parse(raw) };
  } catch {}
  return { ...initialData };
}

function saveToLocalStorage(data: SistemaData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function loadFromSupabase(): Promise<SistemaData | null> {
  try {
    const { data, error } = await db
      .from("sistema_data")
      .select("data")
      .eq("key", SUPABASE_ROW_KEY)
      .maybeSingle();
    if (error || !data) return null;
    return { ...initialData, ...(data.data as Partial<SistemaData>) };
  } catch {
    return null;
  }
}

async function saveToSupabase(sysData: SistemaData) {
  try {
    await db
      .from("sistema_data")
      .upsert({ key: SUPABASE_ROW_KEY, data: sysData, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {}
}

const SistemaContext = createContext<SistemaContextType | null>(null);

export const SistemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<SistemaData>(() => loadFromLocalStorage());
  const [currentVendedor, setCurrentVendedorState] = useState<LookupItem | null>(() => {
    try {
      const raw = localStorage.getItem(VENDEDOR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // On mount: sync with Supabase
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadFromSupabase().then((remote) => {
      if (remote) {
        // Supabase tem dados — usa como fonte da verdade
        setData(remote);
        saveToLocalStorage(remote);
      } else {
        // Supabase vazio — migra dados do localStorage para lá (primeira vez)
        const local = loadFromLocalStorage();
        const hasLocalData = local.orcamentos.length > 0 || local.clientes.length > 0 || local.pedidos.length > 0;
        if (hasLocalData) saveToSupabase(local);
      }
    });
  }, []);

  useEffect(() => {
    try {
      if (currentVendedor) localStorage.setItem(VENDEDOR_KEY, JSON.stringify(currentVendedor));
      else localStorage.removeItem(VENDEDOR_KEY);
    } catch {}
  }, [currentVendedor]);

  const persist = useCallback((updater: (prev: SistemaData) => SistemaData) => {
    setData((prev) => {
      const next = updater(prev);
      saveToLocalStorage(next);
      saveToSupabase(next); // fire-and-forget
      return next;
    });
  }, []);

  const gerarNumeroOrcamento = useCallback(() => {
    const BASE = 125748;
    const seq = BASE + data.orcamentos.length + 1;
    return String(seq);
  }, [data.orcamentos.length]);

  const gerarNumeroPedido = useCallback(() => {
    const seq = data.pedidos.length + 1;
    const ano = new Date().getFullYear();
    return `PED-${ano}-${String(seq).padStart(5, "0")}`;
  }, [data.pedidos.length]);

  const addOrcamento = useCallback(
    (o: Omit<Orcamento, "id" | "numero" | "createdAt" | "updatedAt">): Orcamento => {
      const id = crypto.randomUUID();
      const numero = gerarNumeroOrcamento();
      const now = new Date().toISOString();
      const orcamento: Orcamento = { ...o, id, numero, createdAt: now, updatedAt: now };
      persist((prev) => ({ ...prev, orcamentos: [...prev.orcamentos, orcamento] }));
      return orcamento;
    },
    [gerarNumeroOrcamento, persist]
  );

  const updateOrcamento = useCallback((id: string, changes: Partial<Orcamento>) => {
    persist((prev) => ({
      ...prev,
      orcamentos: prev.orcamentos.map((o) => (o.id === id ? { ...o, ...changes, updatedAt: new Date().toISOString() } : o)),
    }));
  }, [persist]);

  const removeOrcamento = useCallback((id: string) => {
    persist((prev) => ({ ...prev, orcamentos: prev.orcamentos.filter((o) => o.id !== id) }));
  }, [persist]);

  const aprovarOrcamento = useCallback(
    (id: string): Pedido | null => {
      const orcamento = data.orcamentos.find((o) => o.id === id);
      if (!orcamento || orcamento.status !== "aberto") return null;

      const now = new Date().toISOString();
      const pedidoId = crypto.randomUUID();
      const numero = gerarNumeroPedido();

      const itensPedido: PedidoItem[] = orcamento.itens.map((item) => ({
        id: crypto.randomUUID(),
        produtoId: item.produtoId,
        codigoComposto: item.codigoComposto,
        varianteSlug: item.varianteSlug,
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        total: item.quantidade * item.precoUnitario,
        mockupImagem: item.mockupImagem,
      }));

      const pedido: Pedido = {
        id: pedidoId,
        numero,
        orcamentoId: orcamento.id,
        clienteId: orcamento.clienteId,
        contatoNome: orcamento.contatoNome,
        contatoTelefone: orcamento.contatoTelefone,
        contatoEmail: orcamento.contatoEmail,
        vendedorId: orcamento.vendedorId,
        itens: itensPedido,
        subtotal: orcamento.subtotal,
        freteTipo: orcamento.freteTipo,
        freteValor: orcamento.freteValor,
        total: orcamento.subtotal + orcamento.freteValor,
        transportadoraId: orcamento.transportadoraId,
        prazoEntrega: orcamento.prazoEntrega,
        pagamentoId: orcamento.pagamentoId,
        observacoes: orcamento.observacoes,
        status: "novo",
        createdAt: now,
        updatedAt: now,
      };

      // Criar reservas de estoque
      const reservas: StockAdjustment[] = itensPedido.map((item) => ({
        id: crypto.randomUUID(),
        produtoId: item.produtoId || "",
        codigoComposto: item.codigoComposto || item.produtoId || "",
        varianteSlug: item.varianteSlug,
        tipo: "reserva",
        quantidade: -item.quantidade,
        motivo: `Pedido ${numero}`,
        orcamentoId: orcamento.id,
        pedidoId: pedido.id,
        createdAt: now,
      }));

      persist((prev) => ({
        ...prev,
        pedidos: [...prev.pedidos, pedido],
        orcamentos: prev.orcamentos.map((o) =>
          o.id === id ? { ...o, status: "aprovado" as const, aprovadoEm: now, updatedAt: now } : o
        ),
        ajustesEstoque: [...prev.ajustesEstoque, ...reservas],
      }));

      return pedido;
    },
    [data.orcamentos, gerarNumeroPedido, persist]
  );

  const updatePedido = useCallback((id: string, changes: Partial<Pedido>) => {
    persist((prev) => ({
      ...prev,
      pedidos: prev.pedidos.map((p) => (p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p)),
    }));
  }, [persist]);

  const addCliente = useCallback((c: Omit<Cliente, "id" | "createdAt" | "updatedAt">): Cliente => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cliente: Cliente = { ...c, id, createdAt: now, updatedAt: now };
    persist((prev) => ({ ...prev, clientes: [...prev.clientes, cliente] }));
    return cliente;
  }, [persist]);

  const updateCliente = useCallback((id: string, changes: Partial<Cliente>) => {
    persist((prev) => ({
      ...prev,
      clientes: prev.clientes.map((c) => (c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c)),
    }));
  }, [persist]);

  const removeCliente = useCallback((id: string) => {
    persist((prev) => ({ ...prev, clientes: prev.clientes.filter((c) => c.id !== id) }));
  }, [persist]);

  const addVendedor = useCallback(
    (nome: string): LookupItem => {
      const item: LookupItem = { id: crypto.randomUUID(), nome, ativo: true };
      persist((prev) => ({ ...prev, vendedores: [...prev.vendedores, item] }));
      return item;
    },
    [persist]
  );

  const updateVendedor = useCallback(
    (id: string, nome: string) => {
      persist((prev) => ({
        ...prev,
        vendedores: prev.vendedores.map((v) => (v.id === id ? { ...v, nome } : v)),
      }));
    },
    [persist]
  );

  const removeVendedor = useCallback(
    (id: string) => {
      persist((prev) => ({ ...prev, vendedores: prev.vendedores.filter((v) => v.id !== id) }));
    },
    [persist]
  );

  const toggleVendedorAtivo = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        vendedores: prev.vendedores.map((v) => v.id === id ? { ...v, ativo: !v.ativo } : v),
      }));
    },
    [persist]
  );

  const addMeioPagamento = useCallback(
    (nome: string): LookupItem => {
      const item: LookupItem = { id: crypto.randomUUID(), nome, ativo: true };
      persist((prev) => ({ ...prev, meiosPagamento: [...prev.meiosPagamento, item] }));
      return item;
    },
    [persist]
  );

  const updateMeioPagamento = useCallback(
    (id: string, nome: string) => {
      persist((prev) => ({
        ...prev,
        meiosPagamento: prev.meiosPagamento.map((p) => (p.id === id ? { ...p, nome } : p)),
      }));
    },
    [persist]
  );

  const removeMeioPagamento = useCallback(
    (id: string) => {
      persist((prev) => ({ ...prev, meiosPagamento: prev.meiosPagamento.filter((p) => p.id !== id) }));
    },
    [persist]
  );

  const toggleMeioPagamentoAtivo = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        meiosPagamento: prev.meiosPagamento.map((p) => p.id === id ? { ...p, ativo: !p.ativo } : p),
      }));
    },
    [persist]
  );

  const addTransportadora = useCallback(
    (nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number): Transportadora => {
      const item: Transportadora = { id: crypto.randomUUID(), nome, ativo: true, tipoFrete, prazoEntrega };
      persist((prev) => ({ ...prev, transportadoras: [...prev.transportadoras, item] }));
      return item;
    },
    [persist]
  );

  const updateTransportadora = useCallback(
    (id: string, nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => {
      persist((prev) => ({
        ...prev,
        transportadoras: prev.transportadoras.map((t) =>
          t.id === id ? { ...t, nome, tipoFrete, prazoEntrega } : t
        ),
      }));
    },
    [persist]
  );

  const removeTransportadora = useCallback(
    (id: string) => {
      persist((prev) => ({ ...prev, transportadoras: prev.transportadoras.filter((t) => t.id !== id) }));
    },
    [persist]
  );

  const toggleTransportadoraAtivo = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        transportadoras: prev.transportadoras.map((t) => t.id === id ? { ...t, ativo: !t.ativo } : t),
      }));
    },
    [persist]
  );

  const addOrigem = useCallback(
    (nome: string): LookupItem => {
      const item: LookupItem = { id: crypto.randomUUID(), nome, ativo: true };
      persist((prev) => ({ ...prev, origens: [...prev.origens, item] }));
      return item;
    },
    [persist]
  );

  const updateOrigem = useCallback(
    (id: string, nome: string) => {
      persist((prev) => ({
        ...prev,
        origens: prev.origens.map((o) => (o.id === id ? { ...o, nome } : o)),
      }));
    },
    [persist]
  );

  const removeOrigem = useCallback(
    (id: string) => {
      persist((prev) => ({ ...prev, origens: prev.origens.filter((o) => o.id !== id) }));
    },
    [persist]
  );

  const toggleOrigemAtivo = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        origens: prev.origens.map((o) => o.id === id ? { ...o, ativo: !o.ativo } : o),
      }));
    },
    [persist]
  );

  const getEstoqueDisponivel = useCallback(
    (produtoId: string, codigoComposto: string) => {
      // Base estoque do produto (mock - seria buscado do Supabase)
      const baseStock = 100;
      // Ajustes de reserva/ajuste
      const ajuste = data.ajustesEstoque
        .filter((a) => a.codigoComposto === codigoComposto || a.produtoId === produtoId)
        .reduce((sum, a) => sum + a.quantidade, 0);
      return Math.max(0, baseStock + ajuste);
    },
    [data.ajustesEstoque]
  );

  const value = useMemo<SistemaContextType>(
    () => ({
      ...data,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
      aprovarOrcamento,
      updatePedido,
      addCliente,
      updateCliente,
      removeCliente,
      addVendedor,
      updateVendedor,
      removeVendedor,
      toggleVendedorAtivo,
      addMeioPagamento,
      updateMeioPagamento,
      removeMeioPagamento,
      toggleMeioPagamentoAtivo,
      addTransportadora,
      updateTransportadora,
      removeTransportadora,
      toggleTransportadoraAtivo,
      addOrigem,
      updateOrigem,
      removeOrigem,
      toggleOrigemAtivo,
      currentVendedor,
      setCurrentVendedor: setCurrentVendedorState,
      getEstoqueDisponivel,
      gerarNumeroOrcamento,
      gerarNumeroPedido,
    }),
    [
      data,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
      aprovarOrcamento,
      updatePedido,
      addCliente,
      updateCliente,
      removeCliente,
      addVendedor,
      updateVendedor,
      removeVendedor,
      toggleVendedorAtivo,
      addMeioPagamento,
      updateMeioPagamento,
      removeMeioPagamento,
      toggleMeioPagamentoAtivo,
      addTransportadora,
      updateTransportadora,
      removeTransportadora,
      toggleTransportadoraAtivo,
      addOrigem,
      updateOrigem,
      removeOrigem,
      toggleOrigemAtivo,
      currentVendedor,
      getEstoqueDisponivel,
      gerarNumeroOrcamento,
      gerarNumeroPedido,
    ]
  );

  return <SistemaContext.Provider value={value}>{children}</SistemaContext.Provider>;
};

// Helper functions
export const calcSubtotal = (orcamento: Orcamento): number => {
  return orcamento.itens.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);
};

export const calcTotal = (orcamento: Orcamento): number => {
  return calcSubtotal(orcamento) + (orcamento.freteValor || 0);
};

export const clienteDisplay = (cliente: Cliente | null | undefined): string => {
  if (!cliente) return "—";
  return cliente.nome || "—";
};

export const useSistema = () => {
  const ctx = useContext(SistemaContext);
  if (!ctx) throw new Error("useSistema must be used within SistemaProvider");
  return ctx;
};
