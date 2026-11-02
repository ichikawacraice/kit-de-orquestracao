# O primeiro dia

Do zero ao primeiro item entregue. Leva uns 15 minutos, quase todos esperando o app reiniciar.

## 1. Antes de tudo

- Claude Code no **app desktop**. O pane `/painel` e a troca de mensagens entre sessões são do app: no terminal puro o kit perde metade do que faz.
- Node 20 ou mais novo, e git.
- O repositório do kit é privado: peça o convite a quem o mantém e entre no GitHub com a conta convidada (`gh auth login`).

## 2. Os plugins, uma vez por máquina

```bash
claude plugin marketplace add ichikawacraice/kit-de-orquestracao
```
```bash
claude plugin install orquestracao@ichikawa-kit
```

O `orquestracao` é o núcleo. Repita o `install` para `painel-sessoes`, `processos` e `kit-design`. O `kit-performance` é opcional: instale-o só se quiser as práticas de performance e o revisor ([o que ele traz](ligar-e-desligar.md#kit-performance)). Reinicie o app: plugin novo só vale depois do reinício.

**Atenção:** o `install` liga o plugin na sua conta, para **todo** projeto, não só para o que tem o kit. A maior parte das travas só age onde há orquestradora ou item na fila, mas algumas valem em qualquer sessão: a lista e como desligá-las num projeto estão em [O que ligar e desligar](ligar-e-desligar.md#valem-em-todo-projeto).

## 3. O kit no projeto

Na raiz do repositório do projeto, veja primeiro o que ele faria:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao adotar --simular
```

Se a lista estiver boa, rode de novo sem `--simular`. Projeto novo, sem `CLAUDE.md`: use `iniciar` (não tem `--simular`; não há o que sobrescrever). Projeto com front: acrescente `--design <pasta do front>`.

O que ele grava no projeto:

| Arquivo | O quê |
|---|---|
| `CLAUDE.md` | Blocos entre marcas `kit:` com as regras das sessões. O seu texto fora das marcas não é tocado |
| `.claude/settings.json` | Liga os quatro plugins em `enabledPlugins` (chave que já existe não é trocada: um `false` seu fica `false`), declara o marketplace (quem clonar o projeto recebe o convite para instalar) e registra a guarda de operação |
| `.claude/kit.json` | A configuração do kit neste projeto: o comando do gate, as regras da guarda, as pastas de documento |
| `scripts/kit/` | O gate de testes e a guarda de operação |
| `.claude/kit.lock.json` | O que o kit pôs, com hash: é por ele que o `kit atualizar` e o `kit remover` sabem o que é do kit e o que é seu |
| `package.json` | O `npm test` passa a ser o gate no `iniciar`, com `--trocar-test`, quando o `test` é o de exemplo do npm (`no test specified`) ou quando não há `package.json` (ele cria um). Com um `test` seu e sem a flag, o seu fica como está |
| `docs/` | Os modelos de documento que faltam: índices de ADR, specs, planos, pesquisa e diário, e o roadmap. Os que já existem ficam |
| Pasta do front | Só com `--design`: os modelos `PRODUCT.md`, `ANATOMIA.md` e `DESIGN.md` |

E fora do projeto, em `~/.claude/orquestracao/`: cria o `subagente-pode-escrever.txt` vazio (nenhum subagente liberado) e, se a lista `trava-edicao-repos.txt` já existe, acrescenta este repositório a ela ([o que são](ligar-e-desligar.md)).

Nada é sobrescrito: o que já existe e difere vira conflito, e o `adotar` não grava nada até você resolver (ou grava o resto com `--parcial`).

Confira:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao doutor
```

Tudo `ok` é o esperado. Cada `falha` traz o comando que a resolve.

Commite o que o kit gravou no projeto: o `.claude/kit.json` e o `CLAUDE.md` valem para o time inteiro.

## 4. Declarar a orquestradora

Abra uma sessão no projeto e diga:

> você é a orquestradora

Ela carrega o manual, se renomeia `🎛 orquestradora — <projeto>` e passa a ser a sessão com quem você fala. Uma por projeto. Se o app reiniciar ou o contexto for limpo, ela volta ao papel sozinha.

Abra o pane com `/painel`. Ele fica ao lado do chat e mostra o que espera você, o que está travado, o que roda e o que está na fila.

## 5. O primeiro item

Peça à orquestradora em palavras suas, como pediria a uma pessoa:

> o botão de exportar da tela de relatórios não faz nada; descobre por quê e corrige

O que acontece:

1. A orquestradora confere o pedido, registra o item (`F1 · Exportar relatório`) e abre uma sessão dona para ele, com o modelo escolhido pelo risco.
2. A dona aparece na lista de sessões do app, aninhada sob a orquestradora. Você pode abri-la e conversar com ela, mas não precisa.
3. Se a dona precisar de uma decisão sua, a pergunta chega no painel com um ID (`Q1`). Decisão de baixo risco ela assume e marca *assumida, a confirmar*.
4. A dona abre o PR e avisa a orquestradora. A orquestradora roda os testes completos na fila de merge e mergeia.
5. O item fica `feito` no painel e a orquestradora arquiva a sessão dona.

Daí em diante é o [dia a dia](dia-a-dia.md).
