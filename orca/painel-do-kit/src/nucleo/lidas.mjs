// "Limpar" uma entrega (F436): estado da aba, não fato do item. As chaves limpas ficam no armazenamento do plugin
// (`{ chave: ms em que limpou }`). Sem import nenhum: o painel e o worker usam as mesmas contas.

export function separarLidas(lista, lidas) {
  const visiveis = [];
  const limpas = [];
  for (const e of lista) (e.chaves.some((c) => c in lidas) ? limpas : visiveis).push(e);
  return { visiveis, limpas };
}
export const limpar = (lidas, chaves, agoraMs) => ({ ...lidas, ...Object.fromEntries(chaves.map((c) => [c, agoraMs])) });
export const desfazer = (lidas, chaves) => Object.fromEntries(Object.entries(lidas).filter(([c]) => !chaves.includes(c)));
/** Esquece chaves limpas há mais de `dias` (a entrega já saiu da janela de leitura). */
export const podarLidas = (lidas, agoraMs, dias = 35) => Object.fromEntries(Object.entries(lidas).filter(([, em]) => agoraMs - em <= dias * 86_400_000));
