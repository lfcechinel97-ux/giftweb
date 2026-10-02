import { useState } from "react";
import { Search, ImageIcon } from "lucide-react";
import { useSistemaProducts, type SistemaProduct } from "@/pages/sistema/useSistemaProducts";
import type { ProdutoMockup } from "./types";

interface Props {
  onVoltar: () => void;
  onSelecionar: (produto: ProdutoMockup) => void;
}

export default function EtapaProduto({ onVoltar, onSelecionar }: Props) {
  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<SistemaProduct[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [grupo, setGrupo] = useState<{ parent: SistemaProduct; variants: SistemaProduct[] } | null>(null);
  const [variante, setVariante] = useState<SistemaProduct | null>(null);

  const listaExibida = termo.trim() ? resultados : parentProducts.slice(0, 20);

  const buscar = async (valor: string) => {
    setTermo(valor);
    if (!valor.trim()) { setResultados([]); return; }
    setBuscando(true);
    try {
      const r = await searchParents(valor, 30);
      setResultados(r);
    } finally {
      setBuscando(false);
    }
  };

  const abrirProduto = async (p: SistemaProduct) => {
    const g = await getParentWithVariants(p.codigo_amigavel);
    if (!g) return;
    setGrupo(g);
    setVariante(g.parent.has_image ? g.parent : g.variants.find((v) => v.has_image) || g.parent);
  };

  if (grupo) {
    const candidatos = [grupo.parent, ...grupo.variants].filter((p) => p.has_image);
    const fotos = Array.from(new Set((variante?.image_urls as string[] | null)?.length ? (variante!.image_urls as string[]) : variante?.image_url ? [variante.image_url] : []));

    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <button type="button" onClick={() => setGrupo(null)} className="text-sm text-blue-600 hover:underline mb-4">
          ← Voltar à busca
        </button>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">{grupo.parent.nome}</h2>
        <p className="text-sm text-slate-500 mb-6">{grupo.parent.codigo_amigavel}</p>

        {candidatos.length > 1 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 mb-2">Variante</p>
            <div className="flex flex-wrap gap-2">
              {candidatos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariante(v)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${variante?.id === v.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-blue-300"}`}
                >
                  {v.cor || v.codigo_amigavel}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs font-medium text-slate-500 mb-2">Fotografia</p>
        {fotos.length === 0 ? (
          <p className="text-sm text-slate-400">Este produto não tem fotos sincronizadas.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {fotos.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => variante && onSelecionar({ id: variante.id, nome: grupo.parent.nome, codigoAmigavel: variante.codigo_amigavel, fotoUrl: url })}
                className="aspect-square border rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Selecionar produto</h2>
      <p className="text-sm text-slate-500 mb-6">Busca no catálogo sincronizado da XBZ.</p>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={termo}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Nome ou código do produto..."
          className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm"
        />
      </div>

      {(isLoading || buscando) ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {listaExibida.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => abrirProduto(p)}
              className="border rounded-lg p-2 text-left hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="aspect-square bg-slate-50 rounded mb-2 flex items-center justify-center overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
              </div>
              <p className="text-xs font-medium text-slate-700 truncate">{p.nome}</p>
              <p className="text-[11px] text-slate-400">{p.codigo_amigavel}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        <button type="button" onClick={onVoltar} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Voltar
        </button>
      </div>
    </div>
  );
}
