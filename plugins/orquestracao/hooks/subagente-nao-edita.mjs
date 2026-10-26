#!/usr/bin/env node
// PreToolUse (Q154, 23/10): quem escreve é sessão, como TRAVA. Subagente (evento com `agent_id`)
// que chama Edit/Write/MultiEdit/NotebookEdit fora das pastas livres → `deny`, com o motivo. O
// subagente não aparece na lista de sessões nem no painel e, quando morre, deixa mudança no disco
// sem dono (11–13/10); trabalho que grava vai para sessão `exec · …`. Sessão aberta com
// `--agent executor` chega com `agent_type` e SEM `agent_id`: é sessão, e passa.
// `deny`, não `ask`: a decisão já foi tomada (Q154) e o subagente em background não teria a quem
// perguntar. Vale em bypass. Bash fica de fora pelo mesmo motivo do orquestradora-nao-edita
// (parsear shell deu 50 alertas falsos); o briefing do subagente diz que ele não grava.
// Exceção por papel: subagent_type listado em subagente-pode-escrever.txt (um por linha, `*` no
// fim casa prefixo, `#` comenta) — o designer do projeto e os agentes de plugin que gravam. A lista
// casa o tipo inteiro e o tipo sem o prefixo `orquestracao:` ou `design:` (os plugins do kit):
// `designer` libera `design:designer`, mas `outro:designer` e `outro:executor` não ganham a exceção.
// `design:designer` vem liberado mesmo sem a lista: só grava doc, e a guarda do plugin design já
// lhe nega o código de tela.
// Erro do hook vai para o log e a ferramenta segue.
import { existsSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BASE, registrar, lerEntrada, semPrefixoDoPlugin } from './hooks-crewai-comum.mjs';

const HOOK = 'subagente-nao-edita';
const H = homedir();

// Livre: toda a ~/.claude (estado, memória, planos, skills), o estado da orquestração, o rascunho
// (scratchpad/tmp) e as notas entre sessões. O que a trava guarda é o código e a doc do projeto.
const LIVRES = [
  (p) => p.startsWith(BASE + '/'),
  (p) => p.startsWith(join(H, '.claude') + '/'),
  (p) => p.startsWith(join(H, 'Library', 'Application Support', 'Claude', 'side-session-notes') + '/'),
  (p) => /^\/(private\/)?tmp\//.test(p) || p.startsWith('/var/folders/') || p.startsWith('/private/var/folders/'),
  (p) => p.startsWith(resolve(tmpdir()) + '/'),
];

// Valem sem a lista: o designer do próprio kit grava a revisão de design.
const LIBERADOS_DO_KIT = ['design:designer'];

function tipoLiberado(tipo) {
  if (!tipo) return false;
  if (LIBERADOS_DO_KIT.includes(tipo)) return true;
  const lista = join(BASE, 'subagente-pode-escrever.txt');
  if (!existsSync(lista)) return false;
  const nomes = [tipo, semPrefixoDoPlugin(tipo), tipo.replace(/^design:/, '')];
  return readFileSync(lista, 'utf8').split('\n')
    .map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    .some((t) => nomes.some((n) => (t.endsWith('*') ? n.startsWith(t.slice(0, -1)) : n === t)));
}

function caminhoDe(entrada) {
  const ti = entrada.tool_input || {};
  let p = ti.file_path || ti.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(H, p.slice(2));
  return resolve(entrada.cwd || process.cwd(), p);
}

function main() {
  const e = lerEntrada();
  if (!e.agent_id) return;
  const p = caminhoDe(e);
  if (!p || LIVRES.some((f) => f(p))) return;
  const quem = `subagente ${e.agent_type || e.agent_id}`;
  if (tipoLiberado(e.agent_type)) {
    registrar(e.session_id || '-', HOOK, 'liberado-por-tipo', `${quem} ${e.tool_name} ${p}`);
    return;
  }

  registrar(e.session_id || '-', HOOK, 'recusou', `${quem} ${e.tool_name} ${p}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Subagente não grava arquivo do projeto (${p}): quem escreve é sessão. ` +
        'Pare e devolva no relatório o que gravaria (arquivo e conteúdo); quem te lançou despacha ' +
        'a uma executora E livre do pool (ou, fora do pool, abre uma sessão executora).',
    },
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
