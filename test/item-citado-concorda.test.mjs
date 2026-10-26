import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// F43: o pane (citadosDe, ITEM_SOLTO) e a recusa do `painel` classificam o F<n> citado do mesmo jeito, e o exemplo do protocolo é o que os dois aceitam.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAINEL = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const REGISTER = join(RAIZ, 'plugins', 'painel-sessoes', 'hooks', 'register.tsx');
const PROTOCOLO = join(RAIZ, 'plugins', 'orquestracao', 'pool', 'protocolo.md');

const regexDoPane = () => {
  const m = readFileSync(REGISTER, 'utf8').match(/export const ITEM_SOLTO = \/(.+)\/([a-z]*)$/m);
  assert.ok(m, 'insumo: o register.tsx não exporta mais ITEM_SOLTO');
  return new RegExp(m[1], m[2]);
};

const painelAceita = (frase) => {
  const base = mkdtempSync(join(tmpdir(), 'item-citado-'));
  try {
    mkdirSync(join(base, 'painel')); mkdirSync(join(base, 'app')); mkdirSync(join(base, 'orq'));
    const r = spawnSync('node', [PAINEL, 'set', 'perguntas', 'Q1', JSON.stringify({ estado: 'aberta', sessaoId: 'local_a', caso: frase })], {
      encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
      env: { ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: join(base, 'app'), HOOKS_CREWAI_BASE: join(base, 'orq') },
    });
    return r.status === 0;
  } finally { rmSync(base, { recursive: true, force: true }); }
};

describe('F43 — o pane e o painel concordam sobre o F<n> solto', () => {
  const exemplo = readFileSync(PROTOCOLO, 'utf8').match(/<!-- exemplo-item-citado: (.+?) -->/)?.[1]?.trim();
  const frases = [
    ['a executora do F13 está parada', true],
    ['espera o F42 fechar', true],
    ['F13 · SPEC-155 fatia 2 está parado', false],
    ['sem número nenhum', false],
    [exemplo, false],
  ];

  it('o exemplo do protocolo existe e traz um número nomeado', () => {
    assert.ok(exemplo && exemplo.length > 0, 'protocolo sem a marca exemplo-item-citado');
    assert.match(exemplo, /F\d+ · \S/);
  });

  for (const [frase, solta] of frases) {
    it(`"${frase}": o pane ${solta ? 'cita' : 'não cita'} e o painel ${solta ? 'recusa' : 'aceita'}`, () => {
      assert.ok(frase, 'insumo vazio');
      assert.equal(frase.match(regexDoPane()) !== null, solta, 'regex do pane');
      assert.equal(painelAceita(frase), !solta, 'painel');
    });
  }

  it('prova que a medição enxerga: a regex pega o solto, e o painel recusa o solto', () => {
    assert.notEqual('o F13'.match(regexDoPane()), null);
    assert.equal(painelAceita('o F13'), false);
  });
});
