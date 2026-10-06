import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ChevronDown, Download, FileUp, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CM, ErroCartela, lerNumero, type CaixaLogo, type Distribuicao } from "@/lib/cartelaDtf/layout";
import {
  CMYK_PADRAO, DISTANCIA_PADRAO_MM, SPOT_PADRAO, gerarCartela, lerLogo,
  type Cartela, type Modo, type OpcoesCartela,
} from "@/lib/cartelaDtf/gerarCartela";

/* Gerador de cartela de DTF (têxtil e UV com TOYO). Ferramenta interna,
   atrás do AdminGuard. Tudo roda no navegador: a logo do cliente nunca
   sai da máquina de quem está usando. Detalhes em src/lib/cartelaDtf/README.md */

const AZUL_ESCURO = "#0E2A57";
const VERDE = "#19A84A";
const AZUL = "#1464D2";

const fmt = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

interface Logo {
  nome: string;
  bytes: Uint8Array;
  caixa: CaixaLogo;
}

interface Campos {
  largura: string;
  qtd: string;
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
  largura: "",
  qtd: "",
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

type Erros = Partial<Record<keyof Campos | "cmyk", string>>;

/** Valida os campos; devolve as opções prontas ou os erros por campo. */
function validar(c: Campos): { opcoes: OpcoesCartela | null; erros: Erros; avisoDistancia: string | null } {
  const erros: Erros = {};
  const largura = lerNumero(c.largura);
  const qtd = lerNumero(c.qtd);
  const espaco = lerNumero(c.espaco);
  const folha = lerNumero(c.folha);
  const margem = lerNumero(c.margem);
  const distancia = lerNumero(c.distancia);
  const cmyk = c.cmyk.map(lerNumero) as [number, number, number, number];

  if (!c.largura.trim()) erros.largura = "Informe a largura da logo.";
  else if (!(largura > 0)) erros.largura = "Largura inválida: use um número maior que zero.";
  if (!c.qtd.trim()) erros.qtd = "Informe a quantidade.";
  else if (!(qtd >= 1) || !Number.isInteger(qtd)) erros.qtd = "Quantidade inválida: use um número inteiro a partir de 1.";
  else if (qtd > 20000) erros.qtd = "Quantidade muito alta (máximo 20.000 por cartela).";
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
      larguraCm: largura, qtd, espacoCm: espaco, folhaMaxCm: folha, margemCm: margem,
      distribuicao: c.distribuicao, modo: c.modo, contrair: c.modo === "uv" && c.contrair,
      distanciaMm: distancia, spot: c.spot.trim(), cmyk,
    },
  };
}

export default function CartelaDtf() {
  const [logo, setLogo] = useState<Logo | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [avancado, setAvancado] = useState(false);
  const [cartela, setCartela] = useState<Cartela | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setCampos((c) => ({ ...c, [k]: v }));
  const { opcoes, erros, avisoDistancia } = useMemo(() => validar(campos), [campos]);
  // campo obrigatório vazio só fica vermelho depois que a logo foi enviada
  const erroVisivel = (k: "largura" | "qtd") => (campos[k].trim() || logo ? erros[k] : undefined);

  const abrirArquivo = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setErroArquivo(null);
    setCartela(null);
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setErroArquivo("O arquivo precisa ser PDF: envie um PDF vetorial exportado do Corel/Illustrator.");
      return;
    }
    setLendo(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { caixa } = await lerLogo(bytes);
      setLogo({ nome: file.name, bytes, caixa });
    } catch (e) {
      setLogo(null);
      setErroArquivo(e instanceof ErroCartela ? e.message : "Não foi possível ler o PDF: envie um PDF vetorial exportado do Corel/Illustrator.");
    } finally {
      setLendo(false);
    }
  }, []);

  // gera de novo (com um pequeno atraso) sempre que a logo ou os campos mudam
  const geracao = useRef(0);
  useEffect(() => {
    if (!logo || !opcoes) {
      setCartela(null);
      setErroGeracao(null);
      return;
    }
    const id = ++geracao.current;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const c = await gerarCartela(logo.bytes, opcoes);
        if (id !== geracao.current) return;
        setCartela(c);
        setErroGeracao(null);
      } catch (e) {
        if (id !== geracao.current) return;
        console.error("[carteladtf]", e);
        setCartela(null);
        setErroGeracao(e instanceof ErroCartela ? e.message : "Não foi possível gerar a cartela com essa logo.");
      } finally {
        if (id === geracao.current) setGerando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [logo, opcoes]);

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
          <div>
            <Rotulo>Arquivo da logo (PDF vetorial)</Rotulo>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); abrirArquivo(e.dataTransfer.files?.[0]); }}
              className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition"
              style={{ borderColor: arrastando ? AZUL : "#CBD5E1", background: arrastando ? "#EEF4FD" : "#F8FAFC" }}
            >
              {lendo ? (
                <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
              ) : (
                <FileUp className="h-7 w-7 text-slate-400" />
              )}
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
                  <span className="text-xs text-slate-500">Página 1 do PDF. O arquivo não sai do seu computador.</span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => { abrirArquivo(e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>
            {erroArquivo && <Erro>{erroArquivo}</Erro>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CampoNumero rotulo="Largura da logo (cm)" valor={campos.largura} onChange={(v) => set("largura", v)} erro={erroVisivel("largura")} placeholder="ex.: 7" obrigatorio />
            <CampoNumero rotulo="Quantidade" valor={campos.qtd} onChange={(v) => set("qtd", v)} erro={erroVisivel("qtd")} placeholder="ex.: 30" obrigatorio inteiro />
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
                    <input
                      value={campos.spot}
                      onChange={(e) => set("spot", e.target.value)}
                      className={inputCls(!!erros.spot)}
                    />
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
          {!logo && (
            <Vazio>Envie a logo e informe a largura e a quantidade para ver a cartela.</Vazio>
          )}
          {logo && !opcoes && <Vazio>Preencha a largura e a quantidade para montar a cartela.</Vazio>}
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
                  <Info rotulo="Colunas × linhas" valor={`${L.cols} × ${L.linhas} (${L.posicoes.length} logos)`} />
                  <Info rotulo="Folha (largura × comprimento)" valor={`${fmt(L.larguraFolha / CM)} × ${fmt(L.alturaFolha / CM)} cm`} />
                  <Info rotulo="Cada logo" valor={`${fmt(L.W / CM)} × ${fmt(L.H / CM)} cm`} />
                  <Info rotulo="Mídia usada" valor={`${fmt(L.alturaFolha / CM / 100)} m lineares`} />
                </dl>

                {cartela.avisos.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {cartela.avisos.map((a) => (
                      <li key={a} className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {a}
                      </li>
                    ))}
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
                  Render do PDF gerado.{opcoes?.modo === "uv" && " A camada TOYO aparece na cor de visualização, por cima da logo."}
                </p>
                <Previa pdf={cartela.pdf} />
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

/* ------------------------------------------------------------ pré-visualização */

const MAX_PIXELS = 24_000_000;

function Previa({ pdf }: { pdf: Uint8Array }) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let tarefa: { cancel: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        // o pdf.js transfere o buffer para o worker: passa uma cópia
        const doc = await pdfjs.getDocument({ data: pdf.slice() }).promise;
        const pagina = await doc.getPage(1);
        if (cancelado) return;
        const base = pagina.getViewport({ scale: 1 });
        const largura = caixaRef.current?.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let escala = (largura / base.width) * dpr;
        const px = base.width * base.height * escala * escala;
        if (px > MAX_PIXELS) escala *= Math.sqrt(MAX_PIXELS / px);
        const vp = pagina.getViewport({ scale: escala });
        const canvas = canvasRef.current!;
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        canvas.style.width = `${largura}px`;
        canvas.style.height = `${(largura * base.height) / base.width}px`;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const render = pagina.render({ canvasContext: ctx, viewport: vp });
        tarefa = render;
        await render.promise;
        setErro(null);
      } catch (e: unknown) {
        if (!cancelado && (e as { name?: string })?.name !== "RenderingCancelledException") {
          setErro("Não foi possível desenhar a pré-visualização (o PDF para download não é afetado).");
        }
      }
    })();
    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [pdf]);

  return (
    <div ref={caixaRef} className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] [background-size:16px_16px]">
      {erro ? <p className="p-4 text-sm text-slate-500">{erro}</p> : <canvas ref={canvasRef} className="block" />}
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
