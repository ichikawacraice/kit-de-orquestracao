import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nomesDoAutorEm, semOEnderecoPublicado } from './nomes-do-autor.mjs';

// O que o kit publica não cita nome de projeto nem de pessoa do autor, nem caminho da pasta pessoal de alguém.
// Fica de fora o histórico datado (docs/), que não se reescreve; o guia de uso (docs/guia/) é publicado e entra.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTAS = ['plugins', 'cli', 'gate', 'scripts', 'test', 'modelos', '.claude-plugin', 'docs/guia'];
const AVULSOS = ['README.md', 'CLAUDE.md', 'package.json'];
const TEXTO = /\.(md|mjs|js|cjs|ts|tsx|json|sh|html|css|txt)$/;
// a pasta pessoal de alguém; os nomes genéricos dos testes (`/Users/x`, `/home/teste`…) passam
const CASA = /\/(?:Users|home)\/(?!(?:x|teste|usuario|user|fulano)(?![\w.-]))[a-z][\w.-]*/;

function arquivos() {
  const lista = AVULSOS.map((f) => join(RAIZ, f));
  const varre = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === '.git') continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) varre(p);
      else if (TEXTO.test(n) || ['painel', 'proxima-pergunta', 'proximo-item'].includes(n)) lista.push(p);
    }
  };
  for (const d of PASTAS) varre(join(RAIZ, d));
  return lista;
}

/** O texto que conta: o manifesto perde o campo de autor e dono (é o usuário que publica), e o endereço publicado vira `DONO/…`. */
function textoQueConta(p) {
  let t = readFileSync(p, 'utf8');
  if (['plugin.json', 'marketplace.json'].includes(basename(p))) {
    const j = JSON.parse(t);
    delete j.author; delete j.owner;
    for (const pl of j.plugins ?? []) delete pl.author;
    t = JSON.stringify(j);
  }
  return semOEnderecoPublicado(t);
}

const achados = (lista) => lista.flatMap((p) => textoQueConta(p).split('\n').flatMap((l, i) => {
  const onde = `${relative(RAIZ, p)}:${i + 1}`;
  return [...nomesDoAutorEm(l).map(() => `${onde} (nome do autor)`), ...(CASA.test(l) ? [`${onde} (pasta pessoal)`] : [])];
}));

describe('o kit sai sem nome pessoal', () => {
  it('a varredura pega arquivos de todas as pastas publicadas', () => {
    const lista = arquivos();
    for (const d of [...PASTAS, ...AVULSOS]) assert.ok(lista.some((p) => relative(RAIZ, p).startsWith(d)), `nada lido em ${d}`);
  });

  it('o detector enxerga um nome do autor, a pasta pessoal, e deixa passar o endereço publicado e o caminho genérico', () => {
    // o detector é exercitado pelos mesmos caminhos (nomesDoAutorEm, CASA, semOEnderecoPublicado) com palavras que só existem em hash
    const amostra = Buffer.from('aXphbmFnaQ==', 'base64').toString();
    assert.deepEqual(nomesDoAutorEm(`o projeto ${amostra.toUpperCase()}_X`), [amostra]);
    assert.ok(CASA.test(['', 'Users', 'maria', 'Developer'].join('/')) && CASA.test(['', 'home', 'maria'].join('/')));
    assert.ok(!CASA.test('/Users/x/Developer') && !CASA.test("'/home/teste'"));
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`npx -y github:${amostra}/kit-de-orquestracao`)), []);
    // o nome do kit passa nas duas formas; o sobrenome dele sozinho, não
    const marca = Buffer.from('aWNoaWthd2E=', 'base64').toString();
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`orquestracao@${marca}-kit e ${marca[0].toUpperCase()}${marca.slice(1)}'s Kit`)), []);
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`o ${marca} disse`)), [marca]);
  });

  it('nenhum arquivo publicado cita nome do autor nem pasta pessoal', () => {
    assert.deepEqual(achados(arquivos()), []);
  });
});
