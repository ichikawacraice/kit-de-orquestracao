# F347 · A sessão começa mais leve

## O pedido e a premissa
Encolher o contexto que toda chamada relê (releitura ≈ 2/3 do custo; piso da sessão principal ~105 mil). Hipóteses do briefing: regras do kit repetidas três vezes, plugins sem uso no contexto, compactação tardia. **Medido antes de construir:** as duas primeiras pesam pouco (repetição ~1,5–2 mil; plugin desligado tira só os agentes, porque a lista de skills tem teto fixo), 58% do piso é do app, e o maior alvo alcançável é o `CLAUDE.md` + memória do projeto de produto e a janela de compactação. Laudo: [2026-11-02-piso-da-sessao](../research/2026-11-02-piso-da-sessao.md).

## Escopo
- Medidor `scripts/piso-da-sessao.mjs` (lê transcripts; só lê).
- Resumo do hook de início sem as regras que os blocos `kit:` do `CLAUDE.md` do projeto já trazem. Escolha: o `CLAUDE.md` fica com a regra e o hook encolhe, porque o `CLAUDE.md` chega aos subagentes e o hook não.
- `plugins.desligar` no `.claude/kit.json`, aplicado pelo `kit adotar`/`kit atualizar` no `.claude/settings.json` do projeto, conferido pelo `kit doutor`, tirado pelo `kit remover`. Desliga plugin; nunca nega ferramenta (negar MCP subiu o piso de 36 para 45 mil no teste).

## Fora do escopo
- Mudanças na conta (`~/.claude/CLAUDE.md`, plugins da conta, `autoCompactWindow`): proposta no laudo, aplicada só depois do merge com ok do operador.
- `CLAUDE.md` e memória do projeto de produto: item daquele repositório.
- O que é do app (system prompt, Artifact, navegador, simulador).

## Pronto quando
Testes afetados verdes, guia documenta o perfil, laudo com a saída real, validador sem achado médio ou alto.
