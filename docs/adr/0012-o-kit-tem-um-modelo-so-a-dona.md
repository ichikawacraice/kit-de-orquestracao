# ADR 0012 — O kit tem um modelo só: o pool de papéis sai do código e do texto

- Data: 2026-10-27
- Status: Proposto
- Autor: sessão dona do F195, a pedido do operador
- Relacionados: completa o [0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (tira a decisão 7, "desligar por regra, não apagar"); torna sem objeto o [0004](0004-via-rapida-escopo-trancado-e-piso-de-uma-executora.md) na parte do piso de uma executora, o [0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) na parte do aviso ao livre e o [0009](0009-afinidade-no-despacho.md) inteiro; mantém o [0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md), o [0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) e o [0010](0010-o-gate-emprestado-comeca-com-dois-workers-por-pacote.md) (teto de núcleos)

<a id="contexto"></a>
## Contexto
- O ADR 0011 trocou o pool de papéis (planejadora, design, executora e validadora em sessões separadas) por uma sessão dona do item do plano ao PR, mas manteve o pool atrás de uma chave (`KIT_MODELO=papeis` ou `modelo.json`) para os itens antigos terminarem nele.
- Os itens antigos terminaram. Sobrou, em código e texto, um segundo modelo que ninguém usa: travas que só valem para membro do pool, `painel pegar`/`seguinte`/`livres`, afinidade, piso de executora, excedentes, aviso ao livre, título velho, cinco manuais de papel, um "legado" com o dobro do tamanho do protocolo vivo e scripts de migração (um deles com defeito conhecido).
- O operador vai compartilhar o kit com outras pessoas e pediu que ele saia limpo: só as regras e as skills atuais, escritas como manual para quem nunca viu o pool.

<a id="decisao"></a>
## Decisão
1. **O kit tem um modelo só.** `KIT_MODELO`, `modelo.json` e o seletor `modeloDoKit` deixam de existir; o modelo da dona não é mais "o padrão", é o único.
2. **Sai do código o que só servia ao pool:** as travas T1, T1c, T2, T3b, T8 e T9; o hook `livre-se-limpa`, o `skill-do-papel` (com o mapa de skills por papel) e o `executor-anuncia`; o piso de E, os excedentes e o "esperando papel" do ritual da orquestradora; os papéis P/D/E/V da régua de contexto; `painel pegar`, `seguinte`, `livres`, `fez del` e o registro em `passaram`; na batida, o aviso ao livre, a afinidade, o título velho e a espera de máquina cheia da validadora; os scripts `migrar-fila` e `migrar-para-dona`; os agentes `orquestracao:executor` e `orquestracao:planejador` (no modelo da dona quem escreve é a dona, e subagente só lê ou revisa).
3. **Fica, com nome de agora:** `papel-do-pool.mjs` vira `travas-da-sessao.mjs` (T3 modo ausente, T5 painel só por comando, T6 merge só pela orquestradora, T7 a orquestradora só se limpa com o ok do operador); `executor-criterio.mjs` vira `criterio-da-dona.mjs` e cobra a dona em `execucao`, `validacao` e `merge`; "esperando papel" vira "item sem dona" (`sem-dona.mjs`, com a cópia do pane e o teste que compara as duas); as skills por etapa da dona passam a ler `pool/skills-por-etapa.json`; a régua de contexto (`contexto-do-papel.mjs`), que só media membro do pool, passa a medir a dona pela régua que o manual dela já trazia (≥ 350 mil limpa ou diz `Contexto: sigo — …`; ≥ 500 mil limpa) — *assumida, a confirmar*; a guarda F155 do `com add` (recusa o id da orquestradora) fica.
4. **O texto descreve só o que existe.** `pool/protocolo.md` é o manual do modelo da dona, com âncoras explícitas; `pool/papeis/` e `skills/orquestradora/legado-pool.md` saem; `papeis-e-modelos`, a skill da orquestradora, `/ausente`, o plugin `design`, o `CLAUDE.md` e o modelo de `CLAUDE.md` do `kit` deixam de citar planejadora, executora e validadora em sessão.
5. **Dado gravado antigo continua legível.** Os campos `fez`, `passaram` e `via` de itens já gravados seguem aceitos na leitura e num `set` igual ao gravado; nada novo os grava.
6. **O nome da pasta `pool/` fica** (o manual `pool/dona.md` e `~/.claude/orquestracao/pool/handoffs/` são citados por sessões vivas e pelo `CLAUDE.md` global de quem já usa o kit); renomear é outro item.

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter o pool atrás da chave (o 0011 como está).** Rejeitada: quem recebe o kit lê o dobro de texto para descartar metade, e cada trava do pool é um caminho a mais para o defeito; nenhum item vivo depende dele.
- **Mover o pool para uma pasta `legado/` sem apagar.** Rejeitada: continua no pacote que se compartilha e continua sendo testado; o histórico do git e os ADRs 0004–0011 já guardam o desenho para quem quiser estudá-lo.
- **Renomear também a pasta `pool/` e o caminho dos handoffs agora.** Adiada: quebra referências de sessões vivas e do `CLAUDE.md` global de cada máquina; vale um item próprio, com a migração do caminho.

<a id="consequencias"></a>
## Consequências
- Um modelo só para ler, testar e explicar; o protocolo cabe numa leitura.
- Quem ainda tiver `KIT_MODELO=papeis` no ambiente não recebe erro: a variável é ignorada.
- Os ADRs 0004, 0007 e 0009 continuam como estão (imutáveis); a parte deles que dependia do pool não tem mais objeto.
