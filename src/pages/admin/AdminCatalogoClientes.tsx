import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search, Save, X, Upload, Plus, Trash2, Eye, EyeOff, Star, Loader2, ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { CAMPOS_FAIXA, QTD_PADRAO, brl, faixasDoProduto } from "@/lib/catalogoPrecos";

export interface CorVariacao {
  n: string;
  h: string | string[];
}

export interface CatalogoItem {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  categoria_rotulo: string | null;
  subcategoria: string | null;
  grupo: string | null;
  grupo_rotulo: string | null;
  preco: number | null;
  /** Faixas por quantidade. Opcionais: a coluna so existe depois da migration. */
  faixa1_qtd?: number | null; faixa1_preco?: number | null;
  faixa2_qtd?: number | null; faixa2_preco?: number | null;
  faixa3_qtd?: number | null; faixa3_preco?: number | null;
  imagem_url: string | null;
  imagem_secundaria_url: string | null;
  cores: CorVariacao[];
  destaque: boolean;
  ordem: number;
  ativo: boolean;
}

const BUCKET = "site-images";
const PASTA = "catalogo-clientes";

/** Mesmo mapa usado no catálogo público, para o admin mostrar a bolinha certa. */
const CORES_SUGERIDAS: Record<string, string> = {
  Azul: "#3B82F6", "Azul Claro": "#60A5FA", "Azul Escuro": "#1E3A5F",
  Vermelho: "#EF4444", Verde: "#22C55E", "Verde Escuro": "#166534",
  Preto: "#111827", Branco: "#F9FAFB", Bege: "#E8D9BE", Amarelo: "#EAB308",
  Roxo: "#8B5CF6", Rosa: "#EC4899", Pink: "#DB2777", Cinza: "#6B7280",
  Chumbo: "#4B5563", Laranja: "#F97316", Marrom: "#92400E", Dourado: "#D4A15A",
  Prata: "#C0C0C0", Inox: "#B8BCC4", Vinho: "#7F1D1D", Transparente: "#E5E7EB",
};

function corParaCss(h: string | string[]): string {
  return Array.isArray(h)
    ? `linear-gradient(135deg, ${h[0]} 0 50%, ${h[1]} 50% 100%)`
    : h;
}

export default function AdminCatalogoClientes() {
  const [itens, setItens] = useState<CatalogoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [editando, setEditando] = useState<CatalogoItem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState<"principal" | "secundaria" | null>(null);
  /**
   * As colunas de faixa vem de uma migration que roda separada (Lovable Cloud
   * nao aplica migration por push). Enquanto ela nao rodar, o select nao traz
   * esses campos - e mandar eles no update faria TODO salvamento falhar. Por
   * isso o admin detecta a coluna em vez de assumir que ela existe.
   */
  const [temFaixas, setTemFaixas] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("catalogo_clientes" as never)
      .select("*")
      .order("ordem", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar: " + error.message);
    } else {
      const linhas = (data as unknown as CatalogoItem[]) ?? [];
      setItens(linhas);
      if (linhas.length) setTemFaixas("faixa1_preco" in linhas[0]);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const categorias = useMemo(
    () => [...new Set(itens.map((i) => i.categoria))].sort(),
    [itens],
  );

  const visiveis = useMemo(() => {
    const t = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return itens.filter((i) => {
      const alvo = `${i.nome} ${i.codigo} ${i.categoria} ${i.subcategoria ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return (!t || alvo.includes(t)) && (!filtroCategoria || i.categoria === filtroCategoria);
    });
  }, [itens, busca, filtroCategoria]);

  const salvar = async () => {
    if (!editando) return;
    if (!editando.nome.trim()) {
      toast.error("O nome não pode ficar vazio");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("catalogo_clientes" as never)
      .update({
        nome: editando.nome.trim(),
        categoria: editando.categoria,
        categoria_rotulo: editando.categoria_rotulo,
        subcategoria: editando.subcategoria,
        grupo: editando.grupo,
        grupo_rotulo: editando.grupo_rotulo,
        preco: editando.preco,
        ...(temFaixas
          ? {
              faixa1_qtd: editando.faixa1_qtd ?? null,
              faixa1_preco: editando.faixa1_preco ?? null,
              faixa2_qtd: editando.faixa2_qtd ?? null,
              faixa2_preco: editando.faixa2_preco ?? null,
              faixa3_qtd: editando.faixa3_qtd ?? null,
              faixa3_preco: editando.faixa3_preco ?? null,
            }
          : {}),
        imagem_url: editando.imagem_url,
        imagem_secundaria_url: editando.imagem_secundaria_url,
        cores: editando.cores,
        destaque: editando.destaque,
        ativo: editando.ativo,
        ordem: editando.ordem,
      } as never)
      .eq("id", editando.id);
    setSalvando(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setItens((prev) => prev.map((i) => (i.id === editando.id ? editando : i)));
    setEditando(null);
    toast.success("Produto atualizado. Já está no ar no catálogo.");
  };

  const alternarAtivo = async (item: CatalogoItem) => {
    const novo = !item.ativo;
    const { error } = await supabase
      .from("catalogo_clientes" as never)
      .update({ ativo: novo } as never)
      .eq("id", item.id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, ativo: novo } : i)));
    toast.success(novo ? "Produto visível no catálogo" : "Produto escondido do catálogo");
  };

  const enviarFoto = async (file: File, campo: "principal" | "secundaria") => {
    if (!editando) return;
    setEnviandoFoto(campo);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      // timestamp no nome: o navegador cacheia por URL, entao reaproveitar o
      // mesmo caminho faria a foto antiga continuar aparecendo
      const path = `${PASTA}/${editando.codigo}-${campo}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setEditando({
        ...editando,
        ...(campo === "principal"
          ? { imagem_url: data.publicUrl }
          : { imagem_secundaria_url: data.publicUrl }),
      });
      toast.success("Foto enviada. Clique em Salvar para confirmar.");
    } catch (e) {
      toast.error("Erro no upload: " + (e as Error).message);
    } finally {
      setEnviandoFoto(null);
    }
  };

  const atualizarCor = (idx: number, patch: Partial<CorVariacao>) => {
    if (!editando) return;
    const cores = editando.cores.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setEditando({ ...editando, cores });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Catálogo Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Os produtos que aparecem no link enviado por WhatsApp. Alterações aqui
            entram no ar na hora.
          </p>
        </div>
        <a
          href="/catalogo-clientes"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
        >
          <ExternalLink className="h-4 w-4" />
          Ver catálogo
        </a>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou categoria..."
            className="pl-9"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {visiveis.length} de {itens.length}
        </span>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando produtos...
        </div>
      ) : itens.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-muted-foreground bg-background">
          Nenhum produto encontrado. Rode a migration do catálogo primeiro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((item) => (
            <div
              key={item.id}
              className={`border rounded-lg bg-background p-3 flex gap-3 ${
                item.ativo ? "" : "opacity-55"
              }`}
            >
              <div className="w-20 h-20 shrink-0 rounded-md border bg-white overflow-hidden">
                {item.imagem_url && (
                  <img
                    src={item.imagem_url}
                    alt={item.nome}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start gap-1">
                  <p className="text-sm font-medium leading-tight line-clamp-2 flex-1">
                    {item.nome}
                  </p>
                  {item.destaque && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {item.codigo} · {item.grupo_rotulo || item.categoria_rotulo}
                </p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {item.cores?.slice(0, 8).map((c, i) => (
                    <span
                      key={i}
                      title={c.n}
                      className="w-3 h-3 rounded-full ring-1 ring-black/10"
                      style={{ background: corParaCss(c.h) }}
                    />
                  ))}
                  {item.cores?.length > 8 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{item.cores.length - 8}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-auto pt-2">
                  {faixasDoProduto(item) ? (
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {item.faixa1_qtd ?? QTD_PADRAO[0]}+ {brl(item.faixa1_preco!)}
                      <span className="mx-1 text-muted-foreground/60">→</span>
                      <span className="text-sm font-bold text-green-700">
                        {item.faixa3_qtd ?? QTD_PADRAO[2]}+ {brl(item.faixa3_preco!)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-green-700">
                      {item.preco != null
                        ? item.preco.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => alternarAtivo(item)}>
                      {item.ativo ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditando({ ...item })}>
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Painel de edição ── */}
      {editando && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex justify-end"
          onClick={() => setEditando(null)}
        >
          <div
            className="w-full max-w-lg bg-background h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background border-b px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-semibold">Editar produto</h2>
                <p className="text-xs text-muted-foreground">{editando.codigo}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <Label>Nome do produto</Label>
                <Input
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço exibido (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editando.preco ?? ""}
                    onChange={(e) =>
                      setEditando({
                        ...editando,
                        preco: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="mt-1.5"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Só aparece ("a partir de") quando não há preço por faixa
                  </p>
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editando.ordem}
                    onChange={(e) =>
                      setEditando({ ...editando, ordem: Number(e.target.value) || 0 })
                    }
                    className="mt-1.5"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Menor aparece antes</p>
                </div>
              </div>

              {/* Precos por faixa: e o que o cliente ve no card. O campo
                  "Preco exibido" acima so entra em acao quando as tres faixas
                  estao vazias. */}
              <div className="rounded-lg border p-4">
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm">Preço por quantidade</Label>
                  <span className="text-[11px] text-muted-foreground">
                    100+ un. = melhor preço
                  </span>
                </div>

                {temFaixas ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {CAMPOS_FAIXA.map((c, i) => {
                        const melhor = i === CAMPOS_FAIXA.length - 1;
                        return (
                          <div
                            key={c.preco}
                            className={`rounded-md p-2 ${melhor ? "bg-green-50 ring-1 ring-green-200" : "bg-muted/50"}`}
                          >
                            <Label className="text-[10px] text-muted-foreground">
                              A partir de (un.)
                            </Label>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              placeholder={String(QTD_PADRAO[i])}
                              value={editando[c.qtd] ?? ""}
                              onChange={(e) =>
                                setEditando({
                                  ...editando,
                                  [c.qtd]: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="mt-1 h-8"
                            />
                            <Label
                              className={`text-[10px] mt-2 block ${melhor ? "text-green-700 font-semibold" : "text-muted-foreground"}`}
                            >
                              {melhor ? "Melhor preço (R$)" : "Preço (R$)"}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="—"
                              value={editando[c.preco] ?? ""}
                              onChange={(e) =>
                                setEditando({
                                  ...editando,
                                  [c.preco]: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className={`mt-1 h-8 ${melhor ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {faixasDoProduto(editando)
                        ? `O card mostra as três faixas lado a lado e começa em ${editando.faixa1_qtd ?? QTD_PADRAO[0]} un.`
                        : "Preencha os três preços, em quantidades crescentes, para o card mostrar a escada. Faltando algum, ele volta a exibir só o “Preço exibido” acima."}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-2 flex gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                    <span>
                      As colunas de preço por faixa ainda não existem no banco. Rode a
                      migration <code>20260904094500_catalogo_faixas_por_produto.sql</code> no SQL
                      editor do Lovable Cloud para liberar esta seção.
                    </span>
                  </p>
                )}
              </div>

              <div>
                <Label>Seção da página</Label>
                <select
                  value={editando.categoria}
                  onChange={(e) => {
                    const cat = e.target.value;
                    const ref = itens.find((i) => i.categoria === cat);
                    setEditando({
                      ...editando,
                      categoria: cat,
                      categoria_rotulo: ref?.categoria_rotulo ?? cat,
                    });
                  }}
                  className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Categoria dos stories</Label>
                <select
                  value={editando.grupo ?? ""}
                  onChange={(e) => {
                    const g = e.target.value;
                    const ref = itens.find((i) => i.grupo === g);
                    setEditando({
                      ...editando,
                      grupo: g || null,
                      grupo_rotulo: ref?.grupo_rotulo ?? null,
                    });
                  }}
                  className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sem categoria de story</option>
                  {[...new Set(itens.map((i) => i.grupo).filter(Boolean))].map((g) => (
                    <option key={g as string} value={g as string}>
                      {itens.find((i) => i.grupo === g)?.grupo_rotulo || g}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Define em qual bolinha do topo o produto aparece
                </p>
              </div>

              {/* Imagens */}
              <div className="grid grid-cols-2 gap-3">
                {(["principal", "secundaria"] as const).map((campo) => {
                  const url =
                    campo === "principal" ? editando.imagem_url : editando.imagem_secundaria_url;
                  return (
                    <div key={campo}>
                      <Label className="capitalize">Foto {campo}</Label>
                      <div className="mt-1.5 border rounded-md aspect-square bg-white overflow-hidden relative">
                        {url ? (
                          <img src={url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                            sem foto
                          </div>
                        )}
                        {enviandoFoto === campo && (
                          <div className="absolute inset-0 bg-white/80 grid place-items-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      <label className="mt-1.5 flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs cursor-pointer hover:bg-muted transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        Trocar
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) enviarFoto(f, campo);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Cores */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Variações de cor</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditando({
                        ...editando,
                        cores: [...editando.cores, { n: "Nova cor", h: "#3B82F6" }],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  As bolinhas só aparecem no catálogo com 2 ou mais cores
                </p>
                <div className="mt-2 space-y-2">
                  {editando.cores.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma cor cadastrada.</p>
                  )}
                  {editando.cores.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full ring-1 ring-black/10 shrink-0"
                        style={{ background: corParaCss(c.h) }}
                      />
                      <Input
                        value={c.n}
                        onChange={(e) => {
                          const nome = e.target.value;
                          const sugestao = CORES_SUGERIDAS[nome.trim()];
                          atualizarCor(i, sugestao ? { n: nome, h: sugestao } : { n: nome });
                        }}
                        placeholder="Nome da cor"
                        className="h-9"
                        list="cores-sugeridas"
                      />
                      <Input
                        type="color"
                        value={Array.isArray(c.h) ? c.h[0] : c.h}
                        onChange={(e) => atualizarCor(i, { h: e.target.value })}
                        className="h-9 w-14 p-1 cursor-pointer"
                        title={
                          Array.isArray(c.h)
                            ? "Cor composta — editar aqui deixa em tom único"
                            : "Escolher cor"
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditando({
                            ...editando,
                            cores: editando.cores.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <datalist id="cores-sugeridas">
                    {Object.keys(CORES_SUGERIDAS).map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.destaque}
                    onChange={(e) => setEditando({ ...editando, destaque: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Mais vendido
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.ativo}
                    onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Visível no catálogo
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-background border-t px-5 py-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
