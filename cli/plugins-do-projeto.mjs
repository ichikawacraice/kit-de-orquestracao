// O perfil de plugins do projeto (F347): `plugins.desligar` do `.claude/kit.json` lista os plugins (`nome@marketplace`) que não
// servem a este projeto. O `kit adotar` e o `kit atualizar` os põem como `false` no `enabledPlugins` do `.claude/settings.json` do
// projeto (a conta não muda); o `kit doutor` confere. Plugin desligado não põe agente, hook nem MCP no contexto de cada sessão.
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

/** Aplica o perfil no settings `s` (mutado). `desligados`: os ids que o kit pôs agora; o `true` que o projeto já tem é conflito. */
export function aplicarDesligados(s, kj) {
  const { ids, avisos } = lerPerfil(kj);
  const desligados = []; const conflitos = [];
  for (const id of ids) {
    const atual = s.enabledPlugins?.[id];
    if (atual === undefined) { s.enabledPlugins = { ...(s.enabledPlugins ?? {}), [id]: false }; desligados.push(id); }
    else if (atual !== false) conflitos.push(`enabledPlugins.${id} já é ${JSON.stringify(atual)} no .claude/settings.json e o kit.json pede desligar — não troquei`);
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
