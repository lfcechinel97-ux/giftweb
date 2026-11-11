import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcularVolumes, type ItemCalculo } from "@/lib/medidaDespacho/calculo";
import { CONFIG_PADRAO, db } from "@/lib/medidaDespacho/dados";
import { formaParaDesenho, type Forma } from "@/lib/medidaDespacho/empacotamento";
import BlocoDados from "./medidaDespacho/BlocoDados";
import Cabecalho from "./medidaDespacho/Cabecalho";
import BlocoResultado from "./medidaDespacho/BlocoResultado";
import BuscaProduto from "./medidaDespacho/BuscaProduto";
import { novaLinha, resolverLinha, useContexto, useDadosDespacho, type LinhaForm } from "./medidaDespacho/estado";
import LinhaItem from "./medidaDespacho/LinhaItem";
import { Bloco, CampoNumero, Rotulo, fmtN, inputCls, lerNum } from "./medidaDespacho/ui";

/* Calculadora de volumes de despacho. Ferramenta interna, atrás do AdminGuard.
   O cálculo roda no navegador, em tempo real, com os dados já carregados
   (products_cache + caixa master + overrides). Detalhes em src/lib/medidaDespacho/README.md */

interface CaixaForm {
  largura: string;
  comprimento: string;
  altura: string;
  pesoMax: string;
  tara: string;
  cubagem: string;
}

const caixaDoConfig = (c: typeof CONFIG_PADRAO): CaixaForm => ({
  largura: fmtN(c.caixa.largura), comprimento: fmtN(c.caixa.comprimento), altura: fmtN(c.caixa.altura),
  pesoMax: fmtN(c.pesoMaxKg), tara: fmtN(c.taraKg), cubagem: String(c.cubagemRodoviario),
});

// Three.js só é baixado quando alguém abre o 3D
const Visualizador3D = lazy(() => import("./medidaDespacho/Visualizador3D"));

export default function MedidaDespacho() {
  const dados = useDadosDespacho();
  const qc = useQueryClient();
  const config = dados.config.data ?? CONFIG_PADRAO;
  const [caixa, setCaixa] = useState<CaixaForm>(() => caixaDoConfig(CONFIG_PADRAO));
  const [linhas, setLinhas] = useState<LinhaForm[]>([]);
  const configAplicada = useRef(false);
  const [ver3d, setVer3d] = useState(false);

  useEffect(() => {
    if (dados.config.data && !configAplicada.current) {
      configAplicada.current = true;
      setCaixa(caixaDoConfig(dados.config.data));
    }
  }, [dados.config.data]);

  const { ctx } = useContexto(dados);

  const resolvidas = useMemo(() => linhas.map((l) => resolverLinha(l, ctx)), [linhas, ctx]);

  const params = useMemo(() => {
    const L = lerNum(caixa.largura), A = lerNum(caixa.altura), C = lerNum(caixa.comprimento);
    const pesoMax = lerNum(caixa.pesoMax), tara = lerNum(caixa.tara) ?? 0, cub = lerNum(caixa.cubagem);
    if (!L || !A || !C || L <= 0 || A <= 0 || C <= 0 || !pesoMax || pesoMax <= tara || tara < 0 || !cub || cub <= 0) return null;
    return { caixa: { largura: L, altura: A, comprimento: C }, pesoMaxKg: pesoMax, taraKg: tara, fatorCubagem: cub };
  }, [caixa]);

  const rotulos = useMemo(() => new Map(resolvidas.map((r) => [String(r.linha.uid), r.produto ? `${r.produto.codigo} ${r.produto.nome}` : r.linha.codigo])), [resolvidas]);
  const resultado = useMemo(() => {
    if (!params) return null;
    const itens: ItemCalculo[] = resolvidas
      .filter((r) => r.medida && r.qtd > 0)
      .map((r) => ({ id: String(r.linha.uid), rotulo: rotulos.get(String(r.linha.uid))!, qtd: r.qtd, medida: r.medida! }));
    return calcularVolumes(itens, params);
  }, [resolvidas, params, rotulos]);
  const formas = useMemo(() => {
    const m = new Map<string, Forma>();
    for (const r of resolvidas) {
      const f = r.medida && formaParaDesenho(r.medida);
      if (f) m.set(String(r.linha.uid), f);
    }
    return m;
  }, [resolvidas]);
  const erroPorLinha = useMemo(() => new Map((resultado?.erros ?? []).map((e) => [e.id, e.texto])), [resultado]);

  const mudar = (uid: number, m: Partial<LinhaForm>) => setLinhas((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...m } : l)));
  const remover = (uid: number) => setLinhas((ls) => ls.filter((l) => l.uid !== uid));

  const salvarOverride = async (uid: number) => {
    const r = resolvidas.find((x) => x.linha.uid === uid);
    if (!r?.produto || !r.medida) return;
    const atual = ctx.overrides.get(r.produto.codigo);
    const l = r.linha;
    const digitouDims = !!(l.altura || l.largura || l.profundidade);
    const d = digitouDims && r.medida.fonte === "manual" ? r.medida.dimsExibidas : null;
    if (digitouDims && !d) throw new Error("Preencha as três dimensões.");
    const comp = lerNum(l.compressao);
    if (comp !== null && (comp <= 0 || comp > 1)) throw new Error("Fator de compressão entre 0 e 1.");
    const peso = lerNum(l.peso);
    if (peso !== null && peso <= 0) throw new Error("Peso precisa ser maior que zero.");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("medidas_override").upsert({
      codigo_amigavel: r.produto.codigo,
      largura_cm: d ? d[0] : atual?.largura_cm ?? null,
      altura_cm: d ? d[1] : atual?.altura_cm ?? null,
      profundidade_cm: d ? d[2] : atual?.profundidade_cm ?? null,
      peso_g: peso ?? atual?.peso_g ?? null,
      fator_compressao: comp ?? atual?.fator_compressao ?? null,
      // medida nova da unidade substitui o volume promovido da calibração
      vol_efetivo_un_cm3: d ? null : atual?.vol_efetivo_un_cm3 ?? null,
      atualizado_por: u.user?.id ?? null,
      atualizado_em: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await qc.invalidateQueries({ queryKey: ["medidadespacho", "overrides"] });
    mudar(uid, { altura: "", largura: "", profundidade: "", peso: "", compressao: "", aberto: null });
  };

  const carregando = dados.produtos.isLoading || dados.config.isLoading;
  const erroCarga = dados.produtos.error || dados.master.error || dados.overrides.error || dados.config.error;
  const setC = (k: keyof CaixaForm, v: string) => setCaixa((c) => ({ ...c, [k]: v }));

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <Helmet>
        <title>Medida de despacho | Gift Web Brindes</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Cabecalho subtitulo="Quantos volumes, peso real e cubado · estimativa para orçamento" />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {erroCarga && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Erro ao carregar dados: {(erroCarga as Error).message}. Se as tabelas ainda não existem, rode a migration
            supabase/migrations/20261111120000_medidadespacho.sql no SQL Editor.
          </p>
        )}

        <Bloco
          titulo="Caixa"
          acao={
            <button type="button" onClick={() => setCaixa(caixaDoConfig(config))} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-700">
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <CampoNumero rotulo="Largura" sufixo="cm" valor={caixa.largura} erro={!lerNum(caixa.largura)} onChange={(v) => setC("largura", v)} />
            <CampoNumero rotulo="Comprimento" sufixo="cm" valor={caixa.comprimento} erro={!lerNum(caixa.comprimento)} onChange={(v) => setC("comprimento", v)} />
            <CampoNumero rotulo="Altura" sufixo="cm" valor={caixa.altura} erro={!lerNum(caixa.altura)} onChange={(v) => setC("altura", v)} />
            <CampoNumero rotulo="Peso máx." sufixo="kg" valor={caixa.pesoMax} erro={!lerNum(caixa.pesoMax)} onChange={(v) => setC("pesoMax", v)} />
            <CampoNumero rotulo="Tara" sufixo="kg" valor={caixa.tara} onChange={(v) => setC("tara", v)} />
            <label className="block min-w-0">
              <Rotulo>Cubagem</Rotulo>
              <select value={caixa.cubagem} onChange={(e) => setC("cubagem", e.target.value)} className={inputCls()}>
                <option value={String(config.cubagemRodoviario)}>Rodoviário ({config.cubagemRodoviario} kg/m³)</option>
                <option value={String(config.cubagemAereo)}>Aéreo ({config.cubagemAereo} kg/m³)</option>
              </select>
            </label>
          </div>
          {!params && <p className="mt-2 text-[13px] text-red-600">Confira a caixa: dimensões maiores que zero e peso máximo maior que a tara.</p>}
        </Bloco>

        <Bloco titulo="Itens">
          <BuscaProduto
            produtos={dados.produtos.data ?? []}
            carregando={carregando}
            onAdicionar={(p, qtd) => setLinhas((ls) => [...ls, novaLinha(p.codigo, qtd)])}
          />
          <div className="mt-4 space-y-3">
            {resolvidas.map((r) => (
              <LinhaItem
                key={r.linha.uid}
                r={r}
                erroCalculo={erroPorLinha.get(String(r.linha.uid)) ?? null}
                onMudar={(m) => mudar(r.linha.uid, m)}
                onRemover={() => remover(r.linha.uid)}
                onSalvarOverride={() => salvarOverride(r.linha.uid)}
              />
            ))}
            {!linhas.length && !carregando && <p className="text-sm text-slate-500">Busque um produto pelo código ou nome e informe a quantidade.</p>}
          </div>
        </Bloco>

        {resultado && params && (
          <BlocoResultado
            resultado={resultado}
            caixa={params.caixa}
            rotuloDe={(id) => rotulos.get(id) ?? id}
            acaoExtra={
              <button type="button" onClick={() => setVer3d(true)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Box className="h-4 w-4" /> Ver em 3D
              </button>
            }
          />
        )}
        {ver3d && resultado && params && resultado.volumes.length > 0 && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
            <Visualizador3D volumes={resultado.volumes} caixa={params.caixa} formas={formas} rotulos={rotulos} onFechar={() => setVer3d(false)} />
          </Suspense>
        )}

        <BlocoDados
          produtos={dados.produtos.data ?? []}
          ultimaSync={dados.sync.data ?? null}
          master={dados.master.data ? { total: dados.master.data.total, importadoEm: dados.master.data.importadoEm } : null}
        />
      </main>
    </div>
  );
}
