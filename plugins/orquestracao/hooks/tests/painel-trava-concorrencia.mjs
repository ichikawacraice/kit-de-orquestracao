#!/usr/bin/env node
// Medida longa da trava do painel (F5-consertos-3): 80 rodadas × 20 processos. Em cada rodada, metade começa com uma trava órfã
// semeada (pid morto, 60 s atrás); 20 `update` simultâneos sem --se-versao têm de somar 20 versões (atualização perdida = exclusão
// mútua furada), nenhum aviso de trava viva e nenhum `.trava*` sobrando. Roda em diretório temporário.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const RODADAS = Number(process.env.RODADAS || 80), N = Number(process.env.PROCESSOS || 20);
const base = mkdtempSync(join(tmpdir(), 'painel-conc-'));
const dir = join(base, 'painel'); mkdirSync(dir, { recursive: true }); mkdirSync(join(base, 'home'), { recursive: true });
const env = { ...process.env, PAINEL_DIR: dir, HOME: join(base, 'home') };
const painel = (...a) => spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...a], { env, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL' });
const roda = (...a) => new Promise((res) => { const c = spawn('node', [join(SCRIPTS, 'painel.mjs'), ...a], { env }); const r = { err: '', exit: null }; c.stderr.on('data', (d) => { r.err += d; }); c.on('close', (x) => { r.exit = x; res(r); }); });
const pidMorto = () => { const p = spawnSync('true'); return p.pid; };
const ITEM = '{"titulo":"x","estado":"aberto","historico":[]}';
let ruins = 0, orfasRoubadas = 0, avisosVivos = 0, sobras = 0, perdidas = 0, falhouSemGravar = 0, falhouDepoisDeGravar = 0;
for (let r = 1; r <= RODADAS; r++) {
  painel('set', 'fila', 'F1', ITEM);
  const antes = JSON.parse(painel('get', 'fila', 'F1').stdout).version;
  if (r % 2) { const t = join(dir, '.trava'); mkdirSync(t); writeFileSync(join(t, 'dono'), `${pidMorto()}-morto`); const v = new Date(Date.now() - 60_000); utimesSync(t, v, v); }
  const rs = await Promise.all(Array.from({ length: N }, (_, i) => roda('update', 'fila', 'F1', JSON.stringify({ [`m${i}`]: 1 }))));
  const lido = JSON.parse(painel('get', 'fila', 'F1').stdout);
  const gravou = rs.map((_, i) => lido.data[`m${i}`] === 1);
  rs.forEach((x, i) => {
    if (x.exit !== 0) { if (gravou[i]) falhouDepoisDeGravar++; else falhouSemGravar++; ruins++; console.log(`rodada ${r}: processo ${i} saiu ${x.exit} (${gravou[i] ? 'DEPOIS de gravar' : 'sem gravar'}): ${x.err.trim()}`); }
    else if (!gravou[i]) { perdidas++; ruins++; console.log(`rodada ${r}: processo ${i} saiu 0 e a gravação sumiu`); }
  });
  if (lido.version - antes !== gravou.filter(Boolean).length) { perdidas++; ruins++; console.log(`rodada ${r}: versão +${lido.version - antes}, gravaram ${gravou.filter(Boolean).length}`); }
  avisosVivos += rs.filter((x) => x.err.includes('perdeu-trava-viva')).length;
  orfasRoubadas += rs.filter((x) => x.err.includes('órfã')).length;
  const s = readdirSync(dir).filter((n) => n.startsWith('.trava')); if (s.length) { sobras++; ruins++; console.log(`rodada ${r}: sobrou ${s}`); }
}
rmSync(base, { recursive: true, force: true });
console.log(`rodadas=${RODADAS} processos=${N} atualizacoes-perdidas=${perdidas} falhou-sem-gravar=${falhouSemGravar} falhou-depois-de-gravar=${falhouDepoisDeGravar} avisos-trava-viva=${avisosVivos} rodadas-com-sobra=${sobras} orfas-removidas=${orfasRoubadas} (esperado ${Math.ceil(RODADAS / 2)})`);
process.exitCode = ruins || avisosVivos || orfasRoubadas !== Math.ceil(RODADAS / 2) ? 1 : 0;
