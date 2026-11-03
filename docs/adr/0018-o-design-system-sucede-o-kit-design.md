# ADR 0018 — O `design-system` sucede o `kit-design`, e o tema liga pelo `kit.json` do projeto

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F353, a partir das decisões do operador Q631, Q845, Q847, Q859 e Q861
- Relacionados: [ADR 0002](0002-processos-de-documento-e-design-sao-plugins-opcionais.md) (processos de documento e de design são plugins próprios); [ADR 0017](0017-o-marketplace-se-chama-ichikawa-kit.md) (o marketplace e a troca de nome); plano em [`docs/planos/2026-11-02-design-system-sucede-kit-design.md`](../planos/2026-11-02-design-system-sucede-kit-design.md); guia em [`docs/guia/ligar-e-desligar.md#design-system`](../guia/ligar-e-desligar.md#design-system)

<a id="contexto"></a>
## Contexto
- O kit tinha dois processos de design: o `kit-design` (deste repositório) e o `design-system` (do repositório da empresa, listado por git-subdir desde o F350). O operador decidiu ficar com um só, o `design-system` (Q631), assim que a base dele ficasse sem marca (Q859). Isso aconteceu no commit `e8b0b175998242174a0fd0dcbe401ce92ea5b46e` da `main` de lá.
- Os dois têm o mesmo designer, o mesmo crítico e a mesma guarda, com opções de mesmo nome (`guarda`, `cobrar_critica`, `pasta_do_front`, `largura`). O `design-system` lê as opções gravadas para `kit-design@*` e a seção `design` do `.claude/kit.json`, mas só cede ao `wicomm`, não ao `kit-design`: com os dois ligados, a guarda roda duas vezes.
- O estado real: a conta tem o `kit-design` no escopo user e um projeto tem uma cópia de escopo project. O `kit iniciar` ligava o `kit-design` em todo projeto.
- O código dos dois plugins segue no repositório da empresa: trazê-lo com histórico é um item próprio (Q861).

<a id="decisao"></a>
## Decisão
1. **O marketplace aponta o `design-system` e o `tema-wicomm` no commit `e8b0b17`,** os dois no mesmo `sha`. Para subir a fixação, o guia dá o passo: `git ls-remote`, conferir o `name` de cada `plugin.json` nesse commit, trocar os dois `sha` e o do teste.
2. **O `kit-design` fica no marketplace como apontador até a troca rodar,** com a descrição e o README apontando o sucessor. Ele sai num item seguinte.
3. **A conta troca pelo `atualizar-plugins`:** o `design-system` entra com as opções do `kit-design`, desligado se o velho estava, e só então o velho sai. Com `--seco`, só mostra. O novo, de origem remota, se confere pela presença na lista.
4. **O projeto troca pelo `kit atualizar`:** o `design-system@ichikawa-kit` recebe o valor do `kit-design@ichikawa-kit`, e o velho fica `false`, porque a conta pode ainda tê-lo ligado. O `design-system` de outro marketplace é conflito. O lock acompanha, para o `kit remover` tirar só o que o kit pôs. O perfil que desliga o `kit-design` desliga também o `design-system`. O `kit iniciar` e o `kit adotar` ligam o `design-system`.
5. **O tema liga pelo `.claude/kit.json`:** `design.tema` com o nome do plugin (`tema-<marca>`). O `kit adotar` e o `kit atualizar` o ligam no `.claude/settings.json` do projeto, e o `kit doutor` confere e avisa se a conta liga um tema. Tema que o marketplace não lista não liga. Sem a chave, nada liga: o `tema-wicomm` vem desligado por padrão, e em app externo é melhor não ativá-lo.
6. **O nome novo é o padrão:** `design-system:designer` e `design-system:critico-de-ui`. As travas, a cobrança da crítica e as skills da etapa `design` aceitam o `kit-design:` durante a transição.

<a id="alternativas"></a>
## Alternativas consideradas
- **Tirar o `kit-design` do marketplace agora, como o F332 fez com o `design`.** Rejeitada: quem atualizasse o marketplace antes de rodar a troca ficaria com um plugin que o marketplace não lista mais, e o comportamento do app nesse caso não está medido. O apontador custa um item de limpeza.
- **Fazer a guarda do `kit-design` ceder quando o `design-system` está ligado.** Rejeitada: a cópia da conta nunca recebe essa versão, porque o `atualizar-plugins` a troca em vez de atualizá-la. Desligar o velho no projeto resolve em qualquer estado da conta.
- **Apagar a chave do `kit-design` no projeto em vez de deixá-la `false`.** Rejeitada: com a conta ainda ligando o velho, o projeto voltaria a rodar as duas guardas.
- **Ligar o tema pelo `enabledPlugins` à mão, sem chave no `kit.json`.** Rejeitada: o `kit.json` já é o lugar do time para o design (A7), e o doutor só confere o que está declarado.
- **`design.tema` com a marca solta (`"wicomm"`).** Rejeitada: o nome do plugin é mais claro e é a única forma da marca que o detector de nome privado aceita fora da entrada do tema.
- **Copiar o código dos plugins para este repositório já neste item.** Rejeitada pelo operador (Q861): o subtree com histórico, num item próprio, criaria os mesmos caminhos.
