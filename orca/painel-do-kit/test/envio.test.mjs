// Transporte da resposta no Orca (F436): o texto do operador vai em arquivo, nunca na linha de shell.
// O teste roda o comando montado num shell de verdade, com um `orca` falso que grava os argumentos que recebeu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { destinoValido, prepararEnvio, lerResultado, destinoDoSeguimento } from '../src/nucleo/envio.mjs';

const PERIGOSO = `"aspas" 'simples' $(touch /tmp/f436-pwned) \`touch /tmp/f436-pwned2\` $HOME \\n; exit 7
segunda linha & | > < * ? ~ !`;

function orcaFalso() {
  const bin = mkdtempSync(join(tmpdir(), 'f436-bin-'));
  const f = join(bin, 'orca');
  // Grava cada argumento em JSON (um por linha) e responde como o Orca responde ao send --json.
  writeFileSync(f, `#!/usr/bin/env node\nconst fs=require('fs');fs.writeFileSync(process.env.F436_ARGS, JSON.stringify(process.argv.slice(2)));console.log(JSON.stringify({ok:true,result:{messageId:'msg_teste'}}));\n`);
  chmodSync(f, 0o755);
  return bin;
}

test('destino: só run:, dispatch: ou orca_session_id: com id simples', () => {
  for (const ok of ['run:run_7f75831d32eb', 'dispatch:ctx_54e7445053d2', 'orca_session_id:18214e67-8a96-42c7-9479-baca1935411a']) assert.ok(destinoValido(ok), ok);
  for (const ruim of ['', 'run:', "run:x'", 'run:a b', 'dispatch:$(x)', 'local_abc', '@all', 'run:a;b', null, undefined, 42]) assert.ok(!destinoValido(ruim), String(ruim));
});

for (const shell of ['/bin/sh', '/bin/zsh', '/bin/bash'].filter((s) => existsSync(s))) {
  test(`${shell}: o comando montado entrega assunto e corpo byte a byte, e o texto não aparece na linha`, () => {
    const bin = orcaFalso();
    const args = join(bin, 'args.json');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, F436_ARGS: args };
    const env2 = prepararEnvio({ destino: 'dispatch:ctx_abc', assunto: `Q1 · ${PERIGOSO}`, corpo: PERIGOSO, tipo: 'status' });
    assert.ok(env2.comando.length > 0);
    assert.ok(!env2.comando.includes('aspas') && !env2.comando.includes('pwned') && !env2.comando.includes('segunda'), `texto na linha: ${env2.comando}`);
    assert.equal(statSync(env2.dir).mode & 0o777, 0o700);
    execFileSync(shell, ['-c', env2.comando.replace(/; exit$/, '')], { env, timeout: 10_000, killSignal: 'SIGKILL' });
    const recebidos = JSON.parse(readFileSync(args, 'utf8'));
    assert.deepEqual(recebidos, ['orchestration', 'send', '--to', 'dispatch:ctx_abc', '--type', 'status', '--subject', `Q1 · ${PERIGOSO}`, '--body', PERIGOSO, '--json']);
    assert.ok(!existsSync('/tmp/f436-pwned') && !existsSync('/tmp/f436-pwned2'), 'o texto foi executado');
    const r = lerResultado(env2.dir);
    assert.deepEqual(r, { pronto: true, ok: true, messageId: 'msg_teste' });
  });
}

test('prepararEnvio recusa destino inválido antes de criar qualquer arquivo', () => {
  assert.throws(() => prepararEnvio({ destino: "run:x'; rm -rf ~; '", assunto: 'a', corpo: 'b' }), /destino/);
  assert.throws(() => prepararEnvio({ destino: 'run:x', assunto: 'a', corpo: '' }), /corpo/);
});

test('lerResultado: sem o marcador de fim ainda não está pronto; erro do Orca vira motivo legível', () => {
  const { dir } = prepararEnvio({ destino: 'run:r1', assunto: 'a', corpo: 'b' });
  assert.deepEqual(lerResultado(dir), { pronto: false });
  writeFileSync(join(dir, 'saida.json'), '{"ok":false,"error":{"code":"task_not_found","message":"Dispatch x is not a helper"}}\nerror: task_not_found: ...');
  writeFileSync(join(dir, 'fim'), '1\n');
  assert.deepEqual(lerResultado(dir), { pronto: true, ok: false, motivo: 'task_not_found: Dispatch x is not a helper' });
  writeFileSync(join(dir, 'saida.json'), 'zsh: command not found: orca');
  writeFileSync(join(dir, 'fim'), '127\n');
  assert.deepEqual(lerResultado(dir), { pronto: true, ok: false, motivo: 'zsh: command not found: orca' });
});

test('seguimento: worker vivo recebe direto; worker encerrado manda à coordenadora da Run; sem Run não há destino', () => {
  assert.deepEqual(destinoDoSeguimento({ origem: 'orca', dispatchId: 'ctx_a', run: 'run_1', vivo: true }), { destino: 'dispatch:ctx_a', quem: 'sessao' });
  assert.deepEqual(destinoDoSeguimento({ origem: 'orca', dispatchId: 'ctx_a', run: 'run_1', vivo: false }), { destino: 'run:run_1', quem: 'coordenadora' });
  assert.deepEqual(destinoDoSeguimento({ origem: 'painel', runDoProjeto: 'run_9' }), { destino: 'run:run_9', quem: 'coordenadora' });
  assert.equal(destinoDoSeguimento({ origem: 'painel' }), null);
  assert.equal(destinoDoSeguimento({ origem: 'orca', run: "x'" }), null);
});
