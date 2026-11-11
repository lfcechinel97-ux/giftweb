import { useQuery } from "@tanstack/react-query";
import type { ConfigMaster } from "@/lib/medidaDespacho/caixaMaster";
import {
  carregarConfig, carregarMaster, carregarOverrides, carregarProdutos, ultimaSync,
  type Config, type MasterProduto, type OverrideDb, type ProdutoIndice,
} from "@/lib/medidaDespacho/dados";
import { resolverMedida, type Calibrado, type EntradaManual, type MedidaResolvida } from "@/lib/medidaDespacho/fontes";
import { normalizar } from "@/lib/medidaDespacho/regras";
import { lerNum } from "./ui";

/** Uma linha de item na tela (tudo como texto, do jeito que foi digitado). */
export interface LinhaForm {
  uid: number;
  codigo: string;
  variante: string | null;
  qtd: string;
  altura: string;
  largura: string;
  profundidade: string;
  peso: string;
  compressao: string;
  master: string | null;
  /** null = abre sozinho quando falta medida/peso. */
  aberto: boolean | null;
}

let proximo = 1;
export const novaLinha = (codigo: string, qtd: string, variante: string | null = null): LinhaForm => ({
  uid: proximo++, codigo, variante, qtd, altura: "", largura: "", profundidade: "", peso: "", compressao: "", master: null, aberto: null,
});

const HORA = 60 * 60 * 1000;

export function useDadosDespacho() {
  const produtos = useQuery({ queryKey: ["medidadespacho", "produtos"], queryFn: carregarProdutos, staleTime: 6 * HORA });
  const master = useQuery({
    queryKey: ["medidadespacho", "master", produtos.data?.length],
    queryFn: () => carregarMaster(produtos.data!),
    enabled: !!produtos.data,
    staleTime: 6 * HORA,
  });
  const overrides = useQuery({ queryKey: ["medidadespacho", "overrides"], queryFn: carregarOverrides, staleTime: 5 * 60 * 1000 });
  const config = useQuery({ queryKey: ["medidadespacho", "config"], queryFn: carregarConfig, staleTime: HORA });
  const sync = useQuery({ queryKey: ["medidadespacho", "sync"], queryFn: ultimaSync, staleTime: HORA });
  return { produtos, master, overrides, config, sync };
}

export interface Contexto {
  mapa: Map<string, ProdutoIndice>;
  master: Map<string, MasterProduto>;
  overrides: Map<string, OverrideDb>;
  calibrados: Map<string, Calibrado>;
  config: Config;
}

export interface LinhaResolvida {
  linha: LinhaForm;
  produto: ProdutoIndice | null;
  configs: ConfigMaster[];
  medida: MedidaResolvida | null;
  qtd: number;
}

export function resolverLinha(l: LinhaForm, ctx: Contexto): LinhaResolvida {
  const produto = ctx.mapa.get(l.codigo) ?? null;
  const qtd = Math.max(0, Math.floor(lerNum(l.qtd) ?? 0));
  if (!produto) return { linha: l, produto, configs: [], medida: null, qtd };
  const mp = ctx.master.get(produto.codigo);
  const daCor = l.variante ? mp?.porVariante.get(normalizar(l.variante)) : undefined;
  const configs = daCor?.length ? daCor : mp?.todas ?? [];
  const base = {
    produto: produto.api,
    fatores: { aproveitamentoApi: ctx.config.aproveitamentoApi, aproveitamentoMaster: ctx.config.aproveitamentoMaster },
    configsMaster: configs,
    masterEscolhida: l.master,
    masterEmRevisao: mp?.emRevisao ?? 0,
    override: ctx.overrides.get(produto.codigo) ?? null,
    calibrado: ctx.calibrados.get(produto.codigo) ?? null,
  };
  const digitadas = [lerNum(l.altura), lerNum(l.largura), lerNum(l.profundidade)];
  const manual: EntradaManual = { pesoG: lerNum(l.peso), fatorCompressao: lerNum(l.compressao) };
  if (digitadas.some((v) => v !== null)) {
    // Completa o que não foi digitado com a medida que já estava sendo usada
    const atual = resolverMedida({ ...base, manual }).dimsExibidas;
    manual.altura = digitadas[0] ?? atual?.[1] ?? null;
    manual.largura = digitadas[1] ?? atual?.[0] ?? null;
    manual.profundidade = digitadas[2] ?? atual?.[2] ?? null;
  }
  return { linha: l, produto, configs, medida: resolverMedida({ ...base, manual }), qtd };
}
