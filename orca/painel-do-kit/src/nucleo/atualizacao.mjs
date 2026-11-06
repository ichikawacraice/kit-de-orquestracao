// Aviso de atualização do kit na aba (F463): há versão publicada mais nova que a instalada? É a mesma conta do `pode-reiniciar` do
// kit (`lerParaBaixar` em plugins/orquestracao/skills/orquestradora/scripts/pode-reiniciar.mjs), refeita aqui porque o plugin do Orca
// anda sozinho (não pode importar do plugin do Claude); `test/atualizacao.test.mjs` compara as duas. No Orca a batida não roda, então
// a aba lê o cache `batida/kit-publicado.json` (o mesmo arquivo do kit) e, vencido o prazo, refaz a conferência em segundo plano:
// ler a aba nunca espera a rede, e a rede só é tocada uma vez a cada 30 min.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const KIT_PUBLICADO_VALE_MS = 30 * 60_000;
const GIT_TIMEOUT_MS = 20_000;
const MARKETPLACES = ['ichikawa-kit', 'kit-de-orquestracao']; // o nome novo primeiro: com os dois instalados, vale o novo
const RENOMEADOS = { design: 'kit-design' };
const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;
const comparar = (a, b) => { const x = RELEASE.exec(a).slice(1).map(Number); const y = RELEASE.exec(b).slice(1).map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/** Os plugins do kit com escopo user: [{ nome, versao, marketplace }]. Sem o arquivo, nenhum. */
export function lerInstalados(home) {
  let reg = null;
  try { reg = JSON.parse(readFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8')); } catch { return []; }
  const ids = Object.keys(reg?.plugins ?? {});
  const marketplace = MARKETPLACES.find((m) => ids.some((id) => id.endsWith(`@${m}`))) ?? MARKETPLACES[0];
  return Object.entries(reg?.plugins ?? {}).flatMap(([id, lista]) => {
    if (!id.endsWith(`@${marketplace}`) || !Array.isArray(lista)) return [];
    const user = lista.find((e) => e?.scope === 'user' && typeof e.version === 'string');
    return user ? [{ nome: id.slice(0, -marketplace.length - 1), versao: user.version, marketplace }] : [];
  });
}

const lerCache = (cache) => { try { const c = JSON.parse(readFileSync(cache, 'utf8')); return { em: Date.parse(c?.em ?? ''), publicado: c?.publicado ?? null }; } catch { return null; } };

/** As versões publicadas que o cache guarda, de qualquer idade ({ nome: versao }), ou null. */
export const publicadoDoCache = (cache) => lerCache(cache)?.publicado ?? null;

/** O cache ainda vale (menos de 30 min, e não vem do futuro)? */
export function cacheVale(cache, agoraMs = Date.now()) {
  const c = lerCache(cache);
  return Boolean(c && !Number.isNaN(c.em) && agoraMs - c.em < KIT_PUBLICADO_VALE_MS && agoraMs >= c.em);
}

/** Os plugins com versão publicada mais nova que a instalada: [{ nome, instalada, publicada }]. */
export function paraBaixar(instalados, publicado) {
  if (!publicado) return [];
  return instalados.flatMap((p) => {
    // plugin renomeado: o velho instalado e só o novo publicado pede o atualizar-plugins, que troca um pelo outro
    const novo = RENOMEADOS[p.nome];
    if (novo && publicado[novo] && !publicado[p.nome]) return RELEASE.test(publicado[novo]) ? [{ nome: novo, instalada: p.versao, publicada: publicado[novo] }] : [];
    const v = publicado[p.nome];
    return RELEASE.test(v ?? '') && RELEASE.test(p.versao) && comparar(p.versao, v) < 0 ? [{ nome: p.nome, instalada: p.versao, publicada: v }] : [];
  });
}

/** O clone do marketplace do kit nesta máquina (a árvore dele não anda: só o fetch). */
export const cloneDoMarketplace = (home) => join(home, '.claude', 'plugins', 'marketplaces', lerInstalados(home)[0]?.marketplace ?? MARKETPLACES[0]);

const git = (clone, args) => new Promise((resolve, reject) =>
  execFile('git', ['-C', clone, ...args], { encoding: 'utf8', timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 }, (err, so) => (err ? reject(err) : resolve(so))));

/** `git fetch` no clone e leitura das versões do `main` publicado; grava o cache (também a tentativa que falhou, com o que já se sabia: o prazo vale para a rede). */
export async function atualizarCache({ clone, cache, agoraMs = Date.now() }) {
  let publicado = null;
  const anterior = publicadoDoCache(cache); // a conferência que falha não apaga o que já se sabia
  // fetch que falha (sem rede, ou outro fetch segurando o ref): vale o `origin/main` que o clone já tem
  let ref = 'FETCH_HEAD';
  try { await git(clone, ['fetch', '--quiet', 'origin', 'main']); } catch { ref = 'origin/main'; }
  try {
    const entradas = JSON.parse(await git(clone, ['show', `${ref}:.claude-plugin/marketplace.json`])).plugins;
    publicado = {};
    for (const { name: nome, source } of entradas) {
      const pasta = typeof source === 'string' ? source.replace(/^\.\//, '').replace(/\/$/, '') : `plugins/${nome}`;
      try { publicado[nome] = JSON.parse(await git(clone, ['show', `${ref}:${pasta}/.claude-plugin/plugin.json`])).version; } catch { /* sem manifesto */ }
    }
  } catch { publicado = anterior; }
  try { mkdirSync(dirname(cache), { recursive: true }); writeFileSync(cache, `${JSON.stringify({ em: new Date(agoraMs).toISOString(), publicado })}\n`); } catch { /* sem cache */ }
  return publicado;
}
