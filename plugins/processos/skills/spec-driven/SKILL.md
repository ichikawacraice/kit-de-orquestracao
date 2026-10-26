---
name: spec-driven
description: O ritual documental do projeto — abrir uma SPEC nova, registrar um ADR, e fechar um item no roadmap e no diário. Use SEMPRE que for escrever ou mudar uma spec, tomar ou reverter uma decisão de arquitetura, marcar tarefa como concluída, ou quando terminar de implementar algo que já tem spec (a spec é atualizada na mesma sessão). Também vale quando a pessoa diz "documenta isso", "abre uma spec", "isso merece um ADR", "atualiza o roadmap", ou pergunta onde registrar uma decisão. Não cobre regras de build, migration ou deploy, que vivem no CLAUDE.md.
---

# O ritual documental

A documentação não descreve o que foi feito: é onde a coisa é decidida, e o código vem depois. Três rituais, cada um com um mecanismo que degenera sem conferência.

**A regra que governa os três:** divergência entre o que está escrito e o que o código faz é bug, e se corrige na mesma sessão — corrigindo o código ou a doc, nunca deixando os dois discordarem até amanhã.

Tudo em **PT-BR** (termo técnico em inglês é normal); código e identificadores seguem a convenção do projeto. Links entre docs sempre relativos e clicáveis; link para seção cita **âncora explícita** (`<a id="…"></a>` no destino), nunca um `#slug` escrito de cabeça.

## Onde mora cada coisa

Leia as pastas do `.claude/kit.json`, seção `documentos`. Sem a seção, valem os padrões:

| Chave | Padrão | O que é |
|---|---|---|
| `documentos.adr` | `docs/adr` | decisões, `NNNN-slug.md` |
| `documentos.specs` | `docs/specs` | contratos, `SPEC-NNN-slug.md` |
| `documentos.roadmap` | `docs/roadmap.md` | índice do progresso, uma linha por item |
| `documentos.diario` | `docs/diario` | narrativa, uma entrada por arquivo em `AAAA-MM/DD-<ancora>.md` |
| `documentos.research` | `docs/research` | pesquisa datada (snapshot) |
| `documentos.planos` | `docs/planos` | planos por data |

O vocabulário de status e os orçamentos (400 caracteres por linha do roadmap, 150 KB por entrada do diário (e por parte do acervo antigo)) são os padrões deste texto; `documentos.estados` e `documentos.orcamentos` do `kit.json` os trocam, e `documentos.docs` é a raiz de onde os links relativos são conferidos.

Se o projeto tem orquestradora ativa, **peça a ela o número** (ADR, SPEC) antes de escrever o arquivo; sem orquestradora, confira o maior existente e some um. Número nunca é reutilizado. Número reservado sem spec escrita fica registrado no índice, de forma explícita.

## Abrir ou mudar uma SPEC

Specs vivem em `<documentos.specs>/SPEC-NNN-slug.md`, três dígitos. O cabeçalho é uma linha só:

```
- **Data:** AAAA-MM-DD · **Revisões:** AAAA-MM-DD (o que mudou) · **Status:** Implementada · **Pendências:** critério 4 pende do primeiro uso real
```

**`Status` é UMA palavra deste vocabulário fechado:** `Rascunho`, `Em revisão`, `Aprovada`, `Implementada`, `Substituída`. Nada além disso.

Quando status e nuance dividem o mesmo campo, aparecem estados inventados ("Parcialmente implementada", "Fase 1 implementada") e o campo deixa de responder à única pergunta que importa: *dá para confiar no que está escrito aqui?* Por isso a nuance mora em `Pendências:`, livre e opcional (ausente = não falta nada). **Meia implementação é `Aprovada` com pendência, não um estado novo.**

**Spec no presente só afirma o que existe.** Mecanismo planejado e não implementado vai para `Pendências:`.

Depois de criar a spec ou mudar o status, atualize a linha dela no índice (`<documentos.specs>/README.md`). Índice e cabeçalho são conferidos por `scripts/kit/as-docs-concordam.mjs` (o gate do projeto): quando a regra está ligada (`documentos.conferir`), status fora do vocabulário, ou índice discordando da spec, reprovam. Uma spec = um componente ou contrato coeso; passou de ~300 linhas, provavelmente são duas. Cite os ADRs relacionados, e faça o ADR citar a spec de volta.

## Registrar um ADR

ADRs vivem em `<documentos.adr>/NNNN-slug.md`, quatro dígitos, sequenciais, e são **imutáveis depois do merge**: nunca edite a decisão de um ADR aceito. Para reverter, escreva um novo que o supersede e mude o status do antigo para `Superseded por NNNN`. O histórico de por que pensávamos diferente impede refazer a mesma discussão daqui a seis meses. (Antes do merge, o ADR ainda é rascunho: pode ser editado.)

Use o modelo de `<documentos.adr>/README.md` inteiro. **"Alternativas consideradas" é seção obrigatória**, não enfeite: um ADR que só afirma a decisão escolhida não ajuda ninguém, o valor está em saber o que foi descartado e por quê — é exatamente o que alguém vai propor de novo.

Em **Contexto**, escreva fatos verificáveis — commit, arquivo, medição, erro real. "Parecia mais limpo" não é contexto. Terminado o ADR, adicione a linha no índice do README.

**O que merece ADR:** decisão que restringe escolhas futuras ou que alguém razoável questionaria depois. Escolher uma biblioteca por conveniência, não; decidir que o ambiente de execução não herda a configuração da máquina, sim.

## Fechar um item

Ao concluir ou iniciar tarefa relevante, atualize o roadmap **na hora** — fonte de verdade do progresso, uma linha por item, com a data, **em até 400 caracteres e no máximo 2 links de rastro** (a spec e o ADR principais). Tarefa nova relevante entra na fase certa.

A linha é curta e diz o que mudou **e por que importava**; a narrativa longa vai em `<documentos.diario>/AAAA-MM/DD-<ancora>.md`, um arquivo novo por entrada (âncora `[a-z0-9-]+`, declarada com `<a id>` na linha acima do título), apontada da linha por `· [detalhe](diario/AAAA-MM/DD-<ancora>.md#<ancora>)`. Item que cresce depois do merge ganha entrada nova (outro dia, outra âncora); a entrada mergeada não se reescreve. Sem índice por pasta. O acervo `AAAA-MM.md`/`-parte-N.md` fica, mas não cresce: mês novo é pasta.

**Item que cresce ganha ENTRADA NOVA no diário, nunca a linha mais longa.** Linha que engorda vira índice ilegível; com `documentos.conferir` ligado, o gate reprova a linha acima de 400 caracteres, o terceiro link e a âncora que não existe no destino.

**Fraco:** `- [x] Corrigido bug na promoção — 2026-08-15`

**Bom:** `- [x] **Promoção interrompida vira desfecho** — carimbo de início + varredor: processo morto no meio devolve o candidato à fila em 15 min, em vez de deixar o card girando para sempre — 2026-08-15`

O segundo permite a alguém, daqui a três meses, entender o que mudou sem abrir o diff.

## Armadilhas que custam caro

- **Texto de UI não cita spec nem ADR.** Nada de `SPEC-014`, `ADR 0014`, `§3` em label, tooltip, mensagem de erro ou e-mail — inclusive no que nasce no back-end (log, detalhe de estado, erro de comando) e chega à tela. Escreva o que a coisa É. A rastreabilidade vive no código, no commit e nas docs.
- **Pesquisa envelhece.** Arquivos de `<documentos.research>` são snapshots datados: **não se editam**. Para usar algo crítico deles numa decisão nova (preço, endpoint, nome de ferramenta), revalide antes.
- **Commitado não é mergeado.** "Imutável" e "Implementada" valem depois do merge, não do commit.

## Commits

Conventional commits **em PT-BR**, escopo entre parênteses: prefixo e escopo em inglês (`docs:`, `feat:`, `fix:`), assunto em português. Referencie a spec ou o ADR **no corpo**, não no título.
