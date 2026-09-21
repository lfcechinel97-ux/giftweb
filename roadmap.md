# Roadmap — segurança + deploy (21/09)

- [ ] Deploy `sistema-criar-usuario` e confirmar 401 sem token
- [ ] C2: trocar policies `auth_all_*` (USING true) por `is_admin_user()`
- [ ] A1: `security_invoker = on` nas 3 views (depois do C2)
- [ ] M1: revogar default privileges do anon em tabelas/funções novas
- [ ] M2: revogar EXECUTE anon/public de funções SECURITY DEFINER internas + checagem em sistema_contar_pedidos_por_coluna
- [ ] M3: limpar policies duplicadas de products_cache
- [ ] Propor (sem aplicar) bucket privado só para comprovantes/NF
- [ ] Propor (sem aplicar) A2 (papéis) e A3 (senha de exclusão), com impacto no PCP para produção
