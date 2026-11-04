import { Users } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nomeUsuario } from "./api";
import { useDonos, useUsers } from "./hooks";
import { Avatar } from "./cardUi";

/**
 * Só para o gestor: escolhe de quem é o Trello aberto. "Eu" primeiro, depois
 * os colaboradores (com quantos quadros cada um tem).
 */
export default function ColaboradorSelect({
  userId, valor, onChange,
}: {
  userId: string;
  valor: string;
  onChange: (id: string) => void;
}) {
  const { data: usuarios = [] } = useUsers();
  const { data: donos = {} } = useDonos(true);
  const eu = usuarios.find((u) => u.user_id === userId);
  const outros = usuarios
    .filter((u) => u.user_id !== userId)
    .sort((a, b) => nomeUsuario(a).localeCompare(nomeUsuario(b), "pt-BR"));
  const qtd = (id: string) => {
    const n = donos[id] ?? 0;
    return n === 0 ? "sem quadro" : n === 1 ? "1 quadro" : `${n} quadros`;
  };

  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger
        className="h-9 w-auto min-w-[170px] max-w-[240px] gap-2 rounded-[10px] border-[var(--gw-border)] bg-white text-[14px] font-semibold text-[var(--gw-text)]"
        aria-label="Trello de qual colaborador"
      >
        <Users className="h-4 w-4 shrink-0 text-[var(--gw-text-muted)]" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="sistema-theme max-h-[360px]">
        <SelectItem value={userId}>
          <span className="flex items-center gap-2">
            <Avatar usuario={eu} tamanho={22} />
            Meu Trello
          </span>
        </SelectItem>
        {outros.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[11.5px] text-[var(--gw-text-muted)]">Colaboradores</SelectLabel>
            {outros.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                <span className="flex items-center gap-2">
                  <Avatar usuario={u} tamanho={22} />
                  <span className="truncate">{nomeUsuario(u)}</span>
                  <span className="text-[11.5px] font-normal text-[var(--gw-text-muted)]">· {qtd(u.user_id)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
