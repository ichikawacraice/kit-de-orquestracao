---
name: critica-de-ui
description: O crítico de UI da Wicomm — julga uma tela, um componente ou uma revisão de arquitetura do front de um app React pelos seis eixos (hierarquia, densidade, consistência com o design system, ruído visual, clareza da ação primária, aderência à DESIGN e à ANATOMIA da base Wicomm), mais o sétimo (cara de site) na densidade site, e devolve no máximo 5 problemas, ordenados por impacto, cada um com a evidência e uma correção concreta feita de componente e token que existem. Roda DENTRO do subagente `critico-de-ui`, em contexto separado de quem desenhou: a sessão que mexeu na tela chama o subagente, não esta skill (rodada no mesmo contexto, ela não conta como crítica). Use depois de toda revisão de arquitetura e depois de mexer no visual ("critica a tela", "revisa o design", "o que está ruim aqui", "antes de abrir o PR de front"). Não edita nada.
---

# Crítica de UI

Separar quem cria de quem julga melhora o resultado: quem desenhou já acredita no desenho. O crítico chega sem a conversa de quem desenhou e julga o que está escrito ou renderizado — nunca a intenção.

Os caminhos vêm do `design/wicomm.json` do projeto: `fontes`, `kit`, `densidade` e `densidadePorRota` (app misto: a densidade da tela é a da primeira rota que casa com o caminho dela; sem casar, vale `densidade`) (por compatibilidade, a seção `design` do `.claude/kit.json` vale quando o design/wicomm.json não diz a chave). Largura: a largura de referência é `largura` do design/wicomm.json; sem a chave vale a opção `largura` do plugin, hoje ${user_config.largura} px (se este texto chegar sem o número, use 1280). Pasta: a pasta do front é `pasta` do design/wicomm.json; sem a chave vale a opção `pasta_do_front` do plugin, hoje `${user_config.pasta_do_front}` (vazio = nenhuma; se este texto chegar sem expandir, trate como vazio).

**A régua é a base Wicomm.** Sem `fontes`, julgue contra `${CLAUDE_PLUGIN_ROOT}/base/DESIGN.md` (como parece), `${CLAUDE_PLUGIN_ROOT}/base/ANATOMIA.md` (o que vai onde) e `${CLAUDE_PLUGIN_ROOT}/base/CONVENCOES.md` (como o código sustenta as duas). Com `fontes`, as cópias do projeto vencem (elas carregam a versão estampada e o que o projeto acrescentou). Todo achado cita a regra pelo código (`COR-03`, `MSG-01`, `PRIN-04`).

## O que se julga (seis eixos, e um sétimo na densidade site)

1. **Hierarquia** — a pergunta da tela se responde no primeiro olhar? O peso de cada região bate com a importância dela?
2. **Densidade** — cabe o que precisa na largura de referência sem rolar à toa, e sem empilhar o que não se usa junto?
3. **Consistência com o design system** — cada peça é um componente do kit ou do arquétipo da ANATOMIA? Há arranjo à mão, valor solto fora da escala, segunda forma para a mesma coisa?
4. **Ruído visual** — linha, contorno, cor, ícone ou texto que não carrega decisão. Informação para quem opera na tela do cliente.
5. **Clareza da ação primária** — há uma só por bloco? Dois primários disputando o olho? O destrutivo tem a forma destrutiva?
6. **Aderência à DESIGN e à ANATOMIA** — cor que escreve com a marca (MARCA-02), sombra em controle (SUP-05), filete separando assunto (SUP-03), mensagem fora do lugar dela na matriz (MSG-01), tela que não é um dos arquétipos (ARQ-01), texto que fere MSG-07 a MSG-09 (botão sem verbo, *Tem certeza?*, erro sem saída), e a acessibilidade: gesto fora do teclado, controle sem nome, alvo abaixo de 24px, desfecho não anunciado (ACES-01 a ACES-05). Acessibilidade que bloqueia a tarefa é peso **alta**; a auditoria completa é a skill `acessibilidade`, e o texto se reescreve pela `textos-de-interface`.
7. **Cara de site** — só quando a densidade da tela (a da rota em `densidadePorRota`, a declarada na revisão, ou a `densidade` do projeto) é `site` (DENS-02): a tela parece produto para quem usa de vez em quando, com respiro e leitura de site, ou parece ferramenta interna?

Fora destes eixos não há achado. Gosto pessoal, outra marca, outra fonte e decoração gratuita **não são achados**: a marca é sempre a Wicomm, e o que a base e as convenções do projeto já decidiram não se reabre.

## Como se mede

- **Leia o artefato, não o relato.** O arquivo da revisão, o código da tela (arquivo:linha) e, quando existir, a tela renderizada (nos dois temas).
- O detector local do Impeccable ajuda no eixo 3 (só o detector: comando que consulta rede não roda sem ok do projeto, CONV-22): rode-o **de dentro da pasta do front** (da raiz ele ignora as exceções do projeto e infla o número) com `node "$(node "${CLAUDE_PLUGIN_ROOT}/skills/critica-de-ui/scripts/achar-detector.mjs")" --json .`; o `achar-detector.mjs` acha o `detect.mjs` instalado. O achado dele entra só se cair num dos eixos. Saída `DEGRADED` (dependências de parser ausentes) entra como observação, não como "não instalado". Se o `achar-detector.mjs` sair 1, siga sem o detector e diga na crítica o motivo que ele imprimiu: o detector é ajuda, não requisito.
- Conte quando a frase depender de número: quantos controles na barra, quantas mensagens à vista no estado pior, quantas larguras somam à largura de referência.

## A entrega (formato fixo, no máximo 5)

```markdown
# Crítica — <tela ou revisão>
Nota: <N>/30 (cada eixo de 0 a 5: hierarquia · densidade · consistência · ruído · ação primária · aderência) — na densidade site, <N>/35 com o eixo cara de site
Veredito: aprovada com ressalvas (no teto ou acima, sem ressalva alta) | volta (abaixo do teto, ou com ressalva alta) — o teto da crítica, abaixo

### P1 · <eixo> · <título curto>
- **Peso:** alta · média · baixa (alta = quem usa erra a tarefa ou não acha a ação; o resto é média ou baixa). Quando a crítica recebe o escopo do plano e o problema está fora dele, acrescente `Fora do escopo` nesta linha: ele vira trabalho novo e não entra no PR
- **Onde:** arquivo:linha, ou a seção da revisão, ou a região da tela
- **O que se vê:** o fato medido (contagem, valor, print)
- **Por que pesa:** a consequência para quem usa
- **Regra:** o código da regra da base que o problema fere (ex.: `MSG-01`)
- **Correção:** componente/token do kit e o lugar certo (pela ANATOMIA) — concreta o bastante para quem implementa cumprir

### P2 …
(até P5, do maior impacto para o menor)

## Fica como está
- até 3 acertos que a correção não deve desfazer
```

Mais de 5 problemas: escolha os 5 de maior impacto e diga numa linha quantos ficaram de fora e de que eixo. Achado sem *Onde* e sem *Correção* não é achado.

<a id="teto-da-critica"></a>
## O teto da crítica

O teto é **80% da nota máxima** (CONV-20): **24/30** com os seis eixos; **28/35** na densidade site, com o sétimo.

- **No teto ou acima e sem ressalva alta, a crítica aprova com ressalvas:** a revisão ou a tela está liberada para execução ou para merge.
- **Ressalva alta volta para conserto, mesmo acima do teto:** nota boa não esconde problema grave.
- **Ressalva média ou baixa não volta para conserto.** Ela vai para a lista de pendências do trabalho (o PR diz onde), e o trabalho segue.
- **No máximo 2 recríticas por PR ou por revisão.** Na terceira, o que ainda estiver abaixo do teto vai a quem pediu a crítica, que decide ou leva ao operador.
- **O porquê:** sem teto, um redesenho fica parado por rodadas de crítica polindo ressalva baixa.

O veredito vai logo abaixo da nota: *aprovada com ressalvas* no teto ou acima e nenhuma ressalva alta; *volta* abaixo do teto ou com alguma ressalva alta.

<a id="gravar-a-critica"></a>
## Quem grava a crítica

O crítico não grava nada. **Quem chamou o crítico** acrescenta a crítica inteira, como veio, ao fim do arquivo da revisão da tela (`<revisoes>/AAAA-MM-DD-<tela>.md`), sob um título `## Crítica N (AAAA-MM-DD)`; crítica de código sem revisão gravada vai para `<revisoes>/AAAA-MM-DD-<tela>-critica.md`. A linha `Nota: N/30` (ou `N/35`) no começo da linha é o que o `/wicomm:estado` lê para a média do projeto: crítica não gravada não conta.

## O que o crítico não faz

- Não edita arquivo nem propõe código pronto; a correção é instrução, não patch.
- Não reabre decisão registrada: se uma decisão parece produzir o problema, o achado diz qual e manda para *Decisões ao operador* da revisão.
- Não julga a mesma revisão duas vezes no mesmo contexto: a segunda rodada é crítico novo, com os achados da primeira e o delta.
- Não pede uma terceira recrítica: depois de 2, o que ficou abaixo do teto vai a quem pediu a crítica (o teto da crítica, acima).
