// A batida: o julgamento puro de "o que está parado, quem cutucar, o que soltar". Sem I/O: o painel.mjs lê a fila, a lista
// de sessões (`list_sessions`, passada por arquivo) e o estado da batida, chama `julgar` e aplica o resultado (grava o estado,
// solta). Quem chama a cada 10 min é o mod painel-sessoes.
import { slugDoProjeto } from './perguntas-arquivo.mjs';

export const PRAZO_MIN = 30; // item parado: sem gravar há tanto (PAINEL_PRAZO_MIN troca)
export const BATIDA_SOLTA_MIN = 20; // depois da cutucada, sem gravação, solta (BATIDA_SOLTA_MIN troca)
export const ESPERA_MIN = 5; // sem dona há tanto: vira vaga no relatório da orquestradora
export const CARTAO_VALIDADE_H = 12; // cartão de sessão dona sem clique há tanto: a orquestradora já o terá reproposto

const ETAPAS_FINAIS = new Set(['feito', 'descartado']);
const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const texto = (v) => typeof v === 'string' && v.trim() !== '';

export const ehDaOrquestradora = (titulo, projeto) => {
  const m = /^🎛 orquestradora — (.+?)\s*$/.exec(titulo || '');
  return Boolean(m) && slugDoProjeto(m[1]) === projeto; // o mesmo slug do painel ("Meu Projeto" → meu-projeto)
};
const vivoNaLista = (row) => row && row.isArchived !== true;

// A sessão aberta pelo cartão se chama `F<n> · …`, com o item do cartão.
const tituloDoCartao = (titulo, c) => (/^(F\d+) · /.exec(titulo || '')?.[1] ?? null) === c.itens?.[0];

// Cartões de sessão dona (coleção `cartoes`) que já não esperam o clique: a sessão `F<n> · …` do item apareceu viva no projeto
// depois de `propostoEm`, ou passou de CARTAO_VALIDADE_H (também quando `propostoEm` não é legível). `linhas` null = sem a lista
// de sessões: só o prazo vale. Sessão de antes de `propostoEm` com o mesmo título é outra e não resolve.
// `propostoEm` no futuro (hora escrita errada) não vale: conta de `atualizadoEm` (a gravação do cartão), ou de agora se faltar.
// `cartoes`: [{ id, data }] → ids a apagar.
export function cartoesResolvidos({ cartoes, linhas, projetoDe, agoraMs }) {
  const apagar = [];
  for (const { id, data: c } of cartoes) {
    let proposto = ms(c?.propostoEm);
    if (proposto !== null && proposto > agoraMs) proposto = Math.min(ms(c?.atualizadoEm) ?? agoraMs, agoraMs);
    if (proposto === null || agoraMs - proposto >= CARTAO_VALIDADE_H * 3_600_000) { apagar.push(id); continue; }
    const aberto = (linhas ?? []).some((r) => {
      if (!vivoNaLista(r) || !tituloDoCartao(r.title, c) || projetoDe(r) !== slugDoProjeto(c.projeto)) return false;
      const criada = ms(r.createdAt) ?? ms(r.lastActivityAt);
      return criada !== null && criada >= proposto;
    });
    if (aberto) apagar.push(id);
  }
  return apagar;
}

export function julgar({ agoraMs, itens, linhas, projetoDe, estado, semDona, ultimo = () => null, caminhoDoRelatorio = () => '', prazoMin = PRAZO_MIN, soltaMin = BATIDA_SOLTA_MIN }) {
  const porId = new Map(linhas.map((r) => [r.sessionId, r]));
  const cutucadas = { ...(estado?.cutucadas ?? {}) };
  const mensagens = []; const soltar = [];
  const projetos = new Map();
  const projeto = (nome) => {
    if (!projetos.has(nome)) projetos.set(nome, { orquestradora: null, merge: [], vagas: [] });
    return projetos.get(nome);
  };
  for (const r of linhas) {
    if (!vivoNaLista(r)) continue;
    const p = projetoDe(r);
    if (p && ehDaOrquestradora(r.title, p)) { const proj = projeto(p); proj.orquestradora = proj.orquestradora ?? r.sessionId; }
  }
  const viva = (id) => vivoNaLista(porId.get(id));
  const nova = (para, textoDaMensagem, item, tipo) => mensagens.push({ para, texto: textoDaMensagem, item, tipo });
  const vistos = new Set();

  for (const [F, d] of [...itens].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    if (!d || ETAPAS_FINAIS.has(d.etapa)) continue;
    const nome = slugDoProjeto(d.projeto); // o mesmo slug das sessões
    if (!nome) continue;
    const proj = projeto(nome);
    vistos.add(F);
    const gente = [...new Set([d.donoLocalId, ...(Array.isArray(d.com) ? d.com.map((c) => c?.localId) : [])].filter(texto))];
    const t = ms(d.atualizadoEm);
    const parado = !d.espera && !d.trava && (t === null || agoraMs - t >= prazoMin * 60_000);
    const minParado = t === null ? null : Math.floor((agoraMs - t) / 60_000);

    if (d.etapa === 'merge') {
      if (parado) proj.merge.push(F);
      continue;
    }
    if (parado && gente.length) {
      if (gente.some((id) => porId.get(id)?.isRunning === true && viva(id))) { delete cutucadas[F]; continue; }
      const presentes = gente.filter(viva);
      if (!presentes.length) {
        soltar.push({ F, motivo: 'a sessão do item foi arquivada ou sumiu' });
        delete cutucadas[F];
        continue;
      }
      const cut = cutucadas[F];
      if (!cut || (t !== null && ms(cut.em) < t)) {
        const alvo = texto(d.donoLocalId) && viva(d.donoLocalId) ? d.donoLocalId : presentes[0];
        nova(alvo, `${F} · ${d.titulo} está parado há ${minParado ?? '?'} min e é seu: siga, grave o \`agora\` ou solte com \`painel soltar ${F} "<motivo>"\`.`, F, 'cutucada');
        cutucadas[F] = { em: new Date(agoraMs).toISOString(), localId: alvo };
      } else if (agoraMs - ms(cut.em) >= soltaMin * 60_000) {
        soltar.push({ F, motivo: `ninguém gravou há ${minParado ?? '?'} min e a dona não respondeu ao aviso` });
        delete cutucadas[F];
      }
      continue;
    }
    delete cutucadas[F];

    // O item sem dona há ESPERA_MIN vira vaga de dona no relatório da orquestradora.
    const r = semDona(d, agoraMs);
    if (r && r.minutos >= ESPERA_MIN) proj.vagas.push({ papel: 'dona', item: F });
  }
  for (const F of Object.keys(cutucadas)) if (!vistos.has(F)) delete cutucadas[F];

  // relatório à orquestradora de cada projeto, só quando algo mudou desde o último
  const relatorios = {};
  for (const [nome, proj] of [...projetos].sort(([a], [b]) => a.localeCompare(b))) {
    const chaves = (x) => [x.merge ?? [], x.vagas ?? []];
    const mudou = JSON.stringify(chaves(proj)) !== JSON.stringify((() => { const u = ultimo(nome); return u ? chaves(u) : [[], []]; })());
    relatorios[nome] = { ...proj, mudou };
    const algo = proj.merge.length || proj.vagas.length;
    if (proj.orquestradora && algo && mudou) {
      const partes = [];
      if (proj.merge.length) partes.push(`merge parado: ${proj.merge.join(', ')}`);
      if (proj.vagas.length) partes.push(`sem dona: ${proj.vagas.map((v) => v.item).join(', ')}`);
      const hora = new Date(agoraMs).toTimeString().slice(0, 5);
      nova(proj.orquestradora, `Batida ${hora}: ${partes.join('; ')}. Relatório: ${caminhoDoRelatorio(nome)}.`, null, 'relatorio');
    }
  }
  return { mensagens, soltar, projetos: relatorios, estado: { cutucadas, ultima: new Date(agoraMs).toISOString() } };
}
