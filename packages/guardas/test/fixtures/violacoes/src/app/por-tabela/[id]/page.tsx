import { TELAS } from '@/telas/indice'

// Monta uma tela do índice; o índice também importa uma tela que tem trilha, mas esta página não.
export default function PorTabela() {
  const Tela = TELAS.lista
  return <Tela />
}
