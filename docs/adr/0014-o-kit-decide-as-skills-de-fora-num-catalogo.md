# ADR 0014 — O kit decide as skills de fora num catálogo: depende, barra, absorve ou deixa livre

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F333, a pedido do operador
- Relacionados: [ADR 0013](0013-o-pedido-e-ponto-de-partida-nao-ordem.md) (análise do pedido); F332 (renomear o plugin `design` do kit, que colide com o da Anthropic); catálogo em `plugins/orquestracao/skills-de-fora.json`

<a id="contexto"></a>
## Contexto
- O operador instalou plugins da Anthropic (`engineering`, `design`, `data`, `cowork-plugin-management`, ~30 skills). Alguns repetem o que o kit já faz e fazem pior para as regras dele: `engineering:architecture` escreve ADR sem número reservado, fora de `docs/adr` e sem `Alternativas consideradas`; `engineering:code-review` disputa com o `orquestracao:validador`; `design:design-critique` com o crítico de UI do kit.
- O kit já **depende** de skills de fora sem dizer: as fixas da dona (`superpowers:writing-plans`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`, em `pool/skills-por-etapa.json`) são do plugin `superpowers`, e o README não manda instalá-lo. Quem instala o kit numa máquina limpa fica sem elas, calado.
- O que se mediu no Claude Code 2.1.316 (doc oficial e o próprio binário):
  - `skillOverrides` (`on` · `name-only` · `user-invocable-only` · `off`) **não vale para skill de plugin** ("Plugin skills are not affected by `skillOverrides`"). Plugin só se liga e desliga inteiro (`enabledPlugins`).
  - O manifesto de plugin tem `dependencies`: `claude plugin install` instala e liga as dependências junto, e `disable` recusa desligar uma dependência de plugin ligado. Dependência em outro marketplace pede `allowCrossMarketplaceDependenciesOn` no `marketplace.json` raiz.
  - Hook `PreToolUse` com matcher `Skill` recusa a skill que o modelo chama; o `/nome` digitado pela pessoa não passa por ele, passa pelo `UserPromptExpansion` (`command_name`, recusa com `decision: "block"`).
  - Os plugins da Anthropic do operador chegam pela conta do app (diretório `anthropic-plugin-directory`), não aparecem em `claude plugin list` nem em `installed_plugins.json`: só a tela de plugins do app os desliga.
- Copiar uma skill de fora para dentro do kit envelhece (a original muda, a cópia não) e, se a pessoa tiver as duas, duplica.

<a id="decisao"></a>
## Decisão
1. **Um catálogo versionado no plugin `orquestracao`** (`skills-de-fora.json`) dá a cada plugin e skill de fora conhecida uma de quatro saídas, com o motivo:
   - `depender` — o kit chama a skill num passo dele; o plugin a declara em `dependencies` e ela chega junto na instalação.
   - `barrar` — quebra uma regra do kit (não basta repetir uma peça dele); o kit recusa a chamada e diz qual peça usar. Repetir sem quebrar regra fica `livre`: a trava é leve de propósito.
   - `absorver` — a ideia completa uma peça do kit ou do plugin wicomm (o design system da casa); ela é reescrita no formato de lá (com crédito à fonte e licença conferida, sem copiar o texto). Enquanto não foi absorvida (`feito: false`) a skill fica livre; absorvida, é barrada como duplicata.
   - `livre` — fora do escopo do kit; ele não opina.
   Skill sem linha própria herda a saída do plugin dela; plugin fora do catálogo é livre.
2. **`superpowers@claude-plugins-official` é dependência declarada** do plugin `orquestracao` (`dependencies` + `allowCrossMarketplaceDependenciesOn: ["claude-plugins-official"]`). É o "instalar automaticamente" com consentimento: a pessoa aceita ao instalar o kit, e a saída do `claude plugin install` lista o que veio junto.
3. **A trava `skills-de-fora.mjs`** (`PreToolUse` em `Skill` e `UserPromptExpansion`) recusa a skill `barrar` (e a `absorver` já feita, ou a que o projeto substituiu em `skillsDeFora.substitutas`, apontando a substituta) com "use <peça>", chamada pelo nome completo ou pelo curto quando ele é único no catálogo (salvo o curto que é skill própria do projeto ou da conta, ou a substituta), **só em projeto que usa o kit** (`.claude/kit.json` ou bloco `<!-- kit:` no `CLAUDE.md`, da pasta da sessão até a raiz do git). O projeto libera uma skill pela lista `skillsDeFora.liberar` do `.claude/kit.json`. Erro da trava deixa passar.
4. **O `kit doutor` diz o que ter e o que desligar**, em PT-BR: dependência faltando é falha, com o comando de instalar; plugin de fora presente com skill barrada é aviso, com a lista do que o kit barra, o que fica livre e como desligar o plugin inteiro (no app, para o que veio pela conta; `claude plugin disable … --scope local`, só para a pessoa, para o do CLI) quando a pessoa não usa as livres. O doutor não instala nem desliga nada: quem decide é a pessoa.
5. **O guia de conflitos (`docs/guia/conflitos.md`) diz o mesmo para quem chega:** o que vem junto, o que o kit barra e por quê, o que é absorvido e o que desligar para não pagar descrição à toa. O README só aponta para ele.
6. **A absorção de design vai para o plugin wicomm** (combinado entre as orquestradoras do kit e do wicomm-design-system): `design:accessibility-review` e `design:ux-copy` viram peças do wicomm, presas aos tokens e às regras de mensagem da base. O catálogo as marca `feito: true` quando o wicomm as tiver, numa fatia seguinte deste item.

<a id="alternativas"></a>
## Alternativas consideradas
- **Copiar as skills boas para dentro do kit.** Rejeitada: a cópia envelhece e duplica para quem tem a original; o crédito e a licença viram dívida a cada atualização.
- **`permissions.deny` com `Skill(skill:engineering:architecture)` no `settings.json` do projeto.** Adiada: é nativo e cobre os outros nomes da skill, mas não o `/nome` digitado (que pede o `UserPromptExpansion` de qualquer jeito), e escrever permissão no settings do projeto é chave nova para o `kit adotar`/`atualizar` manter e o `remover` tirar. A trava casa o nome curto (sem o prefixo do plugin) quando ele é único no catálogo, que era o que o deny ganhava; se aparecer escape que só o deny pega, ele entra como camada a mais.
- **`skillOverrides: "off"` no `settings.json` do projeto.** Rejeitada: a doc diz que não vale para skill de plugin; teria sido o melhor (some até a descrição), e o catálogo passa a usá-lo se o Claude Code mudar.
- **Nenhuma dependência de terceiro, só absorção** (proposta do wicomm-design-system). Rejeitada para o `superpowers`: o kit já não funciona sem ele (são as fixas da dona); declarar a dependência só torna explícito o que já era exigido calado. Para o resto, vale: nada mais vira dependência.
- **O CLI desligar ou instalar plugins sozinho.** Rejeitada: mexe na máquina da pessoa sem ela ver, e os plugins da conta não têm comando de CLI que os desligue. A dependência declarada cobre o instalar com o consentimento da instalação do kit; o doutor cobre o resto com o comando pronto.
- **Barrar em toda sessão em que o plugin `orquestracao` está ligado.** Rejeitada: o plugin costuma ficar ligado na conta inteira, e num projeto sem o kit as regras de ADR e de revisão do kit não valem; lá a skill de fora é a melhor que a pessoa tem.
- **Só texto no README e no `CLAUDE.md`, sem trava.** Rejeitada: a descrição da skill de fora puxa o modelo para ela em todo pedido que casa ("write an ADR"), e o texto do kit não ganha sempre; o conflito já aconteceu.
- **Barrar toda skill que repete o kit (`engineering:debug`, `engineering:documentation`).** Rejeitada: repetir não quebra regra, e trava demais vira atrito sem ganho; a descrição da original continua no contexto de qualquer jeito.
- **Barrar o plugin inteiro (`engineering`, `design`).** Rejeitada: a maior parte das skills deles não tem par no kit (`incident-response`, `deploy-checklist`, `standup`, `ux-copy`, `design-system`); o kit barra só a duplicata e o doutor sugere desligar o resto quando a pessoa não usa.

<a id="consequencias"></a>
## Consequências
- Quem instala o `orquestracao` recebe o `superpowers` junto, se o marketplace oficial estiver adicionado (medido com `CLAUDE_CONFIG_DIR` temporário no Claude Code 2.1.316: com ele, vem junto, e adicionar o marketplace depois instala a dependência pendente; sem ele, o `install` avisa "will not load without it"). Por isso o README adiciona o marketplace oficial antes do kit.
- **Risco:** máquina com o kit e sem o `superpowers` (ou com o marketplace oficial bloqueado pela organização) perde o plugin `orquestracao` inteiro, travas inclusive, ao atualizar para a versão com a dependência. O `kit doutor` reprova esse caso com os dois comandos; quem atualiza os plugins confere antes.
- A descrição das skills barradas continua no contexto até a pessoa desligar o plugin: a trava evita o uso errado, não o custo. O doutor e o README dizem como cortar o custo.
- Skill nova de fora que duplique o kit só é barrada depois de entrar no catálogo; o catálogo cresce por PR, com o motivo.
- O detector de plugins da conta lê o manifesto do app (`local-agent-mode-sessions/*/*/rpm/manifest.json`), caminho não documentado: se o app mudar, o doutor deixa de ver esses plugins e só diz o que vê pelo CLI.
