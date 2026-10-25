// `kit doutor` (stub da K6): lê o lock e confere o disco. O diagnóstico completo chega com a K7.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCK, sha256 } from './lock.mjs';

export function doutor({ destino }) {
  const caminho = join(destino, LOCK);
  if (!existsSync(caminho)) return { codigo: 1, saida: '', erro: `kit doutor: não achei ${LOCK} aqui — rode \`kit iniciar\` ou \`kit adotar\`` };
  const lock = JSON.parse(readFileSync(caminho, 'utf8'));
  const linhas = [`kit ${lock.versao}, perfil ${lock.perfil}, ${Object.keys(lock.arquivos).length} arquivos no lock`];
  let problemas = 0;
  for (const [f, h] of Object.entries(lock.arquivos)) {
    const arq = join(destino, f);
    if (!existsSync(arq)) { linhas.push(`faltando: ${f}`); problemas++; }
    else if (sha256(readFileSync(arq, 'utf8')) !== h) { linhas.push(`modificado: ${f}`); problemas++; }
  }
  linhas.push(problemas ? `${problemas} divergência(s) em relação ao lock` : 'tudo em dia com o lock');
  return { codigo: problemas ? 1 : 0, saida: `${linhas.join('\n')}\n`, erro: '' };
}
