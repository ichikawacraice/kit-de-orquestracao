# ADR 0006 — O diário tem uma entrada por arquivo

- Data: 2026-10-26
- Status: Aceito (Q372, operador, 2026-10-26)
- Autor: sessão planejadora do kit (P2), a pedido da orquestradora do kit; o operador aprovou trazer o formato do Izanagi sem desenhar outro (Q372)
- Relacionados: traz para o kit o ADR 0399 do Izanagi ("O diário tem uma entrada por arquivo", PR 1178); ADR [0002](0002-processos-de-documento-e-design-sao-plugins-opcionais.md) (o plugin `processos` e o gate de documentos)

<a id="contexto"></a>
## Contexto
- O kit ensina a todo projeto que a narrativa vai em `docs/diario/AAAA-MM.md`, um arquivo por mês, e que a entrada nova vai no FIM da última parte (bloco `kit:documentos` do `CLAUDE.md`, skill `spec-driven`, modelo do roadmap). Dois PRs abertos ao mesmo tempo escrevem, então, na mesma linha do mesmo arquivo, e o segundo a entrar conflita.
- No Izanagi, que segue essa regra, a medição de 26/10 sobre os 150 últimos merges da `develop` achou 67 pares de merges vizinhos em conflito; o diário estava em 55 deles e era o único arquivo em conflito em 24. Cinco PRs já validados voltaram para rebase só por isso no mesmo dia. O Izanagi aprovou o ADR 0399 e passou a escrever cada entrada num arquivo próprio.
- Todo projeto que instala o kit herda o mesmo conflito enquanto o modelo ensinar o apêndice no arquivo do mês.

<a id="decisao"></a>
## Decisão
1. **Cada entrada nova do diário é um arquivo próprio, numa pasta do mês:** `<documentos.diario>/AAAA-MM/DD-<ancora>.md`. `DD` é o dia da entrada, com dois dígitos; `<ancora>` segue `[a-z0-9-]+` (minúsculas, sem acento, com hífen). O arquivo declara `<a id="<ancora>"></a>` na linha acima do título.
2. **O link do roadmap mantém o desenho:** `· [detalhe](diario/AAAA-MM/DD-<ancora>.md#<ancora>)`. A âncora fica no link para que a regra `linha-do-roadmap` confira os dois formatos do mesmo jeito.
3. **O acervo não muda.** Os `AAAA-MM.md` e `AAAA-MM-parte-N.md` que um projeto já tem ficam como estão, com o orçamento de bytes valendo para eles, e os links que já apontam para eles continuam valendo.
4. **Um item, uma entrada.** O item que cresce depois do merge ganha entrada nova (outro dia, outra âncora); a entrada mergeada não se reescreve. Dentro do mesmo PR, edita-se à vontade.
5. **Não há índice do mês.** Um `README` por pasta voltaria a ser o arquivo que todo PR edita. O índice é o roadmap; a pasta, em ordem de dia, é a leitura cronológica. O `docs/diario/README.md` do modelo explica o formato e não lista meses.
6. **O gate confere o formato** (regra `tamanho-do-diario`, que mantém o nome para não quebrar o `documentos.conferir` nem a opção `conferir_tamanho_do_diario` de quem já usa): na pasta do mês, nome no formato, arquivo não vazio, até `orcamentos.diarioEmBytes`, `<a id>` igual à âncora do nome; e reprova arquivo único (`AAAA-MM.md` ou parte) de mês POSTERIOR ao primeiro mês que já tem pasta.
7. **Onde o kit difere do Izanagi:** o Izanagi fixa o fim do acervo em `2026-10-parte-5.md`. O kit serve projetos com acervos diferentes, então não fixa data: o corte é o primeiro mês com pasta, medido no próprio projeto. Projeto que ainda não tem pasta nenhuma não é reprovado pelo formato antigo; a primeira entrada no formato novo liga a trava.

<a id="alternativas"></a>
## Alternativas consideradas
- **A orquestradora escreve o diário no merge.** Recusada (como no Izanagi): a narrativa é de quem fez o trabalho; poria um passo de escrita em Opus no caminho de todo merge e a entrada sairia fora da validação do PR.
- **`merge=union` no `.gitattributes`.** Recusada: quem decide se o PR entra é o servidor do GitHub, sem garantia de que aplique o driver, e a união de dois apêndices não garante ordem nem fronteira das entradas.
- **Uma pasta só, sem o mês; ou o número do PR no nome.** Recusadas: mil arquivos numa pasta perdem o "quando"; o número do PR só existe depois de abrir o PR, e o roadmap da branch já precisa do link antes.
- **Migrar o acervo.** Recusada: reapontaria links em ADRs mergeados (imutáveis) sem ganho; o conflito é só no fim do arquivo que cresce.
- **Fixar no kit um mês de corte em configuração (`documentos.diarioPorEntradaDesde`).** Recusada: é uma chave a mais que cada projeto teria de preencher, e o primeiro mês com pasta já diz a mesma coisa sem configuração.
- **Renomear a regra para `formato-do-diario`.** Recusada: quebraria o `documentos.conferir` dos projetos e a opção do plugin; o nome antigo continua verdadeiro (o tamanho segue conferido).

<a id="consequencias"></a>
## Consequências
- **Melhor:** dois PRs nunca escrevem no mesmo arquivo do diário; cada entrada custa a própria leitura, não a de 150 KB.
- **Pior:** no mês da transição a leitura cronológica fica em dois lugares (o arquivo do mês e a pasta). A trava não pega uma parte nova (`-parte-N`) criada no mesmo mês da primeira pasta: o gate não sabe quais partes já existiam sem olhar o git.
- **Passamos a ter que:** escrever a entrada nova num arquivo novo e conferir que a âncora do nome é a do link do roadmap. Os projetos que já instalaram o kit recebem o bloco `kit:documentos` novo pelo `kit atualizar` (o bloco sobe de versão).
