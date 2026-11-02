# F350 · O design system da empresa entra no kit como plugin opcional

Decidido pelo operador: um marketplace só (`ichikawa-kit`), plugins opcionais (Q844); a marca fica no repositório da empresa e o kit só aponta para ele por git-subdir (Q845, Q847); o processo de design mora num só, o `design-system` (Q631 do projeto da empresa).

## Premissas conferidas
- **git-subdir com `ref` e `sha` existe** (referência do marketplace do Claude Code) e foi medido: numa pasta de configuração temporária, `claude plugin install` dos dois instalou `design-system` 0.1.13 e `tema-wicomm` 0.1.0 no commit `2a6e5cdf…`, com o repositório privado, pelo git da máquina.
- **O `kit.json` não liga plugin.** Quem liga é o `enabledPlugins` do `.claude/settings.json` do projeto; o guia diz isso no lugar do "ligar pelo kit.json" do pedido.
- **A guarda e a cobrança da crítica já aceitavam qualquer prefixo** (`nomeCurto` do `guarda-de-design` corta no `:`). A trava `subagente-nao-edita` não: ela só conhece os prefixos do kit (`semPrefixoDoKit`).
- **Três scripts liam `source` como pasta local** e quebrariam com a entrada remota: `subir-versao` (punha a entrada em `pulados`), `atualizar-plugins` (lia o `plugin.json` no clone e lançava erro) e o teste `cli.test` (idem).

## Escopo
1. `marketplace.json`: `design-system` e `tema-wicomm` por git-subdir, `ref: main` e o `sha` fixo, os dois no mesmo commit. Descrição genérica no `design-system`; a marca só na do tema.
2. Detector de nome privado: os dois nomes fixos (o endereço do repositório e o id do plugin de tema) e o texto da entrada do tema no marketplace passam; a palavra solta continua barrada. Com teste.
3. `semPrefixoDoKit` conhece `design-system:`: o designer dele grava só na pasta de revisões, com a mesma cerca e o log `liberado-por-papel`.
4. `subir-versao` pula a entrada remota; `atualizar-plugins` a lista como origem remota, sem `plugin update`.
5. `skills-por-etapa.json`: as skills de design do `design-system` na etapa `design`, ao lado das do `kit-design`.
6. README e guia: os dois plugins, como ligar o tema só no projeto interno, que trocar as cores é trocar o tema, como subir o `sha`.

## Fora do escopo
- Tirar o `kit-design`: a base do `design-system` ainda traz a marca até a fatia 4 do projeto da empresa.
- `papeis-e-modelos`, `protocolo.md`, `dona.md` e `skills-de-fora.json` (abertos no F348) e o `kit doutor` (F347): citam `kit-design:` e ficam para depois do merge deles.

## Pronto quando
Os testes afetados verdes, `claude plugin validate .` passa, e o validador não acha nada que afete correção.
