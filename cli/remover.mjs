// `kit remover [--simular]`: tira blocos, chaves e arquivos cujo hash bate com o lock; o que foi mexido fica e é listado.
import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { LOCK, blocosDe, sha256 } from './lock.mjs';
import { COMPARTILHADOS, HOOK_GUARDA, MARKETPLACE, lerTexto, modeloClaude, serializar } from './pacote.mjs';

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const vazio = (v) => (Array.isArray(v) ? v.length === 0 : ehObjeto(v) && Object.keys(v).length === 0);

export function remover({ destino, simular = false }) {
  const caminho = join(destino, LOCK);
  if (!existsSync(caminho)) return { codigo: 1, saida: '', erro: `kit remover: não achei ${LOCK} aqui — não há o que remover` };
  const lock = JSON.parse(readFileSync(caminho, 'utf8'));
  const c = lock.chaves ?? { settings: {}, package: {}, kitJson: {} };
  const linhas = []; const gravacoes = new Map(); const apagar = [];
  const tirou = (m) => linhas.push(`removido: ${m}`);
  const deixou = (m) => linhas.push(`deixado (mexido): ${m}`);

  // arquivos inteiros do kit (scripts/kit/…): só se o hash bate
  for (const [rel, hash] of Object.entries(lock.arquivos)) {
    if (COMPARTILHADOS.has(rel)) continue;
    const atual = lerTexto(destino, rel);
    if (atual === null) continue;
    if (sha256(atual) === hash) { apagar.push(rel); tirou(rel); } else deixou(rel);
  }

  // blocos do CLAUDE.md
  let claude = lerTexto(destino, 'CLAUDE.md');
  const claudeOriginal = claude;
  for (const [nome, reg] of Object.entries(lock.blocos)) {
    if (claude === null) break;
    const atual = blocosDe(claude).find((b) => b.nome === nome);
    if (!atual) continue;
    if (sha256(atual.conteudo) !== reg.sha256) { deixou(`bloco ${nome} (CLAUDE.md)`); continue; }
    const inteiro = claude.match(new RegExp(`<!-- kit:${nome} v\\d+ -->[\\s\\S]*?<!-- /kit:${nome} -->`))[0];
    const i = claude.indexOf(inteiro);
    const antes = claude[i - 1] === '\n' ? 1 : 0;
    const depois = claude[i + inteiro.length] === '\n' ? 1 : 0;
    claude = claude.slice(0, i - antes) + claude.slice(i + inteiro.length + depois);
    tirou(`bloco ${nome} (CLAUDE.md)`);
  }
  if (lock.arquivos['CLAUDE.md'] !== undefined && claude !== null && semOsBlocos(modeloClaude().replace('# <nome do projeto>', `# ${basenameDe(destino)}`)) === semOsBlocos(claude)) { apagar.push('CLAUDE.md'); tirou('CLAUDE.md (só restava o esqueleto do modelo)'); }
  else if (claude !== claudeOriginal) gravacoes.set('CLAUDE.md', claude);

  // JSON compartilhados: só as chaves que o kit registrou, se o valor ainda é o que ele pôs
  const editarJson = (rel, criado, fn, vazioAposRemover) => {
    const texto = lerTexto(destino, rel);
    if (texto === null) return;
    const v = JSON.parse(texto);
    fn(v);
    const restante = Object.keys(v).filter((k) => !(vazioAposRemover.includes(k)));
    if (criado && restante.length === 0) { apagar.push(rel); tirou(`${rel} (criado pelo kit, sem mais nada)`); return; }
    const novo = serializar(v, texto);
    if (novo !== texto) gravacoes.set(rel, novo);
  };

  const cs = c.settings ?? {};
  editarJson('.claude/settings.json', cs.criado, (s) => {
    if (cs.hook && s.hooks?.PreToolUse) {
      for (const g of s.hooks.PreToolUse) if (g.hooks) g.hooks = g.hooks.filter((h) => h.command !== HOOK_GUARDA);
      s.hooks.PreToolUse = s.hooks.PreToolUse.filter((g) => !(g.hooks && g.hooks.length === 0));
      tirou('hook da guarda (settings.json)');
    }
    if (cs.marketplace && s.extraKnownMarketplaces?.[MARKETPLACE]) { delete s.extraKnownMarketplaces[MARKETPLACE]; tirou('marketplace do kit (settings.json)'); }
    for (const nome of cs.plugins ?? []) {
      if (s.enabledPlugins?.[nome] === true) { delete s.enabledPlugins[nome]; tirou(`plugin ${nome} (settings.json)`); } else if (s.enabledPlugins && nome in s.enabledPlugins) deixou(`plugin ${nome} (settings.json)`);
    }
    for (const [pai, filho] of [['hooks', 'PreToolUse'], [null, 'hooks'], [null, 'extraKnownMarketplaces'], [null, 'enabledPlugins']]) {
      const alvo = pai ? s[pai] : s;
      if (alvo && vazio(alvo[filho])) delete alvo[filho];
    }
  }, ['hooks', 'extraKnownMarketplaces', 'enabledPlugins']);

  const cp = c.package ?? {};
  editarJson('package.json', cp.criado, (pkg) => {
    const sc = pkg.scripts ?? {};
    if (cp.testeTrocado) {
      if (sc.test === cp.gate) {
        if (cp.testeOriginal === null) delete sc.test; else sc.test = cp.testeOriginal;
        tirou('script test → gate (package.json)');
      } else deixou('script test (package.json)');
    }
    for (const [nome, valor] of Object.entries(cp.scripts ?? {})) {
      if (sc[nome] === valor) { delete sc[nome]; tirou(`script ${nome} (package.json)`); } else if (nome in sc) deixou(`script ${nome} (package.json)`);
    }
    if (vazio(sc)) delete pkg.scripts;
  }, ['name', 'version', 'private', 'scripts']);

  const ck = c.kitJson ?? {};
  editarJson('.claude/kit.json', ck.criado, (k) => {
    for (const { caminho: cam, valor } of [...(ck.adicionadas ?? [])].reverse()) {
      const partes = cam.split('.');
      const pais = [k];
      for (const parte of partes.slice(0, -1)) pais.push(pais.at(-1)?.[parte] ?? {});
      const ultimo = partes.at(-1);
      if (isDeepStrictEqual(pais.at(-1)[ultimo], valor)) {
        delete pais.at(-1)[ultimo];
        for (let i = pais.length - 1; i > 0; i--) if (vazio(pais[i])) delete pais[i - 1][partes[i - 1]];
        tirou(`kit.json: ${cam}`);
      } else if (ultimo in pais.at(-1)) deixou(`kit.json: ${cam}`);
    }
  }, []);

  if (!simular) {
    for (const rel of apagar) rmSync(join(destino, rel), { force: true });
    for (const [rel, texto] of gravacoes) writeFileSync(join(destino, rel), texto);
    rmSync(caminho, { force: true });
    for (const dir of ['scripts/kit', 'scripts', '.claude']) { try { if (!readdirSync(join(destino, dir)).length) rmdirSync(join(destino, dir)); } catch { /* não existe ou não está vazio */ } }
  }
  linhas.push(`kit remover${simular ? ' --simular' : ''}: ${simular ? 'nada foi gravado' : `lock ${LOCK} removido`}.`);
  return { codigo: 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}

const semOsBlocos = (t) => t.replace(/<!-- kit:([a-z-]+) v\d+ -->[\s\S]*?<!-- \/kit:\1 -->/g, '').replace(/\s+/g, ' ').trim();
function basenameDe(d) { return d.split('/').filter(Boolean).at(-1); }
