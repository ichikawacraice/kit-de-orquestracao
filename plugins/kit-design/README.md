# Plugin `kit-design` — sucedido pelo `design-system`

O processo de design do kit agora é o plugin `design-system@ichikawa-kit`: o mesmo designer, o crítico de UI com nota e a guarda que cobra a crítica, com a base (direção de design, anatomia, convenções) e sem marca nenhuma. O `kit-design` fica no marketplace só até a troca rodar, e sai depois.

**Trocar:**
- **Na conta:** o `atualizar-plugins` instala o `design-system` com as opções do `kit-design` (as quatro têm o mesmo nome: `guarda`, `cobrar_critica`, `pasta_do_front`, `largura`), desligado se o velho estava, e só então desinstala o `kit-design`. Rode antes com `--seco` para ver o que muda.
- **Em cada projeto:** o `kit atualizar` passa o valor de `kit-design@ichikawa-kit` para `design-system@ichikawa-kit` no `enabledPlugins` do `.claude/settings.json` e deixa o velho `false`. O `--simular` mostra sem gravar; o `settings.local.json` é seu e só ganha aviso.
- **A seção `design` do `.claude/kit.json`** continua valendo: o `design-system` a lê quando o `design/design-system.json` do projeto não diz a chave.
- **Os nomes:** `design-system:designer`, `design-system:critico-de-ui` e as skills `design-system:revisao-de-arquitetura-de-ui` e `design-system:critica-de-ui`. As travas do kit aceitam o `kit-design:` durante a transição.

Os dois ligados no mesmo projeto rodam a guarda duas vezes: deixe o `kit-design` desligado onde o `design-system` está.
