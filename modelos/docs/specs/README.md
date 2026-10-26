# Specs — índice e processo

Toda feature nasce como spec aqui, antes do código. A spec descreve **o quê e por quê** com precisão suficiente para implementar sem redecidir o desenho, mas não é código: detalhe de implementação que não afeta contrato fica livre. Arquivo: `SPEC-NNN-título-em-minúsculas.md`, numeração de 3 dígitos, número pedido à orquestradora quando há uma.

## Ciclo de vida

```
Rascunho → Em revisão → Aprovada → Implementada
                 ↘ Substituída por SPEC-NNN
```

- **Rascunho:** escrita, pode mudar livremente.
- **Em revisão:** submetida ao time; as mudanças ficam rastreadas em commit.
- **Aprovada:** contrato fechado; mudar exige reabrir a revisão e atualizar o código que depende.
- **Implementada:** o código existe e referencia a spec. A spec vira documentação viva: divergência entre código e spec é defeito, e se corrige um dos dois na mesma sessão.
- **Substituída:** outra spec assumiu o assunto; o cabeçalho aponta qual.

## O status é UMA palavra da lista. A nuance vai em `Pendências:`

Vocabulário fechado: Rascunho · Em revisão · Aprovada · Implementada · Substituída.

Quando o status carrega nuance, quem precisa dela inventa estado novo ("Parcialmente implementada") e o campo deixa de ser legível por máquina. A nuance vai à parte:

```
- **Data:** AAAA-MM-DD · **Status:** Implementada · **Pendências:** critério 4 pende do primeiro uso real
```

`Pendências:` é livre e opcional: ausência significa que não falta nada. **Meia implementação é `Aprovada` com pendência, não um estado novo.**

**A spec no presente afirma o que existe.** O que ainda não existe fica em `Pendências:` ou em outra spec, nunca escrito como se já valesse.

## Índice

| Spec | Título | Status | Depende de |
|---|---|---|---|
