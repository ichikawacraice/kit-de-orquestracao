// `kit adotar [--simular] [--trocar-test] [--perfil …]`: põe o kit num projeto em andamento sem sobrescrever nada do que já é dele.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { diffTexto } from './diff.mjs';
import { LOCK } from './lock.mjs';
import { arquivosDoGate, esqueletoDe, gravar, lerModelo, lerTexto, planejar, semBom, semOsBlocos } from './pacote.mjs';

/** Devolve { codigo, saida, erro }. */
export function adotar({ destino, perfil = 'simples', versao, simular = false, trocarTest = false, parcial = false }) {
  if (!existsSync(join(destino, 'CLAUDE.md'))) return { codigo: 2, saida: '', erro: 'kit adotar: não há CLAUDE.md aqui — para um projeto novo, use `kit iniciar`' };
  if (existsSync(join(destino, LOCK))) return { codigo: 2, saida: '', erro: `kit adotar: já existe ${LOCK} — o kit já foi adotado; para trazer a versão nova use \`kit atualizar\`` };
  // Instalação interrompida (processo morto no meio): `.kit-tmp` órfão ou `test` que já é o gate, sem lock. O `adotar` reconhece, conclui e grava o lock.
  const candidatos = ['CLAUDE.md', 'package.json', '.claude/settings.json', '.claude/kit.json', LOCK, ...arquivosDoGate().map((f) => `scripts/kit/${f}`)];
  const orfaos = candidatos.filter((rel) => existsSync(join(destino, `${rel}.kit-tmp`)));
  let testJaEhGate = false;
  try { testJaEhGate = JSON.parse(semBom(lerTexto(destino, 'package.json') ?? '{}')).scripts?.test === lerModelo().perfis[perfil]?.scripts?.test; } catch { /* JSON ilegível: o planejador recusa abaixo */ }
  const recuperando = orfaos.length > 0 || testJaEhGate;
  // o esqueleto do iniciar no CLAUDE.md diz que quem morreu foi o `iniciar`, que troca o `test` e guarda a suíte em test:suite
  const claudeAtual = lerTexto(destino, 'CLAUDE.md');
  const viaIniciar = recuperando && claudeAtual !== null && semOsBlocos(claudeAtual) === esqueletoDe(destino);
  const plano = planejar({ destino, perfil, trocarTest: trocarTest || viaIniciar, nomeScript: viaIniciar ? 'test:suite' : 'test:projeto', recuperando });
  if (plano.erro) return { codigo: 2, saida: '', erro: `kit adotar: ${plano.erro}` };
  const linhas = [];
  if (recuperando) linhas.push(`recuperado: instalação interrompida${orfaos.length ? ` (${orfaos.length} .kit-tmp órfão(s) ${simular ? 'seriam apagados' : 'apagados'})` : ''}; o que já estava lá foi reconhecido e o resto é concluído.`);
  const barrado = plano.conflitos.length > 0 && !parcial; // atômico: com conflito não grava nada, a menos que --parcial
  if (simular) for (const m of plano.mudancas) linhas.push(diffTexto(m.antigo, m.novo, m.arquivo));
  else if (!barrado) {
    for (const rel of orfaos) rmSync(join(destino, `${rel}.kit-tmp`), { force: true });
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
