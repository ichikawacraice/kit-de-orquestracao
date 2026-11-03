// CTRL-09 — ícone de uma biblioteca só, `lucide-react`: duas bibliotecas dão
// dois traços e duas métricas na mesma barra.
import { CODIGO, especificadores, violacao } from './_comum.mjs'

const BIBLIOTECAS_DE_ICONE = /^(?:react-icons(?:\/|$)|@heroicons\/|@radix-ui\/react-icons$|@tabler\/icons|phosphor-react$|@phosphor-icons\/|@fortawesome\/|react-feather$|@mui\/icons-material|iconoir-react$|@iconify\/react$|react-bootstrap-icons$|lucide$|lucide-static$)/

export default {
  id: 'icone-de-uma-biblioteca',
  regras: ['CTRL-09'],
  titulo: 'Ícone de uma biblioteca só',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      especificadores(texto)
        .filter((s) => BIBLIOTECAS_DE_ICONE.test(s))
        .map((s) => violacao(arquivo, texto.split('\n').findIndex((l) => l.includes(s)) + 1, 'ícone de outra biblioteca: use lucide-react', s)),
    )
    return { examinados: fontes.length, violacoes }
  },
}
