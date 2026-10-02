import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Package, Upload, Boxes, Video as VideoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { uploadAnexoPcp, MockupUploadError } from "@/lib/uploadMockup";

/* Dashboard de login próprio pra terceirizada (ex.: FLEX) -- /pcp/terceirizada.
   Mostra SÓ os produtos dela, nas 3 colunas que importam pra produção
   externa: Aguardando Teste / A Produzir / Inserir Medidas. Toda leitura e
   escrita passa por funções SECURITY DEFINER estreitas (sistema_pcp_terceirizada,
   sistema_terceirizada_anexar_teste/producao/inserir_medidas) -- nunca lê
   sistema_pedidos/vw_pcp direto, então cliente/preço nunca chegam aqui. */

interface LinhaTerceirizada {
  producao_id: string;
  pedido_numero: string | null;
  coluna_pcp: string;
  produto_nome: string | null;
  mockup_url: string | null;
  imagem_catalogo_url: string | null;
  quantidade: number | null;
  personalizacao: string | null;
  observacao: string | null;
  tags: string[] | null;
  teste_anexo_url: string | null;
  producao_anexo_url: string | null;
  producao_anexo_tipo: string | null;
  volumes: { responsavel?: string; itens?: unknown[] } | null;
  item_posicao: number | null;
  etapa_desde: string;
}

const COLUNAS = [
  { coluna: "teste_fisico_terceirizada", titulo: "Aguardando Teste", cor: "#A21CAF", corFundo: "#FAE8FF" },
  { coluna: "em_producao_terceirizada", titulo: "A Produzir", cor: "#0F766E", corFundo: "#CCFBF1" },
  { coluna: "inserir_medidas", titulo: "Inserir Medidas", cor: "#4D7C0F", corFundo: "#ECFCCB" },
] as const;

/* O campo "Usuário" do login vira o e-mail do Supabase Auth. Se quem
   cadastrou o acesso já usou um e-mail de verdade (ex.: "terceirizada@
   flex.com.br"), digita ele inteiro aqui -- só completa com o domínio
   sintético quando for um usuário curto sem "@" (ex.: "flex"). */
const EMAIL_LOGIN = (usuario: string) => {
  const limpo = usuario.trim().toLowerCase();
  return limpo.includes("@") ? limpo : `${limpo}@terceirizadas.giftweb.internal`;
};

export default function PcpTerceirizada() {
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [logado, setLogado] = useState(false);

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<{ usuario: string; terceirizada_nome: string } | null>(null);
  const [linhas, setLinhas] = useState<LinhaTerceirizada[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    document.title = "Produção — Gift Web Brindes";
    supabase.auth.getSession().then(({ data }) => {
      setLogado(!!data.session);
      setSessaoPronta(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setLogado(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregarTudo = async () => {
    setCarregando(true);
    const [{ data: perfilData, error: erroPerfil }, { data: linhasData, error: erroLinhas }] = await Promise.all([
      (supabase as any).rpc("sistema_terceirizada_meu_perfil"),
      (supabase as any).rpc("sistema_pcp_terceirizada"),
    ]);
    if (erroPerfil || !perfilData?.length) {
      // Login válido no Supabase Auth, mas sem vínculo de terceirizada: não é pra essa pessoa estar aqui.
      await supabase.auth.signOut();
      setErroLogin("Este login não tem acesso a este painel.");
      setCarregando(false);
      return;
    }
    setPerfil(perfilData[0]);
    if (!erroLinhas) setLinhas((linhasData as LinhaTerceirizada[]) ?? []);
    setCarregando(false);
  };

  useEffect(() => {
    if (!sessaoPronta || !logado) return;
    void carregarTudo();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => { clearTimeout(timer); timer = setTimeout(() => void carregarTudo(), 1200); };
    const canal = supabase
      .channel("pcp-terceirizada-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_producao_itens" }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoPronta, logado]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha) return;
    setEntrando(true);
    setErroLogin(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: EMAIL_LOGIN(usuario), password: senha,
    });
    setEntrando(false);
    if (error) setErroLogin("Usuário ou senha incorretos.");
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setLinhas([]);
  };

  if (!sessaoPronta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A2A56]">
        <Loader2 className="h-6 w-6 text-white animate-spin" />
      </div>
    );
  }

  if (!logado || !perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A2A56] px-4">
        <form onSubmit={entrar} className="w-full max-w-[360px] bg-white rounded-[14px] p-7 shadow-xl space-y-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <img src="/logos/giftweb-logo.png" alt="Gift Web" className="h-14 w-14" />
            <h1 className="text-[18px] font-bold text-[#0A2A56]">Painel de Produção</h1>
            <p className="text-[12.5px] text-[#748094]">Acesso exclusivo para parceiros terceirizados</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[#334155]">Usuário</label>
            <input
              value={usuario} onChange={e => setUsuario(e.target.value)} autoFocus
              className="w-full h-10 rounded-[8px] border border-[#D9E0E8] px-3 text-[14px]"
              placeholder="ex.: flex"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[#334155]">Senha</label>
            <input
              value={senha} onChange={e => setSenha(e.target.value)} type="password"
              className="w-full h-10 rounded-[8px] border border-[#D9E0E8] px-3 text-[14px]"
            />
          </div>
          {erroLogin && <p className="text-[12.5px] font-semibold text-[#DC2626]">{erroLogin}</p>}
          <button
            type="submit" disabled={entrando}
            className="w-full h-10 rounded-[8px] bg-[#15803D] text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {entrando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <header className="bg-[#0A2A56] text-white px-5 py-3.5 flex items-center gap-3">
        <img src="/logos/giftweb-logo.png" alt="" className="h-9 w-9" />
        <div>
          <p className="font-bold text-[15px] leading-tight">{perfil.terceirizada_nome}</p>
          <p className="text-[11.5px] text-white/70 leading-tight">Painel de Produção</p>
        </div>
        <span className="flex-1" />
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-white/70" />}
        <button onClick={sair} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/85 hover:text-white">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUNAS.map(col => {
          const itens = linhas
            .filter(l => l.coluna_pcp === col.coluna)
            .sort((a, b) => (a.item_posicao ?? 0) - (b.item_posicao ?? 0));
          return (
            <div key={col.coluna} className="rounded-[12px] bg-white border border-[#E2E8F0] overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: col.corFundo }}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.cor }} />
                <p className="text-[13px] font-bold" style={{ color: col.cor }}>{col.titulo}</p>
                <span className="ml-auto text-[11.5px] font-bold text-[#64748B]">{itens.length}</span>
              </div>
              <div className="p-2.5 space-y-2.5 min-h-[80px]">
                {itens.length === 0 ? (
                  <p className="text-[12px] text-[#94A3B8] text-center py-6">Nada por aqui.</p>
                ) : itens.map(item => (
                  <CardTerceirizada key={item.producao_id} item={item} coluna={col.coluna} onAtualizado={carregarTudo} />
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

function CardTerceirizada({
  item, coluna, onAtualizado,
}: { item: LinhaTerceirizada; coluna: string; onAtualizado: () => void }) {
  const foto = item.mockup_url || item.imagem_catalogo_url;
  const [enviando, setEnviando] = useState(false);
  const inputTesteRef = useRef<HTMLInputElement | null>(null);
  const inputProducaoRef = useRef<HTMLInputElement | null>(null);
  const [medidasAberto, setMedidasAberto] = useState(false);

  const handleAnexoTeste = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      const { url } = await uploadAnexoPcp(file, item.producao_id, "teste");
      const { error } = await (supabase as any).rpc("sistema_terceirizada_anexar_teste", {
        p_producao_id: item.producao_id, p_url: url,
      });
      if (error) throw error;
      onAtualizado();
    } catch (err) {
      alert(err instanceof MockupUploadError ? err.message : (err as Error)?.message || "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  const handleAnexoProducao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      const { url, tipo } = await uploadAnexoPcp(file, item.producao_id, "producao");
      const { error } = await (supabase as any).rpc("sistema_terceirizada_anexar_producao", {
        p_producao_id: item.producao_id, p_url: url, p_tipo: tipo,
      });
      if (error) throw error;
      onAtualizado();
    } catch (err) {
      alert(err instanceof MockupUploadError ? err.message : (err as Error)?.message || "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[#E2E8F0] overflow-hidden bg-white">
      <div className="flex gap-2.5 p-2.5">
        {foto ? (
          <img src={sizedImage(foto, 160)} alt="" className="h-[58px] w-[58px] rounded-[7px] object-cover bg-[#F1F5F9] shrink-0" />
        ) : (
          <div className="h-[58px] w-[58px] rounded-[7px] bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-[#94A3B8]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0F172A] leading-tight truncate" title={item.produto_nome || "—"}>
            {item.produto_nome || "—"}
          </p>
          <p className="text-[11px] text-[#64748B]">
            {item.pedido_numero ? `Pedido #${item.pedido_numero}` : ""}
          </p>
          <p className="text-[12.5px] font-bold text-[#0F172A] mt-0.5">{item.quantidade ?? 0} un.</p>
        </div>
      </div>

      {item.personalizacao && (
        <p className="px-2.5 pb-1.5 text-[11.5px] text-[#475569]">{item.personalizacao}</p>
      )}

      <div className="px-2.5 pb-2.5">
        {coluna === "teste_fisico_terceirizada" && (
          <>
            <input ref={inputTesteRef} type="file" accept="image/*" className="hidden" onChange={handleAnexoTeste} />
            <button
              onClick={() => inputTesteRef.current?.click()} disabled={enviando}
              className="w-full h-8 rounded-[7px] bg-[#7E22CE] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Anexar teste
            </button>
          </>
        )}
        {coluna === "em_producao_terceirizada" && (
          <>
            <input ref={inputProducaoRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleAnexoProducao} />
            <button
              onClick={() => inputProducaoRef.current?.click()} disabled={enviando}
              className="w-full h-8 rounded-[7px] bg-[#0F766E] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <VideoIcon className="h-3.5 w-3.5" />} Anexar produção
            </button>
          </>
        )}
        {coluna === "inserir_medidas" && (
          <button
            onClick={() => setMedidasAberto(true)}
            className="w-full h-8 rounded-[7px] bg-[#4D7C0F] text-white text-[12px] font-bold flex items-center justify-center gap-1.5"
          >
            <Boxes className="h-3.5 w-3.5" /> Inserir medidas
          </button>
        )}
      </div>

      {medidasAberto && (
        <ModalMedidas
          producaoId={item.producao_id}
          onFechar={() => setMedidasAberto(false)}
          onSalvo={() => { setMedidasAberto(false); onAtualizado(); }}
        />
      )}
    </div>
  );
}

function ModalMedidas({
  producaoId, onFechar, onSalvo,
}: { producaoId: string; onFechar: () => void; onSalvo: () => void }) {
  const [comprimento, setComprimento] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [peso, setPeso] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setErro(null);
    const n = (v: string) => Number(v.replace(",", "."));
    if (!n(comprimento) || !n(altura) || !n(largura) || !n(peso)) {
      setErro("Preencha comprimento, altura, largura e peso.");
      return;
    }
    if (!responsavel.trim()) { setErro("Informe seu nome."); return; }
    setSalvando(true);
    const { error } = await (supabase as any).rpc("sistema_terceirizada_inserir_medidas", {
      p_producao_id: producaoId,
      p_comprimento: n(comprimento), p_altura: n(altura), p_largura: n(largura), p_peso: n(peso),
      p_responsavel: responsavel.trim(),
    });
    setSalvando(false);
    if (error) { setErro(error.message || "Não foi possível salvar."); return; }
    onSalvo();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onFechar}>
      <div className="bg-white rounded-[12px] p-5 w-full max-w-[340px] space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-[14px] font-bold text-[#0F172A]">Medidas da caixa</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Comprimento (cm)" value={comprimento} onChange={setComprimento} />
          <Campo label="Altura (cm)" value={altura} onChange={setAltura} />
          <Campo label="Largura (cm)" value={largura} onChange={setLargura} />
          <Campo label="Peso (kg)" value={peso} onChange={setPeso} />
        </div>
        <Campo label="Responsável pela medição" value={responsavel} onChange={setResponsavel} span2 />
        {erro && <p className="text-[12px] font-semibold text-[#DC2626]">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onFechar} className="flex-1 h-9 rounded-[7px] border border-[#D9E0E8] text-[13px] font-semibold">Cancelar</button>
          <button
            onClick={salvar} disabled={salvando}
            className="flex-1 h-9 rounded-[7px] bg-[#4D7C0F] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label, value, onChange, span2,
}: { label: string; value: string; onChange: (v: string) => void; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2 space-y-1" : "space-y-1"}>
      <label className="text-[11.5px] font-semibold text-[#334155]">{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} inputMode={span2 ? "text" : "decimal"}
        className="w-full h-9 rounded-[7px] border border-[#D9E0E8] px-2.5 text-[13px]"
      />
    </div>
  );
}
