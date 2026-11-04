import { useRef, useState } from "react";
import {
  Check, ChevronDown, ImageIcon, LayoutGrid, CalendarDays, Palette, Pencil, Plus, SquareKanban, Trash2, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FUNDOS_COR, lerFundo, removerArquivo, uploadArquivo, type Board } from "./api";
import { useBoardMutations } from "./hooks";

export type Visao = "quadro" | "calendario";

interface Props {
  boards: Board[];
  board: Board | null;
  onSelect: (id: string) => void;
  visao: Visao;
  onVisao: (v: Visao) => void;
  /** Sino de notificações (fica no cabeçalho). */
  extra?: React.ReactNode;
  /** Seletor de colaborador (só gestor), ao lado do título. */
  colaborador?: React.ReactNode;
  /** Dono da lista aberta (null = eu). Muda rótulos e quem pode excluir. */
  nomeDono?: string | null;
  podeExcluir?: boolean;
  /** Dono da lista: quadro novo nasce dele. */
  dono?: string | null;
}

export default function BoardHeader({
  boards, board, onSelect, visao, onVisao, extra, colaborador, nomeDono = null, podeExcluir = true, dono = null,
}: Props) {
  const { criar, atualizar, excluir } = useBoardMutations(dono);
  const [dialog, setDialog] = useState<null | "novo" | "renomear">(null);
  const [nome, setNome] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const abrir = (modo: "novo" | "renomear") => {
    setNome(modo === "renomear" ? board?.title ?? "" : "");
    setDialog(modo);
  };

  const salvar = () => {
    const t = nome.trim();
    if (!t) return;
    if (dialog === "novo") {
      criar.mutate(t, { onSuccess: (b) => onSelect(b.id) });
    } else if (board) {
      atualizar.mutate({ id: board.id, title: t });
    }
    setDialog(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 mr-auto min-w-0">
        <SquareKanban className="h-5 w-5 text-[var(--gw-primary)] shrink-0" />
        <h1 className="gw-title text-[20px] shrink-0">Trello</h1>
        {colaborador}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-1.5 max-w-[260px] rounded-[10px] border border-[var(--gw-border)] bg-white px-3 h-9 text-[14px] font-semibold text-[var(--gw-text)] hover:border-[var(--gw-border-strong)]"
            >
              <span className="truncate">{board?.title ?? "Selecionar quadro"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--gw-text-muted)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[12px] text-muted-foreground font-medium">{nomeDono ? `Quadros de ${nomeDono}` : "Seus quadros"}</DropdownMenuLabel>
            {boards.length === 0 && <DropdownMenuItem disabled>Nenhum quadro ainda</DropdownMenuItem>}
            {boards.map((b) => (
              <DropdownMenuItem key={b.id} onClick={() => onSelect(b.id)} className="gap-2">
                <span className="h-4 w-4 shrink-0">{b.id === board?.id && <Check className="h-4 w-4" />}</span>
                <span className="truncate">{b.title}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => abrir("novo")} className="gap-2">
              <Plus className="h-4 w-4" /> {nomeDono ? `Novo quadro para ${nomeDono}` : "Novo quadro"}
            </DropdownMenuItem>
            {board && (
              <>
                <DropdownMenuItem onClick={() => abrir("renomear")} className="gap-2">
                  <Pencil className="h-4 w-4" /> Renomear quadro
                </DropdownMenuItem>
                {podeExcluir && (
                  <DropdownMenuItem onClick={() => setConfirmarExclusao(true)} className="gap-2 text-[var(--gw-danger)] focus:text-[var(--gw-danger)]">
                    <Trash2 className="h-4 w-4" /> Excluir quadro
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {board && (
        <div className="flex items-center rounded-[10px] border border-[var(--gw-border)] bg-white overflow-hidden text-[13px] font-semibold" role="tablist">
          {([["quadro", "Quadro", LayoutGrid], ["calendario", "Calendário", CalendarDays]] as const).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={visao === id}
              onClick={() => onVisao(id)}
              className={`inline-flex items-center gap-1.5 px-3 h-9 transition-colors ${
                visao === id ? "bg-[var(--gw-primary)] text-white" : "text-[var(--gw-text-secondary)] hover:bg-[var(--gw-surface-alt)]"
              }`}
            >
              <Icone className="h-4 w-4" /> {rotulo}
            </button>
          ))}
        </div>
      )}

      {board && <FundoPicker board={board} onChange={(bg) => atualizar.mutate({ id: board.id, background: bg })} />}
      {extra}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === "novo" ? (nomeDono ? `Novo quadro para ${nomeDono}` : "Novo quadro") : "Renomear quadro"}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nome}
            maxLength={80}
            placeholder="Nome do quadro"
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") salvar(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!nome.trim()}>{dialog === "novo" ? "Criar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{board?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as colunas, cartões, checklists, comentários e lembretes deste quadro serão apagados. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--gw-danger)] hover:bg-[var(--gw-danger)]/90"
              onClick={() => {
                if (!board) return;
                const id = board.id;
                excluir.mutate(id, {
                  onSuccess: () => {
                    const proximo = boards.find((b) => b.id !== id);
                    if (proximo) onSelect(proximo.id);
                  },
                });
              }}
            >
              Excluir quadro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FundoPicker({ board, onChange }: { board: Board; onChange: (bg: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const atual = lerFundo(board.background);

  const enviarImagem = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem maior que 8 MB"); return; }
    setEnviando(true);
    try {
      const path = await uploadArquivo(board.id, "fundo", file);
      if (atual?.tipo === "imagem") void removerArquivo(atual.path);
      onChange(`image:${path}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Fundo do quadro"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--gw-border)] bg-white px-3 h-9 text-[13px] font-semibold text-[var(--gw-text-secondary)] hover:border-[var(--gw-border-strong)]"
        >
          <Palette className="h-4 w-4" /> <span className="hidden sm:inline">Fundo</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-[12px] font-semibold text-[var(--gw-text-label)] mb-2">Cores</p>
        <div className="grid grid-cols-4 gap-2">
          {FUNDOS_COR.map((cor) => {
            const ativo = atual?.tipo === "cor" && atual.valor === cor;
            return (
              <button
                key={cor}
                type="button"
                onClick={() => {
                  if (atual?.tipo === "imagem") void removerArquivo(atual.path);
                  onChange(`color:${cor}`);
                }}
                className={`h-10 rounded-[8px] border border-[var(--gw-border)] flex items-center justify-center ${ativo ? "ring-2 ring-offset-1 ring-[var(--gw-primary)]" : ""}`}
                style={{ background: cor }}
                aria-label="Usar esta cor de fundo"
              >
                {ativo && <Check className="h-4 w-4 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] font-semibold text-[var(--gw-text-label)] mt-3 mb-2">Imagem</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void enviarImagem(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => inputRef.current?.click()} disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {atual?.tipo === "imagem" ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {atual && (
            <Button
              type="button" variant="ghost" size="sm" title="Remover fundo"
              onClick={() => { if (atual.tipo === "imagem") void removerArquivo(atual.path); onChange(null); }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
