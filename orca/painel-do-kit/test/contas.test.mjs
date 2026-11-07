// Uso das contas (F475): o que o `orca account list --json` diz vira uma linha por conta. Contas puras, sem Orca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contagem, contasDoOrca } from '../src/nucleo/contas.mjs';

const AGORA = Date.parse('2026-11-06T20:32:00Z'); // 17:32 em São Paulo
const MIN = 60_000, H = 60 * MIN, D = 24 * H;

test('contagem: horas e minutos, dias e horas, minutos soltos', () => {
  assert.equal(contagem(AGORA + 3 * H + 8 * MIN, AGORA), '3h 8m');
  assert.equal(contagem(AGORA + 6 * D + 7 * H + 20 * MIN, AGORA), '6d 7h');
  assert.equal(contagem(AGORA + 45 * MIN, AGORA), '45m');
  assert.equal(contagem(AGORA + 1 * H, AGORA), '1h 0m');
  assert.equal(contagem(AGORA + 1 * D, AGORA), '1d 0h');
});

test('contagem: sem horário, no passado ou com lixo vira traço; menos de 1 min é <1m', () => {
  for (const x of [null, undefined, 'amanhã', NaN]) assert.equal(contagem(x, AGORA), '—');
  assert.equal(contagem(AGORA, AGORA), '—');
  assert.equal(contagem(AGORA - 5 * MIN, AGORA), '—');
  assert.equal(contagem(AGORA + 20_000, AGORA), '<1m');
});

const janela = (usedPercent, resetsAt = AGORA + H) => ({ usedPercent, windowMinutes: 300, resetsAt, resetDescription: 'x' });
const limites = (sessao, semana, extra = {}) => ({ provider: 'claude', session: sessao, weekly: semana, status: 'ok', error: null, ...extra });
const conta = (id, email) => ({ id, email });
const bruto = (extra = {}) => ({
  claude: { accounts: [conta('b', 'zeta@x.com'), conta('a', 'alfa@x.com'), conta('c', 'agentes@x.com')], activeAccountId: 'c' },
  codex: { accounts: [], activeAccountId: null },
  rateLimits: {
    claude: limites(janela(51), janela(16)),
    inactiveClaudeAccounts: [
      { accountId: 'b', rateLimits: limites(janela(56), janela(100)) },
      { accountId: 'a', rateLimits: limites(janela(17), janela(72)) },
    ],
    inactiveCodexAccounts: [],
    ...extra,
  },
});

test('a ativa vem primeiro e marcada; as outras por e-mail; o e-mail vem de accounts pelo id', () => {
  const { contas } = contasDoOrca(bruto());
  assert.deepEqual(contas.map((c) => [c.email, c.ativa]), [['agentes@x.com', true], ['alfa@x.com', false], ['zeta@x.com', false]]);
  assert.deepEqual(contas[0].sessao, { usado: 51, resetsAt: AGORA + H });
  assert.deepEqual(contas[0].semana, { usado: 16, resetsAt: AGORA + H });
  assert.equal(contas[1].semana.usado, 72);
});

test('conta removida (accountId sem conta em accounts) é ignorada', () => {
  const b = bruto();
  b.rateLimits.inactiveClaudeAccounts.push({ accountId: 'fantasma', rateLimits: limites(janela(1), janela(1)) });
  const { contas } = contasDoOrca(b);
  assert.equal(contas.length, 3);
  assert.ok(!contas.some((c) => c.id === 'fantasma'));
});

test('status error ou limites ausentes: semDado, sem esconder as outras', () => {
  const b = bruto();
  b.rateLimits.inactiveClaudeAccounts[1] = { accountId: 'a', rateLimits: limites(janela(17), janela(72), { status: 'error', error: 'token velho' }) };
  b.rateLimits.inactiveClaudeAccounts[0] = { accountId: 'b' }; // sem rateLimits
  const { contas } = contasDoOrca(b);
  assert.deepEqual(contas.map((c) => [c.email, c.semDado]), [['agentes@x.com', false], ['alfa@x.com', true], ['zeta@x.com', true]]);
  assert.equal(contas[1].sessao, null);
  assert.equal(contas[1].semana, null);
});

test('janela sem uso: resetsAt null segue como dado, com horário null', () => {
  const b = bruto();
  b.rateLimits.claude = limites(janela(0, null), janela(10));
  const { contas } = contasDoOrca(b);
  assert.equal(contas[0].semDado, false);
  assert.deepEqual(contas[0].sessao, { usado: 0, resetsAt: null });
});

test('uma janela sem número de uso vira semDado só nessa conta', () => {
  const b = bruto();
  b.rateLimits.claude = limites({ usedPercent: null, resetsAt: null }, janela(10));
  assert.equal(contasDoOrca(b).contas[0].semDado, true);
});

test('Codex: conta com uso aparece depois das do Claude; sem conta nada aparece', () => {
  const b = bruto();
  b.codex = { accounts: [conta('x', 'g@gmail.com')], activeAccountId: 'x' };
  b.rateLimits.codex = { ...limites(janela(100), janela(16)), provider: 'codex' };
  const { contas } = contasDoOrca(b);
  assert.deepEqual(contas.map((c) => c.provedor), ['claude', 'claude', 'claude', 'codex']);
  assert.equal(contas[3].email, 'g@gmail.com');
  assert.equal(contas[3].ativa, true);
  assert.equal(contasDoOrca(bruto()).contas.filter((c) => c.provedor === 'codex').length, 0);
});

test('entrada que não é a resposta do Orca: lança erro, para a aba dizer "indisponível"', () => {
  for (const x of [null, undefined, 'x', {}, { claude: {} }]) assert.throws(() => contasDoOrca(x), /resposta do Orca/);
});

test('sem conta nenhuma: lista vazia, sem erro', () => {
  assert.deepEqual(contasDoOrca({ claude: { accounts: [], activeAccountId: null }, rateLimits: {} }).contas, []);
});
