import { useEffect, useRef, useState } from "react";
import { ajustarDescricoes, ajustarNomes, CONFIG_PADRAO, CSS, paginaParaCanvas, paginar, renderPaginas, to600, type ProdutoCatalogo } from "./catalogoWhatsapp/template";
import { buscarProdutos, lerCodigos } from "./catalogoWhatsapp/dados";

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

  useEffect(() => {
    document.title = "Catálogo WhatsApp | Gift Web";
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

    // clicar na foto troca a imagem (reduzida para 600x600)
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
            el.querySelector("img")!.src = await to600(String(r.result));
          };
          r.readAsDataURL(arq);
        };
        f.click();
      }),
    );

    // fotos da API: o proxy já entrega 600x600 com CORS; converter para data:
    // deixa o html2canvas sem nenhuma requisição externa na hora de baixar
    fotosProntas.current = Promise.all(
      Array.from(root.querySelectorAll<HTMLImageElement>(".ph img")).map(async (im) => {
        if (!im.src.startsWith("data:")) im.src = await to600(im.src);
      }),
    );
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
            Clique em qualquer texto para editar. Clique na foto para trocar. Gerar de novo descarta as edições.
          </div>
        )}
        {erro && <div style={{ marginTop: 8, color: "#ff8a8a", fontWeight: 700 }}>{erro}</div>}
        {avisos.map((a) => (
          <div key={a} style={{ marginTop: 4, color: "#ffd479" }}>{a}</div>
        ))}
      </div>
      <div style={{ padding: "20px 0", overflowX: "auto" }}>
        <div ref={rootRef} />
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#1db35f",
  color: "#fff",
  border: 0,
  borderRadius: 6,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
