// A batida: o julgamento puro de "o que está parado, quem cutucar, o que soltar". Sem I/O: o painel.mjs lê a fila, a lista
// de sessões (`list_sessions`, passada por arquivo) e o estado da batida, chama `julgar` e aplica o resultado (grava o estado,
// solta). Quem chama a cada 10 min é o mod painel-sessoes.
import { slugDoProjeto } from './perguntas-arquivo.mjs';
import { comandoDeRelance } from './fila-orfa.mjs';

export const PRAZO_MIN = 30; // item parado: sem gravar há tanto (PAINEL_PRAZO_MIN troca)
export const BATIDA_SOLTA_MIN = 20; // depois da cutucada, sem gravação, solta (BATIDA_SOLTA_MIN troca)
export const ESPERA_MIN = 5; // sem dona há tanto: vira vaga no relatório da orquestradora
export const CARTAO_VALIDADE_H = 12; // cartão de sessão dona sem clique há tanto sai; enquanto vale, o item não é cobrado de novo (F218)

// F241: quem envia é o mod da sessão que rodou a batida, de qualquer projeto, e o app a mostra como remetente.
export const NOTA_DO_REMETENTE = '(aviso automático da batida: o remetente é só a sessão que rodou a batida desta vez, de qualquer projeto; não responda a ela)';

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
// `itens` (Map F → data, opcional): com ele, a sessão aberta só resolve o cartão quando o item já tem quem trabalhe (ou saiu da
// fila viva), ou quando ela está aberta há PRAZO_MIN sem se gravar dona (morreu ou foi largada: o item volta a ser vaga). Até lá
// o cartão segura a cobrança de outra dona (F218).
export function cartoesResolvidos({ cartoes, linhas, projetoDe, agoraMs, itens = null }) {
  const apagar = [];
  for (const { id, data: c } of cartoes) {
    let proposto = ms(c?.propostoEm);
    if (proposto !== null && proposto > agoraMs) proposto = Math.min(ms(c?.atualizadoEm) ?? agoraMs, agoraMs);
    if (proposto === null || agoraMs - proposto >= CARTAO_VALIDADE_H * 3_600_000) { apagar.push(id); continue; }
    let abertaEm = null; // a sessão do cartão mais antiga aberta depois dele
    for (const r of linhas ?? []) {
      if (!vivoNaLista(r) || !tituloDoCartao(r.title, c) || projetoDe(r) !== slugDoProjeto(c.projeto)) continue;
      const criada = ms(r.createdAt) ?? ms(r.lastActivityAt);
      if (criada !== null && criada >= proposto && (abertaEm === null || criada < abertaEm)) abertaEm = criada;
    }
    if (abertaEm === null) continue;
    const d = itens?.get(c?.itens?.[0]);
    const gravou = !itens || !d || ETAPAS_FINAIS.has(d.etapa) || texto(d.donoLocalId) || (Array.isArray(d.com) && d.com.length > 0);
    if (gravou || agoraMs - abertaEm >= PRAZO_MIN * 60_000) apagar.push(id);
  }
  return apagar;
}

// `filasOrfas`: { <projeto>: fila-orfa.mjs#filaOrfa } — a fila de merge com PR anotado e sem processo vivo (F220). O item em
// merge com PR nela vai ao relatório na hora, sem esperar o prazo, e o relatório leva `filaParada` com o comando de relance.
export function julgar({ agoraMs, itens, linhas, projetoDe, estado, semDona, filasOrfas = {}, donaACaminho = () => false, cartoes = [], ultimo = () => null, caminhoDoRelatorio = () => '', prazoMin = PRAZO_MIN, soltaMin = BATIDA_SOLTA_MIN }) {
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
  const nova = (para, textoDaMensagem, item, tipo) => mensagens.push({ para, texto: `${textoDaMensagem} ${NOTA_DO_REMETENTE}`, item, tipo });
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
      const naFilaOrfa = Array.isArray(d.prs) && (filasOrfas[nome]?.prs ?? []).some((p) => d.prs.includes(p.pr));
      if (parado || naFilaOrfa) proj.merge.push(F);
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

    // O item sem dona há ESPERA_MIN vira vaga de dona no relatório da orquestradora, menos o que já tem a dona a caminho
    // (cartão esperando o clique): a vaga repetida faz a orquestradora propor a segunda dona (F218).
    const r = semDona(d, agoraMs);
    if (r && r.minutos >= ESPERA_MIN && !donaACaminho(F, d, { cartoes, agoraMs })) proj.vagas.push({ papel: 'dona', item: F });
  }
  for (const F of Object.keys(cutucadas)) if (!vistos.has(F)) delete cutucadas[F];
  for (const [nome, o] of Object.entries(filasOrfas)) {
    if (!o?.prs?.length) continue;
    projeto(nome).filaParada = { prs: o.prs.map((p) => p.pr), desde: o.desde ?? null, relance: comandoDeRelance(o) };
  }

  // relatório à orquestradora de cada projeto, só quando algo mudou desde o último
  const relatorios = {};
  for (const [nome, proj] of [...projetos].sort(([a], [b]) => a.localeCompare(b))) {
    const chaves = (x) => [x.merge ?? [], x.vagas ?? [], x.filaParada?.prs ?? []];
    const mudou = JSON.stringify(chaves(proj)) !== JSON.stringify(chaves(ultimo(nome) ?? {}));
    relatorios[nome] = { ...proj, mudou };
    const algo = proj.merge.length || proj.vagas.length || proj.filaParada;
    if (proj.orquestradora && algo && mudou) {
      const partes = [];
      if (proj.filaParada) partes.push(`fila de merge sem processo vivo para ${proj.filaParada.prs.map((n) => `#${n}`).join(', ')} (a limpeza de contexto mata a fila em segundo plano); relance em segundo plano: \`${proj.filaParada.relance}\``);
      if (proj.merge.length) partes.push(`merge parado: ${proj.merge.join(', ')}`);
      if (proj.vagas.length) partes.push(`sem dona: ${proj.vagas.map((v) => v.item).join(', ')}`);
      const hora = new Date(agoraMs).toTimeString().slice(0, 5);
      nova(proj.orquestradora, `Batida ${hora}: ${partes.join('; ')}. Relatório: ${caminhoDoRelatorio(nome)}.`, null, 'relatorio');
    }
  }
  return { mensagens, soltar, projetos: relatorios, estado: { cutucadas, ultima: new Date(agoraMs).toISOString() } };
}
