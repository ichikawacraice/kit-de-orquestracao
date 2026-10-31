# F277 · Publicar os pacotes da Wicomm (tokens e guardas)

Parte da fatia F261.10 do estudo, antecipada pela Q654 para destravar a etapa de tokens do piloto WiControl. Destino decidido na Q630: GitHub Packages da org `wicomm-projects`, privado.

## Escopo
- `packages/tokens/package.json` e `packages/guardas/package.json`: sem `private`, com `publishConfig` (`npm.pkg.github.com`, `access: restricted`), `repository` (liga o pacote ao repositório e herda o acesso dele), `license: UNLICENSED`; `tokens` declara o Tailwind v4 como `peerDependency` opcional.
- `.github/workflows/publicar-pacotes.yml`: a cada push na `main` que toca um dos pacotes (e à mão), roda o gate e publica a versão que o registro ainda não tem, com `GITHUB_TOKEN` e `packages: write`.
- `docs/instalar-pacotes.md`: `.npmrc` sem token, o token de cada ambiente, o alias.

## Fora do escopo
Registro shadcn e ateliê na Vercel; a versão única do sistema (estudo §2.5) e o guia de entrada do time.

## Decisão: o nome publicado (*assumida, a confirmar*)
O GitHub Packages exige que o escopo npm seja o dono. `@wicomm` no GitHub é uma conta de usuário que não é a org (medido: `npm view @wicomm/tokens` no `npm.pkg.github.com` responde *does not exist under owner "wicomm"*), então na org o nome só pode ser `@wicomm-projects/<pacote>`.

- **Escolhido:** o código segue `@wicomm/tokens` e `@wicomm/guardas` (a base, o registro shadcn, a guarda dos tokens e o plugin contam com esse nome); o workflow troca o nome só na hora de publicar; o projeto instala pelo alias do npm (`@wicomm/tokens@npm:@wicomm-projects/tokens`). Não toca nada fora dos dois pacotes.
- **Alternativa:** renomear `@wicomm/*` para `@wicomm-projects/*` em todo o repositório (cerca de 30 arquivos, base e plugin incluídos). Nome único, sem alias, mas mexe em camadas de outras frentes e no texto que o time já lê.
- O nome publicado é o mesmo nas duas; trocar depois de uma para a outra não republica nada.

## Critério de pronto
Num diretório fora do repositório, com o `.npmrc` apontando o escopo para o GitHub Packages, a instalação dos dois pacotes traz as versões publicadas; `npm test` verde na raiz.
