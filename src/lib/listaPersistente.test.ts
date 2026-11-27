import { describe, expect, it } from "vitest";
import { dataValida, paginasVisiveis } from "./listaPersistente";

describe("paginasVisiveis", () => {
  it("mostra todas quando são poucas", () => {
    expect(paginasVisiveis(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("no início mostra pelo menos 1 2 3 4 … última", () => {
    expect(paginasVisiveis(1, 78)).toEqual([1, 2, 3, 4, 5, null, 78]);
    expect(paginasVisiveis(4, 78)).toEqual([1, 2, 3, 4, 5, null, 78]);
  });
  it("no meio mostra vizinhas", () => {
    expect(paginasVisiveis(30, 78)).toEqual([1, null, 29, 30, 31, null, 78]);
  });
  it("no fim mostra as últimas", () => {
    expect(paginasVisiveis(78, 78)).toEqual([1, null, 74, 75, 76, 77, 78]);
  });
});

describe("dataValida", () => {
  it("aceita data completa", () => expect(dataValida("2026-11-18")).toBe("2026-11-18"));
  it("recusa ano ainda sendo digitado", () => {
    expect(dataValida("0002-11-18")).toBeNull();
    expect(dataValida("0202-11-18")).toBeNull();
    expect(dataValida("")).toBeNull();
  });
});
