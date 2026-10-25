// `kit adotar [--simular] [--trocar-test] [--perfil …]`: põe o kit num projeto em andamento sem sobrescrever nada do que já é dele.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { diffTexto } from './diff.mjs';
import { LOCK } from './lock.mjs';
import { gravar, planejar } from './pacote.mjs';

/** Devolve { codigo, saida, erro }. */
export function adotar({ destino, perfil = 'simples', versao, simular = false, trocarTest = false, parcial = false }) {
  if (!existsSync(join(destino, 'CLAUDE.md'))) return { codigo: 2, saida: '', erro: 'kit adotar: não há CLAUDE.md aqui — para um projeto novo, use `kit iniciar`' };
  if (existsSync(join(destino, LOCK))) return { codigo: 2, saida: '', erro: `kit adotar: já existe ${LOCK} — o kit já foi adotado; para trazer a versão nova use \`kit atualizar\`` };
  const plano = planejar({ destino, perfil, trocarTest, nomeScript: 'test:projeto' });
  if (plano.erro) return { codigo: 2, saida: '', erro: `kit adotar: ${plano.erro}` };
  const linhas = [];
  const barrado = plano.conflitos.length > 0 && !parcial; // atômico: com conflito não grava nada, a menos que --parcial
  if (simular) for (const m of plano.mudancas) linhas.push(m.antigo === null ? `+++ b/${m.arquivo} (arquivo novo, ${m.novo.split('\n').length - 1} linhas)` : diffTexto(m.antigo, m.novo, m.arquivo));
  else if (!barrado) {
    const pendente = [...plano.conflitos, ...plano.pendencias];
    const g = gravar(destino, plano.mudancas, { versao, perfil, ...plano.lock, ...(pendente.length ? { pendente } : {}) });
    if (g.erro) return { codigo: 1, saida: '', erro: `kit adotar: ${g.erro}` };
  }
  for (const t of plano.avisos) linhas.push(`trocado: ${t}`);
  for (const c of plano.conflitos) linhas.push(`conflito: ${c}`);
  for (const p of plano.pendencias) linhas.push(`pendente: ${p}`);
  if (barrado) linhas.push(`kit adotar${simular ? ' --simular' : ''}: ${plano.conflitos.length} conflito(s); nada foi gravado. Resolva e rode de novo, ou use --parcial para gravar o resto e deixar os conflitos registrados no lock como pendentes.`);
  else linhas.push(simular
    ? `kit adotar --simular: ${plano.mudancas.length} arquivo(s) mudariam; nada foi gravado.`
    : `kit adotar: ${plano.mudancas.length} arquivo(s) gravados (perfil ${perfil}); lock em ${LOCK}${plano.conflitos.length + plano.pendencias.length ? `; ${plano.conflitos.length + plano.pendencias.length} pendente(s) registrados no lock` : ''}.`);
  return { codigo: plano.conflitos.length ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}
