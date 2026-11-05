// F373 (fatia 3): o pós-merge da fila sem turno — subir a versão dos plugins num worktree temporário destacado em origin/<base>,
// atualizar os plugins (só no repositório do kit) e girar o arquivo de estado da orquestradora — sem turno dela. Repositório,
// origem, HOME e a pasta da orquestração são temporários; o `claude` é um falso que só registra a chamada.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { posMerge } from '../../skills/orquestradora/scripts/pos-merge.mjs';

let base; let repo; let origem; let orq;
function git(args, cwd = repo) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
const escrever = (rel, texto) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), texto); };
const pluginJson = (v) => `{\n  "name": "a",\n  "version": "${v}"\n}\n`;
const commitar = (msg) => { git(['add', '-A']); git(['commit', '-q', '-m', msg]); };

function montar(nomeDoMarketplace) {
  if (nomeDoMarketplace) {
    escrever('.claude-plugin/marketplace.json', JSON.stringify({ name: nomeDoMarketplace, plugins: [{ name: 'a', source: './plugins/a' }] }));
    escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('0.1.5'));
  }
  escrever('plugins/a/x.mjs', 'um\n');
  commitar('chore: inicial');
  git(['clone', '-q', '--bare', repo, origem], base);
  git(['remote', 'add', 'origin', origem]);
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat: o PR mergeado');
  git(['push', '-q', 'origin', 'HEAD:main']);
  git(['switch', '-q', '-c', 'outra']); // o checkout principal pode estar em outra branch, e com a main fora do lugar
}
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'pos-merge-'));
  repo = join(base, 'kit'); origem = join(base, 'origem.git'); orq = join(base, 'orq');
  for (const d of [repo, orq, join(base, 'home'), join(base, 'bin')]) mkdirSync(d, { recursive: true });
  git(['init', '-q', '-b', 'main']); git(['config', 'user.name', 'T']); git(['config', 'user.email', 't@t']);
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function claudeFalso() {
  const f = join(base, 'bin', 'claude'); const log = join(base, 'claude.log');
  writeFileSync(f, `#!/bin/sh\necho "$@" >> "${log}"\nexit 1\n`); chmodSync(f, 0o755);
  return { bin: f, log };
}
const ambiente = (extra = {}) => ({ ...process.env, HOME: join(base, 'home'), KIT_MARKETPLACE_DIR: join(base, 'clone'), ...extra });
const worktrees = () => git(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).length;

test('marketplace do kit: sobe a versão na origin/main pelo worktree temporário, chama o atualizar-plugins e some com o worktree', () => {
  montar('ichikawa-kit');
  const c = claudeFalso();
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente({ CLAUDE_BIN: c.bin }) });
  assert.deepEqual(r.versao?.subiu?.map((s) => `${s.nome} ${s.depois}`), ['a 0.1.6'], JSON.stringify(r));
  assert.equal(r.versao.empurrou, true);
  assert.match(git(['log', '-1', '--format=%s', 'main'], origem), /^chore\(versao\): sobe os plugins do lote — a 0\.1\.6$/);
  assert.equal(git(['rev-parse', '--abbrev-ref', 'HEAD']), 'outra', 'o checkout principal não saiu da branch dele');
  assert.equal(worktrees(), 1, 'o worktree temporário foi removido');
  assert.ok(existsSync(c.log), 'o atualizar-plugins rodou (chamou o claude)');
  assert.ok((r.erros ?? []).some((e) => /^plugins: /.test(e)), `o claude falso falha e o erro vem com a etapa: ${JSON.stringify(r.erros)}`);
});

test('outro marketplace: sobe a versão e não mexe nos plugins instalados', () => {
  montar('outro');
  const c = claudeFalso();
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente({ CLAUDE_BIN: c.bin }) });
  assert.equal(r.versao?.subiu?.length, 1, JSON.stringify(r));
  assert.equal(r.plugins, undefined);
  assert.ok(!existsSync(c.log), 'o claude não foi chamado');
  assert.equal(r.erros, undefined, JSON.stringify(r.erros));
});

test('projeto sem marketplace: não sobe versão; com o arquivo de estado, gira; sem ele, nada', () => {
  montar(null);
  const vazio = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente() });
  assert.deepEqual(vazio, {}, JSON.stringify(vazio));
  const hoje = new Date();
  const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const ontem = new Date(hoje.getTime() - 3 * 86_400_000);
  writeFileSync(join(orq, 'kit.md'), `# Estado\n\n## PRs abertos\n- nada\n\n## Retomar daqui (${dd(ontem)})\n- velho\n\n## Retomar daqui (${dd(hoje)})\n- novo\n`);
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['Kit', 'kit'], pastaOrq: orq, env: ambiente() });
  assert.equal(r.versao, undefined);
  assert.ok(r.estado, JSON.stringify(r));
  const vivo = readFileSync(join(orq, 'kit.md'), 'utf8');
  assert.match(vivo, /- novo/);
  assert.doesNotMatch(vivo, /- velho/, 'a seção datada antiga foi ao arquivo morto');
});

test('push recusado: tenta de novo, vira erro com o motivo do git e não deixa worktree; no kit, os plugins ficam por fazer', () => {
  montar('ichikawa-kit');
  // a presença seria detectada: um worktree a mais conta
  const extra = join(base, 'extra'); git(['worktree', 'add', '-q', '--detach', extra, 'HEAD']);
  assert.equal(worktrees(), 2); git(['worktree', 'remove', '--force', extra]); assert.equal(worktrees(), 1);
  const gancho = join(origem, 'hooks', 'pre-receive'); const conta = join(base, 'pushes');
  writeFileSync(gancho, `#!/bin/sh\necho x >> "${conta}"\necho "nao aceito" >&2\nexit 1\n`); chmodSync(gancho, 0o755);
  const c = claudeFalso();
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente({ CLAUDE_BIN: c.bin }) });
  const v = (r.erros ?? []).find((e) => /^versao: /.test(e));
  assert.ok(v, JSON.stringify(r));
  assert.match(v, /rejected/, 'o motivo é a linha do rejected');
  assert.doesNotMatch(v, /^versao: (To |remote:)/, 'não o "To <url>" nem o "remote:" que vêm antes');
  assert.match(v, /3 tentativas/);
  assert.equal(readFileSync(conta, 'utf8').trim().split('\n').length, 3, 'três pushes');
  assert.equal(worktrees(), 1, 'nenhum worktree sobrou');
  assert.equal(git(['rev-parse', '--abbrev-ref', 'HEAD']), 'outra');
  assert.ok((r.erros ?? []).some((e) => /^plugins: não rodou porque a versão falhou/.test(e)), JSON.stringify(r.erros));
  assert.ok(!existsSync(c.log), 'sem versão, o atualizar-plugins não roda');
});

test('a origem sumiu: erro de versão na etapa, sem lançar', () => {
  montar('outro');
  rmSync(origem, { recursive: true, force: true });
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente() });
  assert.ok((r.erros ?? []).some((e) => /^versao: /.test(e)), JSON.stringify(r));
});

test('a trava do botão do kit: a vencida ou com falha não segura; o pós-merge grava a dele e a tira no fim', () => {
  montar('ichikawa-kit');
  const trava = join(orq, 'batida', 'atualizando-kit.json'); mkdirSync(dirname(trava), { recursive: true });
  writeFileSync(trava, JSON.stringify({ em: new Date(Date.now() - 11 * 60_000).toISOString() }));
  const c = claudeFalso();
  const r = posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, env: ambiente({ CLAUDE_BIN: c.bin, KIT_POS_MERGE_ESPERA_MS: '10' }) });
  assert.ok(existsSync(c.log), `o atualizar-plugins rodou: ${JSON.stringify(r)}`);
  assert.ok(!existsSync(trava), 'a trava do pós-merge saiu no fim');
});

// F426: a versão sobe no máximo uma vez por dia de São Paulo; os plugins seguem a cada lote. Relógio injetado em KIT_AGORA.
function outroPr(texto) { // um PR a mais na origin/main, sem sair da branch do checkout principal
  git(['fetch', '-q', 'origin']);
  git(['switch', '-q', '-c', `pr-${texto}`, 'origin/main']);
  escrever('plugins/a/x.mjs', `pr ${texto}\n`); commitar(`feat: PR ${texto}`);
  git(['push', '-q', 'origin', 'HEAD:main']);
  git(['switch', '-q', 'outra']);
}
const versaoNaOrigem = () => /"version": "([^"]+)"/.exec(git(['show', 'main:plugins/a/.claude-plugin/plugin.json'], origem))[1];

test('uma subida por dia: o segundo lote do mesmo dia não sobe a versão e não chama o atualizar-plugins; o primeiro do dia seguinte sobe', () => {
  montar('ichikawa-kit');
  const c = claudeFalso();
  const rodar = (agora, extra = {}) => posMerge({ cwd: repo, base: 'main', nomes: ['kit'], pastaOrq: orq, ...extra, env: ambiente({ CLAUDE_BIN: c.bin, KIT_AGORA: agora }) });
  const hoje = new Date().toISOString();
  const amanha = new Date(Date.now() + 26 * 3_600_000).toISOString(); // 26 h depois: sempre é o dia seguinte em SP

  const l1 = rodar(hoje);
  assert.equal(versaoNaOrigem(), '0.1.6', `precondição: o primeiro lote sobe ${JSON.stringify(l1)}`);

  outroPr('dois');
  const log1 = readFileSync(c.log, 'utf8').split('\n').filter(Boolean).length;
  assert.ok(log1 > 0, 'precondição: o primeiro lote chamou o claude');
  const l2 = rodar(hoje);
  assert.equal(versaoNaOrigem(), '0.1.6', `o segundo lote do dia não sobe: ${JSON.stringify(l2)}`);
  assert.deepEqual(l2.versao?.subiu, []);
  assert.match(l2.versao?.adiado ?? '', /já subiu hoje/);
  assert.equal(readFileSync(c.log, 'utf8').split('\n').filter(Boolean).length, log1, 'o lote que não sobe não chama o atualizar-plugins (ele só troca versão diferente)');
  assert.equal((l2.erros ?? []).some((e) => /^versao:/.test(e)), false, 'adiar não é erro da versão');

  outroPr('tres');
  const l3 = rodar(hoje, { forcar: true });
  assert.equal(versaoNaOrigem(), '0.1.7', `--forcar sobe no mesmo dia: ${JSON.stringify(l3)}`);

  outroPr('quatro');
  const l4 = rodar(amanha);
  assert.equal(versaoNaOrigem(), '0.1.8', `o primeiro lote do dia seguinte sobe: ${JSON.stringify(l4)}`);
  assert.equal(worktrees(), 1, 'nenhum worktree temporário sobrou');
});
