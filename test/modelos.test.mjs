import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nomesDoAutorEm } from './nomes-do-autor.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELOS = [
  'docs/adr/README.md', 'docs/specs/README.md', 'docs/roadmap.md', 'docs/diario/README.md',
  'docs/design/revisoes/README.md', 'docs/research/README.md', 'docs/planos/README.md',
  'front/PRODUCT.md', 'front/DESIGN.md', 'front/ANATOMIA.md', 'CLAUDE.md',
];
const PROIBIDAS = ['Wake', 'VTEX', 'apps/web'];
const ler = (f, base = join(RAIZ, 'modelos')) => readFileSync(join(base, f), 'utf8');
const citadas = (texto) => [...PROIBIDAS.filter((p) => texto.includes(p)), ...nomesDoAutorEm(texto)];
const bloco = (texto, nome) => new RegExp(`<!-- kit:${nome} v(\\d+) -->([\\s\\S]*?)<!-- /kit:${nome} -->`).exec(texto);

describe('modelos de documento (K10)', () => {
  for (const f of MODELOS) {
    test(`${f}: existe, não é vazio e não cita o produto de origem`, () => {
      assert.ok(existsSync(join(RAIZ, 'modelos', f)), `${f} não existe`);
      const t = ler(f);
      assert.ok(t.trim().length > 200, `${f} vazio ou curto demais (${t.trim().length})`);
      assert.deepEqual(citadas(t), [], `${f} cita o produto de origem`);
    });
  }

  test('o detector de palavra proibida enxerga a palavra num modelo copiado, pelo mesmo caminho (ler + citadas)', () => {
    const base = mkdtempSync(join(tmpdir(), 'kit-modelo-'));
    try {
      mkdirSync(join(base, 'docs', 'adr'), { recursive: true });
      copyFileSync(join(RAIZ, 'modelos', 'docs/adr/README.md'), join(base, 'docs/adr/README.md'));
      assert.deepEqual(citadas(ler('docs/adr/README.md', base)), []); // a cópia limpa passa
      for (const p of PROIBIDAS) {
        appendFileSync(join(base, 'docs/adr/README.md'), `\ntexto do ${p}\n`);
        assert.ok(citadas(ler('docs/adr/README.md', base)).includes(p), `o detector não enxergou "${p}"`);
      }
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('o modelo de spec traz o vocabulário fechado de status, na ordem', () => {
    const t = ler('docs/specs/README.md');
    assert.ok(t.includes('Rascunho · Em revisão · Aprovada · Implementada · Substituída'));
    assert.match(t, /Pendências:/);
  });

  test('o modelo de ADR traz "Alternativas consideradas"', () => {
    assert.match(ler('docs/adr/README.md'), /^## Alternativas consideradas/m);
  });

  test('o modelo de PRODUCT.md traz a marca de esquema do Impeccable', () => {
    assert.ok(ler('front/PRODUCT.md').includes('<!-- impeccable:product-schema 1 -->'));
  });

  test('o roadmap modelo traz o orçamento da linha (400 caracteres, 2 links)', () => {
    const t = ler('docs/roadmap.md');
    assert.match(t, /400 caracteres/); assert.match(t, /2 links/);
  });
});

describe('blocos do modelos/CLAUDE.md (K10)', () => {
  const t = ler('CLAUDE.md');

  test('kit:documentos v2 existe, fechado e com as regras de doc', () => {
    const b = bloco(t, 'documentos');
    assert.ok(b, 'bloco kit:documentos ausente'); assert.equal(b[1], '2');
    for (const frase of ['4 dígitos', 'imutável', '400 caracteres', 'diário', 'datada', 'âncora', 'mergeado', '3 dígitos', 'Pendências:', 'A spec no presente só afirma o que existe', 'no máximo 2 links']) {
      assert.ok(b[2].toLowerCase().includes(frase.toLowerCase()), `kit:documentos não diz "${frase}"`);
    }
  });

  test('kit:design v1 existe, fechado e com o fluxo, o teto e as envs do Impeccable', () => {
    const b = bloco(t, 'design');
    assert.ok(b, 'bloco kit:design ausente'); assert.equal(b[1], '1');
    for (const frase of ['24/30', 'IMPECCABLE_NO_TELEMETRY', 'IMPECCABLE_NO_UPDATE_CHECK', 'config.local.json', 'estado visível', 'nunca `hooks off`', 'O efeito entra na hora', 'Texto de UI não cita spec, ADR nem doc']) {
      assert.ok(b[2].includes(frase), `kit:design não diz "${frase}"`);
    }
  });

  test('kit:regras-de-operacao v3 declara o CI só no PR para a main (F298)', () => {
    const b = bloco(t, 'regras-de-operacao');
    assert.ok(b, 'bloco ausente'); assert.equal(b[1], '3');
    for (const frase of ['CI só no PR para a produção', 'branches: [main]', 'integração roda só os testes afetados', '`exit=0`', 'espera']) {
      assert.ok(b[2].includes(frase), `kit:regras-de-operacao não diz "${frase}"`);
    }
  });

  test('o protocolo tem a âncora ci-so-na-producao e o dona.md aponta para ela (F298)', () => {
    const pool = join(RAIZ, 'plugins/orquestracao/pool');
    const protocolo = ler('protocolo.md', pool);
    const dona = ler('dona.md', pool);
    const secao = /<a id="ci-so-na-producao"><\/a>\n## [^\n]+\n([\s\S]*?)(?=\n<a id=|$)/.exec(protocolo);
    assert.ok(secao && secao[1].trim(), 'seção ci-so-na-producao ausente ou vazia no protocolo');
    for (const frase of ['branches: [main]', '`push:`', 'protegida', 'squash', 'testes afetados', '`exit=0`', 'Por quê', 'espera', 'fila de merge']) {
      assert.ok(secao[1].includes(frase), `a seção não diz "${frase}"`);
    }
    assert.match(dona, /protocolo\.md#ci-so-na-producao/);
  });

  test('kit:regras-de-trabalho sobe para v4 e aponta para o bloco de documentos', () => {
    const b = bloco(t, 'regras-de-trabalho');
    assert.ok(b, 'bloco ausente'); assert.equal(b[1], '4');
    assert.match(b[2], /kit:documentos/);
  });
});

describe('PRODUCT.md do front: plataforma que o Impeccable reconhece (F66)', () => {
  // Mesma regra do Impeccable: a primeira linha não vazia depois do título, até o próximo título.
  const plataforma = (texto) => {
    const m = /^## Platform[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(texto);
    return m && m[1].split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  };

  test('o leitor enxerga o comentário como valor no texto antigo (a regra mede de verdade)', () => {
    assert.equal(plataforma('## Platform\n\n<!-- web | mobile | desktop -->\n\n## Users\n'), '<!-- web | mobile | desktop -->');
  });

  test('a primeira linha da seção existe, não é comentário e é uma plataforma válida', () => {
    const valor = plataforma(ler('front/PRODUCT.md'));
    assert.ok(valor, 'seção `## Platform` ausente ou vazia');
    assert.ok(!valor.startsWith('<!--'), `o valor é comentário: ${valor}`);
    assert.ok(['web', 'ios', 'android', 'adaptive'].includes(valor), `plataforma desconhecida: ${valor}`);
  });
});
