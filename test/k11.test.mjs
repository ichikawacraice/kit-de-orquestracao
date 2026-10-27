import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, appendFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(RAIZ, 'plugins', 'processos');
const SKILLS = ['spec-driven', 'revisar-diff', 'auditoria-de-clique'];
const ARQUIVOS = [...SKILLS.map((s) => `skills/${s}/SKILL.md`), 'workflows/revisao-do-diff.js'];
const PROIBIDAS = /Izanagi|Wake|VTEX|apps\/web|packages\/shared|useAposta|decidirGesto|pnpm/;
const ler = (f, base = PLUGIN) => readFileSync(join(base, f), 'utf8');
const frontmatter = (t) => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(t);
  if (!m) return null;
  return Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
};

describe('plugin processos (K11)', () => {
  test('plugin.json: nome, versão semver e descrição', () => {
    const p = JSON.parse(ler('.claude-plugin/plugin.json'));
    assert.equal(p.name, 'processos');
    assert.match(p.version, /^\d+\.\d+\.\d+$/);
    assert.ok(p.description.length > 20);
  });

  test('marketplace lista o plugin com a fonte certa', () => {
    const m = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin/marketplace.json'), 'utf8'));
    const e = m.plugins.find((x) => x.name === 'processos');
    assert.ok(e, 'processos fora do marketplace');
    assert.equal(e.source, './plugins/processos');
    assert.ok(existsSync(join(RAIZ, e.source, '.claude-plugin/plugin.json')));
  });

  for (const s of SKILLS) {
    test(`${s}: frontmatter com name e description, corpo não vazio`, () => {
      const t = ler(`skills/${s}/SKILL.md`);
      const fm = frontmatter(t);
      assert.ok(fm, 'sem frontmatter');
      assert.equal(fm.name, s);
      assert.ok(fm.description, 'sem description');
      assert.ok(fm.description.length > 80, `description curta (${fm.description.length})`);
      assert.ok(t.split('\n').length > 30, 'corpo curto demais');
    });
  }

  for (const f of ARQUIVOS) {
    test(`${f}: não cita o produto de origem`, () => {
      const t = ler(f);
      assert.ok(t.trim().length > 200);
      assert.equal(PROIBIDAS.exec(t), null, `cita ${PROIBIDAS.exec(t)?.[0]}`);
    });
  }

  test('o detector enxerga a palavra proibida numa cópia mutada', () => {
    const base = mkdtempSync(join(tmpdir(), 'kit-k11-'));
    try {
      mkdirSync(join(base, 'skills/spec-driven'), { recursive: true });
      copyFileSync(join(PLUGIN, 'skills/spec-driven/SKILL.md'), join(base, 'skills/spec-driven/SKILL.md'));
      assert.equal(PROIBIDAS.exec(ler('skills/spec-driven/SKILL.md', base)), null);
      appendFileSync(join(base, 'skills/spec-driven/SKILL.md'), '\nver apps/web\n');
      assert.ok(PROIBIDAS.exec(ler('skills/spec-driven/SKILL.md', base)));
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('spec-driven lê os caminhos do kit.json, com os padrões da A2 e o vocabulário fechado', () => {
    const t = ler('skills/spec-driven/SKILL.md');
    assert.match(t, /\.claude\/kit\.json/);
    for (const k of ['adr', 'specs', 'roadmap', 'diario']) assert.ok(t.includes(`documentos.${k}`), `falta documentos.${k}`);
    for (const p of ['docs/adr', 'docs/specs', 'docs/roadmap.md', 'docs/diario']) assert.ok(t.includes(p), `falta o padrão ${p}`);
    assert.match(t, /Rascunho.*Em revisão.*Aprovada.*Implementada.*Substituída/s);
    assert.ok(t.includes('Alternativas consideradas'));
    assert.ok(t.includes('scripts/kit/as-docs-concordam.mjs'));
    assert.ok(!t.includes('specs-lifecycle'));
  });

  test('revisar-diff usa guarda.tronco como base e chama o workflow do plugin', () => {
    const t = ler('skills/revisar-diff/SKILL.md');
    assert.ok(t.includes('guarda.tronco'));
    assert.ok(t.includes('revisao-do-diff'));
    assert.ok(t.includes('${CLAUDE_PLUGIN_ROOT}/workflows/revisao-do-diff.js') || t.includes('processos:revisao-do-diff'));
    assert.ok(!t.includes('origin/develop'));
    assert.ok(!t.includes('com `origin/` na frente'), 'guarda.tronco já traz o remoto');
    assert.match(t, /guarda\.tronco[^\n]*como está/);
  });

  test('o workflow troca a dimensão do produto pela do CLAUDE.md do projeto', () => {
    const t = ler('workflows/revisao-do-diff.js');
    assert.ok(t.includes("name: 'revisao-do-diff'"));
    assert.ok(t.includes('convenções do `CLAUDE.md` do projeto'));
    assert.ok(!t.includes("?? 'origin/develop'"));
  });

  test('o workflow é JavaScript válido (corpo de função assíncrona)', () => {
    const src = ler('workflows/revisao-do-diff.js').replace(/^export const meta =/m, 'const meta =');
    assert.doesNotThrow(() => new Function('args', 'agent', 'parallel', 'phase', 'log', `return (async () => {${src}})`));
  });

  test('o gate só reprova quando a regra está ligada (documentos.conferir) e a spec-driven cita as chaves de ajuste', () => {
    const sd = ler('skills/spec-driven/SKILL.md');
    const wf = ler('workflows/revisao-do-diff.js');
    for (const [nome, t] of [['spec-driven', sd], ['workflow', wf]]) {
      const frases = t.split('\n').filter((l) => /(gate|suíte do projeto)[^.]*reprov/.test(l));
      assert.ok(frases.length > 0, `${nome}: sem frase sobre o gate reprovar`);
      for (const l of frases) assert.ok(l.includes('documentos.conferir'), `${nome}: reprova sem condicionar a documentos.conferir`);
    }
    for (const k of ['documentos.estados', 'documentos.orcamentos', 'documentos.docs']) assert.ok(sd.includes(k), `falta ${k}`);
  });

  test('a asserção de description falha pela asserção quando a description some (mutação)', () => {
    const t = ler('skills/spec-driven/SKILL.md').replace(/^description:.*\n/m, '');
    const fm = frontmatter(t);
    assert.ok(fm);
    assert.throws(() => assert.ok(fm.description, 'sem description'), /sem description/);
  });

  test('auditoria-de-clique traz o mapa do gesto e o laudo', () => {
    const t = ler('skills/auditoria-de-clique/SKILL.md');
    assert.ok(t.includes('GESTO:'));
    assert.ok(t.includes('CLIQUE-NN'));
    assert.ok(t.includes('Procedência'));
  });
});
