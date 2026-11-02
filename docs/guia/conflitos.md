# Conflitos com plugins de fora

O kit decide num catálogo ([`plugins/orquestracao/skills-de-fora.json`](../../plugins/orquestracao/skills-de-fora.json), [ADR 0014](../adr/0014-o-kit-decide-as-skills-de-fora-num-catalogo.md)) o que faz com cada plugin de fora que costuma estar instalado. O `kit doutor` confere a sua máquina contra ele: o que falta instalar é falha, com o comando; o que vale desligar é aviso.

<a id="precisa-ter"></a>
## Precisa ter
- `superpowers` (marketplace oficial `claude-plugins-official`): as skills de planejar, testar antes e conferir antes de dizer pronto, que a sessão dona carrega em toda etapa, são dele. Vem junto ao instalar o plugin `orquestracao`, desde que o marketplace oficial esteja adicionado (`claude plugin marketplace add anthropics/claude-plugins-official`); sem ele o `install` avisa e o `orquestracao` não carrega. Quem instalou o kit antes vê a falta no `kit doutor`.

<a id="barradas"></a>
## O que o kit barra
Só as skills que quebram uma regra do kit, não as que apenas repetem. Em projeto com o kit (`.claude/kit.json` ou blocos `kit:` no `CLAUDE.md`), a sessão que tentar usá-las, pela ferramenta ou digitando `/nome`, recebe a recusa com a peça certa:

| Skill barrada | Use no lugar | A regra que ela quebra |
|---|---|---|
| `engineering:architecture` | `processos:spec-driven` | ADR com número reservado, na pasta do projeto e com "Alternativas consideradas" |
| `engineering:code-review` | `orquestracao:validador` | a revisão antes do PR é por subagente de contexto limpo, só com o que afeta correção |
| `superpowers:requesting-code-review` | `orquestracao:validador` | idem |
| `design:design-critique` | o crítico de UI do plugin de design do kit | a crítica que conta é a do subagente crítico, com nota de 0 a 30 e teto de recríticas |

Para liberar uma delas num projeto, ponha o nome em `skillsDeFora.liberar` do `.claude/kit.json`. Fora de projeto com o kit, nada é barrado.

<a id="absorvidas"></a>
## O que é absorvido
A ideia boa de uma skill de fora é reescrita no formato da casa, com crédito à fonte, em vez de copiada. Enquanto a versão da casa não sai, a original segue livre.
- `design:accessibility-review` e `design:ux-copy` vão para o plugin de design system do projeto, quando houver (acessibilidade presa aos tokens da base, texto de interface em PT-BR com as regras de mensagem).

<a id="desligar"></a>
## O que desligar, se não usa
Os plugins da Anthropic `engineering`, `design`, `data` e `cowork-plugin-management` costumam chegar pela conta do app e carregam a descrição de cada skill em toda sessão. O kit não depende de nenhum deles, e as skills não barradas seguem livres. Se você não as usa:
- os da conta: desligue na lista de plugins da conta, no app;
- os instalados pelo CLI: `claude plugin disable <plugin> --scope local` desliga só para você, neste projeto.

A sessão fica mais leve e não sobra skill repetida.
