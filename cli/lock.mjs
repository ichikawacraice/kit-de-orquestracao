// O lock do projeto (.claude/kit.lock.json): versão do kit, perfil, sha256 de cada arquivo e de cada bloco marcado do CLAUDE.md.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCK = '.claude/kit.lock.json';
export const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');

/** Os blocos `<!-- kit:<nome> vN -->…<!-- /kit:<nome> -->` de um texto, na ordem: { nome, versao, conteudo }. */
export function blocosDe(texto) {
  return [...texto.matchAll(/<!-- kit:([a-z-]+) v(\d+) -->([\s\S]*?)<!-- \/kit:\1 -->/g)].map((m) => ({ nome: m[1], versao: Number(m[2]), conteudo: m[3] }));
}

/** Monta o lock lendo do disco os arquivos listados (caminhos relativos à raiz do projeto). */
export function montarLock({ raiz, versao, perfil, arquivos }) {
  const lock = { versao, perfil, arquivos: {}, blocos: {} };
  for (const f of [...arquivos].sort()) lock.arquivos[f] = sha256(readFileSync(join(raiz, f), 'utf8'));
  for (const b of blocosDe(readFileSync(join(raiz, 'CLAUDE.md'), 'utf8'))) lock.blocos[b.nome] = { versao: b.versao, sha256: sha256(b.conteudo) };
  return lock;
}
