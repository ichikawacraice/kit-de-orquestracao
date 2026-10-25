# kit-de-orquestracao

Kit de orquestração de sessões do Claude Code (pool de papéis, travas por hook, painel, gates), instalável em qualquer projeto.

Em construção:
- [Estudo: como distribuir e instalar](docs/estudos/2026-10-24-como-distribuir-o-kit.md)
- [ADR 0001: plugin para o núcleo, CLI para o projeto](docs/adr/0001-plugin-para-o-nucleo-cli-para-o-projeto.md)
- [Fase 1: generalizar no lugar (`~/.claude/`)](docs/planos/2026-10-24-fase-1-generalizar-no-lugar.md)
- [ADRs](docs/adr/README.md) · [docs](docs/README.md)
- [Fase 2: o pacote (fatias K1–K9)](docs/planos/2026-10-24-fase-2-o-pacote.md)

## Comportamentos do CLI que surpreendem

- **Bloco renomeado aparece duas vezes.** Quando uma versão nova do kit renomeia um bloco do `CLAUDE.md`, o `kit atualizar` não apaga o antigo (pode ter texto seu): avisa `o bloco X saiu do kit; deixei como está` e acrescenta o novo no fim (`novo: Y`). Os dois ficam até você apagar o antigo.
- **Instalação interrompida.** Se o `kit iniciar`/`adotar` morrer no meio, o `kit adotar` reconhece (`.kit-tmp` órfão ou `test` que já é o gate), conclui e grava o lock. O `remover` depois declara que o texto original dos JSON não foi guardado.
- **`test` do projeto.** Sem `--trocar-test` o `npm test` continua sendo o seu; o `kit doutor` lembra a pendência, e `kit atualizar --trocar-test` faz a troca depois.
- **`gate.comandoCompleto`** não pode chamar `npm test`/`pnpm test`/`yarn test`: o `test` é o gate, e o gate chamando o `test` esperaria a própria vez para sempre. Aponte para o script da suíte (ex.: `npm run test:suite`).
