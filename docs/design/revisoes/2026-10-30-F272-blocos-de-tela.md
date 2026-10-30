# Revisão de arquitetura: F272, blocos de tela do registro Wicomm

**Fontes lidas, nesta ordem:**

- **PRODUCT:** este repositório não tem; os blocos são genéricos e o papel foi assumido.
- **Base:** `plugins/wicomm/base/ANATOMIA.md`, `DESIGN.md` e `CONVENCOES.md` (v0.2.0), lidas inteiras.
- **Configuração:** não há `design/wicomm.json` nem `.claude/kit.json`. Valem a largura de 1280 px, o kit em `packages/registro/registry/wicomm/ui/` e as revisões em `docs/design/revisoes/`.
- **Código de hoje:** as 17 peças do registro e o `lib/idioma-de-cor`.
- **Referência, só leitura:** do Izanagi, `AppSidebar`, `AppHeader`, `Trilha`, o `(app)/layout.tsx`, o `ForaDoEditor`/`SaidaDoEditor`, a guarda `o-modo-foco-tira-o-casco` e as peças `barra-do-editor`, `colunas-do-editor`, `chip-de-estado`, `estado`, `seletor-de-vista`, `ficha`, `dobra` e `table`.

**Premissas, todas *assumidas, a confirmar*:**

- Densidade instrumento (DENS-01).
- Tela de referência de 1280 × 800.
- Conteúdo de exemplo neutro: *pedidos* na Lista e na Mesa, *documento* no Editor.
- Os nomes D1…D8 são rótulos locais, não Q-IDs. A dona atribui o Q-ID ao levar a decisão ao operador.

**Como o exemplo alterna os estados, sem controle na tela (vale para os cinco blocos):**

- **Componente puro.** Cada bloco é um componente que recebe a carga por props, numa união tipada: `{ tipo: "carregando" } | { tipo: "erro" } | { tipo: "pronto", itens }`, com a causa do vazio dentro do `pronto`.
- **Página de exemplo.** O bloco instala também uma página de exemplo (`registry:page`). Ela lê `searchParams.estado` no servidor e entrega a fixação correspondente, que mora num arquivo à parte (`exemplo/dados.ts`, ex.: `?estado=vazio-filtro`).
- **Ateliê e crítico.** O ateliê lista um link por estado, com `data-vitrine`. O crítico avalia cada URL a 1280 px nos dois temas.
- **No projeto.** O projeto apaga a página e o `dados.ts` e liga a sua consulta à mesma união. Nada na tela alterna estado.

**Rotas do exemplo:**

- Dentro do casco: `app/(casco)/exemplos/{lista,mesa}`.
- Fora do casco: `app/(tela-inteira)/exemplos/{editor,entrada}`.

---

# Revisão de arquitetura: casco

## Tarefa
Quem usa qualquer app Wicomm **acha onde está e vai para outro destino** sem ler a tela. O casco dá navegação, título e primário no mesmo lugar em todo app (CASCO-01).

## Quem e onde
- **Quem:** quem usa um app Wicomm autenticado, seja equipe interna ou cliente.
- **Largura:** 1280 px é o pior caso.
- **Frequência:** em toda tela, o dia inteiro.
- **Densidade:** instrumento. O casco é igual nas duas densidades (DENS-02: "muda o ritmo").
- **Arquétipo:** não é arquétipo; é a moldura dos arquétipos Lista, Mesa e Formulário.

## Inventário
| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Símbolo Wicomm + nome do app | barra lateral, topo | "estou no app certo"; o clique leva ao início | toda sessão | **fica** (recolhida: só o símbolo) |
| Destinos (ícone 18 + rótulo) | barra lateral | para onde vou | várias vezes por hora | **fica** |
| Destino ativo | barra lateral | onde estou | sempre | **fica** (`bg-primary/10`, tinta, `aria-current="page"`) |
| Contagem "pede você" num destino | à direita do rótulo | há trabalho esperando noutro destino | várias vezes por dia | **fica** só quando > 0 e em tom `espera`/`ruim`. Recolhida, vira ponto sobre o ícone, e o número vai na dica |
| Rótulo de grupo de destinos | barra lateral | separa áreas | — | **fica** só com > 1 grupo e grupo com > 1 destino; recolhida, sai |
| Filete entre grupos (referência) | barra lateral | nenhuma que o ar não dê | — | **sai** (SUP-03): separa por `gap-4` |
| Botão de ação na barra lateral (referência: "Novo …") | barra lateral | é ação de tela | — | **sai** (CASCO-01: "ação de tela" não mora ali); vai ao topo da página |
| Recolher / expandir | pé da barra | mais largura para o conteúdo | raro, por preferência | **fica** |
| Tema (claro · escuro · do sistema) | pé da barra | conforto | raro | **fica**, como menu de escolha (PECA-01: `GrupoDeEscolhaDoMenu`) |
| Conta (monograma + nome) | pé da barra | quem está logado; ir à conta, sair | raro | **fica**; o e-mail vai **sob demanda**, no topo do menu da conta |
| "Configuração da conta" como destino (referência) | barra | — | raro | **sai** da lista de destinos; vira item do menu da conta |
| Sair | menu da conta | encerrar a sessão | raro | **sob demanda** (menu da conta, sem confirmação) |
| Troca de contexto (organização) | cabeçalho | em que conjunto de dados estou | diário | **fica** quando o app tem mais de um contexto; senão o cabeçalho não existe |
| Busca global | cabeçalho | achar qualquer objeto do app | — | **encaixe** do cabeçalho; o exemplo não preenche (D3 em *Peças novas*: falta o campo com ícone) |
| Conexão (serviço de fora) | cabeçalho | o app inteiro está de pé? | — | **encaixe**; o exemplo não preenche |
| Medidores de uso/cota, saúde de serviço (referência) | cabeçalho | decisão de quem opera | — | **sai** do casco (MSG-03; ARQ-02: análise é Lista, noutra tela) |
| Trilha | topo da página | voltar à lista de onde veio | toda tela de detalhe | **fica** só em detalhe (CASCO-03) |
| Título `h1` | topo da página | onde estou | sempre | **fica** (TIPO-04) |
| Estado do objeto | topo, ao lado do `h1` | o que isto pede de mim | tela de objeto | **fica** (`ChipDeEstado`) |
| Primário da tela | topo, à direita | o gesto que avança | por tela | **fica**, um só (PESO-01) |
| Secundárias (até 2) | topo, à esquerda do primário | gestos frequentes não primários | por tela | **fica** em `secondary` |
| `⋯` da tela | topo, à direita do primário | ações raras do objeto | raro | **sob demanda** (`Menu`) |
| Desfecho do gesto do topo | linha abaixo do título | a ação deu certo ou falhou, e a saída | após o gesto | **fica** até a próxima ação (MSG-01 "no bloco") |

## Hierarquia e peso
**Divisão cabeçalho × topo (decidida aqui; fecha o *assumida* da CASCO-01):**
- **Cabeçalho** = o que vale **igual em todas as telas** do app e muda o app inteiro: troca de contexto, busca global, conexão. Nunca título, nunca primário, nunca conta nem tema (esses moram no pé da barra lateral).
- **Topo da página** = o que **muda quando a tela muda**: trilha, `h1`, estado, gestos da tela, filtros globais da tela (Lista) e desfecho.
- **O teste para casos novos:** se a mesma coisa continua valendo depois de trocar de destino, é do cabeçalho; se não, é do topo.
- **O topo não rola.** Rola a região do arquétipo abaixo dele, pela peça de rolagem do kit. O primário e o estado ficam sempre à vista (D2).

**Pesos a 1280 × 800:**

| região | peso |
|---|---|
| Barra lateral | 224 px = 17,5 % (expandida) · 64 px = 5 % (recolhida). Altura total. `z-20` |
| Cabeçalho (opcional) | 48 px (`h-12`), largura do resto, fora da rolagem, `z-30`, no chão (`bg-background`, sem linha) |
| Topo da página | `pt-6` 24 · trilha 16 · `gap-1.5` · linha do título 36 (a altura do `lg`) · filtros (só a Lista: `gap-3` + 30) |
| Conteúdo | `max-w-[100rem]` (LAY-02), `px-6`, `pb-6`, `gap-6` entre o topo e a região. Com o cabeçalho e a barra expandida, sobram ≈ 1008 × 600 px na Lista |

**Ordem do olho:**
1. O `h1`.
2. O estado.
3. O primário (`lg`, à direita).
4. Os destinos.

## Mensagens
| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "3" (pedem você) no destino | ao lado do rótulo; recolhida, ponto + dica "Pedidos: 3 pedem você" | enquanto vale | `espera` | quem usa |
| Desfecho do primário do topo ("Conferência concluída.") | linha do desfecho, no topo | até a próxima ação | `ok`/`ruim` | quem usa |
| Desfecho de gesto cuja tela sumiu ("Pedido 1043 criado") | `useToast` | some sozinho (o `ruim` fica até fechar) | `ok`/`ruim`/`neutro` | quem usa |
| "Não deu para abrir o app. Tente de novo." (falha ao montar a navegação) | `TelaDeErro escala="rota"` | até a condição mudar | `ruim` | quem usa |
| "Sua conta ainda não tem acesso a nada aqui. Fale com quem administra o app." | `TelaDeErro escala="rota"` (sem permissão) | até mudar | `alheio` | quem usa |

## Regiões e componentes
| região | peças | arquivo |
|---|---|---|
| Moldura | `CascoDoApp` (bloco). Raiz `flex h-screen overflow-hidden bg-background`; coluna `flex min-w-0 flex-1 flex-col`; `main` `relative z-10 min-h-0 flex-1 overflow-y-auto` (só reserva: rola quando a janela fica mais baixa que o mínimo). Monta `ToastProvider`, `TooltipProvider` e `ProvedorDeLink` | bloco `casco` |
| Barra lateral | `BarraLateral` (bloco): `aside` `bg-card superficie` sem raio, `data-superficie`, `py-6 px-3`, `gap-6`. Topo: `Logotipo variante="simbolo"` 24 + nome do app `t-titulo`. Destinos: `ItemDaNavegacao` (h-10, ícone `size-4.5`, `gap-3`, `rounded-ctrl`; ativo `bg-primary/10 text-foreground font-semibold`; resto `text-foreground-2 hover:bg-accent`) + `ChipDeEstado tom="espera"` para a contagem; recolhida, `Estado soPonto` + `Ajuda lado="right"` (CTRL-08). Pé (`mt-auto`): recolher (`ItemDaNavegacao` como botão), `MenuDoTema`, `MenuDaConta` | `casco`, `logotipo`*, `chip-de-estado`*, `estado`*, `tooltip`, `menu-do-tema`*, `menu-da-conta`* |
| Cabeçalho | `CabecalhoDoApp` (bloco), encaixes `contexto`, `busca`, `conexao`. O exemplo põe em `contexto` um `Menu` com `GrupoDeEscolhaDoMenu` (gatilho `Button variant="ghost"` "Organização Exemplo" + `ChevronsUpDownIcon`) | `casco`, `menu`, `button` |
| Topo da página | `PaginaDoApp` + `TopoDaPagina` (`trilha`, `titulo`, `estado`, `secundarias`, `primario`, `menu`, `filtros`, `desfecho`) | `topo-da-pagina`*, `trilha`*, `button`, `menu` |
| Conteúdo | o arquétipo, sempre em superfície (`Painel`, `Bloco`, `Card`) | por bloco |

`*` = peça nova, ver *Peças novas para o kit*. A navegação recebe `caminhoAtual: string` e `destinos` prontos do servidor: nada de `usePathname` dentro da peça, para servir a Next e Vite.

**Como a barra lateral recolhe:**

- **Gesto.** O botão "Recolher menu" / "Expandir menu" (`PanelLeftClose`/`PanelLeftOpen`). Só no gesto a largura anima (LAY-01); troca de tela e F5 mudam de uma vez. A preferência fica num cookie `wicomm-casco=recolhida`, que o layout do servidor lê e passa em `recolhidaInicial`: sem divergência na hidratação e sem o pulo de 160 px no F5. Sem servidor (Vite), lê o `localStorage` depois da hidratação, como a LAY-01 já manda (emenda E4).
- **Tela < 768 px.** Começa recolhida. Expandir abre a barra como **sobreposição** (camada de gaveta, `z-40`, `superficie-flutuante`) sobre o conteúdo, sem empurrá-lo. Fecha ao escolher destino, com Esc ou ao clicar fora. Não grava preferência.
- **Telas densas.** O app declara a lista de rotas densas no mesmo arquivo que declara os destinos (`navegacao.ts`; CONV-15: uma fonte só). O layout passa `recolherNestaTela`. A pessoa pode expandir enquanto está ali; isso não grava preferência e vale até sair da tela.
- **O que a barra recolhida mostra:**
  - o símbolo;
  - os ícones dos destinos, cada um com a dica do rótulo à direita;
  - o ponto `espera` sobre o ícone que tem contagem;
  - recolher, tema (ícone do tema atual) e conta (monograma de 20 px), todos com dica.
  - Nada de rótulo de grupo: os grupos se separam só pelo ar.

## Estados
| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| Barra lateral | não existe: os destinos chegam do servidor junto com o HTML | sem destino nenhum, o casco não monta → `TelaDeErro` de rota (sem permissão) | n/a (não dispara trabalho) | a navegação não montou → `TelaDeErro escala="rota"` com *Tentar de novo*. Nunca barra vazia em silêncio | n/a | n/a | destino que a pessoa não alcança **não é desenhado** (PESO-03) |
| Cabeçalho | o contexto chega do servidor; não tem espera | sem contexto para trocar → o cabeçalho não monta | troca de contexto navega (`router.push`), e a tela nova mostra o próprio carregando | falha ao listar contextos → o submenu mostra o erro dele (`SubmenuDoMenu erro`) | n/a | o contexto novo aparece no gatilho | contexto sem acesso não aparece na lista |
| Topo | título vem da rota (nunca vazio); estado vira `Skeleton h-5 w-20 rounded-md`; o primário só aparece quando a regra que o libera responde | n/a | primário em trabalho: rótulo no gerúndio ("Concluindo"), desabilitado, sem clique duplo; o estado vem do servidor (EST-03, CONV-07) | desfecho `ruim` na linha do desfecho, com a saída | desfecho `ruim` com o motivo nas palavras de quem usa e a saída (MSG-06) | desfecho `ok` até a próxima ação | gesto não liberado não é desenhado |
| Conteúdo | do arquétipo | do arquétipo | do arquétipo | do arquétipo | do arquétipo | do arquétipo | rota proibida → `TelaDeErro escala="rota"` (`sem-permissao`) com a saída para o início |

## Movimento
- **Largura da barra:** `transition-[width] duration-painel ease-abre motion-reduce:transition-none`, ligado só durante o gesto. Desliga no `transitionend` ou por prazo = token + folga (a referência prende o número ao token por teste; manter).
- **Sobreposição < 768 px:** entra em `duration-painel ease-abre` (MOVA-01, coluna lateral) e sai sem animação (MOV-03).
- **Dica da barra recolhida:** `duration-dica`. **Menus do tema, da conta e do contexto:** `duration-menu-abre ease-abre`, como a peça já faz.
- **Item ativo e hover:** só a cor muda (`transition-colors duration-cor`).
- **Movimento reduzido:** tudo muda de uma vez.

## O que sai
- O botão de ação primária dentro da barra lateral (é ação de tela).
- O filete entre grupos de destinos.
- "Configuração da conta" como destino: vira item do menu da conta.
- O logotipo repetido no cabeçalho.
- Medidores, chips de serviço e qualquer chip de quem opera no cabeçalho.
- Tema e conta no cabeçalho (moram no pé da barra, CASCO-01).
- A largura animando na troca de tela e no F5.

## Decisões ao operador
D1 (Editor fora do casco), D2 (o topo não rola), D4 (cookie da barra) e D5 (logotipo). As quatro estão em *Decisões ao operador*, no fim.

---

# Revisão de arquitetura: Lista

## Tarefa
Quem opera **escolhe o próximo pedido que pede a sua atenção** e o abre (ARQ-01: *o que pede a minha atenção?*).

## Quem e onde
- **Quem e frequência:** quem opera, várias vezes por hora.
- **Largura:** 1280 × 800, com a barra expandida e o cabeçalho.
- **Densidade:** instrumento. **Arquétipo:** Lista; o quadro fica fora (ver *O que sai*).

## Inventário
| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| `h1` "Pedidos" | topo | onde estou | sempre | **fica** |
| Primário "Novo pedido" (`lg`) | topo, à direita | criar um pedido (leva ao Formulário) | algumas vezes por dia | **fica**; sem permissão de criar, não é desenhado |
| Modos com contagem: "Pedem você 3 · Com outros 2 · Andando 5 · Concluídos 0" | topo, linha de filtros | por qual fila começo | toda visita | **fica**. Todos os contadores, inclusive o 0 (EST-04); o padrão é "Pedem você"; o modo vai no URL por `replaceState` (CONV-06) |
| Busca "Buscar por número ou cliente" | topo, linha de filtros, à direita, `w-64` | achar um pedido conhecido | diário | **fica** (`Input` com `aria-label`; não grava, então não pede `<label>` visível) |
| Coluna Pedido (número `t-medida` + cliente `t-denso`) | tabela | qual é | sempre | **fica**; o número é o link da linha inteira |
| Coluna Situação (`ChipDeEstado`) | tabela | o que pede de mim | sempre | **fica** |
| Coluna Etapa (texto `t-denso`) | tabela | que tipo de trabalho é (agrupar o parecido) | sempre | **fica**, sem cor de etapa (ver `PontoDaEtapa` em *Peças*) |
| Coluna Valor (`t-medida`, à direita) | tabela | prioridade por valor | frequente | **fica** (TIPO-03) |
| Coluna Atualizado ("há 2 h") | tabela | urgência pela idade | frequente | **fica** |
| `⋯` por linha | — | ações raras moram na Mesa | — | **sai** |
| Caixa de seleção em lote | — | nenhuma tarefa em lote no exemplo | — | **sai** |
| Ordenação escolhível | — | a ordem fixa é por urgência (situação, depois idade) | — | **sai** |
| Paginação | — | 20 linhas no exemplo; rola dentro do painel | — | **sai** do exemplo; o projeto que passar de algumas centenas põe "Mostrar mais" no fim da lista |
| Total geral "128 pedidos" | — | nenhuma além das contagens por modo | — | **sai** |

## Hierarquia e peso
- **Primário:** "Novo pedido" (`lg`). A ação real da tela, porém, é **abrir a linha**: a linha inteira é alvo (h-10).
- **Secundárias:** os modos e a busca. **Terciárias:** nenhuma.
- **Pesos a 1280:**

| região | medida |
|---|---|
| Topo | 24 + 36 + 12 + 30 = 102 px |
| Painel da lista | ≈ 1008 × 600 px: cabeça 32 + linhas de 40 ≈ **14 linhas sem rolar** (16 sem o cabeçalho do app) |
| Colunas | Pedido ≈ 32 % · Situação 16 % · Etapa 16 % · Valor 14 % · Atualizado 14 % · respiro |

- **Ordem do olho:** os modos com número → a situação da primeira linha → o número do pedido.

## Mensagens
| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "Nada pede você agora. 2 pedidos estão com outras pessoas." + "Ver os que estão com outros" (troca o modo; é a mesma ação do modo, MSG-06) | `Vazio causa="filtro"` no painel | enquanto vale | `neutro` (nunca ✓, EST-02) | quem usa |
| "Nenhum pedido com “1099”." + "Limpar a busca" | `Vazio causa="filtro"` | enquanto vale | `neutro` | quem usa |
| "Nenhum pedido ainda. Os pedidos aparecem aqui assim que chegarem." (sem botão: o primário do topo já é a saída) | `Vazio causa="nada-ainda"` | enquanto vale | `neutro` | quem usa |
| "Não deu para carregar os pedidos." + *Tentar de novo* | `TelaDeErro escala="bloco"` no painel | até tentar de novo | `ruim` | quem usa |
| "Pedido 1043 criado" (ao voltar do Formulário) | `useToast` | some sozinho | `ok` | quem usa |
| "Processando" numa linha | `ChipDeEstado tom="neutro" emCurso` | enquanto anda | `neutro` (COR-04) | quem usa |

## Regiões e componentes
| região | peças |
|---|---|
| Topo | `TopoDaPagina` com `titulo`, `primario={<Button size="lg">}` e `filtros`. A linha dos filtros traz `BarraDeModos densidade="abas"` (`seletor-de-vista`*), com `numero` em cada modo, e o `Input` à direita (`ml-auto w-64`) |
| Lista | `Painel` → `RolagemDoPainel` → `Table`* com `TableHeader` grudado (`sticky top-0 bg-card`, `t-coluna`), `TableRow href` (a linha inteira abre; h-10; `hover:bg-accent`; **sem filete entre linhas**, SUP-03) e `TableCell` (`t-denso`; `medida` → `t-medida text-right`) |
| Situação | `ChipDeEstado`*. O tom vem de um mapa `Record<Situacao, Tom>` no `dados.ts` do exemplo, nunca do componente |
| Vazio | `Vazio`* dentro do mesmo `Painel`, centrado, `max-w-medida` |
| Erro | `TelaDeErro escala="bloco"`* dentro do `Painel` |
| Carregando | `EsperaDaLista linhas={8} alturaDaLinha="h-10" rotulo="Carregando os pedidos"` sob a cabeça da tabela, que já aparece |

## Estados
| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| Topo | título e primário de pé; os modos mostram `—` em `neutro` no lugar do número (EST-04: não contado) | os modos com os números reais, inclusive 0 | n/a | modos com `—`; o primário continua | n/a (a Lista não grava) | toast de quem voltou do Formulário | sem criar → sem primário |
| Lista | cabeça da tabela + `EsperaDaLista` | três causas, três frases: `nada-ainda`, `filtro` (modo ou busca), e a que não carregou, que é o erro | linha com `ChipDeEstado emCurso` "Processando" | `TelaDeErro escala="bloco"` | n/a | n/a | a rota proibida → `TelaDeErro` de rota; linha que a pessoa não pode abrir não é listada |

`?estado=` do exemplo: `carregando`, `vazio`, `vazio-filtro`, `vazio-busca`, `erro`, `sem-permissao`, e o padrão `pronto` com uma linha "Processando".

## Movimento
- A pílula do `BarraDeModos` desliza em `duration-revela ease-abre` (CTRL-06 manda deslizar, mas não dá o token: *assumida*). Com movimento reduzido, salta.
- Hover de linha: `transition-colors duration-cor`.
- `EsperaDaLista` pulsa e fica parada com movimento reduzido. Nada mais se move.

## O que sai
- O quadro (colunas por etapa): pede peça de colunas que nenhum bloco usa. Fica para o projeto que precisar, e entra como peça antes de entrar na tela.
- O `⋯` por linha, a seleção em lote, a ordenação escolhível, a paginação e o total geral.
- A cor de etapa na coluna Etapa.

## Decisões ao operador
Nenhuma própria. A Tabela e o Vazio fora da PECA-01 entram pela emenda E5.

---

# Revisão de arquitetura: Mesa

## Tarefa
Quem opera **vê em que etapa o pedido está e dá o passo que a etapa pede** (ARQ-01: *em que pé está isto, e o que eu faço agora?*).

## Quem e onde
- **Quem e frequência:** quem opera, várias vezes por hora, vindo da Lista.
- **Largura:** 1280 × 800, com a barra expandida e o cabeçalho.
- **Densidade:** instrumento. **Arquétipo:** Mesa. O padrão vem com trilho e primário; a variante de leitura traz abas e nenhum primário.

## Inventário
| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Trilha "Pedidos › Pedido 1042" | topo | voltar à lista | sempre | **fica** (CASCO-03) |
| `h1` "Pedido 1042" | topo | qual objeto | sempre | **fica** (o título vem da rota; nunca vazio) |
| Estado "Aguarda você" | topo, `ChipDeEstado tom="espera"` | se é a minha vez | sempre | **fica** |
| Primário "Concluir conferência" (`lg`) | topo | avançar a etapa | uma vez por pedido | **fica** só quando a regra o libera (PESO-03); com item por conferir, não é desenhado, e a ação está na linha do item |
| `⋯` do pedido: "Duplicar pedido", "Cancelar pedido" (destrutivo, com confirmação) | topo | ações raras | raro | **sob demanda** (PRIN-03, PESO-02) |
| Desfecho do primário | topo, linha do desfecho | deu certo? o que faço se não deu | após o gesto | **fica** até a próxima ação |
| Trilho: Recebido · Conferência · Pagamento · Envio · Entregue, cada estação com a situação | coluna esquerda | onde está e o que já foi; abrir uma etapa passada para ler | sempre | **fica**. A estação aberta vai no URL (`?etapa=`, `replaceState`) |
| Tempo na etapa atual | — | nenhuma no exemplo | — | **sai** |
| Bloco "Itens" (tabela: Item · Quantidade `t-medida` · Situação `Estado`) | conteúdo | o que falta conferir | sempre | **fica**. Contagem do bloco "2 de 3 conferidos" (`Secao contagem`/`Bloco legenda`) |
| "Conferir" por item (`Button size="sm" variant="secondary"`) | linha do item | conferir este item | frequente | **fica** só nos itens por conferir |
| "Registrar divergência" | `⋯` da linha do item | rara | raro | **sob demanda** |
| Bloco "Dados do pedido" (Ficha: Cliente, Criado em, Valor total `mono`, Entrega) | conteúdo, abaixo de Itens | com quem falar e que valor está em jogo se algo divergir | às vezes | **fica**, recolhível com `resumo` "Ana Souza · R$ 1.240,00", fechado por padrão |
| Apoio à direita | — | a ARQ-01 cita e não define | — | **sai** do bloco (emenda E6) |

## Hierarquia e peso
- **Primário:** "Concluir conferência" (`lg`, no topo).
- **Primário do bloco Itens:** nenhum preenchido. "Conferir" é `secondary sm`, por linha (PESO-01: o primário da tela já existe).
- **Terciárias:** os `⋯`.
- **Pesos a 1280:**

| região | medida |
|---|---|
| Topo | 24 + 16 + 6 + 36 = 82 px |
| Trilho | `Painel` `w-60` = 240 px = **18,75 %** (PESO-04 ≤ 25 %), `h-fit self-start`: `TopoDoPainel` "Percurso" + 5 × 40 px ≈ 260 px |
| Conteúdo da etapa | ≈ 744 px de largura (1008 − 240 − `gap-6`), coluna que rola (≈ 620 px de altura); Itens cabe inteiro sem rolar com até ~8 itens |

- **Ordem do olho:** `h1` + estado → estação atual no trilho → primário → itens.

## Mensagens
| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "Conferência concluída." | desfecho do topo | até a próxima ação | `ok` | quem usa |
| "Não deu para concluir: o pedido foi cancelado por outra pessoa." + "Ver o pedido atualizado" | desfecho do topo | até a próxima ação | `ruim` | quem usa |
| "Cancelar o pedido 1042? Isso não se desfaz." | `useConfirm` destrutivo, a partir do `⋯` | até responder | — | quem usa |
| "Pedido cancelado" | `useToast` (o gesto veio de um menu que fechou e a tela volta à Lista) | some sozinho | `ok` | quem usa |
| "Não deu para marcar este item. Tente de novo." | no bloco Itens, na linha do item (MSG-04) | até a próxima ação | `ruim` | quem usa |
| "Este pedido não tem itens para conferir." | `Vazio causa="nao-se-aplica"` no bloco Itens | enquanto vale | `neutro` | quem usa |
| "Para mudar este pedido, abra a conferência." (variante de leitura) | linha com link, abaixo do topo (ARQ-01) | enquanto vale | `neutro` | quem usa |

## Regiões e componentes
| região | peças |
|---|---|
| Topo | `TopoDaPagina` com `trilha`, `titulo`, `estado={<ChipDeEstado>}`, `primario`, `menu={<Menu>…}` (gatilho `Button variant="ghost" size="icon"` `MoreHorizontalIcon`, `aria-label="Mais ações do pedido"`) e `desfecho` |
| Trilho | `TrilhoDoPercurso`* (`TopoDoPainel` + `EstacaoDoTrilho` com `Estado`* por situação: feito `ok`, atual `espera`, à frente `neutro`). A estação aberta tem `aria-current="step"` e o fundo `bg-primary/10` do item ativo |
| Conteúdo da etapa | coluna `RolagemDoPainel densidade="solta"` (LAY-06; a peça ganha a prop, ver *Peças*) com dois `Bloco`. "Itens" leva `Table`* + `Estado`* + `Button sm secondary` + `Menu` por linha. "Dados do pedido" é `recolhivel` com `resumo` e leva `Ficha`/`ParDaFicha`* |
| Variante com abas | `BarraDeModos densidade="abas"`* entre o topo e o conteúdo, no lugar do trilho; sem coluna à esquerda e sem apoio |

## Estados
| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| Topo | `h1` da rota; estado em `Skeleton`; sem primário até a regra responder | n/a | "Concluindo" no botão, desabilitado; o estado vem do servidor e sobrevive ao F5 | desfecho `ruim` com *Tentar de novo* (a mesma ação, MSG-06) | desfecho `ruim` com o motivo e a saída | desfecho `ok`; o trilho avança; o primário passa a ser o gesto da etapa nova, ou some | sem o gesto → sem primário; rota proibida → `TelaDeErro` de rota |
| Trilho | `EsperaDaLista linhas={5} alturaDaLinha="h-10"` no painel | n/a (todo pedido tem percurso) | a estação atual mostra `Estado neutro` "em curso" enquanto o servidor conclui | `TelaDeErro escala="bloco"` no painel | n/a | a estação seguinte vira a atual | n/a |
| Conteúdo | `Skeleton` com a forma dos dois blocos (nome + cartão); **na variante de abas, o esqueleto desenha abas**, não a coluna do trilho (ARQ-01) | `Vazio causa="nao-se-aplica"` em Itens | "Conferindo" no botão da linha; `Estado neutro` "conferindo" na linha | `TelaDeErro escala="bloco"` no bloco que falhou; o resto de pé | erro na linha do item | a linha vira `Estado ok` "Conferido" e o botão some | item que a pessoa não pode conferir: sem botão |

`?estado=`: `carregando`, `carregando-abas`, `a-conferir` (sem primário no topo), `pronto` (padrão: tudo conferido, primário à vista), `andando`, `erro`, `recusa`, `sucesso`, `leitura` (abas, sem primário), `sem-permissao`.

## Movimento
- O "Dados do pedido" recolhível abre com `duration-dobra-abre`, e só a entrada anima (a peça `Bloco` já faz).
- A troca de estação no trilho troca o conteúdo **sem animar**; a coluna volta ao topo.
- A pílula das abas: igual à da Lista.
- O `useConfirm` entra com `duration-modal-abre`. Movimento reduzido: tudo seco.

## O que sai
- O apoio à direita, o tempo na etapa e a cor de identidade de cada etapa.
- "Registrar divergência" como botão à vista (vai ao `⋯`).
- Um segundo lugar para "Concluir" dentro do bloco.

## Decisões ao operador
D2 (o topo não rola) e E6 (o apoio à direita).

---

# Revisão de arquitetura: Editor

## Tarefa
Quem edita **muda uma seção de um documento e vê como fica** antes de publicar (ARQ-01: *como fica se eu mudar isto?*).

## Quem e onde
- **Quem e frequência:** quem edita, em sessões de dezenas de minutos.
- **Largura:** 1280 × 800, o pior caso (ARQ-03).
- **Densidade:** instrumento.
- **Arquétipo:** Editor, **fora do casco**, em tela inteira (D1).

## Inventário
| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Voltar ("Voltar aos documentos", ícone + dica) | barra, à esquerda | sair do editor para a lista de onde veio | uma vez por sessão | **fica**; cumpre a trilha (emenda E2) |
| Nome do documento (`h1`, `t-titulo`) | barra, à esquerda | onde estou | sempre | **fica** (emenda E3) |
| Chip do rascunho ("Salvo" / "2 mudanças" / "Publicando" / "1 pendência") | barra, à esquerda | se há o que publicar e se algo impede | sempre | **fica** (`ChipDeEstado`; `ChipQueAbre` quando há pendência) |
| Desfazer / refazer | barra, à esquerda | voltar um passo | frequente | **fica** (`Button size="icon" variant="ghost"` + `Ajuda`) |
| Vista "Computador · Celular" | barra, centro | conferir como fica em cada tela | frequente | **fica** (`BarraDeModos densidade="modos"`) |
| Zoom | — | — | — | **sai** do exemplo (pede seletor que não muda a anatomia) |
| Primário "Publicar" (`default`, 30 px: fora do casco o `lg` não se aplica) | barra, à direita | pôr no ar | uma vez por sessão | **fica** |
| `⋯` do documento: "Duplicar documento", "Ver histórico" (abre `DialogLateral`), "Excluir documento" (destrutivo, com confirmação) | barra, à direita | raras | raro | **sob demanda** |
| Tema + conta | barra, fim à direita (`GrupoDaPessoa`) | os mesmos do pé da barra lateral | raro | **fica** (a barra substitui o casco) |
| Conversa com IA | — | — | — | **sai** do bloco (pede `IconeDaIa`, `ContornoDaIa` e a bolha; fica para o item da IA). A coluna da direita deixa o modo previsto no tipo |
| Estrutura: as seções em ordem (Capa · Introdução · Itens · Assinatura), "Adicionar seção" | coluna esquerda | o que existe, em que ordem, e qual editar | frequente | **fica** |
| Reordenar | `⋯` da linha da estrutura: "Mover para cima" / "Mover para baixo" | mudar a ordem | às vezes | **sob demanda**; a alça de arrasto da ARQ-04 só entra com dependência de arrasto, que o exemplo não traz |
| Situação da seção (alterada, com pendência) | linha da estrutura, `Estado soPonto` + `sr-only` | onde está o que falta | enquanto vale | **fica** (MSG-01 "no item") |
| Canvas: a página do documento, seção selecionada em `superficie-alta` (SUP-01: altura de seleção; o anel é só de foco) | centro | ver o efeito | sempre | **fica** |
| Barra flutuante do item no canvas | — | as ações do item já estão no `⋯` da linha e no topo do inspector | — | **sai** do exemplo (ver *O que sai*) |
| Inspector: `TopoDoPainel` com o nome da seção + `⋯` (Duplicar seção, Excluir seção); Dobra "Conteúdo" aberta (Título, Subtítulo); Dobra "Aparência" fechada (Alinhamento `Select`, Fundo `Select`) | coluna direita | mudar o item | sempre | **fica** |
| Histórico, publicação detalhada | — | não são a tarefa | raro | **outra tela / gaveta** (`DialogLateral` pelo `⋯`) |

## Hierarquia e peso
- **Primário:** "Publicar".
- **Secundárias:** desfazer/refazer e a vista.
- **Terciárias:** os `⋯`, o tema e a conta.
- **Barra** (`BarraDoEditor`): `h-11` (44 px), uma linha, grade `1fr | auto | 1fr`, sem `flex-wrap`. A moldura da tela tem `p-2`, e as colunas ficam a `gap-2`.
- **Larguras a 1280** (ARQ-03, medidas):

| situação | estrutura | canvas | inspector |
|---|---|---|---|
| Nada selecionado | 288 px (`w-72`) aberta | 1280 − 16 − 288 − 8 = **968 px = 76 %** | fechado |
| Seção selecionada (padrão do exemplo) | trilho de ícones 48 px (`w-12`) | 1280 − 16 − 48 − 340 − 16 = **860 px = 67 %** | 340 px (`w-85`) |
| Estrutura + inspector abertos | 288 | 620 px = 48 % → **proibido**; a estrutura recolhe sozinha | 340 |

  A regra é a medida (canvas ≥ 60 %), não um ponto fixo. A estrutura aberta só cabe com o inspector a partir de ~1650 px. Reabrir a estrutura quando ela não cabe faz o inspector dar lugar (vira o trilho dele), e vice-versa.
- **Abaixo de 1280,** a coluna da direita vira `DialogLateral`.
- **Ordem do olho:** canvas → chip do rascunho → Publicar.

## Mensagens
| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "2 mudanças" / "Salvo" | chip da barra | enquanto vale | `neutro` / `ok` | quem usa |
| "Publicando" | no botão (gerúndio, desabilitado) e no chip, com `emCurso` | enquanto anda; sobrevive ao F5 | `neutro` | quem usa |
| "Publicado" | chip da barra | até a próxima mudança | `ok` | quem usa |
| "Não publicou", com a dica "Não deu para publicar agora; tente em alguns minutos." | chip da barra; o "Publicar" continua sendo a saída (MSG-06) | até a próxima tentativa | `ruim` | quem usa |
| "1 pendência" → o clique seleciona a seção e põe o foco no campo | `ChipQueAbre` da barra | enquanto vale | `espera` | quem usa |
| "Escreva o título da capa." | no campo do inspector (`aria-describedby`, `aria-invalid`) | enquanto vale | `ruim` | quem usa |
| "Excluir a seção Itens?" / "Excluir o documento?" | `useConfirm` destrutivo | até responder | — | quem usa |
| "Escolha uma seção na estrutura ou na página para editar." | `Vazio` no inspector | enquanto nada está selecionado | `neutro` | quem usa |
| Faixa abaixo da barra | — | o exemplo não tem condição em que a tela inteira mente | — | **nenhuma** (MSG-01: só nesse caso) |

## Regiões e componentes
| região | peças |
|---|---|
| Moldura | `CascoDoEditor` (bloco): `h-screen overflow-hidden flex flex-col gap-2 p-2 bg-background`, com `ToastProvider`, `TooltipProvider` e `ProvedorDeLink` |
| Barra | `BarraDoEditor`* com os encaixes: `ondeEstou` (voltar, `h1`, `ChipDeEstado`/`ChipQueAbre`*, `GrupoDaBarra`* desfazer/refazer), `vista` (`BarraDeModos densidade="modos"`*) e `acoes` (`Button` "Publicar", `Menu`, `GrupoDaPessoa`* = `MenuDoTema`* + `MenuDaConta`*) |
| Colunas | `ColunasDoEditor`*: estrutura, trilho, canvas, direita; regra dos 60 %; gaveta abaixo de 1280 |
| Estrutura | `Painel` + `TopoDoPainel titulo="Estrutura"` (ação: `Button size="sm" variant="ghost"` "Adicionar seção") + `RolagemDoPainel densidade="compacta"` com linhas (`ItemDaEstrutura`, que é parte de `colunas-do-editor`*: botão de selecionar com ícone + nome e o `⋯` no fim, ARQ-04) + `Estado soPonto`* |
| Canvas | `bg-muted rounded-2xl` (degrau) com a página do exemplo num `Card`; a seção selecionada em `superficie-alta`. A troca de item **rola até ele**, sem animar |
| Inspector | `Painel` + `TopoDoPainel` (nome da seção + `Menu`) + `RolagemDoPainel densidade="compacta"` + `Dobra`* × 2 + `Label`/`Input`/`Select` |

## Estados
| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| Barra | `h1` da rota; chip em `Skeleton`; "Publicar" só depois da regra responder | chip "Sem mudanças" `neutro`; "Publicar" bloqueado de vista vira item com motivo no `⋯`? Não: sem mudanças, "Publicar" **não é desenhado** (PESO-03) | "Publicando" (botão + chip `emCurso`) | chip "Não publicou" `ruim` com a dica; "Publicar" de volta | chip `ChipQueAbre` "1 pendência" `espera` | chip "Publicado" `ok` | sem publicar → sem botão; sem editar → `TelaDeErro` de rota com a saída "Voltar aos documentos" |
| Estrutura | `EsperaDaLista linhas={4} alturaDaLinha="h-8"` | `Vazio causa="nada-ainda"` "Nenhuma seção ainda." + "Adicionar seção" (a mesma ação do topo do painel, MSG-06) | linha da seção movida: o efeito entra na hora e a recusa desfaz (CONV-08) | `TelaDeErro escala="bloco"` | a seção com pendência leva `Estado soPonto tom="espera"` | — | sem editar a ordem → sem os itens de mover no `⋯` |
| Canvas | `Skeleton` da página | página em ausência: caixa tracejada (FORMA-02) "A página aparece aqui quando houver uma seção." | a seção que muda se redesenha; nada por cima do canvas | `TelaDeErro escala="bloco"` no lugar da página | — | — | — |
| Inspector | `Skeleton` de 3 campos | `Vazio` "Escolha uma seção…" | o campo grava em segundo plano; o chip diz "2 mudanças" | erro do campo, no campo | o campo recusado com a mensagem nele | — | campo que a pessoa não pode mudar: `ComMotivo` na linha |

`?estado=`: `carregando`, `vazio`, `nada-selecionado` (estrutura aberta), `pronto` (padrão, seção selecionada), `andando`, `erro`, `recusa`, `sucesso`, `sem-permissao`.

## Movimento
- A estrutura recolhe e expande e a gaveta da direita (< 1280) entra em `duration-painel ease-abre` (MOVA-01).
- As Dobras: `duration-dobra-abre`. Os menus: `duration-menu-abre`. Os diálogos: `duration-modal-abre`.
- O canvas não anima ao trocar de item: rola até ele (`behavior: "smooth"`, `"auto"` com movimento reduzido).
- O spinner do chip `emCurso` para com movimento reduzido; a palavra "Publicando" segura o sentido.

## O que sai
- O zoom, a conversa com IA, a barra flutuante do item no canvas, a alça de arrasto e a faixa abaixo da barra.
- A barra lateral e o cabeçalho do casco (D1).
- O histórico à vista (vai à gaveta).

## Decisões ao operador
D1 (Editor fora do casco + E1, E2, E3) e D7 (a barra flutuante do canvas).

---

# Revisão de arquitetura: Entrada

## Tarefa
Quem chega **entra no app num passo só** (ARQ-01: *qual é o único passo?*).

## Quem e onde
- **Quem e frequência:** qualquer pessoa, inclusive o cliente, uma vez por sessão ou menos.
- **Largura:** 1280 é o pior caso medido; o cartão serve igual a 375 px.
- **Densidade:** fora do ritmo do app. O campo usa `voz="campo"` (DENS-02) mesmo num app instrumento: a Entrada é vista por quem não opera o dia todo (*assumida*).
- **Arquétipo:** Entrada, fora do casco.

## Inventário
| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Logotipo Wicomm (horizontal) | cartão, topo | "é o app da Wicomm" | sempre | **fica** |
| `h1` "Entrar" (`t-display`) | cartão | o passo | sempre | **fica** |
| E-mail, senha (`Input tamanho="xl"`, `Label voz="campo"`, `autocomplete`) | cartão | o dado do passo | sempre | **fica** |
| "Esqueci a senha" (`Button variant="link"`) | abaixo da senha, à direita | sair para a outra Entrada | raro | **fica** |
| "Entrar" (`Button size="xl"`, largura do cartão) | fim do cartão | concluir | sempre | **fica** (CTRL-02) |
| Rodapé com versão, termos, idioma | — | nenhuma | — | **sai** |
| Imagem ou ilustração de fundo | — | nenhuma | — | **sai** (chão liso) |

## Hierarquia e peso
- **Primário:** "Entrar" `xl` (44 px). **Secundária:** o link "Esqueci a senha".
- **Cartão:** `Card` `w-full max-w-sm` (384 px = 30 % de 1280), `p-6`, `gap-6` entre os grupos (logotipo+título · campos · ação) e `gap-3` dentro de cada um. Fica centrado nos dois eixos sobre `bg-background`.
- **Altura:** ≈ 24 + 24 + 24 + 28 + 24 + (2 × (18 + 6 + 40) + 12) + 24 + 44 + 24 ≈ 380 px. Cabe a partir de ~420 px de janela.

## Mensagens
| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "Escreva um e-mail completo." | no campo | enquanto vale | `ruim` | quem usa |
| "E-mail ou senha não conferem." | no bloco: linha acima do "Entrar" (MSG-04), com o foco no primeiro campo (CONV-09) | até a próxima tentativa | `ruim` | quem usa |
| "Esta conta não tem acesso a este app. Fale com quem administra." | no bloco | até mudar | `alheio` | quem usa |
| "Não deu para entrar agora. Tente em alguns minutos." | no bloco | até a próxima tentativa | `ruim` | quem usa (nunca o erro cru, MSG-03) |

## Regiões e componentes
`CascoDaEntrada` (bloco: `min-h-screen grid place-items-center bg-background p-6`) com:

- `Card`;
- `Logotipo variante="horizontal"`*;
- `Label`, `Input`;
- `Button` `xl` e `link`;
- o desfecho em texto com `COR_DO_TOM_DENSO`.

Nenhuma peça nova além do `logotipo`. Entra na lista da guarda `a-tela-de-entrada-tem-o-botao-grande`.

## Estados
| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| Cartão | n/a (estático) | n/a | "Entrando", desabilitado, campos `readOnly` | desfecho `ruim` no bloco | desfecho `alheio` no bloco | navega ao início do app (sem toast) | = recusa |

`?estado=`: `pronto`, `andando`, `erro-campo`, `erro`, `recusa`.

## Movimento
Nenhum, além da cor dos controles (`duration-cor`) e do foco.

## O que sai
O rodapé, a imagem de fundo, "Lembrar de mim" e o login social (o exemplo não precisa deles para provar a anatomia).

## Decisões ao operador
D5 (o arquivo do logotipo).

---

# Peças novas para o kit

Todas entram como `registry:ui` (PECA-02: partem do shadcn quando existe), com teste dom e vitrine no ateliê. Ao portar da referência, todo valor solto dela vira token: `text-[11.5px]`, `gap-[7px]`, `rounded-[9px]`, `text-[12.5px]`, `h-[30px]`.

**Os blocos PRECISAM:**

| peça | usada em | o mínimo |
|---|---|---|
| `chip-de-estado` | casco, Lista, Mesa, Editor | `ChipDeEstado { tom: Tom; emCurso?: boolean; children }`: casco da CTRL-05 + `BADGE_DO_TOM`; `emCurso` põe `LoaderCircleIcon size-3 animate-spin motion-reduce:animate-none`. `ChipQueAbre { tom; onAbrir; aberto?; children }`: `<button>` com o mesmo casco, hover um degrau de tinta, foco SUP-06 e `aria-expanded` quando abre algo |
| `estado` | casco (ponto no ícone), Mesa, Editor | `Estado { tom; soPonto?; children? }`, só a forma `ponto` (6 px, `PONTO_DO_TOM`, palavra em `COR_DO_TOM_DENSO`). `play` fica para quando houver IA |
| `trilha` | Mesa (e toda tela de detalhe) | `Trilha { degraus: { rotulo: string; href?: string }[] }`: `nav aria-label="Trilha"` + `ol`; `text-legenda text-muted-foreground`, `gap-1.5`; separador `ChevronRightIcon size-3` `aria-hidden` (isento, COR-13, escrevendo a condição); o último sem link e com `aria-current="page"`; o link pelo `ProvedorDeLink` |
| `topo-da-pagina` | casco, Lista, Mesa | `PaginaDoApp` (o contêiner da LAY-02) + `TopoDaPagina { trilha?; titulo: string; estado?; secundarias?; primario?; menu?; filtros?; desfecho?: { tom; texto; saida? } }`. É o único lugar que escreve o `h1` `t-display` |
| `seletor-de-vista` | Lista, Mesa (abas), Editor | `BarraDeModos<T> { rotulo; modos: { chave; rotulo; icone?; numero?; bloqueado? }[]; valor; onTrocar; densidade: "abas" \| "modos" }`, `role="tablist"`; o estado no texto (CTRL-06); `numero` em `t-medida`, com 0 em `neutro` |
| `table` | Lista, Mesa | o `table` do shadcn com `TableHeader` (grudado, `t-coluna`), `TableRow { href? }` (link esticado no primeiro `TableCell`, linha inteira clicável, h-10, `hover:bg-accent`, **sem filete**), `TableCell { medida? }` |
| `ficha` | Mesa | `Ficha` (`dl`, grade de 2 colunas: rótulo `t-coluna`, valor `t-denso`) + `ParDaFicha { rotulo; mono?; children }`; valor ausente = "não informado" em `neutro` (EST-02) |
| `trilho-do-percurso` (**fora da PECA-01**, E5) | Mesa | `TrilhoDoPercurso { rotulo; estacoes: { chave; nome; situacao: "feita" \| "atual" \| "a-frente" \| "falhou"; tom: Tom }[]; aberta; onAbrir }`: `nav` + `ol`, estação h-10 com `Estado` + nome; aberta = `bg-primary/10` + `aria-current="step"`; a estação à frente não abre (não é desenhada como botão) |
| `vazio` (**fora da PECA-01**, E5) | Lista, Mesa, Editor | `Vazio { causa: "nada-ainda" \| "filtro" \| "nao-se-aplica" \| "nao-informado"; icone; titulo; children; acao? }`: `MedalhaoDoIcone sm` neutro, `t-titulo`, frase `t-denso text-foreground-2`, `acao` em `outline sm`; `data-causa` para a guarda poder ler (EST-02); nunca `tom` (COR-10) |
| `medalhao-do-icone` | `vazio`, `tela-de-erro` | `MedalhaoDoIcone { icone; tamanho: "sm" \| "md"; tom?: Tom }`: `sm` `size-7` com ícone de 14, `md` `size-10` com ícone de 18, `rounded-full`, `TINTA_DO_TOM`, ícone em `COR_DO_TOM_DENSO`, `aria-hidden` |
| `tela-de-erro` | todos | `TelaDeErro { escala: "rota" \| "bloco"; tipo: "erro" \| "nao-encontrado" \| "sem-permissao"; titulo? (só na rota); children; saida? (só na rota); onTentarDeNovo? }`. Rota: medalhão `md` (`ruim` / `neutro` / `alheio`), `h1`. Bloco: sem título nem saída, *Tentar de novo* `outline sm`, `role="alert"`. Nunca tracejado |
| `dobra` | Editor | `Dobra { rotulo; abertaDeInicio?; nome?; children }`: botão com chevron e `aria-expanded`; entra com `duration-dobra-abre`, sai seca. Só informativo ou campos; nunca esconde ação (PRIN-03) |
| `barra-do-editor` | Editor | `BarraDoEditor { ondeEstou; vista?; acoes; rotulo? }` (`Card`, `h-11`, grade `minmax(0,1fr) auto minmax(0,1fr)`, sem quebra) + `GrupoDaBarra` (`gap-1`) + `GrupoDaPessoa { conta }` (tema + conta). O vão entre encaixes é escala (`gap-6`); o "48 px" especial da referência não vem |
| `colunas-do-editor` | Editor | `ColunasDoEditor { estrutura; trilho; canvas; direita; tituloDaEstrutura }` com as constantes 288 / 48 / 340 / `gap-2` / piso de 0,6 numa fonte só, e `estruturaCabe(largura, direita)` exportada para teste; abaixo de 1280, direita em `DialogLateral`; mais `ItemDaEstrutura` (selecionar + `⋯` no fim, ARQ-04). Sem redimensionar à mão nesta versão (*assumida*: o `Resizable` do shadcn entra se um projeto pedir) |
| `logotipo` | casco, Entrada, Editor (voltar não; só o casco e a Entrada) | `Logotipo { variante: "simbolo" \| "horizontal"; className? }`: SVG em linha; o símbolo em `fill-marca`, a palavra em `fill-foreground` (MARCA-02: a marca desenha, não escreve); `role="img" aria-label="Wicomm"`. Depende do arquivo oficial (D5) |
| `menu-do-tema` | casco, Editor | `MenuDoTema { comoItem?: boolean }`: `Menu` + `GrupoDeEscolhaDoMenu` (Claro · Escuro · Do sistema; a escolha já é a ação, PECA-01) + `useTema` (classe `.dark` no `<html>`, `localStorage` lido depois da hidratação, script anti-piscada no `<head>` do layout) |
| `menu-da-conta` | casco, Editor | `MenuDaConta { nome; email; hrefDaConta?; onSair; comoItem?: boolean }`: monograma (círculo de 20 px, CTRL-05) + nome; no menu, o e-mail no topo e os itens "Minha conta" e "Sair" |
| lib `link-do-app` | `trilha`, `table`, casco | `ProvedorDeLink { componente }` + `LinkDoApp`; padrão `<a>`, e o Next passa `next/link`. É o que mantém as peças valendo em Next e Vite |

**Mudança numa peça que existe:** `RolagemDoPainel` ganha `densidade?: "padrao" | "compacta" | "solta"` (`px-5 pb-6`, `px-4 pb-5`, `pb-6`). A LAY-06 já manda isso, e a peça de hoje não tem.

**Ficam de fora, com a região desenhada sem elas:**
- **`Badge`.** Nenhum valor rotulado nos exemplos; a contagem de destino é estado (`ChipDeEstado`).
- **`PontoDaEtapa`.** A cor de etapa é declarada por projeto (COR-09) e o `@wicomm/tokens` excluiu os tokens de etapa. No trilho, a posição e o nome já dizem "onde", e na Lista a etapa é texto.
- **`FaixaDoEditor`.** Nenhuma condição do exemplo faz a tela inteira mentir. `ColunasDoEditor` não reserva lugar à mão: quando entrar, a faixa vai entre a barra e as colunas.
- **`CarregandoPorCima`.** A troca de contexto do exemplo navega.
- **`Popover`.** O detalhe dos chips vai na dica (`Ajuda`) e no `ChipQueAbre`, que seleciona.

---

# Emendas à base propostas

Mudar regra que existe sobe a versão nos três arquivos da base (para 0.3.0). Cada regra mudada ganha uma linha em `docs/rastreio/origens-da-base.md`.

- **E1 · CASCO-01.**
  - Troca o *assumida* pela divisão decidida: cabeçalho = o que vale igual em todas as telas (contexto, busca global, conexão); topo = o que muda com a tela.
  - **"Os arquétipos Entrada e Editor ficam fora do casco; a barra do Editor (ARQ-03) leva a volta e a conta."**
  - "O topo da página não rola; rola a região do arquétipo."
- **E2 · CASCO-03.** "No Editor, o *voltar* e o *onde estou* da barra cumprem a trilha." A guarda `toda-tela-de-detalhe-tem-trilha` aceita a `BarraDoEditor` com o voltar.
- **E3 · TIPO-04.** "No Editor, o `h1` é o nome do objeto na barra, na voz `t-titulo`." 23 px numa barra de 44 px disputa o canvas (PRIN-02).
- **E4 · LAY-01.**
  - "Quem rola é a região do arquétipo, pela peça de rolagem do kit; o `<main>` rola só como reserva."
  - "O estado da barra é lido pelo servidor num cookie, ou depois da hidratação sem servidor."
  - "Abaixo de 768 px, a barra expandida é sobreposição na camada de gaveta."
- **E5 · PECA-01.** Linhas novas:
  - Percurso de um objeto → `TrilhoDoPercurso` (não use `Passos` nem `Progress`).
  - Região sem itens → `Vazio`, declarando a causa (não use ✓ nem cartão de voz).
  - Lista de objetos → `Table` sem filete entre linhas.
  - Topo da tela → `TopoDaPagina`.
  - Marca → `Logotipo`.
  - Conta e tema → `MenuDaConta`, `MenuDoTema`.
  - Colunas do Editor → `ColunasDoEditor`.
- **E6 · ARQ-01.** "Apoio à direita" aparece na Mesa com abas e não é definido. Proposta: "a Mesa pode ter apoio à direita, opcional, ≤ 25 %, com a `Ficha` do objeto". A alternativa é tirar a menção.
- **E7 · CTRL-08.** O raio do item de navegação: `rounded-ctrl`, a medir no ateliê.

---

# Decisões ao operador

Cada decisão vem no formato o caso · se não decidir · recomendação.

**D1 · O Editor fica fora do casco** (emendas E1, E2, E3).
- **O caso:** a regra do casco diz que só a tela de login fica fora da moldura com menu lateral. Mas a barra do Editor já leva o "voltar" e a conta, e a 1280 px o menu lateral (64 px mesmo recolhido) tira largura da prévia, que precisa de pelo menos 60 % da tela. O produto de referência já tirou o menu do editor por decisão do dono.
- **Se não decidir:** o bloco do Editor nasce dentro do casco, com a conta em dois lugares e a prévia 64 px menor. A guarda da trilha reprova o Editor, que não tem trilha.
- **Recomendação:** fora do casco, com as três emendas. A barra substitui o casco inteiro, e é o desenho já testado no produto de origem.

**D2 · O topo da página não rola.**
- **O caso:** a regra diz "quem rola é o `<main>`". Se o `<main>` inteiro rolar, o título, o estado e o botão principal somem quando a lista desce.
- **Se não decidir:** cada app escolhe. Uns grudam o topo com valor de altura escrito à mão; outros deixam o primário sumir.
- **Recomendação:** o topo fica parado e rola a região abaixo dele, pela peça de rolagem do kit (emenda E4). Assumida no desenho.

**D3 · O escopo do F272.**
- **O caso:** os cinco blocos pedem 18 peças novas, mais uma mudança no `RolagemDoPainel`.
- **Se não decidir:** um PR enorme, com crítica de 5 blocos e 18 peças de uma vez, e o gate do registro (teste dom por peça) crescendo junto.
- **Recomendação:** duas fatias.
  1. As peças de casco, Lista, Mesa e Entrada, com esses quatro blocos.
  2. `dobra`, `barra-do-editor` e `colunas-do-editor` com o bloco Editor.

  Reversível e barato; segue assumida até o operador dizer.

**D4 · A preferência da barra recolhida vai num cookie.**
- **O caso:** guardar só no navegador faz a barra abrir larga e encolher no F5.
- **Se não decidir:** o pulo de 160 px no F5, que a regra hoje aceita.
- **Recomendação:** cookie lido pelo servidor, com o `localStorage` só em app sem servidor. Assumida; está na E4.

**D5 · O arquivo do logotipo.**
- **O caso:** não existe SVG oficial da Wicomm no repositório, e o logotipo não se desenha à mão (MARCA-04).
- **Se não decidir:** o bloco sai com a palavra "Wicomm" em texto no lugar do símbolo, e a crítica de consistência perde ponto.
- **Recomendação:** o operador entrega o SVG oficial (símbolo + horizontal). Até lá, a peça usa a palavra em texto, marcada *provisória*. **Precisa do operador.**

**D6 · A alça de arrasto e a conversa ficam fora do Editor.**
- **O caso:** as duas pedem dependências e peças (arrastar; ícone e bolha de IA) que nenhum outro bloco usa.
- **Se não decidir:** o Editor fica sem elas.
- **Recomendação:** fora. Reordena pelo `⋯` da linha, e a coluna da direita fica pronta para o modo conversa. Assumida.

**D7 · A barra flutuante do item no canvas sai do exemplo.**
- **O caso:** a regra do Editor prevê, sobre a prévia, uma barrinha do item selecionado (nome, mover, `⋯`). Ela repete o que a linha da estrutura e o topo do inspector já oferecem.
- **Se não decidir:** entra uma peça a mais que pode crescer por cima da prévia.
- **Recomendação:** fora do bloco. Volta como peça se um projeto mostrar que a estrutura recolhida deixa o item sem ação. Assumida.

**D8 · Sem filete entre as linhas da tabela.**
- **O caso:** a referência separa as linhas com linha de 1 px; a base proíbe linha que não seja o anel da peça (SUP-03).
- **Se não decidir:** a peça segue a base.
- **Recomendação:** sem filete, só o hover. Medir no ateliê com 14 linhas nos dois temas; se a leitura cair, a emenda vai à base com a medida. Assumida.

---

## Crítica 1 (30/10/2026, `critico-de-ui`, contexto limpo): revisão F272, blocos de tela (casco, Lista, Mesa, Editor, Entrada)

**Antes da nota:**
- **Onde está o arquivo:** a revisão não está em `docs/design/revisoes/`. Ela está, fora do git, em `/Users/ichikawacraice/Developer/Projects/wicomm-design-system/.claude/worktrees/hopeful-moser-3729dc/packages/guardas/docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`. Por isso o link do plano `docs/planos/2026-10-30-F272-blocos-de-tela.md` está quebrado.
- **Sem `.claude/kit.json`:** não sei onde ficam as fontes. Julguei a revisão, a base (v0.2.0) e o código do kit.
- **Detector:** o `achar-detector.mjs` saiu 0. O detector rodou em `packages/registro` e voltou 0 achados, sem `DEGRADED`. Ele só leu as peças que já existem, porque os blocos ainda não existem. Para a revisão, não acrescenta nada.

Nota: 25/30 (hierarquia 5 · densidade 4 · consistência 3 · ruído 4 · ação primária 5 · aderência 4)
Veredito: aprovada com ressalvas (25, nenhuma ressalva alta)

**Nota por bloco** (hierarquia · densidade · consistência · ruído · ação · aderência):

| bloco | nota | onde perde |
|---|---|---|
| casco | 27 (5·4·4·5·5·4) | `ItemDaNavegacao` e `BarraLateral` moram no bloco, não no kit (PRIN-05). A altura da linha do desfecho fica fora da conta dos pesos |
| Lista | 24 (4·4·4·3·5·4) | P1, P2. Linha h-10 com 8 % de respiro |
| Mesa | 24 (4·4·3·4·5·4) | P1, P3. `Table` dentro do cartão do `Bloco` é ambíguo: FORMA-01 conta a tabela como peça |
| Editor | 24 (5·4·3·4·5·3) | P4, P5. O tema ocupa um controle a mais na barra, e o `MenuDoTema comoItem` já resolveria dentro da conta |
| Entrada | 28 (5·5·4·5·5·4) | A altura (≈380 px) não conta o link "Esqueci a senha" nem a linha do desfecho. O logotipo é provisório (D5) |

#### P1 · aderência · As rotas do exemplo reprovam na guarda da trilha
- **Peso:** média
- **Onde:** revisão, "Rotas do exemplo" (l. 25–28). A guarda é `packages/guardas/lib/guardas/toda-tela-de-detalhe-tem-trilha.mjs:24-29`. Os grupos de rota saem da conta em `packages/guardas/lib/projeto.mjs:116`.
- **O que se vê:** sem o `(casco)`, as quatro rotas `/exemplos/{lista,mesa,editor,entrada}` ficam com 2 segmentos. A guarda lê as quatro como tela de detalhe. Lista e Entrada não montam `Trilha`, então são 2 violações certas. O Editor vira a 3ª enquanto a E2 não entrar. O plano roda as guardas sobre os blocos.
- **Por que pesa:** o gate do PR 1 fica vermelho. A saída tentadora é pôr trilha na Lista, que é destino da barra lateral, e isso viola a mesma guarda pelo outro lado. A trilha da Mesa também perde o destino real.
- **Correção:** usar a topologia real nos exemplos:
  - `app/(casco)/pedidos/page.tsx` para a Lista (1 segmento);
  - `app/(casco)/pedidos/[id]/page.tsx` para a Mesa, com a trilha "Pedidos › Pedido 1042" apontando para `/pedidos`;
  - `app/(tela-inteira)/entrar/page.tsx` para a Entrada, que também entra em `telas` da guarda `a-tela-de-entrada-tem-o-botao-grande`;
  - `app/(tela-inteira)/documentos/[id]/editar` para o Editor (PR 2), junto com a E2.

#### P2 · ruído · A coluna Situação repete o modo, e o exemplo padrão quebra o filtro
- **Peso:** média
- **Onde:** Lista, inventário (l. 169, 172), Mensagens (l. 203) e `?estado=` (l. 221).
- **O que se vê:** os 4 modos casam um a um com 4 vozes: Pedem você = `espera`, Com outros = `alheio`, Andando = `neutro`, Concluídos = `ok`. No modo padrão, as até 14 linhas visíveis levam o mesmo chip âmbar. Além disso, o `pronto` padrão põe uma linha "Processando" (`neutro`, do modo Andando) dentro de "Pedem você".
- **Por que pesa:** são 14 chips que não geram decisão (PRIN-04). E uma linha que não pede você, dentro do filtro "Pedem você", faz o filtro mentir (COR-03).
- **Correção:**
  - Na vista por modo, a coluna Situação só desenha o `ChipDeEstado` quando a voz da linha for diferente da voz do modo (por exemplo, `ruim` dentro de Andando). O `emCurso` passa para o lado do texto da Etapa.
  - A coluna inteira volta nos resultados da busca, que cruzam os modos.
  - Na fixação, a linha "Processando" vai para `?estado=andando`, com o modo Andando selecionado.

#### P3 · consistência · O `TrilhoDoPercurso` usa a forma que a PECA-01 proíbe para o percurso
- **Peso:** média
- **Onde:** Peças novas, `trilho-do-percurso` (l. 500); Mesa, Regiões (l. 294); E5 (l. 538). Do outro lado, `ANATOMIA.md:190` ("Onde no percurso → `PontoDaEtapa`; não use `Estado` com `tom`"), `ANATOMIA.md:195` (Progress) e DESIGN COR-08 (l. 248).
- **O que se vê:** são 5 estações, cada uma com um ponto de voz de 6 px (`ok`/`espera`/`neutro`) ao lado do nome da etapa. É exatamente o lugar onde a COR-08 reserva o ponto de etapa de 7 px. Com a E5, a PECA-01 passa a ter três linhas para a mesma função: "onde no percurso", "progresso de etapa" e "percurso de um objeto".
- **Por que pesa:** o ponto colorido ao lado do nome da etapa lê como cor de etapa, ou seja, uma segunda régua. E o projeto que declarar `PontoDaEtapa` fica com dois pontos por estação.
- **Correção:**
  - Só a estação atual leva `Estado` com `tom`.
  - As estações feitas usam `CheckIcon` (canal de forma, sem matiz) e tinta `foreground-2`.
  - As estações à frente ficam em `muted-foreground`, sem ponto.
  - A E5 reescreve a linha "Onde no percurso" em vez de acrescentar outra: o trilho é o `TrilhoDoPercurso`, e o `PontoDaEtapa` é o encaixe opcional da cor de etapa dentro da estação.

#### P4 · aderência · A E3 tira o `t-display` do `h1`, mas não muda a TIPO-02 nem a guarda
- **Peso:** média
- **Onde:** E3 (l. 532) e Editor, inventário (l. 338). Do outro lado, `DESIGN.md:304-305` (TIPO-02: `t-display` é o título da página, `t-titulo` é bloco, cartão e diálogo) e `packages/guardas/lib/guardas/o-titulo-da-pagina-e-um-so.mjs:12`, que reprova todo `h1` sem `t-display`.
- **O que se vê:** a E2 lista a mudança da guarda dela. A E3 não lista nenhuma.
- **Por que pesa:** o bloco Editor nasce reprovado. Ou alguém "corrige" o `h1` de volta para 23 px dentro da barra de 44 px.
- **Correção:** a E3 emenda também a linha `t-display` da TIPO-02 ("salvo o `h1` da `BarraDoEditor`, em `t-titulo`"). A guarda ganha a exceção por peça, com um teste que prove que ela morde. Isso pertence à D1: quem aprova a D1 aprova as duas coisas juntas. Vai para *Decisões ao operador*.

#### P5 · ação primária · O que fazer depois de "Não publicou" só aparece em dica de hover
- **Peso:** média
- **Onde:** Editor, Mensagens (l. 378) e "Ficam de fora: `Popover`" (l. 519). Do outro lado, DESIGN CTRL-08 (l. 487: a dica de hover só se justifica na barra recolhida), PECA-01 (`ANATOMIA.md:209`: detalhe sob demanda é `Popover`) e MSG-01 (l. 137: o clique no chip abre o detalhe).
- **O que se vê:** a única frase que diz o que fazer ("tente em alguns minutos") mora numa `Ajuda`.
- **Por que pesa:** quem não passa o mouse sobre o chip vê só "Não publicou" e clica Publicar de novo, sem saber que deveria esperar.
- **Correção:** "Não publicou" vira `ChipQueAbre`, que abre um `Popover` com a frase. O `Popover` entra nas peças do PR 2. A saída continua sendo o próprio "Publicar" (MSG-06).

Ficaram de fora 3 problemas, todos baixos:
- **Densidade:** linha h-10 com t-denso. Com h-8 caberiam 17 linhas em vez de 14.
- **Consistência:** fica ambíguo se a `Table` é ou não superfície dentro de `Painel` e `Bloco`.
- **Ruído:** o tema ocupa um controle próprio na barra do Editor.

### As emendas E1–E7 contra o resto da base
- **E1:** não contradiz nada além do que emenda. Ela resolve um conflito que já existe: a ARQ-03 (l. 107) põe a conta na barra do Editor, e a CASCO-01 manda todo app autenticado ter o casco. Mas o terceiro item ("o topo não rola") repete o primeiro da E4, e o `DESIGN.md:132` diz que os três arquivos não se repetem. Deixar a regra num lugar só (LAY-01) e citá-la daqui.
- **E2:** sem conflito. A guarda precisa da opção que a própria emenda já anuncia.
- **E3:** contradiz a TIPO-02 e a guarda do título (P4).
- **E4:** é compatível com o porquê da LAY-01 e com a LAY-05 (gaveta na camada 40). Há um choque de redação com a PESO-05 (`ANATOMIA.md:252`, "quem rola é a página"): dizer que, nesta regra, "a página" é a região do arquétipo.
- **E5:** três conflitos:
  - o trilho contra as linhas l. 190 e l. 195 da PECA-01 (P3);
  - "Colunas do Editor → `ColunasDoEditor`" sem `Resizable`, contra a PECA-02 (`ANATOMIA.md:222`, "colunas ← `Resizable`");
  - "`Vazio`, `MedalhaoDoIcone` nunca com `tom`" contra a linha do medalhão na PECA-01 (l. 185, "`tom` quando a tela diz… ausência"). Aqui a revisão está certa pela COR-10: o que se emenda é a linha do medalhão.
- **E6:** não contradiz nada; a ARQ-01 (l. 93) só exclui o apoio na Mesa com abas. Mas a conta não fecha: trilho 240 + vão 24 + apoio até 320 (25 %) + vão 24 deixam 400 px de 1008 para a etapa, e a tabela de Itens não cabe. Recomendo a alternativa de tirar a menção.
- **E7:** não contradiz nada. Mas o raio do item de navegação deveria entrar na lista da FORMA-01, e uma regra "a medir" ainda não tem o que conferir.

### Fica como está
- As larguras do Editor medidas como regra (860 px = 67 %, 968 px = 76 %, 620 px proibido; a estrutura só cabe com o inspector a partir de ~1650 px), com `estruturaCabe` exportada para teste.
- O estado entra por props numa união tipada e as fixações vêm por `?estado=`. Nada na tela alterna estado, e cada região declara os sete estados.
- O teste que divide cabeçalho e topo ("continua valendo depois de trocar de destino?"). Saem da barra lateral o filete e a ação de tela.

**Para levar em conta:**
- As ressalvas médias vão para o `depois` do item. Mesmo assim, P1 e P4 vão aparecer como gate vermelho nas guardas do PR 1 e do PR 2 se não forem tratadas antes.
- Enquanto eu lia, apareceram no kit peças novas da execução (`chip-de-estado.tsx`, `estado.tsx`, `topo-da-pagina.tsx`, `tela-de-erro.tsx`, `seletor-de-vista.tsx`, `medalhao-do-icone.tsx`, `lib/link-do-app.tsx`). Elas não entraram nesta nota: o código está mudando e merece crítica própria, a 1280 px nos dois temas.

### O que a dona fez com a crítica (30/10/2026)
- **P1:** as rotas do exemplo passam à topologia real: `app/(casco)/pedidos` (Lista), `app/(casco)/pedidos/[id]` (Mesa, trilha para `/pedidos`), `app/(tela-inteira)/entrar` (Entrada, na lista da guarda da tela de Entrada).
- **P2:** na vista por modo, a coluna Situação só desenha o chip quando a voz da linha difere da voz do modo; volta inteira nos resultados da busca. A linha em curso vai ao modo Andando (`?estado=andando`).
- **P3:** o trilho leva `Estado` com tom só na estação atual; as feitas levam o ícone de feito em `foreground-2`; as à frente, `muted-foreground` sem ponto. A E5 reescreve a linha "Onde no percurso".
- **P4, P5:** são do Editor, que vai no PR 2 (D3); entram lá junto com a D1.
- **E1/E4:** "o topo não rola" fica só na LAY-01; a PESO-05 ganha a nota de que "a página" é a região do arquétipo. **E6:** sai a menção ao apoio (a conta não fecha). **E7:** fica para o ateliê medir.

---

## Crítica 2 (30/10/2026, `critico-de-ui`, contexto limpo): as telas do F272 (casco, Lista, Mesa, Entrada) a 1280×800, claro e escuro

**Antes da nota**
- **Sem `.claude/kit.json`.** Julguei pelas 36 capturas em `/private/tmp/claude-501/-Users-ichikawacraice-Developer-Projects-wicomm-design-system--claude-worktrees-hopeful-moser-3729dc/28813ca2-ca01-4adf-a1be-71641f821c97/scratchpad/capturas/v1/`, pelo código dos blocos e das peças e pela revisão `/Users/ichikawacraice/Developer/Projects/wicomm-design-system/.claude/worktrees/hopeful-moser-3729dc/docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`.
- **Detector.** O `achar-detector.mjs` saiu 0. O Impeccable 4.1.1 rodou em `packages/registro` e voltou `[]`: nenhum achado e sem `DEGRADED`.
- **Os dois temas.** Nenhum problema aparece só num tema. A nota de cada bloco vale para os dois.
- **Logotipo.** É provisório e não foi descontado.

Nota: 25/30 (hierarquia 5 · densidade 4 · consistência 4 · ruído 4 · ação primária 4 · aderência 4)
Veredito: **volta**, por uma ressalva alta (P1), que é só da Mesa. Casco, Lista e Entrada passam do 24 nos dois temas.

| bloco | nota (hier · dens · cons · ruído · ação · ader) | onde perde |
|---|---|---|
| casco | 27 (5·5·4·4·5·4) | P3, P4. `ItemDaNavegacao` continua no bloco, não no kit |
| Lista | 25 (4·4·4·4·5·4) | P2, P3, P5 |
| Mesa | 24 (5·4·4·4·3·4), **volta pela P1** | P1. A Table fica a 28 px da borda, e a Ficha a 16 px. "em curso" aparece 3 vezes no estado de sucesso |
| Entrada | 28 (5·5·4·5·5·4) | O cartão sobe 15 px quando aparece o erro. No estado andando, os campos estão vazios |

#### P1 · ação primária · Na Mesa de leitura, o caminho até a ação não chega à conferência
- **Peso:** alta
- **Onde:**
  - `packages/registro/registry/wicomm/blocks/mesa/mesa-do-pedido.tsx:338-344`: o link aponta para `hrefDaLista`.
  - `:356`: `aoConferir={() => {}}`.
  - `:86-108`: o `BlocoDosItens` desenha o "Conferir" em todo item não conferido e o `MenuDoItem` em toda linha.
  - Captura: `mesa-pedidos_1042_estado_leitura-{claro,escuro}.png`.
- **O que se vê:**
  - A frase manda "abra a conferência", mas o link "fila de pedidos" vai à Lista. Lá, clicar no 1042 traz a pessoa de volta a este mesmo pedido. É um círculo.
  - Na leitura, cada um dos 3 itens ainda tem `⋯` com "Registrar divergência", que é um gesto que grava.
  - A fixação usa só itens conferidos e por isso esconde o pior caso. Com um item pendente, a leitura desenharia "Conferir" em `secondary sm` ligado a uma função vazia: um botão que não faz nada.
- **Por que pesa:**
  - A Mesa de leitura existe para o caso "o gesto mora noutra tela". Nesse caso o normal é ter item pendente.
  - Quem usa clica em "Conferir" e nada acontece, ou segue o link e volta ao ponto de partida.
  - É o oposto da ARQ-01 ("o caminho de ação é uma linha com link, nunca um segundo lugar para o mesmo gesto").
- **Correção:**
  - A `MesaDoPedido` ganha a prop `hrefDaConferencia`, separada de `hrefDaLista`. O link aponta para a Mesa com o trilho na estação Conferência, com o texto "Abrir a conferência".
  - O `BlocoDosItens` ganha `somenteLeitura`. Nesse modo, o item pendente vira `Estado tom="neutro"` "por conferir", sem botão e sem `MenuDoItem` (PESO-03).
  - A fixação `leitura` passa a ter 1 item pendente, para provar o caso.

#### P2 · densidade · As colunas da Lista pulam ao trocar de modo, e a célula vazia não diz por quê
- **Peso:** média
- **Onde:**
  - `blocks/lista/lista-de-pedidos.tsx:30-36` (as larguras) e `:62-71` (a coluna condicional).
  - Capturas: `lista-pedidos-claro.png` × `lista-pedidos_modo_andando-claro.png`.
- **O que se vê:**
  - Sem Situação, as larguras somam 34 + 18 + 15 + 15 = 82 %. O navegador reparte o resto, e a coluna Pedido fica com 418 px para cerca de 100 px de conteúdo.
  - Ao trocar "Pedem você" por "Andando", a Etapa salta de x=678 para x=784, e todas as colunas andam.
  - Em Andando, 2 das 3 células de Situação ficam em branco, numa coluna de 182 px que só existe por causa de um chip "Falhou".
- **Por que pesa:**
  - Quem alterna entre filas perde o lugar do olho a cada troca.
  - Sem filete entre as linhas (D8), a distância de cerca de 600 px entre o cliente e o valor é justamente o que a D8 pedia para medir.
  - Uma célula vazia sem causa vai contra a EST-02.
- **Correção:**
  - Na vista por modo, a coluna Situação sai sempre. O chip de exceção ("Falhou") vai dentro da célula da Etapa, ao lado do texto, no mesmo lugar onde o "processando" já foi.
  - A coluna Situação volta só nos resultados da busca.
  - A `Table` usa `table-fixed`, com larguras que somam 100 % em cada um dos dois desenhos. Exemplo: Pedido 40 · Etapa 30 · Valor 15 · Atualizado 15.

#### P3 · aderência · A contagem "3" da barra lateral é constante e contradiz a tela
- **Peso:** média
- **Onde:**
  - `blocks/casco/navegacao.ts:20`: `contagem: { numero: 3, … }` fixa, dentro da fonte das rotas.
  - Capturas: `lista-pedidos_estado_vazio-*`, `_vazio_filtro-*`, `_sem_permissao-*` e `mesa-pedidos_1042_estado_sucesso-*`.
- **O que se vê:**
  - Em 4 fixações, a barra diz "Pedidos 3" ao lado de "Pedem você 0".
  - Na fixação sem permissão, a barra diz "Pedidos 3" e o destino aparece ativo, e a tela diz "Sua conta não tem acesso aos pedidos". A revisão (l. 128) manda não desenhar destino fora de alcance.
- **Por que pesa:**
  - Duas contagens do mesmo fato discordam na mesma tela, e a cor `espera` afirma um trabalho que não existe (COR-03).
  - O exemplo ensina a declarar um número vivo junto das rotas, que mudam pouco, e é isso que o projeto vai copiar.
- **Correção:**
  - A `contagem` sai de `DESTINOS`. O `CascoDoApp` recebe `contagens?: Record<href, Contagem>` como dado do servidor, ao lado de `grupos`.
  - No exemplo, as fixações em que a contagem mentiria (vazio, vazio-filtro, sem-permissão, sucesso) rodam sem ela.
  - A de sem-permissão entrega `grupos` sem `/pedidos`.

#### P4 · ruído · O cabeçalho corta a borda e a sombra da barra lateral nos 48 px de cima
- **Peso:** baixa
- **Onde:**
  - `blocks/casco/cabecalho-do-app.tsx:31` (`relative z-30 … bg-background`).
  - Capturas: `lista-pedidos-claro.png` e `-escuro.png`, x≈224, y 0–48. O mesmo vale para a barra recolhida, em x≈64.
- **O que se vê:**
  - No claro, o contorno da `superficie` da barra começa em y=48.
  - No escuro, a sombra da barra para no mesmo ponto.
  - A barra parece encaixada sob o cabeçalho, como se fosse uma peça mais curta.
- **Por que pesa:** é um degrau que não carrega decisão nenhuma, no lugar mais visto do app, em todas as telas.
- **Correção:** tirar o `bg-background` do `CabecalhoDoApp`. O chão já é da raiz (`casco-do-app.tsx:64`), e os menus do cabeçalho saem por portal. Assim, o contorno da barra corre inteiro.

#### P5 · aderência · Dois estados da Lista fogem do que a revisão desenhou
- **Peso:** baixa
- **Onde:**
  - `blocks/lista/lista-de-pedidos.tsx:111` (`TelaDeErro` sem `saida`) e `:123` (a espera substitui a tabela inteira).
  - Na revisão: l. 131 ("sem-permissao com a saída para o início") e l. 213 ("sob a cabeça da tabela, que já aparece").
  - Capturas: `lista-pedidos_estado_sem_permissao-*` e `_carregando-*`.
- **O que se vê:**
  - A Mesa sem permissão tem "Voltar aos pedidos". A Lista sem permissão não tem saída nenhuma.
  - No carregando, aparecem 8 barras de largura inteira e nenhum cabeçalho de coluna. Quando os dados chegam, a forma muda.
- **Por que pesa:**
  - Na tela sem permissão, a pessoa fica sem botão para sair (MSG-06).
  - A espera que não tem a forma do pronto faz a tela pular quando os dados chegam.
- **Correção:**
  - A `TelaDeErro` da Lista ganha `saida` com `Button variant="outline"` para o início do app.
  - No carregando, o corpo passa a ser `<Table><CabecaDaTabela comSituacao={false} /></Table>` seguido da `EsperaDaLista`.

Ficaram de fora 3 problemas, todos de peso baixo:
- **Consistência:** a distância do texto à borda da superfície é 12 px na Lista, 28 px na Table da Mesa e 16 px na Ficha.
- **Ruído:** "em curso" aparece 3 vezes na Mesa de sucesso, e na Mesa de leitura o título do bloco "Itens" repete a aba "Itens".
- **Aderência:** o cartão da Entrada sobe 15 px quando aparece o erro, e a fixação "andando" mostra os campos vazios.

### Fica como está
- **O topo parado, e quem rola é o painel.** O primário e o estado ficam à vista em todos os estados. Os modos mostram `—` no carregando e `0` no vazio (EST-04).
- **O trilho da Mesa como a crítica anterior pediu.** O ✓ vai nas estações feitas, o `Estado` só na atual, e as estações à frente ficam sem ponto. A largura é de 240 px, 18,75 % da tela. Sem item por conferir, o primário não é desenhado, e a ação passa para a linha do item.
- **A Entrada.** O erro de campo aparece no campo e o de credencial no bloco, acima do "Entrar" `xl`. O "Entrando" desabilita o botão. O cartão de 384 px fica centrado, sem nada em volta.

### O que a dona fez com a crítica 2 (30/10/2026)
- **P1 (alta):** a fixação de leitura tem 1 item pendente; `BlocoDosItens somenteLeitura` mostra "por conferir" sem botão nem `⋯`; o `⋯` do pedido some na leitura; a linha leva "Abrir a conferência" (`hrefDaConferencia`).
- **P2:** na vista por modo a coluna Situação sai; a exceção vai como chip na célula da Etapa; `table-fixed` com larguras que somam 100% nos dois desenhos.
- **P3:** a contagem saiu de `DESTINOS` e virou dado (`contagens`, ou `useNavegacao`); no exemplo, `navegacaoDoExemplo` a mantém coerente com cada estado.
- **P4:** o cabeçalho sem fundo próprio. **P5:** "Voltar ao início" na Lista sem permissão; o carregando com a cabeça da tabela.
- **Baixas:** texto a 16px da borda nas três superfícies; menos "em curso" na Mesa de sucesso; "Itens do pedido" na leitura; a Entrada mostra o e-mail nos momentos depois do envio.

---

## Crítica 3 (30/10/2026, `critico-de-ui`, contexto limpo, recrítica 1 de 2): as telas do F272 (casco, Lista, Mesa, Entrada) a 1280×800, claro e escuro. Recrítica 1 de 2

**Antes da nota**
- **Sem `.claude/kit.json`.** Julguei pelas 36 capturas de `v2/`, comparadas com `v1/`, pelo código dos blocos e das peças e pela revisão.
- **Detector.** O `achar-detector.mjs` saiu 0. O Impeccable 4.1.1 rodou em `packages/registro` e voltou `[]`, sem `DEGRADED`.
- **Temas.** Medi as cores dos pixels nos dois temas. Nenhum problema aparece só num deles. A pílula ativa da `BarraDeModos` fica mais escura que a trilha no escuro, mas isso é decisão registrada (`seletor-de-vista.tsx:13-17`) e não reabri.
- **Logotipo e Editor.** O logotipo é provisório e não foi descontado. O Editor ficou de fora.

**O delta, conferido**
- **P1, resolvido na tela.** Na leitura, a Luminária aparece como "por conferir", sem botão e sem `⋯`. O topo não tem primário nem `⋯`, e a linha leva a "Abrir a conferência". O default do link tem um problema novo (P2 abaixo).
- **P2, resolvido.** A Etapa fica em x=664 em "Pedem você" e em "Andando". As larguras somam 100% nos dois desenhos (32+18+20+15+15 e 40+30+15+15). O "Falhou" vai como chip na Etapa.
- **P3, resolvido na Lista.** A Mesa ganhou uma regressão (P1 abaixo).
- **P4, resolvido.** O contorno da barra corre desde y=0 em x=224.
- **P5, resolvido.** A Lista sem permissão tem "Voltar ao início". O carregando desenha a cabeça da tabela, com linhas de espera em passo de 40 px, igual ao das linhas prontas.
- **Baixas da rodada anterior:**
  - O texto fica a 16 px da borda nas três superfícies (248→264, 512→528, Ficha 512→528).
  - "em curso" aparece 1 vez na Mesa de sucesso.
  - A Entrada mostra o e-mail depois do envio.
  - Continuam o cartão da Entrada que sobe e o título "Itens do pedido".

Nota: 27/30 (hierarquia 5 · densidade 5 · consistência 4 · ruído 5 · ação primária 4 · aderência 4)
Veredito: **aprovada com ressalvas.** Todo bloco passa de 24 nos dois temas e não há ressalva alta. As 5 ressalvas abaixo vão para o `depois` do item.

| bloco | nota (hier · dens · cons · ruído · ação · ader) | onde perde |
|---|---|---|
| casco | 28 (5·5·4·5·5·4) | P1. `ItemDaNavegacao` continua no bloco (`barra-lateral.tsx:116`) |
| Lista | 28 (5·5·4·5·5·4) | P4. A busca tem 30 px de altura ao lado da barra de 36 px |
| Mesa | 26 (5·5·4·4·4·4) | P1, P2, P3 |
| Entrada | 28 (5·5·4·5·5·4) | P5 |

#### P1 · aderência · A navegação do exemplo lê o `?estado=` sem olhar a rota, e a barra volta a contradizer a Mesa
- **Peso:** média
- **Onde:**
  - `packages/registro/registry/wicomm/blocks/casco/navegacao.ts:36-46`: `semNada` e o filtro de sem-permissão valem para qualquer caminho.
  - `blocks/mesa/mesa-do-pedido.tsx:247-263`.
  - Capturas: `mesa-pedidos_1042_estado_erro-{claro,escuro}.png` e `mesa-pedidos_1042_estado_carregando-*.png`.
- **O que se vê:**
  - Na Mesa de erro, a barra mostra "Pedidos" sem contagem. Na mesma tela, o chip do topo diz "Aguarda você" e o trilho, "aguarda você". O erro ali é de um gesto que falhou, não de carga: os 3 pedidos continuam pedindo a pessoa.
  - Na Mesa carregando, a contagem some da barra a cada vez que a pessoa abre um pedido.
  - Na Mesa sem permissão, que não tem captura e conferi pelo código, o destino Pedidos some da barra. A saída da tela, porém, é "Voltar aos pedidos".
- **Por que pesa:**
  - É a mesma discordância que a P3 anterior tirou da Lista, agora na Mesa.
  - O exemplo é o que o projeto copia, e ele ensina a ligar a contagem da barra ao estado da tela aberta.
- **Correção:**
  - `navegacaoDoExemplo` decide pela rota:
    - Em `/pedidos` (Lista), vazio, vazio-filtro, carregando e erro ficam sem contagem, e sem-permissão tira o destino.
    - Em `/pedidos/:id` (Mesa), a contagem continua 3 em todo estado menos sucesso (2), e o destino Pedidos nunca sai. A falta de acesso é a um pedido, não à lista.
  - O teste de `os-blocos.dom.test.tsx:89` ganha os casos `("/pedidos/1042", "erro")` e `("/pedidos/1042", "sem-permissao")`.

#### P2 · ação primária · O default de `hrefDaConferencia` é a rota do próprio pedido
- **Peso:** média
- **Onde:**
  - `blocks/mesa/mesa-do-pedido.tsx:364`: `hrefDaConferencia ?? \`${hrefDaLista}/${carga.numero}\``.
  - `blocks/mesa/page.tsx:11`: não passa a prop.
  - `blocks/mesa/dados-da-mesa.ts:41-44`.
  - O teste (`os-blocos.dom.test.tsx:200`) passa `/pedidos/1042/conferencia`, então o default nunca é exercido.
- **O que se vê:**
  - No exemplo, "Abrir a conferência" leva a `/pedidos/1042`, que é o momento `pronto`. Ali a Luminária, que estava "por conferir", já aparece conferida (3 de 3), e o primário "Concluir conferência" está à vista. A pessoa chega a uma tela onde o item que veio conferir não está pendente.
  - Num projeto em que a leitura é a vista de `/pedidos/:id`, o default aponta para a própria tela. É o círculo da P1 anterior, de volta para quem copiar o bloco sem passar a prop.
- **Por que pesa:** o caminho de ação da Mesa de leitura (ANATOMIA l. 92) só funciona se o destino for outra tela, e outra tela que mostre o pendente.
- **Correção:**
  - `hrefDaConferencia` passa a ser obrigatória quando a carga é de leitura, por um tipo discriminado em `momento`. O bloco deixa de inventar o destino.
  - A `page.tsx` do exemplo passa `` `/pedidos/${id}?estado=a-conferir` ``.
  - `cargaDaMesa` alinha as duas fixações com o mesmo item pendente (`a-conferir` com a Luminária por conferir, como na leitura), para o percurso fechar.

#### P3 · ruído · A Mesa de leitura ainda diz "itens" três vezes e "confere" duas
- **Peso:** baixa
- **Onde:**
  - `blocks/mesa/mesa-do-pedido.tsx:361-362` (a frase), `:376` (a aba "Itens") e `:384` (`titulo="Itens do pedido"`).
  - Captura: `mesa-pedidos_1042_estado_leitura-*.png`, y 151–255.
- **O que se vê:**
  - Em 100 px de altura aparecem três textos: "Os itens se conferem na conferência do pedido.", depois a aba ativa "Itens", depois o título "Itens do pedido · 2 de 3 conferidos".
  - O nome novo do bloco ainda repete a aba que acabou de ser escolhida.
- **Por que pesa:** são três linhas para dizer o que a aba ativa já diz. A legenda "2 de 3 conferidos", que é o fato que interessa, fica no fim da fila.
- **Correção:**
  - Na leitura, o `BlocoDosItens` vai sem título, porque a aba ativa já nomeia a região. A legenda "2 de 3 conferidos" continua como legenda do bloco.
  - A frase fica sem a repetição: "A conferência dos itens é feita noutra tela." e o link "Abrir a conferência".

#### P4 · aderência · A barra de modos da Lista muda de largura quando a contagem chega
- **Peso:** baixa
- **Onde:**
  - `packages/registro/registry/wicomm/ui/seletor-de-vista.tsx:132` (`"—"` no lugar do número).
  - Capturas: `lista-pedidos_estado_carregando-claro.png` × `lista-pedidos-claro.png`, y=138.
- **O que se vê:**
  - A trilha termina em x=690 no carregando e em x=668 no pronto, uma diferença de 22 px.
  - "Andando" anda de 492 para 481, e "Concluídos" de 589 para 572.
  - O travessão é mais largo que um algarismo.
- **Por que pesa:** é o mesmo pulo de forma que a P5 anterior tirou da tabela, agora no controle que o olho procura primeiro quando os dados chegam.
- **Correção:**
  - O número do modo ganha um espaço reservado da largura de um algarismo (`tabular-nums` com `min-w-[1ch]`, centrado).
  - O "não contado" vira o travessão numérico U+2012 (`‒`), que tem a largura de um algarismo, em vez do U+2014.

#### P5 · aderência · O cartão da Entrada sobe quando aparece o erro, e o "Entrando" mostra a senha vazia
- **Peso:** baixa
- **Onde:**
  - `blocks/entrada/tela-de-entrada.tsx:77` (`grid place-items-center`) e `:117` (a senha sem valor na fixação).
  - Capturas: `entrada-entrar*-claro.png`.
- **O que se vê:**
  - O topo do cartão fica em y=231 no pronto e no andando, em y=216 no erro de credencial (15 px acima) e em y=219 no erro de campo (12 px acima).
  - No "Entrando", o e-mail aparece, mas a senha está vazia: parece que a pessoa enviou sem senha.
- **Por que pesa:** o botão "Entrar" muda de lugar entre a tentativa e o reenvio. A fixação do momento depois do envio também ainda não mostra o que foi enviado.
- **Correção:**
  - O cartão é ancorado pelo topo: `content-start` com um respiro fixo acima, no lugar do centro vertical. Assim o erro empurra para baixo, não para cima.
  - Nos momentos depois do envio, a fixação dá à senha um `defaultValue` de exemplo, para aparecerem os pontos.

Ficou de fora 1 problema, de consistência e de peso baixo: na Lista, a busca tem 30 px de altura (y 123–152) ao lado da barra de modos de 36 px (y 120–155).

### Fica como está
- **As colunas fixas da Lista.** A Etapa fica em x=664 nos dois modos, as larguras somam 100% nos dois desenhos, e a exceção ("Falhou") vai como chip na própria Etapa, sem coluna vazia.
- **A Mesa de leitura sem nenhum gesto que grava.** Não há primário, nem `⋯` no pedido, nem `⋯` nos itens. O pendente aparece como `Estado` neutro, e a ação é uma linha com link, como manda a ANATOMIA l. 92.
- **A forma da espera na Lista.** O carregando desenha a cabeça da tabela e linhas no mesmo passo de 40 px das prontas. O sem-permissão tem saída, e a barra fica sem contagem nos estados em que ela mentiria.

### O que a dona fez com a crítica 3 (30/10/2026)
- **P1:** `navegacaoDoExemplo` decide pela rota: na Mesa a contagem continua (2 no sucesso) e o destino Pedidos nunca sai; o teste cobre a Mesa de erro e a sem permissão.
- **P2:** `hrefDaConferencia` sem padrão — sem ela, a leitura não desenha o caminho; a página de exemplo passa `/pedidos/:id?estado=a-conferir`; `a-conferir` e `leitura` têm o mesmo item pendente.
- **P3:** a frase da leitura vira "A conferência dos itens é feita noutra tela." (o título do bloco fica, porque a peça `Bloco` pede um).
- **P4:** o não contado é o travessão numérico (U+2012) numa caixa de 1ch: a barra de modos não muda de largura quando a contagem chega.
- **P5:** a senha aparece preenchida nos momentos depois do envio; o cartão que sobe vai para o `depois`.
