// `kit migrar-marketplace` (F344): troca as instalações do kit do marketplace `kit-de-orquestracao` para `ichikawa-kit`, na conta e
// nos projetos. O `marketplace update` não renomeia o registro de quem já tinha o kit (medido com o CLI real): só migra quem remove o
// antigo e adiciona de novo, e o `remove` apaga o liga/desliga, as opções e a pasta de dados dos plugins. Este comando guarda tudo
// isso antes, refaz pelo CLI e devolve. Seco por padrão; `--aplicar` grava, com backup; falha no meio desfaz sozinha;
// `--desfazer <pasta>` volta ao backup. Ambiente: CLAUDE_BIN (o executável do `claude`), CLAUDE_CONFIG_DIR, HOME.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pastaDeConfig } from '../gate/opcoes-do-plugin.mjs';
import { MARKETPLACE, MARKETPLACE_ANTIGO, REPASSES, REPO_DO_KIT, idNovoDe, repasse, semBom, serializar, trocarNomesDoKit } from './pacote.mjs';

const LONGO_MS = 300_000;
const ARQUIVOS_DO_PROJETO = ['.claude/settings.json', '.claude/settings.local.json'];

const lerJson = (arq) => { try { return JSON.parse(semBom(readFileSync(arq, 'utf8'))); } catch { return null; } };
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nomeDe = (id) => id.split('@')[0];
/** A pasta de dados do plugin (`CLAUDE_PLUGIN_DATA`): o id com o que não é `[A-Za-z0-9_-]` trocado por `-` (doc do Claude Code). */
const pastaDeDados = (C, id) => join(C, 'plugins', 'data', id.replace(/[^A-Za-z0-9_-]/g, '-'));
const vazia = (p) => { try { return readdirSync(p).length === 0; } catch { return true; } };

function claudeDe(env) {
  const bin = env.CLAUDE_BIN || 'claude';
  return (args, cwd) => {
    const r = spawnSync(bin, args, { encoding: 'utf8', cwd, env, timeout: LONGO_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.error?.code === 'ENOENT') throw new Error(`${bin} não encontrado no PATH`);
    if (r.signal === 'SIGKILL') throw new Error(`${bin} ${args.slice(0, 3).join(' ')} não respondeu em ${LONGO_MS / 1000} s`);
    return { status: r.status ?? 1, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
  };
}

/** O argumento do `marketplace add` para a origem registrada (`github` → `dono/repo`; `git`/`url` → a URL; `directory` → o caminho). */
function argumentoDaOrigem(source) {
  if (source?.source === 'github' && source.repo) return source.repo;
  if (['git', 'url'].includes(source?.source) && source.url) return source.url;
  if (source?.source === 'directory' && source.path) return source.path;
  return null;
}

/** Os projetos a olhar: os das instalações de escopo projeto, os de `--projeto` e os do `~/.claude.json` cujo settings cita o nome antigo. */
function projetosAOlhar(home, C, instalados, extras) {
  const caminhos = new Set(extras.map((p) => resolve(p)));
  for (const lista of Object.values(instalados)) for (const e of Array.isArray(lista) ? lista : []) if (typeof e?.projectPath === 'string') caminhos.add(e.projectPath);
  // a lista de projetos do Claude Code: em `~/.claude.json`, ou na pasta de configuração quando `CLAUDE_CONFIG_DIR` a muda
  for (const arq of [join(home, '.claude.json'), join(C, '.claude.json')]) for (const p of Object.keys(lerJson(arq)?.projects ?? {})) caminhos.add(p);
  const projetos = []; const vistos = new Set();
  for (const raiz of caminhos) {
    let real; try { real = realpathSync(raiz); } catch { continue; } // pasta que sumiu: nada a trocar
    if (vistos.has(real)) continue;
    vistos.add(real);
    // a pasta pessoal também é projeto no ~/.claude.json: o settings.json dela é o da conta, que o CLI troca
    let daConta = false; try { daConta = realpathSync(join(real, '.claude')) === realpathSync(C); } catch { /* sem .claude */ }
    if (daConta) continue;
    const arquivos = [];
    for (const rel of ARQUIVOS_DO_PROJETO) {
      const arq = join(raiz, rel);
      if (!existsSync(arq)) continue;
      const texto = readFileSync(arq, 'utf8');
      let s; try { s = JSON.parse(semBom(texto)); } catch { continue; } // ilegível: não é o kit quem conserta
      const trocas = trocarNomesDoKit(s);
      if (trocas.length) arquivos.push({ rel, arq, texto, novo: serializar(s, texto), trocas });
    }
    if (arquivos.length) projetos.push({ raiz, arquivos });
  }
  return projetos;
}

/** O nome e os plugins do manifesto no clone do marketplace (o que o `add` vai registrar). */
function publicado(clone) {
  const m = clone ? lerJson(join(clone, '.claude-plugin', 'marketplace.json')) : null;
  return { nomePublicado: m?.name ?? null, pluginsPublicados: Array.isArray(m?.plugins) ? m.plugins.map((p) => p?.name) : [] };
}

/** O que a migração faria, lido do disco (nada gravado). */
function planejar({ home, C, extras }) {
  const plugins = join(C, 'plugins');
  const conhecidos = lerJson(join(plugins, 'known_marketplaces.json')) ?? {};
  const instalados = lerJson(join(plugins, 'installed_plugins.json'))?.plugins ?? {};
  const conta = lerJson(join(C, 'settings.json')) ?? {};
  const antigo = conhecidos[MARKETPLACE_ANTIGO] ?? null;
  const novo = conhecidos[MARKETPLACE] ?? null;
  const daConta = []; const doProjeto = []; const semPasta = [];
  for (const [id, lista] of Object.entries(instalados)) {
    if (!id.endsWith(`@${MARKETPLACE_ANTIGO}`) || !Array.isArray(lista)) continue;
    const idNovo = idNovoDe(id);
    for (const e of lista) {
      // sem entrada no enabledPlugins o Claude Code o trata como desligado (medido; ver skills-de-fora.mjs): só `true` volta ligado
      if (e?.scope === 'user') daConta.push({ id, idNovo, installPath: e.installPath, jaInstalado: (instalados[idNovo] ?? []).some((x) => x?.scope === 'user'), ligado: conta.enabledPlugins?.[id] === true, opcoes: objeto(conta.pluginConfigs?.[id]?.options) ? conta.pluginConfigs[id].options : {} });
      else if (['project', 'local'].includes(e?.scope) && typeof e.projectPath === 'string') {
        // a pasta que sumiu não tem settings a trocar, e o CLI não roda nela: fica como está, com aviso
        if (existsSync(e.projectPath)) doProjeto.push({ id, idNovo, scope: e.scope, projectPath: e.projectPath, installPath: e.installPath, jaInstalado: (instalados[idNovo] ?? []).some((x) => x?.scope === e.scope && x.projectPath === e.projectPath) }); else semPasta.push(`${id} (escopo ${e.scope} em ${e.projectPath})`);
      }
    }
  }
  // `design@` e `kit-design@` caem no mesmo id novo: entra uma vez só, com o que já tinha o nome novo
  const porId = new Map();
  for (const p of daConta) {
    const ja = porId.get(p.idNovo);
    if (!ja || nomeDe(p.id) === nomeDe(p.idNovo)) porId.set(p.idNovo, { ...p, tambem: ja ? [...(ja.tambem ?? []), ja.id] : [] });
    else ja.tambem = [...(ja.tambem ?? []), p.id];
  }
  const repasses = Object.keys(REPASSES).map((rel) => join(C, 'skills', 'orquestradora', 'scripts', rel))
    .filter((arq) => existsSync(arq) && readFileSync(arq, 'utf8') !== repasse(arq.split('/').pop()) && readFileSync(arq, 'utf8').includes(`@${MARKETPLACE_ANTIGO}`));
  return {
    antigo, novo, origem: argumentoDaOrigem(antigo?.source ?? novo?.source),
    ...publicado(antigo?.installLocation),
    conta: [...porId.values()], doProjeto, semPasta, projetos: projetosAOlhar(home, C, instalados, extras), repasses,
  };
}

/** Os plugins instalados com o nome antigo que o publicado não traz (sem o marketplace antigo, não teriam de onde reinstalar). */
const naoPublicados = (plano) => [...plano.conta, ...plano.doProjeto].map((p) => p.idNovo).filter((id, i, l) => l.indexOf(id) === i && !plano.pluginsPublicados.includes(nomeDe(id)));

function descrever(plano, aplicado) {
  const v = (seco, feito) => (aplicado ? feito : seco);
  const linhas = [];
  if (plano.antigo) linhas.push(`${v('trocaria', 'trocado')}: marketplace ${MARKETPLACE_ANTIGO} → ${MARKETPLACE} (origem ${plano.origem ?? '?'})`);
  for (const p of plano.conta) linhas.push(`${v('trocaria', 'trocado')}: ${p.id} → ${p.idNovo} (conta${p.ligado ? '' : ', desligado'}${Object.keys(p.opcoes).length ? `, opções ${Object.keys(p.opcoes).join(', ')}` : ''}${p.tambem?.length ? `; ${p.tambem.join(', ')} sai` : ''})`);
  for (const p of plano.doProjeto) linhas.push(`${v('trocaria', 'trocado')}: ${p.id} → ${p.idNovo} (escopo ${p.scope} em ${p.projectPath})`);
  for (const pr of plano.projetos) for (const a of pr.arquivos) for (const t of a.trocas) linhas.push(`${v('trocaria', 'trocado')}: ${t} (${join(pr.raiz, a.rel)})`);
  for (const r of plano.repasses) linhas.push(`${v('trocaria', 'trocado')}: o repasse ${r} passa a achar o plugin pelo nome novo (e pelo antigo)`);
  for (const x of plano.semPasta) linhas.push(`aviso: ${x}: a pasta não existe mais; a instalação fica com o nome antigo (tire com claude plugin uninstall)`);
  return linhas;
}

/** Guarda o que a migração mexe e o que ela cria; o manifesto é o que o `--desfazer` lê. */
function fazerBackup(plano, C) {
  const dir = join(C, 'orquestracao', 'backups', `F344-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(dir, { recursive: true });
  const itens = []; let n = 0;
  const guardar = (origem) => {
    if (itens.some((i) => i.origem === origem)) return;
    const existia = existsSync(origem);
    const copia = existia ? join(dir, 'copia', String(n++)) : null;
    if (existia) cpSync(origem, copia, { recursive: true, verbatimSymlinks: true });
    itens.push({ origem, copia, existia });
  };
  for (const rel of ['settings.json', 'plugins/installed_plugins.json', 'plugins/known_marketplaces.json']) guardar(join(C, rel));
  if (plano.antigo?.installLocation && plano.antigo.source?.source !== 'directory') guardar(plano.antigo.installLocation);
  for (const p of plano.conta) {
    if (p.installPath) guardar(p.installPath);
    for (const id of [p.id, ...(p.tambem ?? []), p.idNovo]) guardar(pastaDeDados(C, id));
  }
  // o que nasce com o nome novo (sai no desfazer se não existia)
  guardar(join(C, 'plugins', 'cache', MARKETPLACE));
  guardar(join(C, 'plugins', 'marketplaces', MARKETPLACE));
  for (const pr of plano.projetos) for (const a of pr.arquivos) guardar(a.arq);
  for (const p of plano.doProjeto) {
    for (const rel of ARQUIVOS_DO_PROJETO) guardar(join(p.projectPath, rel));
    if (p.installPath) guardar(p.installPath);
    for (const id of [p.id, p.idNovo]) guardar(pastaDeDados(C, id));
  }
  for (const r of plano.repasses) guardar(r);
  writeFileSync(join(dir, 'manifesto.json'), `${JSON.stringify({ item: 'F344', em: new Date().toISOString(), itens }, null, 2)}\n`);
  writeFileSync(join(dir, 'DESFAZER.md'), `# Desfazer a migração do marketplace\n\n\`npx -y github:ichikawacraice/kit-de-orquestracao migrar-marketplace --desfazer ${dir}\`\n\nSem o comando: cada item de \`manifesto.json\` com \`existia: true\` volta de \`copia\` para \`origem\`; os com \`existia: false\` saem.\n\nAtenção: o desfazer volta ao estado do backup. O que nasceu depois com o nome novo (o cache e a pasta de dados de \`ichikawa-kit\`, com o que acumulou desde a troca) sai junto.\n`);
  return dir;
}

/** Volta ao backup: o que existia volta da cópia, o que não existia sai. → as linhas do que fez. */
export function desfazer(dir) {
  const m = lerJson(join(dir, 'manifesto.json'));
  if (!Array.isArray(m?.itens)) throw new Error(`${dir} não tem um manifesto.json de backup da migração`);
  const linhas = [];
  for (const { origem, copia, existia } of m.itens) {
    rmSync(origem, { recursive: true, force: true });
    if (existia) { mkdirSync(join(origem, '..'), { recursive: true }); cpSync(copia, origem, { recursive: true, verbatimSymlinks: true }); linhas.push(`voltou: ${origem}`); }
    else linhas.push(`saiu: ${origem}`);
  }
  return linhas;
}

function aplicar(plano, { C, env, claude }) {
  const passo = (r, oQue) => { if (r.status !== 0) throw new Error(`${oQue}: ${r.err || `exit ${r.status}`}`); };
  for (const p of plano.conta) for (const id of [p.id, ...(p.tambem ?? [])]) passo(claude(['plugin', 'uninstall', id, '-s', 'user', '--keep-data']), `uninstall ${id}`);
  for (const p of plano.doProjeto) passo(claude(['plugin', 'uninstall', p.id, '-s', p.scope, '--keep-data'], p.projectPath), `uninstall ${p.id} (${p.projectPath})`);
  // só a declaração da conta: sem `--scope`, o CLI tira também a do projeto da pasta de onde a pessoa rodou, fora do backup
  if (plano.antigo) passo(claude(['plugin', 'marketplace', 'remove', MARKETPLACE_ANTIGO, '--scope', 'user']), `marketplace remove ${MARKETPLACE_ANTIGO}`);
  const conhecidos = () => lerJson(join(C, 'plugins', 'known_marketplaces.json')) ?? {};
  const reinstalar = plano.conta.some((p) => !p.jaInstalado) || plano.doProjeto.some((p) => !p.jaInstalado);
  if (reinstalar && !conhecidos()[MARKETPLACE]) {
    if (!plano.origem) throw new Error(`sem o marketplace ${MARKETPLACE_ANTIGO} registrado, não sei de onde adicionar o ${MARKETPLACE}: rode claude plugin marketplace add ${REPO_DO_KIT}`);
    passo(claude(['plugin', 'marketplace', 'add', plano.origem]), `marketplace add ${plano.origem}`);
    if (!conhecidos()[MARKETPLACE]) throw new Error(`o marketplace add de ${plano.origem} não registrou ${MARKETPLACE} (o publicado ainda tem o nome antigo?)`);
  }
  const clone = conhecidos()[MARKETPLACE]?.installLocation;
  for (const p of plano.conta) {
    // só a opção que o manifesto novo declara: a que saiu dele faria o install recusar
    const declaradas = Object.keys(lerJson(join(clone ?? '', 'plugins', nomeDe(p.idNovo), '.claude-plugin', 'plugin.json'))?.userConfig ?? {});
    const configs = Object.entries(p.opcoes).filter(([k, v]) => declaradas.includes(k) && ['string', 'number', 'boolean'].includes(typeof v) && v !== '').flatMap(([k, v]) => ['--config', `${k}=${v}`]);
    if (!p.jaInstalado) passo(claude(['plugin', 'install', p.idNovo, '-s', 'user', ...configs]), `install ${p.idNovo}`);
    if (!p.ligado && !p.jaInstalado) passo(claude(['plugin', 'disable', p.idNovo, '-s', 'user']), `disable ${p.idNovo}`);
    const dados = pastaDeDados(C, p.idNovo);
    const deOnde = [p.id, ...(p.tambem ?? [])].map((id) => pastaDeDados(C, id)).find((d) => !vazia(d));
    if (deOnde && vazia(dados)) cpSync(deOnde, dados, { recursive: true, verbatimSymlinks: true });
  }
  // `design@` e `kit-design@` do nome antigo no mesmo projeto e escopo viram um install só
  const feitos = new Set();
  for (const p of plano.doProjeto) {
    const chave = `${p.idNovo} ${p.scope} ${p.projectPath}`;
    if (!p.jaInstalado && !feitos.has(chave)) passo(claude(['plugin', 'install', p.idNovo, '-s', p.scope], p.projectPath), `install ${p.idNovo} (${p.projectPath})`);
    feitos.add(chave);
    const dados = pastaDeDados(C, p.idNovo); const deOnde = pastaDeDados(C, p.id);
    if (!vazia(deOnde) && vazia(dados)) cpSync(deOnde, dados, { recursive: true, verbatimSymlinks: true });
  }
  // os settings dos projetos saem do texto de antes do CLI, com as chaves trocadas: o valor (o `false` de quem desligou) fica
  for (const pr of plano.projetos) for (const a of pr.arquivos) writeFileSync(a.arq, a.novo);
  for (const r of plano.repasses) writeFileSync(r, repasse(r.split('/').pop()), { mode: 0o755 });
  // confere: os ids novos estão, os antigos saíram
  const r = claude(['plugin', 'list', '--json']);
  passo(r, 'plugin list');
  const lista = JSON.parse(r.out);
  const faltam = plano.conta.filter((p) => !lista.some((x) => x.id === p.idNovo && x.scope === 'user')).map((p) => p.idNovo);
  const faltamProjeto = plano.doProjeto.filter((p) => !lista.some((x) => x.id === p.idNovo && x.scope === p.scope)).map((p) => `${p.idNovo} (${p.projectPath})`);
  faltam.push(...faltamProjeto);
  const sobram = lista.filter((x) => String(x.id).endsWith(`@${MARKETPLACE_ANTIGO}`) && (x.scope === 'user' || plano.doProjeto.some((p) => p.id === x.id && p.scope === x.scope))).map((x) => x.id);
  if (faltam.length || sobram.length) throw new Error(`depois da troca${faltam.length ? `, faltam ${faltam.join(', ')}` : ''}${sobram.length ? `, sobram ${sobram.join(', ')}` : ''}`);
}

export function migrarMarketplace({ aplicarMesmo = false, desfazerDe = null, projetos = [], env = process.env } = {}) {
  const home = env.HOME || homedir();
  const C = pastaDeConfig(home, env);
  if (desfazerDe) {
    try { return { codigo: 0, saida: `${[...desfazer(resolve(desfazerDe)), 'Desfeito. Reinicie o app para valer.'].join('\n')}\n`, erro: '' }; } catch (e) { return { codigo: 1, saida: '', erro: `kit migrar-marketplace: ${e.message}` }; }
  }
  const claude = claudeDe(env);
  let plano = planejar({ home, C, extras: projetos });
  if (!plano.antigo && !plano.conta.length && !plano.doProjeto.length && !plano.projetos.length && !plano.repasses.length) {
    return { codigo: 0, saida: `nada a migrar: nenhuma instalação com o nome ${MARKETPLACE_ANTIGO}\n`, erro: '' };
  }
  if (plano.antigo && !plano.origem) return { codigo: 1, saida: '', erro: `kit migrar-marketplace: não sei refazer a origem do ${MARKETPLACE_ANTIGO} (${JSON.stringify(plano.antigo.source)})` };
  if (!aplicarMesmo) {
    const linhas = descrever(plano, false);
    const fora = naoPublicados(plano);
    if (plano.antigo && plano.nomePublicado === MARKETPLACE && fora.length) linhas.push(`aviso: ${fora.join(', ')} não está no marketplace publicado: o --aplicar para (desinstale-o antes, ou espere ele ser publicado)`);
    if (plano.antigo && plano.nomePublicado !== MARKETPLACE) linhas.push(`aviso: o clone local do marketplace ainda se chama ${plano.nomePublicado ?? '?'}; o --aplicar o atualiza antes e para se o publicado não tiver o nome ${MARKETPLACE}`);
    linhas.push('Seco: nada foi gravado. Rode com --aplicar para trocar (com backup; falha no meio desfaz sozinha).');
    return { codigo: 0, saida: `${linhas.join('\n')}\n`, erro: '' };
  }
  if (plano.antigo) {
    // o publicado precisa já ter o nome novo: sem isso o add registraria de novo o antigo
    const u = claude(['plugin', 'marketplace', 'update', MARKETPLACE_ANTIGO]);
    if (u.status !== 0) return { codigo: 1, saida: '', erro: `kit migrar-marketplace: marketplace update ${MARKETPLACE_ANTIGO}: ${u.err || `exit ${u.status}`}` };
    plano = planejar({ home, C, extras: projetos });
    if (plano.nomePublicado !== MARKETPLACE) return { codigo: 1, saida: '', erro: `kit migrar-marketplace: o marketplace publicado ainda se chama ${plano.nomePublicado ?? '?'}, não ${MARKETPLACE}: nada foi mexido` };
    const fora = naoPublicados(plano);
    if (fora.length) return { codigo: 1, saida: '', erro: `kit migrar-marketplace: ${fora.join(', ')} está instalado e não está no marketplace publicado: sem o antigo, não teria de onde voltar. Desinstale-o antes ou espere ele ser publicado; nada foi mexido` };
  }
  const backup = fazerBackup(plano, C);
  try {
    aplicar(plano, { C, env, claude });
  } catch (e) {
    let volta;
    try { volta = desfazer(backup); } catch (e2) { return { codigo: 1, saida: '', erro: `kit migrar-marketplace: ${e.message}; o desfazer automático também falhou (${e2.message}) — rode --desfazer ${backup}` }; }
    return { codigo: 1, saida: `${volta.join('\n')}\n`, erro: `kit migrar-marketplace: ${e.message} — desfeito do backup ${backup}` };
  }
  return { codigo: 0, saida: `${[...descrever(plano, true), `backup: ${backup} (para voltar: --desfazer ${backup})`, 'Reinicie o app para valer.'].join('\n')}\n`, erro: '' };
}
