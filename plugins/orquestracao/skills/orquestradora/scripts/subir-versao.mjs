#!/usr/bin/env node
// `subir-versao [--seco] [--empurrar] [--destacado] [--base <branch>]` (F173): depois de um lote de merges, sobe o patch da `version` de cada plugin
// que mudou desde a última subida (o último commit que mexeu na linha "version" do plugin.json) e commita tudo de uma vez.
// Rodar na raiz do repositório, na base (padrão main) em dia. Saída JSON: {subiu, commit?, empurrou?, pulados?} ou {recusado, motivo} com exit 1.
// `--destacado` (F373): aceita o HEAD destacado (o worktree temporário da fila sem turno), que tem de estar em dia com origin/<base>.
// Ambiente: GIT_BIN troca o `git` (teste).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GIT = process.env.GIT_BIN || 'git';
const git = (args) => execFileSync(GIT, args, { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tenta = (args) => { try { git(args); return true; } catch { return false; } };

function recusa(motivo) {
  process.stdout.write(`${JSON.stringify({ recusado: true, motivo })}\n`);
  process.exitCode = 1;
}

function main() {
  const args = process.argv.slice(2);
  const seco = args.includes('--seco');
  const empurrar = args.includes('--empurrar');
  const destacado = args.includes('--destacado');
  const i = args.indexOf('--base');
  const base = i >= 0 ? args[i + 1] : 'main';
  if (!base) { recusa('--base pede um valor'); return; }

  if (git(['status', '--porcelain'])) { recusa('árvore com mudança não commitada'); return; }
  const atual = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (atual !== base && !(destacado && atual === 'HEAD')) { recusa(`fora da ${base} (estou em ${atual}); a subida é na ${base}`); return; }
  if (destacado && atual === 'HEAD' && !tenta(['remote', 'get-url', 'origin'])) { recusa(`--destacado precisa do origin/${base} para conferir a ponta`); return; }
  if (tenta(['remote', 'get-url', 'origin'])) {
    if (!tenta(['fetch', '-q', 'origin', base])) { recusa(`não consegui buscar origin/${base}`); return; }
    if (!tenta(['merge-base', '--is-ancestor', `origin/${base}`, 'HEAD'])) { recusa(`${base} atrás de origin/${base}; puxe antes`); return; }
  }

  const raiz = git(['rev-parse', '--show-toplevel']);
  const marketplace = JSON.parse(readFileSync(join(raiz, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const subiu = []; const pulados = []; const tocados = [];
  for (const pl of marketplace.plugins ?? []) {
    // origem remota (F350: git-subdir do repositório da empresa): a versão mora lá, e o kit só move o sha da entrada
    if (typeof pl.source !== 'string') continue;
    const fonte = pl.source.replace(/^\.\//, '').replace(/\/$/, '');
    const arquivoJson = `${fonte}/.claude-plugin/plugin.json`;
    // só a linha da base, e o diff do merge pelo primeiro pai: o plugin que chegou por merge de subárvore (F357) tem a versão vista no
    // commit que o trouxe, e o merge da base dentro da branch de um PR não vira referência
    const ref = git(['log', '-1', '--format=%H', '--first-parent', '--diff-merges=first-parent', '--no-patch', '-G"version"', '--', arquivoJson]);
    if (!ref) { pulados.push({ nome: pl.name, motivo: 'plugin.json nunca teve versão commitada' }); continue; }
    const arquivos = git(['diff', '--name-only', ref, 'HEAD', '--', fonte]).split('\n').filter(Boolean);
    if (arquivos.length === 0) continue;
    const caminho = join(raiz, arquivoJson);
    const texto = readFileSync(caminho, 'utf8');
    const m = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/.exec(texto);
    if (!m) { pulados.push({ nome: pl.name, motivo: 'sem version semver no plugin.json' }); continue; }
    const antes = `${m[1]}.${m[2]}.${m[3]}`;
    const depois = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
    subiu.push({ nome: pl.name, antes, depois, arquivos });
    tocados.push(arquivoJson);
    if (!seco) writeFileSync(caminho, texto.replace(m[0], m[0].replace(antes, depois)));
  }

  const saida = { subiu };
  if (pulados.length) saida.pulados = pulados;
  if (!seco && subiu.length) {
    git(['add', '--', ...tocados.filter((f) => existsSync(join(raiz, f)))]);
    git(['commit', '-q', '-m', `chore(versao): sobe os plugins do lote — ${subiu.map((s) => `${s.nome} ${s.depois}`).join(', ')}`]);
    saida.commit = git(['rev-parse', 'HEAD']);
    if (empurrar) { git(['push', '-q', 'origin', `HEAD:${base}`]); saida.empurrou = true; }
  }
  process.stdout.write(`${JSON.stringify(saida)}\n`);
}

// o motivo do git que conta é a linha do `! [rejected]` ou do `fatal:`/`error:`, não o `To <url>` ou o `remote:` que vêm antes
try { main(); } catch (err) {
  const linhas = String(err?.stderr || err?.message || err).split('\n').map((l) => l.trim()).filter(Boolean);
  recusa(linhas.find((l) => /rejected|fatal:|error:/i.test(l)) ?? linhas[0] ?? 'erro sem mensagem');
}
