// F353: o `design-system` toma o lugar do `kit-design`. No projeto, o `kit atualizar` passa o valor do `kit-design@` ao
// `design-system@` e deixa o velho `false` (a conta pode ainda tê-lo ligado); o `kit iniciar` liga o novo; `design.tema` no
// `.claude/kit.json` liga o plugin de tema. Tudo em pasta temporária; HOME e a base da orquestração também.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGINS_DO_KIT, sucederPlugins } from '../cli/pacote.mjs';
import { opcoesDoPlugin, pluginLigado } from '../gate/opcoes-do-plugin.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const DS = 'design-system@ichikawa-kit';
const KD = 'kit-design@ichikawa-kit';
const TEMA = 'tema-wicomm@ichikawa-kit';

const nova = (prefixo) => realpathSync(mkdtempSync(join(tmpdir(), prefixo)));
function projeto() { const d = nova('kit-f353-'); execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' }); return d; }
const casa = nova('kit-f353-casa-');
mkdirSync(join(casa, '.claude', 'plugins'), { recursive: true });
writeFileSync(join(casa, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ 'ichikawa-kit': {} }));
// a conta já tem o design-system (F353): sem isso o kit atualizar não troca o kit-design do projeto
writeFileSync(join(casa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'design-system@ichikawa-kit': [{ scope: 'user', version: '0.9.0' }] } }));
const base = nova('kit-f353-base-');
const kit = (cwd, ...args) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: base, CI: '' } });
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const escrever = (d, rel, texto) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), texto); };
const mexer = (d, rel, f) => { const v = json(d, rel); f(v); escrever(d, rel, `${JSON.stringify(v, null, 2)}\n`); };

describe('o marketplace aponta a base sem marca', () => {
  it('as duas entradas do repositório da empresa no commit da fatia 4 (e8b0b17)', () => {
    const m = JSON.parse(ler(RAIZ, '.claude-plugin', 'marketplace.json'));
    const shas = m.plugins.filter((p) => ['design-system', 'tema-wicomm'].includes(p.name)).map((p) => p.source.sha);
    assert.equal(shas.length, 2, JSON.stringify(m.plugins.map((p) => p.name)));
    assert.deepEqual(shas, ['e8b0b175998242174a0fd0dcbe401ce92ea5b46e', 'e8b0b175998242174a0fd0dcbe401ce92ea5b46e']);
  });

  it('o kit-design segue listado, como apontador para o sucessor', () => {
    const m = JSON.parse(ler(RAIZ, '.claude-plugin', 'marketplace.json'));
    const kd = m.plugins.find((p) => p.name === 'kit-design');
    assert.ok(kd, 'saiu antes da troca rodar');
    assert.match(kd.description, /design-system/);
    assert.match(ler(RAIZ, 'plugins', 'kit-design', 'README.md'), /design-system/);
  });
});

describe('sucederPlugins', () => {
  it('o novo recebe o valor do velho, e o velho fica false', () => {
    for (const valor of [true, false]) {
      const s = { enabledPlugins: { 'a@b': true, [KD]: valor } };
      const r = sucederPlugins(s);
      assert.deepEqual(s.enabledPlugins, { 'a@b': true, [KD]: false, [DS]: valor });
      assert.equal(r.trocas.length, 1, JSON.stringify(r));
      assert.deepEqual(r.conflitos, []);
      assert.deepEqual(r.pares, [{ velho: KD, novo: DS, novoJaEstava: false }]);
    }
  });

  it('o novo que já está fica como está; o velho fica false; de novo, nada', () => {
    const s = { enabledPlugins: { [KD]: true, [DS]: false } };
    sucederPlugins(s);
    assert.deepEqual(s.enabledPlugins, { [KD]: false, [DS]: false });
    for (const v of [s, { enabledPlugins: { 'a@b': true } }, {}]) {
      const r = sucederPlugins(v);
      assert.deepEqual([r.trocas, r.conflitos, r.pares], [[], [], []]);
    }
  });

  it('o design-system de outro marketplace é conflito e nada muda', () => {
    const s = { enabledPlugins: { [KD]: true, 'design-system@outro': true } };
    const r = sucederPlugins(s);
    assert.equal(r.conflitos.length, 1);
    assert.deepEqual(s.enabledPlugins, { [KD]: true, 'design-system@outro': true });
  });
});

describe('kit iniciar e kit atualizar', () => {
  it('kit iniciar liga o design-system e não o kit-design', () => {
    assert.ok(PLUGINS_DO_KIT.includes(DS) && !PLUGINS_DO_KIT.includes(KD), PLUGINS_DO_KIT.join());
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[DS], true);
    assert.ok(!(KD in s.enabledPlugins));
    assert.ok(!(TEMA in s.enabledPlugins), 'o tema não liga sem o kit.json pedir');
  });

  /** Um projeto de antes do F353: o settings e o lock com o kit-design. */
  function projetoVelho(valor = true) {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const texto = ler(d, '.claude/settings.json');
    assert.ok(texto.includes(`"${DS}": true`), 'precondição: o iniciar ligou o design-system');
    escrever(d, '.claude/settings.json', texto.replace(`"${DS}": true`, `"${KD}": ${valor}`));
    mexer(d, '.claude/kit.lock.json', (l) => { l.chaves.settings.plugins = l.chaves.settings.plugins.map((n) => (n === DS ? KD : n)); });
    return d;
  }

  it('kit atualizar troca, o lock acompanha, a segunda vez não muda nada e o remover limpa os dois', () => {
    const d = projetoVelho();
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /kit-design@ichikawa-kit → design-system@ichikawa-kit/);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[DS], true);
    assert.equal(s.enabledPlugins[KD], false, 'o velho fica desligado: a conta pode ainda tê-lo');
    const cs = json(d, '.claude/kit.lock.json').chaves.settings;
    assert.ok(cs.plugins.includes(DS) && !cs.plugins.includes(KD), cs.plugins.join());
    assert.ok(cs.desligados?.includes(KD), JSON.stringify(cs));
    const antes = ler(d, '.claude/settings.json');
    const r2 = kit(d, 'atualizar');
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.doesNotMatch(r2.stdout, /→ design-system/);
    assert.equal(ler(d, '.claude/settings.json'), antes);
    assert.equal(kit(d, 'remover').status, 0);
    const depois = (() => { try { return json(d, '.claude/settings.json').enabledPlugins ?? {}; } catch { return {}; } })();
    assert.ok(!(DS in depois) && !(KD in depois), JSON.stringify(depois));
  });

  it('sem o design-system instalado para o projeto, o kit atualizar não troca e diz como instalar; instalado só no projeto, troca', () => {
    const d = projetoVelho();
    const outraCasa = nova('kit-f353-sem-');
    mkdirSync(join(outraCasa, '.claude', 'plugins'), { recursive: true });
    writeFileSync(join(outraCasa, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ 'ichikawa-kit': {} }));
    const rodar = () => spawnSync('node', [KIT, 'atualizar'], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: outraCasa, HOOKS_CREWAI_BASE: base, CI: '' } });
    const r = rodar();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /aviso: kit-design@ichikawa-kit tem sucessor.*atualizar-plugins/);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[KD], true, 'desligou o velho sem o novo instalado');
    assert.ok(!(DS in json(d, '.claude/settings.json').enabledPlugins));
    writeFileSync(join(outraCasa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { [DS]: [{ scope: 'project', projectPath: d, version: '0.9.0' }] } }));
    assert.equal(rodar().status, 0);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[DS], true);
  });

  it('kit atualizar guarda o false de quem desligou o plugin; o remover tira os dois false', () => {
    const d = projetoVelho(false);
    assert.equal(kit(d, 'atualizar').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[DS], false);
    assert.equal(s.enabledPlugins[KD], false);
    assert.equal(kit(d, 'remover').status, 0);
    const depois = (() => { try { return json(d, '.claude/settings.json').enabledPlugins ?? {}; } catch { return {}; } })();
    assert.ok(!(DS in depois) && !(KD in depois), JSON.stringify(depois));
  });

  it('kit atualizar --simular diz a troca e não grava', () => {
    const d = projetoVelho();
    const antes = ler(d, '.claude/settings.json');
    const r = kit(d, 'atualizar', '--simular');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /kit-design@ichikawa-kit → design-system@ichikawa-kit/);
    assert.equal(ler(d, '.claude/settings.json'), antes);
  });

  it('o design-system de outro marketplace vira conflito do atualizar', () => {
    const d = projetoVelho();
    mexer(d, '.claude/settings.json', (s) => { s.enabledPlugins['design-system@outro'] = true; });
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /conflito: .*design-system@outro/);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[KD], true);
  });

  it('o projeto de antes do F332 (design@ do marketplace antigo) chega direto ao design-system', () => {
    const d = projetoVelho();
    escrever(d, '.claude/settings.json', ler(d, '.claude/settings.json').replace(`"${KD}"`, '"design@kit-de-orquestracao"'));
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[DS], true);
    assert.ok(!('design@kit-de-orquestracao' in s.enabledPlugins));
  });

  it('kit doutor manda rodar o kit atualizar enquanto o projeto liga o kit-design', () => {
    const d = projetoVelho();
    assert.match(kit(d, 'doutor').stdout, /settings\.json ainda liga kit-design@ichikawa-kit.*design-system@ichikawa-kit.*kit atualizar/);
    assert.equal(kit(d, 'atualizar').status, 0);
    assert.doesNotMatch(kit(d, 'doutor').stdout, /ainda liga kit-design/, 'o false que fica não é aviso');
  });
});

describe('o tema pelo kit.json', () => {
  const comTema = (tema) => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    mexer(d, '.claude/kit.json', (k) => { k.design = { ...(k.design ?? {}), tema }; });
    return d;
  };

  it('design.tema liga o tema-<id> no atualizar; o lock o registra e o remover o tira; o doutor confere', () => {
    const d = comTema(TEMA.split('@')[0]);
    assert.match(kit(d, 'doutor').stdout, /aviso: .*design\.tema.*tema-wicomm@ichikawa-kit.*kit atualizar/);
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /tema-wicomm@ichikawa-kit/);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[TEMA], true);
    assert.ok(json(d, '.claude/kit.lock.json').chaves.settings.plugins.includes(TEMA));
    assert.match(kit(d, 'doutor').stdout, /ok: .*tema-wicomm/);
    assert.equal(kit(d, 'remover').status, 0);
    const depois = (() => { try { return json(d, '.claude/settings.json').enabledPlugins ?? {}; } catch { return {}; } })();
    assert.ok(!(TEMA in depois), JSON.stringify(depois));
  });

  it('kit adotar com design.tema já no kit.json liga o tema', () => {
    const d = projeto();
    escrever(d, '.claude/kit.json', `${JSON.stringify({ design: { tema: TEMA.split('@')[0] } }, null, 2)}\n`);
    escrever(d, 'CLAUDE.md', '# projeto\n');
    const r = kit(d, 'adotar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[TEMA], true);
  });

  it('o false que o projeto pôs no tema fica (aviso); tema que o marketplace não lista não liga', () => {
    const d = comTema(TEMA.split('@')[0]);
    mexer(d, '.claude/settings.json', (s) => { s.enabledPlugins[TEMA] = false; });
    const r = kit(d, 'atualizar');
    assert.match(r.stdout, /aviso: .*tema-wicomm@ichikawa-kit/);
    assert.equal(json(d, '.claude/settings.json').enabledPlugins[TEMA], false);
    const x = comTema('tema-acme');
    const rx = kit(x, 'atualizar');
    assert.equal(rx.status, 0, rx.stdout + rx.stderr);
    assert.match(rx.stdout, /aviso: .*não lista o plugin tema-acme/);
    assert.ok(!('tema-acme@ichikawa-kit' in json(x, '.claude/settings.json').enabledPlugins));
  });

  it('sem design.tema nada liga o tema', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    assert.equal(kit(d, 'atualizar').status, 0);
    assert.ok(!(TEMA in json(d, '.claude/settings.json').enabledPlugins));
  });
});

describe('o gate lê as opções e o liga/desliga do kit-design para o design-system', () => {
  it('opções gravadas sob kit-design valem enquanto o design-system não tem as suas; o liga/desliga do velho vale quando o novo não diz', () => {
    const home = nova('kit-f353-home-');
    const raiz = projeto();
    escrever(home, '.claude/settings.json', JSON.stringify({ pluginConfigs: { [KD]: { options: { guarda: false } } } }));
    assert.deepEqual(opcoesDoPlugin('design-system', home, {}), { guarda: false });
    escrever(home, '.claude/settings.json', JSON.stringify({ pluginConfigs: { [KD]: { options: { guarda: false } }, [DS]: { options: { largura: 700 } } } }));
    assert.deepEqual(opcoesDoPlugin('design-system', home, {}), { largura: 700 });
    escrever(raiz, '.claude/settings.json', JSON.stringify({ enabledPlugins: { [KD]: true } }));
    assert.equal(pluginLigado('design-system', raiz, home, {}), true);
    escrever(raiz, '.claude/settings.json', JSON.stringify({ enabledPlugins: { [KD]: false, [DS]: true } }));
    assert.equal(pluginLigado('design-system', raiz, home, {}), true, 'na mesma camada o novo vence');
  });
});
