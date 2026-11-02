# Plano — F343 · Plugin opcional de performance

Decisão: [ADR 0016](../adr/0016-performance-e-um-plugin-opcional-do-kit.md).

## Escopo
- `plugins/kit-performance`: `praticas.json` (31 práticas, camada, tipo), 4 skills por camada, agente `revisor-de-performance` só leitura.
- Marketplace, README, guia (`primeiro-dia`, `comandos`, `ligar-e-desligar#kit-performance`).
- `revisar-diff` (plugin `processos`) lança o revisor quando ele existe na sessão.
- `kit doutor` confere a seção `performance` do `kit.json` (`cli/performance.mjs`).
- Testes: `test/kit-performance.test.mjs` (catálogo × skills, revisor só leitura, marketplace, `iniciar` não liga, doutor) e a lista do marketplace em `test/cli.test.mjs`.

## Fora do escopo
- Renomear o marketplace (Q844, decisão aberta).
- Mudar o crítico do `kit-design` (contraproposta no ADR: ele não cobra performance).
- Trava que cobre o revisor antes do PR.
- As lacunas de performance de projetos que usam o kit: sugestão à orquestradora de cada um depois do merge.
- Subir a versão dos plugins (a orquestradora sobe no lote).

## Assumido, a confirmar
- O plugin nasce desligado no `kit iniciar`/`adotar` (o pedido diz "a pessoa decide o que instalar").
- `cache-de-dados`, `servidor-perto-do-banco` e `load-balancing` são `decisao`; o resto é `regra`.

## Pronto quando
`claude plugin validate plugins/kit-performance --strict` e `claude plugin validate .` passam; testes afetados verdes; ADR e guia no PR.
