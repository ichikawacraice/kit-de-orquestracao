// `kit atualizar [--simular]`: troca pela versão nova o que o projeto não editou; o que foi editado vira conflito com o diff.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffTexto } from './diff.mjs';
import { LOCK, blocosDe, lerLock, sha256 } from './lock.mjs';
import { RAIZ_DO_KIT, arquivosDoGate, blocosDoModelo, gravar, gravarLock, lerTexto } from './pacote.mjs';

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function atualizar({ destino, versao, simular = false }) {
  const { lock, erro } = lerLock(destino);
  if (erro) return { codigo: 1, saida: '', erro: `kit atualizar: ${erro}` };
  const mudancas = []; const linhas = []; let conflitos = 0;
  const conflito = (msg, diff) => { conflitos++; linhas.push(`conflito: ${msg}`); if (diff) linhas.push(diff); };

  for (const f of arquivosDoGate()) {
    const rel = `scripts/kit/${f}`;
    const novo = readFileSync(join(RAIZ_DO_KIT, 'gate', f), 'utf8');
    const atual = lerTexto(destino, rel);
    if (!(rel in lock.arquivos)) {
      if (atual === null) { mudancas.push({ arquivo: rel, antigo: null, novo }); lock.arquivos[rel] = sha256(novo); linhas.push(`novo: ${rel}`); }
      else if (atual !== novo) conflito(`${rel} é novo no kit mas já existe diferente aqui`, diffTexto(atual, novo, rel));
      continue;
    }
    if (atual === null) { conflito(`${rel} faltando (estava no lock) — não recriei`); continue; }
    if (atual === novo) { lock.arquivos[rel] = sha256(novo); continue; }
    if (sha256(atual) === lock.arquivos[rel]) { mudancas.push({ arquivo: rel, antigo: atual, novo }); lock.arquivos[rel] = sha256(novo); linhas.push(`atualizado: ${rel}`); }
    else conflito(`${rel} editado à mão — não troquei`, diffTexto(atual, novo, rel));
  }

  const modelo = blocosDoModelo();
  const claudeAtual = lerTexto(destino, 'CLAUDE.md');
  let claude = claudeAtual;
  for (const [nome, reg] of Object.entries(lock.blocos)) {
    const texto = modelo[nome];
    const atual = claudeAtual === null ? undefined : blocosDe(claudeAtual).find((b) => b.nome === nome);
    if (!texto) { linhas.push(`aviso: o bloco ${nome} saiu do kit; deixei como está`); continue; }
    if (!atual) { conflito(`bloco ${nome} ausente do CLAUDE.md — não recriei`); continue; }
    const novo = blocosDe(texto)[0];
    const inteiroAtual = claudeAtual.match(new RegExp(`<!-- kit:${nome} v\\d+ -->[\\s\\S]*?<!-- /kit:${nome} -->`))[0];
    if (inteiroAtual === texto) { lock.blocos[nome] = { versao: novo.versao, sha256: sha256(novo.conteudo) }; continue; }
    if (sha256(atual.conteudo) === reg.sha256) { claude = claude.replace(inteiroAtual, () => texto); lock.blocos[nome] = { versao: novo.versao, sha256: sha256(novo.conteudo) }; linhas.push(`atualizado: bloco ${nome}`); }
    else conflito(`bloco ${nome} editado à mão — não troquei`, diffTexto(inteiroAtual, texto, `CLAUDE.md#${nome}`));
  }
  if (claude !== claudeAtual) mudancas.push({ arquivo: 'CLAUDE.md', antigo: claudeAtual, novo: claude });

  if (!conflitos) lock.versao = versao;
  if (!simular) { gravar(destino, mudancas); gravarLock(destino, lock); }
  linhas.push(conflitos
    ? `kit atualizar: ${conflitos} conflito(s); a versão do lock continua ${lock.versao}.`
    : `kit atualizar${simular ? ' --simular' : ''}: em dia com o kit ${versao} (${mudancas.length} arquivo(s) ${simular ? 'mudariam' : 'trocados'}).`);
  return { codigo: conflitos ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}
