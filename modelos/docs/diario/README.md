# Diário

A narrativa do projeto: por que cada coisa foi feita assim, o caso que originou a decisão, o que a medição mostrou. O [roadmap](../roadmap.md) guarda só a linha curta de cada item e aponta para cá; o índice é o roadmap.

## Como se escreve

- **Uma entrada por arquivo**, na pasta do mês: `AAAA-MM/DD-<ancora>.md`. A âncora é `[a-z0-9-]+` e vem declarada na primeira linha do arquivo (`<a id="<ancora>"></a>`), antes do título com a data. Dois PRs nunca escrevem no mesmo arquivo.
- **Uma entrada por item e por dia.** O roadmap aponta com `· [detalhe](diario/AAAA-MM/DD-<ancora>.md#<ancora>)`.
- **Cada entrada cabe numa leitura:** até 150 KB; passou disso, divida em duas entradas.
- **Entrada mergeada não se reescreve.** Correção ou continuação entra como entrada nova, com outra âncora.
- **Texto de quem não estava lá:** diga o caso concreto, o que foi medido e o que ficou decidido, sem depender de conversa que ninguém mais viu.
- Arquivos `AAAA-MM.md` de antes continuam valendo; mês novo nasce como pasta.
