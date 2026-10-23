import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ajustarNome, derivarRecursos, extrairLitragem, iconeDoCard, lerCodigos, limparDescricao, paraCatalogo } from "./dados";
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

  it("limpa HTML da descrição e trunca em ~120 caracteres sem cortar palavra", () => {
    expect(limparDescricao("<p>Mochila&nbsp;em<br>nylon</p>")).toBe("Mochila em nylon");
    const t = trunc("palavra ".repeat(30).trim());
    expect(t.length).toBeLessThanOrEqual(121);
    expect(t.endsWith("palavra…")).toBe(true);
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
