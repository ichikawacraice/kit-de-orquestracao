// Uso das contas (F475): a resposta de `orca account list --json` vira uma linha por conta (5 horas e semana), só leitura.
// Contas puras: sem Orca, sem relógio (o chamador passa o `agoraMs`).

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

/** Quanto falta para o reinício: `3h 8m`, `6d 7h`, `45m`, `<1m`; sem horário, no passado ou ilegível, `—`. */
export function contagem(resetsAt, agoraMs) {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return '—';
  const falta = resetsAt - agoraMs;
  if (falta <= 0) return '—';
  if (falta < MIN) return '<1m';
  const d = Math.floor(falta / D);
  if (d >= 1) return `${d}d ${Math.floor((falta % D) / H)}h`;
  const h = Math.floor(falta / H);
  if (h >= 1) return `${h}h ${Math.floor((falta % H) / MIN)}m`;
  return `${Math.floor(falta / MIN)}m`;
}

const janela = (j) => {
  if (!j || typeof j.usedPercent !== 'number' || !Number.isFinite(j.usedPercent)) return null;
  return { usado: j.usedPercent, resetsAt: typeof j.resetsAt === 'number' && Number.isFinite(j.resetsAt) ? j.resetsAt : null };
};

// Limite com `status` diferente de ok, sem uso numérico em alguma janela ou ausente: `semDado` (o Orca guarda o último
// número em conta com erro, mas ele é velho: mostrar como se valesse hoje enganaria).
function linha(provedor, ativa, conta, limites) {
  const sessao = limites && limites.status === 'ok' ? janela(limites.session) : null;
  const semana = limites && limites.status === 'ok' ? janela(limites.weekly) : null;
  const semDado = !sessao || !semana;
  return { provedor, id: conta.id, email: conta.email, ativa, semDado, sessao: semDado ? null : sessao, semana: semDado ? null : semana };
}

function doProvedor(provedor, bruto, limitesDaAtiva, inativas) {
  const contas = Array.isArray(bruto?.accounts) ? bruto.accounts.filter((c) => c && typeof c.id === 'string' && typeof c.email === 'string') : [];
  const porId = new Map(contas.map((c) => [c.id, c]));
  const ativaId = typeof bruto?.activeAccountId === 'string' ? bruto.activeAccountId : null;
  const dosInativos = new Map((Array.isArray(inativas) ? inativas : []).map((i) => [i?.accountId, i?.rateLimits]));
  const linhas = [];
  for (const c of porId.values()) {
    if (c.id === ativaId) linhas.push(linha(provedor, true, c, limitesDaAtiva));
    // Conta que está em `accounts` mas não aparece nas inativas (nem é a ativa) ainda não foi lida: sem dado.
    else linhas.push(linha(provedor, false, c, dosInativos.get(c.id)));
  }
  // A ativa primeiro; as outras por e-mail. (`accountId` de inativa sem conta em `accounts` é conta removida: nunca entra.)
  return linhas.sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.email.localeCompare(b.email));
}

/** As contas na ordem da tela: Claude (ativa e depois por e-mail), depois Codex. Lança se a resposta não for a do Orca. */
export function contasDoOrca(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.claude?.accounts)) throw new Error('não é a resposta do Orca');
  const limites = json.rateLimits ?? {};
  return {
    contas: [
      ...doProvedor('claude', json.claude, limites.claude, limites.inactiveClaudeAccounts),
      ...doProvedor('codex', json.codex, limites.codex, limites.inactiveCodexAccounts),
    ],
  };
}
