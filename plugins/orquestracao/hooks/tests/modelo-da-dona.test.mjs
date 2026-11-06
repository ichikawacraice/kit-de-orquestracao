// ADR 0011: a escolha dos testes afetados (o teto de donas saiu no ADR 0033).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afetados, citacoesDe } from '../../skills/orquestradora/scripts/testes-afetados.mjs';

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
  const { skillsDaEtapa, ETAPAS } = await import('../../pool/skills-da-etapa.mjs');
  const protocolo = readFileSync(new URL('../../pool/protocolo.md', import.meta.url), 'utf8');
  const secao = protocolo.slice(protocolo.indexOf('<a id="skills-da-etapa"></a>'), protocolo.indexOf('<a id="modelo-e-esforco"></a>'));
  assert.ok(secao.length > 200, 'seção ausente');
  for (const etapa of ETAPAS) {
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

// F179: os textos que a dona e as outras sessões leem concordam na regra do título e no modelo da dona.
test('título da dona é `F<n> · <tema>` em todo texto que o diz; o resumo de início e o modelo de CLAUDE.md dizem o modelo da dona', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const plugin = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const ler = (...p) => readFileSync(join(...p), 'utf8');
  const textos = {
    dona: ler(plugin, 'pool', 'dona.md'),
    protocolo: ler(plugin, 'pool', 'protocolo.md'),
    orquestradora: ler(plugin, 'skills', 'orquestradora', 'SKILL.md'),
    papeis: ler(plugin, 'skills', 'papeis-e-modelos', 'SKILL.md'),
    resumo: ler(plugin, 'hooks', 'regras-globais.md'),
    modelo: ler(plugin, '..', '..', 'modelos', 'CLAUDE.md'),
  };
  for (const [nome, t] of Object.entries(textos)) {
    assert.ok(t.length > 500, `insumo vazio: ${nome}`);
    assert.ok(t.includes('`F<n> · <tema'), `${nome} não diz o título \`F<n> · <tema…>\``);
  }
  // A regra velha ("sem `F<n>`" no título da dona) sumiu; o que mede pegaria a frase de antes.
  const velha = /Título da sessão: o tema do item[^.]*sem `F<n>`/;
  assert.ok(velha.test('Título da sessão: o tema do item, sem `F<n>`.'), 'precondição: a regex pega a frase antiga');
  for (const nome of ['dona', 'protocolo', 'orquestradora']) assert.doesNotMatch(textos[nome], velha, nome);
  assert.doesNotMatch(textos.resumo, /executar plano pronto em Sonnet|O modelo sai do papel/);
  for (const frase of ['dona', 'orquestracao:validador', 'fila de merge', 'testes-afetados']) assert.ok(textos.resumo.includes(frase), `o resumo não diz "${frase}"`);
  for (const frase of ['dona', 'orquestracao:validador', 'fila de merge']) assert.ok(textos.modelo.includes(frase), `o modelo de CLAUDE.md não diz "${frase}"`);
  // Quem mantém o painel: a âncora existe no protocolo e a dona e a skill apontam para ela.
  assert.ok(textos.protocolo.includes('<a id="painel-em-dia"></a>') && textos.dona.includes('<a id="painel-em-dia"></a>'));
  assert.ok(textos.orquestradora.includes('protocolo.md#painel-em-dia'));
});
