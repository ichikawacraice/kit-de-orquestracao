# F306 · O registro ganha as peças de lista

Origem: a F305 (listagens do piloto WiControl, 01/11/2026) — quatro peças de lista que o registro não tem e que o piloto monta à mão em três ou quatro lugares cada. Especificação: [revisão das peças de lista](../design/revisoes/2026-11-01-F306-pecas-de-lista.md).

## Escopo
| ordem | peça (item) | parte de (shadcn) |
|---|---|---|
| L1 | `LinhaDoGrupo` (`linha-do-grupo`) | `table` + a dobra do kit (o `Collapsible` não serve: o grupo é o `<tbody>`) |
| L2 | `Monograma` + `MonogramaAusente` (`monograma`, saído do `menu-da-conta`), `Pessoa` + `PilhaDePessoas` (`pessoa`) | `avatar` / grupo de avatares |
| L3 | `Prazo` (`prazo`) | sem equivalente; a ausência como a da `Ficha` |
| L4 | `EscolhaNaCelula` (`escolha-na-celula`) | `dropdown-menu` (gatilho ghost) e `popover` |

## Base
PECA-01 ganha as quatro linhas (grupo de linhas, pessoa, prazo, trocar o valor na célula). A base sobe a **0.8.0** (MINOR: peça nova), com entrada no `CHANGELOG.md` e a linha de rastreio da PECA-01.

## Fora do escopo
- `PontoDaEtapa` (o grupo recebe a identidade como encaixe).
- Adotar as peças no WiControl: é a fatia 2 da F305.
- Subir a versão do pacote do registro: a URL `/r/v0.1.0/` é a que os projetos apontam, e o ateliê serve só a versão do pacote de hoje (*assumido, a confirmar*).

## Critério de pronto
- Cada peça no `lib/itens.mjs`, com teste dom (`test/pecas-de-lista.dom.test.tsx`) e demonstração no ateliê, nos dois temas; o `registry.json` regenerado.
- Crítica de UI com nota de pelo menos 24/30.
- `npm test` verde.

## Como foi conferido (01/11/2026)
- Crítica de UI: **25/30**, aprovada sem ressalva alta. As cinco ressalvas foram consertadas: a recusa quebra entre as duas frases (sem transbordar); o hover do gatilho soma tinta (`foreground/[0.07]`) para se ver sobre a linha que acende em `accent`; a pilha sobrepõe 2px (com 6px, o anel cortava a segunda inicial); o anel de foco com o deslocamento de 2px; o grupo sem linhas diz a frase de quem chama (*Sem tarefas*), não *0 de 0*. A especificação dizia `bg-accent` e `-space-x-1.5`: *assumido, a confirmar*.
- Validador: nenhum achado alto. Consertados: o texto de data com hora e sem fuso é lido como hora de São Paulo (o servidor em UTC trocava o dia); `hoje` inválido cai no agora; a PECA-01 diz o que a pilha faz com uma pessoa a mais que o limite.
