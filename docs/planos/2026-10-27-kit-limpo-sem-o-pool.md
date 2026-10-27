# O kit sai limpo: só o modelo da dona (F195)

## O pedido
Operador, 27/10: *"remova tudo que é do pool antigo, as regras etc, deixe nosso kit limpo, só com as regras atuais, skills atuais, bem formatadas, bem feitas, revise se não faltou nada. Vamos compartilhar esse kit com outras pessoas depois."*

## Escopo
Dois PRs em sequência, cada um com o validador antes:
1. **PR 1 — o pool sai** (código, testes, textos do pool e ADR 0012). O kit passa a ter um modelo só; `KIT_MODELO` deixa de existir.
2. **PR 2 — revisão para compartilhar** (README de quem é de fora, CLAUDE.md-modelo do `kit`, referências pessoais, ruído de Q-ID e data no texto que vai para outras pessoas, `claude plugin validate`).

## O que sai (PR 1)
- Seletor de modelo: `modeloDoKit`, `modeloDaDona`, `KIT_MODELO`, `modelo.json`.
- Textos: `pool/papeis/` (5 papéis), `skills/orquestradora/legado-pool.md`, o "Legado" do `pool/protocolo.md`, a tabela de papéis P/D/E/V, "cada papel na sua sessão", os níveis Leve/Padrão/Robusta e a pré-checagem do critério de `papeis-e-modelos`.
- Skills por papel: `pool/skills-por-papel.json|md`, `pool/aplicar-skills-do-papel.mjs`, `hooks/skill-do-papel.mjs`. As skills por etapa da dona passam a ler `pool/skills-por-etapa.json`.
- Hooks do pool: `livre-se-limpa.mjs` (membro que se declara livre); as travas T1, T1c, T2, T3b, T8 e T9 de `papel-do-pool.mjs`; piso de E, excedentes e "esperando papel" do `orquestradora-ritual.mjs`; os papéis P/D/E/V de `contexto-do-papel.mjs`.
- Painel: `pegar`, `seguinte`, `livres`, `fez del`, `com del --fez`, o registro em `passaram`.
- Batida: aviso ao livre, afinidade, piso de E, excedentes, `titulosVelhos`, espera de máquina cheia para a V.
- Scripts de migração: `migrar-fila.mjs` (F1–F4 para a coleção) e `migrar-para-dona.mjs` (tem defeito conhecido: `copyfile` de diretório falha com ENOTSUP e não há rollback; sem item do pool vivo, não tem uso).
- Agentes `orquestracao:executor` e `orquestracao:planejador`: no modelo da dona quem escreve é a dona e subagente só lê ou revisa; os dois não têm papel.
- Testes que só medem o que sai.

## O que fica e por quê
- A fila do painel (`list|get|set|update|batch`, `com add|del`, `soltar`, `espera`, `trava`, `perguntas`, `depois`, `temas`, `cartoes`, `handoffs`), `mergear`, `fila-de-merge`, `pode-reiniciar`, `proximo-item`, `proxima-pergunta`, `subir-versao`, `atualizar-plugins`, `testes-afetados`.
- A batida como rede de segurança: cutuca a dona do item parado, solta o item cuja dona sumiu, relata o `merge` parado e o item sem dona, apaga cartão resolvido, julga o reinício.
- `papel-do-pool.mjs` vira `travas-da-sessao.mjs` com o que vale sem pool: T3 (modo ausente não abre sessão fora do turno do operador), T5 (painel e ok de limpar só por comando), T6 (merge só pela orquestradora), T7 (a orquestradora só se limpa com o ok do operador).
- `executor-criterio.mjs` vira `criterio-da-dona.mjs` (cobra a dona em execução, validação e merge); `executor-anuncia.mjs` sai (só disparava para a executora do pool); `fila-do-item.mjs`, `titulo-da-dona.mjs`, `subagente-nao-edita.mjs`, `orquestradora-nao-edita.mjs`, `painel-das-sessoes.mjs`, `contexto-do-papel.mjs` (orquestradora e dona), teto de núcleos e `com-fichas`, modo ausente.
- "Esperando papel" vira "item sem dona" (`hooks/sem-dona.mjs`, com a cópia do pane e o teste que compara as duas).
- O nome da pasta `pool/` (o manual `pool/dona.md` e `~/.claude/orquestracao/pool/handoffs/` são citados por sessões vivas e pelo `CLAUDE.md` global do operador): *assumida, a confirmar*.
- Campos antigos gravados nos itens (`fez`, `passaram`, `via`) continuam aceitos na leitura e no `set` igual ao gravado; nada novo os grava.

## Critério de pronto
- `grep -rniE "KIT_MODELO|legado-pool|painel pegar|exec · |valida · |piso de E|excedentes" plugins cli docs README* CLAUDE.md` não acha nada fora do ADR 0012 e do histórico (diário, ADRs antigos, research, planos antigos).
- Testes afetados verdes, saída colada no PR.
- `claude plugin validate .` e `claude plugin validate plugins/<nome> --strict` limpos.
- Checagem de links e âncoras internos sem quebra.

## Fora do escopo
- Renomear a pasta `pool/` e o caminho `~/.claude/orquestracao/pool/handoffs/` (vão em `depois`).
- Ruído de Q-ID, data e nome de projeto pessoal no texto (PR 2).
- Mudar o comportamento do modelo da dona.
