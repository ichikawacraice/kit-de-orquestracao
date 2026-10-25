#!/usr/bin/env node
// PreToolUse (F5, 24/10): as regras do pool que dependem de QUEM chama viram trava. Fonte:
// ~/.claude/orquestracao/pool/protocolo.md ("Cada papel na sua sessão", "Nunca arquivar", "Nunca travar",
// "Operador dormindo"). Quem chama: título do registro do app (`P|D|E|V<n> · …`) ou orquestradora
// (marcador em ativas/ ou título `🎛 orquestradora`). Evento de subagente usa o título da sessão-mãe
// (mesmo `session_id`). Sem título de membro e sem ser orquestradora: passa calado (outros projetos).
//   T1  Agent/Task: P, D ou orquestradora não lança `executor`/`validador`; E não lança `validador`
//       nem `executor`; V não lança `executor`.            T1c V não edita arquivo do projeto.
//   T2  archive_session / delete_session de membro do pool (a orquestradora só arquiva livre do MESMO projeto ou de projeto sem orquestradora).
//   T3  start_session: negado em turno que não é do operador com o modo ausente ligado (/ausente on) e a membro do pool.
//   T5  Edit/Write em <BASE>/painel/ (só o painel.mjs grava).
//   T6  Bash `gh pr merge` de quem não é a orquestradora, em repo com orquestradora ativa → ask.
// Limites conhecidos: o cache do registro (pool-comum.mjs, 2 min) atrasa em até 2 min a troca de título, nos dois
// sentidos (acerto e ausência). Orquestradora reconhecida só por título (sem marcador em ativas/) não ativa o T6; projeto não medido (null) pergunta
// para as outras; o painel-das-sessoes.mjs repõe o marcador no primeiro Stop dela. T1c deixa a V gravar em
// ~/.claude/** (inclusive nos hooks): decisão consciente, notas e memória moram lá.
// `deny` (vale em bypass) onde a decisão já foi tomada; `ask` no T6 (o operador às vezes manda mergear direto).
// Erro do hook vai para o log e a ferramenta segue.
import { existsSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registrar, lerEntrada, semPrefixoDoPlugin } from './hooks-crewai-comum.mjs';
import { BASE, registroDaSessao, membroDoPool, ehOrquestradora, inicioDoTurno, origemDoTurno, gitCommonDir, projetoTemOrquestradora, projetoDaSessao } from './pool-comum.mjs';

const HOOK = 'papel-do-pool';
const H = homedir();

// Pastas livres para a validadora gravar (mesma lista de subagente-nao-edita.mjs; mude nos dois).
const LIVRES = [
  (p) => p.startsWith(BASE + '/'),
  (p) => p.startsWith(join(H, '.claude') + '/'),
  (p) => p.startsWith(join(H, 'Library', 'Application Support', 'Claude', 'side-session-notes') + '/'),
  (p) => /^\/(private\/)?tmp\//.test(p) || p.startsWith('/var/folders/') || p.startsWith('/private/var/folders/'),
  (p) => p.startsWith(resolve(tmpdir()) + '/'),
];

function caminhoDe(e) {
  const ti = e.tool_input || {};
  let p = ti.file_path || ti.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(H, p.slice(2));
  return resolve(e.cwd || process.cwd(), p);
}

function decisao(tipo, motivo) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: tipo, permissionDecisionReason: motivo },
  }));
}

function bandeiraDeAusencia() {
  const f = join(BASE, 'operador-ausente.json');
  if (!existsSync(f)) return null;
  try {
    const b = JSON.parse(readFileSync(f, 'utf8'));
    const desde = Date.parse(b.desde);
    if (Number.isNaN(desde)) return null; // sem prazo: só /ausente off desliga
    return { ...b, desdeMs: desde };
  } catch { return null; }
}

function main() {
  const e = lerEntrada();
  const sid = e.session_id || '-';
  const tool = e.tool_name || '';
  const ti = e.tool_input || {};
  const nega = (regra, quem, alvo, motivo) => {
    registrar(sid, HOOK, 'recusou', `${regra} ${quem} ${tool} ${alvo}`);
    decisao('deny', motivo);
  };
  if (tool.startsWith('mcp__ccd_')) registrar(sid, HOOK, 'viu', tool);

  // T5 e T1c primeiro: caminho decide antes de qualquer varredura do registro.
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    const p = caminhoDe(e);
    if (!p) return;
    if (p.startsWith(join(BASE, 'painel') + '/')) {
      return nega('T5', '-', p, 'O painel só se grava por `painel` (o comando do plugin orquestracao: ele valida e trava a escrita).');
    }
    if (LIVRES.some((f) => f(p))) return;
    const reg = registroDaSessao(e.session_id);
    if (membroDoPool(reg?.titulo)?.papel === 'V') {
      return nega('T1c', membroDoPool(reg.titulo).id, p, 'Validadora não conserta o que valida: devolva o achado (arquivo, linha, correção) a quem planejou.');
    }
    return;
  }

  if (tool === 'Bash') {
    if (!/\bgh\b[^\n|;&]*\bpr\s+merge\b/.test(ti.command || '')) return;
    const reg = registroDaSessao(e.session_id);
    if (ehOrquestradora(e.session_id, reg?.titulo)) return;
    const repo = gitCommonDir(e.cwd);
    if (!repo) return;
    const temOrq = projetoTemOrquestradora(e.session_id, repo);
    if (temOrq === false) return;
    if (temOrq === null) {
      registrar(sid, HOOK, 'perguntou', `T6 ${membroDoPool(reg?.titulo)?.id ?? 'sessao'} Bash gh pr merge (projeto não conferido)`);
      return decisao('ask', 'Não consegui conferir se este projeto tem orquestradora ativa; se tiver, quem mergeia é ela. Aprove só se o operador mandou mergear daqui.');
    }
    registrar(sid, HOOK, 'perguntou', `T6 ${membroDoPool(reg?.titulo)?.id ?? 'sessao'} Bash gh pr merge`);
    return decisao('ask', 'Com orquestradora ativa, quem mergeia é ela: mande `PR N validado, HEAD Y`. Aprove só se o operador mandou mergear daqui.');
  }

  if (tool === 'Agent' || tool === 'Task') {
    const tipo = semPrefixoDoPlugin(ti.subagent_type);
    if (tipo !== 'executor' && tipo !== 'validador') return;
    const reg = registroDaSessao(e.session_id);
    const orq = ehOrquestradora(e.session_id, reg?.titulo);
    const m = membroDoPool(reg?.titulo);
    if (!orq && !m) return;
    const quem = orq ? 'orquestradora' : m.id;
    const papel = orq ? 'O' : m.papel;
    if (papel === 'P' || papel === 'D' || papel === 'O') {
      return nega('T1', quem, tipo, 'Execução vai a uma executora E livre e validação a uma validadora V livre (painel: estado parada, etapa livre), por mensagem com o item da fila. Subagente executor/validador não existe mais para planejadora (decisão do operador, 24/10).');
    }
    if (papel === 'E' && tipo === 'validador') return nega('T1', quem, tipo, 'Quem executou não valida: solte o item com `etapa` validacao e sem dono, e o `handoff` gravado.');
    if (papel === 'E' && tipo === 'executor') return nega('T1', quem, tipo, 'Executora executa ela mesma; subagente não grava.');
    if (papel === 'V' && tipo === 'executor') return nega('T1', quem, tipo, 'Validadora não executa: devolva o achado a quem planejou.');
    return;
  }

  if (tool === 'mcp__ccd_session_mgmt__archive_session' || tool === 'mcp__ccd_session_mgmt__delete_session') {
    // delete_session recebe `session_ids` (lista); archive_session, `session_id`. "self" é a própria sessão.
    const alvos = [].concat(ti.session_ids ?? ti.session_id ?? []).map((a) => (a === 'self' ? e.session_id : a));
    for (const alvo of alvos) {
      const reg = registroDaSessao(alvo, { fresco: true });
      if (!reg) { registrar(sid, HOOK, 'alvo-desconhecido', `${tool} ${alvo}`); continue; }
      const m = membroDoPool(reg.titulo);
      if (!m) continue;
      // Exceção (operador, 24/10, teto da Q214): a orquestradora arquiva membro LIVRE acima do teto.
      const quemChama = registroDaSessao(e.session_id);
      if (ehOrquestradora(e.session_id, quemChama?.titulo) && /· livre\s*$/.test(reg.titulo) && alvo !== e.session_id) {
        // Do MESMO projeto (D1, 24/10) ou de projeto SEM orquestradora própria (F23, assumida, a confirmar): `E1 · livre`
        // existe em cada projeto. "Não consegui medir" nunca libera: repo indeterminado de qualquer lado, ou projeto do alvo
        // cuja orquestradora não deu para medir (`projetoTemOrquestradora` → null) → não arquiva.
        const meu = projetoDaSessao(quemChama)?.repo; const dele = projetoDaSessao(reg)?.repo;
        const dela = meu && dele && meu !== dele ? projetoTemOrquestradora(alvo, dele) : undefined;
        if (meu && dele && (meu === dele || dela === false)) {
          registrar(sid, HOOK, 'deixou-arquivar-livre', `${m.id} ${alvo}`);
          continue;
        }
        return nega('T2', m.id, String(alvo), !(meu && dele)
          ? `Não consegui confirmar o projeto de ${meu ? 'o alvo' : 'quem arquiva'} (git do originCwd/cwd): por segurança, membro livre não se arquiva sem a certeza de que é do mesmo projeto.`
          : dela === null
            ? `Não consegui conferir se o projeto desse \`${m.id} · livre\` tem orquestradora própria (marcador sem repo resolvido, transcript velho ou ausente, ou pasta de transcripts ilegível): por segurança, não arquivo.`
            : `Esse \`${m.id} · livre\` é de outro projeto: a orquestradora só arquiva membro livre do próprio projeto.`);
      }
      return nega('T2', m.id, String(alvo), `Membro do pool não se arquiva (decisão do operador, 24/10): quem termina fica livre — título \`${m.id} · livre\` e clear_session. Só a orquestradora arquiva membro livre, para caber no teto.`);
    }
    return;
  }

  if (tool === 'mcp__ccd_session__start_session') {
    const reg = registroDaSessao(e.session_id);
    const b = bandeiraDeAusencia();
    // Cartão (own_initiative) só propõe: com o operador ausente ele fica pronto para quando ele voltar (decisão de 24/10).
    const soPropoe = e.tool_input?.initiation === 'own_initiative';
    if (b && !soPropoe) {
      // Modo ausente (/ausente on até /ausente off): abre sessão só o turno que o OPERADOR começou — ele está ali.
      // Turno de notificação, de mensagem de outra sessão ou de evento não abre: propõe o cartão.
      let origem = null;
      try { origem = e.transcript_path ? origemDoTurno(e.transcript_path) : null; } catch { /* sem transcript */ }
      if (origem !== 'human') {
        return nega('T3a', membroDoPool(reg?.titulo)?.id ?? 'sessao', 'start_session', `Modo ausente ligado desde ${b.desde} (/ausente on). Este turno não foi aberto pelo operador: não abra sessão; proponha o cartão (initiation own_initiative) e deixe o item \`aberto\` na fila para o primeiro membro que liberar.`);
      }
    }
    const m = membroDoPool(reg?.titulo);
    if (m && !ehOrquestradora(e.session_id, reg?.titulo)) {
      return nega('T3b', m.id, 'start_session', 'Membro não abre sessão nova: despache a um membro livre do papel (painel); sem membro livre, deixe o item aberto e avise a orquestradora.');
    }
  }
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
