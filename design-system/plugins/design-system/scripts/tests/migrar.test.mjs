// A migração de um projeto do plugin `wicomm` para o `design-system` + tema (F345): o que muda, o que não muda, e
// que rodar duas vezes não muda nada.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aplicar, planejar } from '../migrar.mjs';

const SCRIPT = join(import.meta.dirname, '..', 'migrar.mjs');
const temporarias = [];
after(() => temporarias.forEach((d) => rmSync(d, { recursive: true, force: true })));
const escrever = (raiz, rel, obj) => {
  mkdirSync(join(raiz, rel, '..'), { recursive: true });
  writeFileSync(join(raiz, rel), JSON.stringify(obj, null, 2) + '\n');
};
const ler = (raiz, rel) => JSON.parse(readFileSync(join(raiz, rel), 'utf-8'));

/** Um projeto como o piloto: wicomm ligado pelo marketplace wicomm, kit.json com o designer antigo, design/wicomm.json. */
function projetoAntigo() {
  const r = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-migrar-')));
  temporarias.push(r);
  escrever(r, '.claude/settings.json', {
    extraKnownMarketplaces: { wicomm: { source: { source: 'github', repo: 'wicomm-projects/wicomm-design-system' } } },
    enabledPlugins: { 'wicomm@wicomm': true, 'outro@kit': true },
  });
  escrever(r, '.claude/kit.json', { design: { designers: ['wicomm:designer'], revisoes: 'docs/design/revisoes' } });
  escrever(r, 'design/wicomm.json', { versao: '0.14.1', pasta: 'frontend' });
  return r;
}

describe('migrar', () => {
  it('desliga o wicomm, liga o design-system e o tema, e declara o marketplace', () => {
    const r = projetoAntigo();
    aplicar(planejar(r));
    const s = ler(r, '.claude/settings.json');
    assert.equal(s.enabledPlugins['wicomm@wicomm'], false);
    assert.equal(s.enabledPlugins['design-system@ichikawa-kit'], true);
    assert.equal(s.enabledPlugins['tema-wicomm@ichikawa-kit'], true);
    assert.equal(s.enabledPlugins['outro@kit'], true, 'o resto fica');
    assert.deepEqual(s.extraKnownMarketplaces['ichikawa-kit'], { source: { source: 'github', repo: 'ichikawacraice/kit-de-orquestracao' } });
    assert.ok(s.extraKnownMarketplaces.wicomm, 'o marketplace antigo fica até o wicomm virar apontador');
  });

  it('acrescenta o designer novo ao kit.json sem tirar o antigo', () => {
    const r = projetoAntigo();
    aplicar(planejar(r));
    assert.deepEqual(ler(r, '.claude/kit.json').design.designers, ['wicomm:designer', 'design-system:designer']);
    assert.equal(ler(r, '.claude/kit.json').design.revisoes, 'docs/design/revisoes');
  });

  it('não renomeia o design/wicomm.json nem cria o arquivo novo', () => {
    const r = projetoAntigo();
    aplicar(planejar(r));
    assert.deepEqual(ler(r, 'design/wicomm.json'), { versao: '0.14.1', pasta: 'frontend' });
    assert.equal(existsSync(join(r, 'design', 'design-system.json')), false);
  });

  it('rodar de novo não muda nada', () => {
    const r = projetoAntigo();
    aplicar(planejar(r));
    const segundo = planejar(r);
    assert.deepEqual(segundo.mudancas, []);
    assert.deepEqual(segundo.arquivos, {});
  });

  it('projeto sem kit.json nem settings ganha só o settings', () => {
    const r = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-migrar-')));
    temporarias.push(r);
    const p = planejar(r);
    assert.deepEqual(Object.keys(p.arquivos), [join(r, '.claude', 'settings.json')]);
  });

  it('sem a chave do wicomm no projeto, ela entra desligada: o wicomm ligado na conta não guarda o projeto migrado', () => {
    const r = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-migrar-')));
    temporarias.push(r);
    aplicar(planejar(r));
    assert.equal(ler(r, '.claude/settings.json').enabledPlugins['wicomm@wicomm'], false);
    assert.deepEqual(planejar(r).mudancas, []);
  });

  it('o design-system já ligado por outro marketplace é erro: os hooks rodariam duas vezes', () => {
    const r = projetoAntigo();
    escrever(r, '.claude/settings.json', { enabledPlugins: { 'design-system@outro': true } });
    assert.throws(() => planejar(r), /um plugin num marketplace só/);
  });

  it('o comando sem --aplicar só mostra, e com --aplicar grava', () => {
    const r = projetoAntigo();
    const antes = readFileSync(join(r, '.claude', 'settings.json'), 'utf-8');
    const mostra = execFileSync(process.execPath, [SCRIPT, r], { encoding: 'utf-8' });
    assert.match(mostra, /desliga wicomm@wicomm/);
    assert.equal(readFileSync(join(r, '.claude', 'settings.json'), 'utf-8'), antes);
    execFileSync(process.execPath, [SCRIPT, r, '--aplicar'], { encoding: 'utf-8' });
    assert.equal(ler(r, '.claude/settings.json').enabledPlugins['design-system@ichikawa-kit'], true);
    assert.match(execFileSync(process.execPath, [SCRIPT, r], { encoding: 'utf-8' }), /Nada a migrar/);
  });
});
