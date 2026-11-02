# ADR 0017 — O marketplace se chama `ichikawa-kit`, e o kit lê o nome antigo até cada máquina migrar

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F344, a partir da decisão do operador de unificar o kit num marketplace só com plugins opcionais
- Relacionados: [ADR 0001](0001-plugin-para-o-nucleo-cli-para-o-projeto.md) (plugin para o núcleo, CLI para o projeto); plano em [`docs/planos/2026-11-02-marketplace-ichikawa-kit.md`](../planos/2026-11-02-marketplace-ichikawa-kit.md); guia em [`docs/guia/comandos.md#kit-migrar-marketplace`](../guia/comandos.md#kit-migrar-marketplace)

<a id="contexto"></a>
## Contexto
- O operador quer o kit com o nome "Ichikawa's Kit", num marketplace só em que a pessoa escolhe os plugins. O id do marketplace aceita letras, dígitos, `.`, `_` e `-`, e o marketplace não tem campo de nome de exibição (doc do Claude Code, referência do `marketplace.json`).
- O id do marketplace está em cada id de plugin (`plugin@marketplace`): `enabledPlugins`, `pluginConfigs`, `extraKnownMarketplaces`, `installed_plugins.json`, o cache, a pasta de dados (`~/.claude/plugins/data/<plugin>-<marketplace>`) e os repasses que a K8 gravou em `~/.claude/skills/orquestradora/scripts/`.
- Medido com o CLI real num HOME temporário: trocar o `name` no manifesto não migra quem já tem o marketplace. O `marketplace update` mantém o registro com o nome antigo, os plugins seguem como `p@antigo` e o `marketplace add` da mesma origem responde que já está no disco. Só migra quem remove o antigo e adiciona de novo, e o `remove` leva o liga/desliga, as opções e a pasta de dados dos plugins (o `uninstall --keep-data` a preserva).

<a id="decisao"></a>
## Decisão
1. **O id é `ichikawa-kit`; "Ichikawa's Kit" vai na `description` do manifesto e no README.** O repositório continua `kit-de-orquestracao`, e com ele o `marketplace add` e o `npx … kit`.
2. **O código grava só o nome novo e lê os dois** enquanto houver máquina com o antigo: o gate e o hook do `kit-design` (opções e liga/desliga), o `atualizar-plugins` e o `pode-reiniciar` (usam o nome com que a conta tem os plugins, o novo primeiro), o `kit doutor` (avisa do antigo), o `kit remover` e os repasses da K8.
3. **A troca de uma máquina é o `kit migrar-marketplace`,** pelo CLI do GitHub e não pelo plugin que ele troca. Seco por padrão. O `--aplicar` faz backup e recusa se o publicado ainda não tem o nome novo. Depois troca os plugins da conta e dos projetos, com o liga/desliga, as opções declaradas e os dados, e reescreve os repasses. A falha no meio desfaz sozinha, e o `--desfazer <backup>` volta ao estado de antes.
4. **O projeto troca no `kit atualizar`,** como no `design` → `kit-design`: a chave antiga vira a nova no mesmo lugar e com o mesmo valor. O `settings.local.json` é da pessoa: o `atualizar` só avisa, e o `migrar-marketplace`, que a pessoa roda de propósito, troca com backup.
5. **O nome do kit é exceção do detector de nome do autor** nas duas formas (`ichikawa-kit`, "Ichikawa's Kit"), como já é o endereço publicado. O nome solto continua barrado.

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter o id `kit-de-orquestracao` e pôr "Ichikawa's Kit" só na exibição.** Rejeitada: o marketplace não tem campo de exibição, e o nome que a pessoa digita no `install` seguiria o antigo.
- **Renomear também o repositório.** Adiada: o GitHub redirecionaria, mas cada `extraKnownMarketplaces` gravado aponta para o nome atual e o ganho é só cosmético. Se vier, é item à parte, depois de as máquinas migrarem.
- **Só trocar o nome e deixar o código no novo.** Rejeitada: quem não migrou recebe as versões novas pelo id antigo, e o código deixaria de achar os próprios plugins (opções, liga/desliga, atualização e painel).
- **Migrar editando os JSON do Claude Code à mão.** Rejeitada: o formato interno não é contrato. Refazer pelo CLI (`uninstall`, `marketplace remove/add`, `install --config`, `disable`) usa o caminho documentado, e o backup cobre o resto.
- **A migração como script do plugin `orquestracao`.** Rejeitada: ela desinstala o plugin de onde rodaria, e quem não tem o plugin atualizado não a teria.
