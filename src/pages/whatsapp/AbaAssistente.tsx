import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircleQuestion, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Bloco, chamar, type ConversaComAnalise } from "./comum";
import { tokensCurto } from "./tokens";

/* Assistente: perguntas livres sobre os leads e atendimentos ("como foram
   os leads de ontem?"). A edge function entende o período/origem/consultor
   da pergunta, junta os dados do banco e a IA responde. O histórico fica
   neste navegador. */

interface Mensagem { papel: "usuario" | "assistente"; texto: string; conversas?: string[]; tokens?: number }

const SUGESTOES = [
  "Como foram os leads de ontem? Quantos vieram do Meta e do Google?",
  "Quais leads desta semana ainda estão sem resposta ou sem consultor?",
  "Qual consultor teve a melhor nota este mês e qual tem mais dificuldade?",
  "Quais campanhas do Meta trouxeram leads melhores em setembro?",
  "Quais são as objeções mais comuns dos últimos 7 dias e como estamos respondendo?",
  "Em quanto tempo o consultor assume depois do resumo do SDR?",
];

const CHAVE = "whatsapp-assistente-historico";

/** Markdown simples: ### títulos, listas com "-", **negrito**. */
function Markdown({ texto }: { texto: string }) {
  const negrito = (linha: string) => linha.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>);
  const blocos: React.ReactNode[] = [];
  let lista: string[] = [];
  const fecharLista = () => {
    if (lista.length) blocos.push(<ul key={blocos.length} className="list-disc pl-5 space-y-0.5">{lista.map((l, i) => <li key={i}>{negrito(l)}</li>)}</ul>);
    lista = [];
  };
  for (const linha of texto.split("\n")) {
    const t = linha.trim();
    if (/^[-*•]\s+/.test(t)) { lista.push(t.replace(/^[-*•]\s+/, "")); continue; }
    fecharLista();
    if (!t) continue;
    const titulo = /^#{1,4}\s+(.*)/.exec(t);
    blocos.push(titulo
      ? <h4 key={blocos.length} className="font-semibold mt-2">{negrito(titulo[1])}</h4>
      : <p key={blocos.length}>{negrito(t)}</p>);
  }
  fecharLista();
  return <div className="space-y-2 text-sm">{blocos}</div>;
}

export default function AbaAssistente({ conversas, onAbrir }: { conversas: ConversaComAnalise[]; onAbrir: (c: ConversaComAnalise) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); } catch { return []; }
  });
  const [pergunta, setPergunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const porId = new Map(conversas.map((c) => [c.id, c]));

  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(mensagens.slice(-40))); } catch { /* sem localStorage */ }
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens]);

  const enviar = async (texto = pergunta) => {
    const q = texto.trim();
    if (!q || pensando) return;
    const historico = mensagens.slice(-6).map(({ papel, texto }) => ({ papel, texto }));
    setMensagens((m) => [...m, { papel: "usuario", texto: q }]);
    setPergunta("");
    setPensando(true);
    try {
      const r = await chamar({ acao: "perguntar", pergunta: q, historico });
      setMensagens((m) => [...m, { papel: "assistente", texto: r.resposta, conversas: r.conversas, tokens: r.tokens }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMensagens((m) => [...m, { papel: "assistente", texto: `Não consegui responder: ${(e as Error).message}` }]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <Bloco titulo="Assistente comercial" icone={MessageCircleQuestion} cor="emerald"
      acao={mensagens.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => setMensagens([])}><Trash2 className="h-4 w-4 mr-1" /> Limpar conversa</Button>
      )}>
      <div className="space-y-3">
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {!mensagens.length && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Pergunte sobre os leads e os atendimentos já importados. Exemplos:</p>
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-100 text-left">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={cn("flex", m.papel === "usuario" ? "justify-end" : "justify-start")}>
              <div className={cn("rounded-2xl px-4 py-2.5 max-w-[85%]",
                m.papel === "usuario" ? "bg-emerald-600 text-white" : "bg-slate-50 border border-slate-200")}>
                {m.papel === "usuario" ? <p className="text-sm whitespace-pre-wrap">{m.texto}</p> : <Markdown texto={m.texto} />}
                {!!m.conversas?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.conversas.map((id) => {
                      const c = porId.get(id);
                      return c ? (
                        <button key={id} onClick={() => onAbrir(c)} className="text-xs rounded-full bg-white border border-blue-200 text-blue-700 px-2 py-0.5 hover:bg-blue-50">
                          {c.contato_nome ?? "conversa"}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
                {m.tokens ? <p className="text-[11px] text-muted-foreground mt-1">~{tokensCurto(m.tokens)} tokens</p> : null}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando os dados…
            </div>
          )}
          <div ref={fim} />
        </div>
        <div className="flex gap-2">
          <Textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Ex.: como foram os leads de ontem? quantos vieram do Meta e do Google?"
            className="min-h-[52px]"
          />
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white self-end" onClick={() => enviar()} disabled={pensando || !pergunta.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada pergunta custa duas chamadas de IA (entender a pergunta + responder). As respostas usam só o que já foi
          importado e analisado — importe e analise o período antes de perguntar sobre ele.
        </p>
      </div>
    </Bloco>
  );
}
