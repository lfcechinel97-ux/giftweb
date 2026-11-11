import { describe, expect, it } from "vitest";
import { calcularVolumes, type ParamsCalculo } from "./calculo";
import { classificarLinhaMaster, configsMaster } from "./caixaMaster";
import { agruparErros, amostraDe, calibrar, confiancaCalibrado, errosDoDespacho, palavraChave, type Despacho } from "./calibracao";
import { lerCsv, lerData, modeloCsv, montarDespachos } from "./importarHistorico";
import { encaixar, formaParaDesenho, type Posicao } from "./empacotamento";
import { resolverMedida, type ProdutoApi } from "./fontes";
import { ehDobravel, medida, normalizarReferencia } from "./regras";
import { resumoTexto } from "./resumo";

const FATORES = { aproveitamentoApi: 0.85, aproveitamentoMaster: 0.9 };
const PARAMS: ParamsCalculo = { caixa: { largura: 60, altura: 40, comprimento: 40 }, pesoMaxKg: 25, taraKg: 0, fatorCubagem: 300 };

const produto = (p: Partial<ProdutoApi> = {}): ProdutoApi => ({
  codigo: "P1", nome: "PRODUTO TESTE", pesoG: null, altura: null, largura: null, profundidade: null, ...p,
});
const masterOk = (L: number, A: number, C: number, q: number) =>
  ({ codigo_composto: "P1-AZU", largura_cm: L, altura_cm: A, comprimento_cm: C, qtd_por_caixa: q, status_revisao: "ok" as const });

const item = (id: string, qtd: number, m: ReturnType<typeof resolverMedida>) => ({ id, rotulo: id, qtd, medida: m });
const qtds = (r: ReturnType<typeof calcularVolumes>) => r.volumes.map((v) => v.conteudo.reduce((s, c) => s + c.qtd, 0));

describe("caixa master", () => {
  it("50 un em 38×48×38 → 1.386,24 cm³/un, 62 un/volume, 100 un = 2 volumes (62 + 38)", () => {
    const m = resolverMedida({ produto: produto({ pesoG: 100 }), fatores: FATORES, configsMaster: configsMaster([masterOk(38, 48, 38, 50)]) });
    expect(m.fonte).toBe("master");
    expect(m.volEfetivoUn).toBeCloseTo(1386.24, 6);
    const r = calcularVolumes([item("A", 100, m)], PARAMS);
    expect(qtds(r)).toEqual([62, 38]);
    expect(calcularVolumes([item("A", 62, m)], PARAMS).volumes).toHaveLength(1);
    expect(calcularVolumes([item("A", 63, m)], PARAMS).volumes).toHaveLength(2);
  });

  it("IDs repetidos: usa a mediana do volume por unidade e o vendedor pode escolher outra", () => {
    const configs = configsMaster([masterOk(38.5, 28, 76.5, 50), masterOk(42, 39.5, 55, 50), masterOk(42, 39.5, 55, 50)]);
    expect(configs).toHaveLength(2);
    const m = resolverMedida({ produto: produto(), fatores: FATORES, configsMaster: configs });
    expect(m.volEfetivoUn).toBeCloseTo((38.5 * 28 * 76.5 / 50 + 42 * 39.5 * 55 / 50) / 2, 6);
    const escolhida = resolverMedida({ produto: produto(), fatores: FATORES, configsMaster: configs, masterEscolhida: configs[1].chave });
    expect(escolhida.volEfetivoUn).toBeCloseTo(configs[1].volUn, 6);
  });

  it("planilha: erros de digitação viram 'revisar' e não entram no cálculo; fora da API vira 'inativo'", () => {
    const existe = (c: string) => c === "10078-AZU";
    const base = { codigo_xbz: "X1", referencia: "#10078#-AZU", descricao: "GARRAFA", qtd_por_caixa: 50, largura_cm: 38, altura_cm: 48, comprimento_cm: 38 };
    expect(classificarLinhaMaster(base, existe)).toMatchObject({ status_revisao: "ok", codigo_composto: "10078-AZU" });
    expect(classificarLinhaMaster({ ...base, largura_cm: 0 }, existe).status_revisao).toBe("revisar");
    expect(classificarLinhaMaster({ ...base, comprimento_cm: 6735 }, existe).status_revisao).toBe("revisar");
    expect(classificarLinhaMaster({ ...base, qtd_por_caixa: 120000 }, existe).status_revisao).toBe("revisar");
    expect(classificarLinhaMaster({ ...base, largura_cm: 1, altura_cm: 1, comprimento_cm: 1, qtd_por_caixa: 5 }, existe).status_revisao).toBe("revisar");
    expect(classificarLinhaMaster({ ...base, referencia: "#99999#-AZU" }, existe).status_revisao).toBe("inativo");
    const revisar = classificarLinhaMaster({ ...base, altura_cm: 736 }, existe);
    expect(configsMaster([revisar])).toHaveLength(0);
    expect(normalizarReferencia("#10078#-AZU")).toBe("10078-AZU");
  });
});

describe("dimensões da API", () => {
  it("10×10×10, 100 g, fator 0,85 → 81 un/volume; 500 un = 7 volumes (6×81 + 14)", () => {
    const m = resolverMedida({ produto: produto({ altura: 10, largura: 10, profundidade: 10, pesoG: 100 }), fatores: FATORES });
    expect(m.fonte).toBe("api");
    const r = calcularVolumes([item("A", 500, m)], PARAMS);
    expect(qtds(r)).toEqual([81, 81, 81, 81, 81, 81, 14]);
  });

  it("limite de peso: 1.000 un de 600 g com 25 kg → 41 un/volume, 25 volumes", () => {
    const m = resolverMedida({ produto: produto({ altura: 1, largura: 1, profundidade: 1, pesoG: 600 }), fatores: FATORES });
    const r = calcularVolumes([item("A", 1000, m)], PARAMS);
    expect(r.volumes).toHaveLength(25);
    expect(Math.max(...qtds(r))).toBe(41);
    expect(qtds(r).slice(0, 24).every((q) => q === 41)).toBe(true);
  });

  it("item 70×10×10 não cabe em 60×40×40", () => {
    const m = resolverMedida({ produto: produto({ altura: 70, largura: 10, profundidade: 10, pesoG: 100 }), fatores: FATORES });
    const r = calcularVolumes([item("A", 1, m)], PARAMS);
    expect(r.volumes).toHaveLength(0);
    expect(r.erros[0].texto).toMatch(/não cabe/);
  });

  it("zero = ausente: Altura 0.00 não é medida; cai para a master ou pede preenchimento", () => {
    expect(medida("0.00")).toBeNull();
    expect(medida(0)).toBeNull();
    const semNada = resolverMedida({ produto: produto({ altura: 0, largura: 10, profundidade: 10, pesoG: 0 }), fatores: FATORES });
    expect(semNada.fonte).toBeNull();
    expect(semNada.pesoG).toBeNull();
    expect(semNada.alertas.map((a) => a.codigo)).toContain("sem_medida");
    const r = calcularVolumes([item("A", 10, semNada)], PARAMS);
    expect(r.pendentes).toEqual(["A"]);
    expect(r.volumes).toHaveLength(0);
    const comMaster = resolverMedida({
      produto: produto({ altura: 0, largura: 10, profundidade: 10 }), fatores: FATORES, configsMaster: configsMaster([masterOk(38, 48, 38, 50)]),
    });
    expect(comMaster.fonte).toBe("master");
  });

  it("mistura: 20 + 50 un de dois SKUs pequenos dividem o mesmo volume", () => {
    const a = resolverMedida({ produto: produto({ altura: 10, largura: 8, profundidade: 8, pesoG: 300 }), fatores: FATORES });
    const b = resolverMedida({ produto: produto({ altura: 14, largura: 1, profundidade: 1, pesoG: 10 }), fatores: FATORES });
    const r = calcularVolumes([item("copo", 20, a), item("caneta", 50, b)], PARAMS);
    expect(r.volumes).toHaveLength(1);
    expect(r.volumes[0].conteudo).toEqual([{ id: "copo", rotulo: "copo", qtd: 20 }, { id: "caneta", rotulo: "caneta", qtd: 50 }]);
    expect(r.volumes[0].pesoRealKg).toBeCloseTo(6.5, 6);
  });

  it("cilíndrico sem profundidade: assume profundidade = diâmetro; outros pedem a profundidade", () => {
    const caneta = resolverMedida({ produto: produto({ nome: "CANETA RECICLAVEL", altura: 13.7, largura: 3 }), fatores: FATORES });
    expect(caneta.fonte).toBe("api");
    expect(caneta.volEfetivoUn).toBeCloseTo(13.7 * 3 * 3, 6);
    expect(caneta.alertas.map((a) => a.codigo)).toContain("profundidade_assumida");
    const bloco = resolverMedida({ produto: produto({ nome: "BLOCO DE NOTAS", altura: 13.7, largura: 3 }), fatores: FATORES });
    expect(bloco.fonte).toBeNull();
    expect(bloco.alertas.map((a) => a.codigo)).toContain("falta_profundidade");
  });

  it("dobrável: alerta só com fonte API; fator de compressão reduz o volume", () => {
    expect(ehDobravel("Mochila de nylon")).toBe(true);
    expect(ehDobravel("CAPACIDADE 500ML")).toBe(false);
    const mochila = produto({ nome: "MOCHILA EXECUTIVA", altura: 40, largura: 30, profundidade: 10 });
    expect(resolverMedida({ produto: mochila, fatores: FATORES }).alertas.map((a) => a.codigo)).toContain("dobravel");
    const comprimida = resolverMedida({ produto: mochila, fatores: FATORES, manual: { fatorCompressao: 0.4 } });
    expect(comprimida.volEfetivoUn).toBeCloseTo(40 * 30 * 10 * 0.4, 6);
    expect(comprimida.alertas.map((a) => a.codigo)).not.toContain("dobravel");
    const comMaster = resolverMedida({ produto: mochila, fatores: FATORES, configsMaster: configsMaster([masterOk(50, 40, 40, 20)]) });
    expect(comMaster.fonte).toBe("master");
    expect(comMaster.alertas.map((a) => a.codigo)).not.toContain("dobravel");
  });

  it("prioridade: manual > calibrado > override > master > API; calibrado não aplica aproveitamento", () => {
    const p = produto({ altura: 10, largura: 10, profundidade: 10, pesoG: 100 });
    const configs = configsMaster([masterOk(38, 48, 38, 50)]);
    const ov = { altura_cm: 5, largura_cm: 5, profundidade_cm: 5, peso_g: 50, fator_compressao: null, vol_efetivo_un_cm3: null };
    expect(resolverMedida({ produto: p, fatores: FATORES, configsMaster: configs, override: ov }).fonte).toBe("override");
    const cal = resolverMedida({ produto: p, fatores: FATORES, configsMaster: configs, override: ov, calibrado: { volUn: 1200, pesoUnG: 110, n: 4 } });
    expect(cal).toMatchObject({ fonte: "calibrado", volEquivalente: 1200, confianca: "media", fontePeso: "override" });
    const man = resolverMedida({ produto: p, fatores: FATORES, calibrado: { volUn: 1200, pesoUnG: 110, n: 12 }, manual: { altura: 2, largura: 2, profundidade: 2 } });
    expect(man.fonte).toBe("manual");
  });
});

describe("resultado", () => {
  it("último volume parcial: sugere altura reduzida de 5 em 5 cm e monta o resumo", () => {
    const m = resolverMedida({ produto: produto({ pesoG: 100 }), fatores: FATORES, configsMaster: configsMaster([masterOk(38, 48, 38, 50)]) });
    const r = calcularVolumes([item("A", 100, m)], PARAMS);
    const ultimo = r.volumes[1];
    // 38 un × 1.540,27 cm³ = 58.530 / 96.000 = 61% → 40 × 0,61 = 24,4 → 25 cm
    expect(ultimo.sugestao?.caixa).toEqual({ largura: 60, altura: 25, comprimento: 40 });
    expect(r.volumes[0].pesoCubadoKg).toBeCloseTo(28.8, 6);
    expect(resumoTexto(r, PARAMS.caixa)).toContain("2 volumes de 60×40×40 cm: 1 cheio (6,2 kg) + 1 parcial 60×40×25 (3,8 kg).");
  });
});

describe("encaixe 3D (ilustrativo)", () => {
  const caixa = { largura: 60, altura: 40, comprimento: 40 };
  const semSobreposicao = (ps: Posicao[]) =>
    ps.every((a, i) => ps.slice(i + 1).every((b) =>
      a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6 || a.z + a.d <= b.z + 1e-6 || b.z + b.d <= a.z + 1e-6));
  const dentro = (ps: Posicao[]) => ps.every((p) => p.x + p.w <= 60 + 1e-6 && p.y + p.h <= 40 + 1e-6 && p.z + p.d <= 40 + 1e-6);

  it("cubos de 10 cm: 96 cabem; 81 pedidos entram todos", () => {
    expect(encaixar([{ id: "a", qtd: 200, dims: [10, 10, 10] }], caixa).colocadas).toBe(96);
    const r = encaixar([{ id: "a", qtd: 81, dims: [10, 10, 10] }], caixa);
    expect(r.colocadas).toBe(81);
    expect(semSobreposicao(r.porItem.get("a")!)).toBe(true);
  });

  it("testa orientações e mistura SKUs sem sobrepor nem sair da caixa", () => {
    const r = encaixar([{ id: "copo", qtd: 20, dims: [8, 10, 8] }, { id: "caneta", qtd: 50, dims: [1, 14, 1] }, { id: "livro", qtd: 4, dims: [35, 3, 25] }], caixa);
    expect(r.colocadas).toBe(74);
    const todas = [...r.porItem.values()].flat();
    expect(semSobreposicao(todas)).toBe(true);
    expect(dentro(todas)).toBe(true);
  });

  it("item que não cabe não é posicionado; 1.000+ unidades rodam rápido", () => {
    expect(encaixar([{ id: "a", qtd: 1, dims: [70, 10, 10] }], caixa).colocadas).toBe(0);
    const t = performance.now();
    const r = encaixar([{ id: "a", qtd: 5000, dims: [2, 2, 2] }], caixa);
    expect(r.colocadas).toBe(5000);
    expect(performance.now() - t).toBeLessThan(200);
  });

  it("só caixa master: forma aproximada com o volume efetivo e as proporções da master", () => {
    const m = resolverMedida({ produto: produto(), fatores: FATORES, configsMaster: configsMaster([masterOk(38, 48, 38, 50)]) });
    const f = formaParaDesenho(m)!;
    expect(f.aproximada).toBe(true);
    expect(f.dims[0] * f.dims[1] * f.dims[2]).toBeCloseTo(1386.24, 3);
    expect(f.dims[1] / f.dims[0]).toBeCloseTo(48 / 38, 6);
  });
});

describe("calibração", () => {
  const desp = (id: number, data: string, itens: [string, number][], peso: number, ocup = 100, status: Despacho["status"] = "validado"): Despacho => ({
    id, data, referencia_pedido: null, caixa_larg_cm: 60, caixa_alt_cm: 40, caixa_comp_cm: 40, ocupacao_pct: ocup, peso_real_kg: peso,
    status, observacao: null, estimativa: null, criado_por_nome: null, criado_em: data, validado_por_nome: null, validado_em: null,
    itens: itens.map(([c, q]) => ({ codigo_amigavel: c, qtd: q })),
  });

  it("1 SKU: vol_un = vol_caixa × ocupação ÷ qtd e peso_un = (peso − tara) ÷ qtd", () => {
    const a = amostraDe(desp(1, "2026-10-01", [["A", 50]], 18.5, 75), 0.5)!;
    expect(a.volUn).toBeCloseTo((96000 * 0.75) / 50, 6);
    expect(a.pesoUnG).toBeCloseTo(360, 6);
    expect(amostraDe(desp(2, "2026-10-01", [["A", 10], ["B", 10]], 5), 0)).toBeNull();
    expect(amostraDe(desp(3, "2026-10-01", [["A", 10], ["A", 10]], 5), 0)!.volUn).toBeCloseTo(4800, 6);
  });

  it("mediana das últimas 10 validadas, fora da curva (> 50%) sai, n define a confiança", () => {
    const lista = [
      ...Array.from({ length: 12 }, (_, i) => desp(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}`, [["A", 100]], 10)),
      desp(50, "2026-10-20", [["A", 30]], 10), // 3.200 cm³/un: foge > 50% de 960
      desp(51, "2026-10-21", [["A", 1]], 10, 100, "pendente"),
      desp(52, "2026-10-22", [["A", 1]], 10, 100, "descartado"),
      desp(53, "2026-10-23", [["A", 50], ["B", 50]], 10),
    ];
    const c = calibrar(lista, 0).get("A")!;
    expect(c.volUn).toBeCloseTo(960, 6);
    expect(c.pesoUnG).toBeCloseTo(100, 6);
    expect(c.foraDaCurva).toEqual([50]);
    expect(c.n).toBe(9); // as 10 mais recentes, menos a fora da curva
    expect(confiancaCalibrado(c.n)).toBe("media");
    expect(confiancaCalibrado(2)).toBe("baixa");
    expect(confiancaCalibrado(10)).toBe("alta");
    expect(calibrar(lista, 0).has("B")).toBe(false);
  });

  it("erro do modelo: estimado x real e agrupamento por palavra-chave", () => {
    const d = { ...desp(1, "2026-10-01", [["A", 50]], 20, 80), estimativa: { ocupacao: 1, pesoKg: 18, volumes: 1, fontes: {}, completa: true } };
    expect(errosDoDespacho(d)).toEqual({ id: 1, volume: expect.closeTo(0.25, 6), peso: expect.closeTo(-0.1, 6) });
    expect(palavraChave("Caneta metálica")).toBe("CANETA");
    const g = agruparErros([d, { ...d, id: 2 }], () => "CANETA");
    expect(g[0]).toMatchObject({ chave: "CANETA", n: 2 });
    expect(g[0].volAbsMedio).toBeCloseTo(0.25, 6);
  });

  it("importação em lote: agrupa por DESPACHO, aceita ; e vírgula decimal, aponta erros", () => {
    const linhas = lerCsv(modeloCsv() + "3;xx;;60;40;40;5;100;99999;1;\n");
    const r = montarDespachos(linhas, (c) => (c === "99999" ? null : { codigo_amigavel: c.split("-")[0], codigo_composto: c.includes("-") ? c : null }));
    expect(r.despachos).toHaveLength(2);
    expect(r.despachos[0]).toMatchObject({ data: "2026-10-15", peso_real_kg: 18.4, ocupacao_pct: 100, referencia_pedido: "PED-1234" });
    expect(r.despachos[1].itens).toEqual([
      { codigo_amigavel: "00001", codigo_composto: null, qtd: 500 },
      { codigo_amigavel: "10078", codigo_composto: "10078-AZU", qtd: 20 },
    ]);
    expect(r.erros).toEqual(['Linha 5: código "99999" não encontrado.']);
    expect(lerData("2026-01-05")).toBe("2026-01-05");
    expect(lerData("46000")).toBe("2025-12-09");
  });
});
