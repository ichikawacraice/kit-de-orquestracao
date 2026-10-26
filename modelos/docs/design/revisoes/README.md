# Revisões de design

Antes de qualquer tela nova ou mudada, a revisão de arquitetura de UI. Cada revisão é um arquivo `AAAA-MM-DD-<tela>.md` e é o que a executora segue: ela não redesenha a tela, ela cumpre a revisão aprovada.

## O que a revisão traz

1. **A tarefa:** a pergunta única que a tela responde.
2. **O inventário:** cada dado na tela com a decisão que ele gera. Dado sem decisão sai.
3. **A hierarquia:** o que a pessoa vê primeiro, depois, e só se procurar.
4. **Onde mora cada mensagem:** erro, aviso, vazio, sucesso e carregando, cada um no seu lugar.
5. **As peças do kit de componentes** para cada região; peça que falta entra no kit, não como arranjo à mão.
6. **Os estados:** vazio, carregando, erro, parcial, cheio e bloqueado.
7. **O movimento:** o que se move, por quê, e o escape para quem pede menos movimento.
8. **O que sai:** o que existia e deixa de existir.

A revisão não escreve código de tela. Depois da implementação, a crítica de UI dá nota por eixo, aponta no máximo 5 problemas e vale como aprovada a partir de 24/30.

## Índice

| Data | Tela | Estado |
|---|---|---|
