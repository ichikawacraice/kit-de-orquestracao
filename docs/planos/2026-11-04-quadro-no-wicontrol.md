# Plano — o quadro novo no QA do WiControl (depois do F378)

04/11/2026. Item de origem: F378, no kit-de-orquestracao. Este repositório **não** edita o WiControl. A troca é da sessão do WiControl, com o prompt abaixo.

## Pré-requisito

As peças `quadro`, `prioridade` e `ponto-da-etapa`, e as versões novas de `idioma-de-cor` e `vazio`, só podem ser instaladas depois de duas coisas: o merge do PR do F378 e o deploy do ateliê, que serve o registro em `https://wicomm-atelie.vercel.app/r/v0.1.0/`. Antes disso, o `shadcn add` devolve 404 para as peças novas.

Para conferir:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "x-vercel-protection-bypass: $WICOMM_REGISTRO_BYPASS" https://wicomm-atelie.vercel.app/r/v0.1.0/quadro.json
```

O esperado é `200`.

## O que muda no WiControl

| Hoje (`frontend/src/components/qa/QaBoard.tsx`) | Depois |
|---|---|
| Cada coluna é um `Painel` `w-72` | `ColunaDoQuadro`, que mora no chão, com `CabecalhoDaColuna` e `PilhaDaColuna`. A coluna vazia vira `FitaDaColuna` |
| O cartão é `BlocoDeTinta densidade="compacta"` | `CartaoDoQuadro` (a peça, com sombra e raio 14). O cartão tem duas zonas: o `PedidoDoCartao` e a `VidaDoCartao`, que é a bandeja |
| O cabeçalho é `Estado soPonto` + `h2 t-titulo` + a contagem solta | O `marcador` é o ponto de `Estado` com o tom do status (P2). A contagem vai em pílula, dentro do `CabecalhoDaColuna` |
| `prioridade · há 2 h · 3 mensagens` em texto corrido | `Prioridade` na cabeça. O tempo e as mensagens vão no `InformativoDoCartao`, dentro da bandeja |
| `Estado espera "aguardando você"` e as falhas do diagnóstico | `VidaDoCartao tom="espera"` ou `tom="ruim"`, com a frase. Quando há as duas, vale a voz mais forte, e a outra fica contada em texto |
| A coluna que recebe o soltar fica `bg-accent` | `alvo` na `ColunaDoQuadro`: tinta da marca com contorno tracejado |
| `Vazio causa="filtro"`, alto, em toda coluna vazia | `Vazio escala="coluna"` dentro da fita aberta |
| `ring-1 ring-foreground/30` no item ativo | `ativo` no `CartaoDoQuadro` |
| Erro "Não mudou" fora do lugar | `recusa` + `motivoDaRecusa` na coluna. A bandeja fica `ruim`, com *Tentar de novo* (`outline sm`). O app traz a origem à vista |

O tabuleiro do `@hello-pangea/dnd` (`DragDropContext`, `Droppable`, `Draggable`, `renderClone`, autoscroll) **fica como está**. As props da biblioteca encaixam nas peças conforme o JSDoc do `Quadro`:

- `innerRef` e `droppableProps` → `PilhaDaColuna`;
- `innerRef` e `draggableProps` → `CartaoDoQuadro`;
- `dragHandleProps` → `TituloDoCartao`.

## Prompt para a sessão do WiControl

> Trocar o acabamento do quadro do QA pelas peças novas do registro `@wicomm`, sem mexer na anatomia nem no arrastar.
>
> **Antes de começar**, confira que o registro já serve a peça nova. O comando do pré-requisito precisa devolver 200 para `https://wicomm-atelie.vercel.app/r/v0.1.0/quadro.json`. O `WICOMM_REGISTRO_BYPASS` vem do ambiente; nunca o escreva em arquivo. Se der 404, pare e avise: o PR do F378 ainda não foi mergeado, ou o ateliê ainda não fez o deploy.
>
> **1. Instale as peças:** `cd frontend && npx shadcn@latest add @wicomm/quadro @wicomm/prioridade @wicomm/idioma-de-cor @wicomm/vazio`. O `idioma-de-cor` e o `vazio` vêm em versão nova: o `idioma-de-cor` ganha o `TEXTO_SOBRE_A_TINTA`, e o `vazio` ganha `escala="coluna"`. As classes antigas não mudam. Revise o diff antes de aceitar a sobrescrita.
>
> **2. Reescreva `src/components/qa/QaBoard.tsx`** com as peças. Use a tabela "O que muda" de `docs/planos/2026-11-04-quadro-no-wicontrol.md`, no repositório kit-de-orquestracao, e a demo `design-system/apps/atelie/src/catalogo/demos/quadro.tsx`, que é o exemplo de uso. Pontos que não podem escapar:
> - **A coluna** é `ColunaDoQuadro`, sem `Painel`. A coluna sem itens vira `FitaDaColuna`, e o `onAbrir` dela abre a coluna.
> - **O cabeçalho:** no quadro por status, o `marcador` é `<Estado soPonto tom={tomDoStatusDoQa(status)} />`. Nos quadros por responsável e por local, a coluna não tem marcador.
> - **O cartão:** o `CardDoItem` vira `CartaoDoQuadro`, com:
>   - `PedidoDoCartao`, contendo `CabecaDoCartao` (a `Prioridade` primeiro, depois o `ChipDeEstado` do status), `TituloDoCartao` (a descrição, em até 3 linhas: é a alça do arrastar e abre o item com Enter), `MiniaturaDoCartao` quando houver imagem, e `IdentidadeDoCartao` (`inicio` = onde · dispositivo; `fim` = `Pessoa soMonograma` ou *Assumir* `outline sm`, com `PilhaDePessoas` de quem está vendo);
>   - `VidaDoCartao`, sempre presente. Em repouso, `tom="neutro"`, com o `InformativoDoCartao` (*há 2 h*, *3 mensagens*). Com *aguardando você*, `tom="espera"`. Com falhas no diagnóstico, `tom="ruim"`.
> - **A prioridade:** mapeie a prioridade do QA para `nivel` (0–3 ou `"urgente"`). O nível *normal* do QA não se mostra.
> - **Arrastando:** `arrastando` no clone, `origem` no cartão de onde saiu, `alvo` na coluna sob o cursor (`snapshot.isDraggingOver`). `VagaDoCartao` onde o cartão vai entrar.
> - **A recusa do servidor:** desfaça o efeito otimista. Passe `recusa` e `motivoDaRecusa` à coluna de destino. Ponha a bandeja `ruim` com *Não mudou: <motivo>* e *Tentar de novo*. Chame `scrollIntoView({block:"nearest",inline:"nearest"})` no cartão de origem. Pelo teclado, mande o foco para *Tentar de novo*. Ponha o desfecho no `anuncio` do `Quadro`.
> - **Carregando:** `<Quadro carregando>` desenha a `EsperaDoQuadro` no lugar do esqueleto atual.
> - **Leitor de tela:** as instruções e os anúncios do hello-pangea (`dragHandleUsageInstructions` e `provided.announce`) em PT-BR.
>
> **3. Confira** pelo gate do WiControl: typecheck, testes e as guardas `wicomm-guardas` com zero violações. Depois veja o quadro no navegador:
> - claro e escuro;
> - 1280px e 375px;
> - um quadro sem nenhum cartão pedindo nada: todas as bandejas ficam cinzas, e o quadro precisa continuar legível;
> - o arrastar pelo mouse e pelo teclado;
> - a recusa.
>
> Peça a crítica ao `design-system:critico-de-ui` (corte 24/30) antes do PR.
>
> **Fora do escopo:** card, bloco-de-tinta, vazio de página, estado, skeleton e o `PontoDaEtapa` local. Esses ficam para o próximo item de acabamento. Não troque a biblioteca de arrastar.

## Depois

Estas peças têm o mesmo acabamento fraco e ficam para itens próprios:

- `card` e `bloco-de-tinta`;
- o `vazio` de página;
- `estado`;
- `skeleton`;
- o `PontoDaEtapa` local do WiControl, que passa a ser o `criarPontoDaEtapa` do registro, com o mapa de etapas num arquivo só, listado nas exceções da guarda `o-carimbo-tem-forma`.
