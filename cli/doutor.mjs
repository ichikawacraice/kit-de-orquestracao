// `kit doutor`: confere o ambiente (plugin, hooks duplicados, kit.json, skills de fora, versão, Node, git) e o disco contra o lock.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { avisoDeLaco, carregarConfig, opcaoDaRegra, REGRAS_DE_DOCUMENTO } from '../gate/config.mjs';
import { booleanoDaOpcao, opcoesDoPlugin, pastaDeConfig } from '../gate/opcoes-do-plugin.mjs';
import { LOCK, blocosDe, lerLock, sha256 } from './lock.mjs';
import { conferirPerformance, lerPraticas } from './performance.mjs';
import { conferirSkillsDeFora } from './skills-de-fora.mjs';
import { COMPARTILHADOS, HOOK_GUARDA, IMPECCABLE, PLUGINS_RENOMEADOS, avisoDasRegras, docsDoProjeto, gitDirComum, MARKETPLACE, PLUGIN, RAIZ_DO_KIT, baseDaOrquestracao, lerTexto } from './pacote.mjs';

const lerJson = (caminho) => { try { return JSON.parse(readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };

export function doutor({ destino, versao, home = process.env.HOME || homedir() }) {
  const { lock, erro } = lerLock(destino);
  if (erro) return { codigo: 1, saida: '', erro: `kit doutor: ${erro}${erro.startsWith('não achei') ? ' — rode `kit iniciar` ou `kit adotar`' : ''}` };
  const linhas = [`kit ${lock.versao}, perfil ${lock.perfil}, ${Object.keys(lock.arquivos).length} arquivos no lock`];
  let falhas = 0;
  const ok = (m) => linhas.push(`ok: ${m}`);
  const falha = (m) => { falhas++; linhas.push(`falha: ${m}`); };

  // plugin instalado e habilitado
  const instalados = lerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {};
  if (instalados[PLUGIN]?.length) ok('plugin instalado na máquina: sim (orquestracao)');
  else falha(`plugin instalado na máquina: não (orquestracao) — rode \`claude plugin install ${PLUGIN}\``);
  const configs = [join(pastaDeConfig(home), 'settings.json'), join(destino, '.claude', 'settings.json'), join(destino, '.claude', 'settings.local.json')].map(lerJson);
  const flags = configs.map((s) => s?.enabledPlugins?.[PLUGIN]).filter((v) => v !== undefined);
  if (flags.length && flags.every((v) => v === true) || (flags.includes(true) && !flags.includes(false))) ok('plugin habilitado no projeto: sim (orquestracao)');
  else falha('plugin habilitado no projeto: não (orquestracao) — `enabledPlugins` do settings.json precisa trazer true');

  // hook do kit duplicado no settings global
  const hooksJson = lerTexto(RAIZ_DO_KIT, 'plugins/orquestracao/hooks/hooks.json') ?? '';
  const nomes = [...new Set([...hooksJson.matchAll(/\/hooks\/([\w-]+\.mjs)/g)].map((m) => m[1]))];
  // só conta quem está num `command` dentro de `hooks` (uma permissão que cita o script não dispara hook nenhum)
  const global = lerJson(join(home, '.claude', 'settings.json'));
  const comandos = Object.values(global?.hooks ?? {}).flat().flatMap((g) => g?.hooks ?? []).map((h) => String(h?.command ?? ''));
  const duplicados = nomes.filter((n) => comandos.some((c) => c.includes(n)));
  if (!nomes.length) falha('não consegui listar os hooks do plugin (hooks.json do kit vazio)');
  else if (duplicados.length) for (const n of duplicados) falha(`hook do kit também em ~/.claude/settings.json: ${n} (dispararia duas vezes)`);
  else ok(`nenhum hook do kit também em ~/.claude/settings.json (${nomes.length} conferidos)`);

  // temas.json do painel: o painel o cria na primeira gravação; o doutor só diz se já existe
  const temas = join(process.env.PAINEL_DIR || join(home, '.claude', 'orquestracao', 'painel'), 'temas.json');
  if (existsSync(temas)) ok('temas.json do painel existe');
  else linhas.push(`info: temas.json ausente (${temas}); o painel o cria, com o tema geral, na primeira gravação`);

  // kit.json
  try { const cfg = carregarConfig(destino); ok('.claude/kit.json válido'); const laco = avisoDeLaco(cfg.gate?.comandoCompleto); if (laco) linhas.push(`aviso: ${laco}`); } catch (e) { falha(`.claude/kit.json: ${e.message}`); }

  processos(destino, home, configs, linhas);
  linhas.push(...conferirPerformance(lerJson(join(destino, '.claude', 'kit.json')) ?? {}, ligadoEm(`kit-performance@${MARKETPLACE}`, configs), lerPraticas()));

  // skills de fora (ADR 0014): a dependência que falta reprova; o plugin com skill barrada só avisa
  const fora = conferirSkillsDeFora({ home, destino, configs });
  falhas += fora.falhas;
  linhas.push(...fora.linhas);

  // versões, Node e git
  if (lock.versao === versao) ok(`versão do lock (${lock.versao}) igual à do CLI`);
  else falha(`versão: o lock está em ${lock.versao} e o CLI em ${versao} — rode \`kit atualizar\``);
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok(`node ${process.versions.node}`); else falha(`node ${process.versions.node} — o kit pede Node >= 20`);
  const g = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  if (g.status === 0) ok(g.stdout.trim()); else falha('git não encontrado no PATH');

  // disco × lock (arquivos inteiros do kit; os compartilhados são do projeto e mudam à vontade)
  for (const [f, h] of Object.entries(lock.arquivos)) {
    if (COMPARTILHADOS.has(f)) continue;
    const t = lerTexto(destino, f);
    if (t === null) falha(`faltando: ${f}`);
    else if (sha256(t) !== h) falha(`modificado: ${f}`);
  }
  const claude = lerTexto(destino, 'CLAUDE.md');
  for (const [nome, reg] of Object.entries(lock.blocos ?? {})) {
    const b = claude && blocosDe(claude).find((x) => x.nome === nome);
    if (!b) linhas.push(`aviso: bloco ${nome} ausente do CLAUDE.md`);
    else if (nome !== 'projeto' && sha256(b.conteudo) !== reg.sha256) linhas.push(`aviso: bloco ${nome} editado à mão (o \`kit atualizar\` não o troca)`);
  }
  // o bloco `projeto` é para o usuário preencher: editá-lo não é desvio (nem aviso); só o placeholder que sobra é
  // o bloco `projeto` nasce com o texto de preencher; sem ele preenchido as sessões não sabem o que o projeto é
  const projeto = claude && blocosDe(claude).find((x) => x.nome === 'projeto');
  if (projeto && /<!--\s*preencher:/.test(projeto.conteudo)) linhas.push('aviso: o bloco projeto do CLAUDE.md ainda tem o texto de preencher; descreva o projeto nele (o que é, stack, pastas, idioma dos commits)');
  // as chaves que o kit escreveu em settings.json e package.json (o resto desses arquivos é do projeto)
  const c = lock.chaves ?? {};
  const st = lerJson(join(destino, '.claude', 'settings.json'));
  if (c.settings?.hook && !(st?.hooks?.PreToolUse ?? []).some((g) => g.hooks?.some((h) => h.command === HOOK_GUARDA))) falha('hook da guarda sumiu do .claude/settings.json (foi o kit que o pôs)');
  if (c.settings?.marketplace && !st?.extraKnownMarketplaces?.[MARKETPLACE]) linhas.push(`aviso: marketplace ${MARKETPLACE} sumiu do .claude/settings.json`);
  const pk = lerJson(join(destino, 'package.json'));
  for (const t of c.package?.trocados ?? []) if (pk?.scripts?.[t.nome] !== t.gate) linhas.push(`aviso: scripts.${t.nome} (package.json) não passa mais pelo gate`);
  for (const [nome, valor] of Object.entries(c.package?.scripts ?? {})) if (pk?.scripts?.[nome] !== valor) linhas.push(`aviso: scripts.${nome} (package.json) não está mais como o kit deixou`);
  for (const f of lock.omitidos ?? []) linhas.push(`aviso: ${f} não foi copiado (o projeto tem a guarda ou o gate dele)`);
  // a lista existe e não tem este repositório: a trava da orquestradora não vale aqui (sem lista ela valeria em todos). Vale também para quem adotou antes do c18 (sem `operador` no lock).
  const listaTrava = join(baseDaOrquestracao(), 'trava-edicao-repos.txt');
  const repoDaTrava = gitDirComum(destino);
  if (repoDaTrava && existsSync(listaTrava) && !readFileSync(listaTrava, 'utf8').split('\n').map((l) => l.trim()).includes(repoDaTrava)) linhas.push(`aviso: ${repoDaTrava} não está em trava-edicao-repos.txt; a orquestradora edita este repositório sem perguntar. Para acrescentá-lo: echo '${repoDaTrava}' >> ${listaTrava}`);
  for (const p of lock.pendente ?? []) linhas.push(`aviso: pendente da adoção: ${p}`);
  linhas.push(falhas ? `${falhas} falha(s)` : 'tudo em dia');
  return { codigo: falhas ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}

/** O que `enabledPlugins` diz do plugin: a camada mais próxima (local > projeto > conta), o nome velho valendo quando o novo não diz; `undefined` se ninguém diz. */
function ligadoEm(id, configs) {
  const ids = [id, ...Object.keys(PLUGINS_RENOMEADOS).filter((v) => PLUGINS_RENOMEADOS[v] === id)];
  for (const s of [configs[2], configs[1], configs[0]]) for (const i of ids) if (typeof s?.enabledPlugins?.[i] === 'boolean') return s.enabledPlugins[i];
  return undefined;
}

/** Os processos do kit (plugins `processos` e `kit-design`): o que o kit.json e o settings dizem, e onde um sobrepõe o outro. Só aviso e info: nada aqui reprova. */
function processos(destino, home, configs, linhas) {
  const kj = lerJson(join(destino, '.claude', 'kit.json')) ?? {};
  for (const [velho, novo] of Object.entries(PLUGINS_RENOMEADOS)) {
    for (const [i, onde] of [[1, '.claude/settings.json'], [2, '.claude/settings.local.json']]) {
      if (configs[i]?.enabledPlugins && velho in configs[i].enabledPlugins) linhas.push(`aviso: ${onde} ainda liga ${velho}; o plugin agora se chama ${novo}${i === 1 ? ' — rode `kit atualizar`' : ' — troque a chave à mão'}`);
    }
  }
  const ligado = { processos: ligadoEm(`processos@${MARKETPLACE}`, configs), design: ligadoEm(`kit-design@${MARKETPLACE}`, configs) };
  const secao = { processos: 'documentos', design: 'design' };
  const plugin = { processos: 'processos', design: 'kit-design' };
  for (const nome of ['processos', 'design']) {
    if (ligado[nome] === false && kj[secao[nome]] !== undefined) linhas.push(`aviso: plugin ${plugin[nome]} desligado, mas o .claude/kit.json tem a seção ${secao[nome]}: o kit.json não o religa (plugin desligado não roda, diga o arquivo o que disser); para religar, enabledPlugins "${plugin[nome]}@${MARKETPLACE}": true`);
    else if (ligado[nome] === false) linhas.push(`info: plugin ${plugin[nome]} desligado neste projeto`);
    else if (ligado[nome] === true && kj[secao[nome]] === undefined) linhas.push(`aviso: plugin ${plugin[nome]} ligado, mas o .claude/kit.json está sem a seção ${secao[nome]}: valem os caminhos e os padrões do plugin; o \`kit atualizar\` não a acrescenta, copie-a do modelo do kit`);
  }
  // plugin fora do enabledPlugins (projeto instalado antes dos processos): o gate confere as docs mesmo assim, pelo padrão
  const docsDoProj = docsDoProjeto(destino);
  if (ligado.processos === undefined && !Array.isArray(kj.documentos?.conferir) && docsDoProj.length) linhas.push(`aviso: plugin processos fora do enabledPlugins deste projeto, mas o gate confere as docs mesmo assim (documentos.conferir ausente = as cinco regras): ${avisoDasRegras(docsDoProj, ligado.processos)}`);
  // design: a guarda só age com pasta do front (design.pasta, design.visual ou a opção pasta_do_front do plugin)
  const opDesign = opcoesDoPlugin('kit-design', home);
  const pasta = typeof kj.design?.pasta === 'string' ? kj.design.pasta.replace(/\/+$/, '') : '';
  const pastaDaOpcao = typeof opDesign.pasta_do_front === 'string' ? opDesign.pasta_do_front.replace(/\/+$/, '') : '';
  const front = pasta || pastaDaOpcao;
  const temDesign = ligado.design !== false && (kj.design !== undefined || ligado.design === true);
  if (temDesign && !front && !(Array.isArray(kj.design?.visual) && kj.design.visual.length)) {
    linhas.push('info: design: sem design.pasta (nem design.visual) a guarda de design fica inerte e o crítico não é cobrado; para ligá-la, ponha design.pasta no .claude/kit.json (ou a opção pasta_do_front do plugin kit-design)');
  }
  if (temDesign && front) {
    for (const f of ['PRODUCT.md', 'DESIGN.md']) if (!existsSync(join(destino, front, f))) linhas.push(`aviso: design: ${front}/${f} não existe; o designer e o crítico leem dele o que o produto é e como a tela parece (modelo em modelos/front do kit)`);
    const imp = ligadoEm(IMPECCABLE.plugin, configs);
    if (imp !== true) linhas.push(`aviso: design: o Impeccable é recomendado para este front e não está ligado (${IMPECCABLE.plugin}); \`kit adotar --design ${front}\` só vale em projeto novo, então ponha "${IMPECCABLE.plugin}": true em enabledPlugins e o marketplace ${IMPECCABLE.marketplace} em extraKnownMarketplaces do .claude/settings.json`);
    else ok_(linhas, 'Impeccable ligado no projeto');
  }
  // onde o kit.json sobrepõe uma opção do plugin (A7: o kit.json com a chave vence)
  const opProc = opcoesDoPlugin('processos', home);
  if (Array.isArray(kj.documentos?.conferir) && ligado.processos !== false) {
    const diferentes = REGRAS_DE_DOCUMENTO.filter((r) => booleanoDaOpcao(opProc[opcaoDaRegra(r)]) !== kj.documentos.conferir.includes(r)).map(opcaoDaRegra);
    if (diferentes.length) linhas.push(`info: o kit.json sobrepõe a opção do plugin processos (${diferentes.join(', ')}): documentos.conferir vale para o time e vence a opção de cada conta`);
  }
  if (ligado.design !== false) {
    const sobrepostas = [];
    if (typeof kj.design?.guarda === 'boolean' && kj.design.guarda !== booleanoDaOpcao(opDesign.guarda)) sobrepostas.push('guarda');
    if (typeof kj.design?.cobrarCritica === 'boolean' && kj.design.cobrarCritica !== booleanoDaOpcao(opDesign.cobrar_critica)) sobrepostas.push('cobrar_critica');
    if (pasta && pastaDaOpcao && pasta !== pastaDaOpcao) sobrepostas.push('pasta_do_front');
    if (kj.design?.largura !== undefined && kj.design.largura !== (opDesign.largura ?? 1280)) sobrepostas.push('largura');
    if (sobrepostas.length) linhas.push(`info: o kit.json sobrepõe a opção do plugin kit-design (${sobrepostas.join(', ')}): a chave do kit.json vale para o time e vence a opção de cada conta`);
  }
}
const ok_ = (linhas, m) => linhas.push(`ok: ${m}`);
