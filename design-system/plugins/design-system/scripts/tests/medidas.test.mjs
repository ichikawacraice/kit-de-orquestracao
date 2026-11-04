// O contraste no plugin (correção 6 do piloto WiControl) e a concordância das cópias que o plugin carrega dos pacotes
// do repositório: o plugin é instalado sozinho, então copia; este teste reprova se uma cópia andar sem a outra.
// Rodar: npm test na raiz do repositório.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as contrasteDoPacote from '../../../../packages/tokens/lib/contraste.mjs';
import * as fonteDasGuardas from '../../../../packages/guardas/lib/fonte.mjs';
import { animacoesSemEscape as cssDasGuardas } from '../../../../packages/guardas/lib/guardas/o-movimento-tem-escape.mjs';
import { declaracoes as declDasGuardas } from '../../../../packages/guardas/lib/guardas/os-tokens-pagam-o-piso.mjs';
import { lerCor, luminancia, razao, sobre } from '../lib/contraste.mjs';
import * as fonte from '../lib/fonte.mjs';
import { lerConfigTailwind } from '../lib/tailwind-config.mjs';
import { emMarkdown, medirContraste } from '../medir-contraste.mjs';
import { TEMA_PADRAO, temaDaMedida } from '../lib/tema.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..', '..');
const CSS = readFileSync(join(AQUI, 'fixtures', 'wicontrol', 'contraste.css'), 'utf-8');

describe('medir-contraste (6): a matriz da COR-12 e a COR-11 sem importar outro pacote', () => {
  const m = medirContraste([CSS]);
  const r = (tema, par) => m[tema].linhas.find((l) => l.par === par)?.razao;

  it('reproduz os números que a auditoria do WiControl mediu à mão', () => {
    assert.equal(r('claro', '--foreground × --accent'), 13.01);
    assert.equal(r('claro', '--muted-foreground × --background'), 4.59);
    assert.equal(r('claro', '--muted-foreground × --accent'), 4.01);
    assert.equal(r('claro', '--primary-foreground × --primary'), 3.97);
    assert.equal(r('claro', '--secondary-foreground × --secondary'), 18.69);
    assert.equal(r('escuro', '--destructive × --background'), 2.95);
    assert.equal(r('claro', '--ring × --background'), 1.99);
  });
  it('a rampa no pior fundo, o transparent (CONV-03) e a marca (MARCA-01)', () => {
    assert.deepEqual(m.claro.pior['--foreground'], { razao: 13.01, piso: 14, passa: false, fundo: '--accent' });
    assert.deepEqual(m.claro.transparentes, ['--input']);
    assert.ok(m.claro.linhas.filter((l) => l.regra === 'COR-11').every((l) => !l.passa), 'contorno transparent não passa');
    assert.deepEqual(m.claro.marca, { primary: '#FF012E', igual: false, doTema: '#F30B42', tema: 'Wicomm' });
    assert.match(emMarkdown(m), /a do tema Wicomm é #F30B42/);
  });
  it('os tokens da Wicomm passam, com os 4,25 da marca aceitos pela MARCA-01', () => {
    const w = medirContraste([readFileSync(join(RAIZ, 'packages/tokens/dist/tokens.css'), 'utf-8')]);
    for (const tema of ['claro', 'escuro']) {
      assert.deepEqual(w[tema].linhas.filter((l) => !l.passa).map((l) => l.par), [], tema);
      assert.equal(w[tema].linhas.find((l) => l.regra === 'MARCA-01').razao, 4.25);
    }
  });
  it('a marca e a razão aceita vêm do tema: outro tema mede a marca dele, no piso dele', () => {
    const outro = temaDaMedida(join(RAIZ, 'packages/tokens/test/fixtures/temas/outro'));
    assert.deepEqual(outro, { id: 'outro', nome: 'Outro', marca: '#0057D9', contrasteAceito: 4.5 });
    const css = ':root { --background: #FFFFFF; --primary: #0057D9; --primary-foreground: #FEFEFE; }';
    const doOutro = medirContraste([css], outro).claro;
    const l = doOutro.linhas.find((x) => x.par === '--primary-foreground × --primary');
    assert.equal(l.regra, 'MARCA-01');
    assert.equal(l.piso, 4.5);
    assert.equal(doOutro.marca.igual, true);
    // Com o tema padrão, a mesma folha não é a marca: o par vira COR-12 comum.
    assert.equal(medirContraste([css]).claro.linhas.find((x) => x.par === '--primary-foreground × --primary').regra, 'COR-12');
  });
  it('o comando aceita --tema e acusa a pasta sem o tema', () => {
    const folha = join(RAIZ, 'packages/tokens/dist/tokens.css');
    const script = join(AQUI, '..', 'medir-contraste.mjs');
    const ok = spawnSync(process.execPath, [script, folha, '--tema', join(RAIZ, 'packages/tokens/test/fixtures/temas/outro')], { encoding: 'utf-8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /a do tema Outro é #0057D9/);
    const sem = spawnSync(process.execPath, [script, folha, '--tema'], { encoding: 'utf-8' });
    assert.equal(sem.status, 2);
  });
  it('o tema padrão do plugin é cópia do tema Wicomm do repositório', () => {
    for (const f of ['tema.json', 'tema.tokens.json']) {
      assert.equal(readFileSync(join(TEMA_PADRAO, f), 'utf-8'), readFileSync(join(RAIZ, 'temas', 'wicomm', f), 'utf-8'), f);
    }
  });
  it('lê hex curto e com alfa, rgb, hsl, os canais do shadcn e oklch', () => {
    assert.deepEqual(lerCor('#fff'), { hex: '#FFFFFF', alfa: 1 });
    assert.deepEqual(lerCor('#0000001a'), { hex: '#000000', alfa: 26 / 255 });
    assert.deepEqual(lerCor('rgb(255 0 0 / 50%)'), { hex: '#FF0000', alfa: 0.5 });
    assert.deepEqual(lerCor('hsl(0, 100%, 50%)'), { hex: '#FF0000', alfa: 1 });
    assert.deepEqual(lerCor('0 0% 100%'), { hex: '#FFFFFF', alfa: 1 });
    assert.deepEqual(lerCor('oklch(1 0 0)'), { hex: '#FFFFFF', alfa: 1 });
    assert.equal(lerCor('oklch(0.628 0.2577 29.23)').hex, '#FF0000');
    assert.deepEqual(lerCor('var(--a)', { '--a': '#000' }), { hex: '#000000', alfa: 1 });
    assert.equal(lerCor('linear-gradient(red, blue)'), null);
  });
  it('o script sai 2 sem folha e escreve a matriz com uma', () => {
    const script = join(AQUI, '..', 'medir-contraste.mjs');
    assert.equal(spawnSync('node', [script], { encoding: 'utf-8' }).status, 2);
    const ok = spawnSync('node', [script, join(AQUI, 'fixtures', 'wicontrol', 'contraste.css')], { encoding: 'utf-8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /Tema escuro/);
  });
});

describe('as cópias do plugin concordam com os pacotes', () => {
  it('a aritmética de contraste é a do @wicomm/tokens', () => {
    for (const [a, b] of [['#565D70', '#FFFFFF'], ['#F30B42', '#FFFFFF'], ['#131722', '#EBEEF5']]) {
      assert.equal(razao(a, b), contrasteDoPacote.razao(a, b));
      assert.equal(luminancia(a), contrasteDoPacote.luminancia(a));
      assert.equal(sobre(a, 0.15, b), contrasteDoPacote.sobre(a, 0.15, b));
    }
  });
  it('a leitura de fonte é a das guardas', () => {
    const fonteTsx = readFileSync(join(AQUI, 'fixtures', 'wicontrol', 'frontend', 'src', 'pages', 'Dashboard.tsx'), 'utf-8');
    assert.deepEqual(fonte.literaisDoFonte(fonteTsx), fonteDasGuardas.literaisDoFonte(fonteTsx));
    assert.deepEqual(fonte.tagsDeAbertura(fonteTsx, 'Button'), fonteDasGuardas.tagsDeAbertura(fonteTsx, 'Button'));
    for (const t of ['data-[state=open]:!animate-in', 'md:h-10', 'hover:-mt-1']) assert.deepEqual(fonte.separaVariante(t), fonteDasGuardas.separaVariante(t));
    assert.deepEqual(fonte.tokensDaLiteral('a ${b} "c"'), fonteDasGuardas.tokensDaLiteral('a ${b} "c"'));
    const css = '.a { animation: x 1s; } @media (prefers-reduced-motion: reduce) { .b { animation: none; } } .b { animation: y 1s }';
    assert.deepEqual(fonte.animacoesSemEscape(css), cssDasGuardas(css));
    assert.deepEqual(fonte.declaracoes(CSS), declDasGuardas(CSS));
  });
  it('os tokens da Wicomm que o plugin carrega são os do pacote', () => {
    const copia = JSON.parse(readFileSync(join(AQUI, '..', 'dados', 'tokens-wicomm.json'), 'utf-8')).variaveis;
    const pacote = JSON.parse(readFileSync(join(RAIZ, 'packages/tokens/dist/tokens.json'), 'utf-8')).variaveis;
    assert.deepEqual(copia, pacote, 'rode: node -e \'…\' (ver dados/tokens-wicomm.json, campo origem) para recopiar');
  });
});

describe('lerConfigTailwind', () => {
  it('lê o literal sem executar: chave entre aspas, comentário, DEFAULT, spread e lista', () => {
    const c = lerConfigTailwind(`module.exports = { theme: { /* x */ colors: { 'brand': { DEFAULT: "hsl(var(--b) / <alpha-value>)", fg: 'var(--bf)' }, ...outras, gray: colors.gray }, extend: { borderRadius: { DEFAULT: '4px' }, transitionTimingFunction: { suave: 'cubic-bezier(.2,0,0,1)' } } }, darkMode: 'media' }`);
    assert.deepEqual(c.cores, { brand: 'hsl(var(--b) / <alpha-value>)', 'brand-fg': 'var(--bf)', gray: 'colors.gray' });
    assert.deepEqual(c.semAlfa, ['brand-fg']);
    assert.deepEqual(c.raios, { '': '4px' }, 'o DEFAULT vira o nome sem sufixo (`rounded`)');
    assert.deepEqual(c.movimento, [{ onde: 'transitionTimingFunction.suave', tipo: 'curva', valor: 'cubic-bezier(.2,0,0,1)' }]);
    assert.equal(c.darkMode, "'media'");
  });
});

describe('a skill, o agente e os comandos dizem a mesma coisa (correções 7, 19, 21 e o caminho da auditoria)', () => {
  const ler = (rel) => readFileSync(join(AQUI, '..', '..', rel), 'utf-8');
  const skill = ler('skills/auditar-projeto/SKILL.md');
  const agente = ler('agents/auditor-de-padrao.md');

  it('(7) a nota por leitura de código é aceita e marcada, e o agente sem navegador a dá', () => {
    assert.match(skill, /fonte \(tela \| código\)/, 'a coluna Fonte no formato da entrega');
    assert.match(skill, /por leitura de código/);
    assert.match(agente, /por leitura de código/);
    assert.doesNotMatch(agente, /nota de tela sem a tela à vista/, 'a contradição antiga saiu');
  });
  it('(19) a densidade por rota: a skill diz como decidir, a crítica e a revisão leem a chave', () => {
    assert.match(skill, /decida \*\*por rota\*\*/);
    for (const s of ['skills/critica-de-ui/SKILL.md', 'skills/revisao-de-arquitetura-de-ui/SKILL.md', 'skills/plano-de-padronizacao/SKILL.md']) assert.match(ler(s), /densidadePorRota/, s);
  });
  it('(21) rota sem arquétipo leva o mais próximo ao lado do "nenhum"', () => {
    assert.match(skill, /nenhum \(mais próximo: /);
  });
  it('o plano aceita a auditoria em qualquer caminho e escreve uma fatia por arquivo', () => {
    assert.match(ler('skills/plano-de-padronizacao/SKILL.md'), /o caminho que a pessoa der/);
    assert.match(ler('skills/plano-de-padronizacao/SKILL.md'), /uma fatia por arquivo/);
    assert.match(ler('commands/padronizar.md'), /em qualquer pasta/);
  });
  it('as skills instalam @wicomm/* do npm público, pelo nome, sem o GitHub Packages (F357)', () => {
    const doRegistroAntigo = /@wicomm-projects|npm\.pkg\.github\.com|NODE_AUTH_TOKEN|read:packages/;
    // A régua morde: o texto de antes da troca seria pego.
    assert.match('npm install @wicomm/tokens@npm:@wicomm-projects/tokens', doRegistroAntigo);
    assert.match('@wicomm-projects:registry=https://npm.pkg.github.com', doRegistroAntigo);
    for (const nome of ['novo-projeto', 'plano-de-padronizacao', 'atualizar-sistema']) {
      const t = ler(`skills/${nome}/SKILL.md`);
      const instala = [...t.matchAll(/npm (?:install|i) ([^`\n]+)/g)].map((m) => m[1]).filter((a) => /@wicomm\//.test(a));
      assert.ok(instala.length > 0, `${nome}: nenhuma instalação de @wicomm/* achada`);
      for (const a of instala) assert.match(a, /@wicomm\/tokens(?:@<versão>)?\s+@wicomm\/guardas/, `${nome}: ${a}`);
      // O atualizar-sistema cita o registro antigo só para migrar dele.
      const semMigracao = nome === 'atualizar-sistema' ? t.replace(/\*\*Projeto instalado pelo GitHub Packages\*\*[^\n]*/, '') : t;
      assert.doesNotMatch(semMigracao, doRegistroAntigo, nome);
    }
  });
  it('os scripts que a skill manda rodar existem', () => {
    for (const m of skill.matchAll(/scripts\/([\w/-]+\.mjs)/g)) assert.ok(readFileSync(join(AQUI, '..', m[1])), m[1]);
  });
});

describe('a deriva e o contraste medem contra o tema do projeto (F345)', async () => {
  const { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { referenciaDoProjeto, tokensDoProjeto } = await import('../medir-deriva.mjs');
  const { TEMA_PADRAO, temaDoProjeto } = await import('../lib/tema.mjs');
  /** Um projeto com `design/tema/` copiado do padrão e a marca trocada. */
  const comTema = (cor) => {
    const r = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-tema-')));
    cpSync(TEMA_PADRAO, join(r, 'design', 'tema'), { recursive: true });
    const arq = join(r, 'design', 'tema', 'tema.tokens.json');
    const t = JSON.parse(readFileSync(arq, 'utf-8'));
    t.marca.cor.$value = cor;
    writeFileSync(arq, JSON.stringify(t));
    return r;
  };

  it('o mapa da marca cobre todo token do sistema que aponta para o slot da marca', async () => {
    const { variaveisDaMarca } = await import('../lib/tema.mjs');
    const sistema = readFileSync(join(AQUI, '..', '..', '..', '..', 'packages', 'tokens', 'fonte', 'sistema.tokens.json'), 'utf-8');
    const aliases = (sistema.match(/"\$value":\s*"\{marca\./g) ?? []).length;
    assert.equal(Object.keys(variaveisDaMarca().claro).length, aliases);
  });

  it('sem design/tema/, a referência é a do tema padrão', () => {
    const r = realpathSync(mkdtempSync(join(tmpdir(), 'design-system-tema-')));
    assert.equal(referenciaDoProjeto(r).claro['--primary'], temaDoProjeto(r).marca);
    rmSync(r, { recursive: true, force: true });
  });

  it('com design/tema/, a cor da marca vem dele, e o projeto que a usa não deriva', () => {
    const r = comTema('#0055FF');
    assert.equal(temaDoProjeto(r).marca, '#0055FF');
    const ref = referenciaDoProjeto(r);
    assert.equal(ref.claro['--primary'], '#0055FF');
    assert.equal(ref.escuro['--ring'], '#0055FF');
    const folhas = [{ texto: ':root { --primary: #0055FF; --ring: #0055FF; --chart-1: #0055FF; }' }];
    assert.deepEqual(tokensDoProjeto(folhas, [], '', ref).diferencas, []);
    assert.equal(tokensDoProjeto(folhas, [], '', referenciaDoProjeto(TEMA_PADRAO)).diferencas.length > 0, true, 'contra o padrão, a marca trocada deriva');
    rmSync(r, { recursive: true, force: true });
  });
});
