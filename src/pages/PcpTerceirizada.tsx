import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Package, Upload, Boxes, Video as VideoIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sizedImage } from "@/lib/imageSize";
import { uploadAnexoPcp, MockupUploadError } from "@/lib/uploadMockup";
import { resumoPersonalizacao, rotuloPersonalizacao } from "@/lib/personalizacao";
import { corDaTag, pastelizar, rotuloTag } from "@/lib/tagsPcp";
import { OrderNumber } from "@/components/sistema/ui/OrderNumber";

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
  aplicacoes: number | null;
  observacao: string | null;
  pedido_observacoes: string | null;
  tags: string[] | null;
  teste_anexo_url: string | null;
  producao_anexo_url: string | null;
  producao_anexo_tipo: string | null;
  volumes: { responsavel?: string; itens?: unknown[] } | null;
  item_posicao: number | null;
  item_total_pedido: number | null;
  etapa_desde: string;
}

const PEDIDO_PALETTE = [
  "#2563EB", "#F97316", "#14B8A6", "#A855F7", "#EAB308",
  "#EC4899", "#0EA5E9", "#16A34A", "#F43F5E", "#8B5CF6",
];

/** Mesma lógica de corDoPedido do PCP interno, sem o campo pedido_cor
    (esse dashboard não tem acesso a sistema_pedidos). */
const corDoPedido = (pedidoNumero: string | null, producaoId: string) => {
  const key = pedidoNumero || producaoId || "";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PEDIDO_PALETTE[h % PEDIDO_PALETTE.length];
};

const tempoNaEtapaCurto = (iso: string) => {
  const horas = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (horas < 1) return "<1h";
  if (horas < 24) return `${Math.floor(horas)}h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.floor(horas % 24);
  return resto > 0 ? `${dias}d ${resto}h` : `${dias}d`;
};

interface ComentarioRow {
  id: string;
  mensagem: string;
  autor_id: string | null;
  autor_email: string | null;
  autor_nome: string | null;
  mencionados: string[] | null;
  lido_por: string[] | null;
  created_at: string;
}

const CHAT_MENTION_REGEX = /@([a-zà-ú]*)$/i;

/* Mesmos rótulo/cor das colunas do PCP interno (TODAS_COLUNAS_PCP em
   src/lib/statusPedido.ts) -- "o que acontece em um, acontece no outro,
   exatamente igual", incluindo o nome da etapa escrito igual. */
const COLUNAS = [
  { coluna: "teste_fisico_terceirizada", titulo: "Aguardando Teste Terceirizada", cor: "#A21CAF", corFundo: "#FAE8FF" },
  { coluna: "teste_enviado", titulo: "Teste Enviado", cor: "#BE185D", corFundo: "#FCE7F3" },
  { coluna: "em_producao_terceirizada", titulo: "A Produzir Terceirizada", cor: "#0F766E", corFundo: "#CCFBF1" },
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
  const [meuUserId, setMeuUserId] = useState<string | null>(null);
  const [nomesUsuarios, setNomesUsuarios] = useState<{ user_id: string; nome: string }[]>([]);
  const [chatResumo, setChatResumo] = useState<{ producao_item_id: string; nao_lidas: number; mencionado: boolean }[]>([]);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const carregarChatResumo = async () => {
    const { data } = await (supabase as any).rpc("sistema_chat_resumo");
    setChatResumo((data ?? []) as { producao_item_id: string; nao_lidas: number; mencionado: boolean }[]);
  };

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
    const { data: auth } = await supabase.auth.getUser();
    setMeuUserId(auth?.user?.id ?? null);
    const { data: nomes } = await (supabase as any).rpc("sistema_nomes_usuarios");
    setNomesUsuarios((nomes ?? []) as { user_id: string; nome: string }[]);
    await carregarChatResumo();
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
      .on("postgres_changes", { event: "*", schema: "public", table: "sistema_producao_comentarios" }, () => void carregarChatResumo())
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

      <main className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
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
                  <CardTerceirizada
                    key={item.producao_id}
                    item={item}
                    coluna={col.coluna}
                    onAtualizado={carregarTudo}
                    onAbrir={() => setDetalheId(item.producao_id)}
                    chat={chatResumo.find(r => r.producao_item_id === item.producao_id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {detalheId && (
        <DetalheModal
          item={linhas.find(l => l.producao_id === detalheId) ?? null}
          meuUserId={meuUserId}
          meuNome={perfil.terceirizada_nome}
          nomesUsuarios={nomesUsuarios}
          onFechar={() => setDetalheId(null)}
          onLido={carregarChatResumo}
        />
      )}
    </div>
  );
}

function CardTerceirizada({
  item, coluna, onAtualizado, onAbrir, chat,
}: {
  item: LinhaTerceirizada; coluna: string; onAtualizado: () => void; onAbrir: () => void;
  chat?: { nao_lidas: number; mencionado: boolean };
}) {
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

  const cor = corDoPedido(item.pedido_numero, item.producao_id);
  const tecnicaCurta = rotuloPersonalizacao(item.personalizacao);
  const tecnica = resumoPersonalizacao({ personalizacao: item.personalizacao, aplicacoes: item.aplicacoes });
  const tags = item.tags ?? [];

  return (
    <div
      onClick={onAbrir}
      className="w-full rounded-[16px] overflow-hidden bg-white border border-[#E2E8F0] cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Topo -- igual ao PCP interno: bolinha colorida do pedido, número,
          item X/Y, e tempo nesta etapa à direita. */}
      <div className="flex items-start justify-between gap-2 pl-3 pr-2.5 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ backgroundColor: cor }} />
          <OrderNumber value={item.pedido_numero ?? "—"} className="text-[13px] shrink-0" />
          {item.item_total_pedido != null && item.item_total_pedido > 1 && (
            <span className="text-[12px] font-medium text-[#64748B] shrink-0">
              Item {item.item_posicao ?? 1}/{item.item_total_pedido}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {chat && chat.nao_lidas > 0 && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-bold rounded-full px-[6px] py-[2px] text-white"
              style={{ backgroundColor: chat.mencionado ? "#DC2626" : "#0A2A56" }}
            >
              💬 {chat.nao_lidas}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#64748B]">
            <Clock className="h-[11px] w-[11px]" /> {tempoNaEtapaCurto(item.etapa_desde)}
          </span>
        </div>
      </div>

      {/* Foto grande (contain, sem cortar) com selo de técnica e quantidade
          nos cantos inferiores -- mesmo layout do card interno. Quando já
          tem foto de teste/produção anexada, ela aparece do lado, bem
          visível, não só escondida dentro de um anexo. */}
      <div className="px-3 pb-2 flex gap-1.5">
        <div className="relative h-[168px] flex-1 min-w-0 rounded-[10px] bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden">
          {foto ? (
            <img src={sizedImage(foto, 480)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-[#94A3B8]" />
            </div>
          )}
          {tecnicaCurta && (
            <span
              className="absolute left-1.5 bottom-1.5 text-[10px] font-bold leading-none rounded-[5px] px-[7px] py-[4px] text-white"
              style={{ backgroundColor: "rgba(0,0,0,.78)" }}
            >
              {tecnicaCurta}
            </span>
          )}
          <span
            className="absolute right-1.5 bottom-1.5 leading-none rounded-[5px] px-[7px] py-[4px] text-white"
            style={{ backgroundColor: "rgba(0,0,0,.78)" }}
          >
            <span className="text-[16px] font-extrabold">{item.quantidade ?? 0}</span>{" "}
            <span className="text-[9px] font-medium">un.</span>
          </span>
        </div>
        {(item.teste_anexo_url || item.producao_anexo_url) && (
          <div className="relative h-[168px] flex-1 min-w-0 rounded-[10px] bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden">
            {item.producao_anexo_url && item.producao_anexo_tipo === "video" ? (
              <video src={item.producao_anexo_url} controls className="h-full w-full object-contain bg-black" />
            ) : (
              <img
                src={sizedImage((item.producao_anexo_url || item.teste_anexo_url)!, 480)}
                alt="" loading="lazy" decoding="async" className="h-full w-full object-contain"
              />
            )}
            <span
              className="absolute left-1.5 bottom-1.5 text-[10px] font-bold leading-none rounded-[5px] px-[7px] py-[4px] text-white"
              style={{ backgroundColor: "rgba(0,0,0,.78)" }}
            >
              {item.producao_anexo_url ? "Produção anexada" : "Teste anexado"}
            </span>
          </div>
        )}
      </div>

      <div className="px-3 pb-1.5">
        <p
          className="text-[13px] font-semibold text-[#0F172A] leading-tight"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          title={item.produto_nome || undefined}
        >
          {item.produto_nome || "—"}
        </p>
        {tecnica && <p className="text-[11px] text-[#64748B] mt-0.5">{tecnica}</p>}
      </div>

      {tags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {tags.map(t => (
            <span
              key={t}
              className="text-[10px] leading-none rounded-[5px] px-[7px] py-[4px] whitespace-nowrap font-bold"
              style={{ backgroundColor: pastelizar(corDaTag(t)), color: corDaTag(t) }}
            >
              {rotuloTag(t)}
            </span>
          ))}
        </div>
      )}

      <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
        {coluna === "teste_enviado" && (
          <p className="text-[11.5px] text-[#64748B] text-center py-1">Aguardando aprovação do cliente.</p>
        )}
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

/** Painel de detalhe do produto: foto + dados essenciais + observação
 *  fixa + chat (mesma tabela sistema_producao_comentarios do PCP
 *  interno -- é o mesmo chat dos dois lados, não uma cópia). */
function DetalheModal({
  item, meuUserId, meuNome, nomesUsuarios, onFechar, onLido,
}: {
  item: LinhaTerceirizada | null;
  meuUserId: string | null;
  meuNome: string;
  nomesUsuarios: { user_id: string; nome: string }[];
  onFechar: () => void;
  onLido: () => void;
}) {
  const [comentarios, setComentarios] = useState<ComentarioRow[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mencaoAberta, setMencaoAberta] = useState(false);

  const carregar = async () => {
    if (!item) return;
    const { data } = await supabase
      .from("sistema_producao_comentarios" as any)
      .select("*")
      .eq("producao_item_id", item.producao_id)
      .order("created_at", { ascending: true });
    const lista = (data as any as ComentarioRow[]) ?? [];
    setComentarios(lista);
    if (meuUserId) {
      const naoLidas = lista.filter(c => !(c.lido_por ?? []).includes(meuUserId));
      if (naoLidas.length > 0) {
        await Promise.all(naoLidas.map(c =>
          supabase.from("sistema_producao_comentarios" as any)
            .update({ lido_por: [...(c.lido_por ?? []), meuUserId] })
            .eq("id", c.id),
        ));
        onLido();
      }
    }
  };

  useEffect(() => {
    if (!item) return;
    void carregar();
    const canal = supabase
      .channel(`chat-terceirizada-${item.producao_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sistema_producao_comentarios", filter: `producao_item_id=eq.${item.producao_id}` },
        () => void carregar(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.producao_id]);

  const resolverMencoes = (msg: string): string[] => {
    const ids = new Set<string>();
    for (const u of nomesUsuarios) {
      if (!u.nome) continue;
      if (new RegExp(`@${u.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(msg)) ids.add(u.user_id);
    }
    return [...ids];
  };

  const enviar = async () => {
    if (!item) return;
    const msg = texto.trim();
    if (!msg) return;
    setEnviando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("sistema_producao_comentarios" as any).insert({
      producao_item_id: item.producao_id,
      mensagem: msg,
      autor_id: auth?.user?.id ?? null,
      autor_email: auth?.user?.email ?? null,
      autor_nome: meuNome,
      mencionados: resolverMencoes(msg),
      lido_por: auth?.user?.id ? [auth.user.id] : [],
    });
    setEnviando(false);
    if (error) { alert(error.message || "Não foi possível enviar."); return; }
    setTexto("");
    setMencaoAberta(false);
    await carregar();
  };

  const opcoesMencao = (() => {
    const m = texto.match(CHAT_MENTION_REGEX);
    if (!m) return [];
    const termo = m[1].toLowerCase();
    return nomesUsuarios.filter(u => u.nome?.toLowerCase().includes(termo)).slice(0, 6);
  })();

  if (!item) return null;
  const foto = item.mockup_url || item.imagem_catalogo_url;
  const tecnica = resumoPersonalizacao({ personalizacao: item.personalizacao, aplicacoes: item.aplicacoes });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-[14px] w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0]">
          {foto && <img src={sizedImage(foto, 120)} alt="" className="h-11 w-11 rounded-[8px] object-contain bg-[#F1F5F9] border border-[#E2E8F0]" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[#0F172A] truncate">{item.produto_nome || "—"}</p>
            <p className="text-[12px] text-[#64748B]">
              {item.quantidade ?? 0} un{tecnica ? ` · ${tecnica}` : ""}
            </p>
          </div>
          <button onClick={onFechar} className="text-[#64748B] text-[20px] leading-none px-1">×</button>
        </div>

        {(item.pedido_observacoes || item.observacao) && (
          <div className="px-4 pt-3 space-y-1.5 shrink-0">
            {item.pedido_observacoes && (
              <div className="rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2">
                <p className="text-[10.5px] font-bold uppercase text-[#94A3B8] mb-0.5">Observação do pedido</p>
                <p className="text-[12.5px] text-[#0F172A] whitespace-pre-wrap">{item.pedido_observacoes}</p>
              </div>
            )}
            {item.observacao && (
              <div className="rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2">
                <p className="text-[10.5px] font-bold uppercase text-[#94A3B8] mb-0.5">Observação do item</p>
                <p className="text-[12.5px] text-[#0F172A] whitespace-pre-wrap">{item.observacao}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-[220px] overflow-y-auto px-4 py-3 space-y-1.5">
          {comentarios.length === 0 ? (
            <p className="text-[13px] text-[#94A3B8] text-center py-8">Nenhuma mensagem ainda. Escreva a primeira abaixo.</p>
          ) : (
            comentarios.map(c => {
              const minha = !!meuUserId && c.autor_id === meuUserId;
              return (
                <div key={c.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-[12px] px-3 py-1.5 shadow-sm ${
                      minha ? "bg-[#15803D] text-white rounded-br-[3px]" : "bg-[#F1F5F9] border border-[#E2E8F0] rounded-bl-[3px]"
                    }`}
                  >
                    {!minha && <p className="text-[11.5px] font-bold text-[#0A2A56]">{c.autor_nome || "Gift Web"}</p>}
                    <p className={`text-[13.5px] whitespace-pre-wrap leading-snug ${minha ? "text-white" : "text-[#0F172A]"}`}>
                      {c.mensagem}
                    </p>
                    <p className={`text-[10px] mt-0.5 text-right ${minha ? "text-white/70" : "text-[#94A3B8]"}`}>
                      {new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="relative px-4 pb-4 pt-1 shrink-0">
          {mencaoAberta && opcoesMencao.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 rounded-[8px] border border-[#E2E8F0] bg-white shadow-lg overflow-hidden z-10">
              {opcoesMencao.map(u => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => { setTexto(prev => prev.replace(CHAT_MENTION_REGEX, `@${u.nome} `)); setMencaoAberta(false); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#F1F5F9]"
                >
                  @{u.nome}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setMencaoAberta(CHAT_MENTION_REGEX.test(e.target.value)); }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escreva uma mensagem… use @ pra marcar alguém"
              rows={2}
              className="flex-1 text-[13px] resize-none rounded-[8px] border border-[#D9E0E8] px-3 py-2"
            />
            <button
              onClick={enviar} disabled={enviando || !texto.trim()}
              className="h-9 w-9 shrink-0 rounded-[8px] bg-[#15803D] text-white flex items-center justify-center disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "➤"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
