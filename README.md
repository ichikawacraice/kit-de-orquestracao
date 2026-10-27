# kit-de-orquestracao

Kit para trabalhar com várias sessões do Claude Code no mesmo projeto sem perder o fio: cada trabalho vira um **item** numa fila, uma **sessão dona** leva o item do plano ao PR, e uma **sessão orquestradora** abre as donas, mergeia e faz o release. Travas por hook garantem as regras que não podem depender de memória, um painel mostra o estado de tudo, e um teto de núcleos impede que os testes de todas as sessões derrubem a máquina.

## Como funciona

- **Item e dona.** Todo trabalho é um item `F<n>`. A orquestradora abre uma sessão por item, com o título `F<n> · <tema>`. Essa sessão é a dona: mede, decide, escreve, testa e revisa o diff por um subagente de contexto limpo (`orquestracao:validador`). Depois abre o PR e manda à orquestradora `PR N pronto, HEAD <sha>`.
- **Fila de merge.** A orquestradora junta os PRs prontos, roda o gate completo **uma vez** sobre a combinação e mergeia o que passou. O que conflitou ou ficou vermelho volta para a dona. Durante o trabalho, cada dona roda só os testes afetados pelo que tocou.
- **Até 4 donas ao mesmo tempo** (3 com a máquina cheia).
- **Painel.** O pane `/painel` mostra:
  - o que espera você: perguntas com ID (`Q12`) e botões de resposta;
  - o que está travado;
  - o que está em execução;
  - o que está na fila.

  A barra acima do prompt diz o contexto da sessão, o item e se dá para reiniciar o app.
- **Batida.** A cada 10 min, o pane confere a fila. Cutuca a dona do item parado, solta o item cuja dona sumiu e avisa a orquestradora do que está esperando merge ou sem dona.
- **Modo ausente.** `/ausente on` antes de sair: depois daquele turno, nenhuma sessão abre sozinha, e as decisões de baixo risco seguem assumidas e marcadas para você confirmar.

O manual completo está em [`plugins/orquestracao/pool/protocolo.md`](plugins/orquestracao/pool/protocolo.md) (a regra comum) e [`plugins/orquestracao/pool/dona.md`](plugins/orquestracao/pool/dona.md) (a sessão dona). As decisões de desenho estão nos [ADRs](docs/adr/README.md).

## O que vem no kit

| Peça | O que é |
|---|---|
| Plugin `orquestracao` | Hooks e travas, skills (`orquestradora`, `papeis-e-modelos`, `handoff-de-sessao`, `ausente`, `notas-de-release`, `orquestrar-com-subagentes`), agentes `validador` e `explorador`, e os comandos do `bin/` (`painel`, `proximo-item`, `proxima-pergunta`, `testes-afetados`, `subir-versao`, `atualizar-plugins`) |
| Plugin `painel-sessoes` | O pane `/painel`, a barra de status e a batida |
| Plugin `processos` | Skills de processo: `spec-driven` (ADR, spec, roadmap), `revisar-diff`, `auditoria-de-clique` |
| Plugin `design` | Revisão de arquitetura de UI antes da tela, crítico de UI depois, e a guarda que cobra a crítica do trabalho visual |
| CLI `kit` | Põe o kit num projeto: gate de testes, guarda de operação, `CLAUDE.md` com as regras, `.claude/kit.json` |

## Requisitos

- Claude Code no app desktop (o pane e as sessões entre si usam as ferramentas do app).
- Node 20 ou mais novo, e git. O kit não traz dependência npm.

## Instalar

O repositório é privado: peça acesso a quem mantém o kit e entre no GitHub com a conta que recebeu o convite (`gh auth login`) antes dos passos abaixo.

1. Os plugins, uma vez por máquina:
   ```bash
   claude plugin marketplace add ichikawacraice/kit-de-orquestracao
   ```
   ```bash
   claude plugin install orquestracao@kit-de-orquestracao
   ```
   Repita o `install` para `painel-sessoes`, `processos` e `design`. Reinicie o app.
2. O kit no projeto, na raiz do repositório:
   ```bash
   npx -y github:ichikawacraice/kit-de-orquestracao adotar --simular
   ```
   Sem `--simular`, grava. Projeto novo, sem `CLAUDE.md`: use `iniciar` no lugar de `adotar` (o `iniciar` não tem `--simular`). Com front: acrescente `--design <pasta do front>`.
3. Confira:
   ```bash
   npx -y github:ichikawacraice/kit-de-orquestracao doutor
   ```
4. Numa sessão do projeto, declare a orquestradora: *"você é a orquestradora"*. Ela se renomeia `🎛 orquestradora — <projeto>` e passa a abrir as donas.

Os outros comandos do CLI (`atualizar`, `remover`) estão em `npx -y github:ichikawacraice/kit-de-orquestracao ajuda`.

## Atualizar os plugins na máquina

`atualizar-plugins [--seco] [--json]` (no `bin/` do plugin `orquestracao`) atualiza o clone do marketplace e os plugins do kit instalados em `user`; o app precisa reiniciar para valer.

## Comportamentos do CLI que surpreendem

- **Bloco renomeado aparece duas vezes.** Quando uma versão nova do kit renomeia um bloco do `CLAUDE.md`, o `kit atualizar` não apaga o antigo (pode ter texto seu): avisa `o bloco X saiu do kit; deixei como está` e acrescenta o novo no fim (`novo: Y`). Os dois ficam até você apagar o antigo.
- **Instalação interrompida.** Se o `kit iniciar`/`adotar` morrer no meio, o `kit adotar` reconhece (`.kit-tmp` órfão ou `test` que já é o gate), conclui e grava o lock. O `remover` depois declara que o texto original dos JSON não foi guardado.
- **Laço no gate.** O gate põe `KIT_GATE_DENTRO` (a raiz do worktree) no ambiente da suíte; um gate do mesmo worktree que nasce com ela (o `comandoCompleto` chamou `npm test`, direta ou indiretamente) recusa com exit 2 em vez de esperar a própria vez. O `kit doutor` ainda avisa pelo texto do comando, que pode errar.
- **Flag desconhecida** em qualquer subcomando: exit 2 com a lista das válidas, sem gravar nada.
- **`test` do projeto.** Sem `--trocar-test` o `npm test` continua sendo o seu; o `kit doutor` lembra a pendência, e `kit atualizar --trocar-test` faz a troca depois.
- **`gate.comandoCompleto`** não pode chamar `npm test`/`pnpm test`/`yarn test`: o `test` é o gate, e o gate chamando o `test` esperaria a própria vez para sempre. Aponte para o script da suíte (ex.: `npm run test:suite`).

## Para quem mexe no kit

Regras do código e comandos em [`CLAUDE.md`](CLAUDE.md). Gate: `npm test`; teste isolado: `node gate/com-fichas.mjs -- node --test <arquivo>`; testes do pane: `claude plugin test plugins/painel-sessoes`. Estudos, planos e o diário em [`docs/`](docs/README.md).
