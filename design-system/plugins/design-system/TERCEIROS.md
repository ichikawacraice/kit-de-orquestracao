# Material de terceiros no plugin `design-system` (antes `wicomm`)

## anthropics/knowledge-work-plugins — plugin `design`

- **Origem:** [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins), pasta `design/skills/`, conferida em 02/11/2026 (`main @ 2574e29`).
- **Licença:** Apache License 2.0 — cópia em [`licencas/knowledge-work-plugins-APACHE-2.0.txt`](licencas/knowledge-work-plugins-APACHE-2.0.txt). O repositório não tem arquivo `NOTICE`.
- **O que se aproveitou, e o que mudou:**

| Original | Aqui | Mudanças |
|---|---|---|
| `design/skills/accessibility-review` | skill [`acessibilidade`](skills/acessibilidade/SKILL.md) e regras `ACES-01` a `ACES-05` da base (CONVENCOES §8) | reescrita em PT-BR; cada critério ligado a uma regra da base; contraste medido pelos tokens nos dois temas; alvo de toque corrigido para o critério AA 2.5.8 (24px) — o original dava o 2.5.5 (44px, AAA) como AA; sem conectores (Figma, gestor de tarefas) |
| `design/skills/ux-copy` | skill [`textos-de-interface`](skills/textos-de-interface/SKILL.md) e regras `MSG-07` a `MSG-09` da base (ANATOMIA §4) | reescrita em PT-BR; presa à matriz de mensagens (MSG-01) e ao glossário do projeto (CONV-12); erro em duas partes; *Cancelar* mantido como padrão do kit; sem notas de localização |
| `design/skills/design-system` (só a auditoria) | skill `auditar-projeto` (estados de cada peça sem par) | uma coluna a mais na tabela de peças; o resto já existia (tokens, deriva, peças do registro) |

O restante do plugin `design` (`design-critique`, `design-handoff`, `research-synthesis`, `user-research`) não entrou: a crítica do plugin (`critico-de-ui`) cobre a primeira, e as outras estão fora do processo de hoje.
