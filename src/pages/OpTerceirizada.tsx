import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, MoveHorizontal, MoveVertical, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* Página PÚBLICA (sem login) da ordem de produção terceirizada. Lê só o
   retrato congelado do link via sistema_op_terceirizada_publica — nada do
   pedido, cliente ou preço chega aqui. */

interface Conteudo {
  pedido_numero?: string;
  produto_nome?: string;
  quantidade?: number;
  mockup_url?: string | null;
  arte_url?: string | null;
  personalizacao?: string;
  observacao?: string;
  terceirizada_nome?: string;
}

interface Dados {
  dimensao_tipo: "largura" | "altura";
  dimensao_cm: number;
  conteudo: Conteudo;
  expira_em: string;
}

const AZUL = "#1464D2";
const AZUL_ESCURO = "#102A56";

const nomeDoArquivo = (url: string) => {
  try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || "logo"); }
  catch { return "logo"; }
};

const ehImagem = (url: string) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);

export default function OpTerceirizada() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<"carregando" | "ok" | "indisponivel">("carregando");
  const [dados, setDados] = useState<Dados | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    document.title = "Ordem de produção — GiftWeb Brindes";
    (async () => {
      const { data, error } = await (supabase as any).rpc("sistema_op_terceirizada_publica", { p_token: token });
      if (error || !data) { setEstado("indisponivel"); return; }
      setDados(data as Dados);
      setEstado("ok");
    })();
  }, [token]);

  /* O atributo download é ignorado em URL de outro domínio (o storage),
     então baixa o arquivo como blob; se o navegador bloquear, abre. */
  const baixarLogo = async (url: string) => {
    setBaixando(true);
    try {
      const blob = await fetch(url).then(r => { if (!r.ok) throw new Error(); return r.blob(); });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = nomeDoArquivo(url);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      window.open(url, "_blank", "noopener");
    } finally {
      setBaixando(false);
    }
  };

  if (estado === "carregando") {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">Carregando…</div>;
  }

  if (estado === "indisponivel" || !dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200 p-8">
          <Package className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <h1 className="text-lg font-bold" style={{ color: AZUL_ESCURO }}>Link indisponível</h1>
          <p className="text-sm text-slate-500 mt-2">
            Este link de ordem de produção expirou ou não existe. Peça um novo link à GiftWeb Brindes.
          </p>
        </div>
      </div>
    );
  }

  const c = dados.conteudo;
  const horizontal = dados.dimensao_tipo === "largura";
  const medida = `${Number(dados.dimensao_cm).toLocaleString("pt-BR")} cm`;

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172033]">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest" style={{ color: AZUL }}>GIFTWEB BRINDES</p>
            <h1 className="text-xl md:text-2xl font-extrabold" style={{ color: AZUL_ESCURO }}>
              Ordem de produção terceirizada
            </h1>
            {c.terceirizada_nome && <p className="text-sm text-slate-500 mt-0.5">Para: {c.terceirizada_nome}</p>}
          </div>
          {c.pedido_numero && (
            <div className="text-right">
              <p className="text-[11px] text-slate-500">PEDIDO Nº</p>
              <p className="text-3xl font-extrabold leading-none" style={{ color: AZUL_ESCURO }}>{c.pedido_numero}</p>
            </div>
          )}
        </header>

        <div className="grid gap-5 md:grid-cols-[1.35fr_1fr]">
          {/* Mockup com a dimensão da logo */}
          <section className="bg-white rounded-2xl border border-[#D9E0E8] overflow-hidden">
            <div className="relative bg-white">
              {c.mockup_url ? (
                <img src={c.mockup_url} alt={c.produto_nome || "Mockup"} className="w-full max-h-[560px] object-contain" />
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400">Sem mockup</div>
              )}
            </div>
            <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ backgroundColor: AZUL }}>
              {horizontal ? <MoveHorizontal className="h-7 w-7 shrink-0" /> : <MoveVertical className="h-7 w-7 shrink-0" />}
              <div>
                <p className="text-[11px] font-bold tracking-wider opacity-90">
                  {horizontal ? "LARGURA DA LOGO" : "ALTURA DA LOGO"}
                </p>
                <p className="text-2xl font-extrabold leading-tight">{medida}</p>
              </div>
              <p className="ml-auto text-[11px] opacity-90 text-right max-w-[180px]">
                A outra medida acompanha a proporção da arte.
              </p>
            </div>
          </section>

          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-[#D9E0E8] p-5 space-y-4">
              <h2 className="text-lg font-bold" style={{ color: AZUL_ESCURO }}>{c.produto_nome}</h2>
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-500">QUANTIDADE</p>
                <p className="text-2xl font-extrabold" style={{ color: AZUL }}>{c.quantidade ?? "—"} un.</p>
              </div>
              {c.personalizacao && (
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">PERSONALIZAÇÃO</p>
                  <p className="text-base font-semibold whitespace-pre-line">{c.personalizacao}</p>
                </div>
              )}
              {c.observacao && (
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500">OBSERVAÇÕES</p>
                  <p className="text-sm whitespace-pre-line break-words">{c.observacao}</p>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#D9E0E8] p-5 space-y-3">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">LOGO DO CLIENTE</p>
              {c.arte_url ? (
                <>
                  {ehImagem(c.arte_url) && (
                    <div className="rounded-xl border border-[#D9E0E8] bg-[#F5F7FA] p-3">
                      <img src={c.arte_url} alt="Logo do cliente" className="w-full max-h-48 object-contain" />
                    </div>
                  )}
                  <p className="text-xs text-slate-500 break-all">{nomeDoArquivo(c.arte_url)}</p>
                  <button
                    type="button"
                    onClick={() => void baixarLogo(c.arte_url!)}
                    disabled={baixando}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-white font-bold disabled:opacity-60"
                    style={{ backgroundColor: "#19A84A" }}
                  >
                    <Download className="h-5 w-5" /> {baixando ? "Baixando…" : "Baixar"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">A arte não foi anexada a este produto.</p>
              )}
            </section>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Link válido até {new Date(dados.expira_em).toLocaleDateString("pt-BR")}.
        </p>
      </div>
    </div>
  );
}
