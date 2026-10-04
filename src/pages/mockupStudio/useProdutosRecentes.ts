import { useEffect, useState } from "react";
import { useSistemaProducts, type SistemaProduct } from "@/pages/sistema/useSistemaProducts";

/** Resolve os códigos mais usados em produtos do catálogo. Roda desde que o
 * Mockup Studio abre, então quando o vendedor chega na etapa de produto a
 * lista já está pronta (antes aparecia o catálogo e só depois os recentes). */
export function useProdutosRecentes(codigos: string[], historicoCarregando: boolean) {
  const { searchParents } = useSistemaProducts();
  const [recentes, setRecentes] = useState<SistemaProduct[]>([]);
  const [resolvendo, setResolvendo] = useState(false);

  const chave = codigos.join("|");
  useEffect(() => {
    if (!codigos.length) { setRecentes([]); return; }
    let cancelado = false;
    setResolvendo(true);
    Promise.all(codigos.map((c) => searchParents(c, 1).then((r) => r[0]).catch(() => undefined)))
      .then((lista) => {
        if (cancelado) return;
        const vistos = new Set<string>();
        setRecentes(lista.filter((p): p is SistemaProduct => !!p && !vistos.has(p.id) && !!vistos.add(p.id)));
      })
      .finally(() => { if (!cancelado) setResolvendo(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return { recentes, carregando: historicoCarregando || resolvendo };
}
