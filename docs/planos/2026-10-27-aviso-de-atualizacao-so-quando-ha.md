# Plano · o aviso de atualização e de reinício só aparece quando há o que fazer (F209)

Base: `main` em `d424817`. Origem: pedido do operador depois do F207 — "a parte de 'atualização baixada' e 'pode reiniciar o app' só devem aparecer quando necessário".

## Medido (d424817)
- O topo do pane (`register.tsx`, desktop por `reinicioSvg` em `desenho.ts`, terminal por `Text`) mostra **sempre** a linha do reinício (`Pode reiniciar o app · conferido às…`, `Reiniciar: espere · N rodando`, `Reiniciar: não sei`) e, desde o F207, a linha azul `↑ Atualização baixada · app X, motor Y`.
- `painel pode-reiniciar` (`pode-reiniciar.mjs`, `lerAtualizacao`) já sabe o que espera reinício do lado do **app** (ShipIt) e do **motor** (`claude-code` na pasta do app × versão nos processos). Dos **plugins do kit** não sabe nada.
- Versão instalada dos plugins: `~/.claude/plugins/installed_plugins.json` (escopo `user`, `version` e `lastUpdated` por plugin). O app carrega os plugins quando abre: plugin com `lastUpdated` depois do início do processo do app (`ps -o lstart`, linha que termina em `Claude.app/Contents/MacOS/Claude`) ainda não vale.
- Versão publicada: o `plugin.json` de cada plugin no `main` do repositório do marketplace. O clone fica em `~/.claude/plugins/marketplaces/kit-de-orquestracao`; `git fetch origin main` + `git show FETCH_HEAD:<caminho>` lê sem mexer na árvore do clone.
- O clique pelo mod: `$.process.run(['node', <installPath do orquestracao>/skills/orquestradora/scripts/atualizar-plugins.mjs, '--json'])`. O processo de plugins do app herda o `PATH` do login (medido: `ps eww` do `Claude Helper (Plugin)` traz o `~/.nvm/.../bin` onde está o `claude`). O script já confere que a instalada ficou igual à publicada e sai 1 quando não pegou.

## Os três estados
1. **Há atualização do kit para baixar** (publicada > instalada): linha `↓ Atualização do kit · orquestracao 0.1.71` com o botão `Atualizar`. O clique mostra `Atualizando…` na hora; feito → a linha some, toast com as versões e a conferência roda de novo (entra o estado 2); falhou → a linha fica com o motivo, `Tentar de novo`, toast e a faixa "Ação não concluída".
2. **Algo instalado esperando reinício** (app baixado, motor novo, plugin do kit instalado depois que o app abriu): a linha do reinício de hoje (pode / espere / não sei, `Me avise`), com a linha azul `↑ … · reinicie o app para aplicar` listando as versões.
3. **Nada pendente:** nada do reinício aparece no pane. Exceção: com o aviso `Me avise` ligado o bloco fica (o operador pediu; ele se desliga sozinho como hoje).

Os estados 1 e 2 podem coexistir (app baixado e kit para baixar): aparecem as duas linhas.

## Partes
- **A · script** (`pode-reiniciar.mjs`, `painel.mjs`): `atualizacao.plugins` (instalado depois do início do app) e `paraBaixar` (publicada > instalada, lida com cache de 30 min em `batida/kit-publicado.json`, para não ir à rede a cada leitura do pane). Rede fora do ar → sem `paraBaixar` e a próxima tentativa na janela seguinte.
- **B · mod**: gate dos três estados no desktop e no terminal; botão `Atualizar` com estado visível; trava entre sessões em `batida/atualizando-kit.json` (10 min).
- Teste antes do código nas duas partes.

## Fora do escopo
- Baixar o app ou o motor (o Claude baixa sozinho; entram direto no estado 2).
- A barra acima do prompt (já só fala com o aviso ligado).

## Assumido, a confirmar
- "Para baixar" são só os plugins do kit (`orquestracao`, `painel-sessoes`, os outros do marketplace com escopo `user`).
- Instalado depois do início do app = ainda não vale (régua `lastUpdated` × início do app).
- Com o aviso ligado e nada pendente, o bloco do aviso fica até desligar.
