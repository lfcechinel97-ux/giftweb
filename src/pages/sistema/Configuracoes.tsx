import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSistema, type LookupItem, type Transportadora } from "@/contexts/SistemaContext";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Cadastre as opções que aparecerão nos selects de orçamento.
        </p>
      </div>

      <Tabs defaultValue="vendedores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="pagamentos">Meios de pagamento</TabsTrigger>
          <TabsTrigger value="transportadoras">Transportadoras</TabsTrigger>
          <TabsTrigger value="origens">Origens</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores"><VendedoresCRUD /></TabsContent>
        <TabsContent value="pagamentos"><PagamentosCRUD /></TabsContent>
        <TabsContent value="transportadoras"><TransportadorasCRUD /></TabsContent>
        <TabsContent value="origens"><OrigensCRUD /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Lookup genérico (vendedores / pagamentos / origens) ────────────────── */

interface SimpleCRUDProps {
  titulo: string;
  items: LookupItem[];
  onAdd: (nome: string) => void;
  onUpdate: (id: string, nome: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

function SimpleCRUD({ titulo, items, onAdd, onUpdate, onRemove, onToggle }: SimpleCRUDProps) {
  const [novo, setNovo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const handleAdd = () => {
    const nome = novo.trim();
    if (!nome) return;
    onAdd(nome);
    setNovo("");
  };

  const startEdit = (i: LookupItem) => { setEditingId(i.id); setEditingValue(i.nome); };

  const saveEdit = () => {
    if (!editingId) return;
    const v = editingValue.trim();
    if (v) onUpdate(editingId, v);
    setEditingId(null);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Input
          placeholder={`Adicionar ${titulo.toLowerCase()}...`}
          value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <Button type="button" onClick={handleAdd} className="bg-blue-700 hover:bg-blue-800 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado.</p>
        ) : items.map(i => (
          <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            {editingId === i.id ? (
              <Input
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                className="h-8 max-w-md"
              />
            ) : (
              <span className={`text-sm ${i.ativo === false ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {i.nome}
              </span>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Switch checked={i.ativo !== false} onCheckedChange={() => onToggle(i.id)} />
                Ativo
              </label>
              {editingId === i.id ? (
                <>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={saveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => startEdit(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onRemove(i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Vendedores ─────────────────────────────────────────────────────────── */

function VendedoresCRUD() {
  const { vendedores, addVendedor, updateVendedor, removeVendedor, toggleVendedorAtivo } = useSistema();
  return (
    <SimpleCRUD
      titulo="Vendedores"
      items={vendedores}
      onAdd={addVendedor}
      onUpdate={updateVendedor}
      onRemove={removeVendedor}
      onToggle={toggleVendedorAtivo}
    />
  );
}

/* ─── Meios de pagamento ─────────────────────────────────────────────────── */

function PagamentosCRUD() {
  const { meiosPagamento, addMeioPagamento, updateMeioPagamento, removeMeioPagamento, toggleMeioPagamentoAtivo } = useSistema();
  return (
    <SimpleCRUD
      titulo="Meios de pagamento"
      items={meiosPagamento}
      onAdd={addMeioPagamento}
      onUpdate={updateMeioPagamento}
      onRemove={removeMeioPagamento}
      onToggle={toggleMeioPagamentoAtivo}
    />
  );
}

/* ─── Origens ────────────────────────────────────────────────────────────── */

function OrigensCRUD() {
  const { origens, addOrigem, updateOrigem, removeOrigem, toggleOrigemAtivo } = useSistema();
  return (
    <SimpleCRUD
      titulo="Origens"
      items={origens}
      onAdd={addOrigem}
      onUpdate={updateOrigem}
      onRemove={removeOrigem}
      onToggle={toggleOrigemAtivo}
    />
  );
}

/* ─── Transportadoras (campos extras: tipoFrete + prazo) ─────────────────── */

function TransportadorasCRUD() {
  const {
    transportadoras,
    addTransportadora,
    updateTransportadora,
    removeTransportadora,
    toggleTransportadoraAtivo,
  } = useSistema();

  const [novo, setNovo] = useState({ nome: "", prazo: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState({ nome: "", prazo: "" });

  const handleAdd = () => {
    const nome = novo.nome.trim();
    if (!nome) return;
    addTransportadora(nome, undefined, novo.prazo ? Number(novo.prazo) : undefined);
    setNovo({ nome: "", prazo: "" });
  };

  const startEdit = (t: Transportadora) => {
    setEditingId(t.id);
    setEditingValue({
      nome: t.nome,
      prazo: t.prazoEntrega ? String(t.prazoEntrega) : "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const nome = editingValue.nome.trim();
    if (nome) {
      updateTransportadora(
        editingId,
        nome,
        undefined,
        editingValue.prazo ? Number(editingValue.prazo) : undefined,
      );
    }
    setEditingId(null);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Linha de adição */}
      <div className="p-4 border-b border-border flex flex-wrap items-center gap-2">
        <Input
          placeholder="Nome da transportadora..."
          value={novo.nome}
          onChange={e => setNovo(p => ({ ...p, nome: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="flex-1 min-w-40"
        />
        <Input
          placeholder="Prazo padrão (dias)"
          type="number"
          min="0"
          className="w-40 shrink-0"
          value={novo.prazo}
          onChange={e => setNovo(p => ({ ...p, prazo: e.target.value }))}
        />
        <Button type="button" onClick={handleAdd} className="bg-blue-700 hover:bg-blue-800 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border">
        {transportadoras.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma transportadora cadastrada.</p>
        ) : transportadoras.map(t => (
          <div key={t.id} className="px-4 py-2.5">
            {editingId === t.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={editingValue.nome}
                  onChange={e => setEditingValue(p => ({ ...p, nome: e.target.value }))}
                  className="h-8 flex-1 min-w-40"
                  autoFocus
                />
                <Input
                  placeholder="Prazo (dias)"
                  type="number"
                  className="w-32 h-8 shrink-0"
                  value={editingValue.prazo}
                  onChange={e => setEditingValue(p => ({ ...p, prazo: e.target.value }))}
                />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={saveEdit}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className={`text-sm font-medium ${
                    t.ativo === false ? "text-muted-foreground line-through" : "text-foreground"
                  }`}>
                    {t.nome}
                  </span>
                  {t.prazoEntrega ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Prazo padrão: {t.prazoEntrega} dias
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <Switch checked={t.ativo !== false} onCheckedChange={() => toggleTransportadoraAtivo(t.id)} />
                    Ativo
                  </label>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => startEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeTransportadora(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
