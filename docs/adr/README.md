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
| [0004](0004-via-rapida-escopo-trancado-e-piso-de-uma-executora.md) | Via rápida para item simples, escopo trancado no plano e piso de uma E livre fora do modo ausente | Substituído por [0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) |
| [0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) | Os testes de todas as sessões e projetos dividem um teto de núcleos da máquina, em fichas em `~/.claude/orquestracao/nucleos-de-teste/` (padrão: metade dos núcleos) | Proposto |
| [0006](0006-o-diario-tem-uma-entrada-por-arquivo.md) | Cada entrada nova do diário é um arquivo próprio em `diario/AAAA-MM/DD-<ancora>.md`; o acervo fica, e o gate confere o formato | Aceito |
| [0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) | Cada sessão grava o próprio item; a batida de 10 min roda no mod sem modelo, cutuca e solta o parado e avisa o livre; a orquestradora só lê, mergeia, pede vaga e arquiva | Proposto |
| [0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) | O teto da máquina vira 2/3 dos núcleos, partido em vaga do gate (70%, um gate por vez na máquina) e vaga dos testes normais; sem gate, a vaga dele se empresta | Proposto |
| [0009](0009-afinidade-no-despacho.md) | Item do mesmo tema vai primeiro ao membro que passou pelo último (`passaram`); o afim ocupado segura o item até 20 min; quem termina roda `painel seguinte` antes de se limpar | Proposto |
| [0010](0010-o-gate-emprestado-comeca-com-dois-workers-por-pacote.md) | O gate que esperou a devolução começa com pelo menos 2 workers por pacote (4 de 6) no pnpm-workspace; substitui o "3 de 6" da decisão 6 do 0008 | Proposto |
| [0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) | Uma sessão dona do item do plano ao PR; revisão por subagente validador; testes afetados no trabalho e gate só na fila de merge da orquestradora; até 4 donas | Aceito |
| [0012](0012-o-kit-tem-um-modelo-so-a-dona.md) | O pool de papéis sai do código e do texto: um modelo só, a sessão dona; `KIT_MODELO` deixa de existir; as travas que valem sem pool ganham nome de agora | Proposto |
| [0013](0013-o-pedido-e-ponto-de-partida-nao-ordem.md) | O pedido é ponto de partida: a sessão confere a premissa, aponta o errado e propõe o melhor formato, na medida do risco; discorda uma vez e segue com o reversível; sem hook | Proposto |
| [0014](0014-o-kit-decide-as-skills-de-fora-num-catalogo.md) | Catálogo de skills de fora: superpowers vira dependência declarada; a trava barra a que duplica o kit em projeto com o kit; o doutor diz o que ter e o que desligar | Proposto |
| [0015](0015-o-plugin-declara-as-substitutas-dele.md) | O plugin ligado declara em `substitutas.json` as skills de fora que absorveu; vale só para `absorver` do catálogo e peça do próprio plugin; o `kit.json` do projeto vence | Proposto |
| [0016](0016-performance-e-um-plugin-opcional-do-kit.md) | Performance vira o plugin opcional `kit-performance`: 4 skills por camada com 31 práticas num catálogo, um revisor só leitura; Redis, região e balanceamento são decisão, não regra | Proposto |
| [0017](0017-o-marketplace-se-chama-ichikawa-kit.md) | O marketplace se chama `ichikawa-kit` (exibição "Ichikawa's Kit"); o código grava o nome novo e lê os dois; `kit migrar-marketplace` troca a máquina com backup e desfazer | Proposto |
| [0018](0018-o-design-system-sucede-o-kit-design.md) | O `design-system` sucede o `kit-design`: troca na conta (`atualizar-plugins`) e no projeto (`kit atualizar`, o velho fica false); o tema liga pelo `design.tema` do kit.json | Proposto |
