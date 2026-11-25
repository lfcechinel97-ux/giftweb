# Roadmap — segurança + deploy (21/09)

- [x] Deploy `sistema-criar-usuario` — 401 sem token confirmado
- [x] C2: policies `auth_all_*` substituídas por `is_admin_user()` (7 tabelas)
- [x] A1: `security_invoker = on` nas 3 views
- [x] M1: default privileges do anon revogados (tabelas e funções novas)
- [x] M2: EXECUTE de anon/public revogado nas funções internas + checagem em `sistema_contar_pedidos_por_coluna`
- [x] M3: policy duplicada de `products_cache` removida
- [x] Propostas escritas em `docs/seguranca-propostas.md` (bucket privado, A2, A3)

Aguardando decisão do usuário: aplicar bucket `financeiro-docs`, A2 (papéis) e A3 (senha de exclusão).

## PR #30 — publicação
- [x] Republicar `analisar-conversas-comercial` sem IA e verificar 401 sem sessão.
- [x] Manter `LOVABLE_API_KEY` intacto.
- [x] Revisar os quatro alertas de leitura pública, sem alterar permissões: dados de catálogo/preços, sem campos pessoais; leitura inclui produtos inativos.
- [ ] Publicar o site após a decisão do usuário sobre os acessos revisados.

## Otimizações após Mini — 25/11/2026

Aplicar uma etapa por vez, somente após apresentar seu diff/migration e obter aprovação. Não alterar o tamanho da instância.

- [x] Coletar linha de base de db_health, slow_queries e plano do preço máximo.
- [x] 1. Índice parcial de preço máximo + React Query com cache de 1h; 4 testes aprovados e remount real sem nova consulta.
- [ ] 2. Comparação inicial em 10 termos concluída: 9 coincidem; inox acrescenta 11 IDs. Aguardar decisão sobre equivalência, depois apresentar diff para contagem estimada e debounce 400ms antes de trocar.
- [ ] 3. RPC de categorias com contagens agregadas e cache de 1h.
- [ ] 4. RPC única de chat/menções; polling 120s somente com aba visível, preservando permissões.
- [ ] 5. Projeção do board e joins agregados em vw_pcp, preservando demais consumidores e security_invoker.
- [ ] 6. Cron trello-lembretes a cada 15min (96 execuções/dia).
- [ ] 7. Investigar os rollbacks históricos nos logs, apenas leitura.
- [ ] 8. Mapear mídia/base64 no JSONB de orçamentos e propor Storage, sem migrar.
- [ ] Comparar db_health e slow_queries após as etapas aprovadas, distinguindo estatísticas cumulativas e consultas de diagnóstico.
