# F183 · Cada projeto lê só as próprias perguntas

Origem: pesquisa `docs/research/2026-10-27-fila-de-merge-e-testes.md`, recomendações 3 e 4. Pedido do operador (27/10): separar o trabalho entre projetos para ninguém ler o que não precisa.

## Medido (27/10, só leitura de `~/.claude/orquestracao/painel/`)
- `perguntas/`: 439 arquivos — 259 `izanagi`, 42 `Izanagi`, 95 `kit-de-orquestracao`, 43 sem `projeto` (35 com `sessaoId`, 22 deles resolvem pela coleção `sessoes`); estados: 377 respondidas, 47 assumidas, 14 canceladas, 1 aberta.
- `sessoes/` 138 (5 sem projeto, nenhuma com caixa alta), `fila/` 25, `cartoes/` 1: todos em minúsculas.
- O `doProjeto` da linha 187 é o filtro dos **temas** (tema sem projeto vale para todos, de propósito). O vazamento real das perguntas: `list perguntas` sem flag lê tudo, e o pane, o hook de início e a trava da limpeza varrem a pasta inteira a cada leitura.

## Decisões (assumidas, a confirmar no PR)
1. **Projeto num nome só.** `projeto` é slug `[a-z0-9-]` (minúsculo, sem traço nas pontas). O painel recusa gravar outro (`Izanagi` volta com a dica do slug) e preenche o das perguntas novas pela raiz do git, como já fazia em `sessoes` e `fila`. `projetoDoCwd` e `projetoDaSessao` passam o nome da pasta pelo mesmo slug.
2. **`list perguntas` lê o projeto da pasta atual**; `--todos` lê todos, `--projeto sem-projeto` lê o resto. As outras coleções não mudam (a skill já passa `--projeto`).
3. **Pasta quente = abertas e assumidas.** Respondida e cancelada vão para `perguntas/arquivo/<projeto>/<AAAA-MM>/<Q>.json` (mês da resposta, em São Paulo). *Assumida fica na pasta quente*: ela ainda espera o operador confirmar ou mudar (o pane tem a ação de mudar e o resumo da ausência a lista); arquivá-la obrigaria esses três leitores a varrer o arquivo.
4. **Quem move:** o `painel` move na hora a pergunta que ele fecha (e traz de volta a que reabre); o pane continua gravando a resposta na pasta quente (o mod não apaga arquivo), e a batida (10 em 10 min) roda `painel perguntas arquivar`, que leva as fechadas para o arquivo.
5. **Quem lê o arquivo:** `get`/`update` por ID acham a pergunta onde ela estiver; `list perguntas respondida|cancelada` (ou `--arquivo`) inclui o arquivo; o rodapé "Perguntas respondidas" do pane lê as fechadas da pasta quente mais as do arquivo respondidas hoje (São Paulo); o hook de início (respondidas em 24 h) e a trava da limpeza (o "sim" do painel, 30 min) leem do arquivo só os arquivos mudados no período.
6. **Migração única:** `painel perguntas migrar [--seco]`: copia o painel inteiro para `backups/F183-<data>/` antes de gravar; projeto em minúsculas nas quatro coleções; pergunta sem projeto ganha o da sessão (`sessoes/<sessaoId>`, senão o registro do app), senão `sem-projeto`; sessão sem projeto, pelo registro do app, senão `sem-projeto`; depois move as fechadas. Não roda no estado real neste PR: a orquestradora pede o ok do operador.

## Fora do escopo
Pane com filtro por projeto (o pane é a visão do operador, de todos os projetos); arquivo de `sessoes` concluídas; mudar o padrão do `list` das outras coleções.

## Pronto quando
Testes novos (`node:test`, HOME temporário) e os do mod verdes; `--seco` da migração mostra o antes → depois sem gravar; validador sem achado médio/alto.
