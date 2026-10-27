#!/usr/bin/env node
// `atualizar-plugins [--seco] [--json]` (F151): põe os plugins do kit (escopo user) na versão publicada no marketplace.
// Sequência: lista os instalados → `marketplace update` → confere que o clone está no commit do GitHub (uma nova tentativa) →
// `plugin update <nome>@kit-de-orquestracao -s user` onde a versão difere → lista de novo. Cópia `project` não se mexe; plugin
// que falta não se instala. Ambiente: CLAUDE_BIN, GIT_BIN (trocam os executáveis), KIT_MARKETPLACE_DIR (o clone, senão
// ~/.claude/plugins/marketplaces/kit-de-orquestracao), KIT_UPDATE_TIMEOUT_MS (marketplace e update; padrão 180 s).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MARKETPLACE = 'kit-de-orquestracao';
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const GIT = process.env.GIT_BIN || 'git';
const CLONE = process.env.KIT_MARKETPLACE_DIR || join(homedir(), '.claude', 'plugins', 'marketplaces', MARKETPLACE);
const LONGO_MS = Number(process.env.KIT_UPDATE_TIMEOUT_MS) || 180_000;
const CURTO_MS = 30_000;

function rodar(bin, args, limite) {
  try {
    return { status: 0, out: execFileSync(bin, args, { encoding: 'utf8', timeout: limite, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }), err: '' };
  } catch (e) {
    if (e?.code === 'ENOENT') throw new Error(`${bin} não encontrado no PATH`);
    if (e?.signal === 'SIGKILL' || e?.code === 'ETIMEDOUT') throw new Error(`${bin} ${args.slice(0, 3).join(' ')} não respondeu em ${limite / 1000} s`);
    return { status: e?.status ?? 1, out: String(e?.stdout ?? ''), err: String(e?.stderr ?? '').trim() };
  }
}
const claude = (args, limite = CURTO_MS) => rodar(CLAUDE, args, limite);
const git = (args) => rodar(GIT, args, CURTO_MS);

function instalados() {
  const r = claude(['plugin', 'list', '--json']);
  if (r.status !== 0) throw new Error(`claude plugin list falhou: ${r.err || `exit ${r.status}`}`);
  const lista = JSON.parse(r.out);
  if (!Array.isArray(lista)) throw new Error('claude plugin list --json não devolveu uma lista');
  return lista.filter((p) => String(p?.id ?? '').endsWith(`@${MARKETPLACE}`));
}
const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
const headDoClone = () => {
  const r = git(['-C', CLONE, 'rev-parse', 'HEAD']);
  if (r.status !== 0) throw new Error(`não achei o clone do marketplace em ${CLONE}: ${r.err}`);
  return r.out.trim();
};
function remoto() {
  const url = git(['-C', CLONE, 'remote', 'get-url', 'origin']);
  if (url.status !== 0) throw new Error(`o clone em ${CLONE} não tem origin: ${url.err}`);
  const r = git(['ls-remote', url.out.trim(), 'refs/heads/main']);
  const sha = r.out.split(/\s/)[0];
  if (r.status !== 0 || !sha) throw new Error(`git ls-remote falhou: ${r.err || 'sem refs/heads/main'}`);
  return sha;
}
function atualizarClone() {
  const antes = headDoClone();
  let depois = antes; let fim = remoto();
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const m = claude(['plugin', 'marketplace', 'update', MARKETPLACE, '--json'], LONGO_MS);
    if (m.status !== 0) throw new Error(`claude plugin marketplace update falhou: ${m.err || `exit ${m.status}`}`);
    depois = headDoClone(); fim = remoto();
    if (depois === fim) return { antes, depois, remoto: fim };
  }
  throw new Error(`o clone do marketplace ficou em ${depois.slice(0, 7)}, o GitHub está em ${fim.slice(0, 7)}`);
}

function main(argv) {
  const seco = argv.includes('--seco');
  const json = argv.includes('--json');
  const desconhecida = argv.find((a) => a !== '--seco' && a !== '--json');
  if (desconhecida) throw new Error('uso: atualizar-plugins [--seco] [--json]');
  const antes = instalados();
  const clone = atualizarClone();
  const publicados = lerJson(join(CLONE, '.claude-plugin', 'marketplace.json')).plugins.map((p) => p.name);
  const versaoPublicada = (nome) => lerJson(join(CLONE, 'plugins', nome, '.claude-plugin', 'plugin.json')).version;
  const plugins = []; let falhou = false; let atualizou = false;
  for (const nome of publicados) {
    const id = `${nome}@${MARKETPLACE}`;
    const publicado = versaoPublicada(nome);
    for (const c of antes.filter((p) => p.id === id && p.scope === 'project')) {
      plugins.push({ id, antes: c.version, publicado, depois: c.version, acao: `não mexido (projeto ${c.projectPath ?? '?'})` });
    }
    const user = antes.find((p) => p.id === id && p.scope === 'user');
    if (!user) { plugins.push({ id, antes: null, publicado, depois: null, acao: 'não instalado' }); continue; }
    if (user.version === publicado) { plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'em dia' }); continue; }
    if (seco) { plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'atualizaria' }); continue; }
    const u = claude(['plugin', 'update', id, '--json', '-s', 'user'], LONGO_MS);
    if (u.status !== 0) { falhou = true; plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'falhou', mensagem: u.err || `exit ${u.status}` }); continue; }
    atualizou = true;
    plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'atualizado' });
  }
  if (atualizou) {
    const depois = instalados();
    for (const p of plugins) if (p.acao === 'atualizado') p.depois = depois.find((x) => x.id === p.id && x.scope === 'user')?.version ?? p.depois;
  }
  const resultado = { clone, plugins, reiniciar: atualizou };
  if (json) process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  else {
    const larg = Math.max(...plugins.map((p) => p.id.split('@')[0].length));
    for (const p of plugins) {
      const nome = p.id.split('@')[0].padEnd(larg);
      const quadro = p.acao === 'atualizado' || p.acao === 'atualizaria' ? `${p.antes} → ${p.publicado}${p.acao === 'atualizaria' ? ' (atualizaria)' : ''}`
        : p.acao === 'em dia' ? `${p.antes} (em dia)`
          : p.acao === 'falhou' ? `${p.antes} (falhou: ${p.mensagem})`
            : p.acao.startsWith('não mexido') ? `${p.antes} (${p.acao})` : `(${p.acao})`;
      process.stdout.write(`${nome}  ${quadro}\n`);
    }
    const faltaAtualizar = plugins.some((p) => p.acao === 'atualizaria');
    process.stdout.write(atualizou ? 'Reinicie o app para valer.\n' : faltaAtualizar ? 'Rode sem --seco para atualizar.\n' : 'Nada a atualizar.\n');
  }
  return falhou ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`atualizar-plugins: ${err?.message || err}\n`);
  process.exitCode = 1;
}
