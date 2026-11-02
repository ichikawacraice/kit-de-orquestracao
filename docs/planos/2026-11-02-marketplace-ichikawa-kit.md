# F344 · O kit vira um marketplace só, com nome novo e migração das instalações

## O que muda
O identificador do marketplace passa de `kit-de-orquestracao` a `ichikawa-kit`; o nome que aparece para quem usa é "Ichikawa's Kit". O repositório GitHub continua `ichikawacraice/kit-de-orquestracao`: o comando `npx … kit` e o `marketplace add` seguem os mesmos.

## Premissas conferidas
- **O id não aceita apóstrofo** (letras, dígitos, `.`, `_`, `-`) e **o marketplace não tem campo de nome de exibição**: "Ichikawa's Kit" vai na `description` do `marketplace.json` e no README (doc oficial, `marketplace-reference`).
- **Trocar o `name` no manifesto não migra ninguém** (medido com o CLI real num HOME temporário): `marketplace update` mantém o registro com o nome antigo, e os plugins seguem como `p@antigo`; `marketplace add` da mesma origem responde "already on disk". Só migra quem remove o marketplace antigo e adiciona de novo.
- **`marketplace remove` apaga** o `enabledPlugins`, o `pluginConfigs` e a pasta de dados (`~/.claude/plugins/data/<plugin>-<marketplace>`) dos plugins dele; `uninstall --keep-data` preserva a pasta. O cache antigo fica no disco.
- **Os atalhos `~/.claude/skills/orquestradora/scripts/{painel.mjs,proxima-pergunta.sh,proximo-item.sh}`** (gerados pela K8) têm `orquestracao@kit-de-orquestracao` fixo: sem troca, a migração quebraria o painel e o Q-ID de todas as sessões.
- Nenhum plugin do kit declara opção `sensitive`: não há segredo no keychain a perder.

## Decisões (assumidas, a confirmar)
1. **O código aceita os dois nomes durante a transição.** Quem ainda não migrou recebe as versões novas pelo id antigo (o `update` não migra); o código novo não pode deixar de achar os próprios plugins. Grava sempre o nome novo; lê o novo e o antigo.
2. **A migração é o subcomando `kit migrar-marketplace`** do CLI (`npx -y github:…`): roda do GitHub, independente do plugin instalado que ela vai trocar. Seco por padrão; `--aplicar`; `--desfazer <backup>`. Falha no meio desfaz sozinha.
3. **Projetos:** o `kit atualizar` troca as chaves antigas pelas novas no `.claude/settings.json` (como já faz com `design` → `kit-design`); o `migrar-marketplace` também troca os projetos que achar (instalações de escopo projeto e `~/.claude.json`), inclusive o `settings.local.json`, com backup.
4. **Repositório GitHub não se renomeia agora.** O GitHub redirecionaria, mas o ganho é só cosmético e cada `extraKnownMarketplaces` gravado aponta para o nome atual. Se for renomear, é item à parte, depois da migração assentar.
5. **Os documentos datados** (ADR, planos, pesquisas, revisões de design) ficam como estão: são registro do que valia na data.

## Fora do escopo
O design system e o tema da marca (itens próprios); rodar a migração no estado real (só com ok do operador, depois do merge).

## Pronto quando
`claude plugin validate .` verde; testes afetados verdes; migração testada em HOME temporário (seco, aplicar, falha com desfazer automático, `--desfazer`); guia atualizado; PR aberto.
