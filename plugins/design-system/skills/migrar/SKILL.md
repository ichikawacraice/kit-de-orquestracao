---
name: migrar
description: Migra um projeto que usa o plugin antigo `wicomm` para o `design-system` com o plugin de tema (`tema-wicomm`) — desliga o `wicomm@wicomm`, liga os dois novos no `.claude/settings.json` do projeto e acrescenta o designer novo ao `.claude/kit.json`, sem renomear o `design/wicomm.json` nem mexer em dependência. Use quando o projeto ainda tem `wicomm@wicomm` ligado, quando pedirem "migra para o design-system", "troca o plugin wicomm pelo novo", "sai do wicomm", `/design-system:migrar`. Não é para subir a versão da base (isso é o `atualizar-sistema`) nem para entrar no sistema pela primeira vez (`novo-projeto`).
---

# Migrar do `wicomm` para o `design-system`

O `design-system` é o plugin `wicomm` com outro nome, e a marca saiu para um plugin de tema (`tema-wicomm`). A migração só troca o que o Claude Code liga: a base, as peças, os tokens e as guardas do projeto não mudam.

## 1. Antes

- **O marketplace do kit precisa listar os dois.** Rode `claude plugin marketplace update ichikawa-kit` (ou `claude plugin marketplace add ichikawacraice/kit-de-orquestracao`) e confira no `/plugin` que o `ichikawa-kit` oferece o `design-system` e o `tema-wicomm`. Se não aparecem, **pare**: diga à pessoa que o kit ainda não traz os dois plugins e que o projeto segue no `wicomm` até lá. Sem eles, desligar o `wicomm` deixa o projeto sem guarda.
- **Árvore limpa**, para o diff da migração ser só dela.

## 2. O plano, sem gravar

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/migrar.mjs" <raiz>
```

Mostra o que muda: `wicomm@*` desligado, `design-system@ichikawa-kit` e `tema-wicomm@ichikawa-kit` ligados, o marketplace `ichikawa-kit` declarado e `design-system:designer` nos `designers` do `.claude/kit.json` (o `wicomm:designer` fica na lista). Mostre a lista à pessoa. Se o script recusar porque o `design-system` já está ligado por outro marketplace, leve a ela: um plugin em dois marketplaces roda os hooks duas vezes, e a recomendação é deixar só o `ichikawa-kit`.

## 3. Gravar

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/migrar.mjs" <raiz> --aplicar
```

O que **não** muda, e por quê:
- o `design/wicomm.json` fica com o nome: o plugin e as guardas leem os dois nomes, e o script `guardas` do projeto passa esse caminho por `--config` (renomear quebraria o CI);
- as dependências (`@wicomm/tokens`, `@wicomm/guardas`) e o `components.json` (registro `@wicomm`) ficam;
- o `.claude/settings.local.json` é de cada pessoa: se alguém ligou o `wicomm` ali, avise que ele cede só quando desligado lá também.

Se o `CLAUDE.md` do projeto cita os comandos antigos (`/wicomm:estado`, `/wicomm:novo`…), troque pelos novos (`/design-system:…`).

## 4. Pronto

- Reabra a sessão do Claude Code no projeto (os plugins carregam no início) e aceite a instalação dos dois.
- `/design-system:estado` mostra a versão e a densidade do projeto, como o `/wicomm:estado` mostrava.
- Um pedido de tela recebe **um** lembrete de design, não dois.
- Commit: `chore(design): migra do plugin wicomm para o design-system com o tema-wicomm`.
