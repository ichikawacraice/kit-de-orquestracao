// K14: o CLI liga tudo (modelos de documento, os plugins processos e design, --design e o Impeccable), remove, atualiza e o doutor avisa.
// Tudo em pasta temporária com `git init`; HOME, a trava do gate e a base da orquestração também são temporários.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// F438 (ADR 0030): a casa do teste é a temporária; o CLAUDE_CONFIG_DIR de quem roda (o perfil do Orca) não vale aqui, nem nos filhos.
delete process.env.CLAUDE_CONFIG_DIR;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const MKT = 'ichikawa-kit';

const temporarios = [];
const nova = (prefixo) => { const d = realpathSync(mkdtempSync(join(tmpdir(), prefixo))); temporarios.push(d); return d; };
function projeto() { const d = nova('kit-k14-'); execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' }); return d; }
const casa = nova('kit-k14-casa-');
const base = nova('kit-k14-base-');
const kit = (cwd, ...args) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: base, CI: '' } });
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const escrever = (d, rel, texto) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), texto); };
/** Todos os arquivos de uma pasta → { caminho relativo: sha256 }. */
function hashes(dir) {
  const saida = {};
  const varrer = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const c = join(d, e.name); if (e.isDirectory()) varrer(c); else saida[relative(dir, c)] = sha(readFileSync(c, 'utf8')); } };
  if (existsSync(dir)) varrer(dir);
  return saida;
}
const modelos = (sub) => Object.keys(hashes(join(RAIZ, 'modelos', sub))).sort();

describe('kit iniciar liga os processos', () => {
  it('cria os modelos de documento, liga processos e design, escreve os caminhos e NÃO escreve documentos.conferir', () => {
    const d = projeto();
    const r = kit(d, 'iniciar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const esperados = modelos('docs');
    assert.ok(esperados.length >= 7, 'insumo vazio: modelos/docs sem arquivo');
    for (const f of esperados) assert.equal(ler(d, 'docs', f), ler(RAIZ, 'modelos', 'docs', f), `docs/${f} difere do modelo`);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[`processos@${MKT}`], true);
    assert.equal(s.enabledPlugins[`design-system@${MKT}`], true);
    assert.equal(s.enabledPlugins[`orquestracao@${MKT}`], true);
    const k = json(d, '.claude/kit.json');
    assert.deepEqual(Object.keys(k.documentos).sort(), ['adr', 'diario', 'docs', 'estados', 'orcamentos', 'planos', 'research', 'roadmap', 'specs']);
    assert.equal(k.documentos.adr, 'docs/adr');
    assert.ok(!('conferir' in k.documentos), 'o conferir ausente é o que liga as cinco regras pelo plugin');
    assert.equal(k.design.revisoes, 'docs/design/revisoes');
    assert.ok(!('pasta' in k.design), 'sem --design a seção fica sem pasta');
    assert.ok(!('largura' in k.design), 'largura no kit.json venceria a opção do plugin');
    assert.ok(!existsSync(join(d, 'apps')), 'sem --design não há front');
    const lock = json(d, '.claude/kit.lock.json');
    for (const f of esperados) assert.equal(lock.arquivos[`docs/${f}`], sha(ler(RAIZ, 'modelos', 'docs', f)), `o lock não registra docs/${f}`);
    assert.ok(!JSON.stringify(s).includes('impeccable'), 'sem --design o Impeccable não entra');
  });

  it('--design web cria os modelos de front só onde não existem, grava design.pasta e declara o Impeccable', () => {
    const d = projeto();
    escrever(d, 'web/DESIGN.md', '# o meu\n'); // já existe: fica
    const antes = sha(ler(d, 'web/DESIGN.md'));
    const r = kit(d, 'iniciar', '--design', 'web');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(sha(ler(d, 'web/DESIGN.md')), antes, 'o DESIGN.md que existia foi tocado');
    for (const f of ['PRODUCT.md', 'ANATOMIA.md']) assert.equal(ler(d, 'web', f), ler(RAIZ, 'modelos', 'front', f));
    const k = json(d, '.claude/kit.json');
    assert.equal(k.design.pasta, 'web');
    assert.deepEqual(k.design.fontes, ['web/PRODUCT.md', 'web/ANATOMIA.md', 'web/DESIGN.md']);
    const s = json(d, '.claude/settings.json');
    assert.deepEqual(s.extraKnownMarketplaces.impeccable, { source: { source: 'github', repo: 'pbakaus/impeccable' } });
    assert.equal(s.enabledPlugins['impeccable@impeccable'], true);
    assert.equal(s.env.IMPECCABLE_NO_TELEMETRY, '1');
    assert.equal(s.env.IMPECCABLE_NO_UPDATE_CHECK, '1');
    const lock = json(d, '.claude/kit.lock.json');
    assert.ok(lock.arquivos['web/PRODUCT.md'] && lock.arquivos['web/ANATOMIA.md']);
    assert.ok(!('web/DESIGN.md' in lock.arquivos), 'arquivo que já existia não é do kit');
    assert.equal(lock.design, 'web');
  });

  it('--design recusa pasta absoluta, com .. ou sem valor', () => {
    const d = projeto();
    for (const ruim of ['/tmp/x', '../fora', 'a/../b']) {
      const r = kit(d, 'iniciar', '--design', ruim);
      assert.equal(r.status, 2, ruim);
      assert.match(r.stderr, /--design/);
    }
    const r = kit(d, 'iniciar', '--design');
    assert.equal(r.status, 2);
    assert.ok(!existsSync(join(d, 'CLAUDE.md')), 'recusou, então nada foi gravado');
  });
});

describe('kit adotar liga os processos sem tocar no que existe', () => {
  function comAdrProprio() {
    const d = projeto();
    escrever(d, 'CLAUDE.md', '# meu\n');
    escrever(d, 'package.json', '{"name":"x","scripts":{"test":"node --test"}}\n');
    escrever(d, 'docs/adr/0001-uma.md', '# 1\n\nTexto.\n');
    escrever(d, 'docs/adr/0002-duas.md', '# 2\n');
    return d;
  }

  it('docs/adr existente não muda um byte; as outras pastas de modelo entram; avisa das regras e onde desligar', () => {
    const d = comAdrProprio();
    const antes = hashes(join(d, 'docs/adr'));
    assert.equal(Object.keys(antes).length, 2);
    const r = kit(d, 'adotar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(hashes(join(d, 'docs/adr')), antes, 'docs/adr foi tocado');
    assert.ok(existsSync(join(d, 'docs/specs/README.md')), 'a pasta que faltava recebe o modelo');
    assert.match(r.stdout, /podem reprovar o primeiro gate/);
    assert.match(r.stdout, /\/plugin do terminal/);
    assert.doesNotMatch(r.stdout, /aba de plugins/, 'o app desktop não mostra as opções do plugin');
    assert.match(r.stdout, /documentos\.conferir/);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[`processos@${MKT}`], true);
    assert.equal(s.enabledPlugins[`design-system@${MKT}`], true);
    assert.ok(!('conferir' in json(d, '.claude/kit.json').documentos));
    assert.ok(!JSON.stringify(s).includes('impeccable'));
    assert.ok(!json(d, '.claude/kit.json').design.pasta);
  });

  it('o kit.json do projeto com outro caminho de documento não vira conflito: o do projeto vale', () => {
    const d = comAdrProprio();
    escrever(d, '.claude/kit.json', JSON.stringify({ documentos: { adr: 'docs/decisoes' } }));
    const r = kit(d, 'adotar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(json(d, '.claude/kit.json').documentos.adr, 'docs/decisoes');
    assert.equal(json(d, '.claude/kit.json').documentos.specs, 'docs/specs');
  });

  it('--design em adotar liga o Impeccable; sem ele, nada', () => {
    const d = comAdrProprio();
    assert.equal(kit(d, 'adotar', '--design', 'apps/web').status, 0);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins['impeccable@impeccable'], true);
    assert.equal(json(d, '.claude/kit.json').design.pasta, 'apps/web');
    assert.ok(existsSync(join(d, 'apps/web/PRODUCT.md')));
  });
});

describe('kit remover desfaz o que o K14 pôs', () => {
  it('apaga só o que o hash diz intacto, desliga os plugins e tira o Impeccable', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar', '--design', 'web').status, 0);
    escrever(d, 'docs/roadmap.md', `${ler(d, 'docs/roadmap.md')}\n- [ ] meu item\n`); // mexido: fica
    const r = kit(d, 'remover');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(existsSync(join(d, 'docs/roadmap.md')), 'o roadmap que o projeto editou foi apagado');
    assert.match(r.stdout, /deixado \(mexido\): docs\/roadmap\.md/);
    for (const f of ['docs/adr/README.md', 'docs/specs/README.md', 'web/PRODUCT.md', 'web/DESIGN.md', 'web/ANATOMIA.md']) assert.ok(!existsSync(join(d, f)), `${f} devia ter saído`);
    assert.ok(!existsSync(join(d, 'web')), 'a pasta que o kit criou e ficou vazia sai');
    assert.ok(!existsSync(join(d, 'docs/adr')));
    assert.ok(!existsSync(join(d, '.claude/settings.json')), 'o settings era só do kit');
  });

  it('num settings do projeto, tira os plugins e o Impeccable e deixa o resto', () => {
    const d = projeto();
    escrever(d, 'CLAUDE.md', '# meu\n');
    escrever(d, '.claude/settings.json', JSON.stringify({ env: { MINHA: '1' }, enabledPlugins: { 'outro@x': true } }));
    assert.equal(kit(d, 'adotar', '--design', 'web').status, 0);
    const meio = json(d, '.claude/settings.json');
    assert.equal(meio.env.MINHA, '1');
    assert.equal(meio.env.IMPECCABLE_NO_TELEMETRY, '1');
    assert.equal(kit(d, 'remover').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.deepEqual(s, { env: { MINHA: '1' }, enabledPlugins: { 'outro@x': true } });
  });

  it('o env que o projeto mudou depois não é tocado', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar', '--design', 'web').status, 0);
    const s = json(d, '.claude/settings.json');
    s.env.IMPECCABLE_NO_TELEMETRY = '0';
    escrever(d, '.claude/settings.json', JSON.stringify(s));
    const r = kit(d, 'remover');
    assert.match(r.stdout, /deixado \(mexido\): .*IMPECCABLE_NO_TELEMETRY/);
    assert.equal(json(d, '.claude/settings.json').env.IMPECCABLE_NO_TELEMETRY, '0');
  });
});

describe('kit atualizar e a ordem dos blocos', () => {
  const ordemDosBlocos = (t) => [...t.matchAll(/<!-- kit:([a-z-]+) v\d+ -->/g)].map((m) => m[1]);

  it('o iniciar põe os blocos na ordem do modelo (documentos e design antes de convencoes-de-teste)', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const modelo = ordemDosBlocos(ler(RAIZ, 'modelos/CLAUDE.md'));
    assert.ok(modelo.indexOf('documentos') > 0 && modelo.indexOf('documentos') < modelo.indexOf('convencoes-de-teste'));
    assert.deepEqual(ordemDosBlocos(ler(d, 'CLAUDE.md')), modelo);
  });

  it('o atualizar acrescenta documentos e design na mesma ordem do iniciar, não no fim', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const modelo = ordemDosBlocos(ler(RAIZ, 'modelos/CLAUDE.md'));
    // projeto instalado antes do K10: sem os dois blocos (nem no CLAUDE.md nem no lock)
    let claude = ler(d, 'CLAUDE.md');
    for (const n of ['documentos', 'design']) claude = claude.replace(new RegExp(`\\n?<!-- kit:${n} v\\d+ -->[\\s\\S]*?<!-- /kit:${n} -->\\n?`), '\n');
    escrever(d, 'CLAUDE.md', claude);
    const lock = json(d, '.claude/kit.lock.json');
    delete lock.blocos.documentos; delete lock.blocos.design;
    escrever(d, '.claude/kit.lock.json', JSON.stringify(lock));
    assert.ok(!ordemDosBlocos(ler(d, 'CLAUDE.md')).includes('documentos'), 'precondição: o bloco saiu');
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(ordemDosBlocos(ler(d, 'CLAUDE.md')), modelo);
  });
});

describe('kit doutor sobre os processos', () => {
  const lerSettings = (d) => json(d, '.claude/settings.json');
  const salvar = (d, s) => escrever(d, '.claude/settings.json', JSON.stringify(s, null, 2));

  it('acusa design sem pasta (a guarda fica inerte)', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const r = kit(d, 'doutor');
    assert.match(r.stdout, /design: sem design\.pasta/);
  });

  it('com a pasta e os arquivos de design, não acusa; pasta sem PRODUCT.md/DESIGN.md acusa', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar', '--design', 'web').status, 0);
    const bom = kit(d, 'doutor');
    assert.doesNotMatch(bom.stdout, /sem design\.pasta/);
    assert.doesNotMatch(bom.stdout, /PRODUCT\.md/);
    rmSync(join(d, 'web/PRODUCT.md'));
    assert.match(kit(d, 'doutor').stdout, /web\/PRODUCT\.md/);
  });

  it('recomenda o Impeccable quando há design e ele não está ligado', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar', '--design', 'web').status, 0);
    assert.doesNotMatch(kit(d, 'doutor').stdout, /Impeccable.*recomend|recomend.*Impeccable/i);
    const s = lerSettings(d); delete s.enabledPlugins['impeccable@impeccable']; salvar(d, s);
    assert.match(kit(d, 'doutor').stdout, /Impeccable/);
    assert.match(kit(d, 'doutor').stdout, /--design|enabledPlugins/);
  });

  it('plugin desligado com a seção do kit.json presente avisa que o arquivo não o religa; e o inverso', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    assert.doesNotMatch(kit(d, 'doutor').stdout, /desligado/);
    const s = lerSettings(d); s.enabledPlugins[`processos@${MKT}`] = false; salvar(d, s);
    assert.match(kit(d, 'doutor').stdout, /processos.*desligado.*kit\.json não o religa/);
    const k = json(d, '.claude/kit.json'); delete k.documentos; escrever(d, '.claude/kit.json', JSON.stringify(k));
    assert.match(kit(d, 'doutor').stdout, /processos.*desligado/);
    // o inverso: plugin ligado e sem a seção no kit.json
    const s2 = lerSettings(d); s2.enabledPlugins[`processos@${MKT}`] = true; salvar(d, s2);
    assert.match(kit(d, 'doutor').stdout, /processos.*ligado.*sem a seção documentos/);
  });

  it('lista onde o kit.json sobrepõe uma opção do plugin', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar', '--design', 'web').status, 0);
    assert.doesNotMatch(kit(d, 'doutor').stdout, /sobrepõe/);
    const k = json(d, '.claude/kit.json');
    k.documentos.conferir = ['status-da-spec'];
    k.design.largura = 1440;
    escrever(d, '.claude/kit.json', JSON.stringify(k));
    const r = kit(d, 'doutor').stdout;
    assert.match(r, /kit\.json sobrepõe a opção do plugin.*conferir_indice_de_adr/);
    assert.match(r, /kit\.json sobrepõe a opção do plugin.*largura/);
  });
});

describe('o padrão do tronco é o mesmo no gate e nas skills do processos', () => {
  it('gate/config.mjs, guarda de operação, a skill e o workflow da revisar-diff caem em origin/main', async () => {
    const { carregarConfig } = await import('../gate/config.mjs');
    const tronco = carregarConfig('/x', {}, { home: casa }).guarda.tronco;
    assert.equal(tronco, 'origin/main');
    assert.match(readFileSync(join(RAIZ, 'gate/guarda-de-operacao.mjs'), 'utf8'), /TRONCO_PADRAO = "origin\/main"/);
    assert.ok(readFileSync(join(RAIZ, 'plugins/processos/skills/revisar-diff/SKILL.md'), 'utf8').includes(`sem essa chave, \`${tronco}\``));
    assert.ok(readFileSync(join(RAIZ, 'plugins/processos/workflows/revisao-do-diff.js'), 'utf8').includes(`entrada.base ?? '${tronco}'`));
  });
});

describe('o README do gate diz a regra nova do documentos.conferir', () => {
  it('não afirma mais que sem a chave o gate não confere nada', () => {
    const t = readFileSync(join(RAIZ, 'gate/README.md'), 'utf8');
    assert.ok(t.length > 0);
    assert.ok(!/gate não confere nada/.test(t));
    assert.match(t, /opções `conferir_\*` do plugin `processos`/);
    assert.match(t, /scripts\/kit\/as-docs-concordam\.mjs/);
  });
});

describe('V2 M1 — projeto instalado antes dos processos: o atualizar e o doutor avisam das regras ligadas', () => {
  /** Um projeto "antigo": adotado, depois sem o que o K14 pôs (plugins, seções do kit.json), com docs/adr fora do índice. */
  function projetoAntigo() {
    const d = projeto();
    escrever(d, 'CLAUDE.md', '# meu\n');
    escrever(d, 'package.json', '{"name":"x","scripts":{"test":"node --test"}}\n');
    escrever(d, 'docs/adr/0001-x.md', '# 1\n');
    assert.equal(kit(d, 'adotar').status, 0);
    const s = json(d, '.claude/settings.json');
    delete s.enabledPlugins[`processos@${MKT}`]; delete s.enabledPlugins[`design-system@${MKT}`];
    escrever(d, '.claude/settings.json', JSON.stringify(s));
    const k = json(d, '.claude/kit.json'); delete k.documentos; delete k.design;
    escrever(d, '.claude/kit.json', JSON.stringify(k));
    return d;
  }

  it('o atualizar imprime o mesmo aviso do adotar quando documentos.conferir está ausente e há docs', () => {
    const d = projetoAntigo();
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /podem reprovar o primeiro gate/);
    assert.match(r.stdout, /docs\/adr/);
    assert.match(r.stdout, /documentos\.conferir/);
  });

  it('B6: com o plugin fora do enabledPlugins o aviso manda ligá-lo ou usar o kit.json, não o /plugin; com o plugin ligado, o /plugin vale', () => {
    const d = projetoAntigo();
    const fora = kit(d, 'atualizar').stdout;
    assert.match(fora, /ligue o plugin processos/);
    assert.match(fora, /enabledPlugins/);
    assert.match(fora, /documentos\.conferir/);
    assert.doesNotMatch(fora, /\/plugin do terminal/, 'o plugin nem está ligado: o /plugin não tem opção para ajustar');
    const s = json(d, '.claude/settings.json'); s.enabledPlugins[`processos@${MKT}`] = true; escrever(d, '.claude/settings.json', JSON.stringify(s));
    const ligado = kit(d, 'atualizar').stdout;
    assert.match(ligado, /podem reprovar o primeiro gate/);
    assert.match(ligado, /\/plugin do terminal/);
    assert.doesNotMatch(ligado, /ligue o plugin/);
  });

  it('com documentos.conferir no kit.json, ou sem docs, o atualizar não avisa', () => {
    const com = projetoAntigo();
    escrever(com, '.claude/kit.json', JSON.stringify({ ...json(com, '.claude/kit.json'), documentos: { conferir: [] } }));
    assert.doesNotMatch(kit(com, 'atualizar').stdout, /podem reprovar/);
    const vazio = projeto();
    escrever(vazio, 'CLAUDE.md', '# meu\n');
    assert.equal(kit(vazio, 'adotar').status, 0);
    const k = json(vazio, '.claude/kit.json'); delete k.documentos; escrever(vazio, '.claude/kit.json', JSON.stringify(k));
    rmSync(join(vazio, 'docs'), { recursive: true, force: true });
    assert.doesNotMatch(kit(vazio, 'atualizar').stdout, /podem reprovar/);
  });

  it('o doutor avisa com o plugin fora do enabledPlugins (undefined), e só quando há docs e conferir ausente', () => {
    const d = projetoAntigo();
    const r = kit(d, 'doutor').stdout;
    assert.match(r, /processos.*fora do enabledPlugins/);
    assert.match(r, /docs\/adr/);
    assert.match(r, /ligue o plugin processos/);
    assert.doesNotMatch(r, /\/plugin do terminal/);
    const k = json(d, '.claude/kit.json'); k.documentos = { conferir: [] }; escrever(d, '.claude/kit.json', JSON.stringify(k));
    assert.doesNotMatch(kit(d, 'doutor').stdout, /fora do enabledPlugins/);
  });
});
