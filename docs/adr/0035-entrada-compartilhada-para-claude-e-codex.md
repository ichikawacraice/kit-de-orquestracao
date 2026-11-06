# 0035 — Entrada compartilhada para Claude e Codex

Data: 2026-11-06. Status: Proposta.

## Contexto

O núcleo já reconhece a ORCA, mas a descoberta das regras e o PATH dos comandos
dependiam do plugin Claude. Duplicar o painel para Codex separaria os itens.

## Decisão

Gerar AGENTS.md apontando para CLAUDE.md no mesmo plano transacional de instalação,
com hash no lock, atualização conservadora e remoção pelo mecanismo existente.
AGENTS.md preexistente pertence ao projeto e é preservado. Expor manuais e
comandos por `kit contexto` e `kit executar`, sem resolver o plugin na conta Claude.
Aplicar a guarda de modelo explícito e isolamento a workers Codex, sem impor
nomes de modelos Claude. Configuração e estado mantêm os caminhos históricos.

## Alternativas consideradas

- Duplicar regras e estado em .codex: cria duas fontes divergentes.
- Simular a ferramenta Skill e os hooks Claude: os contratos dos runtimes diferem.
- Só documentar comandos: não resolve a descoberta das regras ao iniciar o Codex.

## Consequências

Ambos acessam o mesmo núcleo. Os hooks Claude continuam exclusivos do runtime
Claude: paridade de enforcement automático exige um adaptador de eventos próprio.
O catálogo expõe instruções originais; o manual explica a adaptação das ferramentas.
