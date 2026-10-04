-- =====================================================================
-- GIFT WEB - Histórico do Mockup Studio: identificação do cliente
-- (nome/telefone, opcional) e nome do vendedor em cada geração. Cada
-- vendedor continua vendo só as próprias; admin passa a ver todas.
-- =====================================================================

alter table public.mockup_geracoes add column if not exists cliente text;
alter table public.mockup_geracoes add column if not exists vendedor_nome text;

drop policy if exists "le as proprias geracoes de mockup" on public.mockup_geracoes;
create policy "le as proprias geracoes de mockup" on public.mockup_geracoes
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "le as proprias imagens de mockup" on storage.objects;
create policy "le as proprias imagens de mockup" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mockup-geracoes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin'))
  );
