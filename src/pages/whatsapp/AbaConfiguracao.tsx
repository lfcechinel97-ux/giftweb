import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, ClipboardList, Loader2, RefreshCw, Save, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bloco, tabela } from "./comum";

/* Configuração: o processo de atendimento (critério de todas as avaliações),
   o prompt do SDR de IA e ferramentas de manutenção da importação. */

function TextoConfig({ chave, titulo, descricao, icone, cor, placeholder }: {
  chave: string; titulo: string; descricao: string; icone: typeof Bot; cor: "violet" | "emerald"; placeholder: string;
}) {
  const qc = useQueryClient();
  const { data: salvo, isLoading } = useQuery({
    queryKey: ["whatsapp", "config", chave],
    queryFn: async (): Promise<string> => {
      const { data, error } = await tabela("comercial_configuracoes").select("valor").eq("chave", chave).maybeSingle();
      if (error) throw error;
      return data?.valor ?? "";
    },
  });
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const texto = rascunho ?? salvo ?? "";

  const salvar = async () => {
    setSalvando(true);
    const { error } = await tabela("comercial_configuracoes").upsert({ chave, valor: texto, atualizado_em: new Date().toISOString() });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    setRascunho(null);
    qc.invalidateQueries({ queryKey: ["whatsapp", "config"] });
    toast.success("Salvo. As próximas análises e avaliações usam esta versão.");
  };

  return (
    <Bloco titulo={titulo} icone={icone} cor={cor}>
      <p className="text-sm text-muted-foreground mb-2">{descricao}</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <>
          <Textarea className="font-mono text-xs min-h-[240px]" value={texto} onChange={(e) => setRascunho(e.target.value)} placeholder={placeholder} />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={salvar} disabled={salvando || rascunho == null}>
              {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar
            </Button>
          </div>
        </>
      )}
    </Bloco>
  );
}

export default function AbaConfiguracao({ ocupado, onReimportar, onRecalcular }: {
  ocupado: boolean;
  onReimportar: () => void;
  onRecalcular: () => void;
}) {
  return (
    <div className="space-y-6">
      <TextoConfig
        chave="processo_atendimento"
        titulo="Como funciona o nosso atendimento"
        icone={ClipboardList}
        cor="emerald"
        descricao="É o critério de todas as avaliações: a IA compara cada conversa (e cada conjunto) com o que está escrito aqui. Descreva as etapas, o que o consultor precisa descobrir e o que é um bom atendimento."
        placeholder="O lead chega pelo anúncio... o SDR de IA qualifica... o consultor entra, se apresenta e precisa entender produto, quantidade, onde mora..."
      />
      <TextoConfig
        chave="prompt_sdr"
        titulo="Prompt do SDR de IA (Felipe)"
        icone={Bot}
        cor="violet"
        descricao="A IA confere as regras deste prompt em cada conversa e sugere alterações. Atualize sempre que mudar o agente."
        placeholder="<system_instruction>…"
      />
      <Bloco titulo="Separar SDR (IA) de consultor (humano)" icone={Wrench} cor="amber">
        <div className="text-sm space-y-3">
          <p>
            Cada mensagem enviada é marcada como <b>SDR (IA)</b> ou <b>Consultor</b>. É do consultor a mensagem com um
            atendente humano identificado pelo Data Crazy, a mensagem em que alguém se apresenta ("sou o Guilherme",
            "aqui é a Priscila") e tudo o que a empresa manda depois disso ou depois do "Resumo do projeto". O resto é do
            SDR. Para conferir numa conversa, abra-a e use <b>"Ver dados do Data Crazy"</b>.
          </p>
          <p>
            As conversas importadas antes desta versão ainda estão com a marcação antiga e sem as mensagens guardadas.
            <b> Reimportar</b> busca tudo de novo no Data Crazy (~15 conversas por minuto) e refaz a marcação. Depois,
            se a regra mudar, <b>Recalcular</b> refaz em segundos, sem o Data Crazy.
          </p>
          <p className="text-muted-foreground">
            Se a marcação mudar, a análise da conversa fica "desatualizada" (a antiga continua visível). Reanalise só o que
            quiser, pela aba Conversas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onReimportar} disabled={ocupado}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reimportar mensagens do período
            </Button>
            <Button variant="outline" onClick={onRecalcular} disabled={ocupado}>
              <Wrench className="h-4 w-4 mr-1" /> Recalcular marcação (sem Data Crazy)
            </Button>
          </div>
        </div>
      </Bloco>
    </div>
  );
}
