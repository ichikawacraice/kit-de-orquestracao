// F347: o resumo do início não repete o que o CLAUDE.md do projeto já traz. A regra que um bloco `kit:` cobre sai do resumo
// quando o CLAUDE.md do projeto tem esse bloco; sem o bloco (projeto que não adotou o kit), o resumo vai inteiro. Os
// comentários de marcação nunca chegam à sessão. Nada aqui toca ~/.claude: HOME e PAINEL_DIR apontam para pasta vazia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocosQueCobrem, resumoParaOProjeto } from '../regras-do-inicio.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = readFileSync(join(HOOKS, '..', '..', '..', 'modelos', 'CLAUDE.md'), 'utf8');
const REGRAS = readFileSync(join(HOOKS, 'regras-globais.md'), 'utf8');

function inicio(cwd) {
  const vazio = mkdtempSync(join(tmpdir(), 'resumo-home-'));
  try {
    const out = execFileSync('node', [join(HOOKS, 'sessao-inicio.mjs')], {
      input: JSON.stringify({ cwd }), encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: vazio, PAINEL_DIR: vazio, CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', KIT_ANFITRIAO: 'claude-desktop' }, // F443: o resumo muda pelo anfitrião; fixa a variante do app
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
  } finally { rmSync(vazio, { recursive: true, force: true }); }
}

function projeto(claude) {
  const dir = mkdtempSync(join(tmpdir(), 'resumo-proj-'));
  mkdirSync(join(dir, '.git'));
  if (claude !== null) writeFileSync(join(dir, 'CLAUDE.md'), claude);
  mkdirSync(join(dir, 'sub', 'pasta'), { recursive: true });
  return dir;
}

test('cada bloco que o resumo diz cobrir existe no modelo de CLAUDE.md, numa versão igual ou maior que a da marca', () => {
  const cobertos = blocosQueCobrem(REGRAS);
  assert.ok(cobertos.length >= 2, 'o resumo não marca nenhuma regra como coberta');
  for (const { bloco, versao } of cobertos) {
    const v = Number(new RegExp(`<!-- kit:${bloco} v(\\d+) -->`).exec(MODELO)?.[1] ?? 0);
    assert.ok(v >= versao, `o modelo tem ${bloco} v${v} e a marca pede v${versao}`);
  }
});

test('bloco de versão mais velha que a da marca não tira a regra (o CLAUDE.md desatualizado não a traz)', () => {
  const velho = MODELO.replace(/<!-- kit:(regras-de-trabalho|regras-de-operacao) v\d+ -->/g, '<!-- kit:$1 v1 -->');
  assert.notEqual(velho, MODELO, 'precondição: troquei a versão dos blocos');
  const dir = projeto(velho);
  try {
    const r = resumoParaOProjeto(REGRAS, dir);
    for (const frase of ['ponto de partida, não ordem', '**Revisão por subagente:**', 'testes-afetados']) assert.ok(r.includes(frase), `saiu com bloco velho: ${frase}`);
    assert.doesNotMatch(r, /blocos `kit:` do CLAUDE\.md/, 'a linha final diz que estão no CLAUDE.md, e não estão');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('projeto com os blocos kit: recebe o resumo sem as regras que eles já trazem, e mais curto', () => {
  const comBlocos = projeto(MODELO);
  const semBlocos = projeto('# projeto sem o kit\n');
  try {
    const curto = inicio(join(comBlocos, 'sub', 'pasta'));
    const inteiro = inicio(semBlocos);
    // a presença seria detectada: sem os blocos, a regra coberta está lá
    assert.ok(inteiro.includes('- **O pedido é ponto de partida'), 'precondição: o resumo inteiro traz a regra coberta');
    assert.ok(!curto.includes('- **O pedido é ponto de partida'), 'a regra coberta pelo CLAUDE.md continuou no resumo');
    assert.ok(!curto.includes('**Revisão por subagente:**'), 'a revisão por subagente continuou no resumo');
    // o que o CLAUDE.md não traz continua
    for (const frase of ['Q-ID', 'Achar a orquestradora', 'Não pare à toa', 'papeis-e-modelos']) assert.ok(curto.includes(frase), `sumiu do resumo: ${frase}`);
    assert.match(curto, /blocos `kit:` do CLAUDE\.md/);
    assert.ok(curto.length < inteiro.length * 0.8, `o resumo encolheu pouco: ${curto.length} de ${inteiro.length}`);
    for (const t of [curto, inteiro]) assert.ok(!t.includes('<!--'), 'comentário de marcação chegou à sessão');
  } finally { for (const d of [comBlocos, semBlocos]) rmSync(d, { recursive: true, force: true }); }
});

test('sem cwd ou sem CLAUDE.md, o resumo vai inteiro', () => {
  const nada = projeto(null);
  try {
    const inteiro = resumoParaOProjeto(REGRAS, undefined);
    assert.ok(inteiro.includes('ponto de partida, não ordem') && !inteiro.includes('<!--'));
    assert.equal(resumoParaOProjeto(REGRAS, nada), inteiro);
  } finally { rmSync(nada, { recursive: true, force: true }); }
});

test('marca de abertura solta ou bloco vazio não tira a regra', () => {
  for (const claude of ['# p\n<!-- kit:regras-de-trabalho v4 -->\nsem fechar\n', '# p\n<!-- kit:regras-de-trabalho v4 -->\n<!-- /kit:regras-de-trabalho -->\n']) {
    const dir = projeto(claude);
    try { assert.ok(resumoParaOProjeto(REGRAS, dir).includes('- **O pedido é ponto de partida'), claude); } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('só o bloco que existe tira a regra: CLAUDE.md com um dos blocos tira só as regras dele', () => {
  const trabalho = MODELO.match(/<!-- kit:regras-de-trabalho v\d+ -->[\s\S]*?<!-- \/kit:regras-de-trabalho -->/)?.[0];
  assert.ok(trabalho, 'precondição: o modelo tem o bloco regras-de-trabalho');
  const dir = projeto(`# p\n\n${trabalho}\n`);
  try {
    const r = resumoParaOProjeto(REGRAS, dir);
    assert.ok(!r.includes('- **O pedido é ponto de partida'));
    assert.ok(r.includes('**Revisão por subagente:**'), 'tirou regra de bloco que o projeto não tem');
    assert.match(r, /CLAUDE\.md deste projeto: O pedido é ponto de partida, não ordem\.$/m, 'a linha final cita o que não saiu');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
