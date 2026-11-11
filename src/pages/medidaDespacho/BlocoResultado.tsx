import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Caixa, ResultadoCalculo } from "@/lib/medidaDespacho/calculo";
import { fmtCaixa, fmtKg, resumoTexto } from "@/lib/medidaDespacho/resumo";
import { AZUL, AZUL_ESCURO, Bloco, ListaAlertas } from "./ui";

interface Props {
  resultado: ResultadoCalculo;
  caixa: Caixa;
  rotuloDe: (id: string) => string;
  acaoExtra?: React.ReactNode;
}

function Card({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[12px] font-semibold text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-tight" style={{ color: AZUL_ESCURO }}>{valor}</p>
      {sub && <p className="text-[11.5px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function BlocoResultado({ resultado: r, caixa, rotuloDe, acaoExtra }: Props) {
  const [copiado, setCopiado] = useState(false);
  const texto = resumoTexto(r, caixa);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* navegador sem permissão de área de transferência */ }
  };

  const avisos = [
    ...r.erros.map((e) => ({ tipo: "erro" as const, texto: e.texto })),
    ...(r.pendentes.length ? [{ tipo: "erro" as const, texto: `Fora do cálculo, sem medida — preencha: ${r.pendentes.map(rotuloDe).join(", ")}.` }] : []),
    ...(r.semPeso.length ? [{ tipo: "aviso" as const, texto: `Sem peso (peso total incompleto): ${r.semPeso.map(rotuloDe).join(", ")}.` }] : []),
  ];

  return (
    <Bloco
      titulo="Resultado"
      acao={
        r.volumes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {acaoExtra}
            <button
              type="button"
              onClick={copiar}
              className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: AZUL }}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar resumo"}
            </button>
          </div>
        )
      }
    >
      <ListaAlertas alertas={avisos} />
      {r.volumes.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Adicione itens com quantidade para calcular.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card titulo="Volumes" valor={String(r.totais.volumes)} sub={`caixa ${fmtCaixa(caixa)} cm`} />
            <Card titulo="Peso real total" valor={`${fmtKg(r.totais.pesoRealKg)} kg`} sub={r.totais.pesoCompleto ? undefined : "faltam pesos"} />
            <Card titulo="Peso cubado total" valor={`${fmtKg(r.totais.pesoCubadoKg)} kg`} />
            <Card titulo="Peso tarifável" valor={`${fmtKg(r.totais.pesoTarifavelKg)} kg`} sub="maior entre real e cubado, por volume" />
          </div>

          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-[13px] text-slate-700">{texto}</pre>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] text-slate-500">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-2 font-semibold">Conteúdo</th>
                  <th className="py-2 pr-2 font-semibold">Dimensão (L×C×A)</th>
                  <th className="py-2 pr-2 text-right font-semibold">Peso real</th>
                  <th className="py-2 pr-2 text-right font-semibold">Cubado</th>
                  <th className="py-2 pr-2 font-semibold">Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {r.volumes.map((v) => (
                  <tr key={v.numero} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 font-bold text-slate-700">{v.numero}</td>
                    <td className="py-2 pr-2 text-slate-700">
                      {v.conteudo.map((c) => <div key={c.id}>{c.qtd.toLocaleString("pt-BR")} × {c.rotulo}</div>)}
                    </td>
                    <td className="py-2 pr-2 text-slate-700">
                      {fmtCaixa(caixa)}
                      {v.sugestao && (
                        <div className="text-[12px] text-amber-700">
                          sugestão: {fmtCaixa(v.sugestao.caixa)} (cubado {fmtKg(v.sugestao.pesoCubadoKg)} kg)
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-700">{fmtKg(v.pesoRealKg)} kg{!v.pesoCompleto && "*"}</td>
                    <td className="py-2 pr-2 text-right text-slate-700">{fmtKg(v.pesoCubadoKg)} kg</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(v.ocupacao * 100)}%`, background: AZUL }} />
                        </div>
                        <span className="text-slate-600">{Math.round(v.ocupacao * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!r.totais.pesoCompleto && <p className="mt-1 text-[12px] text-slate-500">* sem o peso de algum item.</p>}
          </div>
          <p className="mt-3 text-[12px] text-slate-500">
            Ocupação considera o fator de aproveitamento (o volume que cada unidade "gasta" da caixa). A dimensão reduzida do último volume é só sugestão.
          </p>
        </>
      )}
    </Bloco>
  );
}
