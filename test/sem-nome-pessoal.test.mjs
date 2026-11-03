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

// A entrada do marketplace que pode citar a marca da empresa no texto (F350): o plugin de tema dela. As outras, não.
const ENTRADA_DA_MARCA = 'tema-wicomm';

/**
 * O texto que conta: o manifesto perde o campo de autor e dono (é o usuário que publica), a entrada do tema da empresa perde o
 * texto de exibição, e o endereço publicado vira `DONO/…`.
 */
function textoQueConta(p, t = readFileSync(p, 'utf8')) {
  if (['plugin.json', 'marketplace.json'].includes(basename(p))) {
    const j = JSON.parse(t);
    delete j.author; delete j.owner;
    for (const pl of j.plugins ?? []) {
      delete pl.author;
      if (basename(p) === 'marketplace.json' && pl.name === ENTRADA_DA_MARCA) { delete pl.description; delete pl.displayName; }
    }
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

  it('a marca da empresa passa só nos nomes fixos e no texto da entrada do tema (F350)', () => {
    const marca = Buffer.from('d2ljb21t', 'base64').toString();
    const Marca = `${marca[0].toUpperCase()}${marca.slice(1)}`;
    assert.deepEqual(nomesDoAutorEm(`o ${Marca} decide`), [marca], 'precondição: a marca sozinha é pega');
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`tema-${marca}@ichikawa-kit e ${marca}-projects/${marca}-design-system`)), []);
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`${marca}-projects/outro e tema-${marca}x`)).length > 0, true, 'outra forma continua barrada');
    // F357: os dois pacotes no npm passam; outro pacote do escopo, não
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`npm i @${marca}/tokens @${marca}/guardas`)), []);
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`npm i @${marca}/registro`)), [marca]);
    assert.deepEqual(nomesDoAutorEm(semOEnderecoPublicado(`npm i @${marca}/tokens-x @${marca}/guardas.y`)), [marca], 'nome que só começa igual continua barrado');
    const mk = (desc) => JSON.stringify({ name: 'm', owner: { name: 'x' }, plugins: [{ name: 'design-system', description: desc('design-system') }, { name: `tema-${marca}`, description: desc(`tema-${marca}`) }] });
    const so = (nome) => (n) => (n === nome ? `o tema ${Marca}` : 'genérico');
    assert.deepEqual(nomesDoAutorEm(textoQueConta('x/marketplace.json', mk(so(`tema-${marca}`)))), [], 'na entrada do tema a marca passa');
    assert.deepEqual(nomesDoAutorEm(textoQueConta('x/marketplace.json', mk(so('design-system')))), [marca], 'na do design-system, não');
    assert.deepEqual(nomesDoAutorEm(textoQueConta('x/plugin.json', JSON.stringify({ name: `tema-${marca}`, description: `o tema ${Marca}` }))), [marca], 'só o marketplace tem a exceção');
  });

  it('nenhum arquivo publicado cita nome do autor nem pasta pessoal', () => {
    assert.deepEqual(achados(arquivos()), []);
  });
});
