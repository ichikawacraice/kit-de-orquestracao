// Diff de linhas (LCS) para `--simular` e para o conflito do `atualizar`. Os arquivos do kit são pequenos; não há otimização.
export function diffTexto(antigo, novo, nome) {
  const a = antigo === null ? [] : antigo.split('\n');
  const b = novo === null ? [] : novo.split('\n');
  if (a.at(-1) === '') a.pop();
  if (b.at(-1) === '') b.pop();
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const linhas = [];
  let i = 0; let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (j < b.length && (i === a.length || t[i][j + 1] >= t[i + 1][j])) linhas.push(`+${b[j++]}`);
    else linhas.push(`-${a[i++]}`);
  }
  if (!linhas.length) return '';
  return [`--- ${antigo === null ? '/dev/null' : `a/${nome}`}`, `+++ b/${nome}`, ...linhas].join('\n');
}
