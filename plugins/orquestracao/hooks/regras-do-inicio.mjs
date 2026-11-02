// O resumo das regras (regras-globais.md) sem o que o CLAUDE.md do projeto já traz (F347). Cada regra que um bloco `kit:` do
// modelo de CLAUDE.md cobre leva no fim `<!-- coberta-por: kit:<bloco> -->`; se o CLAUDE.md do projeto tem esse bloco, a regra
// sai do resumo (o CLAUDE.md entra em toda chamada, inclusive nos subagentes, que não recebem o resumo; repetir é pagar duas
// vezes). Os comentários nunca chegam à sessão.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MARCA = /\s*<!--\s*coberta-por:\s*kit:([\w-]+)\s*-->/;

/** Os blocos `kit:` que o resumo diz cobrir. */
export function blocosQueCobrem(regras) {
  return [...new Set(regras.split('\n').map((l) => MARCA.exec(l)?.[1]).filter(Boolean))];
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
  const tem = (bloco) => new RegExp(`<!-- kit:${bloco} v\\d+ -->`).test(claude);
  let tirou = false;
  const linhas = regras.split('\n').flatMap((l) => {
    const bloco = MARCA.exec(l)?.[1];
    if (bloco && tem(bloco)) { tirou = true; return []; }
    return [l.replace(MARCA, '')];
  });
  if (tirou) linhas.push('- As outras regras do kit (análise do pedido, dona por item, revisão, testes) estão nos blocos `kit:` do CLAUDE.md deste projeto.');
  return linhas.join('\n').trim();
}
