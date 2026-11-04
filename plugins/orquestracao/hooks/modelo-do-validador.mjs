#!/usr/bin/env node
// PreToolUse em `Agent` (F373): o `orquestracao:validador` lançado sem `model` ganha `model: "sonnet"` quando o diff da branch
// não toca contrato nem trava (o corte da via rápida, `pool/via-rapida.mjs`: ADR, spec, migration, schema, hook, gate, CI,
// manifesto, protocolo, agentes, arquivo removido ou binário). Com risco no diff, ou com `model` dado pela dona, não mexe: fica o
// padrão do agente (Opus) ou a escolha dela. O que o diff não mostra (estado gravado, segurança, produção, item que voltou da
// fila) a dona declara passando `model: "opus"`. Medido em 02-04/11: 541 de 564 rodadas do validador em Opus, a regra de
// passar Sonnet em item mecânico existia só no texto.
// O `updatedInput` substitui o pedido inteiro (doc dos hooks): vai o pedido de antes mais o `model`.
// Erro, base não achada ou fora de git: não mexe (o padrão do agente é o mais seguro) e registra.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { corte } from '../pool/via-rapida.mjs';
import { acharBase } from '../skills/orquestradora/scripts/testes-afetados.mjs';

const HOOK = 'modelo-do-validador';
const VALIDADOR = /^(?:orquestracao:)?validador$/;

export function decidir(e) {
  if (e.tool_name !== 'Agent' && e.tool_name !== 'Task') return null;
  const pedido = e.tool_input ?? {};
  if (!VALIDADOR.test(String(pedido.subagent_type ?? ''))) return null;
  if (pedido.model) return { desfecho: 'escolhido', detalhe: String(pedido.model) };
  const cwd = e.cwd || process.cwd();
  const r = corte(cwd, acharBase(cwd));
  if (r.validador !== 'sonnet') return { desfecho: 'opus', detalhe: r.risco.join('; ') || 'diff vazio' };
  return {
    desfecho: 'sonnet',
    detalhe: `${r.linhas} linhas em ${r.arquivos.length} arquivos`,
    saida: {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: `Validador em Sonnet: o diff (${r.linhas} linhas em ${r.arquivos.length} arquivos) não toca contrato nem trava. Item que grava estado, toca segurança ou produção, ou voltou da fila: lance de novo com model: "opus".`,
        updatedInput: { ...pedido, model: 'sonnet' },
      },
    },
  };
}

const principal = (() => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (principal) {
  let e = {};
  try {
    e = lerEntrada();
    const d = decidir(e);
    if (d) {
      registrar(e.session_id, HOOK, d.desfecho, d.detalhe);
      if (d.saida) process.stdout.write(JSON.stringify(d.saida));
    }
  } catch (err) {
    registrar(e?.session_id, HOOK, 'erro', String(err?.message || err));
  }
  process.exitCode = 0;
}
