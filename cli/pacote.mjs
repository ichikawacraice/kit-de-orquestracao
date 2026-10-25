// O que o kit põe num projeto e como: o plano é calculado em memória (iniciar, adotar e --simular usam o mesmo) e só então gravado.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
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

const BOM = '\uFEFF';
export const semBom = (t) => (t.startsWith(BOM) ? t.slice(1) : t);
const eolDe = (t) => (t !== null && t.includes('\r\n') ? '\r\n' : '\n');
export const semOsBlocos = (t) => t.replace(/<!-- kit:([a-z-]+) v\d+ -->[\s\S]*?<!-- \/kit:\1 -->/g, '').replace(/\s+/g, ' ').trim();
/** O CLAUDE.md que o `iniciar` cria, sem os blocos: o que o `adotar` reconhece como "o iniciar morreu no meio". */
export const esqueletoDe = (destino) => semOsBlocos(modeloClaude().replace('# <nome do projeto>', `# ${basename(destino)}`));
/** A frase de cabeçalho do modelo de CLAUDE.md (o parágrafo que explica as marcas `kit:`). */
export const fraseDoKit = () => modeloClaude().split(/\n\n/).find((par) => par.startsWith('As seções marcadas `kit:`'));
/** Texto acrescentado ao fim do CLAUDE.md com o fim de linha que o arquivo já usa (CRLF continua CRLF). */
export function acrescentar(claude, texto) {
  const add = `${claude.endsWith('\n') ? '' : '\n'}\n${texto}\n`;
  return claude + (eolDe(claude) === '\n' ? add : add.replace(/\n/g, '\r\n'));
}

/** JSON de volta ao texto com a indentação, o fim de linha (LF/CRLF) e o BOM do original (sem original: 2 espaços e quebra final). */
export function serializar(valor, original) {
  const base = original === null ? null : semBom(original);
  const recuo = base === null ? '  ' : (base.match(/^([ \t]+)"/m)?.[1] ?? '  ');
  const eol = eolDe(base);
  const corpo = JSON.stringify(valor, null, recuo).replace(/\n/g, eol);
  return (original?.startsWith(BOM) ? BOM : '') + corpo + (base === null || base.endsWith('\n') ? eol : '');
}
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function lerJsonOuErro(destino, rel, erros) {
  const t = lerTexto(destino, rel);
  if (t === null) return { texto: null, valor: {} };
  try { return { texto: t, valor: JSON.parse(semBom(t)) }; } catch (e) { erros.push(`${rel} ilegível: ${e.message}`); return { texto: t, valor: null }; }
}

/** O settings.json só tem o que o kit põe (nada do projeto): numa recuperação, é o que diz que o arquivo foi criado por ele. */
function soDoKit(v) {
  const chaves = (o) => Object.keys(o ?? {});
  const pre = v?.hooks?.PreToolUse;
  return chaves(v).every((k) => ['hooks', 'extraKnownMarketplaces', 'enabledPlugins'].includes(k))
    && (v.hooks === undefined || (chaves(v.hooks).join() === 'PreToolUse' && pre.length === 1 && pre[0].hooks?.length === 1 && pre[0].hooks[0].command === HOOK_GUARDA))
    && (v.extraKnownMarketplaces === undefined || chaves(v.extraKnownMarketplaces).join() === MARKETPLACE)
    && chaves(v.enabledPlugins).every((n) => [PLUGIN, `painel-sessoes@${MARKETPLACE}`].includes(n));
}


/** O git dir comum do projeto (o mesmo que o gate e a trava da orquestradora usam), ou null fora de um repositório. */
export function gitDirComum(destino) {
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: destino, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

/** O estado do operador (fora do projeto): onde as travas por hook leem as listas. */
export const baseDaOrquestracao = () => process.env.HOOKS_CREWAI_BASE || join(homedir(), '.claude', 'orquestracao');
const CABECALHO_SUBAGENTES = `# subagent_type que pode gravar arquivo do projeto mesmo como subagente (exceção ao Q154).
# Lido por hooks/subagente-nao-edita.mjs. Um por linha; \`*\` no fim casa prefixo.
# Vazio de propósito: o executor é sessão, não subagente (Q197); nenhuma lista o libera por padrão.
`;
const linhasDaLista = (texto) => texto.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * O que o `iniciar`/`adotar` põem fora do projeto: a linha do repo em `trava-edicao-repos.txt` (a trava da orquestradora só vale nos repos
 * listados) e o `subagente-pode-escrever.txt` só com o cabeçalho. Nada é gravado aqui — `aplicarOperador` grava depois do plano gravado.
 */
export function planejarOperador(destino) {
  const base = baseDaOrquestracao();
  const operador = {};
  const repo = gitDirComum(destino);
  if (repo) {
    const arq = join(base, 'trava-edicao-repos.txt');
    const existe = existsSync(arq);
    const jaTem = existe && linhasDaLista(readFileSync(arq, 'utf8')).includes(repo);
    // Sem a lista a trava já vale em todo repositório com marcador: criá-la com uma linha só tiraria os outros projetos da trava.
    operador.trava = existe ? { linha: repo, adicionou: !jaTem } : { linha: repo, adicionou: false, cobreTudo: true };
  }
  const sub = join(base, 'subagente-pode-escrever.txt');
  if (!existsSync(sub)) operador.subagentes = { criou: true, sha256: sha256(CABECALHO_SUBAGENTES) };
  return operador;
}

/** A linha que o `iniciar`/`adotar` dizem quando não há lista: a ausência já cobre o repositório. */
export const FRASE_TRAVA_COBRE = 'trava: não há trava-edicao-repos.txt, e sem ela a trava da orquestradora já cobre todos os repositórios (este inclusive); não criei a lista.';

/** Grava o que `planejarOperador` decidiu. Devolve as linhas de aviso (falha de gravar não desfaz a instalação). */
export function aplicarOperador(operador) {
  const base = baseDaOrquestracao(); const avisos = [];
  try {
    mkdirSync(base, { recursive: true });
    if (operador.trava?.adicionou) {
      const arq = join(base, 'trava-edicao-repos.txt');
      const atual = existsSync(arq) ? readFileSync(arq, 'utf8') : '';
      writeFileSync(arq, `${atual}${atual === '' || atual.endsWith('\n') ? '' : '\n'}${operador.trava.linha}\n`);
    }
    if (operador.subagentes?.criou) writeFileSync(join(base, 'subagente-pode-escrever.txt'), CABECALHO_SUBAGENTES);
  } catch (e) { avisos.push(`aviso: não consegui gravar em ${base} (${e.message}); a trava da orquestradora e a lista de subagentes ficam como estavam`); }
  return avisos;
}

/** Desfaz o que `aplicarOperador` fez (só o que o lock diz que foi do kit). Devolve as linhas `removido:`/`deixado`. */
export function desfazerOperador(operador, { simular = false } = {}) {
  const base = baseDaOrquestracao(); const linhas = [];
  const arq = join(base, 'trava-edicao-repos.txt');
  if (operador?.trava?.adicionou && existsSync(arq)) {
    const todas = readFileSync(arq, 'utf8').split('\n');
    if (todas.some((l) => l.trim() === operador.trava.linha)) {
      const resto = todas.filter((l) => l.trim() !== operador.trava.linha);
      const vazio = linhasDaLista(resto.join('\n')).length === 0;
      if (!simular) writeFileSync(arq, vazio ? '' : resto.join('\n')); // nunca apaga: lista vazia ≠ sem lista (a vazia não cobre repo nenhum; a ausente cobre todos), e quem a deixou vazia quis assim
      linhas.push(`removido: ${operador.trava.linha} de trava-edicao-repos.txt`);
    }
  }
  const sub = join(base, 'subagente-pode-escrever.txt');
  if (operador?.subagentes?.criou && existsSync(sub)) {
    if (sha256(readFileSync(sub, 'utf8')) === operador.subagentes.sha256) { if (!simular) rmSync(sub, { force: true }); linhas.push('removido: subagente-pode-escrever.txt (só tinha o cabeçalho do kit)'); }
    else linhas.push('deixado (mexido): subagente-pode-escrever.txt');
  }
  return linhas;
}

/** Há `pnpm-workspace.yaml` e o perfil não foi pedido: o `simples` roda só a suíte da raiz; sugere o perfil de workspace (não troca sozinho). */
export function sugestaoDePerfil(destino, perfilPedido) {
  if (perfilPedido !== undefined || !existsSync(join(destino, 'pnpm-workspace.yaml'))) return '';
  return '\nsugestão: há pnpm-workspace.yaml aqui e o perfil simples roda só a suíte da raiz; para o gate cobrir os pacotes use `--perfil pnpm-workspace`.';
}
/** O projeto já tem um hook `PreToolUse` com matcher `Bash` que não é o do kit: a guarda dele já existe. */
export function temGuardaDoProjeto(settings) {
  return (settings?.hooks?.PreToolUse ?? []).some((g) => String(g?.matcher ?? '').split('|').map((m) => m.trim()).includes('Bash') && (g.hooks ?? []).some((h) => h.command !== HOOK_GUARDA));
}
// Blocos que descrevem comandos e regras de operação do kit: num CLAUDE.md que já existe, o projeto tem as suas e os dois podem se contradizer.
export const BLOCOS_DO_PROJETO = ['comandos', 'regras-de-operacao'];
const GATE_PROPRIO = /\bnode\s+(?:\.\/)?((?!scripts\/kit\/)\S*gate\S*\.m?js)/i;
/** O comando é o script de gate do próprio projeto (existe no disco, fora de scripts/kit/): o do kit não o substitui. */
/** Os scripts de gate/ que ninguém chamaria: raízes = o que hook, `test`/`typecheck` do perfil e o projeto (biblioteca do vitest) chamam, e o que elas importam. */
export function scriptsSemUso({ guardaPropria, gatePropria, perfil }) {
  const todos = arquivosDoGate();
  if (!guardaPropria && !gatePropria) return [];
  const raizes = ['o-teto-de-workers.mjs']; // biblioteca para o `vitest.config` do projeto importar
  if (!guardaPropria) raizes.push('guarda-de-operacao.mjs');
  if (!gatePropria) raizes.push('a-vez-do-gate.mjs');
  for (const gate of Object.values(perfil.scripts ?? {})) for (const f of todos) if (gate.includes(`scripts/kit/${f}`) && !(gatePropria && f === 'a-vez-do-gate.mjs')) raizes.push(f);
  const usados = new Set(raizes);
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const f of [...usados]) {
      if (!todos.includes(f)) continue;
      for (const m of readFileSync(join(RAIZ_DO_KIT, 'gate', f), 'utf8').matchAll(/from\s+["']\.\/([^"']+\.mjs)["']/g)) if (!usados.has(m[1])) { usados.add(m[1]); mudou = true; }
    }
  }
  return todos.filter((f) => !usados.has(f));
}
export const ehGateProprio = (destino, comando) => { const m = typeof comando === 'string' && comando.match(GATE_PROPRIO); return Boolean(m) && existsSync(join(destino, m[1])); };

/**
 * Calcula o que o kit grava. Devolve { erro } ou { mudancas:[{arquivo,antigo,novo}], conflitos, pendencias, lock }.
 * `lock` já traz arquivos/blocos/chaves, calculados sobre o conteúdo NOVO (hashes) — o chamador só acrescenta versão e perfil.
 */
export function planejar({ destino, perfil, trocarTest = false, nomeScript = 'test:projeto', criarClaude = false, recuperando = false }) {
  const p = lerModelo().perfis[perfil];
  if (!p) return { erro: `perfil "${perfil}" desconhecido — use ${Object.keys(lerModelo().perfis).join(' ou ')}` };
  const erros = [];
  const mudancas = []; const conflitos = []; const pendencias = [];
  const lock = { arquivos: {}, blocos: {}, chaves: { settings: {}, package: {}, kitJson: {} } };
  const avisosDoProjeto = [];
  // o projeto que já tem as suas regras: guarda de Bash própria e gate próprio não são duplicados nem trocados
  const solto = (rel) => { try { return JSON.parse(semBom(lerTexto(destino, rel) ?? 'null')); } catch { return null; } };
  const guardaPropria = temGuardaDoProjeto(solto('.claude/settings.json'));
  const gatePropria = ehGateProprio(destino, solto('package.json')?.scripts?.test) || ehGateProprio(destino, solto('.claude/kit.json')?.gate?.comandoCompleto);
  const omitidos = [];
  // scripts/kit só guarda o que alguém chama: sem a guarda ou o gate do kit, os arquivos que só eles usam também ficam de fora
  const sobram = scriptsSemUso({ guardaPropria, gatePropria, perfil: p });
  omitidos.push(...sobram);
  if (guardaPropria) { avisosDoProjeto.push('guarda: o projeto já tem um hook PreToolUse de Bash próprio; não registrei a guarda do kit nem copiei o script dela (kit.json: guarda "do-projeto")'); }
  if (gatePropria) { avisosDoProjeto.push('gate próprio: o gate do projeto é um script dele; não copiei scripts/kit/a-vez-do-gate.mjs nem os scripts que só o gate do kit usa, não troquei o `test`, e o kit.json não aponta o gate'); }
  if (omitidos.length) lock.omitidos = omitidos.map((f) => `scripts/kit/${f}`);

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
    // o esqueleto de um `iniciar` interrompido (recuperando) recebe todos os blocos; um CLAUDE.md do projeto, só os de orquestração
    const esqueletoDoIniciar = recuperando && semOsBlocos(claudeAtual) === esqueletoDe(destino);
    for (const [nome, texto] of Object.entries(blocos)) {
      const jaTem = new RegExp(`<!-- kit:${nome} v\\d+ -->`).test(claude);
      if (nome === 'projeto' && !jaTem) continue; // num CLAUDE.md que já existe, o projeto já diz o que ele é
      if (!jaTem && !esqueletoDoIniciar && BLOCOS_DO_PROJETO.includes(nome)) { (lock.blocosOmitidos ??= []).push(nome); continue; }
      if (jaTem) {
        // instalação interrompida: o bloco que já está lá, igual ao do modelo, é do kit
        const inteiro = claude.match(new RegExp(`<!-- kit:${nome} v\\d+ -->[\\s\\S]*?<!-- /kit:${nome} -->`))?.[0];
        if (recuperando && inteiro?.replace(/\r\n/g, '\n') === texto) novosBlocos.push(nome);
        continue;
      }
      if (claudeAtual !== '' && !claudeAtual.endsWith('\n')) lock.claudeSemEol = true; // o remover devolve o arquivo sem o `\n` final
      claude = acrescentar(claude, texto);
      novosBlocos.push(nome);
    }
  }
  if (lock.blocosOmitidos?.length) avisosDoProjeto.push(`CLAUDE.md: omiti os blocos ${lock.blocosOmitidos.join(' e ')} (comandos e regras de operação do kit): o CLAUDE.md que já existe tem as regras do projeto, e as do kit podem contradizê-las; os blocos de orquestração entraram`);
  if (claude !== claudeAtual) mudancas.push({ arquivo: 'CLAUDE.md', antigo: claudeAtual, novo: claude });
  if (recuperando && claudeAtual !== null && semOsBlocos(claudeAtual) === esqueletoDe(destino)) lock.arquivos['CLAUDE.md'] = sha256(claude); // o CLAUDE.md é o esqueleto do `iniciar` que morreu: o remover o apaga
  for (const b of blocosDe(claude)) if (novosBlocos.includes(b.nome)) lock.blocos[b.nome] = { versao: b.versao, sha256: sha256(b.conteudo) };

  // scripts/kit: cópia do gate/; arquivo igual já lá fica (não é nosso), diferente é conflito.
  for (const f of arquivosDoGate()) {
    if (omitidos.includes(f)) continue;
    const rel = `scripts/kit/${f}`;
    const novo = readFileSync(join(RAIZ_DO_KIT, 'gate', f), 'utf8');
    const atual = lerTexto(destino, rel);
    if (atual === null) { mudancas.push({ arquivo: rel, antigo: null, novo }); lock.arquivos[rel] = sha256(novo); }
    else if (atual !== novo) conflitos.push(`${rel} já existe diferente do kit — não sobrescrevi`);
    else if (recuperando) lock.arquivos[rel] = sha256(novo); // cópia idêntica que o processo morto deixou
  }

  // package.json
  const pk = lerJsonOuErro(destino, 'package.json', erros);
  const pkg = pk.valor && structuredClone(pk.valor);
  const cp = { criado: pk.texto === null, scripts: {}, trocados: [] };
  lock.chaves.package = cp;
  const avisos = [];
  let comandoSuite = `npm run ${nomeScript}`; // o que o kit.json manda o gate rodar: o `test` próprio, quando ele não foi trocado
  if (pkg) {
    if (pk.texto === null) Object.assign(pkg, { name: basename(destino).toLowerCase().replace(/[^a-z0-9-_.]+/g, '-'), version: '0.1.0', private: true });
    pkg.scripts ??= {};
    const sc = pkg.scripts;
    const sufixo = nomeScript.split(':')[1] ?? 'suite';
    // `test` e os demais scripts do perfil passam a ser o gate; o antigo é guardado em `<nome>:<sufixo>` (o `test`, em `nomeScript`) e dito na saída.
    for (const [nome, gate] of Object.entries(p.scripts)) {
      const guardado = nome === 'test' ? nomeScript : `${nome}:${sufixo}`;
      const atual = sc[nome];
      if (gatePropria && gate.includes('a-vez-do-gate')) continue;
      if (recuperando && atual === gate) {
        // o processo morreu depois de trocar este script: a suíte do projeto é a que está guardada, nunca derivada do gate
        const origem = nome === 'test' ? [nomeScript, 'test:suite', 'test:projeto'].find((n) => sc[n] !== undefined) : (sc[guardado] !== undefined ? guardado : undefined);
        if (nome === 'test' && !origem) { erros.push('scripts.test já é o gate, mas não achei test:suite nem test:projeto — não sei qual era a suíte do projeto. Restaure o `test` original do package.json (ex.: `git checkout package.json`) e rode `kit adotar` de novo'); continue; }
        if (origem) cp.scripts[origem] = sc[origem];
        cp.trocados.push({ nome, original: origem ? sc[origem] : null, gate });
        if (nome === 'test') comandoSuite = `npm run ${origem}`;
        avisos.push(`recuperado: scripts.${nome} já passava pelo gate (instalação interrompida)${origem ? `; a suíte do projeto está em ${origem}` : ''}.`);
        continue;
      }
      if (atual === gate || atual?.includes('scripts/kit/')) continue;
      const real = atual && !TESTE_PADRAO_DO_NPM.test(atual);
      // sem troca (o `test` próprio, sem --trocar-test) nada é guardado: o script do projeto segue onde está e a pendência vai ao lock
      if (real && !trocarTest) {
        if (nome === 'test') { pendencias.push(`scripts.test (${JSON.stringify(atual)}) ficou como estava e o \`npm test\` não passa pelo gate. Para trocar: \`kit atualizar --trocar-test\` (o seu vira ${nomeScript}).`); comandoSuite = atual; }
        else conflitos.push(`scripts.${nome} já existe (${JSON.stringify(atual)}) — rode com --trocar-test para guardá-lo em ${guardado} e pôr o do gate no lugar`);
        continue;
      }
      const padrao = nome === 'test' ? p.suitePadrao : undefined;
      // `test` que já chama o script guardado (ex.: "npm run test:suite") é só a porta de entrada: a suíte já mora lá, e guardá-lo de novo seria um laço
      const jaGuardado = real && sc[guardado] !== undefined && atual.includes(guardado);
      if (!jaGuardado && (real || padrao)) {
        const valor = real ? atual : padrao;
        if (sc[guardado] === undefined) { sc[guardado] = valor; cp.scripts[guardado] = valor; }
        else if (sc[guardado] !== valor) { conflitos.push(`scripts.${guardado} já existe com outro valor — o \`${nome}\` ficou como estava`); continue; }
      }
      sc[nome] = gate;
      cp.trocados.push({ nome, original: atual ?? null, gate });
      if (real) avisos.push(jaGuardado
        ? `scripts.${nome} agora passa pelo gate; a suíte do projeto segue em ${guardado} (\`${sc[guardado]}\`).`
        : `scripts.${nome} agora passa pelo gate; o seu \`${atual}\` está em ${guardado}.`);
    }
    const novo = pk.texto !== null && isDeepStrictEqual(pkg, pk.valor) ? pk.texto : serializar(pkg, pk.texto); // sem mudança de valor, o texto do projeto fica como está (nada de reformatar)
    if (novo !== pk.texto) mudancas.push({ arquivo: 'package.json', antigo: pk.texto, novo });
    if (pk.texto === null) lock.arquivos['package.json'] = null; else if (!recuperando) cp.original = pk.texto;
  }

  // .claude/settings.json
  const st = lerJsonOuErro(destino, '.claude/settings.json', erros);
  const s = st.valor && structuredClone(st.valor);
  const cs = { criado: st.texto === null, hook: false, marketplace: false, plugins: [] };
  lock.chaves.settings = cs;
  if (s) {
    s.hooks = { ...(s.hooks ?? {}) };
    s.hooks.PreToolUse = [...(s.hooks.PreToolUse ?? [])];
    if (guardaPropria && !s.hooks.PreToolUse.some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) { /* a guarda é a do projeto */ }
    else if (!s.hooks.PreToolUse.some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) {
      s.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: HOOK_GUARDA }] });
      cs.hook = true;
    } else if (recuperando) cs.hook = true;
    const mkt = { source: { source: 'github', repo: REPO_DO_KIT } };
    s.extraKnownMarketplaces = { ...(s.extraKnownMarketplaces ?? {}) };
    if (!(MARKETPLACE in s.extraKnownMarketplaces)) { s.extraKnownMarketplaces[MARKETPLACE] = mkt; cs.marketplace = true; }
    else if (!isDeepStrictEqual(s.extraKnownMarketplaces[MARKETPLACE], mkt)) conflitos.push(`extraKnownMarketplaces.${MARKETPLACE} já aponta para outra origem — não troquei`);
    else if (recuperando) cs.marketplace = true;
    s.enabledPlugins = { ...(s.enabledPlugins ?? {}) };
    for (const nome of [PLUGIN, `painel-sessoes@${MARKETPLACE}`]) {
      if (!(nome in s.enabledPlugins)) { s.enabledPlugins[nome] = true; cs.plugins.push(nome); }
      else if (s.enabledPlugins[nome] !== true) conflitos.push(`enabledPlugins.${nome} já é ${JSON.stringify(s.enabledPlugins[nome])} — não troquei`);
      else if (recuperando) cs.plugins.push(nome);
    }
    if (recuperando && st.texto !== null) cs.criado = soDoKit(st.valor);
    const novo = st.texto !== null && isDeepStrictEqual(s, st.valor) ? st.texto : serializar(s, st.texto); // sem mudança de valor, o texto do projeto fica como está (nada de reformatar)
    if (novo !== st.texto) mudancas.push({ arquivo: '.claude/settings.json', antigo: st.texto, novo });
    if (st.texto === null) lock.arquivos['.claude/settings.json'] = null; else if (!recuperando) cs.original = st.texto;
  }

  // .claude/kit.json
  const kj = lerJsonOuErro(destino, '.claude/kit.json', erros);
  const k = kj.valor && structuredClone(kj.valor);
  const ck = { criado: kj.texto === null, adicionadas: [] };
  lock.chaves.kitJson = ck;
  if (k) {
    const desejado = structuredClone(p.kit);
    if (desejado.gate?.comandoCompleto) desejado.gate.comandoCompleto = comandoSuite;
    if (gatePropria) { delete desejado.gate?.comandoCompleto; if (desejado.gate && !Object.keys(desejado.gate).length) delete desejado.gate; }
    if (guardaPropria && !('guarda' in k)) desejado.guarda = 'do-projeto';
    const mescla = (alvo, fonte, caminho) => {
      for (const [chave, valor] of Object.entries(fonte)) {
        const cam = caminho ? `${caminho}.${chave}` : chave;
        if (!(chave in alvo)) { alvo[chave] = valor; ck.adicionadas.push({ caminho: cam, valor }); }
        else if (ehObjeto(alvo[chave]) && ehObjeto(valor)) mescla(alvo[chave], valor, cam);
        else if (!isDeepStrictEqual(alvo[chave], valor)) conflitos.push(`.claude/kit.json: ${cam} já é ${JSON.stringify(alvo[chave])} — não troquei`);
        else if (recuperando) ck.adicionadas.push({ caminho: cam, valor });
      }
    };
    mescla(k, desejado, '');
    if (recuperando && kj.texto !== null && isDeepStrictEqual(kj.valor, desejado)) ck.criado = true;
    const vazioNovo = kj.texto === null && Object.keys(k).length === 0; // nada a dizer: não cria um kit.json de `{}`
    const novo = kj.texto !== null && isDeepStrictEqual(k, kj.valor) ? kj.texto : serializar(k, kj.texto); // sem mudança de valor, o texto do projeto fica como está (nada de reformatar)
    if (!vazioNovo && novo !== kj.texto) mudancas.push({ arquivo: '.claude/kit.json', antigo: kj.texto, novo });
    if (vazioNovo) lock.chaves.kitJson = { criado: false, adicionadas: [] };
    else if (kj.texto === null) lock.arquivos['.claude/kit.json'] = null; else if (!recuperando) ck.original = kj.texto;
  }

  if (erros.length) return { erro: erros.join('; ') };
  // hashes dos arquivos que o kit criou inteiros (o conteúdo novo)
  for (const rel of Object.keys(lock.arquivos)) if (lock.arquivos[rel] === null) lock.arquivos[rel] = sha256(mudancas.find((m) => m.arquivo === rel).novo);
  if (recuperando) {
    lock.pastasCriadas = ['.claude', 'scripts', 'scripts/kit'].filter((d) => existsSync(join(destino, d)));
    lock.recuperado = true;
  }
  return { mudancas, conflitos, pendencias, avisos, avisosProjeto: avisosDoProjeto, lock };
}

/**
 * Grava tudo ou nada: cada arquivo vai primeiro para `<arquivo>.kit-tmp` e só depois que todos foram escritos é que são renomeados.
 * Falha em qualquer ponto → apaga os temporários, restaura o que já foi renomeado (a partir de `antigo`) e some com as pastas que criou.
 * O lock entra na mesma transação e registra as pastas que o kit criou (o `remover` só apaga essas). Devolve `{ erro }` (mensagem, sem stack) ou `{}`.
 */
export function gravar(destino, mudancas, lock) {
  const itens = [...mudancas];
  const aCriar = []; // pastas que ainda não existem, da mais rasa para a mais funda
  const nova = (rel) => {
    const partes = dirname(rel).split('/').filter((x) => x && x !== '.');
    for (let i = 1; i <= partes.length; i++) { const d = partes.slice(0, i).join('/'); if (!existsSync(join(destino, d)) && !aCriar.includes(d)) aCriar.push(d); }
  };
  for (const m of itens) nova(m.arquivo);
  if (lock) {
    nova(LOCK);
    lock.pastasCriadas = [...new Set([...(lock.pastasCriadas ?? []), ...aCriar])];
    if (!lock.pastasCriadas.length) delete lock.pastasCriadas;
    itens.push({ arquivo: LOCK, antigo: lerTexto(destino, LOCK), novo: `${JSON.stringify(lock, null, 2)}\n` });
  }
  const criadas = []; const temporarios = []; const renomeados = [];
  let onde = '';
  try {
    for (const d of aCriar) { onde = d; mkdirSync(join(destino, d)); criadas.push(d); }
    for (const m of itens) {
      onde = m.arquivo;
      const t = `${join(destino, m.arquivo)}.kit-tmp`;
      temporarios.push(t);
      writeFileSync(t, m.novo);
      if (m.antigo !== null) chmodSync(t, statSync(join(destino, m.arquivo)).mode & 0o7777);
    }
    for (const m of itens) { onde = m.arquivo; renomeado(m, destino, renomeados); }
  } catch (e) {
    const sobrou = [];
    for (const t of temporarios) { try { rmSync(t, { force: true }); } catch { /* já não existe */ } }
    for (const m of renomeados.reverse()) {
      try { if (m.antigo === null) rmSync(join(destino, m.arquivo), { force: true }); else writeFileSync(join(destino, m.arquivo), m.antigo); } catch (e2) { sobrou.push(`${m.arquivo} (${e2.message})`); }
    }
    for (const d of criadas.reverse()) { try { rmdirSync(join(destino, d)); } catch { /* não está vazia ou já não existe */ } }
    return { erro: `não consegui gravar ${onde}: ${e.message}. ${sobrou.length ? `Não consegui desfazer: ${sobrou.join('; ')} — confira com git status.` : 'Nada ficou gravado: o que já tinha sido escrito foi desfeito.'}` };
  }
  return {};
}
function renomeado(m, destino, lista) {
  renameSync(`${join(destino, m.arquivo)}.kit-tmp`, join(destino, m.arquivo));
  lista.push(m);
}
