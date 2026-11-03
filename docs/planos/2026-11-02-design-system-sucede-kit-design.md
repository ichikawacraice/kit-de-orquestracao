# F353 · O design-system toma o lugar do kit-design

Decidido pelo operador: um processo de design só, no `design-system` (Q631); a marca no repositório da empresa, o kit aponta por git-subdir (Q845, Q847); com a base sem marca, o `design-system` entra no lugar do `kit-design` e o `tema-wicomm` só nos projetos internos (Q859). A base ficou sem marca no commit `e8b0b175…` da `main` do repositório da empresa (fatia 4 do F345 de lá).

## Premissas conferidas
- **As opções têm os mesmos nomes** (`guarda`, `cobrar_critica`, `pasta_do_front`, `largura`), medido no `plugin.json` do `design-system` em `e8b0b17`.
- **O `design-system` já herda o que o `kit-design` deixou:** as opções gravadas para `kit-design@*` em `pluginConfigs` valem enquanto o nome novo não tem as suas, e a seção `design` do `.claude/kit.json` vale quando o `design/design-system.json` não diz a chave (`hooks/config.mjs` de lá). Levar as opções no `--config` do install é cinto e suspensório: o `uninstall` do velho pode apagar a entrada dele.
- **O `design-system:migrar` de lá é outra migração:** troca o plugin `wicomm@wicomm` pelo `design-system` + `tema-wicomm` no projeto. Não toca `kit-design`; as duas só concordam em ligar `design-system@ichikawa-kit`, o que é idempotente. O `design-system` só cede ao `wicomm` (não ao `kit-design`): com os dois ligados, a guarda roda em dobro — por isso a troca desliga o velho no mesmo passo.
- **O estado real:** a conta tem `kit-design@ichikawa-kit` no escopo user (ligado, sem opções gravadas) e um projeto com cópia de escopo project.
- **O `kit iniciar` ligava o `kit-design` em todo projeto** (`PLUGINS_DO_KIT`), inerte sem `design.pasta`. O `design-system` fica no mesmo lugar, com a mesma inércia.

## Escolha: o `kit-design` fica no marketplace, como apontador, até a troca rodar
Tirar a entrada e a pasta agora é o que o F332 fez com o `design`. O risco: quem tem o `kit-design` e atualiza o marketplace antes de rodar a troca fica com um plugin que o marketplace não lista mais (o comportamento do app nesse caso não está medido). Mantido, ele segue funcionando até a troca, e a troca (conta e projeto) acontece sem pressa. O custo é um item de limpeza depois que a troca rodar na conta e nos projetos.
- A descrição e o README do `kit-design` dizem que o sucessor é o `design-system` e como trocar.
- Os dois ligados no mesmo projeto rodariam a guarda duas vezes: a troca deixa o velho `false` no projeto e o tira da conta. Fazer a guarda do `kit-design` ceder não adianta: a cópia da conta nunca recebe a versão nova, porque o `atualizar-plugins` a troca em vez de atualizá-la.

## Escopo
1. `marketplace.json`: as duas entradas no `sha` `e8b0b175998242174a0fd0dcbe401ce92ea5b46e`; o guia diz como subir (já dizia; ganha o passo de conferir o `name`).
2. **Conta** (`atualizar-plugins`): o `kit-design` de escopo user dá lugar ao `design-system` (install com as opções do velho, desligado se o velho estava, só então o uninstall do velho); `--seco` mostra sem fazer. O plugin novo de origem remota se confere pela presença na lista, não pela versão.
3. **Projeto** (`kit atualizar`): no `enabledPlugins` do `.claude/settings.json`, `design-system@ichikawa-kit` recebe o valor do `kit-design@ichikawa-kit` (se ainda não está lá) e o velho fica `false` (a conta pode ainda tê-lo ligado). Conflito se o `design-system` já vem de outro marketplace. O lock acompanha. `kit iniciar`/`adotar` ligam o `design-system` no lugar do `kit-design`. Backup: o `kit atualizar` já grava pelo `gravar` e tem `--simular`.
4. **Tema:** `design.tema` no `.claude/kit.json` (o nome do plugin, `tema-<marca>`) pede `tema-<marca>@ichikawa-kit`; `kit adotar` e `kit atualizar` o ligam no `.claude/settings.json` do projeto, `kit doutor` confere. Tema que o marketplace não lista é aviso, não liga.
5. **Nomes:** onde o kit cita o agente ou a skill de design, o padrão vira `design-system:`; o `kit-design:` segue aceito nas travas (`semPrefixoDoKit`, guarda) e nas skills da etapa `design`.

## Fora do escopo
- Trazer o código do `design-system` e do `tema-wicomm` para este repositório: o operador decidiu trazer o repositório da empresa inteiro, com histórico, num item próprio (Q861).
- Tirar o `kit-design` do marketplace e a pasta dele: item seguinte, depois que a troca rodar na conta e nos projetos.
- Instalar na conta e rodar a troca no estado real: depois do merge, com o ok do operador (a orquestradora pergunta). O `atualizar-plugins` faz a troca na primeira execução sem `--seco`, então a primeira depois do merge precisa desse ok.
- O `settings.local.json` (é de cada pessoa): só aviso.

## Pronto quando
Testes afetados verdes, `claude plugin validate .` passa, validador sem achado que afete correção.
