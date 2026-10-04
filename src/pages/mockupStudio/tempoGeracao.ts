import { useEffect, useState } from "react";

const CHAVE = "mockup-studio:duracoes-ms";
const PADRAO_MS = 15_000;
const AMOSTRAS = 10;

function lerDuracoes(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number" && n > 0) : [];
  } catch {
    return [];
  }
}

/** Média das últimas gerações neste navegador (15s até ter histórico). */
export function tempoMedioMs(): number {
  const d = lerDuracoes();
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : PADRAO_MS;
}

export function registrarDuracao(ms: number): void {
  // Descarta valores absurdos (aba em segundo plano, rede caída etc.).
  if (ms < 2_000 || ms > 180_000) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...lerDuracoes(), Math.round(ms)].slice(-AMOSTRAS)));
  } catch { /* storage indisponível: só não aprende */ }
}

/** Progresso estimado 0..1: chega a ~90% no tempo médio e depois vai
 * desacelerando sem nunca completar -- quem fecha o anel é o resultado. */
export function useProgressoEstimado(ativo: boolean, mediaMs: number): number {
  const [progresso, setProgresso] = useState(0);
  useEffect(() => {
    if (!ativo) { setProgresso(0); return; }
    const inicio = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - inicio) / mediaMs;
      setProgresso(t <= 1 ? 0.9 * t : 0.9 + 0.08 * (1 - Math.exp(-(t - 1) * 1.5)));
    }, 100);
    return () => window.clearInterval(id);
  }, [ativo, mediaMs]);
  return progresso;
}
