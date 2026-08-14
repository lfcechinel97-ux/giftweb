import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Pencil, AlertTriangle, Lock } from "lucide-react";
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
import { OrderNumber, Thumb, Money } from "@/components/sistema/ui";

import { supabase } from "@/integrations/supabase/client";
import { useSistema, clienteDisplay, type Pedido, type PedidoItem, type QuoteItem } from "@/contexts/SistemaContext";
import { useSistemaProducts } from "./useSistemaProducts";
import { ItemDialog } from "./OrcamentoForm";
import { registrarAuditoria } from "@/lib/auditoria";
import { useUserRole } from "@/hooks/useUserRole";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* Etapas do PCP em que o item já saiu da fase inicial */
const PCP_LABEL: Record<string, string> = {
  organizando_pedido: "Organizando Pedido",
  pronto_producao: "Pronto p/ Produção",
  teste_fisico: "Teste Físico",
  preparacao: "Preparação",
  em_producao: "Em Produção",
  embalagem_pagamento: "Embalagem & Pagamento",
  aguardando_coleta: "Aguardando Coleta",
  enviado: "Enviado",
  cancelado: "Cancelado",
};

type ProducaoRow = { id: string; item_id: string; status: string };

const PedidoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, transportadoras, meiosPagamento, vendedores, ensureClientes, refreshPedidos } = useSistema();
  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();
  const { isAdmin } = useUserRole();

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
  const [observacoes, setObservacoes] = useState("");

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
      }
      setCarregando(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  const statusDoItem = (itemId: string) =>
    producao.find(r => r.item_id === itemId)?.status || "organizando_pedido";

  const subtotal = useMemo(
    () => itens.reduce((s, i) => s + (num(i.total) || num(i.quantidade) * num(i.precoUnitario)), 0),
    [itens],
  );
  const total = subtotal + num(freteValor);

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
    if (st === "enviado") {
      toast.error("Item já enviado: não pode ser excluído. Use “Cancelar item”.");
      return;
    }
    if (st !== "organizando_pedido") {
      setConfirmRemove({ item, etapa: PCP_LABEL[st] || st });
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
      itens: itens as never,
      subtotal,
      frete_tipo: freteTipo || null,
      frete_valor: num(freteValor),
      total,
      transportadora_id: transportadoraId || null,
      prazo_entrega: prazoEntrega || null,
      pagamento_id: pagamentoId || null,
      prazo_producao_dias: prazoProducaoDias,
      observacoes: observacoes || null,
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
            <div className="flex items-center gap-2">
              <OrderNumber value={pedido.numero} />
              <span className="gw-meta">{clienteNome ? clienteDisplay(clienteNome) : "Sem cliente"}</span>
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

      {/* Itens */}
      <div className="rounded-[12px] p-4" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="gw-label" style={{ color: "var(--gw-primary)", fontWeight: 700 }}>Itens do pedido</span>
          <Button size="sm" variant="outline" onClick={abrirNovoItem}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar item
          </Button>
        </div>

        <div className="space-y-2">
          {itens.map(item => {
            const st = statusDoItem(item.id);
            const cancelado = Boolean((item as PedidoItem & { cancelado?: boolean }).cancelado) || st === "cancelado";
            return (
              <div
                key={item.id}
                className="grid grid-cols-[64px_1fr_150px_110px_110px_90px] items-center gap-3 p-2 rounded-lg"
                style={{ border: "1px solid var(--gw-border)", opacity: cancelado ? 0.5 : 1 }}
              >
                <Thumb src={item.mockupImagem || item.imagem} alt={item.nome} size="sm" />
                <div className="min-w-0">
                  <div className="gw-title text-[13.5px] truncate" style={{ fontWeight: 600 }}>{item.nome}</div>
                  {item.observacao && <div className="gw-meta truncate">{item.observacao}</div>}
                </div>
                <span className="gw-meta">{cancelado ? "Cancelado" : (PCP_LABEL[st] || st)}</span>
                <Input
                  type="number"
                  min={1}
                  value={item.quantidade}
                  onChange={e => {
                    const q = Math.max(1, Number(e.target.value) || 1);
                    setItens(prev => prev.map(i => i.id === item.id
                      ? { ...i, quantidade: q, total: q * num(i.precoUnitario) } : i));
                  }}
                  className="h-9 text-right"
                />
                <span className="text-right"><Money value={num(item.total) || num(item.quantidade) * num(item.precoUnitario)} /></span>
                <div className="flex items-center justify-end gap-1">
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
            );
          })}
          {itens.length === 0 && <div className="py-8 text-center gw-meta">Nenhum item no pedido.</div>}
        </div>

        <div className="mt-3 flex justify-end gap-6 text-right">
          <span className="gw-meta">Subtotal: <strong>{brl(subtotal)}</strong></span>
          <span className="gw-meta">Frete: <strong>{brl(num(freteValor))}</strong></span>
          <span className="gw-title" style={{ fontWeight: 700 }}>Total: {brl(total)}</span>
        </div>
      </div>

      {/* Dados do pedido */}
      <div className="rounded-[12px] p-4 grid gap-3 md:grid-cols-3" style={{ background: "var(--gw-surface)", border: "1px solid var(--gw-border-strong)" }}>
        <label className="space-y-1">
          <span className="gw-label">Cliente</span>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{clienteDisplay(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="gw-label">Vendedor</span>
          <Select value={vendedorId} onValueChange={setVendedorId}>
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
          <span className="gw-label">Pagamento</span>
          <Select value={pagamentoId} onValueChange={setPagamentoId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {meiosPagamento.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
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
        <label className="space-y-1">
          <span className="gw-label">Transportadora</span>
          <Select value={transportadoraId} onValueChange={setTransportadoraId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {transportadoras.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="gw-label">Prazo de entrega (dias)</span>
          <Input className="h-9" type="number" value={prazoEntrega}
            onChange={e => setPrazoEntrega(Number(e.target.value) || 0)} />
        </label>
        <label className="space-y-1">
          <span className="gw-label">Prazo de produção (dias)</span>
          <Input className="h-9" type="number" value={prazoProducaoDias}
            onChange={e => setPrazoProducaoDias(Number(e.target.value) || 0)} />
        </label>
        <label className="space-y-1 md:col-span-3">
          <span className="gw-label">Observações</span>
          <Textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </label>
      </div>

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
