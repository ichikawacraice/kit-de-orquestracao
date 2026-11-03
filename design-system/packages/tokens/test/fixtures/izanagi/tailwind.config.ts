import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/* As cores do tema vêm de CSS vars em hex (`--background: #FAFAFA`). Entregar
   `var(--background)` cru ao Tailwind faz o modificador de opacidade sumir: sem o
   placeholder `<alpha-value>` no valor, o v3 NÃO GERA a regra de `bg-background/80`
   — a classe simplesmente não existe no CSS, o elemento fica sem fundo e o
   `getComputedStyle` devolve `rgba(0, 0, 0, 0)`. Foi o que apagou 5 das 6 faixas da
   régua de validação (`bg-muted-foreground/40`) e o fundo dos rótulos do comparador.
   `color-mix` resolve sem tocar nas vars: elas seguem em hex e continuam legíveis
   por quem usa `var(--card)` direto no CSS/inline (o `border-primary-gradient`, o
   `--input-background` dos campos). Sem modificador, `<alpha-value>` vira `1` e o
   mix devolve a própria cor. */
const comAlfa = (nome: string) =>
  `color-mix(in srgb, var(${nome}) calc(<alpha-value> * 100%), transparent)`

/* A identidade é a da Wicomm desde 2026-09-06 ([ADR 0124](../../docs/adr/0124-a-marca-e-a-da-wicomm-e-o-vermelho-nao-carrega-texto.md));
   o sistema inteiro está na [SPEC-077](../../docs/specs/SPEC-077-o-sistema-visual-do-painel.md).
   A anterior era portada do WiControl, e o PRODUCT.md já a registrava como herança revogável. */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* `sans` é OVERRIDE, não acréscimo — e é essa palavra que importa.
         Enquanto o Archivo entrava só como chave nova (`archivo`), o preflight
         mantinha o `sans` default (`ui-sans-serif, system-ui, …`) no `html` e a
         fonte da marca pintava apenas nos ~30 lugares onde alguém escreveu
         `font-archivo` à mão: corpo, tabelas, botões, campos e badges seguiam na
         fonte do sistema. Nada declarava `font-family` em lugar nenhum do `src`,
         então não havia o que reprovasse — medido no navegador,
         `getComputedStyle(document.body).fontFamily` devolvia a pilha do sistema.
         Redefinir a chave `sans` aqui é o que troca a fonte do PRODUTO; o resto
         herda por cascata, inclusive `<td>`, `<button>` e `<input>` (o preflight
         já dá `font-family: inherit` aos controles).

         `mono` fica de fora de propósito: são ~85 usos deliberados para número,
         id e chave, e virar Archivo apagaria a distinção.

         A chave `archivo` continua existindo como saída explícita para subárvore
         que redefine `sans` por conta própria — hoje ninguém precisa dela, mas
         apagá-la faria `font-archivo` virar classe inexistente, que é o mesmo
         tipo de falha silenciosa que este bloco conserta. */
      fontFamily: {
        sans: [
          'var(--font-archivo)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        archivo: ['var(--font-archivo)', 'sans-serif'],
        /* A fonte de display da janela do kit de campanha (ADR 0435): só no escopo `data-tema="campanha"`, onde a var
           mora (a classe da Anton vai no próprio diálogo). Fora dele a var não existe e a declaração cai inteira. */
        campanha: ['var(--font-anton)', 'Impact', 'sans-serif'],
      },
      colors: {
        border: comAlfa('--border'),
        input: comAlfa('--input'),
        ring: comAlfa('--ring'),
        background: comAlfa('--background'),
        foreground: comAlfa('--foreground'),
        /* `primary` é cor de PREENCHIMENTO, e só. A marca não carrega texto: medido,
           o vermelho dela e o vermelho de erro ficam a 1,17:1 um do outro quando os
           dois são letra. Por isso não existe mais `on-tint` — o degrau que ele
           resolvia era o de texto sobre a própria tinta, e agora nada escreve ali.
           Uma varredura reprova `text-primary` em `apps/web/src`. */
        primary: {
          DEFAULT: comAlfa('--primary'),
          foreground: comAlfa('--primary-foreground'),
          hover: comAlfa('--primary-hover'),
        },
        /* A marca crua. Ela DESENHA — ponto, filete, barra —, nunca escreve:
           branco sobre ela mede 3,94, e ela mesma sobre o chão mede menos que o
           piso de texto. */
        'marca-viva': comAlfa('--marca-viva'),
        /* A tinta da marca: fundo tingido opaco (task aberta, coluna que aceita o
           arrasto). Ela tinge; não escreve. */
        'marca-tinta': comAlfa('--marca-tinta'),
        /* O degrau do meio da rampa de tinta: 6,81 no pior fundo do claro, 5,99
           no do escuro. `muted-foreground` continua sendo o terceiro. */
        'foreground-2': comAlfa('--foreground-2'),
        /* IDENTIDADE DE PESSOA (ADR 0128) — quem pediu, no disco de iniciais.
           Cor de IDENTIDADE, como o `desenho`: ela diz QUEM, e não o que se
           deve fazer. Por isso é token de tema e não entra no idioma de cor. */
        'pessoa-a': comAlfa('--pessoa-a'),
        'pessoa-a-tinta': comAlfa('--pessoa-a-tinta'),
        'pessoa-b': comAlfa('--pessoa-b'),
        'pessoa-b-tinta': comAlfa('--pessoa-b-tinta'),
        'pessoa-c': comAlfa('--pessoa-c'),
        'pessoa-c-tinta': comAlfa('--pessoa-c-tinta'),
        'pessoa-d': comAlfa('--pessoa-d'),
        'pessoa-d-tinta': comAlfa('--pessoa-d-tinta'),
        /* A camada do DESENHO na mesa de corte. Cor de IDENTIDADE (de que lado
           o pixel veio), não de veredito — por isso ela é token de tema e não
           entra no idioma de cor. */
        desenho: comAlfa('--desenho'),
        /* O TERMINAL: superfície escura nos dois temas para o valor cru colhido de fora
           (a prova do laudo, o log). Não é voz nem identidade; é onde o texto literal mora. */
        terminal: {
          DEFAULT: comAlfa('--terminal'),
          foreground: comAlfa('--terminal-foreground'),
        },
        secondary: {
          DEFAULT: comAlfa('--secondary'),
          foreground: comAlfa('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: comAlfa('--destructive'),
          foreground: comAlfa('--destructive-foreground'),
        },
        muted: {
          DEFAULT: comAlfa('--muted'),
          foreground: comAlfa('--muted-foreground'),
        },
        accent: {
          DEFAULT: comAlfa('--accent'),
          foreground: comAlfa('--accent-foreground'),
        },
        popover: {
          DEFAULT: comAlfa('--popover'),
          foreground: comAlfa('--popover-foreground'),
        },
        card: {
          DEFAULT: comAlfa('--card'),
          foreground: comAlfa('--card-foreground'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /* Os quatro raios do protótipo v3, um por classe de peça. */
        cartao: 'var(--raio-cartao)',
        painel: 'var(--raio-painel)',
        ctrl: 'var(--raio-ctrl)',
        badge: 'var(--raio-badge)',
      },
      /* AS COLUNAS DO EDITOR: a largura de cada uma é um token, e `components/ui/colunas-do-editor.tsx`
         tem as mesmas constantes (um teste lê as duas). O encaixe da direita é a coluna mais o vão de
         8 px entre colunas: as duas são a mesma decisão. */
      width: {
        estrutura: '288px',
        trilho: '48px',
        'coluna-lateral': '340px',
        'encaixe-lateral': '348px',
        /* AS COLUNAS DA MESA DO JOB: a espinha encolhe abaixo de `xl`, e o apoio só existe em `xl`. A grade
           (`GRADE_DA_MESA`, em `lib/layout.ts`) lê estes três, e a casca e o esqueleto leem a grade: o
           esqueleto não pula de largura quando o conteúdo chega. */
        'espinha-estreita': '208px',
        espinha: '224px',
        apoio: '228px',
        /* A coluna do rótulo do ranking das `BarrasDeMedida`: cabe o nome de um modelo (`claude-sonnet-5-5`,
           99px no `text-xs` da Archivo); mais longo, trunca com a dica. */
        'rotulo-da-barra': '128px',
      },
      /* A largura de leitura: a linha de texto corrido não passa de 78 caracteres (F210 M8a). */
      maxWidth: {
        medida: '78ch',
      },
      /* O MOVIMENTO TEM TOKENS ([ADR 0374](../../docs/adr/0374-o-movimento-do-painel-tem-tokens-e-escape.md)).
         Nenhuma duração ou curva de animação se escreve à mão no kit: `duration-200`
         e `ease-out` soltos davam um ritmo diferente a cada peça. No kit e em código
         novo, duração e curva saem destes tokens; o que sobra solto fora do kit está
         contado no ADR. Abrir é mais longo
         que fechar (o operador já decidiu ao fechar), e o `painel` é a exceção
         escrita: numa troca de etapa uma sai enquanto a outra entra, e tempos
         diferentes abririam um buraco entre elas. O `tailwindcss-animate` lê
         `animation-duration` e `animation-timing-function` destas mesmas chaves.
         `components/ui/colunas-do-editor.tsx` (`DURACAO_DO_DESLIZE_MS`) e
         `components/layout/AppSidebar.tsx` (`PRAZO_DA_TRANSICAO_MS`, 50 ms a mais) têm de bater com `painel`. */
      transitionDuration: {
        'modal-abre': '220ms',
        'modal-fecha': '140ms',
        'menu-abre': '160ms',
        'menu-fecha': '110ms',
        dica: '120ms',
        painel: '200ms',
        'dobra-abre': '200ms',
        'dobra-fecha': '150ms',
        cor: '150ms',
        /* O que aparece no hover ou no foco (a ação escondida da linha): não é troca de cor nem chegada. */
        revela: '150ms',
        /* A janela do kit de campanha (ADR 0435), fora do ritmo do painel e só no escopo dela: a cortina e as letras do
           título, o leque que abre com mola e fecha seco, o pulso da carta escolhida e a troca de tom. */
        'campanha-entra': '480ms',
        'campanha-leque-abre': '320ms',
        'campanha-leque-fecha': '180ms',
        'campanha-escolhe': '240ms',
        'campanha-tom': '300ms',
      },
      /* O véu de carregamento só aparece se a espera passar disto: evita o piscar na resposta rápida.
         O `tailwindcss-animate` lê `animationDelay` daqui, então `delay-veu` escreve `animation-delay`. */
      transitionDelay: {
        veu: '120ms',
        /* A espiada das seções (colunas-do-editor.tsx): o mouse parado no trilho antes de abrir, e a tolerância ao sair. Os dois são timers de JS; estes são a fonte, e um teste compara com as constantes. */
        'espiada-abre': '250ms',
        'espiada-fecha': '300ms',
        /* O leque da janela do kit: o mouse parado antes de abrir (o mesmo da espiada) e a tolerância antes de fechar. Timers de JS; um teste compara com as constantes. */
        'campanha-leque-espera': '250ms',
        'campanha-leque-tolera': '200ms',
        /* A defasagem entre as cartas que saem da pilha, e entre as letras do título. */
        'campanha-carta': '40ms',
        'campanha-letra': '30ms',
      },
      /* A letra das etiquetas e legendas (o 11 px do casco do chip). String: gera só `font-size`, e a
         entrelinha continua herdada. `utils.ts` declara o nome ao `tailwind-merge`. */
      fontSize: {
        legenda: '11px',
        /* O texto de controle do quadro: o nome da coluna e o título do cartão (ADR 0406). */
        controle: '13px',
        /* A Anton da janela do kit de campanha (ADR 0435): o título e o nome de cada fileira. */
        'campanha-display': ['64px', { lineHeight: '0.95' }],
        'campanha-titulo': ['44px', { lineHeight: '1' }],
      },
      /* A altura de um controle (botão e campo têm 30 px). Fora de `spacing` de propósito: lá viraria
         `p-ctrl` e `gap-ctrl`, um degrau de espaçamento que não é espaçamento. */
      height: {
        ctrl: '30px',
        /* As densidades da `EsperaDaLista`; de que linha real sai cada uma está em `ALTURA_DA_ESPERA` (lib/layout.ts). */
        'espera-linha': '40px',
        'espera-item': '64px',
        'espera-cartao': '76px',
      },
      size: {
        ctrl: '30px',
      },
      /* A proporção do print de seção (o candidato a componente e a biblioteca): a espera, a falha e a imagem dividem a mesma. */
      aspectRatio: {
        print: '4 / 3',
      },
      /* A altura mínima do palco, a mesma no preview e no canvas: uma fonte só. */
      minHeight: {
        palco: '32rem',
      },
      /* A marca da linha ativa, igual na árvore e na estrutura da seção. */
      boxShadow: {
        'linha-ativa': 'inset 2px 0 0 var(--primary)',
      },
      transitionTimingFunction: {
        abre: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fecha: 'cubic-bezier(0.4, 0, 1, 1)',
        /* A mola do leque da janela do kit de campanha: passa do ponto e volta. Só lá (ADR 0435). */
        mola: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      /* Escala inicial do `zoom-in-*`: modal 0,97, menu 0,98. */
      animationScale: {
        '97': '.97',
        '98': '.98',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        /* A janela do kit de campanha: cada letra do título sobe uma vez; a carta escolhida pulsa. */
        'campanha-letra': {
          from: { transform: 'translateY(0.35em)', opacity: '0' },
          to: { transform: 'none', opacity: '1' },
        },
        'campanha-escolhe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-up': 'accordion-up 150ms cubic-bezier(0.4, 0, 1, 1)',
        'campanha-letra': 'campanha-letra 480ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'campanha-escolhe': 'campanha-escolhe 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
