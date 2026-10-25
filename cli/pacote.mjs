// O que o kit põe num projeto e como: o plano é calculado em memória (iniciar, adotar e --simular usam o mesmo) e só então gravado.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { LOCK, blocosDe, sha256 } from './lock.mjs';

export const RAIZ_DO_KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MARKETPLACE = 'kit-de-orquestracao';
export const PLUGIN = `orquestracao@${MARKETPLACE}`;
const REPO_DO_KIT = 'ichikawacraice/kit-de-orquestracao';
export const HOOK_GUARDA = 'node "$CLAUDE_PROJECT_DIR/scripts/kit/guarda-de-operacao.mjs"';
const TESTE_PADRAO_DO_NPM = /no test specified/;
/** Arquivos que o projeto também edita: nunca saem inteiros; o kit mexe só nos blocos/chaves que registrou. */
export const COMPARTILHADOS = new Set(['CLAUDE.md', 'package.json', '.claude/settings.json', '.claude/kit.json']);

export const lerTexto = (destino, rel) => (existsSync(join(destino, rel)) ? readFileSync(join(destino, rel), 'utf8') : null);
export const lerModelo = () => JSON.parse(readFileSync(join(RAIZ_DO_KIT, 'modelos', 'kit.json'), 'utf8'));
export const modeloClaude = () => readFileSync(join(RAIZ_DO_KIT, 'modelos', 'CLAUDE.md'), 'utf8');
/** Os blocos do modelo, inteiros (com as marcas): { nome → texto }. */
export function blocosDoModelo() {
  return Object.fromEntries([...modeloClaude().matchAll(/<!-- kit:([a-z-]+) v\d+ -->[\s\S]*?<!-- \/kit:\1 -->/g)].map((m) => [m[1], m[0]]));
}
export const arquivosDoGate = () => readdirSync(join(RAIZ_DO_KIT, 'gate')).filter((n) => n.endsWith('.mjs')).sort();

/** JSON de volta ao texto com a indentação e o fim de linha do original (sem original: 2 espaços e quebra final). */
export function serializar(valor, original) {
  const recuo = original === null ? '  ' : (original.match(/^([ \t]+)"/m)?.[1] ?? '  ');
  return JSON.stringify(valor, null, recuo) + (original === null || original.endsWith('\n') ? '\n' : '');
}
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function lerJsonOuErro(destino, rel, erros) {
  const t = lerTexto(destino, rel);
  if (t === null) return { texto: null, valor: {} };
  try { return { texto: t, valor: JSON.parse(t) }; } catch (e) { erros.push(`${rel} ilegível: ${e.message}`); return { texto: t, valor: null }; }
}

/**
 * Calcula o que o kit grava. Devolve { erro } ou { mudancas:[{arquivo,antigo,novo}], conflitos, pendencias, lock }.
 * `lock` já traz arquivos/blocos/chaves, calculados sobre o conteúdo NOVO (hashes) — o chamador só acrescenta versão e perfil.
 */
export function planejar({ destino, perfil, trocarTest = false, nomeScript = 'test:projeto', criarClaude = false }) {
  const p = lerModelo().perfis[perfil];
  if (!p) return { erro: `perfil "${perfil}" desconhecido — use ${Object.keys(lerModelo().perfis).join(' ou ')}` };
  const erros = [];
  const mudancas = []; const conflitos = []; const pendencias = [];
  const lock = { arquivos: {}, blocos: {}, chaves: { settings: {}, package: {}, kitJson: {} } };

  // CLAUDE.md: bloco que falta entra no fim; bloco com a marca já presente fica como está.
  const claudeAtual = lerTexto(destino, 'CLAUDE.md');
  const blocos = blocosDoModelo();
  let claude = claudeAtual;
  const novosBlocos = [];
  if (claudeAtual === null) {
    if (!criarClaude) return { erro: 'não há CLAUDE.md aqui' };
    claude = modeloClaude().replace('# <nome do projeto>', `# ${basename(destino)}`);
    novosBlocos.push(...Object.keys(blocos));
    lock.arquivos['CLAUDE.md'] = null;
  } else {
    for (const [nome, texto] of Object.entries(blocos)) {
      if (new RegExp(`<!-- kit:${nome} v\\d+ -->`).test(claude)) continue;
      claude += `${claude.endsWith('\n') ? '' : '\n'}\n${texto}\n`;
      novosBlocos.push(nome);
    }
  }
  if (claude !== claudeAtual) mudancas.push({ arquivo: 'CLAUDE.md', antigo: claudeAtual, novo: claude });
  for (const b of blocosDe(claude)) if (novosBlocos.includes(b.nome)) lock.blocos[b.nome] = { versao: b.versao, sha256: sha256(b.conteudo) };

  // scripts/kit: cópia do gate/; arquivo igual já lá fica (não é nosso), diferente é conflito.
  for (const f of arquivosDoGate()) {
    const rel = `scripts/kit/${f}`;
    const novo = readFileSync(join(RAIZ_DO_KIT, 'gate', f), 'utf8');
    const atual = lerTexto(destino, rel);
    if (atual === null) { mudancas.push({ arquivo: rel, antigo: null, novo }); lock.arquivos[rel] = sha256(novo); }
    else if (atual !== novo) conflitos.push(`${rel} já existe diferente do kit — não sobrescrevi`);
  }

  // package.json
  const pk = lerJsonOuErro(destino, 'package.json', erros);
  const pkg = pk.valor && structuredClone(pk.valor);
  const cp = { criado: pk.texto === null, scripts: {}, testeTrocado: false, testeOriginal: null };
  lock.chaves.package = cp;
  if (pkg) {
    if (pk.texto === null) Object.assign(pkg, { name: basename(destino).toLowerCase().replace(/[^a-z0-9-_.]+/g, '-'), version: '0.1.0', private: true });
    pkg.scripts ??= {};
    const sc = pkg.scripts;
    const gate = p.scripts.test;
    const atual = sc.test;
    const ehGate = atual === gate || atual?.includes('scripts/kit/');
    const real = atual && !TESTE_PADRAO_DO_NPM.test(atual) && !ehGate;
    if (!ehGate) {
      if (p.suitePadrao || real) {
        const suite = real ? atual : p.suitePadrao;
        if (sc[nomeScript] === undefined) { sc[nomeScript] = suite; cp.scripts[nomeScript] = suite; }
        else if (sc[nomeScript] !== suite) conflitos.push(`scripts.${nomeScript} já existe com outro valor — o \`test\` ficou como estava`);
      }
      const suiteGuardada = !real || sc[nomeScript] === atual; // o `test` só sai do lugar se o valor dele ficou guardado em outro script
      if ((!real || trocarTest) && suiteGuardada) { cp.testeTrocado = true; cp.testeOriginal = atual ?? null; cp.gate = gate; sc.test = gate; }
      else if (real && !trocarTest) pendencias.push(`scripts.test (${JSON.stringify(atual)}) ficou como estava: rode com --trocar-test para o \`npm test\` passar pelo gate (o seu vira ${nomeScript}).`);
    }
    for (const [nome, valor] of Object.entries(p.scripts)) {
      if (nome === 'test') continue;
      if (sc[nome] === undefined) { sc[nome] = valor; cp.scripts[nome] = valor; }
      else if (sc[nome] !== valor) conflitos.push(`scripts.${nome} já existe diferente (${JSON.stringify(sc[nome])}) — não troquei`);
    }
    const novo = serializar(pkg, pk.texto);
    if (novo !== pk.texto) mudancas.push({ arquivo: 'package.json', antigo: pk.texto, novo });
    if (pk.texto === null) lock.arquivos['package.json'] = null;
  }

  // .claude/settings.json
  const st = lerJsonOuErro(destino, '.claude/settings.json', erros);
  const s = st.valor && structuredClone(st.valor);
  const cs = { criado: st.texto === null, hook: false, marketplace: false, plugins: [] };
  lock.chaves.settings = cs;
  if (s) {
    s.hooks = { ...(s.hooks ?? {}) };
    s.hooks.PreToolUse = [...(s.hooks.PreToolUse ?? [])];
    if (!s.hooks.PreToolUse.some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) {
      s.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: HOOK_GUARDA }] });
      cs.hook = true;
    }
    const mkt = { source: { source: 'github', repo: REPO_DO_KIT } };
    s.extraKnownMarketplaces = { ...(s.extraKnownMarketplaces ?? {}) };
    if (!(MARKETPLACE in s.extraKnownMarketplaces)) { s.extraKnownMarketplaces[MARKETPLACE] = mkt; cs.marketplace = true; }
    else if (!isDeepStrictEqual(s.extraKnownMarketplaces[MARKETPLACE], mkt)) conflitos.push(`extraKnownMarketplaces.${MARKETPLACE} já aponta para outra origem — não troquei`);
    s.enabledPlugins = { ...(s.enabledPlugins ?? {}) };
    for (const nome of [PLUGIN, `painel-sessoes@${MARKETPLACE}`]) {
      if (!(nome in s.enabledPlugins)) { s.enabledPlugins[nome] = true; cs.plugins.push(nome); }
      else if (s.enabledPlugins[nome] !== true) conflitos.push(`enabledPlugins.${nome} já é ${JSON.stringify(s.enabledPlugins[nome])} — não troquei`);
    }
    const novo = serializar(s, st.texto);
    if (novo !== st.texto) mudancas.push({ arquivo: '.claude/settings.json', antigo: st.texto, novo });
    if (st.texto === null) lock.arquivos['.claude/settings.json'] = null;
  }

  // .claude/kit.json
  const kj = lerJsonOuErro(destino, '.claude/kit.json', erros);
  const k = kj.valor && structuredClone(kj.valor);
  const ck = { criado: kj.texto === null, adicionadas: [] };
  lock.chaves.kitJson = ck;
  if (k) {
    const desejado = structuredClone(p.kit);
    if (desejado.gate?.comandoCompleto) desejado.gate.comandoCompleto = `npm run ${nomeScript}`;
    const mescla = (alvo, fonte, caminho) => {
      for (const [chave, valor] of Object.entries(fonte)) {
        const cam = caminho ? `${caminho}.${chave}` : chave;
        if (!(chave in alvo)) { alvo[chave] = valor; ck.adicionadas.push({ caminho: cam, valor }); }
        else if (ehObjeto(alvo[chave]) && ehObjeto(valor)) mescla(alvo[chave], valor, cam);
        else if (!isDeepStrictEqual(alvo[chave], valor)) conflitos.push(`.claude/kit.json: ${cam} já é ${JSON.stringify(alvo[chave])} — não troquei`);
      }
    };
    mescla(k, desejado, '');
    const novo = serializar(k, kj.texto);
    if (novo !== kj.texto) mudancas.push({ arquivo: '.claude/kit.json', antigo: kj.texto, novo });
    if (kj.texto === null) lock.arquivos['.claude/kit.json'] = null;
  }

  if (erros.length) return { erro: erros.join('; ') };
  // hashes dos arquivos que o kit criou inteiros (o conteúdo novo)
  for (const rel of Object.keys(lock.arquivos)) if (lock.arquivos[rel] === null) lock.arquivos[rel] = sha256(mudancas.find((m) => m.arquivo === rel).novo);
  return { mudancas, conflitos, pendencias, lock };
}

export function gravar(destino, mudancas) {
  for (const m of mudancas) {
    mkdirSync(dirname(join(destino, m.arquivo)), { recursive: true });
    writeFileSync(join(destino, m.arquivo), m.novo);
  }
}
export function gravarLock(destino, lock) {
  mkdirSync(join(destino, '.claude'), { recursive: true });
  writeFileSync(join(destino, LOCK), `${JSON.stringify(lock, null, 2)}\n`);
}
