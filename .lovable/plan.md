
## Problemas

1. **Formulário reseta sozinho a cada ~10s** quando o vendedor está editando um orçamento — perde todas as alterações não salvas.
2. **Salvar sempre baixa o PDF automaticamente** — o vendedor quer decidir se quer baixar ou não.

## Causa raiz (problema 1)

Em `src/pages/sistema/OrcamentoForm.tsx` (linhas 94-114) existe um `useEffect` que reescreve `formData` sempre que `orcamentoExistente`, `clientes` ou `currentVendedor` mudam:

```ts
useEffect(() => {
  if (orcamentoExistente) {
    setFormData({ ...orcamentoExistente ... });
  }
}, [orcamentoExistente, clientes, currentVendedor]);
```

`orcamentoExistente` vem de `orcamentos.find(o => o.id === id)` no `SistemaContext`. Como o contexto atualiza a lista de orçamentos/clientes periodicamente (refresh na volta de foco / após ações), a referência do objeto muda e o `useEffect` sobrescreve tudo que o vendedor digitou.

## Correções

### 1. `src/pages/sistema/OrcamentoForm.tsx` — proteger o estado do formulário

- Alterar o `useEffect` de hidratação para rodar **apenas uma vez por orçamento carregado**, usando uma `ref` que guarda o `id` já hidratado (e o `updatedAt`, para permitir re-hidratar só quando o próprio orçamento realmente muda no servidor).
- Remover `clientes` e `currentVendedor` das dependências desse effect. A seleção de cliente selecionada continua sendo derivada, mas em um effect separado que só ajusta `clienteSelecionado` sem tocar em `formData`.
- Não mexer no restante da lógica (validação, cálculo de total, itens, etc.).

### 2. Checkbox "Baixar orçamento em PDF" ao lado do botão Salvar

- Adicionar `const [baixarPdf, setBaixarPdf] = useState(false)` no `OrcamentoForm`.
- No cabeçalho (linhas 280-287), inserir à esquerda do botão "Salvar Orçamento" um checkbox rotulado **"Baixar orçamento em PDF"**.
- Em `handleSalvar` (linhas 232-251), chamar `gerarPDFOrcamento(...)` **somente se `baixarPdf === true`**, tanto no ramo `isEdit` quanto no ramo de novo orçamento. O `navigate("/sistema/orcamentos")` e o `toast.success` continuam ocorrendo normalmente.

## Fora de escopo (não mexer)

- `SistemaContext` (refreshes automáticos continuam existindo — servem para outras telas).
- Lógica de PDF, aprovação, itens, cálculo de preços, busca de produtos.
- Tela de listagem `/sistema/orcamentos`.

## Verificação

- Abrir um orçamento existente, começar a editar, aguardar >15s → alterações permanecem intactas.
- Salvar sem marcar o checkbox → volta para lista, sem download.
- Salvar com checkbox marcado → volta para lista e o PDF é baixado.
