# F173 · Versão do plugin sobe só no merge, pela orquestradora — plano (P6, 27/10)

Copie este arquivo para `docs/planos/2026-10-27-versao-sobe-no-lote.md` no PR.

**Prioridade sobre os outros itens** (operador, Q459 sim). Branch nova a partir da `main` (`git switch -c versao-no-lote origin/main`, árvore limpa).

## A regra (Q459)
O PR de item **não mexe** na `version` de nenhum `plugins/*/.claude-plugin/plugin.json` nem em teste que fixe a versão. A orquestradora sobe a versão **num commit só depois de cada lote de merges**, só dos plugins que mudaram desde a última subida, e então roda `atualizar-plugins`. PRs já abertos com bump seguem como estão (não precisa rebasear para tirar).

## O que hoje obriga o bump (medido em d52359c)
- `test/cli.test.mjs:50` fixa `orquestracao` em `'0.1.57'` → todo PR do plugin sobe a versão E o teste, e dois PRs em paralelo conflitam nessa linha (ex.: F144, laudo V1: conflito em `plugin.json` com a #69).
- `test/k11.test.mjs:21-24` fixa `processos` em `'0.2.1'` (título do teste e o `assert.equal`).
- Os planos das planejadoras mandam "suba `version`… e ajuste o `cli.test.mjs`" (F167, F170, F54…). Nenhum hook exige o bump; a exigência é o teste fixo + o hábito.
- `skills/orquestradora/SKILL.md:76` fala de "depois do merge que sobe a versão de um plugin" (o PR subia).
- `marketplace.json` não declara versão (nada a mudar lá).

## Passos
1. **Testes do script novo primeiro** — `plugins/orquestracao/hooks/tests/subir-versao.test.mjs` (`node:test`, `HOME` e repositório em `mkdtemp`; `git init -b main`, `user.name/email` locais; processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`). Repositório falso com `.claude-plugin/marketplace.json` listando `a` (`./plugins/a`) e `b` (`./plugins/b`), cada um com `.claude-plugin/plugin.json` (`a` 0.1.5, `b` 0.2.0) e um arquivo; commit inicial. Casos:
   - nada mudou desde a última subida → exit 0, `{"subiu":[]}`, nenhum commit novo (`git rev-list --count HEAD` igual).
   - commit mexe em `plugins/a/x.mjs` → `subiu` = `[{nome:'a', antes:'0.1.5', depois:'0.1.6', arquivos:['plugins/a/x.mjs']}]`; `b` intocado; **um** commit novo cuja mensagem é `chore(versao): sobe os plugins do lote — a 0.1.6`; o `plugin.json` de `a` mantém o resto do arquivo byte a byte (só a linha da versão muda).
   - `a` e `b` mudaram → um commit só, mensagem `… — a 0.1.6, b 0.2.1`.
   - depois da subida, rodar de novo → `subiu: []` (a referência é o último commit que mudou a linha `"version"` do plugin).
   - mudança só no `plugin.json` de `a` fora da versão (ex.: `description`) → conta como mudança e sobe.
   - `--seco` → mesmo `subiu`, nenhum arquivo escrito, nenhum commit (`git status --porcelain` vazio).
   - árvore suja → exit 1, `{"recusado":true,"motivo":"árvore com mudança não commitada"}`.
   - fora da `main` (branch `x`) → exit 1, motivo cita `main`.
   - com `origin` configurado (repositório bare em tmp) e `main` local atrás de `origin/main` → exit 1, motivo `main atrás de origin/main; puxe antes`.
   - `--empurrar` com `origin` bare → commit chega ao bare (`git -C bare log -1 --format=%s`).
   Rode e veja falhar porque o script não existe (cole a saída vermelha no PR).
2. **Script** `plugins/orquestracao/skills/orquestradora/scripts/subir-versao.mjs` (ESM, só nativos, termina por `process.exitCode`; `GIT_BIN` troca o `git`, como no `mergear.mjs`). Uso: `subir-versao [--seco] [--empurrar] [--base <branch>]` (base padrão `main`), rodado na raiz do repositório.
   - Confere: árvore limpa; branch atual = base; se há `origin`, `git fetch -q origin <base>` e recusa quando `HEAD` não contém `origin/<base>` (`merge-base --is-ancestor origin/<base> HEAD`).
   - Lê `.claude-plugin/marketplace.json`; para cada plugin: `ref = git log -1 --format=%H -G'"version"' -- <source>/.claude-plugin/plugin.json`; `arquivos = git diff --name-only <ref> HEAD -- <source>`; sem `ref` (plugin nunca versionado) → pula com aviso no resultado.
   - Com arquivos: patch +1 (`x.y.z` → `x.y.(z+1)`), troca **só** a primeira ocorrência de `"version": "<antes>"` no texto do `plugin.json`.
   - Sem `--seco` e com algo a subir: `git add` dos `plugin.json` tocados e **um** commit `chore(versao): sobe os plugins do lote — <nome> <depois>, …`. `--empurrar`: `git push origin HEAD:<base>`.
   - Saída JSON em stdout: `{subiu, commit?, empurrou?, pulados?}`; recusa → `{recusado:true, motivo}` e exit 1. `--texto` é desnecessário (fora de escopo).
   - Cabeçalho do script no estilo do `atualizar-plugins.mjs` (duas a quatro linhas dizendo o que faz).
3. **Wrapper** `plugins/orquestracao/bin/subir-versao`, cópia do `bin/atualizar-plugins` trocando o nome do `.mjs` (`chmod +x`).
4. **Tira o bump dos testes do repo:**
   - `test/cli.test.mjs:50`: remova `if (pl.name === 'orquestracao') assert.equal(pj.version, '0.1.57'); // …`; o `assert.match` de semver fica. Renomeie o teste para `'marketplace.json lista os plugins do kit, cada um com versão semver no plugin.json'`.
   - `test/k11.test.mjs:21-24`: título `'plugin.json: nome, versão semver e descrição'` e `assert.match(p.version, /^\d+\.\d+\.\d+$/)` no lugar do `equal '0.2.1'`.
   - Novo teste em `test/cli.test.mjs` (a regra não volta escondida): nenhum `*.test.mjs` sob `test/` e `plugins/*/hooks/tests/` contém a versão atual de algum `plugin.json` como literal (`'0.1.57'`, etc.). Antes de afirmar, o teste confere que achou ≥ 4 `plugin.json` e ≥ 20 arquivos de teste (insumo vazio passaria). Prove que ele detecta: rode-o uma vez com o `0.1.57` ainda no `cli.test.mjs` (vermelho) antes do passo 4 — cole a saída.
5. **`painel mergear` avisa** (não recusa — PRs abertos antes da regra seguem com bump): em `mergear.mjs`, `conferir()` roda `git diff -U0 origin/<base>...<sha> -- 'plugins/*/.claude-plugin/plugin.json'` e, se alguma linha `^[+-]\s*"version"` aparece, devolve no `ok` o campo `aviso: 'o PR sobe a versão de <plugins>; a versão é da orquestradora depois do lote (rode subir-versao)'`. O `painel.mjs` repassa o `aviso` na saída do `mergear` (inclusive no `--seco`). Teste em `plugins/orquestracao/hooks/tests/painel-mergear.test.mjs`: PR com bump → `aviso` presente e merge feito; PR sem bump → sem `aviso`.
6. **Docs (texto pronto; ajuste só a costura com a frase vizinha):**
   - `plugins/orquestracao/pool/papeis/executora.md`, lista **Não faz**, novo item: `não mexe na versão do plugin (\`version\` dos \`plugin.json\`) nem em teste que a fixe: quem sobe é a orquestradora, depois do lote de merges;`
   - `plugins/orquestracao/pool/papeis/planejadora.md`, em **Faz**, acrescente: `O plano não manda subir a versão do plugin: isso é da orquestradora, depois do lote.`
   - `plugins/orquestracao/pool/papeis/validadora.md`, onde lista o que confere no diff: `PR que mexe na \`version\` de um \`plugin.json\`: ressalva baixa, vai ao \`depois\` do item (não abre rodada); a orquestradora sobe a versão depois do lote.`
   - `plugins/orquestracao/pool/papeis/orquestradora.md`, nas responsabilidades de merge: `Depois de cada lote de merges, sobe a versão dos plugins que mudaram num commit só (\`subir-versao --empurrar\`, na main em dia) e roda \`atualizar-plugins\`.`
   - `plugins/orquestracao/pool/protocolo.md`, seção "Regras do repositório", fim do parágrafo: `O PR não sobe a versão do plugin; a orquestradora sobe depois do lote (\`subir-versao\`).`
   - `plugins/orquestracao/skills/orquestradora/SKILL.md:76`, troque o item **Plugin novo do kit na máquina** por: `**Versão dos plugins, depois do lote:** o PR não mexe na versão (Q459). Fechado o lote de merges, na main em dia: \`subir-versao --seco\` mostra quais plugins mudaram desde a última subida; \`subir-versao --empurrar\` sobe o patch de cada um num commit só e empurra. Depois, \`atualizar-plugins [--seco] [--json]\` atualiza o clone do marketplace (confere o commit contra o GitHub) e os plugins \`user\` desatualizados; mostra \`antes → depois\` e \`Reinicie o app para valer.\` Cópia \`project\` não é mexida e plugin que falta não é instalado. O \`painel mergear\` avisa (\`aviso\`) quando o PR ainda traz bump.` Se a skill tiver lista de comandos/scripts no topo, inclua `subir-versao`.
   - `CLAUDE.md` do projeto, bloco `kit:projeto`, lista **Regras do código** (é o trecho escrito à mão para este repo; a seção "Regras de operação" é bloco do kit e o `kit atualizar` a troca): `- O PR não mexe na versão dos plugins; a orquestradora sobe a versão num commit só depois de cada lote de merges (\`subir-versao\`).`
7. Gate: `npm test`; `claude plugin validate .`; `claude plugin validate plugins/orquestracao --strict`. **Não suba a versão do plugin neste PR** (é o primeiro sob a regra; a orquestradora sobe depois do lote).

## Pronto quando
- Saída vermelha do passo 1 (script ausente) e do teste-guarda do passo 4 (com `0.1.57` presente) coladas no PR; depois, tudo verde.
- `grep -rn "0\.1\.57\|'0\.2\.1'" test plugins/*/hooks/tests` vazio (o `0.2.1` do `atualizar-plugins.test.mjs` é dado de fixture em `montar({...})` e fica — o teste-guarda compara com as versões **atuais** dos `plugin.json`; se `processos` está em 0.2.1, o guarda vai acusar essa fixture: troque a fixture para `0.2.9`/`0.2.8` ou outra que não seja versão atual).
- `git diff origin/main -- 'plugins/*/.claude-plugin/plugin.json'` vazio.
- `subir-versao --seco` na raiz deste repo, na main, roda e lista os plugins que mudaram desde a última subida (cole a saída no PR; não rode sem `--seco`).
- Gate verde; PR para `main` com o plano em `docs/planos/`.

## Fora de escopo
- Subir versão de fato, ou rodar `subir-versao` sem `--seco` aqui.
- Cópia velha dos papéis em `~/.claude/orquestracao/pool/papeis/` (fora do repo; anotada no `depois`).
- Minor/major automático, changelog, notas de release, mudar o `atualizar-plugins`.
- Recusar no `mergear` PR com bump (é só aviso, por causa dos PRs já abertos).
- ADR: a mudança é de operação, registrada no plano e no CLAUDE.md (*assumida, a confirmar*).

## Regras do projeto
Node ≥ 20, ESM, só nativos; `process.exitCode`; testes nunca tocam `~/.claude` real; teste só por `npm test` ou `node gate/com-fichas.mjs -- …`; commits conventional em PT-BR, sem citar ADR no título; rebase em vez de merge; orquestradora ativa → abra o PR e mande `PR N` a ela, não mergeie.
