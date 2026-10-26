// A batida (ADR 0007): o julgamento puro de "o que está parado, quem avisar, o que soltar". Sem I/O: o painel.mjs lê a fila,
// a lista de sessões (`list_sessions`, passada por arquivo) e o estado da batida, chama `julgar` e aplica o resultado
// (grava o estado, solta, grava a espera). Quem chama a cada 10 min é o mod painel-sessoes.

export const PRAZO_MIN = 30; // item parado: sem gravar há tanto (PAINEL_PRAZO_MIN troca)
export const BATIDA_SOLTA_MIN = 20; // depois da cutucada, sem gravação, solta (BATIDA_SOLTA_MIN troca)
export const ESPERA_MIN = 5; // esperando o papel há tanto: avisa o livre
export const REAVISO_MIN = 30; // o mesmo livre não é avisado de novo do mesmo item antes disso
export const TETO_DE_LIVRES = 2; // livres por papel por projeto fora do modo ausente

const ETAPAS_FINAIS = new Set(['feito', 'descartado']);
const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const texto = (v) => typeof v === 'string' && v.trim() !== '';
const apelidoDoTitulo = (t) => /^([PDEV]\d+) · /.exec(t || '')?.[1] ?? null;

export const ehLivre = (titulo) => /^[PDEV]\d+ · livre\s*$/.test(titulo || '');
export const ehDaOrquestradora = (titulo, projeto) => {
  const m = /^🎛 orquestradora — (.+?)\s*$/.exec(titulo || '');
  return Boolean(m) && m[1].toLowerCase() === projeto;
};
const vivoNaLista = (row) => row && row.isArchived !== true;

// Quem está num item vivo (dono ou `com`): fora do pool de livres.
export function ocupadosDaFila(itens) {
  const s = new Set();
  for (const d of itens.values()) {
    if (ETAPAS_FINAIS.has(d?.etapa)) continue;
    if (texto(d?.donoLocalId)) s.add(d.donoLocalId);
    for (const c of Array.isArray(d?.com) ? d.com : []) if (texto(c?.localId)) s.add(c.localId);
  }
  return s;
}

// Membros livres de um papel num projeto, o mais antigo parado primeiro. → [{ localId, apelido }]
export function livresDe(linhas, papel, projeto, projetoDe, ocupados) {
  return linhas
    .filter((r) => vivoNaLista(r) && r.isRunning !== true && ehLivre(r.title) && String(r.title).startsWith(papel) && !ocupados.has(r.sessionId) && projetoDe(r) === projeto)
    .sort((a, b) => (ms(a.lastActivityAt) ?? 0) - (ms(b.lastActivityAt) ?? 0))
    .map((r) => ({ localId: r.sessionId, apelido: apelidoDoTitulo(r.title) }));
}

export function julgar({ agoraMs, itens, linhas, projetoDe, estado, ausente, cheia, esperandoPapel, ultimo = () => null, caminhoDoRelatorio = () => '', prazoMin = PRAZO_MIN, soltaMin = BATIDA_SOLTA_MIN }) {
  const porId = new Map(linhas.map((r) => [r.sessionId, r]));
  const ocupados = ocupadosDaFila(itens);
  const cutucadas = { ...(estado?.cutucadas ?? {}) };
  const avisos = { ...(estado?.avisos ?? {}) };
  const mensagens = []; const soltar = []; const espera = [];
  const projetos = new Map();
  const projeto = (nome) => {
    if (!projetos.has(nome)) projetos.set(nome, { orquestradora: null, merge: [], vagas: [], excedentes: [], membros: 0 });
    return projetos.get(nome);
  };
  for (const r of linhas) {
    if (!vivoNaLista(r)) continue;
    const p = projetoDe(r);
    if (!p) continue;
    const proj = projeto(p);
    if (ehDaOrquestradora(r.title, p)) proj.orquestradora = proj.orquestradora ?? r.sessionId;
    else if (apelidoDoTitulo(r.title)) proj.membros += 1;
  }
  const usados = new Set(); // livre já avisado nesta batida
  const viva = (id) => vivoNaLista(porId.get(id));
  const nova = (para, textoDaMensagem, item, tipo) => mensagens.push({ para, texto: textoDaMensagem, item, tipo });
  const vistos = new Set();

  for (const [F, d] of [...itens].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    if (!d || ETAPAS_FINAIS.has(d.etapa)) continue;
    const nome = String(d.projeto ?? '').toLowerCase();
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

    const r = esperandoPapel(d, agoraMs);
    if (!r || r.minutos < ESPERA_MIN) continue;
    if (r.entregue) {
      const chave = `entregue:${F}`;
      const dona = texto(d.donoLocalId) && viva(d.donoLocalId) ? d.donoLocalId : null;
      if (dona && !(avisos[chave] && ms(avisos[chave].em) >= ms(r.desde))) {
        nova(dona, `${F} · ${d.titulo}: a parte do papel ${r.papel} foi entregue; avance a etapa do item.`, F, 'avancar');
        avisos[chave] = { em: new Date(agoraMs).toISOString(), localId: dona };
      }
      continue;
    }
    if (r.papel === 'V' && cheia()) { espera.push({ F, texto: 'máquina cheia' }); continue; }
    const livres = livresDe(linhas, r.papel, nome, projetoDe, ocupados).filter((l) => !usados.has(l.localId));
    if (!livres.length) { proj.vagas.push({ papel: r.papel, item: F }); continue; }
    const livre = livres[0];
    const antes = avisos[F];
    if (antes?.localId === livre.localId && agoraMs - ms(antes.em) < REAVISO_MIN * 60_000) { usados.add(livre.localId); continue; }
    nova(livre.localId, `${F} · ${d.titulo} para você: rode \`painel pegar ${F} ${livre.localId} ${livre.apelido}\`, troque o título (\`${livre.apelido} · <o quê>\`) e leia o handoff do item.`, F, 'avisar-livre');
    avisos[F] = { em: new Date(agoraMs).toISOString(), localId: livre.localId };
    usados.add(livre.localId);
  }
  for (const F of Object.keys(cutucadas)) if (!vistos.has(F)) delete cutucadas[F];

  // piso de E e excedentes (fora do modo ausente)
  if (!ausente) {
    for (const [nome, proj] of projetos) {
      const livresE = livresDe(linhas, 'E', nome, projetoDe, ocupados);
      if (proj.membros > 0 && livresE.length === 0 && !proj.vagas.some((v) => v.papel === 'E' && v.piso)) proj.vagas.push({ papel: 'E', piso: true });
      for (const papel of ['P', 'D', 'E', 'V']) {
        const l = livresDe(linhas, papel, nome, projetoDe, ocupados);
        if (l.length > TETO_DE_LIVRES) for (const x of l.slice(0, l.length - TETO_DE_LIVRES)) proj.excedentes.push({ papel, apelido: x.apelido, localId: x.localId });
      }
    }
  }

  // relatório à orquestradora de cada projeto, só quando algo mudou desde o último
  const relatorios = {};
  for (const [nome, proj] of [...projetos].sort(([a], [b]) => a.localeCompare(b))) {
    const { membros, ...conteudo } = proj;
    const mudou = JSON.stringify([conteudo.merge, conteudo.vagas, conteudo.excedentes]) !== JSON.stringify((() => { const u = ultimo(nome); return u ? [u.merge, u.vagas, u.excedentes] : [[], [], []]; })());
    relatorios[nome] = { ...conteudo, mudou };
    const algo = conteudo.merge.length || conteudo.vagas.length || conteudo.excedentes.length;
    if (conteudo.orquestradora && algo && mudou) {
      const partes = [];
      if (conteudo.merge.length) partes.push(`merge parado: ${conteudo.merge.join(', ')}`);
      if (conteudo.vagas.length) partes.push(`vaga: ${conteudo.vagas.map((v) => (v.piso ? `${v.papel} (piso)` : `${v.papel} (${v.item})`)).join(', ')}`);
      if (conteudo.excedentes.length) partes.push(`livres além do teto: ${conteudo.excedentes.map((x) => x.apelido).join(', ')}`);
      const hora = new Date(agoraMs).toTimeString().slice(0, 5);
      nova(conteudo.orquestradora, `Batida ${hora}: ${partes.join('; ')}. Relatório: ${caminhoDoRelatorio(nome)}.`, null, 'relatorio');
    }
  }
  return { mensagens, soltar, espera, projetos: relatorios, estado: { cutucadas, avisos, ultima: new Date(agoraMs).toISOString() } };
}
