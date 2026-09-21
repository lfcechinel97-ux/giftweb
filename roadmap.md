# Roadmap — segurança + deploy (21/09)

- [x] Deploy `sistema-criar-usuario` — 401 sem token confirmado
- [x] C2: policies `auth_all_*` substituídas por `is_admin_user()` (7 tabelas)
- [x] A1: `security_invoker = on` nas 3 views
- [x] M1: default privileges do anon revogados (tabelas e funções novas)
- [x] M2: EXECUTE de anon/public revogado nas funções internas + checagem em `sistema_contar_pedidos_por_coluna`
- [x] M3: policy duplicada de `products_cache` removida
- [x] Propostas escritas em `docs/seguranca-propostas.md` (bucket privado, A2, A3)

Aguardando decisão do usuário: aplicar bucket `financeiro-docs`, A2 (papéis) e A3 (senha de exclusão).
