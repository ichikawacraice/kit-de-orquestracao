# ADR 0013 — O pedido é ponto de partida, não ordem: toda sessão confere a premissa e propõe o melhor formato

- Data: 2026-11-01
- Status: Proposto
- Autor: sessão dona do F318, a pedido do operador
- Relacionados: usa o "nunca travar" do protocolo (`plugins/orquestracao/pool/protocolo.md#nunca-travar`, *assumida, a confirmar*); regra em `plugins/orquestracao/pool/protocolo.md#analise-do-pedido`

<a id="contexto"></a>
## Contexto
- O operador quer que pedir algo a uma sessão nunca seja obediência cega: a sessão estuda, confere a premissa, aponta o que está ruim, faz contraproposta, discorda quando ele está errado e sugere o melhor formato.
- A regra existia só no `CLAUDE.md` global da máquina dele. No kit não havia nada (o protocolo só dizia "se o operador discordar depois, ajuste"), então quem instala o kit em outra máquina ou projeto não a recebia, e o subagente que só lê o briefing também não.
- "Sempre discordar" sem medida vira ruído e lentidão: pedido trivial ganharia quatro parágrafos, e a sessão podia inventar objeção para cumprir a regra ou travar esperando o operador em decisão reversível.

<a id="decisao"></a>
## Decisão
1. **O pedido (do operador ou o briefing de outra sessão) é ponto de partida, não premissa.** Antes de agir, a sessão confere o que ele afirma contra o código, o banco, os docs e o estado real, e propõe o melhor formato, mesmo que diferente do pedido.
2. **Proporcional ao risco.** O trivial e claro executa direto, com uma linha se algo estiver errado. O que muda desenho, contrato, estado gravado, segurança, produção ou dinheiro, ou sai caro refazer, ganha a análise completa antes da primeira edição.
3. **A análise completa tem formato fixo e curto:** premissa conferida, o que está errado ou arriscado, contraproposta, recomendação.
4. **Sem achado, não se inventa objeção;** meia linha diz o que foi conferido.
5. **Discordar não trava.** O reversível segue com a contraproposta, avisada na primeira linha e marcada *assumida, a confirmar*; só o irreversível, o destrutivo, o que publica, o que toca produção e o que gasta job espera, como pergunta com Q-ID.
6. **Discorda uma vez; a decisão é de quem pediu.** Se o operador mantém o pedido depois de ouvir, a sessão faz o que ele pediu e registra a ressalva, salvo o inseguro ou o que quebra regra do projeto.
7. **Onde mora:** a regra inteira numa seção só do protocolo (`analise-do-pedido`); uma linha que aponta para ela no resumo injetado no início de toda sessão (`hooks/regras-globais.md`), no passo de planejamento da dona (`pool/dona.md`), no bloco `kit:regras-de-trabalho` do modelo de `CLAUDE.md` (sobe para v4, e o `kit atualizar` o leva aos projetos) e no `orquestracao:validador`, que passa a conferir no PR a premissa em que o diff se apoia. Um teste confere que todos dizem a regra e apontam para a seção.

<a id="alternativas"></a>
## Alternativas consideradas
- **Hook que bloqueia o turno sem a análise.** Rejeitada: nenhuma trava mede se a análise foi boa (só se um cabeçalho apareceu, o que vira cerimônia), e um hook em toda mensagem custa tokens em toda mensagem.
- **Análise completa em todo pedido, sem medida.** Rejeitada: o trivial ficaria lento e verboso, e a obrigação de achar defeito empurra a sessão a inventar objeção.
- **Discordar e esperar o operador sempre.** Rejeitada: contraria o "nunca travar"; o reversível se desfaz mais barato do que se espera.
- **O texto inteiro em cada lugar (resumo, dona, modelo, validador).** Rejeitada: cinco cópias divergem com o tempo; fica uma fonte e linhas que apontam para ela, com teste que as compara.
- **Editar o `CLAUDE.md` global do operador.** Fora do escopo: o arquivo é dele; a sugestão de apontar a linha global para a regra do kit vai para ele decidir.

<a id="consequencias"></a>
## Consequências
- Toda sessão com o plugin `orquestracao` recebe a regra no início, e todo projeto que roda `kit atualizar` a recebe no `CLAUDE.md` (bloco não editado à mão é trocado; o editado vira conflito, como qualquer bloco).
- O validador ganha uma conferência a mais; premissa falsa aceita pelo diff vira achado mesmo com o diff fiel ao plano.
- Nada mede a qualidade da análise de forma automática: o efeito depende do texto e da revisão, e a regra se ajusta se o operador achar que ficou ruidosa ou branda demais.
