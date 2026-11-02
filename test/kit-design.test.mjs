// F332: o plugin de design do kit se chama `kit-design` (o `design` da Anthropic, instalado pela conta, ofuscava o do kit).
// O kit lê o nome velho onde lê tipo de agente, opção e liga/desliga, e o `kit atualizar` migra o projeto que ainda o tem.
// Tudo em pasta temporária; HOME, a trava do gate e a base da orquestração também são temporários.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semPrefixoDoKit } from '../plugins/orquestracao/hooks/hooks-crewai-comum.mjs';
import { opcoesDoPlugin, pluginLigado } from '../gate/opcoes-do-plugin.mjs';
import { opcoesDoPlugin as opcoesDoHook, pluginLigado as pluginLigadoDoHook } from '../plugins/kit-design/hooks/opcoes-do-plugin.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const MKT = 'ichikawa-kit';
const NOVO = `kit-design@${MKT}`;
// o projeto de antes do F332 tinha o `design` no marketplace com o nome antigo (F344)
const VELHO = 'design@kit-de-orquestracao';

const nova = (prefixo) => realpathSync(mkdtempSync(join(tmpdir(), prefixo)));
function projeto() { const d = nova('kit-f332-'); execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' }); return d; }
const casa = nova('kit-f332-casa-');
const base = nova('kit-f332-base-');
const kit = (cwd, ...args) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, HOOKS_CREWAI_BASE: base, CI: '' } });
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const escrever = (d, rel, texto) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), texto); };

describe('o plugin se chama kit-design', () => {
  it('manifesto, pasta e marketplace usam o nome novo; o nome velho sumiu do marketplace', () => {
    const m = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const nomes = m.plugins.map((p) => p.name);
    assert.ok(nomes.length >= 4, `marketplace sem plugins: ${nomes}`);
    assert.ok(nomes.includes('kit-design'), nomes.join());
    assert.ok(!nomes.includes('design'), 'o nome design colide com o plugin da Anthropic');
    assert.equal(m.plugins.find((p) => p.name === 'kit-design').source, './plugins/kit-design');
    assert.equal(JSON.parse(readFileSync(join(RAIZ, 'plugins', 'kit-design', '.claude-plugin', 'plugin.json'), 'utf8')).name, 'kit-design');
    assert.ok(!existsSync(join(RAIZ, 'plugins', 'design')), 'a pasta velha ficou');
  });

  it('nenhum texto vivo dos plugins, do CLI ou dos modelos cita agente ou skill pelo prefixo velho design:', () => {
    const textos = [];
    const varrer = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const c = join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'tests') varrer(c); } else if (/\.(md|json|mjs|ts|tsx)$/.test(e.name)) textos.push(c); } };
    for (const p of ['plugins', 'cli', 'modelos']) varrer(join(RAIZ, p));
    assert.ok(textos.length > 20, `poucos arquivos lidos: ${textos.length}`);
    // o detector pega a citação velha (e não confunde com kit-design:)
    const velho = /(?<![\w-])design:(designer|critico-de-ui|critica-de-ui|revisao-de-arquitetura-de-ui)\b/;
    assert.ok(velho.test('o `design:designer` grava') && !velho.test('o `kit-design:designer` grava'), 'detector quebrado');
    const achados = textos.filter((f) => !f.endsWith('hooks-crewai-comum.mjs')).filter((f) => velho.test(readFileSync(f, 'utf8')));
    assert.deepEqual(achados.map((f) => f.slice(RAIZ.length + 1)), []);
  });
});

describe('o nome velho continua lido', () => {
  it('semPrefixoDoKit tira kit-design: e design:', () => {
    assert.equal(semPrefixoDoKit('kit-design:designer'), 'designer');
    assert.equal(semPrefixoDoKit('design:designer'), 'designer');
    assert.equal(semPrefixoDoKit('acme:designer'), 'acme:designer');
  });

  for (const [rotulo, opcoes, ligado] of [['gate', opcoesDoPlugin, pluginLigado], ['hook do plugin', opcoesDoHook, pluginLigadoDoHook]]) {
    it(`${rotulo}: as opções e o liga/desliga gravados sob design@ valem para kit-design enquanto o novo não diz nada`, () => {
      const home = nova('kit-f332-home-');
      const raiz = projeto();
      escrever(home, '.claude/settings.json', JSON.stringify({ pluginConfigs: { [VELHO]: { options: { guarda: false, largura: 900 } } } }));
      assert.deepEqual(opcoes('kit-design', home, {}), { guarda: false, largura: 900 });
      escrever(home, '.claude/settings.json', JSON.stringify({ pluginConfigs: { [VELHO]: { options: { guarda: false } }, [NOVO]: { options: { largura: 700 } } } }));
      assert.deepEqual(opcoes('kit-design', home, {}), { largura: 700 }, 'o novo gravado vence o velho');
      assert.equal(ligado('kit-design', raiz, home, {}), undefined, 'ninguém diz');
      escrever(raiz, '.claude/settings.json', JSON.stringify({ enabledPlugins: { [VELHO]: false } }));
      assert.equal(ligado('kit-design', raiz, home, {}), false, 'o projeto ainda com o nome velho desligado');
      escrever(raiz, '.claude/settings.json', JSON.stringify({ enabledPlugins: { [VELHO]: false, [NOVO]: true } }));
      assert.equal(ligado('kit-design', raiz, home, {}), true, 'na mesma camada o novo vence');
      escrever(raiz, '.claude/settings.local.json', JSON.stringify({ enabledPlugins: { [VELHO]: false } }));
      assert.equal(ligado('kit-design', raiz, home, {}), false, 'a camada mais próxima vence, mesmo com o nome velho');
      assert.equal(ligado('processos', raiz, home, {}), undefined, 'outros plugins não herdam nada');
    });
  }
});

describe('kit iniciar e kit atualizar', () => {
  it('kit iniciar liga kit-design e não design', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[NOVO], true);
    assert.ok(!(VELHO in s.enabledPlugins));
    assert.ok(json(d, '.claude/kit.lock.json').chaves.settings.plugins.includes(NOVO));
  });

  /** Um projeto instalado antes do F332: o settings e o lock com design@. */
  function projetoVelho(valor = true) {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const texto = ler(d, '.claude/settings.json');
    assert.ok(texto.includes(`"${NOVO}": true`), 'precondição: o iniciar ligou o novo');
    escrever(d, '.claude/settings.json', texto.replace(`"${NOVO}": true`, `"${VELHO}": ${valor}`));
    const lock = json(d, '.claude/kit.lock.json');
    lock.chaves.settings.plugins = lock.chaves.settings.plugins.map((n) => (n === NOVO ? VELHO : n));
    escrever(d, '.claude/kit.lock.json', `${JSON.stringify(lock, null, 2)}\n`);
    return d;
  }

  it('kit atualizar troca design@ por kit-design@ no settings e no lock, guardando o valor e a ordem', () => {
    const d = projetoVelho();
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /design@kit-de-orquestracao → kit-design@ichikawa-kit/);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[NOVO], true);
    assert.ok(!(VELHO in s.enabledPlugins), 'o nome velho ficou');
    assert.deepEqual(Object.keys(s.enabledPlugins).at(-1), NOVO, 'a chave fica no lugar da velha');
    const plugins = json(d, '.claude/kit.lock.json').chaves.settings.plugins;
    assert.ok(plugins.includes(NOVO) && !plugins.includes(VELHO), plugins.join());
    // de novo: nada a trocar
    const r2 = kit(d, 'atualizar');
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.doesNotMatch(r2.stdout, /→ kit-design/);
    // e o remover tira o novo
    const rm = kit(d, 'remover');
    assert.equal(rm.status, 0, rm.stdout + rm.stderr);
    assert.ok(!existsSync(join(d, '.claude', 'settings.json')) || !(NOVO in (json(d, '.claude/settings.json').enabledPlugins ?? {})), 'o remover não tirou o kit-design');
  });

  it('kit atualizar guarda o false de quem desligou o plugin', () => {
    const d = projetoVelho(false);
    assert.equal(kit(d, 'atualizar').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[NOVO], false);
    assert.ok(!(VELHO in s.enabledPlugins));
  });

  it('kit atualizar --simular diz a troca e não grava', () => {
    const d = projetoVelho();
    const antes = ler(d, '.claude/settings.json');
    const r = kit(d, 'atualizar', '--simular');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /design@kit-de-orquestracao → kit-design@ichikawa-kit/);
    assert.equal(ler(d, '.claude/settings.json'), antes);
  });

  it('com os dois nomes no settings, o velho sai e o novo fica como está', () => {
    const d = projetoVelho(true);
    const s0 = json(d, '.claude/settings.json'); s0.enabledPlugins[NOVO] = false;
    escrever(d, '.claude/settings.json', JSON.stringify(s0, null, 2));
    assert.equal(kit(d, 'atualizar').status, 0);
    const s = json(d, '.claude/settings.json');
    assert.equal(s.enabledPlugins[NOVO], false);
    assert.ok(!(VELHO in s.enabledPlugins));
  });

  it('kit doutor com kit-design desligado manda religar pelo nome novo; com o velho no settings, manda rodar o kit atualizar', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    const s = json(d, '.claude/settings.json'); s.enabledPlugins[NOVO] = false;
    escrever(d, '.claude/settings.json', JSON.stringify(s, null, 2));
    const out = kit(d, 'doutor').stdout;
    assert.match(out, /plugin kit-design desligado/);
    assert.match(out, /enabledPlugins "kit-design@ichikawa-kit": true/);
    assert.doesNotMatch(out, /"design@kit-de-orquestracao": true/);
    const v = projetoVelho(false);
    assert.match(kit(v, 'doutor').stdout, /settings\.json ainda liga design@kit-de-orquestracao.*kit atualizar/);
  });

  it('chave nova posta pela pessoa (fora do lock) não entra no lock: o remover não a apaga', () => {
    const d = projetoVelho(true);
    const s0 = json(d, '.claude/settings.json'); s0.enabledPlugins[NOVO] = true;
    escrever(d, '.claude/settings.json', JSON.stringify(s0, null, 2));
    assert.equal(kit(d, 'atualizar').status, 0);
    const plugins = json(d, '.claude/kit.lock.json').chaves.settings.plugins;
    assert.ok(!plugins.includes(NOVO) && !plugins.includes(VELHO), plugins.join());
  });

  it('settings.json ilegível não vira conflito do atualizar (ele não é do atualizar)', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    escrever(d, '.claude/settings.json', '{ quebrado');
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it('o nome velho no settings.local.json (do usuário) não se mexe: vira aviso', () => {
    const d = projeto();
    assert.equal(kit(d, 'iniciar').status, 0);
    escrever(d, '.claude/settings.local.json', JSON.stringify({ enabledPlugins: { [VELHO]: false } }));
    const r = kit(d, 'atualizar');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /aviso: .*settings\.local\.json.*design@kit-de-orquestracao/);
    assert.deepEqual(json(d, '.claude/settings.local.json'), { enabledPlugins: { [VELHO]: false } });
  });
});
