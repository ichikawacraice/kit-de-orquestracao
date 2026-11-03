// F350: o design system da empresa entra no marketplace do kit como dois plugins opcionais: o `design-system` (genérico, o sucessor
// do `kit-design`) e o `tema-wicomm` (a marca). F357: o código mora neste repositório, em design-system/ (ADR 0020); o `kit iniciar`
// liga só o `design-system` (F353) e a trava lê o `design-system:` como prefixo do kit.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGINS_DO_KIT } from '../cli/pacote.mjs';
import { semPrefixoDoKit } from '../plugins/orquestracao/hooks/hooks-crewai-comum.mjs';
import { nomesDoAutorEm } from './nomes-do-autor.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
const NOMES = ['design-system', 'tema-wicomm'];
const entrada = (nome) => m.plugins.find((p) => p.name === nome);

describe('o marketplace lista o design system da empresa', () => {
  it('as duas entradas existem e apontam a pasta do plugin em design-system/plugins/', () => {
    const [ds, tema] = NOMES.map(entrada);
    assert.ok(ds && tema, `fora do marketplace: ${m.plugins.map((p) => p.name)}`);
    for (const [nome, e] of [['design-system', ds], ['tema-wicomm', tema]]) {
      assert.equal(e.source, `./design-system/plugins/${nome}`, nome);
      const manifesto = join(RAIZ, e.source, '.claude-plugin', 'plugin.json');
      assert.ok(existsSync(manifesto), `${nome}: sem ${manifesto}`);
      assert.equal(JSON.parse(readFileSync(manifesto, 'utf8')).name, nome, `${nome}: o plugin.json tem o nome da entrada`);
    }
  });

  it('a entrada do design-system é genérica; a marca só aparece na do tema', () => {
    const ds = entrada('design-system');
    assert.ok(ds.description?.length > 0, 'sem descrição');
    assert.deepEqual(nomesDoAutorEm(ds.description), [], ds.description);
    assert.ok(nomesDoAutorEm(entrada('tema-wicomm').description).length > 0, 'precondição: o detector vê a marca na descrição do tema');
  });

  it('cada um aparece uma vez só no marketplace', () => {
    for (const nome of NOMES) assert.equal(m.plugins.filter((p) => p.name === nome).length, 1, `${nome} duplicado`);
  });

  it('kit iniciar liga o design-system (F353: sucede o kit-design) e não o tema', () => {
    assert.ok(PLUGINS_DO_KIT.length >= 3, `precondição: lista lida: ${PLUGINS_DO_KIT}`);
    assert.ok(PLUGINS_DO_KIT.includes('design-system@ichikawa-kit'), PLUGINS_DO_KIT.join());
    assert.ok(!PLUGINS_DO_KIT.some((id) => id.startsWith('tema-')), PLUGINS_DO_KIT.join());
  });
});

describe('a trava lê o design-system como plugin do kit', () => {
  it('semPrefixoDoKit tira design-system: e deixa outro prefixo como chega', () => {
    assert.equal(semPrefixoDoKit('design-system:designer'), 'designer');
    assert.equal(semPrefixoDoKit('design-system:critico-de-ui'), 'critico-de-ui');
    assert.equal(semPrefixoDoKit('design-systemx:designer'), 'design-systemx:designer');
    assert.equal(semPrefixoDoKit('tema-wicomm:designer'), 'tema-wicomm:designer', 'o tema não ganha papel');
  });
});
