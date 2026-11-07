#!/usr/bin/env node
// F438 (ADR 0030, item 3): a trava no Bash confere todo worker Claude aberto pelo `orca` — modelo e esforço explícitos, o
// modelo pelo papel (dona ou worker) e a worktree (a pasta de quem chama só com `Só leitura:` no texto do pedido).
// Rodar: node --test hooks/tests/trava-do-orca.test.mjs   (repo git, HOME e a pasta do log em diretório temporário)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, comandosDoOrca } from '../trava-do-orca.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');

// Um repositório com duas worktrees: a de quem chama (branch `principal`) e outra (branch `outra`).
const BASE = realpathSync(mkdtempSync(join(tmpdir(), 'trava-do-orca-')));
const REPO = join(BASE, 'repo');
const OUTRA = join(BASE, 'outra-worktree');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: BASE, GIT_CONFIG_NOSYSTEM: '1' } });
mkdirSync(join(REPO, 'sub'), { recursive: true });
git('init', '-q', '-b', 'principal');
writeFileSync(join(REPO, 'a.txt'), 'a');
git('add', '.');
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'inicio');
git('worktree', 'add', '-q', '-b', 'outra', OUTRA);
writeFileSync(join(REPO, 'spec-sonnet.md'), 'Faça a fatia X.\nSó leitura: só lê o log\n');
writeFileSync(join(REPO, 'spec-dona-opus.md'), 'Você é a dona do F77 · Tema.\nEsforço alto: contrato\n');
test.after(() => rmSync(BASE, { recursive: true, force: true }));

const ENV = { HOME: BASE };
const d = (comando, cwd = REPO) => decidir(comando, { cwd, env: ENV });
const recusa = (c, cwd) => { const r = d(c, cwd); assert.ok(r.recusa, `deveria recusar: ${c}`); return r.recusa; };
const passa = (c, cwd) => { const r = d(c, cwd); assert.equal(r.recusa, null, `deveria passar: ${c}\nmotivo: ${r.recusa}`); return r; };
const desfechos = (r) => r.registros.map((x) => x.desfecho);

const WS = 'orca orchestration worker-start --agent claude';
const OK = '--model sonnet --effort medium';
const LEITURA = '"Faça X.\nSó leitura: só lê o log"';

test('worker-start: sem --model ou sem --effort recusa; com os dois e new-child passa', () => {
  recusa(`${WS} --effort medium --worktree new-child --spec "Faça X."`);
  recusa(`${WS} --model sonnet --worktree new-child --spec "Faça X."`);
  recusa(`${WS} --worktree new-child --spec "Faça X."`);
  const r = passa(`${WS} ${OK} --worktree new-child --spec "Faça X."`);
  assert.deepEqual(desfechos(r), ['orca-abriu-sonnet']);
  passa(`${WS} ${OK} --worktree new-top-level --spec "Faça X."`);
  passa(`${WS} --model=claude-sonnet-5-5 --effort=medium --worktree=new-child --spec="Faça X."`);
});

test('worker-start: a pasta de quem chama (current, active, ausente) só com `Só leitura:`', () => {
  for (const wt of ['--worktree current', '--worktree active', '']) {
    recusa(`${WS} ${OK} ${wt} --spec "Faça X."`);
    passa(`${WS} ${OK} ${wt} --spec ${LEITURA}`);
  }
  // A linha precisa de motivo e de linha própria; a menção em prosa não conta.
  recusa(`${WS} ${OK} --worktree current --spec "Faça X.\nSó leitura:"`);
  recusa(`${WS} ${OK} --worktree current --spec "Faça X. Não é só leitura: escreve."`);
  passa(`${WS} ${OK} --worktree current --spec "Faça X.\n- **So Leitura:** confere o log"`);
});

test('worker-start: seletor de outra worktree passa; o que cai na própria pasta ou não se resolve conta como current', () => {
  const outros = [`path:${OUTRA}`, 'branch:outra', `id:repo-1::${OUTRA}`, `name:${basename(OUTRA)}`];
  for (const sel of outros) passa(`${WS} ${OK} --worktree '${sel}' --spec "Volte ao item."`);
  const proprios = ['path:$PWD', 'path:.', `path:${join(REPO, 'sub')}`, 'branch:principal', `id:repo-1::${REPO}`, `name:${basename(REPO)}`];
  for (const sel of proprios) {
    recusa(`${WS} ${OK} --worktree "${sel}" --spec "Faça X."`);
    passa(`${WS} ${OK} --worktree "${sel}" --spec ${LEITURA}`);
  }
  for (const sel of ['branch:nao-existe', 'name:nao-existe', `path:${join(BASE, 'nao-existe')}`, 'identity:abc', 'issue:12']) {
    recusa(`${WS} ${OK} --worktree "${sel}" --spec "Faça X."`);
  }
  // Chamado de dentro da outra worktree, a principal é a outra.
  passa(`${WS} ${OK} --worktree branch:principal --spec "Volte."`, OUTRA);
  recusa(`${WS} ${OK} --worktree branch:outra --spec "Faça X."`, OUTRA);
});

test('modelo pelo papel: Opus só com gatilho; dona em Haiku recusa; worker em Haiku passa; desconhecido recusa', () => {
  recusa(`${WS} --model opus --effort high --worktree new-child --spec "Faça X."`);
  const r = passa(`${WS} --model opus --effort high --worktree new-child --spec "Faça X.\nGatilho do Opus: seguranca"`);
  assert.deepEqual(desfechos(r), ['orca-abriu-opus']);
  assert.match(r.registros[0].detalhe, /seguranca/);
  recusa(`${WS} --model opus --effort high --worktree new-child --spec "Faça X.\nGatilho do Opus: pressa"`);
  recusa(`${WS} --model haiku --effort low --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  const h = passa(`${WS} --model haiku --effort low --worktree new-child --spec "Leia o log e resuma."`);
  assert.deepEqual(desfechos(h), ['orca-abriu-haiku']);
  recusa(`${WS} --model gpt-5 --effort medium --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  recusa(`${WS} --model gpt-5 --effort medium --worktree new-child --spec "Leia o log."`);
  // F477 (ADR 0036): dona em Sonnet recusa, com a sugestão de Opus médio; em Opus médio passa sem linha.
  const s = recusa(`${WS} --model sonnet --effort medium --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  assert.match(s, /orquestracao:executor/);
  assert.match(s, /--model opus --effort medium/);
  const dm = passa(`${WS} --model opus --effort medium --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  assert.deepEqual(desfechos(dm), ['orca-abriu-opus']);
  assert.match(dm.registros[0].detalhe, /gatilho=-$/);
  // Opus alto: só com a linha (nova ou antiga); low recusa mesmo com a linha.
  const alto = recusa(`${WS} --model opus --effort high --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  assert.match(alto, /Opus alto sem gatilho nomeado; o padrão é médio/);
  assert.match(alto, /--effort medium/);
  assert.match(alto, /Esforço alto: <gatilho>/);
  const novaLinha = passa(`${WS} --model opus --effort high --worktree new-child --spec "Você é a dona do F12 · Tema.\nEsforço alto: contrato"`);
  assert.match(novaLinha.registros[0].detalhe, /gatilho=contrato/);
  passa(`${WS} --model opus --effort high --worktree new-child --spec "Você é a dona do F12 · Tema.\nGatilho do Opus: contrato"`);
  recusa(`${WS} --model opus --effort low --worktree new-child --spec "Você é a dona do F12 · Tema.\nEsforço alto: contrato"`);
  // Worker que não é dona: Sonnet e Opus médio passam; Opus em outro esforço pede a linha.
  passa(`${WS} --model sonnet --effort medium --worktree new-child --spec "Faça X."`);
  passa(`${WS} --model opus --effort medium --worktree new-child --spec "Faça X."`);
  recusa(`${WS} --model opus --effort low --worktree new-child --spec "Faça X."`);
  passa(`${WS} --model opus --effort high --worktree new-child --spec "Faça X.\nEsforço alto: estado"`);
});

test('agent launch: modelo e esforço; na pasta de quem chama só com `Só leitura:`, e a recusa sugere new-child', () => {
  recusa(`orca agent launch --agent claude --effort medium --prompt ${LEITURA}`);
  const m = recusa(`orca agent launch --agent claude ${OK} --prompt "Faça X."`);
  assert.match(m, /worker-start/);
  assert.match(m, /--worktree new-child/);
  assert.match(m, /worktree create/);
  passa(`orca agent launch --agent claude ${OK} --prompt ${LEITURA}`);
  recusa(`orca agent launch --agent claude ${OK} --worktree current --prompt "Faça X."`);
  passa(`orca agent launch --agent claude ${OK} --worktree branch:outra --prompt "Volte ao item."`);
});

test('worktree create --agent: só modelo e esforço; sem --agent passa', () => {
  recusa('orca worktree create --name f9 --agent claude --prompt "Faça X."');
  recusa('orca worktree create --name f9 --agent claude --model sonnet --prompt "Faça X."');
  passa(`orca worktree create --name f9 --agent claude ${OK} --prompt "Faça X."`);
  const r = passa('orca worktree create --name f9');
  assert.deepEqual(r.registros, []);
});

test('--terminal passa; --agent codex passa com modelo, esforço e isolamento; --help passa', () => {
  const t = passa('orca orchestration worker-start --terminal term_abc --spec "Devolução: conserte o teste."');
  assert.deepEqual(desfechos(t), ['passou-terminal']);
  const c = passa('orca orchestration worker-start --agent codex --model modelo-codex --effort medium --worktree new-child --spec "Faça X."');
  assert.deepEqual(desfechos(c), ['orca-abriu-codex']);
  assert.match(c.registros[0].detalhe, /modelo-codex/);
  passa('orca orchestration worker-start --help');
});

test('o texto do pedido sai de --spec, --spec-file <arquivo>, --spec-file - com heredoc, "$(cat <<EOF)" e --prompt', () => {
  // Cada forma traz a linha `Só leitura:` com --worktree current: passar prova que o texto foi lido.
  passa(`${WS} ${OK} --worktree current --spec ${LEITURA}`);
  passa(`${WS} ${OK} --worktree current --spec-file spec-sonnet.md`);
  passa(`${WS} ${OK} --worktree current --spec-file ${join(REPO, 'spec-sonnet.md')}`);
  passa(`${WS} ${OK} --worktree current --spec-file - <<'EOF'\nFaça X.\nSó leitura: só lê o log\nEOF`);
  passa(`${WS} ${OK} --worktree current --spec-file - < spec-sonnet.md`);
  passa(`${WS} ${OK} --worktree current --spec "$(cat <<'EOF'\nFaça X (com parênteses).\nSó leitura: só lê o log\nEOF\n)"`);
  passa(`orca agent launch --agent claude ${OK} --prompt 'Faça X.\nSó leitura: só lê o log'`);
  // O gatilho e a marca de dona também vêm do arquivo.
  const r = passa(`${WS} --model opus --effort high --worktree new-child --spec-file spec-dona-opus.md`);
  assert.match(r.registros[0].detalhe, /contrato/);
  assert.match(r.registros[0].detalhe, /F77/);
});

test('sem texto legível (--task, arquivo ausente, pipe): bandeiras conferidas, Opus e current recusam, o resto passa no log', () => {
  recusa('orca orchestration worker-start --agent claude --task task_1 --worktree new-child');
  recusa(`${WS} --model opus --effort high --worktree new-child --task task_1`);
  assert.deepEqual(desfechos(passa(`${WS} --model opus --effort medium --worktree new-child --task task_1`)), ['passou-sem-ler-spec']);
  recusa(`${WS} ${OK} --worktree current --task task_1`);
  recusa(`${WS} ${OK} --task task_1`);
  const r = passa(`${WS} ${OK} --worktree new-child --task task_1`);
  assert.deepEqual(desfechos(r), ['passou-sem-ler-spec']);
  assert.deepEqual(desfechos(passa(`${WS} ${OK} --worktree new-child --spec-file nao-existe.md`)), ['passou-sem-ler-spec']);
  recusa(`${WS} --model opus --effort high --worktree new-child --spec-file nao-existe.md`);
  assert.deepEqual(desfechos(passa(`${WS} --model opus --effort medium --worktree new-child --spec-file nao-existe.md`)), ['passou-sem-ler-spec']);
  assert.deepEqual(desfechos(passa(`cat spec.md | ${WS} ${OK} --worktree new-child --spec-file -`)), ['passou-sem-ler-spec']);
  recusa(`cat spec-sonnet.md | ${WS} ${OK} --worktree current --spec-file -`);
});

test('a recusa traz o comando corrigido, com o modelo que o Orca aceita', () => {
  const m = recusa(`${WS} --worktree new-child --spec "Faça X."`);
  assert.match(m, /orca orchestration worker-start --agent claude .*--model sonnet --effort medium/);
  const w = recusa(`${WS} ${OK} --worktree current --spec "Faça X."`);
  assert.match(w, /--worktree new-child/);
  assert.match(w, /Só leitura:/);
  const o = recusa(`${WS} --model opus --effort high --worktree new-child --spec "Faça X."`);
  assert.match(o, /Esforço alto: <gatilho>/);
  assert.match(o, /--model sonnet --effort medium/); // worker: o corrigido cai em Sonnet médio
  const dona = recusa(`${WS} --model sonnet --effort medium --worktree new-child --spec "Você é a dona do F12 · Tema."`);
  assert.match(dona, /--model opus --effort medium/);
  const e = recusa(`${WS} --model opus --worktree new-child --spec "Esforço alto: estado"`);
  assert.match(e, /Comando corrigido: .*--model sonnet --effort medium/);
  assert.doesNotMatch(e.slice(e.indexOf('Comando corrigido')), /--effort high/);
  // Spec longo é abreviado na sugestão.
  const longo = 'x'.repeat(500);
  const l = recusa(`${WS} --worktree new-child --spec "${longo}"`);
  assert.ok(!l.includes(longo), 'o spec longo não deveria vir inteiro');
});

test('o binário é reconhecido pelo PATH, por $ORCA_CLI_COMMAND e pelo caminho inteiro; no meio de && e |', () => {
  const resto = `orchestration worker-start --agent claude --worktree new-child --spec "Faça X."`;
  for (const bin of ['orca', '"$ORCA_CLI_COMMAND"', '$ORCA_CLI_COMMAND', '${ORCA_CLI_COMMAND}', '/Applications/Orca.app/Contents/Resources/bin/orca', '"/Applications/Orca.app/Contents/Resources/bin/orca"']) {
    recusa(`${bin} ${resto}`);
  }
  recusa(`cd /tmp && orca ${resto}`);
  recusa(`orca ${resto} | jq .`);
  recusa(`echo ok; orca ${resto}`);
  recusa(`FOO=1 env orca ${resto}`);
  recusa(`(orca ${resto})`);
  recusa(`X=$(orca ${resto} --json)`);
  recusa(`orca \\\n  orchestration worker-start \\\n  --agent claude \\\n  --worktree new-child \\\n  --spec "Faça X."`);
});

test('revisão F438: substituição entre aspas duplas, <( ), opção global, bash -c e eval também são comandos', () => {
  const resto = 'orchestration worker-start --agent claude --worktree new-child --spec x';
  recusa(`out="$(orca ${resto} --json)"`);
  recusa(`echo "\`orca ${resto}\`"`);
  recusa(`cat <(orca ${resto})`);
  recusa(`orca --json ${resto}`);
  recusa(`orca --environment casa ${resto}`);
  recusa(`bash -c "orca ${resto}"`);
  recusa(`sh -c 'orca ${resto}'`);
  recusa(`eval "orca ${resto}"`);
  // Dentro de aspas simples, nada disso é comando.
  passa(`echo '"$(orca ${resto})"'`);
  passa(`echo 'bash -c "orca ${resto}"'`);
});

test('revisão F438: crase e $( entre aspas simples (ou escapados) são texto do pedido, não substituição', () => {
  passa(`${WS} ${OK} --worktree current --spec 'Só leitura: medir o \`npm test\`'`);
  passa(`${WS} ${OK} --worktree current --spec "Só leitura: medir o \\\`npm test\\\`"`);
  passa(`${WS} --model opus --effort high --worktree new-child --spec 'Esforço alto: estado\nRode \`x\` e $(y)'`);
  recusa(`${WS} --model haiku --effort low --worktree new-child --spec 'Você é a dona do F12. Rode \`npm test\` antes do PR.'`);
  // A substituição de verdade continua ilegível.
  assert.deepEqual(desfechos(passa(`${WS} ${OK} --worktree new-child --spec "$(cat spec.md)"`)), ['passou-sem-ler-spec']);
  assert.deepEqual(desfechos(passa(`${WS} ${OK} --worktree new-child --spec "Rode \`x\`"`)), ['passou-sem-ler-spec']);
});

test('revisão F438: Opus sem texto legível diz como resolver em vez de pedir a linha num texto que não existe', () => {
  const m = recusa(`${WS} --model opus --effort high --worktree new-child --task task_1`);
  assert.match(m, /sem texto legível/);
  assert.match(m, /--effort medium/);
  assert.match(m, /--model sonnet --effort medium/); // o comando corrigido do worker
});

test('`orca …` dentro de string, heredoc de outro comando ou comentário não é comando', () => {
  const cmd = 'orca orchestration worker-start --agent claude --worktree new-child --spec x';
  recusa(cmd); // o mesmo texto fora da string recusa
  passa(`echo "${cmd}"`);
  passa(`echo '${cmd}'`);
  passa(`git commit -m "fix: ${cmd}"`);
  passa(`cat > nota.md <<'EOF'\n${cmd}\nEOF`);
  passa(`ls # ${cmd}`);
  passa(`grep -n "orca agent launch" README.md`);
  passa('orcamento orchestration worker-start --agent claude');
});

test('comandosDoOrca lê os três comandos e ignora o resto', () => {
  const l = comandosDoOrca('orca worktree list && orca agent launch --agent claude --prompt "oi" ; orca worktree create --name a', { cwd: REPO, env: ENV });
  assert.ok(l.length > 0);
  assert.deepEqual(l.map((x) => x.sub), ['agent-launch', 'worktree-create']);
  assert.equal(l[0].bandeiras.prompt, 'oi');
});

// Ponta a ponta: o hook lê a entrada do Claude, nega com o motivo e grava o log com o anfitrião.
function rodar(entrada, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'trava-do-orca-hook-'));
  try {
    const r = spawnSync(process.execPath, [join(HOOKS, 'trava-do-orca.mjs')], {
      input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, HOOKS_CREWAI_BASE: dir, PAINEL_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '', KIT_ANFITRIAO: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', ...env },
    });
    const log = existsSync(join(dir, 'hooks-crewai.log')) ? readFileSync(join(dir, 'hooks-crewai.log'), 'utf8') : '';
    return { ...r, log };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('hook: nega com permissionDecision deny e grava `recusou` com o anfitrião', () => {
  const r = rodar({ tool_name: 'Bash', session_id: 's1', cwd: REPO, tool_input: { command: `${WS} --worktree new-child --spec x` } }, { ORCA_AGENT_SESSION_ID: 'abc-1' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /--model sonnet --effort medium/);
  assert.match(r.log, /\ttrava-do-orca\trecusou\t/);
  assert.match(r.log, /anfitriao=orca/);
});

test('hook: o que passa não escreve nada e grava o desfecho; comando sem orca não grava nada', () => {
  const r = rodar({ tool_name: 'Bash', session_id: 's1', cwd: REPO, tool_input: { command: `${WS} ${OK} --worktree new-child --spec x` } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.log, /\ttrava-do-orca\torca-abriu-sonnet\t.*anfitriao=terminal/);
  const s = rodar({ tool_name: 'Bash', session_id: 's1', cwd: REPO, tool_input: { command: 'ls -la' } });
  assert.equal(s.stdout, '');
  assert.equal(s.log, '');
  const outra = rodar({ tool_name: 'Read', session_id: 's1', cwd: REPO, tool_input: { file_path: '/x' } });
  assert.equal(outra.stdout, '');
});

test('hook: erro interno deixa passar e vai ao log', () => {
  const r = rodar('{ isto não é json');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.log, /\ttrava-do-orca\terro\t/);
});
