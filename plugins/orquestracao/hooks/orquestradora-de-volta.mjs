// F208: no início de sessão (startup, clear, compact, resume), a orquestradora volta ao papel sem depender de memória.
// Limpar o contexto troca o session_id: o marcador `ativas/<id>` fica órfão e a sessão nova começa sem as travas da
// orquestradora (medido em 27/10: a limpeza chegou como `startup`, o painel-das-sessoes só recria o marcador no fim do
// primeiro turno, e o turno inteiro editou código como dona). Reconhece a sessão pelo registro do app (título
// `🎛 orquestradora`) ou pela batida (`batida/<projeto>.json` com `orquestradora: <local_…>`), recria o marcador da id nova,
// apaga os das ids que ela deixou para trás e devolve a ordem para o additionalContext. Quem chama engole qualquer erro.
// F220: a limpeza também mata a fila de merge que rodava em segundo plano; a fila do projeto órfã entra no aviso, com a
// chamada que a retoma.
// F447: no Orca o título da conversa não se troca; a orquestradora se declara por `painel orquestradora assumir`, que grava o
// id do Orca (`orca_session_id:…`) na 2ª linha do marcador, e volta por ele: o id do Orca não muda ao limpar o contexto.
// F351: o arquivo de estado do projeto (`<BASE>/<repo>.md`) gira aqui, antes do "Ao assumir" lê-lo: as seções datadas antigas
// vão ao arquivo morto (estado-girar.mjs) e a orquestradora lê só o vivo.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registroDaSessao, gitCommonDir, projetoDaSessao } from './pool-comum.mjs';
import { avisoSemGate, comandoDeRelance, lerFilaOrfa } from '../skills/orquestradora/scripts/fila-orfa.mjs';
import { girarArquivo } from '../skills/orquestradora/scripts/estado-girar.mjs';
import { cliParado } from './orca-sessoes.mjs';

const ID_SEGURO = /^[\w-]+$/; // o session_id vira nome de arquivo em ativas/

function nomeadaNaBatida(localId) {
  const dir = join(BASE, 'batida');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((n) => {
    if (!n.endsWith('.json')) return false;
    try { return JSON.parse(readFileSync(join(dir, n), 'utf8'))?.orquestradora === localId; } catch { return false; }
  });
}

// Algum marcador de `ativas/` traz este id do Orca na 2ª linha.
function marcadaNoOrca(localId) {
  if (!String(localId).startsWith('orca_session_id:')) return false;
  const dir = join(BASE, 'ativas');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((id) => {
    try { return readFileSync(join(dir, id), 'utf8').split('\n')[1]?.trim() === localId; } catch { return false; }
  });
}

// O estado da fila mora ao lado do painel (painel.mjs: <PAINEL_DIR>/../fila-de-merge), que no uso real é <BASE>/fila-de-merge.
const pastaDasFilas = () => (process.env.PAINEL_DIR ? join(process.env.PAINEL_DIR, '..', 'fila-de-merge') : join(BASE, 'fila-de-merge'));

function avisoDaFila(reg) {
  try {
    const nome = projetoDaSessao(reg)?.nome;
    const orfa = nome ? lerFilaOrfa(join(pastaDasFilas(), `${nome}.json`)) : null;
    if (!orfa) return '';
    return [
      `**A fila de merge deste projeto está sem processo** (ocupada desde ${orfa.desde ?? '?'}; a limpeza de contexto mata a fila que roda em segundo plano): ${orfa.prs.map((p) => `#${p.pr}`).join(', ')} ficaram anotados e ninguém os leva.`,
      `Depois de carregar a skill, relance em segundo plano (run_in_background): \`${comandoDeRelance(orfa)}\`${avisoSemGate(orfa)}.`,
    ].join(' ');
  } catch { return ''; }
}

// O `<repo>.md` do projeto: o nome do arquivo é o do repositório, com a caixa que a orquestradora escolheu (Projeto.md ou projeto.md).
function giroDoEstado(reg) {
  try {
    const nome = projetoDaSessao(reg)?.nome;
    if (!nome) return '';
    const arq = readdirSync(BASE).find((n) => n.endsWith('.md') && n.slice(0, -3).toLowerCase() === nome);
    if (!arq) return '';
    const g = girarArquivo(join(BASE, arq));
    if (!g.movidas.length && !g.entregasMovidas) return '';
    return `O arquivo de estado \`${arq}\` girou (${Math.round(g.antes / 1024)} → ${Math.round(g.depois / 1024)} KB): ${g.movidas.length} seção(ões) datada(s) antiga(s)${g.entregasMovidas ? ` e ${g.entregasMovidas} entrega(s) antiga(s)` : ''} foram para \`${g.morto}\`; leia só o vivo e busque no morto com grep quando precisar.`;
  } catch { return ''; }
}

// → { texto, marcador, apagados } quando a sessão é a orquestradora; null quando não é ou não dá para saber.
export function orquestradoraDeVolta({ sessionId, localId, cwd, source }) {
  if (!localId || !sessionId || !ID_SEGURO.test(sessionId)) return null;
  const reg = registroDaSessao(localId, { fresco: true });
  if (!reg || reg.arquivada) return null;
  if (!reg.titulo.startsWith('🎛 orquestradora') && !nomeadaNaBatida(localId) && !marcadaNoOrca(localId)) return null;

  const ativas = join(BASE, 'ativas');
  mkdirSync(ativas, { recursive: true });
  const marcador = join(ativas, sessionId);
  const doOrca = String(localId).startsWith('orca_session_id:') ? `${localId}\n` : '';
  writeFileSync(marcador, `${gitCommonDir(reg.originCwd || reg.cwd || cwd) ?? 'null'}\n${doOrca}`);
  const apagados = [];
  // Só as ids que o registro já marca como deixadas para trás. A id atual do registro fica: "o app ainda não gravou a id
  // nova da limpeza" e "um `claude` lançado do Bash da orquestradora" (herda o CLAUDE_CODE_HOST_SESSION_ID) chegam iguais
  // aqui, e no segundo apagar a atual derrubaria as travas da orquestradora viva. O que sobrar, a batida apaga.
  // No Orca o próprio início regrava o registro: o `claude` filho vira o CLI atual e a orquestradora vira "anterior". Fora da
  // limpeza e da compactação (que trocam o id de verdade), a id anterior só sai com o transcript parado há 30 min.
  const trocouDeVerdade = !doOrca || source === 'clear' || source === 'compact';
  for (const id of reg.cliIds ?? []) {
    if (id === sessionId || id === reg.cliAtual || !ID_SEGURO.test(id) || !existsSync(join(ativas, id))) continue;
    if (!trocouDeVerdade && cliParado(id) !== true) continue;
    rmSync(join(ativas, id), { force: true });
    apagados.push(id);
  }

  const texto = [
    `# Você é a orquestradora deste projeto (sessão ${localId}${reg.titulo ? `, "${reg.titulo}"` : ''})`,
    '',
    'O contexto desta sessão começou agora (abertura, limpeza ou compactação), mas o papel continua. **Antes de qualquer outra coisa** — inclusive antes de responder ao pedido que abriu este turno —, carregue a skill `orquestracao:orquestradora` e cumpra o "Ao assumir". Pedido de código ou de mudança que chegar vira item com sessão dona, não edição aqui.',
    `O marcador \`ativas/${sessionId}\` já foi recriado por este hook${apagados.length ? ` (saíram os das ids anteriores: ${apagados.join(', ')})` : ''}: as travas da orquestradora valem desde já.`,
    avisoDaFila(reg),
    giroDoEstado(reg),
  ].filter((l, i) => i < 3 || l).join('\n');
  return { texto, marcador, apagados };
}
