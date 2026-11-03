# Plugin `tema-wicomm`

O tema dos apps da Wicomm para o plugin [`design-system`](../design-system/). O `design-system` não sabe de marca nenhuma; este plugin traz o que é da Wicomm, como dado:

- [`tema/tema.tokens.json`](tema/tema.tokens.json): a cor da marca (`#F30B42`, igual nos dois temas), o hover, a tinta, a cor que escreve sobre a marca e o gradiente, em DTCG;
- [`tema/tema.json`](tema/tema.json): o nome (`Wicomm`), o logotipo (`wicomm` e o monograma `w`), a fonte do texto (Archivo, com o eixo de largura, carregada pelo app na variável `--font-archivo`), a razão aceita do branco sobre a marca (4,25, MARCA-01) e o prefixo do registro (`@wicomm`).

A fonte de verdade é [`temas/wicomm/`](../../temas/wicomm/) na raiz do repositório. Esta pasta é a cópia que vai com o plugin (o plugin se instala sozinho), e o teste do repositório reprova a cópia que andar sem a outra.

## Usar

Ligue os dois plugins no projeto, sempre pelo mesmo marketplace (`design-system@ichikawa-kit` e `tema-wicomm@ichikawa-kit`). Depois, a skill `tema-wicomm:aplicar` liga o projeto ao tema: copia o tema para `design/tema/`, que os scripts de medida do `design-system` leem, e confere o prefixo do registro e a fonte.

Os tokens e as peças **já saem com o tema Wicomm**: `@wicomm/tokens` publica o CSS gerado com ele, e o registro `@wicomm` serve as peças com ele. O `aplicar` não gera nada no projeto.
