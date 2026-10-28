// F208: no início de sessão (startup, clear, compact, resume), a orquestradora volta ao papel sem depender de memória.
// Limpar o contexto troca o session_id: o marcador `ativas/<id>` fica órfão e a sessão nova começa sem as travas da
// orquestradora (medido em 27/10: a limpeza chegou como `startup`, o painel-das-sessoes só recria o marcador no fim do
// primeiro turno, e o turno inteiro editou código como dona). Reconhece a sessão pelo registro do app (título
// `🎛 orquestradora`) ou pela batida (`batida/<projeto>.json` com `orquestradora: <local_…>`), recria o marcador da id nova,
// apaga os das ids que ela deixou para trás e devolve a ordem para o additionalContext. Quem chama engole qualquer erro.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registroDaSessao, gitCommonDir } from './pool-comum.mjs';

const ID_SEGURO = /^[\w-]+$/; // o session_id vira nome de arquivo em ativas/

function nomeadaNaBatida(localId) {
  const dir = join(BASE, 'batida');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((n) => {
    if (!n.endsWith('.json')) return false;
    try { return JSON.parse(readFileSync(join(dir, n), 'utf8'))?.orquestradora === localId; } catch { return false; }
  });
}

// → { texto, marcador, apagados } quando a sessão é a orquestradora; null quando não é ou não dá para saber.
export function orquestradoraDeVolta({ sessionId, localId, cwd }) {
  if (!localId || !sessionId || !ID_SEGURO.test(sessionId)) return null;
  const reg = registroDaSessao(localId, { fresco: true });
  if (!reg || reg.arquivada) return null;
  if (!reg.titulo.startsWith('🎛 orquestradora') && !nomeadaNaBatida(localId)) return null;

  const ativas = join(BASE, 'ativas');
  mkdirSync(ativas, { recursive: true });
  const marcador = join(ativas, sessionId);
  writeFileSync(marcador, `${gitCommonDir(reg.originCwd || reg.cwd || cwd) ?? 'null'}\n`);
  const apagados = [];
  // Só as ids que o registro já marca como deixadas para trás. A id atual do registro fica: "o app ainda não gravou a id
  // nova da limpeza" e "um `claude` lançado do Bash da orquestradora" (herda o CLAUDE_CODE_HOST_SESSION_ID) chegam iguais
  // aqui, e no segundo apagar a atual derrubaria as travas da orquestradora viva. O que sobrar, a batida apaga.
  for (const id of reg.cliIds ?? []) {
    if (id === sessionId || id === reg.cliAtual || !ID_SEGURO.test(id) || !existsSync(join(ativas, id))) continue;
    rmSync(join(ativas, id), { force: true });
    apagados.push(id);
  }

  const texto = [
    `# Você é a orquestradora deste projeto (sessão ${localId}${reg.titulo ? `, "${reg.titulo}"` : ''})`,
    '',
    'O contexto desta sessão começou agora (abertura, limpeza ou compactação), mas o papel continua. **Antes de qualquer outra coisa** — inclusive antes de responder ao pedido que abriu este turno —, carregue a skill `orquestracao:orquestradora` e cumpra o "Ao assumir". Pedido de código ou de mudança que chegar vira item com sessão dona, não edição aqui.',
    `O marcador \`ativas/${sessionId}\` já foi recriado por este hook${apagados.length ? ` (saíram os das ids anteriores: ${apagados.join(', ')})` : ''}: as travas da orquestradora valem desde já.`,
  ].join('\n');
  return { texto, marcador, apagados };
}
