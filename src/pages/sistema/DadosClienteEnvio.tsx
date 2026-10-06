import { Check, Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Cliente, ClienteSnapshot, Endereco } from "@/contexts/SistemaContext";

interface Contato { nome?: string; telefone?: string; email?: string }

interface Props {
  /** Cadastro atual do cliente (preferido -- é o que a edição altera). */
  cliente?: Cliente | null;
  /** Foto do cliente gravada no pedido -- usada quando não há cadastro vinculado. */
  snapshot?: ClienteSnapshot | null;
  /** Contato informado no próprio pedido (tem prioridade sobre o do cadastro). */
  contatoPedido?: Contato;
  onEditar?: () => void;
}

async function copiar(texto: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function linhaEndereco(e: Endereco): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  return [rua, e.complemento].filter(Boolean).join(" - ");
}

function textoEtiqueta(nome: string, tipo: string, documento: string, ie: string | undefined, e: Endereco | undefined, c: Contato): string {
  const linhas = [
    nome,
    documento ? `${tipo === "PF" ? "CPF" : "CNPJ"}: ${documento}` : "",
    tipo === "PJ" && ie ? `IE: ${ie}` : "",
    e ? linhaEndereco(e) : "",
    e ? [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" - ") : "",
    e?.cep ? `CEP: ${e.cep}` : "",
    c.telefone ? `Tel: ${c.telefone}` : "",
    c.email ? `E-mail: ${c.email}` : "",
  ];
  return linhas.filter(Boolean).join("\n");
}

/**
 * Dados do cliente pra emitir etiqueta/nota: cada campo com botão de copiar,
 * mais "Copiar tudo" no formato de etiqueta. PF mostra CPF; PJ mostra CNPJ e IE.
 */
export default function DadosClienteEnvio({ cliente, snapshot, contatoPedido, onEditar }: Props) {
  const nome = cliente?.nome || snapshot?.nome || "";
  const tipo = cliente?.tipo || snapshot?.tipo || "PJ";
  const documento = cliente?.documento || snapshot?.documento || "";
  const ie = cliente?.ie || snapshot?.ie;
  const enderecos: Endereco[] = cliente?.enderecos?.length
    ? cliente.enderecos
    : snapshot?.endereco ? [snapshot.endereco] : [];
  const contatoCadastro = cliente?.contatos?.[0] ?? snapshot?.contato ?? {};
  const contato: Contato = {
    nome: contatoPedido?.nome || contatoCadastro.nome,
    telefone: contatoPedido?.telefone || contatoCadastro.telefone,
    email: contatoPedido?.email || contatoCadastro.email,
  };

  if (!nome && !documento && enderecos.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[var(--gw-border)] px-3 py-3 text-[12px] text-[var(--gw-text-muted)]">
        Pedido sem cliente cadastrado. Selecione ou cadastre o cliente no pedido para ter os dados de envio.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] font-bold rounded-full px-2 py-[2px]"
          style={tipo === "PF"
            ? { backgroundColor: "#F1EDFF", color: "#6D28D9" }
            : { backgroundColor: "var(--gw-blue-soft)", color: "#1D4ED8" }}
        >
          {tipo === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
        </span>
        {!cliente && snapshot && (
          <span className="text-[11px] text-[var(--gw-text-muted)]">dados gravados no pedido (sem cadastro vinculado)</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => copiar(textoEtiqueta(nome, tipo, documento, ie, enderecos[0], contato), "Dados para etiqueta")}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-semibold text-white"
          style={{ backgroundColor: "var(--gw-primary)" }}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar tudo
        </button>
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-semibold border border-[var(--gw-border)] bg-white text-[var(--gw-text-secondary)] hover:bg-[var(--gw-surface-alt)]"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar cliente
          </button>
        )}
      </div>

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo={tipo === "PF" ? "Nome" : "Nome / Razão social"} valor={nome} />
        <Campo rotulo={tipo === "PF" ? "CPF" : "CNPJ"} valor={documento} />
        {tipo === "PJ" && <Campo rotulo="Inscrição estadual" valor={ie} />}
        <Campo rotulo="Contato" valor={contato.nome} />
        <Campo rotulo="Telefone" valor={contato.telefone} />
        <Campo rotulo="E-mail" valor={contato.email} />
      </div>

      {enderecos.map((e, i) => (
        <div key={i} className="rounded-[10px] border border-[var(--gw-border)] bg-[var(--gw-surface-alt)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gw-text-label)]">
              {enderecos.length > 1 ? `Endereço ${i + 1}` : "Endereço"}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => copiar(
                [linhaEndereco(e), e.bairro, [e.cidade, e.uf].filter(Boolean).join("/"), e.cep ? `CEP ${e.cep}` : ""].filter(Boolean).join(" - "),
                "Endereço",
              )}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gw-primary)] hover:underline"
            >
              <Copy className="h-3 w-3" /> Copiar endereço
            </button>
          </div>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="CEP" valor={e.cep} />
            <Campo rotulo="Logradouro" valor={e.logradouro} className="lg:col-span-2" />
            <Campo rotulo="Número" valor={e.numero} />
            <Campo rotulo="Complemento" valor={e.complemento} />
            <Campo rotulo="Bairro" valor={e.bairro} />
            <Campo rotulo="Cidade" valor={e.cidade} />
            <Campo rotulo="UF" valor={e.uf} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Campo({ rotulo, valor, className = "" }: { rotulo: string; valor?: string | null; className?: string }) {
  const [copiado, setCopiado] = useState(false);
  const v = (valor ?? "").trim();
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gw-text-label)]">{rotulo}</p>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-[13px] truncate ${v ? "text-[var(--gw-text)] font-medium" : "text-[var(--gw-text-muted)]"}`} title={v || undefined}>
          {v || "—"}
        </span>
        {v && (
          <button
            type="button"
            onClick={async () => {
              await copiar(v, rotulo);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1200);
            }}
            className="shrink-0 p-1 rounded text-[var(--gw-text-muted)] hover:text-[var(--gw-primary)] hover:bg-[var(--gw-blue-soft)]"
            title={`Copiar ${rotulo.toLowerCase()}`}
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-[var(--gw-success)]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
