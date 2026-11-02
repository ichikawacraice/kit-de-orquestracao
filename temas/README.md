# Temas

Cada pasta é um tema: o que é da marca e não do sistema. O sistema (a base, os tokens de sistema, as guardas, as peças) não sabe de marca nenhuma; o tema preenche os valores.

- `tema.tokens.json` — as cores da marca, em DTCG (o slot `marca`).
- `tema.json` — nome, logotipo, fonte do texto, razão aceita da tinta sobre a marca e prefixo do registro ([formato](../packages/tokens/tema.schema.json)).

O `id` do tema é o nome da pasta. O tema é conferido ao gerar pelas regras da base (MARCA-01, MARCA-03): ver o [README dos tokens](../packages/tokens/README.md#o-tema).

| tema | de quem |
|---|---|
| [`wicomm`](wicomm/) | os apps da Wicomm (o padrão) |
