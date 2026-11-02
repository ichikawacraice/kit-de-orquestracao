// `kit remover [--simular]`: tira blocos, chaves e arquivos cujo hash bate com o lock; o que foi mexido fica e é listado.
import { existsSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { LOCK, blocosDe, lerLock, sha256 } from './lock.mjs';
import { carregarConfig } from '../gate/config.mjs';
import { COMPARTILHADOS, HOOK_GUARDA, MARKETPLACE, MARKETPLACE_ANTIGO, desfazerOperador, esqueletoDe, foraDoProjeto, fraseDoKit, gitDirComum, lerTexto, semBom, semOsBlocos, serializar } from './pacote.mjs';

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const vazio = (v) => (Array.isArray(v) ? v.length === 0 : ehObjeto(v) && Object.keys(v).length === 0);

export function remover({ destino, simular = false }) {
  const caminho = join(destino, LOCK);
  const { lock, erro } = lerLock(destino);
  if (erro) return { codigo: 1, saida: '', erro: `kit remover: ${erro}` };
  // o que o kit edita no lugar (CLAUDE.md e os JSON) não pode ser link: a edição iria para onde ele aponta
  const links = [...COMPARTILHADOS, LOCK].map((rel) => foraDoProjeto(destino, rel)).filter(Boolean);
  if (links.length) return { codigo: 1, saida: '', erro: `kit remover: ${links.join('; ')} — nada foi removido` };
  const ilegiveis = [];
  const c = lock.chaves ?? { settings: {}, package: {}, kitJson: {} };
  const linhas = []; const gravacoes = new Map(); const apagar = [];
  const tirou = (m) => linhas.push(`removido: ${m}`);
  const deixou = (m) => linhas.push(`deixado (mexido): ${m}`);

  // arquivos inteiros do kit (scripts/kit/…): só se o hash bate
  for (const [rel, hash] of Object.entries(lock.arquivos)) {
    if (COMPARTILHADOS.has(rel)) continue;
    const motivo = foraDoProjeto(destino, rel);
    if (motivo) { linhas.push(`recusado: ${motivo}`); continue; }
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
    if (sha256(atual.conteudo) !== reg.sha256) {
      if (nome === 'projeto') {
        // o bloco `projeto` é para o usuário preencher: depois de preenchido o texto é dele; tira só as marcas
        const inteiro = claude.match(/<!-- kit:projeto v\d+ -->[\s\S]*?<!-- \/kit:projeto -->/)[0];
        claude = claude.replace(inteiro, () => inteiro.replace(/^<!-- kit:projeto v\d+ -->\r?\n?/, '').replace(/\r?\n?<!-- \/kit:projeto -->$/, ''));
        linhas.push('desembrulhado: bloco projeto (CLAUDE.md): o texto que você preencheu fica, só tirei as marcas do kit');
      } else deixou(`bloco ${nome} (CLAUDE.md)`);
      continue;
    }
    const inteiro = claude.match(new RegExp(`<!-- kit:${escapar(nome)} v\\d+ -->[\\s\\S]*?<!-- /kit:${escapar(nome)} -->`))[0];
    const i = claude.indexOf(inteiro);
    const antes = claude[i - 1] === '\n' ? (claude[i - 2] === '\r' ? 2 : 1) : 0;
    const depois = claude.startsWith('\r\n', i + inteiro.length) ? 2 : claude[i + inteiro.length] === '\n' ? 1 : 0;
    claude = claude.slice(0, i - antes) + claude.slice(i + inteiro.length + depois);
    tirou(`bloco ${nome} (CLAUDE.md)`);
  }
  if (lock.claudeSemEol && claude !== null && blocosDe(claude).length === 0) claude = claude.replace(/\r?\n$/, '');
  if (lock.arquivos['CLAUDE.md'] !== undefined && claude !== null && blocosDe(claude).length === 0 && esqueletoDe(destino) === semOsBlocos(claude)) { apagar.push('CLAUDE.md'); tirou('CLAUDE.md (só restava o esqueleto do modelo)'); } // bloco mexido que ficou tem texto do usuário: o arquivo não é só o esqueleto
  else {
    // a frase de cabeçalho do kit só fica enquanto sobrar algum bloco `kit:`
    const frase = fraseDoKit();
    if (claude !== null && frase && blocosDe(claude).length === 0) {
      const m = claude.match(new RegExp(`${escapar(frase)}(\\r?\\n){1,2}`));
      if (m) { claude = claude.replace(m[0], ''); tirou('frase de cabeçalho do kit (CLAUDE.md)'); }
    }
    if (claude !== claudeOriginal) gravacoes.set('CLAUDE.md', claude);
  }

  // JSON compartilhados: só as chaves que o kit registrou, se o valor ainda é o que ele pôs
  const editarJson = (rel, criado, fn, vazioAposRemover, original) => {
    const texto = lerTexto(destino, rel);
    if (texto === null) return;
    let v;
    try { v = JSON.parse(semBom(texto)); } catch (e) { ilegiveis.push(`${rel} ilegível: ${e.message}`); return; }
    fn(v);
    const restante = Object.keys(v).filter((k) => !vazioAposRemover.includes(k) || ((ehObjeto(v[k]) || Array.isArray(v[k])) && !vazio(v[k]))); // chave do kit que ficou com valor (o projeto mexeu) segura o arquivo
    if (criado && restante.length === 0) { apagar.push(rel); tirou(`${rel} (criado pelo kit, sem mais nada)`); return; }
    // o que sobrou é o que o projeto tinha antes do kit: devolve os bytes dele, não os do JSON.stringify
    let antes; try { antes = original ? JSON.parse(semBom(original)) : undefined; } catch { antes = undefined; }
    if (antes !== undefined && isDeepStrictEqual(v, antes)) { if (original !== texto) gravacoes.set(rel, original); return; }
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
    for (const nome of cs.marketplace ? [MARKETPLACE, MARKETPLACE_ANTIGO] : []) {
      if (s.extraKnownMarketplaces?.[nome]) { delete s.extraKnownMarketplaces[nome]; tirou('marketplace do kit (settings.json)'); }
    }
    for (const nome of cs.marketplaces ?? []) {
      if (s.extraKnownMarketplaces?.[nome] !== undefined) { delete s.extraKnownMarketplaces[nome]; tirou(`marketplace ${nome} (settings.json)`); }
    }
    for (const [nome, valor] of Object.entries(cs.env ?? {})) {
      if (s.env?.[nome] === valor) { delete s.env[nome]; tirou(`env ${nome} (settings.json)`); } else if (s.env && nome in s.env) deixou(`env ${nome} (settings.json)`);
    }
    for (const nome of cs.desligados ?? []) {
      if (s.enabledPlugins?.[nome] === false) { delete s.enabledPlugins[nome]; tirou(`plugin desligado ${nome} (settings.json)`); } else if (s.enabledPlugins && nome in s.enabledPlugins) deixou(`plugin ${nome} (settings.json)`);
    }
    for (const nome of cs.plugins ?? []) {
      if (s.enabledPlugins?.[nome] === true) { delete s.enabledPlugins[nome]; tirou(`plugin ${nome} (settings.json)`); } else if (s.enabledPlugins && nome in s.enabledPlugins) deixou(`plugin ${nome} (settings.json)`);
    }
    for (const [pai, filho] of [['hooks', 'PreToolUse'], [null, 'hooks'], [null, 'extraKnownMarketplaces'], [null, 'enabledPlugins'], [null, 'env']]) {
      const alvo = pai ? s[pai] : s;
      if (alvo && vazio(alvo[filho])) delete alvo[filho];
    }
  }, ['hooks', 'extraKnownMarketplaces', 'enabledPlugins', 'env'], cs.original);

  const cp = c.package ?? {};
  editarJson('package.json', cp.criado, (pkg) => {
    const sc = pkg.scripts ?? {};
    for (const t of cp.trocados ?? []) {
      if (sc[t.nome] === t.gate) {
        if (t.original === null) delete sc[t.nome]; else sc[t.nome] = t.original;
        tirou(`script ${t.nome} → gate (package.json)`);
      } else deixou(`script ${t.nome} (package.json)`);
    }
    for (const [nome, valor] of Object.entries(cp.scripts ?? {})) {
      if (sc[nome] === valor) { delete sc[nome]; tirou(`script ${nome} (package.json)`); } else if (nome in sc) deixou(`script ${nome} (package.json)`);
    }
    if (vazio(sc)) delete pkg.scripts;
  }, ['name', 'version', 'private', 'scripts'], cp.original);

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
  }, [], ck.original);

  // o verde guardado do gate mora no git dir do projeto (um para todo worktree)
  let verde = null;
  const comum = gitDirComum(destino);
  if (comum) { let nome = 'kit-gate-verde'; try { nome = carregarConfig(destino).gate.verdeDir || nome; } catch { /* kit.json ilegível: o nome padrão */ } const d = resolve(comum, nome); if (d.startsWith(resolve(comum) + sep) && existsSync(d)) verde = d; }
  if (verde) tirou(`${verde.replace(comum, '.git')}/ (verde guardado do gate)`);

  if (ilegiveis.length) return { codigo: 1, saida: '', erro: `kit remover: ${ilegiveis.join('; ')} — nada foi removido` };
  if (!simular) {
    for (const rel of apagar) rmSync(join(destino, rel), { force: true });
    for (const [rel, texto] of gravacoes) writeFileSync(join(destino, rel), texto);
    rmSync(caminho, { force: true });
    if (verde) rmSync(verde, { recursive: true, force: true });
    // só as pastas que o lock diz que o kit criou, da mais funda para a mais rasa, e só se ficaram vazias
    for (const dir of (lock.pastasCriadas ?? []).filter((p) => !foraDoProjeto(destino, p)).sort((a, b) => b.split('/').length - a.split('/').length)) { try { if (!readdirSync(join(destino, dir)).length) rmdirSync(join(destino, dir)); } catch { /* não existe ou não está vazia */ } }
  }
  linhas.push(...desfazerOperador(lock.operador, { simular, destino }));
  if (lock.recuperado) linhas.push('aviso: instalação recuperada de uma interrompida — o texto original dos JSON não foi guardado (voltam sem as chaves do kit, no formato do JSON.stringify) e a suíte original foi deduzida de test:suite/test:projeto; confira com git status.');
  linhas.push(`kit remover${simular ? ' --simular' : ''}: ${simular ? 'nada foi gravado' : `lock ${LOCK} removido`}.`);
  return { codigo: 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}

