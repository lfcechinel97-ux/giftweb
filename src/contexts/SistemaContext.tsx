import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// Helper: surface DB write errors to the user (otherwise inserts fail silently and data "disappears" on reload)
const reportDbError = (label: string) => (res: any) => {
  if (res?.error) {
    console.error(`[Sistema] ${label} falhou:`, res.error);
    toast.error(`Não foi possível salvar (${label}). ${res.error.message || ""}`);
  }
};

// Helper: every DB write goes through here — blocks writes without an authenticated
// session (RLS would silently reject them) and always surfaces errors.
const dbWrite = async (label: string, fn: () => PromiseLike<any>): Promise<any> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error(`[Sistema] ${label}: gravação bloqueada — sem sessão autenticada`);
      toast.error(`Não foi possível salvar (${label}): sessão expirada. Faça login novamente em /admin/login.`);
      return { error: { message: "Sessão expirada" } };
    }
    const res: any = await fn();
    reportDbError(label)(res);
    return res;
  } catch (e: any) {
    console.error(`[Sistema] ${label} falhou:`, e);
    toast.error(`Não foi possível salvar (${label}). ${e?.message || ""}`);
    return { error: e };
  }
};

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
  documento: string;
  ie?: string;
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
  prazoEntrega?: number;
}

export interface QuoteItem {
  id: string;
  tipo: "produto" | "manual";
  produtoId?: string;
  codigoComposto?: string;
  varianteSlug?: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  precoUnitario: number;
  precoOriginal: number;
  precoManual: boolean;
  precoCusto?: number;
  tabelaPrecos?: any;
  imagem?: string;
  mockupImagem?: string;
  altura?: number;
  diametro?: number;
  observacao?: string;
}

export type OrcamentoStatus = "aberto" | "aprovado" | "cancelado";

export interface ClienteSnapshot {
  nome: string;
  tipo: TipoPessoa;
  documento: string;
  ie?: string;
  endereco?: Endereco;
  contato?: { nome?: string; telefone?: string; email?: string };
}

export interface Orcamento {
  id: string;
  numero: string;
  clienteId: string;
  clienteSnapshot?: ClienteSnapshot;
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
  prazoProducaoDias?: number;
  dataProduzirAte?: string;
  dataDespacharAte?: string;
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
  imagem?: string;
  observacao?: string;
}

export interface Pedido {
  id: string;
  numero: string;
  orcamentoId: string;
  clienteId: string;
  clienteSnapshot?: ClienteSnapshot;
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
  prazoProducaoDias?: number;
  dataProduzirAte?: string;
  dataDespacharAte?: string;
}

export interface StockAdjustment {
  id: string;
  produtoId: string;
  codigoComposto: string;
  varianteSlug?: string;
  tipo: "reserva" | "ajuste";
  quantidade: number;
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
  loading: boolean;
  refreshOrcamentos: (opts?: {
    vendedorId?: string | null;
    status?: string | null;
    search?: string | null;
    cliente?: string | null;
    limit?: number;
  }) => Promise<Orcamento[]>;
  fetchOrcamentoCompleto: (id: string) => Promise<Orcamento | null>;
  addOrcamento: (o: Omit<Orcamento, "id" | "numero" | "createdAt" | "updatedAt">) => Promise<Orcamento>;
  updateOrcamento: (id: string, changes: Partial<Orcamento>) => Promise<void>;
  removeOrcamento: (id: string) => void;
  aprovarOrcamento: (id: string) => Promise<Pedido | null>;
  updatePedido: (id: string, changes: Partial<Pedido>) => void;
  addCliente: (c: Omit<Cliente, "id" | "createdAt" | "updatedAt">) => Cliente;
  updateCliente: (id: string, changes: Partial<Cliente>) => void;
  removeCliente: (id: string) => void;
  addVendedor: (nome: string) => LookupItem;
  updateVendedor: (id: string, nome: string) => void;
  removeVendedor: (id: string) => void;
  toggleVendedorAtivo: (id: string) => void;
  addMeioPagamento: (nome: string) => LookupItem;
  updateMeioPagamento: (id: string, nome: string) => void;
  removeMeioPagamento: (id: string) => void;
  toggleMeioPagamentoAtivo: (id: string) => void;
  addTransportadora: (nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => Transportadora;
  updateTransportadora: (id: string, nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => void;
  removeTransportadora: (id: string) => void;
  toggleTransportadoraAtivo: (id: string) => void;
  addOrigem: (nome: string) => LookupItem;
  updateOrigem: (id: string, nome: string) => void;
  removeOrigem: (id: string) => void;
  toggleOrigemAtivo: (id: string) => void;
  currentVendedor: LookupItem | null;
  setCurrentVendedor: (v: LookupItem | null) => void;
  getEstoqueDisponivel: (produtoId: string, codigoComposto: string) => number;
  gerarNumeroOrcamento: () => string;
  gerarNumeroPedido: () => string;
}

const VENDEDOR_KEY = `sistema_vendedor_v1`;
const LEGACY_KEY = `sistema_data_v1`;

const emptyData: SistemaData = {
  orcamentos: [], pedidos: [], clientes: [], vendedores: [],
  meiosPagamento: [], transportadoras: [], origens: [], ajustesEstoque: [],
};

const SistemaContext = createContext<SistemaContextType | null>(null);

const arr = <T,>(value: any): T[] => Array.isArray(value) ? value : [];

// ---------- mappers ----------
const mapVendedor = (r: any): LookupItem => ({ id: r.id, nome: r.nome, ativo: r.ativo, meta: r.meta ?? undefined });
const mapMeio = mapVendedor;
const mapOrigem = mapVendedor;
const mapTransp = (r: any): Transportadora => ({
  id: r.id, nome: r.nome, ativo: r.ativo,
  tipoFrete: r.tipo_frete ?? undefined, prazoEntrega: r.prazo_entrega ?? undefined,
});
const mapCliente = (r: any): Cliente => ({
  id: r.id, nome: r.nome, tipo: r.tipo, documento: r.documento, ie: r.ie ?? undefined,
  contatos: r.contatos ?? [], enderecos: r.enderecos ?? [], observacoes: r.observacoes ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapOrcamento = (r: any): Orcamento => ({
  id: r.id, numero: r.numero, clienteId: r.cliente_id ?? "",
  clienteSnapshot: r.cliente_snapshot ?? undefined,
  contatoNome: r.contato_nome ?? undefined, contatoTelefone: r.contato_telefone ?? undefined,
  contatoEmail: r.contato_email ?? undefined, vendedorId: r.vendedor_id ?? undefined,
  origemId: r.origem_id ?? undefined, itens: r.itens ?? [], subtotal: Number(r.subtotal ?? 0),
  freteTipo: r.frete_tipo ?? null, freteValor: Number(r.frete_valor ?? 0),
  transportadoraId: r.transportadora_id ?? undefined, prazoEntrega: r.prazo_entrega ?? undefined,
  pagamentoId: r.pagamento_id ?? undefined, observacoes: r.observacoes ?? undefined,
  status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  aprovadoEm: r.aprovado_em ?? undefined, anexoUrl: r.anexo_url ?? undefined,
  prazoProducaoDias: r.prazo_producao_dias ?? undefined,
  dataProduzirAte: r.data_produzir_ate ?? undefined,
  dataDespacharAte: r.data_despachar_ate ?? undefined,
});
const orcamentoToDb = (o: Partial<Orcamento>): any => {
  const out: any = {};
  if (o.id !== undefined) out.id = o.id;
  if (o.numero !== undefined) out.numero = o.numero;
  if (o.clienteId !== undefined) out.cliente_id = o.clienteId || null;
  if (o.clienteSnapshot !== undefined) out.cliente_snapshot = o.clienteSnapshot as any;
  if (o.contatoNome !== undefined) out.contato_nome = o.contatoNome ?? null;
  if (o.contatoTelefone !== undefined) out.contato_telefone = o.contatoTelefone ?? null;
  if (o.contatoEmail !== undefined) out.contato_email = o.contatoEmail ?? null;
  if (o.vendedorId !== undefined) out.vendedor_id = o.vendedorId ?? null;
  if (o.origemId !== undefined) out.origem_id = o.origemId ?? null;
  if (o.itens !== undefined) out.itens = o.itens as any;
  if (o.subtotal !== undefined) out.subtotal = o.subtotal;
  if (o.freteTipo !== undefined) out.frete_tipo = o.freteTipo;
  if (o.freteValor !== undefined) out.frete_valor = o.freteValor;
  if (o.transportadoraId !== undefined) out.transportadora_id = o.transportadoraId ?? null;
  if (o.prazoEntrega !== undefined) out.prazo_entrega = o.prazoEntrega ?? null;
  if (o.pagamentoId !== undefined) out.pagamento_id = o.pagamentoId ?? null;
  if (o.observacoes !== undefined) out.observacoes = o.observacoes ?? null;
  if (o.status !== undefined) out.status = o.status;
  if (o.aprovadoEm !== undefined) out.aprovado_em = o.aprovadoEm ?? null;
  if (o.anexoUrl !== undefined) out.anexo_url = o.anexoUrl ?? null;
  out.updated_at = new Date().toISOString();
  return out;
};
const mapPedido = (r: any): Pedido => ({
  id: r.id, numero: r.numero, orcamentoId: r.orcamento_id ?? "",
  clienteId: r.cliente_id ?? "",
  clienteSnapshot: r.cliente_snapshot ?? undefined,
  contatoNome: r.contato_nome ?? undefined,
  contatoTelefone: r.contato_telefone ?? undefined, contatoEmail: r.contato_email ?? undefined,
  vendedorId: r.vendedor_id ?? undefined, itens: r.itens ?? [],
  subtotal: Number(r.subtotal ?? 0), freteTipo: r.frete_tipo ?? null,
  freteValor: Number(r.frete_valor ?? 0), total: Number(r.total ?? 0),
  transportadoraId: r.transportadora_id ?? undefined, prazoEntrega: r.prazo_entrega ?? undefined,
  pagamentoId: r.pagamento_id ?? undefined, observacoes: r.observacoes ?? undefined,
  status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  prazoProducaoDias: r.prazo_producao_dias ?? undefined,
  dataProduzirAte: r.data_produzir_ate ?? undefined,
  dataDespacharAte: r.data_despachar_ate ?? undefined,
});
const pedidoToDb = (p: Partial<Pedido>): any => {
  const out: any = {};
  if (p.id !== undefined) out.id = p.id;
  if (p.numero !== undefined) out.numero = p.numero;
  if (p.orcamentoId !== undefined) out.orcamento_id = p.orcamentoId ?? null;
  if (p.clienteId !== undefined) out.cliente_id = p.clienteId || null;
  if (p.clienteSnapshot !== undefined) out.cliente_snapshot = p.clienteSnapshot as any;
  if (p.contatoNome !== undefined) out.contato_nome = p.contatoNome ?? null;
  if (p.contatoTelefone !== undefined) out.contato_telefone = p.contatoTelefone ?? null;
  if (p.contatoEmail !== undefined) out.contato_email = p.contatoEmail ?? null;
  if (p.vendedorId !== undefined) out.vendedor_id = p.vendedorId ?? null;
  if (p.itens !== undefined) out.itens = p.itens as any;
  if (p.subtotal !== undefined) out.subtotal = p.subtotal;
  if (p.freteTipo !== undefined) out.frete_tipo = p.freteTipo;
  if (p.freteValor !== undefined) out.frete_valor = p.freteValor;
  if (p.total !== undefined) out.total = p.total;
  if (p.transportadoraId !== undefined) out.transportadora_id = p.transportadoraId ?? null;
  if (p.prazoEntrega !== undefined) out.prazo_entrega = p.prazoEntrega ?? null;
  if (p.pagamentoId !== undefined) out.pagamento_id = p.pagamentoId ?? null;
  if (p.observacoes !== undefined) out.observacoes = p.observacoes ?? null;
  if (p.status !== undefined) out.status = p.status;
  if (p.prazoProducaoDias !== undefined) out.prazo_producao_dias = p.prazoProducaoDias;
  if (p.dataProduzirAte !== undefined) out.data_produzir_ate = p.dataProduzirAte ?? null;
  if (p.dataDespacharAte !== undefined) out.data_despachar_ate = p.dataDespacharAte ?? null;
  out.updated_at = new Date().toISOString();
  return out;
};

export const SistemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<SistemaData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [currentVendedor, setCurrentVendedorState] = useState<LookupItem | null>(() => {
    try { const raw = localStorage.getItem(VENDEDOR_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  useEffect(() => {
    try {
      if (currentVendedor) localStorage.setItem(VENDEDOR_KEY, JSON.stringify(currentVendedor));
      else localStorage.removeItem(VENDEDOR_KEY);
    } catch {}
  }, [currentVendedor]);

  const migratedRef = useRef(false);
  const loadedRef = useRef(false);

  const reconcileCurrentVendedor = useCallback((vendedores: LookupItem[]) => {
    setCurrentVendedorState(prev => {
      if (prev) {
        const fresh = vendedores.find(v => v.id === prev.id);
        if (fresh) return fresh;
        return vendedores.length > 0 ? null : prev;
      }

      const ativos = vendedores.filter(v => v.ativo !== false);
      return ativos.length === 1 ? ativos[0] : null;
    });
  }, []);

  const refreshOrcamentos = useCallback(async (opts?: {
    vendedorId?: string | null;
    status?: string | null;
    search?: string | null;
    cliente?: string | null;
    limit?: number;
  }): Promise<Orcamento[]> => {
    const { data: payload, error } = await supabase.rpc("sistema_list_orcamentos", {
      p_vendedor_id: opts?.vendedorId || null,
      p_status: opts?.status && opts.status !== "todos" ? opts.status : null,
      p_search: opts?.search || null,
      p_cliente: opts?.cliente || null,
      p_limit: opts?.limit ?? 300,
    });

    if (error) {
      console.error("[Sistema] carregar orçamentos falhou:", error);
      toast.error(`Não foi possível carregar os orçamentos. ${error.message || ""}`);
      throw error;
    }

    const rows = arr<any>((payload as any)?.rows).map(mapOrcamento);
    setData(prev => {
      // Preserva itens já carregados (a função leve devolve itens vazios)
      const prevById = new Map(prev.orcamentos.map(o => [o.id, o]));
      const merged = rows.map(r => {
        const prevOrc = prevById.get(r.id);
        return prevOrc && prevOrc.itens.length > 0 ? { ...r, itens: prevOrc.itens } : r;
      });
      return { ...prev, orcamentos: merged };
    });
    return rows;
  }, []);

  const fetchOrcamentoCompleto = useCallback(async (id: string): Promise<Orcamento | null> => {
    const { data, error } = await supabase.rpc("sistema_get_orcamento", { p_id: id });
    if (error) {
      console.error("[Sistema] carregar orçamento falhou:", error);
      toast.error(`Não foi possível abrir o orçamento. ${error.message || ""}`);
      return null;
    }
    if (!data) return null;
    const full = mapOrcamento(data as any);
    setData(prev => ({
      ...prev,
      orcamentos: prev.orcamentos.map(o => o.id === id ? { ...o, ...full } : o),
    }));
    return full;
  }, []);

  const loadAll = useCallback(async (force = false) => {
    if (loadedRef.current && !force) return;
    setLoading(prev => (loadedRef.current ? prev : true));
    try {
      const [bootstrapRes, clientesRes, orcamentosRes] = await Promise.all([
        supabase.rpc("sistema_get_bootstrap"),
        supabase.from("sistema_clientes").select("*").order("nome"),
        supabase.rpc("sistema_list_orcamentos", { p_limit: 300 }),
      ]);

      if (bootstrapRes.error) throw bootstrapRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (orcamentosRes.error) throw orcamentosRes.error;

      const bootstrap = (bootstrapRes.data ?? {}) as any;
      const vendedores = arr<any>(bootstrap.vendedores).map(mapVendedor);

      setData(prev => {
        // Preserva itens já carregados: a listagem leve devolve itens vazios e
        // não pode "zerar" o que já está visível na tela.
        const prevById = new Map(prev.orcamentos.map(o => [o.id, o]));
        const orcamentos = arr<any>((orcamentosRes.data as any)?.rows).map(mapOrcamento).map(r => {
          const prevOrc = prevById.get(r.id);
          return prevOrc && prevOrc.itens.length > 0 ? { ...r, itens: prevOrc.itens } : r;
        });
        return {
          ...prev,
          vendedores,
          meiosPagamento: arr<any>(bootstrap.meios_pagamento).map(mapMeio),
          transportadoras: arr<any>(bootstrap.transportadoras).map(mapTransp),
          origens: arr<any>(bootstrap.origens).map(mapOrigem),
          clientes: (clientesRes.data ?? []).map(mapCliente),
          orcamentos,
        };
      });

      reconcileCurrentVendedor(vendedores);
      loadedRef.current = true;
      setLoading(false);

      Promise.all([
        supabase.from("sistema_pedidos").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("sistema_ajustes_estoque").select("*").order("created_at", { ascending: false }).limit(1000),
      ]).then(([p, ae]) => {
        setData(prev => ({
          ...prev,
          pedidos: (p.data ?? []).map(mapPedido),
          ajustesEstoque: (ae.data ?? []).map((r: any) => ({
            id: r.id, produtoId: r.produto_id ?? "", codigoComposto: r.codigo_composto ?? "",
            varianteSlug: r.variante_slug ?? undefined, tipo: r.tipo, quantidade: r.quantidade,
            motivo: r.motivo ?? "", orcamentoId: r.orcamento_id ?? undefined,
            pedidoId: r.pedido_id ?? undefined, createdAt: r.created_at, createdBy: r.created_by ?? undefined,
          })),
        }));
      }).catch(e => console.warn("[Sistema] carga secundária falhou", e));
    } catch (e: any) {
      console.error("[Sistema] carregamento inicial falhou:", e);
      toast.error(`Não foi possível carregar o sistema. ${e?.message || "Tente novamente."}`);
      if (!loadedRef.current) setLoading(false);
    }
  }, [reconcileCurrentVendedor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Só carrega/migra dados com sessão autenticada — sem sessão, RLS devolve
      // listas vazias e gravações falham (causa do "sumiço" dos orçamentos).
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setLoading(false); return; }

      // One-time migration from legacy localStorage
      if (!migratedRef.current) {
        migratedRef.current = true;
        try {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) {
            const legacy = JSON.parse(raw);
            await migrateLegacy(legacy);
            localStorage.removeItem(LEGACY_KEY);
          }
        } catch (e) { console.warn("Legacy migration skipped", e); }
      }
      await loadAll();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN também é emitido em refresh de token / retorno de foco.
      // Recarregar tudo nesses casos causava piscar/sumiço dos itens.
      if (event === "SIGNED_IN" && session && !loadedRef.current) {
        setTimeout(() => { loadAll(true); }, 0);
      }
      if (event === "SIGNED_OUT") {
        loadedRef.current = false;
        setData(emptyData);
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [loadAll]);

  // ---------- Orcamentos ----------
  const addOrcamento = useCallback(async (o: Omit<Orcamento, "id" | "numero" | "createdAt" | "updatedAt">): Promise<Orcamento> => {
    const { data: numeroData, error: numeroError } = await supabase.rpc("sistema_next_orcamento_numero");
    if (numeroError) {
      reportDbError("número do orçamento")({ error: numeroError });
      throw numeroError;
    }
    const numero = (numeroData as any) ?? String(Date.now());
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const orcamento: Orcamento = { ...o, id, numero, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, orcamentos: [orcamento, ...prev.orcamentos] }));
    const res = await dbWrite("orçamento", () => supabase.from("sistema_orcamentos").insert({ ...orcamentoToDb(orcamento), created_at: now }));
    if (res?.error) {
      setData(prev => ({ ...prev, orcamentos: prev.orcamentos.filter(item => item.id !== id) }));
      throw res.error;
    }
    await refreshOrcamentos({ limit: 300 }).catch(() => undefined);
    return orcamento;
  }, [refreshOrcamentos]);

  const updateOrcamento = useCallback(async (id: string, changes: Partial<Orcamento>) => {
    setData(prev => ({
      ...prev,
      orcamentos: prev.orcamentos.map(o => o.id === id ? { ...o, ...changes, updatedAt: new Date().toISOString() } : o),
    }));
    const res = await dbWrite("orçamento", () => supabase.from("sistema_orcamentos").update(orcamentoToDb(changes)).eq("id", id));
    if (res?.error) throw res.error;
    await refreshOrcamentos({ limit: 300 }).catch(() => undefined);
  }, [refreshOrcamentos]);

  const removeOrcamento = useCallback((id: string) => {
    setData(prev => ({ ...prev, orcamentos: prev.orcamentos.filter(o => o.id !== id) }));
    dbWrite("excluir orçamento", () => supabase.from("sistema_orcamentos").delete().eq("id", id));
  }, []);

  const gerarNumeroOrcamento = useCallback(() => {
    const BASE = 125748;
    return String(BASE + data.orcamentos.length + 1);
  }, [data.orcamentos.length]);

  const gerarNumeroPedido = useCallback(() => {
    const seq = data.pedidos.length + 1;
    return `PED-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
  }, [data.pedidos.length]);

  const aprovarOrcamento = useCallback(async (id: string): Promise<Pedido | null> => {
    let orcamento = data.orcamentos.find(o => o.id === id);
    if (!orcamento || orcamento.status !== "aberto") return null;

    // A listagem é "leve" (itens vazios). Sem recarregar o orçamento completo,
    // o pedido seria criado com itens: [] — causa da tabela vazia em /sistema/pedidos.
    if (orcamento.itens.length === 0) {
      const { data: full } = await supabase.rpc("sistema_get_orcamento", { p_id: id });
      const mapped = full ? mapOrcamento(full as any) : null;
      if (mapped && mapped.itens.length > 0) orcamento = { ...orcamento, itens: mapped.itens };
    }

    const now = new Date().toISOString();
    const { data: nrData } = await supabase.rpc("sistema_next_pedido_numero");
    const numero = (nrData as any) ?? `PED-${Date.now()}`;
    const pedidoId = crypto.randomUUID();

    const itensPedido: PedidoItem[] = orcamento.itens.map(item => ({
      id: crypto.randomUUID(), produtoId: item.produtoId, codigoComposto: item.codigoComposto,
      varianteSlug: item.varianteSlug, nome: item.nome, quantidade: item.quantidade,
      precoUnitario: item.precoUnitario, total: item.quantidade * item.precoUnitario,
      mockupImagem: item.mockupImagem, imagem: item.imagem, observacao: (item as any).observacao,
    }));

    const pedido: Pedido = {
      id: pedidoId, numero, orcamentoId: orcamento.id, clienteId: orcamento.clienteId,
      contatoNome: orcamento.contatoNome, contatoTelefone: orcamento.contatoTelefone,
      contatoEmail: orcamento.contatoEmail, vendedorId: orcamento.vendedorId, itens: itensPedido,
      subtotal: orcamento.subtotal, freteTipo: orcamento.freteTipo, freteValor: orcamento.freteValor,
      total: orcamento.subtotal + orcamento.freteValor, transportadoraId: orcamento.transportadoraId,
      prazoEntrega: orcamento.prazoEntrega, pagamentoId: orcamento.pagamentoId,
      observacoes: orcamento.observacoes, status: "novo", createdAt: now, updatedAt: now,
    };

    const reservas: StockAdjustment[] = itensPedido.map(item => ({
      id: crypto.randomUUID(), produtoId: item.produtoId || "",
      codigoComposto: item.codigoComposto || item.produtoId || "", varianteSlug: item.varianteSlug,
      tipo: "reserva", quantidade: -item.quantidade, motivo: `Pedido ${numero}`,
      orcamentoId: orcamento.id, pedidoId: pedido.id, createdAt: now,
    }));

    setData(prev => ({
      ...prev,
      pedidos: [pedido, ...prev.pedidos],
      orcamentos: prev.orcamentos.map(o => o.id === id ? { ...o, status: "aprovado" as const, aprovadoEm: now, updatedAt: now } : o),
      ajustesEstoque: [...reservas, ...prev.ajustesEstoque],
    }));

    await Promise.all([
      dbWrite("pedido", () => supabase.from("sistema_pedidos").insert({ ...pedidoToDb(pedido), created_at: now })),
      dbWrite("orçamento", () => supabase.from("sistema_orcamentos").update({ status: "aprovado", aprovado_em: now, updated_at: now }).eq("id", id)),
      dbWrite("reserva de estoque", () => supabase.from("sistema_ajustes_estoque").insert(reservas.map(r => ({
        id: r.id, produto_id: r.produtoId, codigo_composto: r.codigoComposto, variante_slug: r.varianteSlug,
        tipo: r.tipo, quantidade: r.quantidade, motivo: r.motivo, orcamento_id: r.orcamentoId, pedido_id: r.pedidoId,
      })))),
    ]);

    return pedido;
  }, [data.orcamentos]);

  const updatePedido = useCallback((id: string, changes: Partial<Pedido>) => {
    setData(prev => ({
      ...prev,
      pedidos: prev.pedidos.map(p => p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p),
    }));
    dbWrite("pedido", () => supabase.from("sistema_pedidos").update(pedidoToDb(changes)).eq("id", id));
  }, []);

  // ---------- Clientes ----------
  const addCliente = useCallback((c: Omit<Cliente, "id" | "createdAt" | "updatedAt">): Cliente => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cliente: Cliente = { ...c, id, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, clientes: [...prev.clientes, cliente] }));
    dbWrite("cliente", () => supabase.from("sistema_clientes").insert({
      id, nome: c.nome, tipo: c.tipo, documento: c.documento, ie: c.ie ?? null,
      contatos: c.contatos as any, enderecos: c.enderecos as any, observacoes: c.observacoes ?? null,
    }));
    return cliente;
  }, []);

  const updateCliente = useCallback((id: string, changes: Partial<Cliente>) => {
    setData(prev => ({
      ...prev,
      clientes: prev.clientes.map(c => c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c),
    }));
    const dbc: any = { updated_at: new Date().toISOString() };
    if (changes.nome !== undefined) dbc.nome = changes.nome;
    if (changes.tipo !== undefined) dbc.tipo = changes.tipo;
    if (changes.documento !== undefined) dbc.documento = changes.documento;
    if (changes.ie !== undefined) dbc.ie = changes.ie ?? null;
    if (changes.contatos !== undefined) dbc.contatos = changes.contatos as any;
    if (changes.enderecos !== undefined) dbc.enderecos = changes.enderecos as any;
    if (changes.observacoes !== undefined) dbc.observacoes = changes.observacoes ?? null;
    dbWrite("cliente", () => supabase.from("sistema_clientes").update(dbc).eq("id", id));
  }, []);

  const removeCliente = useCallback((id: string) => {
    setData(prev => ({ ...prev, clientes: prev.clientes.filter(c => c.id !== id) }));
    dbWrite("excluir cliente", () => supabase.from("sistema_clientes").delete().eq("id", id));
  }, []);

  // ---------- Generic lookup helpers ----------
  const addLookup = useCallback(<K extends keyof SistemaData>(
    key: K, table: "sistema_vendedores" | "sistema_meios_pagamento" | "sistema_origens",
    nome: string,
  ): LookupItem => {
    const item: LookupItem = { id: crypto.randomUUID(), nome, ativo: true };
    setData(prev => ({ ...prev, [key]: [...(prev[key] as any), item] } as any));
    dbWrite("cadastro", () => supabase.from(table).insert({ id: item.id, nome, ativo: true }));
    return item;
  }, []);

  const updateLookup = useCallback((
    key: keyof SistemaData, table: "sistema_vendedores" | "sistema_meios_pagamento" | "sistema_origens",
    id: string, nome: string,
  ) => {
    setData(prev => ({ ...prev, [key]: (prev[key] as any[]).map(x => x.id === id ? { ...x, nome } : x) } as any));
    dbWrite("cadastro", () => supabase.from(table).update({ nome, updated_at: new Date().toISOString() }).eq("id", id));
  }, []);

  const removeLookup = useCallback((
    key: keyof SistemaData, table: "sistema_vendedores" | "sistema_meios_pagamento" | "sistema_origens" | "sistema_transportadoras",
    id: string,
  ) => {
    setData(prev => ({ ...prev, [key]: (prev[key] as any[]).filter(x => x.id !== id) } as any));
    dbWrite("excluir cadastro", () => supabase.from(table).delete().eq("id", id));
  }, []);

  const toggleLookupAtivo = useCallback((
    key: keyof SistemaData, table: "sistema_vendedores" | "sistema_meios_pagamento" | "sistema_origens" | "sistema_transportadoras",
    id: string,
  ) => {
    let novoAtivo = true;
    setData(prev => {
      const arr = (prev[key] as any[]).map(x => {
        if (x.id === id) { novoAtivo = !x.ativo; return { ...x, ativo: novoAtivo }; }
        return x;
      });
      return { ...prev, [key]: arr } as any;
    });
    // Need correct value - use a small delay through promise
    setTimeout(() => {
      dbWrite("cadastro", () => supabase.from(table).update({ ativo: novoAtivo, updated_at: new Date().toISOString() }).eq("id", id));
    }, 0);
  }, []);

  const addVendedor = useCallback((nome: string) => addLookup("vendedores", "sistema_vendedores", nome), [addLookup]);
  const updateVendedor = useCallback((id: string, nome: string) => updateLookup("vendedores", "sistema_vendedores", id, nome), [updateLookup]);
  const removeVendedor = useCallback((id: string) => removeLookup("vendedores", "sistema_vendedores", id), [removeLookup]);
  const toggleVendedorAtivo = useCallback((id: string) => toggleLookupAtivo("vendedores", "sistema_vendedores", id), [toggleLookupAtivo]);

  const addMeioPagamento = useCallback((nome: string) => addLookup("meiosPagamento", "sistema_meios_pagamento", nome), [addLookup]);
  const updateMeioPagamento = useCallback((id: string, nome: string) => updateLookup("meiosPagamento", "sistema_meios_pagamento", id, nome), [updateLookup]);
  const removeMeioPagamento = useCallback((id: string) => removeLookup("meiosPagamento", "sistema_meios_pagamento", id), [removeLookup]);
  const toggleMeioPagamentoAtivo = useCallback((id: string) => toggleLookupAtivo("meiosPagamento", "sistema_meios_pagamento", id), [toggleLookupAtivo]);

  const addOrigem = useCallback((nome: string) => addLookup("origens", "sistema_origens", nome), [addLookup]);
  const updateOrigem = useCallback((id: string, nome: string) => updateLookup("origens", "sistema_origens", id, nome), [updateLookup]);
  const removeOrigem = useCallback((id: string) => removeLookup("origens", "sistema_origens", id), [removeLookup]);
  const toggleOrigemAtivo = useCallback((id: string) => toggleLookupAtivo("origens", "sistema_origens", id), [toggleLookupAtivo]);

  // ---------- Transportadoras ----------
  const addTransportadora = useCallback((nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number): Transportadora => {
    const item: Transportadora = { id: crypto.randomUUID(), nome, ativo: true, tipoFrete, prazoEntrega };
    setData(prev => ({ ...prev, transportadoras: [...prev.transportadoras, item] }));
    dbWrite("transportadora", () => supabase.from("sistema_transportadoras").insert({
      id: item.id, nome, ativo: true, tipo_frete: tipoFrete ?? null, prazo_entrega: prazoEntrega ?? null,
    }));
    return item;
  }, []);

  const updateTransportadora = useCallback((id: string, nome: string, tipoFrete?: "CIF" | "FOB", prazoEntrega?: number) => {
    setData(prev => ({
      ...prev,
      transportadoras: prev.transportadoras.map(t => t.id === id ? { ...t, nome, tipoFrete, prazoEntrega } : t),
    }));
    dbWrite("transportadora", () => supabase.from("sistema_transportadoras").update({
      nome, tipo_frete: tipoFrete ?? null, prazo_entrega: prazoEntrega ?? null, updated_at: new Date().toISOString(),
    }).eq("id", id));
  }, []);

  const removeTransportadora = useCallback((id: string) => removeLookup("transportadoras", "sistema_transportadoras", id), [removeLookup]);
  const toggleTransportadoraAtivo = useCallback((id: string) => toggleLookupAtivo("transportadoras", "sistema_transportadoras", id), [toggleLookupAtivo]);

  const getEstoqueDisponivel = useCallback((produtoId: string, codigoComposto: string) => {
    const baseStock = 100;
    const ajuste = data.ajustesEstoque
      .filter(a => a.codigoComposto === codigoComposto || a.produtoId === produtoId)
      .reduce((sum, a) => sum + a.quantidade, 0);
    return Math.max(0, baseStock + ajuste);
  }, [data.ajustesEstoque]);

  const value = useMemo<SistemaContextType>(() => ({
    ...data, loading,
    refreshOrcamentos, fetchOrcamentoCompleto,
    addOrcamento, updateOrcamento, removeOrcamento, aprovarOrcamento, updatePedido,
    addCliente, updateCliente, removeCliente,
    addVendedor, updateVendedor, removeVendedor, toggleVendedorAtivo,
    addMeioPagamento, updateMeioPagamento, removeMeioPagamento, toggleMeioPagamentoAtivo,
    addTransportadora, updateTransportadora, removeTransportadora, toggleTransportadoraAtivo,
    addOrigem, updateOrigem, removeOrigem, toggleOrigemAtivo,
    currentVendedor, setCurrentVendedor: setCurrentVendedorState,
    getEstoqueDisponivel, gerarNumeroOrcamento, gerarNumeroPedido,
  }), [
    data, loading, refreshOrcamentos, fetchOrcamentoCompleto, addOrcamento, updateOrcamento, removeOrcamento, aprovarOrcamento, updatePedido,
    addCliente, updateCliente, removeCliente,
    addVendedor, updateVendedor, removeVendedor, toggleVendedorAtivo,
    addMeioPagamento, updateMeioPagamento, removeMeioPagamento, toggleMeioPagamentoAtivo,
    addTransportadora, updateTransportadora, removeTransportadora, toggleTransportadoraAtivo,
    addOrigem, updateOrigem, removeOrigem, toggleOrigemAtivo,
    currentVendedor, getEstoqueDisponivel, gerarNumeroOrcamento, gerarNumeroPedido,
  ]);

  return <SistemaContext.Provider value={value}>{children}</SistemaContext.Provider>;
};

// One-time legacy migration helper
async function migrateLegacy(legacy: any) {
  if (!legacy || typeof legacy !== "object") return;
  try {
    if (Array.isArray(legacy.vendedores) && legacy.vendedores.length) {
      await supabase.from("sistema_vendedores").upsert(
        legacy.vendedores.filter((v: any) => !["v1","v2"].includes(v.id)).map((v: any) => ({
          id: isUuid(v.id) ? v.id : crypto.randomUUID(), nome: v.nome, ativo: v.ativo ?? true,
        })), { onConflict: "id" }
      );
    }
    if (Array.isArray(legacy.meiosPagamento)) {
      await supabase.from("sistema_meios_pagamento").upsert(
        legacy.meiosPagamento.filter((x: any) => !/^p\d+$/.test(x.id)).map((x: any) => ({
          id: isUuid(x.id) ? x.id : crypto.randomUUID(), nome: x.nome, ativo: x.ativo ?? true,
        })), { onConflict: "id" }
      );
    }
    if (Array.isArray(legacy.transportadoras)) {
      await supabase.from("sistema_transportadoras").upsert(
        legacy.transportadoras.filter((x: any) => !/^t\d+$/.test(x.id)).map((x: any) => ({
          id: isUuid(x.id) ? x.id : crypto.randomUUID(), nome: x.nome, ativo: x.ativo ?? true,
          tipo_frete: x.tipoFrete ?? null, prazo_entrega: x.prazoEntrega ?? null,
        })), { onConflict: "id" }
      );
    }
    if (Array.isArray(legacy.origens)) {
      await supabase.from("sistema_origens").upsert(
        legacy.origens.filter((x: any) => !/^o\d+$/.test(x.id)).map((x: any) => ({
          id: isUuid(x.id) ? x.id : crypto.randomUUID(), nome: x.nome, ativo: x.ativo ?? true,
        })), { onConflict: "id" }
      );
    }
    if (Array.isArray(legacy.clientes)) {
      await supabase.from("sistema_clientes").upsert(
        legacy.clientes.map((c: any) => ({
          id: isUuid(c.id) ? c.id : crypto.randomUUID(), nome: c.nome, tipo: c.tipo,
          documento: c.documento, ie: c.ie ?? null, contatos: c.contatos ?? [],
          enderecos: c.enderecos ?? [], observacoes: c.observacoes ?? null,
        })), { onConflict: "id" }
      );
    }
    if (Array.isArray(legacy.orcamentos)) {
      for (const o of legacy.orcamentos) {
        await supabase.from("sistema_orcamentos").upsert({
          id: isUuid(o.id) ? o.id : crypto.randomUUID(),
          numero: o.numero ?? String(Date.now()),
          cliente_id: o.clienteId || null, contato_nome: o.contatoNome ?? null,
          contato_telefone: o.contatoTelefone ?? null, contato_email: o.contatoEmail ?? null,
          vendedor_id: isUuid(o.vendedorId) ? o.vendedorId : null,
          origem_id: isUuid(o.origemId) ? o.origemId : null,
          itens: o.itens ?? [], subtotal: o.subtotal ?? 0, frete_tipo: o.freteTipo ?? null,
          frete_valor: o.freteValor ?? 0,
          transportadora_id: isUuid(o.transportadoraId) ? o.transportadoraId : null,
          prazo_entrega: o.prazoEntrega ?? null,
          pagamento_id: isUuid(o.pagamentoId) ? o.pagamentoId : null,
          observacoes: o.observacoes ?? null, status: o.status ?? "aberto",
          aprovado_em: o.aprovadoEm ?? null, anexo_url: o.anexoUrl ?? null,
        }, { onConflict: "id" });
      }
    }
    if (Array.isArray(legacy.pedidos)) {
      for (const p of legacy.pedidos) {
        await supabase.from("sistema_pedidos").upsert({
          id: isUuid(p.id) ? p.id : crypto.randomUUID(),
          numero: p.numero ?? `PED-${Date.now()}`,
          orcamento_id: isUuid(p.orcamentoId) ? p.orcamentoId : null,
          cliente_id: p.clienteId || null,
          contato_nome: p.contatoNome ?? null, contato_telefone: p.contatoTelefone ?? null,
          contato_email: p.contatoEmail ?? null,
          vendedor_id: isUuid(p.vendedorId) ? p.vendedorId : null,
          itens: p.itens ?? [], subtotal: p.subtotal ?? 0, frete_tipo: p.freteTipo ?? null,
          frete_valor: p.freteValor ?? 0, total: p.total ?? 0,
          transportadora_id: isUuid(p.transportadoraId) ? p.transportadoraId : null,
          prazo_entrega: p.prazoEntrega ?? null,
          pagamento_id: isUuid(p.pagamentoId) ? p.pagamentoId : null,
          observacoes: p.observacoes ?? null, status: p.status ?? "novo",
        }, { onConflict: "id" });
      }
    }
  } catch (e) {
    console.warn("migrateLegacy error", e);
  }
}

function isUuid(v: any): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Helper functions
export const calcSubtotal = (orcamento: Orcamento): number =>
  orcamento.itens.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);

export const calcTotal = (orcamento: Orcamento): number =>
  calcSubtotal(orcamento) + (orcamento.freteValor || 0);

export const clienteDisplay = (cliente: Cliente | null | undefined): string => {
  if (!cliente) return "—";
  return cliente.nome || "—";
};

export const useSistema = () => {
  const ctx = useContext(SistemaContext);
  if (!ctx) throw new Error("useSistema must be used within SistemaProvider");
  return ctx;
};
