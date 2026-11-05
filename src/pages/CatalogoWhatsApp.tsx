import { useEffect, useRef, useState } from "react";
import { ajustarDescricoes, ajustarNomes, CONFIG_PADRAO, corDaFoto, CSS, fitDesc, paginaParaCanvas, paginar, prepararFoto, renderPaginas, type ProdutoCatalogo } from "./catalogoWhatsapp/template";
import { buscarProdutos, lerCodigos } from "./catalogoWhatsapp/dados";
import { carregarHistorico, registrarGeracao, type GeracaoCatalogo } from "./catalogoWhatsapp/historico";

/**
 * Gerador de catálogo em PNG para WhatsApp (/catalogo-whatsapp).
 *
 * Cola os códigos + título → busca no products_cache → monta páginas de 4
 * produtos no template oficial. Depois de montado, tudo é editável direto na
 * página (contenteditable) e cada página baixa como PNG 1080x1350.
 *
 * O HTML das páginas é gerado por string (igual ao template) e entra no DOM
 * fora do controle do React, para as edições feitas na tela não serem
 * apagadas por um re-render.
 */
export default function CatalogoWhatsApp() {
  const [codigos, setCodigos] = useState("");
  const [titulo, setTitulo] = useState("MOCHILAS");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [paginas, setPaginas] = useState(0);
  const [baixando, setBaixando] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fotosProntas = useRef<Promise<unknown>>(Promise.resolve());
  const [historico, setHistorico] = useState<GeracaoCatalogo[]>([]);
  const [erroHistorico, setErroHistorico] = useState("");
  const [verHistorico, setVerHistorico] = useState(false);

  const atualizarHistorico = async () => {
    try {
      setHistorico(await carregarHistorico());
      setErroHistorico("");
    } catch (e) {
      setErroHistorico(`Histórico indisponível: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useEffect(() => {
    document.title = "Catálogo WhatsApp | Gift Web";
    atualizarHistorico();
  }, []);

  const montar = (produtos: ProdutoCatalogo[]) => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = renderPaginas(produtos, { ...CONFIG_PADRAO, titulo: titulo.trim().toUpperCase() || CONFIG_PADRAO.titulo });
    setPaginas(paginar(produtos).length);

    const ajustar = () => {
      ajustarNomes(root);
      ajustarDescricoes(root);
    };
    ajustar();
    document.fonts?.ready.then(ajustar);

    // clicar na foto troca a imagem (ajustada ao tamanho da área da foto)
    root.querySelectorAll<HTMLElement>(".ph").forEach((el) =>
      el.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("lt")) return;
        const f = document.createElement("input");
        f.type = "file";
        f.accept = "image/*";
        f.onchange = () => {
          const arq = f.files?.[0];
          if (!arq) return;
          const r = new FileReader();
          r.onload = async () => {
            el.querySelector("img")!.src = await prepararFoto(String(r.result));
          };
          r.readAsDataURL(arq);
        };
        f.click();
      }),
    );

    // bolinha de cor: clicar remove; sem nenhuma, some o bloco "CORES:"
    root.querySelectorAll<HTMLElement>(".cores .bc").forEach((bc) =>
      bc.addEventListener("click", () => {
        const bloco = bc.parentElement!;
        const ds = bc.closest(".card")?.querySelector<HTMLElement>(".ds[data-full]");
        bc.remove();
        if (!bloco.querySelector(".bc")) {
          bloco.remove();
          if (ds) fitDesc(ds); // a descrição ganha o espaço do bloco
        }
      }),
    );

    // fotos da API: o proxy entrega com CORS; converter para data: (na
    // proporção da área, sem margem branca) deixa o html2canvas sem nenhuma requisição externa na hora de baixar
    fotosProntas.current = Promise.all([
      ...Array.from(root.querySelectorAll<HTMLImageElement>(".ph img")).map(async (im) => {
        if (!im.src.startsWith("data:")) im.src = await prepararFoto(im.src);
      }),
      // cor com nome desconhecido: pinta a bolinha com a cor predominante da foto
      ...Array.from(root.querySelectorAll<HTMLElement>(".cores .bc[data-foto]")).map(async (bc) => {
        const hex = await corDaFoto(bc.dataset.foto!);
        if (hex) bc.style.background = hex;
      }),
    ]);
  };

  const gerar = async () => {
    const lista = lerCodigos(codigos);
    setErro("");
    setAvisos([]);
    if (!lista.length) {
      setErro("Cole pelo menos um código de produto.");
      return;
    }
    setCarregando(true);
    try {
      const r = await buscarProdutos(lista);
      const msgs = [...r.avisos];
      if (r.naoEncontrados.length) msgs.unshift(`Não encontrados: ${r.naoEncontrados.join(", ")}`);
      setAvisos(msgs);
      if (!r.produtos.length) {
        setErro("Nenhum dos códigos foi encontrado no banco do site.");
        if (rootRef.current) rootRef.current.innerHTML = "";
        setPaginas(0);
        return;
      }
      montar(r.produtos);
      const tituloFinal = titulo.trim().toUpperCase() || CONFIG_PADRAO.titulo;
      registrarGeracao({
        titulo: tituloFinal,
        codigos: r.produtos.map((p) => p.codigo),
        naoEncontrados: r.naoEncontrados,
        paginas: paginar(r.produtos).length,
      })
        .then(atualizarHistorico)
        .catch((e) => setErroHistorico(`Não foi possível salvar no histórico: ${e instanceof Error ? e.message : String(e)}`));
    } catch (e) {
      setErro(`Erro ao buscar produtos: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCarregando(false);
    }
  };

  const baixar = async (n: number) => {
    const el = document.getElementById(`catwa-pg${n}`);
    if (!el) return;
    setBaixando(n);
    try {
      await fotosProntas.current;
      (document.activeElement as HTMLElement | null)?.blur(); // tira o contorno de edição do PNG
      const nome = (titulo.trim() || "catalogo").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/-+$/, "");
      const c = await paginaParaCanvas(el);
      const a = document.createElement("a");
      a.download = `catalogo-giftweb-${nome}-${n}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="catwa min-h-screen">
      <style>{CSS}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#111", color: "#fff", padding: "12px 16px", fontSize: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Códigos (um por linha, vírgula ou espaço)</span>
            <textarea
              value={codigos}
              onChange={(e) => setCodigos(e.target.value)}
              rows={3}
              placeholder={"11329-VM\n02066-PRE\n01326"}
              style={{ width: 320, color: "#111", borderRadius: 6, padding: 6, fontFamily: "monospace", fontSize: 13 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && gerar()}
              style={{ width: 220, color: "#111", borderRadius: 6, padding: "7px 8px", fontWeight: 700 }}
            />
          </label>
          <button onClick={gerar} disabled={carregando} style={btn}>
            {carregando ? "Buscando..." : "Gerar catálogo"}
          </button>
          {Array.from({ length: paginas }, (_, i) => (
            <button key={i} onClick={() => baixar(i + 1)} disabled={baixando !== null} style={btn}>
              {baixando === i + 1 ? "Gerando..." : `Baixar PNG página ${i + 1}`}
            </button>
          ))}
        </div>
        {paginas > 0 && (
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            Clique em qualquer texto para editar. Clique na foto para trocar. Clique numa bolinha de cor para removê-la. Gerar de novo descarta as edições.
          </div>
        )}
        {erro && <div style={{ marginTop: 8, color: "#ff8a8a", fontWeight: 700 }}>{erro}</div>}
        {avisos.map((a) => (
          <div key={a} style={{ marginTop: 4, color: "#ffd479" }}>{a}</div>
        ))}
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setVerHistorico((v) => !v)} style={{ ...btn, background: "#2b3a4f", padding: "5px 12px", fontSize: 13 }}>
            {verHistorico ? "Ocultar histórico" : `Histórico de gerações (${historico.length})`}
          </button>
          {erroHistorico && <span style={{ marginLeft: 10, color: "#ff8a8a" }}>{erroHistorico}</span>}
        </div>
        {verHistorico && (
          <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto", background: "#1b1b1b", borderRadius: 6, padding: 8 }}>
            {historico.length === 0 && <div style={{ opacity: 0.7 }}>Nenhuma geração registrada ainda.</div>}
            {historico.map((h) => (
              <div key={h.id} style={{ padding: "8px 4px", borderBottom: "1px solid #333", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontWeight: 700 }}>{fmtDataHora(h.created_at)}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{h.usuario || "—"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>
                    {h.titulo} <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>· {h.codigos.length} produto(s) · {h.paginas} página(s)</span>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 3, wordBreak: "break-word" }}>{h.codigos.join(", ")}</div>
                  {h.nao_encontrados.length > 0 && (
                    <div style={{ fontSize: 12, color: "#ffd479", marginTop: 2 }}>Não encontrados: {h.nao_encontrados.join(", ")}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCodigos(h.codigos.join("\n"));
                    setTitulo(h.titulo);
                  }}
                  style={{ ...btn, padding: "4px 10px", fontSize: 12 }}
                >
                  Usar estes códigos
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "20px 0", overflowX: "auto" }}>
        <div ref={rootRef} />
      </div>
    </div>
  );
}

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const btn: React.CSSProperties = {
  background: "#1db35f",
  color: "#fff",
  border: 0,
  borderRadius: 6,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
