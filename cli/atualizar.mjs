// `kit atualizar [--simular]`: troca pela versão nova o que o projeto não editou; o que foi editado vira conflito com o diff.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pluginLigado } from '../gate/opcoes-do-plugin.mjs';
import { diffTexto } from './diff.mjs';
import { LOCK, blocosDe, lerLock, sha256 } from './lock.mjs';
import { MARKETPLACE, MARKETPLACE_ANTIGO, PLUGINS_RENOMEADOS, RAIZ_DO_KIT, trocarNomesDoKit, arquivosDoGate, avisoDasRegras, docsDoProjeto, blocosDoModelo, gravar, inserirBloco, lerModelo, lerTexto, semBom, serializar } from './pacote.mjs';

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function atualizar({ destino, versao, simular = false, trocarTest = false }) {
  const { lock, erro } = lerLock(destino);
  if (erro) return { codigo: 1, saida: '', erro: `kit atualizar: ${erro}` };
  const mudancas = []; const linhas = []; let conflitos = 0;
  const conflito = (msg, diff) => { conflitos++; linhas.push(`conflito: ${msg}`); if (diff) linhas.push(diff); };

  for (const f of arquivosDoGate()) {
    const rel = `scripts/kit/${f}`;
    if ((lock.omitidos ?? []).includes(rel)) continue; // o projeto tem o dele (guarda ou gate próprios)
    const novo = readFileSync(join(RAIZ_DO_KIT, 'gate', f), 'utf8');
    const atual = lerTexto(destino, rel);
    if (!(rel in lock.arquivos)) {
      if (atual === null) { mudancas.push({ arquivo: rel, antigo: null, novo }); lock.arquivos[rel] = sha256(novo); linhas.push(`novo: ${rel}`); }
      else if (atual !== novo) conflito(`${rel} é novo no kit mas já existe diferente aqui`, diffTexto(atual, novo, rel));
      continue;
    }
    if (atual === null) { conflito(`${rel} faltando (estava no lock) — não recriei`); continue; }
    if (atual === novo) { lock.arquivos[rel] = sha256(novo); continue; }
    if (sha256(atual) === lock.arquivos[rel]) { mudancas.push({ arquivo: rel, antigo: atual, novo }); lock.arquivos[rel] = sha256(novo); linhas.push(`atualizado: ${rel}`); }
    else conflito(`${rel} editado à mão — não troquei`, diffTexto(atual, novo, rel));
  }

  const modelo = blocosDoModelo();
  const claudeAtual = lerTexto(destino, 'CLAUDE.md');
  let claude = claudeAtual;
  for (const [nome, reg] of Object.entries(lock.blocos)) {
    const texto = modelo[nome];
    const atual = claudeAtual === null ? undefined : blocosDe(claudeAtual).find((b) => b.nome === nome);
    if (!texto) { linhas.push(`aviso: o bloco ${nome} saiu do kit; deixei como está`); continue; }
    if (!atual) { conflito(`bloco ${nome} ausente do CLAUDE.md — não recriei`); continue; }
    const novo = blocosDe(texto)[0];
    const inteiroAtual = claudeAtual.match(new RegExp(`<!-- kit:${escapar(nome)} v\\d+ -->[\\s\\S]*?<!-- /kit:${escapar(nome)} -->`))[0];
    const eol = claudeAtual.includes('\r\n') ? '\r\n' : '\n';
    const nosso = eol === '\n' ? texto : texto.replace(/\n/g, eol);
    if (inteiroAtual === nosso) { lock.blocos[nome] = { versao: novo.versao, sha256: sha256(blocosDe(nosso)[0].conteudo) }; continue; }
    if (sha256(atual.conteudo) === reg.sha256) { claude = claude.replace(inteiroAtual, () => nosso); lock.blocos[nome] = { versao: novo.versao, sha256: sha256(blocosDe(nosso)[0].conteudo) }; linhas.push(`atualizado: bloco ${nome}`); }
    else conflito(`bloco ${nome} editado à mão — não troquei`, diffTexto(inteiroAtual, texto, `CLAUDE.md#${nome}`));
  }
  // bloco que o modelo tem e o projeto nunca recebeu (novo, ou o novo nome de um renomeado) entra na ordem do modelo, como no iniciar
  if (claude !== null) {
    for (const [nome, texto] of Object.entries(modelo)) {
      if (nome === 'projeto' || (lock.blocosOmitidos ?? []).includes(nome) || nome in lock.blocos || new RegExp(`<!-- kit:${escapar(nome)} v\\d+ -->`).test(claude)) continue;
      claude = inserirBloco(claude, nome, texto, modelo);
      const b = blocosDe(texto)[0];
      lock.blocos[nome] = { versao: b.versao, sha256: sha256(b.conteudo) };
      linhas.push(`novo: ${nome} (bloco acrescentado ao CLAUDE.md, na ordem do modelo)`);
    }
  }
  if (claude !== claudeAtual) mudancas.push({ arquivo: 'CLAUDE.md', antigo: claudeAtual, novo: claude });

  // o projeto instalado antes dos processos passa a ter as cinco regras ligadas pelo padrão do plugin: diz isso, uma vez por atualização
  const kitJson = (() => { try { return JSON.parse(semBom(lerTexto(destino, '.claude/kit.json') ?? '{}')); } catch { return {}; } })();
  const docsDoProj = docsDoProjeto(destino);
  if (!Array.isArray(kitJson.documentos?.conferir) && docsDoProj.length) linhas.push(`aviso: ${avisoDasRegras(docsDoProj, pluginLigado('processos', destino, process.env.HOME || homedir(), process.env))}`);

  renomearPlugins({ destino, lock, mudancas, linhas, conflito });
  if (trocarTest) trocarOTest({ destino, lock, mudancas, linhas, conflito });

  if (!conflitos) lock.versao = versao;
  if (!simular) {
    const g = gravar(destino, mudancas, lock);
    if (g.erro) return { codigo: 1, saida: '', erro: `kit atualizar: ${g.erro}` };
  }
  linhas.push(conflitos
    ? `kit atualizar: ${conflitos} conflito(s); a versão do lock continua ${lock.versao}.`
    : `kit atualizar${simular ? ' --simular' : ''}: em dia com o kit ${versao} (${mudancas.length} arquivo(s) ${simular ? 'mudariam' : 'trocados'}).`);
  return { codigo: conflitos ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}

/**
 * Plugin do kit que mudou de nome (F332, F344): no `enabledPlugins` do `.claude/settings.json` a chave velha vira a nova, no mesmo lugar e com
 * o mesmo valor (o `false` de quem desligou fica); se a nova já está lá, ela fica e a velha sai. O lock acompanha, para o remover tirar
 * a nova. O `settings.local.json` é da pessoa: só aviso.
 */
function renomearPlugins({ destino, lock, mudancas, linhas, conflito }) {
  const texto = lerTexto(destino, '.claude/settings.json');
  if (texto !== null) {
    let s = null; try { s = JSON.parse(semBom(texto)); } catch { /* ilegível: o doutor acusa; o atualizar não o lê para mais nada */ }
    const ligados = s?.enabledPlugins;
    const trocas = s ? trocarNomesDoKit(s) : [];
    if (trocas.length) {
      for (const t of trocas) linhas.push(`trocado: ${t} (.claude/settings.json)`);
      const base = mudancas.find((m) => m.arquivo === '.claude/settings.json');
      if (base) base.novo = serializar(s, texto); else mudancas.push({ arquivo: '.claude/settings.json', antigo: texto, novo: serializar(s, texto) });
    }
    if (ligados && typeof ligados === 'object') {
      const cs = lock.chaves?.settings;
      // a chave nova que já estava não foi o kit que pôs: o lock larga a velha e não a toma (o remover não apaga o que é da pessoa)
      if (Array.isArray(cs?.plugins)) cs.plugins = [...new Set(cs.plugins.flatMap((n) => (!PLUGINS_RENOMEADOS[n] ? [n] : PLUGINS_RENOMEADOS[n] in ligados ? [] : [PLUGINS_RENOMEADOS[n]])))];
    }
  }
  const local = lerTexto(destino, '.claude/settings.local.json');
  if (local !== null) {
    let l = null; try { l = JSON.parse(semBom(local)); } catch { /* ilegível: não é do kit */ }
    for (const [velho, novo] of Object.entries(PLUGINS_RENOMEADOS)) {
      if (l?.enabledPlugins && velho in l.enabledPlugins) linhas.push(`aviso: o .claude/settings.local.json ainda tem ${velho}; o plugin agora se chama ${novo} — troque a chave à mão (o kit não mexe no seu settings.local.json)`);
    }
    if (l?.extraKnownMarketplaces && MARKETPLACE_ANTIGO in l.extraKnownMarketplaces) linhas.push(`aviso: o .claude/settings.local.json ainda declara o marketplace ${MARKETPLACE_ANTIGO}; o nome agora é ${MARKETPLACE} — troque a chave à mão (o kit não mexe no seu settings.local.json)`);
  }
}

/** `--trocar-test`: o `npm test` passa a ser o gate e o `test` do projeto vai para `test:projeto` (o que a adoção deixou pendente). */
function trocarOTest({ destino, lock, mudancas, linhas, conflito }) {
  const pend = (lock.pendente ?? []).filter((p) => p.startsWith('scripts.test '));
  const texto = lerTexto(destino, 'package.json');
  if (!pend.length || texto === null) { linhas.push('aviso: --trocar-test: não há nada pendente do `test` neste projeto'); return; }
  let pkg; try { pkg = JSON.parse(semBom(texto)); } catch (e) { conflito(`package.json ilegível: ${e.message}`); return; }
  const gate = lerModelo().perfis[lock.perfil]?.scripts?.test;
  const sc = pkg.scripts ?? {};
  const atual = sc.test;
  if (!gate || atual === undefined || atual === gate) { linhas.push('aviso: --trocar-test: o `test` já é o gate ou não existe; nada a trocar'); return; }
  if (sc['test:projeto'] !== undefined && sc['test:projeto'] !== atual) { conflito('scripts.test:projeto já existe com outro valor — não troquei o `test`'); return; }
  const jaExistia = sc['test:projeto'] !== undefined; // já era do projeto (igual ao `test`): o remover não o apaga
  sc['test:projeto'] = atual; sc.test = gate; pkg.scripts = sc;
  mudancas.push({ arquivo: 'package.json', antigo: texto, novo: serializar(pkg, texto) });
  const cp = lock.chaves.package;
  if (!jaExistia) cp.scripts['test:projeto'] = atual;
  cp.trocados.push({ nome: 'test', original: atual, gate });
  const kj = lerTexto(destino, '.claude/kit.json');
  if (kj !== null) {
    const k = JSON.parse(semBom(kj));
    if (k.gate?.comandoCompleto === atual) {
      k.gate.comandoCompleto = 'npm run test:projeto';
      mudancas.push({ arquivo: '.claude/kit.json', antigo: kj, novo: serializar(k, kj) });
      // o lock registra o que o kit pôs (a folha `gate.comandoCompleto` ou o objeto `gate` inteiro): acompanha o valor novo, senão o remover o tomaria por mexido
      for (const a of lock.chaves.kitJson.adicionadas ?? []) {
        if (a.caminho === 'gate.comandoCompleto') a.valor = 'npm run test:projeto';
        else if (a.caminho === 'gate' && a.valor?.comandoCompleto === atual) a.valor = { ...a.valor, comandoCompleto: 'npm run test:projeto' };
      }
    }
  }
  lock.pendente = lock.pendente.filter((p) => !pend.includes(p));
  if (!lock.pendente.length) delete lock.pendente;
  linhas.push(`trocado: scripts.test agora passa pelo gate; o seu \`${atual}\` está em test:projeto.`);
}
