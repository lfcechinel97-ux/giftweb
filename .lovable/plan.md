
## Corrigir persistência da foto de capa e melhorar responsividade dos banners

### Diagnóstico provável
Hoje há uma combinação de 4 problemas:

1. **Cache de imagem**: alguns pontos usam a URL pública “crua” do storage (`.../banner_x.png`) sem versão por `updated_at`, então o navegador/CDN continua mostrando a imagem antiga.
2. **Contexto global estático**: `SiteContentProvider` carrega `site_content` só uma vez no mount. Se você salva no admin e navega para o site na mesma sessão, o frontend pode continuar com os dados antigos.
3. **Admin mostra preview sem cache-busting**: em `/admin/banners`, depois do refresh a tela pode parecer “voltar” porque ela reaproveita a mesma URL sem token de versão.
4. **Preload hardcoded da capa**: `index.html` e `HeroSection.tsx` ainda têm preload/fallback fixos para `banner_1_*` com versão antiga, o que aumenta a chance de exibir a capa desatualizada.

---

## O que vou implementar

### 1) Padronizar URL versionada para banners CMS
Criar uma pequena camada utilitária para imagens do CMS, baseada em `value + updated_at`.

**Objetivo:**
- toda imagem gerenciada no admin ser renderizada como:
  - `url?v=timestamp_do_updated_at`
- isso força invalidação de cache sem mudar a lógica principal do upload.

**Aplicar em:**
- `src/components/HeroSection.tsx`
- `src/components/BannerSeparator.tsx`
- `src/pages/admin/AdminBanners.tsx`

### 2) Fazer o conteúdo do CMS atualizar em tempo real no app
Ajustar `SiteContentProvider` para não depender só do primeiro carregamento.

**Implementação:**
- manter o fetch inicial
- adicionar atualização reativa para `site_content`:
  - assinatura realtime da tabela, ou
  - refetch após mudanças locais no admin

**Resultado:**
- salvou no admin -> homepage passa a refletir a mudança sem precisar depender de estado velho da sessão.

### 3) Corrigir o preview do admin para não “voltar” após F5
No `AdminBanners`, usar:
- preview local com `URL.createObjectURL(file)` enquanto o arquivo ainda não foi salvo
- após salvar/refetch, usar a URL persistida **versionada pelo `updated_at`**
- revogar object URLs antigos para evitar acúmulo de memória

**Resultado:**
- a imagem que aparece após refresh será a realmente persistida no backend, não a versão cacheada do navegador.

### 4) Remover dependência de preload hardcoded antigo da capa
Refatorar a lógica da capa principal para não depender de versões fixas embutidas no código.

**Arquivos:**
- `src/components/HeroSection.tsx`
- `index.html`

**Decisão:**
- manter a renderização nativa com `<picture>` para mobile/desktop
- trocar os fallbacks hardcoded por uma estratégia segura:
  - usar dados do CMS quando existirem
  - usar asset fallback local só se o CMS estiver vazio
- revisar/remover preloads remotos com versão fixa, porque ficam obsoletos quando você troca a capa pelo admin

### 5) Melhorar a responsividade do admin de banners
A tela de `/admin/banners` hoje está funcional, mas muito “travada” para telas menores.

**Melhorias:**
- cabeçalho e botões com quebra inteligente em mobile
- cards com padding responsivo
- previews desktop/mobile em grid responsivo em vez de blocos rígidos
- preview mobile ocupando largura melhor em celular/tablet
- botão “Salvar alterações” com melhor comportamento sticky e largura adequada em mobile
- labels de dimensão mais discretas e legíveis

### 6) Melhorar a responsividade dos banners no site
Ajustar a experiência visual do banner no frontend, sem trocar a lógica principal do carrossel.

**Hero (`HeroSection`)**
- revisar proporção e encaixe entre mobile e desktop
- evitar cortes/overflow feios
- ajustar setas e indicadores para telas menores
- garantir que a imagem ocupe bem o frame sem distorção

**Banner faixa (`BannerSeparator`)**
- aplicar a mesma lógica versionada de cache-busting
- melhorar largura útil e comportamento de `object-fit` entre mobile e desktop
- preservar exibição integral do banner sem parecer “espremido”

---

## Arquivos envolvidos

### Código
- `src/contexts/SiteContentContext.tsx`
- `src/hooks/useSiteContent.ts`
- `src/pages/admin/AdminBanners.tsx`
- `src/components/HeroSection.tsx`
- `src/components/BannerSeparator.tsx`
- `index.html`

### Possível utilitário novo
- `src/utils/siteContentImage.ts` ou similar  
  Para centralizar:
- `buildVersionedCmsUrl`
- `getVersionToken`
- fallback seguro para imagens CMS

---

## Resultado esperado
Depois da implementação:

- ao subir uma nova foto de capa no admin, ela permanece correta após salvar
- ao dar F5, a imagem **não volta** para a anterior
- no site, a capa atualizada passa a aparecer corretamente
- banners CMS deixam de sofrer com cache antigo
- admin de banners fica mais confortável em mobile e desktop
- hero/banner faixa ficam visualmente mais bem adaptados em telas menores e maiores

---

## Observação técnica importante
Não vou mudar a lógica principal de upload nem o modelo do CMS. A correção será feita em cima de:
- invalidação de cache via `updated_at`
- atualização reativa do conteúdo
- refino responsivo da UI/admin e da renderização no frontend
