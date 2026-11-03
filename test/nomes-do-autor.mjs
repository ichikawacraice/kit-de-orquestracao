import { createHash } from 'node:crypto';

// Os nomes de projeto e de pessoa do autor que o kit não cita, guardados em sha256 (minúsculas) para que o próprio
// detector não os escreva. Para conferir uma palavra: `printf '%s' palavra | shasum -a 256`.
const HASHES = new Set([
  '0a13fe27742142ab0a55d3c9ffd85712b9d578ca58c87901e5bfafe12003cb88',
  'cb5b92b1244f8c6492a0410b8bf01581e219ba58b288a85dcfb11dccb339e956',
  'a20d69be3da910c60ba4030482d177684cff18ae42aabdb327dedd0575c8f0ff',
  'e8e66882c64ac9a907cefeba77c60367a3922fc0fd767c12ad5962b1a5f66275',
  'd19f1747c7499216630246e7fe957f692e5d9da4746ff417bdd13c61012f2139',
  '9da9d469c98238a4f4411844ad7df6488165eb09f0bc2e9ff846bfd30c18dd1b',
]);
const sha = (p) => createHash('sha256').update(p).digest('hex');

/** As palavras do texto (letras e dígitos, em minúsculas) que são nome do autor; vazio quando não há nenhuma. */
export const nomesDoAutorEm = (texto) => [...new Set(texto.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((p) => HASHES.has(sha(p)));

// a marca da empresa, montada aqui para que o detector não a escreva
const EMPRESA = Buffer.from('d2ljb21t', 'base64').toString();

/**
 * As exceções: o dono do repositório no endereço publicado (`<dono>/kit-de-orquestracao`), por onde se instala, e o nome do kit
 * (F344: o id `ichikawa-kit` do marketplace e o nome de exibição "Ichikawa's Kit"), que o operador escolheu como marca. E (F350) os
 * dois nomes fixos do design system da empresa, que o marketplace lista vindo do repositório dela: o endereço desse repositório e o
 * id do plugin de tema (`tema-<marca>`). E (F357) os dois pacotes que o kit publica no npm, `@<marca>/tokens` e `@<marca>/guardas`.
 * O nome fora dessas formas continua barrado.
 */
export const semOEnderecoPublicado = (texto) => texto
  .replace(/[\w.-]+\/kit-de-orquestracao\b/g, 'DONO/kit-de-orquestracao')
  .replace(new RegExp(`\\b${EMPRESA}-projects/${EMPRESA}-design-system\\b`, 'g'), 'EMPRESA/design-system')
  .replace(new RegExp(`\\btema-${EMPRESA}\\b`, 'g'), 'tema-EMPRESA')
  .replace(new RegExp(`@${EMPRESA}/(tokens|guardas)(?![\\w.-])`, 'g'), '@EMPRESA/$1')
  .replace(/\bichikawa-kit\b/g, 'NOME-DO-KIT')
  .replace(/\bIchikawa['’]s Kit\b/g, 'NOME DO KIT');
