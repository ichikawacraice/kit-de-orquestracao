#!/usr/bin/env node
// Testes do migrar-fila.mjs (F27, fatia 2). Nunca toca o painel real: PAINEL_DIR e POOL_ITENS_DIR são temporários.
// Rodar: node hooks/tests/migrar-fila.test.mjs   (KIT_F27_FOTO=<pasta fila-antes> liga o caso da foto real)
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
// A foto do painel real de 25/10 mora na máquina do operador (backups/F27-2/fila-antes); sem KIT_F27_FOTO o caso dela é pulado (teste não lê o ~/.claude real).
const SNAPSHOT = process.env.KIT_F27_FOTO;
let raiz, painelDir, poolDir;

const L1 = 'local_00000000-0000-4000-8000-0000000000a1';
const L2 = 'local_00000000-0000-4000-8000-0000000000a2';
function novo() {
  raiz = mkdtempSync(join(tmpdir(), 'migrar-fila-'));
  painelDir = join(raiz, 'orquestracao', 'painel'); poolDir = join(raiz, 'orquestracao', 'pool', 'itens');
  for (const d of ['fila', 'sessoes', 'perguntas']) mkdirSync(join(painelDir, d), { recursive: true });
  mkdirSync(poolDir, { recursive: true });
  writeFileSync(join(painelDir, 'temas.json'), JSON.stringify([
    { id: 'editor', rotulo: 'Editor' }, { id: 'motor', rotulo: 'Motor' },
    { id: 'gate', rotulo: 'Gate' }, { id: 'orquestracao', rotulo: 'Orquestração' },
    { id: 'kit', rotulo: 'Kit' }]));
  writeFileSync(join(painelDir, 'sessoes', `${L1}.json`), JSON.stringify({ id: L1, version: 1, data: { titulo: 'P1 · editor da loja' } }));
  writeFileSync(join(painelDir, 'sessoes', `${L2}.json`), JSON.stringify({ id: L2, version: 1, data: { titulo: 'E4 · fatia' } }));
}
const fim = () => rmSync(raiz, { recursive: true, force: true });
const env = () => { const e = { ...process.env, PAINEL_DIR: painelDir, POOL_ITENS_DIR: poolDir, CLAUDE_CODE_SESSION_ID: '', HOME: raiz }; delete e.KIT_PROJETO; return e; };
function run(script, args, extra = {}) {
  const r = spawnSync('node', [join(SCRIPTS, script), ...args], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: env(), ...extra });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const migrar = (...a) => run('migrar-fila.mjs', a);
const painel = (...a) => run('painel.mjs', a);
const item = (id, data, version = 1) => writeFileSync(join(painelDir, 'fila', `${id}.json`), JSON.stringify({ id, version, data: { projeto: 'izanagi', titulo: `t ${id}`, atualizadoEm: '2026-10-20T10:00:00.000Z', ...data } }));
const lido = (id) => JSON.parse(readFileSync(join(painelDir, 'fila', `${id}.json`), 'utf8'));
const igual = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
function caso(nome, fn, opcoes = {}) { test(nome, opcoes, () => { novo(); try { fn(); } finally { fim(); } }); }
const ANTIGOS = ['estado', 'proximoPapel', 'frente', 'pr', 'nota', 'dono', 'dona', 'membro', 'executora', 'papel', 'item', 'origem'];

caso('etapa: estado + proximoPapel, um por um', () => {
  const casos = [
    ['F101', { estado: 'feito' }, 'feito'], ['F102', { estado: 'concluida' }, 'feito'], ['F103', { estado: 'concluido' }, 'feito'],
    ['F104', { estado: 'em-planejamento' }, 'planejamento'], ['F105', { estado: 'em-validacao', proximoPapel: 'merge' }, 'validacao'],
    ['F106', { estado: 'aberto', proximoPapel: 'plano' }, 'planejamento'], ['F107', { estado: 'aberto', proximoPapel: 'design' }, 'design'],
    ['F108', { estado: 'em-andamento', proximoPapel: 'exec' }, 'execucao'], ['F109', { estado: 'aberto', proximoPapel: 'executa' }, 'execucao'],
    ['F110', { estado: 'aberto', proximoPapel: 'valid' }, 'validacao'], ['F111', { estado: 'bloqueado', proximoPapel: 'merge', nota: 'x' }, 'merge'],
    ['F112', { estado: 'aberto' }, 'planejamento'], ['F113', { estado: 'aberto', proximoPapel: 'operador' }, 'planejamento'],
  ];
  for (const [id, d, _] of casos) item(id, { frente: 'builder', ...d });
  const r = migrar('--gravar'); igual(r.exit, 0, `exit (${r.err}${r.out.slice(-300)})`);
  for (const [id, , esperada] of casos) igual(lido(id).data.etapa, esperada, `etapa de ${id}`);
  ok(/F112: proximoPapel/.test(r.out) && /F113: proximoPapel/.test(r.out), 'F112 e F113 vão para conferir à mão');
  ok(!/F108: proximoPapel/.test(r.out), 'F108 decidiu pelo papel: fora da lista');
});
caso('bloqueado ganha trava {outra, nota}; sem nota usa texto padrão e avisa', () => {
  item('F201', { frente: 'builder', estado: 'bloqueado', proximoPapel: 'exec', nota: 'espera o operador' });
  item('F202', { frente: 'builder', estado: 'bloqueado', proximoPapel: 'exec' });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  igual(lido('F201').data.trava, { motivo: 'outra', texto: 'espera o operador' }, 'trava');
  igual(lido('F202').data.trava.motivo, 'outra', 'motivo F202'); ok(/F202: bloqueado sem nota/.test(r.out), 'avisou');
});
caso('tema: frente, e F22/F23/F26 sem frente', () => {
  for (const [id, fr] of [['F301', 'builder'], ['F302', 'operacao'], ['F303', 'orquestração (~/.claude)'], ['F304', 'gate']]) item(id, { frente: fr, estado: 'feito' });
  for (const id of ['F22', 'F23', 'F26']) item(id, { estado: 'feito' });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  igual(['F301', 'F302', 'F303', 'F304', 'F22', 'F23', 'F26'].map((i) => lido(i).data.tema), ['editor', 'orquestracao', 'orquestracao', 'gate', 'gate', 'kit', 'editor'], 'temas');
});
caso('dono: feito perde; local_ vira donoLocalId com apelido do título; apelido solto vai para conferir', () => {
  item('F401', { frente: 'builder', estado: 'feito', dono: L1, donoLocalId: L1, donoApelido: 'P1' });
  item('F402', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', dono: L2 });
  item('F403', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', membro: 'Z9' });
  item('F404', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', dona: 'P1' });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  const d1 = lido('F401').data; ok(!('donoLocalId' in d1) && !('donoApelido' in d1) && !('dono' in d1), 'feito sem dono');
  const d2 = lido('F402').data; igual([d2.donoLocalId, d2.donoApelido], [L2, 'E4'], 'F402'); ok(/F402: donoApelido "E4" tirado do título/.test(r.out), 'F402 confirmar');
  const d3 = lido('F403').data; igual([d3.donoLocalId, d3.donoApelido], [undefined, 'Z9'], 'F403'); ok(/F403: membro "Z9" só tem apelido/.test(r.out), 'F403 preencher');
  const d4 = lido('F404').data; igual([d4.donoLocalId, d4.donoApelido], [L1, 'P1'], 'F404 achou a única sessão P1'); ok(/F404: dona "P1" → /.test(r.out), 'F404 confirmar');
});
caso('pr → prs, nota → agora, etapa em texto livre → agora, campos antigos somem, os outros ficam', () => {
  item('F501', { frente: 'builder', estado: 'em-validacao', proximoPapel: 'merge', pr: 1111, nota: 'PR aberto', etapa: 'aguarda validação', handoff: '/x.md', branch: 'b', via: 'sessao', aplicaMigration: false, historico: [{ em: '2026-10-24', de: 'a', para: 'b', por: 'c' }] });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  const d = lido('F501').data;
  igual(d.prs, [1111], 'prs'); igual(d.etapa, 'validacao', 'etapa nova'); ok(d.agora.includes('PR aberto') && d.agora.includes('aguarda validação'), `agora: ${d.agora}`);
  for (const k of ANTIGOS) ok(!(k in d), `campo antigo ${k} ficou`);
  igual([d.handoff, d.branch, d.via, d.aplicaMigration], ['/x.md', 'b', 'sessao', false], 'demais ficam');
  igual(d.historico[0], { em: '2026-10-24', de: 'a', para: 'b', por: 'c' }, 'histórico antigo preservado');
  ok(/F501: o campo antigo "etapa" era texto livre/.test(r.out), 'conferir');
});
caso('concluida com texto de etapa que diz "aguarda" vai para conferir', () => {
  item('F601', { frente: 'operacao', estado: 'concluida', etapa: 'prontos, aguarda nova validação' });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err); ok(/F601: estado "concluida" virou feito/.test(r.out), 'avisou');
  ok(typeof lido('F601').data.feitoEm === 'string', 'feitoEm');
});
caso('importar: tema/etapa/prs/dono, título sem "# Fn —", Origem como resumo, feito ganha feitoEm', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  writeFileSync(join(poolDir, 'F17.md'), '# F17 · aviso falho\n\nOrigem: ressalva B4 do #1100.\nEstado: aberto\n');
  writeFileSync(join(poolDir, 'F2.md'), '# F2 — motor: Q173\n');
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  const f1 = lido('F1').data; igual([f1.titulo, f1.tema, f1.etapa, f1.prs, f1.donoApelido, f1.donoLocalId], ['builder: fatias', 'editor', 'execucao', [1128], 'P1', L1], 'F1');
  igual(f1.handoff, join(poolDir, 'F1.md'), 'handoff F1');
  const f17 = lido('F17').data; igual([f17.titulo, f17.resumo, f17.etapa, 'donoApelido' in f17], ['aviso falho', 'ressalva B4 do #1100.', 'planejamento', false], 'F17');
  const f2 = lido('F2').data; igual([f2.tema, f2.etapa], ['motor', 'feito'], 'F2'); ok(typeof f2.feitoEm === 'string', 'feitoEm F2');
  ok(!existsSync(join(painelDir, 'fila', 'F3.json')), 'sem .md, sem item'); ok(/F3: .*não existe/.test(r.out), 'avisou F3');
});
caso('handoff vazio recebe o .md de pool/itens (inclusive F12-notas-baixas.md); handoff existente fica', () => {
  writeFileSync(join(poolDir, 'F12-notas-baixas.md'), '# F12\n'); writeFileSync(join(poolDir, 'F14.md'), '# F14\n');
  item('F12', { frente: 'builder', estado: 'feito' }); item('F14', { frente: 'builder', estado: 'feito', handoff: '/ja/tem.md' });
  const r = migrar('--gravar'); igual(r.exit, 0, r.err);
  igual(lido('F12').data.handoff, join(poolDir, 'F12-notas-baixas.md'), 'F12'); igual(lido('F14').data.handoff, '/ja/tem.md', 'F14 intacto');
});
caso('--seco (e sem flag) não grava nada e mostra antes → depois, 0 campo antigo e a lista', () => {
  item('F701', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', nota: 'n' });
  const antes = readFileSync(join(painelDir, 'fila', 'F701.json'), 'utf8');
  const r = migrar();
  igual(r.exit, 0, r.err); igual(readFileSync(join(painelDir, 'fila', 'F701.json'), 'utf8'), antes, 'arquivo intacto');
  ok(r.out.includes('antes :') && r.out.includes('depois:'), 'mostra antes e depois');
  ok(/campos antigos restantes: 0/.test(r.out), 'zero campo antigo'); ok(r.out.includes('conferir à mão'), 'lista'); ok(r.out.includes('(seco:'), 'avisa que é seco');
});
caso('a gravação passa pela validação: tema fora de temas.json recusa o lote inteiro, sem gravar nada', () => {
  item('F801', { frente: 'builder', estado: 'feito' }); item('F802', { frente: 'builder', estado: 'feito' });
  writeFileSync(join(painelDir, 'temas.json'), JSON.stringify([{ id: 'motor', rotulo: 'Motor' }]));
  const r = migrar('--gravar');
  igual(r.exit, 1, `exit (${r.out.slice(-200)}${r.err})`); ok(r.err.includes('temas.json'), `stderr: ${r.err}`);
  ok('estado' in lido('F801').data && !('etapa' in lido('F801').data), 'F801 intacto'); ok(!existsSync(join(painelDir, 'fila', 'F1.json')), 'nada importado');
});
caso('idempotente: segunda rodada não muda nada; regravar um item migrado passa', () => {
  item('F901', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', membro: 'E4' });
  igual(migrar('--gravar').exit, 0, 'primeira');
  const v = lido('F901').version; const r2 = migrar('--gravar'); igual(r2.exit, 0, r2.err);
  ok(/F901: já no contrato novo/.test(r2.out), 'pulou'); igual(lido('F901').version, v, 'versão igual');
  const w = painel('update', 'fila', 'F901', '{"nota":"ok"}'); igual(w.exit, 0, `regravação: ${w.err}${w.out}`);
});
caso('cópia do painel real (foto de 25/10): migra, 0 sem etapa/tema, 0 com campo antigo, e regravar cada um passa', () => {
  ok(existsSync(SNAPSHOT), `foto ausente: ${SNAPSHOT}`);
  const arqs = readdirSync(SNAPSHOT).filter((f) => /^F\d+\.json$/.test(f)); ok(arqs.length >= 15, `foto com ${arqs.length} itens`);
  rmSync(join(painelDir, 'fila'), { recursive: true, force: true }); cpSync(SNAPSHOT, join(painelDir, 'fila'), { recursive: true });
  const r = migrar('--gravar'); igual(r.exit, 0, `exit (${r.err}${r.out.slice(-300)})`);
  const ids = readdirSync(join(painelDir, 'fila')).filter((f) => /^F\d+\.json$/.test(f)).map((f) => f.slice(0, -5));
  ok(ids.length >= arqs.length, `itens depois: ${ids.length}`);
  for (const id of ids) {
    const d = lido(id).data; ok(d.etapa && d.tema, `${id} sem etapa/tema`);
    for (const k of ANTIGOS) ok(!(k in d), `${id} ficou com ${k}`);
    const w = painel('update', 'fila', id, '{"agora":"regravado"}'); igual(w.exit, 0, `${id} regravação: ${w.err}`);
  }
}, { skip: SNAPSHOT ? false : 'KIT_F27_FOTO não definida (a foto do painel real mora na máquina do operador)' });


// ---- --ajustes e --ensaio (passo c da fatia 2) ----
function foto(id, data) { mkdirSync(join(raiz, 'ensaio'), { recursive: true }); writeFileSync(join(raiz, 'ensaio', `${id}.json`), JSON.stringify({ id, version: 1, data })); }
function ajustes(o) { const f = join(raiz, 'ajustes.json'); writeFileSync(f, JSON.stringify(o)); return f; }
const COM_AJ = (o) => ['--ajustes', ajustes(o), '--ensaio', join(raiz, 'ensaio')];

caso('ajustes: resumo entra, null remove o dono, etapa e agora do ajuste valem sobre o mapeamento', () => {
  const base = { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec', membro: 'E4', nota: 'n', etapa: 'texto livre' };
  item('F1001', base); foto('F1001', { ...base });
  const r = migrar('--gravar', ...COM_AJ({ F1001: { resumo: 'R', donoApelido: null, donoLocalId: null, etapa: 'feito', agora: 'A' } }));
  igual(r.exit, 0, `exit (${r.err}${r.out.slice(-300)})`);
  const d = lido('F1001').data; igual([d.resumo, d.etapa, d.agora, 'donoApelido' in d, typeof d.feitoEm], ['R', 'feito', 'A', false, 'string'], 'campos');
  ok(!/F1001: (sem resumo|membro)/.test(r.out), 'o que o ajuste resolveu saiu da lista');
});
caso('ajustes: o documento vivo vence quando trouxe etapa nova depois do ensaio; campo solto vira depois', () => {
  const antes = { frente: 'operacao', estado: 'em-execucao', proximoPapel: 'exec', dona: 'P4' };
  foto('F1002', antes);
  item('F1002', { ...antes, etapa: 'feito', feitoEm: '2026-10-25T13:30:00.000Z', proximo: 'conferir o piloto em 01/11' });
  const r = migrar('--gravar', ...COM_AJ({ F1002: { resumo: 'R', etapa: 'execucao', donoApelido: 'P4', donoLocalId: L1 } }));
  igual(r.exit, 0, `exit (${r.err}${r.out.slice(-300)})`);
  const d = lido('F1002').data;
  igual([d.etapa, d.feitoEm, 'donoApelido' in d, 'proximo' in d, d.resumo], ['feito', '2026-10-25T13:30:00.000Z', false, false, 'R'], 'vivo vence');
  igual(d.depois, [{ texto: 'conferir o piloto em 01/11' }], 'depois');
});
caso('ajustes: o ajuste vence quando o vivo não mudou desde o ensaio', () => {
  const antes = { frente: 'builder', estado: 'concluida', etapa: 'aguarda', membro: 'E4' };
  foto('F1003', antes); item('F1003', antes);
  const r = migrar('--gravar', ...COM_AJ({ F1003: { etapa: 'planejamento', resumo: 'R', donoApelido: 'E4', donoLocalId: L2 } }));
  igual(r.exit, 0, r.err); igual(lido('F1003').data.etapa, 'planejamento', 'etapa do ajuste');
});
caso('ajustes: item vivo sem resumo reprova a conferência estrita e nada grava', () => {
  item('F1004', { frente: 'builder', estado: 'em-andamento', proximoPapel: 'exec' }); foto('F1004', { frente: 'builder' });
  const r = migrar('--gravar', ...COM_AJ({}));
  igual(r.exit, 1, `exit (${r.out.slice(-200)})`); ok(/F1004: item vivo .* sem resumo/.test(r.out), 'nomeou o item'); ok('estado' in lido('F1004').data, 'não gravou');
  const feito = (() => { item('F1005', { frente: 'builder', estado: 'feito' }); rmSync(join(painelDir, 'fila', 'F1004.json')); return migrar('--gravar', ...COM_AJ({})); })();
  igual(feito.exit, 0, `item feito sem resumo passa (${feito.out.slice(-200)})`);
});

// ---- B2: o projeto vem do git da pasta atual quando falta KIT_PROJETO, e o aviso diz isso ----
function repoGit() {
  const repo = join(raiz, 'meu-projeto'); mkdirSync(repo);
  const g = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL' });
  ok(g.status === 0, `git init: ${g.stderr}`);
  return repo;
}
caso('projeto: sem KIT_PROJETO deriva do git da pasta atual e avisa no stderr (uma vez)', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  writeFileSync(join(poolDir, 'F2.md'), '# F2 — motor: Q173\n');
  const r = run('migrar-fila.mjs', ['--gravar'], { cwd: repoGit() }); igual(r.exit, 0, r.err);
  igual(lido('F1').data.projeto, 'meu-projeto', 'projeto derivado do git');
  ok(/projeto.*meu-projeto.*git/i.test(r.err), `stderr sem o aviso: ${JSON.stringify(r.err)}`);
  igual(r.err.split('\n').filter((l) => /meu-projeto/.test(l)).length, 1, 'avisa uma vez só');
});
caso('projeto: com KIT_PROJETO definido usa ele e não avisa', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  const r = run('migrar-fila.mjs', ['--gravar'], { cwd: repoGit(), env: { ...env(), KIT_PROJETO: 'outro' } }); igual(r.exit, 0, r.err);
  igual(lido('F1').data.projeto, 'outro', 'projeto da env');
  ok(!/git/i.test(r.err), `avisou sem precisar: ${JSON.stringify(r.err)}`);
});
caso('projeto: fora de um repo git e sem KIT_PROJETO fica sem projeto, sem aviso de derivação', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  const fora = join(raiz, 'fora'); mkdirSync(fora);
  const r = run('migrar-fila.mjs', ['--gravar'], { cwd: fora, env: { ...env(), GIT_CEILING_DIRECTORIES: raiz } }); igual(r.exit, 0, r.err);
  ok(!('projeto' in lido('F1').data), 'sem projeto');
  ok(!/derivei/i.test(r.err), `avisou derivação sem ter derivado: ${JSON.stringify(r.err)}`);
});

// M1 (c15): dentro de um worktree o projeto é o do repositório principal (git common dir), não o nome da pasta do worktree.
function repoComWorktree() {
  const repo = join(raiz, 'Izanagi'); mkdirSync(repo); // maiúscula de propósito: o nome do projeto sai em minúsculas (mutante sem toLowerCase morre)
  const git = (cwd, ...a) => { const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL' }); ok(r.status === 0, `git ${a.join(' ')}: ${r.stderr}`); };
  git(repo, 'init', '-q'); git(repo, 'commit', '-q', '--allow-empty', '-m', 'x');
  const wt = join(raiz, 'trabalho-wt'); git(repo, 'worktree', 'add', '-q', '-b', 'wt', wt);
  return wt;
}
caso('projeto: de dentro de um worktree dá o nome do repositório principal', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  const r = run('migrar-fila.mjs', ['--gravar'], { cwd: repoComWorktree() }); igual(r.exit, 0, r.err);
  igual(lido('F1').data.projeto, 'izanagi', 'projeto do worktree');
});
caso('projeto: o mutante com --show-toplevel dá o nome do worktree (o teste acima o pega)', () => {
  writeFileSync(join(poolDir, 'F1.md'), '# F1 — builder: fatias\n- frente: builder\n');
  const mut = join(raiz, 'scripts-mut'); cpSync(SCRIPTS, mut, { recursive: true });
  const f = join(mut, 'migrar-fila.mjs'); const fonte = readFileSync(f, 'utf8');
  ok(fonte.includes("'--path-format=absolute', '--git-common-dir'"), 'a linha a mutar existe');
  writeFileSync(f, fonte.replace("'--path-format=absolute', '--git-common-dir'", "'--show-toplevel'"));
  const r = spawnSync('node', [f, '--gravar'], { cwd: repoComWorktree(), encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: env() }); igual(r.status, 0, r.stderr);
  igual(lido('F1').data.projeto, 'trabalho-wt', 'o mutante enxerga o worktree');
});
