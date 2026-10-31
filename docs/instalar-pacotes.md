# Instalar os pacotes da Wicomm

`@wicomm/tokens` e `@wicomm/guardas` moram no GitHub Packages da org `wicomm-projects`, **privados**: só instala quem tem acesso ao repositório `wicomm-projects/wicomm-design-system` (ou o repositório a que o pacote deu acesso). O registro shadcn e o ateliê não estão aqui.

**O nome publicado não é o nome do código.** O GitHub Packages exige que o escopo npm seja o dono do pacote, e o dono é a org: no registro, os pacotes são `@wicomm-projects/tokens` e `@wicomm-projects/guardas` (o escopo `@wicomm` do GitHub é de outra conta). O código importa `@wicomm/tokens` e `@wicomm/guardas` — a base, o registro shadcn e as próprias guardas contam com esse nome —, então o projeto instala **pelo alias do npm**, que põe o pacote em `node_modules/@wicomm/…`.

## No projeto

1. Um `.npmrc` na raiz do projeto, versionado, **sem token**:

   ```ini
   @wicomm-projects:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```

   O npm troca `${NODE_AUTH_TOKEN}` pela variável de ambiente na hora; o token nunca vai para o git. Só o escopo `@wicomm-projects` deixa de vir do npm público.

2. Instalar pelo alias:

   ```bash
   npm install @wicomm/tokens@npm:@wicomm-projects/tokens @wicomm/guardas@npm:@wicomm-projects/guardas
   ```

   No `package.json` fica `"@wicomm/tokens": "npm:@wicomm-projects/tokens@^0.1.0"`. Instalado sem o alias (`npm install @wicomm-projects/tokens`), o `@import "@wicomm/tokens/tailwind-v4.css"` não acha o arquivo e a guarda dos tokens acusa o pacote como não instalado.

## O token

- **Na máquina do dev:** um token com `read:packages`. Com o `gh` logado, o próprio token dele serve:

  ```bash
  gh auth refresh -s read:packages
  export NODE_AUTH_TOKEN=$(gh auth token)
  ```

  Sem o `gh`: um *personal access token (classic)* com `read:packages` — o registro npm do GitHub Packages não aceita o token *fine-grained*.
- **No CI do projeto (GitHub Actions):** o `GITHUB_TOKEN` do próprio job, com permissão de leitura:

  ```yaml
  permissions:
    contents: read
    packages: read
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        registry-url: https://npm.pkg.github.com
        scope: '@wicomm-projects'
    - run: npm ci
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```

  O `GITHUB_TOKEN` de outro repositório só lê o pacote se o pacote der acesso a ele: na página do pacote na org, *Package settings → Manage Actions access → Add repository*, com papel *Read*. Uma vez por pacote e por repositório que consome.
- **Em build fora do GitHub (Vercel e afins):** a variável `NODE_AUTH_TOKEN` no ambiente de build, com um token *classic* `read:packages` de uma conta com acesso à org.

## Versão nova

Quem publica é o workflow [`publicar-pacotes`](../.github/workflows/publicar-pacotes.yml): a cada push na `main` que toca um dos pacotes, ele roda o gate e publica, com o nome `@wicomm-projects/…`, a versão do `package.json` que o registro ainda não tem. Publicar versão nova é subir o `version` do pacote no PR; o merge publica. Versão publicada não se sobrescreve.
