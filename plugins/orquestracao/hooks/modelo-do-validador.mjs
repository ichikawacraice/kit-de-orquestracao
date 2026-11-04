#!/usr/bin/env node
// PreToolUse em `Agent` (F373, ADR 0021): o modelo do `orquestracao:validador` sai do item e do diff, não da memória da dona.
// Lançado sem `model` pela dona de um item vivo:
//   - o item declarado de risco (`risco: true` no painel), ou o diff com contrato ou trava (o corte da via rápida,
//     `pool/via-rapida.mjs`: ADR, spec, migration, schema, hook, gate, CI, manifesto, protocolo, agentes, removido, binário)
//     → não mexe: fica o Opus do agente;
//   - o item declarado sem risco (`risco: false`) e o diff limpo → `model: "sonnet"` (`updatedInput`), com o aviso no contexto;
//   - o risco não declarado e o diff limpo → recusa o lançamento pedindo a declaração (uma vez por item; o que o diff não
//     mostra — estado gravado, segurança, dinheiro, produção, item que voltou da fila — só a dona sabe).
// `model` dado pela dona vale sempre. Sessão que não é dona de item vivo, erro, base não achada: não mexe (o padrão é Opus).
// Medido de 02 a 04/11: 128 de 131 rodadas do validador em Opus; a regra de passar Sonnet em item mecânico só existia no texto.
// O `updatedInput` substitui o pedido inteiro (doc dos hooks): vai o pedido de antes mais o `model`. O
// `permissionDecisionReason` de um `allow` só vai ao log de depuração; o aviso à dona vai em `additionalContext`.
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { registroDaSessao, itensDonosDaSessao, filaDir } from './pool-comum.mjs';
import { corte } from '../pool/via-rapida.mjs';
import { acharBase } from '../skills/orquestradora/scripts/testes-afetados.mjs';

const HOOK = 'modelo-do-validador';
const VALIDADOR = /^(?:orquestracao:)?validador$/;

export function decidir(e) {
  if (e.tool_name !== 'Agent' && e.tool_name !== 'Task') return null;
  const pedido = e.tool_input ?? {};
  if (!VALIDADOR.test(String(pedido.subagent_type ?? ''))) return null;
  if (pedido.model) return { desfecho: 'escolhido', detalhe: String(pedido.model) };
  const ids = itensDonosDaSessao(registroDaSessao(e.session_id)?.localId);
  if (!ids.length) return { desfecho: 'opus', detalhe: 'sem item vivo da sessão' };
  const declarado = ids.map(riscoDoItem);
  const itens = ids.join(',');
  if (declarado.includes(true)) return { desfecho: 'opus', detalhe: `${itens}: risco declarado` };
  const cwd = e.cwd || process.cwd();
  const r = corte(cwd, acharBase(cwd));
  if (r.validador !== 'sonnet') return { desfecho: 'opus', detalhe: `${itens}: ${r.risco.join('; ') || 'diff vazio'}` };
  if (declarado.some((x) => x !== false)) {
    const id = ids[declarado.findIndex((x) => x !== false)];
    return {
      desfecho: 'pediu-risco',
      detalhe: itens,
      saida: {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Declare antes o risco do ${id}, uma vez: \`painel update fila ${id} '{"risco":true}'\` se o item grava estado (banco, arquivo de estado, painel), toca segurança, dinheiro ou produção, ou voltou da fila; \`painel update fila ${id} '{"risco":false}'\` se não. O diff (${r.linhas} linhas em ${r.arquivos.length} arquivos) não toca contrato nem trava: com risco false o validador roda em Sonnet; com true, em Opus. Depois lance o validador de novo.`,
        },
      },
    };
  }
  const aviso = `Validador em Sonnet: ${itens} declarado sem risco e o diff (${r.linhas} linhas em ${r.arquivos.length} arquivos) não toca contrato nem trava. Se o item passou a gravar estado, tocar segurança ou produção, ou voltou da fila: grave "risco":true no item e lance de novo com model: "opus".`;
  return {
    desfecho: 'sonnet',
    detalhe: `${itens}: ${r.linhas} linhas em ${r.arquivos.length} arquivos`,
    saida: {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: aviso,
        additionalContext: aviso,
        updatedInput: { ...pedido, model: 'sonnet' },
      },
    },
  };
}

// `risco` do item na fila: true, false, ou undefined (não declarado, ou item ilegível).
function riscoDoItem(id) {
  try {
    const v = JSON.parse(readFileSync(join(filaDir(), `${id}.json`), 'utf8'))?.data?.risco;
    return typeof v === 'boolean' ? v : undefined;
  } catch { return undefined; }
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
