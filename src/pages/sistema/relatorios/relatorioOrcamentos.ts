/* Relatório de orçamentos (admin): um Excel com TODOS os dados do lead/
   cliente de cada orçamento — principalmente contato, WhatsApp e e-mail —
   para bater com os formulários de lead do Meta.

   Planilhas:
   - "Orçamentos": uma linha por orçamento (cliente, contato, valores, status).
   - "Itens": uma linha por produto orçado.
   - "Como ler". */

import { supabase } from "@/integrations/supabase/client";
import { lerEmLotes } from "@/lib/resultadoPedidos";
import { resumoPersonalizacao } from "@/lib/personalizacao";
import type { Endereco, QuoteItem } from "@/contexts/SistemaContext";
import {
  arred, dataExcel, formatarEndereco, montarPlanilha, type Celula, type Coluna,
} from "./relatorioGeralPedidos";

// Tabelas do sistema ainda fora do types.ts gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FiltroOrcamentos {
  /** yyyy-mm-dd, inclusive. */
  inicio: string;
  /** yyyy-mm-dd, inclusive. */
  fim: string;
  vendedorId?: string | null;
  /** "todos" | "aberto" | "aprovado" | "cancelado" */
  status?: string;
}

/** Nomes das tabelas auxiliares (vêm do contexto da tela). */
export interface NomesAuxiliares {
  vendedores: Map<string, string>;
  origens: Map<string, string>;
  pagamentos: Map<string, string>;
  transportadoras: Map<string, string>;
}

interface Contato { nome?: string; telefone?: string; email?: string }

interface OrcamentoRow {
  id: string;
  numero: string;
  cliente_id: string | null;
  cliente_snapshot: {
    nome?: string; tipo?: string; documento?: string; ie?: string;
    endereco?: Endereco; contato?: Contato;
  } | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  vendedor_id: string | null;
  origem_id: string | null;
  itens: QuoteItem[] | null;
  subtotal: number | null;
  frete_tipo: string | null;
  frete_valor: number | null;
  transportadora_id: string | null;
  prazo_entrega: number | null;
  pagamento_id: string | null;
  observacoes: string | null;
  status: string;
  aprovado_em: string | null;
  created_at: string;
}

interface ClienteRow {
  id: string;
  nome: string | null;
  razao_social?: string | null;
  tipo: string | null;
  documento: string | null;
  ie: string | null;
  contatos: Contato[] | null;
  enderecos: Endereco[] | null;
}

export interface LinhaOrcamento {
  o: OrcamentoRow;
  itens: QuoteItem[];
  clienteNome: string;
  razaoSocial: string;
  tipoPessoa: string;
  documento: string;
  ie: string;
  contatoNome: string;
  whatsapp: string;
  emailContato: string;
  emailsCadastro: string;
  telefonesCadastro: string;
  endereco: Endereco | undefined;
  statusNome: string;
  vendedorNome: string;
  origemNome: string;
  pagamentoNome: string;
  transportadoraNome: string;
  pedidoNumero: string;
  qtdTotal: number;
  subtotal: number;
  frete: number;
  total: number;
}

const STATUS: Record<string, string> = { aberto: "Aberto", aprovado: "Aprovado", cancelado: "Cancelado" };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const itemTotal = (i: QuoteItem) => num(i.quantidade) * num(i.precoUnitario);
const unicos = (xs: (string | undefined | null)[]) =>
  [...new Set(xs.map(x => (x ?? "").trim()).filter(Boolean))].join(" / ");

/** Lê os orçamentos do período, com cliente e pedido gerado. */
export async function carregarRelatorioOrcamentos(f: FiltroOrcamentos, nomes: NomesAuxiliares): Promise<LinhaOrcamento[]> {
  const [a, m, d] = f.fim.split("-").map(Number);
  const fimExcl = new Date(a, m - 1, d + 1);
  const [ai, mi, di] = f.inicio.split("-").map(Number);
  const ini = new Date(ai, mi - 1, di);

  // Lê em páginas: o itens (jsonb) de cada orçamento pode ser grande.
  const PAGINA = 200;
  const orcamentos: OrcamentoRow[] = [];
  for (let de = 0; ; de += PAGINA) {
    let q = db.from("sistema_orcamentos").select("*")
      .gte("created_at", ini.toISOString())
      .lt("created_at", fimExcl.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (f.vendedorId) q = q.eq("vendedor_id", f.vendedorId);
    if (f.status && f.status !== "todos") q = q.eq("status", f.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message || "Falha ao ler orçamentos");
    orcamentos.push(...((data ?? []) as OrcamentoRow[]));
    if (!data || data.length < PAGINA) break;
  }

  const idsClientes = [...new Set(orcamentos.map(o => o.cliente_id).filter((x): x is string => !!x))];
  const idsOrc = orcamentos.filter(o => o.status === "aprovado").map(o => o.id);
  const [clientesRes, pedidosRes] = await Promise.all([
    lerEmLotes<ClienteRow>(idsClientes, lote => db.from("sistema_clientes").select("*").in("id", lote)),
    lerEmLotes<{ numero: string; orcamento_id: string }>(idsOrc, lote => db
      .from("sistema_pedidos").select("numero,orcamento_id").in("orcamento_id", lote)),
  ]);
  if (clientesRes.error) throw new Error(clientesRes.error.message || "Falha ao ler clientes");
  const clientes = new Map(clientesRes.data.map(c => [c.id, c]));
  const pedidoPorOrc = new Map<string, string[]>();
  for (const p of pedidosRes.data) (pedidoPorOrc.get(p.orcamento_id) ?? pedidoPorOrc.set(p.orcamento_id, []).get(p.orcamento_id)!).push(String(p.numero));

  return orcamentos.map(o => {
    const cli = o.cliente_id ? clientes.get(o.cliente_id) : undefined;
    const snap = o.cliente_snapshot ?? {};
    const contatosCli = Array.isArray(cli?.contatos) ? cli!.contatos! : [];
    const principal = contatosCli[0];
    const itens = Array.isArray(o.itens) ? o.itens : [];
    const subtotal = itens.length ? itens.reduce((s, i) => s + itemTotal(i), 0) : num(o.subtotal);
    const frete = num(o.frete_valor);
    return {
      o,
      itens,
      clienteNome: cli?.nome || snap.nome || "—",
      razaoSocial: cli?.razao_social || "",
      tipoPessoa: cli?.tipo || snap.tipo || "",
      documento: cli?.documento || snap.documento || "",
      ie: cli?.ie || snap.ie || "",
      contatoNome: o.contato_nome || snap.contato?.nome || principal?.nome || "",
      whatsapp: o.contato_telefone || snap.contato?.telefone || principal?.telefone || "",
      emailContato: o.contato_email || snap.contato?.email || principal?.email || "",
      emailsCadastro: unicos(contatosCli.map(c => c.email)),
      telefonesCadastro: unicos(contatosCli.map(c => c.telefone)),
      endereco: snap.endereco ?? (Array.isArray(cli?.enderecos) ? cli!.enderecos![0] : undefined),
      statusNome: STATUS[o.status] ?? o.status,
      vendedorNome: (o.vendedor_id && nomes.vendedores.get(o.vendedor_id)) || "Sem vendedor",
      origemNome: (o.origem_id && nomes.origens.get(o.origem_id)) || "",
      pagamentoNome: (o.pagamento_id && nomes.pagamentos.get(o.pagamento_id)) || "",
      transportadoraNome: (o.transportadora_id && nomes.transportadoras.get(o.transportadora_id)) || "",
      pedidoNumero: (pedidoPorOrc.get(o.id) ?? []).join(", "),
      qtdTotal: itens.reduce((s, i) => s + num(i.quantidade), 0),
      subtotal,
      frete,
      total: subtotal + frete,
    };
  });
}

/* ── Excel ────────────────────────────────────────────────────────────── */

const CLIENTE_COLS: Coluna[] = [
  { titulo: "Data", largura: 12, tipo: "data" },
  { titulo: "Nº orçamento", largura: 12, tipo: "texto" },
  { titulo: "Status", largura: 11, tipo: "texto" },
  { titulo: "Vendedor", largura: 18, tipo: "texto" },
  { titulo: "Origem do lead", largura: 18, tipo: "texto" },
  { titulo: "Cliente", largura: 32, tipo: "texto" },
  { titulo: "Contato", largura: 24, tipo: "texto" },
  { titulo: "WhatsApp do contato", largura: 18, tipo: "texto" },
  { titulo: "E-mail do contato", largura: 28, tipo: "texto" },
];

const COLS_ORC: Coluna[] = [
  ...CLIENTE_COLS,
  { titulo: "Razão social", largura: 32, tipo: "texto" },
  { titulo: "PF/PJ", largura: 6, tipo: "texto" },
  { titulo: "CNPJ/CPF", largura: 20, tipo: "texto" },
  { titulo: "Inscrição estadual", largura: 16, tipo: "texto" },
  { titulo: "E-mails da empresa (cadastro)", largura: 32, tipo: "texto" },
  { titulo: "Telefones da empresa (cadastro)", largura: 26, tipo: "texto" },
  { titulo: "Endereço", largura: 48, tipo: "texto" },
  { titulo: "Cidade", largura: 18, tipo: "texto" },
  { titulo: "UF", largura: 5, tipo: "texto" },
  { titulo: "CEP", largura: 11, tipo: "texto" },
  { titulo: "Qtd. de peças", largura: 11, tipo: "qtd", soma: true },
  { titulo: "Produtos", largura: 50, tipo: "texto" },
  { titulo: "Subtotal", largura: 15, tipo: "brl", soma: true },
  { titulo: "Frete (CIF/FOB)", largura: 10, tipo: "texto" },
  { titulo: "Valor do frete", largura: 13, tipo: "brl", soma: true },
  { titulo: "Total", largura: 15, tipo: "brl", soma: true },
  { titulo: "Forma de pagamento", largura: 20, tipo: "texto" },
  { titulo: "Transportadora", largura: 18, tipo: "texto" },
  { titulo: "Prazo de entrega (dias)", largura: 12, tipo: "texto" },
  { titulo: "Aprovado em", largura: 12, tipo: "data" },
  { titulo: "Pedido gerado", largura: 12, tipo: "texto" },
  { titulo: "Observações", largura: 40, tipo: "texto" },
];

const COLS_ITENS: Coluna[] = [
  ...CLIENTE_COLS,
  { titulo: "Código", largura: 16, tipo: "texto" },
  { titulo: "Produto", largura: 40, tipo: "texto" },
  { titulo: "Personalização", largura: 24, tipo: "texto" },
  { titulo: "Quantidade", largura: 11, tipo: "qtd", soma: true },
  { titulo: "Valor unitário", largura: 14, tipo: "brl" },
  { titulo: "Total do item", largura: 15, tipo: "brl", soma: true },
];

const cabecalho = (l: LinhaOrcamento): Celula[] => [
  dataExcel(l.o.created_at), String(l.o.numero), l.statusNome, l.vendedorNome, l.origemNome,
  l.clienteNome, l.contatoNome, l.whatsapp, l.emailContato,
];

function linhasOrcamentos(ls: LinhaOrcamento[]): Celula[][] {
  return ls.map(l => {
    const e = l.endereco;
    return [
      ...cabecalho(l),
      l.razaoSocial, l.tipoPessoa, l.documento, l.ie, l.emailsCadastro, l.telefonesCadastro,
      formatarEndereco(e), e?.cidade ?? "", (e?.uf ?? "").toUpperCase(), e?.cep ?? "",
      l.qtdTotal, l.itens.map(i => `${num(i.quantidade)}× ${i.nome}`).join("; "),
      arred(l.subtotal),
      l.o.frete_tipo === "CIF" || l.o.frete_tipo === "FOB" ? l.o.frete_tipo : "",
      arred(l.frete), arred(l.total),
      l.pagamentoNome, l.transportadoraNome,
      l.o.prazo_entrega ? String(l.o.prazo_entrega) : "",
      l.o.aprovado_em ? dataExcel(l.o.aprovado_em) : null,
      l.pedidoNumero, l.o.observacoes ?? "",
    ];
  });
}

function linhasItens(ls: LinhaOrcamento[]): Celula[][] {
  const out: Celula[][] = [];
  for (const l of ls) {
    if (l.itens.length === 0) {
      out.push([...cabecalho(l), "", "(orçamento sem produtos)", "", 0, 0, 0]);
      continue;
    }
    for (const i of l.itens) {
      out.push([
        ...cabecalho(l),
        i.codigoComposto ?? "", i.nome,
        resumoPersonalizacao({ personalizacao: i.personalizacao, aplicacoes: i.aplicacoes }),
        num(i.quantidade), arred(num(i.precoUnitario), 4), arred(itemTotal(i)),
      ]);
    }
  }
  return out;
}

/** Gera e baixa o .xlsx. Devolve as linhas (para o resumo da tela). */
export async function exportarRelatorioOrcamentos(f: FiltroOrcamentos, nomes: NomesAuxiliares): Promise<LinhaOrcamento[]> {
  const [linhas, mod] = await Promise.all([carregarRelatorioOrcamentos(f, nomes), import("exceljs")]);
  const ExcelJS = (mod as { default?: unknown }).default ?? mod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = new (ExcelJS as any).Workbook();
  wb.creator = "GiftWeb";
  wb.created = new Date();

  const fmt = (ymd: string) => { const [a, m, d] = ymd.split("-").map(Number); return new Date(a, m - 1, d).toLocaleDateString("pt-BR"); };
  const titulo = `Relatório de orçamentos — ${fmt(f.inicio)} a ${fmt(f.fim)}`;

  montarPlanilha(wb, "Orçamentos", titulo, COLS_ORC, linhasOrcamentos(linhas));
  montarPlanilha(wb, "Itens", titulo, COLS_ITENS, linhasItens(linhas));

  const ws = wb.addWorksheet("Como ler");
  ws.columns = [{ width: 30 }, { width: 110 }];
  ([
    ["Período", `${fmt(f.inicio)} a ${fmt(f.fim)} (data de criação do orçamento)`],
    ["Status", !f.status || f.status === "todos" ? "Todos" : STATUS[f.status] ?? f.status],
    ["", ""],
    ["Contato / WhatsApp / E-mail", "Os do orçamento; se em branco, o contato principal do cadastro do cliente. Use para cruzar com os leads do Meta."],
    ["E-mails/Telefones da empresa", "Todos os e-mails e telefones dos contatos do cadastro do cliente (inclui os vindos da consulta do CNPJ)."],
    ["Origem do lead", "Campo \"Origem\" do orçamento."],
    ["Pedido gerado", "Nº do pedido criado quando o orçamento foi aprovado."],
    ["Aba Itens", "Uma linha por produto orçado, repetindo os dados do cliente/contato."],
  ] as [string, string][]).forEach(([a, b], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = a; row.getCell(1).font = { bold: true };
    row.getCell(2).value = b; row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `relatorio-orcamentos_${f.inicio}_a_${f.fim}.xlsx`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return linhas;
}
