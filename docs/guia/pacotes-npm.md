# Os pacotes do design system no npm

`@wicomm/tokens` e `@wicomm/guardas` moram em `design-system/packages/` e saem no npm público, sob a licença MIT. A cor da marca da empresa nos tokens não entra no MIT (`NOTICE`). Quem publica é o workflow `publicar-pacotes` (`.github/workflows/publicar-pacotes.yml`), sem token guardado, pela publicação confiável (*trusted publishing*) do npm.

<a id="primeiro-envio"></a>
## O primeiro envio, uma vez por pacote

A publicação confiável só vale para pacote que já existe no npm. Por isso, o primeiro envio de cada um é à mão, por quem administra no npm a organização do escopo (o nome depois do `@`). Até lá, o workflow só avisa que o pacote não existe e segue.

1. **A organização:** em npmjs.com, *Add Organization* com o nome do escopo, no plano gratuito (pacote público). Se o nome estiver tomado, pare: o escopo é o que o código importa, e trocar de escopo é outra decisão.
2. **Entrar no npm** na máquina, com a conta que administra a organização (`npm login`). Deixe a verificação em dois passos ligada.
3. **Publicar da `main` em dia**, com o gate da pasta verde:

   ```bash
   cd design-system && npm ci && npm test
   ```

   ```bash
   npm publish -w packages/tokens --access public
   ```

   ```bash
   npm publish -w packages/guardas --access public
   ```

4. **Ligar o publicador confiável** em cada pacote, só no dia em que for mergear a primeira versão nova (a configuração nova expira se não publicar nada em 2 dias, e aí é preciso apagá-la e criá-la de novo): npmjs.com → o pacote → *Settings* → *Trusted publishing* → *GitHub Actions*, com o dono e o repositório deste kit (o `<dono>/kit-de-orquestracao` do endereço de instalação) e o workflow `publicar-pacotes.yml`, e marque **npm publish** em *Allowed actions* (sem isso a configuração aceita só a publicação em etapas, que espera aprovação com 2FA a cada versão, e o workflow falha com um E404 ou ENEEDAUTH enganoso). Na mesma página, *Publishing access* em "Require two-factor authentication and disallow tokens" fecha o envio por token.

<a id="versao-nova"></a>
## Versão nova

Suba o `version` do pacote no PR que muda o que ele publica (o gate da pasta reprova se o `dist` dos tokens ou a `lib` das guardas mudar sem versão nova). Depois do merge na `main`, o workflow roda o gate da pasta e publica a versão que o npm ainda não tem, com proveniência. Versão publicada não se sobrescreve; depois de 72 horas, só sai do npm em casos restritos (sem dependentes e com poucos downloads).
