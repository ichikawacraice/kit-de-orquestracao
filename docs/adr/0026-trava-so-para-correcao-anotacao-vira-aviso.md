# ADR 0026 — Trava só para correção; anotação vira aviso

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F420, a partir da fase 1 do diagnóstico aprovada pelo operador em 05/11 ("Sim, fases 0 e 1")
- Relacionados: [diagnóstico da orquestração](../research/2026-11-05-diagnostico-orquestracao.md) (a medição que motiva); [ADR 0020](0020-o-design-system-mora-numa-pasta-com-dependencias-e-gate-proprios.md) (a guarda de design mora em `design-system/`)

<a id="contexto"></a>
## Contexto
- Hook de `Stop` que devolve `{"decision":"block"}` força um turno extra, e cada turno extra relê o contexto inteiro da sessão (média de ~200 mil tokens na dona). Na semana de 29/10 a 05/11 as travas de Stop geraram ~1.300 turnos extras, estimados em 0,5–0,8 bi de tokens.
- Três travas respondem pela maior parte, e o que elas cobram é, na maioria, anotação, não correção:
  - `criterio-da-dona` ("relatório sem a saída real"): 566 turnos na semana. Medido sobre 617 primeiras cobranças, ~606 eram de turno que rodou o teste e só não colou a saída. O defeito que ela existe para pegar (relatório que diz o que a saída contradiz) é a minoria.
  - `contexto-do-papel`: cobrava a cada turno acima do limiar, não ao cruzá-lo. A dona a 360 mil que respondia `Contexto: sigo` era cobrada de novo no turno seguinte se não repetisse a linha.
  - A guarda de design (plugin `design-system`) cobrava o crítico de UI no `Stop` de todo turno que mudava o visual: 183 turnos na semana, a maioria no meio do item, antes de a tela estar pronta para ser julgada.

<a id="decisao"></a>
## Decisão
- **Trava (turno extra) só para correção.** O que é anotação (colar, registrar, repetir) vira aviso: `{"systemMessage": …}` no `Stop`, visto pelo operador e sem turno extra.
- **`criterio-da-dona`:** continua bloqueando, até 2 vezes por turno, quando o relatório:
  - tem falha escondida (a última saída com resultado tem `N failed`, `ℹ fail N`, `# fail N` ou `Found N errors` e o relatório não cita o N junto da falha; ou, sem contagem, o diagnóstico `error TS…` do tsc ou a linha de status com `exit` diferente de zero contra relatório que afirma sucesso — o nome de um teste que cita `exit=1` não conta);
  - cita status ou contagem (`exit=0`, `98 passed`) que não aparece na saída real;
  - afirma sucesso (*"testes passaram"*, *"gate verde"*, `exit=0`) sem nenhum teste rodado no turno (trecho de Bash que começa pelo executor de teste, typecheck, lint, build ou gate — citar teste num `git add` ou `ls` não conta; saída com resultado de teste — `N passed`, `ℹ pass N`, `# pass N`, `Found N errors` —, qualquer que seja o executor; Monitor; `TaskOutput`; leitura de `.output`/`.log` que o turno lançou ou citou; notificação de tarefa em background).

  Fora disso, a saída real só não colada vira aviso, uma vez por turno (`avisou-sem-saida` no log).
- **`contexto-do-papel`:** uma cobrança por limiar cruzado (espera 250 mil com o turno esperando o operador = 1, alto 350 mil = 2, teto 500 mil = 3), gravada em `<sessão>:contexto` no estado dos hooks. O turno seguinte no mesmo limiar passa (`ja-avisado`); só um limiar acima cobra de novo; o contexto que cai abaixo do nível cobrado (limpeza, compactação) rearma. A linha `Contexto: sigo — …` responde ao limiar. Continua sendo bloqueio: limpar o contexto é correção de custo, não anotação.
- **Crítica de UI:** exigida uma vez, no fim do item. O `PreToolUse` do `Bash` que roda `gh pr create` nega se o visual da branch (a foto: o hash do diff visual desde o merge-base) mudou depois da última crítica; a segunda tentativa com a mesma foto passa. Vale também para o `gh -R … pr create` e para o PR aberto por subagente. As fotos criticadas valem para o repositório, não só para a sessão: a dona que limpa o contexto volta com outro id e não perde a crítica. O `Stop` da sessão não cobra mais. A regra (o que é visual, o que livra) fica no hook; muda só o gatilho.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Tirar o `criterio-da-dona`.** Rejeitada: o diagnóstico mostra que ele pega defeito real (falha escondida, número inventado). O custo vinha de cobrar o esquecimento, não da trava.
- **Manter o bloqueio e baixar para 1 cobrança por turno.** Rejeitada: a primeira cobrança é o grosso do custo (~89% resolvem nela); cortar a segunda economiza pouco.
- **Aviso também para "afirma sucesso sem teste".** Rejeitada: é o caso em que o relatório afirma o que não mediu, exatamente o que a trava existe para pegar.
- **`contexto-do-papel` como aviso puro.** Rejeitada: a dona que passa de 350 mil custa mais a cada turno; um bloqueio por limiar é barato e força a decisão (limpar ou dizer o que falta).
- **Crítica de UI no `Stop` só quando o item está em `validacao` ou `merge`.** Rejeitada: a guarda vive no plugin `design-system`, que não conhece a fila do kit; o `gh pr create` é o fim do item em qualquer projeto que use o plugin.

<a id="consequencias"></a>
## Consequências
- Menos turnos extras: pela medição, ~606 de 617 primeiras cobranças do critério viram aviso; o contexto cobra uma vez por limiar; a crítica de UI uma vez por PR.
- O relatório sem a saída colada passa com aviso: quem confere que o número veio do comando de critério continua sendo o validador.
- **Limite conhecido:** o PR aberto pelo botão do app (`create_pr`) não passa pelo `Bash` e escapa da cobrança da crítica. Quem cita o número da saída e erra é cobrado; quem não cita número nenhum só ganha aviso. As cópias antigas da guarda em `design-system/plugins/wicomm/hooks/` e `plugins/kit-design/hooks/` não mudaram.
- O estado do `contexto-do-papel` mora no mesmo `hooks-crewai-estado.json` dos outros hooks e é podado em 7 dias.
