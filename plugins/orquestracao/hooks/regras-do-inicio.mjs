// O resumo das regras (regras-globais.md) sem o que o CLAUDE.md do projeto já traz (F347). Cada regra que um bloco `kit:` do
// modelo de CLAUDE.md cobre leva no fim `<!-- coberta-por: kit:<bloco> v<n> -->` (a 1ª versão do bloco que traz a regra); se o
// CLAUDE.md do projeto tem o bloco nessa versão ou depois, a regra sai do resumo; bloco mais velho não a traz, e ela fica. O
// CLAUDE.md entra em toda chamada, inclusive nos subagentes, que não recebem o resumo: repetir é pagar duas vezes. Os
// comentários nunca chegam à sessão.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MARCA = /\s*<!--\s*coberta-por:\s*kit:([\w-]+)\s+v(\d+)\s*-->/;

/** As marcas do resumo: [{ bloco, versao }] de cada regra coberta. */
export function blocosQueCobrem(regras) {
  return regras.split('\n').flatMap((l) => { const m = MARCA.exec(l); return m ? [{ bloco: m[1], versao: Number(m[2]) }] : []; });
}

/** O CLAUDE.md da raiz do projeto: sobe de `cwd` até a pasta com `.git` (ou a raiz do disco). */
function claudeDoProjeto(cwd) {
  let dir = cwd;
  for (let i = 0; dir && i < 64; i++) {
    const f = join(dir, 'CLAUDE.md');
    if (existsSync(join(dir, '.git'))) return existsSync(f) ? readFileSync(f, 'utf8') : '';
    const pai = dirname(dir);
    if (pai === dir) return '';
    dir = pai;
  }
  return '';
}

export function resumoParaOProjeto(regras, cwd) {
  let claude = '';
  try { if (cwd) claude = claudeDoProjeto(cwd); } catch { /* sem CLAUDE.md legível: resumo inteiro */ }
  // só o bloco aberto, com conteúdo e fechado conta (marca solta ou bloco vazio não traz a regra)
  const versao = (bloco) => Number(new RegExp(`<!-- kit:${bloco} v(\\d+) -->\\s*\\S[\\s\\S]*?<!-- /kit:${bloco} -->`).exec(claude)?.[1] ?? 0);
  const tiradas = [];
  const linhas = regras.split('\n').flatMap((l) => {
    const m = MARCA.exec(l);
    if (m && versao(m[1]) >= Number(m[2])) { tiradas.push(/^- \*\*([^*]+?):?\*\*/.exec(l)?.[1] ?? m[1]); return []; }
    return [l.replace(MARCA, '')];
  });
  if (tiradas.length) linhas.push(`- Estas regras do kit estão nos blocos \`kit:\` do CLAUDE.md deste projeto: ${tiradas.join('; ')}.`);
  return linhas.join('\n').trim();
}
