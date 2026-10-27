#!/usr/bin/env node
// O painel das sessões: um JSON por documento em ~/.claude/orquestracao/painel/<coleção>/<id>.json,
// no formato { id, version, data }. Quem lê é o mod painel-sessoes (/painel); quem escreve são as
// sessões, por este script. Substitui o banco do artefato (23/10).
//
//   painel.mjs get    <colecao> <id>
//   painel.mjs list   <colecao> [estado] [--projeto <nome> | --todos] [--sessao <local_…>]   (sem flag lista tudo; --sessao filtra pelo `sessaoId` do documento)
//   painel.mjs set    <colecao> <id> '<json>'            substitui o documento
//   painel.mjs update <colecao> <id> '<json>' [--se-versao N]   mescla os campos (null apaga)
//   painel.mjs batch  '[{"op":"set|update|delete","colecao":"…","id":"…","data":{…},"seVersao":N}]'   (seVersao opcional por op)
//   painel.mjs delete <colecao> <id>
//   painel.mjs temas list [--projeto <nome>]   os temas do projeto (o da pasta atual); cada tema vale só no projeto dele
//   painel.mjs temas add <id> "<rótulo>" [--projeto <nome>]   cria um tema do projeto, sem editar o JSON (projeto sem tema ganha `geral` na primeira gravação em fila)
//   painel.mjs com add <F> <local_> <apelido> "<oQue>"   põe a sessão em `com` (quem trabalha no item agora); repetir troca o oQue
//   painel.mjs com del <F> <local_|apelido> [--fez]   tira a sessão do `com` (o apelido E1/V4… vale se for um só no item); --fez a registra em `fez` (quem executou)
//   painel.mjs fez del <F> <local_|apelido> "<motivo>"   tira do `fez` do item a entrega daquela sessão (registro falso: quem saiu sem entregar); grava `agora` = "fez de <apelido> tirado: <motivo>"; recusa item inexistente, etapa final, motivo vazio, apelido ambíguo e sessão fora do `fez`
//   painel.mjs soltar <F> "<motivo>" [--so-dono]   solta o item: dono null, `com` vazio (sem `fez`: quem sai assim não entregou), `agora` = motivo; --so-dono deixa o `com` como está
//   painel.mjs livres <P|D|E|V> [--sessoes <arquivo>] [--projeto <nome>]   os membros livres do papel no projeto, o mais antigo parado primeiro → [{localId, apelido}]; --sessoes é o JSON do list_sessions (sem ele, o registro do app, sem contar a mesma sessão duas vezes)
//   painel.mjs pegar <F> [<local_>] <apelido>   (o id sai de $CLAUDE_CODE_HOST_SESSION_ID; id de outra sessão, de orquestradora ou de outro apelido é recusado) o membro livre pega o item que espera o papel dele (atômico: o segundo recebe {recusado, motivo} e exit 1); planejamento/design gravam o dono, todos põem a sessão no `com`
//   painel.mjs seguinte [<local_…>] <apelido> [--tokens <n>]   (ADR 0009) ao terminar, pega o item vivo mais antigo do mesmo projeto e tema do último item por onde a sessão passou (`passaram`) que espera o papel dela (pula o item só se a sessão já passou por ele nesta etapa), como o `pegar` → {pegou:true, item, …} ou {pegou:false, motivo}; recusa com o contexto acima do aviso do papel (E 300 mil, P/D/V 350 mil) ou sem medida do transcript; --tokens só sobrescreve a medida (teste)
//   painel.mjs mergear <PR> <sha> [--seco]   o merge do PR validado (F150): confere que a ponta é o <sha> (7 a 40 hex) e que o merge-tree não tem conflito, faz `gh pr merge --squash --match-head-commit <40 hex>` e fecha o item da fila que tem o PR (só com todos os `prs` MERGED; senão fica em merge); recusa → {recusado, motivo} e exit 1; PR que sobe a `version` de um plugin passa e a saída ganha `aviso` (a versão é da orquestradora, F173); --seco só confere
//   painel.mjs batida --sessoes <arquivo> [--seco] [--agora <ISO>]   a batida do mod (ADR 0007): cutuca e solta o item parado, avisa o livre do papel que o item espera, pede ao membro com título de item fechado que volte a livre, relata merge/vagas/excedentes/títulos velhos à orquestradora → {mensagens, soltos, projetos, marcadoresApagados}; --seco não grava nada
//   painel.mjs handoffs arquivar   move para handoffs/arquivo/ os arquivos F<n>* dos itens já fechados que ficaram na raiz → {movidos:[…]}
//   painel.mjs handoffs limpar [--dias N] [--seco]   apaga de handoffs/arquivo/ o que passa de N dias (padrão 30: pelo `feitoEm` do item; sem item, pelo mtime); --seco só lista → {apagados:[…], seco}
//   (item que vira feito/descartado arquiva os próprios handoffs e roda a limpeza; reaberto, eles voltam. Pasta: PAINEL_HANDOFFS_DIR, senão PAINEL_DIR/../pool/handoffs, senão ~/.claude/orquestracao/pool/handoffs)
//   painel.mjs list fila vencidos [--min N]   itens vivos com dono ou `com`, sem `espera` nem `trava`, parados há mais de N min (padrão 30 ou PAINEL_PRAZO_MIN)
//   painel.mjs list fila esperando   itens vivos esperando o papel da etapa (D, E ou V) sem ninguém dele no item; todo documento de `list fila` sai com `esperando` ({papel, desde, minutos} ou null) FORA de `data`, calculado na hora e nunca gravado
//   (`passaram`, a lista de quem passou pelo item, só muda por `com add` e `pegar`; set/update/batch a recusam)
//   (`com` e `fez` só mudam por `com add|del [--fez]`: o set aceita o igual ao gravado e recusa o diferente, o update e o batch recusam; `espera` se grava pelo update comum)
//   (set e delete em sessoes/<id> que JÁ existe e é de OUTRA sessão exigem --de-outra; no batch, "deOutra": true na op)
//   fila: etapa · tema (de temas.json, ao lado das coleções) · trava {motivo,texto} · prs · depois · perguntas · donoLocalId+donoApelido
//   são validados quando presentes; etapa/dono que mudam ganham `historico` e a etapa final grava `feitoEm` (F27 fatia 1).
//   (set em fila/<id> que JÁ existe exige --se-versao N — ou "seVersao" na op do batch —: sem ele, o set apagaria o item em silêncio)
//
// Coleções: sessoes, perguntas, fila (itens F<n> do pool; protocolo em pool/protocolo.md#fila-do-pool) e cartoes (cartão de sessão nova
//   que espera o clique do operador; id = task_id do start_session; { projeto, apelido, papel, itens[F<n>], orquestradoraId, propostoEm };
//   a orquestradora grava e apaga, e a batida apaga o apelido vivo e o que passou de 12 h).
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
import { DIAS_ARQUIVO, arquivarFechados, arquivarItem, desarquivarItem, limparArquivados } from './handoffs.mjs';
import { AFINIDADE_MIN, BATIDA_SOLTA_MIN, cartoesResolvidos, julgar, livresDe, ocupadosDaFila } from './batida.mjs';
import { SHA_VALIDADO, conferir, estadoDoPr, mergearNoGitHub } from './mergear.mjs';

const BASE = process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(homedir(), '.claude', 'orquestracao', 'painel');
// Handoffs dos itens: PAINEL_HANDOFFS_DIR; senão, ao lado do painel (PAINEL_DIR/../pool/handoffs, que no uso real é ~/.claude/orquestracao/pool/handoffs); senão, o padrão do HOME.
const HANDOFFS = process.env.PAINEL_HANDOFFS_DIR || ((process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR) ? join(BASE, '..', 'pool', 'handoffs') : join(homedir(), '.claude', 'orquestracao', 'pool', 'handoffs'));
const COLECOES = new Set(['sessoes', 'perguntas', 'fila', 'cartoes']);
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
// `esperando` da `list fila` (F58): a regra mora em hooks/esperando-papel.mjs; só `list fila` a carrega (as outras
// invocações não dependem do módulo, nem a cópia do script solta numa pasta sem `hooks/`).
const DA_BATIDA = ['batida', 'pegar', 'livres', 'seguinte'].includes(process.argv[2]);
const CONFERE_MEMBRO = DA_BATIDA || process.argv[2] === 'com';
const moduloEsperando = (process.argv[2] === 'list' && process.argv.slice(3).includes('fila')) || DA_BATIDA
  ? await import(pathToFileURL(join(HOOKS_DIR, 'esperando-papel.mjs')).href)
  : null;
const esperandoPapel = moduloEsperando?.esperandoPapel ?? null;
const entradaNaEtapa = moduloEsperando?.entradaNaEtapa ?? null;
// `batida`, `pegar` e `livres` (e `com`, só para conferir o membro) também precisam do registro do app, do modo ausente e da máquina cheia (hooks/).
const regras = CONFERE_MEMBRO
  ? await import(pathToFileURL(POOL_COMUM).href).catch((e) => {
    if (DA_BATIDA) throw e;
    process.stderr.write(`painel.mjs: aviso: não consegui importar ${POOL_COMUM} (${e.message}); o id do membro não foi conferido\n`);
    return null;
  })
  : null;
// As réguas de contexto por papel moram no hook contexto-do-papel (que só roda quando é o script principal); o `seguinte` as lê dali.
const reguas = DA_BATIDA ? await import(pathToFileURL(join(HOOKS_DIR, 'contexto-do-papel.mjs')).href) : null;
const crewai = DA_BATIDA ? await import(pathToFileURL(join(HOOKS_DIR, 'hooks-crewai-comum.mjs')).href) : null;
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
  if (!COLECOES.has(colecao)) throw new Error(`coleção desconhecida: ${colecao} (use sessoes, perguntas, fila ou cartoes)`);
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
// Só `com add|del` grava `com`: o símbolo não atravessa JSON, então um batch não o forja.
const VIA_COM = Symbol('via-com');
const MOTIVOS_DA_ESPERA = ['operador', 'gate'];
const LOCAL_ID = /^local_[0-9a-f-]{36}$/;
const CITA_NUMERO = /\bF\d+\b|#\d+/;
// F43: o texto que o operador lê cita item como "F13 · <título>" na primeira menção; as seguintes podem ser só "F13".
const CAMPOS_LIDOS_PELO_OPERADOR = ['titulo', 'caso', 'seNaoDecidir', 'recomendacao'];
function itemSoltoNaPergunta(novo) {
  const nomeados = new Set();
  for (const campo of CAMPOS_LIDOS_PELO_OPERADOR) {
    if (typeof novo[campo] !== 'string') continue;
    for (const m of novo[campo].matchAll(/\bF\d+\b( · )?/g)) {
      const numero = m[0].replace(' · ', '');
      if (m[1]) nomeados.add(numero);
      else if (!nomeados.has(numero)) return { campo, numero };
    }
  }
  return null;
}
const ARQUIVO_DE_TEMAS = () => join(BASE, 'temas.json');
// temas.json: lista de { id, rotulo, projeto? }. Tema com `projeto` vale só nele; sem `projeto` (instalação antiga) vale para todos.
// Sem `projeto` no pedido (list fora de git), enxerga tudo; quem VALIDA item passa por `temasDoItem`, que não deixa o item sem projeto usar tema alheio.
const doProjeto = (t, projeto) => !projeto || !t?.projeto || String(t.projeto).toLowerCase() === projeto;
const global = (t) => !t?.projeto;
const temasDoItem = (lista, projeto) => lista.filter((t) => (projeto ? doProjeto(t, projeto) : global(t)));
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
// Projeto sem tema PRÓPRIO ganha o `geral` (um tema global não conta: ele não desliga a semente). A semente volta em `semente` e só é gravada quando a escrita do item é aceita (`efetivar`).
function temasValidos(chave, projeto) {
  const caminho = ARQUIVO_DE_TEMAS();
  try {
    const lista = lerTemas(caminho);
    let semente = null;
    if (projeto) {
      const proprio = lista.some((t) => t?.projeto && String(t.projeto).toLowerCase() === projeto);
      if (!proprio && !idsDe(lista, projeto).includes('geral')) semente = { id: 'geral', rotulo: 'Geral', projeto };
    } else if (lista.length === 0) {
      semente = { id: 'geral', rotulo: 'Geral' };
    }
    const ids = temasDoItem(semente ? [...lista, semente] : lista, projeto).map((t) => t?.id).filter((x) => typeof x === 'string' && x);
    return { ids, caminho, semente };
  } catch (e) {
    throw new Error(`${chave}: não consegui ler os temas em ${caminho} (${e.message})`);
  }
}
function semearTema(semente) {
  if (!semente) return;
  const caminho = ARQUIVO_DE_TEMAS();
  const lista = lerTemas(caminho);
  const igual = (t) => t?.id === semente.id && String(t?.projeto ?? '') === String(semente.projeto ?? '');
  if (lista.some(igual)) return;
  gravarTemas(caminho, [...lista, semente]);
  process.stderr.write(semente.projeto ? `painel.mjs: o projeto "${semente.projeto}" não tinha tema; cadastrei "geral" em ${caminho}. Crie os seus com: painel.mjs temas add <id> "<rótulo>"\n` : `painel.mjs: ${caminho} não tinha temas; criei com o tema "geral".\n`);
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

// `list <coleção> <filtro>`: na fila, `em-andamento` é ter dono e etapa não final (item antigo, sem etapa válida, cai no `estado`); os outros valores casam com a etapa ou o estado.
function filtraPorEstado(colecao, d, filtro) {
  if (colecao !== 'fila') return d?.estado === filtro;
  const temEtapa = ETAPAS.includes(d?.etapa);
  if (filtro === 'em-andamento') {
    if (!temEtapa) return d?.estado === 'em-andamento';
    return !ETAPAS_FINAIS.has(d.etapa) && (textoNaoVazio(d.donoLocalId) || textoNaoVazio(d.donoApelido));
  }
  return d?.etapa === filtro || d?.estado === filtro;
}

let sementePendente = null; // a semente do tema da última validação; quem chama a leva até `efetivar`
// JSON com as chaves ordenadas: a mesma lista com as chaves em outra ordem é a mesma lista, não uma forja.
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
function validarItemDaFila(chave, novo, base, op, existia, viaCom, antes) {
  sementePendente = null;
  const tem = (k) => k in novo && novo[k] !== null;
  // apagar o contrato não é mesclar: `null` em update remove o campo, e titulo/etapa/tema são o que faz do documento um item
  if (op === 'update') {
    for (const k of ['titulo', 'etapa', 'tema']) {
      if (k in novo && novo[k] === null) throw new Error(`${chave}: ${k} não pode ser apagado (null) — o item perderia o contrato; troque o valor`);
    }
  }
  // `nota` e `estado` saíram do contrato (viraram `agora` e `etapa`): gravá-los de novo recria o formato antigo. `null` ainda passa, para limpar.
  if (op === 'update') {
    for (const [k, nova] of [['nota', 'agora'], ['estado', 'etapa']]) {
      if (tem(k)) throw new Error(`${chave}: o campo "${k}" saiu do contrato; use "${nova}"`);
    }
  }
  if ('titulo' in novo && !textoNaoVazio(novo.titulo)) {
    throw new Error(`${chave}: titulo é texto não vazio (recusa "", "   " e número)`);
  }
  // Limite conhecido: a regex também recusa "F5" (a tecla) e "F12" (o DevTools); descreva a tecla por extenso (ex.: "a tecla de recarregar").
  // O pane já mostra o número do item e os PRs: um número no título envelhece (o PR fecha, o item muda de nome) e repete o que está ao lado.
  if (typeof novo.titulo === 'string') {
    const citado = novo.titulo.match(/\bF\d+\b/) || novo.titulo.match(/#\d+/);
    if (citado) throw new Error(`${chave}: o título não cita item nem PR ("${citado[0]}") — o pane mostra o número do item ao lado do tema e os PRs; use \`depois\`/\`prs\` (a regra recusa também a tecla "F5": descreva-a por extenso)`);
  }
  if (tem('etapa') && !ETAPAS.includes(novo.etapa)) {
    throw new Error(`${chave}: etapa "${novo.etapa}" fora da lista (${ETAPAS.join(' · ')})`);
  }
  if (tem('tema')) {
    const projeto = base?.projeto ? String(base.projeto).toLowerCase() : null;
    const { ids, caminho, semente } = temasValidos(chave, projeto);
    sementePendente = semente;
    if (ids.length === 0) throw new Error(`${chave}: tema "${novo.tema}" recusado: ${projeto ? `o projeto "${projeto}" não tem tema nenhum` : 'o item não tem projeto e não há tema global'} (lista em ${caminho}); para criar: painel.mjs temas add <id> "<rótulo>"`);
    if (!ids.includes(novo.tema)) throw new Error(`${chave}: tema "${novo.tema}" fora da lista${projeto ? ` do projeto "${projeto}"` : ''} (${ids.join(' · ')}); para criar: painel.mjs temas add <id> "<rótulo>" (lista em ${caminho})`);
  }
  if (tem('trava')) {
    const t = novo.trava;
    if (typeof t !== 'object' || Array.isArray(t)) throw new Error(`${chave}: trava é null ou {motivo, texto}`);
    if (t.motivo === 'sem-ninguem') throw new Error(`${chave}: trava "sem-ninguem" só o mod produz, ao desenhar; use ${[...MOTIVOS_DA_TRAVA].join(' · ')}`);
    if (!MOTIVOS_DA_TRAVA.has(t.motivo)) throw new Error(`${chave}: trava.motivo "${t.motivo}" fora da lista (${[...MOTIVOS_DA_TRAVA].join(' · ')})`);
    if (!textoNaoVazio(t.texto)) throw new Error(`${chave}: trava.texto não pode ser vazio`);
  }
  if (!viaCom && (op === 'update' ? 'com' in novo : 'com' in novo && canonico(novo.com) !== canonico(antes?.com ?? []))) {
    throw new Error(`${chave}: o campo "com" não se grava por ${op} (a lista mesclada perderia quem gravou ao mesmo tempo); use \`painel com add|del\``);
  }
  const lista = (k, campos, extra) => {
    if (!tem(k)) return;
    if (!Array.isArray(novo[k])) throw new Error(`${chave}: ${k} é uma lista de {${campos.join(', ')}}`);
    const vistos = new Set();
    for (const e of novo[k]) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error(`${chave}: ${k} é uma lista de {${campos.join(', ')}}`);
      if (!LOCAL_ID.test(String(e.localId))) throw new Error(`${chave}: ${k}.localId "${e.localId}" não é local_<uuid>`);
      if (!textoNaoVazio(e.apelido)) throw new Error(`${chave}: ${k}.apelido não pode ser vazio`);
      if (campos.includes('oQue')) {
        if (!textoNaoVazio(e.oQue)) throw new Error(`${chave}: ${k}.oQue não pode ser vazio`);
        const citado = String(e.oQue).match(CITA_NUMERO);
        if (citado) throw new Error(`${chave}: ${k}.oQue não cita item nem PR ("${citado[0]}"); o pane mostra o número ao lado do tema`);
      }
      if (vistos.has(e.localId)) throw new Error(`${chave}: ${k} repete ${e.localId}`);
      vistos.add(e.localId);
      extra?.(e);
    }
  };
  lista('com', ['localId', 'apelido', 'oQue']);
  lista('fez', ['localId', 'apelido', 'oQue', 'em'], (e) => {
    if (typeof e.em !== 'string' || Number.isNaN(Date.parse(e.em))) throw new Error(`${chave}: fez.em "${e.em}" não é data ISO`);
  });
  if (!viaCom && 'fez' in novo && (op === 'update' || canonico(novo.fez) !== canonico(antes?.fez ?? []))) {
    throw new Error(`${chave}: o campo "fez" só muda por \`painel com del --fez\` (acrescenta) ou \`painel fez del\` (tira entrega falsa); o ${op} apagaria ou forjaria quem executou`);
  }
  lista('passaram', ['localId', 'apelido', 'papel', 'em'], (e) => {
    if (typeof e.em !== 'string' || Number.isNaN(Date.parse(e.em))) throw new Error(`${chave}: passaram.em "${e.em}" não é data ISO`);
    if (!['P', 'D', 'E', 'V'].includes(e.papel)) throw new Error(`${chave}: passaram.papel "${e.papel}" não é P, D, E ou V`);
  });
  if (!viaCom && 'passaram' in novo && (op === 'update' || canonico(novo.passaram) !== canonico(antes?.passaram ?? []))) {
    throw new Error(`${chave}: o campo "passaram" só muda por \`painel com add\` e \`painel pegar\` (o ${op} apagaria ou forjaria quem passou pelo item)`);
  }
  if (tem('espera')) {
    const e = novo.espera;
    if (typeof e !== 'object' || Array.isArray(e)) throw new Error(`${chave}: espera é null ou {motivo, texto}`);
    if (!MOTIVOS_DA_ESPERA.includes(e.motivo)) throw new Error(`${chave}: espera.motivo "${e.motivo}" fora da lista (${MOTIVOS_DA_ESPERA.join(' · ')})`);
    if (!textoNaoVazio(e.texto)) throw new Error(`${chave}: espera.texto não pode ser vazio`);
  }
  if (ETAPAS_FINAIS.has(base.etapa) && Array.isArray(base.com) && base.com.length) {
    throw new Error(`${chave}: o item fecha com sessões trabalhando nele (com: ${base.com.map((c) => c.apelido).join(', ')}); tire-as com \`painel com del\``);
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
  if (tem('donoLocalId') && !/^local_[0-9a-f-]{36}$/.test(String(novo.donoLocalId))) {
    throw new Error(`${chave}: donoLocalId "${novo.donoLocalId}" não é local_<uuid>`);
  }
  // os dois andam juntos: tirar o dono é os dois null no MESMO update (senão fica um id sem apelido)
  if (textoNaoVazio(base.donoLocalId) && !textoNaoVazio(base.donoApelido)) {
    throw new Error(`${chave}: donoLocalId exige donoApelido — para tirar o dono, mande os dois como null no mesmo update`);
  }
  // item feito/descartado não tem dono: quem fecha o item solta o dono no mesmo update
  if ((tem('etapa') || tem('donoLocalId') || tem('donoApelido')) && ETAPAS_FINAIS.has(base.etapa) && (textoNaoVazio(base.donoLocalId) || textoNaoVazio(base.donoApelido))) {
    throw new Error(`${chave}: etapa "${base.etapa}" não tem dono — mande donoLocalId e donoApelido como null no mesmo update`);
  }
  // set cria/substitui; update de item que não existe também cria — nos dois o item novo nasce com o contrato inteiro
  if (op === 'set' || (op === 'update' && !existia)) {
    const falta = ['titulo', 'etapa', 'tema'].filter((k) => !textoNaoVazio(base[k]));
    if (falta.length) throw new Error(`${chave}: o item novo exige ${falta.join(', ')}`);
  }
}

// Cartão de sessão nova que espera o clique do operador (a coleção `cartoes`; id = o task_id do start_session).
function validarCartao(chave, c) {
  for (const k of ['projeto', 'orquestradoraId']) if (!textoNaoVazio(c[k])) throw new Error(`${chave}: ${k} é obrigatório`);
  if (!/^[PDEV]\d+$/.test(String(c.apelido))) throw new Error(`${chave}: apelido "${c.apelido}" não é P<n>, D<n>, E<n> ou V<n>`);
  if (c.papel !== String(c.apelido)[0]) throw new Error(`${chave}: papel "${c.papel}" não é a letra do apelido ${c.apelido}`);
  if (!Array.isArray(c.itens) || c.itens.some((F) => !ID.test(String(F)) || !/^F\d+$/.test(String(F)))) throw new Error(`${chave}: itens deve ser a lista de F<n> (vazia no piso de E)`);
  if (Number.isNaN(Date.parse(c.propostoEm))) throw new Error(`${chave}: propostoEm não é data ISO`);
}

function validarPadrao(colecao, id, novo, base, vista, op, existia, viaCom, antes) {
  const chave = `${colecao}/${id}`;
  if (colecao === 'fila') validarItemDaFila(chave, novo, base, op, existia, viaCom, antes);
  if (colecao === 'cartoes') validarCartao(chave, base);
  if (colecao === 'perguntas' && base.estado !== 'respondida' && base.estado !== 'cancelada') {
    const solto = itemSoltoNaPergunta(novo);
    if (solto) throw new Error(`${chave}: ${solto.campo} cita "${solto.numero}" solto — na primeira menção escreva "${solto.numero} · <título do item>" (painel get fila ${solto.numero}); o operador não sabe o que é o número (a tecla F5 se descreve por extenso)`);
  }
  if (colecao === 'perguntas' && ('respondidaPor' in novo || 'respondidaEm' in novo)) {
    throw new Error(`${chave}: ${'respondidaPor' in novo ? 'respondidaPor' : 'respondidaEm'} só o pane grava (é a prova do clique do operador)`);
  }
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
  if (final) delete base.espera;
  if (final && !eraFinal && !('feitoEm' in novo)) base.feitoEm = new Date().toISOString();
  if (!final && eraFinal) delete base.feitoEm;
  return { fechou: final && !eraFinal, reabriu: !final && eraFinal };
}

// Valida e calcula uma op contra o estado `vista` (mapa "colecao/id" -> documento ou null, que
// acumula as ops anteriores do mesmo batch). Não grava nada.
function planejar(o, seVersao, vista) {
  const { op, colecao, id, data, deOutra } = o;
  const viaCom = o[VIA_COM] === true;
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
  // `set` monta o documento do zero, mas `com` não é de quem o substitui: o gravado fica (só `com add|del` o muda),
  // e a trava de fechamento abaixo o lê. Sem isto, `set --se-versao` sem o campo apagaria quem trabalha no item.
  // O clique do painel (`respondidaPor` + `respondidaEm`) vale só para a resposta e a pergunta que ele gravou: trocar
  // `resposta`, `estado`, `titulo` ou `sessaoId` por OUTRO valor apaga a prova; regravar o mesmo valor, `nota` e `atualizadoEm` não.
  if (colecao === 'perguntas' && ['resposta', 'estado', 'titulo', 'sessaoId'].some((k) => k in novo && novo[k] !== atual?.data?.[k])) {
    delete base.respondidaPor; delete base.respondidaEm;
  }
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.com) && atual.data.com.length) base.com = atual.data.com;
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.fez)) base.fez = atual.data.fez;
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.passaram)) base.passaram = atual.data.passaram;
  if ((colecao === 'sessoes' || colecao === 'fila') && !base.projeto && (op === 'set' || !atual)) {
    const { projeto, motivo } = projetoDoCwd();
    if (projeto) base.projeto = projeto;
    else process.stderr.write(`aviso: ${colecao}/${id} sem projeto (${motivo})\n`);
  }
  // Item legado sem projeto que troca para um tema de projeto passa a ser desse projeto (senão nunca sai do limbo dos globais).
  if (colecao === 'fila' && op === 'update' && atual && !base.projeto && typeof novo.tema === 'string') {
    const { projeto } = projetoDoCwd();
    try {
      if (projeto && lerTemas(ARQUIVO_DE_TEMAS()).some((t) => t?.id === novo.tema && t?.projeto && String(t.projeto).toLowerCase() === projeto)) base.projeto = projeto;
    } catch { /* lista ilegível: a validação do tema reporta */ }
  }
  if (!('atualizadoEm' in novo)) base.atualizadoEm = new Date().toISOString();
  validarPadrao(colecao, id, novo, base, vista, op, !!atual, viaCom, atual?.data);
  const semente = colecao === 'fila' ? sementePendente : null;
  const transicao = colecao === 'fila' ? automaticosDaFila(base, novo, atual?.data) : {};
  const version = (atual?.version ?? 0) + 1;
  vista.set(chave, { id, version, data: base });
  return { colecao, id, data: base, version, semente, ...transicao };
}

function efetivar(p) {
  if (p.apagar) {
    rmSync(caminho(p.colecao, p.id), { force: true });
    return { id: p.id, deleted: true };
  }
  semearTema(p.semente);
  const r = gravar(p.colecao, p.id, p.data, p.version);
  if (p.fechou || p.reabriu) moverHandoffs(p);
  return r;
}

// F50: o item fechado leva os arquivos de handoff para `arquivo/` (e a limpeza dos velhos roda junto); reaberto, eles voltam.
// A gravação do item já foi feita: erro de fs avisa e segue.
function moverHandoffs(p) {
  try {
    if (p.fechou) {
      arquivarItem(HANDOFFS, p.id);
      limparArquivados(HANDOFFS, itensDaFila(), { dias: DIAS_ARQUIVO });
    } else desarquivarItem(HANDOFFS, p.id);
  } catch (e) {
    process.stderr.write(`aviso: handoff de ${p.id} não foi ${p.fechou ? 'arquivado' : 'trazido de volta'} (${e?.message || e})\n`);
  }
}
function itensDaFila() {
  const dir = caminho('fila');
  const itens = new Map();
  if (!existsSync(dir)) return itens;
  for (const n of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try { const d = JSON.parse(readFileSync(join(dir, n), 'utf8')); itens.set(d.id, d.data ?? {}); } catch { /* documento ilegível: fica de fora */ }
  }
  return itens;
}

// `handoffs arquivar` (os itens já fechados que ficaram para trás) e `handoffs limpar [--dias N] [--seco]`.
function comandoHandoffs(args) {
  const [sub, ...resto] = args;
  if (sub === 'arquivar') {
    if (resto.length) throw new Error('uso: painel.mjs handoffs arquivar');
    return comTrava(() => {
      const fechados = new Map([...itensDaFila()].filter(([, d]) => ETAPAS_FINAIS.has(d.etapa)));
      return { movidos: arquivarFechados(HANDOFFS, fechados) };
    });
  }
  if (sub === 'limpar') {
    const seco = resto.includes('--seco');
    if (seco) resto.splice(resto.indexOf('--seco'), 1);
    const i = resto.indexOf('--dias');
    const bruto = i >= 0 ? String(resto.splice(i, 2)[1] ?? '') : null;
    if (resto.length) throw new Error('uso: painel.mjs handoffs limpar [--dias N] [--seco]');
    if (bruto !== null && !/^[1-9]\d*$/.test(bruto)) throw new Error(`--dias pede um inteiro positivo (recebi "${bruto}")`);
    const dias = bruto === null ? DIAS_ARQUIVO : Number(bruto);
    return comTrava(() => ({ apagados: limparArquivados(HANDOFFS, itensDaFila(), { dias, seco }), seco }));
  }
  throw new Error('uso: painel.mjs handoffs arquivar | handoffs limpar [--dias N] [--seco]');
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

// F155: o id do próprio membro. O Bash da sessão aberta por outra não mostra o `local_…` dela (só o de quem a abriu), então
// quem digita o id erra. Fonte: CLAUDE_CODE_HOST_SESSION_ID; senão o registro do app pelo id do CLI; senão null.
function idDestaSessao() {
  const h = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  if (h && LOCAL_ID.test(h)) return h;
  try { return regras?.registroDaSessao(MEU_CLI)?.localId ?? null; } catch { return null; }
}
// O id tem de ser de um membro do pool com o apelido dado: orquestradora e membro de outro apelido são recusados. Id fora do
// registro ou título sem apelido (sessão recém-aberta) passa: errar para o lado de não travar a escrita.
function conferirMembro(localId, apelido, onde) {
  let reg = null;
  try { reg = regras?.registroDaSessao(localId, { fresco: true }) ?? null; } catch { /* sem registro */ }
  const titulo = reg?.titulo ?? reg?.title;
  if (!titulo) return;
  if (titulo.startsWith('🎛 orquestradora')) throw new Error(`${onde}: ${localId} é a sessão "${titulo}", não um membro do pool; o id do membro sai do start_session (para si: $CLAUDE_CODE_HOST_SESSION_ID)`);
  const m = regras.membroDoPool(titulo);
  if (m && m.id !== apelido) throw new Error(`${onde}: ${localId} é a ${m.id} ("${titulo}"), não a ${apelido}`);
}
// `passaram` (ADR 0009): quem passou pelo item, com o papel (letra do apelido) e quando; a mesma sessão só aparece uma vez (o `em` se renova).
function comPassagem(d, localId, apelido) {
  const lista = Array.isArray(d.passaram) ? d.passaram : [];
  return [...lista.filter((p) => p.localId !== localId), { localId, apelido, papel: String(apelido)[0], em: new Date().toISOString() }];
}

// `com add|del`: lê, muda e grava a lista dentro da trava do painel; é a única via que grava `com` (e a que acrescenta a `fez`).
function comandoCom(args) {
  const [sub, F, quem0, ...resto] = args;
  let localId = quem0;
  if (sub !== 'add' && sub !== 'del') throw new Error('uso: painel.mjs com add <F> <local_> <apelido> "<oQue>" | com del <F> <local_|apelido> [--fez]');
  if (!ID.test(String(F))) throw new Error(`com: id de item inválido "${F}"`);
  // `com del` também aceita o apelido (E1, V4…): resolvido no `com` do item, dentro da trava
  const porApelido = sub === 'del' && !LOCAL_ID.test(String(quem0)) && /^[PDEV]\d+$/.test(String(quem0));
  if (!porApelido && !LOCAL_ID.test(String(localId))) throw new Error(`com: "${localId}" não é local_<uuid>`);
  if (sub === 'add') conferirMembro(localId, resto[0], 'com add');
  return comTrava(() => {
    const atual = ler('fila', F);
    if (!atual) throw new Error(`fila/${F} não existe`);
    const com = Array.isArray(atual.data.com) ? atual.data.com : [];
    if (porApelido) {
      const achados = com.filter((c) => c.apelido === quem0);
      if (achados.length === 0) throw new Error(`com del: ${quem0} não está em com de ${F}`);
      if (achados.length > 1) throw new Error(`com del: apelido ambíguo, use o local_ (${achados.map((c) => c.localId).join(', ')})`);
      localId = achados[0].localId;
    }
    let nova; const data = {};
    if (sub === 'add') {
      const [apelido, oQue] = resto;
      if (!textoNaoVazio(apelido) || !textoNaoVazio(oQue)) throw new Error('com add: faltam <apelido> e "<oQue>"');
      nova = com.some((c) => c.localId === localId) ? com.map((c) => (c.localId === localId ? { ...c, apelido, oQue } : c)) : [...com, { localId, apelido, oQue }];
      if (/^[PDEV]\d+$/.test(apelido)) data.passaram = comPassagem(atual.data, localId, apelido);
    } else {
      const quem = com.find((c) => c.localId === localId);
      if (!quem) throw new Error(`com del: ${localId} não está em com de ${F}`);
      nova = com.filter((c) => c.localId !== localId);
      if (resto.includes('--fez')) {
        const fez = Array.isArray(atual.data.fez) ? atual.data.fez : [];
        data.fez = [...fez.filter((f) => f.localId !== localId || f.oQue !== quem.oQue), { localId, apelido: quem.apelido, oQue: quem.oQue, em: new Date().toISOString() }];
      }
    }
    data.com = nova;
    const p = planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map());
    return efetivar(p);
  });
}

// `fez del <F> <local_|apelido> "<motivo>"`: tira a entrega falsa (F169). É a única via que tira de `fez`; o motivo vira o `agora`.
function comandoFez(args) {
  const [sub, F, quem, motivo, ...sobra] = args;
  if (sub !== 'del' || sobra.length) throw new Error('uso: painel.mjs fez del <F> <local_|apelido> "<motivo>" (o motivo vai entre aspas)');
  if (!ID.test(String(F))) throw new Error(`fez del: id de item inválido "${F}"`);
  const porApelido = !LOCAL_ID.test(String(quem)) && /^[PDEV]\d+$/.test(String(quem));
  if (!porApelido && !LOCAL_ID.test(String(quem))) throw new Error(`fez del: "${quem}" não é local_<uuid> nem apelido`);
  if (!textoNaoVazio(motivo)) throw new Error('fez del: falta o "<motivo>" (vira o `agora` do item)');
  return comTrava(() => {
    const atual = ler('fila', F);
    if (!atual) throw new Error(`fila/${F} não existe`);
    const d0 = atual.data ?? {};
    const final = ETAPAS.includes(d0.etapa) ? ETAPAS_FINAIS.has(d0.etapa) : ['feito', 'descartado'].includes(d0.estado);
    if (final) throw new Error(`fez del: ${F} está em etapa final (${d0.etapa ?? d0.estado}); não há o que tirar`);
    const fez = Array.isArray(d0.fez) ? d0.fez : [];
    const achados = fez.filter((f) => (porApelido ? f.apelido === quem : f.localId === quem));
    if (achados.length === 0) throw new Error(`fez del: ${quem} não está em fez de ${F}`);
    const locais = new Set(achados.map((f) => f.localId));
    if (porApelido && locais.size > 1) throw new Error(`fez del: apelido ambíguo, use o local_ (${[...locais].join(', ')})`);
    const data = { fez: fez.filter((f) => !locais.has(f.localId)), agora: `fez de ${achados[0].apelido} tirado: ${motivo}` };
    return efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map()));
  });
}

// `soltar <F> "<motivo>"`: o único caminho para devolver um item à fila sem dono (hook de Stop e ritual da orquestradora).
// Grava pela via do `com` (zera o `com`) dentro da trava; não registra `fez`.
function comandoSoltar(args) {
  const iso = args.indexOf('--so-dono');
  const soDono = iso >= 0 ? (args.splice(iso, 1), true) : false;
  const [F, motivo, ...sobra] = args;
  if (!ID.test(String(F))) throw new Error(`soltar: id de item inválido "${F}"`);
  if (sobra.length) throw new Error('uso: painel.mjs soltar <F> "<motivo>" (o motivo vai entre aspas)');
  if (!textoNaoVazio(motivo)) throw new Error('soltar: falta o "<motivo>" (vira o `agora` do item)');
  const citado = motivo.match(CITA_NUMERO);
  if (citado) throw new Error(`soltar: o motivo não cita item nem PR ("${citado[0]}"); o pane mostra o número ao lado do tema`);
  return comTrava(() => soltarSemTrava(F, motivo, soDono));
}
function soltarSemTrava(F, motivo, soDono) {
  const atual = ler('fila', F);
  if (!atual) throw new Error(`fila/${F} não existe`);
  const d0 = atual.data ?? {};
  // item legado, sem `etapa` válida, fecha pelo `estado` (o mesmo critério do `vencidos`)
  const final = ETAPAS.includes(d0.etapa) ? ETAPAS_FINAIS.has(d0.etapa) : ['feito', 'descartado'].includes(d0.estado);
  if (final) throw new Error(`soltar: ${F} está em etapa final (${d0.etapa ?? d0.estado}); não há o que soltar`);
  const data = { donoLocalId: null, donoApelido: null, agora: motivo, ...(soDono ? {} : { com: [] }) };
  return efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map()));
}

// ---- batida, pegar, livres (ADR 0007) ----
const flag = (args, nome, comValor = true) => {
  const i = args.indexOf(nome);
  if (i < 0) return comValor ? null : false;
  if (!comValor) { args.splice(i, 1); return true; }
  const v = args.splice(i, 2)[1];
  if (!textoNaoVazio(v)) throw new Error(`${nome} pede um valor`);
  return v;
};
function lerSessoes(arquivo) {
  const t = readFileSync(arquivo, 'utf8');
  const v = JSON.parse(t.slice(Math.max(0, t.indexOf('['))));
  if (!Array.isArray(v)) throw new Error(`${arquivo}: esperava a lista do list_sessions`);
  return v;
}
function projetoDeUmaLinha() {
  const cache = new Map();
  return (r) => {
    const chave = `${r?.originCwd ?? ''}|${r?.cwd ?? ''}`;
    if (!cache.has(chave)) {
      let nome = null;
      try { nome = regras.projetoDaSessao({ cwd: r?.cwd, originCwd: r?.originCwd })?.nome ?? null; } catch { /* sem projeto */ }
      cache.set(chave, nome);
    }
    return cache.get(chave);
  };
}
const itensVivos = () => new Map([...itensDaFila()].filter(([, d]) => !ETAPAS_FINAIS.has(d?.etapa)));

function comandoLivres(args) {
  const arquivo = flag(args, '--sessoes');
  const projeto = (flag(args, '--projeto') ?? projetoDoCwd().projeto ?? '').toLowerCase();
  const [papel, ...sobra] = args;
  if (!['P', 'D', 'E', 'V'].includes(papel) || sobra.length) throw new Error('uso: painel.mjs livres <P|D|E|V> [--sessoes <arquivo>] [--projeto <nome>]');
  if (!projeto) throw new Error('livres: sem projeto (fora de git); passe --projeto');
  const ocupados = ocupadosDaFila(itensDaFila());
  if (arquivo) return livresDe(lerSessoes(arquivo), papel, projeto, projetoDeUmaLinha(), ocupados);
  const repo = regras.gitCommonDir(process.cwd());
  const vistos = new Set();
  return regras.membrosLivres(repo)
    .filter((m) => m.papel === papel && m.localId && !ocupados.has(m.localId) && !vistos.has(m.localId) && vistos.add(m.localId))
    .map((m) => ({ localId: m.localId, apelido: m.apelido }));
}

// `pegar`: o membro livre que recebeu o aviso. Tudo dentro da trava: dois livres no mesmo item, um só pega.
function comandoPegar(args) {
  const [F, ...resto] = args;
  const apelido = resto.pop();
  const [dado, ...sobra] = resto;
  if (!ID.test(String(F)) || sobra.length) throw new Error('uso: painel.mjs pegar <F> [<local_…>] <apelido>');
  if (!/^[PDEV]\d+$/.test(String(apelido))) throw new Error(`pegar: apelido "${apelido}" não é P<n>, D<n>, E<n> ou V<n>`);
  const propria = idDestaSessao();
  const localId = dado ?? propria;
  if (!localId) throw new Error('pegar: não sei o id desta sessão (sem $CLAUDE_CODE_HOST_SESSION_ID); passe o <local_…>: painel.mjs pegar <F> <local_…> <apelido>');
  if (!LOCAL_ID.test(String(localId))) throw new Error(`pegar: "${localId}" não é local_<uuid>`);
  if (propria && localId !== propria) throw new Error(`pegar: ${localId} não é esta sessão (${propria}); pegar é sempre para a própria sessão: painel.mjs pegar ${F} ${apelido}`);
  conferirMembro(localId, apelido, 'pegar');
  return comTrava(() => pegarDentro(F, localId, apelido));
}
// O corpo do `pegar`, já dentro da trava (o `seguinte` o reusa).
function pegarDentro(F, localId, apelido) {
  const recusa = (motivo) => ({ recusado: true, item: F, motivo });
  {
    const atual = ler('fila', F);
    if (!atual) return recusa(`fila/${F} não existe`);
    const d = atual.data ?? {};
    if (ETAPAS_FINAIS.has(d.etapa)) return recusa(`o item está em etapa final (${d.etapa})`);
    if (d.etapa === 'merge') return recusa('o item está em merge: é da orquestradora');
    const r = esperandoPapel(d, Date.now());
    if (!r) return recusa('o item não está esperando ninguém (já tem quem trabalhe nele, está em espera ou travado)');
    if (r.papel !== apelido[0]) return recusa(`o item espera o papel ${r.papel}, não o ${apelido[0]}`);
    if (r.entregue) return recusa(`a parte do papel ${r.papel} já foi entregue; o item espera a dona avançar a etapa`);
    const com = Array.isArray(d.com) ? d.com : [];
    const data = { com: [...com.filter((c) => c.localId !== localId), { localId, apelido, oQue: d.titulo }], agora: `${apelido} começou`, passaram: comPassagem(d, localId, apelido) };
    if ((d.etapa === 'planejamento' || d.etapa === 'design') && !textoNaoVazio(d.donoLocalId)) { data.donoLocalId = localId; data.donoApelido = apelido; }
    efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map()));
    // F169: quem pega um item novo deixou os outros; sai do `com` deles sem `fez` (quem entregou já rodou `com del --fez`).
    for (const [outro, o] of itensVivos()) {
      if (outro === F || !Array.isArray(o?.com) || !o.com.some((c) => c.localId === localId)) continue;
      efetivar(planejar({ op: 'update', colecao: 'fila', id: outro, data: { com: o.com.filter((c) => c.localId !== localId) }, [VIA_COM]: true }, undefined, new Map()));
    }
    const handoff = join(HANDOFFS, `${F}.md`);
    return { pegou: true, item: F, titulo: d.titulo, etapa: d.etapa, handoff: existsSync(handoff) ? handoff : null };
  }
}

// `seguinte` (ADR 0009): ao terminar, o membro olha o mesmo assunto antes de se declarar livre. Acha o item vivo mais antigo do mesmo
// projeto e tema do último item por onde esta sessão passou que espera o papel dela, e faz o `pegar`. O teto de contexto manda mais:
// acima do aviso da régua do papel (ou sem medida) recusa, e a sessão se limpa.
function comandoSeguinte(args) {
  const tokens = flag(args, '--tokens');
  const dado = LOCAL_ID.test(String(args[0])) ? args.shift() : null;
  const [apelido, ...sobra] = args;
  if (!/^[PDEV]\d+$/.test(String(apelido)) || sobra.length) throw new Error('uso: painel.mjs seguinte [<local_…>] <apelido> [--tokens <n>]');
  const localId = dado ?? idDestaSessao();
  if (!localId) throw new Error('seguinte: não sei o id desta sessão (sem $CLAUDE_CODE_HOST_SESSION_ID); passe o <local_…>');
  const nao = (motivo) => ({ pegou: false, motivo });
  const aviso = apelido[0] === 'E' ? reguas.EXEC : reguas.ALTO;
  let medido = tokens === null ? null : Number(tokens);
  if (tokens === null) {
    try { const f = regras.transcriptDoLocal(localId); medido = f ? regras.contextoDoTranscript(f)?.tokens ?? null : null; } catch { medido = null; }
  }
  if (!Number.isFinite(medido)) return nao('contexto sem medida (transcript não achado ou sem usage): livre e limpe-se; o item vai a outro');
  if (medido >= aviso) return nao(`contexto alto (${Math.round(medido / 1000)} mil, aviso do papel ${apelido[0]}: ${Math.round(aviso / 1000)} mil): livre e limpe-se; o item vai a outro`);
  return comTrava(() => {
    const todos = itensDaFila();
    let ultimo = null;
    for (const d of todos.values()) {
      for (const p of Array.isArray(d?.passaram) ? d.passaram : []) {
        if (p?.localId === localId && (!ultimo || Date.parse(p.em) > Date.parse(ultimo.p.em))) ultimo = { d, p };
      }
    }
    if (!ultimo) return nao('esta sessão não passou por nenhum item registrado: não há assunto para seguir');
    const { projeto, tema } = ultimo.d;
    const agora = Date.now();
    const candidatos = [];
    for (const [F, d] of todos) {
      if (ETAPAS_FINAIS.has(d?.etapa) || d?.projeto !== projeto || d?.tema !== tema) continue;
      // já passou por ele NESTA etapa: a V sai sem `--fez` e o item segue esperando V. Passagem de rodada anterior (conserto, revalidação) não pula.
      const entrada = entradaNaEtapa(d);
      if (entrada === null || (Array.isArray(d.passaram) ? d.passaram : []).some((p) => p?.localId === localId && Date.parse(p.em) >= entrada)) continue;
      const r = esperandoPapel(d, agora);
      if (!r || r.entregue || r.papel !== apelido[0]) continue;
      candidatos.push({ F, desde: Date.parse(r.desde) });
    }
    candidatos.sort((a, b) => a.desde - b.desde);
    if (!candidatos.length) return nao(`nenhum item do tema "${tema}" espera o papel ${apelido[0]}`);
    for (const { F } of candidatos) {
      const r = pegarDentro(F, localId, apelido);
      if (r.pegou) return r;
    }
    return nao(`nenhum item do tema "${tema}" pôde ser pego`);
  });
}

// `mergear <PR> <sha> [--seco]` (F150). O GitHub fica FORA da trava (é lento); a escrita no painel, dentro dela.
function comandoMergear(args) {
  const seco = flag(args, '--seco', false);
  const [prTexto, sha, ...sobra] = args;
  const uso = 'uso: painel.mjs mergear <PR> <sha de 7 a 40 hex> [--seco]';
  if (!/^[1-9]\d*$/.test(String(prTexto)) || !SHA_VALIDADO.test(String(sha)) || sobra.length) throw new Error(uso);
  const pr = Number(prTexto);
  const c = conferir(pr, sha, process.cwd());
  if (c.recusado) return c;
  const { projeto } = projetoDoCwd();
  const doPr = () => [...itensVivos()].filter(([, d]) => projeto && String(d?.projeto ?? '').toLowerCase() === projeto && Array.isArray(d.prs) && d.prs.includes(pr)).map(([F, d]) => ({ F, prs: d.prs }));
  const decidir = () => doPr().map(({ F, prs }) => ({ F, fecha: prs.filter((n) => n !== pr).every((n) => estadoDoPr(n, process.cwd()) === 'MERGED') }));
  if (seco) return { seco: true, mergearia: { pr, sha: c.sha, base: c.base }, ...(c.aviso ? { aviso: c.aviso } : {}), itens: decidir().map(({ F, fecha }) => ({ item: F, fecharia: fecha })) };
  mergearNoGitHub(pr, c.sha, process.cwd());
  const decisoes = decidir();
  const curto = c.sha.slice(0, 7);
  const itens = comTrava(() => decisoes.map(({ F, fecha }) => {
    const atual = ler('fila', F);
    if (!atual || ETAPAS_FINAIS.has(atual.data?.etapa)) return { item: F, fechado: false, agora: null };
    const agora = fecha ? `mergeado, ponta ${curto}` : 'um PR entrou; falta outro';
    const data = fecha ? { etapa: 'feito', donoLocalId: null, donoApelido: null, com: [], agora } : { com: [], agora };
    efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map()));
    return { item: F, fechado: fecha, agora };
  }));
  return { mergeado: true, pr, sha: c.sha, base: c.base, ...(c.aviso ? { aviso: c.aviso } : {}), itens };
}

const ORQ = () => regras.BASE;
const arquivoJson = (f, padrao) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return padrao; } };
function gravarJson(f, v) {
  mkdirSync(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(v, null, 2)}\n`);
  renameSync(tmp, f);
}
const SETE_DIAS_MS = 7 * 24 * 3600_000;
// Marcadores `ativas/<id>` de orquestradora que já não existem: sessão arquivada ou fora do registro, ou parada há 7 dias.
function marcadoresMortos(porId, agoraMs) {
  const dir = join(ORQ(), 'ativas');
  let nomes = [];
  try { nomes = readdirSync(dir); } catch { return []; }
  const mortos = [];
  for (const id of nomes.sort()) {
    let reg = null;
    try { reg = regras.registroDaSessao(id, { fresco: true }); } catch { continue; }
    if (reg === null || reg.arquivada) { mortos.push(id); continue; }
    const linha = porId.get(reg.localId);
    if (linha?.isRunning === true) continue;
    const t = Date.parse(linha?.lastActivityAt);
    if (!Number.isNaN(t) && agoraMs - t >= SETE_DIAS_MS) mortos.push(id);
  }
  return mortos;
}

function cartoesDoPainel() {
  let nomes = [];
  try { nomes = readdirSync(caminho('cartoes')).filter((n) => n.endsWith('.json')); } catch { return []; }
  return nomes.flatMap((n) => { try { const d = JSON.parse(readFileSync(join(caminho('cartoes'), n), 'utf8')); return [{ id: n.slice(0, -5), data: d.data ?? {} }]; } catch { return []; } });
}

function comandoBatida(args) {
  const arquivo = flag(args, '--sessoes');
  const seco = flag(args, '--seco', false);
  const agoraIso = flag(args, '--agora');
  if (!arquivo || args.length) throw new Error('uso: painel.mjs batida --sessoes <arquivo> [--seco] [--agora <ISO>]');
  const agoraMs = agoraIso ? Date.parse(agoraIso) : Date.now();
  if (Number.isNaN(agoraMs)) throw new Error(`--agora: "${agoraIso}" não é data ISO`);
  const linhas = lerSessoes(arquivo);
  const pasta = join(ORQ(), 'batida');
  const solta = Number(process.env.BATIDA_SOLTA_MIN);
  const rodar = () => {
    const itens = itensVivos();
    const julgado = julgar({
      agoraMs, itens, linhas, projetoDe: projetoDeUmaLinha(),
      estado: arquivoJson(join(pasta, 'estado.json'), {}), ausente: Boolean(crewai.modoAusente()),
      cheia: () => regras.maquinaCheia().cheia, esperandoPapel, todos: itensDaFila(),
      afinidadeMin: Number.isFinite(Number(process.env.BATIDA_AFINIDADE_MIN)) && Number(process.env.BATIDA_AFINIDADE_MIN) > 0 ? Number(process.env.BATIDA_AFINIDADE_MIN) : AFINIDADE_MIN,
      ultimo: (nome) => arquivoJson(join(pasta, `${nome}.json`), null),
      caminhoDoRelatorio: (nome) => join(pasta, `${nome}.json`),
      prazoMin: prazoEmMin([]), soltaMin: Number.isInteger(solta) && solta > 0 ? solta : BATIDA_SOLTA_MIN,
    });
    const marcadoresApagados = marcadoresMortos(new Map(linhas.map((r) => [r.sessionId, r])), agoraMs);
    const cartoesApagados = cartoesResolvidos({ cartoes: cartoesDoPainel(), linhas, projetoDe: projetoDeUmaLinha(), agoraMs });
    const saida = { cartoesApagados, mensagens: julgado.mensagens, soltos: julgado.soltar.map((s) => s.F), projetos: Object.fromEntries(Object.entries(julgado.projetos).map(([n, p]) => { const { mudou, ...resto } = p; return [n, resto]; })), marcadoresApagados };
    if (seco) return saida;
    const soltos = [];
    for (const { F, motivo } of julgado.soltar) {
      try { soltarSemTrava(F, motivo, false); soltos.push(F); } catch (e) { process.stderr.write(`batida: não soltei ${F}: ${e?.message || e}\n`); }
    }
    saida.soltos = soltos;
    for (const { F, texto } of julgado.espera) {
      try { efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data: { espera: { motivo: 'gate', texto } } }, undefined, new Map())); } catch (e) { process.stderr.write(`batida: não gravei a espera de ${F}: ${e?.message || e}\n`); }
    }
    gravarJson(join(pasta, 'estado.json'), julgado.estado);
    const em = new Date(agoraMs).toISOString();
    for (const [nome, p] of Object.entries(julgado.projetos)) {
      const { mudou, ...conteudo } = p;
      // o relatório só passa a ser "o último" quando a orquestradora existe para recebê-lo: sem ela, a próxima batida o oferece de novo
      if (mudou && !conteudo.orquestradora) { const antes = arquivoJson(join(pasta, `${nome}.json`), null); gravarJson(join(pasta, `${nome}.json`), { ...conteudo, merge: antes?.merge ?? [], vagas: antes?.vagas ?? [], excedentes: antes?.excedentes ?? [], titulosVelhos: antes?.titulosVelhos ?? [], em }); continue; }
      gravarJson(join(pasta, `${nome}.json`), { ...conteudo, em });
    }
    for (const id of marcadoresApagados) rmSync(join(ORQ(), 'ativas', id), { force: true });
    for (const id of cartoesApagados) rmSync(caminho('cartoes', id), { force: true });
    return saida;
  };
  return seco ? rodar() : comTrava(rodar);
}

// `list fila vencidos`: vivo, com dono ou `com`, sem `espera` nem `trava` (quem espera o operador ou o gate está parado de propósito)
// e com `atualizadoEm` mais velho que o prazo. Sem `atualizadoEm` legível vale como vencido: não há prova de que alguém gravou.
function ehVencido(d, limiteMs, agora) {
  const vivo = ETAPAS.includes(d?.etapa) ? !ETAPAS_FINAIS.has(d.etapa) : d?.estado === 'em-andamento';
  if (!vivo) return false;
  const comDono = textoNaoVazio(d.donoLocalId) || textoNaoVazio(d.donoApelido) || (Array.isArray(d.com) && d.com.length > 0);
  if (!comDono || d.espera || d.trava) return false;
  const t = Date.parse(d.atualizadoEm);
  return Number.isNaN(t) || agora - t > limiteMs;
}
function prazoEmMin(resto) {
  const i = resto.indexOf('--min');
  const bruto = i >= 0 ? String(resto.splice(i, 2)[1] ?? '') : process.env.PAINEL_PRAZO_MIN;
  if (i < 0 && (bruto === undefined || bruto === '')) return 30;
  if (!/^[1-9]\d*$/.test(String(bruto))) throw new Error(`--min pede um inteiro positivo (recebi "${bruto}")`);
  return Number(bruto);
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
      const is = resto.indexOf('--sessao');
      const sessao = is >= 0 ? String(resto.splice(is, 2)[1] ?? '') : null;
      if (is >= 0 && !sessao) throw new Error('--sessao pede o local_… da sessão');
      const it = resto.indexOf('--todos'); if (it >= 0) resto.splice(it, 1);
      let prazoMin = null;
      if (a === 'fila') {
        const iv = resto.indexOf('vencidos', 1);
        if (iv >= 0) { resto.splice(iv, 1); prazoMin = prazoEmMin(resto); resto.splice(1, 0, 'vencidos'); }
        else if (resto.includes('--min')) throw new Error('--min só vale com `list fila vencidos`');
        const flag = resto.slice(1).find((x) => String(x).startsWith('--'));
        if (flag) throw new Error(`list fila: flag desconhecida "${flag}"`);
        const filtro = resto[1];
        // os `estado` do contrato antigo ainda filtram (documento sem `etapa`); fora desta lista, o filtro é erro de digitação
        const validos = ['em-andamento', 'vencidos', 'esperando', ...ETAPAS, 'aberto', 'bloqueado', 'concluido', 'concluida', 'em-planejamento', 'em-execucao', 'em-validacao'];
        if (filtro !== undefined && !validos.includes(filtro)) {
          throw new Error(`list fila: filtro desconhecido "${filtro}" (válidos: ${[...new Set(validos)].join(' · ')})`);
        }
      }
      const b = resto[1];
      const dir = caminho(a);
      saida = existsSync(dir)
        ? readdirSync(dir)
            .filter((n) => n.endsWith('.json'))
            .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')))
            .filter((d) => (prazoMin !== null ? ehVencido(d.data, prazoMin * 60_000, Date.now()) : !b || (a === 'fila' && b === 'esperando') || filtraPorEstado(a, d.data, b)))
            .filter((d) => !projeto || String(d.data?.projeto ?? '').toLowerCase() === projeto)
            .filter((d) => !sessao || d.data?.sessaoId === sessao)
            .map((d) => (a === 'fila' ? { ...d, esperando: esperandoPapel(d.data, Date.now()) } : d))
            .filter((d) => !(a === 'fila' && b === 'esperando') || d.esperando)
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
    case 'seguinte':
      saida = comandoSeguinte(resto);
      break;
    case 'com':
      saida = comandoCom(resto);
      break;
    case 'fez':
      saida = comandoFez(resto);
      break;
    case 'soltar':
      saida = comandoSoltar(resto);
      break;
    case 'livres':
      saida = comandoLivres(resto);
      break;
    case 'pegar':
      saida = comandoPegar(resto);
      break;
    case 'batida':
      saida = comandoBatida(resto);
      break;
    case 'handoffs':
      saida = comandoHandoffs(resto);
      break;
    case 'mergear':
      saida = comandoMergear(resto);
      break;
    case 'batch': {
      const ops = JSON.parse(a);
      if (!Array.isArray(ops)) throw new Error('batch: esperava uma lista');
      saida = aplicarLote(ops.map((o) => [o, o?.seVersao === undefined ? undefined : Number(o.seVersao)]));
      break;
    }
    default:
      throw new Error('uso: painel.mjs get|list|set|update|delete|batch|temas|com|soltar|livres|pegar|seguinte|batida|mergear|handoffs … (veja o cabeçalho do script)');
  }
  process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
  return (cmd === 'pegar' || cmd === 'mergear') && saida.recusado ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`painel.mjs: ${err?.message || err}\n`);
  process.exitCode = 1;
}
