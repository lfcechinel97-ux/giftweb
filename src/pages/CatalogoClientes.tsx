import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_NUMERO, ESTILO_CATALOGO } from "./catalogoClientes.styles";
import {
  type FaixaPreco, brl, brlPartes, faixasDoProduto, indiceDaFaixa,
  passoDaQuantidade, quantidadeInicial, type ProdutoComPreco,
} from "@/lib/catalogoPrecos";

/**
 * Catálogo enviado por link no WhatsApp.
 *
 * Le direto de catalogo_clientes, entao tudo que for editado em
 * /admin/catalogo-clientes aparece aqui na hora, sem deploy.
 *
 * O carrinho vive so em memoria de proposito (nada de storage). Ele carrega a
 * ESCADA de cada item, nao um preco fechado: mudar a quantidade dentro do
 * carrinho pode trocar o degrau, e um preco copiado na hora de adicionar
 * ficaria defasado - o cliente veria um valor e o consultor outro.
 */

interface Cor { n: string; h: string | string[]; }
interface Produto extends ProdutoComPreco {
  id: string; codigo: string; nome: string;
  categoria: string; categoria_rotulo: string | null;
  grupo: string | null; grupo_rotulo: string | null;
  preco: number | null;
  imagem_url: string | null; imagem_secundaria_url: string | null;
  cores: Cor[]; destaque: boolean; ordem: number;
}
/** passo e faixas viajam junto: no carrinho nao ha mais o produto para consultar. */
interface ItemCarrinho {
  codigo: string; nome: string; img: string | null; qtd: number; passo: number;
  /** null no produto sem escada configurada - fica "sob consulta". */
  faixas: FaixaPreco[] | null;
}

const MAX_BOLINHAS = 6;
/**
 * Teto do texto do wa.me ja codificado. O limite real varia por aparelho e
 * versao do WhatsApp; abaixo disso nao vi truncamento em lugar nenhum, e passar
 * dele corta o fim da mensagem - justo onde fica o total.
 */
const MAX_TEXTO_WA = 1800;

/**
 * toLocaleString devolve "R$" e o numero separados por espaco NAO-QUEBRAVEL
 * (U+00A0). Na URL isso vira %C2%A0 e, dependendo do aparelho, aparece como
 * caractere estranho no WhatsApp. Troca por espaco comum antes de codificar.
 */
const moeda = (v: number) => brl(v).replace(/\u00a0/g, " ");

const BENEFICIOS = [
  { t: "Personalização inclusa", d: "Arte e gravação já no valor do produto" },
  { t: "Entrega para todo o Brasil", d: "Envio para qualquer cidade, com prazo confirmado" },
  { t: "Atendimento consultivo", d: "A gente ajuda a escolher o brinde certo" },
  { t: "Pedido a partir de 20 un.", d: "Quantidade mínima acessível para começar" },
];

const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const corCss = (h: string | string[]) =>
  Array.isArray(h) ? `linear-gradient(135deg, ${h[0]} 0 50%, ${h[1]} 50% 100%)` : h;

/**
 * Em celular o navegador dispara mouseenter junto do toque, o que brigaria com
 * o clique e cancelaria a troca de foto. Marcando o primeiro toque real, o
 * hover passa a valer so onde de fato existe mouse.
 */
let _usouToque = false;
if (typeof window !== "undefined") {
  window.addEventListener("touchstart", () => { _usouToque = true; }, { once: true, passive: true });
}
const usouToque = () => _usouToque;

/** Unitario do item para a quantidade atual, ou null se nao ha degrau para ela. */
const unitarioDoItem = (i: ItemCarrinho): number | null => {
  if (!i.faixas) return null;
  const k = indiceDaFaixa(i.faixas, i.qtd);
  return k < 0 ? null : i.faixas[k].valor;
};
const subtotalDoItem = (i: ItemCarrinho): number | null => {
  const u = unitarioDoItem(i);
  return u === null ? null : u * i.qtd;
};

/**
 * Card fica FORA do componente da pagina de proposito. Declarado dentro, o
 * React trata como um tipo novo a cada render e remonta os 128 cards a cada
 * tecla digitada na busca ou clique de quantidade - o que alem de lento
 * derrubava os handlers no meio da interacao.
 */
const Card = memo(function Card({
  p, qtd, marcado, onQtd, onAdd,
}: {
  p: Produto; qtd: number; marcado: boolean;
  onQtd: (v: number) => void; onAdd: () => void;
}) {
  // Um unico estado controla qual foto aparece, alimentado por hover (mouse) e
  // por toque (celular). A opacidade vai inline de proposito: com classe + CSS
  // alguma regra do site vencia a especificidade e a troca nao acontecia.
  const [mostrandoAlt, setMostrandoAlt] = useState(false);
  const temSegunda = !!p.imagem_secundaria_url;
  const passo = passoDaQuantidade(p);

  // Produto sem as tres faixas configuradas cai no "a partir de" de antes.
  const faixas = faixasDoProduto(p);
  const iAtiva = faixas ? indiceDaFaixa(faixas, qtd) : -1;
  const ultima = faixas ? faixas.length - 1 : -1;
  // Linha de apoio sempre presente: some/aparecer empurraria o card e mexeria
  // na altura da linha inteira do grid a cada clique de quantidade.
  // Aponta o proximo degrau MAIS BARATO, nao simplesmente o seguinte: ha
  // produto com dois degraus no mesmo valor (o chaveiro 09824 cobra R$ 1,99
  // tanto a 100 quanto a 200 un.), e ali "Leve 200 un. e pague R$ 1,99" seria
  // um convite a pagar o mesmo preco.
  const proximo =
    faixas && iAtiva >= 0
      ? faixas.slice(iAtiva + 1).find((f) => f.valor < faixas[iAtiva].valor)
      : undefined;
  const dica = !faixas
    ? null
    : iAtiva < 0
      ? `Preço de tabela a partir de ${faixas[0].min} un.`
      : proximo
        ? `Leve ${proximo.min} un. e pague ${brl(proximo.valor)}`
        : "Você está no melhor preço";

  return (
    <article className="gwc-card">
      <div
        className={`gwc-ph ${temSegunda ? "tem2" : ""}`}
        onMouseEnter={temSegunda && !usouToque() ? () => setMostrandoAlt(true) : undefined}
        onMouseLeave={temSegunda && !usouToque() ? () => setMostrandoAlt(false) : undefined}
        onClick={temSegunda ? () => setMostrandoAlt((v) => !v) : undefined}
      >
        {p.destaque && <span className="gwc-tag">Mais vendido</span>}
        {p.imagem_url && (
          <img
            className="f1"
            src={p.imagem_url}
            alt={p.nome}
            loading="lazy"
            style={{ opacity: mostrandoAlt ? 0 : 1 }}
          />
        )}
        {temSegunda && (
          <img
            className="f2"
            src={p.imagem_secundaria_url!}
            alt=""
            loading="lazy"
            style={{ opacity: mostrandoAlt ? 1 : 0 }}
          />
        )}
        {temSegunda && (
          <span className="gwc-lupa" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            2
          </span>
        )}
      </div>
      <div className="gwc-info">
        <h3>{p.nome}</h3>
        {p.cores?.length >= 2 && (
          <div className="gwc-cores">
            {p.cores.slice(0, MAX_BOLINHAS).map((c, i) => (
              <i key={i} title={c.n} style={{ background: corCss(c.h) }} />
            ))}
            {p.cores.length > MAX_BOLINHAS && <u>+{p.cores.length - MAX_BOLINHAS}</u>}
          </div>
        )}
        {faixas ? (
          <>
            <div className={`gwc-faixas ${faixas.some((f) => f.valor >= 100) ? "compacta" : ""}`}>
              {faixas.map((f, i) => (
                // Clicavel: quem toca no preco espera levar a quantidade junto.
                <button
                  key={f.min}
                  type="button"
                  aria-pressed={i === iAtiva}
                  className={`${f.melhor ? "best " : ""}${i === iAtiva ? "on" : ""}`}
                  onClick={() => onQtd(f.min)}
                >
                  <span>{f.rotulo}</span>
                  <b><i>R$</i>{brlPartes(f.valor).valor}</b>
                  {f.melhor && <em>Melhor preço</em>}
                </button>
              ))}
            </div>
            <p className={`gwc-dica ${iAtiva === ultima ? "top" : ""}`}>{dica}</p>
          </>
        ) : (
          <div className="gwc-price">
            <small>A partir de</small>
            <b>{p.preco != null ? brl(p.preco) : "sob consulta"}</b>
          </div>
        )}
        <div className="gwc-actions">
          <div className="gwc-qty">
            <button onClick={() => onQtd(qtd - passo)} aria-label="Menos">−</button>
            <span>{qtd} <i>un</i></span>
            <button onClick={() => onQtd(qtd + passo)} aria-label="Mais">+</button>
          </div>
          <button className={`gwc-add ${marcado ? "ok" : ""}`} onClick={onAdd}>
            {marcado ? "Adicionado ✓" : "Adicionar"}
          </button>
        </div>
      </div>
    </article>
  );
});

const Beneficios = () => (
  <div className="gwc-benband">
    <div className="gwc-bh">POR QUE COMPRAR NA GIFT WEB</div>
    <div className="gwc-bens">
      {BENEFICIOS.map((b) => (
        <div className="gwc-ben" key={b.t}>
          <strong>{b.t}</strong>
          <span>{b.d}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function CatalogoClientes() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [onboarding, setOnboarding] = useState(true);
  const [adicionado, setAdicionado] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const caroRef = useRef<HTMLDivElement>(null);
  const storiesRef = useRef<HTMLDivElement>(null);

  /**
   * Busca no primeiro render e sempre que a aba volta a ficar visivel.
   *
   * O catalogo e um link que o cliente recebe no WhatsApp e costuma deixar
   * aberto por horas. Buscando so na montagem, um preco alterado no /admin nao
   * chegava a quem ja estava com a pagina aberta - ele seguia vendo o valor de
   * quando abriu. A janela de 30s evita repetir a consulta a cada alt-tab.
   */
  useEffect(() => {
    let vivo = true;
    let ultimaBusca = 0;

    const buscar = async (primeira: boolean) => {
      ultimaBusca = Date.now();
      const { data, error } = await supabase
        .from("catalogo_clientes" as never)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (!vivo) return;
      // numa rebusca, uma falha de rede nao derruba o catalogo que ja esta na
      // tela: mantem o que tem e tenta de novo no proximo foco
      if (error) {
        if (primeira) setErro(error.message);
      } else {
        setProdutos((data as unknown as Produto[]) ?? []);
        setErro(null);
      }
      if (primeira) setCarregando(false);
    };

    buscar(true);

    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaBusca > 30_000) {
        buscar(false);
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);

  /* dica de rolagem nos stories, igual a versao estatica */
  useEffect(() => {
    if (carregando || onboarding) return;
    const s = storiesRef.current;
    if (!s || s.scrollWidth <= s.clientWidth + 8) return;
    const t1 = setTimeout(() => {
      s.scrollTo({ left: 72, behavior: "smooth" });
      setTimeout(() => s.scrollTo({ left: 0, behavior: "smooth" }), 640);
    }, 700);
    return () => clearTimeout(t1);
  }, [carregando, onboarding]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { slug: string; rot: string; n: number }>();
    produtos.forEach((p) => {
      if (!p.grupo) return;
      const atual = mapa.get(p.grupo);
      if (atual) atual.n++;
      else mapa.set(p.grupo, { slug: p.grupo, rot: p.grupo_rotulo || p.grupo, n: 1 });
    });
    return [...mapa.values()];
  }, [produtos]);

  const secoes = useMemo(() => {
    const ordem: string[] = [];
    const mapa = new Map<string, Produto[]>();
    produtos.forEach((p) => {
      if (!mapa.has(p.categoria)) { mapa.set(p.categoria, []); ordem.push(p.categoria); }
      mapa.get(p.categoria)!.push(p);
    });
    return ordem.map((c) => ({
      nome: c,
      rot: mapa.get(c)![0].categoria_rotulo || c,
      itens: mapa.get(c)!,
    }));
  }, [produtos]);

  const destaques = useMemo(() => produtos.filter((p) => p.destaque), [produtos]);

  const filtrando = !!busca.trim() || !!grupoAtivo;
  const passaNoFiltro = (p: Produto) => {
    const t = norm(busca.trim());
    const alvo = norm(`${p.nome} ${p.categoria} ${p.codigo}`);
    return (!t || alvo.includes(t)) && (!grupoAtivo || p.grupo === grupoAtivo);
  };
  const totalVisiveis = produtos.filter(passaNoFiltro).length;

  // A quantidade inicial e o minimo do proprio produto: 20 un. no geral, 100
  // em caneta, sacola e chaveiro, onde o fornecedor so vende a partir dai.
  const qtdDe = (p: Produto) => qtds[p.codigo] ?? quantidadeInicial(p);
  const setQtd = (p: Produto, v: number) =>
    setQtds((q) => ({ ...q, [p.codigo]: Math.max(quantidadeInicial(p), v) }));

  const adicionar = (p: Produto) => {
    const q = qtdDe(p);
    setCarrinho((c) => {
      const ex = c.find((i) => i.codigo === p.codigo);
      return ex
        ? c.map((i) => (i.codigo === p.codigo ? { ...i, qtd: i.qtd + q } : i))
        : [...c, { codigo: p.codigo, nome: p.nome, img: p.imagem_url, qtd: q,
                   passo: passoDaQuantidade(p), faixas: faixasDoProduto(p) }];
    });
    setQtds((s) => ({ ...s, [p.codigo]: quantidadeInicial(p) }));
    setAdicionado(p.codigo);
    setTimeout(() => setAdicionado(null), 1200);
    setToast(`${q} unidades adicionadas`);
  };
  // O "-" para no minimo do produto em vez de descer ate 1: abaixo do primeiro
  // degrau nao existe preco de tabela, e a linha ficaria sem valor no meio de um
  // carrinho somado. Para tirar o item existe o "remover" (que manda 0).
  const mudarQtdCarrinho = (codigo: string, nova: number) =>
    setCarrinho((c) =>
      nova < 1
        ? c.filter((i) => i.codigo !== codigo)
        : c.map((i) =>
            i.codigo === codigo
              ? { ...i, qtd: Math.max(i.faixas?.[0].min ?? 1, nova) }
              : i));
  const totalItens = carrinho.reduce((s, i) => s + i.qtd, 0);
  const totalValor = carrinho.reduce((s, i) => s + (subtotalDoItem(i) ?? 0), 0);
  const semPreco = carrinho.filter((i) => subtotalDoItem(i) === null).length;

  const linkWhatsApp = useMemo(() => {
    if (!carrinho.length) return "#";

    // Uma linha por item, detalhada. Se o carrinho crescer a ponto de a URL
    // passar do limite seguro, cai para a forma curta (so quantidade e
    // subtotal) - vale perder o "x unitario" e nao perder o fim da mensagem.
    const linha = (i: ItemCarrinho, curta: boolean) => {
      const u = unitarioDoItem(i);
      const sub = subtotalDoItem(i);
      const cabeca = `- ${i.nome} (cod ${i.codigo}): ${i.qtd} un`;
      if (u === null || sub === null) return `${cabeca} - valor sob consulta`;
      return curta
        ? `${cabeca} - ${moeda(sub)}`
        : `${cabeca} x ${moeda(u)} = ${moeda(sub)}`;
    };

    const resumo =
      totalValor > 0
        ? `Total: ${totalItens} un - ${moeda(totalValor)}` +
          (semPreco
            ? ` (+ ${semPreco} ${semPreco === 1 ? "item" : "itens"} sob consulta)`
            : "")
        : `Total: ${totalItens} un`;

    const montar = (linhas: string[], escondidos: number) => {
      const lista = escondidos
        ? [...linhas, `- ... e mais ${escondidos} ${escondidos === 1 ? "item" : "itens"}`]
        : linhas;
      return (
        `Olá! Tenho interesse nestes brindes:\n\n${lista.join("\n")}\n\n${resumo}\n` +
        `Valores do catálogo por faixa de quantidade, a confirmar com o consultor.`
      );
    };
    const cabe = (t: string) => encodeURIComponent(t).length <= MAX_TEXTO_WA;

    // 1) tudo detalhado; 2) tudo em forma curta; 3) forma curta cortando itens do
    // fim ate caber. O total e a linha de fecho entram em todas as formas: se
    // algo tem de se perder, que sejam os itens do meio, nunca o valor total.
    const detalhado = montar(carrinho.map((i) => linha(i, false)), 0);
    if (cabe(detalhado)) {
      return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(detalhado)}`;
    }
    const curtas = carrinho.map((i) => linha(i, true));
    let n = curtas.length;
    let texto = montar(curtas, 0);
    while (n > 1 && !cabe(texto)) {
      n -= 1;
      texto = montar(curtas.slice(0, n), curtas.length - n);
    }
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
  }, [carrinho, totalItens, totalValor, semPreco]);

  const selecionarGrupo = (slug: string) => {
    setGrupoAtivo((g) => (g === slug ? null : slug));
    setBusca("");
    setTimeout(() => {
      const el = storiesRef.current;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - 60, behavior: "smooth" });
    }, 40);
  };

  const cardProps = (p: Produto) => ({
    p,
    qtd: qtdDe(p),
    marcado: adicionado === p.codigo,
    onQtd: (v: number) => setQtd(p, v),
    onAdd: () => adicionar(p),
  });

  return (
    <>
      <Helmet>
        <title>Catálogo Gift Web Brindes</title>
        <meta name="description" content="Catálogo de brindes corporativos personalizados. Monte seu pedido e finalize no WhatsApp." />
      </Helmet>
      <style>{ESTILO_CATALOGO}</style>

      <div className="gwc">
        <header className="gwc-header">
          <div className="gwc-hrow">
            <div className="gwc-brand">
              <img src="/logos/giftweb-logo.png" alt="Gift Web Brindes" />
              <b>Gift Web</b>
            </div>
            <div className="gwc-search">
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); if (e.target.value.trim()) setGrupoAtivo(null); }}
                placeholder="Buscar brinde..."
                type="search"
              />
            </div>
          </div>
        </header>

        <main className="gwc-main">
          <div className="gwc-bwrap">
            <img src="/catalogo/banner.jpg" alt="Catálogo mais vendidos Gift Web" />
          </div>

          {carregando ? (
            <div className="gwc-estado">Carregando catálogo...</div>
          ) : erro ? (
            <div className="gwc-estado">
              Não consegui carregar o catálogo agora.<br />
              <small>{erro}</small>
            </div>
          ) : produtos.length === 0 ? (
            <div className="gwc-estado">Nenhum produto disponível no momento.</div>
          ) : (
            <>
              {!busca.trim() && (
                <div className="gwc-stwrap">
                  <div className="gwc-stories" ref={storiesRef}>
                    {grupos.map((g) => (
                      <button
                        key={g.slug}
                        className={`gwc-st ${grupoAtivo === g.slug ? "on" : ""}`}
                        onClick={() => selecionarGrupo(g.slug)}
                      >
                        <div className="gwc-circ">
                          <img src={`/catalogo/grupo-${g.slug}.png`} alt="" loading="lazy" />
                        </div>
                        <span>{g.rot}</span>
                      </button>
                    ))}
                  </div>
                  <div className="gwc-stfade" />
                </div>
              )}

              {grupoAtivo && !busca.trim() && (
                <div className="gwc-filtro">
                  <span>Mostrando <b>{grupos.find((g) => g.slug === grupoAtivo)?.rot}</b></span>
                  <button onClick={() => setGrupoAtivo(null)}>✕ limpar</button>
                </div>
              )}

              {!filtrando && destaques.length > 0 && (
                <section>
                  <p className="gwc-cursivo">Os Mais Vendidos</p>
                  <div className="gwc-carowrap">
                    <button className="gwc-caroarrow l"
                      onClick={() => caroRef.current?.scrollBy({ left: -caroRef.current.clientWidth * 0.8, behavior: "smooth" })}
                      aria-label="Anterior">‹</button>
                    <div className="gwc-caro" ref={caroRef}>
                      {destaques.map((p) => <Card key={p.id} {...cardProps(p)} />)}
                    </div>
                    <button className="gwc-caroarrow r"
                      onClick={() => caroRef.current?.scrollBy({ left: caroRef.current.clientWidth * 0.8, behavior: "smooth" })}
                      aria-label="Próximo">›</button>
                  </div>
                </section>
              )}

              {secoes.map((s, i) => {
                const itens = s.itens.filter(passaNoFiltro);
                if (!itens.length) return null;
                return (
                  <div key={s.nome}>
                    <section>
                      <div className="gwc-head">
                        <h2>{s.rot}</h2>
                        <span>{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                      </div>
                      <div className="gwc-grid">
                        {itens.map((p) => <Card key={p.id} {...cardProps(p)} />)}
                      </div>
                    </section>
                    {!filtrando && i % 3 === 2 && i < secoes.length - 1 && <Beneficios />}
                  </div>
                );
              })}

              {filtrando && totalVisiveis === 0 && (
                <p className="gwc-estado">Nenhum produto encontrado.<br />Tente outro termo.</p>
              )}
              {!filtrando && <Beneficios />}
            </>
          )}

          <footer className="gwc-footer">
            <b>Gift Web Brindes</b>
            Brindes corporativos personalizados<br />
            Valores sujeitos a confirmação conforme quantidade e personalização.
          </footer>
        </main>

        <button
          className={`gwc-fab ${carrinho.length === 0 ? "zero" : ""}`}
          onClick={() => setDrawerAberto(true)}
          aria-label="Abrir pedido"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          <span className="fl">Meu pedido</span>
          <span className="fc">{totalItens}</span>
        </button>

        <div className={`gwc-ov ${drawerAberto ? "on" : ""}`} onClick={() => setDrawerAberto(false)} />
        <aside className={`gwc-drawer ${drawerAberto ? "on" : ""}`}>
          <div className="gwc-dh">
            <h2>Meu pedido</h2>
            <button onClick={() => setDrawerAberto(false)} aria-label="Fechar">✕</button>
          </div>
          <div className="gwc-ditems">
            {carrinho.length === 0 ? (
              <div className="gwc-empty">Seu pedido está vazio.<br />Adicione produtos do catálogo.</div>
            ) : (
              carrinho.map((i) => (
                <div className="gwc-ci" key={i.codigo}>
                  {i.img && <img src={i.img} alt="" />}
                  <div className="d">
                    <h4>{i.nome}</h4>
                    <div className="r">
                      <div className="q">
                        <button onClick={() => mudarQtdCarrinho(i.codigo, i.qtd - i.passo)}>−</button>
                        <span>{i.qtd}</span>
                        <button onClick={() => mudarQtdCarrinho(i.codigo, i.qtd + i.passo)}>+</button>
                      </div>
                      <button className="rm" onClick={() => mudarQtdCarrinho(i.codigo, 0)}>remover</button>
                    </div>
                    <div className="v">
                      {subtotalDoItem(i) !== null ? (
                        <>
                          <span>{brl(unitarioDoItem(i)!)} /un</span>
                          <b>{brl(subtotalDoItem(i)!)}</b>
                        </>
                      ) : (
                        <span>valor sob consulta</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="gwc-df">
            <div className="gwc-resumo">
              <span>{totalItens} {totalItens === 1 ? "unidade" : "unidades"}</span>
              <b>{totalValor > 0 ? brl(totalValor) : "sob consulta"}</b>
            </div>
            {semPreco > 0 && totalValor > 0 && (
              <p className="gwc-parcial">
                + {semPreco} {semPreco === 1 ? "item" : "itens"} sob consulta
              </p>
            )}
            <a
              className="gwc-wa"
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              {...(carrinho.length === 0 ? { "aria-disabled": true, tabIndex: -1 } : {})}
            >
              Finalizar no WhatsApp
            </a>
            <p className="gwc-hint">Valores do catálogo por faixa de quantidade<br />frete e prazo confirmados com o consultor</p>
          </div>
        </aside>

        {onboarding && (
          <div className="gwc-ob" onClick={() => setOnboarding(false)}>
            <div className="gwc-obc" onClick={(e) => e.stopPropagation()}>
              <div className="gwc-obh">
                <img src="/logos/giftweb-logo.png" alt="" />
                <h2>Como fazer seu pedido</h2>
                <p>São 3 passos rápidos, direto por aqui</p>
              </div>
              <div className="gwc-obb">
                <div className="gwc-step"><div className="n">1</div><div>
                  <h3>Escolha os produtos</h3>
                  <p>Role o catálogo, toque nas categorias do topo ou use a busca.</p>
                </div></div>
                <div className="gwc-step"><div className="n">2</div><div>
                  <h3>Defina a quantidade e adicione</h3>
                  <p>Use os atalhos de 50 e 100 unidades ou ajuste no + e −. Depois toque em Adicionar.</p>
                  <span className="gwc-mini g">Adicionar</span>
                </div></div>
                <div className="gwc-step"><div className="n">3</div><div>
                  <h3>Finalize no WhatsApp</h3>
                  <p>Com tudo escolhido, toque no botão verde do pedido no canto da tela e envie sua lista.</p>
                  <span className="gwc-mini">Meu pedido</span>
                </div></div>
              </div>
              <div className="gwc-obf">
                <button onClick={() => setOnboarding(false)}>Ver o catálogo</button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="gwc-toast">{toast}</div>}
      </div>
    </>
  );
}
