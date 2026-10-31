# Plugin `wicomm`

O plugin do Claude Code de design system da Wicomm, para os apps React próprios da empresa (sempre com a marca Wicomm; lojas FastStore e Wake ficam fora). Leva a todo projeto a **base** (a norma), o **processo** que decide uma tela (designer → crítico com nota → guarda que cobra a crítica) e as skills de **projeto novo**, **auditoria** e **padronização**. Estudo e plano: [`docs/estudo/F261-plugin-design-system.md`](../../docs/estudo/F261-plugin-design-system.md).

## Instalar num projeto

No `.claude/settings.json` do projeto (quem abrir o projeto no Claude Code recebe o convite para instalar):

```json
{
  "extraKnownMarketplaces": {
    "wicomm": { "source": { "source": "github", "repo": "wicomm-projects/wicomm-design-system" } }
  },
  "enabledPlugins": { "wicomm@wicomm": true }
}
```

Ou, na mão: `/plugin marketplace add wicomm-projects/wicomm-design-system` e `/plugin install wicomm@wicomm`. No terminal, num projeto novo, os dois escrevem esse mesmo `.claude/settings.json`: `claude plugin marketplace add wicomm-projects/wicomm-design-system --scope project` e `claude plugin install wicomm@wicomm --scope project`. O aviso de "4 userConfig options not yet set" pode ficar: as quatro opções têm padrão, e o `design/wicomm.json` do projeto vence cada uma.

## O que vem

| Peça | O que faz |
|---|---|
| [`base/`](base/) | A norma: `DESIGN.md` (como parece), `ANATOMIA.md` (o que vai onde), `CONVENCOES.md` (como o código sustenta as duas). Toda regra tem código (`COR-03`, `ARQ-01`), e o motor cita por ele. |
| Agente `designer` | Revisão de arquitetura antes de qualquer tela (skill `revisao-de-arquitetura-de-ui`). Não escreve código de tela. |
| Agente `critico-de-ui` | Julga em contexto separado: seis eixos (sete na densidade site), no máximo 5 problemas com *Onde* e *Correção*, teto 24/30 (28/35) — skill `critica-de-ui`. |
| Agente `auditor-de-padrao` | Mede, só lendo, um projeto existente contra a base (skill `auditar-projeto`). |
| Skills `novo-projeto`, `auditar-projeto`, `plano-de-padronizacao`, `peca-do-kit`, `atualizar-sistema` | Bootstrap, auditoria, plano em fatias, a peça certa do registro, a subida de versão. |
| Comandos `/wicomm:novo`, `/wicomm:auditar`, `/wicomm:padronizar`, `/wicomm:atualizar`, `/wicomm:estado` | Atalhos das skills; o `estado` mostra versão, deriva e a nota média. |
| Hook `guarda-de-design.mjs` | Lembra o designer no pedido de design, nega tela ao designer, cobra a crítica uma vez no turno que mudou o visual, devolve crítica sem forma (CONV-19, CONV-20). |
| Hook `valor-solto.mjs` | Avisa (não nega) na escrita de tela com `#hex` ou `rgba(` (inclusive dentro de `shadow-[…]`), `text-[15px]`, `duration-200`, paleta usada direto fora do idioma de cor (`text-zinc-700`) ou ícone que não é `lucide-react` (CONV-04, PRIN-06, MOV-01, COR-05, CTRL-09). Quem reprova é a guarda no CI. |
| Scripts `medir-deriva.mjs`, `medir-contraste.mjs` | Os números da auditoria, só lendo: deriva por categoria (pasta ui × telas), paleta direto, alfa que não gera CSS no v3, raios em px, alturas de controle, ícones, MOV-02 por ocorrência, tokens contra os da Wicomm, tema escuro, config do Tailwind e uso das peças; e a matriz de contraste da COR-12/COR-11. Carregam cópias de `@wicomm/tokens` e `@wicomm/guardas` (o plugin se instala sozinho); `scripts/tests/medidas.test.mjs` reprova se uma cópia andar sem a outra. |
| `.mcp.json` | O MCP oficial do shadcn, para a skill `peca-do-kit` consultar o registro `@wicomm`. |
| [`evals/`](evals/) | 140 casos de disparo (10 positivos e 10 negativos por skill), gerados por `evals/casos.mjs`. |

## A configuração do projeto: `design/wicomm.json`

Um arquivo só, escrito pelo `/wicomm:novo` (o `.claude/kit.json`, seção `design`, vale por compatibilidade quando o `design/wicomm.json` não diz a chave):

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
claude plugin eval plugins/wicomm --ablation none --no-publish --runs 3
```
