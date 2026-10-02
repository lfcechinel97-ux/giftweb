-- =====================================================================
-- GIFT WEB - Prompts do tratamento por IA do Mockup Studio editáveis por
-- quem tem papel ADMIN de verdade (não qualquer membro da equipe interna
-- -- por isso usa has_role(..,'admin'), igual ao financeiro, e não
-- is_admin_user() que cobre todo mundo com linha em admin_users).
-- A edge function tratar-logo-ia lê daqui (via service role, passa por
-- cima do RLS) e cai pro texto padrão embutido no código se a linha não
-- existir ainda.
-- =====================================================================

create table if not exists public.mockup_ia_prompts (
  chave text primary key,
  prompt text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.admin_users(id)
);

alter table public.mockup_ia_prompts enable row level security;

drop policy if exists "admin le e edita prompts ia" on public.mockup_ia_prompts;
create policy "admin le e edita prompts ia" on public.mockup_ia_prompts
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.mockup_ia_prompts from anon;

insert into public.mockup_ia_prompts (chave, prompt) values
  ('logo_laser',
    'This logo will be laser engraved on stainless steel. Remove the background completely (transparent). ' ||
    'Do NOT redesign, reinterpret or recreate the logo -- keep every letter, symbol, line, proportion and spacing exactly ' ||
    'as in the original. Convert the artwork to a clean monochrome silver/bright metallic look suitable for a laser ' ||
    'engraving preview, preserving all fine details and transparency where it already existed.'),
  ('logo_dtf_uv',
    'This logo will be printed with DTF UV (full color, with a glossy surface and slight varnish relief). Remove the ' ||
    'background completely (transparent) if there is one. Do NOT redesign, reinterpret or recreate the logo or its ' ||
    'colors -- keep letters, symbols, proportions, contours and small details exactly as in the original. Do not add ' ||
    'any outline, element, text or effect that was not requested.'),
  ('logo_dtf_textil',
    'This logo will be printed with DTF for fabric application. Remove the background completely (transparent) if ' ||
    'there is one. Do NOT redesign, reinterpret or recreate the logo or its colors -- keep letters, symbols, ' ||
    'proportions, contours and small details exactly as in the original. Do not make it look embroidered and do not ' ||
    'add textures inside the artwork.'),
  ('composicao',
    'This image shows a product with a logo already placed on it, as a mockup preview. Enhance ONLY how the logo ' ||
    'blends with the product''s surface: realistic shading, lighting direction matching the product, and perspective ' ||
    'if the surface is curved. Do NOT change the product itself (shape, color, material) and do NOT redesign, move, ' ||
    'resize, recolor or reinterpret the logo -- its letters, symbols and proportions must stay exactly the same. Do ' ||
    'not add, remove or invent any element that is not already in the image.')
on conflict (chave) do nothing;
