import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Plus, Trash2, Pencil, AlertTriangle, Lock, Camera, Loader2,
  Minus, Upload, Paperclip, FileText, Truck, CreditCard, X, Download, ClipboardList, PackageSearch,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrderNumber, Thumb, Money, StatusBadge } from "@/components/sistema/ui";
import { statusInfo } from "@/lib/statusPedido";

import { supabase } from "@/integrations/supabase/client";
import { useSistema, clienteDisplay, type Pedido, type PedidoItem, type QuoteItem } from "@/contexts/SistemaContext";
import { useSistemaProducts } from "./useSistemaProducts";
import { ItemDialog } from "./OrcamentoForm";
import ClienteDialog from "./ClienteDialog";
import { registrarAuditoria } from "@/lib/auditoria";
import { uploadMockup, uploadArquivoPedido, MockupUploadError } from "@/lib/uploadMockup";
import { useUserRole } from "@/hooks/useUserRole";
import { resumoPersonalizacao } from "@/lib/personalizacao";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* Rótulos e cores de etapa vêm de src/lib/statusPedido.ts */

type ProducaoRow = { id: string; item_id: string; status: string };

/** Cartão de seção com cabeçalho colorido (ícone + título) — mesmo padrão
    visual repetido nas 5 seções da tela de pedido. */
function SectionCard({
  icon, title, color, action, children,
}: {
  icon: React.ReactNode; title: string; color: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] overflow-hidden" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--gw-border)" }}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0" style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}>
            {icon}
          </span>
          <span className="gw-label" style={{ color, fontWeight: 700 }}>{title}</span>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const PedidoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, transportadoras, meiosPagamento, vendedores, ensureClientes, refreshPedidos } = useSistema();
  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();
  const { isAdmin, vendedorRestrito } = useUserRole();

  useEffect(() => { void ensureClientes(); }, [ensureClientes]);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [producao, setProducao] = useState<ProducaoRow[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [freteTipo, setFreteTipo] = useState<"CIF" | "FOB" | "">("");
  const [freteValor, setFreteValor] = useState(0);
  const [transportadoraId, setTransportadoraId] = useState("");
  const [pagamentoId, setPagamentoId] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState(0);
  const [prazoProducaoDias, setPrazoProducaoDias] = useState(15);
  const [dataDespacharAte, setDataDespacharAte] = useState("");
  const [observacoes, setObservacoes] = useState("");

  /* Anexos gerais do pedido (briefing, arte solta, logo) — array jsonb em
     sistema_pedidos.anexos, separado dos anexos por item. */
  type AnexoGeral = { url: string; nome: string; criadoEm: string };
  const [anexosGerais, setAnexosGerais] = useState<AnexoGeral[]>([]);
  const anexoGeralInputRef = useRef<HTMLInputElement>(null);
  const [enviandoAnexoGeral, setEnviandoAnexoGeral] = useState(false);

  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<{ item: PedidoItem; etapa: string } | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [numeroDigitado, setNumeroDigitado] = useState("");
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const hydrated = useRef(false);
  const itensOriginais = useRef<PedidoItem[]>([]);

  /* ── Foto do item ───────────────────────────────────────────────────────
     Clicar na miniatura anexa ou substitui a foto daquele item. A imagem vai
     para o bucket `mockups` e o jsonb guarda só a URL; a view vw_pcp lê esse
     mesmo campo (`item->>'mockupImagem'`), então a foto aparece no card do PCP
     assim que o pedido é salvo. */
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const itemAlvoFoto = useRef<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);

  const escolherFoto = (itemId: string) => {
    itemAlvoFoto.current = itemId;
    fotoInputRef.current?.click();
  };

  const handleFotoItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = itemAlvoFoto.current;
    e.target.value = "";
    if (!file || !itemId) return;
    setEnviandoFoto(itemId);
    try {
      const url = await uploadMockup(file, id);
      setItens(prev => prev.map(i => (i.id === itemId ? { ...i, mockupImagem: url } : i)));
      toast.success("Foto anexada. Salve o pedido para publicá-la no PCP.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(null);
    }
  };

  /* ── Arte de personalização do item (logo/arquivo que o cliente manda —
     insumo, diferente do mockup que é o resultado pronto) ────────────── */
  const arteInputRef = useRef<HTMLInputElement>(null);
  const itemAlvoArte = useRef<string | null>(null);
  const [enviandoArte, setEnviandoArte] = useState<string | null>(null);

  const escolherArte = (itemId: string) => {
    itemAlvoArte.current = itemId;
    arteInputRef.current?.click();
  };

  const handleArteItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = itemAlvoArte.current;
    e.target.value = "";
    if (!file || !itemId || !id) return;
    setEnviandoArte(itemId);
    try {
      const { url } = await uploadArquivoPedido(file, id);
      setItens(prev => prev.map(i => (i.id === itemId ? { ...i, arteAnexoUrl: url } : i)));
      toast.success("Arte anexada.");
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setEnviandoArte(null);
    }
  };

  /* ── Anexos gerais do pedido ───────────────────────────────────────── */
  const handleAnexoGeral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    setEnviandoAnexoGeral(true);
    try {
      const { url, nome } = await uploadArquivoPedido(file, id);
      setAnexosGerais(prev => [...prev, { url, nome, criadoEm: new Date().toISOString() }]);
      toast.success("Anexo adicionado. Salve o pedido para confirmar.");
    } catch (err) {
      toast.error(err instanceof MockupUploadError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setEnviandoAnexoGeral(false);
    }
  };

  const removerAnexoGeral = (url: string) =>
    setAnexosGerais(prev => prev.filter(a => a.url !== url));

  const alterarQuantidade = (itemId: string, delta: number) => {
    setItens(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const q = Math.max(1, num(i.quantidade) + delta);
      return { ...i, quantidade: q, total: q * num(i.precoUnitario) };
    }));
  };

  /* ── Carrega pedido e linhas de produção ────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setCarregando(true);
      const [{ data: p }, { data: prod }] = await Promise.all([
        supabase.from("sistema_pedidos").select("*").eq("id", id).maybeSingle(),
        supabase.from("sistema_producao_itens").select("id,item_id,status").eq("pedido_id", id),
      ]);
      if (cancel) return;
      setProducao((prod ?? []) as ProducaoRow[]);
      if (!p) { setPedido(null); setCarregando(false); return; }
      const mapped: Pedido = {
        id: p.id, numero: p.numero, orcamentoId: p.orcamento_id ?? "", clienteId: p.cliente_id ?? "",
        clienteSnapshot: (p.cliente_snapshot as never) ?? undefined,
        contatoNome: p.contato_nome ?? undefined, contatoTelefone: p.contato_telefone ?? undefined,
        contatoEmail: p.contato_email ?? undefined, vendedorId: p.vendedor_id ?? undefined,
        itens: (p.itens as unknown as PedidoItem[]) ?? [], subtotal: num(p.subtotal),
        freteTipo: (p.frete_tipo as "CIF" | "FOB" | null) ?? null, freteValor: num(p.frete_valor),
        total: num(p.total), transportadoraId: p.transportadora_id ?? undefined,
        prazoEntrega: p.prazo_entrega ?? undefined, pagamentoId: p.pagamento_id ?? undefined,
        observacoes: p.observacoes ?? undefined, status: p.status as Pedido["status"],
        createdAt: p.created_at, updatedAt: p.updated_at,
        prazoProducaoDias: p.prazo_producao_dias ?? undefined,
        dataProduzirAte: p.data_produzir_ate ?? undefined,
        dataDespacharAte: p.data_despachar_ate ?? undefined,
      };
      setPedido(mapped);
      if (!hydrated.current) {
        hydrated.current = true;
        itensOriginais.current = mapped.itens;
        setItens(mapped.itens);
        setClienteId(mapped.clienteId);
        setContatoNome(mapped.contatoNome || "");
        setContatoTelefone(mapped.contatoTelefone || "");
        setContatoEmail(mapped.contatoEmail || "");
        setVendedorId(mapped.vendedorId || "");
        setFreteTipo(mapped.freteTipo || "");
        setFreteValor(mapped.freteValor);
        setTransportadoraId(mapped.transportadoraId || "");
        setPagamentoId(mapped.pagamentoId || "");
        setPrazoEntrega(mapped.prazoEntrega || 0);
        setPrazoProducaoDias(mapped.prazoProducaoDias ?? 15);
        setObservacoes(mapped.observacoes || "");
        setDataDespacharAte(mapped.dataDespacharAte ? mapped.dataDespacharAte.slice(0, 10) : "");
        setAnexosGerais(((p as any).anexos as AnexoGeral[] | null) ?? []);
      }
      setCarregando(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  /* Sem linha de produção o item não tem etapa — devolver um status inventado
     mentiria na tela. O badge mostra "Sem status" e o backfill da migration
     20260916130000 resolve a origem. */
  const statusDoItem = (itemId: string) =>
    producao.find(r => r.item_id === itemId)?.status;

  /* Troca a etapa do item: grava só aquela linha, otimista. */
  const alterarStatusItem = async (itemId: string, slug: string) => {
    const row = producao.find(r => r.item_id === itemId);
    if (!row) {
      toast.error("Este item ainda não tem linha de produção. Rode a migration de backfill.");
      return;
    }
    const anterior = row.status;
    setProducao(prev => prev.map(r => (r.id === row.id ? { ...r, status: slug } : r)));
    const { error } = await supabase
      .from("sistema_producao_itens")
      .update({ status: slug })
      .eq("id", row.id);
    if (error) {
      setProducao(prev => prev.map(r => (r.id === row.id ? { ...r, status: anterior } : r)));
      toast.error(`Não foi possível mudar a etapa. ${error.message || ""}`);
      return;
    }
  };

  const subtotal = useMemo(
    () => itens.reduce((s, i) => s + (num(i.total) || num(i.quantidade) * num(i.precoUnitario)), 0),
    [itens],
  );
  /* CIF = frete por conta do vendedor, já embutido no preço do produto —
     não soma de novo no total. FOB = comprador paga o frete à parte, esse
     sim entra na conta. */
  const total = subtotal + (freteTipo === "FOB" ? num(freteValor) : 0);

  /* ── Itens ──────────────────────────────────────────────────────────── */
  const abrirNovoItem = () => { setEditingItem(null); setEditingItemId(null); setShowItemDialog(true); };
  const abrirEdicaoItem = (item: PedidoItem) => {
    setEditingItem(item as unknown as QuoteItem);
    setEditingItemId(item.id);
    setShowItemDialog(true);
  };

  const salvarItem = (item: QuoteItem) => {
    const novo = { ...(item as unknown as PedidoItem) };
    novo.total = num(novo.quantidade) * num(novo.precoUnitario);
    if (editingItemId) {
      novo.id = editingItemId;
      setItens(prev => prev.map(i => (i.id === editingItemId ? novo : i)));
    } else {
      novo.id = crypto.randomUUID();
      setItens(prev => [...prev, novo]);
    }
    setShowItemDialog(false);
    setEditingItem(null);
    setEditingItemId(null);
  };

  const pedirRemocao = (item: PedidoItem) => {
    const st = statusDoItem(item.id);
    const coluna = st ? statusInfo(st).colunaPcp : "organizando_pedido";
    if (coluna === "enviado") {
      toast.error("Item já enviado: não pode ser excluído. Use “Cancelar item”.");
      return;
    }
    /* Item sem linha de produção nunca entrou no chão de fábrica — sai sem
       confirmação, igual a um que ainda está sendo organizado. */
    if (coluna !== "organizando_pedido") {
      setConfirmRemove({ item, etapa: statusInfo(st).nome });
      return;
    }
    setItens(prev => prev.filter(i => i.id !== item.id));
  };

  const cancelarItem = async (item: PedidoItem) => {
    const row = producao.find(r => r.item_id === item.id);
    if (row) {
      await supabase.from("sistema_producao_itens").update({ status: "cancelado" }).eq("id", row.id);
      setProducao(prev => prev.map(r => (r.id === row.id ? { ...r, status: "cancelado" } : r)));
    }
    setItens(prev => prev.map(i => (i.id === item.id ? ({ ...i, cancelado: true } as PedidoItem) : i)));
    await registrarAuditoria({
      entidade: "pedido", entidadeId: id!, entidadeNumero: pedido?.numero,
      acao: "item_cancelado", detalhes: { item: item.nome, itemId: item.id },
    });
    toast.success("Item cancelado (mantido no histórico).");
  };

  /* ── Salvar ─────────────────────────────────────────────────────────── */
  const salvar = async () => {
    if (!id || !pedido) return;
    if (itens.length === 0) { toast.error("O pedido precisa ter ao menos um item."); return; }
    setSalvando(true);

    const antes = itensOriginais.current;
    const idsAntes = new Set(antes.map(i => i.id));
    const idsAgora = new Set(itens.map(i => i.id));
    const adicionados = itens.filter(i => !idsAntes.has(i.id));
    const removidos = antes.filter(i => !idsAgora.has(i.id));
    const alterados = itens
      .map(i => {
        const a = antes.find(x => x.id === i.id);
        if (!a) return null;
        if (num(a.quantidade) === num(i.quantidade) && num(a.precoUnitario) === num(i.precoUnitario)) return null;
        return { item: i, de: { qtd: a.quantidade, preco: a.precoUnitario }, para: { qtd: i.quantidade, preco: i.precoUnitario } };
      })
      .filter(Boolean) as { item: PedidoItem; de: { qtd: number; preco: number }; para: { qtd: number; preco: number } }[];

    const { error } = await supabase.from("sistema_pedidos").update({
      cliente_id: clienteId || null,
      contato_nome: contatoNome || null,
      contato_telefone: contatoTelefone || null,
      contato_email: contatoEmail || null,
      vendedor_id: vendedorId || null,
      status: pedido.status,
      itens: itens as never,
      subtotal,
      frete_tipo: freteTipo || null,
      frete_valor: num(freteValor),
      total,
      transportadora_id: transportadoraId || null,
      prazo_entrega: prazoEntrega || null,
      pagamento_id: pagamentoId || null,
      prazo_producao_dias: prazoProducaoDias,
      data_despachar_ate: dataDespacharAte || null,
      observacoes: observacoes || null,
      anexos: anexosGerais as never,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      setSalvando(false);
      toast.error(`Não foi possível salvar. ${error.message}`);
      return;
    }

    /* Sincroniza o PCP: remove cards órfãos e cria cards dos itens novos */
    if (removidos.length > 0) {
      await supabase.from("sistema_producao_itens").delete()
        .eq("pedido_id", id).in("item_id", removidos.map(i => i.id));
    }
    if (adicionados.length > 0) {
      await supabase.from("sistema_producao_itens").insert(
        adicionados.map(i => ({ pedido_id: id, item_id: i.id })),
      );
    }
    /* Alterações de quantidade/valor viram observação no histórico do card */
    for (const alt of alterados) {
      const row = producao.find(r => r.item_id === alt.item.id);
      if (!row) continue;
      await supabase.from("sistema_producao_historico").insert({
        producao_item_id: row.id,
        status_anterior: row.status,
        status_novo: row.status,
        observacao: `Alterado: ${alt.de.qtd} un × ${brl(num(alt.de.preco))} → ${alt.para.qtd} un × ${brl(num(alt.para.preco))}`,
      });
    }

    await registrarAuditoria({
      entidade: "pedido", entidadeId: id, entidadeNumero: pedido.numero, acao: "pedido_editado",
      detalhes: {
        adicionados: adicionados.map(i => i.nome),
        removidos: removidos.map(i => i.nome),
        alterados: alterados.map(a => ({ item: a.item.nome, de: a.de, para: a.para })),
        total,
      },
    });

    itensOriginais.current = itens;
    setSalvando(false);
    toast.success("Pedido atualizado.");
    void refreshPedidos({ page: 1, pageSize: 10 });
    navigate("/sistema/pedidos");
  };

  /* ── Excluir pedido ─────────────────────────────────────────────────── */
  const excluirPedido = async () => {
    if (!id || !pedido) return;
    if (numeroDigitado.trim() !== pedido.numero) {
      toast.error("Digite o número do pedido exatamente como aparece.");
      return;
    }
    setExcluindo(true);
    if (!isAdmin) {
      const { data: ok, error } = await supabase.rpc("sistema_verificar_senha_exclusao", { p_senha: senhaAdmin });
      if (error || !ok) {
        setExcluindo(false);
        toast.error("Senha de administrador incorreta.");
        return;
      }
    }
    await registrarAuditoria({
      entidade: "pedido", entidadeId: id, entidadeNumero: pedido.numero, acao: "pedido_excluido",
      detalhes: { itens: itens.map(i => i.nome), total },
    });
    await supabase.from("sistema_producao_itens").delete().eq("pedido_id", id);
    const { error } = await supabase.from("sistema_pedidos").delete().eq("id", id);
    setExcluindo(false);
    if (error) { toast.error(`Não foi possível excluir. ${error.message}`); return; }
    toast.success(`Pedido ${pedido.numero} excluído.`);
    void refreshPedidos({ page: 1, pageSize: 10 });
    navigate("/sistema/pedidos");
  };

  if (carregando) {
    return <div className="p-10 text-center gw-meta">Carregando pedido...</div>;
  }
  if (!pedido) {
    return (
      <div className="p-10 text-center gw-meta">
        Pedido não encontrado.
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate("/sistema/pedidos")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const clienteNome = clientes.find(c => c.id === clienteId);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/sistema/pedidos")}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full"
            style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="gw-display">Editar pedido</h2>
            <div className="flex items-center gap-2.5">
              <OrderNumber value={pedido.numero} />
              {/* Pedido importado não tem cliente vinculado — o Calcme só manda
                  o nome. Mostrar "Sem cliente" escondia o nome que existe. */}
              <span className="gw-meta">
                {clienteNome
                  ? clienteDisplay(clienteNome)
                  : (pedido.clienteSnapshot?.nome || pedido.contatoNome || "Sem cliente")}
              </span>
              <StatusBadge
                status={pedido.status}
                nivel="pedido"
                size="sm"
                onSelect={slug => setPedido(p => (p ? { ...p, status: slug as Pedido["status"] } : p))}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setConfirmExcluir(true); setNumeroDigitado(""); setSenhaAdmin(""); }}
            style={{ color: "var(--gw-danger)", borderColor: "var(--gw-danger)" }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir pedido
          </Button>
          <Button onClick={salvar} disabled={salvando} style={{ background: "var(--gw-success)" }}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* Dados do pedido */}
      <SectionCard icon={<ClipboardList className="h-4 w-4" />} title="Dados do pedido" color="var(--gw-primary)">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="gw-label">Cliente</span>
            <div className="flex items-center gap-1.5">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{clienteDisplay(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowClienteDialog(true)}
                aria-label="Novo cliente"
                title="Novo cliente"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </label>
          <label className="space-y-1">
            <span className="gw-label">Vendedor</span>
            <Select value={vendedorId} onValueChange={setVendedorId} disabled={!!vendedorRestrito}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="gw-label">Contato</span>
            <Input className="h-9" value={contatoNome} onChange={e => setContatoNome(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="gw-label">Telefone</span>
            <Input className="h-9" value={contatoTelefone} onChange={e => setContatoTelefone(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="gw-label">E-mail</span>
            <Input className="h-9" value={contatoEmail} onChange={e => setContatoEmail(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="gw-label">Prazo de produção (dias)</span>
            <Input className="h-9" type="number" value={prazoProducaoDias}
              onChange={e => setPrazoProducaoDias(Number(e.target.value) || 0)} />
          </label>
        </div>
      </SectionCard>

      {/* Produtos do pedido */}
      <SectionCard
        icon={<PackageSearch className="h-4 w-4" />}
        title="Produtos do pedido"
        color="var(--gw-primary)"
        action={
          <Button size="sm" variant="outline" onClick={abrirNovoItem}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar produto
          </Button>
        }
      >
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFotoItem}
        />
        <input
          ref={arteInputRef}
          type="file"
          accept="image/*,application/pdf,.ai,.cdr,.eps,.svg"
          className="hidden"
          onChange={handleArteItem}
        />

        <div className="space-y-2">
          {itens.map(item => {
            const st = statusDoItem(item.id);
            const cancelado = Boolean((item as PedidoItem & { cancelado?: boolean }).cancelado) || st === "cancelado";
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-lg space-y-2"
                style={{ border: "1px solid var(--gw-hairline)", opacity: cancelado ? 0.5 : 1 }}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => escolherFoto(item.id)}
                    disabled={enviandoFoto === item.id}
                    title={item.mockupImagem ? "Trocar a foto deste item" : "Anexar foto deste item"}
                    className="relative group h-14 w-14 rounded-lg overflow-hidden shrink-0"
                  >
                    <Thumb src={item.mockupImagem || item.imagem} alt={item.nome} size="md" />
                    <span
                      className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                        enviandoFoto === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ background: "rgba(15,42,92,0.62)" }}
                    >
                      {enviandoFoto === item.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                        : <Camera className="h-4 w-4 text-white" />}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="gw-title text-[13.5px] truncate" style={{ fontWeight: 600 }}>{item.nome}</span>
                      {item.varianteSlug && (
                        <span className="gw-meta text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--gw-surface-alt)" }}>
                          {item.varianteSlug}
                        </span>
                      )}
                    </div>
                    <span
                      className="block text-[12px] font-semibold mt-0.5"
                      style={{ color: resumoPersonalizacao(item) ? "var(--gw-primary)" : "var(--gw-danger)" }}
                    >
                      {resumoPersonalizacao(item) || "Sem personalização definida — edite o item"}
                    </span>
                    <span onClick={e => e.stopPropagation()} className="inline-block mt-0.5">
                      <StatusBadge
                        status={cancelado ? "cancelado" : st}
                        nivel="item"
                        size="sm"
                        onSelect={cancelado ? undefined : slug => alterarStatusItem(item.id, slug)}
                      />
                    </span>
                  </div>

                  {/* Quantidade — estepper em vez de só campo numérico */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      onClick={() => alterarQuantidade(item.id, -1)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md"
                      style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={e => {
                        const q = Math.max(1, Number(e.target.value) || 1);
                        setItens(prev => prev.map(i => i.id === item.id
                          ? { ...i, quantidade: q, total: q * num(i.precoUnitario) } : i));
                      }}
                      className="h-8 w-16 text-center px-1"
                    />
                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      onClick={() => alterarQuantidade(item.id, 1)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md"
                      style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 w-28 space-y-0.5">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[11px] text-[var(--gw-text-muted)]">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.precoUnitario}
                        onChange={e => {
                          const preco = Math.max(0, Number(e.target.value) || 0);
                          setItens(prev => prev.map(i => i.id === item.id
                            ? { ...i, precoUnitario: preco, total: num(i.quantidade) * preco } : i));
                        }}
                        className="h-7 w-20 text-right px-1.5 text-[12px]"
                      />
                    </div>
                    <Money
                      value={num(item.total) || num(item.quantidade) * num(item.precoUnitario)}
                      className="text-[12px]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Editar item"
                      onClick={() => abrirEdicaoItem(item)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-full"
                      style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {st === "enviado" || cancelado ? (
                      <button
                        type="button"
                        aria-label="Cancelar item"
                        disabled={cancelado}
                        onClick={() => cancelarItem(item)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full"
                        style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Remover item"
                        onClick={() => pedirRemocao(item)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full"
                        style={{ background: "rgba(239,68,68,0.10)", color: "var(--gw-danger)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Personalização + arte — linha 2, fora do fluxo de preço/qtd */}
                <div className="flex items-center gap-2 pl-[68px]">
                  <input
                    value={item.observacao ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      setItens(prev => prev.map(i => (i.id === item.id ? { ...i, observacao: v } : i)));
                    }}
                    placeholder="Personalização — técnica, cor, nomes da gravação"
                    className="h-7 px-2 flex-1 min-w-0 rounded text-[12px] bg-[var(--gw-surface-alt)] border border-transparent
                               hover:border-[var(--gw-border)] focus:border-[var(--gw-primary)] focus:bg-[var(--gw-surface)]
                               focus:outline-none transition-colors placeholder:text-[var(--gw-text-muted)]"
                    style={{ color: "var(--gw-text-secondary)" }}
                  />
                  <button
                    type="button"
                    onClick={() => escolherArte(item.id)}
                    disabled={enviandoArte === item.id}
                    className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-semibold"
                    style={{
                      background: item.arteAnexoUrl ? "var(--gw-primary-soft)" : "var(--gw-surface-alt)",
                      color: item.arteAnexoUrl ? "var(--gw-primary)" : "var(--gw-text-secondary)",
                    }}
                  >
                    {enviandoArte === item.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Paperclip className="h-3 w-3" />}
                    {item.arteAnexoUrl ? "Arte anexada" : "Anexar arte"}
                  </button>
                  {item.arteAnexoUrl && (
                    <a
                      href={item.arteAnexoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--gw-primary)]"
                      aria-label="Abrir arte"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {itens.length === 0 && <div className="py-8 text-center gw-meta">Nenhum item no pedido.</div>}
        </div>
      </SectionCard>

      {/* Frete / Condição comercial / Resumo — três colunas, igual referência */}
      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <SectionCard icon={<Truck className="h-4 w-4" />} title="Frete e entrega" color="var(--gw-info, #0EA5E9)">
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="gw-label">Transportadora</span>
              <Select value={transportadoraId} onValueChange={setTransportadoraId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {transportadoras.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="gw-label">Tipo de frete</span>
                <Select value={freteTipo} onValueChange={v => setFreteTipo(v as "CIF" | "FOB")}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CIF">CIF (frete incluso)</SelectItem>
                    <SelectItem value="FOB">FOB</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1">
                <span className="gw-label">Valor do frete</span>
                <Input className="h-9" type="number" step="0.01" value={freteValor}
                  onChange={e => setFreteValor(Number(e.target.value) || 0)} />
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="gw-label">Prazo de entrega (dias)</span>
              <Input className="h-9" type="number" value={prazoEntrega}
                onChange={e => setPrazoEntrega(Number(e.target.value) || 0)} />
            </label>
            <label className="space-y-1 block">
              <span className="gw-label">Despachar até</span>
              <Input className="h-9" type="date" value={dataDespacharAte}
                onChange={e => setDataDespacharAte(e.target.value)} />
            </label>
          </div>
        </SectionCard>

        <SectionCard icon={<CreditCard className="h-4 w-4" />} title="Condição comercial" color="var(--gw-success)">
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="gw-label">Condição de pagamento</span>
              <Select value={pagamentoId} onValueChange={setPagamentoId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meiosPagamento.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 block">
              <span className="gw-label">Observações comerciais</span>
              <Textarea rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </label>
          </div>
        </SectionCard>

        <div
          className="rounded-[12px] p-4 space-y-2.5 lg:sticky lg:top-4"
          style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)" }}
        >
          <span className="gw-label" style={{ fontWeight: 700 }}>Resumo do pedido</span>
          <div className="flex justify-between text-[13px]">
            <span className="gw-meta">Itens</span>
            <span>{itens.filter(i => !(i as PedidoItem & { cancelado?: boolean }).cancelado).length}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="gw-meta">Quantidade total</span>
            <span>{itens.reduce((s, i) => s + num(i.quantidade), 0)} un.</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="gw-meta">Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="gw-meta">Frete</span>
            <span>{brl(num(freteValor))}</span>
          </div>
          <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--gw-border)" }}>
            <span className="gw-title" style={{ fontWeight: 700 }}>Total</span>
            <span className="gw-title" style={{ fontWeight: 700, color: "var(--gw-primary)" }}>{brl(total)}</span>
          </div>
        </div>
      </div>

      {/* Anexos gerais do pedido */}
      <SectionCard icon={<Paperclip className="h-4 w-4" />} title="Anexos gerais" color="var(--gw-warning, #F97316)">
        <input ref={anexoGeralInputRef} type="file" accept="image/*,application/pdf,.ai,.cdr,.eps,.svg" className="hidden" onChange={handleAnexoGeral} />
        {anexosGerais.length > 0 && (
          <div className="space-y-1.5 mb-2.5">
            {anexosGerais.map(a => (
              <div key={a.url} className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2" style={{ border: "1px solid var(--gw-border)" }}>
                <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--gw-text-secondary)" }} />
                <span className="flex-1 min-w-0 truncate text-[12px]">{a.nome}</span>
                <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0" style={{ color: "var(--gw-primary)" }} aria-label="Abrir anexo">
                  <Download className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => removerAnexoGeral(a.url)} className="shrink-0" style={{ color: "var(--gw-text-muted)" }} aria-label="Remover anexo">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => anexoGeralInputRef.current?.click()}
          disabled={enviandoAnexoGeral}
          className="w-full rounded-lg py-4 flex flex-col items-center gap-1.5 text-center"
          style={{ border: "1.5px dashed var(--gw-border-strong)", background: "var(--gw-surface-alt)" }}
        >
          {enviandoAnexoGeral ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" style={{ color: "var(--gw-text-secondary)" }} />}
          <span className="gw-body text-[12px]" style={{ color: "var(--gw-text-secondary)" }}>
            Clique para anexar briefing, arte ou logo
          </span>
          <span className="gw-meta text-[11px]">PNG, JPG, PDF, AI, CDR, EPS, SVG (máx. 30 MB)</span>
        </button>
      </SectionCard>

      {showClienteDialog && (
        <ClienteDialog
          open={showClienteDialog}
          onOpenChange={setShowClienteDialog}
          onSaved={c => { setClienteId(c.id); setShowClienteDialog(false); }}
        />
      )}

      {showItemDialog && (
        <ItemDialog
          item={editingItem}
          parentProducts={parentProducts}
          isLoading={isLoading}
          searchParents={searchParents}
          getParentWithVariants={getParentWithVariants}
          onClose={() => { setShowItemDialog(false); setEditingItem(null); setEditingItemId(null); }}
          onSave={salvarItem}
        />
      )}

      {/* Confirmação: item já em produção */}
      <AlertDialog open={Boolean(confirmRemove)} onOpenChange={o => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "var(--gw-warning, #EAB308)" }} />
              Item já está em produção
            </AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmRemove?.item.nome}” está na etapa <strong>{confirmRemove?.etapa}</strong>. Ao remover,
              o card correspondente sai do PCP. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter item</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemove) setItens(prev => prev.filter(i => i.id !== confirmRemove.item.id));
                setConfirmRemove(null);
              }}
            >
              Remover mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exclusão em duas etapas */}
      <AlertDialog open={confirmExcluir} onOpenChange={setConfirmExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido {pedido.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o pedido e todos os cards dele no PCP. Para confirmar, digite o número do pedido
              {!isAdmin && " e a senha de administrador"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input placeholder={pedido.numero} value={numeroDigitado} onChange={e => setNumeroDigitado(e.target.value)} />
            {!isAdmin && (
              <Input type="password" placeholder="Senha de administrador" value={senhaAdmin}
                onChange={e => setSenhaAdmin(e.target.value)} />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={e => { e.preventDefault(); void excluirPedido(); }}
              style={{ background: "var(--gw-danger)" }}
            >
              {excluindo ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PedidoForm;
