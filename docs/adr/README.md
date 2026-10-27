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
| [0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) | Os testes de todas as sessões e projetos dividem um teto de núcleos da máquina, em fichas em `~/.claude/orquestracao/nucleos-de-teste/` (padrão: metade dos núcleos) | Proposto |
| [0006](0006-o-diario-tem-uma-entrada-por-arquivo.md) | Cada entrada nova do diário é um arquivo próprio em `diario/AAAA-MM/DD-<ancora>.md`; o acervo fica, e o gate confere o formato | Aceito |
| [0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) | Cada sessão grava o próprio item; a batida de 10 min roda no mod sem modelo, cutuca e solta o parado e avisa o livre; a orquestradora só lê, mergeia, pede vaga e arquiva | Proposto |
| [0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) | O teto da máquina vira 2/3 dos núcleos, partido em vaga do gate (70%, um gate por vez na máquina) e vaga dos testes normais; sem gate, a vaga dele se empresta | Proposto |
