#!/usr/bin/env node
// Migra a coleção `fila` do painel do contrato antigo (estado/proximoPapel/frente/dono…) para o novo
// (etapa/tema/donoLocalId/donoApelido/prs/agora…) e importa os itens de pool/itens/*.md. Roda UMA vez (F27, fatia 2).
//   node migrar-fila.mjs            → seco: imprime antes → depois por item e a lista "conferir à mão"; não grava nada
//   --ajustes <arquivo.json>  aplica por cima do mapeamento os resumos/donos/etapas escritos à mão (F27: ajustes-P7.json);
//                             liga a conferência estrita: 0 campo antigo e todo item vivo com resumo (senão exit 1 e nada grava)
//   --ensaio <pasta>          a foto da fila no ensaio; o que o documento vivo trouxe DEPOIS dela (etapa/feitoEm/dono novos) vence o ajuste
//   node migrar-fila.mjs --gravar   → grava por `painel.mjs batch` (passa pela validação do contrato), uma operação atômica
// Ambiente: PAINEL_DIR (padrão ~/.claude/orquestracao/painel) · POOL_ITENS_DIR (padrão <PAINEL_DIR>/../pool/itens)
//   · PAINEL_SCRIPT (padrão o painel.mjs ao lado deste arquivo). Nunca escreve o JSON direto.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PAINEL_DIR || join(homedir(), '.claude', 'orquestracao', 'painel');
const POOL = process.env.POOL_ITENS_DIR || resolve(BASE, '..', 'pool', 'itens');
const PAINEL = process.env.PAINEL_SCRIPT || join(AQUI, 'painel.mjs');
const GRAVAR = process.argv.includes('--gravar');
const arg = (nome) => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : null; };
const ARQ_AJUSTES = arg('--ajustes');
const DIR_ENSAIO = arg('--ensaio');
const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
const DONO_NOVO = ['donoLocalId', 'donoApelido'];
// campos que o contrato conhece ou que já existiam em item vivo: o resto, aparecido depois do ensaio, é "solto"
const CONHECIDOS = new Set(['titulo', 'etapa', 'tema', 'trava', 'prs', 'depois', 'perguntas', 'resumo', 'agora', 'donoLocalId', 'donoApelido', 'handoff', 'historico', 'feitoEm', 'atualizadoEm', 'projeto', 'via', 'branch', 'devolverA', 'aplicaMigration', 'adr', 'decisao', 'urgente', 'revisao', 'repo', 'pasta', 'plano', 'nivelValidacao', 'planoFase2', 'detalhe', 'estado', ...['proximoPapel', 'frente', 'pr', 'nota', 'dono', 'dona', 'membro', 'executora', 'papel', 'item', 'origem']]);

const CAMPOS_ANTIGOS = ['estado', 'proximoPapel', 'frente', 'pr', 'nota', 'dono', 'dona', 'membro', 'executora', 'papel', 'item', 'origem'];
const DONOS_ANTIGOS = ['dono', 'dona', 'membro', 'executora'];
const TEMA_DA_FRENTE = { builder: 'editor', operacao: 'orquestracao', 'orquestração (~/.claude)': 'orquestracao', gate: 'gate' };
const TEMA_SEM_FRENTE = { F22: 'gate', F23: 'kit', F26: 'editor' };
const ETAPA_DO_PAPEL = { plano: 'planejamento', plan: 'planejamento', design: 'design', exec: 'execucao', executa: 'execucao', valid: 'validacao', valida: 'validacao', merge: 'merge' };
const FINAIS = new Set(['feito', 'concluida', 'concluido']);
// Itens que só existiam em pool/itens/*.md: tema, etapa, prs e dono (apelido) como combinado no handoff.
const IMPORTADOS = {
  F1: { tema: 'editor', etapa: 'execucao', dono: 'P1', prs: [1128] },
  F13: { tema: 'editor', etapa: 'execucao', dono: 'P2', prs: [1129] },
  F17: { tema: 'editor', etapa: 'planejamento' },
  F18: { tema: 'editor', etapa: 'planejamento' },
  F2: { tema: 'motor', etapa: 'feito' },
  F3: { tema: 'orquestracao', etapa: 'feito' },
  F6: { tema: 'orquestracao', etapa: 'feito' },
  F7: { tema: 'orquestracao', etapa: 'feito' },
  F4: { tema: 'editor', etapa: 'feito' },
};

const lerJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ehTexto = (v) => typeof v === 'string' && v.trim() !== '';
const numeroDoId = (id) => Number(String(id).replace(/^F/, ''));

function tituloDaSessao(localId) {
  const arq = join(BASE, 'sessoes', `${localId}.json`);
  if (!existsSync(arq)) return null;
  try { return lerJson(arq).data?.titulo ?? null; } catch { return null; }
}
const apelidoDoTitulo = (t) => (t && /^([A-Z]\d+) ·/.exec(t)?.[1]) || null;
// Sessão do pool de apelido P1/E4…: só devolve quando UMA sessão tem o prefixo (E1 e E4 têm duas — ambíguo vira "conferir").
function idDoApelido(apelido) {
  const dir = join(BASE, 'sessoes');
  if (!existsSync(dir)) return null;
  const achadas = [];
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('local_') || !f.endsWith('.json')) continue;
    try { if (apelidoDoTitulo(lerJson(join(dir, f)).data?.titulo) === apelido) achadas.push(f.replace(/\.json$/, '')); } catch { /* ignora */ }
  }
  return achadas.length === 1 ? achadas[0] : null;
}

function etapaDe(id, d, conferir) {
  if (ETAPAS.includes(d.etapa)) return d.etapa; // já no formato novo (gravado depois do ensaio): o vivo vence
  const estado = d.estado;
  if (FINAIS.has(estado)) return 'feito';
  if (estado === 'em-planejamento') return 'planejamento';
  if (estado === 'em-validacao') return 'validacao';
  if (estado === 'em-execucao') {
    conferir.push(`${id}: estado "em-execucao" não está na regra; mapeado para execucao`);
    return 'execucao';
  }
  if (['aberto', 'em-andamento', 'bloqueado'].includes(estado)) {
    const e = ETAPA_DO_PAPEL[String(d.proximoPapel ?? '').toLowerCase()];
    if (e) return e;
    conferir.push(`${id}: proximoPapel "${d.proximoPapel ?? ''}" não decide a etapa; ficou planejamento`);
    return 'planejamento';
  }
  conferir.push(`${id}: estado "${estado ?? ''}" desconhecido; ficou planejamento`);
  return 'planejamento';
}

function temaDe(id, d, conferir) {
  if (d.frente !== undefined) {
    const t = TEMA_DA_FRENTE[d.frente];
    if (t) return t;
    conferir.push(`${id}: frente "${d.frente}" sem tema no mapa; ficou orquestracao`);
    return 'orquestracao';
  }
  if (TEMA_SEM_FRENTE[id]) return TEMA_SEM_FRENTE[id];
  conferir.push(`${id}: sem frente e fora da lista F22/F23/F26; ficou orquestracao`);
  return 'orquestracao';
}

// Devolve { donoLocalId?, donoApelido? } do item vivo; item feito perde o dono (feito não tem dono).
function donoDe(id, d, etapa, conferir) {
  if (etapa === 'feito') return {};
  const out = {};
  if (ehTexto(d.donoLocalId)) out.donoLocalId = d.donoLocalId;
  if (ehTexto(d.donoApelido)) out.donoApelido = d.donoApelido;
  for (const campo of DONOS_ANTIGOS) {
    const v = d[campo];
    if (!ehTexto(v) || out.donoLocalId) continue;
    if (/^local_/.test(v)) {
      out.donoLocalId = v;
      if (!out.donoApelido) {
        const ap = apelidoDoTitulo(tituloDaSessao(v));
        if (ap) { out.donoApelido = ap; conferir.push(`${id}: donoApelido "${ap}" tirado do título da sessão ${v}; confirme`); }
        else conferir.push(`${id}: ${campo} ${v} sem donoApelido (sessão fora do painel)`);
      }
    } else if (!out.donoApelido) {
      out.donoApelido = v;
      const lid = idDoApelido(v);
      if (lid) { out.donoLocalId = lid; conferir.push(`${id}: ${campo} "${v}" → ${lid} (única sessão com esse prefixo); confirme`); }
      else conferir.push(`${id}: ${campo} "${v}" só tem apelido (falta o local_…); preencher donoLocalId`);
    }
  }
  // o contrato exige donoApelido junto do donoLocalId: sem apelido, o id não entra (a validação recusaria o lote) e vai para a lista
  if (out.donoLocalId && !out.donoApelido) {
    conferir.push(`${id}: dono ${out.donoLocalId} sem apelido (sessão fora do painel); preencher donoLocalId e donoApelido`);
    delete out.donoLocalId;
  }
  return out;
}

function migrarItem(id, d, conferir) {
  const etapa = etapaDe(id, d, conferir);
  const novo = {};
  for (const [k, v] of Object.entries(d)) {
    if (CAMPOS_ANTIGOS.includes(k) || k === 'donoLocalId' || k === 'donoApelido') continue;
    // `etapa` antigo era texto livre ("PR aberto, aguarda validação"): o campo agora é a etapa; o texto vira `agora`.
    if (k === 'etapa') continue;
    if (k === 'feitoEm' && etapa !== 'feito') continue;
    novo[k] = v;
  }
  novo.etapa = etapa;
  novo.tema = temaDe(id, d, conferir);
  Object.assign(novo, donoDe(id, d, etapa, conferir));
  if (d.estado === 'bloqueado') {
    const texto = ehTexto(d.nota) ? d.nota : 'bloqueado (sem nota na origem)';
    if (!ehTexto(d.nota)) conferir.push(`${id}: bloqueado sem nota; trava.texto preenchido com texto padrão`);
    novo.trava = { motivo: 'outra', texto };
  }
  if (d.pr !== undefined && d.pr !== null) novo.prs = [Number(d.pr)];
  const agora = [];
  if (ehTexto(d.nota)) agora.push(d.nota);
  if (ehTexto(d.etapa) && !ETAPAS.includes(d.etapa)) {
    agora.push(d.etapa);
    conferir.push(`${id}: o campo antigo "etapa" era texto livre e foi para "agora" (junto da nota)`);
  }
  if (agora.length && !ehTexto(novo.agora)) novo.agora = agora.join(' · ');
  if (etapa === 'feito' && !novo.feitoEm && ehTexto(d.atualizadoEm)) novo.feitoEm = d.atualizadoEm;
  if (FINAIS.has(d.estado) && d.estado !== 'feito' && ehTexto(d.etapa) && !ETAPAS.includes(d.etapa)) {
    conferir.push(`${id}: estado "${d.estado}" virou feito, mas o texto antigo de etapa diz "${d.etapa.slice(0, 70)}"; confirme se está feito`);
  }
  if (!ehTexto(novo.resumo)) conferir.push(`${id}: sem resumo`);
  return novo;
}

function lerItemMd(arq) {
  const linhas = readFileSync(arq, 'utf8').split('\n');
  const h1 = linhas.find((l) => l.startsWith('# ')) ?? '';
  const titulo = h1.replace(/^#\s+F\d+\s*[—·-]?\s*/, '').trim();
  const origem = linhas.find((l) => /^\s*-?\s*Origem:/i.test(l));
  const resumo = origem ? origem.replace(/^\s*-?\s*Origem:\s*/i, '').trim() : '';
  return { titulo, resumo };
}

function importar(id, cfg, conferir) {
  const arq = join(POOL, `${id}.md`);
  if (!existsSync(arq)) { conferir.push(`${id}: ${arq} não existe; não importado`); return null; }
  let { titulo, resumo } = lerItemMd(arq);
  if (!titulo) {
    const hf = join(BASE, '..', 'pool', 'handoffs', `${id}.md`);
    if (existsSync(hf)) titulo = (readFileSync(hf, 'utf8').split('\n').find((l) => l.startsWith('# ')) ?? '').replace(/^#\s+F\d+\s*[—·-]?\s*/, '').trim();
    if (titulo) conferir.push(`${id}: o .md não tem título; usei o do handoff`);
  }
  if (!titulo) { titulo = id; conferir.push(`${id}: sem título na origem; ficou "${id}"`); }
  const novo = { titulo, tema: cfg.tema, etapa: cfg.etapa, handoff: arq, projeto: process.env.KIT_PROJETO || undefined, historico: [] }; // o nome do projeto não vem do kit: KIT_PROJETO na hora de rodar
  if (resumo) novo.resumo = resumo; else conferir.push(`${id}: sem resumo (o .md não tem "Origem:")`);
  if (cfg.prs) novo.prs = cfg.prs;
  if (cfg.etapa === 'feito') novo.feitoEm = statSync(arq).mtime.toISOString();
  if (cfg.dono) {
    novo.donoApelido = cfg.dono;
    const lid = idDoApelido(cfg.dono);
    if (lid) novo.donoLocalId = lid; else conferir.push(`${id}: dono "${cfg.dono}" sem sessão única no painel; preencher donoLocalId`);
  }
  return novo;
}

// ---------- plano ----------
const conferir = [];
const ops = [];
const antes = new Map();
const dirFila = join(BASE, 'fila');
const docs = existsSync(dirFila) ? readdirSync(dirFila).filter((f) => /^F\d+\.json$/.test(f)).map((f) => lerJson(join(dirFila, f))) : [];
docs.sort((a, b) => numeroDoId(a.id) - numeroDoId(b.id));

for (const doc of docs) {
  antes.set(doc.id, doc);
  const jaMigrado = ETAPAS_OK(doc.data);
  if (jaMigrado) { console.log(`= ${doc.id}: já no contrato novo; nada a fazer`); continue; }
  const data = migrarItem(doc.id, doc.data, conferir);
  // handoff vazio recebe o .md de pool/itens, se existir (F12-notas-baixas.md conta como F12)
  if (!ehTexto(data.handoff) && existsSync(POOL)) {
    const md = readdirSync(POOL).find((f) => new RegExp(`^${doc.id}(-.*)?\\.md$`).test(f));
    if (md) data.handoff = join(POOL, md);
  }
  ops.push({ op: 'set', colecao: 'fila', id: doc.id, data, seVersao: doc.version });
}
function ETAPAS_OK(d) { return typeof d.etapa === 'string' && typeof d.tema === 'string' && d.estado === undefined; }

for (const [id, cfg] of Object.entries(IMPORTADOS)) {
  if (antes.has(id)) continue;
  const data = importar(id, cfg, conferir);
  if (data) ops.push({ op: 'set', colecao: 'fila', id, data });
}

// ---------- ajustes à mão (por cima do mapeamento) ----------
const ajustes = ARQ_AJUSTES ? lerJson(ARQ_AJUSTES) : {};
const falhasEstritas = [];
const fotoDo = (id) => {
  if (!DIR_ENSAIO) return null;
  const f = join(DIR_ENSAIO, `${id}.json`);
  return existsSync(f) ? lerJson(f).data : null;
};
for (const op of ops) {
  const ajuste = ajustes[op.id] ?? {};
  const foto = fotoDo(op.id);
  const vivoDepois = (campo) => {
    const antigo = antes.get(op.id)?.data?.[campo];
    return antigo !== undefined && (foto === null || JSON.stringify(foto[campo]) !== JSON.stringify(antigo));
  };
  const vivoVence = (campo) => antes.has(op.id) && DIR_ENSAIO && foto && vivoDepois(campo);
  for (const [campo, valor] of Object.entries(ajuste)) {
    if (campo.startsWith('_')) continue;
    if (campo === 'etapa' && vivoVence('etapa') && ETAPAS.includes(antes.get(op.id).data.etapa)) continue;
    if (DONO_NOVO.includes(campo) && (vivoVence('donoLocalId') || vivoVence('donoApelido'))) continue;
    if (valor === null) delete op.data[campo]; else op.data[campo] = valor;
  }
  // campo solto que apareceu no documento vivo depois do ensaio (ex.: `proximo` do F28) vira depois:[{texto}]
  const vivo = antes.get(op.id)?.data;
  if (vivo && foto) {
    for (const [k, v] of Object.entries(vivo)) {
      if (k in foto || CONHECIDOS.has(k) || !ehTexto(v)) continue;
      op.data.depois = [...(Array.isArray(op.data.depois) ? op.data.depois : []), { texto: v }];
      delete op.data[k];
      conferir.push(`${op.id}: campo solto "${k}" (gravado depois do ensaio) virou depois:[{texto}]`);
    }
  }
  if (op.data.etapa === 'feito') {
    for (const k of DONO_NOVO) delete op.data[k];
    if (!op.data.feitoEm && ehTexto(op.data.atualizadoEm)) op.data.feitoEm = op.data.atualizadoEm;
  }
  // o que o ajuste resolveu sai da lista "conferir à mão"
  const resolvido = (c) => c.startsWith(`${op.id}: `) && ((ajuste.resumo && /sem resumo/.test(c)) || (ajuste.etapa && /texto antigo de etapa|era texto livre/.test(c) && op.data.etapa === ajuste.etapa) || ((op.data.etapa === 'feito' || 'donoApelido' in ajuste || 'donoLocalId' in ajuste) && /dono|donoApelido|donoLocalId|membro "|dona "/.test(c)));
  for (let i = conferir.length - 1; i >= 0; i--) if (resolvido(conferir[i])) conferir.splice(i, 1);
}
if (ARQ_AJUSTES) {
  for (const op of ops) {
    const a = Object.keys(op.data).filter((k) => CAMPOS_ANTIGOS.includes(k));
    if (a.length) falhasEstritas.push(`${op.id}: campo antigo restante (${a.join(', ')})`);
    if (!['feito', 'descartado'].includes(op.data.etapa) && !ehTexto(op.data.resumo)) falhasEstritas.push(`${op.id}: item vivo (etapa ${op.data.etapa}) sem resumo`);
  }
}

// ---------- relatório ----------
const resumoDe = (o) => JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 90 ? `${v.slice(0, 87)}…` : v));
for (const op of ops) {
  const a = antes.get(op.id);
  console.log(`\n## ${op.id}${a ? ` (v${a.version})` : ' (novo, importado)'}`);
  if (a) console.log(`antes : ${resumoDe(a.data)}`);
  console.log(`depois: ${resumoDe(op.data)}`);
}
const antigosRestantes = ops.flatMap((op) => Object.keys(op.data).filter((k) => CAMPOS_ANTIGOS.includes(k)).map((k) => `${op.id}.${k}`));
console.log(`\n== ${ops.length} itens (${ops.filter((o) => !antes.has(o.id)).length} importados) · campos antigos restantes: ${antigosRestantes.length}${antigosRestantes.length ? ` (${antigosRestantes.join(', ')})` : ''}`);
console.log(`\n== conferir à mão (${conferir.length})`);
for (const c of conferir) console.log(`- ${c}`);

if (ARQ_AJUSTES) {
  console.log(`\n== conferência estrita: ${falhasEstritas.length ? 'FALHOU' : 'ok (0 campo antigo, todo item vivo com resumo)'}`);
  for (const f of falhasEstritas) console.log(`- ${f}`);
  if (falhasEstritas.length) { process.exitCode = 1; }
}
if (falhasEstritas.length && GRAVAR) { console.error('conferência estrita falhou; nada foi gravado'); }
else if (!GRAVAR) console.log('\n(seco: nada foi gravado; use --gravar)');
const r = GRAVAR && !falhasEstritas.length ? spawnSync('node', [PAINEL, 'batch', JSON.stringify(ops)], { encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: process.env }) : null;
if (r?.error) { console.error(`falha ao chamar o painel.mjs: ${r.error.message}`); process.exitCode = 1; }
else if (r) {
  process.stderr.write(r.stderr);
  if (r.status !== 0) { console.error(`batch recusado (exit ${r.status}); nada foi gravado`); process.exitCode = 1; }
  else console.log(`\ngravado: ${ops.length} itens por painel.mjs batch`);
}
