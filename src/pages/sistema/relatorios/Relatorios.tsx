import { useState } from "react";
import { FileSpreadsheet, Loader2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { useSistema } from "@/contexts/SistemaContext";
import { exportarRelatorioGeral, type FiltroRelatorio } from "./relatorioGeralPedidos";
import { exportarRelatorioOrcamentos } from "./relatorioOrcamentos";

/* Central de relatórios — só admin (mostra custo, comissão e lucro).
   Cada relatório é um card; para incluir outro, basta um novo card aqui. */

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hojeBR = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
// Componentes locais: toISOString (UTC) pulava pro dia seguinte depois das 21h.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Atalho = "mes" | "mes_passado" | "trimestre" | "ano";
const ATALHOS: { id: Atalho; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "mes_passado", label: "Mês passado" },
  { id: "trimestre", label: "Últimos 3 meses" },
  { id: "ano", label: "Este ano" },
];
function intervalo(id: Atalho) {
  const h = hojeBR();
  switch (id) {
    case "mes_passado":
      return { inicio: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), fim: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
    case "trimestre":
      return { inicio: iso(new Date(h.getFullYear(), h.getMonth() - 2, 1)), fim: iso(h) };
    case "ano":
      return { inicio: iso(new Date(h.getFullYear(), 0, 1)), fim: iso(h) };
    case "mes":
    default:
      return { inicio: iso(new Date(h.getFullYear(), h.getMonth(), 1)), fim: iso(h) };
  }
}

export default function Relatorios() {
  const { isAdmin, isLoading } = useUserRole();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <div className="rounded-xl border p-6 text-sm" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)", color: "var(--gw-text-secondary)" }}>
        Os relatórios mostram custos, comissões e lucro e são restritos ao administrador.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="gw-display text-[20px]">Relatórios</h1>
        <p className="gw-meta">Exportações para análise em planilha. Área restrita ao administrador.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <RelatorioGeralPedidos />
        <RelatorioOrcamentos />
      </div>
    </div>
  );
}

interface Resumo { pedidos: number; itens: number; venda: number; lucro: number; semCusto: number }

function RelatorioGeralPedidos() {
  const { vendedores } = useSistema();
  const inicial = intervalo("mes");
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [vendedorId, setVendedorId] = useState("todos");
  const [incluirCancelados, setIncluirCancelados] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const gerar = async () => {
    if (!inicio || !fim || inicio > fim) {
      toast.error("Confira o período: a data inicial precisa ser antes da final.");
      return;
    }
    setGerando(true);
    try {
      const filtro: FiltroRelatorio = {
        inicio, fim, incluirCancelados,
        vendedorId: vendedorId === "todos" ? null : vendedorId,
      };
      const linhas = await exportarRelatorioGeral(filtro);
      const r: Resumo = { pedidos: linhas.length, itens: 0, venda: 0, lucro: 0, semCusto: 0 };
      for (const l of linhas) {
        r.itens += l.produtos.length;
        r.venda += l.bruto;
        r.lucro += l.lucroLiquido;
        r.semCusto += l.produtos.filter(x => x.origemCusto === "sem" || x.origemCusto === "compra_sem_preco").length;
      }
      setResumo(r);
      toast.success(linhas.length ? `Relatório gerado: ${linhas.length} pedido(s).` : "Nenhum pedido no período — planilha gerada vazia.");
    } catch (e) {
      console.error("[Relatórios] geral de pedidos falhou:", e);
      toast.error(`Não foi possível gerar o relatório. ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <section className="rounded-xl border p-5 space-y-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "#0596691A", color: "#047857" }}>
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <h2 className="gw-body font-bold text-[15px]">Relatório geral de pedidos</h2>
          <p className="gw-meta">
            Excel com cliente, contato, endereço, status, pagamento e, por produto, personalização,
            custo, venda, imposto, comissão, taxa de cartão, frete e lucro (R$ e %).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATALHOS.map(a => (
          <Button key={a.id} type="button" variant="outline" size="sm" className="h-7 text-[12px]"
            onClick={() => { const i = intervalo(a.id); setInicio(i.inicio); setFim(i.fim); }}>
            {a.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="gw-label">De</span>
          <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="gw-label">Até</span>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
        </label>
        <div className="space-y-1">
          <span className="gw-label">Vendedor</span>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[13px] cursor-pointer w-fit">
        <Checkbox checked={incluirCancelados} onCheckedChange={v => setIncluirCancelados(v === true)} />
        Incluir pedidos cancelados
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void gerar()} disabled={gerando} className="bg-emerald-700 hover:bg-emerald-800 text-white">
          {gerando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          {gerando ? "Gerando…" : "Exportar Excel"}
        </Button>
        <span className="gw-meta text-[11.5px]">Abas: Itens (um produto por linha), Pedidos e Como ler.</span>
      </div>

      {resumo && (
        <div className="rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]" style={{ background: "var(--gw-surface-alt)" }}>
          <div><span className="gw-label">Pedidos</span><p className="gw-num text-[16px]">{resumo.pedidos}</p></div>
          <div><span className="gw-label">Linhas de produto</span><p className="gw-num text-[16px]">{resumo.itens}</p></div>
          <div><span className="gw-label">Vendido (sem frete)</span><p className="gw-num text-[16px]">{brl(resumo.venda)}</p></div>
          <div><span className="gw-label">Lucro líquido</span><p className="gw-num text-[16px]" style={{ color: resumo.lucro < 0 ? "var(--gw-danger)" : "var(--gw-success)" }}>{brl(resumo.lucro)}</p></div>
          {resumo.semCusto > 0 && (
            <p className="col-span-full flex items-center gap-1.5 text-[12px]" style={{ color: "var(--gw-warning)" }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {resumo.semCusto} produto(s) sem custo lançado — o lucro deles está superestimado (veja a coluna "Origem do custo").
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RelatorioOrcamentos() {
  const { vendedores, origens, meiosPagamento, transportadoras } = useSistema();
  const inicial = intervalo("mes");
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [vendedorId, setVendedorId] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<{ orcamentos: number; semWhats: number; total: number; aprovados: number } | null>(null);

  const gerar = async () => {
    if (!inicio || !fim || inicio > fim) {
      toast.error("Confira o período: a data inicial precisa ser antes da final.");
      return;
    }
    setGerando(true);
    try {
      const mapa = (xs: { id: string; nome: string }[]) => new Map(xs.map(x => [x.id, x.nome]));
      const linhas = await exportarRelatorioOrcamentos(
        { inicio, fim, status, vendedorId: vendedorId === "todos" ? null : vendedorId },
        {
          vendedores: mapa(vendedores), origens: mapa(origens),
          pagamentos: mapa(meiosPagamento), transportadoras: mapa(transportadoras),
        },
      );
      setResumo({
        orcamentos: linhas.length,
        semWhats: linhas.filter(l => l.whatsapp.replace(/\D/g, "").length < 10).length,
        total: linhas.reduce((s, l) => s + l.total, 0),
        aprovados: linhas.filter(l => l.o.status === "aprovado").length,
      });
      toast.success(linhas.length ? `Relatório gerado: ${linhas.length} orçamento(s).` : "Nenhum orçamento no período — planilha gerada vazia.");
    } catch (e) {
      console.error("[Relatórios] orçamentos falhou:", e);
      toast.error(`Não foi possível gerar o relatório. ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <section className="rounded-xl border p-5 space-y-4" style={{ background: "var(--gw-surface)", borderColor: "var(--gw-border)" }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "#2563EB1A", color: "#1D4ED8" }}>
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <h2 className="gw-body font-bold text-[15px]">Relatório de orçamentos</h2>
          <p className="gw-meta">
            Excel com cliente, contato, WhatsApp, e-mail do contato e da empresa, CNPJ/CPF, endereço,
            origem do lead, vendedor, produtos, valores, status e pedido gerado — para cruzar com os leads do Meta.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATALHOS.map(a => (
          <Button key={a.id} type="button" variant="outline" size="sm" className="h-7 text-[12px]"
            onClick={() => { const i = intervalo(a.id); setInicio(i.inicio); setFim(i.fim); }}>
            {a.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="gw-label">De</span>
          <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="gw-label">Até</span>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
        </label>
        <div className="space-y-1">
          <span className="gw-label">Vendedor</span>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="gw-label">Status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void gerar()} disabled={gerando} className="bg-blue-700 hover:bg-blue-800 text-white">
          {gerando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          {gerando ? "Gerando…" : "Exportar Excel"}
        </Button>
        <span className="gw-meta text-[11.5px]">Abas: Orçamentos (um por linha), Itens e Como ler.</span>
      </div>

      {resumo && (
        <div className="rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[13px]" style={{ background: "var(--gw-surface-alt)" }}>
          <div><span className="gw-label">Orçamentos</span><p className="gw-num text-[16px]">{resumo.orcamentos}</p></div>
          <div><span className="gw-label">Aprovados</span><p className="gw-num text-[16px]">{resumo.aprovados}</p></div>
          <div><span className="gw-label">Valor orçado</span><p className="gw-num text-[16px]">{brl(resumo.total)}</p></div>
          {resumo.semWhats > 0 && (
            <p className="col-span-full flex items-center gap-1.5 text-[12px]" style={{ color: "var(--gw-warning)" }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {resumo.semWhats} orçamento(s) sem WhatsApp do contato.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
