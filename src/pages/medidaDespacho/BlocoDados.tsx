import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileUp, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaMaster } from "@/lib/medidaDespacho/caixaMaster";
import type { ProdutoIndice } from "@/lib/medidaDespacho/dados";
import { carregarRevisar, gravarPlanilhaMaster, lerPlanilhaMaster, type LinhaRevisar } from "@/lib/medidaDespacho/importarMaster";
import { fmtN } from "./ui";

interface Props {
  produtos: ProdutoIndice[];
  ultimaSync: string | null;
  master: { total: number; importadoEm: string | null } | null;
}

const fmtData = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const botao = "flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export default function BlocoDados({ produtos, ultimaSync, master }: Props) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [msgSync, setMsgSync] = useState<string | null>(null);
  const [lida, setLida] = useState<{ nome: string; linhas: LinhaMaster[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [revisar, setRevisar] = useState<LinhaRevisar[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const atualizarApi = async () => {
    setSincronizando(true); setMsgSync(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-products");
      if (error) throw error;
      setMsgSync(`Sincronizado: ${(data as { total?: number })?.total ?? "?"} SKUs.`);
      await qc.invalidateQueries({ queryKey: ["medidadespacho"] });
    } catch (e) {
      setMsgSync(`Falhou: ${(e as Error).message}`);
    } finally { setSincronizando(false); }
  };

  const ler = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true); setMsg(null); setLida(null);
    try { setLida({ nome: f.name, linhas: await lerPlanilhaMaster(f, produtos) }); }
    catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
    finally { setOcupado(false); if (input.current) input.current.value = ""; }
  };

  const gravar = async () => {
    if (!lida) return;
    setOcupado(true); setMsg(null);
    try {
      const n = await gravarPlanilhaMaster(lida.linhas);
      setMsg({ ok: true, texto: `${n.toLocaleString("pt-BR")} linhas importadas.` });
      setLida(null); setRevisar(null);
      await qc.invalidateQueries({ queryKey: ["medidadespacho", "master"] });
    } catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
    finally { setOcupado(false); }
  };

  const verRevisar = async () => {
    try { setRevisar(await carregarRevisar()); } catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
  };

  const contagem = lida
    ? (["ok", "revisar", "inativo"] as const).map((s) => [s, lida.linhas.filter((l) => l.status_revisao === s).length] as const)
    : [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex h-12 w-full items-center justify-between px-5 text-sm font-bold text-slate-700">
        Dados (API XBZ e planilha de caixa master)
        <ChevronDown className={`h-4 w-4 transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="space-y-5 border-t border-slate-100 p-5 text-sm text-slate-700">
          <div>
            <p className="font-semibold">Medidas da API XBZ</p>
            <p className="text-slate-500">
              Vêm do cadastro de produtos do site, sincronizado todo dia às 05h. Última sincronização: {fmtData(ultimaSync)} ·{" "}
              {produtos.length.toLocaleString("pt-BR")} produtos.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={sincronizando} onClick={atualizarApi} className={botao}>
                {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar agora
              </button>
              <span className="text-[12px] text-slate-500">{sincronizando ? "Pode levar uns 3 minutos…" : msgSync}</span>
            </div>
          </div>

          <div>
            <p className="font-semibold">Planilha de caixa master</p>
            <p className="text-slate-500">
              {master?.total ? `${master.total.toLocaleString("pt-BR")} linhas, importada em ${fmtData(master.importadoEm)}.` : "Ainda não importada."}{" "}
              Colunas: ID, REFERÊNCIA, DESCRIÇÃO, QUANTIDADE POR CAIXA, LARGURA, ALTURA, COMPRIMENTO. Importar de novo substitui a anterior.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
              <button type="button" disabled={ocupado} onClick={() => input.current?.click()} className={botao}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Escolher planilha
              </button>
              {master?.total ? <button type="button" onClick={verRevisar} className="text-[13px] font-semibold text-[#1464D2]">Ver linhas para revisar</button> : null}
            </div>
            {lida && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p><b>{lida.nome}</b>: {lida.linhas.length.toLocaleString("pt-BR")} linhas</p>
                <p className="text-slate-600">
                  {contagem.map(([s, n]) => `${n.toLocaleString("pt-BR")} ${s}`).join(" · ")}
                  {" "}(“revisar” = erro de digitação evidente, fica fora do cálculo; “inativo” = referência que não existe na API)
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={ocupado} onClick={gravar} className="h-10 rounded-xl bg-[#1464D2] px-4 text-sm font-bold text-white disabled:opacity-50">Importar</button>
                  <button type="button" onClick={() => setLida(null)} className={botao}>Cancelar</button>
                </div>
              </div>
            )}
            {msg && <p className={`mt-2 text-[13px] ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.texto}</p>}
            {revisar && (
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr><th className="p-2">ID</th><th className="p-2">Referência</th><th className="p-2">Descrição</th><th className="p-2">Qtd</th><th className="p-2">L×A×C</th><th className="p-2">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {revisar.map((l, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2 font-mono">{l.codigo_xbz}</td><td className="p-2">{l.referencia}</td><td className="p-2">{l.descricao}</td>
                        <td className="p-2">{fmtN(l.qtd_por_caixa, 0)}</td>
                        <td className="p-2">{fmtN(l.largura_cm)}×{fmtN(l.altura_cm)}×{fmtN(l.comprimento_cm)}</td>
                        <td className="p-2 text-red-600">{l.motivo_revisao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!revisar.length && <p className="p-3 text-slate-500">Nenhuma linha para revisar.</p>}
              </div>
            )}
            <p className="mt-2 text-[12px] text-slate-500">Para corrigir uma linha em revisão: corrija na planilha e importe de novo.</p>
          </div>
        </div>
      )}
    </section>
  );
}
