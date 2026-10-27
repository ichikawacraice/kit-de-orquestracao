// ADR 0011: a chave do modelo (dona × papeis), o teto de donas e a escolha dos testes afetados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modeloDoKit, tetoDeDonas, donaTrabalhando } from '../modelo-do-kit.mjs';
import { afetados, citacoesDe } from '../../skills/orquestradora/scripts/testes-afetados.mjs';

test('o modelo é dona por padrão; KIT_MODELO e modelo.json voltam ao pool; valor estranho é dona', () => {
  const base = mkdtempSync(join(tmpdir(), 'modelo-'));
  try {
    assert.equal(modeloDoKit({ HOOKS_CREWAI_BASE: base }), 'dona');
    assert.equal(modeloDoKit({ HOOKS_CREWAI_BASE: base, KIT_MODELO: 'papeis' }), 'papeis');
    assert.equal(modeloDoKit({ HOOKS_CREWAI_BASE: base, KIT_MODELO: 'xyz' }), 'dona');
    writeFileSync(join(base, 'modelo.json'), '{"modelo":"papeis"}');
    assert.equal(modeloDoKit({ HOOKS_CREWAI_BASE: base }), 'papeis');
    assert.equal(modeloDoKit({ HOOKS_CREWAI_BASE: base, KIT_MODELO: 'dona' }), 'dona', 'o ambiente vence o arquivo');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('teto de donas: padrão 4, KIT_TETO_DE_DONAS troca; donaTrabalhando só conta item da dona em etapa de trabalho', () => {
  assert.equal(tetoDeDonas({}), 4);
  assert.equal(tetoDeDonas({ KIT_TETO_DE_DONAS: '3' }), 3);
  assert.equal(tetoDeDonas({ KIT_TETO_DE_DONAS: '0' }), 4);
  assert.equal(donaTrabalhando({ via: 'dona', etapa: 'execucao', donoLocalId: 'local_x' }), true);
  assert.equal(donaTrabalhando({ via: 'dona', etapa: 'merge', donoLocalId: 'local_x' }), false, 'merge não conta');
  assert.equal(donaTrabalhando({ etapa: 'execucao', donoLocalId: 'local_x' }), false, 'item do pool não conta');
  assert.equal(donaTrabalhando({ via: 'dona', etapa: 'planejamento', com: [] }), false, 'sem ninguém não conta');
});

test('testes afetados: o teste tocado, o que cita o arquivo, o que cita um dependente; o resto fica de fora', () => {
  const arquivos = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs', 'doc/x.md', 't/a.test.mjs', 't/b.test.mjs', 't/c.test.mjs', 't/x.test.mjs', 't/novo.test.mjs'];
  const texto = {
    'src/b.mjs': "import { a } from './a.mjs';",
    't/a.test.mjs': "import '../src/a';",
    't/b.test.mjs': "import '../src/b.mjs';",
    't/c.test.mjs': "import '../src/c.mjs';",
    't/x.test.mjs': "readFileSync(join(RAIZ, 'doc', 'x.md'))",
  };
  const conteudo = (f) => texto[f] ?? '';
  assert.ok(Object.keys(texto).length > 0 && citacoesDe('src/a.mjs').includes("/a'"));
  const r = afetados({ arquivos, conteudo, mudados: ['src/a.mjs', 'doc/x.md', 't/novo.test.mjs'] });
  assert.deepEqual(r.dependentes, ['src/b.mjs']);
  assert.deepEqual(r.testes, ['t/a.test.mjs', 't/b.test.mjs', 't/x.test.mjs', 't/novo.test.mjs']);
  // a ausência é medível: tocar c.mjs traz o c.test
  assert.deepEqual(afetados({ arquivos, conteudo, mudados: ['src/c.mjs'] }).testes, ['t/c.test.mjs']);
});

test('skills por etapa: as fixas da tabela do protocolo estão na lista do script', async () => {
  const { readFileSync } = await import('node:fs');
  const { skillsDaEtapa, COLUNA_DA_ETAPA } = await import('../../pool/skills-da-etapa.mjs');
  const protocolo = readFileSync(new URL('../../pool/protocolo.md', import.meta.url), 'utf8');
  const secao = protocolo.slice(protocolo.indexOf('<a id="skills-da-etapa"></a>'), protocolo.indexOf('<a id="modelo-e-esforco"></a>'));
  assert.ok(secao.length > 200, 'seção ausente');
  for (const etapa of Object.keys(COLUNA_DA_ETAPA)) {
    const lista = skillsDaEtapa(etapa);
    assert.ok(lista.length > 3, `${etapa}: lista vazia`);
    const linha = secao.split('\n').find((l) => l.startsWith(`| \`${etapa}\``));
    assert.ok(linha, `sem linha para ${etapa}`);
    const fixas = [...linha.split('|')[2].replace(/\([^)]*\)/g, '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.ok(fixas.length > 0, `${etapa}: sem fixa`);
    for (const f of fixas) assert.ok(lista.includes(f), `${etapa}: ${f} não está em skills-da-etapa`);
  }
  assert.throws(() => skillsDaEtapa('merge'), /não é/);
});
