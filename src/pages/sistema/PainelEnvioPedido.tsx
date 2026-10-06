import { useCallback, useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mapCliente, type Cliente, type ClienteSnapshot } from "@/contexts/SistemaContext";
import DadosClienteEnvio from "./DadosClienteEnvio";
import ClienteDialog from "./ClienteDialog";

interface Dados {
  cliente: Cliente | null;
  snapshot: ClienteSnapshot | null;
  contato: { nome?: string; telefone?: string; email?: string };
}

/** Dados de envio do cliente de um pedido (PCP, etapas de expedição). */
export default function PainelEnvioPedido({ pedidoId }: { pedidoId: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const { data: p, error } = await supabase
      .from("sistema_pedidos")
      .select("cliente_id, cliente_snapshot, contato_nome, contato_telefone, contato_email")
      .eq("id", pedidoId)
      .maybeSingle();
    if (error || !p) { setErro("Não foi possível carregar os dados do cliente."); return; }
    let cliente: Cliente | null = null;
    if (p.cliente_id) {
      const { data: c } = await supabase.from("sistema_clientes").select("*").eq("id", p.cliente_id).maybeSingle();
      if (c) cliente = mapCliente(c);
    }
    setDados({
      cliente,
      snapshot: (p.cliente_snapshot as unknown as ClienteSnapshot) ?? null,
      contato: {
        nome: p.contato_nome ?? undefined,
        telefone: p.contato_telefone ?? undefined,
        email: p.contato_email ?? undefined,
      },
    });
  }, [pedidoId]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="px-5 py-3 border-b border-[var(--gw-border)] space-y-2" style={{ backgroundColor: "#FFF7F7" }}>
      <p className="gw-label flex items-center gap-1.5" style={{ color: "#B91C1C" }}>
        <Truck className="h-3.5 w-3.5" /> Dados para envio
      </p>
      {erro ? (
        <p className="text-[12px] text-[var(--gw-danger)]">{erro}</p>
      ) : !dados ? (
        <p className="text-[12px] text-[var(--gw-text-muted)] flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</p>
      ) : (
        <DadosClienteEnvio
          cliente={dados.cliente}
          snapshot={dados.cliente ? null : dados.snapshot}
          contatoPedido={dados.contato}
          onEditar={dados.cliente ? () => setEditando(true) : undefined}
        />
      )}
      {editando && dados?.cliente && (
        <ClienteDialog
          open={editando}
          onOpenChange={setEditando}
          cliente={dados.cliente}
          onSaved={(c) => setDados((d) => (d ? { ...d, cliente: c } : d))}
        />
      )}
    </div>
  );
}
