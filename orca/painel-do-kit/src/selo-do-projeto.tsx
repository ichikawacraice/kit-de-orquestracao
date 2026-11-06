// O selo do projeto (F451): de que projeto é o cartão, antes de qualquer outra leitura. Sem estado, sem Orca além dos
// componentes de texto: a aba de sessões (F452) importa daqui. O projeto não ganha tom — os tons do Orca já dizem estado.
import { Row, Text } from 'orca'
import { partesDoSelo } from './vista'

export { chaveDoGrupo, partesDoSelo, semPrefixoDoItem } from './vista'

export function SeloDoProjeto(props: { projeto: string | null; item?: string | null }) {
  const partes = partesDoSelo(props.projeto, props.item)
  if (!partes) return null
  return (
    <Row gap="xs" align="center">
      {partes.forte ? <Text size="sm" weight="semibold">{partes.forte}</Text> : null}
      {partes.fraco ? <Text size="xs" muted>{partes.fraco}</Text> : null}
    </Row>
  )
}
