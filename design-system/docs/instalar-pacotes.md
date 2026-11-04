# Instalar os pacotes da Wicomm

`@wicomm/tokens` e `@wicomm/guardas` saem no **npm público**, sob a licença MIT (a cor da marca da empresa nos tokens fica fora dela: `NOTICE` na raiz do repositório). Instala quem quiser, sem conta, `.npmrc` nem token. O registro shadcn e o ateliê não estão aqui: o registro mora no ateliê, atrás de senha ([publicar o ateliê](publicar-atelie.md)).

## No projeto

```bash
npm install @wicomm/tokens @wicomm/guardas
```

No `package.json` fica `"@wicomm/tokens": "^0.1.2"`. O CSS importa `@wicomm/tokens/tailwind-v4.css`, e as guardas rodam por `"test": "wicomm-guardas"`.

- **No CI do projeto:** `npm ci && npm test`, sem `NODE_AUTH_TOKEN` nem `packages: read`.
- **Na Vercel (e afins):** o build padrão, a cada push. Nenhuma variável de token de pacote (`NPM_RC`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`).

<a id="vindo-do-github-packages"></a>
## Projeto instalado pelo GitHub Packages

Até 03/11/2026 os pacotes moravam no GitHub Packages da org `wicomm-projects`, privados, com o nome `@wicomm-projects/…` e instalados por alias (`"@wicomm/tokens": "npm:@wicomm-projects/tokens@^0.1.0"`). Versão nova só sai no npm público. Para trocar:

1. `npm install @wicomm/tokens@latest @wicomm/guardas@latest` (reescreve o alias no `package.json` e no `package-lock.json`; sem o `@latest`, o npm reaproveita o alias que já está no `package.json` e volta ao GitHub Packages).
2. Tire do `.npmrc` as linhas `@wicomm-projects:registry=…` e `//npm.pkg.github.com/:_authToken=…`; se nada sobrar, apague o arquivo.
3. No CI, tire o `NODE_AUTH_TOKEN`, o `registry-url`/`scope` do `setup-node` e o `packages: read`, se só serviam aos pacotes.
4. Se o deploy era feito na máquina (`vercel build --prod && vercel deploy --prebuilt --prod`) só por causa do token, ele pode voltar ao build da Vercel: a regra que o pedia foi revogada.

O `/design-system:atualizar` faz essa troca junto com a subida de versão.

## Versão nova

Quem publica é o workflow `publicar-pacotes` na raiz do repositório do kit: a cada push na `main` que muda um dos pacotes, ele roda o gate e publica a versão do `package.json` que o npm ainda não tem. Publicar versão nova é subir o `version` do pacote no PR; o merge publica. Versão publicada não se sobrescreve. O passo a passo, inclusive o primeiro envio de cada pacote: [os pacotes no npm](../../docs/guia/pacotes-npm.md).
