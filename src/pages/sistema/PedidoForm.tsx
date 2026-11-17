import React, { useEffect, useMemo, useRef, useState } from "react";
import { excluirPedidoDefinitivo } from "@/lib/excluirPedido";
import { formatTelefone } from "@/lib/telefone";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Plus, Trash2, Pencil, AlertTriangle, Lock, Camera, Loader2,
  Minus, Upload, Paperclip, FileText, Truck, CreditCard, X, Download, ClipboardList, PackageSearch,
  IdCard, Check, CalendarDays, CircleDollarSign, Hash, User, Mail, MessageCircle, Copy,
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
import { OrderNumber, Thumb, StatusBadge } from "@/components/sistema/ui";
import { statusInfo } from "@/lib/statusPedido";

import { supabase } from "@/integrations/supabase/client";
import { useSistema, clienteDisplay, type Pedido, type PedidoItem, type QuoteItem } from "@/contexts/SistemaContext";
import { useSistemaProducts } from "./useSistemaProducts";
import { ItemDialog } from "./OrcamentoForm";
import ClienteDialog from "./ClienteDialog";
import DadosClienteEnvio, { copiarEtiquetaCliente } from "./DadosClienteEnvio";
import ClienteBusca from "@/components/sistema/ClienteBusca";
import { registrarAuditoria } from "@/lib/auditoria";
import { diasUteisAte } from "@/lib/diasUteis";
import { uploadMockup, uploadArquivoPedido, MockupUploadError } from "@/lib/uploadMockup";
import RecorteQuadrado from "@/components/sistema/RecorteQuadrado";
import { useUserRole } from "@/hooks/useUserRole";
import { resumoPersonalizacao } from "@/lib/personalizacao";
import { artesDoItem, comArtes, type ArteAnexo } from "@/lib/artesItem";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* Rótulos e cores de etapa vêm de src/lib/statusPedido.ts */

type ProducaoRow = { id: string; item_id: string; status: string };

/* Paleta da tela de pedido. Cores de status/etapa NÃO passam por aqui —
   continuam vindo de src/lib/statusPedido.ts via StatusBadge. */
const COR = {
  navy: "#082B57",
  azul: "#075BE8",
  verde: "#00A83B",
  verdeEscuro: "#047A2C",
  verdeSoft: "#E8F7EE",
  rotulo: "#0B2A55",
};

/** Cartão de seção. `navy` = cabeçalho azul-marinho com título branco (cards
    principais); `suave` = cabeçalho em tom claro com título na cor forte. */
function SectionCard({
  icon, title, action, children, tom = "navy", corForte, corSuave, className = "", bodyClassName = "p-3.5",
}: {
  icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode;
  tom?: "navy" | "suave"; corForte?: string; corSuave?: string; className?: string; bodyClassName?: string;
}) {
  const navy = tom === "navy";
  return (
    <div
      className={`rounded-[12px] overflow-hidden flex flex-col ${className}`}
      style={{ background: "#FFFFFF", border: "1px solid #E3E7ED", boxShadow: "0 1px 2px rgba(16,24,40,.05)" }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 min-h-[44px] py-1.5 shrink-0"
        style={navy ? { background: COR.navy } : { background: corSuave, borderBottom: "1px solid #E3E7ED" }}
      >
        <div className="flex items-center gap-2.5 min-w-0" style={{ color: navy ? "#FFFFFF" : corForte }}>
          <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
          <span className="text-[15px] font-bold truncate" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", letterSpacing: "-0.01em" }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** Rótulo de campo da tela de pedido — legível, sem caixa-alta. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="block text-[12px] font-semibold mb-1" style={{ color: COR.rotulo }}>{children}</span>;
}

/** Input com ícone à esquerda. */
function ComIcone({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gw-text-muted)] [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      {children}
    </div>
  );
}

/** Bloco da faixa de indicadores (ícone + rótulo + valor). */
function Indicador({ icon, rotulo, children, cor = COR.navy }: { icon: React.ReactNode; rotulo: string; children: React.ReactNode; cor?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className="inline-flex items-center justify-center h-10 w-10 rounded-[10px] shrink-0 [&>svg]:h-5 [&>svg]:w-5"
        style={{ background: `color-mix(in srgb, ${cor} 10%, white)`, color: cor }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block text-[12px] font-medium" style={{ color: "var(--gw-text-muted)" }}>{rotulo}</span>
        {children}
      </div>
    </div>
  );
}

const PedidoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, transportadoras, meiosPagamento, vendedores, ensureClientes, refreshPedidos } = useSistema();
  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();
  const { isGestor: isAdmin, vendedorRestrito } = useUserRole(); // admin ou gerente

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
  /* "Produzir até": data limite de produção (sem o prazo de frete). Grava em
     data_produzir_ate e data_despachar_ate — o PCP ("Mais urgente"), a tela
     de Pedidos (atraso) e a OP em PDF leem a data de despacho. */
  const [dataProduzirAte, setDataProduzirAte] = useState("");
  const [observacoes, setObservacoes] = useState("");

  /* Anexos gerais do pedido (briefing, arte solta, logo) — array jsonb em
     sistema_pedidos.anexos, separado dos anexos por item. */
  type AnexoGeral = { url: string; nome: string; criadoEm: string };
  const [anexosGerais, setAnexosGerais] = useState<AnexoGeral[]>([]);
  const anexoGeralInputRef = useRef<HTMLInputElement>(null);
  const [enviandoAnexoGeral, setEnviandoAnexoGeral] = useState(false);

  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [editarClienteAberto, setEditarClienteAberto] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<{ item: PedidoItem; etapa: string } | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [numeroDigitado, setNumeroDigitado] = useState("");
  const [numero, setNumero] = useState("");
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

  /* Sobe a foto INTEIRA por padrão -- o recorte quadrado é opcional (botão
     "Recortar" abaixo da miniatura, só quando já tem foto), não obrigatório
     no upload. */
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

  const [arquivoParaRecortar, setArquivoParaRecortar] = useState<File | null>(null);
  const abrirRecorteFoto = async (itemId: string, url: string) => {
    itemAlvoFoto.current = itemId;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      setArquivoParaRecortar(new File([blob], "mockup.jpg", { type: blob.type || "image/jpeg" }));
    } catch {
      toast.error("Não foi possível carregar a imagem para recortar.");
    }
  };
  const handleFotoRecortada = async (arquivo: File) => {
    const itemId = itemAlvoFoto.current;
    setArquivoParaRecortar(null);
    if (!itemId) return;
    setEnviandoFoto(itemId);
    try {
      const url = await uploadMockup(arquivo, id);
      setItens(prev => prev.map(i => (i.id === itemId ? { ...i, mockupImagem: url } : i)));
      toast.success("Foto recortada e salva.");
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

  /* Aceita várias logos por item (seleção múltipla e cliques repetidos
     acumulam). Cada arquivo sobe separado; um que falhar não derruba os
     outros. */
  const handleArteItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const itemId = itemAlvoArte.current;
    e.target.value = "";
    if (files.length === 0 || !itemId || !id) return;
    setEnviandoArte(itemId);
    const novas: ArteAnexo[] = [];
    for (const file of files) {
      try {
        novas.push(await uploadArquivoPedido(file, id));
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof MockupUploadError ? err.message : "não foi possível enviar o arquivo."}`);
      }
    }
    if (novas.length > 0) {
      setItens(prev => prev.map(i => (i.id === itemId ? comArtes(i, [...artesDoItem(i), ...novas]) : i)));
      toast.success(novas.length > 1 ? `${novas.length} artes anexadas.` : "Arte anexada.");
    }
    setEnviandoArte(null);
  };

  const removerArteItem = (itemId: string, url: string) =>
    setItens(prev => prev.map(i => (i.id === itemId ? comArtes(i, artesDoItem(i).filter(a => a.url !== url)) : i)));

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
        setNumero(mapped.numero);
        setClienteId(mapped.clienteId);
        setContatoNome(mapped.contatoNome || "");
        setContatoTelefone(formatTelefone(mapped.contatoTelefone));
        setContatoEmail(mapped.contatoEmail || "");
        setVendedorId(mapped.vendedorId || "");
        setFreteTipo(mapped.freteTipo || "");
        setFreteValor(mapped.freteValor);
        setTransportadoraId(mapped.transportadoraId || "");
        setPagamentoId(mapped.pagamentoId || "");
        setPrazoEntrega(mapped.prazoEntrega || 0);
        setPrazoProducaoDias(mapped.prazoProducaoDias ?? 15);
        setObservacoes(mapped.observacoes || "");
        const produzirAte = mapped.dataDespacharAte ?? mapped.dataProduzirAte;
        setDataProduzirAte(produzirAte ? produzirAte.slice(0, 10) : "");
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

  const diasUteisProducao = useMemo(
    () => (dataProduzirAte ? diasUteisAte(dataProduzirAte) : 0),
    [dataProduzirAte],
  );
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
      // O diálogo não conhece as artes anexadas — mantém as do item anterior.
      setItens(prev => prev.map(i => (i.id === editingItemId
        ? (artesDoItem(novo).length > 0 ? novo : comArtes(novo, artesDoItem(i)))
        : i)));
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
    const coluna = st ? statusInfo(st).colunaPcp : "organizando_comercial";
    if (coluna === "enviado") {
      toast.error("Item já enviado: não pode ser excluído. Use “Cancelar item”.");
      return;
    }
    /* Sai sem confirmação só o que ainda não chegou na produção: item sem
       linha de produção ou em "Organizando Pedido" (etapa do comercial).
       "Imprimir O.P." (coluna organizando_pedido) já é chão de fábrica. */
    if (coluna !== "organizando_comercial") {
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
    const numeroNovo = numero.trim();
    if (!numeroNovo) { toast.error("Informe o número do pedido."); return; }
    if (!dataProduzirAte) { toast.error("Vendedor, informe a data limite para produção (Produzir até)."); return; }
    if (numeroNovo !== pedido.numero) {
      const { data: repetido } = await supabase
        .from("sistema_pedidos").select("id").eq("numero", numeroNovo).neq("id", id).maybeSingle();
      if (repetido) { toast.error(`Já existe um pedido com o número ${numeroNovo}.`); return; }
    }
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
      numero: numeroNovo,
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
      data_produzir_ate: dataProduzirAte,
      data_despachar_ate: dataProduzirAte,
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
      entidade: "pedido", entidadeId: id, entidadeNumero: numeroNovo, acao: "pedido_editado",
      detalhes: {
        ...(numeroNovo !== pedido.numero ? { numero: { de: pedido.numero, para: numeroNovo } } : {}),
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
    const erro = await excluirPedidoDefinitivo({
      id, numero: pedido.numero, orcamentoId: pedido.orcamentoId,
      detalhes: { itens: itens.map(i => i.nome), total },
    });
    setExcluindo(false);
    if (erro) { toast.error(`Não foi possível excluir. ${erro}`); return; }
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

  const temDadosCliente = Boolean(clienteNome || pedido.clienteSnapshot);
  const botaoCabecalho = "inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-semibold whitespace-nowrap";

  return (
    <div className="pedido-form space-y-4 max-w-[1680px]">
      {/* ── Cabeçalho: voltar · título · nº/cliente · status · ações ───── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/sistema/pedidos")}
            className="inline-flex items-center justify-center h-10 w-10 rounded-[10px] shrink-0 hover:bg-[var(--gw-surface-alt)]"
            style={{ border: "1px solid #D9DEE5", color: COR.navy }}
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="gw-display leading-tight" style={{ color: COR.navy, fontSize: 24 }}>Editar pedido</h2>
            <div className="flex items-center gap-2 min-w-0">
              <OrderNumber value={pedido.numero} />
              <span className="text-[13px] truncate" style={{ color: "var(--gw-text-secondary)" }}>
                ·{" "}
                {/* Pedido importado não tem cliente vinculado — o Calcme só manda
                    o nome. Mostrar "Sem cliente" escondia o nome que existe. */}
                {clienteNome
                  ? clienteDisplay(clienteNome)
                  : (pedido.clienteSnapshot?.nome || pedido.contatoNome || "Sem cliente")}
              </span>
            </div>
          </div>
          <span className="ml-1 shrink-0">
            <StatusBadge
              status={pedido.status}
              nivel="pedido"
              size="md"
              onSelect={slug => setPedido(p => (p ? { ...p, status: slug as Pedido["status"] } : p))}
            />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 bg-white"
            onClick={() => { setConfirmExcluir(true); setNumeroDigitado(""); setSenhaAdmin(""); }}
            style={{ color: "var(--gw-danger)", borderColor: "var(--gw-danger)" }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir pedido
          </Button>
          <Button onClick={salvar} disabled={salvando} className="h-10 px-5 font-semibold text-white hover:opacity-90" style={{ background: COR.verde }}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* ── Faixa de indicadores ───────────────────────────────────────── */}
      <div
        className="rounded-[12px] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3"
        style={{ background: "#FFFFFF", border: "1px solid #E3E7ED", boxShadow: "0 1px 2px rgba(16,24,40,.05)" }}
      >
        <Indicador icon={<Hash />} rotulo="Pedido nº" cor={COR.azul}>
          <Input
            value={numero}
            onChange={e => setNumero(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            aria-label="Número do pedido"
            className="h-8 w-[120px] px-1.5 -ml-1.5 text-[20px] font-bold gw-tnum border-transparent hover:border-[#D9DEE5] focus-visible:border-[var(--gw-primary)]"
            style={{ color: COR.navy }}
          />
        </Indicador>

        <span className="hidden md:block h-10 w-px" style={{ background: "#E3E7ED" }} />

        <Indicador icon={<CalendarDays />} rotulo="Produzir até *" cor={COR.navy}>
          <Input
            type="date"
            value={dataProduzirAte}
            required
            aria-label="Produzir até (data limite de produção)"
            onChange={e => setDataProduzirAte(e.target.value)}
            className="h-8 w-[150px] px-1.5 -ml-1.5 text-[16px] font-bold gw-tnum border-transparent hover:border-[#D9DEE5] focus-visible:border-[var(--gw-primary)]"
            style={{ color: COR.navy, ...(!dataProduzirAte ? { borderColor: "var(--gw-danger)" } : {}) }}
          />
        </Indicador>

        {dataProduzirAte ? (
          <span
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-semibold"
            style={diasUteisProducao <= 2
              ? { background: "var(--gw-danger-soft)", color: "var(--gw-danger)" }
              : { background: COR.verdeSoft, color: COR.verdeEscuro }}
          >
            <CalendarDays className="h-4 w-4" />
            {diasUteisProducao === 0
              ? "Nenhum dia útil p/ produção"
              : `${diasUteisProducao} ${diasUteisProducao === 1 ? "dia útil" : "dias úteis"} p/ produção`}
          </span>
        ) : (
          <span className="text-[12px] max-w-[260px] leading-snug" style={{ color: "var(--gw-danger)" }}>
            Vendedor, informe a data limite p/ produção (sem contar o prazo de frete).
          </span>
        )}

        <span className="flex-1" />

        <Indicador icon={<CircleDollarSign />} rotulo="Valor total" cor={COR.verde}>
          <span className="block text-[22px] font-extrabold gw-tnum leading-tight" style={{ color: COR.verde, letterSpacing: "-0.02em" }}>
            {brl(total)}
          </span>
        </Indicador>
      </div>

      {/* ── Linha 1: Dados do pedido (40%) + Cliente (60%) ─────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch">
        <SectionCard icon={<ClipboardList />} title="Dados do pedido">
          <div className="space-y-2.5">
            <div>
              <Rotulo>Cliente</Rotulo>
              <div className="flex items-center gap-1.5">
                <ClienteBusca clientes={clientes} value={clienteId} onChange={setClienteId} />
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
                {clienteNome && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setEditarClienteAberto(true)}
                    aria-label="Editar cliente"
                    title="Editar dados do cliente"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <label className="block">
                <Rotulo>Contato</Rotulo>
                <ComIcone icon={<User />}>
                  <Input className="h-9 pl-8" value={contatoNome} onChange={e => setContatoNome(e.target.value)} placeholder="Nome de quem conversamos" />
                </ComIcone>
              </label>
              <label className="block">
                <Rotulo>WhatsApp</Rotulo>
                <ComIcone icon={<MessageCircle />}>
                  <Input className="h-9 pl-8" value={contatoTelefone} onChange={e => setContatoTelefone(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
                </ComIcone>
              </label>
              <label className="block">
                <Rotulo>Vendedor</Rotulo>
                <Select value={vendedorId} onValueChange={setVendedorId} disabled={!!vendedorRestrito && vendedorRestrito.length <= 1}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {/* Vinculado a mais de um vendedor: escolhe só entre os dele. */}
                    {vendedores.filter(v => !vendedorRestrito || vendedorRestrito.includes(v.id) || v.id === vendedorId).map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <Rotulo>E-mail</Rotulo>
                <ComIcone icon={<Mail />}>
                  <Input className="h-9 pl-8" value={contatoEmail} onChange={e => setContatoEmail(e.target.value)} placeholder="E-mail do contato" />
                </ComIcone>
              </label>
            </div>
          </div>
        </SectionCard>

        {/* Dados do cliente pra etiqueta/nota -- copiar campo a campo ou tudo,
            e editar o cadastro sem sair do pedido. */}
        <SectionCard
          icon={<IdCard />}
          title="Cliente (envio e etiqueta)"
          action={temDadosCliente ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copiarEtiquetaCliente({
                  cliente: clienteNome ?? null,
                  snapshot: clienteNome ? null : pedido.clienteSnapshot ?? null,
                  contatoPedido: { nome: contatoNome, telefone: contatoTelefone, email: contatoEmail },
                })}
                className={`${botaoCabecalho} text-white hover:opacity-90`}
                style={{ background: COR.azul }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar tudo
              </button>
              {clienteNome && (
                <button
                  type="button"
                  onClick={() => setEditarClienteAberto(true)}
                  className={`${botaoCabecalho} bg-white hover:bg-[#EEF2F8]`}
                  style={{ color: COR.navy }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar cliente
                </button>
              )}
            </div>
          ) : undefined}
        >
          <DadosClienteEnvio
            compacto
            semAcoes
            cliente={clienteNome ?? null}
            snapshot={clienteNome ? null : pedido.clienteSnapshot ?? null}
            contatoPedido={{ nome: contatoNome, telefone: contatoTelefone, email: contatoEmail }}
            onEditar={clienteNome ? () => setEditarClienteAberto(true) : undefined}
          />
        </SectionCard>
      </div>

      {/* ── Linha 2: Produtos (65%) + Resumo (35%) ─────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] items-start">
        <SectionCard
          icon={<PackageSearch />}
          title="Produtos do pedido"
          bodyClassName="px-3.5 py-1.5"
          action={
            <button
              type="button"
              onClick={abrirNovoItem}
              className={`${botaoCabecalho} hover:opacity-90`}
              style={{ background: COR.verdeSoft, color: COR.verdeEscuro }}
            >
              <Plus className="h-4 w-4" /> Adicionar produto
            </button>
          }
        >
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFotoItem}
          />
          <RecorteQuadrado
            arquivo={arquivoParaRecortar}
            onCancelar={() => setArquivoParaRecortar(null)}
            onConfirmar={arq => void handleFotoRecortada(arq)}
          />
          <input
            ref={arteInputRef}
            type="file"
            accept="image/*,application/pdf,.ai,.cdr,.eps,.svg"
            multiple
            className="hidden"
            onChange={handleArteItem}
          />

          <div className="divide-y divide-[#E9EDF2]">
            {itens.map(item => {
              const st = statusDoItem(item.id);
              const cancelado = Boolean((item as PedidoItem & { cancelado?: boolean }).cancelado) || st === "cancelado";
              return (
                <div key={item.id} className="py-2.5 space-y-1.5" style={{ opacity: cancelado ? 0.5 : 1 }}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => escolherFoto(item.id)}
                        disabled={enviandoFoto === item.id}
                        title={item.mockupImagem ? "Trocar a foto deste item" : "Anexar foto deste item"}
                        className="relative group h-14 w-14 rounded-[10px] overflow-hidden block"
                        style={{ border: "1px solid #E3E7ED" }}
                      >
                        <Thumb src={item.mockupImagem || item.imagem} alt={item.nome} size="md" />
                        <span
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                            enviandoFoto === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                          style={{ background: "rgba(8,43,87,0.62)" }}
                        >
                          {enviandoFoto === item.id
                            ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                            : <Camera className="h-4 w-4 text-white" />}
                        </span>
                      </button>
                      {item.mockupImagem && (
                        <button
                          type="button"
                          onClick={() => void abrirRecorteFoto(item.id, item.mockupImagem!)}
                          disabled={enviandoFoto === item.id}
                          className="text-[10px] text-primary hover:underline block w-14 text-center"
                        >
                          Recortar
                        </button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-[14.5px] font-bold" style={{ color: COR.navy, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
                          {item.nome}
                        </span>
                        {item.varianteSlug && (
                          <span className="gw-meta text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--gw-surface-alt)" }}>
                            {item.varianteSlug}
                          </span>
                        )}
                      </div>
                      {item.origemCalcme ? (
                        <span className="block text-[12px] font-medium" style={{ color: "var(--gw-text-muted)" }}>
                          Importado do Calcme
                        </span>
                      ) : (
                        <span
                          className="block text-[12px] font-medium"
                          style={{ color: resumoPersonalizacao(item) ? "var(--gw-text-secondary)" : "var(--gw-danger)" }}
                        >
                          {resumoPersonalizacao(item) || "Sem personalização definida — edite o item"}
                        </span>
                      )}
                      <span onClick={e => e.stopPropagation()} className="inline-block mt-0.5">
                        <StatusBadge
                          status={cancelado ? "cancelado" : st}
                          nivel="item"
                          size="sm"
                          onSelect={cancelado ? undefined : slug => alterarStatusItem(item.id, slug)}
                        />
                      </span>
                    </div>

                    {/* Quantidade — stepper compacto */}
                    <div className="flex items-center shrink-0 rounded-[8px] overflow-hidden self-center" style={{ border: "1px solid #D9DEE5" }}>
                      <button
                        type="button"
                        aria-label="Diminuir quantidade"
                        onClick={() => alterarQuantidade(item.id, -1)}
                        className="inline-flex items-center justify-center h-8 w-8 hover:bg-[var(--gw-surface-alt)]"
                        style={{ color: COR.navy }}
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
                        className="h-8 w-16 text-center px-1 rounded-none border-0 border-x border-[#D9DEE5] font-bold text-[14px] focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ color: COR.navy }}
                      />
                      <button
                        type="button"
                        aria-label="Aumentar quantidade"
                        onClick={() => alterarQuantidade(item.id, 1)}
                        className="inline-flex items-center justify-center h-8 w-8 hover:bg-[var(--gw-surface-alt)]"
                        style={{ color: COR.navy }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="text-right shrink-0 w-[118px] self-center">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] font-semibold" style={{ color: "var(--gw-text-muted)" }}>R$</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.precoUnitario}
                          aria-label="Valor unitário"
                          onChange={e => {
                            const preco = Math.max(0, Number(e.target.value) || 0);
                            setItens(prev => prev.map(i => i.id === item.id
                              ? { ...i, precoUnitario: preco, total: num(i.quantidade) * preco } : i));
                          }}
                          className="h-8 w-[88px] text-right px-1.5 text-[15px] font-bold"
                          style={{ color: COR.navy }}
                        />
                      </div>
                      <span className="block text-[12px] font-semibold gw-tnum mt-0.5" style={{ color: "var(--gw-text-secondary)" }}>
                        {brl(num(item.total) || num(item.quantidade) * num(item.precoUnitario))}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1 shrink-0 self-center">
                      <button
                        type="button"
                        aria-label="Editar item"
                        onClick={() => abrirEdicaoItem(item)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-[8px]"
                        style={{ background: "var(--gw-primary-soft)", color: COR.azul }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {st === "enviado" || cancelado ? (
                        <button
                          type="button"
                          aria-label="Cancelar item"
                          disabled={cancelado}
                          onClick={() => cancelarItem(item)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-[8px]"
                          style={{ background: "var(--gw-surface-alt)", color: "var(--gw-text-secondary)" }}
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Remover item"
                          onClick={() => pedirRemocao(item)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-[8px]"
                          style={{ background: "var(--gw-danger-soft)", color: "var(--gw-danger)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Personalização + arte */}
                  <div className="flex items-center gap-2 pl-[68px]">
                    <input
                      value={item.observacao ?? ""}
                      onChange={e => {
                        const v = e.target.value;
                        setItens(prev => prev.map(i => (i.id === item.id ? { ...i, observacao: v } : i)));
                      }}
                      placeholder="Personalização — técnica, cor, nomes da gravação"
                      className="h-8 px-2.5 flex-1 min-w-0 rounded-[8px] text-[12.5px] bg-[#F5F7FA] border border-transparent
                                 hover:border-[#D9DEE5] focus:border-[var(--gw-primary)] focus:bg-white
                                 focus:outline-none transition-colors placeholder:text-[var(--gw-text-muted)]"
                      style={{ color: "var(--gw-text)" }}
                    />
                    <button
                      type="button"
                      onClick={() => escolherArte(item.id)}
                      disabled={enviandoArte === item.id}
                      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-semibold"
                      style={{ background: "var(--gw-primary-soft)", color: COR.azul }}
                    >
                      {enviandoArte === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : artesDoItem(item).length > 0 ? <Plus className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                      {artesDoItem(item).length > 0 ? "Outra arte" : "Anexar arte"}
                    </button>
                  </div>
                  {artesDoItem(item).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-[68px]">
                      {artesDoItem(item).map((a, idx) => (
                        <span
                          key={a.url}
                          className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded text-[11px] font-semibold max-w-[220px]"
                          style={{ background: "var(--gw-primary-soft)", color: "var(--gw-primary)" }}
                        >
                          <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-w-0" title={a.nome}>
                            <Download className="h-3 w-3 shrink-0" />
                            <span className="truncate">{a.nome || `Arte ${idx + 1}`}</span>
                          </a>
                          <button
                            type="button"
                            aria-label="Remover arte"
                            onClick={() => removerArteItem(item.id, a.url)}
                            className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-[rgba(239,68,68,0.12)] hover:text-[var(--gw-danger)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {itens.length === 0 && <div className="py-8 text-center gw-meta">Nenhum item no pedido.</div>}
          </div>
        </SectionCard>

        {/* Resumo — fica parado no topo enquanto a lista de produtos rola */}
        <div className="xl:sticky xl:top-4">
          <SectionCard icon={<CircleDollarSign />} title="Resumo do pedido">
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span style={{ color: "var(--gw-text-secondary)" }}>Subtotal</span>
                <span className="font-semibold gw-tnum" style={{ color: COR.navy }}>{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--gw-text-secondary)" }}>
                  Frete{freteTipo ? ` (${freteTipo})` : ""}
                </span>
                <span className="font-semibold gw-tnum" style={{ color: COR.navy }}>{brl(num(freteValor))}</span>
              </div>
              <div
                className="flex items-center justify-between rounded-[10px] px-3.5 py-3 mt-1"
                style={{ background: COR.verdeSoft, border: "1px solid #C9EDD6" }}
              >
                <span className="inline-flex items-center gap-2 text-[16px] font-bold" style={{ color: COR.verdeEscuro }}>
                  <CircleDollarSign className="h-5 w-5" /> Total
                </span>
                <span className="text-[24px] font-extrabold gw-tnum" style={{ color: COR.verdeEscuro, letterSpacing: "-0.02em" }}>
                  {brl(total)}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Linha 3: Frete · Condição comercial · Anexos ───────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
        <SectionCard icon={<Truck />} title="Frete e entrega" tom="suave" corForte={COR.azul} corSuave="#E6EFFD">
          <div className="space-y-2.5">
            <label className="block">
              <Rotulo>Transportadora</Rotulo>
              <Select value={transportadoraId} onValueChange={setTransportadoraId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {transportadoras.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Rotulo>Tipo de frete</Rotulo>
                <Select value={freteTipo} onValueChange={v => setFreteTipo(v as "CIF" | "FOB")}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CIF">CIF (frete incluso)</SelectItem>
                    <SelectItem value="FOB">FOB</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <Rotulo>Valor do frete</Rotulo>
                <ComIcone icon={<span className="text-[11px] font-bold">R$</span>}>
                  <Input className="h-9 pl-8" type="number" step="0.01" value={freteValor}
                    onChange={e => setFreteValor(Number(e.target.value) || 0)} />
                </ComIcone>
              </label>
            </div>
            <label className="block">
              <Rotulo>Prazo de entrega (dias)</Rotulo>
              <ComIcone icon={<CalendarDays />}>
                <Input className="h-9 pl-8" type="number" value={prazoEntrega}
                  onChange={e => setPrazoEntrega(Number(e.target.value) || 0)} />
              </ComIcone>
            </label>
          </div>
        </SectionCard>

        <SectionCard icon={<CreditCard />} title="Condição comercial" tom="suave" corForte={COR.verdeEscuro} corSuave={COR.verdeSoft}>
          <div className="space-y-2.5">
            <label className="block">
              <Rotulo>Condição de pagamento</Rotulo>
              <Select value={pagamentoId} onValueChange={setPagamentoId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meiosPagamento.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <Rotulo>Observações comerciais</Rotulo>
              <Textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} className="min-h-[84px]" />
            </label>
          </div>
        </SectionCard>

        <SectionCard icon={<Paperclip />} title="Anexos gerais" tom="suave" corForte="#5145D9" corSuave="#EEECFB" className="md:col-span-2 xl:col-span-1">
          <input ref={anexoGeralInputRef} type="file" accept="image/*,application/pdf,.ai,.cdr,.eps,.svg" className="hidden" onChange={handleAnexoGeral} />
          {anexosGerais.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {anexosGerais.map(a => (
                <div key={a.url} className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5" style={{ border: "1px solid #E3E7ED" }}>
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "#5145D9" }} />
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
            className={`w-full rounded-[10px] flex flex-col items-center justify-center gap-1.5 text-center hover:bg-[#F7F6FE] transition-colors ${anexosGerais.length > 0 ? "py-3" : "py-6"}`}
            style={{ border: "1.5px dashed #B9B3EE" }}
          >
            {enviandoAnexoGeral ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#5145D9" }} /> : <Upload className="h-5 w-5" style={{ color: "#5145D9" }} />}
            <span className="text-[13px] font-medium" style={{ color: COR.navy }}>
              Clique para anexar briefing, arte ou logo
            </span>
            <span className="gw-meta text-[11px]">PNG, JPG, PDF, AI, CDR, EPS, SVG (máx. 30 MB)</span>
          </button>
        </SectionCard>
      </div>

      {editarClienteAberto && clienteNome && (
        <ClienteDialog
          open={editarClienteAberto}
          onOpenChange={setEditarClienteAberto}
          cliente={clienteNome}
        />
      )}

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
