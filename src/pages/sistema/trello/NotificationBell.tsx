import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { db, fetchNotifications, qk, type Notification as Notificacao } from "./api";

/**
 * Sino do Trello. A lista vem uma vez (com cache) e, depois, só pelo Realtime
 * de trello_notifications (o job do pg_cron insere quando um lembrete vence):
 * nada de polling. Cada notificação nova vira um toast e, se o usuário
 * permitiu, uma notificação do navegador.
 */
export default function NotificationBell({ userId, onOpenCard }: { userId: string | null; onOpenCard: (cardId: string) => void }) {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery({
    queryKey: qk.notifications,
    queryFn: fetchNotifications,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const naoLidas = lista.filter((n) => !n.read).length;
  const abrirRef = useRef(onOpenCard);
  abrirRef.current = onOpenCard;

  useEffect(() => {
    if (!userId) return;
    const ch = db
      .channel(`trello-notificacoes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trello_notifications", filter: `user_id=eq.${userId}` },
        (payload: { new: Notificacao }) => {
          const n = payload.new;
          qc.setQueryData<Notificacao[]>(qk.notifications, (old) => [n, ...(old ?? []).filter((x) => x.id !== n.id)].slice(0, 30));
          toast(`🔔 ${n.title}`, {
            description: n.body ?? undefined,
            duration: 10000,
            action: n.card_id ? { label: "Abrir", onClick: () => abrirRef.current(n.card_id as string) } : undefined,
          });
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const nav = new Notification(n.title, { body: n.body ?? "", tag: n.id, icon: "/logos/giftweb-logo.png" });
              nav.onclick = () => { window.focus(); if (n.card_id) abrirRef.current(n.card_id); nav.close(); };
            }
          } catch { /* navegador sem suporte */ }
        },
      )
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [userId, qc]);

  const marcar = useMutation({
    mutationFn: async (ids: string[] | "todas") => {
      const q = db.from("trello_notifications").update({ read: true }).eq("read", false);
      const { error } = ids === "todas" ? await q : await q.in("id", ids);
      if (error) throw new Error(error.message);
    },
    onMutate: (ids) => {
      const antes = qc.getQueryData<Notificacao[]>(qk.notifications);
      qc.setQueryData<Notificacao[]>(qk.notifications, (old) =>
        old?.map((n) => (ids === "todas" || ids.includes(n.id) ? { ...n, read: true } : n)));
      return { antes };
    },
    onError: (e: Error, _v, ctx) => { if (ctx?.antes) qc.setQueryData(qk.notifications, ctx.antes); toast.error(e.message); },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-[10px] border border-[var(--gw-border)] bg-white text-[var(--gw-text-secondary)] hover:border-[var(--gw-border-strong)]"
          aria-label={naoLidas ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--gw-danger)] text-white text-[11px] font-bold flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="sistema-theme w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--gw-border)]">
          <p className="text-[13px] font-semibold">Notificações</p>
          {naoLidas > 0 && (
            <button type="button" onClick={() => marcar.mutate("todas")} className="inline-flex items-center gap-1 text-[12px] text-[var(--gw-primary)] hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        {lista.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--gw-text-muted)]">Nenhuma notificação. Os lembretes dos cartões aparecem aqui.</p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto">
            {lista.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) marcar.mutate([n.id]);
                    if (n.card_id) onOpenCard(n.card_id);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex gap-2 border-b border-[var(--gw-hairline)] hover:bg-[var(--gw-surface-alt)] ${n.read ? "" : "bg-[var(--gw-blue-soft)]/60"}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[var(--gw-primary)]"}`} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold truncate">{n.title}</span>
                    {n.body && <span className="block text-[12.5px] text-[var(--gw-text-secondary)]">{n.body}</span>}
                    <span className="block text-[11.5px] text-[var(--gw-text-muted)] mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
