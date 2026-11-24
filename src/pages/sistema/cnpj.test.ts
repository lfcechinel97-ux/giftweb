import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCnpjCache, fetchCNPJ, isValidCNPJ, isValidCPF } from "./cnpj";

describe("validação de CNPJ e CPF", () => {
  it("valida CNPJ real e rejeita inválido ou repetido", () => {
    expect(isValidCNPJ("43.956.926/0001-68")).toBe(true);
    expect(isValidCNPJ("43956926000249")).toBe(true);
    expect(isValidCNPJ("43.956.926/0001-69")).toBe(false);
    expect(isValidCNPJ("00.000.000/0000-00")).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
  });

  it("valida CPF com dígitos verificadores corretos e rejeita inválidos", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-26")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123456")).toBe(false);
  });
});

describe("fetchCNPJ com fallback entre provedores", () => {
  afterEach(() => {
    clearCnpjCache();
    vi.restoreAllMocks();
  });

  it("retorna null sem chamar rede quando o CNPJ é inválido", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await fetchCNPJ("43.956.926/0001-00");
    expect(res).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("puxa dados completos (inclusive IE) do CNPJ.ws na primeira tentativa", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          razao_social: "COMERCIO DE UTILIDADES LUKATI LTDA",
          estabelecimento: {
            cnpj: "43956926000168",
            nome_fantasia: "LUKATI UTILIDADES",
            email: "contato@empresa.com.br",
            ddd1: "48",
            telefone1: "96265851",
            cep: "88820000",
            tipo_logradouro: "RUA",
            logradouro: "PROJETADA",
            numero: "224",
            complemento: null,
            bairro: "TEREZA CRISTINA",
            cidade: { nome: "Içara" },
            estado: { sigla: "SC" },
            inscricoes_estaduais: [{ inscricao_estadual: "261371622", ativo: true }],
          },
        }),
        { status: 200 },
      ),
    );

    const data = await fetchCNPJ("43.956.926/0001-68");
    expect(data).toMatchObject({
      razao_social: "COMERCIO DE UTILIDADES LUKATI LTDA",
      nome_fantasia: "LUKATI UTILIDADES",
      inscricao_estadual: "261371622",
      logradouro: "RUA PROJETADA",
      municipio: "Içara",
      uf: "SC",
      cep: "88820-000",
      ddd_telefone_1: "4896265851",
      email: "contato@empresa.com.br",
    });
  });

  it("cai para os próximos provedores quando os anteriores falham ou dão 429", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limit", { status: 429 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cnpj: "43956926000168",
            razao_social: "COMERCIO DE UTILIDADES LUKATI LTDA",
            nome_fantasia: "LUKATI UTILIDADES",
            descricao_tipo_de_logradouro: "RUA",
            logradouro: "PROJETADA",
            numero: "224",
            bairro: "TEREZA CRISTINA",
            municipio: "ICARA",
            uf: "SC",
            cep: "88820000",
            ddd_telefone_1: "4896265851",
          }),
          { status: 200 },
        ),
      );

    const data = await fetchCNPJ("43956926000168");
    expect(spy).toHaveBeenCalledTimes(3);
    expect(data?.nome_fantasia).toBe("LUKATI UTILIDADES");
    expect(data?.logradouro).toBe("RUA PROJETADA");
    expect(data?.cep).toBe("88820-000");
  });
});