// O perfil de plugins do projeto (F347): `plugins.desligar` do `.claude/kit.json` lista os plugins (`nome@marketplace`) que não
// servem a este projeto. O `kit adotar` e o `kit atualizar` os põem como `false` no `enabledPlugins` do `.claude/settings.json` do
// projeto (a conta não muda); o `kit doutor` confere. Plugin desligado não põe agente, hook nem MCP no contexto de cada sessão.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = /^[\w.-]+@[\w.-]+$/;

/** Os ids válidos de `plugins.desligar` e os avisos do que não vale. */
function lerPerfil(kj) {
  const lista = kj?.plugins?.desligar;
  if (lista === undefined) return { ids: [], avisos: [] };
  if (!Array.isArray(lista)) return { ids: [], avisos: [`plugins.desligar precisa ser uma lista de "nome@marketplace", e veio ${JSON.stringify(lista)}`] };
  const ids = []; const avisos = [];
  for (const id of lista) {
    if (typeof id !== 'string' || !ID.test(id)) avisos.push(`plugins.desligar: ${JSON.stringify(id)} não é nome@marketplace; ignorado`);
    // sem ele o kit não roda no projeto (o doutor reprova): não se desliga pelo perfil, com o marketplace novo ou o antigo
    else if (id.startsWith('orquestracao@')) avisos.push(`plugins.desligar: ${id} não se desliga pelo perfil (o kit roda nele); ignorado`);
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, avisos };
}

/**
 * Aplica o perfil no settings `s` (mutado). `desligados`: os ids que ficam como `false` por conta do kit. O `true` que o projeto
 * pôs é conflito; o que o próprio kit pôs (`doKit`, os plugins do kit que o lock registra) vira `false`. Na retomada de uma
 * adoção interrompida (`recuperando`), o `false` já gravado é do kit.
 */
export function aplicarDesligados(s, kj, { doKit = [], recuperando = false } = {}) {
  const { ids, avisos } = lerPerfil(kj);
  const desligados = []; const conflitos = [];
  for (const id of ids) {
    const atual = s.enabledPlugins?.[id];
    if (atual === undefined || (atual === true && doKit.includes(id))) { s.enabledPlugins = { ...(s.enabledPlugins ?? {}), [id]: false }; desligados.push(id); }
    else if (atual === false) { if (recuperando) desligados.push(id); }
    else conflitos.push(`enabledPlugins.${id} já é ${JSON.stringify(atual)} no .claude/settings.json e o kit.json pede desligar — não troquei`);
  }
  return { desligados, conflitos, avisos };
}

/** As linhas do doutor. `configs`: [conta, projeto, local] (settings lidos ou null). */
export function conferirDesligados(kj, configs) {
  const { ids, avisos } = lerPerfil(kj);
  if (!ids.length && !avisos.length) return [];
  const linhas = avisos.map((a) => `aviso: ${a}`);
  const faltam = ids.filter((id) => configs[1]?.enabledPlugins?.[id] !== false);
  const religa = ids.filter((id) => configs[2]?.enabledPlugins?.[id] === true);
  for (const id of faltam) linhas.push(`aviso: o kit.json pede desligar ${id} e o .claude/settings.json não desliga — rode \`kit atualizar\``);
  for (const id of religa) linhas.push(`aviso: o .claude/settings.local.json religa ${id}, que o kit.json desliga para o projeto`);
  if (ids.length && !faltam.length) linhas.push(`ok: o perfil do projeto desliga ${ids.length} plugin(s) no .claude/settings.json`);
  return linhas;
}

// O tema do design-system (F353): `design.tema` do `.claude/kit.json` (o nome do plugin, `tema-<marca>`) pede `tema-<marca>@ichikawa-kit` no
// projeto. A marca é do projeto, nunca da conta: o `kit adotar` e o `kit atualizar` o ligam no `.claude/settings.json`, o `kit doutor` confere.
export const TEMA_DO_KIT = /^tema-[a-z0-9-]+@ichikawa-kit$/;
const MARKETPLACE_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'marketplace.json');
const temasListados = () => { try { return JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8')).plugins.map((p) => p.name).filter((n) => n.startsWith('tema-')); } catch { return []; } };

/** O id do plugin de tema que o kit.json pede (`{ id }`), nenhum (`{}`) ou o motivo de não valer (`{ aviso }`). */
function temaPedido(kj) {
  const tema = kj?.design?.tema;
  if (tema === undefined) return {};
  if (typeof tema !== 'string' || !/^tema-[a-z0-9-]+$/.test(tema)) return { aviso: `design.tema precisa ser o nome do plugin de tema (tema-<marca>), e veio ${JSON.stringify(tema)}; ignorado` };
  if (!temasListados().includes(tema)) return { aviso: `design.tema "${tema}": o marketplace do kit não lista o plugin ${tema}; nada ligado` };
  return { id: `${tema}@ichikawa-kit` };
}

/** Liga no settings `s` (mutado) o tema que o kit.json pede. `id`: o plugin pedido (ou null); `ligado`: o kit o pôs como `true` agora. O `false` do projeto fica. */
export function aplicarTema(s, kj) {
  const { id = null, aviso } = temaPedido(kj);
  if (!id) return { id, ligado: false, avisos: aviso ? [aviso] : [] };
  const atual = s.enabledPlugins?.[id];
  if (atual === undefined) { s.enabledPlugins = { ...(s.enabledPlugins ?? {}), [id]: true }; return { id, ligado: true, avisos: [] }; }
  return { id, ligado: false, avisos: atual === false ? [`o .claude/kit.json pede o tema ${id} e o .claude/settings.json o desliga — não troquei`] : [] };
}

/** As linhas do doutor sobre o tema. `configs`: [conta, projeto, local] (settings lidos ou null). */
export function conferirTema(kj, configs) {
  const { id, aviso } = temaPedido(kj);
  if (aviso) return [`aviso: ${aviso}`];
  const linhas = [];
  const naConta = Object.keys(configs[0]?.enabledPlugins ?? {}).filter((k) => TEMA_DO_KIT.test(k) && configs[0].enabledPlugins[k] === true);
  for (const k of naConta) linhas.push(`aviso: a conta liga ${k}: a marca valeria em todo projeto da máquina; ligue o tema só no projeto, por design.tema no .claude/kit.json`);
  if (!id) return linhas;
  if (configs[1]?.enabledPlugins?.[id] === true) linhas.push(`ok: o tema ${id} ligado no projeto, como pede o design.tema`);
  else linhas.push(`aviso: o .claude/kit.json pede o tema (design.tema) e o .claude/settings.json não liga ${id} — rode \`kit atualizar\``);
  return linhas;
}
