// `kit iniciar [--perfil simples|pnpm-workspace]`: prepara um projeto sem CLAUDE.md para o kit.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCK, montarLock } from './lock.mjs';

const RAIZ_DO_KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE = 'kit-de-orquestracao';
const REPO_DO_KIT = 'ichikawacraice/kit-de-orquestracao';
const HOOK_GUARDA = 'node "$CLAUDE_PROJECT_DIR/scripts/kit/guarda-de-operacao.mjs"';
const TESTE_PADRAO_DO_NPM = /no test specified/;

const lerJson = (caminho, padrao) => (existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : padrao);
const gravarJson = (caminho, valor) => writeFileSync(caminho, `${JSON.stringify(valor, null, 2)}\n`);

/** Devolve { codigo, mensagem } — nunca escreve nada antes de validar. */
export function iniciar({ destino, perfil = 'simples', versao }) {
  const modelo = lerJson(join(RAIZ_DO_KIT, 'modelos', 'kit.json'));
  const p = modelo.perfis[perfil];
  if (!p) return { codigo: 2, mensagem: `kit iniciar: perfil "${perfil}" desconhecido — use ${Object.keys(modelo.perfis).join(' ou ')}` };
  if (existsSync(join(destino, 'CLAUDE.md'))) return { codigo: 2, mensagem: 'kit iniciar: já existe CLAUDE.md aqui — o iniciar é só para projeto sem ele (para um projeto em andamento, use `kit adotar`)' };

  const escritos = ['CLAUDE.md', '.claude/kit.json', '.claude/settings.json', 'package.json'];

  // CLAUDE.md a partir do modelo; o título leva o nome da pasta.
  const claude = readFileSync(join(RAIZ_DO_KIT, 'modelos', 'CLAUDE.md'), 'utf8').replace('# <nome do projeto>', `# ${basename(destino)}`);
  writeFileSync(join(destino, 'CLAUDE.md'), claude);

  mkdirSync(join(destino, '.claude'), { recursive: true });
  gravarJson(join(destino, '.claude', 'kit.json'), p.kit);

  // scripts/kit = cópia do gate/ (só os .mjs, sem os testes)
  mkdirSync(join(destino, 'scripts', 'kit'), { recursive: true });
  for (const f of readdirSync(join(RAIZ_DO_KIT, 'gate')).filter((n) => n.endsWith('.mjs')).sort()) {
    copyFileSync(join(RAIZ_DO_KIT, 'gate', f), join(destino, 'scripts', 'kit', f));
    escritos.push(`scripts/kit/${f}`);
  }

  // package.json: test (e typecheck) → gate; o `test` que já existia vira `test:suite` (o gate o chama; sem isso haveria laço).
  const pkgCaminho = join(destino, 'package.json');
  const pkg = lerJson(pkgCaminho, { name: basename(destino).toLowerCase().replace(/[^a-z0-9-_.]+/g, '-'), version: '0.1.0', private: true });
  pkg.scripts = { ...(pkg.scripts ?? {}) };
  const testeAntigo = pkg.scripts.test;
  if (p.suitePadrao) pkg.scripts['test:suite'] = testeAntigo && !TESTE_PADRAO_DO_NPM.test(testeAntigo) && !testeAntigo.includes('scripts/kit/') ? testeAntigo : p.suitePadrao;
  Object.assign(pkg.scripts, p.scripts);
  gravarJson(pkgCaminho, pkg);

  // settings.json: a guarda do projeto e o marketplace/plugins do kit, sem tocar no que já havia.
  const settingsCaminho = join(destino, '.claude', 'settings.json');
  const s = lerJson(settingsCaminho, {});
  s.hooks = { ...(s.hooks ?? {}) };
  s.hooks.PreToolUse = [...(s.hooks.PreToolUse ?? [])];
  if (!s.hooks.PreToolUse.some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) {
    s.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: HOOK_GUARDA }] });
  }
  s.extraKnownMarketplaces = { ...(s.extraKnownMarketplaces ?? {}), [MARKETPLACE]: { source: { source: 'github', repo: REPO_DO_KIT } } };
  s.enabledPlugins = { ...(s.enabledPlugins ?? {}), [`orquestracao@${MARKETPLACE}`]: true, [`painel-sessoes@${MARKETPLACE}`]: true };
  gravarJson(settingsCaminho, s);

  gravarJson(join(destino, LOCK), montarLock({ raiz: destino, versao, perfil, arquivos: escritos }));
  const aviso = existsSync(join(destino, '.git')) ? '' : '\naviso: esta pasta não é um repositório git; o gate mede o toplevel do git, então rode `git init` antes do primeiro `npm test`.';
  return { codigo: 0, mensagem: `kit iniciar: projeto preparado (perfil ${perfil}, ${escritos.length} arquivos, lock em ${LOCK}).${aviso}` };
}
