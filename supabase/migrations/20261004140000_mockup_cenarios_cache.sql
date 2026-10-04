-- =====================================================================
-- GIFT WEB - Refatoração do Mockup Studio: separa geração de CENÁRIO (IA,
-- com liberdade criativa -- resíntese é bem-vinda aqui) de APLICAÇÃO DA
-- LOGO (agora por inpainting com máscara real via GPT Image 2, não mais
-- "cole e peça pra não mexer", que a IA ignorava).
--
-- O cenário de um produto/variante/foto é sempre o mesmo visualmente, então
-- cacheia por visao_id (estável, derivado client-side de variante+índice da
-- foto) -- gera uma vez, serve pra todos os orçamentos daquele item.
-- Bucket público (mesmo padrão do bucket `mockups`): leitura livre, escrita
-- só pela edge function via service role (bypassa RLS, não precisa de
-- policy de insert pra ninguém).
-- =====================================================================

create table if not exists public.mockup_cenas (
  visao_id text primary key,
  cena_url text not null,
  criado_em timestamptz not null default now()
);

alter table public.mockup_cenas enable row level security;
-- Sem policy nenhuma: só a service role (edge function) acessa. O
-- client nunca lê essa tabela direto, só recebe a URL na resposta da
-- função gerar-cenario-mockup.

insert into storage.buckets (id, name, public)
values ('mockup-cenas', 'mockup-cenas', true)
on conflict (id) do nothing;

insert into public.mockup_ia_prompts (chave, prompt) values
  ('cenario_padrao',
    'Coloque esse {produto} em um cenário de mostruário B2B profissional e realista: prateleiras com outros ' ||
    'produtos desfocados ao fundo, mesa de madeira, iluminação de estúdio. Não altere o produto em si -- forma, ' ||
    'cor, material, proporções e qualquer personalização que já exista nele devem ficar exatamente iguais, só o ' ||
    'cenário ao redor muda.')
on conflict (chave) do nothing;
