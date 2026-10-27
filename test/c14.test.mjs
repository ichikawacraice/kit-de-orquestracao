import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { after } from 'node:test';
import { homedir, tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c14: o agente do plugin chega como `orquestracao:<papel>`; a trava de escrita normaliza só o prefixo dos plugins do kit.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(RAIZ, 'plugins', 'orquestracao', 'hooks');
const SKILL_PAPEIS = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'papeis-e-modelos', 'SKILL.md');
const NOMES = ['validador', 'orquestracao:validador', 'outro:validador'];
// HOME próprio, fora de tmpdir (as pastas livres da trava incluem tmpdir: um HOME ali faria o que deve ser negado passar). Os casos medem `~/Developer/...`.
// Mesma regra de LIVRES das travas (`/tmp`, `/var/folders` e tmpdir): HOME nesses caminhos faz passar o que deve ser negado.
const CAI_NOS_LIVRES = (p) => /^\/(private\/)?tmp\//.test(`${p}/`) || `${p}/`.startsWith('/var/folders/') || `${p}/`.startsWith('/private/var/folders/') || `${p}/`.startsWith(`${realpathSync(tmpdir())}/`);
// Procura onde criar o HOME fora dos LIVRES: primeiro em `.tmp-testes/` na raiz do repo, depois no HOME do usuário (checkout sob /tmp).
// Nunca em `test/`: o cli.test varre `test/` e um HOME que some no meio da varredura derruba quem varre.
function criarHomeDoTeste(candidatas, prefixo) {
  for (const base of candidatas) {
    mkdirSync(base, { recursive: true });
    if (CAI_NOS_LIVRES(realpathSync(base))) continue;
    const h = mkdtempSync(join(base, prefixo));
    if (!CAI_NOS_LIVRES(realpathSync(h))) return h;
    rmSync(h, { recursive: true, force: true });
  }
  throw new Error(`precondição: não achei pasta fora das livres da trava (/tmp, /var/folders, ${realpathSync(tmpdir())}) para o HOME do teste; as candidatas foram ${candidatas.join(', ')}`);
}
const HOME_DO_TESTE = criarHomeDoTeste([join(RAIZ, '.tmp-testes'), userInfo().homedir], '.home-c14-');
after(() => rmSync(HOME_DO_TESTE, { recursive: true, force: true }));
process.env.HOME = HOME_DO_TESTE;
assert.ok(!CAI_NOS_LIVRES(realpathSync(HOME_DO_TESTE)), 'precondição: o HOME do teste está fora das livres da trava');

/** Mesma entrada sintética, três nomes, a trava de escrita. Devolve { nome: decisão }. */
function matriz(pastaHooks) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c14-'))); mkdirSync(join(base, 'ativas'));
  try {
    writeFileSync(join(base, 'subagente-pode-escrever.txt'), 'validador\n');
    const rodar = (hook, ev) => {
      const o = execFileSync('node', [join(pastaHooks, hook)], { input: JSON.stringify(ev), encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', env: { ...process.env, HOOKS_CREWAI_BASE: base, POOL_APP_SESSOES_DIR: join(base, 'sem-registro') } });
      return o ? JSON.parse(o) : null;
    };
    const dec = (r) => r?.decision ?? r?.hookSpecificOutput?.permissionDecision ?? 'passou';
    const fora = {};
    for (const tipo of NOMES) {
      fora[tipo] = dec(rodar('subagente-nao-edita.mjs', { session_id: 'S1', cwd: '/r', hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(homedir(), 'Developer', 'zz-c14', 'a.ts'), old_string: 'a', new_string: 'b' }, agent_id: 'a1', agent_type: tipo }));
    }
    return fora;
  } finally { rmSync(base, { recursive: true, force: true }); }
}

describe('c14 — nome do agente com e sem o prefixo do plugin', () => {
  it('validador e orquestracao:validador valem igual na lista de quem pode escrever; outro:validador não', () => {
    const m = matriz(HOOKS);
    assert.deepEqual(Object.keys(m), NOMES);
    assert.equal(m.validador, 'passou');
    assert.equal(m['orquestracao:validador'], 'passou');
    assert.equal(m['outro:validador'], 'deny');
  });
  it('mutante: sem a normalização do prefixo, orquestracao:validador deixa de casar com a lista (o teste enxerga)', () => {
    const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c14-mut-')));
    try {
      cpSync(HOOKS, join(tmp, 'hooks'), { recursive: true });
      // pool-comum importa o módulo das perguntas, vizinho da skill
      const scripts = join('skills', 'orquestradora', 'scripts', 'perguntas-arquivo.mjs');
      cpSync(join(RAIZ, 'plugins', 'orquestracao', scripts), join(tmp, scripts));
      const comum = join(tmp, 'hooks', 'hooks-crewai-comum.mjs');
      const antes = readFileSync(comum, 'utf8');
      assert.match(antes, /export const semPrefixoDoKit = /);
      writeFileSync(comum, antes.replace(/export const semPrefixoDoKit = .*/, 'export const semPrefixoDoKit = (nome) => String(nome ?? \'\');'));
      const m = matriz(join(tmp, 'hooks'));
      assert.equal(m.validador, 'passou');
      assert.equal(m['orquestracao:validador'], 'deny');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
  it('a skill papeis-e-modelos manda lançar o subagente com o nome do plugin (orquestracao:<papel>)', () => {
    const t = readFileSync(SKILL_PAPEIS, 'utf8');
    assert.ok(t.length > 1000);
    assert.match(t, /subagent_type: "orquestracao:validador" \| "orquestracao:explorador"/);
    assert.doesNotMatch(t, /subagent_type: "validador"/);
  });
});

// L1 (c15): na prosa das skills e do manual da dona o subagente do plugin é citado com o prefixo.
it('L1: skills e pool/ não citam subagente do plugin sem o prefixo orquestracao:', () => {
  const achar = (pasta) => execFileSync('find', [pasta, '-name', '*.md'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const arquivos = [...achar(join(RAIZ, 'plugins', 'orquestracao', 'skills')), ...achar(join(RAIZ, 'plugins', 'orquestracao', 'pool'))];
  assert.ok(arquivos.length >= 6, `poucos arquivos varridos: ${arquivos.length}`);
  const solto = /(\b(sub)?agentes?\s+`?|\b(um|o|a)\s+`)(validador|explorador|planejador|executor)(?![\w:-])/;
  const achados = arquivos.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => solto.test(l)).map(([a, n, l]) => `${a}:${n}: ${l.slice(0, 90)}`));
  assert.deepEqual(achados, []);
  // prova de que o detector pega: um texto com o nome solto é achado
  for (const caso of ['lança subagente `validador`', 'use o agente `validador`', 'o subagente validador revisa', 'um agente explorador', 'chame o `planejador`']) assert.ok(solto.test(caso), `o detector não pegou: ${caso}`);
  for (const caso of ['o agente `orquestracao:validador`', 'subagente orquestracao:executor', 'a skill `papeis-e-modelos`', 'o validador da dona']) assert.ok(!solto.test(caso), `o detector pegou sem dever: ${caso}`);
});
