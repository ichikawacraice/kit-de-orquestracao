# ADR 0033 — Sem teto de donas trabalhando ao mesmo tempo

- Data: 2026-11-06
- Status: Proposto
- Autor: sessão dona do F471, a partir do pedido do operador de 06/11 ("a F468 está sem sessão provavelmente por limite de donas, pode remover esse limite")
- Relacionados: [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (uma dona por item); [ADR 0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) e [ADR 0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) (o teto de núcleos dos testes)
- Substitui: o item 5 da Decisão do [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) ("no máximo 4 donas trabalhando ao mesmo tempo, 3 com a máquina cheia"). O resto do 0011 fica como está.

<a id="contexto"></a>
## Contexto
- O item 5 do ADR 0011 limitava a 4 as donas trabalhando por projeto (3 com a máquina cheia); o item além do teto esperava na fila, sem sessão e sem cobrança.
- Em 06/11 o F468, item do operador, ficou sem dona porque as 4 vagas estavam ocupadas. O operador não via a espera: o item parecia esquecido.
- **O que protege a máquina é o teto de núcleos dos testes** (ADR 0005 e 0008): todo teste de toda sessão divide as fichas, e o que não cabe espera a ficha. Dona escrevendo código ou esperando revisão quase não gasta CPU; o número de donas não mede carga.
- **O que a "máquina cheia" fazia além de baixar o teto de 4 para 3:** nada no código de hoje: era a única leitura de `maquinaCheia` no ritual da orquestradora (o despacho de `validacao` e as vagas de E e V do ADR 0005 já saíram com o pool, ADR 0012). Quem segura o teste com a máquina cheia é a ficha do `com-fichas`.

<a id="decisao"></a>
## Decisão
1. **Não há teto de donas trabalhando.** A orquestradora abre a dona de todo item que nasce, e o ritual cobra todo item sem dona, sem contar quantas já trabalham.
2. **O limite de concorrência é o dos testes:** o teto de núcleos (`gate/com-fichas.mjs`, `protocolo.md#teto-de-nucleos`) fica como está. Dona que roda teste com a máquina cheia espera a ficha.
3. **A orquestradora pode manter dona em espera ou parada** (item em `espera`, esperando o operador, ou dona sem turno) sem que ela conte contra nada.
4. **Compatibilidade:** `KIT_TETO_DE_DONAS`, se alguém a definiu, é ignorada sem erro. Saem `tetoDeDonas` e `donaTrabalhando` de `sem-dona.mjs`. A batida não dependia do teto (`vagas` é o item sem dona há `ESPERA_MIN`).

<a id="alternativas"></a>
## Alternativas consideradas
- **Teto maior (8, por exemplo).** Recusada: só empurra o mesmo problema. O item 9 espera sem sessão e sem aviso, e o número continua sem relação com a carga real.
- **Teto só com a máquina cheia.** Recusada: a máquina cheia já é medida pelas fichas e pela carga, e já segura o teste novo. Segurar também a abertura da dona duplica o freio e atrasa o item que só precisa ler e planejar.
- **Sem teto (escolhida).** Um freio só, no recurso que de fato falta. Custo aceito: mais sessões abertas ao mesmo tempo (contexto e cota de uso do operador), que a orquestradora administra ao manter dona parada.

<a id="consequencias"></a>
## Consequências
- Nenhum item fica sem dona por contagem. Com muitas donas, os testes esperam mais pela ficha; o painel já mostra quem espera.
- Vale em outro projeto só depois de subir a versão do plugin.
