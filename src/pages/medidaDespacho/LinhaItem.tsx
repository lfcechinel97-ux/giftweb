import { useState } from "react";
import { ChevronDown, ImageOff, Loader2, Save, Trash2 } from "lucide-react";
import type { Alerta } from "@/lib/medidaDespacho/fontes";
import { fmtCm } from "@/lib/medidaDespacho/resumo";
import type { LinhaForm, LinhaResolvida } from "./estado";
import { BadgeConfianca, BadgeFonte, CampoNumero, ListaAlertas, fmtN, inputCls } from "./ui";

interface Props {
  r: LinhaResolvida;
  erroCalculo: string | null;
  onMudar: (m: Partial<LinhaForm>) => void;
  onRemover: () => void;
  onSalvarOverride: () => Promise<void>;
}

export default function LinhaItem({ r, erroCalculo, onMudar, onRemover, onSalvarOverride }: Props) {
  const { linha: l, produto: p, medida: m, configs } = r;
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  if (!p || !m) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Produto {l.codigo} não encontrado no cadastro da XBZ.
        <button type="button" onClick={onRemover} className="rounded-lg p-2 hover:bg-red-100" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
      </div>
    );
  }

  const d = m.dimsExibidas; // [largura, altura, profundidade]
  const alertas: Pick<Alerta, "tipo" | "texto">[] = [...m.alertas];
  if (erroCalculo) alertas.unshift({ tipo: "erro", texto: erroCalculo });
  const temDigitado = !!(l.altura || l.largura || l.profundidade || l.peso || l.compressao);
  const precisaPreencher = !m.fonte || !m.pesoG || m.alertas.some((a) => a.codigo === "dobravel");
  const aberto = l.aberto ?? precisaPreencher;

  const salvar = async () => {
    setSalvando(true); setErroSalvar(null);
    try { await onSalvarOverride(); } catch (e) { setErroSalvar((e as Error).message); } finally { setSalvando(false); }
  };

  const medidaTexto = m.fonte === "calibrado" || (m.fonte === "override" && !d)
    ? `${fmtN(m.volEfetivoUn, 0)} cm³/un`
    : m.fonte === "master" && m.configMaster
      ? `${fmtN(m.volEfetivoUn, 0)} cm³/un · caixa ${fmtCm(m.configMaster.largura)}×${fmtCm(m.configMaster.comprimento)}×${fmtCm(m.configMaster.altura)} c/ ${m.configMaster.qtd}${configs.length > 1 && !l.master ? ` (mediana de ${configs.length})` : ""}`
      : d ? `${fmtCm(d[0])} × ${fmtCm(d[1])} × ${fmtCm(d[2])} cm (L×A×P)${m.fatorCompressao < 1 ? ` × ${fmtN(m.fatorCompressao, 2)}` : ""}` : "—";

  return (
    <div className={`rounded-xl border p-3 ${erroCalculo || !m.fonte ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        {p.imagem ? (
          <img src={p.imagem} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 object-contain" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100"><ImageOff className="h-4 w-4 text-slate-400" /></div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[12px] font-bold text-slate-500">{p.codigo}</span>
            <BadgeFonte fonte={m.fonte} />
            <BadgeConfianca confianca={m.confianca} />
          </div>
          <p className="truncate text-[14px] font-semibold text-slate-800" title={p.nome}>{p.nome}</p>
          <p className="text-[12.5px] text-slate-500">
            {medidaTexto} · {m.pesoG ? `${fmtN(m.pesoG, 1)} g/un` : <span className="font-semibold text-red-600">sem peso</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <label className="block w-20 sm:w-24">
            <span className="sr-only">Quantidade</span>
            <input inputMode="numeric" value={l.qtd} onChange={(e) => onMudar({ qtd: e.target.value })} placeholder="Qtd" className={inputCls(!r.qtd, true) + " text-right font-semibold"} />
          </label>
          <button type="button" onClick={onRemover} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="Remover item">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ListaAlertas alertas={alertas} />

      <button
        type="button"
        onClick={() => onMudar({ aberto: !aberto })}
        className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-[#1464D2]"
      >
        {aberto ? "Ocultar ajustes" : "Ajustar medida, peso, cor"} <ChevronDown className={`h-3.5 w-3.5 transition ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <CampoNumero compacto rotulo="Largura" sufixo="cm" valor={l.largura} placeholder={fmtN(d?.[0])} onChange={(v) => onMudar({ largura: v })} />
            <CampoNumero compacto rotulo="Altura" sufixo="cm" valor={l.altura} placeholder={fmtN(d?.[1])} onChange={(v) => onMudar({ altura: v })} />
            <CampoNumero compacto rotulo="Profundidade" sufixo="cm" valor={l.profundidade} placeholder={fmtN(d?.[2])} onChange={(v) => onMudar({ profundidade: v })} />
            <CampoNumero compacto rotulo="Peso unitário" sufixo="g" valor={l.peso} placeholder={fmtN(m.pesoG)} erro={!m.pesoG} onChange={(v) => onMudar({ peso: v })} />
            <CampoNumero compacto rotulo="Fator compressão" valor={l.compressao} placeholder={fmtN(m.fatorCompressao, 2)} onChange={(v) => onMudar({ compressao: v })} />
          </div>
          <p className="text-[12px] text-slate-500">
            Medida da unidade <b>fechada/embalada</b>. Fator de compressão: 1 = sem compressão; 0,4 = ocupa 40% da medida informada (mochila dobrada).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {p.variantes.length > 1 && (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-600">Cor (opcional)</span>
                <select value={l.variante ?? ""} onChange={(e) => onMudar({ variante: e.target.value || null, master: null })} className={inputCls(false, true)}>
                  <option value="">Qualquer cor</option>
                  {p.variantes.map((v) => (
                    <option key={v.codigoComposto} value={v.codigoComposto}>{v.codigoComposto}{v.cor ? ` · ${v.cor}` : ""} ({v.estoque.toLocaleString("pt-BR")} em estoque)</option>
                  ))}
                </select>
              </label>
            )}
            {configs.length > 1 && (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-600">Caixa master ({configs.length} configurações)</span>
                <select value={l.master ?? ""} onChange={(e) => onMudar({ master: e.target.value || null })} className={inputCls(false, true)}>
                  <option value="">Mediana (padrão)</option>
                  {configs.map((c) => (
                    <option key={c.chave} value={c.chave}>
                      {fmtCm(c.largura)}×{fmtCm(c.comprimento)}×{fmtCm(c.altura)} c/ {c.qtd} un · {fmtN(c.volUn, 0)} cm³/un
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!temDigitado || salvando}
              onClick={salvar}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              title="Grava para os próximos cálculos de qualquer pessoa da equipe"
            >
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar como override
            </button>
            {temDigitado && (
              <button type="button" onClick={() => onMudar({ altura: "", largura: "", profundidade: "", peso: "", compressao: "" })} className="text-[12.5px] font-semibold text-slate-500 hover:text-slate-700">
                Limpar o que digitei
              </button>
            )}
            {erroSalvar && <span className="text-[12.5px] text-red-600">{erroSalvar}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
