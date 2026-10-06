import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { ProdutoExtra, ProdutoMockup } from "./types";
import EtapaProduto from "./EtapaProduto";
import { ui } from "./ui";

/** Limites que a edge function também aplica (1 a 4 unidades por item, até 5 extras). */
export const MAX_UNIDADES = 4;
export const MAX_EXTRAS = 5;

interface Props {
  principal: ProdutoMockup;
  quantidadePrincipal: number;
  extras: ProdutoExtra[];
  onChange: (quantidadePrincipal: number, extras: ProdutoExtra[]) => void;
}

/**
 * Etapa 3: monta a foto com mais de um produto (ex.: orçamento com caneca +
 * garrafa) ou várias unidades do mesmo. Só funciona no modo "colar a logo
 * por cima" -- a IA gera os produtos lisos e o vendedor duplica a logo em
 * cada um no editor.
 */
export default function ProdutosNaFoto({ principal, quantidadePrincipal, extras, onChange }: Props) {
  const [escolhendo, setEscolhendo] = useState(false);

  const mudarExtra = (i: number, quantidade: number) =>
    onChange(quantidadePrincipal, extras.map((e, j) => (j === i ? { ...e, quantidade } : e)));

  return (
    <div className="mt-6">
      <p className={ui.rotulo}>Produtos na foto</p>
      <div className="flex flex-col gap-2">
        <LinhaProduto
          produto={principal}
          quantidade={quantidadePrincipal}
          onQuantidade={(q) => onChange(q, extras)}
        />
        {extras.map((e, i) => (
          <LinhaProduto
            key={`${e.produto.id}-${i}`}
            produto={e.produto}
            quantidade={e.quantidade}
            onQuantidade={(q) => mudarExtra(i, q)}
            onRemover={() => onChange(quantidadePrincipal, extras.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      {extras.length < MAX_EXTRAS && (
        <button type="button" onClick={() => setEscolhendo(true)} className={`${ui.btnSecundario} mt-3`}>
          <Plus className="w-4 h-4" /> Adicionar outro produto
        </button>
      )}

      {escolhendo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEscolhendo(false)}>
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEscolhendo(false)}
              className="absolute right-6 top-10 z-10 p-2 rounded-lg bg-white/90 hover:bg-white text-[var(--gw-text-secondary)]"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <EtapaProduto
              recentes={[]}
              carregandoRecentes={false}
              onSelecionar={(p) => {
                onChange(quantidadePrincipal, [...extras, { produto: p, quantidade: 1 }]);
                setEscolhendo(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaProduto({ produto, quantidade, onQuantidade, onRemover }: {
  produto: ProdutoMockup;
  quantidade: number;
  onQuantidade: (q: number) => void;
  onRemover?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[var(--gw-border)] bg-white">
      <img src={produto.visoes[0]?.fotoUrl} alt={produto.nome} className="w-10 h-10 rounded-lg object-contain bg-white border border-[var(--gw-hairline)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--gw-text)] truncate">{produto.nome}</p>
        <p className="text-[11px] font-mono text-[var(--gw-text-muted)]">{produto.codigoAmigavel}</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onQuantidade(Math.max(1, quantidade - 1))} disabled={quantidade <= 1}
          className="p-1.5 rounded-lg border border-[var(--gw-border)] disabled:opacity-30" title="Menos uma unidade">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-semibold">{quantidade}</span>
        <button type="button" onClick={() => onQuantidade(Math.min(MAX_UNIDADES, quantidade + 1))} disabled={quantidade >= MAX_UNIDADES}
          className="p-1.5 rounded-lg border border-[var(--gw-border)] disabled:opacity-30" title="Mais uma unidade">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {onRemover && (
        <button type="button" onClick={onRemover} className="p-1.5 rounded-lg text-[var(--gw-text-muted)] hover:text-red-600 hover:bg-red-50" title="Tirar da foto">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
