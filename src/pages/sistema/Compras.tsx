import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Package, ShoppingBag, Undo2, Search, Plus, Trash2, FileText, ChevronDown, ChevronRight, ClipboardList, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { cn } from "@/lib/utils";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import { useSistema } from "@/contexts/SistemaContext";
import { obterPerfil, vendedorRestritoDe, useUserRole } from "@/hooks/useUserRole";
import { gerarPedidoCompraPDF } from "./pedidoCompraPDF";
import { gerarRelatorioComprasPDF, gerarRelatorioComprasHTML, copiarRelatorioComprasTXT } from "./relatorioCompras";
import { variacaoDoItem } from "./ordemProducaoPDF";
import { ehTagCompra } from "@/lib/tagsPcp";
import ConferenciaCompra, { ImpressoChip, ROTULO_STATUS, StatusCompraChip, statusCompra, type CompraConferivel, type StatusCompra } from "./compras/ConferenciaCompra";

/* Compras: tudo que está em "Aguardando Mercadoria" no PCP.
   - Aba "A comprar": marca os produtos comprados (caixinha) e registra a
     compra num popup (fornecedor, quantidade, valores). Grava a MESMA
     etiqueta COMPRADO XBZ/SP do PCP, então os dois ficam ligados.
   - Aba "Pedidos de compra": cada compra registrada, com o PDF A4 (com ou
     sem preço) para a expedição conferir. Preço só o admin vê. Baixar o PDF
     marca "Impresso"; a produção confere o recebimento item a item
     (compras/ConferenciaCompra) e o pedido fecha como RECEBIDO OK ou
     RECEBIDO C/ FALTAS. */

interface LinhaCompra {
  producao_id: string;
  pedido_id: string;
  pedido_numero: string;
  cliente: string | null;
  produto_nome: string | null;
  quantidade: number | null;
  mockup_url: string | null;
  imagem_catalogo_url: string | null;
  item_posicao: number | null;
  data_entrega_item: string | null;
  tags: string[] | null;
  status: string;
  sku?: string | null;
  variacao?: string | null;
}

interface LinhaPopup {
  chave: string;
  producaoId: string | null;
  pedidoNumero: string | null;
  cliente: string | null;
  produto: string;
  sku: string | null;
  variacao: string | null;
  foto: string | null;
  quantidade: string;
  unitario: string;
}

interface CompraRegistrada extends CompraConferivel {
  fornecedor: string;
  criado_por_nome: string | null;
  criado_em: string;
}

const FORNECEDORES = ["XBZ", "SP", "OUTRO"] as const;
const origemDe = (r: LinhaCompra): string | null => {
  const t = (r.tags ?? []).find(ehTagCompra);
  return t ? t.trim().replace(/^comprado\s*/i, "").toUpperCase() || "—" : null;
};

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const aNumero = (txt: string) => {
  const n = Number(String(txt).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Filtro = "pendentes" | "comprados" | "todos";
type Aba = "comprar" | "pedidos";

export default function Compras() {
  const queryClient = useQueryClient();
  const { currentVendedor } = useSistema();
  const { isAdmin, nome: nomeLogado } = useUserRole();
  const [aba, setAba] = useState<Aba>("comprar");
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  // popup de compra
  const [popupAberto, setPopupAberto] = useState(false);
  const [fornecedor, setFornecedor] = useState<string>("XBZ");
  const [fornecedorOutro, setFornecedorOutro] = useState("");
  const [linhasPopup, setLinhasPopup] = useState<LinhaPopup[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data: linhas = [], isLoading, refetch } = useQuery({
    queryKey: ["sistema", "compras"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const restrito = vendedorRestritoDe(await obterPerfil(queryClient));
      let q = supabase
        .from("vw_pcp" as any)
        .select("producao_id,pedido_id,pedido_numero,cliente,produto_nome,quantidade,mockup_url,imagem_catalogo_url,item_posicao,data_entrega_item,tags,status")
        .eq("coluna_pcp", "aguardando_mercadoria");
      if (restrito) q = q.eq("pedido_vendedor_id", restrito);
      const { data, error } = await q;
      if (error) {
        toast.error(`Não foi possível carregar as compras. ${error.message || ""}`);
        throw error;
      }
      const lista = (data as any as LinhaCompra[]) ?? [];
      // SKU e variação vêm do item dentro do pedido (a view não os expõe).
      const ids = [...new Set(lista.map(l => l.pedido_id))];
      if (ids.length) {
        const { data: peds } = await supabase.from("sistema_pedidos").select("id,itens").in("id", ids);
        const porPedido = new Map((peds ?? []).map((p: any) => [p.id, (p.itens as any[]) ?? []]));
        const semFoto: { l: LinhaCompra; it: any }[] = [];
        for (const l of lista) {
          const it = porPedido.get(l.pedido_id)?.[(l.item_posicao ?? 1) - 1];
          if (it) {
            l.sku = it.codigoComposto ?? null;
            l.variacao = variacaoDoItem(it.nome ?? l.produto_nome ?? "", it.varianteSlug) || null;
            if (!l.mockup_url && !l.imagem_catalogo_url) semFoto.push({ l, it });
          }
        }
        // Sem mockup nem imagem no pedido: usa a foto do produto no catálogo do sistema.
        if (semFoto.length) {
          const idsProd = [...new Set(semFoto.map(x => x.it.produtoId).filter(Boolean))];
          const codigos = [...new Set(semFoto.map(x => x.it.codigoComposto).filter(Boolean))];
          const nomes = [...new Set(semFoto.map(x => String(x.it.nome ?? "").trim()).filter(Boolean))];
          const busca = async (col: string, valores: string[]) =>
            valores.length
              ? ((await (supabase as any).from("products_cache").select("id,nome,codigo_amigavel,image_url").in(col, valores)).data ?? [])
              : [];
          const [porId, porCodigo, porNome] = await Promise.all([busca("id", idsProd), busca("codigo_amigavel", codigos), busca("nome", nomes)]);
          const mapa = new Map<string, string>();
          for (const r of [...porNome, ...porCodigo, ...porId]) {
            if (!r.image_url) continue;
            mapa.set(`id:${r.id}`, r.image_url);
            if (r.codigo_amigavel) mapa.set(`cod:${r.codigo_amigavel}`, r.image_url);
            if (r.nome) mapa.set(`nome:${String(r.nome).trim()}`, r.image_url);
          }
          for (const { l, it } of semFoto) {
            l.imagem_catalogo_url =
              mapa.get(`id:${it.produtoId}`) ?? mapa.get(`cod:${it.codigoComposto}`) ?? mapa.get(`nome:${String(it.nome ?? "").trim()}`) ?? null;
          }
        }
      }
      return lista;
    },
  });

  const { data: compras = [], refetch: refetchCompras } = useQuery({
    queryKey: ["sistema", "compras", "registradas"],
    enabled: aba === "pedidos",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_compras")
        // "*" pra funcionar antes e depois da migration de impressão/recebimento.
        .select("*,itens:sistema_compras_itens(*)")
        .order("numero", { ascending: false })
        .limit(100);
      if (error) {
        toast.error(`Não foi possível carregar os pedidos de compra. ${error.message || ""}`);
        throw error;
      }
      return (data as CompraRegistrada[]).map(c => ({ ...c, itens: [...(c.itens ?? [])].sort((a, b) => a.ordem - b.ordem) }));
    },
  });

  // Tempo real: mudanças nos itens (inclusive vindas do PCP) recarregam.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refetch(), 1500);
    };
    const canal = supabase
      .channel("compras-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_producao_itens" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_pedidos" }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [refetch]);

  // Conferência feita em outra tela/aba aparece na hora.
  useEffect(() => {
    if (aba !== "pedidos") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => { clearTimeout(timer); timer = setTimeout(() => void refetchCompras(), 600); };
    const canal = supabase
      .channel("pedidos-compra-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_compras" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_compras_itens" }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [aba, refetchCompras]);

  const ordenadas = useMemo(
    () => [...linhas].sort((a, b) =>
      (a.data_entrega_item ?? "9999").localeCompare(b.data_entrega_item ?? "9999")
      || String(a.pedido_numero).localeCompare(String(b.pedido_numero), undefined, { numeric: true })
      || (a.item_posicao ?? 0) - (b.item_posicao ?? 0)),
    [linhas],
  );
  const pendentes = ordenadas.filter(r => !origemDe(r));
  const comprados = ordenadas.filter(r => origemDe(r));
  const termo = busca.trim().toLowerCase();
  const visiveis = (filtro === "pendentes" ? pendentes : filtro === "comprados" ? comprados : ordenadas)
    .filter(r => !termo
      || (r.produto_nome ?? "").toLowerCase().includes(termo)
      || (r.cliente ?? "").toLowerCase().includes(termo)
      || String(r.pedido_numero).includes(termo));
  const unidadesPendentes = pendentes.reduce((s, r) => s + Number(r.quantidade ?? 0), 0);

  // Seleção só vale para o que ainda não foi comprado.
  const selecionaveis = visiveis.filter(r => !origemDe(r));
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every(r => selecionados.has(r.producao_id));
  const alternar = (id: string) => setSelecionados(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const alternarTodos = () => setSelecionados(todosMarcados ? new Set() : new Set(selecionaveis.map(r => r.producao_id)));
  const qtdSelecionada = ordenadas.filter(r => selecionados.has(r.producao_id) && !origemDe(r)).length;

  const abrirPopup = () => {
    const escolhidos = ordenadas.filter(r => selecionados.has(r.producao_id) && !origemDe(r));
    if (escolhidos.length === 0) return;
    setFornecedor("XBZ");
    setFornecedorOutro("");
    setLinhasPopup(escolhidos.map(r => ({
      chave: r.producao_id,
      producaoId: r.producao_id,
      pedidoNumero: String(r.pedido_numero),
      cliente: r.cliente,
      produto: r.produto_nome || "—",
      sku: r.sku ?? null,
      variacao: r.variacao ?? null,
      foto: r.mockup_url || r.imagem_catalogo_url,
      quantidade: String(r.quantidade ?? 0),
      unitario: "",
    })));
    setPopupAberto(true);
  };

  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const gerarRelatorio = async (formato: "pdf" | "html" | "txt") => {
    const escolhidos = ordenadas.filter(r => selecionados.has(r.producao_id));
    if (escolhidos.length === 0) return;
    const linhas = escolhidos.map(r => ({
      pedido: r.pedido_numero != null ? String(r.pedido_numero) : null,
      produto: r.produto_nome || "—",
      cor: r.variacao ?? null,
      quantidade: Number(r.quantidade ?? 0),
      foto: r.mockup_url || r.imagem_catalogo_url ? sizedImage((r.mockup_url || r.imagem_catalogo_url)!, 300) : null,
    }));
    if (formato === "html") { gerarRelatorioComprasHTML(linhas); return; }
    if (formato === "txt") {
      const ok = await copiarRelatorioComprasTXT(linhas);
      toast[ok ? "success" : "error"](ok ? "Texto copiado! Já pode colar no WhatsApp." : "Não foi possível copiar. Tente novamente.");
      return;
    }
    setGerandoRelatorio(true);
    toast.info("Gerando PDF…");
    try { await gerarRelatorioComprasPDF(linhas); }
    finally { setGerandoRelatorio(false); }
  };

  const mudarLinha = (chave: string, campo: "produto" | "quantidade" | "unitario", valor: string) =>
    setLinhasPopup(prev => prev.map(l => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  const adicionarLinha = () =>
    setLinhasPopup(prev => [...prev, {
      chave: `livre-${Date.now()}-${prev.length}`, producaoId: null, pedidoNumero: null, cliente: null,
      produto: "", sku: null, variacao: null, foto: null, quantidade: "1", unitario: "",
    }]);
  const removerLinha = (chave: string) => setLinhasPopup(prev => prev.filter(l => l.chave !== chave));

  const nomeFornecedor = fornecedor === "OUTRO" ? fornecedorOutro.trim().toUpperCase() : fornecedor;
  const totalPopup = linhasPopup.reduce((s, l) => s + aNumero(l.quantidade) * aNumero(l.unitario), 0);

  const confirmarCompra = async () => {
    if (!nomeFornecedor) { toast.error("Informe o fornecedor."); return; }
    if (linhasPopup.length === 0) { toast.error("Nenhum produto na compra."); return; }
    if (linhasPopup.some(l => !l.produto.trim() || aNumero(l.quantidade) <= 0)) {
      toast.error("Todo produto precisa de nome e quantidade maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      const { data: compra, error } = await (supabase as any)
        .from("sistema_compras")
        .insert({ fornecedor: nomeFornecedor, criado_por_nome: nomeLogado ?? currentVendedor?.nome ?? null })
        .select("id,numero")
        .single();
      if (error || !compra) throw error ?? new Error("Compra não criada");

      const { data: itens, error: errItens } = await (supabase as any)
        .from("sistema_compras_itens")
        .insert(linhasPopup.map((l, i) => ({
          compra_id: compra.id,
          producao_item_id: l.producaoId,
          pedido_numero: l.pedidoNumero,
          cliente: l.cliente,
          produto_nome: l.produto.trim(),
          sku: l.sku,
          variacao: l.variacao,
          foto_url: l.foto,
          quantidade: aNumero(l.quantidade),
          ordem: i,
        })))
        .select("id,ordem");
      if (errItens) throw errItens;

      if (isAdmin) {
        const precos = (itens as { id: string; ordem: number }[])
          .map(it => ({ compra_item_id: it.id, valor_unitario: aNumero(linhasPopup[it.ordem].unitario) }))
          .filter(p => p.valor_unitario > 0);
        if (precos.length) {
          const { error: errPreco } = await (supabase as any).from("sistema_compras_precos").insert(precos);
          if (errPreco) toast.error(`Compra salva, mas os preços não: ${errPreco.message}`);
        }
      }

      // Etiqueta COMPRADO nos produtos do PCP (mesma do botão do PCP).
      const tag = `COMPRADO ${nomeFornecedor}`;
      const agora = new Date().toISOString();
      for (const l of linhasPopup) {
        if (!l.producaoId) continue;
        const linha = linhas.find(x => x.producao_id === l.producaoId);
        if (!linha) continue;
        const tags = [...(linha.tags ?? []).filter(t => !ehTagCompra(t)), tag];
        const { data: atualizado, error: e2 } = await supabase
          .from("sistema_producao_itens" as any)
          .update({ tags, compra_confirmada_em: agora })
          .eq("id", l.producaoId)
          .select("id");
        // Sem erro E sem linha alterada = RLS bloqueou em silêncio (o Supabase
        // não reporta isso como erro). Sem o .select() acima esse caso passa
        // batido: a compra "salva" mas a etiqueta nunca muda no PCP.
        if (e2 || !atualizado?.length) {
          toast.error(`Não foi possível marcar "${l.produto}" como comprado. ${e2?.message || "Permissão negada pelo banco (RLS)."}`);
          continue;
        }
        await supabase.from("sistema_producao_historico").insert({
          producao_item_id: l.producaoId,
          status_anterior: null,
          status_novo: linha.status,
          vendedor_id: currentVendedor?.id ?? null,
          observacao: `Compra registrada: Comprado ${nomeFornecedor} (pedido de compra nº ${compra.numero})`,
        } as any);
      }

      toast.success(`Pedido de compra nº ${compra.numero} registrado.`);
      setPopupAberto(false);
      setSelecionados(new Set());
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["sistema", "pcp", "rows"] });
      queryClient.invalidateQueries({ queryKey: ["sistema", "compras", "registradas"] });
    } catch (e: any) {
      console.error("[Compras] registrar falhou:", e);
      toast.error(`Não foi possível registrar a compra. ${e?.message || ""}`);
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async (r: LinhaCompra) => {
    setDesfazendo(r.producao_id);
    const tags = (r.tags ?? []).filter(t => !ehTagCompra(t));
    const { data: atualizado, error } = await supabase
      .from("sistema_producao_itens" as any)
      .update({ tags, compra_confirmada_em: null })
      .eq("id", r.producao_id)
      .select("id");
    if (error || !atualizado?.length) {
      toast.error(`Não foi possível desfazer. ${error?.message || "Permissão negada pelo banco (RLS)."}`);
    } else {
      await supabase.from("sistema_producao_historico").insert({
        producao_item_id: r.producao_id, status_anterior: null, status_novo: r.status,
        vendedor_id: currentVendedor?.id ?? null, observacao: "Compra desfeita",
      } as any);
      queryClient.setQueryData<LinhaCompra[]>(["sistema", "compras"], prev =>
        (prev ?? []).map(x => (x.producao_id === r.producao_id ? { ...x, tags } : x)));
      queryClient.invalidateQueries({ queryKey: ["sistema", "pcp", "rows"] });
    }
    setDesfazendo(null);
  };

  const baixarPdf = async (c: CompraRegistrada, comPreco: boolean) => {
    toast.info("Gerando PDF…");
    let precos: Record<string, number> = {};
    if (comPreco) {
      const { data, error } = await (supabase as any)
        .from("sistema_compras_precos")
        .select("compra_item_id,valor_unitario")
        .in("compra_item_id", c.itens.map(i => i.id));
      if (error) { toast.error(`Não foi possível ler os preços. ${error.message || ""}`); return; }
      for (const p of data ?? []) precos[p.compra_item_id] = Number(p.valor_unitario);
    }
    await gerarPedidoCompraPDF({
      numero: c.numero,
      data: c.criado_em,
      fornecedor: c.fornecedor,
      criadoPor: c.criado_por_nome,
      comPreco,
      linhas: c.itens.map(i => ({
        produto: i.produto_nome, sku: i.sku, variacao: i.variacao, foto: i.foto_url ? sizedImage(i.foto_url, 160) : null,
        pedido: i.pedido_numero, cliente: i.cliente,
        quantidade: Number(i.quantidade), valorUnitario: precos[i.id] ?? 0,
      })),
    });
    // Marca o pedido de compra como impresso (último PDF baixado).
    const { error: errImp } = await (supabase as any).from("sistema_compras")
      .update({ impresso_em: new Date().toISOString(), impresso_por: nomeLogado ?? currentVendedor?.nome ?? null })
      .eq("id", c.id);
    if (errImp) toast.error(`PDF gerado, mas não foi possível marcar como impresso. ${errImp.message || ""}`);
    else void refetchCompras();
  };

  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [filtroCompra, setFiltroCompra] = useState<"todos" | StatusCompra>("todos");
  const contagemStatus = useMemo(() => {
    const n: Record<StatusCompra, number> = { aguardando: 0, conferindo: 0, ok: 0, faltas: 0 };
    for (const c of compras) n[statusCompra(c)]++;
    return n;
  }, [compras]);
  const comprasFiltradas = filtroCompra === "todos" ? compras : compras.filter(c => statusCompra(c) === filtroCompra);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <ShoppingBag className="h-5 w-5 text-[var(--gw-primary)]" />
          <h1 className="gw-title text-[20px]">Compras</h1>
        </div>
        <div className="flex items-center rounded-[8px] border border-[var(--gw-border)] overflow-hidden text-[13px] font-semibold">
          {([["comprar", "Comprar"], ["pedidos", "Pedido de compra"]] as [Aba, string][]).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={cn("px-4 py-2 transition-colors", aba === id ? "text-white" : "bg-white text-[var(--gw-text-secondary)]")}
              style={aba === id ? { backgroundColor: "var(--gw-primary)" } : undefined}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {aba === "comprar" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["pendentes", `A comprar (${pendentes.length})`],
              ["comprados", `Comprados (${comprados.length})`],
              ["todos", `Todos (${ordenadas.length})`],
            ] as [Filtro, string][]).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors",
                  filtro === id ? "text-white border-transparent" : "bg-white text-[var(--gw-text-secondary)] border-[var(--gw-border)]",
                )}
                style={filtro === id ? { backgroundColor: "var(--gw-primary)" } : undefined}
              >
                {rotulo}
              </button>
            ))}
            <span className="gw-meta ml-2">{unidadesPendentes} un. ainda a comprar</span>
            <div className="relative ml-auto">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gw-text-muted)]" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto, cliente ou pedido" className="pl-8 w-[280px] h-9" />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[var(--gw-border)] bg-white px-3 py-2">
            <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
              <Checkbox checked={todosMarcados} onCheckedChange={alternarTodos} disabled={selecionaveis.length === 0} />
              Selecionar todos
            </label>
            <span className="gw-meta">{qtdSelecionada} selecionado(s)</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="ml-auto" size="sm" variant="outline" disabled={qtdSelecionada === 0 || gerandoRelatorio}>
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Gerar relatório
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void gerarRelatorio("txt")}>
                  <ClipboardList className="h-3.5 w-3.5 mr-2" /> Copiar texto (WhatsApp)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void gerarRelatorio("pdf")}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void gerarRelatorio("html")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> HTML (documento pronto)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" disabled={qtdSelecionada === 0} onClick={abrirPopup} style={{ backgroundColor: "#15803D" }}>
              Marcar como COMPRADO
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-[var(--gw-text-muted)] py-10 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : visiveis.length === 0 ? (
            <div className="rounded-xl border border-[var(--gw-border)] bg-white py-12 text-center gw-meta">
              {filtro === "pendentes" ? "Nada a comprar no momento." : "Nenhum produto por aqui."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {visiveis.map(r => {
                const foto = r.mockup_url || r.imagem_catalogo_url;
                const origem = origemDe(r);
                const marcado = selecionados.has(r.producao_id) && !origem;
                return (
                  <div
                    key={r.producao_id}
                    onClick={origem ? undefined : () => alternar(r.producao_id)}
                    className={cn(
                      "relative rounded-xl border bg-white overflow-hidden transition-colors",
                      origem ? "border-[var(--gw-border)]" : "cursor-pointer",
                      marcado ? "border-[var(--gw-primary)] ring-2 ring-[var(--gw-primary)]" : "border-[var(--gw-border)]",
                    )}
                  >
                    <div className="absolute top-2 left-2 z-10">
                      {origem ? (
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: "#15803D" }}>
                          Comprado {origem}
                        </span>
                      ) : (
                        <Checkbox checked={marcado} onCheckedChange={() => alternar(r.producao_id)} onClick={e => e.stopPropagation()} className="bg-white shadow" />
                      )}
                    </div>
                    {origem && (
                      <Button
                        size="sm" variant="ghost"
                        className="absolute top-1.5 right-1.5 z-10 h-7 px-2 bg-white/90 shadow"
                        disabled={desfazendo === r.producao_id}
                        onClick={e => { e.stopPropagation(); void desfazer(r); }}
                        title="Desfazer compra"
                      >
                        {desfazendo === r.producao_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <div className="aspect-square bg-[var(--gw-surface-alt)] flex items-center justify-center p-3">
                      {foto ? (
                        <img src={sizedImage(foto, 300)} alt="" loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <Package className="h-10 w-10 text-[var(--gw-text-muted)]" />
                      )}
                    </div>
                    <div className="px-2.5 pt-2 pb-2.5 text-center border-t border-[var(--gw-border)]">
                      <p className="gw-body text-[22px] font-extrabold text-[#0F172A] leading-none">{r.quantidade ?? 0}</p>
                      <p className="gw-meta text-[10.5px] mb-1.5">unidades</p>
                      <p className="gw-body text-[13px] font-semibold text-[#0F172A] leading-tight truncate" title={r.produto_nome || "—"}>
                        {r.produto_nome || "—"}
                      </p>
                      <p className="gw-meta text-[11px] flex items-center justify-center gap-1 mt-0.5">
                        <OrderNumber value={r.pedido_numero} className="text-[11px]" />
                        <span className="truncate">· {r.cliente || "—"}</span>
                      </p>
                      <p className="gw-meta text-[10.5px] mt-1">Entrega {fmtData(r.data_entrega_item)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {compras.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {(["todos", "aguardando", "conferindo", "faltas", "ok"] as const).map(f => {
                const ativo = filtroCompra === f;
                const qtd = f === "todos" ? compras.length : contagemStatus[f];
                const alerta = f === "faltas" && qtd > 0;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroCompra(f)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors"
                    style={ativo
                      ? { background: alerta ? "#DC2626" : "var(--gw-primary)", borderColor: "transparent", color: "#FFFFFF" }
                      : { background: "#FFFFFF", borderColor: alerta ? "#FCA5A5" : "var(--gw-border)", color: alerta ? "#B91C1C" : "var(--gw-text-secondary)" }}
                  >
                    {f === "todos" ? "Todos" : ROTULO_STATUS[f]}
                    <span className="rounded-full px-1.5 text-[11px]" style={{ background: ativo ? "rgba(255,255,255,.25)" : "var(--gw-surface-alt)" }}>{qtd}</span>
                  </button>
                );
              })}
            </div>
          )}
          {compras.length === 0 ? (
            <div className="rounded-xl border border-[var(--gw-border)] bg-white py-12 text-center gw-meta">
              Nenhum pedido de compra ainda. Marque produtos como COMPRADO na aba Comprar.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--gw-border)] bg-white divide-y divide-[var(--gw-border)] overflow-hidden">
              {comprasFiltradas.length === 0 && (
                <div className="py-10 text-center gw-meta">Nenhum pedido de compra neste filtro.</div>
              )}
              {comprasFiltradas.map(c => {
                const aberto = abertos.has(c.id);
                const un = c.itens.reduce((s, i) => s + Number(i.quantidade), 0);
                return (
                  <Fragment key={c.id}>
                    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 min-w-[240px] flex-1 text-left"
                        onClick={() => setAbertos(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                      >
                        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="gw-body text-[14px] font-bold">Nº {String(c.numero).padStart(4, "0")}</span>
                        <span className="gw-meta">· {c.fornecedor} · {fmtData(c.criado_em)}</span>
                      </button>
                      <StatusCompraChip compra={c} />
                      <ImpressoChip compra={c} />
                      <span className="gw-meta">{c.itens.length} produto(s) · {un} un.</span>
                      <Button size="sm" variant="outline" onClick={() => baixarPdf(c, false)}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF sem preço
                      </Button>
                      {isAdmin && (
                        <Button size="sm" onClick={() => baixarPdf(c, true)}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF com preço
                        </Button>
                      )}
                    </div>
                    {aberto && (
                      <ConferenciaCompra compra={c} nomeLogado={nomeLogado ?? currentVendedor?.nome ?? null} onMudou={() => void refetchCompras()} />
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => void refetchCompras()}>Atualizar</Button>
          </div>
        </div>
      )}

      <Dialog open={popupAberto} onOpenChange={open => !open && !salvando && setPopupAberto(false)}>
        <DialogContent className="max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <span className="gw-body text-[13px] font-medium">Comprado em</span>
            <Select value={fornecedor} onValueChange={setFornecedor}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORNECEDORES.map(f => <SelectItem key={f} value={f}>{f === "OUTRO" ? "Outro" : f}</SelectItem>)}
              </SelectContent>
            </Select>
            {fornecedor === "OUTRO" && (
              <Input value={fornecedorOutro} onChange={e => setFornecedorOutro(e.target.value)} placeholder="Nome do fornecedor" className="w-[220px] h-9" />
            )}
          </div>

          <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-[var(--gw-border)]">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--gw-surface-alt)] text-[11px] uppercase text-[var(--gw-text-secondary)]">
                <tr>
                  <th className="text-left px-2 py-2">Produto</th>
                  <th className="px-2 py-2 w-[90px] text-right">Qtd</th>
                  {isAdmin && <th className="px-2 py-2 w-[110px] text-right">Valor unit.</th>}
                  {isAdmin && <th className="px-2 py-2 w-[110px] text-right">Total</th>}
                  <th className="w-[36px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gw-border)]">
                {linhasPopup.map(l => (
                  <tr key={l.chave}>
                    <td className="px-2 py-1.5">
                      {l.producaoId ? (
                        <>
                          <p className="font-semibold truncate max-w-[300px]">{l.produto}</p>
                          <p className="gw-meta text-[11px]">{[l.sku, l.variacao].filter(Boolean).join(" · ")}</p>
                          <p className="gw-meta text-[11px]">#{l.pedidoNumero} · {l.cliente || "—"}</p>
                        </>
                      ) : (
                        <Input value={l.produto} onChange={e => mudarLinha(l.chave, "produto", e.target.value)} placeholder="Produto" className="h-8" />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={l.quantidade} onChange={e => mudarLinha(l.chave, "quantidade", e.target.value)} inputMode="decimal" className="h-8 text-right" />
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-1.5">
                        <Input value={l.unitario} onChange={e => mudarLinha(l.chave, "unitario", e.target.value)} inputMode="decimal" placeholder="0,00" className="h-8 text-right" />
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-2 py-1.5 text-right font-semibold">{brl(aNumero(l.quantidade) * aNumero(l.unitario))}</td>
                    )}
                    <td className="px-1 py-1.5">
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removerLinha(l.chave)} title="Remover da compra">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center">
            <Button variant="outline" size="sm" onClick={adicionarLinha}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar produto
            </Button>
            {isAdmin && <span className="ml-auto gw-body text-[15px] font-bold">Total: {brl(totalPopup)}</span>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPopupAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={confirmarCompra} disabled={salvando} style={{ backgroundColor: "#15803D" }}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
