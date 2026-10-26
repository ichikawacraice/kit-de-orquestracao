# ADRs do kit

Uma decisão por arquivo, `NNNN-título-em-minúsculas.md`, numeração sequencial deste repositório.

## Modelo
```markdown
# ADR NNNN — <decisão em uma frase>

- Data: AAAA-MM-DD
- Status: Proposto | Aceito | Substituído por NNNN
- Autor:
- Relacionados:

## Contexto
O caso concreto e o que força a decisão.

## Decisão
O que ficou decidido, numerado.

## Consequências
O que muda para quem usa; o que fica mais difícil.
```

## Índice
| Nº | Decisão | Status |
|---|---|---|
| [0001](0001-plugin-para-o-nucleo-cli-para-o-projeto.md) | Plugin para o núcleo, CLI para o projeto | Aceito |
| [0002](0002-processos-de-documento-e-design-sao-plugins-opcionais.md) | Processos de documento e de design são plugins próprios, ligados por padrão | Aceito (decisão 5, parte da aba do app, substituída pelo [0003](0003-opcao-do-plugin-vale-por-conta-e-o-kit-json-e-o-caminho-do-time.md)) |
| [0003](0003-opcao-do-plugin-vale-por-conta-e-o-kit-json-e-o-caminho-do-time.md) | A opção do plugin vale por conta e se edita no /plugin do terminal; o kit.json é o caminho do time e vence a opção | Aceito |
| [0004](0004-via-rapida-escopo-trancado-e-piso-de-uma-executora.md) | Via rápida para item simples, escopo trancado no plano e piso de uma E livre fora do modo ausente | Aceito |
