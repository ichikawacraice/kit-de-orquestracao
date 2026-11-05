# Plugin `design-system`

O plugin do Claude Code de design system para apps React. Leva a todo projeto a **base** (a norma), o **processo** que decide uma tela (designer → crítico com nota → guarda que cobra a crítica) e as skills de **projeto novo**, **auditoria**, **padronização** e **migração**. A marca vem de um plugin de tema à parte: nos apps da Wicomm, o [`tema-wicomm`](../tema-wicomm/). Estudo: [`docs/estudo/F261-plugin-design-system.md`](../../docs/estudo/F261-plugin-design-system.md); a separação do tema: [`docs/planos/F345-design-system-generico.md`](../../docs/planos/F345-design-system-generico.md).

> **Vai só usar o sistema num app?** Comece pelo guia [Começar](../../docs/comecar.md). Este README é para quem configura ou mexe no plugin.

## Instalar num projeto

O `design-system` e o `tema-wicomm` moram neste repositório e são listados **só** no marketplace do kit (`ichikawa-kit`), que aponta para cá por subpasta. Um plugin em dois marketplaces roda os hooks duas vezes. No `.claude/settings.json` do projeto:

```json
{
  "extraKnownMarketplaces": {
    "ichikawa-kit": { "source": { "source": "github", "repo": "ichikawacraice/kit-de-orquestracao" } }
  },
  "enabledPlugins": { "design-system@ichikawa-kit": true, "tema-wicomm@ichikawa-kit": true }
}
```

O aviso de "4 userConfig options not yet set" pode ficar: as quatro opções têm padrão, e o arquivo do projeto vence cada uma. As opções gravadas para o nome antigo (`wicomm@*`, ou `kit-design@*`) valem enquanto o nome novo não tem as suas.

## Vindo do plugin `wicomm`

O `design-system` é o plugin `wicomm` com outro nome. O `wicomm` fica **congelado** no marketplace `wicomm` deste repositório até os projetos que o usam migrarem. Correção nova entra só aqui.
- **Não ligue os dois.** Enquanto o `wicomm` está ligado no projeto, o `design-system` cede a ele: a guarda e o aviso de valor solto ficam inertes aqui, e quem roda é o antigo.
- **A migração** é a skill `design-system:migrar`. Ela desliga o `wicomm@wicomm`, liga o `design-system` e o tema, e acrescenta `design-system:designer` aos `designers` do `.claude/kit.json`. O projeto continua com o `design/wicomm.json`.
- **O arquivo do projeto** é `design/design-system.json`. O projeto que já tem `design/wicomm.json` segue com ele: o plugin e as guardas leem os dois (vale o novo quando há os dois), e o script das guardas do projeto passa o caminho por `--config`.

## O que vem

| Peça | O que faz |
|---|---|
| [`base/`](base/) | A norma: `DESIGN.md` (como parece), `ANATOMIA.md` (o que vai onde), `CONVENCOES.md` (como o código sustenta as duas). Toda regra tem código (`COR-03`, `ARQ-01`), e o motor cita por ele. |
| Agente `designer` | Revisão de arquitetura antes de qualquer tela (skill `revisao-de-arquitetura-de-ui`). Não escreve código de tela. |
| Agente `critico-de-ui` | Julga em contexto separado: seis eixos (sete na densidade site), no máximo 5 problemas com *Onde* e *Correção*, teto 24/30 (28/35) — skill `critica-de-ui`. |
| Agente `auditor-de-padrao` | Mede, só lendo, um projeto existente contra a base (skill `auditar-projeto`). |
| Skills `novo-projeto`, `auditar-projeto`, `plano-de-padronizacao`, `peca-do-kit`, `atualizar-sistema` | Bootstrap, auditoria, plano em fatias, a peça certa do registro, a subida de versão. |
| Skill `acessibilidade` | Auditoria de acessibilidade nível AA presa à base: contraste pelos tokens nos dois temas, teclado e foco, nome de controle, alvo de 24px, estrutura, anúncio (ACES-01 a ACES-05). |
| Skill `textos-de-interface` | Escreve e revisa o texto da tela em PT-BR: botão, confirmação, erro, vazio, espera (MSG-01 a MSG-09). |
| Comandos `/design-system:novo`, `/design-system:auditar`, `/design-system:padronizar`, `/design-system:atualizar`, `/design-system:estado` | Atalhos das skills; o `estado` mostra versão, deriva e a nota média. |
| Hook `guarda-de-design.mjs` | Lembra o designer no pedido de design, nega tela ao designer, cobra a crítica uma vez ao abrir o PR (`gh pr create`) se o visual da branch mudou sem ela, devolve crítica sem forma (CONV-19, CONV-20). |
| Hook `valor-solto.mjs` | Avisa (não nega) na escrita de tela com `#hex` ou `rgba(` (inclusive dentro de `shadow-[…]`), `text-[15px]`, `duration-200`, paleta usada direto fora do idioma de cor (`text-zinc-700`) ou ícone que não é `lucide-react` (CONV-04, PRIN-06, MOV-01, COR-05, CTRL-09). Quem reprova é a guarda no CI. |
| Scripts `medir-deriva.mjs`, `medir-contraste.mjs` | Os números da auditoria, só lendo: deriva por categoria (pasta ui × telas), paleta direto, alfa que não gera CSS no v3, raios em px, alturas de controle, ícones, MOV-02 por ocorrência, tokens contra os da Wicomm, tema escuro, config do Tailwind e uso das peças; e a matriz de contraste da COR-12/COR-11. Carregam cópias de `@wicomm/tokens` e `@wicomm/guardas` (o plugin se instala sozinho); `scripts/tests/medidas.test.mjs` reprova se uma cópia andar sem a outra. |
| `.mcp.json` | O MCP oficial do shadcn, para a skill `peca-do-kit` consultar o registro `@wicomm`. |
| `substitutas.json` | Declara ao kit de orquestração quais skills da Anthropic o plugin substitui (`design:accessibility-review`, `design:ux-copy`, `design:design-system`). Com o kit instalado, a original é recusada e aponta a do `design-system`; sem ele, não faz nada. Veja [Com o plugin `design` da Anthropic ligado](#com-o-plugin-design-da-anthropic-ligado). |
| [`evals/`](evals/) | 180 casos de disparo (10 positivos e 10 negativos por skill), gerados por `evals/casos.mjs`. |

## Com o plugin `design` da Anthropic ligado

O app pode trazer o plugin `design` da Anthropic (pela organização, em Personalizar → Plugins). O `design-system` não depende dele: o que serve foi absorvido, em PT-BR e preso à base ([`TERCEIROS.md`](TERCEIROS.md)). Num app React da Wicomm, use a coluna da direita:

| Em vez de | Use |
|---|---|
| `design:accessibility-review` | skill `design-system:acessibilidade` |
| `design:ux-copy` | skill `design-system:textos-de-interface` |
| `design:design-system` (auditoria) | skill `design-system:auditar-projeto` (subagente `design-system:auditor-de-padrao`); a peça nova é a `design-system:peca-do-kit` |
| `design:design-critique` | subagente `design-system:critico-de-ui` |

**Com o kit de orquestração instalado**, as três primeiras linhas da tabela são automáticas: o `substitutas.json` na raiz do plugin faz o kit recusar a skill original e apontar a do `design-system`, em todo projeto com o kit onde o `design-system` está ligado (`enabledPlugins`, instalado pelo CLI; o plugin que só a conta do app traz não entra). **Sem o kit**, nada recusa: desligue o plugin `design` da Anthropic à mão (ou não use as três). A `design:design-critique` não está no arquivo: o kit já a barra por conta própria.

`design-handoff`, `research-synthesis` e `user-research` não têm par aqui e não atrapalham. O plugin de design do kit de orquestração chama-se `kit-design` (`kit-design:designer`, `kit-design:critico-de-ui`) e não colide com o da Anthropic; num app React da Wicomm, o `design-system` substitui o `kit-design` (o mesmo processo, que sai do kit).

## A configuração do projeto: `design/design-system.json`

Um arquivo só, escrito pelo `/design-system:novo` (o `.claude/kit.json`, seção `design`, vale por compatibilidade quando o `design/design-system.json` não diz a chave):

| Chave | Para quê | Padrão |
|---|---|---|
| `versao` | a versão do sistema estampada no projeto | a da base no bootstrap |
| `densidade` | `instrumento` (opera o dia todo) ou `site` (usa de vez em quando) | `instrumento` |
| `densidadePorRota` | app misto: `{ "/p/*": "site" }`; a primeira rota que casa vence, o resto fica com `densidade` | — |
| `pasta` | a pasta do front; dela sai o que é tela (`tsx`, `jsx`, `css`, `html`…, sem testes) | — (sem ela nem `visual`, a guarda fica inerte) |
| `visual` / `negadoAoDesigner` | globs explícitos do que é tela / do que o designer não grava | derivados de `pasta` |
| `fontes` | os documentos que o designer e o crítico leem | `design/PRODUCT.md`, `ANATOMIA.md`, `DESIGN.md`, `CONVENCOES.md`; o que falta cai na base do plugin |
| `kit`, `revisoes`, `largura`, `tronco` | pasta das peças, pasta das revisões, largura de referência, de onde a branch sai | —, `docs/design/revisoes`, 1280, `origin/main` |
| `guarda`, `cobrarCritica` | liga/desliga a guarda e a cobrança da crítica para o time | ligados |
| `valorSolto` | `false` desliga o aviso; `{ "ignorar": [globs] }` lista a exceção local com motivo | ligado |
| `pecas` | peça instalada do registro → `{ arquivo, versao, hash }` | `{}` |
| `base` | o hash de cada documento da base no projeto (o `estampar` escreve) | — |

## Testes

`npm test` na raiz do repositório roda a guarda da base, os testes dos hooks e dos scripts e confere que as pastas de eval batem com a lista. Os evals de disparo custam uma sessão por caso e rodada:

```bash
claude plugin eval plugins/design-system --ablation none --no-publish --runs 3
```
