# kit-de-orquestracao

Kit para trabalhar com várias sessões do Claude Code no mesmo projeto sem perder o fio. Cada trabalho vira um **item** (`F12`) numa fila; uma **sessão dona** leva o item do plano ao PR; uma **sessão orquestradora** abre as donas, junta os PRs, roda os testes uma vez e mergeia. Travas por hook garantem as regras que não podem depender de memória, o pane `/painel` mostra o estado de tudo e responde às perguntas das sessões, e um teto de núcleos impede que os testes de todas as sessões derrubem a máquina.

**Guia de uso:** [`docs/guia/`](docs/guia/README.md) — o primeiro dia, o dia a dia, os comandos, o que ligar e desligar e os problemas comuns.

## O que vem no kit

| Peça | O que é |
|---|---|
| Plugin `orquestracao` | O núcleo: as travas (hooks), as skills da orquestradora e da dona, os agentes `validador` e `explorador`, e os comandos `painel`, `proximo-item`, `proxima-pergunta`, `testes-afetados`, `subir-versao` e `atualizar-plugins` |
| Plugin `painel-sessoes` | O pane `/painel`, a barra de status acima do prompt e a batida que confere a fila a cada 10 min |
| Plugin `processos` | Skills de processo (`spec-driven`, `revisar-diff`, `auditoria-de-clique`) e a conferência das docs no gate |
| Plugin `kit-design` | Para projeto com tela: revisão de arquitetura de UI antes, crítico de UI depois, e a guarda que cobra a crítica |
| CLI `kit` | Põe o kit num projeto: gate de testes, guarda de operação, `CLAUDE.md` com as regras e `.claude/kit.json` |

## Requisitos

- Claude Code no **app desktop** (o pane e as sessões entre si usam ferramentas do app).
- Node 20 ou mais novo, e git. O kit não traz dependência npm.
- Acesso ao repositório: ele é privado. Peça o convite a quem mantém o kit e entre no GitHub com essa conta (`gh auth login`).

## Instalar em 3 passos

1. Os plugins, uma vez por máquina, e reinicie o app:
   ```bash
   claude plugin marketplace add ichikawacraice/kit-de-orquestracao
   ```
   ```bash
   claude plugin install orquestracao@kit-de-orquestracao
   ```
   Repita o `install` para `painel-sessoes`, `processos` e `kit-design`: o passo 2 liga os quatro no projeto. Os dois últimos se desligam por projeto, sem desinstalar ([o que ligar e desligar](docs/guia/ligar-e-desligar.md)).
2. O kit no projeto, na raiz do repositório (o `--simular` mostra o que faria; tire-o para gravar):
   ```bash
   npx -y github:ichikawacraice/kit-de-orquestracao adotar --simular
   ```
   Projeto sem `CLAUDE.md`: `iniciar` no lugar de `adotar`. Depois confira com `doutor` no lugar de `adotar --simular`.
3. Numa sessão do projeto, diga *"você é a orquestradora"*. Ela se renomeia `🎛 orquestradora — <projeto>` e passa a abrir as donas.

O passo a passo completo, com o que cada comando grava, está em [O primeiro dia](docs/guia/primeiro-dia.md).

**Quem já tinha o kit: o plugin `design` virou `kit-design`.** O plugin `design` da Anthropic tem o mesmo nome e escondia os agentes e as skills do kit. O `atualizar-plugins` instala o `kit-design` com as opções do `design` (e desligado, se ele estava) e só então desinstala o velho; em cada projeto, o `kit atualizar` troca `design@kit-de-orquestracao` por `kit-design@kit-de-orquestracao` no `enabledPlugins` do `.claude/settings.json` (o `settings.local.json` é seu: ele só avisa). Até lá, as travas e o gate leem os dois nomes. A seção `design` do `.claude/kit.json` não muda.

## Para quem mexe no kit

Regras do código e comandos em [`CLAUDE.md`](CLAUDE.md). O manual das sessões está em [`plugins/orquestracao/pool/protocolo.md`](plugins/orquestracao/pool/protocolo.md) e as decisões de desenho nos [ADRs](docs/adr/README.md). Estudos, planos e o diário em [`docs/`](docs/README.md).
