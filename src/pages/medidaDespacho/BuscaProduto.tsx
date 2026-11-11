import { useDeferredValue, useMemo, useRef, useState } from "react";
import { ImageOff, Loader2, Plus, Search } from "lucide-react";
import { buscarProdutos, type ProdutoIndice } from "@/lib/medidaDespacho/dados";
import { AZUL, inputCls } from "./ui";

/** Busca com autocomplete (código amigável, composto ou nome) + quantidade. */
export default function BuscaProduto({ produtos, carregando, onAdicionar }: {
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
