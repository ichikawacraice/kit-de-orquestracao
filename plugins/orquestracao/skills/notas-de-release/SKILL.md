---
name: notas-de-release
description: Gera as notas de release (release notes, patch notes, changelog) de um repositório — um arquivo datado por release em docs/releases/, escrito para quem USA o produto, a partir dos PRs que entram (título e caso), separado em Novidades, Correções e Bastidores. Use ANTES de abrir um PR de release ("vou abrir o release", "faz o release", "release develop → main"), logo depois de mergear um hotfix na main, quando pedirem "gera as notas", "release notes", "patch notes", "notas de release", "changelog", "o que mudou nesta versão", ou para gerar o histórico de releases já feitos. Só gera o documento; página que o exiba é de cada projeto.
---

# Notas de release

O produto desta skill é **um arquivo** por release, no formato de [`formato.md`](formato.md). Ele é a fonte única: um projeto pode ter uma página que o lê, mas a skill não sabe nada dela.

## 0. Leia o adaptador do repositório

`docs/releases/README.md` diz o que é deste repositório:
- `- base:` e `- head:` do release (por exemplo `main` e `develop`);
- quem lê as notas;
- o glossário;
- o que é proibido escrever (nomes de cliente, por exemplo);
- onde as notas aparecem.

Leia-o **inteiro** antes de escrever. Sem adaptador: base `main`, head `develop` (ou só `main`, se não houver `develop`), e **pergunte quem lê** antes de escrever, porque o público decide a linguagem. Ofereça criar o adaptador com o que a pessoa responder.

## 1. Colete

```bash
node ~/.claude/skills/notas-de-release/scripts/coletar.mjs                  # o release que vai abrir: head e não base
node ~/.claude/skills/notas-de-release/scripts/coletar.mjs --pr 712         # hotfix já mergeado na base
node ~/.claude/skills/notas-de-release/scripts/coletar.mjs --release 777    # histórico: um PR de release mergeado
node ~/.claude/skills/notas-de-release/scripts/coletar.mjs --dia 2026-08-14 # histórico: os PRs de um dia, antes de haver release
```

O JSON traz `data`, `ordem` (a próxima livre naquele dia), `release`, e `prs[]` com número, título, tipo e `caso` (a seção *O caso* do PR). Também traz `excluidos[]`: o PR já citado em outra nota, o das próprias notas e o commit sem PR. **Leia `excluidos`**: um commit sem PR na faixa é sinal de que alguém empurrou direto, e vale avisar.

Sem PR novo, não há notas a escrever: diga isso e pare.

## 2. Escreva

Siga [`escrita.md`](escrita.md): o efeito para quem usa, uma linha por mudança, nada inventado, nada proibido pelo adaptador. Grave em `<pasta>/<data>-<ordem>.md`. Em lote de histórico, um arquivo por chamada do `coletar.mjs`.

## 3. Confira

```bash
node ~/.claude/skills/notas-de-release/scripts/validar.mjs docs/releases
```

Verde antes de seguir. Se o repositório tiver teste próprio sobre a pasta, rode-o também.

## 4. Leve ao repositório — antes do release

1. Branch curta saindo da head (`docs/notas-AAAA-MM-DD`), commit `docs(releases): notas do release de DD/MM`.
2. PR com base na **head** (`develop`) e merge, seguindo a regra de merge do repositório.
3. **Só então** abra o PR de release `head → base`: ele já leva as notas.

Se entrar outro PR na head entre as notas e o release, rode a skill de novo. Ela só pega o que falta e grava um arquivo com a ordem seguinte do dia.

**Hotfix** (PR direto na base): logo depois do merge, `--pr <n>`, e leve o arquivo à head por PR. Ele aparece no próximo release.
