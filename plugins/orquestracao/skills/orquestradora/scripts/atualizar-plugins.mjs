#!/usr/bin/env node
// `atualizar-plugins [--seco] [--json]` (F151): põe os plugins do kit (escopo user) na versão publicada no marketplace.
// Sequência: lista os instalados → `marketplace update` → confere que o clone está no commit do GitHub (uma nova tentativa) →
// `plugin update <nome>@kit-de-orquestracao -s user` onde a versão difere → lista de novo e confere que a instalada é a publicada (senão `não pegou`, exit 1). Cópia `project` não se mexe; plugin
// que falta não se instala. Plugin renomeado (F332: `design` → `kit-design`): o velho no escopo user dá lugar ao novo, instalado com as
// opções do velho (`--config`) e desligado se o velho estava; só com o novo dentro o velho sai. Ambiente: CLAUDE_BIN, GIT_BIN (trocam os executáveis), KIT_MARKETPLACE_DIR (o clone, senão
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
/** Plugin do kit que mudou de nome: velho → novo (o `design` da Anthropic, instalado pela conta, ofuscava o do kit). */
const RENOMEADOS = { design: 'kit-design' };
const pastaDeConfig = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

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

/**
 * Troca o plugin `velho` (instalação user) pelo `idNovo`: instala o novo com as opções gravadas do velho, desliga-o se o velho estava
 * desligado e só então desinstala o velho. `{ erro }` no primeiro passo que falha; até o novo entrar, o velho fica.
 */
function trocarDeNome(velho, idNovo) {
  let opcoes = {};
  try { opcoes = lerJson(join(pastaDeConfig(), 'settings.json'))?.pluginConfigs?.[velho.id]?.options ?? {}; } catch { /* sem settings: sem opção */ }
  const configs = Object.entries(opcoes && typeof opcoes === 'object' ? opcoes : {})
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v) && v !== '')
    .flatMap(([k, v]) => ['--config', `${k}=${v}`]);
  const i = claude(['plugin', 'install', idNovo, '--json', '-s', 'user', ...configs], LONGO_MS);
  if (i.status !== 0) return { erro: i.err || `install: exit ${i.status}` };
  if (velho.enabled === false) {
    const d = claude(['plugin', 'disable', idNovo, '--json', '-s', 'user']);
    if (d.status !== 0) return { erro: `o novo entrou ligado e o ${velho.id} estava desligado: ${d.err || `exit ${d.status}`}` };
  }
  const u = claude(['plugin', 'uninstall', velho.id, '--json', '-s', 'user'], LONGO_MS);
  if (u.status !== 0) return { erro: `o novo entrou e o ${velho.id} não saiu: ${u.err || `exit ${u.status}`}` };
  return {};
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
  const renomear = new Map(); // novo → a instalação user do velho
  for (const [velho, novo] of Object.entries(RENOMEADOS)) {
    if (!publicados.includes(novo) || publicados.includes(velho)) continue;
    const idVelho = `${velho}@${MARKETPLACE}`;
    for (const c of antes.filter((p) => p.id === idVelho && p.scope === 'project')) {
      plugins.push({ id: idVelho, antes: c.version, publicado: null, depois: c.version, acao: `não mexido (projeto ${c.projectPath ?? '?'}; o plugin agora é ${novo}@${MARKETPLACE}: rode kit atualizar lá)` });
    }
    const user = antes.find((p) => p.id === idVelho && p.scope === 'user');
    if (user) renomear.set(novo, user);
  }
  for (const nome of publicados) {
    const id = `${nome}@${MARKETPLACE}`;
    const publicado = versaoPublicada(nome);
    const velho = renomear.get(nome);
    if (velho && !antes.some((p) => p.id === id && p.scope === 'user')) {
      const era = `era ${velho.id}`;
      if (seco) { plugins.push({ id, antes: velho.version, publicado, depois: velho.version, acao: `renomearia (${era})` }); continue; }
      const r = trocarDeNome(velho, id);
      if (r.erro) { falhou = true; plugins.push({ id, antes: velho.version, publicado, depois: null, acao: 'falhou', mensagem: r.erro }); continue; }
      plugins.push({ id, antes: velho.version, publicado, depois: null, acao: 'conferir', era });
      continue;
    }
    if (velho) {
      // o novo já está: o velho só sai
      if (seco) plugins.push({ id: velho.id, antes: velho.version, publicado: null, depois: velho.version, acao: `desinstalaria (já tem ${id})` });
      else {
        const u = claude(['plugin', 'uninstall', velho.id, '--json', '-s', 'user'], LONGO_MS);
        if (u.status !== 0) { falhou = true; plugins.push({ id: velho.id, antes: velho.version, publicado: null, depois: velho.version, acao: 'falhou', mensagem: u.err || `exit ${u.status}` }); }
        else { atualizou = true; plugins.push({ id: velho.id, antes: velho.version, publicado: null, depois: null, acao: `desinstalado (já tem ${id})` }); }
      }
    }
    for (const c of antes.filter((p) => p.id === id && p.scope === 'project')) {
      plugins.push({ id, antes: c.version, publicado, depois: c.version, acao: `não mexido (projeto ${c.projectPath ?? '?'})` });
    }
    const user = antes.find((p) => p.id === id && p.scope === 'user');
    if (!user) { plugins.push({ id, antes: null, publicado, depois: null, acao: 'não instalado' }); continue; }
    if (user.version === publicado) { plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'em dia' }); continue; }
    if (seco) { plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'atualizaria' }); continue; }
    const u = claude(['plugin', 'update', id, '--json', '-s', 'user'], LONGO_MS);
    if (u.status !== 0) { falhou = true; plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'falhou', mensagem: u.err || `exit ${u.status}` }); continue; }
    plugins.push({ id, antes: user.version, publicado, depois: user.version, acao: 'conferir' });
  }
  if (plugins.some((p) => p.acao === 'conferir')) {
    const relidos = instalados();
    for (const p of plugins.filter((x) => x.acao === 'conferir')) {
      p.depois = relidos.find((x) => x.id === p.id && x.scope === 'user')?.version ?? null;
      const { era } = p; delete p.era;
      if (p.depois === p.publicado && era) { p.acao = `renomeado (${era})`; atualizou = true; continue; }
      if (p.depois === p.publicado) { p.acao = 'atualizado'; atualizou = true; continue; }
      p.acao = 'não pegou'; falhou = true;
      p.mensagem = p.depois === null ? `instalada sumiu da lista, publicada ${p.publicado}` : `instalada ficou em ${p.depois}, publicada ${p.publicado}`;
    }
  }
  const resultado = { clone, plugins, reiniciar: atualizou };
  if (json) process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  else {
    const larg = Math.max(...plugins.map((p) => p.id.split('@')[0].length));
    for (const p of plugins) {
      const nome = p.id.split('@')[0].padEnd(larg);
      const quadro = p.acao === 'atualizado' ? `${p.antes} → ${p.depois}`
        : p.acao === 'atualizaria' ? `${p.antes} → ${p.publicado} (atualizaria)`
        : /^renome(ado|aria) /.test(p.acao) ? `${p.antes} → ${p.acao.startsWith('renomeado') ? p.depois : p.publicado} (${p.acao.replace(' (', ': ').replace(/\)$/, '')})`
        : /^desinstal/.test(p.acao) ? `${p.antes} (${p.acao})`
        : p.acao === 'não pegou' ? `${p.antes} (não pegou: ${p.mensagem})`
        : p.acao === 'em dia' ? `${p.antes} (em dia)`
          : p.acao === 'falhou' ? `${p.antes} (falhou: ${p.mensagem})`
            : p.acao.startsWith('não mexido') ? `${p.antes} (${p.acao})` : `(${p.acao})`;
      process.stdout.write(`${nome}  ${quadro}\n`);
    }
    const faltaAtualizar = plugins.some((p) => /^(atualizaria|renomearia|desinstalaria)/.test(p.acao));
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
