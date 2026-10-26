// K13: a guarda do plugin `design`, portada para node:test. Rodar: node --test plugins/design/hooks/tests/
// Nada aqui toca ~/.claude: o estado (KIT_DESIGN_ESTADO) e os repositórios ficam em pasta temporária.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AGENTE_CRITICO, PAPEL_DESIGNER, criarContexto, decidir, eCodigoDeTela, eCritica, formaDaCritica,
  fotoDoVisual, gitMemoizado, globParaRegex, lerConfig, normalizarDiff, nomeCurto,
} from '../guarda-de-design.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(AQUI, '..', '..');
const SCRIPT = join(AQUI, '..', 'guarda-de-design.mjs');
const RAIZ = '/repo';
const CONFIG = {
  visual: ['apps/web/src/**/*.tsx', 'apps/web/src/**/*.css', '!apps/web/src/**/*.test.tsx'],
  negadoAoDesigner: ['apps/web/src/**', 'apps/web/tailwind.config.ts'],
  bases: ['origin/develop', 'origin/main'],
};
const sh = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', timeout: 10_000, killSignal: 'SIGKILL' });

function ctxDuble(d = {}) {
  const o = typeof d === 'string' ? { foto: d } : d;
  const estados = new Map();
  return {
    estados, duble: o,
    ctx: {
      cwd: RAIZ,
      config: () => (o.semConfig ? null : CONFIG),
      raiz: () => o.raiz ?? RAIZ,
      foto: () => ({ hash: o.foto ?? 'f0', vazia: o.vazia ?? false }),
      ler: (_c, s) => estados.get(s) ?? null,
      gravar: (_c, s, e) => void estados.set(s, e),
    },
  };
}
const INICIO = { versao: 1, raiz: RAIZ, foto: 'f0', criticada: null, cobrado: false };
const CRITICA_BOA = [
  '# Crítica — builder', 'Nota: 20/30',
  '### P1 · hierarquia · dois primários', '- **Onde:** Tela.tsx:12', '- **Correção:** o segundo vira secundário',
  '### P2 · ruído · faixa permanente', '- **Onde:** Faixa.tsx:18', '- **Correção:** a faixa vira chip',
].join('\n');
const falha = (x) => x?.decision === 'block';

describe('formaDaCritica', () => {
  it('conta os problemas e acha os que não têm Onde ou Correção', () => {
    assert.deepEqual(formaDaCritica(CRITICA_BOA), { problemas: 2, faltando: [] });
    assert.deepEqual(formaDaCritica(`${CRITICA_BOA}\n### P3 · densidade · x\n- **Onde:** barra`), { problemas: 3, faltando: ['P3'] });
  });
  it('texto vazio ou ausente é zero problema, não forma boa', () => {
    assert.deepEqual(formaDaCritica(''), { problemas: 0, faltando: [] });
    assert.deepEqual(formaDaCritica(undefined), { problemas: 0, faltando: [] });
  });
});

describe('eCritica, eCodigoDeTela, globs e normalizarDiff', () => {
  it('só o subagente crítico conta (com ou sem prefixo do plugin); a skill não', () => {
    assert.equal(eCritica({ tool_name: 'Agent', tool_input: { subagent_type: 'critico-de-ui' } }), true);
    assert.equal(eCritica({ tool_name: 'Task', tool_input: { subagent_type: 'design:critico-de-ui' } }), true);
    assert.equal(eCritica({ tool_name: 'Agent', tool_input: { subagent_type: 'critico-de-ui', run_in_background: true }, tool_response: { status: 'async_launched' } }), true);
    assert.equal(eCritica({ tool_name: 'Agent', tool_input: { subagent_type: 'designer' } }), false);
    assert.equal(eCritica({ tool_name: 'Skill', tool_input: { skill: 'critica-de-ui' } }), false);
  });
  it('nomeCurto tira o prefixo do plugin', () => {
    assert.equal(nomeCurto('design:designer'), 'designer');
    assert.equal(nomeCurto('designer'), 'designer');
    assert.equal(nomeCurto(undefined), undefined);
  });
  it('código de tela vem dos globs do kit.json, em qualquer worktree; doc e revisão passam', () => {
    const g = CONFIG.negadoAoDesigner;
    assert.equal(eCodigoDeTela('/repo/apps/web/src/components/ui/button.tsx', g), true);
    assert.equal(eCodigoDeTela('apps/web/src/app/globals.css', g), true);
    assert.equal(eCodigoDeTela('/repo/apps/web/tailwind.config.ts', g), true);
    assert.equal(eCodigoDeTela('/Users/x/p/.claude/worktrees/outro/apps/web/src/x/y.tsx', g), true);
    assert.equal(eCodigoDeTela('/repo/docs/design/revisoes/2026-10-23-tela.md', g), false);
    assert.equal(eCodigoDeTela('/repo/apps/web/ANATOMIA.md', g), false);
    assert.equal(eCodigoDeTela('', g), false);
    assert.equal(eCodigoDeTela(undefined, g), false);
  });
  it('glob com exclusão (!) tira o teste do que é visual', () => {
    assert.equal(eCodigoDeTela('/repo/apps/web/src/a/b.tsx', CONFIG.visual), true);
    assert.equal(eCodigoDeTela('/repo/apps/web/src/a/b.test.tsx', CONFIG.visual), false);
  });
  it('globParaRegex: ** atravessa pasta, * não', () => {
    assert.equal(globParaRegex('a/**/*.tsx').test('a/x/y/z.tsx'), true);
    assert.equal(globParaRegex('a/**/*.tsx').test('a/z.tsx'), true);
    assert.equal(globParaRegex('a/*.tsx').test('a/x/z.tsx'), false);
  });
  it('o diff normalizado guarda arquivo e linhas +/-, e larga index, @@ e cabeçalho', () => {
    const diff = ['diff --git a/x.tsx b/x.tsx', 'index 1111111..2222222 100644', '--- a/x.tsx', '+++ b/x.tsx', '@@ -10 +12 @@ f() {', '-  return 1;', '+  return 2;'].join('\n');
    assert.equal(normalizarDiff(diff), 'diff --git a/x.tsx b/x.tsx\n-  return 1;\n+  return 2;');
  });
});

describe('lerConfig — o kit.json do projeto', () => {
  const pasta = realpathSync(mkdtempSync(join(tmpdir(), 'kit-design-cfg-')));
  after(() => rmSync(pasta, { recursive: true, force: true }));
  const kit = (obj) => { mkdirSync(join(pasta, '.claude'), { recursive: true }); writeFileSync(join(pasta, '.claude', 'kit.json'), JSON.stringify(obj)); };
  it('sem kit.json ou sem design.visual, a guarda fica inerte (null)', () => {
    assert.equal(lerConfig(pasta), null);
    kit({ guarda: { tronco: 'origin/main' } });
    assert.equal(lerConfig(pasta), null);
  });
  it('com design.visual: negado padrão = visual sem exclusões; tronco vem primeiro', () => {
    kit({ design: { visual: ['src/**/*.tsx', '!src/**/*.test.tsx'] }, guarda: { tronco: 'origin/trunk' } });
    const c = lerConfig(pasta);
    assert.deepEqual(c.visual, ['src/**/*.tsx', '!src/**/*.test.tsx']);
    assert.deepEqual(c.negadoAoDesigner, ['src/**/*.tsx']);
    assert.deepEqual(c.bases, ['origin/trunk', 'origin/develop', 'origin/main']);
  });
  it('negadoAoDesigner explícito vence o padrão', () => {
    kit({ design: { visual: ['src/**/*.tsx'], negadoAoDesigner: ['app/**'] } });
    assert.deepEqual(lerConfig(pasta).negadoAoDesigner, ['app/**']);
  });
  it('JSON ilegível é erro, não inércia calada', () => {
    writeFileSync(join(pasta, '.claude', 'kit.json'), '{ nao e json');
    assert.throws(() => lerConfig(pasta), /ilegível/);
  });
});

describe('decidir — sem a seção design, não age', () => {
  it('nenhum evento decide nada', () => {
    const { ctx, estados } = ctxDuble({ semConfig: true, foto: 'f1' });
    estados.set('s1', { ...INICIO });
    assert.equal(decidir({ hook_event_name: 'Stop', session_id: 's1' }, null, ctx), null);
    assert.equal(decidir({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'redesenha a tela' }, null, ctx), null);
    assert.equal(decidir({ hook_event_name: 'PreToolUse', agent_type: 'designer', tool_input: { file_path: '/repo/apps/web/src/a.tsx' } }, null, ctx), null);
  });
});

describe('decidir — o designer não implementa (papel pelo agent_type do payload)', () => {
  const { ctx } = ctxDuble();
  const editar = (file_path, agent_type = 'design:designer') => ({ hook_event_name: 'PreToolUse', tool_name: 'Edit', agent_type, tool_input: { file_path } });
  it('nega Edit em código de tela, com o motivo', () => {
    const d = decidir(editar('/repo/apps/web/src/components/ui/button.tsx'), null, ctx);
    assert.equal(d?.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(d.hookSpecificOutput.permissionDecisionReason, /executor/);
  });
  it('deixa a revisão ser gravada', () => {
    assert.equal(decidir(editar('/repo/docs/design/revisoes/2026-10-23-tela.md'), null, ctx), null);
  });
  it('fora do papel designer (executor, sessão principal), o mesmo Edit passa', () => {
    assert.equal(decidir(editar('/repo/apps/web/src/components/ui/button.tsx', 'general-purpose'), null, ctx), null);
    assert.equal(decidir(editar('/repo/apps/web/src/components/ui/button.tsx', ''), null, ctx), null);
  });
  it('--papel na linha de comando vale como o agent_type', () => {
    assert.equal(decidir(editar('/repo/apps/web/src/a.tsx', ''), PAPEL_DESIGNER, ctx)?.hookSpecificOutput?.permissionDecision, 'deny');
  });
});

describe('decidir — a crítica tem forma', () => {
  const { ctx } = ctxDuble();
  const parar = (texto, ativo = false) => ({ hook_event_name: 'SubagentStop', agent_type: 'design:critico-de-ui', last_assistant_message: texto, stop_hook_active: ativo });
  it('forma boa passa', () => assert.equal(decidir(parar(CRITICA_BOA), null, ctx), null));
  it('sem problema nenhum, devolve', () => {
    const d = decidir(parar('Está ótimo.'), null, ctx);
    assert.equal(falha(d), true);
    assert.match(d.reason, /nenhum problema/);
  });
  it('mais de cinco, devolve com a contagem', () => {
    const seis = Array.from({ length: 6 }, (_, i) => `### P${i + 1} · ruído · x\n- **Onde:** a\n- **Correção:** b`).join('\n');
    assert.match(decidir(parar(seis), null, ctx).reason, /6 problemas/);
  });
  it('problema sem Correção, devolve nomeando qual', () => {
    assert.match(decidir(parar(`${CRITICA_BOA}\n### P3 · ruído · x\n- **Onde:** a`), null, ctx).reason, /P3/);
  });
  it('na segunda parada (stop_hook_active), passa', () => assert.equal(decidir(parar('Está ótimo.', true), null, ctx), null));
  it('o crítico não é cobrado como sessão principal: o Stop dele não grava estado', () => {
    const { ctx: c, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    assert.equal(decidir({ hook_event_name: 'Stop', session_id: 's1', agent_type: 'design:critico-de-ui', last_assistant_message: CRITICA_BOA }, null, c), null);
    assert.equal(estados.get('s1').cobrado, false);
  });
});

describe('decidir — o turno que mexe no visual chama o crítico', () => {
  const prompt = (t) => ({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: t });
  const parar = (ativo = false) => ({ hook_event_name: 'Stop', session_id: 's1', stop_hook_active: ativo });
  const usar = (tool_name, tool_input, tool_response) => ({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name, tool_input, tool_response });
  const quebrado = (ctx) => ({ ...ctx, foto: () => { throw new Error('git pendurou'); } });

  it('pedido de design ganha o lembrete; pedido de outra coisa, não', () => {
    const { ctx } = ctxDuble();
    assert.match(decidir(prompt('redesenha a barra do builder'), null, ctx).hookSpecificOutput.additionalContext, /designer/);
    assert.equal(decidir(prompt('roda o gate e abre o PR'), null, ctx), null);
  });
  it('o pedido grava a foto do começo do turno', () => {
    const { ctx, estados } = ctxDuble();
    decidir(prompt('roda o gate'), null, ctx);
    assert.deepEqual(estados.get('s1'), INICIO);
  });
  it('a foto que falha não leva o lembrete junto', () => {
    const { ctx } = ctxDuble();
    assert.match(decidir(prompt('redesenha a barra'), null, quebrado(ctx)).hookSpecificOutput.additionalContext, /designer/);
  });
  it('a foto do começo que falha não herda a crítica do turno anterior', () => {
    const { ctx, estados, duble } = ctxDuble('f0');
    estados.set('s1', { ...INICIO, criticada: 'f0' });
    decidir(prompt('roda o gate'), null, quebrado(ctx));
    duble.foto = 'f1';
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('a foto do começo que falha grava o estado inerte, não o cobrado velho', () => {
    const { ctx, estados } = ctxDuble('f0');
    estados.set('s1', { ...INICIO, cobrado: true });
    decidir(prompt('roda o gate'), null, quebrado(ctx));
    assert.deepEqual(estados.get('s1'), { versao: 1, raiz: null, foto: null, criticada: null, cobrado: true });
  });
  it('visual mudou e o crítico não rodou: cobra uma vez, e a segunda parada passa', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    assert.equal(falha(decidir(parar(), null, ctx)), true);
    assert.equal(estados.get('s1').cobrado, true);
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('com stop_hook_active, não cobra', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    assert.equal(decidir(parar(true), null, ctx), null);
  });
  it('descartou todo o trabalho visual: foto vazia, passa', () => {
    const { ctx, estados } = ctxDuble({ foto: 'vazia', vazia: true });
    estados.set('s1', { ...INICIO });
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('o Stop rodou noutro worktree: não cobra', () => {
    const { ctx, estados } = ctxDuble({ foto: 'f1', raiz: '/outro-worktree' });
    estados.set('s1', { ...INICIO });
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('estado gravado por outra versão da guarda: não cobra', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { versao: 0, raiz: RAIZ, foto: 'f0', criticada: null, cobrado: false });
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('a skill do crítico no mesmo contexto não livra da cobrança', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    decidir(usar('Skill', { skill: 'critica-de-ui' }), null, ctx);
    assert.equal(falha(decidir(parar(), null, ctx)), true);
  });
  it('o crítico em background livra: ele roda depois, em contexto separado', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    decidir(usar('Agent', { subagent_type: 'design:critico-de-ui', run_in_background: true }, { status: 'async_launched' }), null, ctx);
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('visual mudou e o crítico rodou: passa, e a crítica guarda a foto que viu', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    decidir(usar('Agent', { subagent_type: 'critico-de-ui' }), null, ctx);
    assert.equal(estados.get('s1').criticada, 'f1');
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('crítico antes da edição (revisa e implementa): a mudança depois dele é cobrada', () => {
    const { ctx, estados, duble } = ctxDuble('f0');
    estados.set('s1', { ...INICIO });
    decidir(usar('Agent', { subagent_type: 'critico-de-ui' }), null, ctx);
    assert.equal(estados.get('s1').criticada, 'f0');
    duble.foto = 'f1';
    const c = decidir(parar(), null, ctx);
    assert.equal(falha(c), true);
    assert.match(c.reason, /depois da crítica/);
  });
  it('crítico chamado de novo depois da edição: passa', () => {
    const { ctx, estados, duble } = ctxDuble('f0');
    estados.set('s1', { ...INICIO });
    decidir(usar('Agent', { subagent_type: 'critico-de-ui' }), null, ctx);
    duble.foto = 'f1';
    decidir(usar('Agent', { subagent_type: 'critico-de-ui' }), null, ctx);
    assert.equal(estados.get('s1').criticada, 'f1');
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('a foto da crítica que falha conta como crítica: erro não prende', () => {
    const { ctx, estados } = ctxDuble('f1');
    estados.set('s1', { ...INICIO });
    decidir(usar('Agent', { subagent_type: 'critico-de-ui' }), null, quebrado(ctx));
    assert.equal(estados.get('s1').criticada, 'sem-foto');
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('visual igual à foto: passa sem cobrar', () => {
    const { ctx, estados } = ctxDuble();
    estados.set('s1', { ...INICIO });
    assert.equal(decidir(parar(), null, ctx), null);
  });
  it('sem estado (hook instalado no meio do turno): passa', () => {
    const { ctx } = ctxDuble('f1');
    assert.equal(decidir(parar(), null, ctx), null);
  });
});

describe('fotoDoVisual — cada gesto do git, num repositório sintético', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-design-git-')));
  const outro = `${base}-tronco`;
  const gravar = (rel, texto) => { mkdirSync(join(base, rel, '..'), { recursive: true }); writeFileSync(join(base, rel), texto); };
  const linhas = (n, troca = {}) => `${Array.from({ length: n }, (_, i) => troca[i] ?? `linha ${i}`).join('\n')}\n`;
  const TELA = 'apps/web/src/components/ui/button.tsx';
  const OUTRA = 'apps/web/src/components/ui/card.tsx';
  const foto = () => fotoDoVisual(base, CONFIG);
  const troncoAnda = (troca) => {
    writeFileSync(join(outro, TELA), linhas(40, troca));
    writeFileSync(join(outro, OUTRA), `export const c = ${Object.keys(troca).length};\n`);
    sh(outro, 'commit', '-qam', 'outro PR');
    sh(base, 'update-ref', 'refs/remotes/origin/develop', 'develop');
  };
  after(() => { rmSync(outro, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); });

  sh(base, 'init', '-q', '-b', 'develop');
  sh(base, 'config', 'user.email', 't@t');
  sh(base, 'config', 'user.name', 't');
  gravar(TELA, linhas(40));
  gravar(OUTRA, 'export const c = 0;\n');
  gravar('docs/x.md', 'doc\n');
  sh(base, 'add', '-A');
  sh(base, 'commit', '-qm', 'base');
  sh(base, 'update-ref', 'refs/remotes/origin/develop', 'HEAD');
  sh(base, 'checkout', '-qb', 'trabalho');
  sh(base, 'worktree', 'add', '-q', outro, 'develop');

  it('a precondição: sem trabalho próprio a foto é vazia e estável', () => {
    assert.match(foto().hash, /^[0-9a-f]{64}$/);
    assert.deepEqual(foto(), foto());
    assert.equal(foto().vazia, true);
  });
  it('doc e teste de tela não contam; tela conta', () => {
    gravar('docs/x.md', 'doc mudado\n');
    gravar('apps/web/src/components/ui/button.test.tsx', 'teste\n');
    assert.equal(foto().vazia, true);
    gravar(TELA, linhas(40, { 2: 'minha linha' }));
    assert.equal(foto().vazia, false);
  });
  it('commitar o que já estava sujo não muda a foto', () => {
    const suja = foto();
    assert.equal(suja.vazia, false);
    sh(base, 'add', '-A');
    sh(base, 'commit', '-qm', 'meu trabalho');
    assert.deepEqual(foto(), suja);
  });
  it('rebase sobre o tronco que andou não muda a foto', () => {
    const antes = foto();
    assert.equal(antes.vazia, false);
    troncoAnda({ 30: 'do outro PR' });
    sh(base, 'rebase', '-q', 'origin/develop');
    assert.equal(sh(base, 'log', '--oneline', 'origin/develop..HEAD').trim().split('\n').length, 1);
    assert.deepEqual(foto(), antes);
  });
  it('rebase com --autostash sobre tela suja não muda a foto', () => {
    gravar(TELA, linhas(40, { 2: 'minha linha', 5: 'suja' }));
    const antes = foto();
    assert.equal(antes.vazia, false);
    troncoAnda({ 30: 'do outro PR', 35: 'de novo' });
    sh(base, 'rebase', '-q', '--autostash', 'origin/develop');
    assert.deepEqual(foto(), antes);
  });
  it('merge do tronco não muda a foto', () => {
    sh(base, 'add', '-A');
    sh(base, 'commit', '-qm', 'mais trabalho');
    const antes = foto();
    assert.equal(antes.vazia, false);
    troncoAnda({ 30: 'do outro PR', 35: 'de novo', 38: 'e mais' });
    sh(base, 'merge', '-q', '--no-edit', 'origin/develop');
    assert.deepEqual(foto(), antes);
  });
  it('--amend com edição nova muda a foto', () => {
    const antes = foto();
    gravar(TELA, linhas(40, { 2: 'minha linha', 5: 'suja', 8: 'do amend', 30: 'do outro PR', 35: 'de novo', 38: 'e mais' }));
    sh(base, 'commit', '-q', '-a', '--amend', '--no-edit');
    assert.notEqual(foto().hash, antes.hash);
  });
  it('o git que estoura o prazo no merge-base é erro, não troca de régua', () => {
    const lento = (cwd, args) => {
      if (args[0] === 'merge-base') throw Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT', signal: 'SIGKILL' });
      return sh(cwd, ...args);
    };
    assert.throws(() => fotoDoVisual(base, CONFIG, lento), /ETIMEDOUT/);
  });
  it('sem base nenhuma, a régua é o HEAD', () => {
    const semBase = (cwd, args) => {
      if (args[0] === 'merge-base') throw Object.assign(new Error('not a valid object name'), { status: 128 });
      return sh(cwd, ...args);
    };
    assert.notEqual(sh(base, 'ls-files', 'apps/web/src').trim(), '');
    assert.equal(sh(base, 'status', '--porcelain', '--', 'apps/web/src').trim(), '');
    assert.equal(fotoDoVisual(base, CONFIG, semBase).vazia, true);
  });
  it('o tronco do kit.json vale como base: base declarada ausente cai na seguinte', () => {
    const c = { ...CONFIG, bases: ['origin/nao-existe', 'origin/develop'] };
    assert.equal(fotoDoVisual(base, c).vazia, foto().vazia);
    assert.equal(fotoDoVisual(base, c).hash, foto().hash);
  });
  it('o pedido ao git em prazo estourado não troca a pasta do estado', () => {
    const anterior = process.env.KIT_DESIGN_ESTADO;
    delete process.env.KIT_DESIGN_ESTADO;
    try {
      const lento = (cwd, args) => {
        if (args.includes('--git-common-dir')) throw Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT', signal: 'SIGKILL' });
        return sh(cwd, ...args);
      };
      assert.throws(() => criarContexto(gitMemoizado(lento)).gravar(base, 's-prazo', { versao: 1 }), /ETIMEDOUT/);
    } finally {
      if (anterior === undefined) delete process.env.KIT_DESIGN_ESTADO; else process.env.KIT_DESIGN_ESTADO = anterior;
    }
  });
  it('arquivo de tela novo, não rastreado, muda a foto', () => {
    const antes = foto();
    gravar('apps/web/src/components/ui/novo.tsx', 'export const n = 1;\n');
    assert.notEqual(foto().hash, antes.hash);
  });
  it('editar o conteúdo de uma tela não rastreada (edição de subagente) muda a foto', () => {
    const antes = foto();
    gravar('apps/web/src/components/ui/novo.tsx', 'export const n = 2;\n');
    assert.notEqual(foto().hash, antes.hash);
  });
});

describe('o hook de ponta a ponta: um projeto de rascunho com `design` no kit.json', () => {
  const proj = realpathSync(mkdtempSync(join(tmpdir(), 'kit-design-e2e-')));
  const estado = realpathSync(mkdtempSync(join(tmpdir(), 'kit-design-estado-')));
  after(() => { rmSync(proj, { recursive: true, force: true }); rmSync(estado, { recursive: true, force: true }); });
  const env = { ...process.env, KIT_DESIGN_ESTADO: estado };
  const hook = (evento) => {
    const r = spawnSync('node', [SCRIPT], { input: JSON.stringify({ session_id: 'e2e', cwd: proj, ...evento }), encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL', env });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  sh(proj, 'init', '-q', '-b', 'main');
  sh(proj, 'config', 'user.email', 't@t');
  sh(proj, 'config', 'user.name', 't');
  mkdirSync(join(proj, '.claude'), { recursive: true });
  writeFileSync(join(proj, '.claude', 'kit.json'), JSON.stringify({ design: { visual: ['web/src/**/*.tsx'] }, guarda: { tronco: 'origin/main' } }));
  writeFileSync(join(proj, 'README.md'), 'x\n');
  sh(proj, 'add', '-A');
  sh(proj, 'commit', '-qm', 'base');
  sh(proj, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  it('o Stop recusa uma vez a tela editada sem crítico, e o segundo passa', () => {
    assert.match(hook({ hook_event_name: 'UserPromptSubmit', prompt: 'cria uma tela' }).hookSpecificOutput.additionalContext, /designer/);
    mkdirSync(join(proj, 'web', 'src'), { recursive: true });
    writeFileSync(join(proj, 'web', 'src', 'Tela.tsx'), 'export const T = () => null;\n');
    const primeiro = hook({ hook_event_name: 'Stop' });
    console.log('Stop 1:', JSON.stringify(primeiro));
    assert.equal(primeiro?.decision, 'block');
    const segundo = hook({ hook_event_name: 'Stop' });
    console.log('Stop 2:', JSON.stringify(segundo));
    assert.equal(segundo, null);
  });
  it('o designer tem o Write em tela negado pelo script, e a revisão passa', () => {
    const w = (file_path) => hook({ hook_event_name: 'PreToolUse', tool_name: 'Write', agent_type: 'design:designer', tool_input: { file_path } });
    assert.equal(w(join(proj, 'web', 'src', 'Tela.tsx'))?.hookSpecificOutput?.permissionDecision, 'deny');
    assert.equal(w(join(proj, 'docs', 'design', 'revisoes', 'x.md')), null);
  });
  it('evento ilegível sai 0 sem decisão', () => {
    const r = spawnSync('node', [SCRIPT], { input: 'nao e json', encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL', env });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });
});

describe('os arquivos do plugin concordam entre si', () => {
  const ler = (rel) => readFileSync(join(PLUGIN, rel), 'utf-8');
  const frontmatter = (rel) => {
    const t = ler(rel);
    const fim = t.indexOf('\n---', 4);
    assert.ok(t.startsWith('---\n') && fim > 0, `${rel}: frontmatter ausente`);
    return t.slice(4, fim);
  };
  const campo = (fm, nome) => fm.match(new RegExp(`^${nome}: (.+)$`, 'm'))?.[1];

  it('os agents se chamam como o script os procura, e não carregam `hooks` (o plugin os ignora)', () => {
    for (const [arq, nome, skill] of [[`agents/${AGENTE_CRITICO}.md`, AGENTE_CRITICO, 'critica-de-ui'], [`agents/${PAPEL_DESIGNER}.md`, PAPEL_DESIGNER, 'revisao-de-arquitetura-de-ui']]) {
      const fm = frontmatter(arq);
      assert.equal(campo(fm, 'name'), nome);
      assert.ok(campo(fm, 'description')?.length > 20, `${arq}: sem description`);
      assert.doesNotMatch(fm, /^hooks:/m, `${arq}: hooks no frontmatter de agent de plugin são ignorados`);
      assert.match(fm, new RegExp(`^  - ${skill}$`, 'm'));
    }
  });
  it('o hooks.json registra os cinco eventos no script, com o matcher que a guarda precisa', () => {
    const h = JSON.parse(ler('hooks/hooks.json')).hooks;
    assert.deepEqual(Object.keys(h).sort(), ['PostToolUse', 'PreToolUse', 'Stop', 'SubagentStop', 'UserPromptSubmit']);
    for (const [ev, grupos] of Object.entries(h)) {
      assert.equal(grupos.length, 1, ev);
      assert.match(grupos[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/guarda-de-design\.mjs/);
    }
    assert.deepEqual(h.PostToolUse[0].matcher.split('|').sort(), ['Agent', 'Task']);
    assert.deepEqual(h.PreToolUse[0].matcher.split('|').sort(), ['Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
  });
  it('as skills têm name e description, e não citam o produto de origem', () => {
    for (const s of ['revisao-de-arquitetura-de-ui', 'critica-de-ui']) {
      const rel = `skills/${s}/SKILL.md`;
      const fm = frontmatter(rel);
      assert.equal(campo(fm, 'name'), s);
      assert.ok(campo(fm, 'description')?.length > 20);
      assert.doesNotMatch(ler(rel), /Izanagi|Wake|VTEX|apps\/web|packages\/shared/);
    }
    for (const a of ['designer', 'critico-de-ui']) assert.doesNotMatch(ler(`agents/${a}.md`), /Izanagi|Wake|VTEX|apps\/web/);
  });
  it('o teto da crítica (24/30, 2 recríticas) está nas duas skills e nos dois agents', () => {
    for (const rel of ['skills/critica-de-ui/SKILL.md', 'agents/critico-de-ui.md', 'agents/designer.md']) assert.match(ler(rel), /24/, rel);
    assert.match(ler('skills/critica-de-ui/SKILL.md'), /No máximo 2 recríticas/);
  });
  it('a skill de revisão manda ler os caminhos do kit.json (design.*)', () => {
    const t = ler('skills/revisao-de-arquitetura-de-ui/SKILL.md');
    for (const k of ['design.pasta', 'fontes', 'largura', 'revisoes']) assert.ok(t.includes(k), k);
    assert.match(t, /\.claude\/kit\.json/);
  });
  it('o marketplace lista o plugin com a pasta que existe', () => {
    const m = JSON.parse(readFileSync(join(PLUGIN, '..', '..', '.claude-plugin', 'marketplace.json'), 'utf-8'));
    const p = m.plugins.find((x) => x.name === 'design');
    assert.ok(p, 'design ausente do marketplace');
    assert.equal(p.source, './plugins/design');
    assert.equal(JSON.parse(ler('.claude-plugin/plugin.json')).name, 'design');
  });
});
