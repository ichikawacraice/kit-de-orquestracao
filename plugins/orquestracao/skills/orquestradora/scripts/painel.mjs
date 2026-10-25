#!/usr/bin/env node
// O painel das sessões: um JSON por documento em ~/.claude/orquestracao/painel/<coleção>/<id>.json,
// no formato { id, version, data }. Quem lê é o mod painel-sessoes (/painel); quem escreve são as
// sessões, por este script. Substitui o banco do artefato (23/10).
//
//   painel.mjs get    <colecao> <id>
//   painel.mjs list   <colecao> [estado] [--projeto <nome> | --todos]   (sem flag lista tudo)
//   painel.mjs set    <colecao> <id> '<json>'            substitui o documento
//   painel.mjs update <colecao> <id> '<json>' [--se-versao N]   mescla os campos (null apaga)
//   painel.mjs batch  '[{"op":"set|update|delete","colecao":"…","id":"…","data":{…},"seVersao":N}]'   (seVersao opcional por op)
//   painel.mjs delete <colecao> <id>
//   painel.mjs temas list [--projeto <nome>]   os temas do projeto (o da pasta atual); cada tema vale só no projeto dele
//   painel.mjs temas add <id> "<rótulo>" [--projeto <nome>]   cria um tema do projeto, sem editar o JSON (projeto sem tema ganha `geral` na primeira gravação em fila)
//   (set e delete em sessoes/<id> que JÁ existe e é de OUTRA sessão exigem --de-outra; no batch, "deOutra": true na op)
//   fila: etapa · tema (de temas.json, ao lado das coleções) · trava {motivo,texto} · prs · depois · perguntas · donoLocalId+donoApelido
//   são validados quando presentes; etapa/dono que mudam ganham `historico` e a etapa final grava `feitoEm` (F27 fatia 1).
//   (set em fila/<id> que JÁ existe exige --se-versao N — ou "seVersao" na op do batch —: sem ele, o set apagaria o item em silêncio)
//
// Coleções: sessoes, perguntas e fila (itens F<n> do pool; protocolo em pool/protocolo.md#fila-do-pool).
//
// `projeto` (sessoes e fila): ao CRIAR um documento sem o campo, o script o preenche com o nome do repositório git de
// onde roda (basename da pasta que contém o git common dir, minúsculo; fora de git não preenche). Ambiente: PAINEL_DIR
// (o nome antigo IZANAGI_PAINEL_DIR segue valendo, e o novo vence); idem PAINEL_PAUSA_* (só teste).
//
// Toda escrita grava `atualizadoEm` (agora, ISO) quando o JSON não traz um, e sobe `version`.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BASE = process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(homedir(), '.claude', 'orquestracao', 'painel');
const COLECOES = new Set(['sessoes', 'perguntas', 'fila']);
const ID = /^[A-Za-z0-9_.-]{1,120}$/;

// Mesmo cálculo de projetoDaSessao() em hooks/pool-comum.mjs (nome do projeto); mude nos dois.
function projetoDoCwd(cwd = process.cwd()) {
  const limiteMs = Number(process.env.KIT_GIT_TIMEOUT_MS) || 10000;
  try {
    const repo = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', timeout: limiteMs, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!repo) return { projeto: null, motivo: 'cwd fora de git' };
    const raiz = basename(repo) === '.git' ? dirname(repo) : repo;
    return { projeto: basename(raiz).replace(/\.git$/, '').toLowerCase() || null, motivo: 'cwd fora de git' };
  } catch (e) {
    // git que não respondeu a tempo não quer dizer "fora de git": são avisos diferentes
    if (e?.signal === 'SIGKILL' || e?.code === 'ETIMEDOUT') return { projeto: null, motivo: `git não respondeu em ${limiteMs / 1000} s` };
    if (e?.code === 'ENOENT') return { projeto: null, motivo: 'git não encontrado no PATH' };
    return { projeto: null, motivo: 'cwd fora de git' };
  }
}

// Quem sou: CLAUDE_CODE_SESSION_ID (id do CLI, presente no Bash de toda sessão) → registro do app (hooks/pool-comum.mjs)
// → local_… Sem a env (shell do operador, testes): sem trava. Env sem registro resolvido: avisa e deixa passar (errar para o
// lado de não travar a escrita do painel).
const MEU_CLI = process.env.CLAUDE_CODE_SESSION_ID || '';
// No plugin, pool-comum.mjs mora em <plugin>/hooks (relativo a este script); KIT_HOOKS_DIR sobrepõe. Sem fallback para ~/.claude/hooks.
const HOOKS_DIR = process.env.KIT_HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'hooks');
const POOL_COMUM = join(HOOKS_DIR, 'pool-comum.mjs');
const pool = MEU_CLI
  ? await import(pathToFileURL(POOL_COMUM).href).catch((e) => {
    process.stderr.write(`painel.mjs: aviso: não consegui importar ${POOL_COMUM} (${e.message}); a proteção das linhas de outras sessões ficou desligada\n`);
    return null;
  })
  : null;
let meusIds; // Set de ids que contam como "a própria sessão"; null = não resolvido
function ehMinha(id) {
  if (!MEU_CLI) return true;
  if (meusIds === undefined) {
    let local = null;
    try { local = pool?.registroDaSessao(MEU_CLI)?.localId ?? null; } catch { /* sem registro */ }
    meusIds = local ? new Set([local, MEU_CLI]) : null;
    if (!meusIds) process.stderr.write(`painel.mjs: aviso: não consegui resolver a sessão ${MEU_CLI} no registro do app; a proteção das linhas de outras sessões ficou desligada\n`);
  }
  return meusIds === null || meusIds.has(id);
}

function caminho(colecao, id) {
  if (!COLECOES.has(colecao)) throw new Error(`coleção desconhecida: ${colecao} (use sessoes, perguntas ou fila)`);
  if (id !== undefined && !ID.test(id)) throw new Error(`id inválido: ${id}`);
  return id === undefined ? join(BASE, colecao) : join(BASE, colecao, `${id}.json`);
}

function ler(colecao, id) {
  const f = caminho(colecao, id);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

function gravar(colecao, id, data, version) {
  const dir = caminho(colecao);
  mkdirSync(dir, { recursive: true });
  const f = caminho(colecao, id);
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ id, version, data }, null, 2)}\n`);
  renameSync(tmp, f);
  return { id, version };
}

function objeto(json, onde) {
  const v = typeof json === 'string' ? JSON.parse(json) : json;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${onde}: esperava um objeto JSON`);
  return v;
}

// Padrões da skill orquestradora (F5/T4, 24/10) validados na escrita. Só vale para o documento que
// esta op grava: dado antigo que já está no disco não é revalidado.
const MOTIVOS = new Set(['conflito', 'gate-vermelho', 'acesso', 'operador', 'outra']);
// Contrato do item da fila (F27 fatia 1). Vale para os campos PRESENTES em `novo`: documento antigo segue aceitando `update`.
const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
const ETAPAS_FINAIS = new Set(['feito', 'descartado']);
const MOTIVOS_DA_TRAVA = new Set([...MOTIVOS]);
const DONOS_ANTIGOS = ['dono', 'dona', 'membro', 'executora'];
const ARQUIVO_DE_TEMAS = () => join(BASE, 'temas.json');
// temas.json: lista de { id, rotulo, projeto? }. Tema com `projeto` vale só nele; sem `projeto` (instalação antiga) vale para todos.
const doProjeto = (t, projeto) => !projeto || !t?.projeto || String(t.projeto).toLowerCase() === projeto;
function lerTemas(caminho) {
  if (!existsSync(caminho)) return [];
  const lista = JSON.parse(readFileSync(caminho, 'utf8'));
  if (!Array.isArray(lista)) throw new Error('não é uma lista');
  return lista;
}
function gravarTemas(caminho, lista) {
  mkdirSync(dirname(caminho), { recursive: true });
  const tmp = `${caminho}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(lista, null, 2)}\n`);
  renameSync(tmp, caminho);
}
const idsDe = (lista, projeto) => lista.filter((t) => doProjeto(t, projeto)).map((t) => t?.id).filter((x) => typeof x === 'string' && x);
// Projeto sem nenhum tema visível ganha o `geral` na primeira gravação em `fila` (a escrita está sob a trava do painel).
function temasValidos(chave, projeto) {
  const caminho = ARQUIVO_DE_TEMAS();
  try {
    let lista = lerTemas(caminho);
    if (projeto && idsDe(lista, projeto).length === 0) {
      lista = [...lista, { id: 'geral', rotulo: 'Geral', projeto }];
      gravarTemas(caminho, lista);
      process.stderr.write(`painel.mjs: o projeto "${projeto}" não tinha tema; cadastrei "geral" em ${caminho}. Crie os seus com: painel.mjs temas add <id> "<rótulo>"\n`);
    } else if (!projeto && idsDe(lista, projeto).length === 0) {
      lista = [{ id: 'geral', rotulo: 'Geral' }];
      gravarTemas(caminho, lista);
      process.stderr.write(`painel.mjs: ${caminho} não tinha temas; criei com o tema "geral".\n`);
    }
    return { ids: idsDe(lista, projeto), caminho };
  } catch (e) {
    throw new Error(`${chave}: não consegui ler os temas em ${caminho} (${e.message})`);
  }
}
// `painel.mjs temas list|add`: o jeito de cadastrar tema sem editar o JSON. O projeto é o da pasta atual ou `--projeto`.
function comandoTemas(args) {
  const ip = args.indexOf('--projeto');
  const projeto = ip >= 0 ? String(args.splice(ip, 2)[1] ?? '').toLowerCase() : (projetoDoCwd().projeto ?? null);
  const [sub, id, ...rotulo] = args;
  const caminho = ARQUIVO_DE_TEMAS();
  if (sub === 'list') return lerTemas(caminho).filter((t) => doProjeto(t, projeto));
  if (sub === 'add') {
    if (!projeto) throw new Error('temas add: não achei o projeto (rode dentro do repositório git ou passe --projeto <nome>)');
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id ?? '')) throw new Error('temas add: o id é minúsculo, com letras, números e hífen (ex.: loja)');
    const nome = rotulo.join(' ').trim();
    if (!nome) throw new Error('temas add: falta o rótulo (ex.: painel.mjs temas add loja "Loja e checkout")');
    return comTrava(() => {
      const lista = lerTemas(caminho);
      if (idsDe(lista, projeto).includes(id)) throw new Error(`temas add: o tema "${id}" já existe no projeto "${projeto}"`);
      const novo = { id, rotulo: nome, projeto };
      gravarTemas(caminho, [...lista, novo]);
      return novo;
    });
  }
  throw new Error('uso: painel.mjs temas list [--projeto <nome>] | temas add <id> "<rótulo>" [--projeto <nome>]');
}
const textoNaoVazio = (v) => typeof v === 'string' && v.trim() !== '';

function validarItemDaFila(chave, novo, base, op, existia) {
  const tem = (k) => k in novo && novo[k] !== null;
  // apagar o contrato não é mesclar: `null` em update remove o campo, e titulo/etapa/tema são o que faz do documento um item
  if (op === 'update') {
    for (const k of ['titulo', 'etapa', 'tema']) {
      if (k in novo && novo[k] === null) throw new Error(`${chave}: ${k} não pode ser apagado (null) — o item perderia o contrato; troque o valor`);
    }
  }
  if (tem('etapa') && !ETAPAS.includes(novo.etapa)) {
    throw new Error(`${chave}: etapa "${novo.etapa}" fora da lista (${ETAPAS.join(' · ')})`);
  }
  if (tem('tema')) {
    const projeto = base?.projeto ? String(base.projeto).toLowerCase() : null;
    const { ids, caminho } = temasValidos(chave, projeto);
    if (!ids.includes(novo.tema)) throw new Error(`${chave}: tema "${novo.tema}" fora da lista${projeto ? ` do projeto "${projeto}"` : ''} (${ids.join(' · ')}); para criar: painel.mjs temas add <id> "<rótulo>" (lista em ${caminho})`);
  }
  if (tem('trava')) {
    const t = novo.trava;
    if (typeof t !== 'object' || Array.isArray(t)) throw new Error(`${chave}: trava é null ou {motivo, texto}`);
    if (t.motivo === 'sem-ninguem') throw new Error(`${chave}: trava "sem-ninguem" só o mod produz, ao desenhar; use ${[...MOTIVOS_DA_TRAVA].join(' · ')}`);
    if (!MOTIVOS_DA_TRAVA.has(t.motivo)) throw new Error(`${chave}: trava.motivo "${t.motivo}" fora da lista (${[...MOTIVOS_DA_TRAVA].join(' · ')})`);
    if (!textoNaoVazio(t.texto)) throw new Error(`${chave}: trava.texto não pode ser vazio`);
  }
  if (tem('prs') && !(Array.isArray(novo.prs) && novo.prs.every((n) => Number.isInteger(n) && n > 0))) {
    throw new Error(`${chave}: prs é uma lista de inteiros positivos`);
  }
  if (tem('depois')) {
    const ok = Array.isArray(novo.depois) && novo.depois.every((d) => d && typeof d === 'object' && textoNaoVazio(d.texto) && (d.item === undefined || /^F\d+$/.test(String(d.item))));
    if (!ok) throw new Error(`${chave}: depois é uma lista de {texto, item?}, texto não vazio e item no formato F<n>`);
  }
  if (tem('perguntas') && !(Array.isArray(novo.perguntas) && novo.perguntas.every((q) => /^Q\d+$/.test(String(q))))) {
    throw new Error(`${chave}: perguntas é uma lista de Q<n>`);
  }
  for (const k of ['resumo', 'agora', 'nota']) {
    if (tem(k) && typeof novo[k] !== 'string') throw new Error(`${chave}: ${k} é texto`);
  }
  for (const k of DONOS_ANTIGOS) {
    if (tem(k)) throw new Error(`${chave}: o campo "${k}" saiu do contrato; use donoLocalId e donoApelido`);
  }
  if (tem('donoLocalId')) {
    if (!/^local_[0-9a-f-]{36}$/.test(String(novo.donoLocalId))) throw new Error(`${chave}: donoLocalId "${novo.donoLocalId}" não é local_<uuid>`);
    if (!textoNaoVazio(base.donoApelido)) throw new Error(`${chave}: donoLocalId exige donoApelido`);
  }
  // set cria/substitui; update de item que não existe também cria — nos dois o item novo nasce com o contrato inteiro
  if (op === 'set' || (op === 'update' && !existia)) {
    const falta = ['titulo', 'etapa', 'tema'].filter((k) => !textoNaoVazio(base[k]));
    if (falta.length) throw new Error(`${chave}: o item novo exige ${falta.join(', ')}`);
  }
}

function validarPadrao(colecao, id, novo, base, vista, op, existia) {
  const chave = `${colecao}/${id}`;
  if (colecao === 'fila') validarItemDaFila(chave, novo, base, op, existia);
  if (colecao === 'perguntas' && base.estado === 'aberta' && !base.sessaoId) {
    throw new Error(`${chave}: pergunta aberta sem sessaoId — a resposta do painel não teria para onde voltar`);
  }
  if (colecao !== 'sessoes') return;
  if ('motivo' in novo && novo.motivo !== null && !MOTIVOS.has(novo.motivo)) {
    throw new Error(`${chave}: motivo "${novo.motivo}" fora da lista (${[...MOTIVOS].join(' · ')}); o detalhe vai em bloqueio`);
  }
  // Só quando a op mexe em estado ou perguntas: atualizar `etapa` de quem já está aguarda-voce não revalida.
  if (base.estado === 'aguarda-voce' && ('estado' in novo || 'perguntas' in novo)) {
    const ids = base.perguntas;
    const falta = (motivo) => new Error(`${chave}: aguarda-voce sem pergunta aberta (${motivo}) — use parada ou bloqueada`);
    if (!Array.isArray(ids) || ids.length === 0) throw falta('perguntas vazia');
    for (const q of ids) {
      const k = `perguntas/${q}`;
      const doc = vista.has(k) ? vista.get(k) : (ID.test(String(q)) ? ler('perguntas', String(q)) : null);
      if (!doc) throw falta(`${q} não existe`);
      if (doc.data?.estado !== 'aberta') throw falta(`${q} está ${doc.data?.estado ?? 'sem estado'}`);
    }
  }
}

// Histórico e `feitoEm` da fila: quem muda a etapa ou o dono não precisa lembrar de registrar (F27 fatia 1).
function automaticosDaFila(base, novo, antes) {
  const etapaAntes = antes?.etapa ?? null;
  const donoAntes = antes?.donoApelido ?? null;
  const etapa = base.etapa ?? null;
  const dono = base.donoApelido ?? null;
  if (etapa !== etapaAntes || dono !== donoAntes) {
    const agora = new Date().toISOString();
    base.historico = [...(Array.isArray(base.historico) ? base.historico : []), { em: agora, etapa, dono }];
  }
  const final = ETAPAS_FINAIS.has(etapa);
  const eraFinal = ETAPAS_FINAIS.has(etapaAntes);
  if (final && !eraFinal && !('feitoEm' in novo)) base.feitoEm = new Date().toISOString();
  if (!final && eraFinal) delete base.feitoEm;
}

// Valida e calcula uma op contra o estado `vista` (mapa "colecao/id" -> documento ou null, que
// acumula as ops anteriores do mesmo batch). Não grava nada.
function planejar({ op, colecao, id, data, deOutra }, seVersao, vista) {
  if (op !== 'set' && op !== 'update' && op !== 'delete') throw new Error(`op desconhecida: ${op}`);
  const chave = `${colecao}/${id}`;
  const atual = vista.has(chave) ? vista.get(chave) : ler(colecao, id);
  if (seVersao !== undefined && (atual?.version ?? 0) !== seVersao) {
    throw new Error(`${chave}: versão ${atual?.version ?? 0}, esperava ${seVersao}`);
  }
  if (colecao === 'fila' && op === 'set' && atual && seVersao === undefined) {
    throw new Error(`${chave} já existe (versão ${atual.version}): use update para mesclar, ou set --se-versao ${atual.version} para substituir`);
  }
  if (colecao === 'sessoes' && atual && (op === 'set' || op === 'delete') && deOutra !== true && !ehMinha(id)) {
    throw new Error(`${chave} é de outra sessão: use \`update\` (mescla) ou \`--de-outra\` ("deOutra": true no batch) se a intenção é substituir/apagar`);
  }
  if (op === 'delete') {
    vista.set(chave, null);
    return { colecao, id, apagar: true };
  }
  const novo = objeto(data, chave);
  const base = op === 'update' ? { ...(atual?.data ?? {}) } : {};
  for (const [k, v] of Object.entries(novo)) {
    if (v === null && op === 'update') delete base[k];
    else base[k] = v;
  }
  if ((colecao === 'sessoes' || colecao === 'fila') && !base.projeto && (op === 'set' || !atual)) {
    const { projeto, motivo } = projetoDoCwd();
    if (projeto) base.projeto = projeto;
    else process.stderr.write(`aviso: ${colecao}/${id} sem projeto (${motivo})\n`);
  }
  if (!('atualizadoEm' in novo)) base.atualizadoEm = new Date().toISOString();
  validarPadrao(colecao, id, novo, base, vista, op, !!atual);
  if (colecao === 'fila') automaticosDaFila(base, novo, atual?.data);
  const version = (atual?.version ?? 0) + 1;
  vista.set(chave, { id, version, data: base });
  return { colecao, id, data: base, version };
}

function efetivar(p) {
  if (p.apagar) {
    rmSync(caminho(p.colecao, p.id), { force: true });
    return { id: p.id, deleted: true };
  }
  return gravar(p.colecao, p.id, p.data, p.version);
}

// Trava única do painel. A trava nasce COMPLETA: um diretório temporário ao lado dela, com o `dono` (token pid-aleatório)
// já dentro, entra por renameSync — no APFS o rename sobre diretório VAZIO o substitui, então uma trava nunca existe vazia
// (mkdir + dono depois deixava uma janela em que outra execução a engolia). Trava existente = ocupada: não se tenta o rename.
// Órfã = mais de 30 s E o dono morto (pid do token sem processo) ou sem token legível. Dono vivo nunca é tomado, por mais
// velha que seja a trava — e um pid reaproveitado por outro processo a prende além dos 30 s: a recusa dá o caminho da
// trava, e apagá-la à mão resolve.
// Só UM roubador por vez remove a órfã: quem quer roubar publica antes `.trava.roubo` (a mesma publicação completa, com
// dono); com o roubo na mão, julga e remove. Só dois caminhos removem a `.trava`: o dono ao soltar a própria (e o da órfã
// está morto) e o roubador, que é um só — por isso entre o julgamento e o rename ninguém troca a trava e não há devolução.
// Soltar é RENOMEAR a trava para um nome único e só então apagá-la: apagar o `dono` primeiro deixaria a `.trava` vazia por
// um instante, e outra execução publicaria por cima dela. O roubo é órfão quando o pid do dono está morto (qualquer idade)
// ou quando não tem dono legível há mais de 60 s; quem o acha o renomeia para um nome único, relê o dono e só apaga se
// ainda for o julgado (ou se o dono dele também estiver morto); se estiver vivo, devolve. Risco residual: um roubador
// morto vem ANTES e três processos entram juntos na limpeza do roubo órfão, e o terceiro troca o roubo entre o rename e a
// releitura do segundo; o laço de tentativas absorve o caso.
const TRAVA = join(BASE, '.trava');
const ROUBO = `${TRAVA}.roubo`;
const ROUBO_ORFAO_MS = 60_000;
const TRAVA_ORFA_MS = 30_000;
function dormir(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// Gancho só de teste: segura por N ms; valor que não é número finito positivo é ignorado.
function pausa(nome) { // nome = sufixo (PAUSA_MS…): vale PAINEL_<nome> e o antigo IZANAGI_PAINEL_<nome>
  const n = Number(process.env[`PAINEL_${nome}`] ?? process.env[`IZANAGI_PAINEL_${nome}`]);
  if (Number.isFinite(n) && n > 0) dormir(n);
}

function donoDe(dir) {
  try { return readFileSync(join(dir, 'dono'), 'utf8').trim(); } catch { return ''; }
}
function pidVivo(token) {
  const pid = Number.parseInt(token, 10);
  if (!Number.isInteger(pid) || pid <= 0) return false; // sem token legível: ninguém a reivindica
  try { process.kill(pid, 0); return true; } catch (err) { return err?.code === 'EPERM'; }
}
function ehOrfa(dir) {
  try {
    if (Date.now() - statSync(dir).mtimeMs <= TRAVA_ORFA_MS) return false;
  } catch { return false; } // sumiu entre o rename e o stat
  return !pidVivo(donoDe(dir));
}

// Roubo órfão: dono com pid morto (qualquer idade), ou sem dono legível há mais de 60 s (só se alguém o criou à mão).
function rouboOrfao() {
  const dono = donoDe(ROUBO);
  if (dono) return !pidVivo(dono);
  try { return Date.now() - statSync(ROUBO).mtimeMs > ROUBO_ORFAO_MS; } catch { return false; }
}
function limparRouboOrfao() {
  const julgado = donoDe(ROUBO);
  const destino = `${ROUBO}.orfa.${process.pid}-${randomBytes(4).toString('hex')}`;
  try { renameSync(ROUBO, destino); } catch (err) { if (err?.code === 'ENOENT') return; throw err; }
  const achado = donoDe(destino);
  if (achado === julgado || !pidVivo(achado)) { rmSync(destino, { recursive: true, force: true }); return; }
  try { renameSync(destino, ROUBO); } catch {
    process.stderr.write(`painel.mjs: roubo de dono vivo ficou em ${destino}\n`);
  }
}

// Remove a órfã com o roubo na mão (um roubador por vez). Devolve se mexeu (para o laço não dormir à toa).
function roubar() {
  const token = `${process.pid}-${randomBytes(6).toString('hex')}`;
  if (!publicar(ROUBO, token)) {
    if (rouboOrfao()) limparRouboOrfao();
    return false; // outro está roubando (ou o roubo órfão acabou de sair): tenta a trava normal de novo
  }
  try {
    if (!ehOrfa(TRAVA)) return false; // trocada ou solta depois do primeiro julgamento
    pausa('PAUSA_ROUBO_MS');
    const destino = `${TRAVA}.orfa.${process.pid}-${randomBytes(4).toString('hex')}`;
    renameSync(TRAVA, destino);
    process.stderr.write(`painel.mjs: trava órfã (mais de 30 s, dono morto) removida: ${TRAVA}\n`);
    rmSync(destino, { recursive: true, force: true });
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false; // o dono soltou no intervalo
    throw err;
  } finally {
    soltar(ROUBO, token);
  }
}

// Publica `alvo` COMPLETO: diretório temporário com o dono dentro, que entra por rename. Falso = já estava ocupado.
function publicar(alvo, token, gancho) {
  const tmp = mkdtempSync(`${alvo}.novo-`);
  try {
    writeFileSync(join(tmp, 'dono'), token);
    if (existsSync(alvo)) return false;
    if (gancho) pausa(gancho); // só teste: entre conferir que o alvo não existe e o rename
    renameSync(tmp, alvo); // ENOTEMPTY/EEXIST se outra entrou no intervalo
    return true;
  } catch (err) {
    if (err?.code === 'ENOTEMPTY' || err?.code === 'EEXIST') return false;
    throw err;
  } finally {
    rmSync(tmp, { recursive: true, force: true }); // só sobra se o rename não aconteceu
  }
}
const tomarTrava = (token) => publicar(TRAVA, token, 'PAUSA_PUBLICAR_MS');

// Soltura sem janela: o dono renomeia a própria para um nome único (a `.trava` nunca fica vazia no lugar) e então apaga.
// Erro aqui não derruba a execução que já gravou: avisa e segue.
function soltar(alvo, token, gancho) {
  try {
    if (donoDe(alvo) !== token) return;
    const destino = `${alvo}.solta.${process.pid}-${randomBytes(4).toString('hex')}`;
    renameSync(alvo, destino);
    // Só para teste: a pausa fica logo antes do ÚLTIMO passo que remove, dentro da janela. Numa soltura que apagasse o
    // dono e só depois o diretório, é aqui que a trava ficaria vazia e o rename de outro entraria.
    if (gancho) pausa(gancho);
    rmSync(destino, { recursive: true, force: true });
  } catch (err) {
    if (err?.code !== 'ENOENT') process.stderr.write(`painel.mjs: não consegui soltar ${alvo}: ${err?.message || err}\n`);
  }
}

function comTrava(fn) {
  mkdirSync(BASE, { recursive: true });
  const token = `${process.pid}-${randomBytes(6).toString('hex')}`;
  let pegou = false;
  for (let i = 0; i < 200 && !pegou; i++) {
    if (tomarTrava(token)) { pegou = true; break; }
    if (ehOrfa(TRAVA) && roubar()) continue;
    dormir(25);
  }
  if (!pegou) throw new Error(`não consegui a trava do painel (${TRAVA})`);
  try {
    // Só para teste: segura a trava por N ms.
    pausa('PAUSA_MS');
    return fn();
  } finally {
    soltar(TRAVA, token, 'PAUSA_SOLTAR_MS');
  }
}

// Todas as ops são validadas (coleção, op, versão) antes de gravar qualquer uma; uma recusada = nada gravado.
function aplicarLote(ops) {
  return comTrava(() => {
    const vista = new Map();
    const planos = ops.map(([o, seVersao]) => planejar(o, seVersao, vista));
    return planos.map(efetivar);
  });
}

function main(argv) {
  const [cmd, ...resto] = argv;
  const i = resto.indexOf('--se-versao');
  const seVersao = i >= 0 ? Number(resto.splice(i, 2)[1]) : undefined;
  const io = resto.indexOf('--de-outra');
  const deOutra = io >= 0 ? (resto.splice(io, 1), true) : undefined;
  const [a, b, c] = resto;
  let saida;
  switch (cmd) {
    case 'get':
      saida = ler(a, b);
      if (!saida) throw new Error(`${a}/${b} não existe`);
      break;
    case 'list': {
      const ip = resto.indexOf('--projeto');
      const projeto = ip >= 0 ? String(resto.splice(ip, 2)[1] ?? '').toLowerCase() : null;
      if (ip >= 0 && !projeto) throw new Error('--projeto pede o nome do projeto');
      const it = resto.indexOf('--todos'); if (it >= 0) resto.splice(it, 1);
      const b = resto[1];
      const dir = caminho(a);
      saida = existsSync(dir)
        ? readdirSync(dir)
            .filter((n) => n.endsWith('.json'))
            .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')))
            .filter((d) => !b || d.data?.estado === b)
            .filter((d) => !projeto || String(d.data?.projeto ?? '').toLowerCase() === projeto)
        : [];
      break;
    }
    case 'set':
    case 'update':
    case 'delete':
      saida = aplicarLote([[{ op: cmd, colecao: a, id: b, data: c, deOutra }, seVersao]])[0];
      break;
    case 'temas':
      saida = comandoTemas(resto);
      break;
    case 'batch': {
      const ops = JSON.parse(a);
      if (!Array.isArray(ops)) throw new Error('batch: esperava uma lista');
      saida = aplicarLote(ops.map((o) => [o, o?.seVersao === undefined ? undefined : Number(o.seVersao)]));
      break;
    }
    default:
      throw new Error('uso: painel.mjs get|list|set|update|delete|batch|temas … (veja o cabeçalho do script)');
  }
  process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`painel.mjs: ${err?.message || err}\n`);
  process.exitCode = 1;
}
