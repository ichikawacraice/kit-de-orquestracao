# Ichikawa's Kit — Claude e Codex

Leia CLAUDE.md inteiro antes de trabalhar: ele contém as regras compartilhadas do projeto.
A configuração continua em .claude/kit.json e o estado em ~/.claude/orquestracao/;
não crie uma fila ou um painel separado para Codex.

No Codex, use o CLI do kit (local: node cli/kit.mjs; outros projetos:
npx -y github:ichikawacraice/kit-de-orquestracao).
- kit contexto: manual de adaptação e catálogo de skills e agentes.
- kit contexto <caminho do catálogo>: lê a instrução original, incluindo referências relativas.
- kit executar <comando> [argumentos]: executa os comandos do plugin sem depender do PATH do Claude.

Na ORCA, use a identidade ORCA_AGENT_SESSION_ID, mensagens e worktrees da IDE.
Leia o manual com kit contexto antes de coordenar trabalho. Use o agente escolhido
pelo operador; modelos Sonnet/Opus/Haiku são exclusivos do Claude. Para Codex,
escolha modelo e esforço disponíveis na ORCA, de acordo com o risco, sem traduzir
nomes de modelos Claude em nomes GPT automaticamente.
Os hooks do plugin Claude não são ativados por este arquivo no Codex. Cumpra
explicitamente as regras de revisão, testes, isolamento, segredos e entrega.
