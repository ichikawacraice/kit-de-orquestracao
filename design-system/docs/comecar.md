# Começar com o design system Wicomm

Para quem nunca usou o sistema: o que ele é, o que instalar, os cinco comandos, como uma tela nasce e o que ligar ou desligar no Claude Code. Leva uns 10 minutos do zero até o primeiro comando.

## O que é, em uma frase

Um plugin do Claude Code (`design-system`, com o tema `tema-wicomm`) que leva a cada app React da Wicomm a **norma** de design (cores, tipografia, anatomia das telas, convenções de código), um **processo** que decide cada tela antes do código e a julga depois, e **guardas** que reprovam no CI o que foge da norma. Junto vêm os **tokens** (o tema em CSS para o Tailwind v4, no npm), as **peças** prontas (registro shadcn `@wicomm`) e o **ateliê**, a vitrine viva de tudo isso.

**Serve para:** apps React próprios da Wicomm (Next ou Vite), sempre com a marca Wicomm.
**Não serve para:** lojas FastStore ou Wake (levam a marca do cliente e outro kit), nem projeto sem React.

## Requisitos

- **Claude Code** (app desktop ou CLI) e **Node 22**.
- **Tailwind v4** no app. Projeto em Tailwind v3 migra antes; o `/design-system:novo` e o `/design-system:padronizar` dizem como.
- Para ver o ateliê e trazer peças do registro: a **senha do ateliê** e o segredo do registro (`WICOMM_REGISTRO_BYPASS`), pedidos a quem administra o ateliê, por mensagem direta ([publicar o ateliê](publicar-atelie.md)).

Não precisa de conta no GitHub nem de token: o plugin vem de um repositório público e os pacotes, do npm público.

## Instalar (uma vez por máquina)

Cole no terminal, na ordem:

```bash
claude plugin marketplace add ichikawacraice/kit-de-orquestracao
```

```bash
claude plugin install design-system@ichikawa-kit
```

```bash
echo 'export WICOMM_REGISTRO_BYPASS=<o segredo do registro>' >> ~/.zshrc && source ~/.zshrc
```

O que cada linha faz:
1. Acrescenta o marketplace do kit (`ichikawa-kit`), onde o `design-system` e o `tema-wicomm` moram.
2. Instala o plugin `design-system` na sua conta do Claude Code, valendo em todo projeto. O `tema-wicomm` entra por projeto: o `/design-system:novo` o liga no `.claude/settings.json` do app, e o Claude Code oferece a instalação na primeira vez que você abre o projeto.
3. Põe o segredo do registro no ambiente de todo terminal novo, para o `shadcn` trazer as peças. Troque `<o segredo do registro>` pelo valor que recebeu; ele fica só na sua máquina. Usa bash? Troque `~/.zshrc` por `~/.bashrc`.

Reinicie o Claude Code. O aviso *"4 userConfig options not yet set"* pode ficar: as quatro opções têm padrão.

**Conferir:** `claude plugin list` mostra `design-system@ichikawa-kit` com `✔ enabled`. Numa sessão, `/design-system:estado` responde.

> Já usa o plugin antigo, `wicomm`? Não ligue os dois: num projeto que o tem, rode `/design-system:migrar`, que desliga o `wicomm` e liga o `design-system` e o tema.

> Os pacotes (`@wicomm/tokens` e `@wicomm/guardas`) entram por projeto, não por máquina, e o `/design-system:novo` instala para você (`npm install @wicomm/tokens @wicomm/guardas`). O detalhe, e a troca de quem instalou pelo GitHub Packages, está em [instalar os pacotes](instalar-pacotes.md).

## Os cinco comandos

| Comando | Quando usar | O que você recebe |
|---|---|---|
| `/design-system:novo` | Vai começar um app React novo, do zero ou com a pasta recém-criada. | Três perguntas (quem usa e para quê; em que tela e com que frequência; qual é a primeira tela), a base estampada em `design/`, o `design/design-system.json`, tokens, peças e casco instalados, e a primeira tela decidida pelo designer e julgada pelo crítico. |
| `/design-system:auditar` | O app já existe e você quer saber quanto ele foge do padrão. Não muda nada no projeto. | `docs/design/auditoria-AAAA-MM-DD.md`: deriva por categoria com arquivo e linha, a anatomia de cada rota, o mapa das peças do projeto para as do registro e uma nota por tela. |
| `/design-system:padronizar` | Depois da auditoria, para trazer o app ao sistema sem parar o produto. | Um plano em fatias (entrada no sistema, Tailwind v4, tokens com ponte, primitivas, casco, telas, remover a ponte), cada uma com o critério de pronto. Só escreve o plano. |
| `/design-system:atualizar` | Saiu versão nova do sistema (veja a página Mudanças do ateliê) ou o `estado` disse que o projeto está atrasado. | O projeto sobe de versão: a base por merge de três vias (o que você mudou no projeto fica), tokens, guardas e peças. Conflito vem a você com recomendação. |
| `/design-system:estado` | A qualquer hora: "onde este projeto está?" | Versão do sistema no projeto, deriva da base e das peças, a média das últimas críticas e o próximo passo. |

Exemplos de pedido que caem no comando certo sem digitar a barra: *"quero começar um painel novo da Wicomm"* (novo), *"quanto este app foge do padrão?"* (auditar), *"monta o plano para padronizar"* (padronizar).

## Como uma tela nasce

Toda tela nova ou que muda de visual passa por quatro passos. Você só pede a tela; o Claude Code conduz.

1. **Designer** (subagente `design-system:designer`) escreve a revisão de arquitetura: o arquétipo da tela, o que vai onde, que peças usar. Ele não escreve código. A revisão fica em `docs/design/revisoes/`.
2. **Código**, feito como a revisão aprovou, com as peças do kit e os tokens.
3. **Crítico** (subagente `design-system:critico-de-ui`, em contexto separado de quem desenhou) dá a nota: seis eixos de 0 a 5 (sete nas telas de densidade *site*, as de quem usa de vez em quando), até 5 problemas, cada um com onde e a correção. **24/30 sem ressalva alta libera** (28/35 em *site*). Abaixo do teto, ou com ressalva alta mesmo acima dele, volta para conserto. Depois de duas recríticas, o que ainda ficar abaixo vai a quem pediu a crítica, para decidir.
4. **Guarda.** No fim do turno que mudou o visual, a guarda cobra a crítica se ela não aconteceu. Na escrita de tela, avisa de valor solto (`#hex`, `text-[15px]`, `duration-200`, paleta crua). No CI, as guardas de `@wicomm/guardas` (`npm test`) reprovam o que foge da norma.

A nota de cada tela fica gravada no fim da revisão, e o `/design-system:estado` mostra a média.

## O que ligar e o que desligar

### O plugin `design-system`

| O quê | Padrão | Como mudar |
|---|---|---|
| O plugin inteiro | ligado | `claude plugin disable design-system@ichikawa-kit` (ou `enable`). Num projeto que não é da Wicomm, desligue só lá: `claude plugin disable design-system@ichikawa-kit --scope project`. |
| A guarda (lembra o designer, impede o designer de escrever tela, cobra a crítica) | ligada | Só para você: `/plugin configure design-system@ichikawa-kit` → `guarda`. Para o time: `"guarda": false` no `design/design-system.json` do projeto. Desligar a guarda também cala o aviso de valor solto. Para parar só a cobrança da crítica, use a linha de baixo. |
| A cobrança da crítica no fim do turno | ligada | Só para você: opção `cobrar_critica`. Para o time: `"cobrarCritica": false` no `design/design-system.json`. |
| O aviso de valor solto | ligado | `"valorSolto": false` no `design/design-system.json`, ou `{ "ignorar": ["<glob>"] }` para uma exceção com motivo. |
| Uma guarda do CI | todas ligadas | Na chave `guardas` do `design/design-system.json`, desligada **com o motivo** (ex.: o app ainda não tem formulário). Volta quando o assunto chegar. |

O `design/design-system.json` do projeto vence a opção da sua conta: o que o time decidiu vale para todos. A tabela completa das chaves está no [README do plugin](../plugins/design-system/README.md#a-configuração-do-projeto-designdesign-systemjson). Opção mudada vale depois de reiniciar o Claude Code.

<a id="plugins-que-conflitam"></a>
### Outros plugins

**Os plugins da Anthropic** (`design`, `engineering`, `data`, `cowork-plugin-management`) chegam pela organização, em *Personalizar → Plugins* no app. O `design-system` não depende de nenhum e funciona com eles ligados. Num app da Wicomm, use a peça do `design-system` no lugar da do plugin `design` da Anthropic: ela segue a base e fala PT-BR. A troca, peça por peça, está no [README do plugin](../plugins/design-system/README.md#com-o-plugin-design-da-anthropic-ligado). Com o kit de orquestração instalado e o `design-system` instalado pelo CLI e ligado (o plugin que só a conta do app traz não entra), a troca é automática: as skills `design:accessibility-review`, `design:ux-copy` e `design:design-system` são recusadas e a recusa aponta a do `design-system` (o plugin declara isso no `substitutas.json`). Sem o kit, nada as recusa: desligue o plugin `design` da Anthropic à mão (*Personalizar → Plugins*). A crítica que a guarda aceita é a de um subagente `critico-de-ui`, e a skill `design:design-critique` não conta.

**O kit de orquestração** é opcional: o `design-system` mora no marketplace dele, mas não precisa dos outros plugins do kit, que servem para tocar várias sessões do Claude Code no mesmo projeto. Quem usa o kit:
- O plugin de design antigo do kit, `kit-design`, é o antecessor do `design-system`. Não ligue os dois no mesmo projeto: o `kit atualizar` faz a troca. O que desligar e onde está no [guia de conflitos do kit](https://github.com/ichikawacraice/kit-de-orquestracao/blob/main/docs/guia/conflitos.md).
- Declare o designer do `design-system` (`design-system:designer`) em `design.designers` do `.claude/kit.json`; as instruções estão no guia do kit.
- O kit pede o plugin `superpowers`. O `design-system` não pede.

## Perguntas comuns

**O projeto instalou os pacotes como `@wicomm-projects/…` (GitHub Packages).**\
Era o registro antigo, privado; versão nova só sai no npm público. `npm install @wicomm/tokens @wicomm/guardas` troca o alias, e o `.npmrc` e o token do CI saem: o passo a passo está em [instalar os pacotes](instalar-pacotes.md#vindo-do-github-packages). O `/design-system:atualizar` faz isso junto com a subida de versão.

**O `shadcn add @wicomm/…` volta 401.**\
Falta o segredo do registro no ambiente (`WICOMM_REGISTRO_BYPASS`). O `/design-system:novo` monta o `components.json` com ele lido do ambiente, nunca escrito no git.

**A guarda pediu a crítica e eu só mudei um texto.**\
Ela cobra uma vez por turno quando um arquivo de tela muda. Peça o crítico (*"roda o crítico"*) ou, se a mudança não é visual, diga isso ao Claude: ele registra e segue.

**Projeto em Tailwind v3?**\
Migre antes (`npx @tailwindcss/upgrade`). O sistema é só Tailwind v4, e o `/design-system:padronizar` põe a migração como fatia própria.

**Loja FastStore ou Wake?**\
Fora do sistema. Desligue o plugin no projeto da loja (`claude plugin disable design-system@ichikawa-kit --scope project`).

**Onde vejo as cores, as peças e as regras?**\
No [ateliê](https://wicomm-atelie.vercel.app) (com a senha): fundamentos, peças vivas nos dois temas, telas montadas, as regras com o porquê e as mudanças por versão.

**Como atualizo o plugin?**\
`claude plugin marketplace update ichikawa-kit && claude plugin update design-system@ichikawa-kit`, e reinicie o Claude Code. Para subir o *projeto* de versão, `/design-system:atualizar`.

## Para ir além

- [README do plugin](../plugins/design-system/README.md): o que vem dentro, a configuração por projeto, os testes.
- [A base](../plugins/design-system/base/): `DESIGN.md`, `ANATOMIA.md` e `CONVENCOES.md`, a norma que o designer, o crítico e as guardas citam pelo código (`COR-03`, `ARQ-01`).
- [Instalar os pacotes](instalar-pacotes.md) e [o ateliê publicado](publicar-atelie.md).
- [Kit de orquestração](https://github.com/ichikawacraice/kit-de-orquestracao#readme): para trabalhar com várias sessões do Claude Code no mesmo projeto (fila de itens, sessão dona, painel). Opcional: o `design-system` funciona sem ele.
