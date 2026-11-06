// F444 (ADR 0030, fatia 4): a lista de workers do Orca. Um `orca` falso devolve páginas fixas do `worker-list` e grava o
// ambiente e os argumentos que recebeu; nunca se chama o `orca` real (KIT_ORCA_BIN aponta o falso, ou PATH e KIT_ORCA_APP_BIN
// apontam pastas sem ele).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workersDoOrca, binarioDoOrca, vidaDoRegistro } from '../orca-workers.mjs';
import { orcaFalso, recibo, worker } from './orca-falso.mjs';

describe('workersDoOrca', () => {
  it('chama sem o vínculo do Orca no ambiente do filho e segue o nextCursor até o fim', () => {
    const o = orcaFalso({
      '': recibo([worker('/w/a'), worker('/w/b', 'released')], { nextCursor: 'c1' }),
      c1: recibo([worker('/w/c')]),
    });
    const r = workersDoOrca({ env: { ...process.env, ...o.env, ORCA_TERMINAL_HANDLE: 'structworker_eu', ORCA_AGENT_SESSION_ID: 'eu' } });
    assert.ok(r && !r.erro, JSON.stringify(r));
    assert.deepEqual(r.workers.map((w) => w.pasta), ['/w/a', '/w/b', '/w/c']);
    const ch = o.chamadas();
    assert.equal(ch.length, 2, 'duas páginas, duas chamadas');
    // o falso grava as envs ORCA_*: a que o teste pôs aparece (a gravação mede), e as do vínculo não
    for (const c of ch) {
      assert.equal(c.env.ORCA_FALSO_DIR, o.dir, 'o falso não gravou o ambiente: o teste não mediria nada');
      assert.equal(c.env.ORCA_TERMINAL_HANDLE, undefined);
      assert.equal(c.env.ORCA_AGENT_SESSION_ID, undefined);
      assert.deepEqual(c.argv.slice(0, 3), ['orchestration', 'worker-list', '--json']);
    }
    assert.equal(ch[0].argv.includes('--cursor'), false);
    assert.deepEqual(ch[1].argv.slice(ch[1].argv.indexOf('--cursor'), ch[1].argv.indexOf('--cursor') + 2), ['--cursor', 'c1']);
  });

  it('dá erro quando o escopo não é all (a lista seria só da Run de quem chama)', () => {
    const o = orcaFalso({ '': recibo([worker('/w/a')], { source: 'bound' }) });
    const r = workersDoOrca({ env: { ...process.env, ...o.env } });
    assert.ok(r?.erro, JSON.stringify(r));
    assert.match(r.erro, /bound/);
  });

  it('dá erro quando uma página do meio falha: lista parcial não vale', () => {
    const o = orcaFalso({ '': recibo([worker('/w/a')], { nextCursor: 'c1' }), c1: { stdout: '', exit: 1 } });
    const r = workersDoOrca({ env: { ...process.env, ...o.env } });
    assert.ok(r?.erro, JSON.stringify(r));
  });

  it('vivo é terminalState diferente de released; a pasta sai do workspace <repo-id>::<pasta>', () => {
    const o = orcaFalso({
      '': recibo([
        worker('/Users/x/orca/workspaces/kit/f1', 'retained'),
        worker('/Users/x/orca/workspaces/kit/f2', 'released'),
        worker('/Users/x/orca/workspaces/kit/f3', 'active'),
        // despacho só de contexto (sem terminal): não tem processo; vivo só enquanto o estado não é final (medido em 06/11)
        { dispatchId: 'ctx_so', taskId: 't', state: 'succeeded', liveness: 'unverifiable', workspace: 'r::/Users/x/orca/workspaces/kit/f4' },
        { dispatchId: 'ctx_so2', taskId: 't', state: 'running', liveness: 'unverifiable', workspace: 'r::/Users/x/orca/workspaces/kit/f5' },
      ]),
    });
    const r = workersDoOrca({ env: { ...process.env, ...o.env } });
    assert.ok(r && !r.erro, JSON.stringify(r));
    assert.deepEqual(r.workers.map((w) => [w.pasta, w.vivo]), [
      ['/Users/x/orca/workspaces/kit/f1', true],
      ['/Users/x/orca/workspaces/kit/f2', false],
      ['/Users/x/orca/workspaces/kit/f3', true],
      ['/Users/x/orca/workspaces/kit/f4', false],
      ['/Users/x/orca/workspaces/kit/f5', true],
    ]);
    assert.equal(r.workers[0].repoId, 'repo-uuid');
    assert.match(r.workers[0].terminal, /^structworker_/);
  });

  it('devolve null sem orca (nem no PATH, nem no app) e com KIT_ORCA_BIN=off', () => {
    const vazio = realpathSync(mkdtempSync(join(tmpdir(), 'sem-orca-')));
    const env = { PATH: vazio, KIT_ORCA_APP_BIN: join(vazio, 'nao-existe') };
    assert.equal(binarioDoOrca(env), null);
    assert.equal(workersDoOrca({ env }), null);
    // a prova de que a busca acharia: o mesmo PATH com o falso dentro acha
    const o = orcaFalso({ '': recibo([]) });
    assert.equal(binarioDoOrca({ PATH: join(o.dir, 'bin'), KIT_ORCA_APP_BIN: join(vazio, 'nao-existe') }), o.bin);
    assert.equal(binarioDoOrca({ PATH: join(o.dir, 'bin'), KIT_ORCA_BIN: 'off' }), null);
    // e o binário do app vale quando o PATH não o tem (o launchd roda com PATH curto)
    assert.equal(binarioDoOrca({ PATH: vazio, KIT_ORCA_APP_BIN: o.bin }), o.bin);
  });

  it('dá erro quando o orca existe e falha, sai ilegível ou recusa', () => {
    for (const resp of [{ stdout: '', exit: 1 }, { stdout: 'não é json' }, { stdout: { ok: false, error: { message: 'x' } } }, { stdout: { ok: true, result: {} } }]) {
      const o = orcaFalso({ '': resp });
      const r = workersDoOrca({ env: { ...process.env, ...o.env } });
      assert.ok(r?.erro, `${JSON.stringify(resp)} → ${JSON.stringify(r)}`);
    }
  });
});

describe('vidaDoRegistro', () => {
  const reg = { orcaId: 'orca_session_id:abc', terminal: 'structworker_1', cwd: '/w/f1' };
  const lista = (...workers) => ({ workers });
  const w = (terminal, pasta, vivo) => ({ terminal, pasta, vivo });
  it('viva quando há worker vivo com o terminal dela ou na pasta dela', () => {
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_1', '/w/outra', true))), true);
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_9', '/w/f1', true))), true);
  });
  it('encerrada só quando a lista mostra o terminal dela e todos liberados', () => {
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_1', '/w/f1', false))), false);
  });
  it('a prova da morte ganha da pasta compartilhada: outro worker vivo na pasta-mãe não a ressuscita', () => {
    // a prova de que a pasta compartilhada contaria: sem o terminal dela na lista, ela fica viva pela pasta
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_9', '/w', true))), true);
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_9', '/w', true), w('structworker_1', '/w/f1', false))), false);
  });
  it('fora da vista (null), nunca morta, sem a lista, com a lista com erro, sem registro ou sem o terminal na lista', () => {
    assert.equal(vidaDoRegistro(reg, null), null);
    assert.equal(vidaDoRegistro(reg, { erro: 'x' }), null);
    assert.equal(vidaDoRegistro(null, lista(w('structworker_1', '/w/f1', true))), null);
    assert.equal(vidaDoRegistro(reg, lista(w('structworker_9', '/w/outra', true))), null);
    assert.equal(vidaDoRegistro({ ...reg, terminal: null }, lista(w('structworker_1', '/w/f1', false))), null);
  });
});
