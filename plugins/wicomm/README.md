# Plugin `wicomm`

O plugin do Claude Code de design system da Wicomm. Hoje só a **base** existe; o motor (designer, crítico, guarda), as skills e os comandos chegam na fatia F261.7 do [estudo](../../docs/estudo/F261-plugin-design-system.md).

## `base/`

| Arquivo | Responde | Códigos |
|---|---|---|
| [`DESIGN.md`](base/DESIGN.md) | como a tela parece | `MARCA`, `COR`, `TIPO`, `DENS`, `LAY`, `SUP`, `FORMA`, `CTRL`, `MOV`, `MED` |
| [`ANATOMIA.md`](base/ANATOMIA.md) | o que vai onde | `PRIN`, `CASCO`, `ARQ`, `MSG`, `PECA`, `PESO`, `EST`, `MOVA` |
| [`CONVENCOES.md`](base/CONVENCOES.md) | como o código sustenta as duas | `CONV` |

No bootstrap de um projeto (`/wicomm:novo`), os três arquivos são copiados para `design/` com a versão estampada; o `/wicomm:atualizar` faz o merge de três vias quando a base muda.
