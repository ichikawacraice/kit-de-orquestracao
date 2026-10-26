# F59 · ao desligar o modo ausente, a orquestradora traz o resumo do que aconteceu

Pedido do operador (26/10): *"quando eu desligo o modo ausente, você me traz um resumo do que aconteceu, as decisões assumidas e o que for importante"*.

Branch: `claude/f59-resumo-ausente`, a partir de `origin/main` (`f507414`). Gate: `npm test`; testes do mod: `claude plugin test plugins/painel-sessoes`.

## O que foi medido (26/10, sobre `f507414`)
- `plugins/orquestracao/hooks/operador-ausente.mjs`: no `/ausente off` faz `rmSync` da bandeira. **O `desde` se perde no off**: depois dele ninguém sabe de quando a quando foi o período.
- O botão "Estou de volta" do pane (`plugins/painel-sessoes/hooks/register.tsx`, `alternarModo`, ~linha 745) grava `{ligado:false, desligadoEm, por:"painel"}`, **também sem o `desde`**. E não avisa nenhuma sessão: a orquestradora só fica sabendo se alguém lhe escrever.
- Quem lê a bandeira: `modoAusente()` em `hooks/hooks-crewai-comum.mjs` (`ligado === false` → desligado) e `lerBandeira()` no pane (mesmo contrato). Os dois já aceitam o arquivo com `ligado:false`, então guardar o período na própria bandeira não muda o modo para ninguém.
- O pane já manda mensagem a outra sessão (`entregar()`, ~linha 494: `$.tool.call({tool:'mcp__ccd_session_mgmt__send_message', session_id, message})`) e já lê a coleção `sessoes`.
- Dados do período no painel (`~/.claude/orquestracao/painel/`):
  - `fila/F<n>.json`: `historico` `[{em, etapa, dono}]`, `feitoEm`, `trava`, `espera`, `donoLocalId`, `com`, `prs`, `projeto`, `atualizadoEm`;
  - `perguntas/Q<n>.json`: `estado` hoje aparece como `aberta` · `respondida` · `cancelada` · **`assumida`** (9 documentos antigos já usam `assumida`, mas a skill não o lista); `projeto` falta em ~70 documentos (fallback: `sessaoId` → `sessoes/<id>.projeto`);
  - `sessoes/<local_…>.json`: `estado: "concluida"` = arquivada, com `atualizadoEm`.
- **Decisões assumidas não têm lugar único hoje**: umas viram pergunta `assumida`, outras ficam só no texto do `~/.claude/orquestracao/<projeto>.md` ou numa pergunta `respondida` com "assumida" na resposta. Script não consegue contá-las com confiança sem um contrato.
- O que entrou na main sai do git: `git log origin/main --first-parent --since --until` com o `(#N)` do título (squash merge).

## Decisões (assumidas, a confirmar)
- **A1 · o off guarda o período na própria bandeira.** Os dois caminhos de desligar gravam `{ligado:false, desde, desligadoEm, por}` em vez de apagar. Um arquivo só, um contrato só; `modoAusente()` e o pane já tratam como desligado. Alternativa descartada: arquivo à parte (`ausencias/…`) escrito pelo pane — o pane teria de criar pasta e haveria dois lugares para o mesmo fato.
- **A2 · decisão assumida é pergunta com `estado: "assumida"`.** Q-ID de `proxima-pergunta`, `sessaoId`, `titulo`, `caso`, `recomendacao` (= o que se assumiu). Quando o operador confirma ou muda, vira `respondida`. Só assim o script as lista. O pane continua mostrando só as abertas (mostrar as assumidas é item à parte, ver Fora do escopo).
- **A3 · cálculo no script, texto na orquestradora.** O script junta os fatos do período e devolve JSON (e um rascunho em Markdown das seções de dados). A orquestradora escreve a mensagem no formato da skill (blocos `###` com selo, `---`, `### ❓ Decisões` com Q-ID e três partes), escolhe o que é importante e diz o porquê do que parou quando o motivo gravado não basta.
- **A4 · três caminhos de cobrança, um só registro de entrega.** (1) `/ausente off` na orquestradora: a skill `ausente` manda entregar já. (2) Botão "Estou de volta": o pane manda mensagem a cada orquestradora ativa. (3) Garantia: o Stop `orquestradora-ritual.mjs` recusa o fim do turno da orquestradora enquanto houver período desligado nos últimos 7 dias sem entrega registrada para o projeto dela. Entrega registrada = arquivo `~/.claude/orquestracao/ausencias/<desde>--<projeto>.json` gravado por `ausencia.mjs entregue`.
- **A5 · o resumo no painel fica para depois.** Desenhar um cartão "Enquanto você esteve fora" é tela nova e passa pela D1 antes. Os arquivos de `ausencias/` já guardam o JSON do resumo, então o cartão pode lê-los sem mudar o script.

## Arquivos e o que muda

### Bloco A — plugin `orquestracao`
1. **`plugins/orquestracao/hooks/operador-ausente.mjs`** — no `off`: lê a bandeira; se estava ligada (JSON objeto, `desde` válido, `ligado !== false`), grava `{ligado:false, desde, desligadoEm:<agora ISO>, por:"comando", sessionId}`; senão (sem arquivo, ilegível, já desligada) mantém o `rmSync` de hoje. Atualizar o comentário do topo (contrato da bandeira).
2. **`plugins/orquestracao/skills/orquestradora/scripts/ausencia.mjs`** (novo, ESM, só módulos nativos, termina por `process.exitCode`). Envs para teste: `HOOKS_CREWAI_BASE` (base `~/.claude/orquestracao`), `PAINEL_DIR` (como no `painel.mjs`). Subcomandos:
   - `periodo` → imprime JSON `{desde, ate, por}` do último período desligado, ou `null` se a bandeira está ligada, não existe ou não tem `desde`+`desligadoEm`.
   - `resumo [--projeto <nome>] [--desde ISO --ate ISO] [--repo <dir>] [--branch <b>] [--md]` → JSON (ou Markdown com `--md`). Projeto padrão: o do cwd, pela mesma regra do `painel.mjs` (`projetoDoCwd`: pasta que contém o `.git` comum, minúscula). Período padrão: o de `periodo`; sem período e sem `--desde/--ate` → erro claro, exit 1. Campos:
     - `periodo {desde, ate}`;
     - `main`: `[{sha, titulo, pr}]` de `git -C <repo> log origin/<branch> --first-parent --since=<desde> --until=<ate> --format=%h%x09%s` (branch padrão `main`; tenta `git fetch -q origin <branch>` antes, e falha de rede não derruba: segue com o que tem e põe `avisos: ["sem fetch: …"]`); `pr` = número do último `(#N)` do título ou `null`;
     - `itens.feitos`: itens do projeto com `feitoEm` no período (`{id, titulo, etapa, prs}`);
     - `itens.andaram`: vivos com entrada de `historico` no período (`{id, titulo, de, para, dono}`: `de` = etapa antes da primeira entrada do período, `para` = etapa atual);
     - `itens.parados`: vivos sem entrada de `historico` no período, com `motivo`: `trava` → `"travado: <trava.texto>"`; `espera` → `"espera <motivo>: <texto>"`; sem dono e sem `com` → `"sem ninguém"`; senão `"sem movimento"`;
     - `perguntas.assumidas`: todas com `estado:"assumida"` do projeto (não só do período: continuam "a confirmar"), cada uma com `noPeriodo: bool` (`criadaEm` ou `atualizadoEm` dentro);
     - `perguntas.abertas`: todas `aberta` do projeto;
     - `sessoesArquivadas`: `sessoes` do projeto com `estado:"concluida"` e `atualizadoEm` no período (`{id, titulo}`);
     - `pedeAcao`: lista derivada `[{tipo, id, texto}]` = perguntas abertas + assumidas + itens com `espera.motivo === "operador"` ou `trava.motivo` em `operador`/`acesso`;
     - `avisos`: o que não se leu (JSON quebrado é pulado e listado, nunca derruba).
     Projeto da pergunta: `projeto` do documento, senão o de `sessoes/<sessaoId>`; comparação sem diferenciar maiúsculas. Item sem `projeto` não entra.
   - `pendente [--projeto <nome>]` → imprime `{desde, ate}` e exit 0 se há período desligado há ≤ 7 dias sem arquivo de entrega para o projeto; senão imprime `null`, exit 0.
   - `entregue [--projeto <nome>]` → grava `<BASE>/ausencias/<desde com ":" trocado por "-">--<projeto>.json` com `{periodo, projeto, entregueEm, resumo}` (o JSON do `resumo`). Sem período → exit 1 com mensagem.
3. **`plugins/orquestracao/hooks/orquestradora-ritual.mjs`** — além dos dois requisitos de hoje: se `pendente` (chamar a função exportada do `ausencia.mjs`, não processo filho) para o projeto da orquestradora (cwd da entrada do hook → `projetoDaSessao`/`gitCommonDir` de `pool-comum.mjs`), acrescenta a falta *"o operador desligou o modo ausente às HH:MM (período desde X): rode `node "${CLAUDE_PLUGIN_ROOT}/skills/orquestradora/scripts/ausencia.mjs" resumo --md`, entregue o resumo no formato da skill (seção `resumo-da-ausencia`) e registre com `ausencia.mjs entregue`"*. Projeto que não resolve → não cobra. Continua cobrando uma vez só (`stop_hook_active`).
4. **`plugins/orquestracao/skills/ausente/SKILL.md`** — o `off` passa a: (a) dizer numa linha que desligou; (b) se a sessão é a orquestradora, entregar o resumo pela seção `resumo-da-ausencia` da skill `orquestradora`; se não é, dizer que a orquestradora do projeto entrega no próximo turno dela. Corrigir "apaga no off" → "guarda o período no off" (e no parágrafo do botão).
5. **`plugins/orquestracao/skills/orquestradora/SKILL.md`** — seção nova com âncora `<a id="resumo-da-ausencia"></a>` `## Resumo da ausência`: quando (os três caminhos de A4), o comando, o que é do script e o que é dela (A3), a forma (selos e blocos já definidos em "A forma de TODA mensagem"; ordem: `### 🎛 Orquestradora` com o que entrou na main → um bloco por item que andou/parou → `### ⚪ Arquivadas` numa linha → `### ❓ Decisões`, com as assumidas a confirmar e as abertas, cada uma com Q-ID e três partes), e o `entregue` no fim. Na seção de perguntas, acrescentar `assumida` à lista de `estado` com a regra A2.
6. **`plugins/orquestracao/pool/protocolo.md`** — em "Nunca travar", a decisão assumida grava pergunta `estado:"assumida"` (A2); na âncora `sob-demanda` e no parágrafo da bandeira, "apagada só no `/ausente off`" → "desligada (guardando o período) só no `/ausente off`".
7. `plugins/orquestracao/.claude-plugin/plugin.json` — `0.1.29` → `0.1.30`.

### Bloco B — plugin `painel-sessoes`
8. **`plugins/painel-sessoes/hooks/register.tsx`** — em `alternarModo`, ao desligar: gravar `{ligado:false, desde:<antes.desde>, desligadoEm, por:"painel"}` (`desde` só se havia); depois de gravar, mandar a cada sessão de `sessoes` com `papel:"orquestradora"` e `estado !== "concluida"` a mensagem *"O operador desligou o modo ausente pelo painel (desde <desde> até <desligadoEm>). Traga a ele o resumo do período: skill orquestradora, seção resumo-da-ausencia."* via `send_message` (a da própria sessão por `$.prompt.submit`, como em `entregar`). Falha no envio vira aviso no pane (`avisar`), não desfaz o modo. Toast: `Modo ausente desligado. A orquestradora traz o resumo.` (sem orquestradora ativa: `Modo ausente desligado`).
9. `plugins/painel-sessoes/types/index.d.ts` se o tipo de `ausente` ganhar campo.
10. `plugins/painel-sessoes/.claude-plugin/plugin.json` — `0.6.1` → `0.6.2`.

## Passos (teste antes do código)
1. `git switch claude/f59-resumo-ausente` (já existe, com este plano).
2. **Testes vermelhos do bloco A**, em `plugins/orquestracao/hooks/tests/`:
   - `papel-do-pool.test.mjs`, caso `operador-ausente` (~linha 360): trocar "off apaga" por "off guarda `{ligado:false, desde, desligadoEm, por:'comando'}` com o `desde` do on"; novo caso: off sem bandeira não cria arquivo; off com bandeira ilegível apaga.
   - `ausencia.test.mjs` (novo): fixture com `HOOKS_CREWAI_BASE`/`PAINEL_DIR` temporários e um repo git temporário com `origin/main` (bare remoto + 3 commits, dois com `(#N)`, um fora do período por `GIT_COMMITTER_DATE`). Casos: `periodo` (null com bandeira ligada; período com off); `resumo` (cada seção com pelo menos um documento dentro e um fora do período — prova a presença antes da ausência, regra do projeto; pergunta sem `projeto` resolvida pela sessão; JSON quebrado vai a `avisos`); `pendente` (≤ 7 dias sem entrega → período; com o arquivo de entrega → null; 8 dias → null); `entregue` grava o arquivo e o `pendente` passa a null.
   - teste do ritual (novo caso no arquivo que já testa `orquestradora-ritual.mjs`, ou novo `orquestradora-ritual.test.mjs`): com período pendente o reason cita `ausencia.mjs resumo`; com entrega registrada, não cita; projeto que não resolve, não cita.
   - teste doc × código (regra "duas coisas que devem concordar"): a SKILL.md da orquestradora tem a âncora `resumo-da-ausencia` e o texto do hook e do pane a citam.
   Rodar `node --test` e colar as falhas pelo motivo certo.
3. Implementar os arquivos 1–7 até o `npm test` verde.
4. **Testes vermelhos do bloco B** em `plugins/painel-sessoes/tests/painel.test.tsx`: ajustar `F48 B8` (o desligar grava o `desde` que havia) e novos: com uma `sessoes/<id>` orquestradora ativa e outra `concluida`, o desligar chama `send_message` só na ativa, com a mensagem acima; falha do envio mostra aviso e o modo continua desligado; sem orquestradora, toast curto e nenhum envio.
5. Implementar 8–10 até `claude plugin test plugins/painel-sessoes` verde.
6. `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict` e `plugins/painel-sessoes --strict`.
7. Commits conventional em PT-BR (ex.: `feat(orquestracao): o modo ausente guarda o período e a orquestradora entrega o resumo ao desligar`, `feat(painel): o botão de volta avisa a orquestradora`), push, PR com rebase em dia sobre `origin/main`.

## Critério de pronto
- `npm test` com exit 0, e `claude plugin test plugins/painel-sessoes` verde, saídas coladas no PR.
- Prova manual com base temporária: `HOOKS_CREWAI_BASE=$T PAINEL_DIR=$T/painel node …/ausencia.mjs resumo --md --desde … --ate …` sobre uma fixture mostra as seis seções (main, andaram, parados, assumidas, abertas, arquivadas) e `pedeAcao`.
- `operador-ausente.mjs` com `/ausente off` deixa o arquivo com `ligado:false` e o `desde` do on (teste).
- Nenhum teste toca `~/.claude` real.

## Fora do escopo
- Cartão do resumo no pane (A5): item novo, D1 antes.
- Mostrar as perguntas `assumida` no pane com botão de confirmar.
- Migrar as decisões assumidas antigas (texto no `<projeto>.md`) para perguntas `assumida`.
- Período que fica sem entrega e é sobrescrito por um novo `/ausente on`: o resumo daquele período se perde (o `pendente` olha só o último). Aceito nesta fatia.

## Regras do projeto que tocam
- `CLAUDE.md`: Node ≥ 20, ESM, só módulos nativos; `node --test`; `process.exitCode`; testes com `HOME` e envs de pasta em temporário; processo filho de teste síncrono com `timeout` e `killSignal:'SIGKILL'`; teste que mede ausência prova antes a presença; commits em PT-BR; paridade com `~/.claude` não é mais exigida (o plugin é a cópia viva).
- Skill `orquestradora`, "A forma de TODA mensagem ao operador" e "Perguntas com ID e o painel".
- Mod do painel: mudança no formato dos dados combina-se com a sessão do mod (aqui o único campo novo da bandeira é o `desde` mantido no off).
