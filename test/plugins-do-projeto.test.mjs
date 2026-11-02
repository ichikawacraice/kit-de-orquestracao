// F347: o perfil de plugins do projeto. `plugins.desligar` do .claude/kit.json vira `enabledPlugins: false` no
// .claude/settings.json do projeto (nunca na conta): o `kit adotar` e o `kit atualizar` aplicam, o `kit doutor` confere e o
// `kit remover` tira o que o kit pôs. Tudo em pasta temporária; HOME também.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aplicarDesligados, conferirDesligados } from '../cli/plugins-do-projeto.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const FORA = 'figma@claude-plugins-official';
const OUTRO = 'hookify@claude-plugins-official';
const ler = (...p) => JSON.parse(readFileSync(join(...p), 'utf8'));

describe('aplicarDesligados', () => {
  it('ausente vira false e entra na lista do que o kit pôs; false fica; true é do projeto e vira conflito', () => {
    const s = { enabledPlugins: { [OUTRO]: true, 'a@b': false } };
    const r = aplicarDesligados(s, { plugins: { desligar: [FORA, OUTRO, 'a@b'] } });
    assert.equal(s.enabledPlugins[FORA], false);
    assert.equal(s.enabledPlugins[OUTRO], true, 'o true do projeto não pode ser trocado');
    assert.deepEqual(r.desligados, [FORA]);
    assert.equal(r.conflitos.length, 1);
    assert.match(r.conflitos[0], /hookify@claude-plugins-official já é true/);
  });

  it('recusa desligar o plugin orquestracao e id sem marketplace; sem a seção não mexe em nada', () => {
    const s = {};
    const r = aplicarDesligados(s, { plugins: { desligar: ['orquestracao@ichikawa-kit', 'figma', 3] } });
    assert.deepEqual(s, {}, 'nada a desligar: o settings não muda');
    assert.equal(r.avisos.length, 3);
    assert.match(r.avisos.join('\n'), /orquestracao@ichikawa-kit.*não se desliga/);
    assert.match(r.avisos.join('\n'), /"figma".*nome@marketplace/);
    const vazio = {};
    assert.deepEqual(aplicarDesligados(vazio, {}), { desligados: [], conflitos: [], avisos: [] });
    assert.deepEqual(vazio, {});
  });

  it('o true que o próprio kit pôs vira false; na retomada da adoção, o false já gravado é do kit', () => {
    const s = { enabledPlugins: { 'kit-design@ichikawa-kit': true } };
    const r = aplicarDesligados(s, { plugins: { desligar: ['kit-design@ichikawa-kit'] } }, { doKit: ['kit-design@ichikawa-kit'] });
    assert.equal(s.enabledPlugins['kit-design@ichikawa-kit'], false);
    assert.deepEqual([r.desligados, r.conflitos], [['kit-design@ichikawa-kit'], []]);
    const kj = { plugins: { desligar: [FORA] } };
    assert.deepEqual(aplicarDesligados({ enabledPlugins: { [FORA]: false } }, kj).desligados, [], 'false do projeto não é do kit');
    assert.deepEqual(aplicarDesligados({ enabledPlugins: { [FORA]: false } }, kj, { recuperando: true }).desligados, [FORA]);
  });

  it('plugins.desligar que não é lista é aviso', () => {
    assert.match(aplicarDesligados({}, { plugins: { desligar: 'figma@x' } }).avisos[0], /precisa ser uma lista/);
  });
});

describe('conferirDesligados (doutor)', () => {
  it('ok quando o settings do projeto desliga; aviso quando falta ou quando o settings.local religa', () => {
    const kj = { plugins: { desligar: [FORA] } };
    assert.match(conferirDesligados(kj, [{}, { enabledPlugins: { [FORA]: false } }, null]).join('\n'), /^ok: .*1 plugin/m);
    assert.match(conferirDesligados(kj, [{}, {}, null]).join('\n'), /aviso: .*figma@claude-plugins-official.*kit atualizar/);
    assert.match(conferirDesligados(kj, [{}, { enabledPlugins: { [FORA]: false } }, { enabledPlugins: { [FORA]: true } }]).join('\n'), /settings\.local\.json religa/);
    assert.deepEqual(conferirDesligados({}, [{}, {}, null]), []);
  });
});

describe('ponta a ponta: atualizar aplica, doutor confere, remover tira', () => {
  it('o settings da conta não muda; o do projeto ganha o false e o perde no remover', (t) => {
    const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-casa-')));
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-')));
    t.after(() => { for (const x of [casa, d]) rmSync(x, { recursive: true, force: true }); });
    execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
    const env = { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: casa, CI: '' };
    const kit = (...a) => spawnSync('node', [KIT, ...a], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env });
    assert.equal(kit('iniciar').status, 0);
    const kj = ler(d, '.claude', 'kit.json');
    kj.plugins = { desligar: [FORA] };
    writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
    assert.equal(ler(d, '.claude', 'settings.json').enabledPlugins[FORA], undefined, 'precondição: o projeto ainda não desliga');
    assert.match(kit('doutor').stdout, /aviso: .*figma@claude-plugins-official/);
    const a = kit('atualizar');
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.match(a.stdout, /desligado: figma@claude-plugins-official/);
    assert.equal(ler(d, '.claude', 'settings.json').enabledPlugins[FORA], false);
    assert.match(kit('doutor').stdout, /ok: .*desliga 1 plugin/);
    const r = kit('remover');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    let s = {}; try { s = ler(d, '.claude', 'settings.json'); } catch { /* o kit criou o arquivo: o remover o apaga */ }
    assert.equal(s.enabledPlugins?.[FORA], undefined, 'o remover deixou o false que o kit pôs');
    assert.ok(!existsSync(join(casa, '.claude', 'settings.json')), 'o kit gravou no settings da conta');
  });

  it('o kit adotar aplica o perfil do kit.json que o projeto já tem', (t) => {
    const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-casa-')));
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-adotar-')));
    t.after(() => { for (const x of [casa, d]) rmSync(x, { recursive: true, force: true }); });
    execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
    writeFileSync(join(d, 'CLAUDE.md'), '# projeto\n');
    mkdirSync(join(d, '.claude'));
    writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify({ plugins: { desligar: [FORA] } }));
    const env = { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: casa, CI: '' };
    const r = spawnSync('node', [KIT, 'adotar'], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /desliga figma@claude-plugins-official/);
    assert.equal(ler(d, '.claude', 'settings.json').enabledPlugins[FORA], false);
    assert.deepEqual(ler(d, '.claude', 'kit.lock.json').chaves.settings.desligados, [FORA]);
  });

  it('o perfil desliga um plugin do próprio kit: no adotar sem conflito, e no atualizar depois de o kit tê-lo ligado', (t) => {
    const KD = 'kit-design@ichikawa-kit';
    const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-casa-')));
    const a = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-kd-')));
    const b = realpathSync(mkdtempSync(join(tmpdir(), 'kit-f347-kd2-')));
    t.after(() => { for (const x of [casa, a, b]) rmSync(x, { recursive: true, force: true }); });
    const env = { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: casa, CI: '' };
    const kit = (d, ...args) => spawnSync('node', [KIT, ...args], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env });
    for (const d of [a, b]) { execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' }); writeFileSync(join(d, 'CLAUDE.md'), '# projeto\n'); }
    mkdirSync(join(a, '.claude'));
    writeFileSync(join(a, '.claude', 'kit.json'), JSON.stringify({ plugins: { desligar: [KD] } }));
    const ra = kit(a, 'adotar');
    assert.equal(ra.status, 0, ra.stdout + ra.stderr);
    assert.equal(ler(a, '.claude', 'settings.json').enabledPlugins[KD], false);
    // b: adotado sem perfil (o kit liga o kit-design), depois o perfil pede desligar
    assert.equal(kit(b, 'adotar').status, 0);
    assert.equal(ler(b, '.claude', 'settings.json').enabledPlugins[KD], true, 'precondição: o kit ligou o kit-design');
    const kj = ler(b, '.claude', 'kit.json'); kj.plugins = { desligar: [KD] };
    writeFileSync(join(b, '.claude', 'kit.json'), JSON.stringify(kj));
    const rb = kit(b, 'atualizar');
    assert.equal(rb.status, 0, rb.stdout + rb.stderr);
    assert.equal(ler(b, '.claude', 'settings.json').enabledPlugins[KD], false);
    const cs = ler(b, '.claude', 'kit.lock.json').chaves.settings;
    assert.ok(cs.desligados.includes(KD) && !cs.plugins.includes(KD), JSON.stringify(cs));
    assert.equal(kit(b, 'atualizar').status, 0, 'o segundo atualizar não pode virar conflito');
    const doutor = kit(b, 'doutor').stdout;
    assert.match(doutor, /info: plugin kit-design desligado pelo perfil/);
    assert.doesNotMatch(doutor, /para religar, enabledPlugins "kit-design/, 'o doutor manda desfazer o que o perfil pede');
  });
});
