#!/usr/bin/env node
// F314: a devolução por conflito pelo `sync_with_base_branch` do app e o aviso nativo de fim de turno como segundo sinal.
// O que a fila escreve à dona, o manual da dona, o protocolo, a regra do CLAUDE.md e a skill da orquestradora concordam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAIZ = join(PLUGIN, '..', '..');
const ler = (...p) => readFileSync(join(...p), 'utf8');
const passo = (md, n) => md.split('\n').find((l) => l.startsWith(`${n}. `)) ?? '';
const secao = (md, ancora) => {
  const i = md.indexOf(`<a id="${ancora}"></a>`);
  assert.ok(i >= 0, `âncora ${ancora} existe`);
  const fim = md.indexOf('\n<a id=', i + 1);
  return md.slice(i, fim < 0 ? undefined : fim);
};

test('a fila e o passo 7 da dona nomeiam o mesmo caminho para o conflito', async () => {
  const { motivoDeConflito } = await import(join(PLUGIN, 'skills', 'orquestradora', 'scripts', 'fila-de-merge.mjs'));
  const m = motivoDeConflito({ pr: 7, sobre: 'main', arquivos: ['a.txt'], base: 'main' });
  const p7 = passo(ler(PLUGIN, 'pool', 'dona.md'), 7);
  assert.ok(p7.length > 0, 'o passo 7 existe');
  for (const termo of ['sync_with_base_branch', 'rebase']) {
    assert.match(m, new RegExp(termo), `a fila diz ${termo}`);
    assert.match(p7, new RegExp(termo), `o passo 7 diz ${termo}`);
  }
  // a dona passa ao app a base do PR, e a recusa do app cai no rebase em vez de parar
  assert.match(p7, /baseRefName/);
  assert.match(p7, /se o app recusar[\s\S]*Nothing was merged[\s\S]*git rebase origin\/<base>/, 'a recusa do app leva ao rebase');
  assert.match(p7, /git rebase --abort/, 'o rebase que também esbarra tem saída');
});

test('o protocolo da fila e a regra do CLAUDE.md abrem a exceção do merge do app', () => {
  assert.match(secao(ler(PLUGIN, 'pool', 'protocolo.md'), 'fila-de-merge'), /sync_with_base_branch/);
  const regra = (md) => md.split('\n').find((l) => l.includes('Ninguém rebaseia por merge alheio')) ?? '';
  const raiz = regra(ler(RAIZ, 'CLAUDE.md'));
  const modelo = regra(ler(RAIZ, 'modelos', 'CLAUDE.md'));
  assert.ok(raiz.length > 0 && modelo.length > 0, 'a regra existe nos dois');
  assert.match(modelo, /sync_with_base_branch/);
  assert.equal(raiz, modelo, 'o CLAUDE.md da raiz e o modelo dizem o mesmo');
});

test('a skill da orquestradora lê o aviso de fim de turno como segundo sinal', () => {
  const s = secao(ler(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'aviso-de-fim-de-turno');
  assert.match(s, /side-sessions-event/);
  assert.match(s, /you started/, 'o formato real do aviso');
  assert.match(s, /PR N pronto/);
  assert.match(s, /segundo sinal/);
  // o cabeçalho traz o PR sempre que a branch tem um: só se pede a entrega com o item em merge ou a frase no relato
  assert.match(s, /etapa: "merge"/);
  // e a dona põe a frase no começo da mensagem final, onde os 400 caracteres a alcançam
  assert.match(passo(ler(PLUGIN, 'pool', 'dona.md'), 6), /400 caracteres/);
});
