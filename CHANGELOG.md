# Mudanças do design system Wicomm

Uma entrada por versão da base (`versao` no frontmatter de `plugins/wicomm/base/*.md`), da mais nova para a mais velha. Cada entrada diz **o que muda** para quem usa o sistema e **o que migrar** num projeto que já o usa. A vitrine (`/mudancas/`) lê este arquivo no build, e o teste do ateliê reprova versão da base sem entrada aqui.

Formato de cada entrada: `## <versão> · <data, DD/MM/AAAA>`, uma linha `Camadas:` e as seções `### O que muda` e `### Migração`.

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
