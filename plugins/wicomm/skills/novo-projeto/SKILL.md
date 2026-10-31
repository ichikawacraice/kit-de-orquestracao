---
name: novo-projeto
description: Começa um app React novo da Wicomm já dentro do sistema de design — detecta o tipo de projeto, faz a entrevista curta que vira o PRODUCT e define a densidade, estampa a base Wicomm (DESIGN, ANATOMIA, CONVENCOES) em design/, escreve o design/wicomm.json, liga o plugin e o registro no projeto e leva a primeira tela pelo designer e pelo crítico. Use quando a pessoa for criar ou iniciar um app, painel ou sistema React novo da Wicomm ("projeto novo", "começar um app do zero", "bootstrap", "monta a base de um sistema novo", `/wicomm:novo`). Não serve para projeto que já existe (esse é o `auditar-projeto`) nem para loja FastStore ou Wake.
---

# Projeto novo no sistema Wicomm

O projeto nasce com a base Wicomm copiada e estampada, com o processo ligado e com a primeira tela decidida pelo designer e julgada pelo crítico. O que vale aqui é a base do plugin: `${CLAUDE_PLUGIN_ROOT}/base/` (DESIGN = como parece, ANATOMIA = o que vai onde, CONVENCOES = como o código sustenta as duas).

## 1. Detectar o tipo (pare se não for app React)

Leia o `package.json` da raiz (e o do front, num monorepo). Rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-deriva.mjs" <raiz> --pasta <front> --json` e olhe o `stack`.
- **App React (Next ou Vite)** → segue.
- **Loja** (`stack.loja: true`: FastStore, VTEX, Wake) → pare e diga que está fora do escopo: loja leva a marca do cliente e outro kit de componentes (Q627).
- **Projeto que já tem telas** (mais que um punhado de arquivos de tela, ou `components/ui` cheio) → não é projeto novo: proponha o `auditar-projeto`.
- **Tailwind v3** (`stack.tailwindV3`) → o sistema é só Tailwind v4: migre antes (`npx @tailwindcss/upgrade@<versão fixada>`, com o ok da pessoa) e só depois instale tokens e peças.
- **Pasta vazia** → crie o app antes (Next: `npx create-next-app@<versão fixada> --ts --tailwind --app`; Vite: `npm create vite@<versão fixada> -- --template react-ts` mais o Tailwind v4), com o ok da pessoa para o comando. O sistema é só Tailwind v4.

## 2. Entrevista curta (vira `design/PRODUCT.md`)

Três perguntas, uma mensagem só, cada uma com a sua recomendação:
1. **Quem usa** (papéis) e **para quê** (a tarefa principal de cada papel).
2. **Em que tela e largura** (notebook de escritório? celular em campo?) e **com que frequência** (o dia todo × de vez em quando).
3. **A primeira tela** a construir e o arquétipo dela (ANATOMIA, ARQ-01).

A frequência define a **densidade** (DESIGN): quem opera o dia todo → `instrumento` (DENS-01); quem usa de vez em quando, inclusive o cliente final → `site` (DENS-02). A marca é sempre a Wicomm (Q628): não pergunte cor nem fonte. Escreva `design/PRODUCT.md` com as respostas (papéis, cenas de uso, largura de referência, densidade e o porquê).

## 3. Estampar a base e escrever a configuração

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/base-do-projeto.mjs" estampar <raiz> --densidade <instrumento|site> --pasta <front>
```

Isso copia DESIGN, ANATOMIA e CONVENCOES para `design/` (e a cópia intocada para `design/.base/`, o ancestral das atualizações) e escreve o `design/wicomm.json` com `versao`, `densidade`, `pasta` e os hashes. Se ele disser que **manteve** um documento que já existia, pare e pergunte à pessoa (recomendação: mover o antigo para `design/legado/` e estampar de novo). Complete o `design/wicomm.json` com:
- `fontes`: `["design/PRODUCT.md", "design/ANATOMIA.md", "design/DESIGN.md", "design/CONVENCOES.md"]`
- `kit`: a pasta das peças (ex.: `<front>/src/components/ui`)
- `revisoes`: `docs/design/revisoes`
- `largura`: a largura de referência da entrevista (padrão 1280)
- `pecas`: `{}` (o `peca-do-kit` anota cada peça instalada)

E no projeto:
- **`.claude/settings.json`**: `extraKnownMarketplaces` com o marketplace `wicomm` (repositório `wicomm-projects/wicomm-design-system`) e `enabledPlugins: { "wicomm@wicomm": true }` — quem abrir o projeto no Claude Code recebe o convite para instalar.
- **`CLAUDE.md`**: um bloco curto "Design system Wicomm" dizendo que toda tela passa pelo `designer` e pelo `critico-de-ui`, que a norma está em `design/`, e que a nota de 24/30 (28/35 em site) é a porta do PR (CONV-19, CONV-20).
- **`components.json`** com o registro `@wicomm` em `registries`, quando o registro estiver publicado (veja o passo 4).

## 4. Tokens, peças, casco e guardas — o que já existe

Confira antes de prometer: o pacote `@wicomm/tokens`, o registro shadcn `@wicomm` e o pacote `@wicomm/guardas` são fatias próprias do sistema e podem ainda não estar publicados.
- **Publicado:** instale os tokens e as guardas (publicados como `@wicomm-projects/*` no GitHub Packages da org: o `.npmrc` aponta `@wicomm-projects:registry=https://npm.pkg.github.com` e a instalação é por alias, `npm install @wicomm/tokens@npm:@wicomm-projects/tokens @wicomm/guardas@npm:@wicomm-projects/guardas` — instalar pelo nome `@wicomm/tokens` sozinho iria ao npm público; detalhe em `docs/instalar-pacotes.md` do repositório do sistema) — os tokens são o CSS para Tailwind v4 —, rode o `shadcn init` com o estilo Wicomm do registro, traga as primitivas e o **casco** (barra lateral, cabeçalho, trilha, título — ANATOMIA, CASCO-01) com o `peca-do-kit`, ligue as guardas no teste com base zero e crie a rota `/atelie` (CONV-23).
- **Ainda não publicado:** não copie peça à mão nem invente token. Escreva o que ficou de fora numa lista "Falta do sistema" no `design/PRODUCT.md` (qual pacote, qual passo) e siga: a base e o processo já valem sem eles.

## 5. A primeira tela pelo processo

1. Subagente `designer`: revisão de arquitetura da primeira tela (skill `revisao-de-arquitetura-de-ui`), gravada em `docs/design/revisoes/`.
2. Subagente `critico-de-ui` sobre a revisão. Abaixo do teto ou com ressalva alta: volta ao designer (no máximo 2 recríticas).
3. Código da tela **como a revisão aprovou** (CONV-21), com peças do kit e tokens.
4. Subagente `critico-de-ui` sobre o código.

Cada crítica, você grava ao fim do arquivo da revisão (skill `critica-de-ui`, *Quem grava a crítica*): sem isso o `/wicomm:estado` não tem nota.

## 6. Pronto quando

- O app sobe (`npm run dev` sem erro) e o build passa.
- `design/` tem os quatro documentos e o `design/wicomm.json` tem a versão; `node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` mostra a versão e "igual à base".
- A primeira tela tem crítica no teto ou acima (24/30; 28/35 em site), gravada no arquivo da revisão (o `estado` mostra a nota).
- O que dependia de pacote não publicado está na lista "Falta do sistema".

Diga à pessoa, no fim: o que foi criado, a nota da primeira tela, e o que ficou na lista "Falta do sistema".
