# Conflitos com outros plugins

O kit convive com os seus plugins, skills, hooks e o seu `CLAUDE.md`. Onde dois mandam coisas diferentes, a sessão obedece a um e briga com o outro. Os casos conhecidos e a saída de cada um:

| Conflito | O que acontece | Saída |
|---|---|---|
| **Hook do kit também no `~/.claude/settings.json`** (cópia antiga, de antes do plugin) | A trava dispara duas vezes | `kit doutor` aponta cada um (`hook do kit também em ~/.claude/settings.json`). Apague a cópia do `settings.json`; o plugin é a fonte |
| **Skill ou plugin que manda subagente escrever código** | O subagente é recusado pela trava `subagente-nao-edita` e a skill para no meio | Escolha um modelo: a sessão escreve e o subagente só lê ou revisa (o do kit), ou libere o tipo daquele subagente em `~/.claude/orquestracao/subagente-pode-escrever.txt`. Veja [o que ligar e desligar](ligar-e-desligar.md) |
| **Outro hook `PreToolUse` sobre git ou testes** | Duas perguntas para o mesmo comando, ou uma recusa que a outra não explica | Fique com uma guarda: tire do `guarda.regras` do `kit.json` a regra que o outro hook já cobre |
| **O `CLAUDE.md` do projeto diz outra regra** (outro comando de teste, merge commit, outro formato de commit) | A sessão lê as duas e escolhe uma | O `kit adotar` avisa quando os blocos do kit podem contradizer o seu texto. Ajuste o seu texto ou o `kit.json`; não edite dentro das marcas `kit:` (o `kit atualizar` troca o que está lá) |
| **Instruções pessoais no `~/.claude/CLAUDE.md`** que contradizem o kit | Vale para todo projeto, inclusive os com o kit | Deixe lá só o que é seu de verdade (idioma, estilo); a regra de projeto vai no `CLAUDE.md` do projeto |
| **Dois plugins com o mesmo nome** em marketplaces diferentes | Skills e agentes se chamam `<plugin>:<nome>`: os dois dividem o prefixo e um encobre o outro. Foi o caso do plugin `design` do kit com o `design` da Anthropic, e por isso o do kit se chama `kit-design` | Desligue um deles no projeto (`enabledPlugins`) |

Quando aparecer um conflito que não está aqui, a forma de achar a causa: veja qual hook recusou (o motivo da recusa nomeia a trava) e procure-o em [o que ligar e desligar](ligar-e-desligar.md).
