#!/usr/bin/env node
// PreToolUse de Bash (F438, ADR 0030 item 3): todo worker Claude aberto pelo `orca` nasce com modelo e esforço explícitos, no
// modelo do papel (F477, ADR 0036: dona em Opus médio, ou Opus alto com a linha `Esforço alto: <gatilho>` (ou a antiga
// `Gatilho do Opus:`); worker que não é dona aceita Sonnet e Haiku, e Opus médio ou com a linha) e fora da pasta
// de quem chama, salvo com a linha `Só leitura: <motivo>` no texto do pedido. Vale em qualquer anfitrião que chame o `orca`.
//   - `orca orchestration worker-start --agent claude`: modelo, esforço e worktree (current/active/ausente = a pasta de quem chama);
//   - `orca agent launch --agent claude`: modelo, esforço e a pasta (sempre uma worktree que já existe; padrão, a de quem chama);
//   - `orca worktree create --agent claude`: só modelo e esforço (já cria checkout novo).
// Codex também exige modelo/esforço explícitos e isolamento, sem aplicar a política de modelos Claude.
// Passam: `--terminal` (worker que já tem modelo), `--agent` de outro agente (vai ao log), `worktree create` sem `--agent`, `--help`.
// Sem texto legível (`--task`, arquivo ausente, stdin de pipe) não há papel, gatilho nem `Só leitura:`: recusa o Opus fora do esforço
// médio (não há como ver a linha) e a pasta de quem chama; o resto, Opus médio incluído, passa com `passou-sem-ler-spec`. A recusa traz o comando corrigido. Erro do próprio hook DEIXA PASSAR.
// O leitor de comando (`comandosDoOrca`) separa os comandos simples respeitando aspas, heredoc e redirecionamento: `orca …` dentro de
// string, de heredoc de outro comando ou de comentário não é comando. É ele que a fatia 8 reaproveita.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { recusaDoModelo, gatilhoDoOpus, MARCA_DE_DONA } from './titulo-da-dona.mjs';
import { anfitriao } from './anfitriao.mjs';

const HOOK = 'trava-do-orca';
const BOOLEANAS = new Set(['keep-open', 'json', 'full', 'focus', 'no-parent', 'run-hooks', 'activate', 'help']);
const SUBCOMANDOS = { 'orchestration worker-start': 'worker-start', 'agent launch': 'agent-launch', 'worktree create': 'worktree-create' };
// Prefixos que não mudam qual programa roda.
const PREFIXOS = new Set(['env', 'time', 'nohup', 'command', 'exec', 'builtin', '!', '{', 'then', 'do', 'else', 'elif', 'if', 'while', 'until']);
const ATRIBUICAO = /^[A-Za-z_]\w*=/;

// ───────────────────────────── o leitor de comando ─────────────────────────────

/**
 * Os comandos simples de uma linha de shell: `{ palavras: [{ v, cru }], porPipe, stdin }`. `v` é a palavra sem aspas (só `$PWD`
 * e `~` expandem); `cru` é o texto como veio. `stdin` é `{ tipo: 'heredoc'|'arquivo'|'texto', valor }` quando o comando o recebe
 * por `<<`, `<` ou `<<<`. Separadores: `; & && | || ( ) $( ` + "`" + ` e quebra de linha fora de aspas. Comentário `#` some.
 */
export function lerComandos(c, { cwd = process.cwd(), env = {} } = {}) {
  const src = String(c ?? '');
  const comandos = [];
  let atual = novo(false); let palavra = null; let pendentes = []; let redir = null; let k = 0;
  const internos = []; // os comandos de `$( )` e de crase entre aspas duplas, que o shell também executa
  function novo(porPipe) { return { palavras: [], porPipe, stdin: null }; }
  function fecharPalavra() {
    if (palavra === null) return;
    const p = palavra; palavra = null;
    if (redir) { const r = redir; redir = null; aplicarRedir(r, p); return; }
    atual.palavras.push(p);
  }
  function aplicarRedir(op, p) {
    if (op === '<<' || op === '<<-') { const alvo = { tipo: 'heredoc', valor: '' }; atual.stdin = alvo; pendentes.push({ delim: p.v, tira: op === '<<-', alvo }); }
    else if (op === '<<<') atual.stdin = { tipo: 'texto', valor: p.v };
    else if (op === '<') atual.stdin = { tipo: 'arquivo', valor: p.v };
  }
  function fecharComando(porPipe = false) {
    fecharPalavra();
    if (atual.palavras.length || atual.stdin) comandos.push(atual);
    atual = novo(porPipe);
  }
  function lerHeredocs() { // no fim da linha: o corpo de cada heredoc pendente, em ordem
    for (const h of pendentes) {
      const linhas = [];
      while (k < src.length) {
        let fim = src.indexOf('\n', k); if (fim < 0) fim = src.length;
        const linha = src.slice(k, fim); k = fim + 1;
        const comp = h.tira ? linha.replace(/^\t+/, '') : linha;
        if (comp === h.delim) break;
        linhas.push(comp);
      }
      h.alvo.valor = linhas.join('\n');
    }
    pendentes = [];
  }
  // `sub`: a palavra tem substituição que o shell executa (`$( )` ou crase fora de aspas simples); o texto real é desconhecido.
  const add = (v, cru, sub = false) => { if (palavra === null) palavra = { v: '', cru: '', sub: false }; palavra.v += v; palavra.cru += cru; palavra.sub ||= sub; };
  const expandir = (nome) => (nome === 'PWD' ? resolve(cwd) : nome === 'HOME' && env.HOME ? env.HOME : null);

  while (k < src.length) {
    const ch = src[k];
    if (ch === '\\') {
      if (src[k + 1] === '\n') { k += 2; continue; } // continuação de linha
      add(src[k + 1] ?? '', src.slice(k, k + 2)); k += 2; continue;
    }
    if (ch === "'") {
      const fim = src.indexOf("'", k + 1); const f = fim < 0 ? src.length : fim;
      add(src.slice(k + 1, f), src.slice(k, f + 1)); k = f + 1; continue;
    }
    if (ch === '"') {
      let j = k + 1; let v = ''; let sub = false;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && '"\\$`\n'.includes(src[j + 1] ?? '')) { if (src[j + 1] !== '\n') v += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '(') {
          const f = fimDaSubstituicao(src, j + 2); internos.push(...lerComandos(src.slice(j + 2, f - 1), { cwd, env }));
          v += src.slice(j, f); j = f; sub = true; continue;
        }
        if (src[j] === '`') {
          let f = j + 1; while (f < src.length && src[f] !== '`') f += src[f] === '\\' ? 2 : 1;
          internos.push(...lerComandos(src.slice(j + 1, f).replace(/\\([`\\$])/g, '$1'), { cwd, env }));
          v += src.slice(j, f + 1); j = f + 1; sub = true; continue;
        }
        if (src[j] === '$') { const m = /^\$(?:\{(\w+)\}|(\w+))/.exec(src.slice(j)); const e = m && expandir(m[1] ?? m[2]); if (e !== null && m) { v += e; j += m[0].length; continue; } }
        v += src[j]; j++;
      }
      add(v, src.slice(k, j + 1), sub); k = j + 1; continue;
    }
    if (ch === '#' && palavra === null) { while (k < src.length && src[k] !== '\n') k++; continue; }
    if (ch === '\n') { fecharComando(); k++; if (pendentes.length) lerHeredocs(); continue; }
    if (ch === ' ' || ch === '\t') { fecharPalavra(); k++; continue; }
    if (ch === '$' && src[k + 1] === '(') { fecharComando(); k += 2; continue; }
    if (ch === '$') {
      const m = /^\$(?:\{(\w+)\}|(\w+))/.exec(src.slice(k)); const e = m && expandir(m[1] ?? m[2]);
      if (e !== null && m) { add(e, m[0]); k += m[0].length; continue; }
      if (m) { add(m[0], m[0]); k += m[0].length; continue; }
    }
    if (ch === '`' || ch === '(' || ch === ')' || ch === ';') { fecharComando(); k++; continue; }
    if (ch === '|') { const duplo = src[k + 1] === '|'; fecharComando(!duplo); k += duplo || src[k + 1] === '&' ? 2 : 1; continue; }
    if (ch === '&') {
      if (src[k + 1] === '>') { fecharPalavra(); redir = '>'; k += src[k + 2] === '>' ? 3 : 2; continue; } // &> e &>>
      fecharComando(); k += src[k + 1] === '&' ? 2 : 1; continue;
    }
    if ((ch === '<' || ch === '>') && src[k + 1] === '(') { fecharComando(); k += 2; continue; } // <( ) e >( )
    if (ch === '<' || ch === '>') {
      // O número colado antes (`2>`) é o descritor, não palavra.
      if (palavra && /^\d+$/.test(palavra.cru)) palavra = null; else fecharPalavra();
      const op = /^(?:<<<|<<-|<<|<&|<>|<|>>|>&|>\||>)/.exec(src.slice(k))[0];
      k += op.length;
      if ((op === '>&' || op === '<&') && /^[\d-]/.test(src[k] ?? '')) { while (/[\d-]/.test(src[k] ?? '')) k++; continue; }
      while (src[k] === ' ' || src[k] === '\t') k++;
      redir = op; continue;
    }
    add(ch, ch); k++;
  }
  fecharComando();
  return comandos.concat(internos);
}

// O fim de `$( … )` começando depois do `(`: conta parênteses fora de aspas e pula o corpo de heredoc interno.
function fimDaSubstituicao(src, j) {
  let prof = 1; const delims = [];
  while (j < src.length) {
    const ch = src[j];
    if (ch === '\n' && delims.length) {
      j++;
      for (const d of delims.splice(0)) {
        for (;;) { let f = src.indexOf('\n', j); if (f < 0) f = src.length; const l = src.slice(j, f); j = f + 1; if (l.trim() === d || j > src.length) break; }
      }
      continue;
    }
    if (ch === '\\') { j += 2; continue; }
    if (ch === "'") { const f = src.indexOf("'", j + 1); j = f < 0 ? src.length : f + 1; continue; }
    const h = /^<<-?\s*(['"]?)(\w+)\1/.exec(src.slice(j));
    if (h && src[j + 2] !== '<') { delims.push(h[2]); j += h[0].length; continue; }
    if (ch === '(') prof++;
    if (ch === ')') { prof--; if (prof === 0) return j + 1; }
    j++;
  }
  return src.length;
}

const SHELL = /(?:^|\/)(?:ba|z|da|k)?sh$/;
const GLOBAIS_COM_VALOR = new Set(['environment', 'pairing-code']);
const ehOrca = (p) => /(?:^|\/)orca$/.test(p.v) || /^\$\{?ORCA_CLI_COMMAND\}?$/.test(p.v);

/**
 * Os comandos `orca` que abrem um Claude: `{ sub, bandeiras, crus, binario, stdin, porPipe }`. `bandeiras` é `{ nome: valor }`
 * (booleana: true); `crus` guarda a ordem e o texto original, para montar o comando corrigido.
 */
export const comandosDoOrca = (c, ctx = {}) => lerOrca(c, ctx, SUBCOMANDOS);

/**
 * Toda invocação do `orca`, qualquer subcomando (F445: o segredo-sai varre o que sai por qualquer uma delas). `sub` é o par de
 * palavras depois das opções globais, como veio (`orchestration send`); o resto, como em `comandosDoOrca`.
 */
export const invocacoesDoOrca = (c, ctx = {}) => lerOrca(c, ctx, null);

// `mapa` nulo: qualquer subcomando.
function lerOrca(c, ctx, mapa) {
  const saida = [];
  for (const cmd of lerComandos(c, ctx)) {
    const ps = cmd.palavras; let i = 0;
    for (;;) {
      const p = ps[i]; if (!p) break;
      if (ATRIBUICAO.test(p.cru) || PREFIXOS.has(p.v)) { i++; continue; }
      if (p.v === 'nice') { i++; if (ps[i]?.v === '-n') i += 2; else if (/^-\d+$/.test(ps[i]?.v ?? '')) i++; continue; }
      break;
    }
    if (!ps[i]) continue;
    // `bash -c "<script>"` e `eval <script>`: o script é outra linha de comando.
    if (SHELL.test(ps[i].v)) { const c = ps.findIndex((p, n) => n > i && /^-[a-z]*c$/.test(p.v)); if (c > 0 && ps[c + 1]) saida.push(...lerOrca(ps[c + 1].v, ctx, mapa)); continue; }
    if (ps[i].v === 'eval') { saida.push(...lerOrca(ps.slice(i + 1).map((p) => p.v).join(' '), ctx, mapa)); continue; }
    if (!ehOrca(ps[i])) continue;
    let s = i + 1; // opções globais antes do subcomando (`orca --json orchestration worker-start`)
    while (ps[s] && /^-/.test(ps[s].v)) s += GLOBAIS_COM_VALOR.has(ps[s].v.slice(2)) ? 2 : 1;
    const par = `${ps[s]?.v ?? ''} ${ps[s + 1]?.v ?? ''}`.trim();
    const sub = mapa ? mapa[par] : par;
    if (!sub) continue;
    const bandeiras = {}; const crus = []; const comSubst = new Set();
    for (let j = s + 2; j < ps.length; j++) {
      const m = /^--([\w-]+)(?:=([\s\S]*))?$/.exec(ps[j].v);
      if (!m) { crus.push({ cru: ps[j].cru }); continue; }
      const [, nome, igual] = m;
      if (igual !== undefined) { bandeiras[nome] = igual; if (ps[j].sub) comSubst.add(nome); crus.push({ nome, valor: igual, cruValor: ps[j].cru.slice(ps[j].cru.indexOf('=') + 1) }); continue; }
      if (BOOLEANAS.has(nome) || !ps[j + 1] || /^--[\w-]/.test(ps[j + 1].v)) { bandeiras[nome] = true; crus.push({ nome }); continue; }
      bandeiras[nome] = ps[j + 1].v; if (ps[j + 1].sub) comSubst.add(nome); crus.push({ nome, valor: ps[j + 1].v, cruValor: ps[j + 1].cru }); j++;
    }
    saida.push({ sub, bandeiras, comSubst, crus, binario: ps[i].cru, stdin: cmd.stdin, porPipe: cmd.porPipe });
  }
  return saida;
}

// ───────────────────────────── as regras ─────────────────────────────

const SEM_ACENTO = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Linha própria (item de lista, citação ou negrito valem), com motivo; a menção em prosa não conta.
const LINHA_SO_LEITURA = /^[\s>*_`-]*so leitura[*_`]*:[*_`]*[ \t]*[^\s*_`]/m;
export const soLeitura = (texto) => LINHA_SO_LEITURA.test(SEM_ACENTO(String(texto ?? '')));
// `$(cat <<'EOF' … EOF)` dentro de aspas: o corpo é o texto.
const CAT_HEREDOC = /^\$\(\s*cat\s+<<-?\s*(['"]?)(\w+)\1[ \t]*\n([\s\S]*?)\n[ \t]*\2[ \t]*\n?\s*\)$/;

export function lerArquivo(caminho, cwd) {
  try { const p = isAbsolute(caminho) ? caminho : resolve(cwd, caminho); return existsSync(p) ? readFileSync(p, 'utf8') : null; } catch { return null; }
}
function deValor(v, sub) {
  if (typeof v !== 'string') return null;
  const h = CAT_HEREDOC.exec(v.trim());
  if (h) return h[3];
  if (sub) return null; // substituição que o hook não executa: o texto real é desconhecido (entre aspas simples é texto)
  return v;
}

/** O texto do pedido (spec ou prompt) ou null quando não dá para ler sem executar nada. */
function textoDoPedido(o, cwd) {
  const b = o.bandeiras;
  if (o.sub === 'worker-start') {
    if (typeof b.spec === 'string') return deValor(b.spec, o.comSubst.has('spec'));
    if (typeof b['spec-file'] === 'string') {
      const f = b['spec-file'];
      if (f === '-' || f === '/dev/stdin') {
        if (o.stdin?.tipo === 'heredoc' || o.stdin?.tipo === 'texto') return o.stdin.valor;
        if (o.stdin?.tipo === 'arquivo') return lerArquivo(o.stdin.valor, cwd);
        return null;
      }
      return lerArquivo(f, cwd);
    }
    return null;
  }
  return typeof b.prompt === 'string' ? deValor(b.prompt, o.comSubst.has('prompt')) : null;
}

function git(cwd, ...args) {
  try {
    const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
    return r.status === 0 ? r.stdout : null;
  } catch { return null; }
}
const real = (p) => { try { return realpathSync(p); } catch { return null; } };
function raizDe(pasta) {
  const r = real(pasta); if (!r) return null;
  const t = git(r, 'rev-parse', '--show-toplevel');
  return t ? real(t.trim()) : r;
}

/** Onde o seletor de worktree cai: 'nova', 'propria' (a pasta de quem chama), 'outra' ou 'nao-resolve'. */
export function ondeCai(seletor, cwd, env = {}) {
  const s = String(seletor ?? 'current');
  if (s === 'new-child' || s === 'new-top-level') return 'nova';
  if (s === 'current' || s === 'active') return 'propria';
  const minha = raizDe(cwd);
  const comparar = (pasta) => { const r = raizDe(pasta); return !r ? 'nao-resolve' : r === minha ? 'propria' : 'outra'; };
  const m = /^(path|id|branch|name):([\s\S]+)$/.exec(s);
  if (!m) return 'nao-resolve';
  const [, tipo, valor] = m;
  if (tipo === 'path' || tipo === 'id') {
    let p = tipo === 'id' ? (valor.includes('::') ? valor.slice(valor.indexOf('::') + 2) : null) : valor;
    if (!p) return 'nao-resolve';
    if (p === '~' || p.startsWith('~/')) p = (env.HOME ?? '') + p.slice(1);
    return comparar(isAbsolute(p) ? p : resolve(cwd, p));
  }
  const lista = git(cwd, 'worktree', 'list', '--porcelain');
  if (!lista) return 'nao-resolve';
  const arvores = lista.split(/\n\n+/).map((bloco) => ({
    pasta: /^worktree (.+)$/m.exec(bloco)?.[1], branch: /^branch refs\/heads\/(.+)$/m.exec(bloco)?.[1],
  })).filter((a) => a.pasta);
  const achada = tipo === 'branch' ? arvores.find((a) => a.branch === valor) : arvores.find((a) => basename(a.pasta) === valor);
  return achada ? comparar(achada.pasta) : 'nao-resolve';
}

const esforcoDe = () => 'medium';
const abreviar = (cru) => (cru.length > 80 ? `${cru.slice(0, 1) === '"' || cru.slice(0, 1) === "'" ? cru[0] : '"'}…${cru.slice(0, 1) === "'" ? "'" : '"'}` : cru);

// O comando com as bandeiras trocadas; o resto como veio (valor longo abreviado).
function corrigido(o, { model, effort, worktree }) {
  const ps = [o.binario, ...SUB_PALAVRAS[o.sub]];
  for (const c of o.crus) {
    if (c.nome === 'model' || c.nome === 'effort' || (worktree && c.nome === 'worktree')) continue;
    if (!c.nome) { ps.push(abreviar(c.cru)); continue; }
    ps.push(`--${c.nome}`); if (c.valor !== undefined) ps.push(abreviar(c.cruValor));
  }
  ps.push('--model', model, '--effort', effort);
  if (worktree) ps.push('--worktree', worktree);
  return ps.join(' ') + (o.stdin?.tipo === 'heredoc' ? ' <<… (o mesmo heredoc)' : '');
}
const SUB_PALAVRAS = { 'worker-start': ['orchestration', 'worker-start'], 'agent-launch': ['agent', 'launch'], 'worktree-create': ['worktree', 'create'] };

/** Decide um comando `orca`: `{ recusa: string|null, desfecho, detalhe }` (desfecho null = nada a registrar). */
function decidirUm(o, { cwd, env }) {
  const b = o.bandeiras;
  if (b.help === true) return { recusa: null, desfecho: null };
  const base = `${o.sub}`;
  if (o.sub === 'worker-start' && b.terminal !== undefined) return { recusa: null, desfecho: 'passou-terminal', detalhe: base };
  const agente = typeof b.agent === 'string' ? b.agent : (o.sub === 'worktree-create' ? null : 'claude');
  if (!agente) return { recusa: null, desfecho: null };
  if (!['claude', 'codex'].includes(agente.toLowerCase())) return { recusa: null, desfecho: 'outro-agente', detalhe: `${base} agent=${agente}` };

  const texto = textoDoPedido(o, cwd);
  const legivel = texto !== null;
  const dona = legivel ? MARCA_DE_DONA.exec(texto) : null;
  const id = dona ? dona[1].toUpperCase() : null;
  const papel = dona ? 'dona' : 'worker';
  const model = typeof b.model === 'string' ? b.model.trim() : '';
  const effort = typeof b.effort === 'string' ? b.effort.trim() : '';
  const ml = model.toLowerCase();
  const seletor = typeof b.worktree === 'string' ? b.worktree : 'current';
  const cai = o.sub === 'worktree-create' ? 'nova' : ondeCai(seletor, cwd, env);
  const pastaDeQuemChama = cai === 'propria' || cai === 'nao-resolve';
  const precisaPasta = pastaDeQuemChama && !(legivel && soLeitura(texto));
  const detalhe = `${base} model=${model || '-'} effort=${effort || '-'} worktree=${o.sub === 'worktree-create' ? 'nova' : seletor}${id ? ` ${id}` : ''}`;

  // O modelo sugerido: o que veio, quando serve ao papel; senão o do papel (dona: Opus médio; worker: Sonnet médio).
  let motivoModelo = recusaDoModelo(id, { model, effort, prompt: legivel ? texto : '' }, { papel, sintaxe: 'orca' });
  const codex = agente.toLowerCase() === 'codex';
  if (codex) motivoModelo = !model || !effort ? 'worker Codex exige --model e --effort explícitos.' : /sonnet|opus|haiku/.test(ml) ? 'modelo Claude não pode ser usado com --agent codex.' : null;
  if (!codex && !legivel && ml.includes('opus') && effort.toLowerCase() !== 'medium') {
    motivoModelo = 'worker em Opus fora do esforço médio sem texto legível do pedido (`--task`, arquivo ausente ou stdin de pipe): sem texto não há a linha `Esforço alto: <gatilho>`. Use `--effort medium`, ou ponha o pedido em `--spec`/`--spec-file` com a linha.';
  }
  const modelOk = codex ? model && !/sonnet|opus|haiku/.test(ml) : Boolean(model && effort && !motivoModelo);
  const sugModel = modelOk ? model : (papel === 'dona' ? 'opus' : 'sonnet');
  const sugEffort = modelOk && effort ? effort : esforcoDe(sugModel.toLowerCase());

  const motivos = [];
  if (motivoModelo) motivos.push(motivoModelo);
  if (precisaPasta) {
    const onde = cai === 'nao-resolve'
      ? `o seletor \`--worktree ${seletor}\` não se resolve para outra worktree e conta como a pasta de quem chama${/^(name|identity|issue):/.test(seletor) ? ' (o hook não lê o nome de exibição, a identidade nem a issue do Orca; para abrir na worktree do item, use `--worktree path:<pasta>` ou `branch:<branch>`)' : ''}`
      : 'abre na pasta de quem chama';
    const porque = legivel ? 'sem a linha `Só leitura: <motivo>` no texto do pedido' : 'e sem texto legível do pedido não há como ver a linha `Só leitura:`';
    motivos.push(`${o.sub === 'agent-launch' ? 'agent launch' : 'worker-start'} ${onde}, ${porque}: dois agentes escrevendo na mesma worktree se atropelam.`);
  }
  if (!motivos.length) {
    if (!legivel) return { recusa: null, desfecho: 'passou-sem-ler-spec', detalhe };
    const desfecho = codex ? 'orca-abriu-codex' : ml.includes('opus') ? 'orca-abriu-opus' : ml.includes('haiku') ? 'orca-abriu-haiku' : 'orca-abriu-sonnet';
    return { recusa: null, desfecho, detalhe: ml.includes('opus') ? `${detalhe} gatilho=${(legivel && gatilhoDoOpus(texto)) || '-'}` : detalhe };
  }

  if (codex) return { recusa: `${motivos.join(' ')} Use --agent codex com modelo disponível na ORCA, --effort explícito e --worktree new-child (ou declare Só leitura: <motivo>).`, desfecho: 'recusou-codex', detalhe };
  let sugestao;
  if (o.sub === 'agent-launch' && precisaPasta) {
    const prompt = o.crus.find((c) => c.nome === 'prompt');
    const p = prompt ? ` --spec ${abreviar(prompt.cruValor)}` : '';
    sugestao = `Abra num checkout novo: \`${o.binario} orchestration worker-start --agent claude --model ${sugModel} --effort ${sugEffort} --worktree new-child${p}\``
      + ` ou \`${o.binario} worktree create --name <nome> --agent claude --model ${sugModel} --effort ${sugEffort}${prompt ? ` --prompt ${abreviar(prompt.cruValor)}` : ''}\``
      + '; ou, se o worker só lê, ponha no `--prompt` a linha `Só leitura: <motivo>`.';
  } else {
    sugestao = `Comando corrigido: \`${corrigido(o, { model: sugModel, effort: sugEffort, worktree: precisaPasta ? 'new-child' : null })}\``;
    if (precisaPasta) sugestao += ' (ou, se o worker só lê, ponha no texto do pedido a linha `Só leitura: <motivo>`)';
    if (motivoModelo && legivel && ml.includes('opus') && !modelOk) {
      sugestao += papel === 'dona' && effort.toLowerCase() !== 'high' ? '; para manter o Opus, use `--effort medium`'
        : '; para manter o Opus, use `--effort medium` ou ponha no texto do pedido a linha `Esforço alto: <gatilho>`';
    }
    sugestao += '.';
  }
  return { recusa: `${motivos.join(' ')} ${sugestao}`, desfecho: 'recusou', detalhe };
}

/** A decisão para a linha de comando inteira: `{ recusa, registros: [{ desfecho, detalhe }] }`. */
export function decidir(comando, { cwd = process.cwd(), env = process.env } = {}) {
  const registros = []; let recusa = null;
  for (const o of comandosDoOrca(comando, { cwd, env })) {
    const r = decidirUm(o, { cwd, env });
    if (r.desfecho) registros.push({ desfecho: r.desfecho, detalhe: r.detalhe ?? '' });
    if (r.recusa && !recusa) recusa = r.recusa;
  }
  return { recusa, registros };
}

function main() {
  const e = lerEntrada();
  if (e.tool_name !== 'Bash') return;
  const comando = e.tool_input?.command;
  if (typeof comando !== 'string' || !/orca|ORCA_CLI_COMMAND/.test(comando)) return;
  const cwd = typeof e.cwd === 'string' && e.cwd ? e.cwd : process.cwd();
  const { recusa, registros } = decidir(comando, { cwd, env: process.env });
  if (!registros.length) return;
  const a = anfitriao({ env: process.env, cwd });
  const sufixo = ` anfitriao=${a.anfitriao}${a.desconhecido ? ` anfitriao-desconhecido=${a.desconhecido}` : ''}`;
  for (const r of registros) registrar(e.session_id, HOOK, r.desfecho, r.detalhe + sufixo);
  if (recusa) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: recusa } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'}: ${err?.message ?? ''}`); }
  process.exitCode = 0;
}
