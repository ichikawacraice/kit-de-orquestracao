# Deploy

> Modelo do `/design-system:novo` (CONV-25). Troque `<app>`, `<pasta>` e o que o projeto tiver além do front; apague o que não se aplica.

## O build de produção é feito na máquina, não na Vercel

O `install` do projeto baixa `@wicomm/tokens` e `@wicomm/guardas` do GitHub Packages da org `wicomm-projects`, e nos servidores da Vercel ele receberia 401: a Vercel do `<app>` **não tem (e não deve ter)** o token dos pacotes. Quem publica monta o build com o próprio `~/.npmrc` (token `read:packages`, ver [instalar os pacotes](https://github.com/wicomm-projects/wicomm-design-system/blob/main/docs/instalar-pacotes.md)) e sobe o resultado:

```bash
cd <pasta> && vercel build --prod && vercel deploy --prebuilt --prod
```

Não usar `vercel --prod` sem `--prebuilt`: ele manda montar na Vercel e falha no install.

- `vercel.json` e as variáveis de ambiente da Vercel **não** levam `NPM_RC`, `NPM_TOKEN` nem `NODE_AUTH_TOKEN`.
- O deploy é manual: o push para a `main` não publica nada por si só. Terminar o merge não é terminar o release.

## Como conferir que subiu

```bash
vercel list <app> --scope <time>
```

O deploy mais recente deve aparecer como `● Ready` / `Production`. `UNKNOWN` com duração `?` é deployment **bloqueado** antes de buildar (conta ou projeto), não erro de código nem de token.

## Rollback

Promover o deploy anterior no painel da Vercel.
