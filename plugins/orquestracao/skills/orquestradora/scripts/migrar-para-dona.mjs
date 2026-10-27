#!/usr/bin/env node
// Migração do estado para o modelo da dona (ADR 0011). Sem `--aplicar` só mostra o plano (seco é o padrão).
//   node migrar-para-dona.mjs [--aplicar] [--projetos <a>,<b>]   (sem --projetos: os projetos dos itens da fila)
// Com `--aplicar`, na pasta do estado (`HOOKS_CREWAI_BASE`, padrão ~/.claude/orquestracao; painel em `PAINEL_DIR`, padrão <base>/painel):
//   1. move para `backups/migracao-dona-<data>/` a fila do painel, os handoffs do pool, a batida e os arquivos de estado dos projetos;
//   2. recria a fila só com os itens vivos (fora de feito/descartado), no formato novo: `via: "dona"`, sem dona, `com`, `fez` nem
//      `passaram` (a orquestradora abre a dona de cada um), com o `agora` dizendo que migrou e uma entrada no `historico`;
//   3. copia de volta os handoffs dos itens vivos (`F<n>.md`, `F<n>-*`, arquivo ou pasta), recria `batida/` vazia,
//      `pool/handoffs/arquivo/` e `painel/cartoes/` (se faltar);
//   4. escreve um arquivo de estado novo por projeto, com os itens vivos e o caminho do backup, e `modelo.json` = dona.
// Perguntas, sessões, temas, contadores e o resto da pasta ficam como estão. Rode com as sessões do projeto paradas.
// Falha no meio desfaz o que fez (ver `aplicar`); a saída diz `desfeito` e, se algo não voltou, `ficou`.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, cpSync, rmSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FINAIS = new Set(['feito', 'descartado']);
const FORA = ['donoLocalId', 'donoApelido', 'com', 'fez', 'passaram', 'estado', 'proximoPapel', 'nota'];

export function pastas(env = process.env) {
  const base = env.HOOKS_CREWAI_BASE || join(env.HOME || homedir(), '.claude', 'orquestracao');
  const painel = env.PAINEL_DIR || join(base, 'painel');
  return { base, painel, fila: join(painel, 'fila'), cartoes: join(painel, 'cartoes'), handoffs: join(base, 'pool', 'handoffs'), batida: join(base, 'batida') };
}

const lerJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const doItem = (F) => (nome) => nome === `${F}.md` || nome.startsWith(`${F}-`);

// Puro: o documento novo de um item vivo.
export function itemMigrado(doc, agoraIso) {
  const antigo = doc?.data ?? {};
  const data = Object.fromEntries(Object.entries(antigo).filter(([k]) => !FORA.includes(k)));
  data.via = 'dona';
  data.agora = `migrado para o modelo da dona${antigo.agora ? `; antes: ${antigo.agora}` : ''}`.slice(0, 400);
  data.historico = [...(Array.isArray(antigo.historico) ? antigo.historico : []), { em: agoraIso, etapa: antigo.etapa ?? null, dono: null }];
  data.atualizadoEm = agoraIso;
  return { id: doc.id, version: 1, data };
}

export function planejar({ env = process.env, projetos: pedidos, agora = new Date() } = {}) {
  const p = pastas(env);
  const carimbo = agora.toISOString().replace(/[:.]/g, '-');
  const backup = join(p.base, 'backups', `migracao-dona-${carimbo}`);
  const itens = existsSync(p.fila) ? readdirSync(p.fila).filter((n) => n.endsWith('.json')).map((n) => lerJson(join(p.fila, n))).filter(Boolean) : [];
  const vivos = itens.filter((d) => d?.id && !FINAIS.has(d?.data?.etapa));
  const projetos = pedidos ?? [...new Set(itens.map((d) => String(d?.data?.projeto ?? '').toLowerCase()).filter(Boolean))].sort();
  const handoffs = existsSync(p.handoffs) ? readdirSync(p.handoffs) : [];
  const mover = [
    [p.fila, join(backup, 'painel', 'fila')],
    [p.handoffs, join(backup, 'pool', 'handoffs')],
    [p.batida, join(backup, 'batida')],
    ...projetos.map((nome) => [join(p.base, `${nome}.md`), join(backup, `${nome}.md`)]),
  ].filter(([de]) => existsSync(de));
  return {
    ...p, backup, projetos, agoraIso: agora.toISOString(), mover,
    vivos: vivos.map((d) => ({ id: d.id, projeto: d.data?.projeto ?? null, etapa: d.data?.etapa ?? null, titulo: d.data?.titulo ?? '', handoffs: handoffs.filter(doItem(d.id)), doc: d })),
    fechados: itens.length - vivos.length,
  };
}

function estadoDoProjeto(nome, vivos, plano) {
  const meus = vivos.filter((v) => String(v.projeto ?? '').toLowerCase() === nome.toLowerCase());
  return `# ${nome} — estado da orquestradora (modelo da dona, ADR 0011)

Recriado em ${plano.agoraIso} pela migração para o modelo da dona. O estado anterior está em \`${plano.backup}\`.

## PRs abertos (de quem, estado)

## Fila de merge

## Itens vivos migrados (cada um espera a sessão dona)
${meus.length ? meus.map((v) => `- ${v.id} · ${v.titulo} (${v.etapa}${v.handoffs.length ? `; handoff: ${v.handoffs.join(', ')}` : ''})`).join('\n') : '- nenhum'}

## Decisões acumuladas

## Números reservados

## Próximo release
`;
}

// Falha no meio (F179: em 27/10 o `copyFileSync` numa pasta `F47-backup` parou a migração com metade feita): cada passo
// entra num diário e, se um falha, o diário é desfeito de trás para a frente (o que se criou sai, o que se sobrescreveu volta,
// o que se moveu volta ao lugar). O erro lançado traz `desfeito` e, se algo não voltou, `ficou` (o passo e o motivo).
export function aplicar(plano, { aposPasso = () => {} } = {}) {
  const diario = [];
  const passo = (nome) => aposPasso(nome);
  const criarPasta = (caminho) => { const primeira = mkdirSync(caminho, { recursive: true }); if (primeira) diario.push({ tipo: 'criou', caminho: primeira }); };
  const gravar = (caminho, texto) => {
    diario.push(existsSync(caminho) ? { tipo: 'sobrescreveu', caminho, antes: readFileSync(caminho) } : { tipo: 'criou', caminho });
    writeFileSync(caminho, texto);
  };
  try {
    criarPasta(plano.backup);
    for (const [de, para] of plano.mover) {
      criarPasta(dirname(para));
      renameSync(de, para);
      diario.push({ tipo: 'moveu', de, para });
      passo(`moveu ${de}`);
    }
    criarPasta(plano.fila);
    criarPasta(join(plano.handoffs, 'arquivo'));
    criarPasta(plano.batida);
    criarPasta(plano.cartoes); // o pane lê `painel/cartoes`; sem a pasta ele acusa ENOENT
    passo('recriou as pastas');
    const velhos = join(plano.backup, 'pool', 'handoffs');
    for (const v of plano.vivos) {
      gravar(join(plano.fila, `${v.id}.json`), `${JSON.stringify(itemMigrado(v.doc, plano.agoraIso), null, 2)}\n`);
      for (const h of v.handoffs) {
        const destino = join(plano.handoffs, h);
        diario.push({ tipo: 'criou', caminho: destino });
        cpSync(join(velhos, h), destino, { recursive: true }); // `F<n>-*` pode ser pasta (`F47-backup`)
      }
      passo(`migrou ${v.id}`);
    }
    for (const nome of plano.projetos) gravar(join(plano.base, `${nome}.md`), estadoDoProjeto(nome, plano.vivos, plano));
    passo('escreveu o estado dos projetos');
    gravar(join(plano.base, 'modelo.json'), `${JSON.stringify({ modelo: 'dona', desde: plano.agoraIso, backup: plano.backup })}\n`);
    passo('gravou modelo.json');
  } catch (err) {
    const ficou = desfazer(diario, plano.backup);
    const e = new Error(`migração falhou (${err?.message || err}); ${ficou.length ? `desfeita em parte, ficou: ${ficou.join('; ')}` : 'desfeita: o estado voltou ao de antes'}`);
    e.desfeito = ficou.length === 0;
    e.ficou = ficou;
    throw e;
  }
}

// Desfaz o diário de trás para a frente; devolve o que não voltou (vazio = tudo voltou). Pasta criada que contém algo que
// não voltou (a do backup e as de dentro dela) fica: é nela que está o que falta.
function desfazer(diario, backup) {
  const ficou = [];
  const presos = [];
  const contem = (pasta) => presos.some((p) => p === pasta || p.startsWith(`${pasta}${sep}`));
  for (let i = diario.length - 1; i >= 0; i--) {
    const d = diario[i];
    try {
      if (d.tipo === 'moveu') renameSync(d.para, d.de);
      else if (d.tipo === 'sobrescreveu') writeFileSync(d.caminho, d.antes);
      else if (!contem(d.caminho)) rmSync(d.caminho, { recursive: true, force: true });
    } catch (err) {
      if (d.tipo === 'moveu') presos.push(d.para);
      ficou.push(d.tipo === 'moveu' ? `${d.de} segue em ${d.para} (${err?.code || err?.message})` : `${d.caminho} (${d.tipo}; ${err?.code || err?.message})`);
    }
  }
  if (contem(backup)) ficou.push(`backup mantido em ${backup}`);
  return ficou;
}

function main(argv) {
  const ip = argv.indexOf('--projetos');
  const projetos = ip >= 0 ? String(argv[ip + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  if (ip >= 0 && !projetos.length) throw new Error('--projetos pede uma lista separada por vírgula');
  const plano = planejar({ projetos });
  const resumo = {
    seco: !argv.includes('--aplicar'), backup: plano.backup, mover: plano.mover.map(([de, para]) => ({ de, para })),
    vivos: plano.vivos.map(({ id, projeto, etapa, handoffs }) => ({ id, projeto, etapa, handoffs })), fechadosNoBackup: plano.fechados,
    estadoNovo: plano.projetos.map((n) => join(plano.base, `${n}.md`)),
  };
  if (!resumo.seco) {
    try { aplicar(plano); } catch (e) {
      process.stdout.write(`${JSON.stringify({ ...resumo, falhou: e.message, desfeito: e.desfeito ?? false, ficou: e.ficou ?? [] }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
  }
  process.stdout.write(`${JSON.stringify(resumo, null, 2)}\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`migrar-para-dona: ${e?.message || e}\n`); process.exitCode = 1; }
}
