# F357 · O design system da empresa passa a morar no kit, com histórico

- **Data:** 2026-11-02 (SP)
- **Dona:** sessão do F357 (Opus 5.5)
- **Pedido:** Q861 — trazer o repositório do design system inteiro, com o histórico; religar a Vercel; publicar os pacotes no npm público; arquivar o repositório antigo.
- **Decisão de desenho:** [ADR 0020](../adr/0020-o-design-system-mora-numa-pasta-com-dependencias-e-gate-proprios.md)
- **Varredura:** [laudo](../research/2026-11-02-varredura-do-design-system.md)

<a id="premissa"></a>
## A premissa, conferida
- **"Subtree ou equivalente":** feito com `git merge -s ours` + `git read-tree --prefix=design-system/`, o mesmo que o `git subtree add` faz (o `git subtree` não está instalado nesta máquina). Os 50 commits entram com o mesmo `sha`.
- **O que estava errado ou faltava no pedido:**
  - **A fila de merge mergeia por squash,** e o squash apaga exatamente o histórico que o item traz. O PR da fatia 1 sai por merge commit (`gh pr merge --merge`), pela orquestradora, fora do `--anotar`. Um teste (`e8b0b17` é ancestral do HEAD) deixa a combinação por squash vermelha.
  - **O `npm test` da raiz pegaria 46 arquivos de teste da pasta nova** (o `node --test` sem argumento procura em toda a árvore, `.ts` inclusive), e eles pedem `npm install`. A raiz passa a rodar só as pastas do kit, com um teste que compara a seleção à descoberta padrão.
  - **O código da empresa não tem licença** (`UNLICENSED`): entrar num repositório MIT público pede decisão (Q867).
  - **O escopo `@wicomm` não existe no npm público** e a máquina não tem login no npm: publicar pede a organização criada pelo operador (Q869).
  - **Dois scripts da orquestradora supunham todo plugin local em `plugins/<nome>`** (`atualizar-plugins`) e a versão achada por `-G` (`subir-versao`, que não lê o diff de um merge): consertados com teste.

<a id="fatias"></a>
## Fatias
1. **O código entra (este PR):** a subárvore em `design-system/`; o marketplace aponta `./design-system/plugins/design-system` e `./design-system/plugins/tema-wicomm` (o tema segue desligado por padrão); a raiz sem os testes da pasta; os dois scripts; NOTICE, README e guia; o laudo; o ADR. Pronto quando: a suíte da raiz passa sem `npm install`, o gate da pasta passa dentro do kit (`npm ci && npm test` em `design-system/`, com o build do ateliê e o `/r/v0.1.0`), e o PR sai por merge commit.
2. **O npm público** (depois do Q869): `@wicomm/tokens` e `@wicomm/guardas` com `license` e `publishConfig` do npm público; o workflow de publicação na raiz do kit (`.github/workflows/`), por publicação confiável, disparado só por mudança em `design-system/packages/`. Aviso à orquestradora da empresa quando sair.
3. **A Vercel e o arquivo** (depois do Q870): o operador religa o projeto do ateliê ao kit (Root Directory `design-system/apps/atelie`, build só quando a pasta muda); os links do ateliê para o código passam a apontar o kit; conferir o deploy e o `/r/v0.1.0`; o operador arquiva o repositório antigo. Aviso à orquestradora da empresa.

<a id="fora"></a>
## Fora do escopo
- Tirar o codinome do produto de origem da árvore de código da pasta (achado 3 do laudo): vai em `depois`.
- Mover os plugins para a `plugins/` da raiz: a pasta inteira fica como veio, para o gate e o ateliê dela não mudarem de caminho.
- O plugin congelado `wicomm` não entra no marketplace do kit: os projetos que o usam seguem pelo marketplace antigo até migrarem.
