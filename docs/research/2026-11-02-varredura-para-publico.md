# Varredura do repositório antes de ficar público

- **Data:** 2026-11-02, 21:40 (SP) (snapshot; não editar — pesquisa envelhece)
- **Autor:** sessão dona do F355 (Opus 5.5), a pedido do operador (Q860)
- **Objeto:** tudo o que o GitHub mostra quando o repositório `ichikawacraice/kit-de-orquestracao` vira público: os 140 ramos do remoto, os 123 `refs/pull/<n>/head` (que o GitHub guarda mesmo depois de o ramo ser apagado e que nenhum `push --force` alcança), as mensagens de commit e o título, o corpo e os comentários dos 123 PRs. Base: `main` em `21d5cc0`. Os nomes internos que este laudo encontra não são escritos aqui: são descritos pelo papel ("o projeto de produto", "um projeto pessoal").
- **Método:** `git fetch` de todos os refs do remoto (inclusive `refs/pull/*`) para um espaço próprio, `git rev-list --objects` sobre eles e leitura de cada blob de texto único (2.575 blobs, 770 commits); `gh pr list --state all` para os PRs. Em cada linha: padrões de segredo (token do GitHub, chave da Anthropic/OpenAI, chave AWS, token do Slack, chave do Google, JWT, chave privada, `senha=`/`api_key=`/`token=` com valor, URL com usuário e senha, URL de projeto Supabase), pasta pessoal (`/Users/<nome>`, `/home/<nome>`), e-mail, os nomes que o detector do kit barra (`test/nomes-do-autor.mjs`) e URL externa. Nomes de arquivo com cara de segredo (`.env`, `.pem`, `.key`, `id_rsa`, `credential`). O script ficou fora do repositório (scratchpad da sessão); os refs de varredura foram apagados no fim.

<a id="resposta-curta"></a>
## 1. Resposta curta

**Nenhum segredo em nenhum ponto do histórico. Não reescrever o histórico: publicar como está, se o operador aceitar que dois nomes internos de projeto fiquem visíveis (Q864).**

- **Segredo:** zero. Os 43 alarmes são todos dados de teste falsos (`postgres:postgres@127.0.0.1`, `s3cr3tPw0rd@db.exemplo.com`, `password: "Example2024x"`) nos testes das travas que procuram segredo. Nenhum arquivo `.env`, chave ou certificado entrou em commit algum.
- **O que fica exposto** é nome, não segredo: o nome interno do projeto de produto (em 41 arquivos de `docs/` na árvore atual, em 21 mensagens de commit e em 23 PRs), o nome de um projeto pessoal (1 arquivo de `docs/` hoje; mais no histórico e em 1 PR), a pilha do projeto de produto (Wake, VTEX, Supabase), e o nome e o e-mail pessoal do autor nos metadados dos commits.
- **Reescrever o histórico não resolve:** os `refs/pull/*` e o texto dos PRs continuam no GitHub depois de qualquer `push --force`. Só sumiriam num repositório novo (seção [4](#alternativas)).

<a id="achados"></a>
## 2. Achados

| # | O quê | Onde | Gravidade | O que fazer |
|---|---|---|---|---|
| 1 | Nenhum segredo real | — | — | Nada |
| 2 | 43 "segredos" de mentira | `plugins/orquestracao/hooks/tests/varredura-entre-sessoes.test.mjs` (várias versões) e `gate/test/o-verde-da-arvore.test.mjs` | Nenhuma: são os insumos do teste da trava `segredo-sai` e do gate | Nada. O *secret scanning* do GitHub pode avisar sobre eles; basta fechar o aviso como "usado em teste" |
| 3 | Nome interno do projeto de produto | Árvore atual: 41 arquivos em `docs/` (ADRs 0001–0010, planos e revisões de design de outubro, o estudo de distribuição); histórico: também `plugins/painel-sessoes/tests/painel.test.tsx`, `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs` e outros, já limpos na árvore; 21 mensagens de commit; 23 PRs | Baixa: é um codinome. Junto com ele aparecem a pilha (Wake, VTEX, Supabase, runner), nomes de tema ("Editor da loja", "Prévia VTEX") e números de ADR e SPEC de lá, nenhum dado de cliente | Q864 |
| 4 | Nome de um projeto pessoal | 1 plano de `docs/` hoje; histórico de testes do painel; 1 PR | Baixa | Q864 |
| 5 | Pasta pessoal | Uma versão antiga de `plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` cita `/Users/<usuário>/Developer/Projects/<projeto de produto>/.claude/skills` | Baixa: o usuário da máquina é o mesmo nome do dono do repositório | Nada |
| 6 | Nome e e-mail pessoal do autor | Metadados dos 770 commits (autor e quem commitou) | Baixa e esperada em repositório público; o e-mail vira coletável | Opcional, daqui para frente: e-mail `noreply` do GitHub no `git config user.email` deste repositório. Não muda o passado |
| 7 | A marca da empresa | Entrada `tema-wicomm` do marketplace, o endereço `wicomm-projects/wicomm-design-system` e o guia (`ligar-e-desligar.md`) | Nenhuma: é o uso previsto (F350, F353); o `NOTICE` diz que a marca não entra no MIT | Feito neste PR (`NOTICE`) |
| 8 | Nome de cliente | Nenhum. A palavra "cliente" aparece só no sentido técnico (cliente HTTP, "o cliente da página") e como exemplo genérico (`clientes/loja-x`) | — | Nada |
| 9 | URL interna, painel, projeto Supabase | Nenhuma. As URLs são de documentação pública, `exemplo.com`/`x.example` e os dois repositórios do GitHub já citados | — | Nada |

O detector de nome do kit (`test/sem-nome-pessoal.test.mjs`) já guarda o que é publicado como código e guia (`plugins/`, `cli/`, `gate/`, `scripts/`, `test/`, `modelos/`, `docs/guia/`, `README.md`, `CLAUDE.md`, `package.json`, o manifesto) e deixa de fora o resto de `docs/`, por ser histórico datado que não se reescreve. Com o repositório público, esse resto também fica visível: é daí que vêm os achados 3 e 4. O detector continua certo para o que entra de novo; o passado é a decisão do Q864.

<a id="o-que-ainda-vira"></a>
## 3. O que ainda vai mudar o quadro

- **O design-system da empresa continua privado.** O marketplace lista `design-system` e `tema-wicomm` vindos de `wicomm-projects/wicomm-design-system` (privado, sem licença). Quem é de fora da empresa vê as duas entradas e não consegue instalá-las; o guia já diz que é preciso acesso de leitura. Antes de dizer a alguém do time que o design-system vai funcionar, confira que a conta do GitHub dessa pessoa tem acesso de leitura a esse repositório. E o `kit iniciar` e o `kit adotar` ligam o `design-system` em todo projeto: quem não tem acesso vê a instalação dele falhar em cada um.
- **Trazer o wicomm-design-system para cá com histórico (Q861)** torna público também o histórico daquele repositório. Esse item precisa da sua própria varredura (a mesma receita, sobre os refs e PRs de lá) e de uma decisão da empresa sobre a licença do código do `design-system` (hoje ele não tem licença nenhuma). O `NOTICE` deste PR já deixa a pasta `plugins/tema-wicomm/` fora do MIT quando ela chegar. Hoje o tema é só texto e tokens (`tema.json`, `tema.tokens.json`, a skill `aplicar`); se um dia trouxer logotipo ou arquivo de fonte, a fonte tem licença própria e precisa ser conferida.

<a id="alternativas"></a>
## 4. Alternativas consideradas

| Opção | O que limpa | O que custa | Recomendação |
|---|---|---|---|
| **A. Publicar como está** | Nada do passado; o detector segue barrando nome novo no que é publicado | Os achados 3 a 6 ficam visíveis | **Recomendada** se o codinome não for segredo comercial: nenhum dado de cliente, nenhuma credencial, e o resto é o diário honesto de como o kit nasceu |
| B. Reescrever o histórico no lugar (`git filter-repo` + `push --force`) | Os ramos | Não limpa os 123 `refs/pull/*` nem o texto dos PRs, que o GitHub mantém; quebra o `sha` de todo commit citado em doc, diário e handoff; destrói o que as sessões abertas têm na mão | Não fazer: destrutivo e não resolve |
| C. Repositório novo, com um commit só a partir da árvore atual, e o atual arquivado como privado | Tudo, se além disso os 41 arquivos de `docs/` forem limpos ou deixados de fora no commit inicial | Perde o histórico e os links dos PRs; o endereço `ichikawacraice/kit-de-orquestracao` está gravado no `settings.json` de cada projeto e de cada máquina (marketplace e `npx`), então o novo precisa herdar o mesmo nome (renomear o atual para `…-arquivo` antes); os ADRs e diários "imutáveis" seriam editados | Só se o codinome não puder aparecer de jeito nenhum |
| D. Pedir ao suporte do GitHub que apague os `refs/pull/*` depois da opção B | Quase tudo | Depende do suporte, sem prazo; os PRs perdem o diff | Não: custo alto para dano baixo |

<a id="o-que-este-pr-faz"></a>
## 5. O que o PR do F355 faz e não faz

- **Faz:** este laudo; `LICENSE` (MIT); `NOTICE` (a marca da empresa fora do MIT, os plugins de origem remota com a licença de lá); `"license": "MIT"` no `package.json`; README, guia e descrição do marketplace dizendo que o repositório do kit é público e que o design-system continua privado; um teste que mantém `LICENSE`, `package.json`, `NOTICE` e README concordando.
- **Não faz:** tornar o repositório público (publicação para fora: a orquestradora leva ao operador depois do merge), reescrever histórico, mexer no wicomm-design-system.
