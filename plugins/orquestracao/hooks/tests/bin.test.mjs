#!/usr/bin/env node
// K3: os wrappers de bin/ chamam os scripts do plugin; textos citam só comandos que existem em bin/.
// Nada aqui toca ~/.claude: HOME e PAINEL_DIR são pastas temporárias.
// Rodar: node hooks/tests/bin.test.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = join(PLUGIN, 'bin');
let falhas = 0; let base;
const ok = (c, m) => { if (!c) throw new Error(m); };
function caso(nome, fn) {
  base = mkdtempSync(join(tmpdir(), 'kit-bin-'));
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); } finally { rmSync(base, { recursive: true, force: true }); }
}
const rodar = (cmd, args = []) => spawnSync(join(BIN, cmd), args, {
  encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
  env: { PATH: process.env.PATH, HOME: join(base, 'home'), PAINEL_DIR: join(base, 'painel') },
});

caso('painel (bin) grava e lista pela coleção fila, com PAINEL_DIR temporário', () => {
  mkdirSync(join(base, 'painel'), { recursive: true }); writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor', projeto: 'x' }])); // o contrato novo da fila exige tema cadastrado
  const u = rodar('painel', ['update', 'fila', 'F1', '{"titulo":"t","etapa":"planejamento","tema":"editor","projeto":"x","papel":"E"}']);
  ok(u.status === 0, `update saiu ${u.status}: ${u.stderr}`);
  ok(existsSync(join(base, 'painel', 'fila', 'F1.json')), 'não gravou no PAINEL_DIR');
  const l = rodar('painel', ['list', 'fila']);
  ok(l.status === 0 && l.stdout.includes('F1'), `list: ${l.status} ${l.stdout} ${l.stderr}`);
  ok(!existsSync(join(base, 'home', '.claude')) || !existsSync(join(base, 'home', '.claude', 'orquestracao', 'painel', 'fila')), 'gravou fora do PAINEL_DIR');
});
caso('proxima-pergunta e proximo-item (bin) contam a partir de 1, sem repetir', () => {
  const q = [rodar('proxima-pergunta'), rodar('proxima-pergunta')].map((r) => r.stdout.trim());
  ok(q[0] === 'Q1' && q[1] === 'Q2', `perguntas: ${q.join(',')}`);
  const f = [rodar('proximo-item'), rodar('proximo-item')].map((r) => r.stdout.trim());
  ok(f[0] === 'F1' && f[1] === 'F2', `itens: ${f.join(',')}`);
});
caso('todo comando de bin/ é executável e os textos do plugin não citam o caminho antigo dos scripts', () => {
  const cmds = readdirSync(BIN);
  ok(cmds.join() === 'atualizar-plugins,painel,proxima-pergunta,proximo-item,subir-versao', `bin/: ${cmds.join()}`);
  for (const c of cmds) ok(statSync(join(BIN, c)).mode & 0o100, `${c} sem permissão de execução`);
  const arquivos = [];
  const varre = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) varre(p); else if (/\.md$/.test(f.name)) arquivos.push(p); } };
  for (const d of ['skills', 'agents', 'pool']) varre(join(PLUGIN, d));
  ok(arquivos.length >= 15, `poucos textos: ${arquivos.length}`);
  const velhos = arquivos.filter((p) => /~\/\.claude\/skills\/orquestradora\/scripts|\bpainel\.mjs\b|proxima-pergunta\.sh|proximo-item\.sh/.test(readFileSync(p, 'utf8')));
  ok(!velhos.length, `citam o caminho antigo: ${velhos.join(', ')}`);
});

console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
