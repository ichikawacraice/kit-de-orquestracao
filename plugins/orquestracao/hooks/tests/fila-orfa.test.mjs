// F220: a fila de merge órfã — PR anotado (`emVoo` ou `pendentes`) sem processo vivo para drenar. Medido num projeto em 28/10:
// a limpeza de contexto matou a tarefa de background da fila (`[killed]`) e o #1308 ficou só anotado, sem ninguém notar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { comandoDeRelance, donoDaFilaVivo, filaOrfa, inicioDoProcesso } from '../../skills/orquestradora/scripts/fila-orfa.mjs';

const DESDE = '2026-10-28T13:03:03.261Z';
const ms = (iso) => Date.parse(iso);
const vivo = () => true;
const morto = () => false;

test('dono vivo: o pid responde e começou antes de ocupar a fila', () => {
  assert.equal(donoDaFilaVivo({ pid: 10, desde: DESDE }, { vivo, inicio: () => ms(DESDE) - 2000 }), true);
});

test('pid morto não segura a fila', () => {
  assert.equal(donoDaFilaVivo({ pid: 10, desde: DESDE }, { vivo: morto, inicio: () => ms(DESDE) - 2000 }), false);
});

test('pid reciclado: o processo vivo que começou depois de `desde` não é o dono', () => {
  assert.equal(donoDaFilaVivo({ pid: 10, desde: DESDE }, { vivo, inicio: () => ms(DESDE) + 60_000 }), false);
});

test('sem saber o início (ps falhou) vale o pid vivo, como antes', () => {
  assert.equal(donoDaFilaVivo({ pid: 10, desde: DESDE }, { vivo, inicio: () => null }), true);
});

test('o início do próprio processo é lido do ps e vem antes de agora', () => {
  const t = inicioDoProcesso(process.pid);
  assert.ok(Number.isFinite(t), `ps não deu o início: ${t}`);
  assert.ok(t <= Date.now() && t > Date.now() - 24 * 3600_000);
  const fim = spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
  assert.equal(inicioDoProcesso(fim), null, 'pid que já saiu não tem início');
});

test('fila órfã: emVoo e pendentes de dono morto, na ordem em que a fila os levaria, com o gate de quem rodava', () => {
  const estado = {
    ocupada: { pid: 10, desde: DESDE, gate: 'pnpm test && pnpm typecheck', preparar: 'pnpm install --frozen-lockfile' },
    emVoo: [{ pr: 1307, sha: 'a9f034d309a1546d29c807ea54ce3dc87cf919b2' }],
    pendentes: [{ pr: 1308, sha: 'ffcfe433ff7843b4263189588d92aad579605770' }],
  };
  const o = filaOrfa(estado, { vivo: morto });
  assert.ok(o, 'a fila sem dono com PR anotado é órfã');
  assert.deepEqual(o.prs.map((p) => p.pr), [1307, 1308]);
  assert.equal(o.desde, DESDE);
  const cmd = comandoDeRelance(o);
  assert.equal(cmd, "painel fila-de-merge 1307:a9f034d309a1546d29c807ea54ce3dc87cf919b2 1308:ffcfe433ff7843b4263189588d92aad579605770 --gate 'pnpm test && pnpm typecheck' --preparar 'pnpm install --frozen-lockfile'");
});

test('pendentes sem ninguém ocupando (o PR que o gh não leu) também é órfão', () => {
  const o = filaOrfa({ ocupada: null, pendentes: [{ pr: 24, leituras: 1 }] }, { vivo });
  assert.deepEqual(o?.prs.map((p) => p.pr), [24]);
  assert.equal(comandoDeRelance(o), 'painel fila-de-merge 24');
});

test('não é órfã: dono vivo, ou fila vazia (e o mesmo estado com o dono morto é: a prova de que a regra morde)', () => {
  const estado = { ocupada: { pid: 10, desde: DESDE }, emVoo: [{ pr: 1 }], pendentes: [] };
  assert.equal(filaOrfa(estado, { vivo, inicio: () => ms(DESDE) - 1000 }), null);
  assert.ok(filaOrfa(estado, { vivo: morto }));
  assert.equal(filaOrfa({ ocupada: { pid: 10, desde: DESDE }, emVoo: [], pendentes: [] }, { vivo: morto }), null);
  assert.equal(filaOrfa(null), null);
});

test('aspas simples no gate não quebram o comando de relance', () => {
  const o = filaOrfa({ ocupada: { pid: 10, gate: "echo 'oi'" }, emVoo: [{ pr: 3 }] }, { vivo: morto });
  assert.equal(comandoDeRelance(o), `painel fila-de-merge 3 --gate 'echo '\\''oi'\\'''`);
});

// F351: a dona anotou de novo (sha novo nos pendentes) depois de uma rodada morta (sha velho no emVoo): vale o novo.
test('PR no emVoo e nos pendentes leva o sha do pendente, o mais novo', () => {
  const o = filaOrfa({ ocupada: null, emVoo: [{ pr: 21, sha: 'aaaaaaa' }, { pr: 22, sha: 'ccccccc' }], pendentes: [{ pr: 21, sha: 'bbbbbbb' }, { pr: 22 }] });
  assert.deepEqual(o.prs, [{ pr: 21, sha: 'bbbbbbb' }, { pr: 22, sha: 'ccccccc' }]);
});
