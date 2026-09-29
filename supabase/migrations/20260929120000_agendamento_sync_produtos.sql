-- =====================================================================
-- GIFT WEB - Agenda a sincronização do estoque com a XBZ, todo dia às
-- 05h (horário de Brasília = 08h UTC, sem horário de verão no Brasil
-- hoje). Roda "por trás": chama a edge function sync-products via
-- pg_net (fire-and-forget), autenticada com um segredo só dela — NUNCA
-- com login de usuário. Se a chamada falhar (API da XBZ fora do ar,
-- timeout, etc.), a function já registra o erro em `sync_log` e devolve
-- 500 sozinha; aqui não há retry nem qualquer efeito colateral no
-- comercial — só essa tabela de log guarda o resultado.
--
-- ANTES DE RODAR ESTA MIGRATION, faça os dois passos manuais (ver
-- instruções que acompanham este arquivo):
--   1) Edge Functions → sync-products → Secrets → adicionar
--      CRON_SYNC_SECRET com o valor combinado.
--   2) Rodar no SQL Editor (não entra em migration/git):
--      select vault.create_secret('<o mesmo valor>', 'cron_sync_secret');
-- =====================================================================

select cron.schedule(
  'sync-produtos-xbz-05h',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://ozkbfxvouxgsdthnweyr.supabase.co/functions/v1/sync-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Para remover o agendamento, se um dia precisar:
-- select cron.unschedule('sync-produtos-xbz-05h');

-- Para adicionar um segundo horário (ex.: meio-dia), depois de medir
-- quanto tempo a sincronização leva de verdade (ver sync_log):
-- select cron.schedule('sync-produtos-xbz-12h', '0 15 * * *', $$ ... mesmo corpo ... $$);
