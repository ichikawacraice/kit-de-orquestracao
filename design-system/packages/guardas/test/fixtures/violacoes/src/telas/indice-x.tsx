import ComTrilha from '@/telas/com-trilha'
import Lista from '@/telas/lista-por-tabela'

export function TelaDoIndice({ detalhe = false }: { detalhe?: boolean }) {
  return detalhe ? <ComTrilha /> : <Lista />
}
