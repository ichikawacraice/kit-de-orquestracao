# Claude e Codex na ORCA

O kit organiza uma dona por item: planejar, implementar, testar o que mudou,
revisar, abrir PR e entregar. A coordenadora cuida da fila de merge e roda o
gate sobre a combinação dos PRs. A ORCA cuida de sessões, mensagens e worktrees.

`kit iniciar`, `kit adotar` e `kit atualizar` passam a criar `AGENTS.md` quando
não existe, apontando para as regras compartilhadas em `CLAUDE.md`. Um AGENTS
preexistente fica preservado: acrescente nele a orientação de ler CLAUDE.md e
rodar `kit contexto`. A atualização respeita edições e a remoção usa o hash do lock.
Para um projeto que só tem AGENTS.md, use `kit iniciar`: ele preserva esse arquivo
e cria o CLAUDE.md compartilhado. Não é necessário instalar o executável Claude
para usar `kit contexto` e `kit executar`.

## Comandos em qualquer agente

Na raiz deste repositório, `node cli/kit.mjs` abrevia `kit`. Em outros projetos,
use `npx -y github:ichikawacraice/kit-de-orquestracao`.

- `kit contexto`: este manual e os caminhos das skills e agentes originais.
- `kit contexto plugins/orquestracao/pool/dona.md`: lê o papel da dona.
- `kit contexto plugins/orquestracao/skills/orquestradora/SKILL.md`: lê a coordenação.
- `kit executar painel --help`: painel e fila compartilhados.
- `kit executar testes-afetados`: seleção de testes.

O catálogo mostra também as referências: leia-as por seus caminhos completos.
No Claude, a ferramenta Skill e os comandos no PATH continuam funcionando.
No Codex, leia a skill pelo catálogo; comandos de barra e nomes de ferramentas
citados nela são instruções do Claude e devem ser adaptados às ferramentas
disponíveis. Revisores definidos em agents/ são roteiros de revisão com contexto
limpo, não executáveis do Codex.

## Sessões e modelos

Leia `plugins/orquestracao/pool/anfitriao-orca.md`. A identidade é
`orca_session_id:<ORCA_AGENT_SESSION_ID>` para ambos os agentes. Painel, Q-IDs,
handoffs, fila de merge e teto de testes são os mesmos; `.claude` no caminho
é uma localização histórica compartilhada.

Antes de abrir workers, consulte `orca orchestration worker-start --help` e a
skill de orquestração da ORCA instalada nesta sessão. Use `--agent claude` ou
`--agent codex` conforme a escolha do operador. Informe `--model` e `--effort`
compatíveis com o agente e a instalação. Preserve o agente ao devolver um item;
nunca aplique Sonnet/Opus/Haiku ao Codex. Workers que escrevem usam worktree
própria. Workers de leitura declaram `Só leitura: <motivo>`.

## Proteções e limites

A entrada AGENTS.md fornece instruções ao Codex. Os hooks SessionStart,
PreToolUse e Stop declarados pelo plugin Claude continuam exclusivos desse
runtime: não há equivalência automática de enforcement no Codex. Revisão,
isolamento e entrega devem ser cumpridos explicitamente. O gate de testes e
as validações internas do painel continuam sendo código comum aos dois.
`kit doutor`, `atualizar-plugins` e o marketplace diagnosticam/administram a
instalação Claude; a ausência desse plugin não impede os comandos comuns.

Base da entrada Codex: https://learn.chatgpt.com/docs/customization/overview
