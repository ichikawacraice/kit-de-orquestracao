// F59: testes do skills/orquestradora/scripts/ausencia.mjs (resumo do período do modo ausente).
// Tudo em pasta temporária: HOOKS_CREWAI_BASE, PAINEL_DIR e um repositório git com origin/main de verdade.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'ausencia.mjs');
const GIT = (cwd, args, env = {}) => execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { timeout: 15000, killSignal: 'SIGKILL', stdio: 'ignore', env: { ...process.env, ...env } });
const haH = (h) => new Date(Date.now() - h * 3600_000).toISOString();

function ambiente() {
  const raiz = mkdtempSync(join(tmpdir(), 'ausencia-'));
  const base = join(raiz, 'orq'); const painel = join(base, 'painel');
  for (const c of ['fila', 'perguntas', 'sessoes']) mkdirSync(join(painel, c), { recursive: true });
  // repo "proj" com remoto bare: 3 commits na main (um antes do período, dois dentro, um deles sem PR)
  const bare = join(raiz, 'remoto.git'); const repo = join(raiz, 'proj');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare], { timeout: 15000, killSignal: 'SIGKILL' });
  mkdirSync(repo); execFileSync('git', ['init', '-q', '-b', 'main', repo], { timeout: 15000, killSignal: 'SIGKILL' });
  GIT(repo, ['remote', 'add', 'origin', bare]);
  const commit = (msg, quando) => GIT(repo, ['commit', '-q', '--allow-empty', '-m', msg], { GIT_AUTHOR_DATE: quando, GIT_COMMITTER_DATE: quando });
  commit('feat: antigo (#1)', haH(30)); commit('feat(a): dentro do período (#7)', haH(8)); commit('chore: sem número de PR', haH(6)); commit('feat: depois do período (#9)', haH(1));
  GIT(repo, ['push', '-q', 'origin', 'main']);
  const grava = (colecao, id, data) => writeFileSync(join(painel, colecao, `${id}.json`), JSON.stringify({ id, version: 1, data }));
  const env = { ...process.env, HOOKS_CREWAI_BASE: base, PAINEL_DIR: painel, HOME: join(raiz, 'home') };
  const rodar = (...args) => spawnSync('node', [SCRIPT, ...args], { env, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', cwd: repo });
  const bandeira = (o) => writeFileSync(join(base, 'operador-ausente.json'), JSON.stringify(o));
  return { raiz, base, painel, repo, grava, rodar, bandeira };
}
const periodo = { desde: haH(12), ate: haH(2) };

test('periodo: null com a bandeira ligada ou sem arquivo; com o off devolve {desde, ate, por}', () => {
  const a = ambiente();
  assert.equal(JSON.parse(a.rodar('periodo').stdout), null);
  a.bandeira({ desde: periodo.desde, por: 'comando' });
  assert.equal(JSON.parse(a.rodar('periodo').stdout), null, 'ligada não tem período');
  a.bandeira({ ligado: false, desde: periodo.desde, desligadoEm: periodo.ate, por: 'painel' });
  const r = JSON.parse(a.rodar('periodo').stdout);
  assert.deepEqual(r, { desde: periodo.desde, ate: periodo.ate, por: 'painel' });
  a.bandeira({ ligado: false, desligadoEm: periodo.ate });
  assert.equal(JSON.parse(a.rodar('periodo').stdout), null, 'sem desde não há período');
});

test('resumo: cada seção traz o de dentro do período e deixa de fora o de fora', () => {
  const a = ambiente();
  const dentro = haH(5); const fora = haH(40);
  a.bandeira({ ligado: false, desde: periodo.desde, desligadoEm: periodo.ate, por: 'comando' });
  // itens do projeto "proj" (o basename da pasta do repo)
  a.grava('fila', 'F1', { titulo: 'feito dentro', projeto: 'proj', etapa: 'feito', feitoEm: dentro, prs: [7], historico: [{ em: dentro, etapa: 'feito', dono: null }] });
  a.grava('fila', 'F2', { titulo: 'feito fora', projeto: 'proj', etapa: 'feito', feitoEm: fora, historico: [{ em: fora, etapa: 'feito', dono: null }] });
  a.grava('fila', 'F3', { titulo: 'andou', projeto: 'proj', etapa: 'validacao', dono: 'V1', com: ['V1'], historico: [{ em: haH(50), etapa: 'execucao', dono: 'E1' }, { em: dentro, etapa: 'validacao', dono: 'V1' }] });
  a.grava('fila', 'F4', { titulo: 'parado travado', projeto: 'proj', etapa: 'execucao', dono: 'E2', trava: { motivo: 'operador', texto: 'falta a chave' }, historico: [{ em: fora, etapa: 'execucao', dono: 'E2' }] });
  a.grava('fila', 'F5', { titulo: 'parado em espera', projeto: 'proj', etapa: 'execucao', dono: 'E3', espera: { motivo: 'operador', texto: 'aprovar o plano' }, historico: [{ em: fora, etapa: 'execucao', dono: 'E3' }] });
  a.grava('fila', 'F6', { titulo: 'sem ninguém', projeto: 'proj', etapa: 'planejamento', historico: [{ em: fora, etapa: 'planejamento', dono: null }] });
  a.grava('fila', 'F7', { titulo: 'de outro projeto', projeto: 'outro', etapa: 'feito', feitoEm: dentro, historico: [] });
  a.grava('fila', 'F8', { titulo: 'antigo no formato de/para', projeto: 'proj', etapa: 'validacao', dono: 'V1', historico: [{ em: dentro.slice(0, 10), de: 'E3', para: 'V1', por: 'P3' }] });
  a.grava('sessoes', 'local_S1', { projeto: 'proj', titulo: 'D1 · livre', estado: 'concluida', atualizadoEm: dentro });
  a.grava('sessoes', 'local_S2', { projeto: 'proj', titulo: 'arquivada antes', estado: 'concluida', atualizadoEm: fora });
  a.grava('sessoes', 'local_S3', { projeto: 'proj', titulo: 'ativa', estado: 'trabalhando', atualizadoEm: dentro });
  a.grava('perguntas', 'Q1', { projeto: 'proj', titulo: 'assumida dentro', estado: 'assumida', criadaEm: dentro, atualizadoEm: dentro });
  a.grava('perguntas', 'Q2', { sessaoId: 'local_S3', titulo: 'assumida antiga, projeto pela sessão', estado: 'assumida', criadaEm: fora, atualizadoEm: fora });
  a.grava('perguntas', 'Q3', { projeto: 'proj', titulo: 'aberta', estado: 'aberta', criadaEm: dentro });
  a.grava('perguntas', 'Q4', { projeto: 'proj', titulo: 'respondida', estado: 'respondida', criadaEm: dentro });
  a.grava('perguntas', 'Q6', { sessaoId: 'local_inexistente', titulo: 'assumida sem projeto', estado: 'assumida', criadaEm: dentro });
  a.grava('perguntas', 'Q7', { titulo: 'aberta sem projeto nem sessão', estado: 'aberta', criadaEm: dentro });
  a.grava('perguntas', 'Q8', { titulo: 'respondida sem projeto', estado: 'respondida', criadaEm: dentro });
  a.grava('perguntas', 'Q5', { projeto: 'outro', titulo: 'assumida de outro', estado: 'assumida', criadaEm: dentro });
  writeFileSync(join(a.painel, 'fila', 'F99.json'), '{quebrado');
  const r = a.rodar('resumo', '--repo', a.repo);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  const ids = (l) => l.map((x) => x.id).sort();
  assert.deepEqual(j.periodo, { desde: periodo.desde, ate: periodo.ate });
  // main: o commit antigo fica fora, o com (#7) traz o pr, o sem número traz null
  assert.deepEqual(j.main.map((m) => m.pr).sort(), [7, null].sort());
  assert.ok(!j.main.some((m) => /depois do período/.test(m.titulo) || m.pr === 9), 'commit depois do ate apareceu em main');
  assert.ok(j.main.every((m) => m.sha && m.titulo));
  assert.deepEqual(ids(j.itens.feitos), ['F1']);
  assert.deepEqual(ids(j.itens.andaram), ['F3', 'F8']);
  assert.equal(j.itens.andaram.find((i) => i.id === 'F3').de, 'execucao');
  assert.equal(j.itens.andaram.find((i) => i.id === 'F3').para, 'validacao');
  assert.equal(j.itens.andaram.find((i) => i.id === 'F8').de, 'E3');
  assert.deepEqual(ids(j.itens.parados), ['F4', 'F5', 'F6']);
  const motivo = (id) => j.itens.parados.find((i) => i.id === id).motivo;
  assert.equal(motivo('F4'), 'travado: falta a chave');
  assert.match(motivo('F5'), /^espera operador: aprovar o plano/);
  assert.equal(motivo('F6'), 'sem ninguém');
  assert.deepEqual(ids(j.perguntas.assumidas), ['Q1', 'Q2']);
  assert.equal(j.perguntas.assumidas.find((q) => q.id === 'Q1').noPeriodo, true);
  assert.equal(j.perguntas.assumidas.find((q) => q.id === 'Q2').noPeriodo, false);
  assert.deepEqual(ids(j.perguntas.abertas), ['Q3']);
  assert.deepEqual(ids(j.perguntas.semProjeto), ['Q6', 'Q7'], 'só assumida e aberta, sem projeto resolvido');
  assert.ok(j.perguntas.semProjeto.every((q) => q.estado === 'assumida' || q.estado === 'aberta'));
  assert.deepEqual(j.sessoesArquivadas.map((s) => s.id), ['local_S1']);
  const pede = j.pedeAcao.map((p) => `${p.tipo}:${p.id}`).sort();
  assert.deepEqual(pede, ['espera:F5', 'pergunta:Q1', 'pergunta:Q2', 'pergunta:Q3', 'pergunta:Q6', 'pergunta:Q7', 'trava:F4'].sort());
  assert.ok(j.avisos.some((x) => /F99/.test(x)), `JSON quebrado devia ir a avisos: ${j.avisos}`);
  const md = a.rodar('resumo', '--repo', a.repo, '--md').stdout;
  assert.ok(/sem projeto/i.test(md) && md.includes('Q6'), `o --md não mostra o bloco sem projeto: ${md}`);
  assert.ok(md.includes('feito dentro') && md.includes('Q1') && md.includes('dentro do período'), md);
});

test('resumo: sem período e sem --desde/--ate falha com mensagem; --desde/--ate valem sem bandeira', () => {
  const a = ambiente();
  const r = a.rodar('resumo', '--repo', a.repo);
  assert.equal(r.status, 1); assert.match(r.stderr, /período/);
  const ok = a.rodar('resumo', '--repo', a.repo, '--desde', periodo.desde, '--ate', periodo.ate);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).periodo.desde, periodo.desde);
});

test('resumo: data só-dia vale como o dia inteiro em UTC, qualquer que seja a hora do período', () => {
  const a = ambiente();
  const h = (em) => [{ em, de: 'E3', para: 'V1', por: 'P3' }];
  for (const [id, em] of [['G1', '2026-10-24'], ['G2', '2026-10-23'], ['G3', '2026-10-25']]) {
    a.grava('fila', id, { titulo: id, projeto: 'proj', etapa: 'validacao', dono: 'V1', historico: h(em) });
  }
  const r = a.rodar('resumo', '--repo', a.repo, '--desde', '2026-10-24T10:00:00.000Z', '--ate', '2026-10-24T20:00:00.000Z');
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  const ids = (l) => l.map((x) => x.id).sort();
  assert.ok(j.itens.andaram.length > 0 && j.itens.parados.length > 0, 'seções vazias: o teste não mediria nada');
  assert.deepEqual(ids(j.itens.andaram), ['G1']);
  assert.equal(j.itens.andaram[0].de, 'E3');
  assert.deepEqual(ids(j.itens.parados), ['G2', 'G3']);
});

test('pendente/entregue: ≤ 7 dias sem entrega devolve o período; entregue grava e zera; 8 dias não cobra', () => {
  const a = ambiente();
  assert.equal(JSON.parse(a.rodar('pendente').stdout), null, 'sem bandeira');
  a.bandeira({ ligado: false, desde: periodo.desde, desligadoEm: periodo.ate, por: 'painel' });
  const p = JSON.parse(a.rodar('pendente').stdout);
  assert.deepEqual(p, { desde: periodo.desde, ate: periodo.ate }, 'a presença tem de ser detectada antes de medir a ausência');
  const e = a.rodar('entregue', '--repo', a.repo);
  assert.equal(e.status, 0, e.stderr);
  const arq = join(a.base, 'ausencias', `${periodo.desde.replaceAll(':', '-')}--proj.json`);
  assert.ok(existsSync(arq), `sem o arquivo de entrega: ${arq}`);
  const g = JSON.parse(readFileSync(arq, 'utf8'));
  assert.equal(g.projeto, 'proj'); assert.ok(g.entregueEm); assert.ok(g.resumo?.periodo);
  assert.equal(JSON.parse(a.rodar('pendente').stdout), null, 'entregue zera o pendente do projeto');
  assert.deepEqual(JSON.parse(a.rodar('pendente', '--projeto', 'outro').stdout), { desde: periodo.desde, ate: periodo.ate }, 'outro projeto segue pendente');
  const velho = ambiente();
  velho.bandeira({ ligado: false, desde: haH(24 * 9), desligadoEm: haH(24 * 8), por: 'painel' });
  assert.equal(JSON.parse(velho.rodar('pendente').stdout), null, '8 dias já não cobra');
  const sem = ambiente();
  const s = sem.rodar('entregue'); assert.equal(s.status, 1); assert.match(s.stderr, /período/);
});

test('F183: a pergunta que a migração marcou `sem-projeto` segue em semProjeto e pede ação', () => {
  const a = ambiente();
  a.bandeira({ ligado: false, desde: periodo.desde, desligadoEm: periodo.ate, por: 'painel' });
  a.grava('perguntas', 'Q9', { projeto: 'sem-projeto', titulo: 'assumida que a migração não resolveu', estado: 'assumida', criadaEm: haH(5) });
  a.grava('perguntas', 'Q10', { projeto: 'proj', titulo: 'do projeto', estado: 'aberta', criadaEm: haH(5) });
  a.grava('sessoes', 'local_semprojeto', { sessionId: 'local_semprojeto', projeto: 'sem-projeto' });
  a.grava('perguntas', 'Q11', { projeto: 'sem-projeto', sessaoId: 'local_semprojeto', titulo: 'da sessão também sem projeto', estado: 'assumida', criadaEm: haH(5) });
  const j = JSON.parse(a.rodar('resumo', '--repo', a.repo).stdout);
  assert.deepEqual(j.perguntas.abertas.map((q) => q.id), ['Q10'], 'a presença de uma pergunta do projeto é medida');
  assert.deepEqual(j.perguntas.semProjeto.map((q) => q.id).sort(), ['Q11', 'Q9']);
  assert.ok(j.pedeAcao.some((p) => p.id === 'Q9') && j.pedeAcao.some((p) => p.id === 'Q11'));
});
