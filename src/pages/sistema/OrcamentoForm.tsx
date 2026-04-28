import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Upload, X, Search, ImageIcon, Package, AlertCircle } from "lucide-react";
// Local formatCurrency helper
const formatCurrency = (value: number) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
import { useSistema, type QuoteItem, type Orcamento } from "@/contexts/SistemaContext";
import ClienteDialog from "./ClienteDialog";
import { useSistemaProducts } from "./useSistemaProducts";
import { getEffectiveUnitPrice, getNormalizedPriceRows } from "@/utils/price";
import { cnpjMask, cpfMask } from "./cnpj";
import { gerarPDFOrcamento } from "./pdf";

const FRETE_TIPOS = [
  { value: "CIF", label: "CIF (Frete incluso)" },
  { value: "FOB", label: "FOB (Cliente pega)" },
] as const;

interface OrcamentoFormData {
  clienteId: string;
  contatoNome: string;
  contatoTelefone: string;
  contatoEmail: string;
  vendedorId: string;
  origemId: string;
  itens: QuoteItem[];
  freteTipo: "CIF" | "FOB" | null;
  freteValor: number;
  transportadoraId: string;
  prazoEntrega: number;
  pagamentoId: string;
  observacoes: string;
  anexoUrl: string;
}

export const OrcamentoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const {
    orcamentos,
    clientes,
    vendedores,
    transportadoras,
    meiosPagamento,
    origens,
    addOrcamento,
    updateOrcamento,
    currentVendedor,
  } = useSistema();

  const sis = { clientes, vendedores, meiosPagamento, transportadoras, origens };

  const { parentProducts, searchParents, getParentWithVariants, isLoading } = useSistemaProducts();

  const orcamentoExistente = useMemo(() => orcamentos.find((o) => o.id === id), [orcamentos, id]);

  const clienteInicial = useMemo(() => {
    if (orcamentoExistente) {
      return clientes.find((c) => c.id === orcamentoExistente.clienteId) || null;
    }
    return null;
  }, [orcamentoExistente, clientes]);

  const [formData, setFormData] = useState<OrcamentoFormData>({
    clienteId: "",
    contatoNome: "",
    contatoTelefone: "",
    contatoEmail: "",
    vendedorId: currentVendedor?.id || "",
    origemId: "",
    itens: [],
    freteTipo: null,
    freteValor: 0,
    transportadoraId: "",
    prazoEntrega: 0,
    pagamentoId: "",
    observacoes: "",
    anexoUrl: "",
  });

  const [clienteSelecionado, setClienteSelecionado] = useState(clienteInicial);
  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orcamentoExistente) {
      setFormData({
        clienteId: orcamentoExistente.clienteId,
        contatoNome: orcamentoExistente.contatoNome || "",
        contatoTelefone: orcamentoExistente.contatoTelefone || "",
        contatoEmail: orcamentoExistente.contatoEmail || "",
        vendedorId: orcamentoExistente.vendedorId || currentVendedor?.id || "",
        origemId: orcamentoExistente.origemId || "",
        itens: orcamentoExistente.itens,
        freteTipo: orcamentoExistente.freteTipo,
        freteValor: orcamentoExistente.freteValor,
        transportadoraId: orcamentoExistente.transportadoraId || "",
        prazoEntrega: orcamentoExistente.prazoEntrega || 0,
        pagamentoId: orcamentoExistente.pagamentoId || "",
        observacoes: orcamentoExistente.observacoes || "",
        anexoUrl: orcamentoExistente.anexoUrl || "",
      });
      setClienteSelecionado(clientes.find((c) => c.id === orcamentoExistente.clienteId) || null);
    }
  }, [orcamentoExistente, clientes, currentVendedor]);

  const subtotal = useMemo(() => formData.itens.reduce((sum, it) => sum + it.quantidade * it.precoUnitario, 0), [formData.itens]);
  const freteEfetivo = formData.freteTipo === "CIF" ? 0 : (formData.freteValor || 0);
  const total = subtotal + freteEfetivo;

  const clienteFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return clientes.slice(0, 20);
    const t = searchTerm.toLowerCase();
    return clientes.filter((c) => c.nome.toLowerCase().includes(t) || c.documento.includes(t)).slice(0, 20);
  }, [clientes, searchTerm]);

  const handleSelecionarCliente = (cliente: typeof clientes[0]) => {
    setClienteSelecionado(cliente);
    // Usa 1º contato cadastrado; se não houver, usa o nome da empresa como responsável
    const contato = cliente.contatos?.[0];
    setFormData((prev) => ({
      ...prev,
      clienteId: cliente.id,
      contatoNome: contato?.nome || cliente.nome,
      contatoTelefone: contato?.telefone || "",
      contatoEmail: contato?.email || "",
    }));
    setSearchTerm("");
  };

  const handleNovoCliente = () => setShowClienteDialog(true);

  const handleAddItem = () => {
    setEditingItemId(null);
    setEditingItem(null);
    setShowItemDialog(true);
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItemId(item.id);
    setEditingItem({ ...item });
    setShowItemDialog(true);
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      itens: prev.itens.filter((it) => it.id !== itemId),
    }));
  };

  const handleSalvarItem = (item: QuoteItem) => {
    setFormData((prev) => {
      const exists = prev.itens.find((it) => it.id === item.id);
      if (exists) {
        return { ...prev, itens: prev.itens.map((it) => (it.id === item.id ? item : it)) };
      }
      return { ...prev, itens: [...prev.itens, item] };
    });
    setShowItemDialog(false);
  };

  const handleSalvar = () => {
    if (!formData.clienteId || formData.itens.length === 0) {
      alert("Selecione um cliente e adicione pelo menos um item.");
      return;
    }
    const orcData: Omit<Orcamento, "id" | "numero" | "createdAt" | "updatedAt" | "aprovadoEm"> = {
      clienteId: formData.clienteId,
      contatoNome: formData.contatoNome,
      contatoTelefone: formData.contatoTelefone,
      contatoEmail: formData.contatoEmail,
      vendedorId: formData.vendedorId || currentVendedor?.id,
      origemId: formData.origemId || undefined,
      itens: formData.itens,
      subtotal,
      freteTipo: formData.freteTipo,
      freteValor: freteEfetivo,
      transportadoraId: formData.transportadoraId || undefined,
      prazoEntrega: formData.prazoEntrega || undefined,
      pagamentoId: formData.pagamentoId || undefined,
      observacoes: formData.observacoes || undefined,
      status: "aberto",
      anexoUrl: formData.anexoUrl || undefined,
    };

    if (isEdit && id) {
      updateOrcamento(id, orcData);
      const orc = orcamentos.find((o) => o.id === id);
      if (orc) gerarPDFOrcamento({ ...orc, ...orcData }, sis, clienteSelecionado?.nome);
      navigate("/sistema/orcamentos");
    } else {
      const novo = addOrcamento(orcData);
      gerarPDFOrcamento(novo, sis, clienteSelecionado?.nome);
      navigate("/sistema/orcamentos");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, anexoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const formatDoc = (doc: string, tipo: string) => {
    const digits = doc.replace(/\D/g, "");
    if (tipo === "PJ" || digits.length > 11) return cnpjMask(digits);
    return cpfMask(digits);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 p-6 border-b bg-white">
        <button onClick={() => navigate("/sistema/orcamentos")} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold">{isEdit ? `Orçamento ${orcamentoExistente?.numero}` : "Novo Orçamento"}</h1>
          <p className="text-sm text-gray-500">Preencha os dados do orçamento</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate("/sistema/orcamentos")} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSalvar} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            Salvar Orçamento
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Cliente */}
          <section className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Cliente</h3>
              {!clienteSelecionado && (
                <button onClick={handleNovoCliente} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Novo cliente
                </button>
              )}
            </div>

            {clienteSelecionado ? (
              <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{clienteSelecionado.nome}</p>
                  <p className="text-sm text-gray-500">
                    {formatDoc(clienteSelecionado.documento, clienteSelecionado.tipo)} • {clienteSelecionado.tipo}
                  </p>
                  {clienteSelecionado.contatos[0] && (
                    <p className="text-sm text-gray-500">
                      {clienteSelecionado.contatos[0].telefone}
                      {clienteSelecionado.contatos[0].email && ` • ${clienteSelecionado.contatos[0].email}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowClienteDialog(true)}
                  className="p-1 text-xs text-blue-600 hover:bg-blue-50 rounded px-2"
                >
                  Editar
                </button>
                <button onClick={() => setClienteSelecionado(null)} className="p-1 hover:bg-gray-200 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome ou documento..."
                    className="w-full pl-9 pr-4 py-2 border rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && clienteFiltrados.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-auto">
                    {clienteFiltrados.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelecionarCliente(c)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-sm text-gray-500">{formatDoc(c.documento, c.tipo)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {clienteSelecionado && (
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Contato</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.contatoNome}
                    onChange={(e) => setFormData((p) => ({ ...p, contatoNome: e.target.value }))}
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Telefone</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.contatoTelefone}
                    onChange={(e) => setFormData((p) => ({ ...p, contatoTelefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.contatoEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, contatoEmail: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Vendedor e Origem */}
          <section className="bg-white rounded-lg border p-4">
            <h3 className="font-medium mb-4">Informações da Venda</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Vendedor *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.vendedorId}
                  onChange={(e) => setFormData((p) => ({ ...p, vendedorId: e.target.value }))}
                  required
                >
                  <option value="">Selecione...</option>
                  {vendedores.filter(v => v.ativo).map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Origem</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.origemId}
                  onChange={(e) => setFormData((p) => ({ ...p, origemId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {origens.filter(o => o.ativo).map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Meio de Pagamento</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.pagamentoId}
                  onChange={(e) => setFormData((p) => ({ ...p, pagamentoId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {meiosPagamento.filter(p => p.ativo).map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Itens */}
          <section className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Itens ({formData.itens.length})</h3>
              <button onClick={handleAddItem} className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Adicionar Item
              </button>
            </div>

            {formData.itens.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum item adicionado</p>
                <button onClick={handleAddItem} className="text-primary hover:underline mt-1">Adicionar primeiro item</button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.itens.map((item, index) => (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.mockupImagem || item.imagem ? (
                        <img src={item.mockupImagem || item.imagem} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-full h-full p-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium truncate">{item.nome}</p>
                          <p className="text-sm text-gray-500">{item.codigoComposto}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditItem(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                            Editar
                          </button>
                          <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span>Qtd: <strong>{item.quantidade}</strong></span>
                        <span>Preço: <strong>{formatCurrency(item.precoUnitario)}</strong></span>
                        {item.precoManual && (
                          <span className="text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded">Preço manual</span>
                        )}
                        <span className="ml-auto font-medium">{formatCurrency(item.quantidade * item.precoUnitario)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Frete e Negociação */}
          <section className="bg-white rounded-lg border p-4">
            <h3 className="font-medium mb-4">Frete e Prazo</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tipo de Frete</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.freteTipo || ""}
                  onChange={(e) => {
                    const tipo = e.target.value as "CIF" | "FOB" | null;
                    setFormData((p) => ({ ...p, freteTipo: tipo, freteValor: tipo === "CIF" ? 0 : p.freteValor }));
                  }}
                >
                  <option value="">Selecione...</option>
                  {FRETE_TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Transportadora</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.transportadoraId}
                  onChange={(e) => {
                    const transp = transportadoras.find((t) => t.id === e.target.value);
                    setFormData((p) => ({
                      ...p,
                      transportadoraId: e.target.value,
                      prazoEntrega: transp?.prazoEntrega || p.prazoEntrega,
                    }));
                  }}
                >
                  <option value="">Selecione...</option>
                  {transportadoras.filter(t => t.ativo).map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Valor do Frete</label>
                {formData.freteTipo === "CIF" ? (
                  <div className="w-full px-3 py-2 border rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                    Frete Grátis
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.freteValor || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, freteValor: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Prazo Entrega (dias)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.prazoEntrega || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, prazoEntrega: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
            </div>
          </section>

          {/* Observações e Anexo */}
          <section className="bg-white rounded-lg border p-4">
            <h3 className="font-medium mb-4">Observações e Anexo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Observações</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.observacoes}
                  onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Observações gerais do orçamento..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Anexo</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> {formData.anexoUrl ? "Trocar arquivo" : "Selecionar arquivo"}
                  </button>
                  {formData.anexoUrl && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Upload className="w-4 h-4" /> Arquivo anexado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Resumo + botões inferiores */}
          <section className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {formData.itens.length} item(s) • {formData.itens.reduce((s, i) => s + i.quantidade, 0)} unidade(s)
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Subtotal: {formatCurrency(subtotal)}</div>
                {formData.freteTipo === "CIF" && (
                  <div className="text-sm text-green-600">Frete: Grátis (CIF)</div>
                )}
                {formData.freteTipo !== "CIF" && freteEfetivo > 0 && (
                  <div className="text-sm text-gray-500">Frete: {formatCurrency(freteEfetivo)}</div>
                )}
                <div className="text-xl font-bold text-primary">Total: {formatCurrency(total)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => navigate("/sistema/orcamentos")}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
              >
                Salvar Orçamento
              </button>
            </div>
          </section>
        </div>
      </div>

      {showClienteDialog && (
        <ClienteDialog
          open={showClienteDialog}
          onOpenChange={(v) => setShowClienteDialog(v)}
          cliente={clienteSelecionado || undefined}
          onSaved={(c) => {
            handleSelecionarCliente(c);
            setShowClienteDialog(false);
          }}
        />
      )}

      {showItemDialog && (
        <ItemDialog
          item={editingItem}
          parentProducts={parentProducts}
          isLoading={isLoading}
          searchParents={searchParents}
          getParentWithVariants={getParentWithVariants}
          onClose={() => setShowItemDialog(false)}
          onSave={handleSalvarItem}
        />
      )}
    </div>
  );
};

interface ItemDialogProps {
  item: QuoteItem | null;
  parentProducts: any[];
  isLoading: boolean;
  searchParents: (term: string) => any[];
  getParentWithVariants: (codigoAmigavel: string) => any;
  onClose: () => void;
  onSave: (item: QuoteItem) => void;
}

const ItemDialog: React.FC<ItemDialogProps> = ({
  item,
  parentProducts,
  isLoading,
  searchParents,
  getParentWithVariants,
  onClose,
  onSave,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [precoUnitario, setPrecoUnitario] = useState(0);
  const [precoOriginal, setPrecoOriginal] = useState(0);
  const [precoManual, setPrecoManual] = useState(false);
  const [mockupImagem, setMockupImagem] = useState<string | undefined>(undefined);
  const [showPriceRows, setShowPriceRows] = useState(false);
  const [produtoVariantes, setProdutoVariantes] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return parentProducts.slice(0, 10);
    return searchParents(searchTerm).slice(0, 10);
  }, [searchTerm, parentProducts, searchParents]);

  useEffect(() => {
    if (item) {
      setQuantidade(item.quantidade);
      setPrecoUnitario(item.precoUnitario);
      setPrecoOriginal(item.precoOriginal);
      setPrecoManual(item.precoManual);
      setMockupImagem(item.mockupImagem);
      if (item.produtoId) {
        const prod = getParentWithVariants(item.codigoComposto?.split("-")[0] || "");
        if (prod) {
          setSelectedProduct(prod.parent);
          const v = prod.variants.find((vv: any) => vv.slug === item.varianteSlug || vv.codigo_amigavel === item.codigoComposto);
          setSelectedVariant(v || null);
        }
      }
    }
  }, [item, getParentWithVariants]);

  // Busca variantes reais do banco ao selecionar produto
  useEffect(() => {
    if (!selectedProduct) { setProdutoVariantes([]); return; }
    const result = getParentWithVariants(selectedProduct.codigo_amigavel);
    setProdutoVariantes(result?.variants ?? []);
  }, [selectedProduct, getParentWithVariants]);

  const variantes = produtoVariantes;

  const priceRows = useMemo(() => {
    if (!selectedProduct) return null;
    return getNormalizedPriceRows(selectedProduct.tabela_precos, selectedProduct.preco_custo);
  }, [selectedProduct]);

  const calcularPrecoAutomatico = (qtd: number, prod?: any) => {
    const p = prod || selectedProduct;
    if (!p || !p.preco_custo) return 0;
    return getEffectiveUnitPrice(p.tabela_precos, p.preco_custo, qtd);
  };

  const handleSelectProduct = (prod: any) => {
    setSelectedProduct(prod);
    setSelectedVariant(null);
    setProdutoVariantes([]);
    const preco = calcularPrecoAutomatico(quantidade, prod);
    setPrecoOriginal(preco);
    if (!precoManual) setPrecoUnitario(preco);
    setSearchTerm("");
  };

  const handleSelectVariant = (variant: any) => {
    setSelectedVariant(variant);
    const preco = calcularPrecoAutomatico(quantidade);
    setPrecoOriginal(preco);
    if (!precoManual) setPrecoUnitario(preco);
  };

  const handleQuantidadeChange = (qtd: number) => {
    setQuantidade(qtd);
    if (!precoManual) {
      const preco = calcularPrecoAutomatico(qtd);
      setPrecoOriginal(preco);
      setPrecoUnitario(preco);
    }
  };

  const handlePrecoChange = (valor: number) => {
    setPrecoUnitario(valor);
    setPrecoManual(true);
  };

  const handleResetPreco = () => {
    const preco = calcularPrecoAutomatico(quantidade);
    setPrecoOriginal(preco);
    setPrecoUnitario(preco);
    setPrecoManual(false);
  };

  const handleMockupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setMockupImagem(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSalvar = () => {
    if (!selectedProduct || quantidade <= 0) return;
    const variant = selectedVariant;
    // codigoComposto: se há variante usa o código dela (já contém o composto, ex: 08114-VD),
    // caso contrário usa o código do pai.
    const codigoComposto = variant
      ? (variant.codigo_amigavel || `${selectedProduct.codigo_amigavel}-${variant.cor || variant.slug}`)
      : (selectedProduct.codigo_amigavel || selectedProduct.slug);
    const nome = variant
      ? `${selectedProduct.nome} - ${variant.cor || variant.codigo_amigavel || variant.slug}`
      : selectedProduct.nome;
    const imagem = mockupImagem || variant?.image_url || variant?.image || selectedProduct.image_url;

    const newItem: QuoteItem = {
      id: item?.id || crypto.randomUUID(),
      tipo: "produto",
      produtoId: selectedProduct.id,
      codigoComposto,
      varianteSlug: variant?.slug,
      nome,
      quantidade,
      precoUnitario,
      precoOriginal,
      precoManual,
      precoCusto: selectedProduct.preco_custo,
      tabelaPrecos: selectedProduct.tabela_precos,
      imagem,
      mockupImagem,
      altura: selectedProduct.altura,
    };
    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Editar Item" : "Adicionar Item"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Esquerda: Produto */}
            <div className="space-y-4">
              {!selectedProduct ? (
                <div>
                  <label className="block text-sm font-medium mb-2">Buscar Produto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Digite nome, código ou categoria..."
                      className="w-full pl-9 pr-4 py-2 border rounded-lg"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando produtos...</div>
                  ) : filteredProducts.length > 0 ? (
                    <div className="border rounded-lg mt-2 max-h-64 overflow-auto">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 flex gap-3"
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-full h-full p-2 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{p.nome}</p>
                            <p className="text-xs text-gray-500">{p.codigo_amigavel || p.slug}</p>
                            <p className="text-xs text-primary">{formatCurrency(p.preco_custo ? getEffectiveUnitPrice(p.tabela_precos, p.preco_custo, 1) : 0)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchTerm ? (
                    <div className="text-center py-4 text-gray-500">Nenhum produto encontrado</div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                      {(mockupImagem || selectedVariant?.image || selectedProduct.image_url) ? (
                        <img
                          src={mockupImagem || selectedVariant?.image || selectedProduct.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-full h-full p-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{selectedProduct.nome}</p>
                      <p className="text-sm text-gray-500">{selectedProduct.codigo_amigavel || selectedProduct.slug}</p>
                      <button
                        onClick={() => { setSelectedProduct(null); setSelectedVariant(null); }}
                        className="text-xs text-red-600 hover:underline mt-1"
                      >
                        Trocar produto
                      </button>
                    </div>
                  </div>

                  {/* Variant Selection */}
                  {variantes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Variante</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleSelectVariant(null)}
                          className={`px-3 py-1.5 text-sm rounded-lg border ${!selectedVariant ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}
                        >
                          Padrão
                        </button>
                        {variantes.map((v) => {
                          const estoque = typeof v.stock === "number" ? v.stock : (typeof v.estoque === "number" ? v.estoque : null);
                          return (
                            <button
                              key={v.slug || v.codigo_amigavel}
                              onClick={() => handleSelectVariant(v)}
                              className={`px-3 py-1.5 text-sm rounded-lg border flex flex-col items-center leading-tight ${
                                selectedVariant?.slug === v.slug ? "bg-primary text-white border-primary" : "hover:bg-gray-50"
                              }`}
                            >
                              <span>{v.cor || v.codigo_amigavel || v.slug}</span>
                              {estoque !== null && (
                                <span className={`text-[10px] font-normal ${
                                  selectedVariant?.slug === v.slug ? "text-white/70" : "text-gray-400"
                                }`}>
                                  {estoque} em estoque
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mockup Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Imagem Mockup (opcional)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleMockupUpload}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" /> {mockupImagem ? "Trocar" : "Enviar mockup"}
                      </button>
                      {mockupImagem && (
                        <button
                          onClick={() => setMockupImagem(undefined)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    {mockupImagem && (
                      <p className="text-xs text-green-600 mt-1">Mockup será usado no PDF</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Direita: Quantidade e Preço */}
            <div className="space-y-4">
              {selectedProduct && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg"
                      value={quantidade}
                      onChange={(e) => handleQuantidadeChange(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Preço Unitário</label>
                      {precoManual && (
                        <button
                          onClick={handleResetPreco}
                          className="text-xs text-primary hover:underline"
                        >
                          Resetar para automático
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`w-full pl-9 pr-3 py-2 border rounded-lg ${precoManual ? "border-amber-400 bg-amber-50" : ""}`}
                        value={precoUnitario === 0 ? "" : Number(precoUnitario).toFixed(2)}
                        onChange={(e) => handlePrecoChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    {precoManual && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Preço alterado manualmente
                      </p>
                    )}
                  </div>

                  {priceRows && priceRows.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <button
                        onClick={() => setShowPriceRows(!showPriceRows)}
                        className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                      >
                        Tabela de Preços {showPriceRows ? "▲" : "▼"}
                      </button>
                      {showPriceRows && (
                        <div className="mt-2 space-y-1 text-sm">
                          {priceRows.map((row: any) => (
                            <div
                              key={row.qty}
                              className={`flex justify-between px-2 py-1 rounded ${row.qty <= quantidade ? "bg-primary/10 text-primary" : ""}`}
                            >
                              <span>{row.qty}+ un</span>
                              <span>{formatCurrency(row.unit)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Preço Original (automático):</span>
                      <span>{formatCurrency(precoOriginal)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold mt-2">
                      <span>Total do Item:</span>
                      <span className="text-primary">{formatCurrency(quantidade * precoUnitario)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!selectedProduct || quantidade <= 0}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {item ? "Salvar Alterações" : "Adicionar ao Orçamento"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrcamentoForm;
