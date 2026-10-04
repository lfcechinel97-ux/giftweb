import { useEffect, useRef, useState } from "react";
import { Search, ImageIcon, ArrowLeft, ArrowRight, Clock, Loader2, Package } from "lucide-react";
import { useSistemaProducts, type SistemaProduct } from "@/pages/sistema/useSistemaProducts";
import type { ProdutoMockup } from "./types";
import { ui } from "./ui";

interface Props {
  onSelecionar: (produto: ProdutoMockup) => void;
  /** Produtos mais usados no Mockup Studio, já ordenados. */
  recentes: SistemaProduct[];
  carregandoRecentes: boolean;
}

export default function EtapaProduto({ onSelecionar, recentes, carregandoRecentes }: Props) {
  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<SistemaProduct[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [grupo, setGrupo] = useState<{ parent: SistemaProduct; variants: SistemaProduct[] } | null>(null);
  const [variante, setVariante] = useState<SistemaProduct | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const idsRecentes = new Set(recentes.map((p) => p.id));
  const sugestoes = parentProducts.filter((p) => p.has_image && !idsRecentes.has(p.id)).slice(0, 18);

  // Debounce: sem isso cada tecla digitada disparava uma busca -- era isso
  // que deixava a página "travada" enquanto o vendedor digitava o nome.
  const buscaTimer = useRef<number>();
  const buscaIdRef = useRef(0);
  const buscar = (valor: string) => {
    setTermo(valor);
    window.clearTimeout(buscaTimer.current);
    if (!valor.trim()) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const minhaId = ++buscaIdRef.current;
    buscaTimer.current = window.setTimeout(async () => {
      try {
        const r = await searchParents(valor, 30);
        if (minhaId === buscaIdRef.current) setResultados(r);
      } finally {
        if (minhaId === buscaIdRef.current) setBuscando(false);
      }
    }, 350);
  };
  useEffect(() => () => window.clearTimeout(buscaTimer.current), []);

  const abrirProduto = async (p: SistemaProduct) => {
    setAbrindo(p.id);
    try {
      const g = await getParentWithVariants(p.codigo_amigavel);
      if (!g) return;
      setGrupo(g);
      setVariante(g.parent.has_image ? g.parent : g.variants.find((v) => v.has_image) || g.parent);
    } finally {
      setAbrindo(null);
    }
  };

  const confirmar = () => {
    if (!grupo || !variante) return;
    const fotos = Array.from(new Set(
      (variante.image_urls as string[] | null)?.length ? (variante.image_urls as string[]) : variante.image_url ? [variante.image_url] : []
    ));
    if (fotos.length === 0) return;
    onSelecionar({
      id: variante.id,
      nome: grupo.parent.nome,
      codigoAmigavel: variante.codigo_amigavel,
      visoes: fotos.map((url, i) => ({ id: `${variante.id}-${i}`, nome: i === 0 ? "Vista 1" : `Vista ${i + 1}`, fotoUrl: url })),
    });
  };

  if (grupo) {
    const candidatos = [grupo.parent, ...grupo.variants].filter((p) => p.has_image);
    const fotos = Array.from(new Set(
      (variante?.image_urls as string[] | null)?.length ? (variante!.image_urls as string[]) : variante?.image_url ? [variante.image_url] : []
    ));

    return (
      <div className={ui.pagina}>
        <div className={`${ui.card} p-6 sm:p-8`}>
          <button
            type="button"
            onClick={() => setGrupo(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar à busca
          </button>
          <h2 className={ui.titulo}>{grupo.parent.nome}</h2>
          <p className="text-xs font-mono text-[var(--gw-text-muted)] mt-1">{grupo.parent.codigo_amigavel}</p>

          {candidatos.length > 1 && (
            <div className="mt-6">
              <p className={ui.rotulo}>Variante</p>
              <div className="flex flex-wrap gap-2">
                {candidatos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariante(v)}
                    className={`px-3.5 py-1.5 rounded-full border text-sm min-w-[64px] text-center transition-colors ${
                      variante?.id === v.id
                        ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#5B52E8] text-white font-semibold shadow-[0_4px_12px_-4px_rgba(37,99,235,.7)]"
                        : "border-[var(--gw-border-strong)] bg-white text-[var(--gw-text-secondary)] hover:border-[#2563EB]/60 hover:text-[#2563EB]"
                    }`}
                  >
                    {v.cor || v.codigo_amigavel}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`${ui.rotulo} mt-6`}>
            {fotos.length} foto{fotos.length !== 1 ? "s" : ""} — todas entram como vistas no editor
          </p>
          {fotos.length === 0 ? (
            <p className="text-sm text-[var(--gw-text-muted)]">Este produto não tem fotos sincronizadas.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {/* key por posição: trocar de variante só troca o src, sem
                  desmontar as imagens (antes a grade sumia e voltava). */}
              {fotos.map((url, i) => (
                <div key={i} className="aspect-square border border-[var(--gw-border)] rounded-xl overflow-hidden bg-[var(--gw-surface-alt)]">
                  <img src={url} alt="" className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button type="button" disabled={fotos.length === 0} onClick={confirmar} className={ui.btnPrimario}>
              Usar este produto <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cartao = (p: SistemaProduct) => (
    <button
      key={p.id}
      type="button"
      onClick={() => abrirProduto(p)}
      disabled={!!abrindo}
      className="group relative bg-white border border-[var(--gw-border)] rounded-2xl p-2.5 text-left transition-all hover:border-[#2563EB]/50 hover:shadow-[var(--gw-shadow-md)] hover:-translate-y-0.5 disabled:cursor-wait"
    >
      <div className="aspect-square bg-[var(--gw-surface-alt)] rounded-xl mb-2.5 flex items-center justify-center overflow-hidden">
        {p.image_url
          ? <img src={p.image_url} alt="" className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" />
          : <ImageIcon className="w-6 h-6 text-[var(--gw-border-strong)]" />}
      </div>
      <p className="text-xs font-semibold text-[var(--gw-text)] truncate px-0.5">{p.nome}</p>
      <p className="text-[11px] font-mono text-[var(--gw-text-muted)] px-0.5">{p.codigo_amigavel}</p>
      {abrindo === p.id && (
        <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
        </div>
      )}
    </button>
  );

  const buscandoAgora = termo.trim().length > 0;

  return (
    <div className={ui.pagina}>
      <div className={`${ui.card} p-6 sm:p-8`}>
        <h2 className={ui.titulo}>Selecionar produto</h2>
        <p className={ui.subtitulo}>Busque no catálogo sincronizado da XBZ.</p>

        <div className="relative mt-6 mb-6">
          <Search className="w-4 h-4 text-[var(--gw-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={termo}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Nome ou código do produto..."
            className="w-full pl-10 pr-10 py-3 bg-[var(--gw-surface-alt)] border border-[var(--gw-border)] rounded-xl text-sm text-[var(--gw-text)] placeholder:text-[var(--gw-text-muted)] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all"
          />
          {buscando && <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] absolute right-3.5 top-1/2 -translate-y-1/2" />}
        </div>

        {buscandoAgora ? (
          buscando ? null : resultados.length === 0 ? (
            <p className="text-sm text-[var(--gw-text-muted)] text-center py-10">Nenhum produto encontrado para “{termo}”.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{resultados.map(cartao)}</div>
          )
        ) : isLoading || carregandoRecentes ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--gw-border)] p-2.5 animate-pulse">
                <div className="aspect-square rounded-xl bg-[var(--gw-surface-alt)] mb-2.5" />
                <div className="h-3 rounded bg-[var(--gw-surface-alt)] w-3/4 mb-1.5" />
                <div className="h-2.5 rounded bg-[var(--gw-surface-alt)] w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {recentes.length > 0 && (
              <section className="mb-8">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--gw-text)] mb-3">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#F76B15] to-[#F5A524] flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-white" />
                  </span>
                  Usados recentemente
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{recentes.map(cartao)}</div>
              </section>
            )}
            <section>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--gw-text)] mb-3">
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-white" />
                </span>
                {recentes.length > 0 ? "Outros produtos" : "Produtos do catálogo"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{sugestoes.map(cartao)}</div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
