import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Package, ShoppingBag, Undo2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { cn } from "@/lib/utils";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";
import { useSistema } from "@/contexts/SistemaContext";
import { obterPerfil, vendedorRestritoDe } from "@/hooks/useUserRole";

/* Compras: tudo que está em "Aguardando Mercadoria" no PCP. É a MESMA
   informação do PCP (etiqueta COMPRADO XBZ / COMPRADO SP + compra_confirmada_em
   no item de produção), só que numa lista de trabalho para o comprador.
   Marcar aqui aparece no PCP e vice-versa, sem cópia de dado. */

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
  coluna_pcp: string | null;
  horas_na_etapa: number | null;
}

const ORIGENS = ["XBZ", "SP"] as const;
type Origem = (typeof ORIGENS)[number];
const tagDaOrigem = (o: Origem) => `COMPRADO ${o}`;
const ehTagCompra = (t: string) => /^comprado\b/i.test(t.trim());
const origemDe = (r: LinhaCompra): string | null => {
  const t = (r.tags ?? []).find(ehTagCompra);
  return t ? t.trim().replace(/^comprado\s*/i, "").toUpperCase() || "—" : null;
};

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

type Filtro = "pendentes" | "comprados" | "todos";

export default function Compras() {
  const queryClient = useQueryClient();
  const { currentVendedor } = useSistema();
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const { data: linhas = [], isLoading, refetch } = useQuery({
    queryKey: ["sistema", "compras"],
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const restrito = vendedorRestritoDe(await obterPerfil(queryClient));
      let q = supabase
        .from("vw_pcp" as any)
        .select("producao_id,pedido_id,pedido_numero,cliente,produto_nome,quantidade,mockup_url,imagem_catalogo_url,item_posicao,data_entrega_item,tags,status,coluna_pcp,horas_na_etapa")
        .eq("coluna_pcp", "aguardando_mercadoria");
      if (restrito) q = q.eq("pedido_vendedor_id", restrito);
      const { data, error } = await q;
      if (error) {
        toast.error(`Não foi possível carregar as compras. ${error.message || ""}`);
        throw error;
      }
      return (data as any as LinhaCompra[]) ?? [];
    },
  });

  // Tempo real: qualquer mudança nos itens (inclusive vinda do PCP) recarrega.
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

  const registrar = async (r: LinhaCompra, origem: Origem | null) => {
    setSalvando(r.producao_id);
    const semCompra = (r.tags ?? []).filter(t => !ehTagCompra(t));
    const tags = origem ? [...semCompra, tagDaOrigem(origem)] : semCompra;
    const { error } = await supabase
      .from("sistema_producao_itens" as any)
      .update({ tags, compra_confirmada_em: origem ? new Date().toISOString() : null })
      .eq("id", r.producao_id);
    if (error) {
      toast.error(`Não foi possível salvar. ${error.message || ""}`);
      setSalvando(null);
      return;
    }
    await supabase.from("sistema_producao_historico").insert({
      producao_item_id: r.producao_id,
      status_anterior: null,
      status_novo: r.status,
      vendedor_id: currentVendedor?.id ?? null,
      observacao: origem ? `Compra registrada: Comprado ${origem}` : "Compra desfeita",
    } as any);
    queryClient.setQueryData<LinhaCompra[]>(["sistema", "compras"], prev =>
      (prev ?? []).map(x => (x.producao_id === r.producao_id ? { ...x, tags } : x)));
    queryClient.invalidateQueries({ queryKey: ["sistema", "pcp", "rows"] });
    setSalvando(null);
  };

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <ShoppingBag className="h-5 w-5 text-[var(--gw-primary)]" />
          <h1 className="gw-title text-[20px]">Compras</h1>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gw-text-muted)]" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto, cliente ou pedido" className="pl-8 w-[280px] h-9" />
        </div>
      </div>

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
        <div className="rounded-xl border border-[var(--gw-border)] bg-white divide-y divide-[var(--gw-border)] overflow-hidden">
          {visiveis.map(r => {
            const foto = r.mockup_url || r.imagem_catalogo_url;
            const origem = origemDe(r);
            const ocupado = salvando === r.producao_id;
            return (
              <div key={r.producao_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                {foto ? (
                  <img src={sizedImage(foto, 120)} alt="" loading="lazy" className="h-[46px] w-[46px] rounded-[8px] object-cover bg-[var(--gw-surface-alt)] shrink-0" />
                ) : (
                  <div className="h-[46px] w-[46px] rounded-[8px] bg-[var(--gw-surface-alt)] flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-[var(--gw-text-muted)]" />
                  </div>
                )}
                <div className="min-w-[220px] flex-1">
                  <p className="gw-body text-[14px] font-semibold text-[#0F172A] truncate">{r.produto_nome || "—"}</p>
                  <p className="gw-meta text-[12px] flex items-center gap-1.5">
                    <OrderNumber value={r.pedido_numero} className="text-[12px]" />
                    <span>· {r.cliente || "—"}</span>
                  </p>
                </div>
                <div className="w-[84px] text-right">
                  <p className="gw-body text-[18px] font-bold text-[#0F172A] leading-none">{r.quantidade ?? 0}</p>
                  <p className="gw-meta text-[11px]">unidades</p>
                </div>
                <div className="w-[96px] text-right">
                  <p className="gw-meta text-[11px]">Entrega</p>
                  <p className="gw-body text-[13px] font-medium">{fmtData(r.data_entrega_item)}</p>
                </div>
                <div className="flex items-center gap-1.5 w-[250px] justify-end">
                  {origem ? (
                    <>
                      <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ backgroundColor: "#15803D" }}>
                        Comprado {origem}
                      </span>
                      <Button size="sm" variant="ghost" className="h-8 px-2" disabled={ocupado} onClick={() => registrar(r, null)} title="Desfazer compra">
                        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      </Button>
                    </>
                  ) : (
                    ORIGENS.map(o => (
                      <Button key={o} size="sm" variant="outline" className="h-8" disabled={ocupado} onClick={() => registrar(r, o)}>
                        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Comprado ${o}`}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
