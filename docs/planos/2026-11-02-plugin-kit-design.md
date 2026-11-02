# F332 · O plugin de design do kit ganha nome próprio

## O caso
Em 02/11 o operador instalou pela conta os plugins da Anthropic `design`, `engineering`, `data` e `cowork-plugin-management` (chegam pelo app, em `~/Library/Application Support/Claude/local-agent-mode-sessions/*/*/rpm/plugin_*/`). O da Anthropic se chama `design`, como o do kit, e venceu: os agentes `design:designer` e `design:critico-de-ui` sumiram ("no longer available") e as skills `design:critica-de-ui` e `design:revisao-de-arquitetura-de-ui` também saíram da lista da sessão (medido: a lista desta sessão traz só as sete skills da Anthropic sob `design:`).

## Premissa conferida
- O `design` da Anthropic traz só skills (`accessibility-review`, `design-critique`, `design-handoff`, `design-system`, `research-synthesis`, `user-research`, `ux-copy`), nenhum agente. Ler `design:` como nome velho do kit nas travas não dá escrita a agente da Anthropic.
- Os outros plugins do kit (`orquestracao`, `painel-sessoes`, `processos`) não colidem com nenhum plugin dos marketplaces instalados nem dos plugins que a conta trouxe (`data`, `engineering`, `figma`, `product-management`, `productivity`, `superpowers`…). São nomes em português, com risco baixo; ficam como estão.
- `kit-design` não existe em nenhum marketplace instalado (`claude-plugins-official` incluído).

## Decisão
- Nome novo: `kit-design` (agentes `kit-design:designer`, `kit-design:critico-de-ui`). O prefixo `kit-` diz de onde vem e não deve colidir com plugin oficial.
- A seção `design` do `.claude/kit.json` e a etapa `design` da fila não mudam: são configuração e estado, não nome de plugin, e não colidem.
- Compatibilidade com o nome velho onde o kit lê: `semPrefixoDoKit` tira `kit-design:` e `design:`; `opcoesDoPlugin`/`pluginLigado` (gate e cópia do plugin) leem `design@` quando `kit-design@` não diz nada (na mesma camada o novo vence); o `doutor` também.
- Migração:
  - `atualizar-plugins` (escopo user): com `design@` instalado e só `kit-design` publicado, instala `kit-design` com `--config` das opções gravadas do velho, desliga-o se o velho estava desligado e só então desinstala o velho. Se o novo já estava, só desinstala o velho. Cópia `project` não se mexe e a linha pede o `kit atualizar`.
  - `pode-reiniciar` passa a listar o velho instalado como `kit-design` em `paraBaixar` (o aviso "rode atualizar-plugins").
  - `kit atualizar`: troca a chave no `enabledPlugins` do `.claude/settings.json`, no mesmo lugar e com o mesmo valor, e no lock (para o `remover` tirar a nova). `settings.local.json` só ganha aviso.

## Fora do escopo
- Renomear `processos`, `orquestracao`, `painel-sessoes`.
- Mudar a seção `design` do `kit.json`.
- Subir a versão dos plugins (a orquestradora faz).

## Pronto quando
Testes (`test/kit-design.test.mjs`, `atualizar-plugins.test.mjs`, `painel-pode-reiniciar.test.mjs` e os antigos atualizados) verdes nos afetados; validador sem achado médio ou alto.
