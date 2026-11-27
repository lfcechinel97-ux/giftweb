/* Listas do sistema (Pedidos, Orçamentos) lembram onde o usuário estava:
   filtros, página e posição da rolagem ficam no sessionStorage. Abrir um
   pedido/orçamento e voltar (pelo botão Voltar da tela ou do navegador)
   devolve a lista exatamente como estava, em vez da página 1 no topo. */
import { useCallback, useEffect, useRef, useState } from "react";

const ler = <T,>(chave: string, inicial: T): T => {
  try {
    const raw = sessionStorage.getItem(chave);
    return raw === null ? inicial : (JSON.parse(raw) as T);
  } catch {
    return inicial;
  }
};

const gravar = (chave: string, valor: unknown) => {
  try { sessionStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo privado / cota */ }
};

/** useState que sobrevive a sair e voltar para a tela (mesma aba do navegador). */
export function useEstadoPersistente<T>(chave: string, inicial: T | (() => T)) {
  const [valor, setValor] = useState<T>(() => {
    const padrao = typeof inicial === "function" ? (inicial as () => T)() : inicial;
    return ler(chave, padrao);
  });
  useEffect(() => { gravar(chave, valor); }, [chave, valor]);
  return [valor, setValor] as const;
}

/** Roda `fn` quando `deps` mudam — mas NÃO na montagem. Usado para voltar
 *  à página 1 quando um filtro muda sem perder a página restaurada. */
export function useAoMudar(deps: unknown[], fn: () => void) {
  const anterior = useRef<string | null>(null);
  const chave = JSON.stringify(deps);
  useEffect(() => {
    if (anterior.current !== null && anterior.current !== chave) fn();
    anterior.current = chave;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}

/** Guarda a rolagem da lista e a devolve quando a tela volta com dados.
 *  `pronto` = a lista já está na tela (sem isso a página ainda não tem
 *  altura e o scroll pararia no meio). Devolve `salvarAgora` para chamar
 *  logo antes de navegar para o detalhe. */
export function useRestaurarRolagem(chave: string, caminhoDaLista: string, pronto: boolean) {
  const restaurado = useRef(false);

  const salvarAgora = useCallback(() => {
    gravar(chave, window.scrollY);
  }, [chave]);

  useEffect(() => {
    let frame = 0;
    const aoRolar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Depois de navegar o caminho já mudou: não sobrescreve com o 0 da
        // tela nova (o App rola para o topo a cada troca de rota).
        if (window.location.pathname.replace(/\/+$/, "") !== caminhoDaLista) return;
        if (!restaurado.current) return;
        gravar(chave, window.scrollY);
      });
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", aoRolar); };
  }, [chave, caminhoDaLista]);

  useEffect(() => {
    if (!pronto || restaurado.current) return;
    const y = ler<number>(chave, 0);
    // Espera o ScrollToTop do App (efeito do pai roda depois do filho) e o
    // layout da lista terminar.
    const t = window.setTimeout(() => {
      restaurado.current = true;
      if (y > 0) window.scrollTo(0, y);
    }, 60);
    return () => window.clearTimeout(t);
  }, [pronto, chave]);

  return salvarAgora;
}

/** Números da paginação: sempre mostra pelo menos 1 2 3 4 … última.
 *  `null` = reticências. */
export function paginasVisiveis(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  let nums: number[];
  if (atual <= 4) nums = [1, 2, 3, 4, 5, total];
  else if (atual >= total - 3) nums = [1, total - 4, total - 3, total - 2, total - 1, total];
  else nums = [1, atual - 1, atual, atual + 1, total];
  const out: (number | null)[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

/** Data de <input type="date"> completa e plausível. Enquanto o ano está
 *  sendo digitado o navegador entrega valores como "0002-11-05"; mandar
 *  isso ao banco gerava erro / busca errada. */
export const dataValida = (v: string): string | null =>
  /^(19|20)\d{2}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime()) ? v : null;
