# O formato das notas de release (versão 1)

Um arquivo por release, versionado no repositório, na pasta que o adaptador indicar (padrão: `docs/releases/`).

## Nome

`AAAA-MM-DD-<n>.md`, onde `<n>` é a ordem do release **naquele dia**: `1`, `2`, `3`… O número do PR de release **não** entra no nome, porque as notas nascem antes de ele existir.

## Exemplo

```markdown
---
data: 2026-10-04
ordem: 2
tipo: release
release: 777
resumo: A foto de produto chega nítida, e o aprovar deixa de pedir "assim mesmo" sem motivo
prs: [772, 776]
---

## Novidades
- A foto de produto passa a ser pedida no tamanho em que aparece numa tela grande, e a conferência mede o resultado. (#776)

## Correções
- O botão de aprovar só diz "assim mesmo" quando há algo contra. (#772)
```

## Frontmatter

Uma chave por linha, `chave: valor`, sem aninhamento.

| Chave | Obrigatória | Valor |
|---|---|---|
| `data` | sim | `AAAA-MM-DD`, igual à do nome |
| `ordem` | sim | inteiro ≥ 1, igual ao `<n>` do nome |
| `tipo` | sim | `release` ou `entregas-do-dia` (o segundo só para histórico de antes de haver release: um arquivo por dia de calendário) |
| `release` | não | número do PR de release, quando já se sabe (histórico, hotfix) |
| `resumo` | sim | uma linha, até 140 caracteres; aspas duplas em volta são opcionais |
| `prs` | sim | `[1, 2, 3]`: lista não vazia, sem repetição |

## Corpo

- Só três seções, nesta ordem: `## Novidades`, `## Correções`, `## Bastidores`. Seção vazia é **omitida**, e pelo menos uma existe.
- Cada item é **uma** linha de lista, terminada pelo rastro: `- texto. (#N)` ou `- texto. (#N, #M)`.
- Todo `#N` do corpo está em `prs`, e todo número de `prs` aparece em algum item.
- Um PR aparece em **um** arquivo só, em toda a pasta.
- Nada de citar documento interno: `SPEC-`, `ADR`, `§`.

| Seção | O que entra |
|---|---|
| Novidades | o que quem usa passa a conseguir fazer ou ver |
| Correções | o que funcionava errado e passa a funcionar |
| Bastidores | o que não muda a tela: infra, teste, documentação, desempenho invisível |

`scripts/validar.mjs <pasta|arquivo>` confere tudo isto.
