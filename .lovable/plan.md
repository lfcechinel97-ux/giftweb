## Cadastro de produtos customizados no sistema

Permitir que vendedores criem produtos próprios (fora da XBZ) com imagem e variantes, e os utilizem no orçamento. Produtos customizados ficam isolados do site público.

### 1. Backend (Lovable Cloud)

**Nova tabela `sistema_produtos_custom`** (separada de `products_cache` para não conflitar com sync XBZ):
- `nome`, `codigo` (texto livre, único), `preco_custo`, `estoque`, `image_url`, `cor`, `categoria`, `observacoes`
- `parent_id` (uuid, nullable) — se preenchido, é variante de outro produto custom
- `created_by` (uuid, auth.users), timestamps

RLS: qualquer admin logado (`is_admin_user()`) faz SELECT/INSERT/UPDATE/DELETE. GRANT para `authenticated` e `service_role`.

**Bucket de Storage `sistema-produtos`** (público para leitura) com policy: admins fazem upload/delete.

**Atualizar RPC `sistema_search_products`**: fazer UNION com `sistema_produtos_custom`, devolvendo no mesmo formato (rows), marcando origem com `is_custom = true` para diferenciar visualmente.

### 2. Frontend

**Nova aba "Meus Produtos" em `/sistema/produtos`** (mantém a aba atual "Catálogo XBZ"):
- Lista os produtos customizados com busca, edição inline e exclusão
- Botão "Novo produto" abre dialog com formulário: nome, código, preço de custo, estoque, cor, categoria, upload de imagem (drag-drop → bucket `sistema-produtos`)
- Suporte a variantes: dentro do dialog do produto pai, botão "+ Adicionar variante" cria filhos com cor/código/estoque/imagem próprios

**Busca de produtos no `OrcamentoForm`**: já usa `sistema_search_products`; passará a retornar XBZ + custom misturados, ordenados por relevância. Produto custom ganha badge sutil "Personalizado" no resultado.

### 3. Detalhes técnicos

- Validação com Zod no dialog: nome 1-200, código 1-50, preço ≥ 0, estoque ≥ 0
- Upload de imagem: limite 5MB, formatos jpg/png/webp; converte filename para slug
- Código duplicado: constraint `UNIQUE(codigo)` + tratamento de erro amigável
- Itens do orçamento já guardam snapshot (`nome`, `codigo`, `preco`, `image_url`), então funciona sem mudar schema de orçamento
- Não toca em `products_cache` nem no catálogo público — total isolamento
