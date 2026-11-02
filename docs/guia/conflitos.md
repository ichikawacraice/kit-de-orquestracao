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
| **Skill de fora que faz o mesmo que uma peça do kit** (ex.: `engineering:architecture` escreve ADR do jeito dela) | A sessão segue a skill de fora e quebra a regra do projeto | O kit barra as que quebram regra e aponta a peça certa; veja [o que o kit barra](#barradas) e [o que desligar](#desligar) |

Quando aparecer um conflito que não está aqui, a forma de achar a causa: veja qual hook recusou (o motivo da recusa nomeia a trava) e procure-o em [o que ligar e desligar](ligar-e-desligar.md).

<a id="skills-de-fora"></a>
## Skills de fora: o que ter e o que desligar

O kit também decide num catálogo ([`plugins/orquestracao/skills-de-fora.json`](../../plugins/orquestracao/skills-de-fora.json), [ADR 0014](../adr/0014-o-kit-decide-as-skills-de-fora-num-catalogo.md)) o que faz com cada plugin de fora que costuma estar instalado. O `kit doutor` confere a sua máquina contra ele: o que falta instalar é falha, com o comando; o que vale desligar é aviso.

<a id="precisa-ter"></a>
### Precisa ter
- `superpowers` (marketplace oficial `claude-plugins-official`): as skills de planejar, testar antes e conferir antes de dizer pronto, que a sessão dona carrega em toda etapa, são dele. Vem junto ao instalar o plugin `orquestracao`, desde que o marketplace oficial esteja adicionado (`claude plugin marketplace add anthropics/claude-plugins-official`); sem ele o `install` avisa e o `orquestracao` não carrega. Quem instalou o kit antes vê a falta no `kit doutor`.

<a id="barradas"></a>
### O que o kit barra
Só as skills que quebram uma regra do kit, não as que apenas repetem. Em projeto com o kit (`.claude/kit.json` ou blocos `kit:` no `CLAUDE.md`), a sessão que tentar usá-las, pela ferramenta (com ou sem o prefixo do plugin, salvo o `code-review`, que só com ele: o `/code-review` do Claude Code tem o mesmo nome) ou digitando `/nome`, recebe a recusa com a peça certa:

| Skill barrada | Use no lugar | A regra que ela quebra |
|---|---|---|
| `engineering:architecture` | `processos:spec-driven` | ADR com número reservado, na pasta do projeto e com "Alternativas consideradas" |
| `engineering:code-review` | `orquestracao:validador` | a revisão antes do PR é por subagente de contexto limpo, só com o que afeta correção |
| `superpowers:requesting-code-review` | `orquestracao:validador` | idem |
| `design:design-critique` | `kit-design:critico-de-ui` | a crítica que conta é a do subagente crítico, com nota de 0 a 30 e teto de recríticas |

Para liberar uma delas num projeto, ponha o nome em `skillsDeFora.liberar` do `.claude/kit.json`. Fora de projeto com o kit, nada é barrado.

<a id="absorvidas"></a>
### O que é absorvido
A ideia boa de uma skill de fora é reescrita no formato da casa, com crédito à fonte, em vez de copiada. Enquanto a versão da casa não sai, a original segue livre.
- `design:accessibility-review`, `design:ux-copy` e `design:design-system` vão para o design system do projeto, quando houver (acessibilidade presa aos tokens da base, texto de interface em PT-BR com as regras de mensagem, auditoria de valor solto).
- O projeto que tem a versão da casa a declara no `.claude/kit.json`, e a original passa a ser recusada ali, apontando para a substituta:
  ```json
  { "skillsDeFora": { "substitutas": { "design:accessibility-review": "<plugin do design system>:<skill de acessibilidade>" } } }
  ```

<a id="desligar"></a>
### O que desligar, se não usa
Os plugins da Anthropic `engineering`, `design`, `data` e `cowork-plugin-management` costumam chegar pela conta do app e carregam a descrição de cada skill em toda sessão. O kit não depende de nenhum deles, e as skills não barradas seguem livres. Se você não as usa:
- os da conta: desligue na lista de plugins da conta, no app;
- os instalados pelo CLI: `claude plugin disable <plugin> --scope local` desliga só para você, neste projeto.

A sessão fica mais leve e não sobra skill repetida.
