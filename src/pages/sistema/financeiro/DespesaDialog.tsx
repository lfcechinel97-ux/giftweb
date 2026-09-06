import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useSistema } from "@/contexts/SistemaContext";
import { criarDespesa, atualizarDespesa, fetchFornecedores } from "./api";
import { useCategoriasDespesa } from "./useFinanceiro";
import type { Despesa, GrupoDespesa } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  despesa?: Despesa;
  onSaved?: () => void;
}

const GRUPO_LABEL: Record<GrupoDespesa, string> = {
  pessoal: "Pessoal",
  fixa: "Fixas",
  variavel: "Variáveis",
};

const hojeBR = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
    .toISOString().slice(0, 10);

/** Aceita "1.234,56" e "1234.56" — o teclado de quem lança não é o do banco. */
const paraNumero = (v: string): number => {
  const limpo = v.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return NaN;
  // Vírgula como decimal quando ela vem depois do último ponto.
  const normalizado = limpo.lastIndexOf(",") > limpo.lastIndexOf(".")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo.replace(/,/g, "");
  return Number(normalizado);
};

const vazio = () => ({
  data: hojeBR(),
  descricao: "",
  valorTexto: "",
  categoria_id: "",
  fornecedor_id: "",
  meio_pagamento_id: "",
  documento: "",
  observacoes: "",
  pago: true,
});

export default function DespesaDialog({ open, onOpenChange, despesa, onSaved }: Props) {
  const { meiosPagamento } = useSistema();
  const { data: categorias = [] } = useCategoriasDespesa();
  /* Fornecedores não vêm no bootstrap do SistemaContext e só interessam
     enquanto o diálogo está aberto. */
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["sistema", "financeiro", "fornecedores"],
    queryFn: fetchFornecedores,
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });
  const [f, setF] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(despesa
      ? {
          data: despesa.data,
          descricao: despesa.descricao,
          valorTexto: String(despesa.valor).replace(".", ","),
          categoria_id: despesa.categoria_id ?? "",
          fornecedor_id: despesa.fornecedor_id ?? "",
          meio_pagamento_id: despesa.meio_pagamento_id ?? "",
          documento: despesa.documento ?? "",
          observacoes: despesa.observacoes ?? "",
          pago: despesa.pago,
        }
      : vazio());
  }, [open, despesa]);

  const set = (patch: Partial<typeof f>) => setF(prev => ({ ...prev, ...patch }));

  const porGrupo = useMemo(() => {
    const g: Record<GrupoDespesa, typeof categorias> = { pessoal: [], fixa: [], variavel: [] };
    for (const c of categorias) g[c.grupo].push(c);
    return g;
  }, [categorias]);

  const categoriaSelecionada = categorias.find(c => c.id === f.categoria_id);
  /* Imposto, comissão e taxa de cartão já saem do lucro por item. Lançar de
     novo aqui contaria o mesmo dinheiro duas vezes. */
  const categoriaBloqueada = categoriaSelecionada?.deduzida_na_venda ?? false;

  const valor = paraNumero(f.valorTexto);
  const valorInvalido = f.valorTexto.trim() !== "" && (!Number.isFinite(valor) || valor < 0);
  const podeSalvar =
    f.descricao.trim() !== "" &&
    Number.isFinite(valor) && valor >= 0 &&
    f.data !== "" &&
    !categoriaBloqueada &&
    !salvando;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    const payload = {
      data: f.data,
      descricao: f.descricao.trim(),
      valor,
      categoria_id: f.categoria_id || null,
      venda_id: despesa?.venda_id ?? null,
      fornecedor_id: f.fornecedor_id || null,
      meio_pagamento_id: f.meio_pagamento_id || null,
      documento: f.documento.trim() || null,
      observacoes: f.observacoes.trim() || null,
      pago: f.pago,
    };
    const ok = despesa
      ? await atualizarDespesa(despesa.id, payload)
      : await criarDespesa(payload);
    setSalvando(false);
    if (ok) {
      toast.success(despesa ? "Despesa atualizada." : "Despesa lançada.");
      onOpenChange(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sistema-theme sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{despesa ? "Editar despesa" : "Lançar despesa"}</DialogTitle>
          <DialogDescription>
            Custos que não pertencem a um produto. O custo do produto em si vem do
            catálogo de custos e já entra no lucro de cada pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className="gw-label block mb-1">Descrição</label>
              <Input
                autoFocus
                value={f.descricao}
                onChange={e => set({ descricao: e.target.value })}
                placeholder="Ex.: Anúncio Meta — campanha setembro"
                onKeyDown={e => { if (e.key === "Enter" && podeSalvar) void salvar(); }}
              />
            </div>
            <div>
              <label className="gw-label block mb-1">Valor</label>
              <Input
                inputMode="decimal"
                value={f.valorTexto}
                onChange={e => set({ valorTexto: e.target.value })}
                placeholder="0,00"
                className={valorInvalido ? "border-[var(--gw-danger)]" : ""}
                onKeyDown={e => { if (e.key === "Enter" && podeSalvar) void salvar(); }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gw-label block mb-1">Data</label>
              <Input type="date" value={f.data} onChange={e => set({ data: e.target.value })} />
            </div>
            <div>
              <label className="gw-label block mb-1">Categoria</label>
              <Select value={f.categoria_id} onValueChange={v => set({ categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {(["pessoal", "fixa", "variavel"] as GrupoDespesa[]).map(g => (
                    porGrupo[g].length > 0 && (
                      <SelectGroup key={g}>
                        <SelectLabel>{GRUPO_LABEL[g]}</SelectLabel>
                        {porGrupo[g].map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full shrink-0"
                                    style={{ background: c.cor ?? "var(--gw-text-muted)" }} />
                              {c.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {categoriaBloqueada && (
            <div className="flex gap-2 rounded-lg p-2.5 text-[12px]"
                 style={{ background: "var(--gw-danger-soft)", color: "var(--gw-danger)" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
              <span>
                <strong>{categoriaSelecionada?.nome}</strong> já é descontado por item de cada
                venda, com o percentual do pedido. Lançar aqui contaria duas vezes e derrubaria o
                lucro sem motivo. Para ajustar o percentual, use Parâmetros.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gw-label block mb-1">Fornecedor</label>
              <Select value={f.fornecedor_id} onValueChange={v => set({ fornecedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map(x => (
                    <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="gw-label block mb-1">Forma de pagamento</label>
              <Select value={f.meio_pagamento_id} onValueChange={v => set({ meio_pagamento_id: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {meiosPagamento.filter(x => x.ativo !== false).map(x => (
                    <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="gw-label block mb-1">Documento</label>
            <Input
              value={f.documento}
              onChange={e => set({ documento: e.target.value })}
              placeholder="Nº da nota, boleto ou comprovante (opcional)"
            />
          </div>

          <div>
            <label className="gw-label block mb-1">Observações</label>
            <Textarea
              rows={2}
              value={f.observacoes}
              onChange={e => set({ observacoes: e.target.value })}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {despesa ? "Salvar" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
