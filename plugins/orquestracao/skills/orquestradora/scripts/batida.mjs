// A batida (ADR 0007): o julgamento puro de "o que está parado, quem avisar, o que soltar". Sem I/O: o painel.mjs lê a fila,
// a lista de sessões (`list_sessions`, passada por arquivo) e o estado da batida, chama `julgar` e aplica o resultado
// (grava o estado, solta, grava a espera). Quem chama a cada 10 min é o mod painel-sessoes.
import { slugDoProjeto } from './perguntas-arquivo.mjs';

export const PRAZO_MIN = 30; // item parado: sem gravar há tanto (PAINEL_PRAZO_MIN troca)
export const BATIDA_SOLTA_MIN = 20; // depois da cutucada, sem gravação, solta (BATIDA_SOLTA_MIN troca)
export const ESPERA_MIN = 5; // esperando o papel há tanto: avisa o livre
export const REAVISO_MIN = 30; // o mesmo livre não é avisado de novo do mesmo item antes disso
export const TETO_DE_LIVRES = 2; // livres por papel por projeto fora do modo ausente
export const AFINIDADE_MIN = 20; // item do mesmo assunto espera o afim ocupado por tanto; depois, o de sempre (BATIDA_AFINIDADE_MIN troca)
export const CARTAO_VALIDADE_H = 12; // cartão de sessão nova sem clique há tanto: a orquestradora já o terá reproposto (a mesma régua da Q379)
export const TITULO_VELHO_MIN = 10; // membro parado há tanto, fora de item vivo e sem título livre: o título é de item que fechou

const ETAPAS_FINAIS = new Set(['feito', 'descartado']);
const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const texto = (v) => typeof v === 'string' && v.trim() !== '';
const apelidoDoTitulo = (t) => /^([PDEV]\d+) · /.exec(t || '')?.[1] ?? null;

export const ehLivre = (titulo) => /^[PDEV]\d+ · livre\s*$/.test(titulo || '');
export const ehDaOrquestradora = (titulo, projeto) => {
  const m = /^🎛 orquestradora — (.+?)\s*$/.exec(titulo || '');
  return Boolean(m) && slugDoProjeto(m[1]) === projeto; // F183: o mesmo slug do painel ("Wicomm IA" → wicomm-ia)
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

// Quem está no `fez` de um item vivo: guarda a conversa para o conserto, o título dele não é velho.
export function fezDaFila(itens) {
  const s = new Set();
  for (const d of itens.values()) {
    if (ETAPAS_FINAIS.has(d?.etapa)) continue;
    for (const f of Array.isArray(d?.fez) ? d.fez : []) if (texto(f?.localId)) s.add(f.localId);
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

// O membro afim de um item que espera o papel `papel` (ADR 0009): entre os itens do mesmo projeto e tema (vivos ou fechados),
// quem passou por eles com esse papel (`passaram`; item antigo sem `passaram` vale pelo `fez`), o mais recente cuja sessão ainda
// está viva na lista do app e com o título começando pelo mesmo apelido. → { localId, apelido } ou null. Puro.
// O próprio item vem primeiro: no conserto (o item volta à execução) quem o fez tem a conversa; só sem ninguém vivo dele valem os outros.
export function afimDe(item, papel, itens, linhas, projetoDe) {
  const porId = new Map(linhas.map((r) => [r.sessionId, r]));
  const nome = slugDoProjeto(item?.projeto);
  if (!nome || !texto(item?.tema)) return null;
  const daLista = (d) => (Array.isArray(d.passaram) ? d.passaram : (Array.isArray(d.fez) ? d.fez.map((f) => ({ ...f, papel: String(f?.apelido ?? '')[0] })) : []));
  const vivo = (e) => {
    const r = porId.get(e.localId);
    return vivoNaLista(r) && projetoDe(r) && apelidoDoTitulo(r.title) === e.apelido;
  };
  const validos = (d) => daLista(d).filter((e) => e?.papel === papel && texto(e.localId) && texto(e.apelido) && ms(e.em) !== null);
  const doProprio = validos(item).sort((a, b) => ms(b.em) - ms(a.em)).find(vivo);
  if (doProprio) return { localId: doProprio.localId, apelido: doProprio.apelido };
  const candidatos = [];
  for (const d of itens.values()) {
    if (d === item || slugDoProjeto(d?.projeto) !== nome || d?.tema !== item.tema) continue;
    candidatos.push(...validos(d));
  }
  candidatos.sort((a, b) => ms(b.em) - ms(a.em));
  for (const e of candidatos) {
    if (!vivo(e)) continue;
    return { localId: e.localId, apelido: e.apelido };
  }
  return null;
}

// O título da sessão aberta é o do cartão: `<apelido> · …` no pool; no cartão de dona, `F<n> · …` do item do cartão.
const tituloDoCartao = (titulo, c) => (c.apelido === 'dona' ? (/^(F\d+) · /.exec(titulo || '')?.[1] ?? null) === c.itens?.[0] : apelidoDoTitulo(titulo) === c.apelido);

// Cartões de sessão nova (coleção `cartoes`) que já não esperam o clique: o apelido apareceu vivo no projeto depois de
// `propostoEm`, ou passou de CARTAO_VALIDADE_H (também quando `propostoEm` não é legível). `linhas` null = sem a lista de
// sessões: só o prazo vale. Sessão de antes de `propostoEm` com o mesmo apelido é outra e não resolve.
// `cartoes`: [{ id, data }] → ids a apagar.
export function cartoesResolvidos({ cartoes, linhas, projetoDe, agoraMs }) {
  const apagar = [];
  for (const { id, data: c } of cartoes) {
    const proposto = ms(c?.propostoEm);
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

export function julgar({ agoraMs, itens, todos = itens, afinidadeMin = AFINIDADE_MIN, linhas, projetoDe, estado, ausente, cheia, esperandoPapel, ultimo = () => null, caminhoDoRelatorio = () => '', prazoMin = PRAZO_MIN, soltaMin = BATIDA_SOLTA_MIN, dona = false }) {
  const porId = new Map(linhas.map((r) => [r.sessionId, r]));
  const ocupados = ocupadosDaFila(itens);
  const cutucadas = { ...(estado?.cutucadas ?? {}) };
  const avisos = { ...(estado?.avisos ?? {}) };
  const mensagens = []; const soltar = []; const espera = [];
  const projetos = new Map();
  const projeto = (nome) => {
    if (!projetos.has(nome)) projetos.set(nome, { orquestradora: null, merge: [], vagas: [], excedentes: [], titulosVelhos: [], membros: 0 });
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
    const nome = slugDoProjeto(d.projeto); // F183: o mesmo slug das sessões
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
    // ADR 0011 (`dona`): sem pool não há livre a avisar; o item sem ninguém vira vaga de dona no relatório da orquestradora.
    if (dona) { proj.vagas.push({ papel: 'dona', item: F }); continue; }
    if (r.papel === 'V' && cheia()) { espera.push({ F, texto: 'máquina cheia' }); continue; }
    const livres = livresDe(linhas, r.papel, nome, projetoDe, ocupados).filter((l) => !usados.has(l.localId));
    const afim = afimDe(d, r.papel, todos, linhas, projetoDe);
    const livreAfim = afim ? livres.find((l) => l.localId === afim.localId) : null;
    if (!livres.length && !(afim && r.minutos < afinidadeMin)) { proj.vagas.push({ papel: r.papel, item: F }); continue; }
    let livre = livreAfim ?? livres[0];
    if (afim) {
      if (!livreAfim && r.minutos < afinidadeMin) {
        // afim ocupado (ou livre já avisado de outro item nesta batida): espera por ele, uma vez, sem avisar outro nem pedir vaga
        const marca = avisos[`afim:${F}`];
        if (marca?.localId !== afim.localId) {
          nova(afim.localId, `${F} · ${d.titulo}, do mesmo assunto, espera você: pegue ao terminar o atual (\`painel pegar ${F} ${afim.localId} ${afim.apelido}\`).`, F, 'afinidade');
          avisos[`afim:${F}`] = { em: new Date(agoraMs).toISOString(), localId: afim.localId };
        }
        continue;
      }
    }
    const antes = avisos[F];
    if (antes?.localId === livre.localId && agoraMs - ms(antes.em) < REAVISO_MIN * 60_000) { usados.add(livre.localId); continue; }
    nova(livre.localId, `${F} · ${d.titulo} para você: rode \`painel pegar ${F} ${livre.localId} ${livre.apelido}\`, troque o título (\`${livre.apelido} · <o quê>\`) e leia o handoff do item.`, F, 'avisar-livre');
    avisos[F] = { em: new Date(agoraMs).toISOString(), localId: livre.localId };
    usados.add(livre.localId);
  }
  for (const F of Object.keys(cutucadas)) if (!vistos.has(F)) delete cutucadas[F];
  for (const k of Object.keys(avisos)) if (k.startsWith('afim:') && !vistos.has(k.slice('afim:'.length))) delete avisos[k];

  // piso de E e excedentes (fora do modo ausente). Livre no `fez` de item vivo não é excedente nem conta para o teto:
  // a trava de arquivamento recusa arquivá-lo (só se arquiva membro sem item vivo).
  const noFez = fezDaFila(itens);
  if (!ausente && !dona) {
    for (const [nome, proj] of projetos) {
      const livresE = livresDe(linhas, 'E', nome, projetoDe, ocupados);
      if (proj.membros > 0 && livresE.length === 0 && !proj.vagas.some((v) => v.papel === 'E' && v.piso)) proj.vagas.push({ papel: 'E', piso: true });
      for (const papel of ['P', 'D', 'E', 'V']) {
        const l = livresDe(linhas, papel, nome, projetoDe, ocupados).filter((x) => !noFez.has(x.localId));
        if (l.length > TETO_DE_LIVRES) for (const x of l.slice(0, l.length - TETO_DE_LIVRES)) proj.excedentes.push({ papel, apelido: x.apelido, localId: x.localId });
      }
    }
  }

  // membro que ficou com o título do item que fechou (F134): parado, fora de dono/`com`/`fez` de item vivo e sem título livre.
  // Uma mensagem por título (trocou por outro título velho, avisa de novo). O aviso só sai do estado quando o título deixa de ser
  // velho pela fila ou pelo título (livre, dono, `com`, `fez`, arquivado): rodar ou estar recente não conta, senão a própria
  // mensagem acordaria o membro e o reaviso viria na batida seguinte.
  const velhos = new Set();
  for (const r of linhas) {
    const apelido = apelidoDoTitulo(r.title);
    const p = projetoDe(r);
    if (!vivoNaLista(r) || !apelido || !p || ehLivre(r.title)) continue;
    if (ocupados.has(r.sessionId) || noFez.has(r.sessionId)) continue;
    velhos.add(r.sessionId);
    const t = ms(r.lastActivityAt);
    const titulo = String(r.title).trim();
    const chave = `titulo:${r.sessionId}`;
    const avisado = avisos[chave]?.titulo === titulo;
    // rodando ou recente: ainda não é velho, exceto quem já foi avisado deste título (segue no relatório, sem relatório a mais)
    if (!avisado && (r.isRunning === true || (t !== null && agoraMs - t < TITULO_VELHO_MIN * 60_000))) continue;
    projeto(p).titulosVelhos.push({ apelido, localId: r.sessionId, titulo });
    if (avisado) continue;
    nova(r.sessionId, `O seu título "${titulo}" é de um item que já fechou: você não é dona, não está no \`com\` nem no \`fez\` de nenhum item vivo. Troque o título para \`${apelido} · livre\` e chame \`clear_session\` com "self".`, null, 'titulo-velho');
    avisos[chave] = { em: new Date(agoraMs).toISOString(), localId: r.sessionId, titulo };
  }
  for (const k of Object.keys(avisos)) if (k.startsWith('titulo:') && !velhos.has(k.slice('titulo:'.length))) delete avisos[k];
  // em ordem de apelido: a mesma lista em outra ordem do list_sessions não conta como mudança no relatório
  for (const proj of projetos.values()) proj.titulosVelhos.sort((a, b) => a.apelido.localeCompare(b.apelido, 'en', { numeric: true }));

  // relatório à orquestradora de cada projeto, só quando algo mudou desde o último
  const relatorios = {};
  for (const [nome, proj] of [...projetos].sort(([a], [b]) => a.localeCompare(b))) {
    const { membros, ...conteudo } = proj;
    const chaves = (x) => [x.merge, x.vagas, x.excedentes, (x.titulosVelhos ?? []).map((v) => [v.localId, v.titulo])];
    const mudou = JSON.stringify(chaves(conteudo)) !== JSON.stringify((() => { const u = ultimo(nome); return u ? chaves(u) : [[], [], [], []]; })());
    relatorios[nome] = { ...conteudo, mudou };
    const algo = conteudo.merge.length || conteudo.vagas.length || conteudo.excedentes.length || conteudo.titulosVelhos.length;
    if (conteudo.orquestradora && algo && mudou) {
      const partes = [];
      if (conteudo.merge.length) partes.push(`merge parado: ${conteudo.merge.join(', ')}`);
      if (conteudo.vagas.length) partes.push(`vaga: ${conteudo.vagas.map((v) => (v.piso ? `${v.papel} (piso)` : `${v.papel} (${v.item})`)).join(', ')}`);
      if (conteudo.excedentes.length) partes.push(`livres além do teto: ${conteudo.excedentes.map((x) => x.apelido).join(', ')}`);
      if (conteudo.titulosVelhos.length) partes.push(`título velho: ${conteudo.titulosVelhos.map((x) => x.apelido).join(', ')}`);
      const hora = new Date(agoraMs).toTimeString().slice(0, 5);
      nova(conteudo.orquestradora, `Batida ${hora}: ${partes.join('; ')}. Relatório: ${caminhoDoRelatorio(nome)}.`, null, 'relatorio');
    }
  }
  return { mensagens, soltar, espera, projetos: relatorios, estado: { cutucadas, avisos, ultima: new Date(agoraMs).toISOString() } };
}
