# ADR 0003 — A opção do plugin vale por conta; o kit.json é o caminho do time

- Data: 2026-10-26
- Status: Aceito (Q291 respondida pelo operador em 2026-10-26)
- Autor: E1 (K14), a pedido da P2
- Relacionados: [ADR 0002](0002-processos-de-documento-e-design-sao-plugins-opcionais.md), substituído em parte (decisão 5 e a última frase do contexto sobre a aba de plugins do app)

<a id="contexto"></a>
## Contexto
- O ADR 0002 decidiu (Q259 e Q260) que desligar e ajustar mora no plugin, "editável na aba de plugins do app".
- A medição da K14 achou que o `userConfig` do `plugin.json` existe (booleano, texto, número) e que a doc só cita edição no `/plugin` e no `/config` do terminal, no `claude plugin configure` e no VS Code. O operador confirmou (Q291) que o app desktop não mostra as opções do plugin.
- O valor da opção é gravado em `pluginConfigs` do `~/.claude/settings.json` do usuário; entradas de projeto e de local são ignoradas de propósito, para um clone não injetar valor. A opção é, portanto, por conta, nunca por projeto.
- O hook recebe a opção por `CLAUDE_PLUGIN_OPTION_<CHAVE>`, e a variável não vem quando nada foi gravado; o gate não é hook e lê o valor do disco.

<a id="decisao"></a>
## Decisão
1. **O `kit.json` é o caminho principal e o do time.** Cada chave que o `kit.json` traz (`documentos.conferir`, `design.guarda`, `design.cobrarCritica`, `design.pasta`, `design.largura`) vence a opção do plugin (A7, como no 0002).
2. **A opção do plugin é ajuste da conta.** Mantém-se o `userConfig` nos plugins `processos` e `design`; edita-se pelo `/plugin` do terminal ou direto em `pluginConfigs` do `~/.claude/settings.json`, e vale só para quem a gravou. Sem valor gravado vale o padrão (ligado).
3. **O gate e a guarda leem a opção do disco** com um helper que não lança erro: arquivo ausente ou ilegível é "sem opção". O hook também aceita `CLAUDE_PLUGIN_OPTION_<CHAVE>` quando o app a exporta.
4. **O README do gate e a saída do `adotar` mandam primeiro para o `kit.json`** e citam o `/plugin` do terminal como ajuste da conta. Nada diz que o app desktop edita a opção.
5. Plugin desligado em `enabledPlugins` continua não rodando, e o `kit.json` não o religa.

<a id="alternativas"></a>
## Alternativas consideradas
- **Esperar o app desktop mostrar as opções do plugin.** Rejeitada: não há prazo nem documentação disso, e o projeto fica sem caminho para desligar uma regra até lá; o `kit.json` já resolve para o time.
- **Tirar o `userConfig` e ficar só com o `kit.json`.** Rejeitada: o `/plugin` do terminal já edita a opção, e quem quer desligar uma regra só na própria conta, sem mexer no arquivo do projeto, perderia o caminho.

<a id="consequencias"></a>
## Consequências
- Desligar para o time é commitar uma chave no `kit.json`; desligar só para si é editar a opção da conta, e o projeto não vê nem herda isso.
- Quem muda a opção no `/plugin` e quer o mesmo no time precisa escrever a chave no `kit.json`; o `kit doutor` lista onde o `kit.json` sobrepõe uma opção.
- A afirmação do 0002 sobre a aba de plugins do app deixa de valer; o resto do 0002 segue.
