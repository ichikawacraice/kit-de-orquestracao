# ADR 0001 — Plugin para o núcleo, CLI para o projeto

- Data: 2026-10-24
- Status: Aceito (*assumido, a confirmar* pelo operador)
- Autor: P6 (planejadora do pool)
- Relacionados: [estudo](../estudos/2026-10-24-como-distribuir-o-kit.md) · [plano da fase 2](../planos/2026-10-24-fase-2-o-pacote.md) · [plano da fase 1](../planos/2026-10-24-fase-1-generalizar-no-lugar.md)

## Contexto
O kit de orquestração (pool de sessões, travas por hook, painel, gate com fila e verde por árvore) nasceu espalhado entre `~/.claude/` e o repositório Izanagi. O operador quer instalá-lo em projeto novo e em projeto em andamento, atualizar depois e desinstalar. Hook igual no plugin e no `settings.json` roda duas vezes; plugin não grava arquivo no projeto; `${CLAUDE_PLUGIN_DATA}` some no uninstall.

## Decisão
1. Este repositório é um **marketplace privado** com dois plugins: `orquestracao` (hooks, skills, agents, scripts) e `painel-sessoes` (mod). Instalação no escopo do usuário.
2. Este repositório também é o **pacote do CLI `kit`**, rodado por `npx -y github:ichikawacraice/kit-de-orquestracao`, sem publicar no npm: `iniciar`, `adotar`, `atualizar`, `doutor`, `remover`.
3. O CLI escreve no projeto só: `.claude/kit.json`, `scripts/kit/*`, blocos marcados no `CLAUDE.md`, entradas mescladas no `.claude/settings.json` e no `package.json`, e o `.claude/kit.lock.json` com o hash de cada coisa que escreveu. Nunca sobrescreve o que o hash diz que foi mexido.
4. Estado do operador (fila, painel, contadores, logs) fica em `~/.claude/orquestracao/`, sobreponível por env — não no diretório nem no data dir do plugin.
5. Nenhum hook do kit fica no `~/.claude/settings.json` depois da migração; o `kit doutor` acusa cópia duplicada.

## Consequências
- Atualizar o núcleo = subir `version` no `plugin.json` + `claude plugin update`; esquecer de subir a versão não entrega nada.
- Skill e agent do kit ganham prefixo (`orquestracao:…`): travas que casam por nome aceitam os dois.
- O gate do projeto roda no CI sem rede, porque é cópia versionada no projeto.
- Publicar no npm ou tornar o repositório público continua sendo decisão do operador (irreversível); nada aqui depende disso.
