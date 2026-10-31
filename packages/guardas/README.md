# @wicomm/guardas

As guardas de design da Wicomm: testes que leem os arquivos do projeto e reprovam tela fora da base ([`plugins/wicomm/base/`](../../plugins/wicomm/base/)). Rodam no CI, com ou sem Claude, e ligam no dia 1 de um projeto que já existe pela **catraca**. Cada guarda cita pelo código a regra que confere (`SUP-02`, `CTRL-07`).

> **Privado, no GitHub Packages da org `wicomm-projects`.** Como instalar (o `.npmrc` e o token): [`docs/instalar-pacotes.md`](../../docs/instalar-pacotes.md).

## Uso

```bash
npx wicomm-guardas              # confere (o CI)
npx wicomm-guardas --iniciar    # cria a base com o estado de hoje (adoção num projeto existente)
npx wicomm-guardas --atualizar  # grava na base só o que DESCEU; comite a base no mesmo PR do conserto
```

Opções: `--raiz <dir>`, `--config <arquivo>`, `--so <id,id>`, `--json`. Sai `0` quando passa, `1` quando a catraca reprova e `2` em erro de uso.

Dentro da suíte do projeto (vitest, node:test, jest):

```ts
import { test } from 'vitest'
import { afirmarGuardas } from '@wicomm/guardas'

test('as guardas de design Wicomm', () => {
  afirmarGuardas() // lança com o relatório quando a catraca reprova
})
```

## A catraca

A base (`design/guardas.base.json`, versionada) guarda quantas violações cada arquivo tinha, por guarda. A conferência reprova:

- **violação nova** — arquivo ou guarda fora da base (projeto sem base é base zero);
- **contagem que sobe**;
- **contagem que desce sem a base regravada** — quem consertou roda `--atualizar` e comita a base no mesmo PR.

A conferência **nunca** escreve a base: no CI o arquivo reescrito se perderia, e o PR seguinte poderia voltar a violar até o número antigo. `--atualizar` só grava descida; o que subiu ou é novo continua reprovando. Piorar a base é editar o arquivo à mão, num PR que alguém revisa. `--iniciar` cria a base uma vez e recusa sobrescrever.

## Configuração

Na chave `guardas` de `design/wicomm.json`. Sem ela, vale o padrão de um app Next com `src/`:

```json
{
  "guardas": {
    "fontes": ["src"],
    "ignorar": [],
    "kit": "src/components/ui",
    "componentes": "src/components",
    "paginas": "src/app",
    "css": ["src/app/globals.css"],
    "aliases": { "@/": "src/" },
    "base": "design/guardas.base.json",
    "regras": {
      "a-tela-de-entrada-tem-o-botao-grande": { "telas": ["src/components/login/Entrada.tsx"] },
      "nada-de-vidro": { "ignorar": ["src/app/atelie/"] },
      "um-menu-so": { "excecoes": [{ "arquivo": "src/components/Lista.tsx", "motivo": "o hr separa conteúdo, não grupo de menu" }] },
      "o-vocabulario-da-tela": { "desligada": "o produto não tem palavra de código diferente da palavra da tela" }
    }
  }
}
```

Em `regras.<id>`, toda guarda aceita:

- `em` — restringe a varredura a pastas; `ignorar` — tira prefixos (soma ao `ignorar` global);
- `excecoes` — `[{ arquivo, motivo }]`: o arquivo sai da conta. **Exceção é permanente e tem motivo** (20 caracteres ou mais); dívida vai na base. Exceção cujo arquivo já não viola é erro (*exceção velha*), para a lista não envelhecer calada;
- `desligada` — o motivo, por escrito. `false` sozinho é erro.

E as opções próprias da guarda (a última coluna da tabela). Guarda que não achou o que examinar é **erro**, não verde (CONV-14): um caminho errado na configuração não deixa tudo passar.

## As guardas

| Guarda | Regras | O que reprova | Opções próprias |
|---|---|---|---|
| `a-aba-aberta-mora-na-url` | CONV-06 | A aba aberta mora no URL | — |
| `a-espera-nao-e-texto-solto` | EST-01 | A espera não é texto solto | `frases` |
| `a-marca-nao-carrega-texto` | MARCA-02, MARCA-05 | A marca não carrega texto, e o destrutivo não é preenchido | — |
| `a-tela-de-entrada-tem-o-botao-grande` | CTRL-02 | A tela de Entrada tem o botão grande | `telas`, `campos` |
| `a-tinta-clara-nao-vai-em-texto-pequeno` | COR-05, COR-12 | A tinta clara não vai em texto pequeno, e a voz tem a metade escura | `claro`, `denso` |
| `a-troca-de-vista-tem-uma-forma` | CTRL-06 | A troca de vista tem uma forma | — |
| `componente-que-ninguem-monta` | PRIN-05 | Componente que ninguém monta | — |
| `composicao-tem-grau` | PESO-02, FORMA-01, LAY-03, SUP-03 | A composição tem grau | `blocos`, `assuntos`, `paleta` |
| `confirmacao-e-dica-nunca-nativas` | CONV-10 | Confirmação e dica nunca nativas | — |
| `conteudo-mora-em-superficie` | SUP-04 | O conteúdo mora em superfície, e a superfície se declara | `superficies`, `niveis` |
| `estado-de-vista-nao-vai-ao-servidor` | CONV-06 | Estado de vista não vai ao servidor | — |
| `icone-de-uma-biblioteca` | CTRL-09 | Ícone de uma biblioteca só | — |
| `nada-de-vidro` | SUP-02 | Nada de vidro | — |
| `nenhum-botao-tem-reticencias` | CTRL-07 | Nenhum botão tem reticências | `botoes` |
| `nenhum-valor-solto` | CONV-04, PRIN-06, MOV-01 | Nenhum valor solto | — |
| `o-botao-de-24-so-em-linha` | CTRL-01 | O botão de 24px só mora em linha de lista | — |
| `o-carimbo-tem-forma` | CTRL-05, COR-03, COR-05 | O carimbo tem forma, e a voz sai do idioma de cor | `casco`, `idioma`, `naoSaoVoz` |
| `o-erro-de-submissao-alcanca-os-olhos` | CONV-09, MSG-04 | O erro de submissão alcança os olhos | `semCampo` |
| `o-irreversivel-pede-confirmacao` | PESO-02, CONV-10 | O irreversível pede confirmação | `hooks`, `funcoes` |
| `o-movimento-tem-escape` | MOV-02 | O movimento tem escape | — |
| `o-rotulo-tem-duas-vozes` | TIPO-02 | O rótulo tem duas vozes, e nenhuma se escreve à mão | — |
| `o-texto-da-tela-nao-cita-documento` | MSG-05, CONV-11 | O texto da tela não cita documento | — |
| `o-titulo-da-pagina-e-um-so` | TIPO-04 | O título da página é um só, e é h1 | `voz` |
| `o-vocabulario-da-tela` | CONV-12 | O vocabulário da tela | `glossario` |
| `os-tokens-pagam-o-piso` | COR-12, COR-11, MARCA-01 | Os tokens pagam o piso de contraste | `temas` |
| `toda-tela-de-detalhe-tem-trilha` | CASCO-03 | Toda tela de detalhe tem trilha (no Editor, a `BarraDoEditor` com a volta) | `trilha`, `voltas`, `niveis` |
| `um-menu-so` | CASCO-02 | Um menu só, o do kit | — |

Fica para depois: `o-raster-da-marca-sai-do-token` (MARCA-04), que confere pixel de favicon e de lockup contra o token e depende dos scripts de raster da marca.

**Só Tailwind v4** (Q640): nenhuma guarda lê `tailwind.config`. A cor de tema e o piso de contraste se leem das variáveis CSS (`:root` e `.dark`) das folhas da configuração e do `@wicomm/tokens` que elas importam.

`nenhum-botao-tem-reticencias` lê a árvore do TypeScript: o pacote traz o `typescript` 5.9 como dependência própria (o 7 não tem a API em JavaScript), sem depender da versão do projeto.

## Testes

```bash
npm test -w @wicomm/guardas
```

- `violacoes.test.mjs` — o fixture `limpo` passa em todas; o `violacoes` planta uma violação de cada guarda, e cada uma acusa a sua;
- `catraca.test.mjs` — violação nova, descida sem base regravada, `--atualizar`, subida, `--iniciar` e a linha de comando;
- `insumo.test.mjs` — projeto vazio, exceção velha, desligamento sem motivo, guarda inventada na configuração;
- `deteccao.test.mjs` — cada detector acusa o caso ruim e ignora o bom (CONV-16);
- `base.test.mjs` — toda regra citada existe na base, e toda guarda que a base cita existe aqui.
