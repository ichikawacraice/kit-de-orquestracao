#!/usr/bin/env node
// O painel das sessões: um JSON por documento em ~/.claude/orquestracao/painel/<coleção>/<id>.json,
// no formato { id, version, data }. Quem lê é o mod painel-sessoes (/painel); quem escreve são as
// sessões, por este script. Substitui o banco do artefato (23/10).
//
//   painel.mjs get    <colecao> <id>
//   painel.mjs list   <colecao> [estado] [--projeto <nome> | --todos] [--sessao <local_…|orca_session_id:…>]   (sem flag lista tudo; --sessao filtra pelo `sessaoId` do documento)
//     (F183) `list perguntas` sem `--projeto`, `--todos` nem `--sessao` lista o projeto da pasta atual, e só a pasta quente (abertas e
//     assumidas); `respondida`/`cancelada` ou `--arquivo` incluem o arquivo (`perguntas/arquivo/<projeto>/<AAAA-MM>/`)
//   painel.mjs perguntas nova '<json>'   (F478) o jeito de perguntar ao operador: valida como o `set`, reserva o Q-ID (proxima-pergunta.sh), grava, relê e imprime
//     só `Q<n>`; titulo, caso, recomendacao e (na aberta) seNaoDecidir obrigatórios; sessaoId padrão = a sessão que chama; estado aberta (padrão) ou assumida;
//     recusa → exit 1 sem gastar número. Estado de pergunta, em qualquer gravação: só aberta · assumida · respondida · cancelada (sem estado = rascunho)
//   painel.mjs perguntas arquivar [--seco]   leva ao arquivo as fechadas que ficaram na pasta quente (a resposta do pane); a batida roda junto, só depois da migração (marca <PAINEL_DIR>/.migracao-F183) → {arquivadas:[…]}
//   painel.mjs perguntas migrar [--seco]   (F183, uma vez) `projeto` em slug nas quatro coleções; pergunta sem projeto pega o da sessão
//     (sessoes/<sessaoId>, senão o registro do app), senão `sem-projeto`; sessão sem projeto, pelo registro; depois arquiva as fechadas.
//     Lê também o arquivo (conserta a pasta da pergunta já arquivada). Sem --seco faz backup do painel em <PAINEL_DIR>/../backups/F183-<data>/
//     e grava a marca que libera a batida → {seco, backup, projeto:{id: novo}, arquivadas}
//   painel.mjs set    <colecao> <id> '<json>'            substitui o documento
//   painel.mjs update <colecao> <id> '<json>' [--se-versao N]   mescla os campos (null apaga)
//   painel.mjs batch  '[{"op":"set|update|delete","colecao":"…","id":"…","data":{…},"seVersao":N}]'   (seVersao opcional por op)
//   painel.mjs delete <colecao> <id>
//   painel.mjs temas list [--projeto <nome>]   os temas do projeto (o da pasta atual); cada tema vale só no projeto dele
//   painel.mjs temas add <id> "<rótulo>" [--projeto <nome>]   cria um tema do projeto, sem editar o JSON (projeto sem tema ganha `geral` na primeira gravação em fila)
//   painel.mjs com add <F> <local_|orca_session_id:…> <apelido> "<oQue>"   põe a sessão em `com` (quem trabalha no item agora); repetir troca o oQue
//   painel.mjs com del <F> <local_|apelido>   tira a sessão do `com` (o apelido vale se for um só no item)
//   painel.mjs entregas [--desde <HH:MM|ISO>] [--projeto <nome> | --todos]   (F404, ADR 0024) os itens feitos desde a hora (HH:MM é São Paulo; padrão: 24 h), do projeto da pasta, com a `entrega` gravada pela dona → {desde, itens:[{id, titulo, feitoEm, prs, entrega|null}], semEntrega}
//   painel.mjs custo <F> [--seco]   mede o custo do item nos transcripts das sessões dele e grava em `custo` (F348; o `mergear` grava ao fechar); --seco só mostra
//   painel.mjs soltar <F> "<motivo>" [--so-dono]   solta o item: dono null, `com` vazio, `agora` = motivo; --so-dono deixa o `com` como está
//   painel.mjs mergear <PR> <sha> [--seco]   o merge de um PR: confere que a ponta é o <sha> (7 a 40 hex) e que o merge-tree não tem conflito, faz `gh pr merge --squash --match-head-commit <40 hex>` e fecha o item da fila que tem o PR (só com todos os `prs` MERGED; senão fica em merge; com `maisFatias: true` volta a `execucao` com a dona, F222); recusa → {recusado, motivo} e exit 1; PR que sobe a `version` de um plugin passa e a saída ganha `aviso` (a versão é da orquestradora, F173); --seco só confere
//   painel.mjs pode-reiniciar [--sessoes <arquivo do list_sessions>] [--lista-em <ISO>] [--json]   (F152) dá para reiniciar o app agora? Conta sessão com turno rodando (menos a própria), teste rodando (fichas do teto e processos soltos) e merge/rebase no meio; sem --sessoes lê batida/sessoes.json e diz a idade; não manda mensagem a ninguém; grava batida/pode-reiniciar.json (todos os motivos, a própria sessão incluída, com `em` e `listaEm`); (F209) traz também `paraAplicar` (plugins do kit instalados depois que o app abriu) e `paraBaixar` (plugins do kit com versão publicada mais nova, por `git fetch` no clone do marketplace com cache de 30 min em batida/kit-publicado.json); exit 0 nos dois casos, 1 só em erro de leitura
//   painel.mjs fila-de-merge <PR[:sha]> [<PR[:sha]>…] [--gate "<cmd>"] [--preparar "<cmd>"] [--falha-de-infra "<padrão>"…|nenhuma] [--espera-de-infra <s>] [--seco]   a fila de merge: monta os PRs na ordem dada sobre a base num worktree temporário (squash), roda o gate UMA vez na combinação (sem `--gate`, o par gate/preparo do `config` gravado; sem config, `npm test`; vermelho com a saída casando um padrão de falha de infraestrutura (fábrica: "container is not ready"; `--falha-de-infra` troca, `nenhuma` desliga, e fica no `config`) → espera `--espera-de-infra` s (30) e roda de novo uma vez, e persistindo é erro da rodada (F398); vermelho comum → repete uma vez, depois bisseção para achar quem quebra; com a fila do projeto ocupada, só anota o PR nos pendentes → {pendente:true}, e quem roda leva os pendentes como o lote seguinte → `rodadas`), liga cada PR ao item vivo pelo `prs`, pelo `branch` do item ou pela branch do worktree da dona e o põe em `merge` (F221), mergeia na ordem o que passou (como o `mergear`) e devolve o que conflitou ou ficou vermelho: o item volta a `execucao` com o motivo no `agora` → {mergeados, devolvidos:[{pr, motivo, item, dona}], gates, logs}; --seco monta e testa sem mergear nem gravar; a rodada que não é --sem-turno grava o `config` {cwd, gate, preparar, falhaDeInfra?, esperaDeInfra?} do projeto
//   painel.mjs fila-de-merge <PR:sha> [<PR:sha>…] --anotar   (F351) a entrega da dona: confere que a ponta de cada PR é o sha dado, só anota os PRs nos pendentes, grava a pasta do repositório e liga o item e, com a fila livre e o gate gravado, lança a rodada sem turno destacada (F427; o julgamento e a marca `lancada` da batida) → {anotado, pendentes, lancou, pid?, log?, naoLancou?, aviso?, avisoSemCodigo?, avisoSemEntrega?}; ele mesmo não roda gate nem mergeia
//   painel.mjs fila-de-merge <PR:sha>… --gate "<cmd>" [--preparar "<cmd>"] --sem-turno   (F351) a rodada que a batida lança destacada: igual à da orquestradora, e grava o desfecho em `desfechos` do estado da fila
//   painel.mjs batida --sessoes <arquivo> [--seco] [--agora <ISO>]   a batida do mod: cutuca e solta o item parado, relata à orquestradora o merge parado e o item sem dona (vaga), lança a fila de merge anotada sem processo e entrega os desfechos dela (F351) → {mensagens, soltos, projetos, marcadoresApagados, filasLancadas?}; --seco não grava nem lança nada
//   painel.mjs batida --leitura [--agora <ISO>]   (F460) a batida de leitura que a aba do kit roda no Orca: sem a lista do app, só deduz o estado dos itens (git, gh, workers do Orca) e grava batida/deduzido.json com fonte "leitura"; fecha o item cujos PRs ligados mergearam, pela mesma regra da batida completa, salvo o da dona local_ (F472); não julga nem grava mais nada; pula se o deduzido tem menos de 10 min → {gravado, em?, itens?, fechados?, pulou?}
//   painel.mjs orquestradora assumir   (F447) declara esta sessão a orquestradora do projeto da pasta: grava <base>/ativas/<CLAUDE_CODE_SESSION_ID> com o git common dir e, no Orca, o orca_session_id na 2ª linha (as travas valem por ele; no Orca o título não se troca) → {marcador, repo, orcaId, outras}
//   painel.mjs orquestradora arquivar <ctx_…> [--item F<n>] [--remover-worktree] [--seco]   (F447) arquiva no Orca a dona do despacho: confere PR mergeado com o HEAD da worktree (ou nenhum PR e nenhum commit fora da base), nenhuma pergunta aberta do item (pelo item, por quem trabalhou nele ou pelo título), worktree ligada (nunca o checkout principal), limpa e empurrada e worker parado (todo despacho do mesmo terminal ou pasta em estado final); valendo, `orca orchestration worker-release` e `orca worktree set --workspace-status completed` (e `orca worktree rm`, nunca --force, com --remover-worktree) → {arquivado, condicoes, feitos}; faltando algo → {arquivado:false, faltam} e exit 1, sem chamar nada; --seco só confere
//   painel.mjs orquestradora arquivar --concluidas [--itens F<n>,F<n>] [--remover-worktree] [--seco]   (F469) a aba do kit: as donas de item `feito`/`descartado` com worker no Orca, cada uma pelas MESMAS condições do arquivar acima, e com --remover-worktree também sai da barra lateral (a flag vale para todas, como no avulso) → {aptas, arquivadas, recusadas:[{item, faltam}]}; --seco só lista as aptas; --itens limita ao que a pessoa confirmou; exit 1 se alguma ficou recusada
//   painel.mjs orquestradora retomar F<n> --dispatch <ctx_…> [--esperar <s>] [--seco]   (F479) passa o item à sessão nova que a orquestradora abriu na worktree (limite de uso, contexto cheio): espera até --esperar s (60) o registro da sessão do despacho em orca-sessoes/, troca a dona, o `com` (sem as sessões da worktree que saem) e o `sessaoId` das perguntas abertas/assumidas delas, põe a nova em `sessoes`, solta os despachos parados da worktree e lê de volta → {item, para, de, perguntas, liberados, conferido}; recusa sem gravar o despacho novo que não está vivo, o item de outra worktree e a sessão antiga ou outro despacho ainda vivos; --seco só diz o que faria
//   painel.mjs handoffs arquivar   move para handoffs/arquivo/ os arquivos F<n>* dos itens já fechados que ficaram na raiz → {movidos:[…]}
//   painel.mjs handoffs limpar [--dias N] [--seco]   apaga de handoffs/arquivo/ o que passa de N dias (padrão 30: pelo `feitoEm` do item; sem item, pelo mtime); --seco só lista → {apagados:[…], seco}
//   (item que vira feito/descartado arquiva os próprios handoffs e roda a limpeza; reaberto, eles voltam. Pasta: PAINEL_HANDOFFS_DIR, senão PAINEL_DIR/../pool/handoffs, senão ~/.claude/orquestracao/pool/handoffs)
//   painel.mjs list fila vencidos [--min N]   itens vivos com dono ou `com`, sem `espera` nem `trava`, parados há mais de N min (padrão 30 ou PAINEL_PRAZO_MIN)
//   painel.mjs list fila sem-dona   itens vivos numa etapa de trabalho sem dona e sem ninguém no `com`; todo documento de `list fila` sai com `semDona` ({desde, minutos} ou null) FORA de `data`, calculado na hora e nunca gravado
//   (`com` só muda por `com add|del`: o set aceita o igual ao gravado e recusa o diferente, o update e o batch recusam; `espera` se grava pelo update comum)
//   (`fez` e `passaram` são históricos de itens antigos: só leitura; o set guarda o gravado e recusa o diferente, o update e o batch recusam)
//   (set e delete em sessoes/<id> que JÁ existe e é de OUTRA sessão exigem --de-outra; no batch, "deOutra": true na op)
//   fila: etapa · tema (de temas.json, ao lado das coleções) · trava {motivo,texto} · prs · maisFatias · fatias (nomes, F452) · depois · perguntas · donoLocalId+donoApelido
//   são validados quando presentes; etapa/dono que mudam ganham `historico` e a etapa final grava `feitoEm` (F27 fatia 1).
//   (set em fila/<id> que JÁ existe exige --se-versao N — ou "seVersao" na op do batch —: sem ele, o set apagaria o item em silêncio)
//
// Coleções: sessoes, perguntas, fila (itens F<n>; protocolo em pool/protocolo.md#a-fila) e cartoes (cartão de sessão dona
//   que espera o clique do operador; id = task_id do start_session; { projeto, apelido: "dona", papel: "dona", itens: [F<n>], orquestradoraId, propostoEm? }; propostoEm é opcional: o painel grava agora (e troca hora no futuro por agora);
//   a orquestradora grava e apaga, e a batida apaga o cartão cuja sessão já abriu e se gravou dona, ou está aberta há 30 min sem se gravar, e o que passou de 12 h).
//
// `projeto` (sessoes, fila e perguntas): ao CRIAR um documento sem o campo, o script o preenche com o nome do repositório git de
// onde roda (basename da pasta que contém o git common dir, em slug `[a-z0-9-]`; fora de git não preenche). Toda op que grava
// `projeto` fora do slug é recusada (F183). Pergunta respondida/cancelada mora em `perguntas/arquivo/<projeto>/<AAAA-MM>/<Q>.json`
// (mês da resposta, São Paulo); `get`, `update` e `delete` a acham onde estiver, e a que reabre volta à pasta quente. Ambiente: PAINEL_DIR
// e PAINEL_PAUSA_* (só teste).
//
// Toda escrita grava `atualizadoEm` (agora, ISO) quando o JSON não traz um, e sobe `version`.
import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, openSync, mkdtempSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DIAS_ARQUIVO, arquivarFechados, arquivarItem, desarquivarItem, limparArquivados } from './handoffs.mjs';
import { BATIDA_SOLTA_MIN, aFechar, cartoesResolvidos, julgar, mudouDesdeAColeta } from './batida.mjs';
import { coletar as coletarDeduzidos, primeiroId } from './estado-deduzido.mjs';
import { MOTIVO_DO_FORK, SHA_VALIDADO, arquivosDoPr, conferir, dadosDoPr, deFork, estadoDoPr, mergearNoGitHub, releaseAberto, soDocumentacao } from './mergear.mjs';
import { julgarReinicio, lerFichas, lerInicioDoApp, lerParaBaixar, lerPs, orcaNoReinicio, pluginsEsperandoReinicio, textoDoReinicio } from './pode-reiniciar.mjs';
import { GATE_PADRAO, montarLote, motivoDeConflito, padroesDeInfra, ESPERA_DE_INFRA_S } from './fila-de-merge.mjs';
import { donoDaFilaVivo, filaOrfa } from './fila-orfa.mjs';
import { registrarAcerto } from './testes-afetados.mjs';
import { posMerge } from './pos-merge.mjs';
import { custoDoItem, projetosDir, sessoesDoItem } from './custo-do-item.mjs';
import { limiteDoTranscript } from './limite-de-uso.mjs';
// F183: o slug do projeto e o lugar de cada pergunta (pasta quente ou arquivo).
import * as arq from './perguntas-arquivo.mjs';

const BASE = process.env.PAINEL_DIR || join(homedir(), '.claude', 'orquestracao', 'painel');
// Handoffs dos itens: PAINEL_HANDOFFS_DIR; senão, ao lado do painel (PAINEL_DIR/../pool/handoffs, que no uso real é ~/.claude/orquestracao/pool/handoffs); senão, o padrão do HOME.
const HANDOFFS = process.env.PAINEL_HANDOFFS_DIR || (process.env.PAINEL_DIR ? join(BASE, '..', 'pool', 'handoffs') : join(homedir(), '.claude', 'orquestracao', 'pool', 'handoffs'));
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
    return { projeto: arq.slugDoProjeto(basename(raiz).replace(/\.git$/, '')), motivo: 'cwd fora de git' };
  } catch (e) {
    // git que não respondeu a tempo não quer dizer "fora de git": são avisos diferentes
    if (e?.signal === 'SIGKILL' || e?.code === 'ETIMEDOUT') return { projeto: null, motivo: `git não respondeu em ${limiteMs / 1000} s` };
    if (e?.code === 'ENOENT') return { projeto: null, motivo: 'git não encontrado no PATH' };
    return { projeto: null, motivo: 'cwd fora de git' };
  }
}

// F351: a pasta do checkout principal do repositório (a dona do git common dir), onde a fila sem turno roda o git: o worktree
// da dona some quando ela é arquivada. Repositório sem `.git` no nome (bare): o próprio cwd.
function raizDoRepo(cwd = process.cwd()) {
  try {
    const repo = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', timeout: Number(process.env.KIT_GIT_TIMEOUT_MS) || 10000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return repo && basename(repo) === '.git' ? dirname(repo) : cwd;
  } catch { return cwd; }
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
// `semDona` da `list fila`: a regra mora em hooks/sem-dona.mjs; só `list fila` e a batida a carregam (as outras
// invocações não dependem do módulo, nem a cópia do script solta numa pasta sem `hooks/`).
const DA_BATIDA = process.argv[2] === 'batida';
const DO_REINICIO = process.argv[2] === 'pode-reiniciar';
const DA_MIGRACAO = process.argv[2] === 'perguntas' && process.argv[3] === 'migrar';
const DA_ORQUESTRADORA = process.argv[2] === 'orquestradora';
const CONFERE_MEMBRO = DA_BATIDA || DO_REINICIO || DA_MIGRACAO || DA_ORQUESTRADORA || ['com', 'fila-de-merge', 'mergear', 'custo'].includes(process.argv[2]);
const moduloSemDona = (process.argv[2] === 'list' && process.argv.slice(3).includes('fila')) || DA_BATIDA
  ? await import(pathToFileURL(join(HOOKS_DIR, 'sem-dona.mjs')).href)
  : null;
const semDona = moduloSemDona?.semDona ?? null;
const donaACaminho = moduloSemDona?.donaACaminho;
// A batida, o `pode-reiniciar`, a migração das perguntas, o `com add` e a fila de merge (a branch da dona, F221) também precisam do registro do app, do modo ausente e da máquina cheia (hooks/).
const regras = CONFERE_MEMBRO
  ? await import(pathToFileURL(POOL_COMUM).href).catch((e) => {
    if (DA_BATIDA || DO_REINICIO || DA_ORQUESTRADORA) throw e;
    process.stderr.write(`painel.mjs: aviso: não consegui importar ${POOL_COMUM} (${e.message}); o projeto da sessão não foi conferido\n`);
    return null;
  })
  : null;
// F444 (ADR 0030, item 6): a batida e o `pode-reiniciar` leem a lista de workers do Orca (a vida da dona do Orca, a conta do
// reinício) e o registro das sessões do Orca (orca-sessoes/); F447: o `orquestradora arquivar` lê a lista e chama o `orca`.
const moduloOrca = DA_BATIDA || DO_REINICIO || DA_ORQUESTRADORA
  ? await Promise.all([import(pathToFileURL(join(HOOKS_DIR, 'orca-workers.mjs')).href), import(pathToFileURL(join(HOOKS_DIR, 'orca-sessoes.mjs')).href), import(pathToFileURL(join(HOOKS_DIR, 'orca-agentes.mjs')).href)])
    .then(([w, s, a]) => ({ ...w, ...s, ...a }))
  : null;
// A lista uma vez por comando: null (sem orca), { erro } ou { workers }. Falhar ao chamar é erro (falha fechada), nunca "sem orca".
function listaDoOrca() {
  try { return moduloOrca.workersDoOrca(); } catch (e) { return { erro: `orca worker-list: ${e?.message || e}` }; }
}
// F470: o estado dos agentes do Orca (`orca worktree ps`), uma vez por comando: null (sem orca), { erro } ou { agentes }. Falhar aqui
// só tira o "rodando" (ninguém roda sem a lista); não derruba a batida.
function agentesDoOrcaUmaVez() {
  try { return moduloOrca.agentesDoOrca(); } catch (e) { return { erro: `orca worktree ps: ${e?.message || e}` }; }
}
// A vida de cada dona do Orca dos itens: id → { viva: true|false|null, rodando: true|false|null, cwd }. null = fora da vista (sem a
// lista, sem registro). `rodando` (F470) vem do agente da dona em `worktree ps`: só conta com a dona viva.
function vidaDasDonasDoOrca(itens, lista, agentes = null) {
  const vidas = new Map();
  for (const [, d] of itens) {
    for (const id of [d?.donoLocalId, ...(Array.isArray(d?.com) ? d.com.map((c) => c?.localId) : [])]) {
      if (typeof id !== 'string' || !id.startsWith('orca_session_id:') || vidas.has(id)) continue;
      let reg = null;
      try { reg = moduloOrca.lerSessaoDoOrca(id); } catch { /* sem registro: fora da vista */ }
      const viva = moduloOrca.vidaDoRegistro(reg, lista);
      vidas.set(id, { viva, rodando: viva === false ? false : moduloOrca.rodandoDoRegistro(id, agentes), cwd: reg?.cwd ?? null });
    }
  }
  return vidas;
}
// F370: a reabertura do item confere se a dona lembrada foi arquivada (o registro do app); sem o módulo, restaura sem conferir.
const GRAVA_FILA = ['update', 'set'].includes(process.argv[2]) ? process.argv[3] === 'fila' : process.argv[2] === 'batch';
const registroDoApp = regras ?? (GRAVA_FILA ? await import(pathToFileURL(POOL_COMUM).href).catch(() => null) : null);
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
  let f = caminho(colecao, id);
  if (colecao === 'perguntas') f = arq.acharPergunta(caminho(colecao), id);
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

function gravar(colecao, id, data, version) {
  if (colecao === 'perguntas') return gravarPergunta(id, data, version);
  const dir = caminho(colecao);
  mkdirSync(dir, { recursive: true });
  gravarEm(caminho(colecao, id), id, data, version);
  return { id, version };
}
function gravarEm(f, id, data, version) {
  mkdirSync(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ id, version, data }, null, 2)}\n`);
  renameSync(tmp, f);
}
// F183: a pergunta vai para o lugar do estado dela (aberta/assumida na pasta quente, fechada no arquivo do projeto e do mês);
// a cópia de onde ela estava sai depois que a nova está gravada.
function gravarPergunta(id, data, version) {
  const dir = caminho('perguntas');
  const antes = arq.acharPergunta(dir, id);
  const destino = arq.lugarDe(dir, id, data);
  gravarEm(destino, id, data, version);
  if (antes && antes !== destino) rmSync(antes, { force: true });
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
// `item` (F470): parada de propósito esperando OUTRO item ou PR; a aba mostra Esperando com o texto e a batida não cobra.
const MOTIVOS_DA_ESPERA = ['operador', 'gate', 'item'];
const LOCAL_ID = /^local_[0-9a-f-]{36}$/;
// F439 (ADR 0030): o endereço da sessão é o `local_…` do app ou o `orca_session_id:<id>` do Orca; o formato mora em
// hooks/anfitriao.mjs. Sem o módulo (a cópia do script solta numa pasta sem `hooks/`), só o do app.
const {
  ehIdDeSessao = (v) => LOCAL_ID.test(String(v)), quemSou = () => null,
  ehDestinoDoOrca = (v) => typeof v === 'string' && /^(?:run|dispatch|orca_session_id):[A-Za-z0-9_-]+$/.test(v),
} = await import(pathToFileURL(join(HOOKS_DIR, 'anfitriao.mjs')).href).catch(() => ({}));
const NAO_E_SESSAO = 'não é local_<uuid> nem orca_session_id:<id>';
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
const MAX_FATIAS = 12;
const MAX_NOME_DA_FATIA = 60;

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
  // F423 (ADR 0027): o item fecha pelo merge do PR ligado a ele (o `mergear` da fila, ou a batida que vê o merge), nunca por
  // declaração. O item que não entrega PR sai por `descartado`, com o motivo no `agora`.
  // Criar um item já fechado (importação, fixture) passa; KIT_FECHAR_DECLARADO=1 é a escotilha dos testes que exercitam o fechamento.
  if (!viaCom && existia && novo.etapa === 'feito' && antes?.etapa !== 'feito' && process.env.KIT_FECHAR_DECLARADO !== '1') {
    throw new Error(`${chave}: "feito" não se declara: o item fecha sozinho quando o PR ligado a ele mergeia (a fila, ou a batida que vê o merge). Sem PR a entregar, use "etapa":"descartado" com o motivo no "agora"`);
  }
  // F472 (ADR 0034): o item fechado pelo merge não volta a `merge` sem PR novo, ligado no mesmo update: o `painel update` repetido
  // de antes do merge (o caso F455 de outro projeto) o reabria e o deixava em merge para sempre. Retomar o trabalho é `execucao`.
  if (!viaCom && existia && antes?.etapa === 'feito' && novo.etapa === 'merge') {
    const velhos = new Set(Array.isArray(antes.prs) ? antes.prs : []);
    const prNovo = (Array.isArray(novo.prs) ? novo.prs : []).some((n) => Number.isInteger(n) && n > 0 && !velhos.has(n));
    if (!prNovo) throw new Error(`${chave}: o item está "feito" (o PR dele já mergeou) e não volta a "merge" sem PR novo em "prs" no mesmo update (ex.: {"etapa":"merge","prs":[<o PR novo>]}); para retomar o trabalho, use "etapa":"execucao"`);
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
      if (!ehIdDeSessao(e.localId)) throw new Error(`${chave}: ${k}.localId "${e.localId}" ${NAO_E_SESSAO}`);
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
  if (tem('sessoes') && (!Array.isArray(novo.sessoes) || novo.sessoes.some((s) => !ehIdDeSessao(s)))) throw new Error(`${chave}: sessoes é uma lista de local_<uuid> ou orca_session_id:<id>`);
  if (tem('custo') && (typeof novo.custo !== 'object' || Array.isArray(novo.custo) || !Number.isFinite(novo.custo.relativo))) throw new Error(`${chave}: custo é {relativo, chamadas, …} (o \`painel custo\` e o \`mergear\` gravam)`);
  lista('fez', ['localId', 'apelido', 'oQue', 'em'], (e) => {
    if (typeof e.em !== 'string' || Number.isNaN(Date.parse(e.em))) throw new Error(`${chave}: fez.em "${e.em}" não é data ISO`);
  });
  if (!viaCom && 'fez' in novo && (op === 'update' || canonico(novo.fez) !== canonico(antes?.fez ?? []))) {
    throw new Error(`${chave}: o campo "fez" é histórico de item antigo: só leitura (o ${op} o apagaria ou o forjaria)`);
  }
  lista('passaram', ['localId', 'apelido', 'papel', 'em'], (e) => {
    if (typeof e.em !== 'string' || Number.isNaN(Date.parse(e.em))) throw new Error(`${chave}: passaram.em "${e.em}" não é data ISO`);
    if (!['P', 'D', 'E', 'V'].includes(e.papel)) throw new Error(`${chave}: passaram.papel "${e.papel}" não é P, D, E ou V`);
  });
  if (!viaCom && 'passaram' in novo && (op === 'update' || canonico(novo.passaram) !== canonico(antes?.passaram ?? []))) {
    throw new Error(`${chave}: o campo "passaram" é histórico de item antigo: só leitura (o ${op} o apagaria ou o forjaria)`);
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
  if (tem('maisFatias') && typeof novo.maisFatias !== 'boolean') throw new Error(`${chave}: maisFatias é true (o PR em merge não é a última fatia) ou false`);
  // F452: o plano das fatias, em nomes curtos, para a aba do kit mostrar "fatia k de m"; as feitas se deduzem dos PRs mergeados.
  if (tem('fatias')) {
    const f = novo.fatias;
    const ok = Array.isArray(f) && f.length >= 1 && f.length <= MAX_FATIAS
      && f.every((n) => textoNaoVazio(n) && n.trim().length <= MAX_NOME_DA_FATIA && !/\bF\d+\b|#\d+/.test(n));
    if (!ok) throw new Error(`${chave}: fatias é uma lista de 1 a ${MAX_FATIAS} nomes curtos (até ${MAX_NOME_DA_FATIA} caracteres, sem citar item nem PR), na ordem em que entram`);
  }
  if (tem('depois')) {
    const ok = Array.isArray(novo.depois) && novo.depois.every((d) => d && typeof d === 'object' && textoNaoVazio(d.texto) && (d.item === undefined || /^F\d+$/.test(String(d.item))));
    if (!ok) throw new Error(`${chave}: depois é uma lista de {texto, item?}, texto não vazio e item no formato F<n>`);
  }
  if (tem('entrega')) validarEntrega(chave, novo.entrega);
  if (tem('perguntas') && !(Array.isArray(novo.perguntas) && novo.perguntas.every((q) => /^Q\d+$/.test(String(q))))) {
    throw new Error(`${chave}: perguntas é uma lista de Q<n>`);
  }
  for (const k of ['resumo', 'agora', 'nota']) {
    if (tem(k) && typeof novo[k] !== 'string') throw new Error(`${chave}: ${k} é texto`);
  }
  for (const k of DONOS_ANTIGOS) {
    if (!tem(k)) continue;
    // F370: a recusa traz o comando pronto (handoff antigo ensina o campo velho), com o local_ quando o valor já era um
    const id = ehIdDeSessao(novo[k]) ? novo[k] : '<seu local_…>';
    const F = chave.replace(/^fila\//, '');
    throw new Error(`${chave}: o campo "${k}" saiu do contrato; use donoLocalId e donoApelido: painel update fila ${F} '{"donoLocalId":"${id}","donoApelido":"dona"}' (o local_ vem de get_session "self")`);
  }
  if (tem('donoLocalId') && !ehIdDeSessao(novo.donoLocalId)) {
    throw new Error(`${chave}: donoLocalId "${novo.donoLocalId}" ${NAO_E_SESSAO}`);
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

// F448 (ADR 0030, fatia 9): o endereço de entrega da resposta, gravado no nascimento da pergunta. No Orca é
// `endereco: {orca: <o --to do orca orchestration send>}`; a aba do kit no Orca entrega só nele (nunca pelo título da sessão
// nem pela orquestradora ativa). A pergunta que espera resposta (aberta, assumida) com `sessaoId` do Orca ganha o endereço
// dela; o explícito (`dispatch:`, `run:`) fica; o derivado acompanha a troca de `sessaoId`. Numa sessão do Orca, a pergunta
// que nasce (ou troca de sessaoId) esperando resposta sem endereço é recusada: a resposta dada na aba não teria aonde ir.
const ESPERA_ENTREGA = new Set(['aberta', 'assumida']);
const ESTADOS_DA_PERGUNTA = ['aberta', 'assumida', 'respondida', 'cancelada'];
const ehDoOrca = (v) => typeof v === 'string' && v.startsWith('orca_session_id:') && ehDestinoDoOrca(v);
function enderecoDaPergunta(chave, novo, base, antes) {
  if ('endereco' in novo && novo.endereco !== null) {
    const e = novo.endereco;
    const ok = e && typeof e === 'object' && !Array.isArray(e) && Object.keys(e).length === 1 && ehDestinoDoOrca(e.orca);
    if (!ok) throw new Error(`${chave}: endereco é {"orca": "<orca_session_id:…|dispatch:…|run:…>"} (o --to do orca orchestration send); veio ${JSON.stringify(e)}`);
  }
  const trocouSessao = 'sessaoId' in novo && novo.sessaoId !== antes?.sessaoId;
  if (trocouSessao && !('endereco' in novo) && antes?.endereco?.orca && antes.endereco.orca === antes.sessaoId) delete base.endereco;
  if (ESPERA_ENTREGA.has(base.estado) && !base.endereco && ehDoOrca(base.sessaoId)) base.endereco = { orca: base.sessaoId };
  // Recusa a pergunta que ENTRA em espera de entrega no Orca sem endereço: nasce, troca de sessaoId ou volta a aberta/assumida.
  const entraEmEspera = !antes || trocouSessao || !ESPERA_ENTREGA.has(antes.estado);
  if (entraEmEspera && ESPERA_ENTREGA.has(base.estado) && !base.endereco && ehDoOrca(quemSou())) {
    throw new Error(`${chave}: pergunta ${base.estado} numa sessão do Orca sem endereço de entrega — grave sessaoId = o seu orca_session_id:… (ou endereco: {"orca": "dispatch:…"}); com sessaoId ${JSON.stringify(base.sessaoId ?? null)} a resposta dada na aba do kit não teria aonde ir`);
  }
}

// Cartão de sessão dona que espera o clique do operador (a coleção `cartoes`; id = o task_id do start_session): apelido e papel
// `dona`, exatamente um item; a sessão aberta se chama `F<n> · <tema>`.
// `propostoEm` é do painel: ausente vira agora; no futuro (além de 5 min de folga de relógio) a hora escrita à mão estava
// errada e também vira agora, com aviso. Data que não é ISO segue para a validação recusar.
const FOLGA_PROPOSTO_MS = 5 * 60_000;
function corrigirPropostoEm(chave, c) {
  const agora = Date.now();
  if (c.propostoEm === undefined || c.propostoEm === null || c.propostoEm === '') c.propostoEm = new Date(agora).toISOString();
  else if (Date.parse(c.propostoEm) > agora + FOLGA_PROPOSTO_MS) {
    process.stderr.write(`aviso: ${chave}: propostoEm ${c.propostoEm} está no futuro; gravei agora (o painel preenche o campo, não precisa escrevê-lo)\n`);
    c.propostoEm = new Date(agora).toISOString();
  }
}

function validarCartao(chave, c) {
  for (const k of ['projeto', 'orquestradoraId']) if (!textoNaoVazio(c[k])) throw new Error(`${chave}: ${k} é obrigatório`);
  if (c.apelido !== 'dona') throw new Error(`${chave}: apelido "${c.apelido}" não é dona`);
  if (c.papel !== 'dona') throw new Error(`${chave}: papel "${c.papel}" não é dona`);
  if (!Array.isArray(c.itens) || c.itens.length !== 1 || !ID.test(String(c.itens[0])) || !/^F\d+$/.test(String(c.itens[0]))) throw new Error(`${chave}: o cartão de dona leva exatamente um item F<n> em itens`);
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
  // F478: o estado da pergunta é um dos que a tela mostra ou arquiva; outro some de todo mundo. Vale para o que esta op
  // grava (o campo veio nela, ou o documento nasce agora): o documento antigo fora do contrato segue aceitando os demais campos.
  // Sem estado nenhum é rascunho (ninguém espera por ele): segue aceito, como antes.
  if (colecao === 'perguntas' && base.estado !== undefined && ('estado' in novo || !existia) && !ESTADOS_DA_PERGUNTA.includes(base.estado)) {
    throw new Error(`${chave}: estado ${JSON.stringify(base.estado ?? null)} fora do contrato (${ESTADOS_DA_PERGUNTA.join(' · ')}); com outro, a pergunta não aparece a ninguém`);
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

// F404 (ADR 0024): a entrega do item é o que o operador vê do que saiu (pane, `painel entregas`, desfechos.log).
const CAMPOS_DA_ENTREGA = ['resultado', 'medido', 'naoMedido', 'proximos'];
function validarEntrega(chave, e) {
  const forma = `${chave}: entrega é {resultado, medido?, naoMedido?, proximos?}`;
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error(forma);
  const estranho = Object.keys(e).find((k) => !CAMPOS_DA_ENTREGA.includes(k));
  if (estranho) throw new Error(`${forma}; "${estranho}" não é campo dela`);
  if (!textoNaoVazio(e.resultado)) throw new Error(`${chave}: entrega.resultado é o que mudou para quem usa, texto não vazio`);
  for (const k of ['medido', 'naoMedido']) if (k in e && typeof e[k] !== 'string') throw new Error(`${chave}: entrega.${k} é texto`);
  if ('proximos' in e && !(Array.isArray(e.proximos) && e.proximos.every(textoNaoVazio))) throw new Error(`${chave}: entrega.proximos é uma lista de texto não vazio`);
}

// F370: o item que fecha guarda a dona e o `com` em `donaAoFechar`; reaberto sem dona nova no mesmo update, volta com eles (o
// item fechado por engano, como o PR só da SPEC sem `maisFatias`, não vira "sem dona" na batida). Só o painel grava o campo.
function lembrarDona(chave, novo, base, antes, viaCom) {
  // regravar o valor lido (o `get` seguido de `set --se-versao`) passa; trocar, não. O `set` sem o campo o guarda.
  if ('donaAoFechar' in novo && !viaCom && canonico(novo.donaAoFechar) !== canonico(antes?.donaAoFechar ?? null)) throw new Error(`${chave}: donaAoFechar só o painel grava (ao fechar o item)`);
  if (!('donaAoFechar' in novo) && antes?.donaAoFechar && ETAPAS_FINAIS.has(antes.etapa)) base.donaAoFechar = antes.donaAoFechar;
  const final = ETAPAS_FINAIS.has(base.etapa);
  const eraFinal = ETAPAS_FINAIS.has(antes?.etapa);
  if (final && !eraFinal && textoNaoVazio(antes?.donoLocalId)) {
    base.donaAoFechar = { donoLocalId: antes.donoLocalId, donoApelido: antes.donoApelido ?? null, com: Array.isArray(antes.com) ? antes.com : [] };
    return;
  }
  if (final || !eraFinal) return;
  const lembranca = base.donaAoFechar;
  delete base.donaAoFechar;
  if (!lembranca || 'donoLocalId' in novo || 'donoApelido' in novo || textoNaoVazio(base.donoLocalId)) return;
  // a orquestradora arquiva a dona do item fechado: quem o registro do app diz arquivada não volta (o item vira vaga na hora)
  const viva = (id) => { try { return registroDoApp?.registroDaSessao(id, { fresco: true })?.arquivada !== true; } catch { return true; } };
  if (ehIdDeSessao(lembranca.donoLocalId) && textoNaoVazio(lembranca.donoApelido) && viva(lembranca.donoLocalId)) {
    base.donoLocalId = lembranca.donoLocalId;
    base.donoApelido = lembranca.donoApelido;
  }
  const com = Array.isArray(lembranca.com) ? lembranca.com.filter((x) => ehIdDeSessao(x?.localId) && viva(x.localId)) : [];
  if (com.length && !(Array.isArray(base.com) && base.com.length)) base.com = com;
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
  // F404: a entrega descreve o que fechou; o item reaberto entrega de novo (salvo a que vem no próprio update)
  if (!final && eraFinal && !('entrega' in novo)) delete base.entrega;
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
  if (colecao === 'perguntas') enderecoDaPergunta(chave, novo, base, op === 'update' ? atual?.data : null);
  if (colecao === 'fila') lembrarDona(chave, novo, base, atual?.data, viaCom);
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.com) && atual.data.com.length) base.com = atual.data.com;
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.fez)) base.fez = atual.data.fez;
  if (colecao === 'fila' && op === 'set' && !viaCom && Array.isArray(atual?.data?.passaram)) base.passaram = atual.data.passaram;
  if ((colecao === 'sessoes' || colecao === 'fila' || colecao === 'perguntas') && !base.projeto && (op === 'set' || !atual)) {
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
  // F183: projeto num nome só. Vale para o que esta op grava (o campo veio nela, ou o documento nasce agora); o antigo a migração conserta.
  if (base.projeto !== undefined && ('projeto' in novo || !atual) && !arq.SLUG.test(String(base.projeto))) {
    const sugestao = arq.slugDoProjeto(base.projeto);
    throw new Error(`${chave}: projeto "${base.projeto}" fora do padrão (minúsculas, números e traço)${sugestao ? `; use "${sugestao}"` : ''}`);
  }
  if (!('atualizadoEm' in novo)) base.atualizadoEm = new Date().toISOString();
  if (colecao === 'cartoes') corrigirPropostoEm(chave, base);
  validarPadrao(colecao, id, novo, base, vista, op, !!atual, viaCom, atual?.data);
  const semente = colecao === 'fila' ? sementePendente : null;
  const transicao = colecao === 'fila' ? automaticosDaFila(base, novo, atual?.data) : {};
  const version = (atual?.version ?? 0) + 1;
  vista.set(chave, { id, version, data: base });
  return { colecao, id, data: base, version, semente, ...transicao };
}

function efetivar(p) {
  if (p.apagar) {
    if (p.colecao !== 'perguntas') rmSync(caminho(p.colecao, p.id), { force: true });
    else {
      // uma corrida com o pane pode deixar duas cópias (pasta quente e arquivo): o delete leva todas
      let f;
      while ((f = arq.acharPergunta(caminho('perguntas'), p.id))) rmSync(f, { force: true });
    }
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
function pausa(nome) { // nome = sufixo (PAUSA_MS…): vale PAINEL_<nome>
  const n = Number(process.env[`PAINEL_${nome}`]);
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

// A orquestradora abre a dona e pode passar o próprio id no lugar do dela: `com add` recusa o id de sessão `🎛 orquestradora`.
function conferirQuemTrabalha(localId, onde) {
  let reg = null;
  try { reg = regras?.registroDaSessao(localId, { fresco: true }) ?? null; } catch { /* sem registro */ }
  const titulo = reg?.titulo ?? reg?.title;
  if (titulo?.startsWith('🎛 orquestradora')) throw new Error(`${onde}: ${localId} é a sessão "${titulo}", não a dona do item; o id da dona sai do start_session (para si: $CLAUDE_CODE_HOST_SESSION_ID)`);
}

// `com add|del`: lê, muda e grava a lista dentro da trava do painel; é a única via que grava `com`.
function comandoCom(args) {
  const [sub, F, quem0, ...resto] = args;
  let localId = quem0;
  if (sub !== 'add' && sub !== 'del') throw new Error('uso: painel.mjs com add <F> <local_> <apelido> "<oQue>" | com del <F> <local_|apelido>');
  if (!ID.test(String(F))) throw new Error(`com: id de item inválido "${F}"`);
  // `com del` também aceita o apelido: resolvido no `com` do item, dentro da trava
  const porApelido = sub === 'del' && !ehIdDeSessao(quem0) && textoNaoVazio(quem0) && !/^(local_|orca_session_id:)/.test(String(quem0));
  if (!porApelido && !ehIdDeSessao(localId)) throw new Error(`com: "${localId}" ${NAO_E_SESSAO}`);
  if (sub === 'del' && resto.length) throw new Error('uso: painel.mjs com del <F> <local_|apelido>');
  if (sub === 'add') conferirQuemTrabalha(localId, 'com add');
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
      // F348: quem passou pelo `com` conta no custo do item, mesmo que saia antes do merge
      const sessoes = Array.isArray(atual.data.sessoes) ? atual.data.sessoes : [];
      if (!sessoes.includes(localId)) data.sessoes = [...sessoes, localId];
    } else {
      if (!com.some((c) => c.localId === localId)) throw new Error(`com del: ${localId} não está em com de ${F}`);
      nova = com.filter((c) => c.localId !== localId);
    }
    data.com = nova;
    const p = planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map());
    return efetivar(p);
  });
}

// `soltar <F> "<motivo>"`: o único caminho para devolver um item à fila sem dono (a batida o usa com o item cuja dona sumiu).
// Grava pela via do `com` (zera o `com`) dentro da trava.
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

// ---- batida ----
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

function medirCusto(d) {
  if (!d) return null;
  try {
    const c = custoDoItem(sessoesDoItem(d), { registro: (id) => regras?.registroDaSessao?.(id, { fresco: true }) ?? null });
    return c.sessoes.lidas > 0 ? c : null; // nenhum transcript lido: zero não medido não vira número
  } catch { return null; }
}

// F404: `HH:MM` é a hora de São Paulo de hoje (a de ontem, se ainda não chegou); o resto, data ISO.
function horaDoCorte(v, agora = Date.now()) {
  const hm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(v));
  if (!hm) {
    const t = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? Date.parse(v) : NaN;
    if (Number.isNaN(t)) throw new Error(`entregas: --desde "${v}" não é HH:MM (São Paulo) nem data ISO`);
    return t;
  }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(agora).map((x) => [x.type, x.value]));
  const desvio = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(agora / 60_000) * 60_000;
  const t = Date.UTC(+p.year, +p.month - 1, +p.day, Number(hm[1]), Number(hm[2])) - desvio;
  return t > agora ? t - 86_400_000 : t;
}

// `entregas [--desde <HH:MM|ISO>] [--projeto <nome> | --todos]` (F404): os itens feitos desde a hora (padrão: 24 h), com a entrega.
function comandoEntregas(args) {
  const todos = flag(args, '--todos', false);
  const desdeArg = flag(args, '--desde');
  const projetoArg = flag(args, '--projeto');
  if (args.length) throw new Error('uso: painel.mjs entregas [--desde <HH:MM|ISO>] [--projeto <nome> | --todos]');
  const projeto = todos ? null : (projetoArg ? projetoArg.toLowerCase() : projetoDoCwd().projeto);
  if (!todos && !projeto) throw new Error('entregas: não achei o projeto (rode dentro do repositório, ou passe --projeto <nome> ou --todos)');
  const desde = desdeArg ? horaDoCorte(desdeArg) : Date.now() - 86_400_000;
  const itens = [...itensDaFila()]
    .filter(([, d]) => d?.etapa === 'feito' && Date.parse(d.feitoEm) >= desde)
    .filter(([, d]) => todos || String(d?.projeto ?? '').toLowerCase() === projeto)
    .sort(([, a], [, b]) => Date.parse(b.feitoEm) - Date.parse(a.feitoEm))
    .map(([id, d]) => ({ id, titulo: d.titulo ?? null, projeto: d.projeto ?? null, feitoEm: d.feitoEm, prs: Array.isArray(d.prs) ? d.prs : [], entrega: d.entrega ?? null }));
  return { desde: new Date(desde).toISOString(), projeto: todos ? null : projeto, itens, semEntrega: itens.filter((i) => !i.entrega).map((i) => i.id) };
}

// `custo <F> [--seco]` (F348): mede de novo o custo de um item (o `mergear` mede ao fechar). Mede fora da trava, grava dentro.
function comandoCusto(args) {
  const seco = flag(args, '--seco', false);
  const [F, ...sobra] = args;
  if (!ID.test(String(F)) || sobra.length) throw new Error('uso: painel.mjs custo <F> [--seco]');
  const atual = ler('fila', F);
  if (!atual) throw new Error(`fila/${F} não existe`);
  const custo = medirCusto(atual.data);
  if (!custo) throw new Error(`custo: não achei transcript de nenhuma sessão de ${F} nesta máquina`);
  if (seco) return { item: F, seco: true, custo };
  comTrava(() => efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data: { custo }, [VIA_COM]: true }, undefined, new Map())));
  return { item: F, custo };
}

// O item que fecha pelo merge (o `mergear` e a batida, F423): a dona e o `com` saem do item, mas ficam em `sessoes` (o
// `painel custo` mede de novo pelas mesmas sessões, F348).
const dadosDoFechamento = (d, agora, custo) => ({ etapa: 'feito', donoLocalId: null, donoApelido: null, com: [], sessoes: [...new Set(sessoesDoItem(d).filter((s) => ehIdDeSessao(s)))], agora, ...(custo ? { custo } : {}) });

// `mergear <PR> <sha> [--seco]`. O GitHub fica FORA da trava (é lento); a escrita no painel, dentro dela.
function comandoMergear(args) {
  const seco = flag(args, '--seco', false);
  const [prTexto, sha, ...sobra] = args;
  const uso = 'uso: painel.mjs mergear <PR> <sha de 7 a 40 hex> [--seco]';
  if (!/^[1-9]\d*$/.test(String(prTexto)) || !SHA_VALIDADO.test(String(sha)) || sobra.length) throw new Error(uso);
  const pr = Number(prTexto);
  const c = conferir(pr, sha, process.cwd());
  if (c.recusado) return c;
  const { projeto } = projetoDoCwd();
  // F222: com todos os PRs MERGED, o item fecha, salvo `maisFatias: true` (a dona ainda entrega outra fatia): aí volta a
  // `execucao` com a dona e o `com`. A marca fica até a dona tirá-la ao abrir o PR da última fatia.
  const doPr = () => [...itensVivos()].filter(([, d]) => projeto && String(d?.projeto ?? '').toLowerCase() === projeto && Array.isArray(d.prs) && d.prs.includes(pr)).map(([F, d]) => ({ F, prs: d.prs, fatia: d.maisFatias === true }));
  const decidir = () => doPr().map(({ F, prs, fatia }) => {
    const todos = prs.filter((n) => n !== pr).every((n) => estadoDoPr(n, process.cwd()) === 'MERGED');
    return { F, fecha: todos && !fatia, fatia: todos && fatia };
  });
  if (seco) return { seco: true, mergearia: { pr, sha: c.sha, base: c.base }, ...(c.aviso ? { aviso: c.aviso } : {}), itens: decidir().map(({ F, fecha, fatia }) => ({ item: F, fecharia: fecha, ...(fatia ? { fatia } : {}) })) };
  mergearNoGitHub(pr, c.sha, process.cwd());
  const decisoes = decidir();
  const curto = c.sha.slice(0, 7);
  // F348: o custo se mede fora da trava (lê transcripts) e só no item que fecha; a falha não segura o merge
  const custos = new Map(decisoes.filter((x) => x.fecha).map(({ F }) => [F, medirCusto(ler('fila', F)?.data)]));
  const itens = comTrava(() => decisoes.map(({ F, fecha, fatia }) => {
    const atual = ler('fila', F);
    if (!atual || ETAPAS_FINAIS.has(atual.data?.etapa)) return { item: F, fechado: false, agora: null };
    let data;
    // F348: a dona e o `com` saem do item, mas ficam em `sessoes` (o `painel custo` mede de novo pelas mesmas sessões)
    if (fecha) data = dadosDoFechamento(atual.data, `mergeado, ponta ${curto}`, custos.get(F));
    // F404: a entrega de uma fatia sai, para a trava cobrar a do PR que fecha o item
    else if (fatia) data = { etapa: 'execucao', agora: `fatia mergeada (PR ${pr}, ponta ${curto}); a dona segue com a próxima`, entrega: null };
    else data = { com: [], agora: 'um PR entrou; falta outro' };
    efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data, [VIA_COM]: true }, undefined, new Map()));
    // a fatia volta à dona, que parou ao abrir o PR. F370: o aviso se grava no estado da fila agora, e a batida o entrega;
    // a saída da fila da orquestradora (ou o desfecho da sem turno) só chega no fim de todas as rodadas
    const dona = fatia ? atual.data.donoLocalId ?? null : null;
    let avisoGravado = false;
    // com a batida desligada ninguém entregaria o aviso: a orquestradora avisa pela saída, como antes
    if (dona && process.env.BATIDA !== 'off') {
      try { gravarAviso(projeto, { tipo: 'fatia', pr, item: F, dona }); avisoGravado = true; } catch (e) { process.stderr.write(`painel.mjs: aviso: não gravei o aviso de fatia de ${F} (${e?.message || e}); avise a dona\n`); }
    }
    return { item: F, fechado: fecha, ...(fatia ? { fatia, dona } : {}), ...(avisoGravado ? { avisoGravado } : {}), ...(data.custo ? { custo: data.custo.relativo } : {}), ...(fecha && textoNaoVazio(atual.data.entrega?.resultado) ? { entrega: atual.data.entrega.resultado } : {}), agora: data.agora };
  }));
  return { mergeado: true, pr, sha: c.sha, base: c.base, ...(c.aviso ? { aviso: c.aviso } : {}), itens };
}

// `fila-de-merge <PR…>` (ADR 0011). Monta e testa fora da trava (é lento); cada merge segue o `mergear`; a devolução grava o item.
// Lote pela fila ocupada (F182): `<BASE>/../fila-de-merge/<projeto>.json` guarda {ocupada:{pid,desde}|null,
// pendentes:[{pr,sha?}], emVoo:[{pr,sha?}]}. Com a fila ocupada por um processo vivo, a chamada só anota os PRs em `pendentes`
// e sai; quem roda, ao terminar a rodada, leva a lista inteira como o lote seguinte, até esvaziar. `emVoo` é o lote da rodada
// que roda: ocupada por processo morto (ou por pid reciclado, F220: fila-orfa.mjs), a chamada nova assume e leva o `emVoo` e os pendentes antes dos seus. Falha de um PR
// (fechado, ponta mudou) só o tira do lote; PR que o gh não leu volta aos pendentes para a próxima chamada (`releitura`), até
// LEITURAS_DA_FILA tentativas; PR de outra base fica para a rodada seguinte; erro da rodada inteira (preparo, git) não volta à
// lista: sai no erro com os PRs que não rodaram e os que ficaram na fila. `--seco` não usa nem mexe na lista.
const LEITURAS_DA_FILA = 3;
const ESTADO_DA_FILA = (projeto) => join(BASE, '..', 'fila-de-merge', `${projeto || 'sem-projeto'}.json`);
// F370: o PR só de documentação (ex.: a SPEC) num item sem `maisFatias: true` fecha o item no merge, e a dona é arquivada
// com o código por fazer. O `--anotar` avisa (não recusa: o item só de doc fecha mesmo). → texto do aviso ou null
function avisoSemCodigo(prs, projeto, cwd) {
  if (!projeto) return null;
  const itens = [...itensVivos()].filter(([, d]) => String(d?.projeto ?? '').toLowerCase() === projeto && d.maisFatias !== true && Array.isArray(d.prs));
  const partes = [];
  for (const pr of prs) {
    const meus = itens.filter(([, d]) => d.prs.includes(pr)).map(([F]) => F);
    if (!meus.length || !soDocumentacao(arquivosDoPr(pr, cwd))) continue;
    partes.push(`${meus.join(', ')}: o PR ${pr} só muda documentação e o merge fecha o item`);
  }
  return partes.length ? `${partes.join('; ')}: se o item ainda tem código a entregar, grave "maisFatias":true no item antes do merge (painel update fila <F> '{"maisFatias":true}')` : null;
}

// F404 (ADR 0024): o PR que fecha o item (sem `maisFatias: true`) e o item sem `entrega.resultado`: avisa, sem recusar.
function avisoSemEntrega(prs, projeto) {
  if (!projeto) return null;
  const faltam = [...itensVivos()]
    .filter(([, d]) => String(d?.projeto ?? '').toLowerCase() === projeto && d.maisFatias !== true && Array.isArray(d.prs) && prs.some((p) => d.prs.includes(p)))
    .filter(([, d]) => !textoNaoVazio(d.entrega?.resultado))
    .map(([F]) => F);
  if (!faltam.length) return null;
  return `${faltam.join(', ')}: o PR fecha o item e ele está sem a entrega, que é o que o operador vê do que saiu. Grave antes do merge: ${faltam.map((F) => `painel update fila ${F} '{"entrega":{"resultado":"…","medido":"…","naoMedido":"…","proximos":["…"]}}'`).join(' · ')}`;
}

// F370: avisos à dona gravados no estado da fila do projeto ({tipo, pr, item, dona, em}); a batida os entrega e os tira.
// Chame dentro da trava.
function gravarAviso(projeto, aviso) {
  const arquivo = ESTADO_DA_FILA(projeto);
  const e = arquivoJson(arquivo, {});
  const base = e && typeof e === 'object' ? e : {};
  gravarJson(arquivo, { ...base, avisos: [...(Array.isArray(base.avisos) ? base.avisos : []), { ...aviso, em: new Date().toISOString() }] });
}
// junta `novos` ao fim de `lista` sem repetir o PR (o sha mais novo vale)
function juntarPedidos(lista, novos) {
  const r = lista.map((p) => ({ ...p }));
  for (const n of novos) {
    const i = r.findIndex((p) => p.pr === n.pr);
    if (i < 0) r.push({ ...n });
    else if (n.sha) r[i] = { ...r[i], sha: n.sha };
  }
  return r;
}

// F221: a dona que abre um PR novo sem pô-lo em `prs` deixava o item fora da fila (em `execucao`, com a sessão ociosa, que o
// pane lê como parada). O PR se liga ao item vivo do projeto pelo `prs`, pelo campo `branch` do item ou pela branch do worktree
// da sessão dona; o item ligado ganha o PR em `prs` e fica em `merge` até a fila mergear ou devolver. Sem `espera`: o item
// em `merge` que a fila largou (erro da rodada, PR mergeado por fora) segue aparecendo na batida como merge parado.
// A branch só liga quando aponta um item só (duas donas no mesmo cwd, ou a dona com outro item vivo, não ligam nenhum).
function branchDaDona(localId) {
  let cwd = null;
  try { cwd = regras?.registroDaSessao(localId)?.cwd ?? null; } catch { return null; }
  if (!cwd || !existsSync(cwd)) return null;
  try {
    const b = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8', timeout: Number(process.env.KIT_GIT_TIMEOUT_MS) || 10000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return b && b !== 'HEAD' ? b : null;
  } catch { return null; }
}
// branches: Map pr → headRefName (null: só pelo `prs`). Fora da trava lê as branches das donas (git); dentro, relê e grava.
// → { ligados: [{pr, item}], ambiguos: [pr] }
// pular: itens que esta chamada já devolveu (a rodada seguinte não os põe de volta em `merge` por outro PR deles).
function ligarPrsAosItens(branches, { projeto, oQue, pular = new Set() }) {
  if (!projeto || !branches.size) return { ligados: [], ambiguos: [] };
  const doProjeto = (d) => String(d?.projeto ?? '').toLowerCase() === projeto;
  const daDona = new Map();
  if ([...branches.values()].some(Boolean)) {
    for (const [, d] of itensVivos()) if (doProjeto(d) && d.donoLocalId && !daDona.has(d.donoLocalId)) daDona.set(d.donoLocalId, branchDaDona(d.donoLocalId));
  }
  return comTrava(() => {
    const vivos = [...itensVivos()].filter(([F, d]) => doProjeto(d) && !pular.has(F));
    const prsDe = (d) => (Array.isArray(d.prs) ? d.prs : []);
    const pelaBranch = (d, b) => Boolean(b) && (d.branch === b || (Boolean(d.donoLocalId) && daDona.get(d.donoLocalId) === b));
    const porItem = new Map();
    const ambiguos = [];
    for (const [pr, b] of branches) {
      const pelosPrs = vivos.filter(([, d]) => prsDe(d).includes(pr));
      // o campo `branch` do item é o sinal explícito: desempata o worktree da dona
      const explicitos = b ? vivos.filter(([, d]) => d.branch === b) : [];
      const daDonaNaBranch = pelosPrs.length || explicitos.length === 1 ? [] : vivos.filter(([, d]) => pelaBranch(d, b));
      // F446: sem `prs` nem branch de dona, o item do primeiro id da branch (a dona que abre o PR num worktree ao lado)
      const peloId = b && !pelosPrs.length && explicitos.length !== 1 && !daDonaNaBranch.length ? vivos.filter(([F]) => F.toUpperCase() === primeiroId(b)) : [];
      const casados = pelosPrs.length ? pelosPrs : explicitos.length === 1 ? explicitos : daDonaNaBranch.length ? daDonaNaBranch : peloId;
      if (!pelosPrs.length && casados.length > 1) { ambiguos.push(pr); continue; }
      for (const [F] of casados) porItem.set(F, [...(porItem.get(F) ?? []), pr]);
    }
    const ligados = [];
    for (const [F, meus] of porItem) {
      const d = vivos.find(([id]) => id === F)[1];
      const prs = prsDe(d);
      const lista = meus.map((n) => `PR ${n}`).join(', ');
      try {
        efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data: { prs: [...prs, ...meus.filter((n) => !prs.includes(n))], etapa: 'merge', agora: `${lista} na fila de merge: ${oQue}` } }, undefined, new Map()));
        ligados.push(...meus.map((pr) => ({ pr, item: F })));
      } catch (e) { process.stderr.write(`painel.mjs: aviso: fila-de-merge não ligou ${lista} ao ${F} (${String(e?.message || e).split('\n')[0]})\n`); }
    }
    return { ligados, ambiguos };
  });
}
const ligarComAviso = (branches, opcoes) => {
  try {
    const r = ligarPrsAosItens(branches, opcoes);
    if (r.ambiguos.length) process.stderr.write(`painel.mjs: aviso: fila-de-merge: a branch de ${r.ambiguos.map((n) => `#${n}`).join(', ')} aponta mais de um item; nenhum foi ligado (grave o PR em prs do item)\n`);
    return r;
  } catch (e) {
    process.stderr.write(`painel.mjs: aviso: fila-de-merge não ligou os PRs aos itens (${String(e?.message || e).split('\n')[0]})\n`);
    return { ligados: [], ambiguos: [] };
  }
};

// F351: `--anotar` (a dona, com o sha que entrega) só põe os PRs nos pendentes e grava a pasta do repositório; a batida lança a
// fila com `--sem-turno` quando ninguém a roda, e essa rodada grava o desfecho no estado (`desfechos`) para a batida entregar.
// O `config` ({cwd, gate, preparar}) vem da última rodada que a orquestradora chamou: sem ele a batida não lança (não sabe o gate).
function comandoFilaDeMerge(args) {
  const semTurno = flag(args, '--sem-turno', false);
  if (!semTurno) return filaDeMerge(args);
  const arquivo = ESTADO_DA_FILA(projetoDoCwd().projeto);
  const desfecho = (d) => comTrava(() => {
    const e = arquivoJson(arquivo, {});
    gravarJson(arquivo, { ...e, desfechos: [...(Array.isArray(e?.desfechos) ? e.desfechos : []), { em: new Date().toISOString(), ...d }] });
  });
  // F373 (fatia 3): o desfecho sai antes do pós-merge, marcado `pendente` (a dona do devolvido é avisada já); o resultado entra
  // depois no mesmo desfecho, pelo `id`. Se o processo morrer no meio, a batida acha o pendente velho e acorda a orquestradora.
  const completar = (id, posMerge) => comTrava(() => {
    const e = arquivoJson(arquivo, {});
    const lista = Array.isArray(e?.desfechos) ? e.desfechos : [];
    if (lista.some((d) => d?.id === id)) gravarJson(arquivo, { ...e, desfechos: lista.map((d) => (d?.id === id ? { ...d, posMerge } : d)) });
    else gravarJson(arquivo, { ...e, desfechos: [...lista, { em: new Date().toISOString(), id, mergeados: [], devolvidos: [], posMerge }] });
  });
  let saida;
  try { saida = filaDeMerge(args, { semTurno }); } catch (e) {
    try { desfecho({ erro: String(e?.message || e).split('\n')[0] }); } catch { /* o erro segue no log da batida */ }
    throw e;
  }
  // F446: a pausa por release sem merge nem devolução não é desfecho (a batida o mandaria à orquestradora a cada relance)
  const soPausa = saida.pausa && !(saida.mergeados?.length || saida.devolvidos?.length || saida.erros?.length);
  if (!saida.pendente && !soPausa) {
    const { mergeados = [], devolvidos = [], suspeitaDeInstavel, infraRepetida, erros, logs } = saida;
    // F373 (fatia 3): com merge, o pós-merge (versão, plugins, giro do estado) roda aqui, sem turno da orquestradora
    const comPos = mergeados.length > 0 && process.env.KIT_POS_MERGE !== 'off';
    const id = randomBytes(6).toString('hex');
    desfecho({ id, mergeados, devolvidos, ...(suspeitaDeInstavel ? { suspeitaDeInstavel } : {}), ...(infraRepetida ? { infraRepetida } : {}), ...(erros ? { erros } : {}), ...(logs ? { logs } : {}), ...(comPos ? { posMerge: { pendente: true, desde: new Date().toISOString() } } : {}) });
    if (comPos) {
      let pos;
      try {
        const raiz = raizDoRepo();
        pos = posMerge({ cwd: raiz, base: saida.base || 'main', nomes: [basename(raiz), projetoDoCwd().projeto], pastaOrq: join(BASE, '..') });
      } catch (e) { pos = { erros: [`pos-merge: ${String(e?.message || e).split('\n')[0]}`] }; }
      // a batida segura a mesma trava durante a rodada dela: o `comTrava` desiste em ~5 s, então tenta de novo antes de perder o resultado
      for (let i = 0; i < 6; i++) {
        try { completar(id, pos); break; } catch (e) {
          if (i === 5) process.stderr.write(`fila-de-merge: não gravei o pós-merge no desfecho: ${e?.message || e}\n`);
        }
      }
    }
  }
  return saida;
}

function filaDeMerge(args, { semTurno = false } = {}) {
  const seco = flag(args, '--seco', false);
  const anotar = flag(args, '--anotar', false);
  const gateDado = flag(args, '--gate');
  const prepararDado = flag(args, '--preparar');
  // F398: `--falha-de-infra "<padrão>"` (repetível; `nenhuma` desliga) e `--espera-de-infra <s>` trocam os do `config`
  const infraDada = [];
  for (let v = flag(args, '--falha-de-infra'); v !== null; v = flag(args, '--falha-de-infra')) infraDada.push(v);
  const esperaDada = flag(args, '--espera-de-infra');
  const uso = 'uso: painel.mjs fila-de-merge <PR[:sha]> [<PR[:sha]>…] [--gate "<cmd>"] [--preparar "<cmd>"] [--falha-de-infra "<padrão>"…|nenhuma] [--espera-de-infra <s>] [--seco] | <PR:sha>… --anotar';
  if (esperaDada !== null && !/^\d+$/.test(esperaDada)) throw new Error(`fila-de-merge: --espera-de-infra pede segundos inteiros; ${uso}`);
  if (infraDada.length > 1 && infraDada.some((v) => v.trim().toLowerCase() === 'nenhuma')) throw new Error(`fila-de-merge: --falha-de-infra nenhuma não se junta a outros padrões; ${uso}`);
  if (anotar && (seco || gateDado || prepararDado || infraDada.length || esperaDada !== null)) throw new Error(`fila-de-merge: --anotar não roda nada (o gate é o da fila do projeto); ${uso}`);
  // `N:sha` é o sha do recado "PR N pronto, HEAD <sha>": a ponta que mudou depois dele é recusada, como no `mergear` (F150).
  const casados = args.map((a) => /^([1-9]\d*)(?::([0-9a-f]{7,40}))?$/i.exec(String(a)));
  if (!args.length || casados.some((m) => !m)) throw new Error(uso);
  const pedidos = juntarPedidos([], casados.map(([, n, sha]) => (sha ? { pr: Number(n), sha: sha.toLowerCase() } : { pr: Number(n) })));
  // a fila sem turno só leva o PR com o sha que a dona testou: sem ele, ninguém diria qual ponta mergear
  if (anotar && pedidos.some((p) => !p.sha)) throw new Error(`fila-de-merge --anotar: cada PR leva o sha que você testou (<PR>:<sha>); ${uso}`);
  const cwd = process.cwd();
  const arquivo = seco ? null : ESTADO_DA_FILA(projetoDoCwd(cwd).projeto);
  // F396: sem `--gate`, vale o par gravado no `config` da fila do projeto (o relance depois da limpeza de contexto vinha só com
  // os PRs e rodava o padrão, medido no WiControl em 04/11); o `--gate` dado sem `--preparar` segue sem preparo. O padrão fica
  // para a fila que nunca gravou gate.
  const gravado = (() => { const c = arquivoJson(ESTADO_DA_FILA(projetoDoCwd(cwd).projeto), {})?.config; return c && typeof c === 'object' ? c : {}; })();
  const doConfig = !gateDado && textoNaoVazio(gravado.gate);
  const gate = gateDado ?? (doConfig ? gravado.gate : GATE_PADRAO);
  const preparar = prepararDado ?? (doConfig && textoNaoVazio(gravado.preparar) ? gravado.preparar : null);
  // F398: o dado vale sobre o gravado; sem nenhum dos dois, os de fábrica
  const falhaDeInfra = infraDada.length ? (infraDada[0].trim().toLowerCase() === 'nenhuma' ? [] : infraDada) : padroesDeInfra(gravado.falhaDeInfra);
  const esperaDeInfra = esperaDada !== null ? Number(esperaDada) : (Number.isInteger(gravado.esperaDeInfra) && gravado.esperaDeInfra >= 0 ? gravado.esperaDeInfra : ESPERA_DE_INFRA_S);
  const infraDoConfig = { ...(infraDada.length ? { falhaDeInfra } : {}), ...(esperaDada !== null ? { esperaDeInfra } : {}) };
  const lista = (v) => (Array.isArray(v) ? v : []);
  // os outros campos do estado (config, desfechos, lancada) passam intactos por toda gravação
  const lerEstado = () => { const e = arquivoJson(arquivo, {}); return { ...(e && typeof e === 'object' ? e : {}), ocupada: e?.ocupada ?? null, pendentes: lista(e?.pendentes), emVoo: lista(e?.emVoo) }; };
  // o PR pedido agora tem de existir e estar aberto (erro de quem pediu, como antes); o resto se confere na rodada.
  // F220: o PR que já está anotado na fila (o relance da fila órfã repete a lista inteira) e fechou no meio tempo não
  // derruba a chamada: a rodada o tira da fila, como faz com o pendente que fechou.
  const naFila = new Set(seco ? [] : (() => { const e = lerEstado(); return [...e.emVoo, ...e.pendentes].map((p) => p?.pr); })());
  const branches = new Map();
  for (const { pr } of pedidos) {
    const v = dadosDoPr(pr, cwd);
    branches.set(pr, typeof v.headRefName === 'string' ? v.headRefName : null);
    if (v.state !== 'OPEN' && !naFila.has(pr)) throw new Error(`fila-de-merge: o PR ${pr} não está aberto (${v.state})`);
    if (deFork(v)) throw new Error(`fila-de-merge: ${MOTIVO_DO_FORK(pr)}`);
    const pedido = pedidos.find((p) => p.pr === pr).sha;
    if (anotar && !String(v.headRefOid ?? '').toLowerCase().startsWith(pedido)) throw new Error(`fila-de-merge --anotar: a ponta do PR ${pr} é ${String(v.headRefOid ?? '?').slice(0, 7)}, não ${pedido}: empurre e anote o sha que você testou`);
  }
  if (seco) return rodadaDaFila(pedidos, { seco, gate, preparar, falhaDeInfra, esperaDeInfra, cwd });
  if (anotar) {
    // F427: com a fila livre (nenhum gate do projeto vivo), o próprio `--anotar` a lança destacada, pelo julgamento e pelo
    // lançador da batida: a marca `lancada` gravada aqui, dentro da trava, segura a batida (e outro `--anotar`) por RELANCE_MIN.
    // Com gate rodando, só anota: a rodada viva leva os pendentes como lote seguinte. A batida segue como rede (fila órfã).
    // Os avisos (F370, F404) pedem conserto do item antes do merge: com algum deles, não lança (a batida ainda pode lançar).
    // O item se liga ao PR antes dos avisos: eles acham o item pelo `prs`, que a ligação pela branch preenche.
    const projetoDaAnotacao = projetoDoCwd(cwd).projeto;
    const ESPERA_A_BATIDA = 'espera a batida lançar o gate';
    let lig = ligarComAviso(branches, { projeto: projetoDaAnotacao, oQue: ESPERA_A_BATIDA });
    const semCodigo = avisoSemCodigo(pedidos.map((p) => p.pr), projetoDaAnotacao, cwd);
    const semEntrega = avisoSemEntrega(pedidos.map((p) => p.pr), projetoDaAnotacao);
    const comAviso = semCodigo || semEntrega
      ? { motivo: `corrija o aviso (${[semCodigo && 'avisoSemCodigo', semEntrega && 'avisoSemEntrega'].filter(Boolean).join(', ')}) e anote de novo: o --anotar seguinte lança a fila, se a batida não a lançar antes`, aviso: true }
      : null;
    const r = comTrava(() => {
      const e = lerEstado();
      const pendentes = juntarPedidos(e.pendentes, pedidos);
      const novo = { ...e, pendentes, config: { ...(e.config ?? {}), cwd: raizDoRepo(cwd) } };
      const orfa = filaOrfa(novo);
      const julgado = orfa ? julgarLancamento(novo, orfa, Date.now()) : { motivo: 'há um gate da fila rodando: o PR entra no lote seguinte', vivo: true };
      // o aviso só segura o que lançaria: o motivo de fundo (desligada, sem gate, gate rodando) diz mais à dona
      const j = julgado.lancada && comAviso ? comAviso : julgado;
      gravarJson(arquivo, j.lancada ? { ...novo, lancada: j.lancada } : novo);
      return {
        anotado: true, pendentes, lancou: !!j.lancada, ...(j.motivo ? { naoLancou: j.motivo } : {}),
        ...(j.lancada ? { lancar: { orfa, config: j.config, arquivo } } : {}), ...(j.vivo ? { vivo: true } : {}), ...(j.aviso ? { seguraAviso: true } : {}),
        ...(e.config?.gate ? {} : { aviso: 'a fila deste projeto ainda não tem gate gravado: nem o --anotar nem a batida a lançam até a orquestradora rodar a fila uma vez' }),
      };
    });
    // o `agora` do item se acerta antes de o processo subir: a rodada lançada pode devolver o PR em segundos, e a ligação
    // depois dela apagaria a devolução. O processo sobe fora da trava (a fila também a toma); falhar aqui deixa a fila para a
    // batida, que relança depois de RELANCE_MIN.
    const { lancar, vivo, seguraAviso, ...saidaDaTrava } = r;
    const oQue = lancar ? 'a fila foi lançada: o gate roda' : vivo ? 'espera a vez' : seguraAviso ? 'corrija o aviso do --anotar e anote de novo' : ESPERA_A_BATIDA;
    if (oQue !== ESPERA_A_BATIDA) lig = ligarComAviso(branches, { projeto: projetoDaAnotacao, oQue });
    if (lancar) {
      try { Object.assign(saidaDaTrava, lancarFilaSemTurno(lancar)); } catch (err) {
        Object.assign(saidaDaTrava, { lancou: false, naoLancou: `não consegui lançar a fila (${String(err?.message || err).split('\n')[0]}): a batida relança` });
        lig = ligarComAviso(branches, { projeto: projetoDaAnotacao, oQue: ESPERA_A_BATIDA });
      }
    }
    return { ...saidaDaTrava, ...lig, ...(semCodigo ? { avisoSemCodigo: semCodigo } : {}), ...(semEntrega ? { avisoSemEntrega: semEntrega } : {}) };
  }
  const entrada = comTrava(() => {
    const e = lerEstado();
    if (e.ocupada && e.ocupada.pid !== process.pid && donoDaFilaVivo(e.ocupada)) {
      const pendentes = juntarPedidos(e.pendentes, pedidos);
      gravarJson(arquivo, { ...e, pendentes });
      return { pendente: true, ocupadaDesde: e.ocupada.desde ?? null, pendentes };
    }
    const lote = juntarPedidos(juntarPedidos(e.emVoo, e.pendentes), pedidos);
    // o gate e o preparo ficam no estado: o relance da fila órfã (F220) os repete; a rodada da orquestradora grava também o
    // `config` que a fila sem turno usa (F351)
    // F398: os outros campos do config (os padrões de infraestrutura) passam; só o dado agora os troca
    const config = semTurno ? e.config : { ...(e.config && typeof e.config === 'object' ? e.config : {}), cwd: raizDoRepo(cwd), gate, preparar: preparar ?? null, ...infraDoConfig };
    // a fila que se gravou dona zera a contagem de lançamentos da batida
    gravarJson(arquivo, { ...e, lancada: undefined, pausa: undefined, ...(config ? { config } : {}), ocupada: { pid: process.pid, desde: new Date().toISOString(), gate, ...(preparar ? { preparar } : {}) }, pendentes: [], emVoo: lote });
    return { lote };
  });
  const projetoDaFila = projetoDoCwd(cwd).projeto;
  if (entrada.pendente) return { ...entrada, ...ligarComAviso(branches, { projeto: projetoDaFila, oQue: 'espera a vez' }) };
  const ligacoes = { ligados: [], ambiguos: [] };
  const devolvidosAqui = new Set();
  const rodadas = [];
  let aReler = []; // o que o gh não leu nesta chamada: fica nos pendentes, fora dos lotes seguintes dela
  let aPausar = []; // F446: o que o release aberto na base segurou nesta chamada: idem
  let pausa = null;
  try {
    let lote = entrada.lote;
    while (lote.length) {
      // a cada rodada: o PR anotado como pendente (já ligado) passa de "espera a vez" a "o gate roda"
      const lig = ligarComAviso(new Map(lote.map((p) => [p.pr, branches.get(p.pr) ?? null])), { projeto: projetoDaFila, oQue: 'o gate roda', pular: devolvidosAqui });
      for (const l of lig.ligados) if (!ligacoes.ligados.some((x) => x.pr === l.pr && x.item === l.item)) ligacoes.ligados.push(l);
      for (const n of lig.ambiguos) if (!ligacoes.ambiguos.includes(n)) ligacoes.ambiguos.push(n);
      let r;
      try {
        r = rodadaDaFila(lote, { seco, gate, preparar, falhaDeInfra, esperaDeInfra, cwd, semTurno });
      } catch (erro) {
        // erro da rodada inteira: os PRs dela não voltam à lista (um PR que derruba o preparo travaria a fila para sempre)
        const adiados = [...(erro?.adiados ?? []), ...(erro?.releitura ?? []), ...(erro?.pausados ?? [])];
        const naoRodaram = lote.filter((p) => !adiados.some((a) => a.pr === p.pr)).map((p) => p.pr);
        const ficaram = comTrava(() => {
          const e = lerEstado();
          const pendentes = juntarPedidos(adiados, e.pendentes);
          gravarJson(arquivo, { ...e, pendentes, emVoo: [], ...(erro?.pausa && !e.pausa ? { pausa: erro.pausa } : {}) });
          return pendentes.map((p) => p.pr);
        });
        const msg = `${String(erro?.message || erro).split('\n')[0]}; não rodaram: ${naoRodaram.map((n) => `#${n}`).join(', ')} (chame de novo com os que seguem valendo)${ficaram.length ? `; ficaram na fila: ${ficaram.map((n) => `#${n}`).join(', ')}` : ''}`;
        if (!rodadas.length) throw new Error(msg);
        rodadas.push({ prs: naoRodaram, erro: msg, mergeados: [], devolvidos: [] });
        break;
      }
      const { adiados = [], releitura = [], pausados = [], ...resto } = r;
      for (const dv of resto.devolvidos ?? []) for (const it of dv.itens ?? []) devolvidosAqui.add(it.item);
      rodadas.push({ prs: lote.filter((p) => !adiados.some((a) => a.pr === p.pr)).map((p) => p.pr), ...resto, ...(releitura.length ? { releitura: releitura.map((p) => p.pr) } : {}) });
      // F446: o PR pausado por release aberto na base dele fica nos pendentes, como o que o gh não leu, e a fila grava a
      // pausa; a batida e o --anotar só a relançam depois de PAUSA_MIN, e a rodada relançada confere o release de novo
      if (resto.pausa) { aPausar = juntarPedidos(aPausar, pausados); pausa ??= resto.pausa; }
      // ler a lista vazia e soltar a fila no mesmo trecho travado: o PR que chega depois disso acha a fila livre.
      // O PR que o gh não leu fica nos pendentes, fora do lote seguinte desta chamada: a próxima chamada o tenta de novo.
      aReler = juntarPedidos(aReler, releitura);
      const fora = (p) => aReler.some((x) => x.pr === p.pr) || aPausar.some((x) => x.pr === p.pr);
      lote = comTrava(() => {
        const e = lerEstado();
        const seguinte = juntarPedidos(adiados, e.pendentes.filter((p) => !fora(p)));
        const pendentes = juntarPedidos(juntarPedidos(aReler, aPausar), e.pendentes.filter(fora));
        gravarJson(arquivo, { ...e, ocupada: seguinte.length ? e.ocupada : null, pendentes, emVoo: seguinte, ...(pausa ? { pausa } : {}) });
        return seguinte;
      });
    }
  } finally {
    comTrava(() => { const e = lerEstado(); if (e.ocupada?.pid === process.pid) gravarJson(arquivo, { ...e, ocupada: null, emVoo: [] }); });
  }
  const lig = ligacoes.ligados.length || ligacoes.ambiguos.length ? ligacoes : {};
  if (rodadas.length === 1) { const { prs, ...r } = rodadas[0]; return { ...r, ...lig }; }
  const suspeitas = rodadas.map((r) => r.suspeitaDeInstavel).filter(Boolean);
  const infraRepetida = rodadas.flatMap((r) => r.infraRepetida ?? []);
  const erros = rodadas.map((r) => r.erro).filter(Boolean);
  const releitura = rodadas.flatMap((r) => r.releitura ?? []);
  return {
    base: rodadas[0].base,
    gates: rodadas.reduce((n, r) => n + (r.gates ?? 0), 0),
    logs: rodadas.map((r) => r.logs).filter(Boolean),
    mergeados: rodadas.flatMap((r) => r.mergeados),
    devolvidos: rodadas.flatMap((r) => r.devolvidos),
    ...(suspeitas.length ? { suspeitaDeInstavel: suspeitas.join(' · ') } : {}),
    ...(infraRepetida.length ? { infraRepetida } : {}),
    ...(erros.length ? { erros } : {}),
    ...(releitura.length ? { releitura } : {}),
    ...(pausa ? { pausa } : {}),
    rodadas,
    ...lig,
  };
}

// Uma rodada da fila: confere cada PR, monta o lote e testa, mergeia o que passou e devolve o resto à dona.
function rodadaDaFila(pedidos, { seco, gate, preparar, falhaDeInfra, esperaDeInfra, cwd, semTurno = false }) {
  const recusados = [];
  const prs = [];
  const releitura = [];
  for (const pedidoDaFila of pedidos) {
    const { pr, sha: pedido } = pedidoDaFila;
    // o gh que não leu (rede, limite) não tira o PR da fila: volta aos pendentes, até LEITURAS_DA_FILA tentativas
    let v;
    try { v = dadosDoPr(pr, cwd); } catch (e) {
      const leituras = (pedidoDaFila.leituras ?? 0) + 1;
      if (leituras < LEITURAS_DA_FILA) releitura.push({ ...pedidoDaFila, leituras });
      else recusados.push({ pr, sha: '', motivo: `o gh não leu o PR ${pr} em ${leituras} tentativas (${String(e?.message || e).split('\n')[0]}); saiu da fila`, semItem: true });
      continue;
    }
    // mergeado fora da fila: o item já se fechou (ou fecha pelo `mergear`); fechado sem merge volta à dona
    if (v.state !== 'OPEN') { recusados.push({ pr, sha: '', motivo: `o PR ${pr} não está mais aberto (${v.state}); saiu da fila`, semItem: v.state === 'MERGED' }); continue; }
    if (deFork(v)) { recusados.push({ pr, sha: '', motivo: `${MOTIVO_DO_FORK(pr)}; saiu da fila` }); continue; }
    const sha = v.headRefOid.toLowerCase();
    if (pedido && !sha.startsWith(pedido)) { recusados.push({ pr, sha, motivo: `a ponta mudou: entregue ${pedido}, agora ${sha.slice(0, 7)}; a dona manda de novo PR ${pr} pronto` }); continue; }
    prs.push({ pr, sha, base: v.baseRefName, head: v.headRefName });
  }
  // um lote por base: a do primeiro a chegar; o PR de outra base fica para a rodada seguinte (no `--seco`, só se diz).
  // F446: a rodada sem turno não mergeia na base com release aberto: o lote é da primeira base sem release, o PR da base com
  // release fica pausado (sem prender o de outra base) e a base do lote se confere de novo antes do merge (o gate leva
  // minutos); a rodada da orquestradora não confere (o release é dela)
  const conferePausa = semTurno && !seco;
  let base = prs[0]?.base;
  let release = null;
  const travados = [];
  if (conferePausa) {
    base = undefined;
    for (const b of new Set(prs.map((p) => p.base))) {
      const rel = releaseAberto(b, cwd);
      if (!rel) { base = b; break; }
      release ??= rel;
      travados.push(...prs.filter((p) => p.base === b));
    }
  }
  const adiados = prs.filter((p) => p.base !== base && !travados.includes(p)).map(({ pr }) => pedidos.find((x) => x.pr === pr));
  const doLote = base === undefined ? [] : prs.filter((p) => p.base === base);
  const extra = { ...(adiados.length ? { adiados } : {}), ...(releitura.length ? { releitura } : {}) };
  // sem PR para montar, a devolução dos recusados segue o mesmo caminho (o item fechado sem merge volta à dona)
  let lote = { aprovados: [], devolvidos: [], gates: 0, ...(base === undefined && travados.length ? { base: travados[0].base } : {}) };
  // o pausado volta à fila com o pedido da dona (o sha que ela testou), não com a ponta lida agora
  const pedidoDe = ({ pr, sha }) => pedidos.find((p) => p.pr === pr) ?? { pr, sha };
  const pausaDe = (rel) => ({ release: rel.pr, base: rel.base, head: rel.head, motivo: `release aberto (PR ${rel.pr}, ${rel.head} → ${rel.base})`, em: new Date().toISOString() });
  // o lote que cai não leva junto o PR que o release segurou: ele fica nos pendentes, com a pausa
  if (doLote.length) try { lote = montarLote({ prs: doLote.map(({ pr, sha, head }) => ({ pr, sha, head })), base, cwd, gate, preparar, falhaDeInfra, esperaDeInfra }); } catch (e) { e.adiados = adiados; e.releitura = releitura; if (release) { e.pausados = travados.map(pedidoDe); e.pausa = pausaDe(release); } throw e; }
  lote.devolvidos.unshift(...recusados);
  const { projeto } = projetoDoCwd();
  const itensDoPr = (pr) => [...itensVivos()].filter(([, d]) => projeto && String(d?.projeto ?? '').toLowerCase() === projeto && Array.isArray(d.prs) && d.prs.includes(pr));
  const resumo = { base: lote.base, gates: lote.gates, logs: lote.pasta, ...(lote.suspeitaDeInstavel ? { suspeitaDeInstavel: lote.suspeitaDeInstavel } : {}), ...(lote.infraRepetida ? { infraRepetida: lote.infraRepetida } : {}) };
  if (seco) return { seco: true, ...resumo, mergearia: lote.aprovados.map((a) => a.pr), devolveria: lote.devolvidos.map(({ pr, motivo }) => ({ pr, motivo })), ...(adiados.length ? { outraBase: adiados.map((a) => a.pr) } : {}) };
  const mergeados = [];
  const releaseDoLote = conferePausa && lote.aprovados.length ? releaseAberto(base, cwd) : null;
  const pausados = [...travados, ...(releaseDoLote ? lote.aprovados : [])];
  release ??= releaseDoLote;
  const pausa = release ? pausaDe(release) : null;
  for (const { pr, sha } of releaseDoLote ? [] : lote.aprovados) {
    // um merge que falha (gh, fetch) não derruba o lote: vira devolução e os outros seguem
    let r;
    try { r = comandoMergear([String(pr), sha]); } catch (e) { r = { recusado: true, motivo: `o merge falhou: ${String(e?.message || e).split('\n')[0]}` }; }
    if (r.recusado) lote.devolvidos.push({ pr, sha, motivo: r.conflito ? motivoDeConflito({ pr, sobre: lote.base, arquivos: r.arquivos ?? [], base: lote.base }) : r.motivo });
    else mergeados.push({ pr, itens: r.itens });
  }
  const devolvidos = lote.devolvidos.map(({ pr, sha, motivo, log, semItem }) => {
    // F184: o vermelho do gate mede o acerto dos testes afetados da dona; a medição que falha não pesa na fila
    if (log) try { registrarAcerto({ cwd, pr, sha, base: lote.base, log }); } catch { /* sem medição */ }
    const itens = semItem ? [] : comTrava(() => itensDoPr(pr).map(([F, d]) => {
      const agora = `devolvido pela fila de merge (PR ${pr}): ${motivo}`.slice(0, 300);
      // F373: item que voltou da fila é de risco; o validador do conserto vai em Opus (hook `modelo-do-validador`)
      efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data: { etapa: 'execucao', agora, risco: true } }, undefined, new Map()));
      return { item: F, dona: d.donoLocalId ?? null };
    }));
    return { pr, motivo, ...(log ? { log } : {}), itens };
  });
  return { ...resumo, mergeados, devolvidos, ...(pausa ? { pausa, pausados: pausados.map(pedidoDe) } : {}), ...extra };
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
// Marcadores `ativas/<id>` de orquestradora que já não existem: sessão arquivada ou fora do registro, id que a sessão deixou para
// trás ao limpar o contexto (F208), ou parada há 7 dias. Fora do registro só depois de MARCADOR_NOVO_MS: o hook de início cria
// o marcador da id nova antes de o app gravá-la no registro.
const MARCADOR_NOVO_MS = 10 * 60_000;
function marcadoresMortos(porId, agoraMs) {
  const dir = join(ORQ(), 'ativas');
  let nomes = [];
  try { nomes = readdirSync(dir); } catch { return []; }
  const mortos = [];
  for (const id of nomes.sort()) {
    let reg = null;
    try { reg = regras.registroDaSessao(id, { fresco: true }); } catch { continue; }
    if (reg === null) {
      let mtime = 0;
      try { mtime = statSync(join(dir, id)).mtimeMs; } catch { /* sumiu: some de novo */ }
      if (agoraMs - mtime >= MARCADOR_NOVO_MS) mortos.push(id);
      continue;
    }
    if (reg.arquivada) { mortos.push(id); continue; }
    if (reg.anterior) {
      // F447: o marcador da orquestradora do Orca (o id do Orca na 2ª linha) fica enquanto o transcript da id escreve: um
      // `claude` lançado do Bash dela vira o CLI atual do registro e a deixa "anterior" estando viva
      let doOrca = false;
      try { doOrca = /^orca_session_id:/.test(readFileSync(join(dir, id), 'utf8').split('\n')[1] ?? ''); } catch { /* sumiu */ }
      if (!doOrca || moduloOrca?.cliParado(id) === true) mortos.push(id);
      continue;
    }
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

// `pode-reiniciar` (F152): o julgamento é de pode-reiniciar.mjs; aqui ficam os argumentos, a identidade da própria sessão e o arquivo.
// O arquivo guarda TODOS os motivos (a sessão que rodou incluída, cada motivo de sessão com `localId`): a barra das outras sessões não
// pode ler "pode" quando quem gravou estava trabalhando. Só a saída do comando tira a própria sessão.
function eusDestaSessao() {
  const s = new Set([MEU_CLI, process.env.CLAUDE_CODE_HOST_SESSION_ID].filter(textoNaoVazio));
  try { const l = regras?.registroDaSessao(MEU_CLI)?.localId; if (l) s.add(l); } catch { /* sem registro */ }
  return s;
}
function conferirReinicio({ linhas, listaEm, sessoesDe, agoraMs = Date.now(), orca = listaDoOrca() }) {
  const euPid = new Set([process.pid, process.ppid]);
  const ps = lerPs(process.env);
  const motivos = julgarReinicio({ sessoes: linhas, fichas: lerFichas(regras.pastaDoTeto(process.env)), ps, euPid });
  const em = new Date(agoraMs).toISOString();
  // os plugins do kit são um extra: ler mal não derruba o julgamento
  let paraAplicar = [];
  try { paraAplicar = pluginsEsperandoReinicio({ home: homedir(), inicioDoApp: lerInicioDoApp(process.env) }); } catch { /* sem plugins */ }
  let paraBaixar = [];
  try { paraBaixar = lerParaBaixar({ home: homedir(), cache: join(ORQ(), 'batida', 'kit-publicado.json'), agoraMs }); } catch { /* sem conferência */ }
  const doOrca = orcaNoReinicio(orca);
  const att = { ...(paraAplicar.length ? { paraAplicar } : {}), ...(paraBaixar.length ? { paraBaixar } : {}), ...(doOrca ? { orca: doOrca } : {}) };
  const completo = { pode: motivos.length === 0, motivos, sessoesDe, em, listaEm: new Date(listaEm).toISOString(), ...att };
  const idadeMin = Math.max(0, Math.round((agoraMs - listaEm) / 60_000));
  const eu = eusDestaSessao();
  const visiveis = motivos.filter((m) => !(m.tipo === 'sessao' && eu.has(m.localId)));
  const saida = { pode: visiveis.length === 0, motivos: visiveis, sessoesDe, ...(sessoesDe === 'batida' ? { idadeMin } : {}), em, ...att };
  return { completo, saida };
}
const gravarReinicio = (completo) => gravarJson(join(ORQ(), 'batida', 'pode-reiniciar.json'), completo);
function comandoPodeReiniciar(args) {
  const arquivo = flag(args, '--sessoes');
  const listaEmIso = flag(args, '--lista-em');
  const comoJson = flag(args, '--json', false);
  if (args.length) throw new Error('uso: painel.mjs pode-reiniciar [--sessoes <arquivo>] [--lista-em <ISO>] [--json]');
  const fonte = arquivo ?? join(ORQ(), 'batida', 'sessoes.json');
  let listaEm = listaEmIso ? Date.parse(listaEmIso) : null;
  if (listaEmIso && Number.isNaN(listaEm)) throw new Error(`--lista-em: "${listaEmIso}" não é data ISO`);
  let linhas;
  try {
    linhas = lerSessoes(fonte);
    if (listaEm === null) listaEm = statSync(fonte).mtimeMs;
  } catch (e) { throw new Error(`não consegui ler a lista de sessões ${fonte}: ${e?.message || e}`); }
  const { completo, saida } = conferirReinicio({ linhas, listaEm, sessoesDe: arquivo ? 'lista' : 'batida' });
  gravarReinicio(completo);
  return { saida, comoJson };
}

// F351: a batida lança a fila sem turno. Para cada projeto: a fila com PR anotado e sem processo vivo (órfã, F220) se lança
// sozinha, destacada (o mod dá 60 s à batida; o gate leva muito mais), quando todo PR anotado tem o sha da dona, o `config` tem o
// gate e a pasta do repositório, e não houve lançamento nos últimos RELANCE_MIN (o processo novo leva uns segundos para se gravar
// dono). A que não se lança segue no relatório da orquestradora como fila parada. KIT_FILA_SEM_TURNO=off desliga o lançamento.
// A marca `lancada` se grava dentro da trava da batida; o processo sobe depois que ela a solta (a fila também toma a trava, e
// esperaria a batida inteira).
const RELANCE_MIN = 5;
const LANCAMENTOS = 3; // lançada tantas vezes sem nunca se gravar dona: volta ao relatório da orquestradora
const PAUSA_MIN = 10; // F446: a fila pausada por release aberto se relança depois disso, e a rodada confere o release de novo
function lancarFilaSemTurno({ orfa, config, arquivo }) {
  const log = arquivo.replace(/\.json$/, '.sem-turno.log');
  const fd = openSync(log, 'a'); // em 'a': uma rodada anterior ainda pode escrever nele
  try {
    const args = [fileURLToPath(import.meta.url), 'fila-de-merge', ...orfa.prs.map((p) => `${p.pr}:${p.sha}`), '--gate', config.gate, ...(config.preparar ? ['--preparar', config.preparar] : []), '--sem-turno'];
    // sem a id da sessão que rodou a batida: a fila não é dela
    const filho = spawn(process.execPath, args, { cwd: config.cwd, detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, CLAUDE_CODE_SESSION_ID: '' } });
    filho.on('error', () => { /* o log e o relance cobrem */ });
    filho.unref();
    return { pid: filho.pid ?? null, log };
  } finally { closeSync(fd); }
}
// O julgamento de lançar a fila órfã, o mesmo na batida e no `--anotar` (F427). → {lancada, config} para lançar agora, ou
// {motivo} para não lançar; `recente: true` quando o motivo é um lançamento de há pouco (a fila conta como viva).
function julgarLancamento(e, orfa, agoraMs) {
  const c = e?.config && typeof e.config === 'object' ? e.config : {};
  const recente = Date.parse(e?.lancada?.em) > agoraMs - RELANCE_MIN * 60_000;
  const tentativas = Number.isInteger(e?.lancada?.tentativas) ? e.lancada.tentativas : 0;
  if (process.env.KIT_FILA_SEM_TURNO === 'off') return { motivo: 'o lançamento sem turno está desligado (KIT_FILA_SEM_TURNO=off)' };
  if (!orfa.prs.every((p) => p.sha)) return { motivo: 'há PR anotado sem o sha da dona' };
  if (!textoNaoVazio(c.gate) || !textoNaoVazio(c.cwd) || !existsSync(c.cwd)) return { motivo: 'a fila não tem gate e pasta gravados pela orquestradora' };
  // F446: pausada há pouco conta como viva (não vai ao relatório como fila parada) e não se relança
  if (Date.parse(e?.pausa?.em) > agoraMs - PAUSA_MIN * 60_000) return { recente: true, motivo: `a fila está pausada: ${e.pausa.motivo ?? 'release aberto'}; confere de novo em até ${PAUSA_MIN} min` };
  if (recente) return { recente, motivo: `a fila foi lançada há pouco (${e.lancada.em}); a rodada lançada leva o PR` };
  if (tentativas >= LANCAMENTOS) return { motivo: `${tentativas} lançamentos sem a fila se gravar dona: fica com a orquestradora` };
  return { config: c, lancada: { em: new Date(agoraMs).toISOString(), tentativas: tentativas + 1 } };
}
function filasDaBatida({ seco, agoraMs }) {
  const dir = dirname(ESTADO_DA_FILA('x'));
  let nomes = [];
  try { nomes = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return { orfas: {}, vivas: {}, desfechos: {}, avisos: {}, lancadas: {} }; }
  const orfas = {}; const vivas = {}; const desfechos = {}; const avisos = {}; const lancadas = {};
  for (const n of nomes.sort()) {
    const nome = n.slice(0, -'.json'.length);
    const arquivo = join(dir, n);
    const e = arquivoJson(arquivo, null);
    if (!e || typeof e !== 'object') continue;
    if (Array.isArray(e.desfechos) && e.desfechos.length) desfechos[nome] = e.desfechos;
    if (Array.isArray(e.avisos) && e.avisos.length) avisos[nome] = e.avisos;
    const prsDe = (l) => (Array.isArray(l) ? l.map((p) => p?.pr).filter(Number.isInteger) : []);
    const orfa = filaOrfa(e);
    if (!orfa) { const prs = [...prsDe(e.emVoo), ...prsDe(e.pendentes)]; if (prs.length) vivas[nome] = prs; continue; }
    const j = julgarLancamento(e, orfa, agoraMs);
    if (j.motivo && !j.recente) { orfas[nome] = orfa; continue; }
    vivas[nome] = orfa.prs.map((p) => p.pr);
    if (j.recente) continue;
    if (!seco) gravarJson(arquivo, { ...e, lancada: j.lancada });
    lancadas[nome] = { prs: vivas[nome], orfa, config: j.config, arquivo };
  }
  return { orfas, vivas, desfechos, avisos, lancadas };
}
// F370: tira do estado os avisos que a batida leu (entregues, ou sem dona viva para recebê-los); o que a fila gravou depois fica.
function baixarAvisos(lidos) {
  for (const [nome, lista] of Object.entries(lidos ?? {})) {
    const arquivo = ESTADO_DA_FILA(nome);
    const e = arquivoJson(arquivo, null);
    if (!e || !Array.isArray(e.avisos)) continue;
    const chaves = new Set(lista.map((a) => JSON.stringify(a)));
    gravarJson(arquivo, { ...e, avisos: e.avisos.filter((a) => !chaves.has(JSON.stringify(a))) });
  }
}
// Tira do estado os desfechos entregues à orquestradora; os entregues só às donas ficam marcados até haver orquestradora.
function baixarDesfechos(entregas) {
  for (const [nome, { orquestradora, soDonas }] of Object.entries(entregas ?? {})) {
    const arquivo = ESTADO_DA_FILA(nome);
    const e = arquivoJson(arquivo, null);
    if (!e || !Array.isArray(e.desfechos)) continue;
    const resto = e.desfechos.slice(orquestradora).map((d, i) => (i < soDonas ? { ...d, donasAvisadas: true } : d));
    gravarJson(arquivo, { ...e, desfechos: resto });
  }
}

// F371: as donas paradas no limite de uso, lidas do fim do transcript atual de cada uma (registro do app → id do CLI atual →
// <projetos>/<pasta>/<id>.jsonl). Só o fim do arquivo: a recusa é a última fala. Erro de leitura = a dona fica fora (a batida segue como antes).
const FIM_DO_TRANSCRIPT = 256 * 1024;
function fimDoArquivo(f) {
  const fd = openSync(f, 'r');
  try {
    const tam = statSync(f).size;
    const n = Math.min(tam, FIM_DO_TRANSCRIPT);
    const buf = Buffer.alloc(n);
    readSync(fd, buf, 0, n, tam - n);
    return buf.toString('utf8');
  } finally { closeSync(fd); }
}
function limitesDasDonas(itens) {
  const limites = {};
  const raiz = projetosDir();
  let pastas = null;
  for (const [, d] of itens) {
    const dona = d?.donoLocalId;
    if (typeof dona !== 'string' || !dona || dona in limites || ['feito', 'descartado', 'merge'].includes(d.etapa)) continue;
    try {
      const cli = regras?.registroDaSessao(dona, { fresco: true })?.cliAtual;
      if (!cli) continue;
      pastas ??= readdirSync(raiz, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
      const f = pastas.map((p) => join(raiz, p, `${cli}.jsonl`)).find((x) => existsSync(x));
      const lim = f ? limiteDoTranscript(fimDoArquivo(f)) : null;
      if (lim) limites[dona] = lim;
    } catch { /* registro ou transcript ilegível: fora */ }
  }
  return limites;
}
const handoffDoItem = (F) => (/^F\d+$/.test(F) && existsSync(join(HANDOFFS, `${F}.md`)) ? join(HANDOFFS, `${F}.md`) : null);

// F460 (ADR 0032): no Orca, o worker da aba do kit roda a batida de leitura a cada 10 min. Sem a lista do app, ela só coleta o
// estado deduzido (git, gh, lista de workers do Orca) e grava `batida/deduzido.json` com `fonte: 'leitura'`: não julga, não
// cutuca, não solta, não lança fila, não grava `estado.json` nem apaga marcador, cartão ou pergunta.
// F472 (ADR 0034): fecha pelo merge, pela mesma regra (`batida.mjs#aFechar`) e a mesma gravação (`fecharPeloMerge`) da batida
// completa: no Orca não há batida completa, e o item mergeado ficava em merge. Fora fica o item da dona local_ (a do app
// desktop): sem a lista do app, a branch do worktree dela não se vê, e o PR aberto nela não seguraria o fechamento.
// Não corre com outra batida: pula se o deduzido tem menos de 10 min, e confere de novo dentro da trava antes de gravar (a
// batida completa grava o deduzido na mesma trava). Não grava `vez.json`: nunca adia a batida completa do app desktop.
const LEITURA_MIN = 10;
function deduzidoFresco(agoraMs) {
  const em = Date.parse(arquivoJson(join(ORQ(), 'batida', 'deduzido.json'), null)?.em ?? '');
  if (!Number.isFinite(em)) return null;
  const min = (agoraMs - em) / 60_000; // negativo: outra batida que começou depois desta
  return Math.abs(min) < LEITURA_MIN ? `o deduzido.json tem ${Math.max(0, Math.floor(min))} min` : null;
}
// As pastas dos workers do Orca como linhas da lista de sessões: servem só para achar o repositório de cada projeto (o gh).
// Os vivos primeiro; a pasta que não existe mais fica fora. O id não casa com dona nenhuma (a dona do Orca vem da lista).
function linhasDosWorkers(orca) {
  const ws = Array.isArray(orca?.workers) ? orca.workers : [];
  const vistas = new Set();
  const linhas = [];
  for (const w of [...ws.filter((x) => x.vivo), ...ws.filter((x) => !x.vivo)]) {
    if (!textoNaoVazio(w?.pasta) || vistas.has(w.pasta) || !existsSync(w.pasta)) continue;
    vistas.add(w.pasta);
    linhas.push({ sessionId: `orca-worker:${w.terminal ?? w.dispatchId ?? w.pasta}`, title: '', cwd: w.pasta, isArchived: false, isRunning: false });
  }
  return linhas;
}
const daDonaLocal = (d) => textoNaoVazio(d?.donoLocalId) && !d.donoLocalId.startsWith('orca_session_id:');
// F472: o custo do item que a dedução viu mergeado; lê transcripts, então se mede fora da trava (F348)
function custosDoFechamento(deduzidos, F = () => true) {
  const custos = new Map();
  for (const [id, dd] of deduzidos) {
    if (!dd?.mergeado || !F(id)) continue;
    const it = ler('fila', id);
    if (it) { try { custos.set(id, medirCusto(it.data)); } catch { /* sem custo */ } }
  }
  return custos;
}
// F423/F472: fecha, dentro da trava, cada item de `fechar` ([{F, prs}], de `aFechar` ou do `julgar`), relido do disco: o que
// fechou, ganhou `maisFatias`, ganhou PR ou trocou de etapa desde a coleta (`coleta`: Map F → o item que a dedução leu) fica
// como está. → os ids fechados
function fecharPeloMerge(fechar, custos, quem, coleta) {
  const fechados = [];
  for (const { F, prs } of fechar) {
    const atual = ler('fila', F);
    if (!atual || ETAPAS_FINAIS.has(atual.data?.etapa) || atual.data?.maisFatias === true) continue;
    if (mudouDesdeAColeta(coleta.get(F), atual.data)) continue;
    try {
      efetivar(planejar({ op: 'update', colecao: 'fila', id: F, data: dadosDoFechamento(atual.data, `mergeado (PR ${prs.join(', ')}), visto pela batida`, custos.get(F)), [VIA_COM]: true }, undefined, new Map()));
      fechados.push(F);
    } catch (e) { process.stderr.write(`${quem}: não fechei ${F}: ${e?.message || e}\n`); }
  }
  return fechados;
}
function comandoBatidaDeLeitura(args) {
  const agoraIso = flag(args, '--agora');
  if (args.length) throw new Error(`uso: painel.mjs batida --leitura [--agora <ISO>] (a leitura não aceita ${args[0]})`);
  const agoraMs = agoraIso ? Date.parse(agoraIso) : Date.now();
  if (Number.isNaN(agoraMs)) throw new Error(`--agora: "${agoraIso}" não é data ISO`);
  if (process.env.KIT_ESTADO_DEDUZIDO === 'off') return { gravado: false, pulou: 'KIT_ESTADO_DEDUZIDO=off' };
  const antes = deduzidoFresco(agoraMs);
  if (antes) return { gravado: false, pulou: antes };
  const orca = listaDoOrca();
  if (orca?.erro) process.stderr.write(`batida --leitura: a lista de workers do Orca falhou; as donas do Orca ficam fora da vista: ${orca.erro}\n`);
  const coleta = itensVivos();
  const vidasDoOrca = vidaDasDonasDoOrca(coleta, orca, agentesDoOrcaUmaVez());
  const deduzidos = coletarDeduzidos({ itens: coleta, linhas: linhasDosWorkers(orca), projetoDe: projetoDeUmaLinha(), slug: (p) => arq.slugDoProjeto(p), agoraMs, prazoMin: prazoEmMin([]), donaDoOrca: (id) => vidasDoOrca.get(id) ?? null, semListaDoApp: true });
  const custos = custosDoFechamento(deduzidos, (F) => !daDonaLocal(ler('fila', F)?.data));
  return comTrava(() => {
    const depois = deduzidoFresco(agoraMs);
    if (depois) return { gravado: false, pulou: `${depois}: outra batida gravou durante esta` };
    const fechados = fecharPeloMerge(aFechar(itensVivos(), deduzidos).filter(({ F }) => !daDonaLocal(ler('fila', F)?.data)), custos, 'batida --leitura', coleta);
    const em = new Date(agoraMs).toISOString();
    gravarJson(join(ORQ(), 'batida', 'deduzido.json'), { em, fonte: 'leitura', itens: Object.fromEntries(deduzidos) });
    return { gravado: true, em, itens: deduzidos.size, ...(fechados.length ? { fechados } : {}) };
  });
}

function comandoBatida(args) {
  if (flag(args, '--leitura', false)) return comandoBatidaDeLeitura(args);
  const arquivo = flag(args, '--sessoes');
  const seco = flag(args, '--seco', false);
  const agoraIso = flag(args, '--agora');
  if (!arquivo || args.length) throw new Error('uso: painel.mjs batida --sessoes <arquivo> [--seco] [--agora <ISO>] | batida --leitura [--agora <ISO>]');
  const agoraMs = agoraIso ? Date.parse(agoraIso) : Date.now();
  if (Number.isNaN(agoraMs)) throw new Error(`--agora: "${agoraIso}" não é data ISO`);
  const linhas = lerSessoes(arquivo);
  const pasta = join(ORQ(), 'batida');
  const solta = Number(process.env.BATIDA_SOLTA_MIN);
  const prazoMin = prazoEmMin([]);
  // F423 (ADR 0027): o estado deduzido do git, do gh e das sessões se coleta fora da trava (o gh é lento); KIT_ESTADO_DEDUZIDO=off
  // volta ao declarado. Falhar aqui não derruba a batida: sem dedução, cada item segue pelo que declara.
  // F444: a lista do Orca se lê uma vez, fora da trava; a dona do Orca que entrou depois dela fica fora da vista nesta batida
  const orca = listaDoOrca();
  if (orca?.erro) process.stderr.write(`batida: a lista de workers do Orca falhou; as donas do Orca ficam fora da vista: ${orca.erro}\n`);
  const coleta = itensVivos();
  const vidasDoOrca = vidaDasDonasDoOrca(coleta, orca, agentesDoOrcaUmaVez());
  let deduzidos = new Map();
  if (process.env.KIT_ESTADO_DEDUZIDO !== 'off') {
    try { deduzidos = coletarDeduzidos({ itens: coleta, linhas, projetoDe: projetoDeUmaLinha(), slug: (p) => arq.slugDoProjeto(p), agoraMs, prazoMin, donaDoOrca: (id) => vidasDoOrca.get(id) ?? null }); } catch (e) { process.stderr.write(`batida: não deduzi o estado dos itens: ${e?.message || e}\n`); }
  }
  // o custo lê transcripts: mede-se fora da trava (F348), só para o item que a dedução viu mergeado
  const custos = seco ? new Map() : custosDoFechamento(deduzidos);
  const rodar = () => {
    const itens = itensVivos();
    const filas = filasDaBatida({ seco, agoraMs });
    const limites = limitesDasDonas(itens);
    const julgado = julgar({
      agoraMs, itens, linhas, projetoDe: projetoDeUmaLinha(), filasOrfas: filas.orfas, filasVivas: filas.vivas, desfechos: filas.desfechos, avisos: filas.avisos,
      estado: arquivoJson(join(pasta, 'estado.json'), {}),
      semDona, donaACaminho, cartoes: cartoesDoPainel().map((c) => c.data),
      ultimo: (nome) => arquivoJson(join(pasta, `${nome}.json`), null),
      caminhoDoRelatorio: (nome) => join(pasta, `${nome}.json`),
      prazoMin, soltaMin: Number.isInteger(solta) && solta > 0 ? solta : BATIDA_SOLTA_MIN,
      limites, handoffDe: handoffDoItem, deduzidos, vidaDoOrca: (id) => vidasDoOrca.get(id)?.viva ?? null,
    });
    const marcadoresApagados = marcadoresMortos(new Map(linhas.map((r) => [r.sessionId, r])), agoraMs);
    const cartoesApagados = cartoesResolvidos({ cartoes: cartoesDoPainel(), linhas, projetoDe: projetoDeUmaLinha(), agoraMs, itens: new Map(itens) });
    const saida = { cartoesApagados, ...(julgado.fechar.length ? { fechados: julgado.fechar.map((x) => x.F) } : {}), ...(Object.keys(filas.lancadas).length ? { filasLancadas: Object.fromEntries(Object.entries(filas.lancadas).map(([n, l]) => [n, l.prs])) } : {}), mensagens: julgado.mensagens, soltos: julgado.soltar.map((s) => s.F), ...(Object.keys(limites).length ? { limites: Object.fromEntries(Object.entries(limites).map(([id, l]) => [id, new Date(l.resetsAtMs).toISOString()])) } : {}), projetos: Object.fromEntries(Object.entries(julgado.projetos).map(([n, p]) => { const { mudou, ...resto } = p; return [n, resto]; })), marcadoresApagados };
    if (seco) return saida;
    // F423: o item cujos PRs ligados mergearam (pela fila, pelo app ou à mão no GitHub) fecha aqui; a fila que mergeou já o fechou
    const fechados = fecharPeloMerge(julgado.fechar, custos, 'batida', coleta);
    if (fechados.length) saida.fechados = fechados; else delete saida.fechados;
    if (deduzidos.size) {
      try { gravarJson(join(pasta, 'deduzido.json'), { em: new Date(agoraMs).toISOString(), itens: Object.fromEntries(deduzidos) }); } catch (e) { process.stderr.write(`batida: não gravei deduzido.json: ${e?.message || e}\n`); }
    }
    const soltos = [];
    for (const { F, motivo } of julgado.soltar) {
      try { soltarSemTrava(F, motivo, false); soltos.push(F); } catch (e) { process.stderr.write(`batida: não soltei ${F}: ${e?.message || e}\n`); }
    }
    saida.soltos = soltos;
    saida.lancarDepois = filas.lancadas;
    for (const [nome, linhas] of Object.entries(julgado.registros ?? {})) {
      try { mkdirSync(pasta, { recursive: true }); appendFileSync(join(pasta, `${nome}.desfechos.log`), linhas.map((l) => `${new Date(agoraMs).toISOString()} ${l}\n`).join('')); } catch (e) { process.stderr.write(`batida: não registrei os desfechos de ${nome}: ${e?.message || e}\n`); }
    }
    try { baixarDesfechos(julgado.desfechos); } catch (e) { process.stderr.write(`batida: não baixei os desfechos da fila: ${e?.message || e}\n`); }
    try { baixarAvisos(filas.avisos); } catch (e) { process.stderr.write(`batida: não baixei os avisos da fila: ${e?.message || e}\n`); }
    gravarJson(join(pasta, 'estado.json'), julgado.estado);
    const em = new Date(agoraMs).toISOString();
    for (const [nome, p] of Object.entries(julgado.projetos)) {
      const { mudou, ...conteudo } = p;
      // o relatório só passa a ser "o último" quando a orquestradora existe para recebê-lo: sem ela, a próxima batida o oferece de novo
      if (mudou && !conteudo.orquestradora) { const antes = arquivoJson(join(pasta, `${nome}.json`), null); const { filaParada, ...resto } = conteudo; gravarJson(join(pasta, `${nome}.json`), { ...resto, merge: antes?.merge ?? [], vagas: antes?.vagas ?? [], ...(antes?.filaParada ? { filaParada: antes.filaParada } : {}), em }); continue; }
      gravarJson(join(pasta, `${nome}.json`), { ...conteudo, em });
    }
    // F183: a resposta gravada pelo pane fica na pasta quente (o mod não apaga arquivo); a batida a leva para o arquivo
    try { saida.perguntasArquivadas = migracaoFeita() ? arquivarFechadas(false) : []; } catch (e) { process.stderr.write(`batida: não arquivei as perguntas fechadas: ${e?.message || e}\n`); }
    for (const id of marcadoresApagados) rmSync(join(ORQ(), 'ativas', id), { force: true });
    for (const id of cartoesApagados) rmSync(caminho('cartoes', id), { force: true });
    // o mesmo julgamento de `pode-reiniciar`, com a lista que a batida já tem (F152); falhar aqui não derruba a batida
    try { gravarReinicio(conferirReinicio({ linhas, listaEm: statSync(arquivo).mtimeMs, sessoesDe: 'lista', agoraMs, orca }).completo); } catch (e) { process.stderr.write(`batida: não gravei pode-reiniciar.json: ${e?.message || e}\n`); }
    return saida;
  };
  if (seco) return rodar();
  const saida = comTrava(rodar);
  for (const [nome, l] of Object.entries(saida.lancarDepois ?? {})) {
    try { lancarFilaSemTurno(l); } catch (err) {
      process.stderr.write(`batida: não lancei a fila de ${nome}: ${err?.message || err}\n`);
      delete saida.filasLancadas?.[nome];
    }
  }
  delete saida.lancarDepois;
  return saida;
}

// F183: as perguntas fechadas (respondida/cancelada) que ainda estão na pasta quente vão para o arquivo, sem mexer no conteúdo.
// Chame dentro da trava. → os ids movidos (ou que seriam, com `seco`).
function arquivarFechadas(seco) {
  const dir = caminho('perguntas');
  if (!existsSync(dir)) return [];
  const movidas = [];
  for (const n of readdirSync(dir)) {
    if (!n.endsWith('.json')) continue;
    const f = join(dir, n);
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { process.stderr.write(`aviso: perguntas/${n} ilegível, ficou onde está\n`); continue; }
    if (!arq.FECHADAS.has(doc?.data?.estado)) continue;
    const id = n.replace(/\.json$/, '');
    movidas.push(id);
    if (seco) continue;
    const destino = arq.caminhoNoArquivo(dir, id, doc.data);
    mkdirSync(dirname(destino), { recursive: true });
    renameSync(f, destino);
  }
  return movidas;
}

// A batida só arquiva depois da migração: antes dela, mover 400 arquivos do estado real sem backup nem ok do operador não vale.
// F447 (ADR 0030, item 7; plano do modo Orca, fatia 5): a orquestradora no Orca. No Orca o título da conversa não se troca:
// a sessão se declara orquestradora pelo marcador, e arquivar a dona é soltar o worker e marcar a worktree, lidos no Orca.
const ID_DO_CLI = /^[\w-]+$/; // vira nome de arquivo em ativas/
function gitDe(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', timeout: Number(process.env.KIT_GIT_TIMEOUT_MS) || 10000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
// `orquestradora assumir`: grava ativas/<id do CLI> com o git common dir do repositório e, no Orca, o id do Orca na 2ª linha
// (o `orquestradora-de-volta` o reconhece por ele depois de limpar o contexto; a batida não o apaga enquanto o registro do
// Orca disser que o CLI é o atual). As travas da orquestradora valem pelo marcador: nada depende do título.
function assumir() {
  const cli = String(process.env.CLAUDE_CODE_SESSION_ID ?? '').trim();
  if (!cli) throw new Error('orquestradora assumir: sem CLAUDE_CODE_SESSION_ID no ambiente (rode pelo Bash da própria sessão)');
  if (!ID_DO_CLI.test(cli)) throw new Error(`orquestradora assumir: CLAUDE_CODE_SESSION_ID inválido: ${JSON.stringify(cli)}`);
  let repo;
  try { repo = gitDe(process.cwd(), ['rev-parse', '--path-format=absolute', '--git-common-dir']); } catch { repo = ''; }
  if (!repo) throw new Error('orquestradora assumir: a pasta atual está fora de git (rode na pasta do projeto)');
  const eu = quemSou();
  const orcaId = typeof eu === 'string' && eu.startsWith('orca_session_id:') ? eu : null;
  const dir = join(ORQ(), 'ativas');
  mkdirSync(dir, { recursive: true });
  const marcador = join(dir, cli);
  writeFileSync(marcador, `${repo}\n${orcaId ? `${orcaId}\n` : ''}`);
  const outras = readdirSync(dir).filter((id) => id !== cli).filter((id) => {
    try { return regras.repoDoMarcador(readFileSync(join(dir, id), 'utf8')) === repo; } catch { return false; }
  });
  return { marcador, repo, orcaId, outras };
}

// As condições de arquivar a dona de um worker do Orca. → { condicoes, faltam, pasta, terminal, item }.
function condicoesDeArquivar(dispatchId, itemPedido, lista) {
  const faltam = [];
  const condicoes = {};
  const w = lista.workers.find((x) => x.dispatchId === dispatchId);
  if (!w) return { condicoes, faltam: [`o despacho ${dispatchId} não está no orca worker-list`], pasta: null, terminal: null, item: null };
  const { pasta, terminal } = w;
  // parado: todo despacho do mesmo terminal ou da mesma pasta terminou (a devolução por `send --to dispatch:` cria um despacho
  // novo no mesmo terminal, e o antigo fica `succeeded` enquanto o worker trabalha de novo)
  const juntos = lista.workers.filter((x) => (terminal && x.terminal === terminal) || (pasta && x.pasta && moduloOrca.dentroDe(x.pasta, pasta)));
  const vivos = juntos.filter((x) => !moduloOrca.estadoFinal(x.state));
  condicoes.parado = vivos.length === 0;
  for (const x of vivos) faltam.push(`worker não está parado: ${x.dispatchId ?? '?'} em ${x.state ?? 'estado desconhecido'}`);
  // limpa e empurrada
  let branch = null; let head = null; let base = 'origin/main';
  if (!pasta || !existsSync(pasta)) { condicoes.limpa = false; faltam.push(`a worktree ${pasta ?? '(sem pasta)'} não existe`); }
  else {
    try {
      // o checkout principal não é a worktree de uma dona: marcá-lo completed ou removê-lo apagaria o projeto
      if (gitDe(pasta, ['rev-parse', '--path-format=absolute', '--git-dir']) === gitDe(pasta, ['rev-parse', '--path-format=absolute', '--git-common-dir'])) {
        condicoes.worktree = false; faltam.push(`a pasta ${pasta} é o checkout principal, não uma worktree ligada`);
      }
      branch = gitDe(pasta, ['branch', '--show-current']) || null;
      head = gitDe(pasta, ['rev-parse', 'HEAD']);
      try { base = gitDe(pasta, ['rev-parse', '--abbrev-ref', 'origin/HEAD']) || base; } catch { /* sem origin/HEAD: origin/main */ }
      const sujos = gitDe(pasta, ['status', '--porcelain']);
      const semPush = gitDe(pasta, ['rev-list', 'HEAD', '--not', '--remotes']);
      condicoes.limpa = !sujos && !semPush;
      if (sujos) faltam.push(`a worktree não está limpa (arquivo sem commit): ${sujos.split('\n').slice(0, 3).join('; ')}`);
      if (semPush) faltam.push(`commit sem push: ${semPush.split('\n').length} commit(s) só na worktree`);
    } catch (e) { condicoes.limpa = false; faltam.push(`git na worktree falhou: ${String(e?.stderr || e?.message || e).trim().slice(0, 200)}`); }
  }
  // o item: o pedido, senão o que tem a branch da worktree
  const itens = itensDaFila();
  let item = itemPedido;
  if (!item && branch) item = [...itens].find(([, d]) => d?.branch === branch)?.[0] ?? null;
  // PR mergeado com o HEAD da worktree, ou trabalho sem PR que não deixa commit fora da base ("não achei PR" não basta: a
  // dona que morreu antes do `gh pr create` deixa a branch empurrada e sem PR)
  if (!branch || !head) { condicoes.pr = false; faltam.push('a worktree não está numa branch: não dá para achar o PR'); }
  else {
    try {
      const saida = execFileSync(process.env.GH_BIN || 'gh', ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,headRefOid'], {
        cwd: pasta, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
      });
      const prs = JSON.parse(saida);
      if (!Array.isArray(prs)) throw new Error('a resposta não é uma lista');
      const pendentes = prs.filter((p) => p?.state !== 'MERGED');
      const mergeados = prs.filter((p) => p?.state === 'MERGED');
      for (const p of pendentes) faltam.push(p?.state === 'OPEN' ? `PR #${p.number} está aberto` : `PR #${p?.number} fechado sem merge`);
      let cobre = true;
      if (!prs.length) {
        let fora = null;
        try { fora = gitDe(pasta, ['rev-list', 'HEAD', '--not', base]); } catch (e) { faltam.push(`não achei a base ${base} para conferir o trabalho sem PR: ${String(e?.stderr || e?.message || e).trim().slice(0, 200)}`); cobre = false; }
        if (fora) { cobre = false; faltam.push(`sem PR e com ${fora.split('\n').length} commit(s) fora de ${base}: abra o PR ou confira com o operador`); }
      } else if (mergeados.length && !mergeados.some((p) => p?.headRefOid === head)) {
        cobre = false;
        faltam.push(`commit depois do PR #${mergeados.map((p) => p?.number).join(', #')} mergeado: o HEAD ${head.slice(0, 12)} não entrou em PR`);
      }
      condicoes.pr = pendentes.length === 0 && cobre;
    } catch (e) { condicoes.pr = false; faltam.push(`o gh não respondeu sobre os PRs da branch ${branch}: ${String(e?.stderr || e?.message || e).trim().slice(0, 200)}`); }
  }
  // nenhuma pergunta aberta do item esperando o operador (a assumida não segura o worker): a que traz o item, a de quem trabalhou nele (o painel só exige o sessaoId
  // na pergunta) e a que o título nomeia
  if (!item) { condicoes.perguntas = false; faltam.push('não achei o item da worktree: passe --item F<n>'); }
  else {
    const d0 = itens.get(item) ?? {};
    const dela = new Set([d0.donoLocalId, d0.donaAoFechar?.donoLocalId, ...[d0.com, d0.donaAoFechar?.com].flatMap((c) => (Array.isArray(c) ? c.map((x) => x?.localId) : []))].filter(textoNaoVazio));
    const doTitulo = new RegExp(`^${item}(?!\\d)`);
    const dir = caminho('perguntas');
    const abertas = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).flatMap((n) => {
      try {
        const d = JSON.parse(readFileSync(join(dir, n), 'utf8'));
        const p = d?.data ?? {};
        // só a aberta espera o operador: a assumida já seguiu com a recomendação e a resposta vai à orquestradora
        if ((p.estado ?? p.status) !== 'aberta') return [];
        const doItem = p.item ? p.item === item : (dela.has(p.sessaoId) || doTitulo.test(String(p.titulo ?? '').trim()));
        return doItem ? [d.id] : [];
      } catch { return []; }
    }) : [];
    condicoes.perguntas = abertas.length === 0;
    if (abertas.length) faltam.push(`pergunta aberta do ${item}: ${abertas.join(', ')}`);
  }
  return { condicoes, faltam, pasta, terminal, item };
}

function orcaMutante(args) {
  const bin = moduloOrca.binarioDoOrca();
  const r = spawnSync(bin, [...args, '--json'], { encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] });
  let d = null;
  try { d = JSON.parse(r.stdout); } catch { /* sem JSON */ }
  const ok = !r.error && r.status === 0 && d?.ok !== false;
  return { comando: `orca ${args.join(' ')}`, ok, ...(ok ? {} : { erro: String(r.error?.message || r.stderr || r.stdout || '').trim().slice(0, 300) }) };
}

// `orquestradora arquivar <ctx_…> [--item F<n>] [--remover-worktree] [--seco]`: as condições de "Arquivar sessão que terminou"
// lidas no Orca. Todas valendo: `worker-release` (fecha o terminal) e `worktree set --workspace-status completed`; com
// --remover-worktree, também `worktree rm` (nunca --force). Faltando qualquer uma, não chama nada e diz qual faltou (exit 1).
function arquivarNoOrca(args) {
  const seco = flag(args, '--seco', false);
  const remover = flag(args, '--remover-worktree', false);
  const concluidas = flag(args, '--concluidas', false);
  const itemPedido = flag(args, '--item');
  const itensPedidos = flag(args, '--itens');
  if (itemPedido !== null && !/^F\d+$/.test(itemPedido)) throw new Error(`--item pede F<n>, veio ${JSON.stringify(itemPedido)}`);
  if (concluidas) {
    if (itemPedido !== null || args.length) throw new Error('uso: painel.mjs orquestradora arquivar --concluidas [--itens F<n>,F<n>] [--remover-worktree] [--seco] (sem --item nem despacho)');
    return arquivarConcluidas(itensPedidos, seco, remover);
  }
  if (itensPedidos !== null) throw new Error('--itens vale só com --concluidas');
  const [dispatchId, ...sobra] = args;
  if (!/^ctx_[\w-]+$/.test(String(dispatchId ?? ''))) throw new Error('uso: painel.mjs orquestradora arquivar <ctx_…> [--item F<n>] [--remover-worktree] [--seco] | arquivar --concluidas [--itens F<n>,F<n>] [--remover-worktree] [--seco]');
  if (sobra.length) throw new Error(`argumento desconhecido: ${sobra[0]}`);
  const lista = listaDoOrca();
  if (lista === null) throw new Error('orquestradora arquivar: sem orca nesta máquina (o arquivar do Orca precisa do orca worker-list)');
  if (lista.erro) return { arquivado: false, dispatchId, faltam: [`não li o Orca: ${lista.erro}`], condicoes: {} };
  return arquivarUm({ dispatchId, itemPedido, remover, seco, lista });
}

// Confere as condições de UM despacho (`condicoesDeArquivar`) e, valendo e sem --seco, solta o worker e marca a worktree.
function arquivarUm({ dispatchId, itemPedido, remover, seco, lista }) {
  const { condicoes, faltam, pasta, item } = condicoesDeArquivar(dispatchId, itemPedido, lista);
  const base = { dispatchId, item, pasta, condicoes };
  if (faltam.length) return { arquivado: false, ...base, faltam };
  if (seco) return { arquivado: false, seco: true, ...base, faltam: [], chamaria: ['worker-release', 'worktree set', ...(remover ? ['worktree rm'] : [])] };
  const feitos = [];
  for (const a of [
    ['orchestration', 'worker-release', '--dispatch', dispatchId],
    ['worktree', 'set', '--worktree', `path:${pasta}`, '--workspace-status', 'completed'],
    ...(remover ? [['worktree', 'rm', '--worktree', `path:${pasta}`]] : []),
  ]) {
    const r = orcaMutante(a);
    feitos.push(r);
    if (!r.ok) return { arquivado: false, ...base, faltam: [`${r.comando} falhou: ${r.erro}${feitos.length > 1 ? ` (já feito: ${feitos.slice(0, -1).map((f) => f.comando).join('; ')})` : ''}`], feitos };
  }
  return { arquivado: true, ...base, feitos };
}

// F469: as sessões donas CONCLUÍDAS (item `feito`/`descartado`) que ainda têm worker no Orca. O item se acha pela branch da
// worktree ou pela sessão que o trabalhou (orca-sessoes/: terminal ou pasta iguais). Quem decide é `arquivarUm`, com as
// mesmas condições do `arquivar <ctx_…>`; aqui só se escolhe quem vai a ela. → [{ item, titulo, dispatchId }]
function candidatasConcluidas(lista, itens) {
  const finais = [...itens].filter(([, d]) => ETAPAS_FINAIS.has(d?.etapa));
  const sessoesDe = (d) => [d.donoLocalId, d.donaAoFechar?.donoLocalId, ...[d.com, d.donaAoFechar?.com].flatMap((c) => (Array.isArray(c) ? c.map((x) => x?.localId) : []))]
    .filter((id) => typeof id === 'string' && id.startsWith('orca_session_id:'));
  const registrosDe = (d) => sessoesDe(d).flatMap((s) => { try { const r = moduloOrca.lerSessaoDoOrca(s); return r ? [r] : []; } catch { return []; } });
  const registros = new Map(finais.map(([id, d]) => [id, registrosDe(d)]));
  // Dona reaproveitada: a sessão (ou a branch) que também trabalha um item AINDA VIVO não é concluída, mesmo que o item fechado a tenha usado antes.
  const vivos = [...itens].filter(([, d]) => d && !ETAPAS_FINAIS.has(d.etapa)).map(([, d]) => ({ branch: d.branch, registros: registrosDe(d) }));
  const casa = (w, branch, d, regs) => (branch && d.branch === branch)
    || regs.some((r) => (w.terminal && r.terminal === w.terminal) || (r.cwd && moduloOrca.dentroDe(r.cwd, w.pasta) && moduloOrca.dentroDe(w.pasta, r.cwd)));
  const vistas = new Set();
  const saida = [];
  for (const w of lista.workers) {
    if (!w.dispatchId || !w.pasta || !moduloOrca.estadoFinal(w.state) || vistas.has(w.pasta) || !existsSync(w.pasta)) continue;
    let branch = null;
    try { branch = gitDe(w.pasta, ['branch', '--show-current']) || null; } catch { /* pasta sem git: só o registro da sessão acha o item */ }
    if (vivos.some((v) => casa(w, branch, v, v.registros))) continue;
    const achado = finais.find(([id, d]) => casa(w, branch, d, registros.get(id)));
    if (!achado || saida.some((x) => x.item === achado[0])) continue;
    vistas.add(w.pasta);
    saida.push({ item: achado[0], titulo: textoNaoVazio(achado[1].titulo) ? achado[1].titulo : achado[0], dispatchId: w.dispatchId });
  }
  return saida.sort((a, b) => Number(a.item.slice(1)) - Number(b.item.slice(1)));
}

// `arquivar --concluidas [--itens F1,F2] [--remover-worktree] [--seco]`: a cada concluída, o mesmo `arquivarUm` do despacho avulso
// (a flag vale como no despacho avulso: `worktree rm`, nunca --force; sem a flag a worktree fica). --itens limita ao que a pessoa viu e confirmou; um item fora das concluídas é recusado.
function arquivarConcluidas(itensPedidos, seco, remover) {
  const pedidos = itensPedidos === null ? null : itensPedidos.split(',').map((x) => x.trim());
  if (pedidos && (!pedidos.length || pedidos.some((x) => !/^F\d+$/.test(x)))) throw new Error(`--itens pede F<n>,F<n>, veio ${JSON.stringify(itensPedidos)}`);
  const lista = listaDoOrca();
  if (lista === null) throw new Error('orquestradora arquivar: sem orca nesta máquina (o arquivar do Orca precisa do orca worker-list)');
  if (lista.erro) return { seco, aptas: [], arquivadas: [], recusadas: [], erro: `não li o Orca: ${lista.erro}` };
  const candidatas = candidatasConcluidas(lista, itensDaFila());
  const escolhidas = pedidos ? candidatas.filter((c) => pedidos.includes(c.item)) : candidatas;
  const aptas = [];
  const arquivadas = [];
  const recusadas = pedidos ? pedidos.filter((i) => !candidatas.some((c) => c.item === i)).map((item) => ({ item, titulo: item, faltam: [`${item} não é uma sessão concluída com worker no Orca`] })) : [];
  for (const c of escolhidas) {
    const r = arquivarUm({ dispatchId: c.dispatchId, itemPedido: c.item, remover, seco, lista });
    const dados = { item: c.item, titulo: c.titulo, dispatchId: c.dispatchId };
    if (r.arquivado) arquivadas.push(dados);
    else if (r.seco) aptas.push(dados);
    else recusadas.push({ ...dados, faltam: r.faltam });
  }
  return { seco, aptas, arquivadas, recusadas };
}

// F479: `orquestradora retomar F<n> --dispatch <ctx novo> [--esperar <s>] [--seco]`. No Orca, a dona que para por limite de uso
// (ou troca de sessão por contexto cheio) termina `stopped/failed`, e a orquestradora abre outra sessão na mesma worktree. O item
// passa a ela aqui, sem depender de a sessão nova se regravar: `donoLocalId`, o `com` sem as sessões paradas da worktree, a nova
// em `sessoes` e o `sessaoId` das perguntas que esperam resposta (o endereço de entrega se rederiva). Solta os despachos parados
// da worktree que ficaram com o terminal preso, e lê de volta. Recusa (sem gravar nem chamar o orca) o despacho novo que não está
// vivo, o item de outra worktree e a worktree com outra sessão viva: duas donas na mesma pasta.
const parouDeVez = (w) => moduloOrca.estadoFinal(w?.state) || String(w?.state ?? '').toLowerCase() === 'stopped';
const trabalhando = (w) => w?.vivo === true && !parouDeVez(w);
function registrosDoOrca() {
  const dir = moduloOrca.pastaDasSessoesDoOrca();
  let nomes = [];
  try { nomes = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return []; }
  return nomes.flatMap((n) => { try { const r = moduloOrca.lerSessaoDoOrca(`orca_session_id:${n.slice(0, -5)}`); return r ? [r] : []; } catch { return []; } });
}
function retomarNoOrca(args) {
  const uso = 'uso: painel.mjs orquestradora retomar F<n> --dispatch <ctx_…> [--esperar <s>] [--seco]';
  const seco = flag(args, '--seco', false);
  const dispatchId = flag(args, '--dispatch');
  const esperar = flag(args, '--esperar');
  const [F, ...sobra] = args;
  if (!/^F\d+$/.test(String(F ?? '')) || !/^ctx_[\w-]+$/.test(String(dispatchId ?? ''))) throw new Error(uso);
  if (sobra.length) throw new Error(`argumento desconhecido: ${sobra[0]} (${uso})`);
  const prazoS = esperar === null ? 60 : Number(esperar);
  if (!Number.isFinite(prazoS) || prazoS < 0) throw new Error(`--esperar pede segundos (0 ou mais), veio ${JSON.stringify(esperar)}`);
  const item0 = ler('fila', F);
  if (!item0) throw new Error(`retomar: fila/${F} não existe`);
  if (ETAPAS_FINAIS.has(item0.data?.etapa)) throw new Error(`retomar: ${F} está em etapa final (${item0.data.etapa}); não há dona a passar`);
  const lista = listaDoOrca();
  if (lista === null) throw new Error('retomar: sem orca nesta máquina (a retomada do Orca precisa do orca worker-list)');
  if (lista.erro) throw new Error(`retomar: não li o Orca: ${lista.erro}`);
  const novo = lista.workers.find((w) => w.dispatchId === dispatchId);
  if (!novo) throw new Error(`retomar: o despacho ${dispatchId} não está no orca worker-list`);
  if (!trabalhando(novo) || !novo.terminal) throw new Error(`retomar: o despacho ${dispatchId} não está vivo (${novo.state ?? '?'}, terminal ${novo.terminalState ?? '?'}): abra a sessão nova antes`);
  const pasta = novo.pasta;
  if (!pasta || !existsSync(pasta)) throw new Error(`retomar: a worktree ${pasta ?? '(sem pasta)'} do despacho ${dispatchId} não existe`);
  // A sessão nova se acha pelo terminal do despacho, no registro que o início da sessão grava (segundos depois do worker-start).
  const limite = Date.now() + prazoS * 1000;
  let reg = null;
  for (;;) {
    reg = registrosDoOrca().filter((r) => r.terminal === novo.terminal).sort((a, b) => String(b.em ?? '').localeCompare(String(a.em ?? '')))[0] ?? null;
    if (reg || Date.now() >= limite) break;
    dormir(Math.min(1000, Math.max(0, limite - Date.now())));
  }
  if (!reg) throw new Error(`retomar: a sessão nova do despacho ${dispatchId} ainda não gravou o registro em orca-sessoes/ (terminal ${novo.terminal}); rode de novo depois do primeiro turno dela`);
  if (!moduloOrca.dentroDe(reg.cwd, pasta)) throw new Error(`retomar: o registro da sessão nova (${reg.orcaId}) está em ${reg.cwd ?? '(sem pasta)'}, fora da worktree ${pasta}`);
  const NOVA = reg.orcaId;
  // Outra sessão trabalhando na mesma worktree: não se sabe qual é a dona; não passa nada.
  const outros = lista.workers.filter((w) => w.terminal !== novo.terminal && w.pasta && moduloOrca.dentroDe(w.pasta, pasta) && trabalhando(w));
  let branch = null;
  try { branch = gitDe(pasta, ['branch', '--show-current']) || null; } catch { /* sem branch: o item se liga pelas sessões */ }
  const registroDe = (id) => { try { return moduloOrca.lerSessaoDoOrca(id); } catch { return null; } };
  const naWorktree = (id) => { const r = registroDe(id); return Boolean(r?.cwd && moduloOrca.dentroDe(r.cwd, pasta)); };
  // Sem registro, a sessão morreu (o limpador apaga o de terminal solto) e não se sabe a pasta: conta como desta worktree, já que o
  // item é dela. Com registro em outra pasta, é de outro lugar (quem ajuda de outra worktree fica).
  const saiDaqui = (id) => { const r = registroDe(id); return !r || Boolean(r.cwd && moduloOrca.dentroDe(r.cwd, pasta)); };
  const doOrca = (id) => textoNaoVazio(id) && String(id).startsWith('orca_session_id:');
  // A branch da worktree segue `f<n>-…` (o item a nomeia); o campo `branch` do item quase nunca está gravado.
  const branchDoItem = Boolean(branch && new RegExp(`^${F.toLowerCase()}(?:-|$)`).test(branch.toLowerCase()));
  const vivaAinda = (id) => { const r = registroDe(id); return Boolean(r?.terminal) && lista.workers.some((w) => w.terminal === r.terminal && trabalhando(w)); };
  const liberar = lista.workers.filter((w) => w.terminal !== novo.terminal && w.dispatchId && w.pasta && moduloOrca.dentroDe(w.pasta, pasta) && w.vivo && parouDeVez(w)).map((w) => w.dispatchId);

  const plano = () => {
    const d = ler('fila', F)?.data ?? {};
    if (ETAPAS_FINAIS.has(d.etapa)) throw new Error(`retomar: ${F} está em etapa final (${d.etapa}); não há dona a passar`);
    const com = Array.isArray(d.com) ? d.com : [];
    const sessoes = Array.isArray(d.sessoes) ? d.sessoes : [];
    const ligado = branchDoItem || d.donoLocalId === NOVA || [d.donoLocalId, ...com.map((c) => c?.localId)].some((id) => textoNaoVazio(id) && naWorktree(id)) || Boolean(branch && d.branch === branch);
    if (!ligado) throw new Error(`retomar: ${F} não é da worktree ${pasta} (a branch dela, ${branch ?? '(sem branch)'}, não é f${F.slice(1)}-…, e nem a dona, nem quem está no com, nem a branch ${d.branch ?? '(sem branch)'} do item apontam para ela)`);
    // As que saem: a dona gravada (quem a nova substitui) e as sessões do Orca do item (com e sessoes) desta worktree ou sem registro.
    const antigas = new Set([d.donoLocalId, ...[...com.map((c) => c?.localId), ...sessoes].filter((id) => doOrca(id) && saiDaqui(id))].filter((id) => textoNaoVazio(id) && id !== NOVA));
    const vivas = [...antigas].filter(vivaAinda);
    if (vivas.length) throw new Error(`retomar: a sessão ${vivas.join(', ')} ainda está viva: duas donas na mesma worktree; solte a antiga antes`);
    if (outros.length) throw new Error(`retomar: a worktree ${pasta} tem outro despacho que ainda está vivo (${outros.map((w) => w.dispatchId).join(', ')}): solte-o ou confira qual é a dona`);
    const herdado = com.find((c) => c?.localId === d.donoLocalId)?.oQue ?? com.find((c) => antigas.has(c?.localId))?.oQue ?? d.titulo ?? F;
    const comNovo = com.filter((c) => !antigas.has(c?.localId));
    if (!comNovo.some((c) => c?.localId === NOVA)) comNovo.push({ localId: NOVA, apelido: 'dona', oQue: herdado });
    const data = {};
    if (d.donoLocalId !== NOVA || d.donoApelido !== 'dona') Object.assign(data, { donoLocalId: NOVA, donoApelido: 'dona' });
    if (JSON.stringify(comNovo) !== JSON.stringify(com)) data.com = comNovo;
    if (!sessoes.includes(NOVA)) data.sessoes = [...sessoes, NOVA];
    const dir = caminho('perguntas');
    const perguntas = antigas.size && existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).flatMap((n) => {
      try {
        const doc = JSON.parse(readFileSync(join(dir, n), 'utf8'));
        const p = doc?.data ?? {};
        if (!ESPERA_ENTREGA.has(p.estado ?? p.status) || !antigas.has(p.sessaoId) || (p.item && p.item !== F)) return [];
        // o endereço explícito a um despacho parado da worktree também morreu: volta a ser o da sessão nova
        const doDespachoVelho = /^dispatch:/.test(String(p.endereco?.orca ?? '')) && liberar.concat(lista.workers.filter((w) => w.pasta && moduloOrca.dentroDe(w.pasta, pasta) && parouDeVez(w)).map((w) => w.dispatchId)).includes(p.endereco.orca.slice(9));
        return [{ id: doc.id, de: p.sessaoId, data: { sessaoId: NOVA, ...(doDespachoVelho ? { endereco: null } : {}) } }];
      } catch { return []; }
    }) : [];
    // `de`: quem de fato saiu (a dona trocada, quem saiu do com, o dono das perguntas que passaram); `sessoes` guarda todas (custo)
    const de = [...antigas].filter((id) => id === d.donoLocalId || com.some((c) => c?.localId === id) || perguntas.some((q) => q.de === id));
    return { de, data, perguntas };
  };

  if (seco) {
    const p = plano();
    return { seco: true, item: F, dispatchId, pasta, para: NOVA, de: p.de, grava: p.data, perguntas: p.perguntas.map((q) => q.id), liberaria: liberar };
  }
  const feito = comTrava(() => {
    const p = plano();
    const vista = new Map();
    const ops = [
      ...(Object.keys(p.data).length ? [{ op: 'update', colecao: 'fila', id: F, data: p.data, [VIA_COM]: true }] : []),
      ...p.perguntas.map((q) => ({ op: 'update', colecao: 'perguntas', id: q.id, data: q.data })),
    ];
    ops.map((o) => planejar(o, undefined, vista)).forEach(efetivar);
    return p;
  });
  const liberados = []; const falhas = [];
  for (const ctx of liberar) {
    const r = orcaMutante(['orchestration', 'worker-release', '--dispatch', ctx]);
    if (r.ok) liberados.push(ctx); else falhas.push(`${r.comando} falhou: ${r.erro}`);
  }
  // lê de volta
  const d = ler('fila', F)?.data ?? {};
  const faltam = [];
  if (d.donoLocalId !== NOVA) faltam.push(`o item ficou com donoLocalId ${d.donoLocalId ?? 'null'}`);
  if (!(Array.isArray(d.com) && d.com.some((c) => c?.localId === NOVA))) faltam.push('a sessão nova não está no com');
  for (const q of feito.perguntas) {
    const lida = ler('perguntas', q.id)?.data;
    if (lida?.sessaoId !== NOVA) faltam.push(`${q.id} ficou com sessaoId ${lida?.sessaoId ?? 'null'}`);
  }
  const conferido = faltam.length === 0;
  return { item: F, dispatchId, pasta, para: NOVA, de: feito.de, perguntas: feito.perguntas.map((q) => q.id), liberados, conferido, ...(faltam.length ? { faltam } : {}), ...(falhas.length ? { falhas } : {}) };
}

function comandoOrquestradora(args) {
  const [sub, ...resto] = args;
  if (!regras) throw new Error(`orquestradora: não consegui carregar ${POOL_COMUM}`);
  if (sub === 'assumir') {
    if (resto.length) throw new Error(`argumento desconhecido: ${resto[0]}`);
    return assumir();
  }
  if (sub === 'arquivar') return arquivarNoOrca(resto);
  if (sub === 'retomar') return retomarNoOrca(resto);
  throw new Error('uso: painel.mjs orquestradora assumir | orquestradora arquivar <ctx_…> [--item F<n>] [--remover-worktree] [--seco] | orquestradora retomar F<n> --dispatch <ctx_…> [--esperar <s>] [--seco]');
}

const MARCA_DA_MIGRACAO = () => join(BASE, '.migracao-F183');
// Painel novo (ou que nunca precisou da migração): sem nada a migrar, a marca nasce aqui e a batida passa a arquivar.
// Enquanto há o que migrar, cada batida confere de novo (lê o painel inteiro) e não move nada.
function migracaoFeita() {
  if (existsSync(MARCA_DA_MIGRACAO())) return true;
  // conferência barata (sem o registro do app): algum projeto fora do slug, ou pergunta repetida entre a pasta quente e o arquivo
  const dir = caminho('perguntas');
  const vistos = new Set();
  const arquivos = [
    ...(existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => join(dir, n)) : []),
    ...arq.arquivadas(dir),
    ...['sessoes', 'fila', 'cartoes'].flatMap((c) => (existsSync(caminho(c)) ? readdirSync(caminho(c)).filter((n) => n.endsWith('.json')).map((n) => join(caminho(c), n)) : [])),
  ];
  for (const f of arquivos) {
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    const pergunta = f.startsWith(dir);
    if (pergunta && vistos.has(doc?.id)) return false;
    if (pergunta) vistos.add(doc?.id);
    const p = doc?.data?.projeto; // `null` gravado por set conta como ausente, como na migração
    if ((p == null && (pergunta || f.startsWith(caminho('sessoes')))) || (p != null && !arq.SLUG.test(String(p)))) return false;
  }
  writeFileSync(MARCA_DA_MIGRACAO(), `${JSON.stringify({ em: new Date().toISOString(), semMigrar: true })}\n`);
  return true;
}

// F183, migração única: `projeto` em slug nas quatro coleções; a pergunta sem projeto ganha o da sessão dela (sessoes/<sessaoId>,
// senão o registro do app), e o resto `sem-projeto`; a sessão sem projeto, pelo registro do app, senão `sem-projeto`. Depois
// arquiva as fechadas. Sem `seco`, copia o painel inteiro para <BASE>/../backups/F183-<data>/ antes de gravar.
function migrarProjetos(seco) {
  const doRegistro = (localId) => {
    if (!regras || !localId) return null;
    try { const reg = regras.registroDaSessao(localId, { fresco: true }); return reg ? arq.slugDoProjeto(regras.projetoDaSessao(reg)?.nome) : null; } catch { return null; }
  };
  // As perguntas incluem o arquivo: uma passada de `perguntas arquivar` antes da migração não as esconde dela.
  const docs = (colecao) => {
    const dir = caminho(colecao);
    if (!existsSync(dir)) return [];
    const arquivos = [...readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => join(dir, n)), ...(colecao === 'perguntas' ? arq.arquivadas(dir) : [])];
    return arquivos.flatMap((f) => {
      try { return [{ f, doc: JSON.parse(readFileSync(f, 'utf8')) }]; } catch { process.stderr.write(`aviso: ${f} ilegível, ficou como está\n`); return []; }
    });
  };
  // A corrida com o pane pode deixar a mesma pergunta na pasta quente e no arquivo: fica a de `version` maior (empate: a
  // atualizada por último); as outras saem (estão no backup) e vão em `duplicadas`.
  const peso = ({ doc }) => [doc?.version ?? 0, Date.parse(doc?.data?.atualizadoEm ?? doc?.data?.respondidaEm ?? '') || 0];
  const maior = (a, b) => { const [va, ta] = peso(a); const [vb, tb] = peso(b); return va !== vb ? va > vb : ta >= tb; };
  const porId = new Map();
  const duplicadas = [];
  for (const c of docs('perguntas')) {
    const outra = porId.get(c.doc.id);
    if (!outra) { porId.set(c.doc.id, c); continue; }
    const [fica, sai] = maior(c, outra) ? [c, outra] : [outra, c];
    porId.set(c.doc.id, fica);
    duplicadas.push({ id: c.doc.id, sai: sai.f, fica: fica.f });
  }
  const sessoes = docs('sessoes');
  const projetoDaSessao = new Map(sessoes.map(({ doc }) => [doc?.data?.sessionId ?? doc?.id, arq.slugDoProjeto(doc?.data?.projeto)]));
  const novos = [];
  for (const colecao of ['perguntas', 'sessoes', 'fila', 'cartoes']) {
    for (const { f, doc } of colecao === 'sessoes' ? sessoes : colecao === 'perguntas' ? porId.values() : docs(colecao)) {
      const d = doc?.data ?? {};
      let novo = arq.slugDoProjeto(d.projeto);
      if (!novo && colecao === 'perguntas') {
        const sid = [d.sessaoId, d.sessao].find((v) => ehIdDeSessao(v));
        novo = (sid && (projetoDaSessao.get(sid) || doRegistro(sid))) || arq.SEM_PROJETO;
      }
      if (!novo && colecao === 'sessoes') novo = doRegistro(d.sessionId ?? doc.id) || arq.SEM_PROJETO;
      const muda = Boolean(novo) && novo !== d.projeto;
      const data = muda ? { ...d, projeto: novo } : d;
      // a pergunta vai para o lugar do estado e do projeto (pasta quente, ou o arquivo do projeto certo)
      const destino = colecao === 'perguntas' ? arq.lugarDe(caminho('perguntas'), doc.id, data) : f;
      if (muda || destino !== f) novos.push({ colecao, f, doc, data, destino, muda, projeto: novo });
    }
  }
  const chave = (n) => (n.colecao === 'perguntas' ? n.doc.id : `${n.colecao}/${n.doc.id}`);
  const projetos = Object.fromEntries(novos.filter((n) => n.muda).map((n) => [chave(n), n.projeto]));
  const quente = caminho('perguntas');
  const arquivadas = novos.filter((n) => n.colecao === 'perguntas' && dirname(n.f) === quente && n.destino !== n.f).map((n) => n.doc.id);
  if (seco) return { seco: true, projeto: projetos, arquivadas, duplicadas };
  const backup = join(BASE, '..', 'backups', `F183-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(dirname(backup), { recursive: true });
  cpSync(BASE, backup, { recursive: true, filter: (src) => !src.startsWith(TRAVA) });
  for (const d of duplicadas) rmSync(d.sai, { force: true });
  for (const n of novos) {
    if (n.muda) gravarEm(n.destino, n.doc.id, n.data, (n.doc.version ?? 0) + 1);
    else { mkdirSync(dirname(n.destino), { recursive: true }); renameSync(n.f, n.destino); }
    if (n.muda && n.destino !== n.f) rmSync(n.f, { force: true });
  }
  writeFileSync(MARCA_DA_MIGRACAO(), `${JSON.stringify({ em: new Date().toISOString(), backup })}\n`);
  return { seco: false, backup, projeto: projetos, arquivadas, duplicadas };
}

// F478: `perguntas nova '<json>'` — a pergunta nasce num passo só: valida (as regras do `set`), reserva o Q-ID pelo
// proxima-pergunta.sh (o mesmo contador e a mesma trava), grava, relê e imprime só o ID. A recusa não gasta número;
// a falha depois de reservar diz qual Q-ID ficou sem arquivo.
const ESTADOS_DE_PERGUNTA_NOVA = ['aberta', 'assumida'];
const PROXIMA_PERGUNTA = join(dirname(fileURLToPath(import.meta.url)), 'proxima-pergunta.sh');
function perguntaNova(args) {
  if (args.length !== 1) throw new Error("uso: painel.mjs perguntas nova '<json>' (titulo, caso, recomendacao e, na aberta, seNaoDecidir; sessaoId padrão: a sessão que chama; estado padrão: aberta)");
  const dados = objeto(args[0], 'perguntas nova');
  if ('id' in dados) throw new Error('perguntas nova: o JSON não leva id (o Q-ID sai do contador)');
  dados.estado ??= 'aberta';
  if (!ESTADOS_DE_PERGUNTA_NOVA.includes(dados.estado)) throw new Error(`perguntas nova: estado ${JSON.stringify(dados.estado)}; a pergunta nasce ${ESTADOS_DE_PERGUNTA_NOVA.join(' ou ')}`);
  if (dados.sessaoId === undefined || dados.sessaoId === null) {
    const eu = quemSou();
    if (!eu) throw new Error('perguntas nova: sem sessaoId e sem como saber a sessão que chama; grave sessaoId (local_… ou orca_session_id:…)');
    dados.sessaoId = eu;
  }
  if (!ehIdDeSessao(dados.sessaoId)) throw new Error(`perguntas nova: sessaoId ${JSON.stringify(dados.sessaoId)} ${NAO_E_SESSAO}`);
  const obrigatorios = ['titulo', 'caso', 'recomendacao', ...(dados.estado === 'aberta' ? ['seNaoDecidir'] : [])];
  const falta = obrigatorios.find((k) => !textoNaoVazio(dados[k]));
  if (falta) throw new Error(`perguntas nova: ${falta} é obrigatório (a pergunta vem inteira: o caso, o que acontece se não decidir e a recomendação)`);
  planejar({ op: 'set', colecao: 'perguntas', id: 'nova', data: dados }, undefined, new Map());
  let q;
  try {
    q = execFileSync('bash', [PROXIMA_PERGUNTA], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error(`perguntas nova: não reservei o Q-ID (${String(e.stderr || e.message).trim()}); nada gravado`);
  }
  if (!/^Q[1-9]\d*$/.test(q)) throw new Error(`perguntas nova: o contador devolveu ${JSON.stringify(q)}; nada gravado`);
  try {
    if (ler('perguntas', q)) throw new Error(`${q} já existe no painel (o contador está atrás do painel)`);
    aplicarLote([[{ op: 'set', colecao: 'perguntas', id: q, data: dados }, 0]]); // versão 0 = só se não existe, conferido dentro da trava
    const gravada = ler('perguntas', q)?.data;
    if (gravada?.estado !== dados.estado || gravada?.sessaoId !== dados.sessaoId) throw new Error('o arquivo relido não traz o estado e o sessaoId gravados');
  } catch (e) {
    throw new Error(`perguntas nova: ${q} ficou reservado e NÃO foi gravado (${e.message}); não o use na mensagem`);
  }
  // Onde o operador a acha: a aberta na seção Perguntas, a assumida em Decisões (a confirmar). Vai ao stderr: o stdout é só o ID.
  process.stderr.write(`${q} gravada: o operador a acha em ${dados.estado === 'assumida' ? 'Decisões (a confirmar)' : 'Perguntas'}; diga isso ao citá-la\n`);
  return q;
}

function comandoPerguntas(args) {
  const seco = flag(args, '--seco', false);
  const [sub, ...sobra] = args;
  if (sobra.length || !['arquivar', 'migrar'].includes(sub)) throw new Error('uso: painel.mjs perguntas arquivar|migrar [--seco]');
  if (sub === 'arquivar') return { seco, arquivadas: seco ? arquivarFechadas(true) : comTrava(() => arquivarFechadas(false)) };
  return seco ? migrarProjetos(true) : comTrava(() => migrarProjetos(false));
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
      if (is >= 0 && !sessao) throw new Error('--sessao pede o local_… da sessão (ou o orca_session_id:…)');
      const it = resto.indexOf('--todos'); if (it >= 0) resto.splice(it, 1);
      const ia = resto.indexOf('--arquivo'); if (ia >= 0) resto.splice(ia, 1);
      let prazoMin = null;
      if (a === 'fila') {
        const iv = resto.indexOf('vencidos', 1);
        if (iv >= 0) { resto.splice(iv, 1); prazoMin = prazoEmMin(resto); resto.splice(1, 0, 'vencidos'); }
        else if (resto.includes('--min')) throw new Error('--min só vale com `list fila vencidos`');
        const flag = resto.slice(1).find((x) => String(x).startsWith('--'));
        if (flag) throw new Error(`list fila: flag desconhecida "${flag}"`);
        const filtro = resto[1];
        // os `estado` do contrato antigo ainda filtram (documento sem `etapa`); fora desta lista, o filtro é erro de digitação
        const validos = ['em-andamento', 'vencidos', 'sem-dona', ...ETAPAS, 'aberto', 'bloqueado', 'concluido', 'concluida', 'em-planejamento', 'em-execucao', 'em-validacao'];
        if (filtro !== undefined && !validos.includes(filtro)) {
          throw new Error(`list fila: filtro desconhecido "${filtro}" (válidos: ${[...new Set(validos)].join(' · ')})`);
        }
      }
      const b = resto[1];
      const dir = caminho(a);
      // F183: `list perguntas` lê o projeto da pasta atual (sem `--todos`, `--projeto` nem `--sessao`) e só a pasta quente;
      // o filtro respondida/cancelada e `--arquivo` incluem o arquivo (do projeto pedido, ou de todos).
      let projetoDaLista = projeto;
      if (a === 'perguntas' && !projeto && it < 0 && !sessao) {
        const { projeto: doCwd, motivo } = projetoDoCwd();
        if (doCwd) projetoDaLista = doCwd;
        else process.stderr.write(`aviso: list perguntas sem projeto (${motivo}): listo todos\n`);
      }
      const doArquivo = a === 'perguntas' && (ia >= 0 || arq.FECHADAS.has(b)) ? arq.arquivadas(dir, { projeto: projetoDaLista ?? undefined }) : [];
      saida = existsSync(dir)
        ? [...readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => join(dir, n)), ...doArquivo]
            .map((f) => JSON.parse(readFileSync(f, 'utf8')))
            .filter((d) => (prazoMin !== null ? ehVencido(d.data, prazoMin * 60_000, Date.now()) : !b || (a === 'fila' && b === 'sem-dona') || filtraPorEstado(a, d.data, b)))
            .filter((d) => !projetoDaLista || (String(d.data?.projeto ?? '').toLowerCase() || arq.SEM_PROJETO) === projetoDaLista)
            .filter((d) => !sessao || d.data?.sessaoId === sessao)
            .map((d) => (a === 'fila' ? { ...d, semDona: semDona(d.data, Date.now()) } : d))
            .filter((d) => !(a === 'fila' && b === 'sem-dona') || d.semDona)
        : [];
      break;
    }
    case 'set':
    case 'update':
    case 'delete':
      // F433: argumento sobrando (opção que o painel não conhece) recusa antes de gravar ou apagar
      if (resto.length > (cmd === 'delete' ? 2 : 3)) throw new Error(`argumento desconhecido: ${resto[cmd === 'delete' ? 2 : 3]} (uso: painel.mjs ${cmd} <colecao> <id>${cmd === 'delete' ? '' : ' <json>'} [--se-versao N] [--de-outra])`);
      saida = aplicarLote([[{ op: cmd, colecao: a, id: b, data: c, deOutra }, seVersao]])[0];
      break;
    case 'temas':
      saida = comandoTemas(resto);
      break;
    case 'perguntas':
      if (a === 'nova') { process.stdout.write(`${perguntaNova(resto.slice(1))}\n`); return 0; }
      saida = comandoPerguntas(resto);
      break;
    case 'com':
      saida = comandoCom(resto);
      break;
    case 'soltar':
      saida = comandoSoltar(resto);
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
    case 'entregas':
      saida = comandoEntregas(resto);
      break;
    case 'custo':
      saida = comandoCusto(resto);
      break;
    case 'pode-reiniciar': {
      const { saida: r, comoJson } = comandoPodeReiniciar(resto);
      if (!comoJson) { process.stdout.write(textoDoReinicio(r)); return 0; }
      saida = r;
      break;
    }
    case 'fila-de-merge':
      saida = comandoFilaDeMerge(resto);
      break;
    case 'orquestradora':
      saida = comandoOrquestradora(resto);
      break;
    case 'batch': {
      const ops = JSON.parse(a);
      if (!Array.isArray(ops)) throw new Error('batch: esperava uma lista');
      saida = aplicarLote(ops.map((o) => [o, o?.seVersao === undefined ? undefined : Number(o.seVersao)]));
      break;
    }
    default:
      throw new Error('uso: painel.mjs get|list|set|update|delete|batch|temas|perguntas|com|soltar|batida|mergear|custo|entregas|pode-reiniciar|fila-de-merge|handoffs|orquestradora … (veja o cabeçalho do script)');
  }
  process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
  return (cmd === 'mergear' && saida.recusado) || (cmd === 'orquestradora' && saida.arquivado === false && !saida.seco) || (cmd === 'orquestradora' && Array.isArray(saida.recusadas) && saida.recusadas.length) || (cmd === 'orquestradora' && (saida.conferido === false || saida.falhas?.length)) ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`painel.mjs: ${err?.message || err}\n`);
  process.exitCode = 1;
}
