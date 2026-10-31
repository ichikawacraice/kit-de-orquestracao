# O ateliê publicado (a vitrine)

O ateliê (`apps/atelie`) é um site estático: `npm run build -w @wicomm/atelie` grava tudo em `apps/atelie/out/` — a vitrine, o catálogo, os palcos e o registro shadcn em `/r/v{versao}/`. Ele está publicado em **https://wicomm-atelie.vercel.app**, e cada merge na `main` publica de novo.

## Como entrar

O ateliê pede **uma senha compartilhada**. O navegador abre a janela de usuário e senha: o usuário pode ser qualquer um (o seu nome, por exemplo), só a senha conta. O navegador lembra dela até você fechá-lo.

**Pedir acesso:** peça a senha a quem administra o projeto `wicomm-atelie` na Vercel (o time de design system). Ela circula por mensagem direta, nunca em canal aberto, issue, PR ou arquivo do repositório.

Quem não tem a senha recebe `401` em todas as páginas e no registro. Não há conta, convite nem login na Vercel para isso.

## Trocar a senha

A senha mora num lugar só: a variável de ambiente **`ATELIE_SENHA`** do projeto `wicomm-atelie` na Vercel (time `wicomm-projects`), em *Production* e *Preview*. Quem administra o projeto a lê em **Settings → Environment Variables**.

Para trocar (quem saiu do time, senha vazada, troca periódica):
1. Em *Settings → Environment Variables*, edite `ATELIE_SENHA` com a senha nova (Production e Preview). Pela linha de comando, num terminal fora do repositório:
   ```bash
   vercel env rm ATELIE_SENHA production --project wicomm-atelie --scope wicomm-projects -y
   ```
   ```bash
   vercel env rm ATELIE_SENHA preview --project wicomm-atelie --scope wicomm-projects -y
   ```
   ```bash
   vercel env add ATELIE_SENHA production,preview --project wicomm-atelie --scope wicomm-projects --no-sensitive
   ```
2. **Publique de novo:** a variável só vale no deploy feito depois dela. Em *Deployments*, *Redeploy* no último de produção (ou `vercel redeploy https://wicomm-atelie.vercel.app --scope wicomm-projects`).
3. Mande a senha nova a quem tem acesso. Quem estava com a antiga recebe a janela de senha de novo.

Senha vazia ou ausente **fecha** o site (`503`), nunca o abre. Gere a senha com algo como `openssl rand -base64 18`.

## Como funciona

- **A guarda é nossa, na borda da Vercel:** [`apps/atelie/borda/acesso.ts`](../apps/atelie/borda/acesso.ts), ligada pelo `proxy` do [`apps/atelie/vercel.json`](../apps/atelie/vercel.json) (o *Routing Middleware* da Vercel). Ela roda antes de todo arquivo do site e libera quem manda a senha (HTTP *Basic Auth*) e, só em `/r/`, o segredo do registro (abaixo). Os testes estão em [`apps/atelie/test/acesso.test.ts`](../apps/atelie/test/acesso.test.ts).
- **Por que não a senha da Vercel:** a *Password Protection* nativa custa US$ 20/mês por projeto no plano Pro. A guarda própria faz o mesmo sem custo; a troca está em *Decisões* no PR do F292.
- **O projeto na Vercel serve o `out/` como site estático** (`"framework": null`, `"outputDirectory": "out"`, `"trailingSlash": true` no `vercel.json`): o preset do Next não aceita o `proxy` fora do arquivo de convenção do Next, e o export estático não roda o `proxy.ts` do Next.
- **A Vercel Authentication** (só membros do time na Vercel) fica nos *previews* e nas URLs de cada deploy; o domínio de produção (`wicomm-atelie.vercel.app`) fica só com a senha. É a opção *Standard Protection* em *Settings → Deployment Protection*.
- **A ordem da troca importa:** a *Standard Protection* tira a proteção da Vercel do domínio de produção, e quem protege passa a ser só a guarda. Ligue-a só depois de (1) o deploy de produção com a guarda estar no ar e (2) `ATELIE_SENHA` estar definida; e confira em seguida, sem conta na Vercel: sem senha `401`, com a senha `200`, registro com o bypass `200`, `shadcn add` passando. Para voltar atrás, *All Deployments* no mesmo lugar.
- **Não volte a produção para um deploy anterior à guarda** (*Instant Rollback* ou *Promote* de um deploy de antes do F292) com a *Standard Protection* ligada: esse deploy não tem a guarda, e o site fica aberto. Se precisar voltar, ligue antes *All Deployments*.

| campo | valor |
|---|---|
| Repositório | `wicomm-projects/wicomm-design-system` |
| Root Directory | `apps/atelie` |
| Install / Build / Saída | do `vercel.json`: `cd ../.. && npm ci`, `npm run build`, `out/` |
| Node | 22 ou mais (o `engines` da raiz) |
| "Include files outside the root directory" | **ligado** (é o padrão): o build lê `packages/` e `plugins/wicomm/base/` |
| Variáveis de ambiente | `ATELIE_SENHA` (a senha). O segredo do registro, `VERCEL_AUTOMATION_BYPASS_SECRET`, a Vercel põe sozinha, com *Automatically expose System Environment Variables* ligado (o padrão) |

O build já confere a saída (`scripts/conferir-saida.mjs`): falta de item do registro, de token na vitrine ou de regra com âncora reprova o deploy.

## O registro e o `shadcn add`

O `shadcn` CLI não abre janela de senha. Ele passa pela guarda com o **Protection Bypass for Automation** da Vercel: o projeto manda o segredo no cabeçalho de cada pedido ao registro, pelo `components.json`:

```json
"registries": {
  "@wicomm": {
    "url": "https://wicomm-atelie.vercel.app/r/v0.1.0/{name}.json",
    "headers": { "x-vercel-protection-bypass": "${WICOMM_REGISTRO_BYPASS}" }
  }
}
```

O `shadcn` troca `${WICOMM_REGISTRO_BYPASS}` pela variável de ambiente: o segredo não vai para o git. Cada dev guarda o valor no próprio ambiente (o mesmo lugar do `NODE_AUTH_TOKEN` dos pacotes, [instalar-pacotes.md](instalar-pacotes.md)); quem administra o projeto o lê em *Settings → Deployment Protection → Protection Bypass for Automation*.

A guarda aceita o mesmo segredo que a Vercel, **e só nos caminhos do registro (`/r/`)**: o segredo não abre a vitrine. Ela compara o cabeçalho com `VERCEL_AUTOMATION_BYPASS_SECRET`, que a Vercel grava em cada deploy; se o projeto tiver mais de um segredo de bypass, só o marcado como variável de ambiente passa pela guarda. **Gerar um segredo novo na Vercel pede um *Redeploy*** para a guarda passar a aceitá-lo, e cada projeto troca o valor de `WICOMM_REGISTRO_BYPASS`.
