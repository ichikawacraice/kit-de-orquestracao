// F470: o estado dos agentes do Orca (`orca worktree ps`). Um `orca` falso devolve o recibo fixo; nunca se chama o `orca` real.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agentesDoOrca, rodandoDoRegistro } from '../orca-agentes.mjs';
import { orcaFalso, reciboPs, worktreeComAgentes, agenteDoOrca } from './orca-falso.mjs';

const ps = (r) => orcaFalso({ '': { stdout: {} }, outros: { 'worktree ps': r } });

describe('agentesDoOrca', () => {
  it('lê o estado de cada agente pela paneKey, de todas as worktrees, sem o vínculo do Orca no ambiente do filho', () => {
    const o = ps(reciboPs([
      worktreeComAgentes('/w/a', [agenteDoOrca('aaa-1', 'working'), agenteDoOrca('bbb-2', 'done')]),
      worktreeComAgentes('/w/b', [agenteDoOrca('ccc_3', 'working')]),
      { path: '/w/c', agents: undefined },
    ]));
    const r = agentesDoOrca({ env: { ...process.env, ...o.env, ORCA_TERMINAL_HANDLE: 'structworker_eu', ORCA_AGENT_SESSION_ID: 'eu' } });
    assert.ok(r && !r.erro, JSON.stringify(r));
    assert.equal(r.agentes.size, 3, 'sem agentes lidos o teste não mediria nada');
    assert.equal(r.agentes.get('aaa-1'), 'working');
    assert.equal(r.agentes.get('bbb-2'), 'done');
    assert.equal(r.agentes.get('ccc_3'), 'working');
    const [c] = o.chamadas();
    assert.deepEqual(c.argv.slice(0, 3), ['worktree', 'ps', '--json']);
    assert.equal(c.env.ORCA_FALSO_DIR, o.dir);
    assert.equal(c.env.ORCA_TERMINAL_HANDLE, undefined);
    assert.equal(c.env.ORCA_AGENT_SESSION_ID, undefined);
  });

  it('erro quando o orca falha, a saída não é JSON, o recibo não traz as worktrees ou a lista veio truncada', () => {
    for (const r of [{ stdout: 'quebrou', exit: 1 }, { stdout: 'não é json' }, { stdout: { ok: true, result: {} } }, { stdout: { ok: false, error: 'x' } }, reciboPs([], { truncated: true })]) {
      const o = ps(r);
      const l = agentesDoOrca({ env: { ...process.env, ...o.env } });
      assert.ok(l?.erro, JSON.stringify(l));
    }
  });

  it('sem orca na máquina, null', () => {
    assert.equal(agentesDoOrca({ env: { ...process.env, KIT_ORCA_BIN: 'off' } }), null);
  });
});

describe('rodandoDoRegistro', () => {
  const lista = { agentes: new Map([['aaa-1', 'working'], ['bbb-2', 'done'], ['ccc-3', 'waiting']]) };
  it('true só com o agente da dona em working; done, waiting e ausente dão false; sem lista ou com erro, null', () => {
    assert.equal(rodandoDoRegistro('orca_session_id:aaa-1', lista), true);
    assert.equal(rodandoDoRegistro('orca_session_id:bbb-2', lista), false);
    assert.equal(rodandoDoRegistro('orca_session_id:ccc-3', lista), false);
    assert.equal(rodandoDoRegistro('orca_session_id:zzz', lista), false);
    assert.equal(rodandoDoRegistro('orca_session_id:aaa-1', null), null);
    assert.equal(rodandoDoRegistro('orca_session_id:aaa-1', { erro: 'x' }), null);
    assert.equal(rodandoDoRegistro('local_x', lista), null, 'não é id do Orca');
  });
});
