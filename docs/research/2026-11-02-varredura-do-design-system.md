# Varredura do repositório do design system antes de entrar no kit público

- **Data:** 2026-11-02, 22:20 (SP) (snapshot; não editar — pesquisa envelhece)
- **Autor:** sessão dona do F357 (Opus 5.5), a pedido do operador (Q861)
- **Objeto:** o que fica público quando o repositório da empresa (`wicomm-projects/wicomm-design-system`, privado) entra no kit por subárvore: os 50 commits da `main` até `e8b0b17` (a ponta, congelada para a mudança), as mensagens deles e cada versão de cada arquivo. Os PRs de lá (#1 a #35) **não** vêm: a subárvore traz commits, não PRs; eles ficam no repositório antigo, que será arquivado como privado. Os nomes internos que este laudo encontra são descritos pelo papel, como no [laudo do kit](2026-11-02-varredura-para-publico.md).
- **Método:** o mesmo do laudo do kit. `git rev-list --objects origin/main` e leitura de cada blob de texto único (2.566 objetos), linha a linha: padrões de segredo (token do GitHub, do npm e da Vercel, chave da Anthropic/OpenAI/AWS/Google/Slack, JWT, chave privada, `senha=`/`api_key=`/`token=`/`secret=` com valor, URL com usuário e senha, URL de projeto Supabase), pasta pessoal, e-mail, os nomes que o detector do kit barra (`test/nomes-do-autor.mjs`) e os domínios citados. Nomes de arquivo com cara de segredo. Os 4 arquivos binários (capturas `.jpg` da revisão F307) foram abertos e olhados. O script ficou fora do repositório (scratchpad da sessão).

<a id="resposta-curta"></a>
## 1. Resposta curta

**Nenhum segredo e nenhum dado de cliente em nenhum ponto do histórico. Trazer como está, pelo mesmo critério do Q864.**

- **Segredo:** zero. Os 20 alarmes de atribuição são nomes de token de design (`token: "painel"`) e dois valores de teste falsos (`SENHA: "senha-certa"`, `SECRET: "segredo-do-registro"` em `apps/atelie/test/acesso.test.ts`). A senha do ateliê e o segredo de bypass da Vercel moram nas variáveis de ambiente da Vercel, nunca em arquivo.
- **O que fica exposto** é nome, não segredo: o codinome do produto de origem da base (o mesmo do achado 3 do laudo do kit) e o nome do produto interno da empresa onde a base foi pilotada, a pilha de lá (Wake, VTEX, FastStore, Supabase), a pasta pessoal do autor em 3 docs e o e-mail pessoal dele nos metadados.

<a id="achados"></a>
## 2. Achados

| # | O quê | Onde | Gravidade | O que fazer |
|---|---|---|---|---|
| 1 | Nenhum segredo real | — | — | Nada |
| 2 | Valores de teste com cara de segredo | `apps/atelie/test/acesso.test.ts` | Nenhuma: insumo do teste da guarda de acesso | Nada; o *secret scanning* do GitHub pode avisar, feche como "usado em teste" |
| 3 | Codinome do produto de origem da base | Árvore: 5 arquivos de código e teste (`packages/tokens/test/fixtures/<codinome>/`, `paridade.test.mjs`, `packages/tokens/README.md`, as listas de palavras proibidas em `scripts/base.test.mjs` e `packages/registro/test/registro.test.mjs`) e 5 docs; histórico: 12 arquivos e 1 mensagem de commit | Baixa: o mesmo codinome que o kit já publica no histórico (Q864) | Trazer como está. Tirar da árvore de código fica em `depois` (renomear a fixture e passar as listas de palavras para hash, como o detector do kit faz) |
| 4 | A fixture copia o CSS do produto de origem | `packages/tokens/test/fixtures/<codinome>/globals.css` e `tailwind.config.ts` | Baixa: são os tokens de cor e espaço que a base reproduz, sem lógica de produto | Nada além do achado 3 |
| 5 | Nome do produto interno onde a base foi pilotada | 253 menções, quase todas em `docs/pilotos/` e `docs/design/revisoes/`; um caminho de pasta e um sha de commit local de lá | Baixa: produto da própria empresa, sem dado de cliente; a pasta e o commit não dão acesso a nada | Nada |
| 6 | Pasta pessoal do autor | 3 docs (`docs/estudo/F261-…`, `docs/pilotos/novo/relatorio.md`, uma revisão de design) | Baixa: o mesmo achado 5 do laudo do kit | Nada |
| 7 | E-mail | O pessoal do autor nos 50 commits; `voce@<empresa>.com.br` e `ana.souza@exemplo.com.br` em exemplos | Baixa e esperada | Nada |
| 8 | Nome de cliente | Nenhum. "Cliente" aparece no sentido genérico ("o cliente reconhece a marca"); as capturas F307 mostram dados fictícios (Ana Souza, Bruno Lima…) | — | Nada |
| 9 | URL interna, painel, projeto Supabase | Nenhuma. Os domínios são do npm, GitHub, Anthropic, shadcn, Vercel (o próprio `wicomm-atelie.vercel.app`, atrás de senha) e `exemplo.com.br` | — | Nada |
| 10 | A marca da empresa | O tema (`temas/wicomm/`, `plugins/tema-wicomm/`), o logotipo do registro (`packages/registro/registry/design-system/ui/logotipo.tsx`), a cor no slot de marca dos tokens (`packages/tokens/fonte/marca.tokens.json`) e o plugin congelado `plugins/wicomm/` | Nenhuma: uso previsto; o `NOTICE` deixa a marca fora do MIT | `NOTICE` atualizado no PR do F357 |
| 11 | Código sem licença | `license: "UNLICENSED"` nos pacotes; nenhum `LICENSE` no repositório | Média: entrar no kit público sem dizer a licença deixa o código num limbo | Q867 |

<a id="o-que-nao-vem"></a>
## 3. O que não vem e continua privado

- Os 35 PRs (título, corpo, comentários) e os `refs/pull/*` do repositório antigo: ficam nele, arquivado e privado.
- Os ramos que não chegaram à `main`.
- As pastas não versionadas do clone local (`.capturas-f305/`, `node_modules/`).
