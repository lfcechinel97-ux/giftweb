import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { ImageOff, Loader2, LogOut, Plus, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcularVolumes, type ItemCalculo } from "@/lib/medidaDespacho/calculo";
import { buscarProdutos, CONFIG_PADRAO, db, type ProdutoIndice } from "@/lib/medidaDespacho/dados";
import type { Calibrado } from "@/lib/medidaDespacho/fontes";
import BlocoDados from "./medidaDespacho/BlocoDados";
import BlocoResultado from "./medidaDespacho/BlocoResultado";
import { novaLinha, resolverLinha, useDadosDespacho, type Contexto, type LinhaForm } from "./medidaDespacho/estado";
import LinhaItem from "./medidaDespacho/LinhaItem";
import { AZUL, AZUL_ESCURO, Bloco, CampoNumero, Rotulo, fmtN, inputCls, lerNum } from "./medidaDespacho/ui";

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

const SEM_CALIBRADOS = new Map<string, Calibrado>();

export default function MedidaDespacho() {
  const dados = useDadosDespacho();
  const qc = useQueryClient();
  const config = dados.config.data ?? CONFIG_PADRAO;
  const [caixa, setCaixa] = useState<CaixaForm>(() => caixaDoConfig(CONFIG_PADRAO));
  const [linhas, setLinhas] = useState<LinhaForm[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const configAplicada = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  useEffect(() => {
    if (dados.config.data && !configAplicada.current) {
      configAplicada.current = true;
      setCaixa(caixaDoConfig(dados.config.data));
    }
  }, [dados.config.data]);

  const mapa = useMemo(() => new Map((dados.produtos.data ?? []).map((p) => [p.codigo, p])), [dados.produtos.data]);
  const ctx: Contexto = useMemo(() => ({
    mapa,
    master: dados.master.data?.porProduto ?? new Map(),
    overrides: dados.overrides.data ?? new Map(),
    calibrados: SEM_CALIBRADOS,
    config,
  }), [mapa, dados.master.data, dados.overrides.data, config]);

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

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/logos/giftweb-logo.png" alt="Gift Web Brindes" className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl" style={{ color: AZUL_ESCURO }}>Volumes de despacho</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Quantos volumes, peso real e cubado · estimativa para orçamento</p>
          </div>
          {email && <span className="hidden text-sm text-slate-500 md:inline">{email}</span>}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

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
          <BlocoResultado resultado={resultado} caixa={params.caixa} rotuloDe={(id) => rotulos.get(id) ?? id} />
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

function BuscaProduto({ produtos, carregando, onAdicionar }: {
  produtos: ProdutoIndice[]; carregando: boolean; onAdicionar: (p: ProdutoIndice, qtd: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [qtd, setQtd] = useState("");
  const [sel, setSel] = useState<ProdutoIndice | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const termoDiferido = useDeferredValue(termo);
  const achados = useMemo(() => (sel ? [] : buscarProdutos(produtos, termoDiferido)), [produtos, termoDiferido, sel]);
  const qtdRef = useRef<HTMLInputElement>(null);

  const escolher = (p: ProdutoIndice) => {
    setSel(p); setTermo(`${p.codigo} · ${p.nome}`); setAberto(false);
    setTimeout(() => qtdRef.current?.focus(), 0);
  };
  const adicionar = () => {
    const p = sel ?? achados[0];
    if (!p) return;
    onAdicionar(p, qtd);
    setSel(null); setTermo(""); setQtd("");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={termo}
          disabled={carregando}
          placeholder={carregando ? "Carregando produtos…" : "Código (01116, 01116-INO) ou nome do produto"}
          onChange={(e) => { setTermo(e.target.value); setSel(null); setAberto(true); setAtivo(0); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && achados[ativo]) { e.preventDefault(); escolher(achados[ativo]); }
          }}
          className={inputCls() + " pl-9"}
        />
        {carregando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
        {aberto && achados.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {achados.map((p, i) => (
              <li key={p.codigo}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(p)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === ativo ? "bg-[#EEF4FD]" : "hover:bg-slate-50"}`}
                >
                  {p.imagem ? <img src={p.imagem} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded object-contain" /> : <ImageOff className="h-9 w-9 shrink-0 p-2 text-slate-300" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-800">{p.nome}</span>
                    <span className="block text-[12px] text-slate-500">
                      <span className="font-mono">{p.codigo}</span> · {p.variantes.length} {p.variantes.length > 1 ? "cores" : "cor"} · {p.estoque.toLocaleString("pt-BR")} em estoque{!p.ativo && " · inativo"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={qtdRef}
          inputMode="numeric"
          value={qtd}
          placeholder="Qtd"
          onChange={(e) => setQtd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
          className={inputCls() + " w-28 text-right"}
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={!sel && !achados.length}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: AZUL }}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </div>
  );
}
