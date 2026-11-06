/* Relatório geral de pedidos (admin): um Excel com os dados do cliente/lead
   e o resultado financeiro de cada venda.

   Os números saem de src/lib/resultadoPedidos.ts — o mesmo cálculo do
   Dashboard por pedido — então o relatório bate com o dashboard.

   Planilhas:
   - "Itens": uma linha por produto. Imposto, comissão, taxa de cartão e frete
     são do pedido inteiro e vão rateados pelos itens na proporção do valor
     de venda de cada um, para que a soma das linhas feche com o pedido.
   - "Pedidos": uma linha por pedido, com os valores cheios.
   - "Como ler": de onde vem cada coluna. */

import { supabase } from "@/integrations/supabase/client";
import {
  calcularPedido, carregarBaseResultado, faixasComissao, lerEmLotes, mesDoPedido,
  type OrigemCusto, type ResultadoPedido,
} from "@/lib/resultadoPedidos";
import { resumoPersonalizacao } from "@/lib/personalizacao";
import { statusInfo } from "@/lib/statusPedido";
import type { Endereco } from "@/contexts/SistemaContext";

// Tabelas do sistema ainda fora do types.ts gerado — mesmo cast do resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FiltroRelatorio {
  /** yyyy-mm-dd, inclusive. */
  inicio: string;
  /** yyyy-mm-dd, inclusive. */
  fim: string;
  vendedorId?: string | null;
  incluirCancelados?: boolean;
}

interface ClienteRow {
  id: string;
  nome: string | null;
  contatos: { nome?: string; telefone?: string }[] | null;
  enderecos: Endereco[] | null;
}

const ORIGEM_CUSTO: Record<OrigemCusto, string> = {
  editado: "Digitado no dashboard",
  compra: "Compra",
  catalogo: "Catálogo",
  compra_sem_preco: "Compra sem preço",
  sem: "Sem custo",
};

const dataLocal = (ymd: string) => {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(a, m - 1, d);
};

/* O exceljs grava Date pelo relógio UTC: um pedido das 22h de Brasília
   viraria o dia seguinte. Fixa a data local à meia-noite UTC. */
const dataExcel = (iso: string) => {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const formatarEndereco = (e?: Partial<Endereco> | null) => {
  if (!e) return "";
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  return [rua, e.complemento, e.bairro, e.cidade, e.cep ? `CEP ${e.cep}` : ""]
    .map(x => (x ?? "").trim()).filter(Boolean).join(" - ");
};

const arred = (n: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
};

type LinhaPedido = ResultadoPedido & {
  clienteNome: string;
  contatoNome: string;
  contatoTelefone: string;
  endereco: string;
  uf: string;
  statusNome: string;
  vendedorNome: string;
  pagamentoNome: string;
  comissaoPct: number;
  comissao: number;
  lucroLiquido: number;
};

/** Lê e calcula. Exportado à parte para a tela mostrar o resumo. */
export async function carregarRelatorioGeral(f: FiltroRelatorio): Promise<LinhaPedido[]> {
  const ini = dataLocal(f.inicio);
  const fimExcl = dataLocal(f.fim);
  fimExcl.setDate(fimExcl.getDate() + 1);

  /* A faixa de comissão é do vendedor no MÊS inteiro: lê os meses cheios que
     o período toca e só depois recorta, senão um período parcial cairia
     numa faixa menor do que a do dashboard. */
  const iniMes = new Date(ini.getFullYear(), ini.getMonth(), 1);
  const fimMes = new Date(fimExcl.getFullYear(), fimExcl.getMonth() + (fimExcl.getDate() === 1 ? 0 : 1), 1);

  const [base, vendedores] = await Promise.all([
    carregarBaseResultado({
      inicio: iniMes.toISOString(),
      fim: fimMes.toISOString(),
      incluirCancelados: f.incluirCancelados,
    }),
    db.from("sistema_vendedores").select("id,nome"),
  ]);
  const nomeVendedor = new Map<string, string>(
    ((vendedores.data ?? []) as { id: string; nome: string }[]).map(v => [v.id, v.nome]),
  );

  const todas = base.pedidos.map(p => calcularPedido(p, base));
  const faixas = faixasComissao(todas);

  const noPeriodo = todas.filter(l => {
    const d = new Date(l.p.created_at);
    if (d < ini || d >= fimExcl) return false;
    if (f.vendedorId && l.p.vendedor_id !== f.vendedorId) return false;
    return true;
  });

  const idsClientes = [...new Set(noPeriodo.map(l => l.p.cliente_id).filter((x): x is string => !!x))];
  const clientesRes = await lerEmLotes<ClienteRow>(idsClientes, lote => db
    .from("sistema_clientes").select("id,nome,contatos,enderecos").in("id", lote));
  if (clientesRes.error) throw new Error(clientesRes.error.message || "Falha ao ler clientes");
  const clientes = new Map(clientesRes.data.map(c => [c.id, c]));

  return noPeriodo.map(l => {
    const p = l.p;
    const cli = p.cliente_id ? clientes.get(p.cliente_id) : undefined;
    const snap = p.cliente_snapshot ?? {};
    const contatoCli = cli?.contatos?.[0];
    const end = snap.endereco ?? cli?.enderecos?.[0];
    const cancelado = p.status === "cancelado";
    const comissaoPct = cancelado ? 0 : faixas.get(`${p.vendedor_id ?? "—"}|${mesDoPedido(p.created_at)}`)?.pct ?? 0;
    const comissao = l.baseComissao * comissaoPct / 100;
    return {
      ...l,
      clienteNome: cli?.nome || snap.nome || "—",
      contatoNome: p.contato_nome || snap.contato?.nome || contatoCli?.nome || "",
      contatoTelefone: p.contato_telefone || snap.contato?.telefone || contatoCli?.telefone || "",
      endereco: formatarEndereco(end),
      uf: (end?.uf ?? "").toUpperCase(),
      statusNome: statusInfo(p.status).nome,
      vendedorNome: (p.vendedor_id && nomeVendedor.get(p.vendedor_id)) || "Sem vendedor",
      pagamentoNome: l.meio?.nome ?? "",
      comissaoPct,
      comissao,
      lucroLiquido: l.lucro - comissao,
    };
  }).sort((a, b) => a.p.created_at.localeCompare(b.p.created_at) || String(a.p.numero).localeCompare(String(b.p.numero)));
}

/* ── Excel ────────────────────────────────────────────────────────────── */

const FMT_BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const FMT_PCT = "0.00%";
const FMT_DATA = "dd/mm/yyyy";
const FMT_QTD = "#,##0";
const AZUL = "FF0B2A4A";

type Tipo = "texto" | "data" | "brl" | "pct" | "qtd";
interface Coluna { titulo: string; largura: number; tipo: Tipo; soma?: boolean }

const COLS_ITENS: Coluna[] = [
  { titulo: "Data da venda", largura: 12, tipo: "data" },
  { titulo: "Nº pedido", largura: 11, tipo: "texto" },
  { titulo: "Cliente", largura: 32, tipo: "texto" },
  { titulo: "Contato", largura: 22, tipo: "texto" },
  { titulo: "Telefone do contato", largura: 18, tipo: "texto" },
  { titulo: "Endereço", largura: 48, tipo: "texto" },
  { titulo: "UF", largura: 5, tipo: "texto" },
  { titulo: "Status da venda", largura: 22, tipo: "texto" },
  { titulo: "Vendedor", largura: 18, tipo: "texto" },
  { titulo: "Tipo de pagamento", largura: 20, tipo: "texto" },
  { titulo: "Quantidade", largura: 11, tipo: "qtd", soma: true },
  { titulo: "Produto", largura: 40, tipo: "texto" },
  { titulo: "Tipo de personalização", largura: 24, tipo: "texto" },
  { titulo: "Valor de custo (un.)", largura: 15, tipo: "brl" },
  { titulo: "Valor de venda (un.)", largura: 15, tipo: "brl" },
  { titulo: "Montante de custo", largura: 16, tipo: "brl", soma: true },
  { titulo: "Montante de venda", largura: 16, tipo: "brl", soma: true },
  { titulo: "Imposto", largura: 13, tipo: "brl", soma: true },
  { titulo: "Comissão", largura: 13, tipo: "brl", soma: true },
  { titulo: "Tx cartão", largura: 13, tipo: "brl", soma: true },
  { titulo: "Frete (CIF/FOB)", largura: 10, tipo: "texto" },
  { titulo: "Valor do frete", largura: 13, tipo: "brl", soma: true },
  { titulo: "Tx lucro (R$/un.)", largura: 15, tipo: "brl" },
  { titulo: "Tx lucro (%)", largura: 11, tipo: "pct" },
  { titulo: "Montante do lucro (R$)", largura: 17, tipo: "brl", soma: true },
  { titulo: "Montante do lucro (%)", largura: 13, tipo: "pct" },
  { titulo: "Origem do custo", largura: 20, tipo: "texto" },
];

const COLS_PEDIDOS: Coluna[] = [
  { titulo: "Data da venda", largura: 12, tipo: "data" },
  { titulo: "Nº pedido", largura: 11, tipo: "texto" },
  { titulo: "Cliente", largura: 32, tipo: "texto" },
  { titulo: "Contato", largura: 22, tipo: "texto" },
  { titulo: "Telefone do contato", largura: 18, tipo: "texto" },
  { titulo: "Endereço", largura: 48, tipo: "texto" },
  { titulo: "UF", largura: 5, tipo: "texto" },
  { titulo: "Status da venda", largura: 22, tipo: "texto" },
  { titulo: "Vendedor", largura: 18, tipo: "texto" },
  { titulo: "Tipo de pagamento", largura: 20, tipo: "texto" },
  { titulo: "Quantidade", largura: 11, tipo: "qtd", soma: true },
  { titulo: "Produtos", largura: 50, tipo: "texto" },
  { titulo: "Montante de custo", largura: 16, tipo: "brl", soma: true },
  { titulo: "Montante de venda", largura: 16, tipo: "brl", soma: true },
  { titulo: "Imposto", largura: 13, tipo: "brl", soma: true },
  { titulo: "Comissão (%)", largura: 11, tipo: "pct" },
  { titulo: "Comissão", largura: 13, tipo: "brl", soma: true },
  { titulo: "Tx cartão (%)", largura: 11, tipo: "pct" },
  { titulo: "Tx cartão", largura: 13, tipo: "brl", soma: true },
  { titulo: "Frete (CIF/FOB)", largura: 10, tipo: "texto" },
  { titulo: "Valor do frete", largura: 13, tipo: "brl", soma: true },
  { titulo: "Total do pedido", largura: 16, tipo: "brl", soma: true },
  { titulo: "Montante do lucro (R$)", largura: 17, tipo: "brl", soma: true },
  { titulo: "Montante do lucro (%)", largura: 13, tipo: "pct" },
  { titulo: "Recebido", largura: 14, tipo: "brl", soma: true },
  { titulo: "A receber", largura: 14, tipo: "brl", soma: true },
];

type Celula = string | number | Date | null;

function linhasItens(pedidos: LinhaPedido[]): Celula[][] {
  const out: Celula[][] = [];
  for (const l of pedidos) {
    const p = l.p;
    const cab: Celula[] = [
      dataExcel(p.created_at), String(p.numero), l.clienteNome, l.contatoNome, l.contatoTelefone,
      l.endereco, l.uf, l.statusNome, l.vendedorNome, l.pagamentoNome,
    ];
    const valorFrete = p.frete_tipo === "FOB" ? l.fob : l.frete;
    const freteTipo = p.frete_tipo === "CIF" || p.frete_tipo === "FOB" ? p.frete_tipo : "";
    const n = l.produtos.length;
    if (n === 0) {
      out.push([
        ...cab, 0, "(pedido sem produtos)", "", 0, 0, 0, 0,
        arred(l.imposto), arred(l.comissao), arred(l.taxa), freteTipo, arred(valorFrete),
        0, null, arred(l.lucroLiquido), null, "",
      ]);
      continue;
    }
    for (const x of l.produtos) {
      // Rateio pelo valor de venda do item (pedido zerado: partes iguais).
      const parte = l.bruto > 0 ? x.pv / l.bruto : 1 / n;
      const custoUn = x.custoUnit + x.persUnit;
      const imposto = l.imposto * parte;
      const comissao = l.comissao * parte;
      const taxa = l.taxa * parte;
      const frete = valorFrete * parte;
      // Frete FOB é do cliente: aparece, mas não sai do lucro.
      const freteCusto = l.frete * parte;
      const lucro = x.pv - x.custo - imposto - comissao - taxa - freteCusto;
      const lucroUn = x.pvUnit - custoUn;
      out.push([
        ...cab,
        x.qtd, x.nome,
        resumoPersonalizacao({ personalizacao: x.personalizacao, aplicacoes: x.aplicacoes }),
        arred(custoUn, 4), arred(x.pvUnit, 4), arred(x.custo), arred(x.pv),
        arred(imposto), arred(comissao), arred(taxa), freteTipo, arred(frete),
        arred(lucroUn, 4), x.pvUnit > 0 ? lucroUn / x.pvUnit : null,
        arred(lucro), x.pv > 0 ? lucro / x.pv : null,
        ORIGEM_CUSTO[x.origemCusto],
      ]);
    }
  }
  return out;
}

function linhasPedidos(pedidos: LinhaPedido[]): Celula[][] {
  return pedidos.map(l => {
    const p = l.p;
    const qtd = l.produtos.reduce((s, x) => s + x.qtd, 0);
    const custo = l.custoProduto + l.custoPers;
    return [
      dataExcel(p.created_at), String(p.numero), l.clienteNome, l.contatoNome, l.contatoTelefone,
      l.endereco, l.uf, l.statusNome, l.vendedorNome, l.pagamentoNome,
      qtd, l.produtos.map(x => `${x.qtd}× ${x.nome}`).join("; "),
      arred(custo), arred(l.bruto), arred(l.imposto),
      l.comissaoPct / 100, arred(l.comissao), l.taxaPct / 100, arred(l.taxa),
      p.frete_tipo === "CIF" || p.frete_tipo === "FOB" ? p.frete_tipo : "",
      arred(p.frete_tipo === "FOB" ? l.fob : l.frete),
      arred(l.total), arred(l.lucroLiquido), l.bruto > 0 ? l.lucroLiquido / l.bruto : null,
      arred(l.recebido), arred(l.aReceber),
    ];
  });
}

const letra = (i: number) => {
  let s = ""; let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarPlanilha(wb: any, nome: string, titulo: string, cols: Coluna[], linhas: Celula[][], totalLucroPct?: { lucro: number; venda: number; destino: number }) {
  const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = cols.map(c => ({ width: c.largura }));

  ws.getCell("A1").value = titulo;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: AZUL } };
  ws.getCell("A2").value = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  const cab = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.titulo;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  cab.height = 32;

  linhas.forEach((valores, r) => {
    const row = ws.getRow(4 + r);
    valores.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      const t = cols[i].tipo;
      if (t === "brl") cell.numFmt = FMT_BRL;
      else if (t === "pct") cell.numFmt = FMT_PCT;
      else if (t === "data") cell.numFmt = FMT_DATA;
      else if (t === "qtd") cell.numFmt = FMT_QTD;
    });
  });

  const ultima = 3 + linhas.length;
  if (linhas.length > 0) {
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: ultima, column: cols.length } };
    const tot = ws.getRow(ultima + 1);
    tot.getCell(1).value = "TOTAL";
    cols.forEach((c, i) => {
      const cell = tot.getCell(i + 1);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      if (!c.soma) return;
      const L = letra(i);
      // SUBTOTAL(109) respeita o filtro: total do que está visível.
      cell.value = { formula: `SUBTOTAL(109,${L}4:${L}${ultima})` };
      cell.numFmt = c.tipo === "qtd" ? FMT_QTD : FMT_BRL;
    });
    if (totalLucroPct) {
      const Ll = letra(totalLucroPct.lucro); const Lv = letra(totalLucroPct.venda);
      const cell = tot.getCell(totalLucroPct.destino + 1);
      cell.value = { formula: `IFERROR(${Ll}${ultima + 1}/${Lv}${ultima + 1},0)` };
      cell.numFmt = FMT_PCT;
    }
  }
  return ws;
}

const idx = (cols: Coluna[], titulo: string) => cols.findIndex(c => c.titulo === titulo);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarLegenda(wb: any, f: FiltroRelatorio) {
  const ws = wb.addWorksheet("Como ler");
  ws.columns = [{ width: 26 }, { width: 110 }];
  const fmt = (ymd: string) => dataLocal(ymd).toLocaleDateString("pt-BR");
  const linhas: [string, string][] = [
    ["Período", `${fmt(f.inicio)} a ${fmt(f.fim)} (data de lançamento do pedido)`],
    ["Cancelados", f.incluirCancelados ? "Incluídos (sem comissão)" : "Fora do relatório"],
    ["", ""],
    ["Aba Itens", "Uma linha por produto. Imposto, comissão, taxa de cartão e frete são do pedido inteiro e aparecem rateados pelos itens na proporção do valor de venda de cada um — a soma das linhas fecha com o pedido."],
    ["Aba Pedidos", "Uma linha por pedido, com os valores cheios."],
    ["", ""],
    ["Valor de custo (un.)", "Custo do produto + custo da personalização, por unidade. Custo do produto: o digitado no Dashboard > preço lançado em Compras > custo do catálogo."],
    ["Montante de custo", "Quantidade × valor de custo (un.)."],
    ["Montante de venda", "Quantidade × valor de venda (un.). Sem frete."],
    ["Imposto", "% de imposto da configuração do financeiro sobre o total do pedido."],
    ["Tx cartão", "% da forma de pagamento (ou a digitada no Dashboard) sobre o total do pedido."],
    ["Comissão", "Faixa escalonada do vendedor no mês × (venda sem frete − imposto − tx cartão)."],
    ["Frete", "CIF: pago pela empresa, desconta do lucro. FOB: pago pelo cliente, só para conferência (não entra no lucro)."],
    ["Tx lucro (R$/un.)", "Lucro bruto por unidade: valor de venda (un.) − valor de custo (un.). % sobre o valor de venda."],
    ["Montante do lucro", "Montante de venda − montante de custo − imposto − comissão − tx cartão − frete CIF. % sobre o montante de venda. É o lucro líquido do Dashboard."],
    ["Origem do custo", "\"Sem custo\" ou \"Compra sem preço\": o produto entrou com custo zero e o lucro está superestimado."],
  ];
  linhas.forEach(([a, b], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = a; row.getCell(1).font = { bold: true };
    row.getCell(2).value = b; row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });
}

/** Gera e baixa o .xlsx. Devolve as linhas usadas (para o resumo da tela). */
export async function exportarRelatorioGeral(f: FiltroRelatorio): Promise<LinhaPedido[]> {
  const [pedidos, mod] = await Promise.all([carregarRelatorioGeral(f), import("exceljs")]);
  const ExcelJS = (mod as { default?: unknown }).default ?? mod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = new (ExcelJS as any).Workbook();
  wb.creator = "GiftWeb";
  wb.created = new Date();

  const fmt = (ymd: string) => dataLocal(ymd).toLocaleDateString("pt-BR");
  const titulo = `Relatório geral de pedidos — ${fmt(f.inicio)} a ${fmt(f.fim)}`;

  montarPlanilha(wb, "Itens", titulo, COLS_ITENS, linhasItens(pedidos), {
    lucro: idx(COLS_ITENS, "Montante do lucro (R$)"),
    venda: idx(COLS_ITENS, "Montante de venda"),
    destino: idx(COLS_ITENS, "Montante do lucro (%)"),
  });
  montarPlanilha(wb, "Pedidos", titulo, COLS_PEDIDOS, linhasPedidos(pedidos), {
    lucro: idx(COLS_PEDIDOS, "Montante do lucro (R$)"),
    venda: idx(COLS_PEDIDOS, "Montante de venda"),
    destino: idx(COLS_PEDIDOS, "Montante do lucro (%)"),
  });
  montarLegenda(wb, f);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-pedidos_${f.inicio}_a_${f.fim}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return pedidos;
}
