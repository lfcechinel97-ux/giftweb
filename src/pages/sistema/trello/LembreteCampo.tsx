import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { qk, type Card, type Reminder } from "./api";
import {
  OPCOES_LEMBRETE, calcularRemindAt, opcaoAtual, pedirPermissaoNotificacao, salvarLembrete, type OpcaoLembrete,
} from "./reminders";

/** Campo "Lembrete" do modal: nenhum, na hora, 15 min, 1 h, 1 dia antes ou personalizado. */
export default function LembreteCampo({ card, reminder }: { card: Card; reminder: Reminder | null }) {
  const qc = useQueryClient();
  const atual = opcaoAtual(card, reminder);
  const [opcao, setOpcao] = useState<OpcaoLembrete>(atual);
  const [custom, setCustom] = useState("");
  useEffect(() => { setOpcao(atual); }, [atual]);
  useEffect(() => {
    const base = reminder?.remind_at ?? card.due_at;
    setCustom(base ? format(new Date(base), "yyyy-MM-dd'T'HH:mm") : "");
  }, [reminder?.remind_at, card.due_at]);

  const mut = useMutation({
    mutationFn: (remindAt: string | null) => salvarLembrete(card.id, remindAt, reminder),
    onSuccess: (_d, remindAt) => {
      qc.invalidateQueries({ queryKey: qk.card(card.id) });
      if (remindAt) toast.success(`Lembrete para ${format(new Date(remindAt), "dd/MM 'às' HH:mm")}`);
    },
    onError: (e: Error) => { setOpcao(atual); toast.error(e.message); },
  });

  const escolher = (v: OpcaoLembrete) => {
    setOpcao(v);
    if (v === "personalizado") return; // grava ao confirmar a data/hora
    if (v === "nenhum") { mut.mutate(null); return; }
    if (!card.due_at) return;
    pedirPermissaoNotificacao();
    mut.mutate(calcularRemindAt(card.due_at, v));
  };

  const salvarCustom = () => {
    if (!custom) return;
    pedirPermissaoNotificacao();
    mut.mutate(new Date(custom).toISOString());
  };

  const semData = !card.due_at;

  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--gw-text-label)] mb-1 flex items-center gap-1">
        <Bell className="h-3.5 w-3.5" /> Lembrete
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={opcao} onValueChange={(v) => escolher(v as OpcaoLembrete)}>
          <SelectTrigger className="h-9 w-[200px] text-[13px] bg-[var(--gw-bg)] border-0" aria-label="Lembrete">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="sistema-theme">
            {OPCOES_LEMBRETE.map((o) => (
              <SelectItem key={o.valor} value={o.valor} disabled={semData && o.minutos !== undefined}>
                {o.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {opcao === "personalizado" && (
          <>
            <input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-9 rounded-[8px] border border-[var(--gw-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--gw-primary)]"
            />
            <Button size="sm" onClick={salvarCustom} disabled={!custom || mut.isPending}>Salvar</Button>
          </>
        )}
        {reminder && opcao !== "personalizado" && (
          <span className={`text-[12px] ${reminder.sent ? "text-[var(--gw-text-muted)]" : "text-[var(--gw-text-secondary)]"}`}>
            {reminder.sent ? "Já disparado em " : "Dispara em "}
            {format(new Date(reminder.remind_at), "dd/MM 'às' HH:mm")}
          </span>
        )}
      </div>
      {semData && opcao !== "personalizado" && (
        <p className="mt-1 text-[12px] text-[var(--gw-text-muted)]">Defina uma data de entrega para lembrar antes dela, ou use "Personalizado".</p>
      )}
    </div>
  );
}
