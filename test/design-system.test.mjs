// F350: o design system da empresa entra no marketplace do kit como dois plugins opcionais, vindos do repositório dela por
// git-subdir num commit fixo: o `design-system` (genérico, o sucessor do `kit-design`) e o `tema-wicomm` (a marca). O kit não
// os traz para este repositório, o `kit iniciar` não os liga e a trava lê o `design-system:` como prefixo do kit.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  it('as duas entradas existem, por git-subdir, do mesmo repositório e no mesmo commit fixo', () => {
    const [ds, tema] = NOMES.map(entrada);
    assert.ok(ds && tema, `fora do marketplace: ${m.plugins.map((p) => p.name)}`);
    for (const [nome, e] of [['design-system', ds], ['tema-wicomm', tema]]) {
      assert.equal(e.source?.source, 'git-subdir', nome);
      assert.equal(e.source.path, `plugins/${nome}`, `${nome}: a pasta tem o nome do plugin`);
      assert.match(e.source.sha, /^[0-9a-f]{40}$/, `${nome}: sha completo, em minúsculas`);
      assert.equal(e.source.ref, 'main', nome);
    }
    assert.equal(ds.source.url, tema.source.url, 'o mesmo repositório');
    assert.equal(ds.source.sha, tema.source.sha, 'o mesmo commit: o tema e a base andam juntos');
    assert.match(ds.source.url, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/);
  });

  it('a entrada do design-system é genérica; a marca só aparece na do tema', () => {
    const ds = entrada('design-system');
    assert.ok(ds.description?.length > 0, 'sem descrição');
    assert.deepEqual(nomesDoAutorEm(ds.description), [], ds.description);
    assert.ok(nomesDoAutorEm(entrada('tema-wicomm').description).length > 0, 'precondição: o detector vê a marca na descrição do tema');
  });

  it('nada do design system mora neste repositório', () => {
    for (const nome of NOMES) assert.equal(m.plugins.filter((p) => p.name === nome).length, 1, `${nome} duplicado`);
    assert.ok(m.plugins.filter((p) => typeof p.source === 'string').every((p) => !NOMES.includes(p.name)));
  });

  it('kit iniciar não os liga (opcionais)', () => {
    assert.ok(PLUGINS_DO_KIT.length >= 3, `precondição: lista lida: ${PLUGINS_DO_KIT}`);
    for (const nome of NOMES) assert.ok(!PLUGINS_DO_KIT.some((id) => id.startsWith(`${nome}@`)), nome);
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
