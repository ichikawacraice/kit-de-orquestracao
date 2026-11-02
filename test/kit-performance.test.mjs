// F343: o plugin opcional de performance. O catálogo de práticas concorda com as skills (cada id tem a seção dele na skill da
// camada), o revisor só lê, o marketplace o lista e o `kit iniciar` não o liga; o `kit doutor` confere a seção `performance`
// do kit.json contra o catálogo. Tudo em pasta temporária; HOME e a base da orquestração também são temporários.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirPerformance, lerPraticas } from '../cli/performance.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(RAIZ, 'plugins', 'kit-performance');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const ID = 'kit-performance@kit-de-orquestracao';
const ler = (...p) => readFileSync(join(...p), 'utf8');
const catalogo = JSON.parse(ler(PLUGIN, 'praticas.json'));
const frente = (texto) => (texto.match(/^---\n([\s\S]*?)\n---\n/) ?? [])[1] ?? '';

describe('o catálogo de práticas concorda com as skills', () => {
  it('31 práticas, ids únicos, camada e tipo conhecidos', () => {
    const ids = catalogo.praticas.map((p) => p.id);
    assert.equal(ids.length, 31);
    assert.equal(new Set(ids).size, ids.length, 'id repetido');
    for (const p of catalogo.praticas) {
      assert.ok(p.camada in catalogo.camadas, `${p.id}: camada ${p.camada}`);
      assert.ok(['regra', 'decisao'].includes(p.tipo), `${p.id}: tipo ${p.tipo}`);
      assert.ok(p.titulo?.length > 0, `${p.id} sem título`);
    }
    // a infra que é decisão, não regra
    assert.deepEqual(catalogo.praticas.filter((p) => p.tipo === 'decisao').map((p) => p.id).sort(), ['cache-de-dados', 'load-balancing', 'servidor-perto-do-banco']);
  });

  it('cada camada tem a skill dela, e cada prática tem a âncora na skill da camada e em nenhuma outra', () => {
    const skills = readdirSync(join(PLUGIN, 'skills')).sort();
    assert.deepEqual(Object.values(catalogo.camadas).map((c) => c.skill).sort(), skills);
    const texto = Object.fromEntries(skills.map((s) => [s, ler(PLUGIN, 'skills', s, 'SKILL.md')]));
    assert.ok(Object.values(texto).every((t) => t.length > 500), 'skill vazia');
    // o detector de âncora acha uma que existe antes de medir a ausência
    assert.ok(texto['performance-front'].includes('<a id="skeleton"></a>'));
    for (const p of catalogo.praticas) {
      const dona = catalogo.camadas[p.camada].skill;
      assert.ok(texto[dona].includes(`<a id="${p.id}"></a>`), `${p.id} sem seção em ${dona}`);
      for (const s of skills.filter((s) => s !== dona)) assert.ok(!texto[s].includes(`<a id="${p.id}"></a>`), `${p.id} também em ${s}`);
    }
    // e a skill não tem âncora de prática fora do catálogo
    const ids = new Set(catalogo.praticas.map((p) => p.id));
    const sobra = Object.values(texto).flatMap((t) => [...t.matchAll(/<a id="([\w-]+)"><\/a>/g)].map((m) => m[1])).filter((a) => !ids.has(a));
    assert.deepEqual(sobra, []);
  });

  it('cada prática de regra diz quando vale e quando não vale; cada skill tem nome e descrição', () => {
    for (const [s] of Object.entries(catalogo.camadas).map(([, c]) => [c.skill])) {
      const t = ler(PLUGIN, 'skills', s, 'SKILL.md');
      assert.match(frente(t), new RegExp(`^name: ${s}$`, 'm'));
      assert.match(frente(t), /^description: .{80,}/m);
    }
    for (const p of catalogo.praticas.filter((x) => x.tipo === 'regra')) {
      const t = ler(PLUGIN, 'skills', catalogo.camadas[p.camada].skill, 'SKILL.md');
      const secao = t.split(`<a id="${p.id}"></a>`)[1].split('<a id=')[0];
      assert.match(secao, /\*\*Vale:\*\*/, `${p.id} sem Vale`);
      assert.match(secao, /\*\*Não vale:\*\*/, `${p.id} sem Não vale`);
    }
  });

  it('o revisor só lê, carrega as quatro skills e cita o catálogo', () => {
    const t = ler(PLUGIN, 'agents', 'revisor-de-performance.md');
    const f = frente(t);
    assert.match(f, /^name: revisor-de-performance$/m);
    const tools = (f.match(/^tools: (.*)$/m) ?? [])[1];
    assert.ok(tools, 'sem tools');
    assert.deepEqual(tools.split(/,\s*/).filter((x) => /Edit|Write|NotebookEdit/.test(x)), []);
    for (const c of Object.values(catalogo.camadas)) assert.match(f, new RegExp(`^  - ${c.skill}$`, 'm'));
    assert.ok(t.includes('praticas.json'));
  });
});

describe('o plugin no marketplace e no kit', () => {
  it('o marketplace lista o kit-performance com a pasta e o manifesto certos', () => {
    const m = JSON.parse(ler(RAIZ, '.claude-plugin', 'marketplace.json'));
    const e = m.plugins.find((p) => p.name === 'kit-performance');
    assert.ok(e, 'fora do marketplace');
    assert.equal(e.source, './plugins/kit-performance');
    const pj = JSON.parse(ler(PLUGIN, '.claude-plugin', 'plugin.json'));
    assert.equal(pj.name, 'kit-performance');
    assert.equal(pj.dependencies, undefined, 'o plugin é opcional e não depende de outro');
  });

  it('kit iniciar não liga o kit-performance (opcional) e liga os outros', () => {
    const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f343-casa-')));
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f343-')));
    execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
    const r = spawnSync('node', [KIT, 'iniciar'], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: casa, CI: '' } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const s = JSON.parse(ler(d, '.claude', 'settings.json'));
    assert.equal(s.enabledPlugins['processos@kit-de-orquestracao'], true, 'precondição: o iniciar liga plugins');
    assert.ok(!(ID in s.enabledPlugins));
  });
});

describe('kit doutor: a seção performance', () => {
  const praticas = lerPraticas();
  it('lê o catálogo do plugin', () => assert.equal(praticas.ids.size, 31));

  it('sem a seção, nada a dizer', () => {
    assert.deepEqual(conferirPerformance({}, true, praticas), []);
    assert.deepEqual(conferirPerformance({}, undefined, praticas), []);
  });

  it('seção válida com o plugin ligado: nada a dizer', () => {
    const kj = { performance: { naoSeAplica: { 'virtualizar-listas': 'listas curtas por regra' }, orcamento: { lcpMs: 2000, cls: 0.05 } } };
    assert.deepEqual(conferirPerformance(kj, true, praticas), []);
  });

  it('plugin desligado com a seção: avisa que o kit.json não o religa', () => {
    const l = conferirPerformance({ performance: {} }, false, praticas);
    assert.equal(l.length, 1);
    assert.match(l[0], /^aviso: plugin kit-performance desligado.*não o religa/);
  });

  it('plugin em nenhuma camada com a seção: avisa', () => {
    assert.match(conferirPerformance({ performance: {} }, undefined, praticas).join('\n'), /^aviso: .*seção performance.*kit-performance não está ligado/m);
  });

  it('id fora do catálogo, motivo vazio e orçamento inválido viram aviso, um por defeito', () => {
    const kj = { performance: { naoSeAplica: { redis: 'não usamos', indices: '' }, orcamento: { lcpMs: -1, ttfb: 800 } } };
    const l = conferirPerformance(kj, true, praticas);
    const t = l.join('\n');
    assert.match(t, /naoSeAplica.*"redis".*não é uma prática/);
    assert.match(t, /naoSeAplica\.indices sem motivo/);
    assert.match(t, /orcamento\.lcpMs.*número maior que zero/);
    assert.match(t, /orcamento\.ttfb.*não existe/);
    assert.equal(l.length, 4, t);
    assert.ok(l.every((x) => x.startsWith('aviso: ')));
  });

  it('seção ou chave com tipo errado: aviso, sem quebrar', () => {
    assert.match(conferirPerformance({ performance: [] }, true, praticas).join(), /performance precisa ser um objeto/);
    assert.match(conferirPerformance({ performance: { naoSeAplica: ['x'] } }, true, praticas).join(), /naoSeAplica precisa ser um objeto/);
    assert.match(conferirPerformance({ performance: { orcamento: 3 } }, true, praticas).join(), /orcamento precisa ser um objeto/);
  });

  it('o kit doutor de um projeto mostra o aviso', () => {
    const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f343-casa-')));
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f343-')));
    execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
    const env = { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: casa, CI: '' };
    assert.equal(spawnSync('node', [KIT, 'iniciar'], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env }).status, 0);
    const kj = JSON.parse(ler(d, '.claude', 'kit.json'));
    kj.performance = { naoSeAplica: { redis: 'x' } };
    writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj));
    const s = JSON.parse(ler(d, '.claude', 'settings.json'));
    s.enabledPlugins[ID] = true;
    writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify(s));
    const out = spawnSync('node', [KIT, 'doutor'], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env }).stdout;
    assert.match(out, /aviso: performance\.naoSeAplica: "redis" não é uma prática/);
  });
});
