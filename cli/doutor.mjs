// `kit doutor`: confere o ambiente (plugin, hooks duplicados, kit.json, versão, Node, git) e o disco contra o lock.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { carregarConfig } from '../gate/config.mjs';
import { LOCK, blocosDe, lerLock, sha256 } from './lock.mjs';
import { COMPARTILHADOS, HOOK_GUARDA, MARKETPLACE, PLUGIN, RAIZ_DO_KIT, lerTexto } from './pacote.mjs';

const lerJson = (caminho) => { try { return JSON.parse(readFileSync(caminho, 'utf8')); } catch { return null; } };

export function doutor({ destino, versao, home = process.env.HOME || homedir() }) {
  const { lock, erro } = lerLock(destino);
  if (erro) return { codigo: 1, saida: '', erro: `kit doutor: ${erro}${erro.startsWith('não achei') ? ' — rode `kit iniciar` ou `kit adotar`' : ''}` };
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
  // só conta quem está num `command` dentro de `hooks` (uma permissão que cita o script não dispara hook nenhum)
  const global = lerJson(join(home, '.claude', 'settings.json'));
  const comandos = Object.values(global?.hooks ?? {}).flat().flatMap((g) => g?.hooks ?? []).map((h) => String(h?.command ?? ''));
  const duplicados = nomes.filter((n) => comandos.some((c) => c.includes(n)));
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
  // as chaves que o kit escreveu em settings.json e package.json (o resto desses arquivos é do projeto)
  const c = lock.chaves ?? {};
  const st = lerJson(join(destino, '.claude', 'settings.json'));
  if (c.settings?.hook && !(st?.hooks?.PreToolUse ?? []).some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) falha('hook da guarda sumiu do .claude/settings.json (foi o kit que o pôs)');
  if (c.settings?.marketplace && !st?.extraKnownMarketplaces?.[MARKETPLACE]) linhas.push(`aviso: marketplace ${MARKETPLACE} sumiu do .claude/settings.json`);
  const pk = lerJson(join(destino, 'package.json'));
  for (const t of c.package?.trocados ?? []) if (pk?.scripts?.[t.nome] !== t.gate) linhas.push(`aviso: scripts.${t.nome} (package.json) não passa mais pelo gate`);
  for (const [nome, valor] of Object.entries(c.package?.scripts ?? {})) if (pk?.scripts?.[nome] !== valor) linhas.push(`aviso: scripts.${nome} (package.json) não está mais como o kit deixou`);
  for (const p of lock.pendente ?? []) linhas.push(`aviso: pendente da adoção: ${p}`);
  linhas.push(falhas ? `${falhas} falha(s)` : 'tudo em dia');
  return { codigo: falhas ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}
