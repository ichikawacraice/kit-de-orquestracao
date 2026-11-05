# Mudanças do design system

Uma entrada por versão da base (`versao` no frontmatter de `plugins/design-system/base/*.md`), da mais nova para a mais velha. Cada entrada diz **o que muda** para quem usa o sistema e **o que migrar** num projeto que já o usa. A vitrine (`/mudancas/`) lê este arquivo no build, e o teste do ateliê reprova versão da base sem entrada aqui.

Formato de cada entrada: `## <versão> · <data, DD/MM/AAAA>`, uma linha `Camadas:` e as seções `### O que muda` e `### Migração`.

## 0.25.0 · 05/11/2026

Camadas: base, registro

### O que muda
- **O filtro da Lista lembrado no navegador** (CONV-26): a Lista pode lembrar o recorte que a pessoa escolheu e voltar como ela o deixou. A chave tem versão e dono (a tela, o registro pai quando há, quem vê); grava só no gesto, nunca ao ler; o recorte igual ao padrão e o *Limpar filtros* apagam a chave; busca de texto e data fixa não se gravam; ao ler, cada campo é conferido e o inválido volta ao padrão. A volta não se anuncia, e sem armazenamento o filtro vale só na memória. O filtro no URL vence o lembrado, sem ler nem gravar a chave.
- **A peça `filtro-lembrado`** (lib): `useFiltroLembrado` com o esquema da tela e o `doUrl` para o filtro que veio no URL (`umaDas`, `algumasDas`, `verdadeiroOuFalso`), mais as funções puras (`chaveDoFiltro`, `lerFiltros`, `gravarFiltros`, `apagarFiltros`, `sanearFiltros`, `igualAoPadrao`). A chave é `wicomm-filtros:<app>:<tela>:v<versão>:<quem vê>[:<registro>]`.

### Migração
- Nada a migrar: a regra vale para a Lista que passar a lembrar o filtro.
- Para adotar: `npx shadcn add <registro>/filtro-lembrado.json`, declare o padrão e o esquema da tela, mostre a região em *carregando* enquanto `lido` for falso ligue *Limpar filtros* a `limpar` e passe em `doUrl` o filtro que veio no URL.
- Quem já grava o filtro com chave própria troca pela do `chaveDoFiltro`; a chave velha deixa de ser lida (a pessoa refaz o recorte uma vez).

## 0.24.0 · 05/11/2026

Camadas: base, registro

### O que muda
- **A espera tem a forma do que vai chegar** (ARQ-01): a regra que era só da Mesa com abas vale para toda tela com mais de uma vista. A lista corrida espera em linhas (`EsperaDaLista`), a lista agrupada em grupos (`EsperaDosGrupos`, nova, na `linha-do-grupo`) e o quadro em colunas (`EsperaDoQuadro`); a troca de vista troca a espera junto. A `EsperaDosGrupos` usa o degrau, o ar, o recuo e o vão da `LinhaDoGrupo` (o `0` é grupo fechado), e a `alturaDaLinha` é a da linha com o conteúdo real, para a lista não pular quando chega.
- **A lista agrupada por período** (PECA-01): uma `LinhaDoGrupo` por período, na ordem do tempo, com a quantidade com unidade (*3 entregas*); o período vazio fica no lugar e diz a causa, e os vazios em sequência viram um grupo só.
- **A `LinhaDoGrupo` conta sem fração:** a `contagem` aceita a quantidade com a unidade (`{ total, unidade: { um, varios } }`), sem trilha (com `progresso`, guarda o lugar dela), o número numa caixa fixa para a coluna não dançar. O grupo vazio diz a causa (`semLinhas`) também sem `contagem`; a causa longa trunca, com a frase inteira no `title`, e não passa por cima do nome.
- **O `IntervaloDeCampos`** (peça nova): o intervalo de dois valores (de, até), num `fieldset` com a legenda e um campo por linha, as pontas amarradas no seletor e o erro do lado abaixo do campo; cabe no popover.
- **O `Label` ganha a voz `coluna`**, para o rótulo que se repete (o *De* e o *Até* do intervalo, no instrumento).
- **O `Popover` ganha a `largura`** (`padrao`, `larga`, `conteudo`) e nunca passa da tela; o conteúdo mais largo que ele é cortado, sem rolagem lateral. A `EscolhaNaCelula` abre na largura do conteúdo, sem mudança visual.

### Migração
- `npx shadcn add <registro>/popover.json <registro>/label.json <registro>/linha-do-grupo.json <registro>/escolha-na-celula.json <registro>/intervalo-de-campos.json`.
- Troque o `className="w-72"`, `"w-80"` ou `"w-auto"` do `PopoverContent` pela prop `largura` (`padrao`, `larga`, `conteudo`).
- Troque o intervalo montado à mão (dois campos lado a lado, `fieldset` sem `min-w-0`) pelo `IntervaloDeCampos`.
- Apague o `contagem={{ feitas: 0, total: 0 }}` fingido no grupo vazio e passe `{ total, unidade }` onde a contagem é quantidade.
- Troque a espera da lista agrupada montada à mão pela `EsperaDosGrupos`.
- Atenção: o grupo vazio sem `contagem` passa a mostrar *Sem linhas*; passe a causa em `semLinhas`.

## 0.23.0 · 05/11/2026

Camadas: base, registro

### O que muda
- **Os recortes contados no topo da Lista** (ARQ-05, nova; CASCO-01, ARQ-01, PECA-01): quando o que pede atenção se divide em situações que se sobrepõem (atrasado, sem responsável, parado), o `TopoDaPagina` ganha o slot `resumo`, **abaixo dos filtros**, com uma fileira de recortes contados. A peça recebe os dados (`rotulo`, `recortes`, `valor`, `onTrocar`) e monta a `BarraDeModos` em `modos`. O rótulo visível e o nome do grupo saem da mesma string. É um recorte por vez, e clicar no recorte ativo chama `onTrocar(null)`. Abaixo de `sm`, o rótulo sobe e só a barra rola. A regra diz o que cada número conta: o que os filtros mostram e cai no recorte, pelo mesmo predicado que recorta a lista. Não há total, cartão de indicador, número grande nem gráfico.
- **O gráfico desenha a forma que o dado tem** (PECA-03, nova): contagens que se sobrepõem não viram pizza nem barra empilhada, e tendência só se desenha com o histórico gravado.
- **A vista que deixa itens de fora diz quantos** (EST-06, nova): uma linha da `Faixa` no assunto `escopo`, com a saída para a vista que mostra todos, sem desfazer o recorte.
- A `BarraDeModos` muda só a documentação: `abas` quando as situações repartem o conjunto; `modos` troca o desenho e, dentro do `resumo`, serve aos recortes que se sobrepõem. A EST-04 e o comentário de `numero` passam a escrever o não contado como `‒`, o travessão numérico que a peça já desenhava.

### Migração
- `npx shadcn add <registro>/topo-da-pagina.json` (traz o `seletor-de-vista` junto).
- Troque a fileira de recortes montada à mão no topo (o `span` do rótulo com a `BarraDeModos` ao lado) pelo `resumo` do `TopoDaPagina`: `resumo={{ rotulo, recortes, valor, onTrocar }}`, em que `onTrocar` recebe a chave ou `null`. Apague a alternância local (`k === valor ? null : k`).
- A fileira passa para baixo dos filtros: confira que cada número conta o que os filtros mostram.

## 0.22.0 · 05/11/2026

Camadas: base, registro

### O que muda
- **A prioridade que recorta** (PECA-01, CTRL-03): a `Prioridade` ganha `onAbrir`. Com ele, o carimbo vira botão e aplica o recorte pelo nível, com o mesmo gesto do `ChipQueAbre` (o sublinhado do link, o anel de foco, o alvo de 24px), agora exportado como `GESTO_DO_CARIMBO` do `chip-de-estado`. O nome acessível é a palavra visível: na contagem, quem chama escreve o número e a palavra (*3 altas*).
- **A contagem zerada** (PECA-01, COR-09): `zerada` mostra o zero na forma do nível (as barras ou o alerta), na tinta neutra, sem a cor do nível nem a voz da urgente, e sem gesto: não há recorte para abrir.
- **A cor do nível só dentro do carimbo** (COR-09): a Alta (vermelho) e a voz `ruim` (rosa) são o mesmo vermelho como texto solto e se separam como carimbo, pela tinta e pelo glifo. A Alta segue vermelha; a regra passa a proibir a cor do nível fora do carimbo neutro da `Prioridade`.

### Migração
- `npx shadcn add <registro>/prioridade.json <registro>/chip-de-estado.json`.
- Troque o `button` à mão em volta da `Prioridade` por `onAbrir`.
- Troque `nivel={0}` usado como contagem zero por `nivel={n} zerada`, com o nível que a contagem conta.
- Tire a cor do nível de onde ela estiver fora da `Prioridade` (texto, ponto, filete, legenda).

## 0.21.0 · 04/11/2026

Camadas: base, registro

### O que muda
- **A cor da pessoa em todo monograma** (COR-08, COR-09): o monograma leva a cor da pessoa em todo lugar que a represente (a linha, a pilha, o cartão, a conta, a escolha de pessoas, a conversa), para a mesma pessoa ser reconhecida de relance de uma região à outra. A cor sai do id, nunca do nome, dentro do próprio `Monograma`. O nome fora da conversa segue na tinta de texto; na conversa, o nome do autor leva a mesma cor, pela mesma chave.
- **A chave é obrigatória e anulável:** `Monograma` pede `chave: string | null`, `Pessoa` e `PilhaDePessoas` pedem `id: string | null` nos dados da pessoa, `MenuDaConta` pede `id`, e a conta da `BarraLateral` e da `BarraDoEditor` ganha `id`. Sem id estável, passe `null`: o monograma fica neutro. A chave vazia também dá neutro.
- O `cor` do `Monograma` sai: quem chama passa a chave, nunca a cor. O `corDaPessoa` segue exportado, e ganha a companhia do `corDaChave`.

### Migração
- `npx shadcn add <registro>/monograma.json <registro>/pessoa.json <registro>/menu-da-conta.json <registro>/conversa.json <registro>/barra-do-editor.json <registro>/casco.json <registro>/editor.json` (o `casco` traz a `BarraLateral` e o `editor` traz o `EditorDeDocumento`, os dois com o `id` novo na conta).
- Em cada lugar que o compilador apontar, passe o id da pessoa ou `null`; troque `cor={corDaPessoa(id)}` por `chave={id}`.
- Apague a cópia local da cor da pessoa, se houver.
- Tire o `className` com a cor da pessoa de cima do `Monograma`: a tinta da chave vem por último e vence; o `className` fica para o layout.

## 0.20.3 · 04/11/2026

Camadas: base, tokens, registro

### O que muda
- **Um sublinhado só para os links** (CTRL-03, MARCA-02). O `@wicomm/tokens` 0.1.3 traz dois utilitários: `sublinhado-de-link` (linha cheia a 50% da tinta, a 2,5px do texto, que fecha no hover) e `sublinhado-de-ajuda` (pontilhado a 35%, que não fecha). A cor sai da tinta de quem os usa, então o link no balão da marca acompanha o balão. As peças que copiavam o sublinhado com valores diferentes passam a usá-los: o link do `button`, o link da `conversa`, o link da `mesa`, o carimbo que abre do `chip-de-estado`, o hover da `trilha` (`hover:sublinhado-de-link`: o sublinhado só aparece no hover, já cheio) e a ajuda do `prazo` (`sublinhado-de-ajuda`).
- O link da `mesa` sobe de 35% para 50%, e o carimbo que abre deixa o pontilhado a 40% pela linha cheia a 50%: o pontilhado é só da ajuda no texto.

### Migração
- Atualize o `@wicomm/tokens` para 0.1.3 (ou `npx shadcn add <registro>/estilo.json`, que completa o `globals.css` com os dois utilitários), e depois `npx shadcn add <registro>/button.json <registro>/conversa.json <registro>/chip-de-estado.json <registro>/trilha.json <registro>/prazo.json <registro>/mesa.json`.
- No código do projeto, troque o sublinhado escrito à mão (`underline decoration-…/50 underline-offset-… hover:decoration-current`) por `sublinhado-de-link`, e o pontilhado da ajuda por `sublinhado-de-ajuda`.

## 0.20.2 · 04/11/2026

Camadas: base, registro

### O que muda
- **O link do botão em linha cheia a 50%** (CTRL-03): a regra dizia sublinhado pontilhado e o código desenhava linha cheia a 35%; agora as duas dizem linha cheia a 50% da tinta, que fecha no hover, como o link da conversa. O pontilhado fica só para a ajuda no texto.

### Migração
- `npx shadcn add <registro>/button.json` traz o link a 50%; quem copiou o `decoration-foreground/35` à mão troca por `/50`.

## 0.20.1 · 04/11/2026

Camadas: base, registro

### O que muda
- **O link clicável na conversa.** A `conversa` ganha `TextoComLinks`, o corpo do balão com os links `http(s)` clicáveis em nova aba, montados como `<a>` (nunca HTML cru: o corpo vem de quem escreveu); `javascript:`, `www.` sem esquema e afins seguem texto; a pontuação e as reticências do fim, as aspas (retas ou curvas) e o parêntese, o colchete ou a chave que envolvem o link ficam com a frase; a barra invertida encerra o link, para ele ir aonde a tela mostra; e o esquema grudado numa palavra não abre link. O link é tinta com sublinhado a 50%, o anel fecha em cada linha da URL quebrada e o respiro do anel tem a cor do balão. A linha *Conversa entre pessoas* da PECA-01 passa a citá-lo.
- A lib nova `links-no-texto` (`trechosComLinks`) vem junto com a `conversa`.

### Migração
- `npx shadcn add <registro>/conversa.json`. No balão, troque `{corpo}` por `<TextoComLinks texto={corpo} />`.

## 0.20.0 · 04/11/2026

Camadas: base, registro

### O que muda
- **A peça nova `conversa`: a conversa entre pessoas em balões.** `Conversa` (a lista, com o `rotulo` de quem chama), `BalaoDaConversa` (o meu à direita na tinta da marca, o do outro à esquerda no `muted`; `rounded-xl` e, no primeiro do grupo, o canto de quem fala menos redondo; a frase inteira escondida para o leitor de tela; a hora num `<time>` com o lugar reservado; o fade só no que chegou), `AutorDaConversa` (o nome e o selo do primeiro balão do outro lado) e `DiaDaConversa`. A PECA-01 ganha a linha *Conversa entre pessoas*.
- **A cor da pessoa, só na conversa.** A COR-09 ganha a segunda exceção: 8 famílias sem dono (lime, teal, cyan, sky, blue, indigo, purple, fuchsia — nenhuma voz, nem o vermelho e o laranja da prioridade), escolhidas pelo id da pessoa (`corDaPessoa(id)`) e declaradas no `Monograma` (`NOME_DA_PESSOA`, `MONOGRAMA_DA_PESSOA`). Pinta só o monograma (fundo opaco) e o nome de quem fala; nunca o balão nem o cartão. O `sky` é dividido com o nível baixo da prioridade, declarado na regra; a COR-08 passa a listar a cor da pessoa entre as exceções. O *Não use* da linha *A pessoa numa linha* passa a dizer "cor por pessoa fora da conversa".
- `Monograma` ganha a prop `cor`; `DadosDaPessoa` ganha `cor`, que a `Pessoa` e a `PilhaDePessoas` passam ao monograma. Sem `cor`, nada muda.
- `PilhaDePessoas` ganha `decorativa`: quando a frase ao lado já diz os nomes, a pilha sai do leitor de tela e do Tab (`aria-hidden`, sem alvo e sem dica).

### Migração
- `npx shadcn add <registro>/conversa.json <registro>/monograma.json <registro>/pessoa.json`.
- Quem tinha a conversa em balões como peça local: troque pela `conversa` e passe a cor da pessoa por `corDaPessoa(id)` — a chave é o id, não o nome. Quem pintava o monograma por `className`: troque pela prop `cor`.

## 0.19.1 · 04/11/2026

Camadas: base, registro

### O que muda
- **O `DialogLateral` pode fechar ao clicar fora.** Com `fechaAoClicarFora`, o clique fora da coluna a fecha; o foco que sai não fecha, e seguram a coluna o clique num elemento com `data-mantem-o-painel` (o cartão ou a linha que a abre), num cartão do quadro, em outro diálogo, menu, lista ou popover, num aviso, e o rascunho digitado num campo de texto dela. Sem a opção, nada muda: clicar fora continua sem fechar. Um `onInteractOutside` passado à peça passa a ser composto com o dela (antes, substituía): se ele chamar `preventDefault`, a coluna fica. A linha *Coluna lateral* da PECA-01 diz a opção.
- **A coluna longa do quadro leva a tinta até o último cartão.** A `ColunaDoQuadro` cresce com os cartões (`h-max min-h-full`): o cabeçalho `sticky` e a tinta do alvo de soltar vão até o fim da coluna que passa da altura do quadro, e a coluna curta ainda enche a altura.

### Migração
- Quem fechava a coluna lateral ao clicar fora com um `onInteractOutside` à mão troca pelo `fechaAoClicarFora` e marca com `data-mantem-o-painel` o que abre a coluna. Quem reinstala `dialog` e `quadro` do registro recebe as peças novas; fora isso, nada quebra.

## 0.19.0 · 04/11/2026

Camadas: base, registro

### O que muda
- **A prioridade ganha cor por nível.** O nível baixo, o médio e o alto pintam o glifo de barras e a palavra do carimbo neutro com a cor declarada do nível (azul, laranja e vermelho: nenhuma família de voz); a tinta do carimbo continua neutra, e a urgente continua na voz de espera. A COR-09 passa a listar o nível da prioridade como cor de identidade declarada, num lugar só e com o contraste de texto medido; a COR-08 a registra como a exceção do glifo com matiz; a COR-03 diz que cor de identidade não é régua de estado; a linha *Prioridade* da PECA-01 troca o "uma matiz por nível" do *Não use* pela tinta do carimbo por nível.
- `prioridade` exporta `COR_DO_NIVEL`, o mapa da cor do nível (fora do idioma de cor: não é voz).
- O quadro deixa de encaixar a coluna ao rolar no celular (`snap-x snap-mandatory`): o encaixe brigava com o arrastar, e o quadro rolava sozinho durante o arrasto.
- O logotipo ganha o símbolo oficial (o monograma recolhido da barra lateral), com o negativo para o tema escuro derivado do oficial por script; a MARCA-04 passa a aceitar esse negativo.

### Migração
- `npx shadcn add <registro>/prioridade.json <registro>/quadro.json <registro>/logotipo.json`.
- Quem pintava o nível da prioridade à mão: troque pela peça.

## 0.18.0 · 04/11/2026

Camadas: base

### O que muda
- **MARCA-04 ganha a exceção do arquivo oficial da marca.** O logotipo que a dona da marca publica é a fonte quando mora no tema com a origem declarada (`logotipo.imagem.origem` do `tema.json`): entra como veio, sem redesenho pelos tokens, e o script só o leva para onde é usado, conferindo byte a byte. Trocar a cor da marca obriga a trocar o arquivo oficial no mesmo PR. O resto da regra não muda: favicon e qualquer outro raster com a cor da marca continuam saindo dos tokens por script.

### Migração
- Projeto com o logotipo oficial em PNG: guarde-o no tema com a `origem` declarada e deixe o script copiá-lo e conferi-lo. Logotipo redesenhado à mão a partir do oficial: troque-o pelo arquivo oficial.
- Quem não usa raster da marca não precisa mudar nada.

## 0.17.0 · 04/11/2026

Camadas: base, registro

### O que muda
- **O quadro de tarefas ganha peça e medida.** Peças novas no registro: `quadro` (a coluna mora no chão e o cartão é a peça, com sombra e raio de 14px; a bandeja no pé do cartão, cinza em repouso e tingida pela voz quando o item pede algo; a coluna vazia recolhe numa fita; o alvo de soltar na tinta da marca com o tracejado; a recusa com o motivo e *Tentar de novo*), `prioridade` (o carimbo com o glifo de barras e a palavra; só a urgente na voz de espera) e `ponto-da-etapa` (o ponto da etapa com o mapa que o projeto declara). O arrastar continua no app.
- A DESIGN ganha o frontmatter `quadro` (as medidas em instrumento e site), o raio `cartao` de 14px na FORMA-01 (cartão de quadro e de lista; o container de 16 fica para cartão de tela, painel, tabela e diálogo), a voz do título do item de quadro (13/500) na TIPO-02 e, na COR-05, o mapa `TEXTO_SOBRE_A_TINTA` e o mapa de etapas como exceção declarada.
- A ANATOMIA ganha as linhas *Quadro de tarefas* e *Prioridade* na PECA-01, e a região *lista ou quadro* do arquétipo Lista diz que a coluna mora no chão.
- `idioma-de-cor` exporta `TEXTO_SOBRE_A_TINTA`, e o `BADGE_DO_TOM` passa a derivar dele (as classes não mudam). `vazio` ganha `escala="coluna"`.

### Migração
- Quadro feito à mão (coluna em `Painel`, cartão em `BlocoDeTinta`): `npx shadcn add <registro>/quadro.json` e troque a coluna e o cartão pelas peças, mantendo a biblioteca de arrastar do app. O mapa de etapas mora num arquivo só, listado em `guardas.regras["o-carimbo-tem-forma"].excecoes` do `design/<tema>.json`.
- Quem só usa `idioma-de-cor` e `vazio` não precisa mudar nada; o `add` atualiza os dois arquivos.

## 0.16.0 · 03/11/2026

Camadas: base, plugin, tokens, guardas

### O que muda
- **`@wicomm/tokens` e `@wicomm/guardas` saem no npm público**, pelo nome e sob a licença MIT (a cor da marca fica fora dela). Acaba o GitHub Packages da org: sem `.npmrc`, sem token, sem alias `@wicomm-projects/…`, no CI e na Vercel.
- **CONV-25 revogada.** O build de produção na máquina existia só porque a Vercel não tinha o token do registro privado; o deploy volta a ser o da Vercel a cada push. O código fica, marcado *revogada*.
- O plugin: `/design-system:novo` instala os pacotes pelo nome e escreve o `docs/deploy.md` com o deploy da Vercel; `/design-system:padronizar` instala pelo nome; `/design-system:atualizar` sobe pelo nome e troca o projeto que ainda instala pelo GitHub Packages. O guia Começar passa ao plugin `design-system` do marketplace do kit (`ichikawa-kit`), sem conta no GitHub nem token.

### Migração
- Projeto que instalou pelo GitHub Packages: `npm install @wicomm/tokens@latest @wicomm/guardas@latest` (sem o `@latest` o npm mantém o alias), tire as linhas do `npm.pkg.github.com` do `.npmrc` e o `NODE_AUTH_TOKEN`/`packages: read` do CI (`docs/instalar-pacotes.md`, seção *Projeto instalado pelo GitHub Packages*). O `/design-system:atualizar` faz a troca.
- Projeto que faz o build na máquina por causa da CONV-25 pode voltar ao build da Vercel: ligue o repositório ao projeto da Vercel e reescreva o `docs/deploy.md`. Nada quebra se ficar como está.
- A base muda só na CONV-25: o merge de três vias não tem conflito, salvo em projeto que reescreveu essa regra.

## 0.15.0 · 02/11/2026

Camadas: base

### O que muda
- **A base não fala de marca nenhuma** (Q846). As regras não mudam de sentido; o que era da Wicomm passa a ser "do tema" (`temas/<id>/`): a cor da marca, o hover e o gradiente (MARCA-01, MARCA-03), a razão aceita da tinta sobre a marca (`contrasteAceitoSobreAMarca`), a família da fonte (TIPO-01: "a família do tema") e o logotipo da barra lateral. O tema Wicomm continua com os mesmos valores.
- O frontmatter da DESIGN deixa de escrever as cores da marca (`marca`, `primary`, `primary-hover`, `primary-foreground`, `gradiente`, `marca-tinta`, `ring`) e a família da fonte: aponta para o tema. `name` passa a `design-system` nos três arquivos.
- A guarda nova do gate reprova o nome de um tema na base, e o `id` fora do escopo de pacote (`@wicomm/…` fica).

### Migração
- Nada quebra: os tokens, as peças e as guardas são os mesmos. Rode `/design-system:atualizar` para trazer a base nova. Projeto que acrescentou texto às regras de marca ou de tipo resolve o merge de três vias nesses trechos.
- Quem lia as cores da marca no frontmatter da DESIGN lê agora do tema (`design/tema/` no projeto, ou `temas/wicomm/` no repositório do sistema).

## 0.14.1 · 02/11/2026

Camadas: base, registro

### O que muda
- O fechar do `toast` e o `ChipQueAbre` passam a ter alvo de clique de 24px (ACES-03), por um pseudo-elemento que estende o clique sem mudar o desenho; a regra passa a aceitar essa forma.
- A `Faixa` e a pilha dos avisos montam a região `status` vazia desde o primeiro desenho (ACES-05), com `aria-atomic="false"`; a linha e o cartão `ok`/`neutro` entram nela sem `role` próprio, e o `ruim` segue em `alert`. A `Faixa` sem linhas deixa de devolver `null`: fica uma região vazia, fora do fluxo (`sr-only`), sem ocupar o `gap` do pai.

### Migração
- Monte a `Faixa` sempre, com `linhas={[]}` quando não há o que dizer: `{mente && <Faixa …/>}` recria a região no mesmo instante do texto e o leitor de tela não anuncia (ACES-05). Fora isso, nada quebra. Quem reinstala `faixa`, `toast` e `chip-de-estado` do registro recebe as peças novas. Teste de app que procura `role="status"` no cartão do aviso ou na linha da faixa passa a achar a região que os contém.

## 0.14.0 · 02/11/2026

Camadas: base, plugin

### O que muda
- **Acessibilidade vira regra** (CONVENCOES §8): tudo pelo teclado, com o foco que volta a quem abriu (ACES-01); todo controle com nome e nada dito só com cor (ACES-02); alvo de clique de 24×24px ou com folga até o vizinho, o mínimo do nível AA (ACES-03); língua, regiões e títulos (ACES-04); o desfecho que aparece sem mover o foco é anunciado (ACES-05). O contraste, o anel de foco e o escape do movimento continuam na DESIGN.
- **Como o texto da tela se escreve** (ANATOMIA §4): o botão diz o que acontece, com verbo (MSG-07); a confirmação pergunta a ação e diz o que não volta, nunca *Tem certeza?* (MSG-08); o erro diz o que não aconteceu e o que fazer agora (MSG-09).
- O plugin ganha as skills `acessibilidade` (auditoria nível AA presa aos tokens) e `textos-de-interface` (escreve e revisa o texto da tela em PT-BR). O crítico passa a cobrar as regras novas no eixo *aderência*, e a auditoria de projeto, os estados de cada peça sem par e uma seção de acessibilidade. Elas substituem `design:accessibility-review`, `design:ux-copy` e a auditoria do `design:design-system` da Anthropic, que não precisam ficar ligadas.

### Migração
- Nada quebra. Rode `/wicomm:atualizar` para trazer a base nova; na próxima tela, o crítico já cobra as regras novas.
- Projeto com `pedir()` do `useConfirm` sem `confirmar` mostra o botão *Confirmar*: passe o verbo do título (MSG-07).
- O próprio kit tem três pontos a conferir contra as regras novas, marcados nelas: o fechar do `toast` e o `ChipQueAbre` abaixo de 24px (ACES-03), e a `Faixa` e a área dos toasts sem região viva antes do texto (ACES-05). Ficam para uma versão do registro.

## 0.13.0 · 01/11/2026

Camadas: base, registro

### O que muda
- **O `Badge` de marca sai do rosa e abre com o filete da marca** (CTRL-05): tinta neutra do carimbo (`bg-foreground/[0.07]`), texto em `foreground` e um filete de 2×10px no gradiente da marca antes da palavra. A tinta da marca e a do carimbo `ruim` eram o mesmo rosa — no escuro, medidas com a tinta composta, ficavam a ΔE2000 0,75–2,7, abaixo do que o olho separa —, e só a cor da letra distinguia o valor que a Wicomm assina do estado que quebrou.
- O token `--marca-tinta` não muda. O `Badge` neutro e o carimbo de estado não mudam.

### Migração
- `npx shadcn add @wicomm/badge`. Nada muda no uso: a peça desenha a tinta e o filete sozinha. Tela que sobrescrevia a tinta do de marca por `className` revê a escolha.

## 0.12.0 · 01/11/2026

Camadas: base, registro

### O que muda
- **O carimbo de estado neutro abre com um ponto** (CTRL-05). O `ChipDeEstado` e o `ChipQueAbre` com `tom="neutro"` ganham o ponto de 6px na tinta do próprio texto, antes da palavra; o `Badge` nunca tem ponto. Antes, o estado neutro e o valor neutro eram a mesma tinta no mesmo casco, e no topo da página (o estado na linha do título, os valores logo abaixo, CASCO-04) o estado se lia como mais um valor.
- As vozes com matiz não mudam: já se separam pela tinta. O em curso (`emCurso`) também não: o giro ocupa o lugar do ponto.
- O `Prazo` com `forma="chip"` sem voz herda o ponto, porque desenha o `ChipDeEstado` neutro.

### Migração
- `npx shadcn add @wicomm/chip-de-estado`. Nada muda no uso: a peça desenha o ponto sozinha.
- Tela que punha um ícone próprio dentro de um carimbo neutro passa a mostrar ponto e ícone: tire o ícone, ou use a voz que o estado tem.

## 0.11.0 · 01/11/2026

Camadas: base, registro

### O que muda
- **O topo da página ganha a linha dos valores** (CASCO-04, regra nova). O `TopoDaPagina` aceita `valores`: os `Badge` que classificam o objeto (categoria, nível, origem), numa linha própria entre a linha do título e o desfecho, que quebra no estreito. O estado continua na linha do título, com voz; o valor não tem voz e não espreme mais o título — quatro valores no `estado` zeravam o título a 1280px.
- `valores="carregando"`: três esperas com o casco do carimbo, na altura de uma linha de valores (sem salto quando os valores cabem numa linha; no estreito, se eles quebram, a linha cresce ao chegar). Sem `valores`, ou com todos os `Badge` vazios, a linha não existe.
- CASCO-01 e PECA-01 citam a linha nova; a coluna "Não use" da PECA-01 ganha `Badge` no `estado` ou ao lado do título.

### Migração
- `npx shadcn add @wicomm/topo-da-pagina`. Tela sem valores não muda.
- Tela que punha `Badge` no `estado` (ou ao lado do `h1`) passa os valores para `valores`; o `estado` fica só com o `ChipDeEstado`.

## 0.10.0 · 01/11/2026

Camadas: base, tokens, registro

### O que muda
- **A tabela guia a leitura da linha larga** (SUP-03). A `Table` desenha um filete-guia de 1px (`border`) entre linhas vizinhas do mesmo corpo, no meio do ar que a linha já guarda: do x do texto da primeira célula (no grupo, o recuo) até 12px antes do fim. Nenhum depois da última linha, nenhum entre o topo do grupo e a primeira linha, e o filete some na linha acesa (hover e foco) e na de cima. Numa lista de 11 colunas o olho atravessava 850 a 1140px de vazio sem guia.
- `table`: o cabeçalho passa a 40px e fecha numa régua de 1px `border` de ponta a ponta, que gruda com ele; continua sem fundo.
- `linha-do-grupo`: o primeiro grupo guarda 8px (12 no site) da régua do cabeçalho.
- `table`: com coluna `esconderNoCelular`, a tabela passa sozinha a layout fixo abaixo de 640px — no automático a coluna escondida não chegava a largura zero e a tabela transbordava o painel. A célula `medida` não quebra linha.
- Tokens: catraca nova no teste — `border` × `card` entre 1,15 e 1,30:1 nos dois temas (hoje 1,207 e 1,226). Nenhum token muda.
- A SUP-03 troca "nunca filete entre linhas" pela regra estreita: o filete e a régua são da peça; zebra, filete entre grupos, contorno de coluna, fundo no cabeçalho e borda em volta da tabela continuam fora. PECA-01 e o bloco `lista` da DESIGN dizem isso.

### Migração
- `npx shadcn add @wicomm/table @wicomm/linha-do-grupo`. Nada a mudar nas telas: o filete e a régua são da peça.
- Linha escrita à mão na tela (`divide-y` no `tbody`, `border-b` no `tr`, fundo `bg-muted` no `TableHeader`) sai: duplicaria o filete ou a régua.
- Tabela com `esconderNoCelular` sem `table-fixed` muda de distribuição no celular: as colunas sem largura dividem por igual o que sobra. A coluna com conteúdo que não quebra (`Estado`, `Pessoa`, `Prazo`) leva `max-sm:w-*` no `TableHead`.

## 0.9.1 · 01/11/2026

Camadas: base, registro

### O que muda
- **Grupo de linhas fechado não guarda o vão de grupo aberto** (SUP-03). O vão grande (16px; 24 no site) só vem depois de grupo aberto; entre grupos fechados fica o espaço curto (6px; 8), e o ar depois do topo só existe com o grupo aberto. Uma lista toda fechada ficava 44–54% mais alta sem ganho de leitura. O bloco `lista` da DESIGN ganha `vao-entre-fechados` e `recuo-com-identidade`.
- `linha-do-grupo`: o topo mede 48px (56 no site) **no mínimo** e cresce inteiro quando o prazo quebra a legenda no celular. Quando algum grupo da tabela tem `identidade`, o recuo das linhas e o do cabeçalho somam o lugar do ponto (46px), e todo grupo reserva esse lugar: o nome do grupo e o texto das linhas começam no mesmo x.
- `prazo`: a data não quebra linha; só a legenda cede.

### Migração
- `npx shadcn add @wicomm/linha-do-grupo @wicomm/prazo @wicomm/table`. Nada a mudar nas telas: o vão e o recuo continuam da peça. Quem escrevia à mão um vão entre grupos fechados ou o lugar do ponto nos grupos sem identidade, remove.

## 0.9.0 · 01/11/2026

Camadas: base, tokens, registro

### O que muda
- **As listas se leem separadas** (SUP-03). A linha se separa da vizinha só por ar: a célula guarda 6px em cima e embaixo (8px no site) e cresce com o conteúdo — com duas linhas de texto, 48px em vez de espremida em 40. O grupo de linhas fica um degrau acima: topo de 48px (56 no site), nome em 14px/600 (`t-titulo` no site), 16px de vão antes de cada grupo (24 no site) e 4px de ar depois do topo, e as linhas recuam até o nome do grupo. O hover acende as células com o raio do anel de foco. Sem filete e sem zebra.
- `table`: a `densidade` passa a ser da `Table` (`instrumento` ou `site`), e as células e a `LinhaDoGrupo` medem por ela. A tabela vira `border-separate` (o raio do hover precisa).
- Tokens: o degrau escuro (`muted`) vai de `#11141B` a `#0B0E14` — contra o cartão, de 1,057:1 a 1,108:1, o mesmo contraste do claro. Vale para todo degrau no escuro (o `BlocoDeTinta`, o rodapé do diálogo, o carimbo neutro, o canvas do Editor). Catraca nova: o degrau mede ≥ 1,10:1 contra o cartão nos dois temas.
- TIPO-02 diz a voz do nome do grupo de linhas; a DESIGN ganha o bloco `lista` no frontmatter.
- `escolha-na-celula`: no popover, os campos vão dentro de um `<form>` — o Enter grava, o *Cancelar* fecha sem gravar, o `aoSalvar` que devolve `false` deixa aberto e o `motivoParaNaoSalvar` desabilita o *Salvar* e escreve a frase no formulário, ligada ao botão. O `valor` nunca é nulo: sem valor, a célula mostra a leitura vazia da peça (*Sem data*, a pessoa tracejada) com o chevron. A peça repassa o `ref` ao gatilho, e a frase da recusa é configurável (`rotuloDaRecusa`).
- `prazo`: o intervalo de um dia escreve o dia uma vez; `relativo={false}` mostra só a data, sem legenda nem voz (o tipo recusa o `tom` junto); `emLinha` põe a legenda ao lado da data.
- `linha-do-grupo`: a contagem e a trilha encostam no fim da linha do grupo, em lugar fixo — as barras de uma coluna começam no mesmo x. No estreito o nome guarda 5rem e o fim cede pela largura que sobra (sai a trilha, depois a medida, por último a contagem). A célula sob uma coluna que some no celular (`{ conteudo, esconderNoCelular: true }`) esvazia sem transbordar.
- `table`: `TableHead` e `TableCell` ganham `esconderNoCelular` — a coluna fica com largura zero abaixo de 640px, sem que as outras troquem de coluna.
- PECA-01 diz isso nas linhas do grupo de linhas, do prazo e da escolha na célula.

### Migração
- `npx shadcn add @wicomm/estilo @wicomm/table @wicomm/escolha-na-celula @wicomm/prazo @wicomm/linha-do-grupo` (o `estilo` traz o degrau escuro novo).
- Lista que passava `densidade` a cada `LinhaDoGrupo` passa a declará-la uma vez na `Table` (a da `LinhaDoGrupo` segue valendo como sobreposição). Linha que se espremia em altura fixa (`h-10` à mão na célula) perde a classe: a célula já guarda o ar. Recuo escrito à mão na primeira célula das linhas de um grupo sai: a peça recua. Hover pintado à mão no `tr` (`hover:bg-…`) passa às células ou sai. Com `border-separate`, borda escrita no `tr` (o `border-b` do shadcn) deixa de pintar — e a SUP-03 já não a queria.
- `EscolhaNaCelula` com `valor` que pode ser nulo passa a mandar a leitura vazia da peça (`<Prazo periodo={null} />`, `<Pessoa pessoa={null} />`); `Prazo` com `relativo={false}` deixa de passar `tom`; botão dentro dos campos do popover sem `type="button"` (um *Hoje*, um *Limpar*) passa a gravar, porque os campos agora estão num `<form>` — declare o `type`; o aberto do gatilho se lê em `aria-expanded` (quem estilizava `data-[state=open]` por fora troca).
- Superfície fixa por cima da tabela (rodapé `sticky`, barra de ações) declara `z-10` ou mais, como o `TableHeader`: a célula editável sobe um degrau (`z-[1]`) para ficar por cima do link da linha.
- Contornos que a tela fez por falta disso saem: formulário que se protegia da inversão só por `min`/`max`, `span` em volta da peça para a `Ajuda`, data passada à mão quando início e fim são iguais, prazo em texto para não mostrar a legenda, as classes `max-sm:[&>tr:first-child>td]:hidden` e `max-sm:[&_[data-slot=trilha-do-progresso]]:hidden` no grupo, e a coluna escondida à mão (`w-0 p-0`), que vira `esconderNoCelular`.

## 0.8.0 · 01/11/2026

Camadas: base, registro

### O que muda
- Quatro peças de lista no registro, pedidas pelo piloto WiControl: o grupo de linhas da tabela (`linha-do-grupo`), a pessoa e a pilha de pessoas (`pessoa`), o prazo com a legenda relativa (`prazo`) e a troca de valor na própria célula (`escolha-na-celula`).
- O `Monograma` sai do `menu-da-conta` para um item próprio (`monograma`), com o círculo tracejado da pessoa que não há (`MonogramaAusente`).
- PECA-01 ganha as linhas do grupo de linhas, da pessoa, do prazo e da escolha na célula.

### Migração
- Nenhuma tela existente muda; o `menu-da-conta` segue exportando `Monograma` e `iniciais`.
- Projeto com linha de grupo, pilha de monogramas, célula de prazo ou escolha na célula feitas à mão troca pela peça do registro: `npx shadcn add @wicomm/linha-do-grupo @wicomm/pessoa @wicomm/prazo @wicomm/escolha-na-celula`.

## 0.7.0 · 31/10/2026

Camadas: base, tokens, registro

### O que muda
- Seis peças novas no registro, pedidas pelo piloto WiControl: a caixa de marcar (`checkbox`, com a `OpcaoDeMarcar`), o progresso de etapa (`progress`), o número contra teto (`medidor`), o valor rotulado (`badge`), a troca de contexto (`carregando-por-cima`) e a faixa (`faixa`).
- A confirmação aceita `onConfirmar`: a ação roda com o diálogo aberto, o botão fica em curso sem perder o foco, e a falha aparece no próprio diálogo, na frase de quem usa.
- A `Faixa` deixa de ser só do Editor: vale para toda tela, uma por tela, abaixo do topo. O véu de carregamento cobre a região que mente, nunca o casco, e espera 120ms também com movimento reduzido.
- PECA-01 diz qual peça usar no lugar de `Sheet`, `Tabs`, `HoverCard`, `ScrollArea` e `Command`. O token `rounded-marcacao` (5px) entra nos tokens.
- O `link-do-app`, o casco e o Editor passam no eslint do template Vite: o `componente` do `ProvedorDeLink` é tipado (`ComponenteDeLink`), sem `any`.

### Migração
- Nenhuma tela existente muda. `OpcoesDaConfirmacao` passou de `interface` a união de tipos: código que a estende com `interface … extends` passa a usar `type … = OpcoesDaConfirmacao & {…}`. Confirmação feita à mão que roda a ação com o diálogo aberto passa a usar `useConfirm` com `onConfirmar` e `rotuloRodando`; o texto do erro sai do `descreverErro`, nunca da mensagem técnica.
- Quem passava ao `ProvedorDeLink` um link de props próprias (o `Link` do react-router, que pede `to`) o embrulha uma vez, fora de componente, com as props do `<a>`.
- Projeto com `Faixa`, `Badge`, `Medidor` ou caixa de marcar feitos à mão troca pela peça do registro.

## 0.6.0 · 31/10/2026

Camadas: base, registro, guardas

### O que muda
- Regra nova **SUP-07** (superfície): o que flutua cabe na tela — troca de lado quando falta espaço, para a 8px da borda, limita a altura ao visível e rola por dentro; a troca de lado nunca se desliga.
- O registro: menu, submenu, seletor e popover ganham a folga de 8px da borda (a dica já tinha); o popover e a dica passam a limitar a altura ao visível e a rolar por dentro; as peças flutuantes deixam de aceitar `avoidCollisions`.
- Guarda nova **`o-que-flutua-cabe-na-tela`**: reprova `avoidCollisions={false}` e o conteúdo flutuante do Radix montado direto sem limite de altura.

### Migração
- Atualizar as peças `menu`, `select`, `popover` e `tooltip` do registro (`npx shadcn add` de novo).
- Projeto com base de catraca: a guarda nova acusa como violação nova o que já existia; conserte (troque o primitivo pela peça do kit, ou acrescente `max-h-(--radix-…-available-height) overflow-y-auto`) ou registre a dívida na base num PR revisado.

## 0.5.0 · 31/10/2026

Camadas: base, plugin

### O que muda
- Regra nova **CONV-25** (seção 7, distribuição e instalação): projeto com pacote privado `@wicomm` faz o build de produção na máquina (`vercel build --prod && vercel deploy --prebuilt --prod`), e a Vercel não recebe o token dos pacotes.
- O `/wicomm:novo` passa a gerar o `docs/deploy.md` do projeto novo com esse fluxo.

### Migração
- Projeto que já usa pacote privado: tirar `NPM_RC`/`NPM_TOKEN`/`NODE_AUTH_TOKEN` da Vercel, publicar por `vercel build --prod && vercel deploy --prebuilt --prod` e ter um `docs/deploy.md` que diga isso (modelo: `plugins/wicomm/skills/novo-projeto/modelos/deploy.md`).

## 0.4.0 · 30/10/2026

Camadas: base, registro, guardas

### O que muda
- O arquétipo **Editor** ganhou bloco no registro: a barra do Editor (a volta obrigatória e o nome como título da página), as colunas do Editor (a estrutura recolhe a um trilho; a regra dos 60% é medida pela peça) e as peças `Dobra` e `Popover`.
- CASCO-01 e CASCO-03 dizem como o Editor sai do casco e volta; TIPO-02 e TIPO-04 dão ao título da barra do Editor a voz `t-titulo`.
- PECA-01 e PECA-02 listam as peças novas e de onde a peça nova parte.

### Migração
- Nenhuma tela existente muda. Tela de edição feita à mão passa a montar a `BarraDoEditor` e as `ColunasDoEditor`.

## 0.3.0 · 30/10/2026

Camadas: base, registro, guardas

### O que muda
- Os blocos de tela entram no registro: o **casco** e os arquétipos **Lista**, **Mesa** e **Entrada**, cada um com a página de exemplo.
- Catorze peças novas: carimbo de estado, ponto de estado, medalhão do ícone, trilha, vazio, tela de erro, topo da página, seletor de vista, tabela, ficha, trilho do percurso, logotipo, menus do tema e da conta, e o link do app.
- CASCO-01 separa o cabeçalho do casco do topo da página; LAY-01 fixa o topo parado; o Confere de CONV-04, CONV-10, CONV-11, CTRL-09 e MSG-05 passa a citar as guardas.

### Migração
- Tela dentro do casco passa a usar `PaginaDoApp` e `TopoDaPagina`: é o topo quem escreve o único `h1`.
- O tema e a barra recolhida são lidos antes do primeiro desenho: ponha `ScriptsAntesDoDesenho` no layout raiz.

## 0.2.0 · 30/10/2026

Camadas: base, plugin

### O que muda
- A base fala só da Wicomm: a origem de cada regra sai dos arquivos da base e vai para o rastreio do repositório.
- O sistema é **só Tailwind v4**: projeto em v3 migra antes de receber os tokens e as peças.
- O processo de design (designer, crítico com nota e a guarda que cobra a crítica) passa a morar no plugin `wicomm`.

### Migração
- Projeto em Tailwind v3: rode a migração para v4 antes de instalar `@wicomm/tokens`.

## 0.1.0 · 30/10/2026

Camadas: base, tokens

### O que muda
- A primeira versão da base: a direção de design, a anatomia e as convenções, cada regra com Regra, Por quê e Confere.
- O pacote `@wicomm/tokens`: uma fonte só, gerada para o tema do Tailwind v4 e para variáveis CSS.

### Migração
- Primeira versão: não há o que migrar.
