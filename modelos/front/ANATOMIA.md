# Anatomia — o que vai onde

O [`DESIGN.md`](DESIGN.md) diz **como** a tela parece: token, cor, tipo, raio, sombra, movimento. Este arquivo diz **o que** vai **onde**: os tipos de tela, as regiões de cada uma, o lugar de cada mensagem e a peça do kit para cada função. Valor de token aqui é defeito: está no DESIGN.md. Regra de lugar no DESIGN.md também é defeito: está aqui. Lugar e estilo mudam por motivos diferentes, por isso moram em arquivos diferentes.

Quem desenha lê os dois antes de qualquer interface: o agente `designer` (skill `revisao-de-arquitetura-de-ui`) e o `critico-de-ui` (skill `critica-de-ui`), que julga pelos dois.

<a id="principios"></a>
## Os princípios

Cada princípio é um critério da revisão e da crítica. Ponto de partida, a ajustar ao produto:

1. **Uma tela, uma tarefa.** A tela responde a uma pergunta só; o que não é a tarefa dela vai para outra tela, gaveta ou diálogo.
2. **Dado sem ação é ruído.** Informação que não muda o que a pessoa faz agora não tem espaço permanente.
3. **Componente antes de layout.** Toda região é montada com peças do kit de componentes; se falta peça, ela entra no kit, nunca como arranjo à mão.
4. **Token ou não existe.** Cor, espaço, tipo, raio, sombra e duração saem da escala do DESIGN.md.

<a id="arquetipos"></a>
## Os arquétipos de tela

Toda tela é um destes. A que não cabe em nenhum vira um arquétipo novo, aqui, antes do código.

| Arquétipo | Pergunta que responde | Exemplo | Regiões |
|---|---|---|---|
| <!-- ex.: lista --> | | | |

<a id="mensagens"></a>
## Onde mora cada mensagem

| Tipo | Lugar | Quando some |
|---|---|---|
| Erro de campo | | |
| Erro da tela | | |
| Aviso | | |
| Vazio | | |
| Sucesso | | |

<a id="pecas"></a>
## A peça do kit para cada função

| Função | Peça | Onde mora no código |
|---|---|---|
| <!-- ex.: botão --> | | |
