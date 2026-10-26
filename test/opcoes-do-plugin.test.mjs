// K14: a precedência A7 (kit.json com a chave > opção do plugin > padrão ligado; plugin desligado não roda) e a lista de opções
// dos plugin.json × as chaves que o gate e a guarda leem. Nada aqui toca ~/.claude: HOME é uma pasta temporária.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { OPCOES_DO_PROCESSOS, REGRAS_DE_DOCUMENTO, carregarConfig } from '../gate/config.mjs';
import { OPCOES_DO_DESIGN, lerConfig } from '../plugins/design/hooks/guarda-de-design.mjs';
import { booleanoDaOpcao, opcoesDoPlugin, pluginLigado } from '../gate/opcoes-do-plugin.mjs';
import { booleanoDaOpcao as booleanoDoHook, pluginLigado as pluginLigadoDoHook, opcoesDoPlugin as opcoesDoHook } from '../plugins/design/hooks/opcoes-do-plugin.mjs';

const RAIZ_DO_KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporarios = [];
after(() => { for (const t of temporarios) rmSync(t, { recursive: true, force: true }); });
const pasta = () => { const t = mkdtempSync(join(tmpdir(), 'k14-')); temporarios.push(t); return t; };
const gravar = (raiz, rel, valor) => { mkdirSync(dirname(join(raiz, rel)), { recursive: true }); writeFileSync(join(raiz, rel), JSON.stringify(valor)); };

/** Um projeto + uma casa (HOME) temporários. `opcoes`: { processos: {...}, design: {...} } gravadas como o app grava. */
function cenario({ kit, opcoes = {}, enabled, enabledLocal } = {}) {
  const raiz = pasta(); const home = pasta();
  if (kit) gravar(raiz, '.claude/kit.json', kit);
  const pluginConfigs = Object.fromEntries(Object.entries(opcoes).map(([p, o]) => [`${p}@kit-de-orquestracao`, { options: o }]));
  if (Object.keys(pluginConfigs).length) gravar(home, '.claude/settings.json', { pluginConfigs });
  if (enabled) gravar(raiz, '.claude/settings.json', { enabledPlugins: enabled });
  if (enabledLocal) gravar(raiz, '.claude/settings.local.json', { enabledPlugins: enabledLocal });
  return { raiz, home };
}
const conferir = (c) => carregarConfig(c.raiz, undefined, { home: c.home }).documentos.conferir;
const LIGADO = { 'processos@kit-de-orquestracao': true };

describe('processos: precedência A7 do documentos.conferir', () => {
  it('sem nada gravado, as cinco regras rodam (padrão ligado)', () => {
    const regras = conferir(cenario({ enabled: LIGADO }));
    assert.equal(regras.length, 5);
    assert.deepEqual(regras, REGRAS_DE_DOCUMENTO);
  });

  it('opção desligada e kit.json sem a chave → a regra não roda', () => {
    const controle = conferir(cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: true } } }));
    assert.ok(controle.includes('links-relativos')); // a opção ligada a manteria: o desligar é que tira
    const regras = conferir(cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: false } } }));
    assert.ok(!regras.includes('links-relativos'));
    assert.equal(regras.length, 4);
  });

  it('opção desligada e kit.json com a regra em conferir → roda', () => {
    const c = cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: false } }, kit: { documentos: { conferir: ['links-relativos'] } } });
    assert.ok(!conferir(cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: false } } })).includes('links-relativos'));
    assert.deepEqual(conferir(c), ['links-relativos']);
  });

  it('opção ligada e kit.json com conferir sem ela → não roda', () => {
    const solto = conferir(cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: true } } }));
    assert.ok(solto.includes('links-relativos'));
    const c = cenario({ enabled: LIGADO, opcoes: { processos: { conferir_links_relativos: true } }, kit: { documentos: { conferir: ['status-da-spec'] } } });
    assert.deepEqual(conferir(c), ['status-da-spec']);
  });

  it('conferir: [] explícito = nenhuma, mesmo com as opções ligadas', () => {
    assert.equal(conferir(cenario({ enabled: LIGADO })).length, 5);
    assert.deepEqual(conferir(cenario({ enabled: LIGADO, kit: { documentos: { conferir: [] } } })), []);
  });

  it('plugin desligado em enabledPlugins → nada roda, mesmo com o kit.json ligando', () => {
    const kit = { documentos: { conferir: ['status-da-spec'] } };
    assert.deepEqual(conferir(cenario({ enabled: LIGADO, kit })), ['status-da-spec']);
    assert.deepEqual(conferir(cenario({ enabled: { 'processos@kit-de-orquestracao': false }, kit })), []);
  });

  it('a camada local de enabledPlugins vence a do projeto', () => {
    const c = cenario({ enabled: LIGADO, enabledLocal: { 'processos@kit-de-orquestracao': false } });
    assert.deepEqual(conferir(c), []);
    assert.equal(pluginLigado('processos', c.raiz, c.home), false);
  });

  it('settings da casa ilegível = sem opção (padrão), nunca erro', () => {
    const c = cenario({ enabled: LIGADO });
    mkdirSync(join(c.home, '.claude'), { recursive: true });
    writeFileSync(join(c.home, '.claude/settings.json'), '{ não é json');
    assert.deepEqual(opcoesDoPlugin('processos', c.home), {});
    assert.equal(conferir(c).length, 5);
  });

  it('opção que o app grava como texto "false" também desliga', () => {
    assert.equal(conferir(cenario({ enabled: LIGADO, opcoes: { processos: { conferir_status_da_spec: 'false' } } })).includes('status-da-spec'), false);
  });
});

describe('design: precedência A7 na guarda (lerConfig)', () => {
  const lerDe = (c, env = {}) => lerConfig(c.raiz, { home: c.home, env });
  const kit = { design: { pasta: 'apps/web' } };

  it('o plugin desligado em enabledPlugins → a guarda não roda, mesmo com design.pasta no kit.json', () => {
    assert.ok(lerDe(cenario({ kit, enabled: { 'design@kit-de-orquestracao': true } }))); // ligado: roda
    assert.ok(lerDe(cenario({ kit }))); // ninguém diz (plugin carregado por --plugin-dir ou pela conta): roda
    assert.equal(lerDe(cenario({ kit, enabled: { 'design@kit-de-orquestracao': false } })), null);
    assert.equal(lerDe(cenario({ kit, enabled: { 'design@kit-de-orquestracao': true }, enabledLocal: { 'design@kit-de-orquestracao': false } })), null);
  });

  it('opção guarda desligada → inerte; design.guarda no kit.json vence a opção', () => {
    const ligado = { 'design@kit-de-orquestracao': true };
    assert.ok(lerDe(cenario({ kit, enabled: ligado, opcoes: { design: { guarda: true } } })));
    assert.equal(lerDe(cenario({ kit, enabled: ligado, opcoes: { design: { guarda: false } } })), null);
    assert.ok(lerDe(cenario({ kit: { design: { pasta: 'apps/web', guarda: true } }, enabled: ligado, opcoes: { design: { guarda: false } } })));
    assert.equal(lerDe(cenario({ kit: { design: { pasta: 'apps/web', guarda: false } }, enabled: ligado, opcoes: { design: { guarda: true } } })), null);
  });

  it('a variável de ambiente do hook (CLAUDE_PLUGIN_OPTION_GUARDA) vale quando o app a exporta', () => {
    const c = cenario({ kit, enabled: { 'design@kit-de-orquestracao': true } });
    assert.ok(lerDe(c, {}));
    assert.equal(lerDe(c, { CLAUDE_PLUGIN_OPTION_GUARDA: 'false' }), null);
  });

  it('pasta_do_front: o kit.json com design.pasta vence; sem ele vale a opção', () => {
    const ligado = { 'design@kit-de-orquestracao': true };
    const semKit = cenario({ kit: { documentos: {} }, enabled: ligado, opcoes: { design: { pasta_do_front: 'web' } } });
    assert.equal(lerDe(cenario({ kit: { documentos: {} }, enabled: ligado })), null); // sem pasta em lugar nenhum: inerte
    assert.deepEqual(lerDe(semKit).visual[0], 'web/**/*.tsx');
    const comKit = cenario({ kit, enabled: ligado, opcoes: { design: { pasta_do_front: 'web' } } });
    assert.deepEqual(lerDe(comKit).visual[0], 'apps/web/**/*.tsx');
  });

  it('cobrar_critica desligada → config.cobrarCritica false; design.cobrarCritica no kit.json vence', () => {
    const ligado = { 'design@kit-de-orquestracao': true };
    assert.equal(lerDe(cenario({ kit, enabled: ligado })).cobrarCritica, true);
    assert.equal(lerDe(cenario({ kit, enabled: ligado, opcoes: { design: { cobrar_critica: false } } })).cobrarCritica, false);
    assert.equal(lerDe(cenario({ kit: { design: { pasta: 'apps/web', cobrarCritica: true } }, enabled: ligado, opcoes: { design: { cobrar_critica: false } } })).cobrarCritica, true);
  });
});

describe('as opções dos plugin.json × as chaves que o código lê', () => {
  const opcoesDe = (plugin) => JSON.parse(readFileSync(join(RAIZ_DO_KIT, 'plugins', plugin, '.claude-plugin/plugin.json'), 'utf8')).userConfig;

  it('processos: uma opção por regra de conferência, e nenhuma a mais', () => {
    const declaradas = opcoesDe('processos');
    assert.ok(declaradas && Object.keys(declaradas).length > 0);
    assert.deepEqual(Object.keys(declaradas).sort(), [...OPCOES_DO_PROCESSOS].sort());
    assert.deepEqual([...OPCOES_DO_PROCESSOS].sort(), REGRAS_DE_DOCUMENTO.map((r) => `conferir_${r.replace(/-/g, '_')}`).sort());
    for (const o of Object.values(declaradas)) { assert.equal(o.type, 'boolean'); assert.equal(o.default, true); }
  });

  it('design: guarda, cobrar_critica, pasta_do_front e largura, e nenhuma a mais', () => {
    const declaradas = opcoesDe('design');
    assert.ok(declaradas && Object.keys(declaradas).length > 0);
    assert.deepEqual(Object.keys(declaradas).sort(), [...OPCOES_DO_DESIGN].sort());
    assert.equal(declaradas.guarda.type, 'boolean');
    assert.equal(declaradas.cobrar_critica.type, 'boolean');
    assert.equal(declaradas.pasta_do_front.type, 'string');
    assert.equal(declaradas.largura.type, 'number');
  });

  it('o helper do gate e o do hook concordam nos mesmos cenários', () => {
    const ligado = { 'design@kit-de-orquestracao': true, 'processos@kit-de-orquestracao': true };
    for (const c of [cenario({ enabled: ligado }), cenario({ enabled: { 'design@kit-de-orquestracao': false } }), cenario({ enabledLocal: ligado, enabled: { 'design@kit-de-orquestracao': false } }), cenario({})]) {
      for (const p of ['design', 'processos']) assert.equal(pluginLigadoDoHook(p, c.raiz, c.home), pluginLigado(p, c.raiz, c.home));
    }
    const c = cenario({ opcoes: { design: { guarda: false, largura: 1440 } } });
    assert.deepEqual(opcoesDoHook('design', c.home), opcoesDoPlugin('design', c.home));
    assert.equal(opcoesDoPlugin('design', c.home).guarda, false); // o cenário tem opção de verdade
    for (const v of [true, false, 'false', 'true', '0', 'off', undefined, '', 'talvez']) for (const p of [true, false]) assert.equal(booleanoDoHook(v, p), booleanoDaOpcao(v, p));
  });
});
