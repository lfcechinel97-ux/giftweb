import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_NUMERO, ESTILO_CATALOGO } from "./catalogoClientes.styles";

/**
 * Catálogo enviado por link no WhatsApp.
 *
 * Le direto de catalogo_clientes, entao tudo que for editado em
 * /admin/catalogo-clientes aparece aqui na hora, sem deploy.
 *
 * O carrinho vive so em memoria de proposito: nao guarda preco porque o valor
 * do card e "a partir de" e o fechamento acontece com o consultor no WhatsApp.
 */

interface Cor { n: string; h: string | string[]; }
interface Produto {
  id: string; codigo: string; nome: string;
  categoria: string; categoria_rotulo: string | null;
  grupo: string | null; grupo_rotulo: string | null;
  preco: number | null; imagem_url: string | null;
  cores: Cor[]; destaque: boolean; ordem: number;
}
interface ItemCarrinho { codigo: string; nome: string; img: string | null; qtd: number; }

const QTD_INICIAL = 10;
const PASSO = 5;
const ATALHOS = [50, 100];
const MAX_BOLINHAS = 6;

const BENEFICIOS = [
  { t: "Personalização inclusa", d: "Arte e gravação já no valor do produto" },
  { t: "Entrega para todo o Brasil", d: "Envio para qualquer cidade, com prazo confirmado" },
  { t: "Atendimento consultivo", d: "A gente ajuda a escolher o brinde certo" },
  { t: "Pedido a partir de 10 un.", d: "Quantidade mínima acessível para começar" },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const corCss = (h: string | string[]) =>
  Array.isArray(h) ? `linear-gradient(135deg, ${h[0]} 0 50%, ${h[1]} 50% 100%)` : h;

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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("catalogo_clientes" as never)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) setErro(error.message);
      else setProdutos((data as unknown as Produto[]) ?? []);
      setCarregando(false);
    })();
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

  const qtdDe = (codigo: string) => qtds[codigo] ?? QTD_INICIAL;
  const setQtd = (codigo: string, v: number) =>
    setQtds((q) => ({ ...q, [codigo]: Math.max(QTD_INICIAL, v) }));

  const adicionar = (p: Produto) => {
    const q = qtdDe(p.codigo);
    setCarrinho((c) => {
      const ex = c.find((i) => i.codigo === p.codigo);
      return ex
        ? c.map((i) => (i.codigo === p.codigo ? { ...i, qtd: i.qtd + q } : i))
        : [...c, { codigo: p.codigo, nome: p.nome, img: p.imagem_url, qtd: q }];
    });
    setQtds((s) => ({ ...s, [p.codigo]: QTD_INICIAL }));
    setAdicionado(p.codigo);
    setTimeout(() => setAdicionado(null), 1200);
    setToast(`${q} unidades adicionadas`);
  };
  const mudarQtdCarrinho = (codigo: string, nova: number) =>
    setCarrinho((c) =>
      nova < 1 ? c.filter((i) => i.codigo !== codigo)
               : c.map((i) => (i.codigo === codigo ? { ...i, qtd: nova } : i)));
  const totalItens = carrinho.reduce((s, i) => s + i.qtd, 0);

  const linkWhatsApp = useMemo(() => {
    if (!carrinho.length) return "#";
    const linhas = carrinho.map((i) => `- ${i.nome} (cod ${i.codigo}) | ${i.qtd} un`);
    const msg =
      `Olá! Tenho interesse nestes brindes:\n\n${linhas.join("\n")}` +
      `\n\nTotal: ${totalItens} unidades.\nPoderia me passar o valor?`;
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;
  }, [carrinho, totalItens]);

  const selecionarGrupo = (slug: string) => {
    setGrupoAtivo((g) => (g === slug ? null : slug));
    setBusca("");
    setTimeout(() => {
      const el = storiesRef.current;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - 60, behavior: "smooth" });
    }, 40);
  };

  const Card = ({ p }: { p: Produto }) => (
    <article className="gwc-card">
      <div className="gwc-ph">
        {p.destaque && <span className="gwc-tag">Mais vendido</span>}
        {p.imagem_url && <img src={p.imagem_url} alt={p.nome} loading="lazy" />}
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
        <div className="gwc-price">
          <small>A partir de</small>
          <b>{p.preco != null ? brl(p.preco) : "sob consulta"}</b>
        </div>
        <div className="gwc-actions">
          <div className="gwc-chips">
            {ATALHOS.map((v) => (
              <button key={v} className={qtdDe(p.codigo) === v ? "on" : ""}
                onClick={() => setQtd(p.codigo, v)}>{v} un</button>
            ))}
          </div>
          <div className="gwc-qty">
            <button onClick={() => setQtd(p.codigo, qtdDe(p.codigo) - PASSO)} aria-label="Menos">−</button>
            <span>{qtdDe(p.codigo)} <i>un</i></span>
            <button onClick={() => setQtd(p.codigo, qtdDe(p.codigo) + PASSO)} aria-label="Mais">+</button>
          </div>
          <button
            className={`gwc-add ${adicionado === p.codigo ? "ok" : ""}`}
            onClick={() => adicionar(p)}
          >
            {adicionado === p.codigo ? "Adicionado ✓" : "Adicionar"}
          </button>
        </div>
      </div>
    </article>
  );

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
                      {destaques.map((p) => <Card key={p.id} p={p} />)}
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
                        {itens.map((p) => <Card key={p.id} p={p} />)}
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
                        <button onClick={() => mudarQtdCarrinho(i.codigo, i.qtd - PASSO)}>−</button>
                        <span>{i.qtd}</span>
                        <button onClick={() => mudarQtdCarrinho(i.codigo, i.qtd + PASSO)}>+</button>
                      </div>
                      <button className="rm" onClick={() => mudarQtdCarrinho(i.codigo, 0)}>remover</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="gwc-df">
            <div className="gwc-resumo">
              <span>Total de itens</span>
              <b>{totalItens} {totalItens === 1 ? "unidade" : "unidades"}</b>
            </div>
            <a
              className="gwc-wa"
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              {...(carrinho.length === 0 ? { "aria-disabled": true, tabIndex: -1 } : {})}
            >
              Finalizar no WhatsApp
            </a>
            <p className="gwc-hint">Você recebe o valor conforme a quantidade<br />direto com um consultor</p>
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
