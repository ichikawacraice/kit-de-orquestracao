import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c14: o agente do plugin chega como `orquestracao:<papel>`; a trava normaliza só o prefixo do plugin `orquestracao`.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(RAIZ, 'plugins', 'orquestracao', 'hooks');
const SKILL_PAPEIS = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'papeis-e-modelos', 'SKILL.md');
const NOMES = ['executor', 'orquestracao:executor', 'outro:executor'];

/** Mesma entrada sintética, três nomes, três travas. Devolve { nome: { nao_edita, criterio, anuncia } }. */
function matriz(pastaHooks) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c14-'))); mkdirSync(join(base, 'ativas'));
  try {
    let u = 0; const id = () => `u-${++u}`;
    const ab = { type: 'user', uuid: id(), message: { role: 'user', content: 'Plano: edite a.ts; critério: vitest run a.test.ts' } };
    const edit = { type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' } }] } };
    const res = { type: 'user', uuid: id(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } };
    const fala = (t) => ({ type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
    const grava = (nome, es) => { const f = join(base, nome); writeFileSync(f, `${es.map((e) => JSON.stringify(e)).join('\n')}\n`); return f; };
    const f1 = grava('t1.jsonl', [ab, edit, res]);
    const f2 = grava('t2.jsonl', [ab, fala('Gate verde, PR aberto.\n\nFalta retomar a fatia 3 do builder.')]);
    writeFileSync(join(base, 'subagente-pode-escrever.txt'), 'executor\n');
    const rodar = (hook, ev) => {
      const o = execFileSync('node', [join(pastaHooks, hook)], { input: JSON.stringify(ev), encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', env: { ...process.env, HOOKS_CREWAI_BASE: base, POOL_APP_SESSOES_DIR: join(base, 'sem-registro') } });
      return o ? JSON.parse(o) : null;
    };
    const dec = (r) => r?.decision ?? r?.hookSpecificOutput?.permissionDecision ?? 'passou';
    const fora = {};
    for (const tipo of NOMES) {
      fora[tipo] = {
        nao_edita: dec(rodar('subagente-nao-edita.mjs', { session_id: 'S1', cwd: '/r', hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(homedir(), 'Developer', 'zz-c14', 'a.ts'), old_string: 'a', new_string: 'b' }, agent_id: 'a1', agent_type: tipo })),
        criterio: dec(rodar('executor-criterio.mjs', { session_id: 'S1', transcript_path: '/pai.jsonl', cwd: '/r', hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'a77', agent_type: tipo, agent_transcript_path: f1, last_assistant_message: 'Pronto, editei a.ts e os testes passaram.', background_tasks: [] })),
        anuncia: dec(rodar('executor-anuncia.mjs', { session_id: 'S2', transcript_path: f2, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false, agent_type: tipo, last_assistant_message: 'Gate verde, PR aberto.\n\nFalta retomar a fatia 3 do builder.', background_tasks: [] })),
      };
    }
    return fora;
  } finally { rmSync(base, { recursive: true, force: true }); }
}

describe('c14 — nome do agente com e sem o prefixo do plugin', () => {
  it('executor e orquestracao:executor valem igual; outro:executor não ganha a exceção nem a cobrança', () => {
    const m = matriz(HOOKS);
    assert.deepEqual(Object.keys(m), NOMES);
    // `executor` na lista de quem pode escrever: o prefixo do plugin é a mesma coisa, o de outro plugin não
    assert.equal(m.executor.nao_edita, 'passou');
    assert.equal(m['orquestracao:executor'].nao_edita, 'passou');
    assert.equal(m['outro:executor'].nao_edita, 'deny');
    // o executor do plugin é cobrado pelo critério e pelo anúncio; o de outro plugin não é executor do pool
    for (const t of ['criterio', 'anuncia']) {
      assert.equal(m.executor[t], 'block', `executor/${t}`);
      assert.equal(m['orquestracao:executor'][t], 'block', `orquestracao:executor/${t}`);
      assert.equal(m['outro:executor'][t], 'passou', `outro:executor/${t}`);
    }
  });
  it('mutante: sem a normalização do prefixo, orquestracao:executor deixa de ser cobrado (o teste enxerga)', () => {
    const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c14-mut-')));
    try {
      cpSync(HOOKS, join(tmp, 'hooks'), { recursive: true });
      const comum = join(tmp, 'hooks', 'hooks-crewai-comum.mjs');
      const antes = readFileSync(comum, 'utf8');
      assert.match(antes, /export const semPrefixoDoPlugin = /);
      writeFileSync(comum, antes.replace(/export const semPrefixoDoPlugin = .*/, 'export const semPrefixoDoPlugin = (nome) => String(nome ?? \'\');'));
      const m = matriz(join(tmp, 'hooks'));
      assert.equal(m['orquestracao:executor'].criterio, 'passou');
      assert.equal(m['orquestracao:executor'].anuncia, 'passou');
      assert.equal(m['orquestracao:executor'].nao_edita, 'deny');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
  it('a skill papeis-e-modelos manda lançar o subagente com o nome do plugin (orquestracao:<papel>)', () => {
    const t = readFileSync(SKILL_PAPEIS, 'utf8');
    assert.ok(t.length > 1000);
    assert.match(t, /subagent_type: "orquestracao:validador" \| "orquestracao:explorador" \| "orquestracao:planejador"/);
    assert.doesNotMatch(t, /subagent_type: "validador"/);
  });
});

// B1 (c13): sem KIT_F27_FOTO o caso da foto real é pulado de verdade (skip com motivo), nunca contado como aprovado.
const tapDoMigrar = (arquivo, env) => {
  const e = { ...process.env, ...env }; delete e.NODE_TEST_CONTEXT; if (!env.KIT_F27_FOTO) delete e.KIT_F27_FOTO;
  const r = spawnSync('node', ['--test', '--test-reporter=tap', arquivo], { encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: e });
  return r.stdout;
};
it('B1: o caso da foto real sem KIT_F27_FOTO sai como SKIP com motivo, e não como ok', () => {
  const tap = tapDoMigrar(join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'tests', 'migrar-fila.test.mjs'), {});
  const linhaFoto = tap.split('\n').find((l) => /^\s*(not )?ok .*cópia do painel real/.test(l));
  assert.ok(linhaFoto, `o caso da foto não apareceu no TAP:\n${tap.slice(0, 400)}`);
  assert.match(linhaFoto, /# SKIP .*KIT_F27_FOTO/, `a foto não foi pulada com motivo: ${linhaFoto}`);
  assert.match(tap, /# skipped 1\b/);
});

// L1 (c15): na prosa das skills e dos papéis do pool o subagente do plugin é citado com o prefixo.
it('L1: skills e pool não citam subagente do plugin sem o prefixo orquestracao:', () => {
  const achar = (pasta) => execFileSync('find', [pasta, '-name', '*.md'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const arquivos = [...achar(join(RAIZ, 'plugins', 'orquestracao', 'skills')), ...achar(join(RAIZ, 'plugins', 'orquestracao', 'pool'))];
  assert.ok(arquivos.length >= 6, `poucos arquivos varridos: ${arquivos.length}`);
  const solto = /(\b(sub)?agentes?\s+`?|\b(um|o|a)\s+`)(validador|explorador|planejador|executor)(?![\w:-])/;
  const achados = arquivos.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => solto.test(l)).map(([a, n, l]) => `${a}:${n}: ${l.slice(0, 90)}`));
  assert.deepEqual(achados, []);
  // prova de que o detector pega: um texto com o nome solto é achado
  for (const caso of ['lança subagente `validador`', 'use o agente `validador`', 'o subagente validador revisa', 'um agente explorador', 'chame o `planejador`']) assert.ok(solto.test(caso), `o detector não pegou: ${caso}`);
  for (const caso of ['o agente `orquestracao:validador`', 'subagente orquestracao:executor', 'a skill `papeis-e-modelos`', 'o validador do pool']) assert.ok(!solto.test(caso), `o detector pegou sem dever: ${caso}`);
});
