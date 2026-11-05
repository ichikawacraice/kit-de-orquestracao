#!/usr/bin/env node
// Testes da coleção `fila` do painel (painel.mjs) e do contador proximo-item.sh.
// Nunca toca o painel real: PAINEL_DIR e HOME são pastas temporárias.
// Rodar: node ~/.claude/hooks/tests/painel-fila.test.mjs   (SCRIPTS_DIR troca a pasta dos scripts)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// F423: "feito" não se declara (painel.mjs recusa); o caso que exercita o fechamento por update liga a escotilha só na chamada que o declara
const fechaDeclarado = (args) => (args.some((a) => /"etapa"\s*:\s*"feito"/.test(String(a))) ? { KIT_FECHAR_DECLARADO: '1' } : {});

const TEMAS = JSON.stringify([{ id: 'editor', rotulo: 'Editor' }, { id: 'motor', rotulo: 'Motor' }]);
const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-fila-'));
  mkdirSync(join(base, 'painel'));
  mkdirSync(join(base, 'home'));
  writeFileSync(join(base, 'painel', 'temas.json'), TEMAS);
}
// `prazo`: o teste da trava presa espera o prazo do próprio comando (5 s de tentativas) e mede comportamento, não
// velocidade; com a máquina em carga 27 os 30 s não bastaram, então esses casos passam um prazo largo.
function run(cmd, args, extraEnv = {}, prazo = 30000) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8', timeout: prazo, killSignal: 'SIGKILL',
    env: { ...process.env, ...fechaDeclarado(args), PAINEL_DIR: join(base, "painel"), CLAUDE_CODE_SESSION_ID: "", CLAUDE_CODE_HOST_SESSION_ID: "", HOME: join(base, "home"), ...extraEnv },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const painel = (...args) => run('node', [join(SCRIPTS, 'painel.mjs'), ...args]);
const json = (r) => JSON.parse(r.out);

function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function runAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { env: { ...process.env, PAINEL_DIR: join(base, "painel"), CLAUDE_CODE_SESSION_ID: "", HOME: join(base, "home") } });
    let out = ''; let err = '';
    const t = setTimeout(() => c.kill('SIGKILL'), 20000);
    c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
    c.on('error', reject);
    c.on('close', (status) => { clearTimeout(t); resolve({ exit: status, out, err }); });
  });
}
async function casoAsync(nome, fn) {
  novoBase();
  try { await fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const ITEM = '{"titulo":"Fatia 1","etapa":"planejamento","tema":"editor","frente":"builder","estado":"aberto","proximoPapel":"exec","aplicaMigration":false,"historico":[]}';

caso('set fila F1 grava {id, version, data} com atualizadoEm', () => {
  const r = painel('set', 'fila', 'F1', ITEM);
  igual(r.exit, 0, `exit (${r.err})`);
  const g = json(painel('get', 'fila', 'F1'));
  igual(g.id, 'F1', 'id');
  igual(g.version, 1, 'version');
  igual(g.data.estado, 'aberto', 'estado');
  ok(typeof g.data.atualizadoEm === 'string' && g.data.atualizadoEm.length > 0, 'sem atualizadoEm');
});
caso('update --se-versao 1 passa; de novo é recusado (exit 1, "versão" no stderr)', () => {
  painel('set', 'fila', 'F1', ITEM);
  const a = painel('update', 'fila', 'F1', '{"etapa":"execucao","donoLocalId":"local_00000000-0000-4000-8000-00000000000a","donoApelido":"E1"}', '--se-versao', '1');
  igual(a.exit, 0, `1º update (${a.err})`);
  igual(json(a).version, 2, 'version depois do 1º');
  const b = painel('update', 'fila', 'F1', '{"donoLocalId":"local_00000000-0000-4000-8000-00000000000b","donoApelido":"E2"}', '--se-versao', '1');
  igual(b.exit, 1, 'exit do 2º');
  ok(b.err.includes('versão'), `stderr sem "versão": ${b.err}`);
  igual(json(painel('get', 'fila', 'F1')).data.donoLocalId, 'local_00000000-0000-4000-8000-00000000000a', 'o dono não pode ter mudado');
});
caso('batch com seVersao velho é recusado; com a versão certa passa', () => {
  painel('set', 'fila', 'F1', ITEM);
  painel('update', 'fila', 'F1', '{"agora":"a"}');
  const velho = painel('batch', JSON.stringify([{ op: 'update', colecao: 'fila', id: 'F1', data: { donoLocalId: 'local_00000000-0000-4000-8000-00000000000c', donoApelido: 'E3' }, seVersao: 1 }]));
  igual(velho.exit, 1, 'exit com versão velha');
  ok(velho.err.includes('versão'), `stderr sem "versão": ${velho.err}`);
  ok(json(painel('get', 'fila', 'F1')).data.donoLocalId === undefined, 'o batch recusado gravou mesmo assim');
  const certo = painel('batch', JSON.stringify([{ op: 'update', colecao: 'fila', id: 'F1', data: { donoLocalId: 'local_00000000-0000-4000-8000-00000000000c', donoApelido: 'E3' }, seVersao: 2 }]));
  igual(certo.exit, 0, `exit com a versão certa (${certo.err})`);
  igual(json(painel('get', 'fila', 'F1')).data.donoLocalId, 'local_00000000-0000-4000-8000-00000000000c', 'dono');
});
caso('batch sem seVersao continua valendo (compatível)', () => {
  const r = painel('batch', JSON.stringify([{ op: 'set', colecao: 'fila', id: 'F1', data: { titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'aberto' } }, { op: 'set', colecao: 'fila', id: 'F2', data: { titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'feito' } }]));
  igual(r.exit, 0, `exit (${r.err})`);
  igual(json(r).length, 2, 'ops');
});
caso('set fila sobre item que já existe, sem --se-versao, é recusado e não apaga o 1º (F27 fatia 0)', () => {
  igual(painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","estado":"aberto","marca":"primeiro"}').exit, 0, '1º set');
  const r = painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","estado":"feito","marca":"segundo"}');
  igual(r.exit, 1, 'exit do 2º set');
  ok(r.err.includes('já existe'), `stderr sem "já existe": ${r.err}`);
  igual(json(painel('get', 'fila', 'F1')).data.marca, 'primeiro', 'o F1 em disco tem de ser o da 1ª gravação');
});
caso('set fila --se-versao 1 sobre a versão 1 substitui (exit 0, versão 2)', () => {
  painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","estado":"aberto","marca":"primeiro"}');
  const r = painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","estado":"feito","marca":"segundo"}', '--se-versao', '1');
  igual(r.exit, 0, `exit (${r.err})`);
  igual(json(r).version, 2, 'version');
  igual(json(painel('get', 'fila', 'F1')).data.marca, 'segundo', 'substituiu');
});
caso('batch com set sobre F1 existente sem seVersao: exit 1 e nada gravado, nem as outras ops', () => {
  painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","estado":"aberto","marca":"primeiro"}');
  const r = painel('batch', JSON.stringify([
    { op: 'set', colecao: 'fila', id: 'F2', data: { titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'aberto' } },
    { op: 'set', colecao: 'fila', id: 'F1', data: { titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'feito', marca: 'segundo' } },
  ]));
  igual(r.exit, 1, 'exit');
  ok(r.err.includes('já existe'), `stderr sem "já existe": ${r.err}`);
  igual(json(painel('get', 'fila', 'F1')).data.marca, 'primeiro', 'F1 intacto');
  ok(!existsSync(join(base, 'painel', 'fila', 'F2.json')), 'o F2 do mesmo lote não pode ter sido gravado');
});
caso('set em sessoes/perguntas sobre documento existente continua valendo (a trava é só da fila)', () => {
  igual(painel('set', 'perguntas', 'Q1', '{"texto":"a"}').exit, 0, '1º');
  igual(painel('set', 'perguntas', 'Q1', '{"texto":"b"}').exit, 0, '2º');
});
caso('list fila em-andamento filtra por dono + etapa não final (B3)', () => {
  const dono = ',"donoLocalId":"local_00000000-0000-4000-8000-00000000000a","donoApelido":"E1"';
  painel('set', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor"}');
  painel('set', 'fila', 'F2', '{"titulo":"t","etapa":"execucao","tema":"editor"' + dono + '}');
  painel('set', 'fila', 'F3', '{"titulo":"t","etapa":"feito","tema":"editor"}');
  const todos = json(painel('list', 'fila'));
  igual(todos.length, 3, 'sem filtro');
  const so = json(painel('list', 'fila', 'em-andamento'));
  igual(so.length, 1, 'com filtro');
  igual(so[0].id, 'F2', 'qual');
});
caso('coleção desconhecida é recusada e a mensagem cita a fila', () => {
  const r = painel('list', 'xpto');
  igual(r.exit, 1, 'exit');
  ok(r.err.includes('fila'), `mensagem: ${r.err}`);
});
caso('proximo-item.sh com HOME temporário e F7.json na fila: F8, depois F9', () => {
  const fila = join(base, 'home', '.claude', 'orquestracao', 'painel', 'fila');
  mkdirSync(fila, { recursive: true });
  writeFileSync(join(fila, 'F7.json'), '{"id":"F7","version":1,"data":{}}\n');
  const a = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  igual(a.exit, 0, `exit (${a.err})`);
  igual(a.out.trim(), 'F8', '1ª');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F9', '2ª');
});
caso('proximo-item.sh: contador 21 e F27.json existente devolve F28 (F27 fatia 0)', () => {
  const orq = join(base, 'home', '.claude', 'orquestracao');
  mkdirSync(join(orq, 'painel', 'fila'), { recursive: true });
  mkdirSync(join(orq, 'pool'), { recursive: true });
  writeFileSync(join(orq, 'painel', 'fila', 'F27.json'), '{"id":"F27","version":1,"data":{}}\n');
  writeFileSync(join(orq, 'pool', 'contador-de-itens'), '21\n');
  const a = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  igual(a.exit, 0, `exit (${a.err})`);
  igual(a.out.trim(), 'F28', 'o maior item existente vence o contador atrasado');
});
caso('proximo-item.sh: contador 30 com o maior item F27 devolve F31 (o contador maior também vale)', () => {
  const orq = join(base, 'home', '.claude', 'orquestracao');
  mkdirSync(join(orq, 'painel', 'fila'), { recursive: true });
  mkdirSync(join(orq, 'pool'), { recursive: true });
  writeFileSync(join(orq, 'painel', 'fila', 'F27.json'), '{"id":"F27","version":1,"data":{}}\n');
  writeFileSync(join(orq, 'pool', 'contador-de-itens'), '30\n');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F31', 'contador maior');
});
caso('proximo-item.sh considera também os itens antigos pool/itens/F<n>.md', () => {
  const itens = join(base, 'home', '.claude', 'orquestracao', 'pool', 'itens');
  mkdirSync(itens, { recursive: true });
  for (const n of ['F1', 'F4', 'F3']) writeFileSync(join(itens, `${n}.md`), 'antigo\n');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F5', 'depois do maior antigo');
});
caso('proximo-item.sh sem nada: F1; trava presa é recusada com prazo (exit 1)', () => {
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F1', 'primeiro');
  mkdirSync(join(base, 'home', '.claude', 'orquestracao', 'pool', '.trava-itens'));
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_TENTATIVAS: '5' }, 180000);
  igual(r.exit, 1, 'exit com a trava ocupada');
  ok(r.err.includes('trava'), `stderr: ${r.err}`);
});

const antigo = (dir) => { const t = new Date(Date.now() - 60_000); utimesSync(dir, t, t); };
const poolDir = () => join(base, 'home', '.claude', 'orquestracao', 'pool');

caso('batch atômico: F1 com versão certa + F2 com versão velha = exit 1 e F1 não muda', () => {
  painel('set', 'fila', 'F1', ITEM);
  painel('set', 'fila', 'F2', ITEM);
  painel('update', 'fila', 'F2', '{"agora":"a"}');
  const r = painel('batch', JSON.stringify([
    { op: 'update', colecao: 'fila', id: 'F1', data: { agora: 'x' }, seVersao: 1 },
    { op: 'update', colecao: 'fila', id: 'F2', data: { agora: 'y' }, seVersao: 1 },
  ]));
  igual(r.exit, 1, 'exit');
  const f1 = json(painel('get', 'fila', 'F1'));
  igual(f1.version, 1, 'F1 foi gravado apesar da recusa de F2');
  ok(f1.data.agora === undefined, 'F1 ganhou a nota');
});
caso('batch com op desconhecida na 2ª posição não grava a 1ª', () => {
  const r = painel('batch', JSON.stringify([
    { op: 'set', colecao: 'fila', id: 'F1', data: { titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'aberto' } },
    { op: 'xpto', colecao: 'fila', id: 'F2', data: {} },
  ]));
  igual(r.exit, 1, 'exit');
  igual(painel('get', 'fila', 'F1').exit, 1, 'F1 existe');
});
caso('trava do painel recente e presa: exit 1 e a trava continua; trava de 60 s atrás é removida e grava', () => {
  const trava = join(base, 'painel', '.trava');
  mkdirSync(trava);
  const r = run('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], {}, 180000);
  igual(r.exit, 1, 'exit com trava recente');
  ok(r.err.includes('trava'), `stderr: ${r.err}`);
  ok(existsSync(trava), 'a trava alheia foi removida');
  antigo(trava);
  const r2 = painel('set', 'fila', 'F1', ITEM);
  igual(r2.exit, 0, `exit com trava órfã (${r2.err})`);
  ok(!existsSync(trava), 'a trava ficou depois do comando');
  ok(r2.err.includes('órfã'), `sem aviso: ${r2.err}`);
});
caso('get e list não pegam trava', () => {
  painel('set', 'fila', 'F1', ITEM);
  mkdirSync(join(base, 'painel', '.trava'));
  igual(painel('get', 'fila', 'F1').exit, 0, 'get');
  igual(painel('list', 'fila').exit, 0, 'list');
});
caso('proximo-item.sh: contador vazio com F1–F4 em pool/itens dá F5', () => {
  const itens = join(poolDir(), 'itens');
  mkdirSync(itens, { recursive: true });
  for (const n of ['F1', 'F2', 'F3', 'F4']) writeFileSync(join(itens, `${n}.md`), 'antigo\n');
  writeFileSync(join(poolDir(), 'contador-de-itens'), '');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F5', 'vazio');
  writeFileSync(join(poolDir(), 'contador-de-itens'), 'lixo\n');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F5', 'não numérico');
  igual(run('bash', [join(SCRIPTS, 'proximo-item.sh')]).out.trim(), 'F6', 'seguinte');
});
caso('proximo-item.sh: trava recente presa = exit 1 e continua; trava de 60 s atrás = sucesso', () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens');
  mkdirSync(trava);
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_TENTATIVAS: '5' }, 180000);
  igual(r.exit, 1, 'exit com trava recente');
  ok(existsSync(trava), 'a trava alheia foi removida');
  antigo(trava);
  const r2 = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  igual(r2.exit, 0, `exit com trava órfã (${r2.err})`);
  igual(r2.out.trim(), 'F1', 'id');
  ok(!existsSync(trava), 'a trava ficou');
});

caso('proximo-item.sh: trava recente com o dono de OUTRO token: exit 1 e a trava e o dono ficam como estavam', () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens');
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), 'token-do-outro\n');
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_TENTATIVAS: '5' });
  igual(r.exit, 1, 'exit');
  ok(existsSync(trava), 'a trava do outro foi removida');
  igual(readFileSync(join(trava, 'dono'), 'utf8'), 'token-do-outro\n', 'dono mudou');
});
// Espera pelo ESTADO (o script tomou a trava), não por tempo: sob carga o node/bash demora a subir.
const aguardar = async (cond, ms = 20000) => { const fim = Date.now() + ms; while (!cond()) { if (Date.now() > fim) return false; await new Promise((r) => setTimeout(r, 25)); } return true; };
await casoAsync('proximo-item.sh: trava tomada por outro no meio do comando: o trap não apaga a do outro', async () => {
  const trava = join(poolDir(), '.trava-itens');
  const p = new Promise((resolve, reject) => {
    const c = spawn('bash', [join(SCRIPTS, 'proximo-item.sh')], { env: { ...process.env, HOME: join(base, 'home'), PROXIMO_ITEM_PAUSA: '1.5' } });
    let err = ''; c.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => c.kill('SIGKILL'), 20000);
    c.on('error', reject); c.on('close', (exit) => { clearTimeout(t); resolve({ exit, err }); });
  });
  await aguardar(() => existsSync(join(trava, 'dono')));
  ok(existsSync(join(trava, 'dono')), 'precondição: o script não pegou a trava com dono');
  rmSync(trava, { recursive: true, force: true });
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), 'token-do-outro\n');
  const r = await p;
  igual(r.exit, 0, `exit (${r.err})`);
  ok(existsSync(trava), 'o trap apagou a trava do outro');
  igual(readFileSync(join(trava, 'dono'), 'utf8'), 'token-do-outro\n', 'dono');
});

await casoAsync('trava tomada por outra execução no meio do comando: a minha não apaga a do outro', async () => {
  const trava = join(base, 'painel', '.trava');
  const p = new Promise((resolve, reject) => {
    const c = spawn('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], {
      env: { ...process.env, PAINEL_DIR: join(base, "painel"), CLAUDE_CODE_SESSION_ID: "", HOME: join(base, "home"), PAINEL_PAUSA_MS: '1500' },
    });
    let err = ''; c.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => c.kill('SIGKILL'), 20000);
    c.on('error', reject); c.on('close', (exit) => { clearTimeout(t); resolve({ exit, err }); });
  });
  await aguardar(() => existsSync(join(trava, 'dono')));
  ok(existsSync(join(trava, 'dono')), 'precondição: a execução não pegou a trava com token');
  rmSync(trava, { recursive: true, force: true }); // "órfã" removida por outra execução…
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), 'token-do-outro'); // …que logo tomou a trava
  const r = await p;
  igual(r.exit, 0, `exit (${r.err})`);
  ok(existsSync(trava), 'a minha execução apagou a trava do outro');
  igual(readFileSync(join(trava, 'dono'), 'utf8'), 'token-do-outro', 'token do outro');
});
caso('trava órfã com token: removida, grava, e a trava some no fim', () => {
  const trava = join(base, 'painel', '.trava');
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), 'velho'); antigo(trava);
  const r = painel('set', 'fila', 'F1', ITEM);
  igual(r.exit, 0, `exit (${r.err})`);
  ok(!existsSync(trava), 'a trava ficou');
  ok(!readdirSync(join(base, 'painel')).some((n) => n.includes('.orfa.')), 'sobrou a órfã renomeada');
});

// B1/B2: a trava nasce completa (nunca vazia) e só se toma a de dono morto. Pid morto = de um filho que já saiu.
const pidMorto = () => { const r = spawnSync('node', ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL' }); return Number(r.stdout); };
caso('trava vazia recente bloqueia e não é tocada (exit 1, continua vazia)', () => {
  const trava = join(base, 'painel', '.trava');
  mkdirSync(trava);
  const r = run('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], {}, 180000);
  igual(r.exit, 1, 'exit');
  ok(existsSync(trava) && readdirSync(trava).length === 0, 'a trava vazia foi engolida ou mudou');
});
caso('B1 painel: trava antiga com dono VIVO não é tomada; com dono morto é', () => {
  const trava = join(base, 'painel', '.trava');
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), `${process.pid}-vivo`); antigo(trava);
  const r = run('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], {}, 180000);
  igual(r.exit, 1, `exit com dono vivo (${r.err})`);
  igual(readFileSync(join(trava, 'dono'), 'utf8'), `${process.pid}-vivo`, 'dono mudou');
  writeFileSync(join(trava, 'dono'), `${pidMorto()}-morto`); antigo(trava);
  const r2 = painel('set', 'fila', 'F1', ITEM);
  igual(r2.exit, 0, `exit com dono morto (${r2.err})`);
  ok(r2.err.includes('órfã'), `sem aviso: ${r2.err}`);
  ok(!existsSync(trava), 'a trava ficou');
});
caso('B1 painel: sobra nenhum diretório temporário da trava depois de um comando', () => {
  igual(painel('set', 'fila', 'F1', ITEM).exit, 0, 'exit');
  ok(!readdirSync(join(base, 'painel')).some((n) => n.startsWith('.trava')), `sobrou: ${readdirSync(join(base, 'painel'))}`);
});
caso('B2 proximo-item.sh: trava antiga com dono VIVO não é tomada; com dono morto é', () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens');
  mkdirSync(trava); writeFileSync(join(trava, 'dono'), `${process.pid}-vivo\n`); antigo(trava);
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_TENTATIVAS: '5' }, 180000);
  igual(r.exit, 1, `exit com dono vivo (${r.err})`);
  igual(readFileSync(join(trava, 'dono'), 'utf8'), `${process.pid}-vivo\n`, 'dono mudou');
  writeFileSync(join(trava, 'dono'), `${pidMorto()}-morto\n`); antigo(trava);
  const r2 = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  igual(r2.exit, 0, `exit com dono morto (${r2.err})`);
  igual(r2.out.trim(), 'F1', 'id');
  ok(!existsSync(trava), 'a trava ficou');
  ok(!readdirSync(poolDir()).some((n) => n.startsWith('.trava-itens')), `sobrou: ${readdirSync(poolDir())}`);
});

// C2: a trava nunca existe vazia nem no instante entre gravar o dono e publicar. O gancho segura a execução nesse instante;
// a sonda olha `.trava` durante a pausa: ausente (ainda só o temporário, com dono) é o certo; existir vazia é o defeito.
await casoAsync('C2 painel: durante a publicação a .trava não existe vazia (o temporário já tem o dono)', async () => {
  const pdir = join(base, 'painel');
  const c = spawn('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], { env: { ...process.env, PAINEL_DIR: pdir, HOME: join(base, 'home'), PAINEL_PAUSA_PUBLICAR_MS: '1500' } });
  const fim = new Promise((r) => c.on('close', r));
  let temporarioComDono = false; let vazia = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const novos = readdirSync(pdir).filter((n) => n.startsWith('.trava.novo-'));
    if (novos.some((n) => existsSync(join(pdir, n, 'dono')))) temporarioComDono = true;
    if (existsSync(join(pdir, '.trava')) && !existsSync(join(pdir, '.trava', 'dono'))) vazia = true;
  }
  await fim;
  ok(temporarioComDono, 'precondição: a pausa não segurou a execução com o temporário pronto (a sonda não mediu a janela)');
  ok(!vazia, '.trava existiu vazia durante a publicação');
  igual(json(painel('get', 'fila', 'F1')).id, 'F1', 'o comando não gravou');
});
// D1/C1: um roubador por vez remove a órfã. Dois processos julgam a mesma órfã (pid morto, 60 s atrás) com o gancho
// de pausa entre o julgamento e o rename; exatamente um rouba, o outro não toca a trava (o dono final é o de quem tomou).
const orfaSemeada = (trava, extra = '') => { mkdirSync(trava); writeFileSync(join(trava, 'dono'), `${pidMorto()}-morto${extra}`); antigo(trava); };
const spawnComEnv = (cmd, args, env) => {
  const c = spawn(cmd, args, { env: { ...process.env, ...fechaDeclarado(args), PAINEL_DIR: join(base, "painel"), CLAUDE_CODE_SESSION_ID: "", HOME: join(base, "home"), ...env } });
  const r = { out: '', err: '', exit: null, pid: c.pid }; c.stdout.on('data', (d) => { r.out += d; }); c.stderr.on('data', (d) => { r.err += d; });
  r.fim = new Promise((res) => c.on('close', (code) => { r.exit = code; res(r); }));
  return r;
};
await casoAsync('D1 painel: dois roubadores da mesma órfã — exatamente um remove, nenhum aviso de trava viva', async () => {
  const trava = join(base, 'painel', '.trava');
  orfaSemeada(trava);
  const env = { PAINEL_PAUSA_ROUBO_MS: '600' };
  const rs = [0, 1].map((i) => spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', `F${i + 1}`, ITEM], env));
  await Promise.all(rs.map((r) => r.fim));
  igual(rs.map((r) => r.exit).join(','), '0,0', `exits (${rs.map((r) => r.err)})`);
  igual(rs.filter((r) => r.err.includes('órfã')).length, 1, `quem removeu a órfã (${rs.map((r) => r.err)})`);
  ok(!rs.some((r) => r.err.includes('perdeu-trava-viva')), 'sobrou o aviso antigo');
  ok(!readdirSync(join(base, 'painel')).some((n) => n.startsWith('.trava')), `sobrou: ${readdirSync(join(base, 'painel'))}`);
});
await casoAsync('D1 proximo-item.sh: dois roubadores da mesma órfã — exatamente um remove', async () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens');
  orfaSemeada(trava, '\n');
  const rs = [0, 1].map(() => spawnComEnv('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_PAUSA_ROUBO: '1' }));
  await Promise.all(rs.map((r) => r.fim));
  igual(rs.map((r) => r.exit).join(','), '0,0', `exits (${rs.map((r) => r.err)})`);
  igual(rs.filter((r) => r.err.includes('órfã')).length, 1, `quem removeu a órfã (${rs.map((r) => r.err)})`);
  igual(rs.map((r) => r.out.trim()).sort().join(','), 'F1,F2', 'ids distintos');
  ok(!readdirSync(poolDir()).some((n) => n.startsWith('.trava-itens')), `sobrou: ${readdirSync(poolDir())}`);
});
caso('D1 painel: roubo recente ocupado faz esperar sem roubar; roubo de mais de 60 s é limpo e a execução segue', () => {
  const trava = join(base, 'painel', '.trava'); const roubo = `${trava}.roubo`;
  orfaSemeada(trava); mkdirSync(roubo);
  const r = run('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], {}, 180000);
  igual(r.exit, 1, `exit com roubo ocupado (${r.err})`);
  ok(existsSync(trava) && existsSync(roubo), 'mexeu na trava ou no roubo de outro');
  const velho = new Date(Date.now() - 120_000); utimesSync(roubo, velho, velho);
  const r2 = painel('set', 'fila', 'F1', ITEM);
  igual(r2.exit, 0, `exit com roubo órfão (${r2.err})`);
  ok(!existsSync(trava) && !existsSync(roubo), 'sobrou trava ou roubo');
});
caso('D1 proximo-item.sh: roubo recente ocupado faz esperar sem roubar; roubo de mais de 60 s é limpo', () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens'); const roubo = `${trava}.roubo`;
  orfaSemeada(trava, '\n'); mkdirSync(roubo);
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_TENTATIVAS: '5' }, 180000);
  igual(r.exit, 1, `exit com roubo ocupado (${r.err})`);
  ok(existsSync(trava) && existsSync(roubo), 'mexeu na trava ou no roubo de outro');
  const velho = new Date(Date.now() - 120_000); utimesSync(roubo, velho, velho);
  const r2 = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  igual(r2.exit, 0, `exit com roubo órfão (${r2.err})`);
  ok(!existsSync(trava) && !existsSync(roubo), 'sobrou trava ou roubo');
});
caso('D3 gancho de pausa com valor não numérico é ignorado (termina dentro de 5 s)', () => {
  const t0 = Date.now();
  const r = run('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], { PAINEL_PAUSA_MS: 'abc', PAINEL_PAUSA_PUBLICAR_MS: '-5', PAINEL_PAUSA_ROUBO_MS: 'x' });
  igual(r.exit, 0, `exit (${r.err})`);
  ok(Date.now() - t0 < 5000, `demorou ${Date.now() - t0} ms`);
  const t1 = Date.now();
  const r2 = run('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_PAUSA: 'abc', PROXIMO_ITEM_PAUSA_ROUBO: 'x' });
  igual(r2.exit, 0, `exit sh (${r2.err})`);
  ok(Date.now() - t1 < 5000, `sh demorou ${Date.now() - t1} ms`);
});

// --- Fase 1 do kit (24/10): projeto por documento e PAINEL_DIR ---
function repoGit(nome) {
  const d = join(base, nome); mkdirSync(d);
  for (const a of [['init', '-q'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x']]) {
    spawnSync('git', ['-C', d, ...a], { timeout: 15000, killSignal: 'SIGKILL', stdio: 'ignore' });
  }
  return d;
}
const painelEm = (cwd, ...args) => {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
    env: { ...process.env, PAINEL_DIR: join(base, "painel"), CLAUDE_CODE_SESSION_ID: "", HOME: join(base, "home") },
  });
  return { exit: r.status, out: r.stdout, err: r.stderr };
};
caso('projeto automático: set fila sem `projeto`, rodado de dentro do repo alfa, grava projeto "alfa" (também em sessoes)', () => {
  const A = repoGit('alfa');
  igual(painelEm(A, 'set', 'fila', 'F1', ITEM).exit, 0, 'set fila');
  igual(json(painelEm(A, 'get', 'fila', 'F1')).data.projeto, 'alfa', 'projeto da fila');
  igual(painelEm(A, 'set', 'sessoes', 'local_00000000-0000-4000-8000-00000000000a', '{"titulo":"E1 · x","estado":"parada"}').exit, 0, 'set sessoes');
  igual(json(painelEm(A, 'get', 'sessoes', 'local_00000000-0000-4000-8000-00000000000a')).data.projeto, 'alfa', 'projeto da sessão');
});
caso('projeto explícito não é sobrescrito; fora de git não inventa projeto', () => {
  const A = repoGit('alfa'); const sem = join(base, 'semgit'); mkdirSync(sem);
  painelEm(A, 'set', 'fila', 'F1', '{"titulo":"x","etapa":"planejamento","tema":"editor","estado":"aberto","projeto":"alfa"}');
  igual(json(painelEm(A, 'get', 'fila', 'F1')).data.projeto, 'alfa', 'explícito');
  igual(painelEm(sem, 'set', 'fila', 'F2', ITEM).exit, 0, 'set fora de git');
  ok(!('projeto' in json(painelEm(sem, 'get', 'fila', 'F2')).data), 'projeto inventado fora de git');
});
caso('criar documento sem projeto, fora de git: exit 0, grava, e avisa no stderr; com projeto ou em git não avisa', () => {
  const A = repoGit('alfa'); const sem = join(base, 'semgit'); mkdirSync(sem);
  const r = painelEm(sem, 'set', 'fila', 'F2', ITEM);
  igual(r.exit, 0, `exit (${r.err})`);
  ok(r.err.includes('aviso: fila/F2 sem projeto (cwd fora de git)'), `stderr sem o aviso: ${JSON.stringify(r.err)}`);
  ok(json(painelEm(sem, 'get', 'fila', 'F2')).data.titulo, 'não gravou');
  ok(!painelEm(A, 'set', 'fila', 'F3', ITEM).err.includes('aviso'), 'avisou dentro de git');
  ok(!painelEm(sem, 'set', 'fila', 'F4', '{"titulo":"x","etapa":"planejamento","tema":"editor","estado":"aberto","projeto":"alfa"}').err.includes('aviso'), 'avisou com projeto explícito');
});
caso('list --projeto filtra; sem flag e com --todos trazem tudo', () => {
  const A = repoGit('alfa'); const B = repoGit('beta');
  painelEm(A, 'set', 'fila', 'F1', ITEM); painelEm(B, 'set', 'fila', 'F2', ITEM);
  const ids = (r) => json(r).map((d) => d.id).sort().join(',');
  igual(ids(painelEm(A, 'list', 'fila', '--projeto', 'alfa')), 'F1', '--projeto alfa');
  igual(ids(painelEm(A, 'list', 'fila')), 'F1,F2', 'sem flag');
  igual(ids(painelEm(A, 'list', 'fila', '--todos')), 'F1,F2', '--todos');
  igual(ids(painelEm(A, 'list', 'fila', 'aberto', '--projeto', 'beta')), 'F2', 'estado + --projeto');
});
caso('PAINEL_DIR manda onde o painel grava', () => {
  const novo = join(base, 'novo'); mkdirSync(novo); writeFileSync(join(novo, 'temas.json'), TEMAS);
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, PAINEL_DIR: novo, HOME: join(base, 'home') } });
  igual(r.status, 0, r.stderr);
  ok(existsSync(join(novo, 'fila', 'F1.json')), 'PAINEL_DIR não mandou');
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// E1: a soltura renomeia a trava (nunca a deixa vazia no lugar). B confere que a trava não existe, A publica, grava e solta
// com pausa entre conferir o dono e o rename; o rename de B cai durante essa pausa e tem de falhar (a trava tem dono), sem
// que A receba ENOTEMPTY ao soltar.
await casoAsync('E1 painel: soltar não deixa a trava vazia no lugar — o rename de outro durante a soltura falha, e quem gravou sai com 0 e sem aviso', async () => {
  const pdir = join(base, 'painel'); painel('set', 'fila', 'F1', ITEM); const antes = json(painel('get', 'fila', 'F1')).version;
  const b = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', '{"b":1}'], { PAINEL_PAUSA_PUBLICAR_MS: '1500', PAINEL_PAUSA_MS: '1500' }); // B segura a trava se a pegar: é o que faz a soltura de A falhar sem o rename
  await aguardar(() => existsSync(join(pdir, '.trava', 'dono')));
  const a = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', '{"a":1}'], { PAINEL_PAUSA_SOLTAR_MS: '1500' });
  await Promise.all([a.fim, b.fim]);
  igual(`${a.exit},${b.exit}`, '0,0', `exits (a: ${a.err} | b: ${b.err})`);
  ok(!a.err.includes('não consegui soltar') && !b.err.includes('não consegui soltar') && !/ENOTEMPTY/.test(a.err + b.err), `avisos: ${a.err} | ${b.err}`);
  const f = json(painel('get', 'fila', 'F1'));
  igual(f.version, antes + 2, 'versão (as duas gravaram)');
  ok(f.data.a === 1 && f.data.b === 1, 'campos das duas');
  ok(!readdirSync(pdir).some((n) => n.startsWith('.trava')), `sobrou: ${readdirSync(pdir)}`);
});
await casoAsync('E1 proximo-item.sh: soltar com pausa — outro processo espera e pega outro id; trava some', async () => {
  mkdirSync(poolDir(), { recursive: true });
  const a = spawnComEnv('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_PAUSA_SOLTAR: '1.5' });
  await aguardar(() => existsSync(join(poolDir(), '.trava-itens', 'dono')));
  const b = spawnComEnv('bash', [join(SCRIPTS, 'proximo-item.sh')], {});
  await Promise.all([a.fim, b.fim]);
  igual(`${a.exit},${b.exit}`, '0,0', `exits (${a.err} | ${b.err})`);
  igual([a.out.trim(), b.out.trim()].sort().join(','), 'F1,F2', 'ids distintos');
  ok(!readdirSync(poolDir()).some((n) => n.startsWith('.trava-itens')), `sobrou: ${readdirSync(poolDir())}`);
});

// E3: o roubador morto no meio da pausa não prende os outros por 60 s: o roubo tem dono (pid morto) e sai na hora.
await casoAsync('E3 painel: roubador morto (SIGKILL na pausa) — a gravação seguinte consegue a trava em menos de 3 s', async () => {
  const trava = join(base, 'painel', '.trava'); orfaSemeada(trava);
  const a = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'set', 'fila', 'F1', ITEM], { PAINEL_PAUSA_ROUBO_MS: '20000' });
  await aguardar(() => existsSync(`${trava}.roubo`));
  ok(existsSync(`${trava}.roubo`), 'o roubo de A deveria existir durante a pausa');
  process.kill(a.pid, 'SIGKILL'); await a.fim;
  const t0 = Date.now();
  const r = painel('set', 'fila', 'F1', ITEM);
  const gasto = Date.now() - t0;
  igual(r.exit, 0, `exit (${r.err})`);
  ok(gasto < 3000, `levou ${gasto} ms`);
  ok(!readdirSync(join(base, 'painel')).some((n) => n.startsWith('.trava')), `sobrou: ${readdirSync(join(base, 'painel'))}`);
});
await casoAsync('E3 proximo-item.sh: roubador morto — o seguinte pega o id em menos de 3 s', async () => {
  mkdirSync(poolDir(), { recursive: true });
  const trava = join(poolDir(), '.trava-itens'); orfaSemeada(trava, '\n');
  const a = spawnComEnv('bash', [join(SCRIPTS, 'proximo-item.sh')], { PROXIMO_ITEM_PAUSA_ROUBO: '8' });
  await aguardar(() => existsSync(`${trava}.roubo`));
  ok(existsSync(`${trava}.roubo`), 'o roubo de A deveria existir durante a pausa');
  process.kill(a.pid, 'SIGKILL'); await a.fim;
  const t0 = Date.now();
  const r = run('bash', [join(SCRIPTS, 'proximo-item.sh')]);
  const gasto = Date.now() - t0;
  igual(r.exit, 0, `exit (${r.err})`);
  ok(gasto < 3000, `levou ${gasto} ms`);
  ok(!readdirSync(poolDir()).some((n) => n.startsWith('.trava-itens')), `sobrou: ${readdirSync(poolDir())}`);
});

// E2 (caso3 da V2): A rouba com pausa 300 ms, B com 900 ms, e C entra aos 450 ms segurando a trava por 1500 ms. O real remove
// só a órfã semeada (1); sem o roubo, B apagaria a trava nova de C (2).
await casoAsync('E2 painel: três processos sobre uma órfã — exatamente 1 remoção, as três gravações entram', async () => {
  const trava = join(base, 'painel', '.trava'); painel('set', 'fila', 'F1', ITEM); orfaSemeada(trava);
  const antes = json(painel('get', 'fila', 'F1')).version;
  const e = (ms) => ({ PAINEL_PAUSA_ROUBO_MS: String(ms) });
  const a = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', '{"a":1}'], e(300));
  const b = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', '{"b":1}'], e(900));
  await esperar(450);
  const c = spawnComEnv('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', '{"c":1}'], { PAINEL_PAUSA_MS: '1500' });
  await Promise.all([a.fim, b.fim, c.fim]);
  igual([a, b, c].map((x) => x.exit).join(','), '0,0,0', `exits (${[a, b, c].map((x) => x.err)})`);
  igual([a, b, c].filter((x) => x.err.includes('removida')).length, 1, `remoções (${[a, b, c].map((x) => x.err)})`);
  const f = json(painel('get', 'fila', 'F1'));
  igual(f.version, antes + 3, 'versão'); ok(f.data.a === 1 && f.data.b === 1 && f.data.c === 1, 'as três gravações');
});

for (let rodada = 1; rodada <= 3; rodada++) {
  await casoAsync(`8 update --se-versao 1 simultâneos, rodada ${rodada}: exatamente 1 vence, versão final 2`, async () => {
    painel('set', 'fila', 'F1', ITEM);
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => runAsync('node', [join(SCRIPTS, 'painel.mjs'), 'update', 'fila', 'F1', JSON.stringify({ donoApelido: `E${i}` }), '--se-versao', '1'])));
    igual(rs.filter((r) => r.exit === 0).length, 1, `vencedores (exits: ${rs.map((r) => r.exit)})`);
    igual(json(painel('get', 'fila', 'F1')).version, 2, 'versão final');
  });
}


// ---- Fatia 1: o contrato do item da fila ----
const UUID = 'local_00000000-0000-4000-8000-0000000000aa';
const semear = () => writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }, { id: 'motor', rotulo: 'Motor' }]));
const recusa = (r, trecho, msg) => { igual(r.exit, 1, `${msg}: exit (${r.out}${r.err})`); ok(r.err.includes(trecho), `${msg}: stderr sem "${trecho}": ${r.err}`); };
const COM = (extra = {}) => JSON.stringify({ titulo: 'T', etapa: 'planejamento', tema: 'editor', ...extra });

caso('contrato 1: etapa fora da lista é recusada com a lista; da lista passa', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"etapa":"andando"}'), 'planejamento · design · execucao · validacao · merge · feito · descartado', 'etapa');
  igual(painel('update', 'fila', 'F1', '{"etapa":"design"}').exit, 0, 'etapa válida');
  igual(json(painel('get', 'fila', 'F1')).data.etapa, 'design', 'gravou');
});
caso('contrato 2: tema fora de temas.json é recusado citando o caminho; da lista passa', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"tema":"inventado"}'), 'temas.json', 'tema');
  igual(painel('update', 'fila', 'F1', '{"tema":"motor"}').exit, 0, 'tema válido');
});
caso('contrato 2b: sem temas.json o tema é recusado dizendo onde ele devia estar', () => {
  painel('set', 'fila', 'F1', ITEM); rmSync(join(base, 'painel', 'temas.json'));
  recusa(painel('update', 'fila', 'F1', '{"tema":"editor"}'), 'temas.json', 'sem arquivo');
});
caso('contrato 3: trava {motivo,texto}; sem-ninguem, motivo solto e texto vazio são recusados', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"trava":{"motivo":"sem-ninguem","texto":"x"}}'), 'sem-ninguem', 'sem-ninguem');
  recusa(painel('update', 'fila', 'F1', '{"trava":{"motivo":"xpto","texto":"x"}}'), 'trava.motivo', 'motivo');
  recusa(painel('update', 'fila', 'F1', '{"trava":{"motivo":"operador","texto":" "}}'), 'trava.texto', 'texto');
  igual(painel('update', 'fila', 'F1', '{"trava":null}').exit, 0, 'trava null limpa');
});
caso('contrato 4: prs, depois e perguntas têm formato', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"prs":["12"]}'), 'prs', 'prs');
  recusa(painel('update', 'fila', 'F1', '{"depois":[{"texto":"x","item":"27"}]}'), 'depois', 'depois');
  recusa(painel('update', 'fila', 'F1', '{"perguntas":["12"]}'), 'perguntas', 'perguntas');
  igual(painel('update', 'fila', 'F1', '{"prs":[12],"depois":[{"texto":"x","item":"F27"}],"perguntas":["Q3"]}').exit, 0, 'válidos');
});
caso('contrato 5: resumo/agora/nota são texto', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"agora":5}'), 'agora é texto', 'agora');
  igual(painel('update', 'fila', 'F1', '{"agora":"x","resumo":"y"}').exit, 0, 'textos');
});
caso('contrato 6: campos de dono antigos são recusados; donoLocalId pede formato e donoApelido', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"dono":"E1"}'), 'saiu do contrato', 'dono');
  // F370: a recusa traz o comando certo pronto, com o local_ quando o valor velho já era um
  recusa(painel('update', 'fila', 'F1', '{"dono":"E1"}'), `painel update fila F1 '{"donoLocalId":"<seu local_…>","donoApelido":"dona"}'`, 'comando pronto');
  recusa(painel('update', 'fila', 'F1', JSON.stringify({ dono: UUID })), `painel update fila F1 '{"donoLocalId":"${UUID}","donoApelido":"dona"}'`, 'comando com o local_');
  recusa(painel('update', 'fila', 'F1', '{"donoLocalId":"abc","donoApelido":"E1"}'), 'local_<uuid>', 'formato');
  recusa(painel('update', 'fila', 'F1', JSON.stringify({ donoLocalId: UUID })), 'donoApelido', 'apelido');
  igual(painel('update', 'fila', 'F1', JSON.stringify({ donoLocalId: UUID, donoApelido: 'E1' })).exit, 0, 'dono válido');
});
caso('contrato 7: update de agora em documento antigo (estado: concluido) passa', () => {
  semear(); mkdirSync(join(base, 'painel', 'fila'), { recursive: true });
  writeFileSync(join(base, 'painel', 'fila', 'F1.json'), JSON.stringify({ id: 'F1', version: 1, data: { titulo: 'velho', estado: 'concluido', projeto: 'alfa', historico: [] } }));
  const r = painel('update', 'fila', 'F1', '{"agora":"anotação"}');
  igual(r.exit, 0, `exit (${r.err})`);
  igual(json(painel('get', 'fila', 'F1')).data.agora, 'anotação', 'agora');
});
caso('histórico automático: a criação e duas trocas de etapa viram três entradas {em, etapa, dono}', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  painel('update', 'fila', 'F1', '{"etapa":"design"}');
  painel('update', 'fila', 'F1', '{"etapa":"execucao"}');
  const h = json(painel('get', 'fila', 'F1')).data.historico;
  igual(h.length, 3, `entradas: ${JSON.stringify(h)}`);
  igual(h[0].etapa, 'planejamento', 'criação'); igual(h[1].etapa, 'design', 'primeira'); igual(h[2].etapa, 'execucao', 'segunda');
  ok(typeof h[0].em === 'string' && h[0].em.length > 0, 'em preenchido'); ok('dono' in h[0], 'dono presente');
  painel('update', 'fila', 'F1', '{"agora":"sem mudar etapa"}');
  igual(json(painel('get', 'fila', 'F1')).data.historico.length, 3, 'agora não acrescenta');
});
caso('feitoEm: entra em feito, sai ao reabrir', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  painel('update', 'fila', 'F1', '{"etapa":"feito"}');
  const a = json(painel('get', 'fila', 'F1')).data;
  ok(typeof a.feitoEm === 'string' && a.feitoEm.length > 0, `feitoEm: ${JSON.stringify(a)}`);
  painel('update', 'fila', 'F1', '{"etapa":"execucao"}');
  ok(!('feitoEm' in json(painel('get', 'fila', 'F1')).data), 'feitoEm some ao reabrir');
});


// ---- Fatia 2 (d): o contrato não tem porta lateral ----
caso('set sem etapa/tema é recusado, e o item novo exige titulo, etapa e tema', () => {
  semear();
  recusa(painel('set', 'fila', 'F1', '{"titulo":"t","estado":"aberto"}'), 'o item novo exige etapa, tema', 'legado');
  recusa(painel('set', 'fila', 'F1', '{"etapa":"design","tema":"editor"}'), 'titulo', 'sem titulo');
  ok(!existsSync(join(base, 'painel', 'fila', 'F1.json')), 'nada gravado');
  igual(painel('set', 'fila', 'F1', COM()).exit, 0, 'contrato completo passa');
});
caso('M1: update de item que não existe vale como criação e exige o contrato', () => {
  semear();
  recusa(painel('update', 'fila', 'F9', '{"agora":"solta"}'), 'o item novo exige titulo, etapa, tema', 'update sem contrato');
  ok(!existsSync(join(base, 'painel', 'fila', 'F9.json')), 'não criou');
  igual(painel('update', 'fila', 'F9', COM()).exit, 0, 'update com contrato cria');
});
caso('M2: null em etapa, tema ou titulo num update é recusado; null em outro campo remove', () => {
  semear(); painel('set', 'fila', 'F1', COM({ agora: 'a' }));
  for (const k of ['etapa', 'tema', 'titulo']) recusa(painel('update', 'fila', 'F1', JSON.stringify({ [k]: null })), `${k} não pode ser apagado`, `null em ${k}`);
  igual(painel('update', 'fila', 'F1', '{"agora":null}').exit, 0, 'null em agora');
  ok(!('agora' in json(painel('get', 'fila', 'F1')).data), 'agora removido'); igual(json(painel('get', 'fila', 'F1')).data.etapa, 'planejamento', 'contrato intacto');
});
caso('prs: [0] e outros não inteiros positivos são recusados', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  for (const v of ['[0]', '[-1]', '[1.5]', '["7"]']) recusa(painel('update', 'fila', 'F1', `{"prs":${v}}`), 'prs', `prs ${v}`);
  igual(painel('update', 'fila', 'F1', '{"prs":[1128]}').exit, 0, 'prs válido');
});
caso('donoLocalId: formato local_<uuid>, e set com dono também exige apelido', () => {
  semear();
  recusa(painel('set', 'fila', 'F1', COM({ donoLocalId: 'local_x', donoApelido: 'E1' })), 'local_<uuid>', 'set formato');
  recusa(painel('set', 'fila', 'F1', COM({ donoLocalId: UUID })), 'donoApelido', 'set sem apelido');
  igual(painel('set', 'fila', 'F1', COM({ donoLocalId: UUID, donoApelido: 'E1' })).exit, 0, 'set válido');
});

// ---- Fatia 3 (5): as ressalvas da V1 ----
const DONO = { donoLocalId: UUID, donoApelido: 'E1' };
caso('R1: tirar só o donoApelido de item com donoLocalId é recusado; os dois null juntos passam', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'execucao', ...DONO }));
  recusa(painel('update', 'fila', 'F1', '{"donoApelido":null}'), 'donoLocalId exige donoApelido', 'só apelido null');
  recusa(painel('update', 'fila', 'F1', '{"donoApelido":""}'), 'donoLocalId exige donoApelido', 'apelido vazio');
  igual(json(painel('get', 'fila', 'F1')).data.donoApelido, 'E1', 'nada gravado');
  igual(painel('update', 'fila', 'F1', '{"donoLocalId":null,"donoApelido":null}').exit, 0, 'os dois null');
});
caso('R2: titulo é texto não vazio depois do trim, no set e no update', () => {
  semear();
  for (const t of ['""', '"   "', '123']) {
    recusa(painel('set', 'fila', 'F1', `{"titulo":${t},"etapa":"design","tema":"editor"}`), 'titulo é texto não vazio', `set ${t}`);
  }
  painel('set', 'fila', 'F1', COM());
  for (const t of ['""', '"   "', '123']) {
    recusa(painel('update', 'fila', 'F1', `{"titulo":${t}}`), 'titulo é texto não vazio', `update ${t}`);
  }
  igual(json(painel('get', 'fila', 'F1')).data.titulo, 'T', 'titulo intacto');
});
caso('B1: deixar a etapa em feito/descartado com dono é recusado; soltar o dono no mesmo update passa', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'execucao', ...DONO }));
  recusa(painel('update', 'fila', 'F1', '{"etapa":"feito"}'), 'não tem dono', 'feito com dono');
  recusa(painel('update', 'fila', 'F1', '{"etapa":"descartado"}'), 'não tem dono', 'descartado com dono');
  igual(json(painel('get', 'fila', 'F1')).data.etapa, 'execucao', 'nada gravado');
  igual(painel('update', 'fila', 'F1', '{"etapa":"feito","donoLocalId":null,"donoApelido":null}').exit, 0, 'fecha e solta');
  recusa(painel('update', 'fila', 'F1', JSON.stringify(DONO)), 'não tem dono', 'dar dono a item feito');
});
caso('B3: list fila em-andamento = dono + etapa não final; item sem etapa válida cai no estado', () => {
  semear(); mkdirSync(join(base, 'painel', 'fila'), { recursive: true });
  painel('set', 'fila', 'F1', COM({ etapa: 'execucao', ...DONO }));
  painel('set', 'fila', 'F2', COM({ etapa: 'execucao' }));
  painel('set', 'fila', 'F3', COM({ etapa: 'feito' }));
  writeFileSync(join(base, 'painel', 'fila', 'F4.json'), JSON.stringify({ id: 'F4', version: 1, data: { titulo: 'velho', estado: 'em-andamento', historico: [] } }));
  writeFileSync(join(base, 'painel', 'fila', 'F5.json'), JSON.stringify({ id: 'F5', version: 1, data: { titulo: 'velho', estado: 'concluido', historico: [] } }));
  const ids = (r) => json(r).map((d) => d.id).sort().join(',');
  igual(ids(painel('list', 'fila', 'em-andamento')), 'F1,F4', 'em-andamento');
  igual(ids(painel('list', 'fila', 'feito')), 'F3', 'por etapa');
  igual(ids(painel('list', 'fila', 'concluido')), 'F5', 'por estado antigo');
});
caso('update com nota ou estado é recusado (apontam agora e etapa); null ainda limpa', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"nota":"x"}'), 'use "agora"', 'nota');
  recusa(painel('update', 'fila', 'F1', '{"estado":"aberto"}'), 'use "etapa"', 'estado');
  igual(painel('update', 'fila', 'F1', '{"nota":null,"estado":null}').exit, 0, 'null limpa');
});

caso('F29-a: título que cita item ou PR é recusado no set, no update e no batch (o F1 do disco fica intacto)', () => {
  semear();
  recusa(painel('set', 'fila', 'F1', '{"titulo":"F27 refaz","etapa":"design","tema":"editor"}'), 'o título não cita item nem PR ("F27")', 'set F27');
  ok(!existsSync(join(base, 'painel', 'fila', 'F1.json')), 'o set recusado gravou mesmo assim');
  painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"titulo":"conserta #1100"}'), 'o título não cita item nem PR ("#1100")', 'update #1100');
  const b = painel('batch', JSON.stringify([{ op: 'update', colecao: 'fila', id: 'F1', data: { agora: 'x' } }, { op: 'update', colecao: 'fila', id: 'F1', data: { titulo: 'depois do F3' } }]));
  igual(b.exit, 1, 'batch com título numerado');
  const g = json(painel('get', 'fila', 'F1')).data;
  igual(g.titulo, 'T', 'título intacto');
  ok(g.agora === undefined, 'o batch recusado gravou a primeira op');
});
caso('F29-a: o limite da regra — "Fatia 1", "OF1" e "F5x" passam; título antigo numerado deixa o update de outro campo passar', () => {
  semear();
  for (const [i, t] of ['Fatia 1', 'OF1', 'F5x'].entries()) {
    const r = painel('set', 'fila', `F${i + 3}`, `{"titulo":"${t}","etapa":"design","tema":"editor"}`);
    igual(r.exit, 0, `set "${t}" (${r.err})`);
  }
  writeFileSync(join(base, 'painel', 'fila', 'F2.json'), JSON.stringify({ id: 'F2', version: 1, data: { titulo: 'vagas (F22)', etapa: 'design', tema: 'editor', historico: [] } }));
  const r = painel('update', 'fila', 'F2', '{"agora":"seguindo"}');
  igual(r.exit, 0, `update de agora (${r.err})`);
  igual(json(painel('get', 'fila', 'F2')).data.titulo, 'vagas (F22)', 'título antigo preservado');
});

const LA = 'local_00000000-0000-4000-8000-0000000000a1';
const LB = 'local_00000000-0000-4000-8000-0000000000b2';
const comAdd = (F, l, ap, o) => painel('com', 'add', F, l, ap, o);

caso('F30-1: com add duas vezes com sessões diferentes dá duas entradas; repetir a mesma troca o oQue', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  igual(comAdd('F1', LA, 'E1', 'título sem número').exit, 0, 'add E1');
  igual(comAdd('F1', LB, 'V4', 'botão abrir').exit, 0, 'add V4');
  let com = json(painel('get', 'fila', 'F1')).data.com;
  igual(com.length, 2, 'duas entradas'); igual(com[1].apelido, 'V4', 'segunda é a V4');
  igual(comAdd('F1', LA, 'E1', 'só o conserto').exit, 0, 'add repetido');
  com = json(painel('get', 'fila', 'F1')).data.com;
  igual(com.length, 2, 'continua com duas'); igual(com[0].oQue, 'só o conserto', 'oQue trocado');
});
caso('F30-1: com del tira a sessão do com; quem não está sai com exit 1', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  comAdd('F1', LA, 'dona', 'título'); comAdd('F1', LB, 'ajuda', 'botão');
  const a = painel('com', 'del', 'F1', LB); igual(a.exit, 0, `del (${a.err})`);
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.com.length, 1, 'tirou a ajuda'); ok(d.fez === undefined, 'del não grava fez');
  recusa(painel('com', 'del', 'F1', LB), 'não está em com', 'del de quem não está');
  recusa(painel('com', 'del', 'F1', LA, '--fez'), 'uso: painel.mjs com del', '--fez saiu');
});
caso('F30-1: o update, o set e o batch com com são recusados (use com add|del); o com do disco fica intacto', () => {
  semear(); painel('set', 'fila', 'F1', COM()); comAdd('F1', LA, 'E1', 'título');
  recusa(painel('update', 'fila', 'F1', JSON.stringify({ com: [] })), 'painel com add|del', 'update com []');
  recusa(painel('update', 'fila', 'F1', '{"com":null}'), 'painel com add|del', 'update com null');
  recusa(painel('set', 'fila', 'F2', COM({ com: [{ localId: LB, apelido: 'V4', oQue: 'x' }] })), 'painel com add|del', 'set com');
  const b = painel('batch', JSON.stringify([{ op: 'update', colecao: 'fila', id: 'F1', data: { com: [{ localId: LB, apelido: 'V4', oQue: 'x' }] } }]));
  recusa(b, 'painel com add|del', 'batch com');
  const com = json(painel('get', 'fila', 'F1')).data.com;
  igual(com.length, 1, 'com intacto'); igual(com[0].apelido, 'E1', 'ainda a E1');
});
caso('F30-1: fechar o item com com não vazio é recusado; sem com, fecha e apaga a espera', () => {
  semear(); painel('set', 'fila', 'F1', COM()); comAdd('F1', LA, 'E1', 'título');
  recusa(painel('update', 'fila', 'F1', '{"etapa":"feito"}'), 'fecha com sessões trabalhando nele (com: E1', 'fechar com com');
  igual(json(painel('get', 'fila', 'F1')).data.etapa, 'planejamento', 'etapa intacta');
  painel('com', 'del', 'F1', LA);
  igual(painel('update', 'fila', 'F1', '{"espera":{"motivo":"gate","texto":"gate do lote"}}').exit, 0, 'espera gate passa');
  igual(painel('update', 'fila', 'F1', '{"etapa":"feito"}').exit, 0, 'fecha sem com');
  ok(json(painel('get', 'fila', 'F1')).data.espera === undefined, 'a espera foi apagada ao fechar');
});
caso('F30-1: set --se-versao sem o campo com preserva o com gravado; fechar por set com com é recusado', () => {
  semear(); painel('set', 'fila', 'F1', COM()); comAdd('F1', LA, 'E1', 'título'); comAdd('F1', LB, 'V4', 'valida');
  const v = () => json(painel('get', 'fila', 'F1')).version;
  igual(painel('set', 'fila', 'F1', COM({ agora: 'x' }), '--se-versao', String(v())).exit, 0, 'set viva passa');
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.com.length, 2, 'com preservado no set'); igual(d.agora, 'x', 'o set gravou o resto');
  recusa(painel('set', 'fila', 'F1', COM({ etapa: 'feito' }), '--se-versao', String(v())), 'fecha com sessões trabalhando nele (com: E1', 'set feito com com gravado');
  const f = json(painel('get', 'fila', 'F1')).data;
  igual(f.etapa, 'planejamento', 'etapa intacta'); igual(f.com.length, 2, 'com intacto');
});
// `fez` e `passaram` são históricos de itens antigos: o set guarda o gravado, e set/update/batch que os mudam são recusados.
const comHistorico = (F) => {
  const arq = join(base, 'painel', 'fila', `${F}.json`);
  const doc = JSON.parse(readFileSync(arq, 'utf8'));
  doc.data.fez = [{ localId: LA, apelido: 'E1', oQue: 'título', em: '2026-10-25T10:00:00.000Z' }];
  doc.data.passaram = [{ localId: LA, apelido: 'E1', papel: 'E', em: '2026-10-25T10:00:00.000Z' }];
  writeFileSync(arq, JSON.stringify(doc));
};
caso('F30-1: fez e passaram antigos são só leitura: o set os preserva, e set/update/batch que os mudam são recusados', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'validacao' })); comHistorico('F1');
  const v = () => json(painel('get', 'fila', 'F1')).version;
  igual(painel('set', 'fila', 'F1', COM({ etapa: 'validacao', espera: { motivo: 'operador', texto: 'decidir' } }), '--se-versao', String(v())).exit, 0, 'set sem fez passa');
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.fez.length, 1, 'fez preservado no set'); igual(d.passaram.length, 1, 'passaram preservado no set');
  recusa(painel('set', 'fila', 'F1', COM({ etapa: 'validacao', fez: [] }), '--se-versao', String(v())), 'é histórico de item antigo', 'set com fez []');
  recusa(painel('update', 'fila', 'F1', '{"fez":[]}'), 'é histórico de item antigo', 'update com fez');
  recusa(painel('update', 'fila', 'F1', '{"passaram":[]}'), 'é histórico de item antigo', 'update com passaram');
  recusa(painel('batch', JSON.stringify([{ op: 'update', colecao: 'fila', id: 'F1', data: { fez: [] } }])), 'é histórico de item antigo', 'batch com fez');
  recusa(painel('set', 'fila', 'F9', COM({ fez: [{ localId: LA, apelido: 'E1', oQue: 'a', em: '2026-10-25T10:00:00.000Z' }] })), 'é histórico de item antigo', 'set novo com fez');
  igual(json(painel('get', 'fila', 'F1')).data.fez.length, 1, 'fez intacto');
});
caso('F30-1: o set compara com e fez em JSON canônico: igual ao gravado passa (chaves em outra ordem também), diferente é recusado, [] inclusive', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'validacao' })); comHistorico('F1'); comAdd('F1', LB, 'dona', 'valida');
  const v = () => json(painel('get', 'fila', 'F1')).version;
  const g = () => json(painel('get', 'fila', 'F1')).data;
  const inverte = (l) => l.map((e) => Object.fromEntries(Object.entries(e).reverse()));
  const com0 = g().com; const fez0 = g().fez;
  ok(com0.length === 1 && fez0.length === 1, 'precondição: com e fez gravados');
  igual(painel('set', 'fila', 'F1', COM({ etapa: 'validacao', com: inverte(com0), fez: inverte(fez0) }), '--se-versao', String(v())).exit, 0, 'igual com chaves invertidas passa');
  igual(JSON.stringify(g().com), JSON.stringify(com0), 'com intacto'); igual(JSON.stringify(g().fez), JSON.stringify(fez0), 'fez intacto');
  recusa(painel('set', 'fila', 'F1', COM({ etapa: 'validacao', com: [] }), '--se-versao', String(v())), 'painel com add|del', 'set com com []');
  recusa(painel('set', 'fila', 'F1', COM({ etapa: 'validacao', com: [{ localId: LA, apelido: 'E1', oQue: 'x' }] }), '--se-versao', String(v())), 'painel com add|del', 'set com com diferente');
  igual(painel('set', 'fila', 'F2', COM({ com: [] })).exit, 0, 'item novo com com [] passa');
  igual(g().com.length, 1, 'com do F1 intacto');
});
caso('F30-1: espera e com validam o formato (motivo fora da lista, oQue com número, localId repetido, fez.em ruim)', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  recusa(painel('update', 'fila', 'F1', '{"espera":{"motivo":"x","texto":"t"}}'), 'espera.motivo "x" fora da lista', 'motivo x');
  recusa(painel('update', 'fila', 'F1', '{"espera":{"motivo":"operador","texto":" "}}'), 'espera.texto', 'texto vazio');
  igual(painel('update', 'fila', 'F1', '{"espera":{"motivo":"operador","texto":"decidir"}}').exit, 0, 'operador passa');
  igual(painel('update', 'fila', 'F1', '{"espera":null}').exit, 0, 'null limpa');
  recusa(comAdd('F1', LA, 'E1', 'refaz o F12'), 'não cita item nem PR ("F12")', 'oQue com F12');
  recusa(comAdd('F1', 'local_x', 'E1', 'ok'), 'não é local_<uuid>', 'localId ruim');
  const rep = JSON.stringify({ fez: [{ localId: LA, apelido: 'E1', oQue: 'a', em: '2026-10-25T10:00:00.000Z' }, { localId: LA, apelido: 'E1', oQue: 'b', em: '2026-10-25T10:00:00.000Z' }] });
  recusa(painel('update', 'fila', 'F1', rep), 'repete', 'fez repetido');
  recusa(painel('update', 'fila', 'F1', JSON.stringify({ fez: [{ localId: LA, apelido: 'E1', oQue: 'a', em: 'ontem' }] })), 'não é data ISO', 'fez.em');
});

// F32: `soltar` e `list fila vencidos`.
const agoraMenos = (min) => new Date(Date.now() - min * 60_000).toISOString();
const dono = { donoLocalId: LA, donoApelido: 'P1' };
const porCom = (F, extra) => painel('set', 'fila', F, COM({ etapa: 'execucao', ...extra }));
const ids = (r) => json(r).map((d) => d.id).sort().join(',');
caso('F32: soltar zera dono e com, grava o agora igual ao motivo, deixa o historico e não cria fez', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'execucao', ...dono }));
  comAdd('F1', LA, 'E1', 'parte'); comAdd('F1', LB, 'V1', 'valida');
  const r = painel('soltar', 'F1', 'a dona se declarou livre sem soltar');
  igual(r.exit, 0, `soltar: exit (${r.err})`);
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.donoLocalId, undefined, 'donoLocalId'); igual(d.donoApelido, undefined, 'donoApelido');
  igual(JSON.stringify(d.com), '[]', 'com'); igual(d.fez, undefined, 'sem fez');
  igual(d.agora, 'a dona se declarou livre sem soltar', 'agora');
  const ultimo = d.historico[d.historico.length - 1];
  igual(ultimo.dono, null, 'historico: dono null'); igual(ultimo.etapa, 'execucao', 'historico: etapa');
});
caso('F32: soltar recusa item que não existe, etapa final, motivo vazio e motivo com número de item ou PR', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'execucao' })); painel('set', 'fila', 'F2', COM({ etapa: 'feito' }));
  recusa(painel('soltar', 'F9', 'x'), 'não existe', 'inexistente');
  recusa(painel('soltar', 'F2', 'x'), 'etapa final', 'feito');
  recusa(painel('soltar', 'F1', ' '), 'falta o "<motivo>"', 'motivo vazio');
  recusa(painel('soltar', 'F1'), 'falta o "<motivo>"', 'sem motivo');
  recusa(painel('soltar', 'F1', 'solta o F12'), 'não cita item nem PR ("F12")', 'F12');
  recusa(painel('soltar', 'F1', 'por causa do #44'), 'não cita item nem PR ("#44")', 'PR');
  igual(json(painel('get', 'fila', 'F1')).version, 1, 'nada gravado nas recusas');
});
caso('F32: vencidos devolve o parado com dono ou com, e deixa de fora o recente, o com espera, o com trava e o sem ninguém', () => {
  semear();
  porCom('F1', { ...dono, atualizadoEm: agoraMenos(90) });                                                     // vencido, dono
  porCom('F2', { atualizadoEm: agoraMenos(90), com: [] });                                                      // sem dono e com vazio
  painel('set', 'fila', 'F3', COM({ etapa: 'execucao', ...dono, atualizadoEm: agoraMenos(2) }));               // recente
  painel('set', 'fila', 'F4', COM({ etapa: 'execucao', ...dono, atualizadoEm: agoraMenos(90), espera: { motivo: 'operador', texto: 'decidir' } }));
  painel('set', 'fila', 'F5', COM({ etapa: 'execucao', ...dono, atualizadoEm: agoraMenos(90), trava: { motivo: 'outra', texto: 't' } }));
  painel('set', 'fila', 'F6', COM({ etapa: 'execucao', atualizadoEm: agoraMenos(90) }));                        // vencido, só com
  comAdd('F6', LB, 'E2', 'parte');
  painel('update', 'fila', 'F6', JSON.stringify({ atualizadoEm: agoraMenos(90) }));
  painel('set', 'fila', 'F7', COM({ etapa: 'feito', atualizadoEm: agoraMenos(90) }));                           // final
  const r = painel('list', 'fila', 'vencidos');
  igual(r.exit, 0, `exit (${r.err})`);
  igual(ids(r), 'F1,F6', 'vencidos');
  igual(ids(painel('list', 'fila', 'vencidos', '--min', '1')), 'F1,F3,F6', 'com --min 1 o recente também vence');
  igual(ids(painel('list', 'fila', 'vencidos', '--min', '200')), '', '--min 200 não acha nada');
  igual(ids(run('node', [join(SCRIPTS, 'painel.mjs'), 'list', 'fila', 'vencidos'], { PAINEL_PRAZO_MIN: '1' })), 'F1,F3,F6', 'PAINEL_PRAZO_MIN vale');
});
caso('F32: vencidos recusa --min que não é inteiro positivo', () => {
  semear();
  for (const v of ['0', '-3', 'x', '1.5', '']) recusa(painel('list', 'fila', 'vencidos', '--min', v), '--min pede um inteiro positivo', `--min ${v}`);
  recusa(painel('list', 'fila', 'vencidos', '--min'), '--min pede um inteiro positivo', '--min sem valor');
});

caso('F32 M5: soltar --so-dono tira só o dono e deixa o com', () => {
  semear(); painel('set', 'fila', 'F1', COM({ etapa: 'execucao', ...dono })); comAdd('F1', LB, 'V1', 'valida');
  igual(painel('soltar', 'F1', 'x', '--so-dono').exit, 0, 'exit');
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.donoLocalId, undefined, 'dono saiu'); igual(d.com.length, 1, 'com ficou');
  igual(painel('soltar', 'F1', '--so-dono', 'y').exit, 0, 'a flag vale em qualquer posição');
});
caso('F32 B8: soltar recusa o item legado fechado pelo estado (sem etapa)', () => {
  semear(); mkdirSync(join(base, 'painel', 'fila'), { recursive: true });
  writeFileSync(join(base, 'painel', 'fila', 'F1.json'), JSON.stringify({ id: 'F1', version: 1, data: { titulo: 'T', tema: 'editor', estado: 'feito' } }));
  recusa(painel('soltar', 'F1', 'x'), 'etapa final', 'legado feito');
});
caso('F32 B9: vencidos vale em qualquer posição; --min sem vencidos e flag desconhecida em list fila saem com exit 1', () => {
  semear(); porCom('F1', { ...dono, atualizadoEm: agoraMenos(90) });
  igual(ids(painel('list', 'fila', '--min', '1', 'vencidos')), 'F1', 'vencidos depois do --min');
  recusa(painel('list', 'fila', '--min', '1'), '--min só vale com', '--min sem vencidos');
  recusa(painel('list', 'fila', '--bobagem'), 'flag desconhecida', 'flag');
  for (const f of ['vencido', 'xyz']) recusa(painel('list', 'fila', f), 'filtro desconhecido', `filtro ${f}`);
  recusa(painel('list', 'fila', 'xyz'), 'válidos: em-andamento · vencidos · sem-dona · planejamento', 'a lista dos válidos');
  for (const f of ['em-andamento', 'vencidos', 'sem-dona', 'execucao', 'feito', 'aberto', 'concluido']) igual(painel('list', 'fila', f).exit, 0, `filtro ${f} vale`);
  igual(painel('list', 'sessoes', 'xyz').exit, 0, 'o filtro livre das outras coleções não muda');
});

// `semDona` na `list fila`, calculado fora de `data` e nunca gravado.
caso('list fila traz `semDona` fora de data (null quando tem gente) e não grava nada; o filtro `sem-dona` separa os sem dona', () => {
  semear();
  porCom('F1', { etapa: 'execucao', donoLocalId: null, donoApelido: null, historico: [{ em: agoraMenos(30), etapa: 'execucao', dono: null }] });
  porCom('F2', { etapa: 'execucao', donoLocalId: null, donoApelido: null, historico: [{ em: agoraMenos(30), etapa: 'execucao', dono: null }] });
  comAdd('F2', LB, 'dona', 'executa');
  const antes = readFileSync(join(base, 'painel', 'fila', 'F1.json'), 'utf8');
  const todos = json(painel('list', 'fila'));
  const f1 = todos.find((d) => d.id === 'F1'); const f2 = todos.find((d) => d.id === 'F2');
  ok(f1 && f2, 'os dois itens saem na lista');
  ok(f1.semDona && f1.semDona.minutos >= 29, `F1 sem dona (${JSON.stringify(f1.semDona)})`);
  igual(f2.semDona, null, 'F2 tem gente no com: semDona é null');
  igual('semDona' in f1.data, false, 'semDona fora de data');
  igual(readFileSync(join(base, 'painel', 'fila', 'F1.json'), 'utf8'), antes, 'o arquivo não muda');
  igual(ids(painel('list', 'fila', 'sem-dona')), 'F1', 'filtro sem-dona');
  igual(painel('get', 'fila', 'F1').out.includes('semDona"'), false, 'get não grava nem mostra o calculado');
});

caso('F150: com del aceita o apelido; ausente erra; repetido erra', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  comAdd('F1', LA, 'dona', 'título'); comAdd('F1', LB, 'ajuda', 'botão');
  recusa(painel('com', 'del', 'F1', 'outra'), 'não está em com', 'apelido ausente');
  const a = painel('com', 'del', 'F1', 'ajuda'); igual(a.exit, 0, `del pelo apelido (${a.err})`);
  const d = json(painel('get', 'fila', 'F1')).data;
  igual(d.com.length, 1, 'tirou a ajuda'); igual(d.com[0].apelido, 'dona', 'ficou a dona');
  comAdd('F1', LB, 'dona', 'b');
  recusa(painel('com', 'del', 'F1', 'dona'), 'apelido ambíguo, use o local_', 'apelido repetido');
  igual(json(painel('get', 'fila', 'F1')).data.com.length, 2, 'o ambíguo não tirou ninguém');
});
// F155: com add recusa o id da orquestradora (quem abre a dona pode passar o próprio id no lugar do dela).
const registro = (id, titulo) => {
  const d = join(base, 'appsess'); mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${id}.json`), JSON.stringify({ sessionId: id, title: titulo, cwd: base, isArchived: false }));
};
const comAddReg = (F, l, ap, o) => run('node', [join(SCRIPTS, 'painel.mjs'), 'com', 'add', F, l, ap, o], { POOL_APP_SESSOES_DIR: join(base, 'appsess') });
caso('F155: com add com o id da orquestradora é recusado e não grava; o da dona passa', () => {
  semear(); painel('set', 'fila', 'F1', COM());
  registro(LA, '🎛 orquestradora — kit');
  registro(LB, 'F1 · editor');
  const antes = JSON.stringify(json(painel('get', 'fila', 'F1')));
  const r = comAddReg('F1', LA, 'dona', 'x');
  igual(r.exit, 1, `exit (${r.out}${r.err})`); ok(r.err.includes('orquestradora'), `stderr: ${r.err}`);
  igual(JSON.stringify(json(painel('get', 'fila', 'F1'))), antes, 'o item mudou');
  igual(comAddReg('F1', LB, 'dona', 'x').exit, 0, 'a dona passa');
  const L30 = 'local_00000000-0000-4000-8000-000000000030';
  igual(comAddReg('F1', L30, 'dona', 'x').exit, 0, 'sem registro passa');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
