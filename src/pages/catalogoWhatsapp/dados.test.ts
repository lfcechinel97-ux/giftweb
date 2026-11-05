import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ajustarNome, derivarRecursos, extrairLitragem, iconeDoCard, lerCodigos, limparDescricao, outrasCores, paraCatalogo } from "./dados";
import { P, renderPaginas, CONFIG_PADRAO, trunc } from "./template";

const base = { nome: "", descricao: "", altura: null, largura: null, profundidade: null };

describe("catálogo WhatsApp - dados", () => {
  it("lê códigos colados em qualquer separador, sem repetir, na ordem", () => {
    expect(lerCodigos("11329-vm\n02066-PRE, 01326;18539 11329-VM")).toEqual(["11329-VM", "02066-PRE", "01326", "18539"]);
  });

  it("extrai litragem do nome ou da descrição", () => {
    expect(extrairLitragem("Mochila de Nylon USB 17L")).toBe("17L");
    expect(extrairLitragem("Garrafa", "Capacidade 1.2 litros")).toBe("1,2L");
    expect(extrairLitragem("Copo 500 ml")).toBe("500ML");
    expect(extrairLitragem("Caneta metálica", "Escrita em 2 lados")).toBe("");
  });

  it("limpa HTML da descrição e trunca em ~240 caracteres sem cortar palavra nem deixar pontuação", () => {
    expect(limparDescricao("<p>Mochila&nbsp;em<br>nylon</p>")).toBe("Mochila em nylon");
    const t = trunc("palavra ".repeat(60).trim());
    expect(t.length).toBeLessThanOrEqual(241);
    expect(t.endsWith("palavra…")).toBe(true);
    expect(trunc("bolsos, ".repeat(40))).toMatch(/bolsos…$/);
  });

  it("deriva até 4 recursos com ícones existentes no dicionário", () => {
    const r = derivarRecursos({
      ...base,
      nome: "Mochila de Nylon USB 17L",
      descricao:
        "Mochila em nylon impermeável com compartimento para notebook até 15,6\", entrada USB, alças acolchoadas e fita para mala.",
    });
    expect(r).toHaveLength(4);
    expect(r[0]).toEqual({ i: "notebook", t: "Notebook até 15,6”" });
    expect(r.map((x) => x.i)).toEqual(["notebook", "usb", "agua", "mala"]);
    for (const x of r) expect(P[x.i]).toBeTruthy();
  });

  it("completa com medidas da ficha técnica quando a descrição é curta", () => {
    const r = derivarRecursos({ ...base, nome: "Mochila", descricao: "Mochila dobrável.", altura: 45, largura: 30, profundidade: 12.5 });
    expect(r).toEqual([{ i: "dobra", t: "Dobrável e compacta" }, { i: "regua", t: "45 x 30 x 12,5 cm" }]);
    expect(iconeDoCard("Mochila", r)).toBe("dobra");
  });

  it("converte nome em caixa alta para título", () => {
    expect(ajustarNome("MOCHILA DE NYLON USB 17L")).toBe("Mochila de Nylon USB 17L");
    expect(ajustarNome("Mochila Nylon Poliéster 30L")).toBe("Mochila Nylon Poliéster 30L");
  });

  it("preços vêm da API nas faixas 20/50/100 e sem preço vira consulte", () => {
    const row = {
      codigo_amigavel: "11329-VM", nome: "Mochila USB 17L", descricao: "x", image_url: null,
      altura: null, largura: null, profundidade: null,
      preco_base: 120, preco_faixas: [{ qty: 20, unit: 110, desc: 0 }, { qty: 50, unit: 104.5, desc: 0 }, { qty: 100, unit: 98.9, desc: 0 }],
    } as never;
    expect(paraCatalogo(row).precos).toEqual([110, 104.5, 98.9]);
    const semPreco = paraCatalogo({ ...(row as object), preco_base: null } as never);
    expect(semPreco.precos).toEqual([null, null, null]);
    expect(renderPaginas([semPreco], CONFIG_PADRAO)).toContain("consulte");
  });

  it("página incompleta mantém a grade 2x2 e escapa texto da API", () => {
    const p = { codigo: "1", nome: "<b>x</b>", litros: "", icone: "usb", foto: "", desc: "d", recursos: [], precos: [1, 2, 3] };
    const html = renderPaginas([p, p, p, p, p], CONFIG_PADRAO);
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html.match(/class="card apoio"/g)).toHaveLength(3);
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain('class="lt"');
  });
});

describe("catálogo WhatsApp - outras cores", () => {
  const row = (codigo: string, cor: string, extra: Record<string, unknown> = {}) =>
    ({ codigo_amigavel: codigo, codigo_prefixo: "01320", cor, image_url: `https://x/${codigo}.jpg`, ativo: true, is_hidden: false, estoque_total: 10, ...extra }) as never;

  it("lista as outras cores, sem a principal, inativas, sem foto ou repetidas", () => {
    const principal = row("01320-VM", "Vermelho");
    const grupo = [
      principal,
      row("01320-PRE", "Preto", { estoque_total: 50 }),
      row("01320-AZ", "Azul"),
      row("01320-AZ2", "azul"),
      row("01320-CZ", "Cinza", { ativo: false }),
      row("01320-BR", "Branco", { image_url: null }),
    ];
    expect(outrasCores(principal, grupo).map((c) => c.codigo)).toEqual(["01320-PRE", "01320-AZ"]);
  });

  it("card só mostra o bloco CORES quando há cores", () => {
    const p = { ...paraCatalogo({ ...base, codigo_amigavel: "01320", nome: "Mochila", image_url: null } as never) };
    expect(renderPaginas([p], CONFIG_PADRAO)).not.toContain('class="cores"');
    const html = renderPaginas([{ ...p, cores: [{ codigo: "01320-PRE", cor: "Preto", foto: "f.jpg" }] }], CONFIG_PADRAO);
    expect(html).toContain("CORES:");
    expect(html).toContain('title="Preto (clique para remover)"');
  });
});
