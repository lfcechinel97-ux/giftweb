// @vitest-environment node
import { QueryClient, type QueryObserverOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { from, response, captured } = vi.hoisted(() => ({
  from: vi.fn(),
  response: { data: [{ preco_base: 608 }] as { preco_base: number }[], error: null as Error | null },
  captured: { options: null as QueryObserverOptions<number> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: (options: QueryObserverOptions<number>) => {
    captured.options = options;
    return { data: undefined };
  },
}));

import { useMaxPrice } from "./useMaxPrice";

let client: QueryClient;

function options() {
  useMaxPrice();
  if (!captured.options) throw new Error("opções não capturadas");
  return captured.options;
}

beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  response.data = [{ preco_base: 608 }];
  response.error = null;
  from.mockReset();
  from.mockImplementation(() => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => ({ ...response })),
    };
    return query;
  });
});

afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

describe("useMaxPrice", () => {
  it("mantém o cálculo com desconto de 1000 unidades e arredondamento para 50", async () => {
    expect(useMaxPrice()).toBe(1000);
    expect(await client.fetchQuery(options())).toBe(550); // 608 × 0,84 = 510,72; teto em múltiplo de 50.
  });

  it("reutiliza o valor por uma hora e reconsulta quando o cache fica obsoleto", async () => {
    expect(await client.fetchQuery(options())).toBe(550);
    await vi.advanceTimersByTimeAsync(3_599_000);
    expect(await client.fetchQuery(options())).toBe(550);
    expect(from).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_100);
    await client.fetchQuery(options());
    expect(from).toHaveBeenCalledTimes(2);
    expect(options().staleTime).toBe(3_600_000);
    expect(options().gcTime).toBe(3_600_000);
  });

  it("mantém o valor padrão quando não há produtos elegíveis", async () => {
    response.data = [];
    expect(await client.fetchQuery(options())).toBe(1000);
  });

  it("não grava falha de consulta como um preço válido no cache", async () => {
    response.error = new Error("consulta indisponível");
    await expect(client.fetchQuery(options())).rejects.toThrow("consulta indisponível");
    expect(useMaxPrice()).toBe(1000);
    expect(client.getQueryState(["catalog-max-price"])?.status).toBe("error");
    expect(client.getQueryData(["catalog-max-price"])).toBeUndefined();
  });
});