# ADRs — registros de decisão

Decisões de desenho do projeto, uma por arquivo, `NNNN-título-em-minúsculas.md`, numeração sequencial de 4 dígitos. Com uma sessão orquestradora ativa, o número é pedido a ela antes de escrever o arquivo.

**Depois de mergeado, o ADR é imutável.** Para reverter, não edite: escreva um ADR novo que o substitui e troque o status do antigo para `Substituído por NNNN`. Antes do merge o ADR ainda é rascunho e pode mudar, desde que a mudança seja declarada dentro do arquivo, em bloco de citação, dizendo o que mudou e por quê.

**O índice é índice.** A célula `Decisão` diz o que a decisão É, em até 200 caracteres; o `Status` usa a forma curta (`Proposto`, `Aceito`, `Substituído por NNNN`). A nuance mora no cabeçalho do ADR, que é a autoridade.

**O que merece ADR:** o que muda um desenho, um contrato ou uma regra que outras pessoas seguem. Correção de defeito e detalhe de implementação não merecem.

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

## Alternativas consideradas
Cada alternativa real e por que ficou de fora. ADR sem esta seção não passa na revisão: sem ela ninguém sabe se a decisão foi escolhida ou só aconteceu.

## Consequências
O que muda para quem usa; o que fica mais difícil.
```

## Índice

| Nº | Decisão | Status |
|---|---|---|
