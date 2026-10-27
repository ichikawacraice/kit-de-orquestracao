# F143 — itens parecidos vão ao mesmo membro (afinidade no despacho)

Decisão do operador: Q418 (27/10, "sim, segue a recomendação"). A decisão de desenho está no [ADR 0009](../adr/0009-afinidade-no-despacho.md); este plano diz
como executar. Tudo marcado *assumida, a confirmar* é reversível e barato.

<a id="medido"></a>
## O que foi medido (27/10, `origin/main` e6565a0, fila real)

- **A escolha do livre** é `livresDe` em `plugins/orquestracao/skills/orquestradora/scripts/batida.mjs`: livres do papel no
  projeto, o mais antigo parado primeiro; `julgar` avisa `livres[0]`. Nenhum critério de assunto.
- **O que a fila guarda de quem passou pelo item:** `fez` (`{localId, apelido, oQue, em}`, só de quem saiu com `--fez`,
  na prática E e D), `donoLocalId` (só o atual) e `historico` (`{em, etapa, dono}`, com o **apelido**, sem `local_…`).
  Na fila real: 143 itens, 75 com `fez`, 106 com `historico` com dono. A P não entra em `fez` (o `--fez` é o que isenta a
  executora da limpeza, então não serve de registro geral), e o apelido sozinho é ambíguo: há dois `E2` vivos em
  momentos diferentes (sessões diferentes).
- **`tema`** existe em todo item (`painel temas`): no kit `painel`, `processos`; no outro projeto `editor`, `quadro`,
  `gate`, `orquestracao`…. Para a D, os temas já são telas (`editor`, `quadro`, `painel`).
- **Ao terminar**, o membro se declara livre e o hook `livre-se-limpa.mjs` exige `clear_session "self"` no mesmo turno.
  `comandoPegar` (`painel.mjs`) já é atômico e é o único caminho do livre para o item.

<a id="decisoes"></a>
## Decisões

- **A1 · Registro de quem passou:** campo novo `passaram` no item, lista de `{localId, apelido, papel, em}`, gravada
  **só pelo `painel`** a cada `com add` e `pegar` (repetir a mesma sessão atualiza o `em`). `set`, `update` e `batch`
  recusam o campo, como o `com`. Item antigo sem `passaram`: vale o `fez` (com o papel pela letra do apelido).
- **A2 · O membro afim** de um item que espera o papel X: entre os itens do mesmo projeto e mesmo `tema` (vivos ou
  fechados), a entrada de `passaram` (ou `fez`) do papel X com o `em` mais recente cuja sessão está viva na lista do app
  e cujo título ainda começa com o mesmo apelido (sessão arquivada ou renomeada para outro papel não conta).
- **A3 · "Mesma tela" para a D é o mesmo `tema`.** *Assumida, a confirmar* (os globs de tela do `kit.json` dizem quais
  arquivos são tela, não qual tela; o tema já separa editor, quadro e painel).
- **A4 · A batida oferece primeiro ao afim:** em `julgar`, item esperando o papel:
  - afim **livre** → o aviso vai a ele (no lugar de `livres[0]`);
  - afim **ocupado** (vivo, fora de `livre`) e o item espera há menos de `AFINIDADE_MIN` (padrão **20 min**, env
    `BATIDA_AFINIDADE_MIN`) → manda **uma vez** ao afim `F<n> · <título>, do mesmo assunto, espera você: pegue ao
    terminar o atual` e não avisa outro livre nem pede vaga;
  - passou de `AFINIDADE_MIN`, ou sem afim → o de sempre (`livres[0]` ou vaga).
  *Assumida, a confirmar*: 20 min é menos que o `PRAZO_MIN` (30) do item parado e cabe um item pequeno.
- **A5 · Ao terminar, o membro olha o mesmo assunto antes de se limpar:** comando novo
  `painel seguinte <local_…> <apelido>`, dentro da trava: acha o item mais antigo do mesmo projeto e mesmo `tema` do
  último item do `passaram` desta sessão que espera o papel do apelido, e faz o mesmo que o `pegar`. Devolve
  `{pegou, item, …}` ou `{pegou:false, motivo}`. O papel de cada membro (`papeis/*.md`, seção "Ao terminar") manda
  rodá-lo **antes** de se declarar livre; pegou → troca o título e segue com a conversa, sem limpar; não pegou → livre e
  limpa, como hoje.
- **A6 · O teto de contexto manda mais que a afinidade:** o `seguinte` recebe `--tokens <n>` (o membro lê da barra) e
  recusa quando `n` passa do `aviso` da régua do papel (as mesmas de `contexto-do-papel`: E 300 mil, P/D/V 350 mil),
  dizendo "contexto alto: livre e limpe-se; o item vai a outro". Sem `--tokens`, pega (*assumida*: quem não sabe o
  próprio contexto confia na barra que já avisa).
- **A7 · Continua:** um item por vez e um PR por item; o `livre-se-limpa` não muda (quem pegou o seguinte não está
  livre).

<a id="arquivos"></a>
## Arquivos

| Arquivo | O quê |
|---|---|
| `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs` | `passaram` gravado por `com add` e `pegar`, recusado na CLI (A1); comando `seguinte` (A5, A6); cabeçalho do script |
| `plugins/orquestracao/skills/orquestradora/scripts/batida.mjs` | `afimDe(item, papel, itens, linhas, projetoDe)` puro (A2); `julgar` com A4; `AFINIDADE_MIN` |
| `plugins/orquestracao/hooks/contexto-do-papel.mjs` | exportar as réguas (`EXEC`, `ALTO`, hoje constantes locais) para o `seguinte` ler dali |
| `plugins/orquestracao/pool/papeis/{planejadora,design,executora,validadora}.md` | "Ao terminar": `painel seguinte` antes do livre |
| `plugins/orquestracao/pool/protocolo.md` | "Ao terminar um item" e "Fila do pool": `passaram`, afinidade, `seguinte` |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | o despacho à mão segue a mesma afinidade (dar ao afim ocupado em vez do primeiro livre, dentro do prazo) |
| `docs/adr/0009-afinidade-no-despacho.md` e `docs/adr/README.md` | o ADR (já escrito, com o plano) |

<a id="passos"></a>
## Passos (teste antes do código)
1. Testes vermelhos no `node --test` da raiz (com `HOME`, `PAINEL_DIR`, `POOL_APP_SESSOES_DIR` temporários):
   - `com add` e `pegar` acrescentam a `passaram` com papel e `em`; repetir atualiza; `update fila F1 '{"passaram":[]}'`
     sai com `exit≠0` citando `passaram`.
   - `afimDe`: o mais recente do mesmo tema e papel; outro tema não conta; sessão arquivada não conta; título com outro
     apelido não conta; item antigo só com `fez` conta.
   - `julgar`: afim livre recebe o aviso no lugar do mais antigo; afim ocupado recebe "pegue ao terminar" uma vez e
     nenhum livre é avisado nem vaga pedida antes de 20 min; depois de 20 min, o primeiro livre; sem afim, igual a hoje
     (os testes atuais da batida seguem verdes sem mudança).
   - `seguinte`: pega o do mesmo tema e papel; não pega de outro tema; recusa com `--tokens` acima do aviso; sem item,
     `pegou:false`.
2. Código até verde; `npm test`.
3. Papéis, protocolo, skill; ADR; versão do plugin.

<a id="pronto"></a>
## Critério de pronto
- Com dois itens do mesmo tema na fila e o membro que fez o primeiro livre, a batida avisa a ele, não ao mais antigo
  livre (teste de `julgar` com a fila de exemplo).
- O membro que termina um item e roda `painel seguinte` pega o próximo do mesmo tema sem limpar a conversa.
- Gate verde.

<a id="fora"></a>
## Fora de escopo
- Juntar itens num PR (proibido por A7).
- Afinidade entre projetos, ou por arquivo tocado em vez de tema.
- Medir o contexto pelo hook dentro do `seguinte` (o membro passa `--tokens`).

## Regras do projeto que valem aqui
Node ≥ 20, ESM, sem dependência; `node:test`; `process.exitCode`; testes nunca tocam `~/.claude` real; commit
convencional em PT-BR, sem citar ADR no título.
