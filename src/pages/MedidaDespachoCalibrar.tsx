import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileUp, Loader2, Trash2, Undo2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  agruparErros, errosDoDespacho, palavraChave, type Despacho, type Estimativa, type ItemDespacho, type StatusDespacho,
} from "@/lib/medidaDespacho/calibracao";
import { CONFIG_PADRAO, db } from "@/lib/medidaDespacho/dados";
import { confiancaCalibrado, ROTULO_FONTE } from "@/lib/medidaDespacho/fontes";
import { lerArquivoHistorico, modeloCsv, montarDespachos, type NovoDespacho } from "@/lib/medidaDespacho/importarHistorico";
import { normalizar } from "@/lib/medidaDespacho/regras";
import { fmtCm, fmtKg } from "@/lib/medidaDespacho/resumo";
import BuscaProduto from "./medidaDespacho/BuscaProduto";
import Cabecalho from "./medidaDespacho/Cabecalho";
import { estimarDespacho, novaLinha, resolverLinha, useContexto, useDadosDespacho, type Contexto } from "./medidaDespacho/estado";
import { AZUL, BadgeConfianca, BadgeFonte, Bloco, CampoNumero, Rotulo, fmtN, inputCls, lerNum } from "./medidaDespacho/ui";

/* Calibração: despachos reais → medidas calibradas por produto e erro do modelo.
   Qualquer pessoa da equipe registra e valida. Detalhes em src/lib/medidaDespacho/README.md */

type Aba = "registrar" | "historico" | "calibrados" | "erro";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "registrar", rotulo: "Registrar despacho" },
  { id: "historico", rotulo: "Histórico" },
  { id: "calibrados", rotulo: "Produtos calibrados" },
  { id: "erro", rotulo: "Erro do modelo" },
];

const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);
const fmtData = (s: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR") : "—");
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

async function usuario() {
  const { data } = await supabase.auth.getUser();
  return { id: data.user?.id ?? null, email: data.user?.email ?? null };
}

async function gravarDespacho(d: Omit<NovoDespacho, "chave">, estimativa: Estimativa): Promise<number> {
  const u = await usuario();
  const { data, error } = await db.rpc("registrar_despacho", { dados: { ...d, estimativa, criado_por_nome: u.email } });
  if (error) throw new Error(error.message);
  return data as number;
}

export default function MedidaDespachoCalibrar() {
  const dados = useDadosDespacho();
  const { ctx, calibracoes } = useContexto(dados);
  const [aba, setAba] = useState<Aba>("registrar");
  const despachos = dados.despachos.data ?? [];
  const erroCarga = dados.despachos.error || dados.produtos.error || dados.config.error;

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <Helmet>
        <title>Calibração de despacho | Gift Web Brindes</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Cabecalho subtitulo="Despachos reais melhoram as estimativas" />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {erroCarga && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Erro ao carregar dados: {(erroCarga as Error).message}. Confira se a migration 20261111120000_medidadespacho.sql foi rodada.
          </p>
        )}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold transition ${aba === a.id ? "bg-[#1464D2] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        {aba === "registrar" && <Registrar ctx={ctx} carregando={dados.produtos.isLoading} produtos={dados.produtos.data ?? []} />}
        {aba === "historico" && <Historico despachos={despachos} ctx={ctx} foraDaCurva={new Set([...calibracoes.values()].flatMap((c) => c.foraDaCurva))} />}
        {aba === "calibrados" && <Calibrados ctx={ctx} calibracoes={calibracoes} />}
        {aba === "erro" && <ErroModelo despachos={despachos} ctx={ctx} />}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- Registrar */

interface ItemForm { uid: number; codigo: string; qtd: string }
let uidItem = 1;

function Registrar({ ctx, carregando, produtos }: { ctx: Contexto; carregando: boolean; produtos: NonNullable<ReturnType<typeof useDadosDespacho>["produtos"]["data"]> }) {
  const qc = useQueryClient();
  const cfg = ctx.config ?? CONFIG_PADRAO;
  const inicial = () => ({
    data: hoje(), pedido: "", largura: fmtN(cfg.caixa.largura), comprimento: fmtN(cfg.caixa.comprimento), altura: fmtN(cfg.caixa.altura),
    peso: "", ocupacao: "100", observacao: "",
  });
  const [f, setF] = useState(inicial);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string; est?: Estimativa; real?: { ocupacao: number; peso: number } } | null>(null);
  const set = (k: keyof ReturnType<typeof inicial>, v: string) => setF((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    setMsg(null);
    const L = lerNum(f.largura), C = lerNum(f.comprimento), A = lerNum(f.altura), peso = lerNum(f.peso), ocup = lerNum(f.ocupacao) ?? 100;
    const lista: ItemDespacho[] = itens.map((i) => ({ codigo_amigavel: i.codigo, qtd: Math.floor(lerNum(i.qtd) ?? 0) }));
    if (!L || !C || !A || L <= 0 || C <= 0 || A <= 0) return setMsg({ ok: false, texto: "Informe as dimensões da caixa." });
    if (!peso || peso <= 0) return setMsg({ ok: false, texto: "Informe o peso real da caixa (kg)." });
    if (ocup <= 0 || ocup > 100) return setMsg({ ok: false, texto: "Ocupação entre 1 e 100%." });
    if (!lista.length || lista.some((i) => i.qtd <= 0)) return setMsg({ ok: false, texto: "Adicione os itens com quantidade." });
    setSalvando(true);
    try {
      const caixa = { largura: L, altura: A, comprimento: C };
      const est = estimarDespacho(lista, caixa, ctx);
      await gravarDespacho({
        data: f.data || hoje(), referencia_pedido: f.pedido.trim() || null,
        caixa_larg_cm: L, caixa_comp_cm: C, caixa_alt_cm: A, peso_real_kg: peso, ocupacao_pct: ocup,
        observacao: f.observacao.trim() || null, itens: lista.map((i) => ({ ...i, codigo_composto: null })),
      }, est);
      setMsg({ ok: true, texto: "Despacho registrado (pendente de validação).", est, real: { ocupacao: ocup / 100, peso } });
      setItens([]);
      setF((x) => ({ ...x, pedido: "", peso: "", ocupacao: "100", observacao: "" }));
      await qc.invalidateQueries({ queryKey: ["medidadespacho", "despachos"] });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally { setSalvando(false); }
  };

  return (
    <>
      <Bloco titulo="Registrar despacho real">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block"><Rotulo>Data</Rotulo><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inputCls()} /></label>
          <label className="col-span-1 block sm:col-span-3"><Rotulo>Pedido (opcional)</Rotulo><input value={f.pedido} onChange={(e) => set("pedido", e.target.value)} className={inputCls()} /></label>
          <CampoNumero rotulo="Largura" sufixo="cm" valor={f.largura} onChange={(v) => set("largura", v)} />
          <CampoNumero rotulo="Comprimento" sufixo="cm" valor={f.comprimento} onChange={(v) => set("comprimento", v)} />
          <CampoNumero rotulo="Altura" sufixo="cm" valor={f.altura} onChange={(v) => set("altura", v)} />
          <div />
          <CampoNumero rotulo="Peso real da caixa" sufixo="kg" valor={f.peso} onChange={(v) => set("peso", v)} />
          <CampoNumero rotulo="Ocupação da caixa" sufixo="%" valor={f.ocupacao} onChange={(v) => set("ocupacao", v)} />
        </div>
        <p className="mt-2 text-[12px] text-slate-500">Ocupação: 100% = caixa cheia. Se a caixa foi com espaço sobrando, estime quanto foi usado.</p>

        <div className="mt-4">
          <Rotulo>Itens da caixa</Rotulo>
          <BuscaProduto produtos={produtos} carregando={carregando} onAdicionar={(p, qtd) => setItens((l) => [...l, { uid: uidItem++, codigo: p.codigo, qtd }])} />
          <ul className="mt-2 space-y-2">
            {itens.map((i) => {
              const p = ctx.mapa.get(i.codigo);
              return (
                <li key={i.uid} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <span className="font-mono text-[12px] font-bold text-slate-500">{i.codigo}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-slate-800">{p?.nome}</span>
                  <input inputMode="numeric" value={i.qtd} placeholder="Qtd" onChange={(e) => setItens((l) => l.map((x) => (x.uid === i.uid ? { ...x, qtd: e.target.value } : x)))} className={inputCls(!lerNum(i.qtd), true) + " w-24 text-right"} />
                  <button type="button" onClick={() => setItens((l) => l.filter((x) => x.uid !== i.uid))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
          {itens.length > 1 && <p className="mt-1 text-[12px] text-slate-500">Com vários produtos, o registro serve para medir o erro do modelo (não calibra o volume unitário).</p>}
        </div>

        <label className="mt-4 block"><Rotulo>Observação</Rotulo>
          <textarea value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} className={inputCls().replace("h-11", "") + " py-2"} />
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={salvar} disabled={salvando} className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50" style={{ background: AZUL }}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar
          </button>
        </div>
        {msg && (
          <div className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            <p className="font-semibold">{msg.texto}</p>
            {msg.est && msg.real && (
              <p className="mt-1">
                Estimado × real — ocupação: {fmtPct(msg.est.ocupacao).replace("+", "")} × {Math.round(msg.real.ocupacao * 100)}%
                {" "}(erro {fmtPct(msg.est.ocupacao === null ? null : (msg.est.ocupacao - msg.real.ocupacao) / msg.real.ocupacao)}) · peso:{" "}
                {msg.est.pesoKg === null ? "sem peso" : `${fmtKg(msg.est.pesoKg)} kg`} × {fmtKg(msg.real.peso)} kg
                {msg.est.completa && msg.est.pesoKg !== null && ` (erro ${fmtPct((msg.est.pesoKg - msg.real.peso) / msg.real.peso)})`}
              </p>
            )}
          </div>
        )}
      </Bloco>
      <ImportarLote ctx={ctx} />
    </>
  );
}

function ImportarLote({ ctx }: { ctx: Contexto }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [lido, setLido] = useState<{ nome: string; despachos: NovoDespacho[]; erros: string[] } | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const porComposto = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of ctx.mapa.values()) for (const v of p.variantes) m.set(normalizar(v.codigoComposto), p.codigo);
    return m;
  }, [ctx.mapa]);
  const resolver = (codigo: string) => {
    const c = normalizar(codigo).trim();
    for (const k of [c, /^\d{1,4}$/.test(c) ? c.padStart(5, "0") : c]) {
      const prod = ctx.mapa.get(k) ?? ctx.mapa.get(codigo.trim());
      if (prod) return { codigo_amigavel: prod.codigo, codigo_composto: null };
      const base = porComposto.get(k);
      if (base) return { codigo_amigavel: base, codigo_composto: k };
    }
    return null;
  };

  const baixarModelo = () => {
    const url = URL.createObjectURL(new Blob([modeloCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_despachos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const ler = async (arq: File | undefined) => {
    if (!arq) return;
    setMsg(null);
    try {
      const r = montarDespachos(await lerArquivoHistorico(arq), resolver);
      setLido({ nome: arq.name, ...r });
    } catch (e) { setMsg((e as Error).message); }
    if (input.current) input.current.value = "";
  };

  const importar = async () => {
    if (!lido) return;
    let ok = 0;
    const falhas: string[] = [];
    for (const d of lido.despachos) {
      setProgresso(`${ok + falhas.length + 1} de ${lido.despachos.length}…`);
      try {
        const est = estimarDespacho(d.itens, { largura: d.caixa_larg_cm, altura: d.caixa_alt_cm, comprimento: d.caixa_comp_cm }, ctx);
        const { chave: _c, ...resto } = d;
        await gravarDespacho(resto, est);
        ok++;
      } catch (e) { falhas.push(`${d.chave}: ${(e as Error).message}`); }
    }
    setProgresso(null);
    setLido(null);
    setMsg(`${ok} despacho(s) importado(s) como pendentes.${falhas.length ? ` Falharam: ${falhas.join("; ")}` : ""}`);
    await qc.invalidateQueries({ queryKey: ["medidadespacho", "despachos"] });
  };

  return (
    <Bloco titulo="Importar histórico em lote">
      <p className="text-sm text-slate-600">
        CSV (separado por ;) ou planilha .xlsx, uma linha por item. Linhas com o mesmo número em <b>despacho</b> formam uma caixa com vários produtos.
        Código: o do produto (01116) ou com a cor (01116-INO).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={baixarModelo} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Download className="h-4 w-4" /> Baixar modelo
        </button>
        <input ref={input} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
        <button type="button" onClick={() => input.current?.click()} disabled={!!progresso} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <FileUp className="h-4 w-4" /> Escolher arquivo
        </button>
      </div>
      {lido && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p><b>{lido.nome}</b>: {lido.despachos.length} despacho(s) prontos para importar.</p>
          {lido.erros.length > 0 && (
            <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-red-600">{lido.erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={!lido.despachos.length || !!progresso} onClick={importar} className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50" style={{ background: AZUL }}>
              {progresso ? <><Loader2 className="h-4 w-4 animate-spin" /> {progresso}</> : `Importar ${lido.despachos.length}`}
            </button>
            {!progresso && <button type="button" onClick={() => setLido(null)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Cancelar</button>}
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
    </Bloco>
  );
}

/* ---------------------------------------------------------------- Histórico */

const COR_STATUS: Record<StatusDespacho, string> = {
  pendente: "bg-amber-100 text-amber-800", validado: "bg-green-100 text-green-800", descartado: "bg-slate-200 text-slate-600",
};

function Historico({ despachos, ctx, foraDaCurva }: { despachos: Despacho[]; ctx: Contexto; foraDaCurva: Set<number> }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<StatusDespacho | "todos">("todos");
  const [limite, setLimite] = useState(100);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lista = despachos.filter((d) => filtro === "todos" || d.status === filtro);

  const mudarStatus = async (d: Despacho, status: StatusDespacho) => {
    setOcupado(d.id); setErro(null);
    try {
      const u = await usuario();
      const patch = status === "pendente"
        ? { status, validado_por: null, validado_por_nome: null, validado_em: null }
        : { status, validado_por: u.id, validado_por_nome: u.email, validado_em: new Date().toISOString() };
      const { error } = await db.from("despachos_historico").update(patch).eq("id", d.id);
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ["medidadespacho", "despachos"] });
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };

  const pendentes = despachos.filter((d) => d.status === "pendente").length;
  return (
    <Bloco
      titulo={`Histórico (${despachos.length})`}
      acao={
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[14px]">
          <option value="todos">Todos</option>
          <option value="pendente">Pendentes ({pendentes})</option>
          <option value="validado">Validados</option>
          <option value="descartado">Descartados</option>
        </select>
      }
    >
      {erro && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      {!lista.length ? <p className="text-sm text-slate-500">Nenhum despacho.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[12px] text-slate-500">
                <th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Itens</th><th className="py-2 pr-2">Caixa (L×C×A)</th>
                <th className="py-2 pr-2 text-right">Real</th><th className="py-2 pr-2 text-right">Estimado</th><th className="py-2 pr-2 text-right">Erro</th>
                <th className="py-2 pr-2">Status</th><th className="py-2 pr-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, limite).map((d) => {
                const e = errosDoDespacho(d);
                return (
                  <tr key={d.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 text-slate-700">{fmtData(d.data)}{d.referencia_pedido && <div className="text-[11.5px] text-slate-500">{d.referencia_pedido}</div>}</td>
                    <td className="py-2 pr-2 text-slate-700">
                      {d.itens.map((i, k) => <div key={k} title={ctx.mapa.get(i.codigo_amigavel)?.nome}>{i.qtd.toLocaleString("pt-BR")} × {i.codigo_composto ?? i.codigo_amigavel}</div>)}
                      {d.observacao && <div className="text-[11.5px] text-slate-500">{d.observacao}</div>}
                      {foraDaCurva.has(d.id) && <div className="mt-1 rounded bg-amber-50 px-1.5 text-[11.5px] font-semibold text-amber-800">Foge &gt; 50% da mediana: revise (fora da calibração)</div>}
                    </td>
                    <td className="py-2 pr-2 text-slate-700">{fmtCm(d.caixa_larg_cm)}×{fmtCm(d.caixa_comp_cm)}×{fmtCm(d.caixa_alt_cm)}</td>
                    <td className="py-2 pr-2 text-right text-slate-700">{Math.round(d.ocupacao_pct)}%<div>{fmtKg(d.peso_real_kg)} kg</div></td>
                    <td className="py-2 pr-2 text-right text-slate-700">
                      {d.estimativa?.ocupacao != null ? `${Math.round(d.estimativa.ocupacao * 100)}%` : "—"}
                      <div>{d.estimativa?.pesoKg != null ? `${fmtKg(d.estimativa.pesoKg)} kg${d.estimativa.completa ? "" : "*"}` : "—"}</div>
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold text-slate-700">{fmtPct(e.volume)}<div>{fmtPct(e.peso)}</div></td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_STATUS[d.status]}`}>{d.status}</span>
                      <div className="mt-1 text-[11px] text-slate-500">por {d.criado_por_nome ?? "—"}</div>
                      {d.validado_por_nome && <div className="text-[11px] text-slate-500">{d.status === "validado" ? "validado" : "descartado"} por {d.validado_por_nome} em {fmtData(d.validado_em)}</div>}
                    </td>
                    <td className="py-2 pr-2">
                      {ocupado === d.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
                        <div className="flex gap-1">
                          {d.status !== "validado" && <BotaoIcone titulo="Validar" onClick={() => mudarStatus(d, "validado")}><Check className="h-4 w-4 text-green-700" /></BotaoIcone>}
                          {d.status !== "descartado" && <BotaoIcone titulo="Descartar" onClick={() => mudarStatus(d, "descartado")}><X className="h-4 w-4 text-red-600" /></BotaoIcone>}
                          {d.status !== "pendente" && <BotaoIcone titulo="Voltar para pendente" onClick={() => mudarStatus(d, "pendente")}><Undo2 className="h-4 w-4 text-slate-500" /></BotaoIcone>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length > limite && <button type="button" onClick={() => setLimite((l) => l + 100)} className="mt-2 text-sm font-semibold text-[#1464D2]">Mostrar mais</button>}
          <p className="mt-2 text-[12px] text-slate-500">Erro: + = o modelo estimou mais do que o real. Linha de cima = ocupação/volume; de baixo = peso. * estimativa sem o peso de algum item.</p>
        </div>
      )}
    </Bloco>
  );
}

function BotaoIcone({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={titulo} aria-label={titulo} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50">{children}</button>;
}

/* ------------------------------------------------------- Produtos calibrados */

function Calibrados({ ctx, calibracoes }: { ctx: Contexto; calibracoes: ReturnType<typeof useContexto>["calibracoes"] }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const semCalibracao = useMemo<Contexto>(() => ({ ...ctx, calibrados: new Map() }), [ctx]);
  const lista = [...calibracoes.values()].sort((a, b) => b.ultimaData.localeCompare(a.ultimaData));

  const gravar = async (codigo: string, campos: Record<string, unknown>) => {
    setOcupado(codigo); setErro(null);
    try {
      const u = await usuario();
      const { error } = await db.from("medidas_override").upsert({ codigo_amigavel: codigo, ...campos, atualizado_por: u.id, atualizado_em: new Date().toISOString() });
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ["medidadespacho", "overrides"] });
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };

  return (
    <Bloco titulo={`Produtos calibrados (${lista.length})`}>
      <p className="mb-3 text-[13px] text-slate-600">
        Mediana das últimas 10 caixas validadas com um só produto. <b>Promover a override</b> congela a mediana atual como medida do produto;
        <b> Reverter</b> volta a usar a fonte anterior. Nos dois casos, novos despachos continuam sendo registrados; use <b>Usar calibração</b> para voltar.
      </p>
      {erro && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      {!lista.length ? <p className="text-sm text-slate-500">Nenhum produto calibrado ainda: valide despachos de um só produto no Histórico.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[12px] text-slate-500">
                <th className="py-2 pr-2">Produto</th><th className="py-2 pr-2">n</th><th className="py-2 pr-2 text-right">Volume/un (mín–máx)</th>
                <th className="py-2 pr-2 text-right">Peso/un (mín–máx)</th><th className="py-2 pr-2">Fonte anterior</th><th className="py-2 pr-2">Situação</th><th className="py-2 pr-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const p = ctx.mapa.get(c.codigo);
                const ov = ctx.overrides.get(c.codigo);
                const anterior = resolverLinha(novaLinha(c.codigo, "1"), semCalibracao).medida;
                const varia = anterior?.volEquivalente && c.volUn ? (c.volUn - anterior.volEquivalente) / anterior.volEquivalente : null;
                const ignorada = !!ov?.ignorar_calibracao;
                const promovida = ignorada && !!ov?.vol_efetivo_un_cm3;
                return (
                  <tr key={c.codigo} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2"><span className="font-mono text-[12px] font-bold text-slate-500">{c.codigo}</span><div className="max-w-[220px] truncate text-slate-800" title={p?.nome}>{p?.nome ?? "—"}</div><div className="text-[11px] text-slate-500">última: {fmtData(c.ultimaData)}</div></td>
                    <td className="py-2 pr-2">{c.n}<div><BadgeConfianca confianca={confiancaCalibrado(c.n)} /></div>{c.foraDaCurva.length > 0 && <div className="text-[11px] text-amber-700">{c.foraDaCurva.length} fora da curva</div>}</td>
                    <td className="py-2 pr-2 text-right text-slate-700">{fmtN(c.volUn, 0)} cm³<div className="text-[11.5px] text-slate-500">{fmtN(c.minVol, 0)}–{fmtN(c.maxVol, 0)}</div></td>
                    <td className="py-2 pr-2 text-right text-slate-700">{c.pesoUnG ? `${fmtN(c.pesoUnG, 1)} g` : "—"}<div className="text-[11.5px] text-slate-500">{c.minPeso ? `${fmtN(c.minPeso, 1)}–${fmtN(c.maxPeso, 1)}` : ""}</div></td>
                    <td className="py-2 pr-2 text-slate-700">
                      {anterior?.fonte ? <BadgeFonte fonte={anterior.fonte} /> : <BadgeFonte fonte={null} />}
                      {anterior?.volEquivalente && <div className="text-[11.5px] text-slate-500">{fmtN(anterior.volEquivalente, 0)} cm³ (com aproveitamento){varia !== null && ` · calibrado ${fmtPct(varia)}`}</div>}
                    </td>
                    <td className="py-2 pr-2 text-[12px] font-semibold">
                      {promovida ? <span className="text-purple-700">promovida a override</span> : ignorada ? <span className="text-slate-500">revertida (não usada)</span> : <span className="text-green-700">em uso ({ROTULO_FONTE.calibrado})</span>}
                    </td>
                    <td className="py-2 pr-2">
                      {ocupado === c.codigo ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
                        <div className="flex flex-col items-start gap-1 text-[12.5px] font-semibold">
                          {!promovida && <button type="button" className="text-purple-700 hover:underline" onClick={() => gravar(c.codigo, { vol_efetivo_un_cm3: c.volUn, peso_g: ov?.peso_g ?? c.pesoUnG, ignorar_calibracao: true })}>Promover a override</button>}
                          {!ignorada && <button type="button" className="text-slate-600 hover:underline" onClick={() => gravar(c.codigo, { ignorar_calibracao: true })}>Reverter</button>}
                          {ignorada && <button type="button" className="text-green-700 hover:underline" onClick={() => gravar(c.codigo, { ignorar_calibracao: false, ...(promovida ? { vol_efetivo_un_cm3: null } : {}) })}>Usar calibração</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Bloco>
  );
}

/* ----------------------------------------------------------- Erro do modelo */

function ErroModelo({ despachos, ctx }: { despachos: Despacho[]; ctx: Contexto }) {
  const VARIOS = "(vários produtos)";
  const umSku = (d: Despacho) => new Set(d.itens.map((i) => i.codigo_amigavel)).size === 1;
  const porProduto = agruparErros(despachos, (d) => (umSku(d) ? d.itens[0].codigo_amigavel : VARIOS));
  const porPalavra = agruparErros(despachos, (d) => (umSku(d) ? palavraChave(ctx.mapa.get(d.itens[0].codigo_amigavel)?.nome ?? "") : VARIOS));
  const geral = agruparErros(despachos, () => "Todos");
  const porFonte = agruparErros(despachos, (d) => {
    const fs = new Set(Object.values(d.estimativa?.fontes ?? {}));
    return fs.size === 1 ? (([...fs][0] && ROTULO_FONTE[[...fs][0] as keyof typeof ROTULO_FONTE]) || "Sem medida") : "Fontes misturadas";
  });

  return (
    <>
      <Bloco titulo="Erro do modelo">
        <p className="text-[13px] text-slate-600">
          Só despachos <b>validados</b>. Erro = (estimado − real) ÷ real, com a estimativa feita na hora do registro. Positivo = o modelo superestima
          (pede mais caixa/peso do que precisou): aumentar o fator de aproveitamento. Negativo = subestima: diminuir.
          Fatores atuais: API {fmtN(ctx.config.aproveitamentoApi, 2)} · caixa master {fmtN(ctx.config.aproveitamentoMaster, 2)} (tabela calc_config).
        </p>
        {geral[0] ? <TabelaErro titulo="" linhas={geral} /> : <p className="mt-2 text-sm text-slate-500">Nenhum despacho validado ainda.</p>}
      </Bloco>
      {geral[0] && <Bloco titulo="Por fonte da medida"><TabelaErro titulo="Fonte" linhas={porFonte} /></Bloco>}
      {geral[0] && <Bloco titulo="Por palavra-chave"><TabelaErro titulo="Palavra-chave" linhas={porPalavra} /></Bloco>}
      {geral[0] && <Bloco titulo="Por produto"><TabelaErro titulo="Produto" linhas={porProduto} nome={(k) => ctx.mapa.get(k)?.nome} /></Bloco>}
    </>
  );
}

function TabelaErro({ titulo, linhas, nome }: { titulo: string; linhas: ReturnType<typeof agruparErros>; nome?: (k: string) => string | undefined }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-[12px] text-slate-500">
            {titulo && <th className="py-2 pr-2">{titulo}</th>}<th className="py-2 pr-2 text-right">Despachos</th>
            <th className="py-2 pr-2 text-right">Volume: erro médio</th><th className="py-2 pr-2 text-right">|erro| médio</th>
            <th className="py-2 pr-2 text-right">Peso: erro médio</th><th className="py-2 pr-2 text-right">|erro| médio</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className="border-b border-slate-100">
              {titulo && <td className="py-2 pr-2 text-slate-700"><span className="font-semibold">{l.chave}</span>{nome?.(l.chave) && <div className="max-w-[260px] truncate text-[11.5px] text-slate-500">{nome(l.chave)}</div>}</td>}
              <td className="py-2 pr-2 text-right">{l.n}</td>
              <td className="py-2 pr-2 text-right font-semibold">{fmtPct(l.volMedio)}</td>
              <td className="py-2 pr-2 text-right">{fmtPct(l.volAbsMedio).replace("+", "")}</td>
              <td className="py-2 pr-2 text-right font-semibold">{fmtPct(l.pesoMedio)}</td>
              <td className="py-2 pr-2 text-right">{fmtPct(l.pesoAbsMedio).replace("+", "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
