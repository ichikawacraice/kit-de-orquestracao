# ADR 0032 — No Orca, a aba do kit roda a batida de leitura

- Data: 2026-11-06
- Status: Proposto
- Autor: sessão dona do F460 (worker do Orca), a partir do pedido do operador na Q1113 e da medição da coordenadora no mesmo dia
- Substitui: no item 7 da Decisão do [ADR 0030](0030-o-kit-reconhece-o-anfitriao-e-no-orca-so-da-as-regras.md), só a parte "a batida do mod continua só no app desktop". A fila sem turno segue só no app desktop, e o resto do 0030 fica como está.
- Relacionados: [ADR 0027](0027-o-estado-do-item-e-deduzido-e-fecha-pelo-merge.md) (o estado deduzido e o `deduzido.json`); [ADR 0028](0028-o-anotar-da-dona-lanca-a-fila-livre.md) (o `--anotar` lança a fila sem esperar a batida)

<a id="contexto"></a>
## Contexto
- **Quem roda a batida hoje.** A batida (`painel.mjs batida --sessoes <arquivo>`) roda só pelo mod `painel-sessoes`, a cada 10 min, e só com o app desktop aberto. O mod lê a lista de sessões do app (`list_sessions`), grava `batida/sessoes.json` e reveza com outras janelas por `batida/vez.json`.
- **O que acontece no Orca.** Ninguém roda a batida. Em 06/11, a última gravação de `~/.claude/orquestracao/batida/` foi às 11:27 (SP). A seção Sessões da aba do kit lê `batida/deduzido.json`, e por isso mostrou o dia todo o aviso "o estado das sessões não se atualiza há N min". Depois de 25 min, ela volta ao estado declarado.
- **O que a batida completa faz** (medido em `comandoBatida`, `painel.mjs`):
  1. coleta o estado deduzido de git, gh, lista do app e lista de workers do Orca;
  2. dentro da trava do painel:
     - julga (`julgar`, `batida.mjs`);
     - fecha o item cujo PR mergeou;
     - grava `deduzido.json`;
     - solta o item parado;
     - registra e baixa os desfechos e os avisos da fila;
     - grava `estado.json` (a memória das cutucadas) e os relatórios por projeto;
     - arquiva as perguntas fechadas;
     - apaga os marcadores `ativas/` e os cartões mortos;
     - grava `pode-reiniciar.json`;
  3. fora da trava, lança a fila sem turno;
  4. o mod entrega as mensagens (cutucada, relatório) por `send_message`, que só existe no app.
- **Por que a batida completa erra no Orca.** Sem a lista do app, toda dona `local_` (sessão do app desktop) sairia como `donaViva: false`, e o `julgar` soltaria o item dela. As mensagens também não teriam por onde sair: o worker da aba não tem remetente próprio, e cada envio abre um terminal (`kit.seguimento`).
- **O que já existe no Orca.**
  - O `painel.mjs` já lê sozinho a lista de workers do Orca (`worker-list`, F444) e deduz por ela a vida da dona do Orca.
  - O worker da aba (`orca/painel-do-kit/src/worker.ts`) é um processo Node do Orca. Medido em 06/11: o binário dele roda como Node 24 com `ELECTRON_RUN_AS_NODE=1` e tem `PATH` e `HOME` do operador, com `gh` e `git`.

<a id="decisao"></a>
## Decisão
1. **No Orca, o worker da aba roda a batida de leitura a cada 10 min:** `painel.mjs batida --leitura`, uma vez ao ativar e depois de 10 em 10 min.
   - Roda só quando `batida/deduzido.json` falta, está ilegível ou tem 10 min ou mais.
   - Roda uma por vez.
   - O script é o `painel.mjs` do plugin `orquestracao` instalado no escopo do usuário, achado em `installed_plugins.json` como o mod acha o dele.
   - O binário é o do próprio Orca, com `ELECTRON_RUN_AS_NODE=1`, e o prazo é de 60 s.
   - Gravou: a aba se relê (`kit.mudou`). Falhou: a falha vai só ao log, e a seção segue com o aviso de estado velho.
   - `PAINEL_DO_KIT_BATIDA=off` desliga.
2. **A batida de leitura só deduz e grava o `deduzido.json`, com `fonte: 'leitura'`.**
   - Não chama o `julgar`: não cutuca, não solta, não fecha pelo merge, não manda mensagem e não lança fila.
   - Não grava `estado.json`, os relatórios nem o `pode-reiniciar.json`.
   - Não apaga marcador nem cartão e não arquiva pergunta.
   - Não usa `--sessoes`: a batida monta as linhas a partir da própria lista de workers do Orca, que ela já lê, sem arquivo intermediário. Cada worker com pasta que existe vira uma linha, que só serve para achar o repositório de cada projeto para o `gh`.
3. **Sem a lista do app, a dona `local_` fica fora da vista** (`donaViva: null`), nunca morta. É o mesmo tratamento que o ADR 0030 deu à dona do Orca sem a lista dele. A seção Sessões já mostra `null` com dona como "fora da vista".
4. **As duas batidas não correm uma sobre a outra.**
   - A de leitura pula logo no início se o `deduzido.json` tem menos de 10 min.
   - Dentro da trava do painel, logo antes de gravar, ela confere de novo. Se outra batida gravou nesse meio-tempo, ela não sobrescreve e devolve `pulou`. A batida completa grava o `deduzido.json` dentro da mesma trava.
   - A de leitura não grava `vez.json`, então nunca adia a batida completa do app desktop.
   - Com o app desktop aberto e a batida dele em dia, a da aba pula.

<a id="alternativas"></a>
## Alternativas consideradas
- **Rodar a batida completa no worker da aba**, com a lista do Orca no lugar da do app, como o briefing sugeria. Ela soltaria o item de toda dona `local_`, porque a dona sem linha é dada como morta. Também cutucaria sem ter por onde mandar a mensagem: um terminal por envio, cada um acordando uma sessão. E fecharia e lançaria fila por um processo que o operador não vê. Descartada: a leitura dá o que falta (a seção Sessões em dia) sem nenhuma ação mecânica.
- **O worker montar `--sessoes` em TypeScript a partir do `worker-list`**, como o briefing pedia. Seria uma segunda leitura da mesma lista em outra linguagem, que o `painel.mjs` já faz (F444), e duas implementações a manter em acordo. Descartada: o `--leitura` reaproveita a `listaDoOrca()`.
- **Usar a `vez.json` do mod como trava entre as duas.** A `vez.json` serve para as janelas do app revezarem, e ocupá-la adiaria a batida completa, que é a que cutuca e solta. Descartada: a dupla conferência do `deduzido.json` (antes de coletar e dentro da trava) basta, porque a leitura só grava esse arquivo.
- **Incluir na leitura as ações mecânicas que não dependem da lista do app**: fechar o item pelo merge, relançar a fila órfã, arquivar as perguntas fechadas. No Orca elas já têm dono: o fechamento vem do `mergear` da fila no turno da orquestradora, e o lançamento vem do `--anotar` (ADR 0028). Descartada por ora. Fechar pelo merge é a candidata mais forte a voltar, se se medir item mergeado à mão que ficou aberto no Orca.
- **Deixar como está** (o 0030: batida só no app desktop). A seção Sessões fica velha o dia todo no Orca, que é onde o operador mais trabalha agora. Descartada.

<a id="consequencias"></a>
## Consequências
- No Orca, a seção Sessões recebe o estado deduzido a cada 10 min (etapa e PRs pelo `gh`, vida da dona do Orca, parado), e o aviso de estado velho só aparece se a batida falhar.
- Com o app desktop e o Orca abertos juntos, as duas batidas se alternam no `deduzido.json`. Quando vale a da leitura, a dona `local_` aparece "fora da vista" na aba do Orca. O pane do app desktop usa a etapa e os PRs do arquivo e desmente o parado pela própria lista ao vivo, mas não lê `donaViva`.
- O `fila-do-item` (a cobrança da entrega) passa a ter no Orca a etapa e os PRs deduzidos em dia.
- Com `KIT_ESTADO_DEDUZIDO=off` no app desktop, a batida dele não grava o `deduzido.json`, e a do Orca passa a gravá-lo. Quem desliga a dedução precisa desligá-la também na aba.
- Cada rodada custa cerca de 3 s de processo (medido em 06/11 com 9 itens vivos: o `gh pr list` de cada projeto e o `git` de cada dona). A trava do painel fica com a rodada só o tempo de gravar um arquivo.
- A dona do Orca nunca aparece como `rodando`, porque o Orca não diz se há turno em curso. O parado dela sai das gravações do item, dos commits e dos PRs.
