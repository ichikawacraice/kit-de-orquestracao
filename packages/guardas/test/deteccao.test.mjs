// CONV-16 — guarda prova que morde: cada detector acusa o caso ruim e ignora o
// bom, inclusive os furos que já deixaram passar defeito no produto de origem.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { literaisDoFonte, semComentarios, separaVariante } from '../lib/fonte.mjs'
import { marcasDeVidro } from '../lib/guardas/nada-de-vidro.mjs'
import { destrutivoPreenchido, marcaComoTexto } from '../lib/guardas/a-marca-nao-carrega-texto.mjs'
import { animacoesSemEscape, literaisSemEscape } from '../lib/guardas/o-movimento-tem-escape.mjs'
import { ehPilula, vocabularioDeFora } from '../lib/guardas/o-carimbo-tem-forma.mjs'
import { botoesComReticencias } from '../lib/guardas/nenhum-botao-tem-reticencias.mjs'
import { chamaConfirmacao } from '../lib/guardas/o-irreversivel-pede-confirmacao.mjs'
import { barraDeModosAMao } from '../lib/guardas/a-troca-de-vista-tem-uma-forma.mjs'
import { containersDeAssunto, superficiesComRaioDeControle, vaoApertado } from '../lib/guardas/composicao-tem-grau.mjs'
import { claroEmTextoPequeno, tintaSemPar } from '../lib/guardas/a-tinta-clara-nao-vai-em-texto-pequeno.mjs'
import { desfechosEmCinza, mensagemForaDaLista, chavesEscritasAMao, renderizadoresDoArquivo } from '../lib/guardas/o-erro-de-submissao-alcanca-os-olhos.mjs'
import { valoresSoltos } from '../lib/guardas/nenhum-valor-solto.mjs'
import { nativos } from '../lib/guardas/confirmacao-e-dica-nunca-nativas.mjs'
import { declaracoes, varsDoTema } from '../lib/guardas/os-tokens-pagam-o-piso.mjs'
import { superficieAMao } from '../lib/guardas/conteudo-mora-em-superficie.mjs'
import { titulos } from '../lib/guardas/o-titulo-da-pagina-e-um-so.mjs'
import { TEXTO_DE_ESPERA } from '../lib/guardas/a-espera-nao-e-texto-solto.mjs'

test('leitura: comentário sai, URL fica, linha se mantém, variante se separa', () => {
  const comBarraEmString = semComentarios('<input accept="image/*" />\n<a href="//cdn.x" className="backdrop-blur-md" />\n/** fim */ <i />')
  assert.match(comBarraEmString, /backdrop-blur-md/)
  assert.match(comBarraEmString, /<i \/>/)
  assert.doesNotMatch(comBarraEmString, /fim/)
  const limpo = semComentarios('a // x\nb /* y\n z */ c')
  assert.deepEqual(limpo.split('\n').map((l) => l.trim()), ['a', 'b', 'c'])
  assert.equal(semComentarios("const u = 'https://x'"), "const u = 'https://x'")
  assert.deepEqual(literaisDoFonte('// "nao"\nconst a = "sim"\nconst b = `x\ny`\nconst c = "z"').map((l) => [l.linha, l.texto]), [[2, 'sim'], [3, 'x\ny'], [5, 'z']])
  assert.deepEqual(separaVariante('data-[a=b:c]:hover:!bg-x'), { variantes: ['data-[a=b:c]', 'hover'], base: 'bg-x' })
})

test('vidro: as quatro marcas, a variante intercalada e o valor entre colchetes; o comentário e o branco chapado não', () => {
  const nomes = (t) => marcasDeVidro(t).map((m) => m.nome)
  assert.deepEqual(nomes('className="glass-surface backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] bg-white/70"'), ['grau de vidro', 'desfoque de fundo', 'bisel branco', 'vidro à mão'])
  assert.deepEqual(nomes('className="dark:hover:bg-white/[0.04]"'), ['vidro à mão'])
  assert.deepEqual(nomes('className="bg-white text-black superficie"'), [])
  assert.deepEqual(nomes('// era glass-surface com backdrop-blur'), [])
})

test('marca: text-primary nu acusa com qualquer variante; o foreground e a tinta do destrutivo não', () => {
  assert.equal(marcaComoTexto('className="text-primary"').length, 1)
  assert.equal(marcaComoTexto('className="group-hover:text-primary"').length, 1)
  assert.equal(marcaComoTexto('className="bg-primary text-primary-foreground"').length, 0)
  assert.equal(destrutivoPreenchido('className="bg-destructive text-white"').length, 1)
  assert.equal(destrutivoPreenchido('className="bg-destructive/12 text-destructive"').length, 0)
})

test('movimento: escape na mesma string, e com ! quando há variante; transition-colors não é movimento', () => {
  const falta = (t) => literaisSemEscape(t).map((f) => f.falta)
  assert.deepEqual(falta('const c = "animate-in fade-in-0"'), ['motion-reduce:animate-none'])
  assert.deepEqual(falta('const c = "animate-in fade-in-0 motion-reduce:animate-none"'), [])
  assert.match(falta('const c = "data-[state=open]:animate-in motion-reduce:animate-none"')[0], /!animate-none/)
  assert.deepEqual(falta('const c = "data-[state=open]:animate-in motion-reduce:!animate-none"'), [])
  assert.deepEqual(falta('const c = "transition-colors"'), [])
  assert.deepEqual(falta('// "animate-spin"'), [])
  assert.deepEqual(animacoesSemEscape('.a, .b { animation: g 1s } @media (prefers-reduced-motion: reduce) { .a { animation: none } }'), ['.b'])
  assert.deepEqual(animacoesSemEscape('.c { @apply animate-spin } @media (prefers-reduced-motion: reduce) { .c { @apply animate-none } }'), [])
})

test('carimbo: a pílula e o vocabulário paralelo; o casco, o botão e o recorte de Tom não', () => {
  assert.equal(ehPilula('shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px]'), true)
  assert.equal(ehPilula('rounded-md border px-3 py-2 text-sm'), false)
  assert.equal(ehPilula('inline-flex h-9 items-center rounded-md px-2 text-xs'), false)
  const msgs = (t) => vocabularioDeFora(t).map((a) => a.msg)
  assert.deepEqual(msgs("export type Tone = 'bad' | 'ok'"), ["type Tone: 'bad'", 'type Tone copia as vozes à mão (use Extract<Tom, …>)'])
  assert.deepEqual(msgs('<ChipDeEstado tom="atencao">x</ChipDeEstado>'), ['tom="atencao"'])
  assert.deepEqual(msgs("tom === 'andando' ? a : b"), ["tom === 'andando'"])
  assert.deepEqual(msgs("export type TomDoChip = Extract<Tom, 'ok' | 'ruim'>"), [])
  assert.deepEqual(msgs("tom: c.status === 'done' ? 'ok' : 'ruim',"), [])
})

test('reticências: no filho, no ternário, no aria-label e na constante; não no evento', () => {
  const exemplo = `
    const ROTULO = 'Abrir…'
    export function T({ rodando }) {
      return <>
        <Button onClick={() => alert('não é texto do botão…')}>{rodando ? 'Publicando…' : 'Publicar'}</Button>
        <button aria-label="Fechar…" />
        <DropdownMenuItem>Remover da página…</DropdownMenuItem>
        <Button>{ROTULO}</Button>
        <Button>{DE_FORA}</Button>
        <Button>Salvar</Button>
      </>
    }`
  const r = botoesComReticencias('x.tsx', exemplo, new Set(['Button', 'button', 'DropdownMenuItem']), new Map([['DE_FORA', 'Buscar…']]))
  assert.equal(r.botoes, 6)
  assert.deepEqual(r.achados.map((a) => a.texto), ['Publicando…', 'Fechar…', 'Remover da página…', 'Abrir…', 'Buscar…'])
})

test('confirmação: a chamada, não o nome; o tipo da prop e o comentário não confirmam', () => {
  const op = { hooks: ['useConfirm'], funcoes: ['onConfirmar'] }
  const declarado = 'const [dialogo, confirmar] = useConfirm()\n'
  assert.equal(chamaConfirmacao(declarado, op), false)
  assert.equal(chamaConfirmacao(`${declarado}await confirmar({ titulo: 'x' })`, op), true)
  assert.equal(chamaConfirmacao('onConfirmar: (opts: X) => Promise<boolean>', op), false)
  assert.equal(chamaConfirmacao('const ok = await onConfirmar({})', op), true)
  assert.equal(chamaConfirmacao("const [d, pedir, setPode] = useConfirm()\nawait pedir({ titulo: 'x' })", op), true)
  assert.equal(chamaConfirmacao(`${declarado}// antes era await confirmar(...)`, op), false)
})

test('troca de vista: o grupo e o map; o alternador solto não', () => {
  assert.equal(barraDeModosAMao(`<Button variant={m === 'a' ? 'secondary' : 'ghost'}>A</Button><Button variant={m === 'b' ? 'secondary' : 'ghost'}>B</Button>`).length, 2)
  assert.equal(barraDeModosAMao(`{MODOS.map((m) => (<Button variant={v === m ? 'default' : 'ghost'} />))}`).length, 1)
  assert.equal(barraDeModosAMao(`<Button variant={aberto ? 'secondary' : 'ghost'}>Detalhes</Button>`).length, 0)
})

test('composição: raio de controle em superfície, vão apertado e vão fora da paleta', () => {
  assert.equal(superficiesComRaioDeControle('"rounded-lg border p-3 text-xs"').length, 1)
  assert.equal(superficiesComRaioDeControle('"rounded-2xl border p-4"').length, 0)
  assert.equal(superficiesComRaioDeControle('"h-8 rounded-lg border px-2"').length, 0)
  const bloco = /<Bloco\b/
  assert.equal(vaoApertado('  <div className="grid gap-4">\n    <Bloco />', bloco).length, 1)
  assert.equal(vaoApertado('  <div className="grid gap-6">\n    <Bloco />', bloco).length, 0)
  const assunto = /<(?:Card|Bloco)\b/
  assert.deepEqual(containersDeAssunto('  <div className="flex gap-8">\n    <Card>a</Card>\n    <Card>b</Card>\n  </div>', assunto).map((c) => c.valor), ['8'])
  assert.deepEqual(containersDeAssunto('  <div className="flex gap-2">\n    <h2>t</h2>\n    <Card>b</Card>\n  </div>', assunto), [])
})

test('tinta: o claro em texto pequeno e a voz sem a metade escura', () => {
  assert.equal(claroEmTextoPequeno('const TOM = COR_DO_TOM\n<span className={`text-xs ${TOM.ruim}`}>', 'COR_DO_TOM').length, 1)
  assert.equal(claroEmTextoPequeno('<span className={`text-2xl ${COR_DO_TOM[c]}`}>\n<span className={`text-xs ${COR_DO_TOM_DENSO.ruim}`}>', 'COR_DO_TOM').length, 0)
  assert.equal(tintaSemPar('<p className="text-xs text-rose-700">').length, 1)
  assert.equal(tintaSemPar('<p className="text-rose-700 dark:text-rose-300">').length, 0)
})

test('erro de submissão: a chave sem leitor, o desfecho em cinza e a mensagem fora da lista', () => {
  assert.deepEqual(chavesEscritasAMao("setErros({ nome: 'x', 'alvo.0.url': 'y' })"), ['alvo.N.url', 'nome'])
  assert.deepEqual([...renderizadoresDoArquivo("{erros.nome}{errors['alvo.0.url']}")].sort(), ['alvo.N.url', 'nome'])
  const cinza = "const [msg, setMsg] = useState(null)\nsetMsg(res.ok ? 'Salvo' : `erro ${res.status}`)\n<span className=\"text-sm text-muted-foreground\">{msg}</span>"
  assert.deepEqual(desfechosEmCinza(cinza), ['msg'])
  assert.deepEqual(desfechosEmCinza(`${cinza}\n<span className={COR_DO_TOM_DENSO[msg.tom]}>{msg}</span>`), [])
  const ruim = "const [error, setError] = useState(null)\nasync function aprovar(id) { setError('x') }\nreturn <>{itens.map((i) => (<button onClick={() => aprovar(i.id)} />))}{error ? <p /> : null}</>"
  assert.deepEqual(mensagemForaDaLista(ruim), ['error via aprovar()'])
  const bom = "const [error, setError] = useState(null)\nasync function aprovar(id) { setError('x') }\nreturn <>{itens.map((i) => (<><button onClick={() => aprovar(i.id)} />{error ? <p /> : null}</>))}</>"
  assert.deepEqual(mensagemForaDaLista(bom), [])
})

test('valor solto, nativo, superfície, título e espera', () => {
  assert.deepEqual(valoresSoltos('<p className="text-[15px] h-[34px] duration-200 bg-[#fff] hover:rounded-[3px] z-[60]" />').map((a) => a.trecho), ['text-[15px]', 'h-[34px]', 'duration-200', 'bg-[#fff]', 'hover:rounded-[3px]', 'z-[60]'])
  assert.deepEqual(valoresSoltos('<p className="text-sm h-ctrl duration-modal-abre bg-[var(--x)]" style={{ color: "#ff0000" }} />').map((a) => a.trecho), ['#ff0000'])
  assert.equal(nativos("if (window.confirm('x')) {}\nalert('y')").length, 2)
  assert.equal(nativos('<button title="Apagar">x</button>').length, 1)
  assert.equal(nativos('<button onClick={() => abrir()} title="Abrir">x</button>').length, 1)
  assert.equal(nativos("const [d, confirm] = useConfirm()\nawait confirm({ titulo: 'x' })").length, 0)
  assert.equal(nativos('<iframe title="Prévia" />\n<Ajuda title="x" />\nconst r = await onConfirm()').length, 0)
  assert.equal(superficieAMao('<div className="superficie rounded-2xl" />').length, 1)
  assert.equal(superficieAMao('<aside data-superficie className="superficie" />').length, 0)
  assert.equal(titulos('<h1 className="text-xl">x</h1>', 't-display').achados.length, 1)
  assert.equal(titulos('<h1 className="t-display">x</h1><h2 className="t-display">y</h2>', 't-display').achados.length, 1)
  assert.equal(titulos('<h1 className={cn("t-display", x)}>x</h1>', 't-display').achados.length, 0)
  assert.equal("<p>{'Carregando…'}</p>".match(TEXTO_DE_ESPERA).length, 1)
  assert.equal("className='data-[carregando=true]:h-24'".match(TEXTO_DE_ESPERA), null)
})

test('tokens: o escuro herda o claro e a variável se lê do bloco do tema', () => {
  const css = ':root { --a: #111111; /* x */ --b: #222222; }\n@layer base { .dark { --b: #333333; } }'
  assert.deepEqual(varsDoTema(declaracoes(css), 'claro'), { '--a': '#111111', '--b': '#222222' })
  assert.deepEqual(varsDoTema(declaracoes(css), 'escuro'), { '--a': '#111111', '--b': '#333333' })
  // Mesma especificidade: o `:root` do projeto, depois do `.dark` do pacote, vence também no escuro.
  const projeto = '.dark { --c: #444444; }\n:root { --c: #555555; }'
  assert.equal(varsDoTema(declaracoes(projeto), 'escuro')['--c'], '#555555')
  assert.equal(varsDoTema(declaracoes('@media (prefers-color-scheme: dark) { :root { --d: #666666; } }'), 'claro')['--d'], undefined)
})

test('composição: o gesto que só abre a confirmação destrutiva pode ser ghost (PESO-02)', async () => {
  const { default: g } = await import('../lib/guardas/composicao-tem-grau.mjs')
  const p = (texto) => ({ config: { kit: 'k' }, fontes: () => [{ arquivo: 'x.tsx', texto }] })
  const op = g.padrao
  assert.equal(g.examinar(p('<Button variant="ghost">Excluir</Button>'), op).violacoes.length, 1)
  const abre = "const [d, confirmar] = useConfirm()\nasync function x() { await confirmar({}) }\n<Button variant=\"ghost\" onClick={x}>Excluir</Button>"
  assert.equal(g.examinar(p(abre), op).violacoes.length, 0)
})
