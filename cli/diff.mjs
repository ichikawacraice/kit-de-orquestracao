// Diff unificado (LCS) para `--simular` e para o conflito do `atualizar`: cabeçalho `---`/`+++`, hunks `@@ -a,b +c,d @@` com 3 linhas
// de contexto, aplicável com `git apply`. Os arquivos do kit são pequenos; não há otimização.
const CONTEXTO = 3;

/** Linhas do texto como [conteúdo, temEol]: o texto sem `\n` final é uma diferença real (vira `\ No newline at end of file`). */
function linhasDe(texto) {
  if (texto === null || texto === '') return [];
  const partes = texto.split('\n');
  const ultima = partes.pop();
  const linhas = partes.map((l) => [l, true]);
  if (ultima !== '') linhas.push([ultima, false]);
  return linhas;
}

export function diffTexto(antigo, novo, nome) {
  const a = linhasDe(antigo);
  const b = linhasDe(novo);
  const igual = (x, y) => x[0] === y[0] && x[1] === y[1];
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) t[i][j] = igual(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const ops = []; // { tipo: ' ' | '+' | '-', linha: [conteúdo, temEol], a: índice em a, b: índice em b }
  let i = 0; let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && igual(a[i], b[j])) { ops.push({ tipo: ' ', linha: a[i], a: i, b: j }); i++; j++; }
    else if (j < b.length && (i === a.length || t[i][j + 1] >= t[i + 1][j])) { ops.push({ tipo: '+', linha: b[j], a: i, b: j }); j++; }
    else { ops.push({ tipo: '-', linha: a[i], a: i, b: j }); i++; }
  }
  const mudancas = ops.map((o, k) => (o.tipo === ' ' ? -1 : k)).filter((k) => k >= 0);
  if (!mudancas.length) return '';
  // agrupa as mudanças cujo contexto se encosta (distância <= 2 * CONTEXTO) no mesmo hunk
  const grupos = [];
  for (const k of mudancas) {
    const g = grupos.at(-1);
    if (g && k - g.fim <= 2 * CONTEXTO + 1) g.fim = k; else grupos.push({ ini: k, fim: k });
  }
  const saida = [`--- ${antigo === null ? '/dev/null' : `a/${nome}`}`, `+++ b/${nome}`];
  for (const g of grupos) {
    const de = Math.max(0, g.ini - CONTEXTO);
    const ate = Math.min(ops.length - 1, g.fim + CONTEXTO);
    const corpo = ops.slice(de, ate + 1);
    const nA = corpo.filter((o) => o.tipo !== '+').length;
    const nB = corpo.filter((o) => o.tipo !== '-').length;
    const iniA = corpo.find((o) => o.tipo !== '+')?.a ?? ops[de].a; // o início de um lado vazio é a posição anterior
    const iniB = corpo.find((o) => o.tipo !== '-')?.b ?? ops[de].b;
    saida.push(`@@ -${nA === 0 ? iniA : iniA + 1},${nA} +${nB === 0 ? iniB : iniB + 1},${nB} @@`);
    for (const o of corpo) {
      saida.push(`${o.tipo}${o.linha[0]}`);
      if (!o.linha[1]) saida.push('\\ No newline at end of file');
    }
  }
  return saida.join('\n');
}
