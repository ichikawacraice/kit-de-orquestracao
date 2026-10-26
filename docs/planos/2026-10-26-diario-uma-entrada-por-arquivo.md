# Plano · o diário tem uma entrada por arquivo (F117)

Base: `main` em `dcc8f48`. Decisão: [ADR 0006](../adr/0006-o-diario-tem-uma-entrada-por-arquivo.md) (entra no mesmo PR deste plano). Versão: `processos` 0.2.0 → **0.2.1**.
Origem: o kit adota o formato do ADR 0399 do Izanagi (Q372). Executora: Sonnet. Teste antes do código na parte A; uma parte por commit.

## Medido (dcc8f48)
- `gate/as-docs-concordam.mjs`, regra `tamanho-do-diario` (`REGRAS["tamanho-do-diario"]`): só lista `^\d{4}-\d{2}(-parte-\d+)?\.md$` na raiz do diário (`arquivosDe`, não recursivo). Entrada em `diario/AAAA-MM/` não é vista; "nada a conferir" diz `nenhum AAAA-MM.md em …`.
- Regra `linha-do-roadmap`: o destino dentro de `c.diario` já exige âncora explícita (`dentro(alvo, c.diario)` cobre subpasta). Link `diario/2026-10/26-x.md#x` já funciona; falta só o teste que o prove.
- Regra `links-relativos`: recursiva (`markdownsSob`), já cobre a pasta do mês.
- Texto que ensina o formato antigo: `modelos/CLAUDE.md:38` e `CLAUDE.md:48` (bloco `kit:documentos v1`, idênticos hoje); `plugins/processos/skills/spec-driven/SKILL.md:23`, `:27` e `:61`; `modelos/docs/roadmap.md:6`; `modelos/docs/diario/README.md` (inteiro, com tabela "Índice" de meses); `gate/README.md:74`; `plugins/processos/.claude-plugin/plugin.json:36` (descrição da opção `conferir_tamanho_do_diario`); comentário do topo de `gate/as-docs-concordam.mjs` (linha `tamanho-do-diario`).
- `cli/atualizar.mjs:46-47` troca o bloco quando o projeto não o editou; o precedente do PR 40 subiu `kit:regras-de-trabalho` de versão ao mudar o texto.
- O repo do kit não tem `docs/diario/` nem `docs/roadmap.md`: nada a migrar aqui.

## Partes

### A · gate: a regra `tamanho-do-diario` confere a pasta do mês
Teste: `gate/test/as-docs-concordam.test.mjs`, no `describe("tamanho-do-diario")`. Use o ajudante `pasta({...})` e `onde(r)` que já existem.
1. Testes vermelhos (cada um afirma antes que o insumo existe: `r` tem a regra rodada e `vistos`/achados > 0 quando o caso é de reprova):
   - **entrada boa:** `docs/diario/2026-11/03-cache-frio.md` com `<a id="cache-frio"></a>\n# 03/11 · cache frio\n` → 0 achados, e a linha de fecho conta **1 arquivo** (prova que a pasta foi vista).
   - **nome fora do formato:** `2026-11/3-x.md`, `2026-11/03-Cache.md`, `2026-11/03_x.md`, `2026-11/x.md` → um achado cada, motivo com `DD-<ancora>.md`.
   - **âncora diferente do nome:** `2026-11/03-a.md` declarando `<a id="b">` → achado com `a âncora do nome`; sem `<a id>` nenhum → achado.
   - **vazio:** arquivo de 0 bytes (e só espaços) → achado `vazio`.
   - **tamanho:** entrada com `diarioEmBytes + 1` → achado de bytes (mesma frase das partes, sem a sugestão de fatiar: diga "a entrada passa do orçamento; divida em duas entradas").
   - **pasta com nome inválido:** `docs/diario/2026-13/01-x.md` ou `docs/diario/nov/01-x.md` → achado `pasta do mês fora de AAAA-MM`. `README.md` e outros arquivos soltos na raiz do diário continuam ignorados.
   - **acervo depois do corte:** pastas `2026-10/` e arquivo `2026-11.md` → achado no `2026-11.md` (`mês depois da primeira pasta (2026-10) vira pasta`). `2026-10.md` + `2026-10/` → sem achado (mês da transição). `2026-09-parte-2.md` + `2026-10/` → sem achado.
   - **sem pasta nenhuma:** só `2026-11.md` e `2026-12.md` → sem achado (projeto que ainda não adotou).
   - **nada a conferir:** pasta `docs/diario` só com `README.md` → `nada` com motivo que cita os dois formatos (`nenhum AAAA-MM.md nem AAAA-MM/DD-*.md`). Ajuste a asserção `/nenhum AAAA-MM/` e a linha exata do teste da linha de fecho (`:467`) para a frase nova.
   - **roadmap aponta para a pasta:** em `describe("linha-do-roadmap")`, item com `[detalhe](diario/2026-11/03-x.md#x)` e destino declarando `<a id="x">` → 0 achados; destino com só `# x` (sem `<a id>`) → achado com `âncora explícita` (prova que o rígido vale na subpasta).
   Rode `node --test gate/test/as-docs-concordam.test.mjs`; confirme que os casos novos falham pelo motivo certo (pasta não vista / frase antiga), não por erro de sintaxe. Cole a saída no relatório.
2. Código em `gate/as-docs-concordam.mjs`, regra `tamanho-do-diario`:
   - lista o acervo como hoje (`AAAA-MM(-parte-N).md`), e as subpastas de `c.diario` (só diretórios); pasta que não casa `^\d{4}-(0[1-9]|1[0-2])$` é achado;
   - em cada pasta do mês, cada `.md`: nome `^(0[1-9]|[12]\d|3[01])-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$`; texto `.trim()` vazio → achado; bytes > orçamento → achado; `ancorasDe(texto).explicitas` deve conter a âncora do nome → senão achado. Arquivo que não é `.md` na pasta do mês: ignore;
   - corte: `primeira` = menor nome de pasta de mês válida; todo arquivo do acervo cujo `AAAA-MM` > `primeira` é achado;
   - `c.vistos` = partes do acervo + entradas das pastas; `nada` quando os dois são zero.
   - Atualize o comentário do topo (linha `tamanho-do-diario`): "cada parte do diário ≤ orçamento; cada entrada `AAAA-MM/DD-<ancora>.md` no formato, não vazia, com `<a id>` igual à âncora; mês depois da primeira pasta não nasce como arquivo único (ADR 0006)" — sem citar ADR se o arquivo não cita ADR nos outros comentários (confira e siga o estilo do arquivo).
3. Mutações (uma por vez, desfaça, cole a saída): M1 tirar a checagem de `<a id>` → o caso "âncora diferente" fica vermelho; M2 tirar o corte → o caso "acervo depois do corte" fica vermelho; M3 trocar `trim()` por `length` → o caso "só espaços" fica vermelho.
4. `npm test` verde. Commit: `feat(gate): o diário aceita uma entrada por arquivo na pasta do mês`.

### B · texto: o kit ensina o formato novo
Sem teste novo de comportamento; a parte A já é o que força. Rode `npm test` no fim (os testes `k11`, `modelos`, `processos` leem estes arquivos).
1. `modelos/CLAUDE.md` e `CLAUDE.md` (raiz), bloco `kit:documentos`: suba a marca para **`v2`** nos dois (abertura `<!-- kit:documentos v2 -->`) e troque a linha do Roadmap por:
   `- **Roadmap** em \`docs/roadmap.md\`: uma linha por item, até 400 caracteres e no máximo 2 links. A narrativa vai para o **diário**, uma entrada por arquivo em \`docs/diario/AAAA-MM/DD-<ancora>.md\` com \`<a id="<ancora>">\`; dois PRs nunca escrevem no mesmo arquivo. Os \`AAAA-MM.md\` antigos ficam como estão.`
   Os dois blocos continuam idênticos (confira com `diff` e cole).
2. `plugins/processos/skills/spec-driven/SKILL.md`:
   - tabela (`:23`): `narrativa, uma entrada por arquivo em \`AAAA-MM/DD-<ancora>.md\``;
   - `:27`: "150 KB por entrada do diário (e por parte do acervo antigo)";
   - `:61`: reescreva o parágrafo: a narrativa vai em `<documentos.diario>/AAAA-MM/DD-<ancora>.md`, um arquivo novo por entrada (âncora `[a-z0-9-]+`, declarada com `<a id>` na linha acima do título), apontada da linha por `· [detalhe](diario/AAAA-MM/DD-<ancora>.md#<ancora>)`. Item que cresce depois do merge ganha entrada nova (outro dia, outra âncora); a mergeada não se reescreve. Sem índice por pasta. Acervo `AAAA-MM.md`/`-parte-N.md` fica, mas não cresce: mês novo é pasta.
   - `:63`: "Item que cresce faz a ENTRADA DO DIÁRIO crescer" → "Item que cresce ganha ENTRADA NOVA no diário, nunca a linha mais longa".
3. `modelos/docs/roadmap.md:6`: troque "um arquivo por mês, e o item aponta para ela com `· [detalhe](diario/AAAA-MM.md#âncora)`" por "uma entrada por arquivo, e o item aponta para ela com `· [detalhe](diario/AAAA-MM/DD-ancora.md#ancora)`".
4. `modelos/docs/diario/README.md`: reescreva "Como se escreve" no formato novo (pasta do mês, nome `DD-<ancora>.md`, `<a id>`, uma entrada por item e por dia, entrada mergeada não se reescreve, texto de quem não estava lá) e **remova a seção "Índice"** (o índice é o roadmap; tabela de meses seria o arquivo que todo PR edita). Diga numa linha que arquivos `AAAA-MM.md` antigos continuam valendo.
5. `gate/README.md:74`: `| \`tamanho-do-diario\` | parte do acervo ou entrada acima de \`orcamentos.diarioEmBytes\` (150000); entrada fora de \`AAAA-MM/DD-<ancora>.md\`, vazia ou sem \`<a id>\` igual à âncora; mês depois da primeira pasta como arquivo único |`.
6. `plugins/processos/.claude-plugin/plugin.json`: descrição da opção `conferir_tamanho_do_diario` → "O gate reprova parte ou entrada do diário acima do orçamento e entrada fora do formato AAAA-MM/DD-<ancora>.md."; `version` 0.2.0 → 0.2.1. Rode `claude plugin validate plugins/processos --strict` e `claude plugin validate .`.
7. `grep -rn "AAAA-MM.md\|um arquivo por mês" modelos plugins cli gate CLAUDE.md` deve sobrar só onde fala do acervo antigo; cole a saída.
8. Commit: `docs(processos): o kit ensina o diário com uma entrada por arquivo`.

## Critério de pronto
- `npm test` verde, com os casos da parte A e as três mutações relatadas com saída real.
- `diff` dos dois blocos `kit:documentos v2` vazio.
- `claude plugin validate` limpo nos dois comandos.
- PR com rebase em dia sobre `main`, número mandado à orquestradora; sem merge.

## Fora de escopo
- Migrar acervo de qualquer projeto (inclusive o Izanagi, que já tem o próprio teste).
- Renomear a regra `tamanho-do-diario` ou a opção do plugin (ADR 0006, alternativas).
- Chave nova no `kit.json` para o mês de corte.
- Mexer no roadmap (`linha-do-roadmap`) além do teste que prova o link novo.
- Qualquer coisa no repositório Izanagi.

## Regras do projeto que tocam a tarefa
- Node ≥ 20, ESM, só módulos nativos; `node:test`; `process.exitCode`, nunca `process.exit()`.
- Testes nunca tocam `~/.claude` real; o gate de docs só lê a pasta temporária do `pasta()`.
- Teste que mede ausência prova antes que a presença seria detectada (o caso "sem pasta" vem depois do caso "acervo depois do corte" reprovar).
- Commits conventional em PT-BR, sem citar ADR no título.
