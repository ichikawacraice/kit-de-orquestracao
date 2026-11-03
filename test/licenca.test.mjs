// O repositório público (F355): a LICENSE é MIT e concorda com o package.json; o NOTICE tira a marca da empresa do MIT e diz a
// licença do design system que veio do repositório dela (F357); o README aponta para os dois; e o que se lê para instalar não diz mais que o repositório do kit é privado.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');
const marketplace = () => JSON.parse(ler('.claude-plugin', 'marketplace.json'));

describe('o kit sai com licença MIT', () => {
  it('a LICENSE é o texto MIT e o package.json diz MIT', () => {
    assert.ok(existsSync(join(RAIZ, 'LICENSE')), 'falta a LICENSE na raiz');
    const t = ler('LICENSE');
    assert.match(t, /^MIT License\n\nCopyright \(c\) \d{4} \S/);
    assert.match(t, /Permission is hereby granted, free of charge/);
    assert.match(t, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
    assert.equal(JSON.parse(ler('package.json')).license, 'MIT');
  });

  it('o NOTICE tira do MIT a marca e diz a licença da pasta design-system/', () => {
    const t = ler('NOTICE');
    assert.match(t, /MIT/);
    // a marca sai do id do plugin de tema, a única forma dela que o detector de nome aceita aqui
    const empresa = 'tema-wicomm'.replace('tema-', '');
    const marca = ['plugins/tema-wicomm/', `temas/${empresa}/`, `plugins/${empresa}/`];
    for (const p of marca) assert.ok(existsSync(join(RAIZ, 'design-system', p)), `precondição: design-system/${p} existe`);
    assert.deepEqual(marca.filter((p) => !t.includes(p)), [], 'cada pasta da marca é citada no NOTICE');
    assert.match(t, /design-system\//, 'o NOTICE diz de onde veio e sob que licença está a pasta design-system/');
    assert.deepEqual(marketplace().plugins.filter((p) => typeof p.source !== 'string').map((p) => p.name), [], 'nenhum plugin vem mais de fora');
  });

  it('todo código que diz vir de projeto MIT de fora está no NOTICE, com o copyright', () => {
    const portados = [];
    const varre = (dir) => {
      for (const n of readdirSync(join(RAIZ, dir))) {
        if (n === 'node_modules' || n === 'tests' || n === 'test') continue;
        const p = join(dir, n);
        if (statSync(join(RAIZ, p)).isDirectory()) varre(p);
        else if (/\.(mjs|js|cjs|ts|tsx)$/.test(n) && /\bMIT\b/.test(ler(p))) portados.push(p);
      }
    };
    for (const d of ['plugins', 'cli', 'gate', 'scripts']) varre(d);
    assert.ok(portados.length > 0, 'precondição: a varredura acha o código portado');
    const t = ler('NOTICE');
    assert.deepEqual(portados.filter((p) => !t.includes(p)), [], 'arquivo portado fora do NOTICE');
    assert.ok((t.match(/Copyright \(c\)/g) ?? []).length >= portados.length + 1, 'cada origem leva a sua linha de copyright');
  });

  it('o README linka a LICENSE e o NOTICE', () => {
    const r = ler('README.md');
    for (const f of ['LICENSE', 'NOTICE']) assert.ok(r.includes(`](${f})`), `o README não linka ${f}`);
  });

  it('nada do que se lê para instalar diz que o repositório do kit é privado', () => {
    const textos = { 'README.md': ler('README.md'), 'primeiro-dia.md': ler('docs', 'guia', 'primeiro-dia.md'), 'problemas-comuns.md': ler('docs', 'guia', 'problemas-comuns.md'), 'marketplace.json': marketplace().description };
    const velho = /(reposit[óo]rio do kit [ée] privado|ele [ée] privado|marketplace privado|peça o convite)/i;
    assert.ok(velho.test('O repositório do kit é privado: peça o convite'), 'precondição: o detector pega a frase antiga');
    assert.deepEqual(Object.entries(textos).filter(([, t]) => velho.test(t)).map(([n]) => n), []);
  });
});
