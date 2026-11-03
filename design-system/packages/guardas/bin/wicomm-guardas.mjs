#!/usr/bin/env node
// wicomm-guardas — confere o projeto contra as guardas de design Wicomm.
//
//   wicomm-guardas               confere (o CI): reprova violação nova, contagem que sobe e contagem que desce sem a base regravada
//   wicomm-guardas --atualizar   grava na base só o que DESCEU (quem consertou roda e comita a base no mesmo PR)
//   wicomm-guardas --iniciar     cria a base com o estado de hoje (adoção num projeto existente; recusa se ela já existe)
//   --raiz <dir>  --config <arquivo>  --so <id,id>  --json
import { verificar } from '../lib/executar.mjs'

const args = process.argv.slice(2)
const valor = (nome) => {
  const i = args.indexOf(nome)
  return i === -1 ? undefined : args[i + 1]
}
const modo = args.includes('--iniciar') ? 'iniciar' : args.includes('--atualizar') ? 'atualizar' : 'conferir'

try {
  const r = verificar({ raiz: valor('--raiz') ?? process.cwd(), caminhoDaConfig: valor('--config'), modo, so: valor('--so')?.split(',') })
  if (args.includes('--json')) console.log(JSON.stringify({ ok: r.ok, comparacao: r.comparacao, resultados: r.resultados, gravou: r.gravou }, null, 2))
  else console.log(r.relatorio)
  process.exit(r.ok ? 0 : 1)
} catch (e) {
  console.error(`wicomm-guardas: ${e.message}`)
  process.exit(2)
}
