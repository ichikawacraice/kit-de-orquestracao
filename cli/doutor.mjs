// `kit doutor`: confere o ambiente (plugin, hooks duplicados, kit.json, versão, Node, git) e o disco contra o lock.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { carregarConfig } from '../gate/config.mjs';
import { LOCK, blocosDe, sha256 } from './lock.mjs';
import { COMPARTILHADOS, PLUGIN, RAIZ_DO_KIT, lerTexto } from './pacote.mjs';

const lerJson = (caminho) => { try { return JSON.parse(readFileSync(caminho, 'utf8')); } catch { return null; } };

export function doutor({ destino, versao, home = process.env.HOME || homedir() }) {
  const caminho = join(destino, LOCK);
  if (!existsSync(caminho)) return { codigo: 1, saida: '', erro: `kit doutor: não achei ${LOCK} aqui — rode \`kit iniciar\` ou \`kit adotar\`` };
  const lock = JSON.parse(readFileSync(caminho, 'utf8'));
  const linhas = [`kit ${lock.versao}, perfil ${lock.perfil}, ${Object.keys(lock.arquivos).length} arquivos no lock`];
  let falhas = 0;
  const ok = (m) => linhas.push(`ok: ${m}`);
  const falha = (m) => { falhas++; linhas.push(`falha: ${m}`); };

  // plugin instalado e habilitado
  const instalados = lerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {};
  if (instalados[PLUGIN]?.length) ok('plugin orquestracao instalado');
  else falha(`plugin orquestracao não instalado — rode \`claude plugin install ${PLUGIN}\``);
  const configs = [join(home, '.claude', 'settings.json'), join(destino, '.claude', 'settings.json'), join(destino, '.claude', 'settings.local.json')].map(lerJson);
  const flags = configs.map((s) => s?.enabledPlugins?.[PLUGIN]).filter((v) => v !== undefined);
  if (flags.length && flags.every((v) => v === true) || (flags.includes(true) && !flags.includes(false))) ok('plugin orquestracao habilitado');
  else falha('plugin orquestracao não habilitado — `enabledPlugins` do settings.json precisa trazer true');

  // hook do kit duplicado no settings global
  const hooksJson = lerTexto(RAIZ_DO_KIT, 'plugins/orquestracao/hooks/hooks.json') ?? '';
  const nomes = [...new Set([...hooksJson.matchAll(/\/hooks\/([\w-]+\.mjs)/g)].map((m) => m[1]))];
  const global = lerTexto(join(home, '.claude'), 'settings.json') ?? '';
  const duplicados = nomes.filter((n) => global.includes(n));
  if (!nomes.length) falha('não consegui listar os hooks do plugin (hooks.json do kit vazio)');
  else if (duplicados.length) for (const n of duplicados) falha(`hook do kit também em ~/.claude/settings.json: ${n} (dispararia duas vezes)`);
  else ok(`nenhum hook do kit também em ~/.claude/settings.json (${nomes.length} conferidos)`);

  // kit.json
  try { carregarConfig(destino); ok('.claude/kit.json válido'); } catch (e) { falha(`.claude/kit.json: ${e.message}`); }

  // versões, Node e git
  if (lock.versao === versao) ok(`versão do lock (${lock.versao}) igual à do CLI`);
  else falha(`versão: o lock está em ${lock.versao} e o CLI em ${versao} — rode \`kit atualizar\``);
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok(`node ${process.versions.node}`); else falha(`node ${process.versions.node} — o kit pede Node >= 20`);
  const g = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  if (g.status === 0) ok(g.stdout.trim()); else falha('git não encontrado no PATH');

  // disco × lock (arquivos inteiros do kit; os compartilhados são do projeto e mudam à vontade)
  for (const [f, h] of Object.entries(lock.arquivos)) {
    if (COMPARTILHADOS.has(f)) continue;
    const t = lerTexto(destino, f);
    if (t === null) falha(`faltando: ${f}`);
    else if (sha256(t) !== h) falha(`modificado: ${f}`);
  }
  const claude = lerTexto(destino, 'CLAUDE.md');
  for (const [nome, reg] of Object.entries(lock.blocos ?? {})) {
    const b = claude && blocosDe(claude).find((x) => x.nome === nome);
    if (!b) linhas.push(`aviso: bloco ${nome} ausente do CLAUDE.md`);
    else if (sha256(b.conteudo) !== reg.sha256) linhas.push(`aviso: bloco ${nome} editado à mão (o \`kit atualizar\` não o troca)`);
  }
  linhas.push(falhas ? `${falhas} falha(s)` : 'tudo em dia');
  return { codigo: falhas ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}
