# ADR 0015 — O plugin declara as skills de fora que ele substitui, e o kit as aplica onde ele está ligado

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F340, a partir da contraproposta da orquestradora de um design system distribuído como plugin
- Relacionados: [ADR 0014](0014-o-kit-decide-as-skills-de-fora-num-catalogo.md) (o catálogo e a trava `skills-de-fora`); guia em [`docs/guia/conflitos.md#absorvidas`](../guia/conflitos.md#absorvidas)

<a id="contexto"></a>
## Contexto
- Pelo ADR 0014, a skill de fora marcada `absorver` só é barrada no projeto que declara a peça que a absorveu, em `skillsDeFora.substitutas` do `.claude/kit.json`.
- Um design system distribuído como plugin é usado por vários apps. Com a declaração só no projeto, cada app repete o mesmo bloco, e o app que esquece segue chamando a original.
- Medido no Claude Code desta máquina: campo desconhecido no `plugin.json` sai como aviso ("Unknown field … Claude Code ignores it") e o `claude plugin validate --strict` reprova; um arquivo à parte na raiz do plugin não gera aviso.
- A trava roda dentro do plugin `orquestracao` e só sabe dos outros plugins pelo disco: o `enabledPlugins` dos `settings` (conta, projeto, local) e o `installed_plugins.json` (escopo e pasta de cada instalação).

<a id="decisao"></a>
## Decisão
1. **O plugin declara as substitutas dele em `substitutas.json`, na raiz do plugin:** `{ "substitutas": { "<skill de fora>": "<plugin>:<peça>" } }`. A trava as aplica em todo projeto com o kit onde o plugin está ligado.
2. **Limite de confiança:** a linha do plugin só vale se a chave for o nome completo de uma skill `absorver` do catálogo do kit e o valor for uma peça do próprio plugin (`<nome do plugin>:<nome>`). O nome curto da peça não pode ser o de outra skill do catálogo (a peça pelo nome curto passa como da casa, e com o nome de uma barrada a liberaria), e o plugin dono da original não se declara substituto dela. Um plugin não barra o que o kit barra, deixa livre ou tem como dependência, nem aponta peça de outro. Linha fora disso é ignorada.
3. **Ligado** é o `enabledPlugins` mais próximo dizendo `true` (`settings.local.json` e `settings.json` do projeto, depois o da conta), com o plugin instalado pelo CLI num escopo que vale para a pasta da sessão (`user`, ou `project`/`local` de uma pasta que a contém). Plugin que só a conta do app traz não entra.
4. **Precedência:** o `kit.json` do projeto vence o plugin, por skill; `skillsDeFora.liberar` vence os dois. Dois plugins ligados para a mesma skill: vale o primeiro em ordem de id.
5. **A peça pode ser skill ou agente;** o guia recomenda a skill, que a sessão chama direto.

<a id="alternativas"></a>
## Alternativas consideradas
- **Um campo no `plugin.json`.** Rejeitada: o validador estrito reprova campo desconhecido, e o plugin que roda `--strict` no próprio gate quebraria.
- **Seguir só com o `kit.json` de cada projeto.** Rejeitada: repete o bloco em todo app e falha calado no app que esquece.
- **Aceitar a declaração do plugin sem limite.** Rejeitada: qualquer plugin instalado passaria a barrar skill alheia, inclusive as dependências do kit.
- **Ler os plugins de todo o cache, ligados ou não.** Rejeitada: a recusa mandaria usar uma peça que não está disponível no projeto.
- **Perguntar ao `claude plugin list` quais estão ligados.** Rejeitada: subprocesso do CLI a cada chamada de skill é lento para um hook, e a leitura do disco dá o mesmo.

<a id="consequencias"></a>
## Consequências
- O app que liga o plugin do design system ganha a trava sem tocar no `kit.json`; o `kit.json` fica para a exceção.
- O formato do `installed_plugins.json` e a ordem das camadas do `enabledPlugins` são do Claude Code: se mudarem, a declaração do plugin deixa de valer (a trava deixa passar, não recusa à toa).
- O plugin da conta do app (fora do CLI) não declara substitutas por este caminho; o projeto ainda pode declará-las no `kit.json`.
- O kit não confere se a peça existe no plugin: nome errado barra a original e aponta para o nada até o plugin corrigir.
- O `kit doutor` não lista as substitutas dos plugins (fica para depois, se fizer falta).
