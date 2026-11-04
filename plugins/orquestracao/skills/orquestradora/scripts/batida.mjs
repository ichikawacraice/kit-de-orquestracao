// A batida: o julgamento puro de "o que está parado, quem cutucar, o que soltar". Sem I/O: o painel.mjs lê a fila, a lista
// de sessões (`list_sessions`, passada por arquivo) e o estado da batida, chama `julgar` e aplica o resultado (grava o estado,
// solta). Quem chama a cada 10 min é o mod painel-sessoes.
import { slugDoProjeto } from './perguntas-arquivo.mjs';
import { comandoDeRelance } from './fila-orfa.mjs';

export const PRAZO_MIN = 30; // item parado: sem gravar há tanto (PAINEL_PRAZO_MIN troca)
export const BATIDA_SOLTA_MIN = 20; // depois da cutucada, sem gravação, solta (BATIDA_SOLTA_MIN troca)
export const ESPERA_MIN = 5; // sem dona há tanto: vira vaga no relatório da orquestradora
const LIMITE_VELHO_MS = 24 * 3_600_000; // F371: recusa de limite com reset mais velho que isto não conta
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
// F351: `filasVivas` { <projeto>: [pr] } são os PRs que uma fila com processo vivo (ou lançada agora pela batida) vai levar: o
// item em merge com PR nela não está parado. `desfechos` { <projeto>: [desfecho] } são os resultados da fila que rodou sem turno
// (`fila-de-merge --sem-turno`): a batida avisa a dona do PR devolvido e da fatia mergeada, e manda à orquestradora um resumo só
// do que é dela. A saída `desfechos` diz, por projeto, quantos foram entregues à orquestradora (saem do arquivo) e quantos só às
// donas (ficam, marcados, até haver orquestradora).
// F371: `limites` { <local_…>: { resetsAtMs } } são as donas paradas no limite de uso (limite-de-uso.mjs, lido do transcript). Antes do
// reset o item dela não é cutucado nem solto (a cutucada só bate de novo no limite); passado o reset, a dona parada recebe uma vez
// por reset (estado `limites`) a mensagem de retomar, com o handoff de cada item (`handoffDe(F)` → caminho ou null).
export function julgar({ agoraMs, itens, linhas, projetoDe, estado, semDona, filasOrfas = {}, filasVivas = {}, desfechos = {}, donaACaminho = () => false, cartoes = [], ultimo = () => null, caminhoDoRelatorio = () => '', prazoMin = PRAZO_MIN, soltaMin = BATIDA_SOLTA_MIN, limites = {}, handoffDe = () => null }) {
  const porId = new Map(linhas.map((r) => [r.sessionId, r]));
  const cutucadas = { ...(estado?.cutucadas ?? {}) };
  // a hora do reset já avisada, por dona; sai 24 h depois do reset
  const avisados = Object.fromEntries(Object.entries(estado?.limites ?? {}).filter(([, em]) => (ms(em) ?? 0) > agoraMs - LIMITE_VELHO_MS));
  const retomar = new Map(); // dona → { resetsAtMs, itens: [F] }
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

    // a recusa cujo reset passou há mais de 24 h é velha (a batida não a viu a tempo, ou a mensagem não mudou o transcript): fluxo
    // normal, para a retomada não sair em laço nem segurar o item; dona arquivada também segue o fluxo normal (o item é solto)
    const lim = d.etapa !== 'merge' && texto(d.donoLocalId) && viva(d.donoLocalId) ? limites[d.donoLocalId] : null;
    if (lim && Number.isFinite(lim.resetsAtMs) && agoraMs - lim.resetsAtMs < LIMITE_VELHO_MS) {
      if (agoraMs < lim.resetsAtMs) { delete cutucadas[F]; continue; } // espera o reset: nem cutuca nem solta
      const r = porId.get(d.donoLocalId);
      if (viva(d.donoLocalId) && r?.isRunning !== true && avisados[d.donoLocalId] !== new Date(lim.resetsAtMs).toISOString()) {
        const x = retomar.get(d.donoLocalId) ?? { resetsAtMs: lim.resetsAtMs, itens: [] };
        x.itens.push(F); retomar.set(d.donoLocalId, x);
        delete cutucadas[F];
        continue;
      }
    }

    if (d.etapa === 'merge') {
      if (Array.isArray(d.prs) && d.prs.some((p) => (filasVivas[nome] ?? []).includes(p))) continue;
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
  for (const [dona, { resetsAtMs, itens: Fs }] of retomar) {
    const deCada = Fs.map((F) => { const h = handoffDe(F); return h ? `${F}: retome pelo handoff \`${h}\`` : `${F}: sem handoff gravado, retome pelo item (\`painel get fila ${F}\`) e pelo estado da branch`; });
    nova(dona, `O limite de uso voltou (resetou às ${new Date(resetsAtMs).toTimeString().slice(0, 5)}): retome pelo handoff de onde parou. ${deCada.join('; ')}.`, Fs[0], 'retomada');
    avisados[dona] = new Date(resetsAtMs).toISOString();
  }
  for (const [nome, o] of Object.entries(filasOrfas)) {
    if (!o?.prs?.length) continue;
    projeto(nome).filaParada = { prs: o.prs.map((p) => p.pr), desde: o.desde ?? null, relance: comandoDeRelance(o) };
  }

  const entregas = {};
  for (const [nome, lista] of Object.entries(desfechos)) {
    if (!Array.isArray(lista) || !lista.length) continue;
    const orq = projeto(nome).orquestradora;
    for (const df of lista) {
      if (!df.donasAvisadas) {
        for (const dv of df.devolvidos ?? []) {
          for (const it of dv.itens ?? []) {
            if (texto(it.dona) && viva(it.dona)) nova(it.dona, `PR ${dv.pr} devolvido pela fila de merge (${it.item}): ${dv.motivo}${dv.log ? ` Log: ${dv.log}.` : ''} Conserte, rode os afetados e anote de novo: \`painel fila-de-merge ${dv.pr}:<sha> --anotar\`.`, it.item, 'devolucao');
          }
        }
        for (const m of df.mergeados ?? []) {
          for (const it of m.itens ?? []) {
            if (it.fatia && texto(it.dona) && viva(it.dona)) nova(it.dona, `fatia PR ${m.pr} mergeada (${it.item}): siga com a próxima.`, it.item, 'fatia');
          }
        }
      }
      if (orq) nova(orq, resumoDoDesfecho(df), null, 'desfecho');
    }
    entregas[nome] = { orquestradora: orq ? lista.length : 0, soDonas: orq ? 0 : lista.length };
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
  return { mensagens, soltar, projetos: relatorios, desfechos: entregas, estado: { cutucadas, ...(Object.keys(avisados).length ? { limites: avisados } : {}), ultima: new Date(agoraMs).toISOString() } };
}

const hhmm = (iso) => { const t = ms(iso); return t === null ? '?' : new Date(t).toTimeString().slice(0, 5); };
// O resumo à orquestradora: o que entrou, o que voltou (a dona já foi avisada pela batida) e o que é dela fazer.
export function resumoDoDesfecho(df) {
  const partes = [];
  const itensDe = (m) => (m.itens ?? []).map((it) => `${it.item}${it.fechado ? ' fechou' : it.fatia ? ' fatia' : ''}`).join(', ');
  if (df.mergeados?.length) partes.push(`mergeados ${df.mergeados.map((m) => `#${m.pr}${itensDe(m) ? ` (${itensDe(m)})` : ''}`).join(', ')}`);
  if (df.devolvidos?.length) partes.push(`devolvidos ${df.devolvidos.map((d) => `#${d.pr}${(d.itens ?? []).length ? ` (${d.itens.map((i) => i.item).join(', ')}, dona avisada)` : ''}: ${String(d.motivo ?? '').slice(0, 160)}`).join('; ')}`);
  if (df.suspeitaDeInstavel) partes.push(`suspeita de teste instável: ${df.suspeitaDeInstavel}`);
  for (const e of [df.erro, ...(df.erros ?? [])].filter(Boolean)) partes.push(`erro: ${e}`);
  const seu = df.mergeados?.length ? ' É seu: subir-versao --empurrar e atualizar-plugins; arquive as donas dos itens fechados; feche o lote (estado em dia, e o "Fim de lote" do Orçamento de contexto).' : df.erro || df.erros?.length ? ' É seu: leia o log, conserte e relance a fila com os PRs que seguem valendo.' : '';
  return `Fila de merge sem turno (${hhmm(df.em)}): ${partes.join('; ') || 'nada mergeado nem devolvido'}.${seu}${df.logs ? ` Logs: ${[].concat(df.logs).join(', ')}.` : ''}`;
}
