# Publicar o ateliê (a vitrine)

O ateliê (`apps/atelie`) é um site estático: `npm run build -w @wicomm/atelie` grava tudo em `apps/atelie/out/` — a vitrine, o catálogo, os palcos e o registro shadcn em `/r/v{versao}/`. Ele se publica na Vercel da Wicomm, **com acesso protegido**. Esta página diz como; a primeira publicação espera a confirmação do operador (projeto, quem acessa, como protege).

> **Ainda não publicado.**

## O projeto na Vercel

| campo | valor |
|---|---|
| Repositório | `wicomm-projects/wicomm-design-system` |
| Root Directory | `apps/atelie` |
| Framework | Next.js (o `output: "export"` do `next.config.ts` faz o site estático) |
| Install / Build | vêm do [`apps/atelie/vercel.json`](../apps/atelie/vercel.json): `cd ../.. && npm ci` e `npm run build` (a Vercel serve o `out/` do export estático) |
| Node | 22 ou mais (o `engines` da raiz) |
| "Include files outside the root directory" | **ligado** (é o padrão): o build lê `packages/` e `plugins/wicomm/base/` |
| Variáveis de ambiente | nenhuma: os pacotes `@wicomm/*` vêm do próprio repositório (workspaces), sem o GitHub Packages |

O build já confere a saída (`scripts/conferir-saida.mjs`): falta de item do registro, de token na vitrine ou de regra com âncora reprova o deploy.

## A proteção, e o que ela quebra

A Vercel protege o deploy de duas formas que servem aqui:
- **Vercel Authentication** (conta da Vercel do time): só quem é membro do time Wicomm na Vercel abre o site.
- **Password Protection**: uma senha para o site inteiro (plano Pro com o complemento, ou Enterprise).

**O registro mora no mesmo site, e o `shadcn` CLI não faz login.** Com a proteção ligada, `npx shadcn add @wicomm/button` recebe a página de login, e não o JSON. A saída é o **Protection Bypass for Automation**: a Vercel gera um segredo, e o projeto o manda no cabeçalho de cada pedido ao registro, pelo `components.json`:

```json
"registries": {
  "@wicomm": {
    "url": "https://<o-endereço-do-ateliê>/r/v0.1.0/{name}.json",
    "headers": { "x-vercel-protection-bypass": "${WICOMM_REGISTRO_BYPASS}" }
  }
}
```

O `shadcn` troca `${WICOMM_REGISTRO_BYPASS}` pela variável de ambiente: o segredo não vai para o git. Cada dev guarda o valor no próprio ambiente (o mesmo lugar do `NODE_AUTH_TOKEN` dos pacotes, [instalar-pacotes.md](instalar-pacotes.md)).

## O que o operador decide antes da primeira publicação

1. **O projeto:** time da Vercel da Wicomm e nome do projeto (sugestão: `wicomm-atelie`), e o domínio (o `*.vercel.app` ou um subdomínio da Wicomm).
2. **Quem acessa:** os membros do time na Vercel, ou qualquer pessoa da Wicomm com a senha.
3. **Como protege:** Vercel Authentication (recomendado: sem senha para circular, e a saída de quem deixa a empresa é tirar a pessoa do time) ou senha.
4. **O segredo do registro:** gerar o *Protection Bypass for Automation* e onde ele circula para o time.

## Publicar

Com as quatro respostas: criar o projeto (painel da Vercel ou `vercel link` em `apps/atelie`), ligar a proteção **antes** do primeiro deploy, e conectar o repositório. Cada merge na `main` publica.
