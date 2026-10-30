---
name: auditar-projeto
description: Audita, só lendo, um app React existente contra a base Wicomm e grava a auditoria com os números de deriva (cores literais, valores arbitrários, tamanhos de fonte, raios, alturas, ícones, animação sem escape), a anatomia (casco, arquétipo de cada rota, onde mora cada mensagem), o mapa das peças do projeto para as do registro e uma nota por eixo nas telas mais usadas. Use antes de padronizar um projeto que não nasceu no sistema ("audita o projeto", "quanto este app foge do padrão Wicomm", "mede a deriva", "diagnóstico de design do app", `/wicomm:auditar`). Não muda nada no projeto; o plano de padronização é a skill seguinte.
---

# Auditoria de projeto existente

Mede quanto um app React se afasta da base Wicomm (`${CLAUDE_PLUGIN_ROOT}/base/`), com número e arquivo:linha, para o `plano-de-padronizacao` decidir as fatias. **Só lê**: nada de instalar, rodar build, codemod ou escrever no projeto auditado — a auditoria é gravada **no repositório de quem pediu** (por padrão `docs/design/auditoria-AAAA-MM-DD.md`; se o projeto auditado só pode ser lido, grave fora dele e diga onde).

O trabalho pesado vai ao subagente `auditor-de-padrao` (só leitura, contexto limpo); você grava o arquivo com o que ele devolver. Se você **é** o `auditor-de-padrao`, faça as medidas abaixo e devolva o texto no formato da entrega, sem gravar.

## 0. Pare se não for app React

Loja FastStore, VTEX ou Wake está fora do escopo (Q627): diga isso e pare. O script do passo 1 diz (`stack.loja`).

## 1. Números de deriva (script)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-deriva.mjs" <raiz> --pasta <front>
```

Dá, em markdown: o stack (React, framework, Tailwind e se é v3 — o sistema é só v4, então v3 vira a primeira fatia do plano —, shadcn e o estilo), quantos arquivos de tela, **valor solto por categoria** (cor literal CONV-04, valor arbitrário PRIN-06, duração e curva soltas MOV-01, ícone de fora CTRL-09) com os piores arquivos, **ícones por biblioteca**, **tamanhos de fonte, raios e alturas distintos** (a base tem 7 papéis de tipo, a escala de raio e a de controle 26/30/36/44 — CTRL-01), **animação sem escape** (MOV-02) e as **peças da pasta ui**. Cole a saída inteira; `--json` serve para comparar duas auditorias.

## 2. O que o script não mede (o auditor mede lendo)

- **Contraste:** os pares de token de texto × fundo nos dois temas, contra o piso (COR-12). Sem os tokens resolvidos em hex, diga que não mediu.
- **Casco** (CASCO-01): tem barra lateral? cabeçalho? trilha nas telas de detalhe (CASCO-03)? um menu só (CASCO-02)? onde fica a ação primária?
- **Anatomia:** cada rota classificada num arquétipo da ANATOMIA (ARQ-01) ou "nenhum", numa tabela *rota · arquétipo · observação*.
- **Mensagens:** onde moram erro, sucesso, aviso e espera (MSG-01): toast para tudo? erro longe do bloco (MSG-04)? mais de uma faixa (MSG-02)?
- **Peças:** cada componente da pasta ui (e os repetidos fora dela) mapeado para a peça da base (ANATOMIA, PECA-01): **igual** · **equivalente** (API diferente) · **sem par**.
- **Nota por eixo** nas **5 telas mais usadas** (pergunte quais; sem resposta, as 5 rotas com mais código): os eixos da crítica (skill `critica-de-ui`: seis, e o sétimo, cara de site, quando o produto é de uso eventual), de 0 a 5, com uma linha de evidência por eixo. É amostra: diga que é.

## 3. A entrega (formato fixo)

```markdown
# Auditoria Wicomm — <projeto> (AAAA-MM-DD)
Base: <versão da base do plugin> · Front: <pasta> · Só leitura

## Resumo            (3 a 5 linhas: o tamanho da deriva e o que pesa mais)
## Stack             (React, framework, Tailwind v3/v4, shadcn, ícones)
## Números de deriva (a saída do medir-deriva)
## Contraste
## Casco
## Rotas e arquétipos (tabela)
## Mensagens
## Peças             (tabela: peça do projeto · peça da base · igual/equivalente/sem par)
## Notas por tela    (tabela: tela · hierarquia · densidade · consistência · ruído · ação · aderência · [cara de site] · total/30 ou /35)
## O que não foi medido, e por quê
```

Termine propondo o `plano-de-padronizacao` sobre esta auditoria.
