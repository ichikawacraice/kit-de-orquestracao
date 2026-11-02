# Ichikawa's Kit

O marketplace de plugins `ichikawa-kit` (repositório `kit-de-orquestracao`). Cada plugin é opcional: instale só os que for usar.

Kit para trabalhar com várias sessões do Claude Code no mesmo projeto sem perder o fio. Cada trabalho vira um **item** (`F12`) numa fila; uma **sessão dona** leva o item do plano ao PR; uma **sessão orquestradora** abre as donas, junta os PRs, roda os testes uma vez e mergeia. Travas por hook garantem as regras que não podem depender de memória, o pane `/painel` mostra o estado de tudo e responde às perguntas das sessões, e um teto de núcleos impede que os testes de todas as sessões derrubem a máquina.

**Guia de uso:** [`docs/guia/`](docs/guia/README.md) — o primeiro dia, o dia a dia, os comandos, o que ligar e desligar e os problemas comuns.

## O que vem no kit

| Peça | O que é |
|---|---|
| Plugin `orquestracao` | O núcleo: as travas (hooks), as skills da orquestradora e da dona, os agentes `validador` e `explorador`, e os comandos `painel`, `proximo-item`, `proxima-pergunta`, `testes-afetados`, `subir-versao` e `atualizar-plugins` |
| Plugin `painel-sessoes` | O pane `/painel`, a barra de status acima do prompt e a batida que confere a fila a cada 10 min |
| Plugin `processos` | Skills de processo (`spec-driven`, `revisar-diff`, `auditoria-de-clique`) e a conferência das docs no gate |
| Plugin `kit-design` | Para projeto com tela: revisão de arquitetura de UI antes, crítico de UI depois, e a guarda que cobra a crítica. O `design-system` é o sucessor; o `kit-design` sai quando a base dele ficar sem marca |
| Plugin `kit-performance` | Opcional, não vem ligado: as práticas de performance por camada (front, dados, entrega, medir), cada uma com quando vale e quando não vale, e o agente `revisor-de-performance` |
| Plugin `design-system` | Opcional, vem do repositório da empresa (privado): o design system para apps React — a base (direção, anatomia, convenções), o designer, o crítico com nota e a guarda. Genérico: a marca vem de um plugin de tema ([como ligar](docs/guia/ligar-e-desligar.md#design-system)) |
| Plugin `tema-wicomm` | Opcional, só nos projetos internos da empresa: o tema dela para o `design-system` (cor, fonte, logotipo, registro). Trocar as cores é trocar o plugin de tema |
| CLI `kit` | Põe o kit num projeto: gate de testes, guarda de operação, `CLAUDE.md` com as regras e `.claude/kit.json` |

## Requisitos

- Claude Code no **app desktop** (o pane e as sessões entre si usam ferramentas do app).
- Node 20 ou mais novo, e git. O kit não traz dependência npm.
- Acesso ao repositório: ele é privado. Peça o convite a quem mantém o kit e entre no GitHub com essa conta (`gh auth login`).

## Instalar em 3 passos

1. Os plugins, uma vez por máquina, e reinicie o app. O `orquestracao` traz junto o `superpowers` do marketplace oficial ([por quê](docs/guia/conflitos.md#precisa-ter)); se o marketplace oficial ainda não estiver adicionado, antes: `claude plugin marketplace add anthropics/claude-plugins-official`.
   ```bash
   claude plugin marketplace add ichikawacraice/kit-de-orquestracao
   ```
   ```bash
   claude plugin install orquestracao@ichikawa-kit
   ```
   Repita o `install` para `painel-sessoes`, `processos` e `kit-design`: o passo 2 liga os quatro no projeto. Os dois últimos se desligam por projeto, sem desinstalar ([o que ligar e desligar](docs/guia/ligar-e-desligar.md)).
2. O kit no projeto, na raiz do repositório (o `--simular` mostra o que faria; tire-o para gravar):
   ```bash
   npx -y github:ichikawacraice/kit-de-orquestracao adotar --simular
   ```
   Projeto sem `CLAUDE.md`: `iniciar` no lugar de `adotar`. Depois confira com `doutor` no lugar de `adotar --simular`.
3. Numa sessão do projeto, diga *"você é a orquestradora"*. Ela se renomeia `🎛 orquestradora — <projeto>` e passa a abrir as donas.

O passo a passo completo, com o que cada comando grava, está em [O primeiro dia](docs/guia/primeiro-dia.md).

**Quem já tinha o kit: o marketplace agora se chama `ichikawa-kit`.** Antes era `kit-de-orquestracao`, e o `claude plugin marketplace update` não troca o nome de quem já o tinha: os plugins seguem funcionando com o nome antigo, mas fora do caminho dos novos. Troque uma vez por máquina (mostra o que faria; com `--aplicar` faz, com backup), e reinicie o app:
```bash
npx -y github:ichikawacraice/kit-de-orquestracao migrar-marketplace
```
O comando troca também os projetos que o Claude Code conhece. Num projeto que ele não achou, rode o `kit atualizar` depois da troca: ele troca o nome no `.claude/settings.json` (antes da troca da conta, só avisa, porque o app ainda não conheceria o nome novo). Detalhes em [Comandos](docs/guia/comandos.md#kit-migrar-marketplace).

**O plugin `design` virou `kit-design`.** O plugin `design` da Anthropic tem o mesmo nome e escondia os agentes e as skills do kit. O `atualizar-plugins` instala o `kit-design` com as opções do `design` (e desligado, se ele estava) e só então desinstala o velho; em cada projeto, o `kit atualizar` troca `design@kit-de-orquestracao` por `kit-design@ichikawa-kit` no `enabledPlugins` do `.claude/settings.json` (o `settings.local.json` é seu: ele só avisa). Até lá, as travas e o gate leem os dois nomes. A seção `design` do `.claude/kit.json` não muda.

## Para quem mexe no kit

Regras do código e comandos em [`CLAUDE.md`](CLAUDE.md). O manual das sessões está em [`plugins/orquestracao/pool/protocolo.md`](plugins/orquestracao/pool/protocolo.md) e as decisões de desenho nos [ADRs](docs/adr/README.md). Estudos, planos e o diário em [`docs/`](docs/README.md).
