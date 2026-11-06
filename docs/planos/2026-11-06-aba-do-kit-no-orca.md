# F436 · Aba do kit no Orca: perguntas, decisões assumidas e entregas (06/11)

Ponto de partida: a prova F434 (plugin `local.perguntas-kit`, relatório em `/tmp/prova-orca/RELATORIO-F434.md`, que não sobrevive ao reinício). Relacionados: [ADR 0030](../adr/0030-o-kit-reconhece-o-anfitriao-e-no-orca-so-da-as-regras.md) (F435 · Modo Orca, fatias 7 e 9).

## O caso
O operador usa o Orca para coordenar as sessões. Quer, numa aba lateral do Orca: as perguntas abertas para responder; as decisões que as sessões assumiram, para confirmar uma a uma ou todas, ou discordar; e um resumo do que cada sessão entregou, porque as sessões se arquivam sozinhas e ele fica sem saber o que aconteceu. Ler não pode gastar token de modelo; só responder e discordar acordam alguém, e só quem precisa.

<a id="premissa-conferida"></a>
## Premissa conferida
- **A prova não tem tipos:** o `orca plugin types` falha no Orca 1.4.250 (os `.d.ts` não vieram no pacote). O plugin roda sem eles (o Orca transpila o `.tsx`/`.ts` ao carregar, sem build), e a API foi lida na documentação oficial do Orca (`docs/reference/plugin-host-api.md` e `plugin-declarative-ui.md`).
- **Sem build e sem dependência npm:** o `orca` e o `orca/testing` vêm do próprio Orca. A lógica fica em `.mjs` puro, testada com `node --test` pelo gate do repo; o painel e o worker (`.tsx`/`.ts`) se testam com `orca plugin test`, como o mod `painel-sessoes` se testa com `claude plugin test`. Não há exceção à regra de dependência.
- **O worker do plugin não manda mensagem de orquestração sozinho** (`no_active_sender_terminal`, medido na F434). Entrega só por um terminal que o worker cria; o texto vai em arquivo, nunca na linha de comando.
- **`respondidaPor` só o pane grava** e o `painel update` recusa o campo. O plugin grava por caminho próprio (lê, confere a versão, grava com `rename`), como o pane faz, com `respondidaPor: "operador-orca"` (Q1055).
- **De onde se leem as entregas:** no app do Claude, o campo `entrega` do item feito (`fila/<F>.json`, o mesmo do `painel entregas`); no Orca, os `worker_done` da caixa (`orca orchestration inbox --full --json`, que de dentro do worker do plugin lista todas as Runs). Os dois sem modelo.
- **"Limpar" não precisa de campo no painel:** é estado da aba, não fato do item. Fica no armazenamento do próprio plugin (`storage:own`), sem mexer na validação do painel nem subir a versão do item que sessões gravam com `--se-versao`. *Assumida, a confirmar.*

<a id="contrato"></a>
## Contrato com o painel e com a fatia 9 da F435
- **Resposta pela aba** (pergunta aberta, decisão assumida confirmada ou mudada): `estado: "respondida"`, `resposta`, `atualizadoEm`, `respondidaPor: "operador-orca"`, `respondidaEm` (ISO), versão + 1, presa à versão lida. A trava de limpeza aceita `painel` e `operador-orca`.
- **Confirmar decisão assumida não acorda ninguém** (a sessão já agiu assim): só grava, `resposta: "confirmada pelo operador (Orca)"`.
- **A entrega da resposta** fica registrada na própria pergunta, para quem entrega depois (a batida do app, na fatia 9) saber o que falta: `entregaDaResposta: { estado: "entregue" | "pendente" | "falhou", via: "orca", destino?, em, motivo? }`.
- **O destino** sai só do que a pergunta grava: `endereco.orca` (o `--to` que o `orca orchestration send` aceita: `run:<id>`, `dispatch:<id>` ou `orca_session_id:<id>`), campo que a fatia 9 da F435 cria no nascimento da pergunta. Sem ele, a resposta fica `pendente` e a aba diz isso. Nunca pelo título da sessão nem pela "orquestradora ativa".
- **O transporte no Orca** é deste plugin (`entregarPeloOrca`): terminal criado pelo worker, comando fixo que lê assunto e corpo de arquivos (`"$(cat …)"`), destino validado por expressão, saída em arquivo; nada do texto do operador entra na linha de shell. A fatia 9 liga a rota e a junção de respostas próximas por cima dele.

<a id="escopo"></a>
## Escopo deste PR (Q1064)
A casca de seções (trilho de ícones à esquerda) com **Perguntas**, **Decisões** e **Entregas**. Ficam para depois, cada uma no seu PR: Agora, PRs, Custo, Manutenção e Histórico. Desenho: [revisão de design](../design/revisoes/2026-11-06-aba-do-kit-no-orca.md).

## O que entra
1. **Perguntas abertas:** lista, caso, recomendação; "Aceitar a recomendação" e resposta livre. Grava e entrega (quando há endereço).
2. **Decisões assumidas:** "Confirmar" por item e "Confirmar todas"; "Discordar…" abre o texto e grava + entrega a mudança à sessão.
3. **Entregas por sessão:** últimos 7 dias, do painel e do Orca; "Limpar" (some da lista, nada se apaga; "Desfazer" na hora) e "Limpar todas"; "Responder" manda o seguimento à sessão (Orca: `dispatch:` vivo; senão a Run, isto é, a orquestradora).
4. **Barra de status:** quantas perguntas e decisões esperam o operador.
5. **Respondidas com entrega pendente:** a resposta gravada cuja entrega falhou fica à vista em Perguntas, com "Tentar entregar de novo" (`kit.reentregar`); a sem endereço vai a uma dobra fechada.
6. **Desfazer do confirmar** (`kit.desfazer`): volta a decisão a assumida, preso à versão que a confirmação deixou e só se ninguém mexeu depois.

## Fatias deste PR (teste antes do código)
- `src/nucleo/*.mjs`: leitura (perguntas, assumidas, entregas do painel e do Orca), gravação com prova do clique, transporte seguro, lidas. Testes `node:test`.
- `hooks/travas-da-sessao.mjs`: origem `operador-orca`.
- `src/worker.ts` e `src/panel.tsx`: handlers e tela, com `orca plugin test`.
- Laudo: clique real na aba carregada no Orca, contagem de chamadas que provam que ler não gasta modelo.

## Fora do escopo
- O campo `endereco` no nascimento da pergunta, a rota da batida no app e a junção de respostas próximas (fatia 9 da F435).
- A trava como hook do Orca (`agent.launch.before`).

<a id="medido-no-orca"></a>
## Medido no Orca (06/11)
- **O átomo `persist: 'storage'` perde o "Desfazer" rápido:** depois de gravar, o Orca relê o armazenamento; se o "Desfazer" cai antes dessa releitura voltar, a gravação seguinte (com atraso de 400 ms) leva o valor velho. As entregas limpas passaram a átomo em memória com `storage.get/set` explícitos.
- **O `--scenario` e o `--act` do `orca plugin shot` só rodam com a janela do Orca escondida;** com ela em uso, só a captura simples, com os dados reais e no tema da hora.
- **A pergunta não traz o tema do item:** o título do grupo em Decisões mostra só `F<n>`. *Assumida, a confirmar:* trazer o tema pelo `fila/<F>.json` num PR seguinte.

<a id="decisoes-assumidas"></a>
## Decisões assumidas, a confirmar com o operador
- "Limpar" guarda o estado no plugin, não no painel (acima).
- Entregas dos últimos 7 dias; o resto só pelo `painel entregas`.
- A pasta do plugin é `orca/painel-do-kit/` (fora de `plugins/`, que é o marketplace do Claude).
