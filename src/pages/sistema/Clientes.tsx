import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSistema, type Cliente } from "@/contexts/SistemaContext";
import ClienteDialog from "./ClienteDialog";

export default function Clientes() {
  const { clientes, deleteCliente } = useSistema();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | undefined>();

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter(c =>
      c.razao_social.toLowerCase().includes(t) ||
      (c.nome_fantasia || "").toLowerCase().includes(t) ||
      (c.cnpj || "").includes(t) ||
      (c.cpf || "").includes(t)
    );
  }, [clientes, search]);

  const startEdit = (c: Cliente) => { setEditing(c); setOpen(true); };
  const startNew = () => { setEditing(undefined); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">{clientes.length} cliente(s) cadastrado(s).</p>
        </div>
        <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Cliente
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, CNPJ, CPF..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Razão social / Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Nenhum cliente.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                <TableCell className="font-medium">
                  {c.nome_fantasia || c.razao_social}
                  {c.nome_fantasia && c.razao_social && (
                    <span className="text-xs text-muted-foreground block">{c.razao_social}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm font-mono">{c.cnpj || c.cpf || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.telefone || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => startEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCliente(c.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClienteDialog open={open} onOpenChange={setOpen} cliente={editing} />
    </div>
  );
}
