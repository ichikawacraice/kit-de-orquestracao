# F272 · Blocos de tela da Wicomm (fatia F261.4)

- **Data:** 30/10/2026 · **Dona:** sessão `F272 · Blocos de tela da Wicomm`
- **Critério de pronto (estudo §4, F261.4):** cada bloco instala num Next vazio e renderiza; crítico ≥ 24/30 em cada um a 1280 px nos dois temas.
- **Revisão de arquitetura:** [`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`](../design/revisoes/2026-10-30-F272-blocos-de-tela.md), com a crítica no fim.

## Escopo — duas fatias (D3 da revisão, *assumida, a confirmar*)
1. **Esta (PR 1):** as peças que o casco, a Lista, a Mesa e a Entrada pedem, e os quatro blocos.
2. **Próxima (PR 2):** `dobra`, `barra-do-editor`, `colunas-do-editor` e o bloco Editor, com as emendas E2 e E3.

Motivo: os cinco blocos pedem ~18 peças novas; num PR só, crítica e revisão ficam rasas. O item fica com `maisFatias: true` até o PR 2.

## Forma dos blocos no registro
- Cada bloco é um item `registry:block` com componentes (`registry:component`) e uma página de exemplo (`registry:page`, com `target` em `app/(casco)/exemplos/…` ou `app/(tela-inteira)/exemplos/…`).
- O componente do bloco é puro: recebe a carga por props numa união tipada (`carregando | erro | pronto`). A página de exemplo lê `?estado=` e entrega a fixação de `dados.ts`. Nada na tela alterna estado.
- Peças agnósticas de framework: o caminho atual entra por prop e o link pelo `ProvedorDeLink` (lib `link-do-app`), que o Next liga ao `next/link`. Só a página de exemplo é do Next.

## Fora do escopo
- Bloco Editor (PR 2); conversa com IA, alça de arrasto, barra flutuante do canvas (D6, D7); `Badge`, `PontoDaEtapa`, `FaixaDoEditor`, `CarregandoPorCima`, `Popover`.
- Demonstração no ateliê (`apps/atelie`): quem mergear por último entre F272 e F273 a escreve (aviso do F273).

## Como se confere
- `npm test -w @wicomm/registro`: registro, dom de cada peça e bloco, `tsc`, e as guardas `@wicomm/guardas` rodadas sobre os blocos.
- `npm run num-next-vazio -w @wicomm/registro`: `add` de cada peça e bloco num Next vazio e o `next build`; as páginas de exemplo renderizam.
- Capturas a 1280 px nos dois temas de cada estado das páginas de exemplo, julgadas pelo crítico.

## Assumido, a confirmar
- **D3 · duas fatias:** o Editor (com `dobra`, `barra-do-editor`, `colunas-do-editor`, as emendas E2/E3 e as ressalvas P4/P5 da crítica 1) vai no PR 2.
- **Rotas de exemplo reais** (`/pedidos`, `/pedidos/[id]`, `/entrar`): as guardas leem a topologia certa (crítica 1, P1).
- **A barra recolhida mora no navegador**, e um script no `<head>` do layout raiz (`ScriptsAntesDoDesenho`) marca o `<html>` antes do primeiro desenho. A revisão propunha um cookie lido pelo servidor (D4), mas o Next 16 (Cache Components) recusa `cookies()` fora de `<Suspense>`, e o script vale igual em Next e Vite. A LAY-01 foi emendada nesse sentido.
- **Logotipo provisório** (o nome em texto e o ponto na cor da marca) até o operador entregar o desenho oficial.
- **Base 0.3.0 (MINOR):** CASCO-01 fixa cabeçalho × topo; LAY-01 o topo parado, a barra por cima abaixo de 768px e a marca antes da hidratação; PESO-05 a nota de rolagem; PECA-01 as linhas novas e o medalhão neutro na ausência. Nota de release da 0.3.0 é do release.

## Depois
- **Achado para `@wicomm/guardas`:** `componente-que-ninguem-monta` só examina arquivo com inicial maiúscula; num projeto shadcn (kebab-case) ela não examina nada. Desligada com motivo no teste dos blocos.
- **Crítica 3, P5:** o cartão da Entrada sobe 15px quando aparece o erro (ancorar pelo topo).
- **Crítica 3, baixa:** a busca da Lista tem 30px ao lado da barra de modos de 36px.
- **Validação, B3 parcial:** a prova de que a varredura morde cobre 2 das 27 guardas.
- **`ItemDaNavegacao`** mora no bloco do casco, não no kit (as duas críticas o citam sem pesar).
- **Demonstração no ateliê** de cada bloco: quem mergear por último entre F272 e F273.
