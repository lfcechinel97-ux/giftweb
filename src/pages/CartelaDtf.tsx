import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ChevronDown, Download, FileUp, Loader2, LogOut, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CM, ErroCartela, lerNumero, type CaixaLogo, type Distribuicao } from "@/lib/cartelaDtf/layout";
import {
  CMYK_PADRAO, DISTANCIA_PADRAO_MM, SPOT_PADRAO, gerarCartela, lerLogo,
  type Cartela, type ItemCartela, type Modo, type OpcoesCartela,
} from "@/lib/cartelaDtf/gerarCartela";
import VisualizadorPdf, { type Alvo } from "./cartelaDtf/VisualizadorPdf";

/* Gerador de cartela de DTF (têxtil e UV com TOYO). Ferramenta interna,
   atrás do AdminGuard. Tudo roda no navegador: a logo do cliente nunca
   sai da máquina de quem está usando. Detalhes em src/lib/cartelaDtf/README.md */

const AZUL_ESCURO = "#0E2A57";
const VERDE = "#19A84A";
const AZUL = "#1464D2";

const fmt = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const ERRO_PDF = "Não foi possível ler o PDF: envie um PDF vetorial exportado do Corel/Illustrator.";

interface Logo {
  nome: string;
  bytes: Uint8Array;
  caixa: CaixaLogo;
}

/** Uma logo da lista: arquivo + largura + quantidade. */
interface ItemForm {
  id: number;
  logo: Logo | null;
  lendo: boolean;
  erro: string | null;
  largura: string;
  qtd: string;
}

interface Campos {
  continuarNaLinha: boolean;
  espaco: string;
  folha: string;
  margem: string;
  modo: Modo;
  contrair: boolean;
  distancia: string;
  distribuicao: Distribuicao;
  spot: string;
  cmyk: [string, string, string, string];
}

const INICIAL: Campos = {
  continuarNaLinha: true,
  espaco: "1",
  folha: "57",
  margem: "0,5",
  modo: "textil",
  contrair: false,
  distancia: fmtNum(DISTANCIA_PADRAO_MM),
  distribuicao: "equilibrada",
  spot: SPOT_PADRAO,
  cmyk: CMYK_PADRAO.map(String) as Campos["cmyk"],
};

let proximoId = 1;
const novoItem = (): ItemForm => ({ id: proximoId++, logo: null, lendo: false, erro: null, largura: "", qtd: "" });

type Erros = Partial<Record<keyof Campos, string>>;

/** Valida o que vale para a folha inteira. */
function validarFolha(c: Campos): { opcoes: OpcoesCartela | null; erros: Erros; avisoDistancia: string | null } {
  const erros: Erros = {};
  const espaco = lerNumero(c.espaco);
  const folha = lerNumero(c.folha);
  const margem = lerNumero(c.margem);
  const distancia = lerNumero(c.distancia);
  const cmyk = c.cmyk.map(lerNumero) as [number, number, number, number];

  if (!(espaco >= 0)) erros.espaco = "Espaçamento inválido.";
  if (!(folha > 0)) erros.folha = "Largura da folha inválida.";
  if (!(margem >= 0)) erros.margem = "Margem inválida.";

  let avisoDistancia: string | null = null;
  if (c.modo === "uv") {
    if (!c.spot.trim()) erros.spot = "Informe o nome do spot.";
    if (cmyk.some((v) => !(v >= 0 && v <= 100))) erros.cmyk = "Cada valor CMYK vai de 0 a 100.";
    if (c.contrair) {
      if (Number.isNaN(distancia)) erros.distancia = "Distância inválida.";
      else if (distancia <= 0) erros.distancia = "A distância precisa ser maior que 0 mm.";
      else if (distancia > 2) erros.distancia = "A distância máxima é 2 mm.";
      else if (distancia < 0.1 || distancia > 0.3) avisoDistancia = "Fora da faixa usual (0,10 a 0,30 mm). Confira se é isso mesmo.";
    }
  }

  if (Object.keys(erros).length) return { opcoes: null, erros, avisoDistancia };
  return {
    erros,
    avisoDistancia,
    opcoes: {
      espacoCm: espaco, folhaMaxCm: folha, margemCm: margem,
      distribuicao: c.distribuicao, continuarNaLinha: c.continuarNaLinha, modo: c.modo, contrair: c.modo === "uv" && c.contrair,
      distanciaMm: distancia, spot: c.spot.trim(), cmyk,
    },
  };
}

/** Valida largura e quantidade de uma logo. */
function validarItem(it: ItemForm) {
  const erros: { largura?: string; qtd?: string } = {};
  const largura = lerNumero(it.largura);
  const qtd = lerNumero(it.qtd);
  if (!it.largura.trim()) erros.largura = "Informe a largura da logo.";
  else if (!(largura > 0)) erros.largura = "Largura inválida: use um número maior que zero.";
  if (!it.qtd.trim()) erros.qtd = "Informe a quantidade.";
  else if (!(qtd >= 1) || !Number.isInteger(qtd)) erros.qtd = "Quantidade inválida: use um número inteiro a partir de 1.";
  else if (qtd > 20000) erros.qtd = "Quantidade muito alta (máximo 20.000 por logo).";
  return { erros, largura, qtd, ok: !erros.largura && !erros.qtd };
}

export default function CartelaDtf() {
  const [itens, setItens] = useState<ItemForm[]>(() => [novoItem()]);
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [avancado, setAvancado] = useState(false);
  const [cartela, setCartela] = useState<Cartela | null>(null);
  // número e nome de cada logo da cartela exibida (na ordem do layout)
  const [rotulos, setRotulos] = useState<{ numero: number; nome: string }[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setCampos((c) => ({ ...c, [k]: v }));
  const mudarItem = (id: number, mud: Partial<ItemForm>) =>
    setItens((lista) => lista.map((it) => (it.id === id ? { ...it, ...mud } : it)));
  const { opcoes, erros, avisoDistancia } = useMemo(() => validarFolha(campos), [campos]);

  /** Lê os arquivos: o primeiro vai para a logo `id`, os outros viram logos novas. */
  const abrirArquivos = useCallback(async (id: number, files: File[]) => {
    if (!files.length) return;
    const extras = files.slice(1).map(() => novoItem());
    const alvos = [id, ...extras.map((e) => e.id)];
    setItens((lista) => {
      const i = lista.findIndex((it) => it.id === id);
      const nova = lista.map((it) => (it.id === id ? { ...it, lendo: true, erro: null } : it));
      nova.splice(i + 1, 0, ...extras.map((e) => ({ ...e, lendo: true })));
      return nova;
    });
    await Promise.all(files.map(async (file, k) => {
      const alvo = alvos[k];
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        mudarItem(alvo, { lendo: false, erro: "O arquivo precisa ser PDF: envie um PDF vetorial exportado do Corel/Illustrator." });
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { caixa } = await lerLogo(bytes);
        mudarItem(alvo, { lendo: false, logo: { nome: file.name, bytes, caixa } });
      } catch (e) {
        mudarItem(alvo, { lendo: false, logo: null, erro: e instanceof ErroCartela ? e.message : ERRO_PDF });
      }
    }));
  }, []);

  const remover = (id: number) => setItens((lista) => (lista.length > 1 ? lista.filter((it) => it.id !== id) : lista));

  // logos que entram na cartela: com arquivo e largura/quantidade válidas
  const validacoes = itens.map(validarItem);
  const prontos = itens
    .map((it, i) => ({ it, v: validacoes[i], numero: i + 1 }))
    .filter(({ it, v }) => it.logo && v.ok);
  const incompletos = itens
    .map((it, i) => ({ it, v: validacoes[i], numero: i + 1 }))
    .filter(({ it, v }) => it.logo && !v.ok);

  // gera de novo (com um pequeno atraso) sempre que algo muda
  const chave = opcoes && prontos.length
    ? JSON.stringify({ o: opcoes, i: prontos.map(({ it, v }) => [it.id, it.logo!.nome, v.largura, v.qtd]) })
    : "";
  const entradaRef = useRef<{ itens: ItemCartela[]; opcoes: OpcoesCartela; rotulos: { numero: number; nome: string }[] } | null>(null);
  entradaRef.current = opcoes && prontos.length
    ? {
        opcoes,
        itens: prontos.map(({ it, v }) => ({ bytes: it.logo!.bytes, larguraCm: v.largura, qtd: v.qtd })),
        rotulos: prontos.map(({ it, numero }) => ({ numero, nome: it.logo!.nome })),
      }
    : null;
  // a logo de cada item muda de bytes ao trocar o arquivo: entra na chave pela identidade
  const versoes = useRef(new WeakMap<Uint8Array, number>());
  const versaoDe = (b: Uint8Array) => {
    if (!versoes.current.has(b)) versoes.current.set(b, Math.random());
    return versoes.current.get(b)!;
  };
  const chaveCompleta = chave + "|" + prontos.map(({ it }) => versaoDe(it.logo!.bytes)).join(",");

  const geracao = useRef(0);
  useEffect(() => {
    const entrada = entradaRef.current;
    if (!chave || !entrada) {
      setCartela(null);
      setErroGeracao(null);
      setGerando(false);
      return;
    }
    const id = ++geracao.current;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const c = await gerarCartela(entrada.itens, entrada.opcoes);
        if (id !== geracao.current) return;
        setCartela(c);
        setRotulos(entrada.rotulos);
        setErroGeracao(null);
      } catch (e) {
        if (id !== geracao.current) return;
        console.error("[carteladtf]", e);
        setCartela(null);
        setErroGeracao(e instanceof ErroCartela ? e.message : "Não foi possível gerar a cartela com essas logos.");
      } finally {
        if (id === geracao.current) setGerando(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveCompleta]);

  const baixar = () => {
    if (!cartela) return;
    const url = URL.createObjectURL(new Blob([cartela.pdf], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = cartela.nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const sair = async () => {
    await supabase.auth.signOut(); // o AdminGuard leva para o login
  };

  const L = cartela?.layout;
  const desatualizada = gerando && !!cartela;
  const alvos: Alvo[] = L
    ? L.itens.map((li, k) => ({
        rotulo: L.itens.length > 1 ? `Ver logo ${rotulos[k]?.numero ?? k + 1} de perto` : "Ver logo de perto",
        ret: { x: li.posicoes[0].x, y: li.posicoes[0].y, w: li.W, h: li.H },
      }))
    : [];
  const temLogo = itens.some((it) => it.logo);

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <Helmet>
        <title>Cartela DTF | Gift Web Brindes</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/logos/giftweb-logo.png" alt="Gift Web Brindes" className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl" style={{ color: AZUL_ESCURO }}>
              Gerador de cartela DTF
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">Têxtil e UV com TOYO · PDF vetorial em escala real 1:1</p>
          </div>
          {email && <span className="hidden text-sm text-slate-500 md:inline">{email}</span>}
          <button
            type="button"
            onClick={sair}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Formulário */}
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            {itens.map((it, i) => (
              <CartaoLogo
                key={it.id}
                numero={i + 1}
                item={it}
                erros={it.logo || it.largura.trim() ? validacoes[i].erros : {}}
                podeRemover={itens.length > 1}
                onArquivos={(files) => abrirArquivos(it.id, files)}
                onMudar={(mud) => mudarItem(it.id, mud)}
                onRemover={() => remover(it.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => setItens((l) => [...l, novoItem()])}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-[15px] font-semibold transition hover:bg-[#EEF4FD]"
              style={{ borderColor: "#BFD3F2", color: AZUL }}
            >
              <Plus className="h-5 w-5" /> Adicionar outra logo
            </button>
            {itens.length > 1 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={campos.continuarNaLinha}
                  onChange={(e) => set("continuarNaLinha", e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#1464D2]"
                />
                <span>
                  <span className="block text-[14px] font-semibold text-slate-800">Aproveitar a sobra da linha</span>
                  <span className="block text-xs text-slate-500">
                    {campos.continuarNaLinha
                      ? "Se uma logo termina no meio da linha, a próxima começa ali mesmo."
                      : "Cada logo começa numa linha nova, embaixo da anterior."}
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
            <CampoNumero rotulo="Espaço entre logos (cm)" valor={campos.espaco} onChange={(v) => set("espaco", v)} erro={erros.espaco} />
            <CampoNumero rotulo="Margem das bordas (cm)" valor={campos.margem} onChange={(v) => set("margem", v)} erro={erros.margem} />
            <CampoNumero rotulo="Largura máx. da folha (cm)" valor={campos.folha} onChange={(v) => set("folha", v)} erro={erros.folha} />
          </div>

          <div>
            <Rotulo>Tipo</Rotulo>
            <div className="grid grid-cols-2 gap-2">
              <Opcao ativo={campos.modo === "textil"} onClick={() => set("modo", "textil")} titulo="DTF Têxtil" sub="Só a logo original" />
              <Opcao ativo={campos.modo === "uv"} onClick={() => set("modo", "uv")} titulo="DTF UV com TOYO" sub="Original + camada spot" />
            </div>
          </div>

          {campos.modo === "uv" && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={campos.contrair}
                  onChange={(e) => set("contrair", e.target.checked)}
                  className="h-5 w-5 rounded accent-[#1464D2]"
                />
                <span className="text-[15px] font-semibold text-slate-800">Contrair TOYO</span>
              </label>
              <p className="text-xs text-slate-500">
                Encolhe a camada branca (TOYO) para dentro da logo, para não aparecer borda branca em volta. A logo original não muda.
              </p>
              {campos.contrair && (
                <div className="grid grid-cols-[120px_1fr] items-start gap-3">
                  <CampoNumero rotulo="Distância (mm)" valor={campos.distancia} onChange={(v) => set("distancia", v)} erro={erros.distancia} />
                  <p className="pt-7 text-xs leading-relaxed text-slate-600">
                    Geralmente utilizamos 0,15 mm, mas pode variar de 0,10 a 0,30 mm.
                  </p>
                  {avisoDistancia && <p className="col-span-2 -mt-1 text-xs font-medium text-amber-700">{avisoDistancia}</p>}
                </div>
              )}
            </div>
          )}

          <div>
            <Rotulo>Distribuição</Rotulo>
            <div className="grid grid-cols-2 gap-2">
              <Opcao ativo={campos.distribuicao === "equilibrada"} onClick={() => set("distribuicao", "equilibrada")} titulo="Equilibrada" sub="Linhas com a mesma quantidade" />
              <Opcao ativo={campos.distribuicao === "encher"} onClick={() => set("distribuicao", "encher")} titulo="Encher linha" sub="Máximo de logos por linha" />
            </div>
          </div>

          {campos.modo === "uv" && (
            <div className="rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAvancado((v) => !v)}
                className="flex h-11 w-full items-center justify-between px-4 text-sm font-semibold text-slate-700"
              >
                Avançado
                <ChevronDown className={`h-4 w-4 transition ${avancado ? "rotate-180" : ""}`} />
              </button>
              {avancado && (
                <div className="space-y-3 border-t border-slate-200 p-4">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Nome do spot</span>
                    <input value={campos.spot} onChange={(e) => set("spot", e.target.value)} className={inputCls(!!erros.spot)} />
                    {erros.spot && <Erro>{erros.spot}</Erro>}
                  </label>
                  <div>
                    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Cor de visualização (CMYK %)</span>
                    <div className="grid grid-cols-4 gap-2">
                      {(["C", "M", "Y", "K"] as const).map((letra, i) => (
                        <label key={letra} className="block">
                          <span className="mb-1 block text-center text-xs text-slate-500">{letra}</span>
                          <input
                            inputMode="decimal"
                            value={campos.cmyk[i]}
                            onChange={(e) => {
                              const novo = [...campos.cmyk] as Campos["cmyk"];
                              novo[i] = e.target.value;
                              set("cmyk", novo);
                            }}
                            className={inputCls(!!erros.cmyk) + " text-center"}
                          />
                        </label>
                      ))}
                    </div>
                    {erros.cmyk && <Erro>{erros.cmyk}</Erro>}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Resultado */}
        <section className="min-w-0 space-y-4">
          {!temLogo && <Vazio>Envie a logo e informe a largura e a quantidade para ver a cartela.</Vazio>}
          {temLogo && !prontos.length && <Vazio>Preencha a largura e a quantidade para montar a cartela.</Vazio>}
          {erroGeracao && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[15px] font-semibold text-red-700">{erroGeracao}</div>
          )}

          {cartela && L && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold" style={{ color: AZUL_ESCURO }}>Resumo</h2>
                  {desatualizada && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> atualizando…
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                  <Info rotulo="Tipo" valor={opcoes?.modo === "uv" ? `DTF UV · ${opcoes.spot}` : "DTF Têxtil"} />
                  {opcoes?.modo === "uv" && (
                    <Info rotulo="TOYO" valor={opcoes.contrair ? `Contraído ${fmtNum(opcoes.distanciaMm)} mm` : "Sem contração"} />
                  )}
                  {L.itens.length === 1 ? (
                    <>
                      <Info rotulo="Colunas × linhas" valor={`${L.itens[0].cols} × ${L.itens[0].linhas} (${L.itens[0].posicoes.length} logos)`} />
                      <Info rotulo="Cada logo" valor={`${fmt(L.itens[0].W / CM)} × ${fmt(L.itens[0].H / CM)} cm`} />
                    </>
                  ) : (
                    <Info rotulo="Logos na folha" valor={`${L.itens.length} logos · ${L.itens.reduce((a, li) => a + li.posicoes.length, 0)} unidades`} />
                  )}
                  <Info rotulo="Folha (largura × comprimento)" valor={`${fmt(L.larguraFolha / CM)} × ${fmt(L.alturaFolha / CM)} cm`} />
                  <Info rotulo="Mídia usada" valor={`${fmt(L.alturaFolha / CM / 100)} m lineares`} />
                </dl>

                {L.itens.length > 1 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Logo</th>
                          <th className="py-1.5 pr-3 font-medium">Tamanho</th>
                          <th className="py-1.5 pr-3 font-medium">Colunas × linhas</th>
                          <th className="py-1.5 font-medium">Qtd.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {L.itens.map((li, k) => (
                          <tr key={k} className="border-t border-slate-100">
                            <td className="max-w-[180px] truncate py-2 pr-3 font-semibold text-slate-900">
                              {rotulos[k]?.numero ?? k + 1}. {rotulos[k]?.nome}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{fmt(li.W / CM)} × {fmt(li.H / CM)} cm</td>
                            <td className="py-2 pr-3 tabular-nums">{li.cols} × {li.linhas}</td>
                            <td className="py-2 tabular-nums">{li.posicoes.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(cartela.avisos.length > 0 || incompletos.length > 0) && (
                  <ul className="mt-4 space-y-2">
                    {incompletos.map(({ numero }) => (
                      <Aviso key={`inc-${numero}`}>A logo {numero} está sem largura ou quantidade válida e ficou fora da cartela.</Aviso>
                    ))}
                    {cartela.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={baixar}
                  disabled={gerando}
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white shadow-[0_8px_20px_-8px_rgba(25,168,74,0.7)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                  style={{ backgroundColor: VERDE }}
                >
                  {gerando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  Baixar PDF
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">{cartela.nome}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-extrabold" style={{ color: AZUL_ESCURO }}>Pré-visualização</h2>
                <p className="mb-3 text-xs text-slate-500">
                  Render do PDF gerado.
                  {opcoes?.modo === "uv" && " A camada TOYO aparece na cor de visualização, por cima da logo: aproxime para ver a borda da original em volta do TOYO."}
                </p>
                <VisualizadorPdf pdf={cartela.pdf} alvos={alvos} />
              </div>
            </>
          )}
          {!cartela && gerando && (
            <Vazio>
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> Gerando a cartela…
            </Vazio>
          )}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ cartão de cada logo */

function CartaoLogo(props: {
  numero: number;
  item: ItemForm;
  erros: { largura?: string; qtd?: string };
  podeRemover: boolean;
  onArquivos: (files: File[]) => void;
  onMudar: (m: Partial<ItemForm>) => void;
  onRemover: () => void;
}) {
  const { numero, item, erros } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const logo = item.logo;

  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: AZUL_ESCURO }}>Logo {numero}</span>
        {props.podeRemover && (
          <button
            type="button"
            onClick={props.onRemover}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Remover
          </button>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); props.onArquivos(Array.from(e.dataTransfer.files ?? [])); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 text-center transition ${logo ? "min-h-[76px] py-3" : "min-h-[110px] py-5"}`}
        style={{ borderColor: arrastando ? AZUL : "#CBD5E1", background: arrastando ? "#EEF4FD" : "#F8FAFC" }}
      >
        {item.lendo ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        ) : !logo ? (
          <FileUp className="h-6 w-6 text-slate-400" />
        ) : null}
        {logo ? (
          <>
            <span className="break-all text-sm font-semibold text-slate-800">{logo.nome}</span>
            <span className="text-xs text-slate-500">
              Original: {fmt(logo.caixa.width / CM)} × {fmt(logo.caixa.height / CM)} cm · clique ou arraste para trocar
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-slate-700">Arraste o PDF aqui ou clique para escolher</span>
            <span className="text-xs text-slate-500">PDF vetorial, página 1. Pode soltar vários de uma vez.</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => { props.onArquivos(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>
      {item.erro && <Erro>{item.erro}</Erro>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <CampoNumero rotulo="Largura (cm)" valor={item.largura} onChange={(v) => props.onMudar({ largura: v })} erro={erros.largura} placeholder="ex.: 7" obrigatorio />
        <CampoNumero rotulo="Quantidade" valor={item.qtd} onChange={(v) => props.onMudar({ qtd: v })} erro={erros.qtd} placeholder="ex.: 30" obrigatorio inteiro />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ peças de UI */

const inputCls = (erro: boolean) =>
  `h-12 w-full rounded-xl border bg-slate-50 px-3.5 text-[15px] text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
    erro ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-[#1464D2] focus:ring-[#1464D2]/10"
  }`;

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{children}</span>;
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[13px] font-medium text-red-600">{children}</p>;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {children}
    </li>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-[15px] text-slate-500">
      {children}
    </div>
  );
}

function CampoNumero(props: {
  rotulo: string; valor: string; onChange: (v: string) => void; erro?: string;
  placeholder?: string; obrigatorio?: boolean; inteiro?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <Rotulo>
        {props.rotulo}
        {props.obrigatorio && <span className="text-red-500"> *</span>}
      </Rotulo>
      <input
        inputMode={props.inteiro ? "numeric" : "decimal"}
        value={props.valor}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputCls(!!props.erro)}
      />
      {props.erro && <Erro>{props.erro}</Erro>}
    </label>
  );
}

function Opcao({ ativo, onClick, titulo, sub }: { ativo: boolean; onClick: () => void; titulo: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className="flex min-h-[64px] flex-col items-start justify-center rounded-xl border-2 px-3.5 py-2.5 text-left transition"
      style={{ borderColor: ativo ? AZUL : "#E2E8F0", background: ativo ? "#EEF4FD" : "#fff" }}
    >
      <span className="text-[15px] font-bold" style={{ color: ativo ? AZUL : "#1E293B" }}>{titulo}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </button>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="break-words font-semibold text-slate-900">{valor}</dd>
    </div>
  );
}
