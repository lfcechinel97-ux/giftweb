import { describe, expect, it, vi, beforeEach } from "vitest";

/* Banco falso: cada tabela devolve as linhas abaixo, ignorando filtros
   (o que interessa aqui é o cálculo e a planilha, não a consulta). */
const tabelas: Record<string, unknown[]> = {};
function consulta(tabela: string) {
  const res = { data: tabelas[tabela] ?? [], error: null };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "gte", "lt", "neq", "order", "range", "in", "limit", "eq"]) q[m] = () => q;
  q.then = (ok: (r: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, erro);
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => consulta(t) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import ExcelJS from "exceljs";
import { exportarRelatorioGeral } from "./relatorioGeralPedidos";

describe("relatório geral de pedidos", () => {
  let blob: Blob | null = null;
  beforeEach(() => {
    blob = null;
    URL.createObjectURL = vi.fn((b: Blob) => { blob = b; return "blob:x"; });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
    tabelas.sistema_pedidos = [{
      id: "p1", numero: "1001", created_at: new Date(2026, 10, 3, 22, 30).toISOString(), status: "a_produzir",
      total: 1100, subtotal: 1000, frete_tipo: "CIF", frete_valor: 100, vendedor_id: "v1", pagamento_id: "m1",
      cliente_id: "c1", contato_nome: "Ana", contato_telefone: "(48) 99999-0000",
      cliente_snapshot: { nome: "ACME LTDA", endereco: { logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Floripa", uf: "sc", cep: "88000-000" } },
      itens: [
        { id: "i1", nome: "Caneca", quantidade: 10, precoUnitario: 60, precoCusto: 20, personalizacao: "laser", aplicacoes: 1 },
        { id: "i2", nome: "Squeeze", quantidade: 20, precoUnitario: 20, personalizacao: "dtf_uv", aplicacoes: 2 },
      ],
    }];
    tabelas.sistema_meios_pagamento = [{ id: "m1", nome: "Cartão 1x", taxa_pct: 0 }];
    tabelas.sistema_financeiro_config = [{ imposto_pct: 10 }];
    tabelas.sistema_vendedores = [{ id: "v1", nome: "Bruno" }];
    tabelas.sistema_clientes = [{ id: "c1", nome: "ACME LTDA", contatos: [], enderecos: [] }];
    tabelas.sistema_producao_itens = [{ id: "pr2", pedido_id: "p1", item_id: "i2", local_producao: "terceirizada", terceirizada_id: null, tags: [], status: null }];
  });

  it("gera itens rateados que fecham com o pedido", async () => {
    const linhas = await exportarRelatorioGeral({ inicio: "2026-11-01", fim: "2026-11-30" });
    expect(linhas).toHaveLength(1);
    const l = linhas[0];
    // imposto 10% de 1100; cartão 1x = 3,66% de 1100; frete CIF 100
    expect(l.imposto).toBeCloseTo(110);
    expect(l.taxa).toBeCloseTo(40.26);
    // custo: caneca 10×20 + squeeze 20×(0 + 3,50×2)
    expect(l.custoProduto + l.custoPers).toBeCloseTo(340);
    expect(l.comissaoPct).toBe(0); // base < 20 mil

    const wb = new ExcelJS.Workbook();
    const buf = await new Promise<ArrayBuffer>(ok => {
      const fr = new FileReader(); fr.onload = () => ok(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob!);
    });
    await wb.xlsx.load(buf);
    const itens = wb.getWorksheet("Itens")!;
    const cab = (itens.getRow(3).values as unknown[]).slice(1);
    const col = (t: string) => cab.indexOf(t) + 1;
    const r1 = itens.getRow(4); const r2 = itens.getRow(5);
    expect(r1.getCell(col("Produto")).value).toBe("Caneca");
    expect(r2.getCell(col("Produto")).value).toBe("Squeeze");
    expect(r1.getCell(col("UF")).value).toBe("SC");
    expect(r1.getCell(col("Tipo de pagamento")).value).toBe("Cartão 1x");
    expect(r1.getCell(col("Status da venda")).value).toBe("A produzir");
    // Data do pedido das 22h30 continua no dia 03
    expect((r1.getCell(col("Data da venda")).value as Date).toISOString().slice(0, 10)).toBe("2026-11-03");
    expect(r2.getCell(col("Valor de custo (un.)")).value).toBe(7);
    // Caneca = 60% do bruto
    expect(r1.getCell(col("Imposto")).value).toBe(66);
    expect(r1.getCell(col("Valor do frete")).value).toBe(60);
    const soma = (t: string) => Number(r1.getCell(col(t)).value) + Number(r2.getCell(col(t)).value);
    expect(soma("Montante do lucro (R$)")).toBeCloseTo(l.lucroLiquido, 1);
    expect(l.lucroLiquido).toBeCloseTo(1000 - 340 - 110 - 40.26 - 100);

    const ped = wb.getWorksheet("Pedidos")!;
    expect(ped.getRow(4).getCell(2).value).toBe("1001");
    expect(wb.getWorksheet("Como ler")).toBeTruthy();
  });
});
