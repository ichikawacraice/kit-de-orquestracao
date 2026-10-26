# Livre só com a conversa vazia; a executora cheia se limpa sozinha (F49)

Planejadora: P4. Validação: **Robusta** (trava que dispara trabalho e muda o despacho do pool).

## O defeito, medido

Relato do operador (25/10, Izanagi, kit 0.1.19) e caso do kit (E1 recusou o bloco A da F48 com 161 mil). Medido no código da main `88e73fa`:

1. **"· livre" quer dizer duas coisas.** `livre-se-limpa.mjs:162` deixa sair sem se limpar quem se declara livre estando no `fez` de item vivo (`livre-com-contexto`, regra F30). O título fica `E2 · livre` com a conversa inteira guardada, e quem despacha (planejadora) só olha o título.
2. **A cobrança dos 150 mil não leva a lugar nenhum.** `contexto-do-papel.mjs:63`: executora ≥ 150 mil recebe *"Commite o que está pronto, escreva `Parei em:` e devolva"*. Não diz a quem, não pede a limpeza e se satisfaz com a linha `Parei em:` (linha 79). A executora devolve, continua cheia, e o próximo despacho cai no mesmo muro.
3. **Quem pode limpar não é quem despachou.** Só a orquestradora limpa outra sessão (`protocolo.md:36`), e o app recusa limpar sessão aberta na tela do operador. A planejadora que despachou não consegue, e a orquestradora não sabe.
4. **Quem se limpa sozinha perde o briefing.** O protocolo (`protocolo.md:52`) já manda gravar "recebido; limpo antes de começar" e se limpar, e diz que a orquestradora reenvia; quem tem o briefing é quem despachou, que não é avisado.

## Decisões (assumidas, a confirmar com o operador)

Recomendações (a)–(d) da orquestradora, com o que este plano muda nelas:

- **D1 = (a), sem mudança.** Executora que entrega com ≥ 150 mil grava no handoff do item o que o conserto vai precisar, põe o título `<ID> · livre` e chama `clear_session "self"`.
- **D2 = (b), sem mudança.** `<ID> · livre` = conversa vazia. Quem entrega com < 150 mil fica `<ID> · aguardando validação` (no `fez` de item vivo, conversa guardada): ninguém lhe manda item de outro. Trava no `livre-se-limpa.mjs`. Detalhe acrescentado: **não conta no teto** de 4 E (está parada, como a livre).
- **D3 = (c), com duas mudanças.** (i) Avisa **quem despachou** (o remetente da mensagem), não a orquestradora: é quem tem o briefing e o reenvia; no caso de 25/10 a E1 se limpou e ninguém reenviou. (ii) Acima de 150 mil, a linha `Parei em:` sozinha **deixa de satisfazer**: em todo caso a executora termina com `clear_session "self"`, porque devolver sem limpar só adia o mesmo muro para o próximo despacho.
- **D4 = (d), só no texto.** A orquestradora, quando o item fecha, limpa quem está `aguardando validação` nele; recusada (aberta na tela, fixada), manda a ela "o item fechou: título livre e `clear_session \"self\"`" e diz ao operador numa linha qual sessão não pôde limpar. Sem hook: não há evento confiável da recusa.
- **D5.** O título `aguardando validação` é declaração de entrega: o hook solta a sessão do `com` (`--fez` para a E), como faz com `livre`, e grava a linha de `sessoes` com `etapa: "aguardando validação"`. Quem o põe sem estar no `fez` de item vivo é cobrado a pôr `livre` e se limpar.
- **D6.** Versão do plugin `0.1.22` (a F48 leva a `0.1.21`); quem entrar por último rebaseia e acerta.

## Contratos

- `tituloAguardando(t)` em `pool-comum.mjs`: `/· aguardando validação\s*$/`.
- `declarouLivre(...)` passa a devolver também a declaração por título aguardando: `{ como: 'título aguardando', tituloNovo, propria: true, aguardando: true }`; a de livre ganha `aguardando: false`. `vaiSoltar` não muda (já devolve a declaração).
- Log do `livre-se-limpa`: `cobrou-livre-no-fez`, `aguardando-com-contexto`, `cobrou-aguardando-sem-fez` (novos); `livre-com-contexto` deixa de existir.
- Log do `contexto-do-papel` (executora): `cobrou-exec-150`, `limpou`, `deixou-passar`; `satisfeito-parei` deixa de existir.

## Faixa e convivência com a F48

A F48 (P1, branch `claude/f48-limpeza-e-header`) mexe nos mesmos arquivos em outras regiões. Esta frente toca **só**:
- `contexto-do-papel.mjs`: o ramo `papel === 'executora'` (linha 63), a linha do `parei` (79) e a linha 7 do comentário do topo. Não mexe em `papelDe`, nas constantes nem no ramo da orquestradora.
- `tests/contexto-do-papel.test.mjs`: o teste 6 e um bloco novo **no fim** do arquivo, prefixo `F49.`.
- `protocolo.md`: linhas 19, 30, 36, 45, 46, 52 (não a 9 nem a 74).
- `skills/orquestradora/SKILL.md`: só o passo 3 do ritual (linha 27).
- `skills/papeis-e-modelos/SKILL.md`: linha Executor da tabela (141) e, no parágrafo "A trava" (147), só a frase da executora.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `plugins/orquestracao/hooks/pool-comum.mjs` | `tituloAguardando`; `declarouLivre` reconhece o título aguardando (contrato). |
| `plugins/orquestracao/hooks/livre-se-limpa.mjs` | regras abaixo; comentário do topo (linhas 10–11) troca a exceção F30 pela regra F49. |
| `plugins/orquestracao/hooks/contexto-do-papel.mjs` | ramo da executora (regra abaixo); linha 7 do comentário. |
| `plugins/orquestracao/pool/protocolo.md` | 19: o título aguardando ao lado do livre. 30: conserto vai primeiro a quem do `fez` está `aguardando validação`; se ela se limpou, a ela mesma ou à primeira E livre, com o handoff. 36: limpeza recusada → D4. 45: membro aguardando também não recebe item de outro. 46: aguardando não conta no teto. 52: passo 3 reescrito pelas D1, D2 e D3. |
| `plugins/orquestracao/pool/papeis/executora.md` | linha 18 (ao entregar: < 150 mil aguardando, ≥ 150 mil handoff + livre + limpar; ao receber item com ≥ 150 mil: D3) e a seção do título (`Aguardando: <ID> · aguardando validação`). |
| `plugins/orquestracao/pool/papeis/planejadora.md` | linha 11: conserto ao primeiro do `fez` que está `aguardando validação`; livre só é quem tem a conversa vazia. |
| `plugins/orquestracao/pool/papeis/orquestradora.md` | linha 7: troca "membro livre que está no `fez`" por "membro `aguardando validação`"; D4. |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | passo 3 do ritual (linha 27): o mesmo da linha 7 acima, mais D4. |
| `plugins/orquestracao/skills/papeis-e-modelos/SKILL.md` | 141: "…devolve a quem despachou e se limpa (`clear_session "self"`)". 147: a frase da executora diz que só a limpeza satisfaz. |
| `plugins/orquestracao/.claude-plugin/plugin.json` | `0.1.22`. |

## Regras exatas

**`livre-se-limpa.mjs`**
1. Declarou **livre** (título ou painel) e não chamou `clear_session "self"` no turno → **bloqueia sempre**, também no `fez` de item vivo. Se está no `fez` (`itensDepois.fez`), log `cobrou-livre-no-fez` e motivo: *"Você está no `fez` de <F…> e não se limpou. Livre é só com a conversa vazia: se quer guardar a conversa para o conserto, o título é `<ID> · aguardando validação`; se não, chame clear_session com session_id "self" e termine o turno."* Fora do `fez`, a cobrança de hoje (`cobrou`). `stop_hook_active` → `deixou-passar`.
2. Declarou **aguardando** (`set_session_title "self"` com `tituloAguardando`): roda o mesmo `soltarDoItem` (F32), mas a linha de `sessoes` recebe `{ estado: 'parada', etapa: 'aguardando validação' }`. Depois: no `fez` de item vivo → passa, log `aguardando-com-contexto`. Fora → bloqueia (`cobrou-aguardando-sem-fez`): *"Aguardando validação é só para quem entregou um item que ainda espera validação ou conserto. Sem item esperando: título `<ID> · livre` e clear_session com session_id "self"."* Falha ao soltar: o bloqueio de hoje (`cobrou-com`).
3. Regra do título que trabalhou (linhas 104–117): vale também para título aguardando; o motivo diz o título que está (`"livre"` ou `"aguardando validação"`).
4. Regra 4 (saiu do item com o título dele, linha 120): título novo livre **ou** aguardando satisfaz; o motivo oferece os dois.

**`contexto-do-papel.mjs`, executora ≥ 150 mil:** só `limpou` satisfaz (sai o `parei`). `stop_hook_active` → `deixou-passar`. Motivo:
> Contexto em N mil, acima de 150 mil: a próxima etapa começa com a conversa vazia. Não compacte. Antes de limpar, conforme o caso: acabou de receber item (novo ou conserto) → grave no item `{"agora":"recebido; limpo antes de começar"}` e mande a quem despachou "limpa a N mil; reenvie o briefing"; no meio do item → commite o que está pronto e mande a quem despachou o relatório com `Parei em: <passo exato>`; entregou à validação → grave no handoff do item o que o conserto vai precisar e ponha o título `<ID> · livre`. Depois chame clear_session com session_id "self" e termine o turno.

## Passos (teste antes do código)

1. `git fetch && git switch -c <sua-branch> origin/claude/f49-livre-so-limpa`.
2. Escreva os testes abaixo e rode-os: têm de **falhar** pelo motivo certo. Cole a saída vermelha.
3. `pool-comum.mjs`, depois `livre-se-limpa.mjs`, depois `contexto-do-papel.mjs`.
4. Docs da tabela e versão.
5. Testes do pacote verdes; gate completo uma vez; validações do plugin. Saídas com `; echo "exit=$?"`.
6. Commit conventional em PT-BR (ex.: `fix(orquestracao): livre só com a conversa vazia e a executora cheia se limpa`), push da sua branch, e mande o HEAD a quem despachou. Não abra PR nem mergeie.

## Testes (HOME, HOOKS_CREWAI_BASE, FILA_DIR, POOL_APP_SESSOES_DIR em pasta temporária)

`hooks/tests/contexto-do-papel.test.mjs`
- Teste 6 reescrito: E 160 mil com o texto `Parei em: passo 4…` e sem limpar → `block`; motivo casa `/clear_session.*"self"/s`, `/quem despachou/` e `/recebido; limpo antes de começar/`; log `cobrou-exec-150`.
- `F49.1` E 160 mil com `clear_session "self"` no turno → `null`, log `limpou`.
- `F49.2` E 160 mil com a limpeza só no turno anterior → `block`.
- `F49.3` E 160 mil com `stop_hook_active` → `null`, log `deixou-passar`.
- 6b (149 mil não cobra) fica como está.

`hooks/tests/livre-se-limpa.test.mjs`
- O caso `F30-2: livre no fez … → passa (livre-com-contexto)` vira `F49.a`: E3 livre no `fez` de F1 (`validacao`), sem limpar → `block`, motivo casa `/aguardando validação/` e `/clear_session/`, log `cobrou-livre-no-fez`. Com `stop_hook_active` → `null`.
- `F49.b` o mesmo com `clear_session "self"` → `null`.
- `F49.c` E3 título `E3 · aguardando validação`, no `fez` de F1 vivo, sem limpar → `null`, log `aguardando-com-contexto`.
- `F49.d` o mesmo título com F1 em `feito` (ou o `fez` de outra sessão) → `block`, motivo casa `/· livre/` e `/clear_session/`, log `cobrou-aguardando-sem-fez`. (O `F49.c` é a prova de que a presença é detectada.)
- `F49.e` (ids reais, `pessoal()`): E5 ainda no `com` de F1 (`execucao`) e linha `sessoes/<UE5>.json` existente; põe título aguardando → `null`; F1 com `com` vazio e `fez` com UE5; a linha de `sessoes` com `etapa: "aguardando validação"`.
- `F49.f` registro do app com título `E3 · aguardando validação`, turno com `Edit` e sem trocar título → `block` `cobrou-titulo`, motivo casa `/aguardando validação/`. Precondição: título `E3 · algo` com `Edit` → `null`.
- `F49.g` `com del F1 local_E3 --fez` + título aguardando no mesmo turno, F1 vivo → sem `cobrou-titulo-velho`.
- `F49.h` doc × código: `pool/protocolo.md` e `pool/papeis/executora.md` contêm `· aguardando validação`, e `tituloAguardando` aceita esse texto.

`hooks/tests/pool-comum.test.mjs`
- `tituloAguardando('E2 · aguardando validação')` → true; `'E2 · livre'` → false; `'E2 · aguardando validação do X'` → false.
- `declarouLivre` com `set_session_title "self"` aguardando → `{ como: 'título aguardando', aguardando: true, propria: true }`; com livre → `aguardando: false`.

## Critério de pronto

- `node --test plugins/orquestracao/hooks/tests/contexto-do-papel.test.mjs plugins/orquestracao/hooks/tests/livre-se-limpa.test.mjs plugins/orquestracao/hooks/tests/pool-comum.test.mjs plugins/orquestracao/hooks/tests/fila-do-item.test.mjs; echo "exit=$?"` → `exit=0`, com os testes `F49.*` listados na saída e a saída vermelha do passo 2 colada.
- `npm test; echo "exit=$?"` → `exit=0`.
- `claude plugin validate . ; echo "exit=$?"` e `claude plugin validate plugins/orquestracao --strict; echo "exit=$?"` → `exit=0`.
- `grep -rn "livre-com-contexto\|satisfeito-parei" plugins/orquestracao/hooks/*.mjs` → vazio.
- `grep -c "aguardando validação" plugins/orquestracao/pool/protocolo.md plugins/orquestracao/pool/papeis/executora.md plugins/orquestracao/pool/papeis/planejadora.md plugins/orquestracao/pool/papeis/orquestradora.md plugins/orquestracao/skills/orquestradora/SKILL.md` → nenhum zero.

## Fora de escopo

- O pane (`plugins/painel-sessoes`): a linha de `sessoes` já mostra a `etapa` como texto.
- Regras de contexto de planejadora, design, orquestradora e validadora (a da orquestradora é da F48).
- Hook que detecte a limpeza recusada por sessão aberta na tela (D4 fica no texto).
- Liberar a executora quando o item vai a `merge` (segue presa até `feito`/`descartado`, como hoje).
- O caminho velho de teste citado em `protocolo.md:52` (`~/.claude/hooks/tests/…`).
