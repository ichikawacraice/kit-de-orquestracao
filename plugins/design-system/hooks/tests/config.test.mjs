// A troca de nome do plugin (wicomm → design-system, F345) sem quebrar quem já usa: o arquivo do projeto nos dois
// nomes, as opções herdadas do nome antigo e o recuo enquanto o plugin antigo está ligado (os hooks não rodam em dobro).
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { arquivoDoProjeto, cedeAoAntigo, configDoProjeto, opcoesDoPlugin, pluginLigado } from '../config.mjs';
import { lerConfig } from '../guarda-de-design.mjs';

const temporarias = [];
after(() => temporarias.forEach((d) => rmSync(d, { recursive: true, force: true })));
const pasta = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-config-')));
  temporarias.push(d);
  return d;
};
const escrever = (raiz, rel, obj) => {
  mkdirSync(join(raiz, rel, '..'), { recursive: true });
  writeFileSync(join(raiz, rel), typeof obj === 'string' ? obj : JSON.stringify(obj));
};
/** Uma conta sem nada gravado, para o settings da máquina não vazar no teste. */
const conta = () => {
  const casa = pasta();
  return { casa, env: { CLAUDE_CONFIG_DIR: join(casa, '.claude') } };
};

describe('o arquivo do projeto, nos dois nomes', () => {
  it('sem arquivo, o nome é o novo (é o que se cria)', () => {
    const r = pasta();
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'design-system.json'));
  });

  it('com só o antigo, vale o antigo — o projeto que já o tem não precisa renomear', () => {
    const r = pasta();
    escrever(r, 'design/wicomm.json', { pasta: 'web', densidade: 'site' });
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'wicomm.json'));
    const c = configDoProjeto(r);
    assert.equal(c.pasta, 'web');
    assert.equal(c.temArquivo, true);
  });

  it('com os dois, vale o novo, e o antigo por baixo dele: o arquivo novo não apaga o que o antigo diz', () => {
    const r = pasta();
    escrever(r, 'design/wicomm.json', { pasta: 'velho', densidade: 'site', pecas: ['botao'] });
    escrever(r, 'design/design-system.json', { pasta: 'novo', pecas: ['botao', 'cartao'] });
    const c = configDoProjeto(r);
    assert.equal(c.pasta, 'novo');
    assert.equal(c.densidade, 'site');
    assert.deepEqual(c.pecas, ['botao', 'cartao']);
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'design-system.json'));
  });
});

describe('as opções e o liga/desliga do nome antigo', () => {
  it('sem opções do nome novo, valem as do wicomm; depois as do kit-design', () => {
    const { casa, env } = conta();
    escrever(casa, '.claude/settings.json', { pluginConfigs: { 'kit-design@kit': { options: { largura: 1440 } }, 'wicomm@wicomm': { options: { guarda: false } } } });
    assert.deepEqual(opcoesDoPlugin(casa, env), { guarda: false });
    escrever(casa, '.claude/settings.json', { pluginConfigs: { 'kit-design@kit': { options: { largura: 1440 } } } });
    assert.deepEqual(opcoesDoPlugin(casa, env), { largura: 1440 });
  });

  it('as opções do nome novo vencem as do antigo', () => {
    const { casa, env } = conta();
    escrever(casa, '.claude/settings.json', { pluginConfigs: { 'wicomm@wicomm': { options: { guarda: false } }, 'design-system@kit': { options: { guarda: true } } } });
    assert.deepEqual(opcoesDoPlugin(casa, env), { guarda: true });
  });

  it('o wicomm desligado não desliga o design-system (é o estado depois da migração)', () => {
    const { casa, env } = conta();
    const r = pasta();
    escrever(r, '.claude/settings.json', { enabledPlugins: { 'wicomm@wicomm': false, 'design-system@ichikawa-kit': true } });
    escrever(r, 'design/wicomm.json', { pasta: 'web' });
    assert.equal(pluginLigado(r, casa, env), true);
    assert.equal(cedeAoAntigo(r, casa, env), false);
    assert.ok(lerConfig(r, { home: casa, env }), 'a guarda roda');
  });

  /** O `wicomm` instalado na conta como o app grava (`plugins/installed_plugins.json`), para o escopo dado. */
  const instalarWicomm = (casa, instalacao) =>
    escrever(casa, '.claude/plugins/installed_plugins.json', { version: 2, plugins: { 'wicomm@wicomm': [instalacao] } });

  it('com o wicomm ligado e instalado no projeto que só tem design/wicomm.json, o design-system cede: a guarda fica inerte nele', () => {
    const { casa, env } = conta();
    const r = pasta();
    escrever(r, '.claude/settings.json', { enabledPlugins: { 'wicomm@wicomm': true } });
    escrever(r, 'design/wicomm.json', { pasta: 'web' });
    escrever(casa, '.claude/settings.json', { enabledPlugins: { 'design-system@ichikawa-kit': true } });
    instalarWicomm(casa, { scope: 'project', projectPath: r });
    assert.equal(cedeAoAntigo(r, casa, env), true);
    assert.equal(lerConfig(r, { home: casa, env }), null);
  });

  it('o wicomm ligado e instalado só na conta não cala o projeto novo, com design/design-system.json (o wicomm não o lê)', () => {
    const { casa, env } = conta();
    const r = pasta();
    escrever(casa, '.claude/settings.json', { enabledPlugins: { 'wicomm@wicomm': true, 'design-system@ichikawa-kit': true } });
    instalarWicomm(casa, { scope: 'user' });
    escrever(r, 'design/design-system.json', { pasta: 'web' });
    assert.equal(cedeAoAntigo(r, casa, env), false);
    assert.ok(lerConfig(r, { home: casa, env }), 'a guarda roda');
  });

  it('o wicomm ligado e instalado guarda pelo kit.json, pela opção dele ou com os dois arquivos: o design-system cede (sem guarda em dobro)', () => {
    const { casa, env } = conta();
    const pelo = (prep) => {
      const r = pasta();
      escrever(r, '.claude/settings.json', { enabledPlugins: { 'wicomm@wicomm': true, 'design-system@ichikawa-kit': true } });
      instalarWicomm(casa, { scope: 'project', projectPath: r });
      prep(r);
      return cedeAoAntigo(r, casa, env);
    };
    assert.equal(pelo((r) => escrever(r, '.claude/kit.json', { design: { pasta: 'web' } })), true, 'kit.json');
    assert.equal(pelo((r) => { escrever(r, 'design/wicomm.json', { pasta: 'web' }); escrever(r, 'design/design-system.json', { pasta: 'web' }); }), true, 'os dois arquivos');
    escrever(casa, '.claude/settings.json', { pluginConfigs: { 'wicomm@wicomm': { options: { pasta_do_front: 'web' } } } });
    assert.equal(pelo(() => {}), true, 'opção pasta_do_front do wicomm');
    escrever(casa, '.claude/settings.json', {});
    assert.equal(pelo((r) => escrever(r, 'design/wicomm.json', { pasta: 'web', guarda: false })), false, 'o wicomm com a guarda desligada não guarda');
  });

  it('o wicomm declarado no projeto mas não instalado não cala o design-system', () => {
    const { casa, env } = conta();
    const r = pasta();
    escrever(r, '.claude/settings.json', { enabledPlugins: { 'wicomm@wicomm': true, 'design-system@ichikawa-kit': true } });
    escrever(r, 'design/wicomm.json', { pasta: 'web' });
    assert.equal(cedeAoAntigo(r, casa, env), false);
    instalarWicomm(casa, { scope: 'project', projectPath: join(r, 'outro') });
    assert.equal(cedeAoAntigo(r, casa, env), false, 'instalado para outro projeto não conta');
  });
});
