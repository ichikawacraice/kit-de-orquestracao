# Ichikawa's Kit

Kit para trabalhar com **várias sessões do Claude Code no mesmo projeto** sem perder o fio: cada trabalho vira um item numa fila, uma sessão leva o item do plano ao PR, outra junta os PRs e mergeia, e travas por hook garantem as regras que não podem depender de memória.

É o marketplace de plugins `ichikawa-kit` (repositório `kit-de-orquestracao`) mais um CLI que põe o kit num projeto. Cada plugin é opcional: instale só os que for usar.

- [Instalar em 3 passos](#instalar)
- [O que o kit faz](#o-que-faz)
- [Os plugins num relance](#plugins)
- [Configurar](#configurar)
- [Cada plugin em detalhe](#detalhe)
- [O uso no dia a dia](#dia-a-dia)
- [Quem já tinha o kit](#quem-ja-tinha)
- [Documentação](#documentacao)

<a id="instalar"></a>
## Instalar em 3 passos

**Precisa de:** Claude Code no **app desktop** (o pane e a conversa entre sessões são do app), Node 20 ou mais novo e git. O repositório é público: nada pede convite nem login.

**1. Os plugins, uma vez por máquina** (depois, reinicie o app):

```bash
claude plugin marketplace add anthropics/claude-plugins-official   # se ainda não tiver
claude plugin marketplace add ichikawacraice/kit-de-orquestracao
claude plugin install orquestracao@ichikawa-kit
claude plugin install painel-sessoes@ichikawa-kit
claude plugin install processos@ichikawa-kit
claude plugin install design-system@ichikawa-kit
```

O `orquestracao` traz junto o `superpowers` do marketplace oficial ([por quê](docs/guia/conflitos.md#precisa-ter)). O `kit-performance` e o `tema-wicomm` são opcionais ([abaixo](#plugins)).

**2. O kit no projeto,** na raiz do repositório:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao adotar --simular   # mostra o que faria
npx -y github:ichikawacraice/kit-de-orquestracao adotar             # grava
npx -y github:ichikawacraice/kit-de-orquestracao doutor             # confere: tudo "ok"
```

Projeto sem `CLAUDE.md`: `iniciar` no lugar de `adotar`. Projeto com tela: acrescente `--design <pasta do front>`. Commite o que ele gravou.

**3. Numa sessão do projeto,** diga:

> você é a orquestradora

Ela se renomeia `🎛 orquestradora — <projeto>` e passa a ser a sessão com quem você fala. Abra o painel com `/painel` e peça o primeiro trabalho em palavras suas.

Passo a passo com o que cada comando grava: [O primeiro dia](docs/guia/primeiro-dia.md).

> **Atenção:** o `claude plugin install` liga o plugin na sua **conta**, para todo projeto. Quase todas as travas só agem onde o kit está em uso, mas algumas valem em qualquer sessão ([quais e como desligar](docs/guia/ligar-e-desligar.md#valem-em-todo-projeto)).

<a id="o-que-faz"></a>
## O que o kit faz

```
você ──pede──▶ orquestradora ──abre──▶ dona F12 ──PR──▶ fila de merge ──▶ main
                     ▲                    │                  │
                     └──── Q12 (pergunta) ┘   gate 1 vez ────┘
```

- **Você conversa com uma sessão só, a orquestradora.** Ela registra cada pedido como item (`F12`), abre uma **sessão dona** para ele e cuida do merge. Não edita código.
- **A dona faz o item inteiro:** confere o pedido, planeja, escreve, roda os testes afetados, pede revisão a um subagente de contexto limpo e abre o PR. Sem teto de donas ao mesmo tempo: o limite é o dos testes.
- **A fila de merge** junta os PRs prontos, roda os testes completos **uma vez** sobre a combinação e mergeia o que passou. Conflito ou vermelho volta para a dona.
- **Tudo o que precisa de você chega com ID (`Q12`):** o caso, o que acontece se você não decidir e a recomendação. Responde no chat (`Q12 sim`) ou no botão do painel. Decisão de baixo risco a sessão assume e marca *assumida, a confirmar*.
- **Travas (hooks)** seguram o que não pode depender de memória: subagente não edita, segredo não sai para outra sessão, só a orquestradora mergeia, teste não roda fora do teto de núcleos.
- **Teto de núcleos da máquina:** todos os testes de todas as sessões dividem uma cota de CPU, para dez sessões testando ao mesmo tempo não derrubarem o computador.

<a id="plugins"></a>
## Os plugins num relance

| Plugin | Para quê | Instalar? |
|---|---|---|
| `orquestracao` | O núcleo: travas, orquestradora, dona, revisão por subagente, comandos de painel e de testes | Sempre |
| `painel-sessoes` | O pane `/painel`, a barra acima do prompt e a batida que confere a fila a cada 10 min | Sim |
| `processos` | Spec, ADR, roadmap e diário; revisão de diff; auditoria de clique; conferência das docs no gate | Sim |
| `design-system` | Processo de design para app React: designer antes, crítico com nota depois, guarda que cobra a crítica | Sim; desligue no projeto sem tela |
| `kit-performance` | Práticas de performance por camada e o agente revisor de performance | Opcional, por projeto |
| `tema-wicomm` | A marca da empresa (cor, fonte, logotipo) para o `design-system` | Só em projeto interno da empresa |
| `kit-design` | Antecessor do `design-system`; fica só até a troca ([abaixo](#quem-ja-tinha)) | Não |

E o **CLI `kit`** (`npx -y github:ichikawacraice/kit-de-orquestracao <comando>`), que põe, confere, atualiza e tira o kit de um projeto.

<a id="configurar"></a>
## Configurar

### O CLI `kit`, no projeto

Roda sem instalar nada, na raiz do projeto. Abaixo, `kit` abrevia `npx -y github:ichikawacraice/kit-de-orquestracao`.

| Comando | O que faz |
|---|---|
| `kit iniciar` | Projeto **sem** `CLAUDE.md`: cria `CLAUDE.md`, gate, guarda, `.claude/kit.json` e lock |
| `kit adotar` | Projeto **em andamento**: põe o kit sem sobrescrever nada; o que difere vira conflito |
| `kit doutor` | Confere plugins, hooks, `kit.json`, versões e arquivos contra o lock. Não grava nada |
| `kit atualizar` | Traz a versão nova do que você não editou; o editado vira conflito para você decidir |
| `kit remover` | Tira o que o kit pôs; o que você editou fica |
| `kit migrar-marketplace` | Troca o nome antigo do marketplace na conta e nos projetos ([abaixo](#quem-ja-tinha)) |
| `kit ajuda` | Lista os comandos e as flags |

Flags mais usadas: `--simular` (mostra sem gravar; use antes da primeira vez), `--design <pasta do front>` (projeto com tela), `--perfil simples|pnpm-workspace` (formato do gate), `--trocar-test` (o `npm test` passa a ser o gate), `--parcial` (grava o resto quando há conflito). Todas: [Comandos](docs/guia/comandos.md).

**O que o kit grava no projeto:** blocos `kit:` no `CLAUDE.md` (o seu texto fora deles não é tocado), os plugins e a guarda em `.claude/settings.json`, a configuração em `.claude/kit.json`, o gate e a guarda em `scripts/kit/`, o lock em `.claude/kit.lock.json` e os modelos de documento que faltam em `docs/`.

### O `.claude/kit.json`: as regras do time

Fica no git e vale para todos do projeto. Vence a opção da conta quando os dois discordam.

| Seção | O que configura |
|---|---|
| `gate` | O comando dos testes completos, por pacote, o typecheck e os prazos ([gate](gate/README.md)) |
| `guarda` | Quais regras da guarda de operação ficam ligadas (`merge-commit`, `destrutivos`, `staging-amplo`…), o tronco, a pasta do front e a das migrations ([regras](docs/guia/ligar-e-desligar.md#guarda-de-operacao)) |
| `documentos` | As pastas de ADR, spec, roadmap e diário, e quais conferências de doc o gate roda |
| `design` | A pasta do front, a pasta de revisões e o tema (`"tema": "tema-wicomm"`) |
| `plugins.desligar` | Plugins que não servem ao projeto, desligados só nele ([perfil de plugins](docs/guia/ligar-e-desligar.md#perfil-de-plugins)) |
| `skillsDeFora` | Libera uma skill de outro plugin que o kit barra, ou declara a substituta |
| `performance` | Práticas dispensadas e o orçamento de web vitals do `kit-performance` |
| `anfitriao` | Qual app hospeda as sessões: `"auto"` (padrão: o kit reconhece o app desktop, o Orca e o terminal pelo ambiente) ou um valor fixo (`claude-desktop`, `orca`, `terminal`) para corrigir uma detecção errada |

### Ligar e desligar

| Para | Faça |
|---|---|
| Desligar um plugin **num projeto**, só para você | `"enabledPlugins": { "<plugin>@ichikawa-kit": false }` em `.claude/settings.local.json` |
| Desligar um plugin **num projeto**, para o time | O mesmo em `.claude/settings.json`, ou `plugins.desligar` no `kit.json` |
| Desligar um plugin **em toda a conta** | `claude plugin disable <plugin>@ichikawa-kit` (volta com `enable`) |
| Mudar uma opção do plugin, só para você | `/plugin` no terminal do Claude Code (o app desktop não mostra) |

Cada trava, o que faz, quando incomoda e o que se perde ao desligar: [O que ligar e desligar](docs/guia/ligar-e-desligar.md).

### Atualizar

- **Os plugins:** botão `Atualizar` do painel, ou `atualizar-plugins` no terminal de uma sessão. Depois, reinicie o app (o painel diz [se pode reiniciar agora](docs/guia/dia-a-dia.md#reiniciar)).
- **O kit no projeto:** `kit atualizar --simular`, depois sem a flag.

<a id="detalhe"></a>
## Cada plugin em detalhe

### `orquestracao` — o núcleo

Põe em pé o modelo de uma sessão dona por item com uma orquestradora coordenando. Sem ele, os outros plugins funcionam, mas não há fila, dona nem travas.

- **Skills:** `orquestradora` (o manual de quem coordena, mergeia e faz release), `papeis-e-modelos` (qual modelo cada sessão e subagente usa), `handoff-de-sessao` (passar o trabalho a outra sessão ou retomar depois de limpar), `notas-de-release`, `orquestrar-com-subagentes` e o comando `/ausente`.
- **Agentes:** `validador` (revisa o trabalho da dona com contexto limpo, só achados que afetam correção) e `explorador` (busca e leitura rápidas).
- **Comandos no terminal das sessões:** `painel` (lê e grava o estado), `proximo-item` (`F13`), `proxima-pergunta` (`Q42`), `testes-afetados`, `esperar-fundo`, `subir-versao`, `atualizar-plugins` e `limpar-disco`.
- **Travas (hooks):** a orquestradora não edita código, subagente não edita, segredo não sai, a dona grava o painel e o critério antes de terminar o turno, o contexto alto cobra limpeza, o validador roda no modelo certo, entre outras.
- **Configura:** pela lista `~/.claude/orquestracao/subagente-pode-escrever.txt`, a `trava-edicao-repos.txt`. (`KIT_TETO_DE_DONAS` não vale mais; se estiver definida, é ignorada.)

Regra completa: [`protocolo.md`](plugins/orquestracao/pool/protocolo.md), [`dona.md`](plugins/orquestracao/pool/dona.md) e a skill [`orquestradora`](plugins/orquestracao/skills/orquestradora/SKILL.md). Todas as travas: [ligar e desligar](docs/guia/ligar-e-desligar.md#plugin-orquestracao-as-travas).

### `painel-sessoes` — o que você vê

- **O pane `/painel`,** ao lado do chat: o que espera você (perguntas com botão de resposta), o que está travado, o que roda e o que está na fila, com a etapa de cada item, a dona e os PRs.
- **A barra acima do prompt,** em toda sessão: contexto usado, relógio do cache, perguntas abertas e os botões `Ficar ausente` / `Estou de volta`, `Abrir painel` e, na orquestradora, `Limpar`.
- **A batida,** a cada 10 minutos: cutuca a dona parada, solta o item cuja dona sumiu e avisa a orquestradora do que espera merge.

Não tem trava nem opção. Detalhe: [o painel](docs/guia/dia-a-dia.md#painel).

### `processos` — como o trabalho se documenta e se revisa

- **`spec-driven`:** o ritual de abrir spec, registrar ADR e fechar item no roadmap e no diário.
- **`revisar-diff`:** revisão do diff antes do PR, em paralelo por dimensão; chama o revisor de performance quando o `kit-performance` está ligado.
- **`auditoria-de-clique`:** segue cada clique de uma tela até o estado gravado, para achar o botão que "não faz nada".
- **Conferência das docs no gate:** reprova spec com status inválido, ADR fora do índice, linha de roadmap longa, link relativo quebrado e diário fora do formato. Cada regra se desliga à parte em `documentos.conferir`.

Detalhe: [ligar e desligar](docs/guia/ligar-e-desligar.md#plugin-processos-a-conferência-das-docs-no-gate).

### `design-system` — o processo de design

Para projeto com tela em React. Traz a base (direção de design, anatomia, convenções), sem marca: a cor e a fonte vêm de um plugin de tema.

- **O fluxo:** o agente `designer` escreve a revisão de arquitetura da tela **antes** do código; a dona implementa sem redesenhar; o `critico-de-ui` dá nota **depois** (abaixo de 24/30 volta para correção). A guarda nega o `gh pr create` uma vez quando o visual mudou sem crítica.
- **Agentes:** `designer`, `critico-de-ui` e `auditor-de-padrao` (mede um app existente contra a base).
- **Comandos:** `/design-system:novo`, `/design-system:auditar`, `/design-system:padronizar`, `/design-system:estado`, `/design-system:atualizar` e `/design-system:migrar`, mais skills de acessibilidade e textos de interface.
- **Configura:** a pasta do front em `design.pasta` do `kit.json` (o `--design` grava). Sem a pasta declarada, a guarda não age.

Manual: [README do plugin](design-system/plugins/design-system/README.md). Ateliê e pacotes npm: [`design-system/`](design-system/README.md).

### `tema-wicomm` — a marca, só em projeto interno

O tema da empresa para o `design-system`: cor, fonte, logotipo e registro. **Desligado por padrão:** liga só com `"design": { "tema": "tema-wicomm" }` no `kit.json` do projeto interno, e nunca na conta. Em app de cliente ou de fora da empresa, não ative: a marca não entra na licença ([NOTICE](NOTICE)). Trocar as cores é trocar o plugin de tema. Detalhe: [tema](docs/guia/ligar-e-desligar.md#tema-wicomm).

### `kit-performance` — opcional

Quatro skills por camada (`performance-front`, `performance-dados`, `performance-entrega`, `medir-performance`) com 31 práticas, cada uma com quando vale e quando não vale, e o agente `revisor-de-performance`, que audita o diff e devolve até 8 achados com evidência e conserto. Funciona sozinho. Liga só num projeto, de dentro dele:

```bash
claude plugin install kit-performance@ichikawa-kit --scope project
```

Detalhe: [performance](docs/guia/ligar-e-desligar.md#kit-performance).

<a id="dia-a-dia"></a>
## O uso no dia a dia

- **Pedir trabalho:** à orquestradora, em palavras suas. Ela confere o pedido contra o código antes de construir em cima e diz se algo estiver errado.
- **Responder:** `Q12 sim`, `Q12 não, faz X`, `Q12 adiar`, ou o botão no painel ([perguntas](docs/guia/dia-a-dia.md#perguntas)).
- **Sair por horas:** `/ausente on` na orquestradora; na volta, `/ausente off` traz o resumo do período ([ausente](docs/guia/dia-a-dia.md#ausente)).
- **Passar trabalho a outra sessão:** diga *"handoff"* ou *"salva onde parei"*.
- **Testes:** durante o trabalho só os afetados; o gate completo roda uma vez, na fila de merge ([testes](docs/guia/dia-a-dia.md#testes)).

Tudo em [O dia a dia](docs/guia/dia-a-dia.md).

<a id="quem-ja-tinha"></a>
## Quem já tinha o kit

- **O marketplace agora se chama `ichikawa-kit`** (antes, `kit-de-orquestracao`). O `marketplace update` não troca o nome: rode uma vez por máquina e reinicie o app ([detalhe](docs/guia/comandos.md#kit-migrar-marketplace)):
  ```bash
  npx -y github:ichikawacraice/kit-de-orquestracao migrar-marketplace           # mostra
  npx -y github:ichikawacraice/kit-de-orquestracao migrar-marketplace --aplicar # troca, com backup
  ```
  Num projeto que ele não achou, rode o `kit atualizar` depois.
- **O `kit-design` deu lugar ao `design-system`** (o antigo `design` virou `kit-design` antes disso, porque o plugin `design` da Anthropic tinha o mesmo nome). Na conta, o `atualizar-plugins` instala o `design-system` com as opções do velho e só então o desinstala (`--seco` mostra antes); em cada projeto, o `kit atualizar` passa o valor de `kit-design@ichikawa-kit` para `design-system@ichikawa-kit`. A seção `design` do `kit.json` não muda ([detalhe](docs/guia/ligar-e-desligar.md#kit-design)).

<a id="documentacao"></a>
## Documentação

| Para | Leia |
|---|---|
| Começar do zero | [O primeiro dia](docs/guia/primeiro-dia.md) |
| Usar no dia a dia | [O dia a dia](docs/guia/dia-a-dia.md) |
| Todo comando e flag | [Comandos](docs/guia/comandos.md) |
| Cada trava e opção | [O que ligar e desligar](docs/guia/ligar-e-desligar.md) |
| Conviver com outros plugins | [Conflitos](docs/guia/conflitos.md) |
| Algo deu errado | [Problemas comuns](docs/guia/problemas-comuns.md) |
| O guia inteiro | [`docs/guia/`](docs/guia/README.md) |
| Por que o desenho é este | [ADRs](docs/adr/README.md) |

## Licença

MIT ([LICENSE](LICENSE)), com duas exceções no [NOTICE](NOTICE): a marca da empresa (o `tema-wicomm`) não é licenciada, e os plugins que o marketplace lista vindos de outro repositório seguem a licença de lá.

## Para quem mexe no kit

Regras do código e comandos em [`CLAUDE.md`](CLAUDE.md). O manual das sessões está em [`protocolo.md`](plugins/orquestracao/pool/protocolo.md) e as decisões de desenho nos [ADRs](docs/adr/README.md). Estudos, planos e o diário em [`docs/`](docs/README.md).
