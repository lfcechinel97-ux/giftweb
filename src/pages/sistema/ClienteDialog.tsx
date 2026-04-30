import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSistema, type Cliente, type Endereco, type TipoPessoa } from "@/contexts/SistemaContext";
import { fetchCNPJ, fetchCEP, cnpjMask, cpfMask, onlyDigits } from "./cnpj";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: Cliente;
  onSaved?: (c: Cliente) => void;
}

const novoClienteVazio = (): Omit<Cliente, "id" | "createdAt" | "updatedAt"> => ({
  nome: "",
  tipo: "PJ",
  documento: "",
  ie: "",
  contatos: [{ nome: "", telefone: "", email: "" }],
  enderecos: [{ cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" }],
  observacoes: "",
});

export default function ClienteDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const { addCliente, updateCliente } = useSistema();
  const [c, setC] = useState<Cliente>(() => {
    if (cliente) return cliente;
    const base = novoClienteVazio();
    return {
      ...base,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState<number | null>(null);
  const [openContato, setOpenContato] = useState(false);

  useEffect(() => {
    if (open) {
      if (cliente) {
        setC(cliente);
      } else {
        const base = novoClienteVazio();
        setC({
          ...base,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [open, cliente]);

  const update = (patch: Partial<Cliente>) => setC((prev) => ({ ...prev, ...patch }));

  const handleCnpjBlur = async () => {
    if (c.tipo !== "PJ") return;
    if (onlyDigits(c.documento).length !== 14) return;
    setLoadingCnpj(true);
    const data = await fetchCNPJ(c.documento);
    setLoadingCnpj(false);
    if (!data) {
      toast.error("Não foi possível consultar o CNPJ. Preencha manualmente.");
      return;
    }
    const novoEndereco: Endereco = {
      cep: data.cep || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      cidade: data.municipio || "",
      uf: data.uf || "",
    };
    update({
      nome: data.nome_fantasia || data.razao_social || c.nome,
      ie: c.ie || "",
      enderecos: [novoEndereco],
    });
    if (data.ddd_telefone_1 && c.contatos.length > 0) {
      const contatosAtualizados = [...c.contatos];
      contatosAtualizados[0] = { ...contatosAtualizados[0], telefone: data.ddd_telefone_1 };
      update({ contatos: contatosAtualizados });
    }
    toast.success("Dados do CNPJ preenchidos automaticamente!");
  };

  const updateEndereco = (index: number, patch: Partial<Endereco>) =>
    update({ enderecos: c.enderecos.map((e, i) => (i === index ? { ...e, ...patch } : e)) });

  const handleCepBlur = async (index: number, cep: string) => {
    if (onlyDigits(cep).length !== 8) return;
    setLoadingCep(index);
    const data = await fetchCEP(cep);
    setLoadingCep(null);
    if (!data) {
      toast.error("CEP não encontrado.");
      return;
    }
    updateEndereco(index, {
      logradouro: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
    });
  };

  const addEndereco = () =>
    update({ enderecos: [...c.enderecos, { cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" }] });

  const removeEndereco = (index: number) => update({ enderecos: c.enderecos.filter((_, i) => i !== index) });

  const addContato = () => {
    update({ contatos: [...c.contatos, { nome: "", telefone: "", email: "" }] });
    setOpenContato(true);
  };
  const updateContato = (index: number, patch: { nome?: string; telefone?: string; email?: string }) =>
    update({ contatos: c.contatos.map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  const removeContato = (index: number) => update({ contatos: c.contatos.filter((_, i) => i !== index) });

  const handleSave = () => {
    if (!c.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!c.documento.trim()) {
      toast.error("Informe o documento (CNPJ/CPF).");
      return;
    }
    if (cliente) {
      updateCliente(c.id, c);
    } else {
      addCliente(c);
    }
    toast.success("Cliente salvo!");
    onSaved?.(c);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar Cliente" : "Cadastro de Cliente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Tipo de Pessoa */}
          <div className="w-48">
            <Field label="Tipo de Pessoa">
              <Select value={c.tipo} onValueChange={(v) => update({ tipo: v as TipoPessoa })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Dados principais */}
          {c.tipo === "PJ" ? (
            <div className="grid grid-cols-3 gap-4">
              <Field label="CNPJ">
                <div className="relative">
                  <Input
                    value={c.documento}
                    placeholder="00.000.000/0000-00"
                    onChange={(e) => update({ documento: cnpjMask(e.target.value) })}
                    onBlur={handleCnpjBlur}
                  />
                  {loadingCnpj && (
                    <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Sai do campo para buscar automaticamente</p>
              </Field>
              <Field label="Inscrição Estadual">
                <Input value={c.ie || ""} onChange={(e) => update({ ie: e.target.value })} placeholder="Isento" />
              </Field>
              <Field label="Nome / Razão Social">
                <Input
                  value={c.nome}
                  onChange={(e) => update({ nome: e.target.value })}
                  placeholder="Preenchido automaticamente"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Field label="CPF">
                <Input
                  value={c.documento}
                  placeholder="000.000.000-00"
                  onChange={(e) => update({ documento: cpfMask(e.target.value) })}
                />
              </Field>
              <Field label="Nome completo" className="col-span-2">
                <Input value={c.nome} onChange={(e) => update({ nome: e.target.value })} />
              </Field>
            </div>
          )}

          {/* Endereços — sempre visível */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Endereços
                {c.enderecos.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({c.enderecos.length})</span>
                )}
              </h3>
              <Button size="sm" variant="outline" onClick={addEndereco}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>

            {c.enderecos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-3 border border-dashed rounded-md">
                Nenhum endereço. Clique em "Adicionar" ou preencha o CNPJ para buscar automaticamente.
              </p>
            ) : (
              c.enderecos.map((e, i) => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                  {c.enderecos.length > 1 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Endereço {i + 1}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 h-7 px-2"
                        onClick={() => removeEndereco(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="CEP" small>
                      <div className="relative">
                        <Input
                          value={e.cep}
                          onChange={(ev) => updateEndereco(i, { cep: ev.target.value })}
                          onBlur={(ev) => handleCepBlur(i, ev.target.value)}
                          placeholder="00000-000"
                        />
                        {loadingCep === i && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                    </Field>
                    <Field label="Logradouro" small className="col-span-3">
                      <Input
                        value={e.logradouro}
                        onChange={(ev) => updateEndereco(i, { logradouro: ev.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Número" small>
                      <Input value={e.numero} onChange={(ev) => updateEndereco(i, { numero: ev.target.value })} />
                    </Field>
                    <Field label="Complemento" small>
                      <Input
                        value={e.complemento || ""}
                        onChange={(ev) => updateEndereco(i, { complemento: ev.target.value })}
                      />
                    </Field>
                    <Field label="Bairro" small>
                      <Input value={e.bairro} onChange={(ev) => updateEndereco(i, { bairro: ev.target.value })} />
                    </Field>
                    <Field label="Cidade" small>
                      <Input value={e.cidade} onChange={(ev) => updateEndereco(i, { cidade: ev.target.value })} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="UF" small>
                      <Input
                        value={e.uf}
                        onChange={(ev) => updateEndereco(i, { uf: ev.target.value.toUpperCase().slice(0, 2) })}
                      />
                    </Field>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Contatos — colapsável */}
          <div className="border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpenContato((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {openContato ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Contatos
                {c.contatos.length > 0 && <span className="text-xs text-muted-foreground">({c.contatos.length})</span>}
              </button>
              <Button size="sm" variant="ghost" onClick={addContato}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {openContato && (
              <div className="p-3 space-y-2">
                {c.contatos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhum contato cadastrado.</p>
                ) : (
                  c.contatos.map((x, i) => (
                    <div
                      key={i}
                      className="border border-border rounded-md p-3 grid grid-cols-4 gap-2 bg-muted/20 items-end"
                    >
                      <Field label="Nome" small>
                        <Input value={x.nome || ""} onChange={(ev) => updateContato(i, { nome: ev.target.value })} />
                      </Field>
                      <Field label="Telefone" small>
                        <Input
                          value={x.telefone || ""}
                          onChange={(ev) => updateContato(i, { telefone: ev.target.value })}
                        />
                      </Field>
                      <Field label="E-mail" small>
                        <Input
                          type="email"
                          value={x.email || ""}
                          onChange={(ev) => updateContato(i, { email: ev.target.value })}
                        />
                      </Field>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-600 mb-0.5"
                        onClick={() => removeContato(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <Field label="Observações">
            <textarea
              className="w-full px-3 py-2 border rounded-md text-sm min-h-[70px]"
              value={c.observacoes || ""}
              onChange={(e) => update({ observacoes: e.target.value })}
              placeholder="Observações sobre o cliente..."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className = "",
  small,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  small?: boolean;
}) {
  return (
    <div className={className}>
      <label className={`block ${small ? "text-[11px]" : "text-xs"} font-medium text-muted-foreground mb-1`}>
        {label}
      </label>
      {children}
    </div>
  );
}
