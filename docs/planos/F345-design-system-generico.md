# F345 · O design system vira genérico, com a marca Wicomm num tema à parte

Dona: `local_c518a378` (Opus). Origem: operador, 02/11 (Q844 unificar tudo no marketplace `ichikawa-kit`, item F344 do kit; Q845 a marca num plugin `tema-wicomm`). Plano escrito em 02/11, antes de mover qualquer arquivo, e revisto no mesmo dia com o laudo de um validador de contexto limpo, que mediu num clone descartável (gate da versão dos pacotes, testes que somem no `git mv`, CI do WiControl, apontador antes da migração, registro `v0.1.0`, validação de tema, dois marketplaces).

## 1. A premissa, conferida

O pedido supõe que a Wicomm está espalhada pelo núcleo. Medido no `main` (67ee842), ela está espalhada **no nome**, quase nunca **na substância**:

- **O tema como dado já existe pela metade.** `packages/tokens/fonte/marca.tokens.json` é o slot da marca: o único arquivo com a cor da marca, e o sistema só aponta para ele por alias. `gerar.mjs --marca <arquivo>` já gera os tokens com outra marca. Falta o resto do tema (nome, fonte, logotipo, prefixo do registro) e falta o arquivo morar fora do núcleo. A Q628 dizia que o slot "não é para troca por cliente"; continua não sendo: o tema serve para o núcleo não ter dono, não para vender marca por cliente.
- **As regras são genéricas.** MARCA-01 a 05, COR-*, TIPO-* falam do *slot* da marca ("a cor da marca não cede a contraste"), não do vermelho Wicomm. O que é da Wicomm nelas é o valor (`#F30B42`, gradiente, Archivo) e a prosa ("todo app da Wicomm").
- **As guardas (`@wicomm/guardas`) não têm nada da marca** além do nome do pacote, do arquivo de configuração (`design/wicomm.json`) e do `@import "@wicomm/tokens/…"` que a guarda dos tokens procura.
- **O processo de design tem as mesmas chaves nos dois plugins, mas não o mesmo comportamento.** As chaves do `kit-design` 0.2.4 (`pasta`, `visual`, `fontes`, `negadoAoDesigner`, `cobrarCritica`) são um subconjunto das do `wicomm`, que lê a seção `design` do `.claude/kit.json` como reserva e tem a mais o aviso de valor solto. Diferem em três pontos (§4, "Para o kit"): sem `fontes`, o `wicomm` julga pela base Wicomm; a trava do kit libera `kit-design:designer` sem lista e o `design-system:designer` só com `design.designers`; e o `kit-design` herda opções do nome antigo, o `wicomm` só reconhece `wicomm@*`. O kit já concordou (02/11 ~16:20) com o processo só no `design-system` e o `kit-design` como apontador.
- **Correção do briefing:** o pacote não se chama `@wicomm-projects/tokens` no código. O código importa `@wicomm/tokens` e `@wicomm/guardas`; `@wicomm-projects/…` é só o nome publicado no GitHub Packages, porque o escopo npm tem de ser o dono (a org). O WiControl instala pelo alias.
- **O marketplace aceita plugin de outro repositório por subpasta.** A fonte `git-subdir` (`url` + `path`) existe no Claude Code instalado (2.1.316). O `ichikawa-kit` pode listar `design-system` e `tema-wicomm` **sem o código sair deste repositório**. Isso muda a pergunta da Q845 (§5, Q847).

## 2. Inventário: o que é Wicomm no núcleo

Ocorrências de "wicomm" (maiúscula ou não), sem `node_modules`, `.next` e resultados de evals:

| camada | onde | o que é Wicomm | tipo |
|---|---|---|---|
| base | `plugins/wicomm/base/*.md` (27 linhas) | `name: Wicomm` no frontmatter; prosa "apps da Wicomm", "registro Wicomm", "exposição para a Wicomm"; cores da marca no frontmatter do DESIGN; Archivo na TIPO-01; `design/wicomm.json` na DENS; CONV-25 cita "pacote privado `@wicomm`" | nome + valor do tema |
| tokens | `packages/tokens` (66 linhas) | `marca.tokens.json` (valores); chave de extensão DTCG `com.wicomm` (escuro); a utilitária `font-archivo` (`lib/saidas.mjs:153`); nome `@wicomm/tokens`; prosa | valor do tema + nome |
| guardas | `packages/guardas` (44 linhas) | `design/wicomm.json`; bin `wicomm-guardas`; procura `@import "@wicomm/tokens/…"`; mensagem "guardas de design Wicomm" | nome |
| registro | `packages/registro` (641 linhas) | `"name": "wicomm"`; item `estilo` "Estilo Wicomm"; pasta interna `registry/wicomm/` (a maioria das ocorrências); `logotipo.tsx` escreve "wicomm"/"w" e `aria-label="Wicomm"`; `barra-lateral.tsx` `aria-label="Wicomm, início"`; chave `wicomm-barra` no `localStorage`; prefixo `@wicomm` nos exemplos | nome + marca na peça + estado gravado no navegador |
| plugin | `plugins/wicomm` | nome `wicomm`, comandos `/wicomm:*`, `design/wicomm.json` (`hooks/config.mjs`, `scripts/base-do-projeto.mjs:45,53`, `scripts/estado.mjs:68`), `substitutas.json` (`wicomm:*`), evals e textos | nome |
| plugin, medida | `scripts/medir-contraste.mjs:18,59-62,98`, `scripts/dados/tokens-wicomm.json` (referência da deriva, `medir-deriva.mjs:388`) | o hex `#F30B42`, a exceção de 4,25 presa a ele, a mensagem "a da Wicomm é…"; os tokens de referência | **valor do tema** |
| ateliê | `apps/atelie` (89 linhas) | `@wicomm/atelie`, servido em `wicomm-atelie.vercel.app` (é também o host do registro, `/r/v0.1.0`) | nome + host |
| marketplace | `.claude-plugin/marketplace.json` | marketplace `wicomm` com o plugin `wicomm` | nome |
| repo | `CLAUDE.md`, `README.md`, `docs/` | a regra "a base fala só da Wicomm"; o repositório `wicomm-projects/wicomm-design-system` | regra + nome |

O que é **da marca de verdade** (vai para o tema): as cores da marca (cor, hover, sobre, tinta, gradiente, nos dois temas), a família de texto e a variável que a carrega, o nome e o monograma do logotipo, o rótulo acessível da marca, o prefixo do registro e o contraste aceito da tinta sobre a marca (o 4,25 dos scripts de medida). A fonte de medida (a mono do sistema, TIPO-03) **não** é marca e fica no sistema. O resto é nome, e o nome passa a ser `design-system`.

## 3. O recorte

### `design-system` (o núcleo, `plugins/design-system/`)
A base sem marca, o processo (designer, crítico, guarda de design, valor solto), as skills (novo, auditar, padronizar, peça do kit, atualizar, acessibilidade, textos, migrar), os scripts de medida e os evals. Comandos `/design-system:*`. Os pacotes de tokens e guardas e o registro continuam pacotes deste repositório: o núcleo genérico é o conjunto, não só o plugin.

### `tema-wicomm` (a marca, `plugins/tema-wicomm/`)
Dado e uma skill para ligar o projeto a ele:
- `tema.json` e `tema.tokens.json` (formato abaixo);
- a skill `tema-wicomm:aplicar`, que grava `"tema": "wicomm"` no arquivo do projeto, o prefixo `@wicomm` no `components.json`, o import do CSS do tema e o carregamento da fonte (`--font-archivo`). Ela **não gera** tokens no projeto: o gerador não é publicado, e o projeto importa o CSS pronto do pacote;
- um README com a marca.

A fonte de verdade é `temas/wicomm/` na raiz do repositório. O plugin leva uma cópia (pasta de plugin tem de ser autossuficiente), e `packages/tokens/fonte/marca.tokens.json` continua existindo como cópia; um teste do gate reprova cópia que diverge.

### O tema como dado

```jsonc
// temas/wicomm/tema.json
{
  "$schema": "../../packages/tokens/tema.schema.json",
  "id": "wicomm",          // o prefixo do registro (@wicomm) e o sufixo do plugin (tema-wicomm)
  "nome": "Wicomm",        // o rótulo acessível da marca
  "logotipo": { "horizontal": "wicomm", "monograma": "w" },
  "fonte": { "familia": "Archivo", "variavel": "--font-archivo", "utilitaria": "font-archivo", "eixoDeLargura": true },
  "contrasteAceitoSobreAMarca": 4.25,
  "registro": { "prefixo": "@wicomm" }
}
// temas/wicomm/tema.tokens.json: o slot `marca` de hoje (DTCG, extensão com.wicomm.escuro), byte a byte
```

- **Trocar as cores é trocar o tema:** `temas/<id>/` com os dois arquivos e `gerar.mjs --tema temas/<id> --saida <pasta>` gera os tokens; o build do registro recebe o mesmo `--tema`. O pacote publica o tema Wicomm na raiz do `dist/`, como hoje, e pode publicar outros em `dist/temas/<id>/` quando existirem.
- **O tema é validado pelo que a base já manda:** hover na mesma matiz da cor (MARCA-01) e as pontas do gradiente a 2:1 (MARCA-03). Um piso para a tinta `sobre` **não** entra: a MARCA-01 diz que nenhum piso move a cor da marca, e cobrar piso do tema é regra nova (vai com a Q846).
- **Fora do tema, por decisão:** os neutros (COR-02), raio, espaço, movimento, escala de controle e a fonte de medida são o sistema. Tema que precise de neutros quentes é item próprio (*assumido, a confirmar*).
- **A utilitária da fonte é do tema:** `font-archivo` sai do `lib/saidas.mjs` com o nome que o tema declara. Com o tema Wicomm a saída fica igual; outro tema tem a utilitária com o nome dele (*assumido, a confirmar*: sem apelido genérico `font-texto`, que mudaria o `dist/`).
- **O porém da fonte:** as vozes que estreitam a letra (`t-rotulo`) contam com o eixo de largura. Tema com `eixoDeLargura: false` gera com aviso.

## 4. A migração sem quebrar quem consome

Consumidor medido: **WiControl** na `develop` (release segurado):
- `frontend/package.json`: `@wicomm/tokens` pelo alias na 0.1.1, `@wicomm/guardas` pelo alias na 0.1.2 (versão exata), e o script `guardas` = `wicomm-guardas --raiz . --config ../design/wicomm.json`, rodado no CI;
- `frontend/components.json`: o registro `@wicomm` em `https://wicomm-atelie.vercel.app/r/v0.1.0/{name}.json`;
- `design/wicomm.json` com a base copiada por hash;
- `.claude/settings.json` (versionado): `extraKnownMarketplaces.wicomm` apontando para `wicomm-projects/wicomm-design-system`, e `enabledPlugins` com `wicomm@wicomm`;
- `.claude/kit.json`: `design.designers` com `wicomm:designer`.

E os projetos que o `/wicomm:novo` criou, com a mesma forma.

**O critério de toda fatia:** o WiControl não vê diferença até ele mesmo migrar. Tokens com o tema Wicomm byte a byte iguais; o que o `shadcn add @wicomm/<peça>` grava no projeto igual; `wicomm@wicomm` continua com guarda e agentes.

| contrato | hoje | depois | como não quebra |
|---|---|---|---|
| nome do pacote no código | `@wicomm/tokens`, `@wicomm/guardas` | **igual** | não muda neste item: renomear obriga todo consumidor a trocar import e alias, e o escopo publicado é o da org (*assumido, a confirmar*) |
| `fonte/` e `dist/` dos tokens | `fonte/marca.tokens.json` + `sistema.tokens.json` | iguais byte a byte; `marca.tokens.json` passa a ser cópia de `temas/wicomm/tema.tokens.json` | o gate `versao-dos-pacotes` compara `dist` **e** `fonte` (`versao-dos-pacotes.test.mjs:32-33`): sem diferença, sem versão nova. A chave DTCG `com.wicomm` **fica** (trocá-la muda o `fonte/` publicado) |
| arquivo do projeto | `design/wicomm.json` | **fica** como nome aceito; projeto novo ganha `design/design-system.json` | o WiControl passa `--config ../design/wicomm.json` explícito, e com `--config` as guardas exigem o arquivo (`projeto.mjs:63-65`): não renomear o dele. O plugin e as guardas procuram os dois quando não há `--config` (as guardas sobem para 0.1.3; o WiControl segue na 0.1.2 até querer) |
| plugin | `wicomm@wicomm` | `wicomm` **congelado** (sem mudança) enquanto houver consumidor; `design-system` e `tema-wicomm` novos | ver "O plugin antigo" |
| marketplace | `wicomm` (este repositório) | `wicomm` fica, só com o `wicomm`; `design-system` e `tema-wicomm` só no `ichikawa-kit` (por `git-subdir`) | o nome `wicomm` está no `settings.json` versionado do WiControl. Cada plugin num marketplace só: o mesmo plugin em dois marketplaces roda os hooks duas vezes, e `pluginLigado` (`config.mjs:74-80`) pega a primeira chave `design-system@*` |
| `kit.json` `designers` | `wicomm:designer` | os dois nomes na migração | a trava do kit aceita lista (tipo exato, `subagente-nao-edita.mjs:146-147`) |
| registro | `/r/v0.1.0/` gerado da fonte atual a cada deploy | **continua `v0.1.0`**, gerado com o tema Wicomm; a pasta interna vira `registry/design-system/` | o `shadcn add` reescreve `@/registry/<pasta>/ui` e `/lib/utils` para os aliases do projeto e usa o nome do arquivo como destino: a pasta não chega ao projeto. Não subo a versão do registro: só a versão atual é gerada (`apps/atelie/scripts/registro.mjs:13`), e subir tira `/r/v0.1.0` do deploy e dá 404 no `components.json` do WiControl. Teste novo: `shadcn add` num projeto descartável grava os mesmos arquivos antes e depois |
| logotipo e rótulo da marca | texto fixo "wicomm"/"w"/"Wicomm" | lidos do tema | com o tema Wicomm, o arquivo instalado é o mesmo (o build põe o valor no arquivo do item, ou um `lib/tema.ts` vira dependência: decido na fatia 3 pelo teste acima) |
| `localStorage` `wicomm-barra` | chave fixa | **igual** | trocar a chave esquece a barra recolhida em todo navegador |
| scripts de medida | `#F30B42` e 4,25 fixos | lidos do tema do projeto | com o tema Wicomm, o mesmo resultado (os testes atuais conferem) |
| host | `wicomm-atelie.vercel.app` | igual | renomear é item próprio |

### O plugin antigo
- **Enquanto houver consumidor:** `plugins/wicomm/` fica como está, congelado, e o gate reprova mudança nele (teste de hash). Correção nova entra só no `design-system`.
- **A migração do consumidor** é a skill `design-system:migrar`, no plugin novo: desliga `wicomm@wicomm` e liga `design-system@ichikawa-kit` + `tema-wicomm@ichikawa-kit` no `settings.json`, acrescenta `design-system:designer` aos `designers`, mantém `design/wicomm.json`. Os dois plugins nunca ficam ligados juntos.
- **Depois que o WiControl e os projetos do `/wicomm:novo` migrarem:** a fatia 5 transforma o `wicomm` em apontador (sem hooks, sem agentes, sem `substitutas.json`; só o README e o comando que manda migrar).

### As fatias, em sequência (`maisFatias: true` até a última)
Cada uma parte da anterior mergeada: a 3 usa o tema da 1; a 4 usa o caminho da 2; a 2 e a 3 mexem as duas no ateliê.

1. **O tema vira dado.** `temas/wicomm/`, `tema.schema.json`, `gerar.mjs --tema --saida`, a validação de hover e gradiente, `marca.tokens.json` como cópia conferida, a utilitária da fonte lida do tema. Critério: `fonte/` e `dist/` iguais aos do `main` (o `versao-dos-pacotes` verde sem subir versão); um tema de teste com outra cor gera em pasta temporária sem tocar no núcleo; tema com hover de outra matiz reprova com a regra no erro.
2. **O plugin `design-system` e o `tema-wicomm`.** `plugins/design-system/` copiado de `plugins/wicomm/` (que congela), com os nomes trocados, o arquivo do projeto nos dois nomes, os scripts de medida lendo o tema, a herança das opções de `wicomm@*` e `kit-design@*`, a base como `fontes` padrão só quando o projeto tem `design/*.json`, e `design-system:migrar`; `plugins/tema-wicomm/` com `aplicar`; as guardas 0.1.3 procurando os dois nomes. **Os caminhos fixos que mudam**, todos nesta fatia: o `test` do `package.json` raiz (hoje com os globs de `plugins/wicomm/…`; o `node --test` com glob vazio sai 0, e o gate cairia de 182 para 17 testes sem acusar), `scripts/base.test.mjs:12`, `packages/tokens/test/paridade.test.mjs:288`, `packages/guardas/test/base.test.mjs:12`, `apps/atelie/scripts/conferir-saida.mjs:40`, `apps/atelie/src/vitrine/base.ts`, `apps/atelie/src/vitrine/comecar.ts:37`, `apps/atelie/test/vitrine.test.ts:20`, `apps/atelie/test/comecar.test.ts:45-46`, `hooks/tests/guarda-de-design.test.mjs:748`, `.gitignore:3`. Mais um teste novo que reprova pasta `plugins/*/{hooks,scripts}/tests` fora do script raiz. Critério: o gate conta os testes de antes mais os novos.
3. **O registro e o ateliê com o tema.** `registry/design-system/`, o item `estilo` e o logotipo e o rótulo lidos do tema, `build --tema`. Critério: o teste do `shadcn add` em projeto descartável igual antes e depois; `/r/v0.1.0` continua sendo o servido.
4. **A base sem marca.** Depende da **Q846**. Prosa sem "Wicomm", `name: design-system`, TIPO-01 sem o nome da família ("a família do tema"), o frontmatter do DESIGN com as cores lidas do tema (e o `paridade.test.mjs:305` ajustado, declarado no PR), versão dos três arquivos subindo, e a guarda nova no `base.test.mjs`: nenhuma ocorrência do `nome` do tema na base, e do `id` só como nome de pacote ou peça (`@wicomm/tokens`, `@wicomm/casco`), que ficam.
5. **O `wicomm` vira apontador.** Só depois que os consumidores migrarem (a orquestradora confirma). `maisFatias: false`.

### Fora deste repositório (vão à orquestradora, não abro)
- **WiControl:** rodar `design-system:migrar` na `develop` depois das fatias 2 e 3 e do item do kit. Não muda tela nem dependência npm.
- **Para o kit** (item de trazer os plugins ao `ichikawa-kit`): listar `design-system` e `tema-wicomm` por `git-subdir` (`url` `wicomm-projects/wicomm-design-system`, `path` `plugins/<nome>`); tirar o `kit-design`; e a trava `subagente-nao-edita` liberar `design-system:designer` sem lista, como libera `kit-design:designer` hoje. As outras duas diferenças de comportamento (fontes padrão e herança de opções) são código deste repositório e entram na fatia 2.

## 5. O que muda nas regras deste repositório

Muda regra, então espera o ok do operador (Q846):
- `CLAUDE.md`: "A base fala só da Wicomm: não cita domínio de produto nenhum nem o produto de origem" passa a "**A base não fala de marca nenhuma** nem de produto: o que é da marca mora no tema (`temas/<id>/`). Exemplo da base usa o tema pelo papel (`marca`, `sobre`), nunca pelo nome." O nome de pacote `@wicomm/…` é exceção declarada enquanto o pacote tiver esse nome.
- A abertura do `CLAUDE.md` e do `README.md`: o design system dos apps React, com o tema Wicomm como o tema dos apps da empresa.
- A guarda nova do gate (fatia 4).

### Q846 · A base deixa de falar da Wicomm
- **O caso:** a regra do `CLAUDE.md` deste repositório manda a base (as três normas de design que o designer e o crítico leem) falar só da Wicomm. Para o núcleo ser genérico, a base passa a não citar marca nenhuma, e a Wicomm vira o tema que preenche os valores (a cor, a fonte, o logotipo). As regras não mudam de sentido; muda a prosa e saem os valores.
- **Se você não decidir:** as fatias 1 a 3 entram e a base segue dizendo "Wicomm". O núcleo funciona com outro tema, mas a norma que ele carrega fala de outra empresa.
- **Recomendação:** aprovar. Sem isso, "genérico" fica só no código.

### Q847 · Onde o código mora, e a marca em repositório pessoal
- **O caso:** a Q845 pediu confirmar se a empresa aceita a marca Wicomm num repositório pessoal (o kit está no seu GitHub pessoal; este repositório é da org `wicomm-projects`). O marketplace do Claude Code instala plugin de subpasta de outro repositório (`git-subdir`, conferido no binário instalado). Então o `ichikawa-kit` lista `design-system` e `tema-wicomm` com o código ficando aqui, na org: no repositório pessoal entra só a linha que aponta. Quem instala precisa de acesso ao repositório da org; você tem, alguém de fora não.
- **Se você não decidir:** as fatias seguem aqui do mesmo jeito; espera só o item do kit que adiciona os dois plugins ao `ichikawa-kit`.
- **Recomendação:** o código fica na org e o kit aponta por `git-subdir`. A marca não sai da empresa, e a consulta à empresa deixa de ser necessária para este passo. Levar o núcleo genérico para o repositório pessoal, para abri-lo a outras pessoas, é decisão à parte e aí pede o ok da empresa: o núcleo foi feito na Wicomm.

## 6. Pronto quando
- As cinco fatias mergeadas, com `npm test` verde e a contagem de testes conferida em cada uma.
- Um tema de teste com outra cor gera tokens e registro sem nenhum arquivo do núcleo mudar (teste no gate).
- `fonte/` e `dist/` dos tokens e o que o `shadcn add` grava iguais aos de hoje com o tema Wicomm.
- `design-system:migrar` num projeto de teste deixa `design-system` + `tema-wicomm` ligados, o `wicomm` desligado, a guarda rodando uma vez só.
- Base sem "Wicomm" (depois da Q846), com a guarda no gate.

## Assumido, a confirmar
- Os nomes dos pacotes npm, o host do ateliê, a chave DTCG `com.wicomm`, a chave `wicomm-barra` e o nome `design/wicomm.json` nos projetos que já o têm ficam como estão.
- Os neutros, a escala e a fonte de medida são do sistema, não do tema.
- A utilitária da fonte leva o nome que o tema declara; sem apelido genérico.
- O registro continua na `v0.1.0`, com as correções de peça chegando na mesma URL, como hoje.
- O arquivo de projeto novo se chama `design/design-system.json`.
