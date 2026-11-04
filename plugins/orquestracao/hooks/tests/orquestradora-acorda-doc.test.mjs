// F373 (fatia 2): a orquestradora só acorda pelos quatro gatilhos, e a dona se desliga dela no primeiro turno. O manual da
// orquestradora, o da dona e o protocolo dizem o mesmo, e a batida cobra da dona o PR fora da fila.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (...p) => readFileSync(join(PLUGIN, ...p), 'utf8');

test('a skill da orquestradora lista os quatro gatilhos e o turno de aviso sem leitura', () => {
  const s = ler('skills', 'orquestradora', 'SKILL.md');
  assert.match(s, /<a id="quando-acorda"><\/a>/);
  const trecho = s.slice(s.indexOf('<a id="quando-acorda">'), s.indexOf('## Ao assumir'));
  assert.ok(trecho.length > 200, 'a seção existe e não está vazia');
  for (const g of ['instrução do operador', 'número de documento', 'sem dona com vaga', 'erro da fila']) assert.ok(trecho.includes(g), `falta o gatilho "${g}"`);
  assert.match(trecho, /sem leitura/);
  assert.match(trecho, /detach_session/);
  assert.doesNotMatch(s, /list_sessions \{"linked": true\}` só quando/, 'a dona desligada não vem no linked');
});

test('a dona e o protocolo mandam desligar-se no primeiro turno', () => {
  assert.match(ler('pool', 'dona.md'), /detach_session` com `"self"`/);
  assert.match(ler('pool', 'protocolo.md'), /detach_session` com `"self"`/);
  assert.ok(existsSync(join(PLUGIN, '..', '..', 'docs', 'adr', '0022-a-orquestradora-so-acorda-quando-precisa.md')), 'o ADR 0022 existe');
});

test('o /ausente conta as donas sem o linked (a dona desligada some da família)', () => {
  const s = ler('skills', 'ausente', 'SKILL.md');
  assert.match(s, /list_sessions/, 'o passo que conta as donas existe');
  assert.doesNotMatch(s, /list_sessions \{"linked": true\}/);
});

// F373 (fatia 3, ADR 0023): o pós-merge é da rodada sem turno, e a dona do PR que fecha o item se arquiva pelo app no merge.
test('o pós-merge sem turno: a skill, a dona e o protocolo dizem o mesmo', () => {
  const s = ler('skills', 'orquestradora', 'SKILL.md');
  const trecho = s.slice(s.indexOf('<a id="quando-acorda">'), s.indexOf('<a id="aviso-de-fim-de-turno">'));
  assert.ok(trecho.length > 200, 'a seção existe');
  assert.match(trecho, /pós-merge que falhou/);
  assert.match(trecho, /desfechos\.log/);
  assert.doesNotMatch(s, /o pós-merge é seu até a fatia/, 'a regra provisória da fatia 2 saiu');
  assert.match(ler('pool', 'dona.md'), /auto_archive_on_close: true/);
  const p = ler('pool', 'protocolo.md');
  assert.match(p, /subir-versao --empurrar --destacado/);
  assert.match(p, /KIT_POS_MERGE=off/);
  assert.doesNotMatch(p, /resumo só com o que é dela \(subir a versão/, 'o protocolo não manda mais o pós-merge à orquestradora');
  assert.ok(existsSync(join(PLUGIN, '..', '..', 'docs', 'adr', '0023-o-pos-merge-roda-sem-turno-da-orquestradora.md')), 'o ADR 0023 existe');
});
