// Transporte de uma mensagem do operador no Orca (F436). O worker do plugin não envia mensagem de orquestração sozinho
// (`no_active_sender_terminal`, medido na F434): envia por um terminal que ele cria. O texto do operador nunca entra na
// linha de shell: assunto e corpo vão em arquivos de um diretório privado e o comando, fixo, os lê com "$(cat …)" — o
// resultado de uma substituição entre aspas não é reinterpretado pelo shell. O destino e o caminho passam por expressão.
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DESTINO = /^(?:run|dispatch|orca_session_id):[A-Za-z0-9_-]+$/;
const CAMINHO_SEGURO = /^[A-Za-z0-9_./-]+$/;
const TIPOS = new Set(['status', 'question', 'decision_gate', 'handoff']);

export const destinoValido = (d) => typeof d === 'string' && DESTINO.test(d);

/** Grava assunto e corpo num diretório 0700 e devolve o comando a mandar ao terminal (sem nenhum texto do operador). */
export function prepararEnvio({ destino, assunto, corpo, tipo = 'status', base = tmpdir(), orca = 'orca' }) {
  if (!destinoValido(destino)) throw new Error(`destino inválido: ${JSON.stringify(destino)}`);
  if (typeof corpo !== 'string' || !corpo.trim()) throw new Error('corpo vazio');
  if (typeof assunto !== 'string' || !assunto.trim()) throw new Error('assunto vazio');
  if (!TIPOS.has(tipo)) throw new Error(`tipo inválido: ${tipo}`);
  if (!CAMINHO_SEGURO.test(orca)) throw new Error(`binário do Orca com caractere inesperado: ${orca}`);
  const dir = mkdtempSync(join(base, 'painel-do-kit-'));
  if (!CAMINHO_SEGURO.test(dir)) throw new Error(`caminho temporário com caractere inesperado: ${dir}`);
  writeFileSync(join(dir, 'assunto'), assunto, { mode: 0o600 });
  writeFileSync(join(dir, 'corpo'), corpo, { mode: 0o600 });
  const comando = `'${orca}' orchestration send --to '${destino}' --type ${tipo} --subject "$(cat '${dir}/assunto')" --body "$(cat '${dir}/corpo')" --json > '${dir}/saida.json' 2>&1; echo $? > '${dir}/fim'; exit`;
  return { dir, comando };
}

/** Lê o desfecho do envio: pronto só depois do marcador de fim; o erro do Orca vira um motivo de uma linha. */
export function lerResultado(dir) {
  if (!existsSync(join(dir, 'fim'))) return { pronto: false };
  let saida = '';
  try { saida = readFileSync(join(dir, 'saida.json'), 'utf8'); } catch { /* sem saída */ }
  const primeira = saida.split('\n').find((l) => l.trim()) ?? '';
  try {
    const j = JSON.parse(primeira);
    if (j?.ok && j.result?.messageId) return { pronto: true, ok: true, messageId: j.result.messageId };
    if (j?.error) return { pronto: true, ok: false, motivo: `${j.error.code}: ${j.error.message}` };
  } catch { /* não é JSON: erro do shell */ }
  return { pronto: true, ok: false, motivo: primeira.trim().slice(0, 200) || `saiu com ${readFileSync(join(dir, 'fim'), 'utf8').trim()}` };
}

const ID_SIMPLES = /^[A-Za-z0-9_-]+$/;

/**
 * Para onde vai o "Responder" de uma entrega: ao worker do Orca, se ainda está vivo; senão à coordenadora da Run dele.
 * A sessão do app do Claude não é alcançável pelo Orca: vai à coordenadora da Run do mesmo projeto, quando há uma.
 */
export function destinoDoSeguimento(e) {
  if (e?.origem === 'orca' && e.vivo && ID_SIMPLES.test(String(e.dispatchId ?? ''))) return { destino: `dispatch:${e.dispatchId}`, quem: 'sessao' };
  const run = e?.origem === 'orca' ? e.run : e?.runDoProjeto;
  if (ID_SIMPLES.test(String(run ?? ''))) return { destino: `run:${run}`, quem: 'coordenadora' };
  return null;
}
