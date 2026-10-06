# Cartela DTF (`/carteladtf`)

Ferramenta interna que gera a cartela de DTF (têxtil ou UV com TOYO) em **PDF
vetorial, escala real 1:1**, pronta para o RIP. A pessoa sobe o PDF vetorial da
logo, informa largura e quantidade e baixa o PDF.

- Página: `src/pages/CartelaDtf.tsx` (rota em `src/App.tsx`); visualizador com zoom em
  `src/pages/cartelaDtf/VisualizadorPdf.tsx`.
- Núcleo: `src/lib/cartelaDtf/`
  - `layout.ts`: cálculo do grid (mesmas fórmulas da referência em Python).
  - `conteudoPdf.ts`: troca de cor pelo spot (as regex de `spot_layer()`) e o tokenizador do content stream.
  - `geometria.ts`: mini interpretador do content stream (caminhos, `cm`/`q`/`Q`, clip, traços, Form XObjects).
  - `contracao.ts`: união da silhueta e offset negativo com Clipper.
  - `gerarCartela.ts`: monta o PDF com o pdf-lib.
- Referência e validação: `scripts/carteladtf/` (ver "Validação" abaixo).

## Como funciona

Tudo roda **no navegador**: a logo do cliente não é enviada para servidor
nenhum. Bibliotecas com versão fixada no `package.json`: `pdf-lib@1.17.1` e
`js-angusj-clipper@1.3.1` (Clipper em WebAssembly, embutido no bundle, sem CDN;
só é baixado quando alguém liga "Contrair TOYO").

1. Lê a página 1 do PDF. A caixa da logo é o **MediaBox**, com a origem real
   (PDFs do Corel vêm com `[-1 -1 …]`).
2. Calcula o grid: `W = largura·CM`, `escala = W / larguraMediaBox`, colunas
   máximas, distribuição *Equilibrada* ou *Encher linha*.
3. **Camada base**: a página da logo vira um Form XObject (`embedPage`) com
   `BBox` = MediaBox e `/Matrix [1 0 0 1 -left -bottom]`, desenhado uma vez por
   posição com `q s 0 0 s x y cm /FmB Do Q`. O conteúdo da logo não é alterado.
   (O `embedPage` do pdf-lib, por padrão, ignora a origem do MediaBox e
   cortaria as logos do Corel; por isso a caixa é passada explicitamente.)
4. **Camada TOYO** (só DTF UV), sempre desenhada por cima da base, num segundo
   Form XObject com o Separation `/CSspot` = `[/Separation /TOYO#200001pc
   /DeviceCMYK <Tipo 2, C1 = cor de visualização>]` a 100% e o ExtGState
   `/GSop` (`/op true /OP true /OPM 1`):
   - **Sem contrair**: cópia do content stream com todas as cores trocadas pelo
     spot e `/GSop gs` no início e depois de cada `gs` (preserva as curvas).
   - **Contrair TOYO**: a silhueta é recalculada. O content stream é
     interpretado, curvas achatadas (tolerância 0,005 mm no tamanho final),
     traços viram contornos (meia espessura, pontas e juntas), tudo é unido
     respeitando nonzero/even-odd e clip, e o Clipper aplica offset negativo
     com juntas redondas. A distância é **física**: `d_fonte = (d_mm/10·CM) /
     escala`. O TOYO sai como polilinhas `m l h … f*`.
5. Avisos (não bloqueiam): partes finas que somem com a contração (perda de
   área maior que 8·d²; pontas agudas de canto não contam), texto não convertido
   em curvas, imagem, gradiente, tracejado, folha acima de 5 m.
   Erros (bloqueiam): PDF sem página, protegido por senha, só imagem, logo que
   não cabe na folha.

Nome do arquivo: `cartela_{qtd}x_{largura}cm[_toyo].pdf`; com várias logos,
`cartela_{qtdTotal}x_{n}logos[_toyo].pdf`.

### Várias logos na mesma cartela

"Adicionar outra logo" cria mais um cartão (arquivo + largura + quantidade);
também dá para soltar vários PDFs de uma vez num cartão. Tipo, contração,
espaçamento, margem, largura da folha e distribuição valem para a folha toda.
As logos entram em linhas, da esquerda para a direita: cada uma usa o seu
número de colunas (calculado pela largura dela e pela distribuição). Com
**"Aproveitar a sobra da linha"** (padrão), se uma logo termina no meio da
linha, a próxima começa ali mesmo, enquanto couber na largura máxima da folha;
desligado, cada logo começa numa linha nova. Numa linha com logos de alturas
diferentes, todas encostam no topo e a linha fica com a altura da maior. A
largura da folha é a da linha mais larga. Com uma logo só, o resultado é
idêntico à referência em Python. Cada logo tem seu Form XObject base e o seu
TOYO; o Separation e o ExtGState de overprint são compartilhados.
Logo com largura/quantidade inválida fica fora da cartela, com aviso.

### Pré-visualização com zoom

O PDF gerado é desenhado pelo pdf.js só no pedaço visível, então dá para
aproximar até 8.000% (100% ≈ tamanho real na tela) e ver a faixa da logo
original em volta do TOYO contraído. Roda do mouse, pinça, duplo clique e
arrastar; botões "Folha inteira" e "Ver logo N de perto". Ao mudar a distância
o zoom e a posição são mantidos, para comparar no mesmo lugar.

## Como trocar o nome do spot ou a distância padrão

- Na tela, em **Avançado** (aparece no modo DTF UV), dá para mudar o nome do
  spot e a cor de visualização só para aquela cartela.
- Para mudar o **padrão**, edite as constantes em
  `src/lib/cartelaDtf/gerarCartela.ts`:
  - `SPOT_PADRAO = "TOYO 0001pc"`
  - `CMYK_PADRAO = [33, 90, 3, 0]`
  - `DISTANCIA_PADRAO_MM = 0.15` (distância padrão da contração)

  Depois é só publicar de novo (ver "Deploy").

## Acesso (só usuários cadastrados)

A rota usa o mesmo login do Sistema da Gift Web (Supabase Auth): o `AdminGuard`
exige sessão válida **e** uma linha do usuário em `admin_users`. Sem isso a
ferramenta nem é renderizada e a pessoa vai para
`/admin/login?next=/carteladtf`, voltando para a cartela depois de entrar.
O botão **Sair** encerra a sessão. A sessão fica salva no navegador.

- **Cadastrar usuário**: um administrador entra em `/sistema` → Configurações →
  aba **Usuários** → novo usuário (nome, e-mail, senha, perfil). Isso chama a
  edge function `sistema-criar-usuario`, que só aceita chamadas de admin e já
  cria a conta confirmada e liberada em `admin_users`. Qualquer perfil
  (Admin, Comercial, Produção) acessa a cartela.
- **Remover usuário**: mesma aba, botão de tirar acesso (função
  `sistema_remover_usuario`, apaga a linha de `admin_users`). A pessoa não entra
  mais nem no Sistema nem na cartela.
- Não existe cadastro pela tela. Mesmo que alguém crie conta direto no Supabase
  Auth, sem linha em `admin_users` não acessa. Recomendado manter **desligado**
  o cadastro público em Supabase → Authentication → Providers → Email
  ("Allow new users to sign up").

O site é uma SPA (Vite, sem servidor próprio), então a checagem é feita no
navegador. O código JavaScript da página continua baixável por quem souber o
endereço do arquivo — ele não contém segredo nenhum (só a chave pública
`VITE_SUPABASE_PUBLISHABLE_KEY`, que já é pública por natureza) e a geração do
PDF é toda local, então não há dado de cliente exposto.

## Validação

Com Python 3 + `pypdf shapely numpy scipy pillow`, `qpdf` e `poppler-utils`:

```sh
python3 scripts/carteladtf/gerar_logos_teste.py /tmp/fx          # logos de teste (estilo Corel)
# mesma cartela pela referência em Python e pelo código da web
python3 scripts/carteladtf/gerar_cartela_dtf.py /tmp/fx/logo_corel.pdf --largura 7 --qtd 30 -o /tmp/ref.pdf
npx vite-node scripts/carteladtf/gerar_cli.ts -- /tmp/fx/logo_corel.pdf /tmp/web.pdf '{"larguraCm":7,"qtd":30}'
python3 scripts/carteladtf/comparar_posicoes.py /tmp/ref.pdf /tmp/web.pdf
# contração: checagem vetorial exata (shapely) e por raster (poppler, 2400 dpi)
npx vite-node scripts/carteladtf/gerar_cli.ts -- /tmp/fx/logo_corel.pdf /tmp/c.pdf '{"qtd":1,"contrair":true}'
npx vite-node scripts/carteladtf/gerar_cli.ts -- /tmp/fx/logo_corel.pdf /tmp/t.pdf '{"qtd":1,"modo":"textil"}'
python3 scripts/carteladtf/validar_contracao_vetorial.py /tmp/c.pdf 7 0.15
python3 scripts/carteladtf/validar_contracao.py /tmp/t.pdf /tmp/c.pdf 0.15 2400
```

Testes automáticos: `npx vitest run src/lib/cartelaDtf`.

## Decisões

- Rota dentro do app existente (Vite + React Router) em vez de página estática,
  reaproveitando login, visual e deploy do site.
- A pré-visualização é o próprio PDF gerado renderizado pelo pdf.js (o que se vê
  é o que vai para o RIP; o PDF baixado não usa imagem).
- O PDF é salvo sem object streams (`useObjectStreams: false`), mais compatível
  com RIPs antigos.
- O pdf-lib envolve o conteúdo da logo em `q … Q`; fora isso, a camada base e a
  camada TOYO sem contração são byte a byte as da referência em Python.
- Na contração, Form XObjects aninhados são seguidos (com `/Matrix` e clip pela
  `/BBox`); juntas chanfradas (bevel) são montadas à mão, porque o Clipper não
  tem esse tipo de junta.
- Mudar quantidade/espaçamento reaproveita a contração já calculada (ela só
  depende da logo, da largura e da distância).

## Deploy

Igual ao resto do site (Lovable): depois do merge na branch principal, abrir o
projeto no Lovable e clicar em **Share → Publish**. A URL final é
`https://www.giftwebbrindes.com.br/carteladtf` (mesmo domínio do site; a rota
`/carteladtf` é atendida pelo fallback de SPA da hospedagem, como as outras).
