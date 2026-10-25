// `kit iniciar [--perfil simples|pnpm-workspace]`: prepara um projeto sem CLAUDE.md para o kit.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LOCK } from './lock.mjs';
import { gravar, lerModelo, planejar } from './pacote.mjs';

/** Devolve { codigo, mensagem } — nada é gravado antes de o plano ser calculado e validado. */
export function iniciar({ destino, perfil = 'simples', versao }) {
  if (!lerModelo().perfis[perfil]) return { codigo: 2, mensagem: `kit iniciar: perfil "${perfil}" desconhecido — use ${Object.keys(lerModelo().perfis).join(' ou ')}` };
  if (existsSync(join(destino, 'CLAUDE.md'))) return { codigo: 2, mensagem: 'kit iniciar: já existe CLAUDE.md aqui — o iniciar é só para projeto sem ele (para um projeto em andamento, use `kit adotar`)' };
  if (existsSync(join(destino, LOCK))) return { codigo: 2, mensagem: `kit iniciar: já existe ${LOCK} — o kit já foi posto aqui; use \`kit atualizar\` ou \`kit remover\`` };
  const plano = planejar({ destino, perfil, trocarTest: true, nomeScript: 'test:suite', criarClaude: true });
  if (plano.erro) return { codigo: 2, mensagem: `kit iniciar: ${plano.erro}` };
  if (plano.conflitos.length) return { codigo: 1, mensagem: `kit iniciar: ${plano.conflitos.length} conflito(s); nada foi gravado.\n${plano.conflitos.map((c) => `conflito: ${c}`).join('\n')}` };
  const g = gravar(destino, plano.mudancas, { versao, perfil, ...plano.lock });
  if (g.erro) return { codigo: 1, mensagem: `kit iniciar: ${g.erro}` };
  const aviso = existsSync(join(destino, '.git')) ? '' : '\naviso: esta pasta não é um repositório git; o gate mede o toplevel do git, então rode `git init` antes do primeiro `npm test`.';
  return { codigo: 0, mensagem: `kit iniciar: projeto preparado (perfil ${perfil}, ${Object.keys(plano.lock.arquivos).length} arquivos, lock em ${LOCK}).${plano.avisos.map((a) => `\ntrocado: ${a}`).join('')}${aviso}` };
}
