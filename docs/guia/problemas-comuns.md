# Problemas comuns

Primeiro passo para quase tudo, na raiz do projeto:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao doutor
```

## Na instalação

| Sintoma | Causa | Saída |
|---|---|---|
| `marketplace add` ou `npx` não acha o repositório | Endereço digitado errado, ou rede sem acesso ao GitHub (o repositório do kit é público) | Confira o endereço `ichikawacraice/kit-de-orquestracao` e o acesso a `github.com` |
| `atualizar-plugins` para com `ENOENT` em `…/marketplaces/ichikawa-kit/plugins/design-system/.claude-plugin/plugin.json` | O `orquestracao` da conta é 0.1.91 ou mais velho, e o `design-system` passou a morar em `design-system/plugins/` (F357) | O clone do marketplace já foi atualizado na tentativa: rode o script novo dele, `node ~/.claude/plugins/marketplaces/ichikawa-kit/plugins/orquestracao/skills/orquestradora/scripts/atualizar-plugins.mjs`. Depois disso a conta tem a versão que conhece a pasta nova |
| O `/painel` não existe, ou nada do kit acontece | Plugin instalado depois que o app abriu | Reinicie o app |
| `kit adotar` não grava nada e lista conflitos | Arquivo seu que difere do que o kit poria; o `adotar` não sobrescreve | Resolva cada conflito à mão, ou grave o resto com `--parcial` |
| `kit adotar` recusa: não há `CLAUDE.md` | Projeto novo | Use `kit iniciar` |
| `doutor`: plugin habilitado no projeto: não | `enabledPlugins` do projeto sem o `orquestracao`, ou com `false` | Ponha `"orquestracao@ichikawa-kit": true` no `.claude/settings.json` (e confira o `settings.local.json`, que vence) |
| `doutor`: versão do lock diferente da do CLI | O kit no projeto é de uma versão anterior | `kit atualizar --simular`, depois sem a flag |
| `doutor` lembra o `test` | O `npm test` ainda é o seu, não o gate | `kit atualizar --trocar-test` quando quiser trocar |
| <a id="nome-antigo"></a>`doutor` ou `atualizar-plugins`: plugins com o nome antigo do marketplace | O kit foi instalado quando o marketplace se chamava `kit-de-orquestracao`; o `marketplace update` não troca o nome | `kit migrar-marketplace` (sem flag mostra; `--aplicar` troca, com backup), depois reinicie o app. Para voltar: `--desfazer <pasta do backup>`, que ele mostra no fim |
| `doutor`: o `.claude/settings.json` declara o marketplace com o nome antigo | Projeto adotado antes da troca de nome | `kit atualizar` troca as chaves, guardando o `false` de quem desligou |

## No trabalho

| Sintoma | Causa | Saída |
|---|---|---|
| Teste recusado com o comando certo no motivo | Regra `teste-fora-do-teto`: teste chamado solto | Rode como o motivo diz (`node scripts/kit/com-fichas.mjs -- <comando>` ou `npm test`) |
| O gate espera a vez para sempre, ou sai com código 2 | `gate.comandoCompleto` chama `npm test`, que é o próprio gate | Aponte o `comandoCompleto` para a suíte (`npm run test:suite`) |
| Subagente recusado ao editar | Trava `subagente-nao-edita`: quem escreve é a sessão | Normal: a sessão grava o que o subagente devolveu. Se o fluxo precisa de subagente escritor, veja [conflitos](conflitos.md) |
| A sessão não termina o turno: "Painel das sessões não atualizado" | Ela abriu PR ou sessão, ou perguntou, e não gravou o painel | Ela grava e termina. A cobrança é uma por turno |
| A dona não termina o turno pedindo a saída do teste | Trava `criterio-da-dona`: editou sem mostrar o teste rodando | Ela roda os testes afetados e cola a saída |
| A orquestradora pede confirmação para editar | Trava `orquestradora-nao-edita`: ela coordena, a dona escreve | Diga não e peça um item; ou, se o projeto quer a orquestradora editando, veja [o que ligar e desligar](ligar-e-desligar.md) |
| Comando git ou `rm` pede confirmação | Guarda de operação | Confirme se é o que você quer; a regra e o motivo estão em [o que ligar e desligar](ligar-e-desligar.md#guarda-de-operacao) |
| Item parado no painel | A dona travou ou sumiu | A batida cutuca a dona e, se ela sumiu, solta o item; a orquestradora abre outra dona. Para apressar, peça à orquestradora |
| Nenhuma sessão nova abre sozinha | Modo ausente ligado | `/ausente off`, ou o botão `Estou de volta` da barra |
| A orquestradora esqueceu o papel | Limpeza de contexto ou reinício | Ela volta ao papel no início da sessão; se não voltar, diga de novo *"você é a orquestradora"* |
| Resposta "segue as recomendações" caiu na pergunta errada | Resposta sem ID vale só para as perguntas da última mensagem | Responda com o ID: `Q12 sim` |
| Plugin atualizado, comportamento antigo | O app ainda roda a versão anterior | Reinicie o app; o painel diz se pode agora |

## Desinstalar

No projeto, veja o que sai e depois tire:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao remover --simular
```

O `remover` tira só o que o kit pôs e você não editou. Os plugins saem da conta com `claude plugin uninstall <plugin>@ichikawa-kit`. O estado das sessões (painel, contadores) fica em `~/.claude/orquestracao/`; apague a pasta se não for usar mais o kit em projeto nenhum.
