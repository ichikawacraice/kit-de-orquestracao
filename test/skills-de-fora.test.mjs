// F333 (ADR 0014): o `kit doutor` diz o que ter (dependência faltando = falha, com o comando) e o que desligar (plugin de
// fora com skill barrada = aviso, com o que fica livre e como desligar). Tudo em HOME temporário.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { conferirSkillsDeFora, pluginsPresentes } from '../cli/skills-de-fora.mjs';
// F438 (ADR 0030): a casa do teste é a temporária; o CLAUDE_CONFIG_DIR de quem roda (o perfil do Orca) não vale aqui, nem nos filhos.
delete process.env.CLAUDE_CONFIG_DIR;

const catalogo = {
  plugins: [
    { plugin: 'superpowers', marketplace: 'claude-plugins-official', repositorioDoMarketplace: 'anthropics/claude-plugins-official', saida: 'depender', motivo: 'as fixas da dona' },
    { plugin: 'engineering', saida: 'livre', motivo: 'o resto não tem par' },
  ],
  skills: [
    { skill: 'engineering:architecture', saida: 'barrar', use: 'processos:spec-driven', motivo: 'ADR fora da regra' },
    { skill: 'engineering:code-review', saida: 'barrar', use: 'orquestracao:validador', motivo: 'revisão do kit' },
  ],
};

const escrever = (f, obj) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); };
// a dependência só vale ligada: a casa a liga em enabledPlugins, salvo `settings` próprio
function casa({ cli = [], app = [], appAntigo = [], entradas = {}, settings = { enabledPlugins: { 'superpowers@claude-plugins-official': true } } } = {}) {
  const h = mkdtempSync(join(tmpdir(), 'kit-skills-de-fora-'));
  escrever(join(h, '.claude', 'plugins', 'installed_plugins.json'), { version: 2, plugins: { ...Object.fromEntries(cli.map((id) => [id, [{ scope: 'user' }]])), ...entradas } });
  if (settings) escrever(join(h, '.claude', 'settings.json'), settings);
  const rpm = (sessao, nomes, quando) => {
    const r = join(h, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions', sessao, 'conta', 'rpm');
    escrever(join(r, 'manifest.json'), { plugins: nomes.map((n, i) => ({ id: `plugin_${i}`, displayName: n })) });
    nomes.forEach((n, i) => escrever(join(r, `plugin_${i}`, '.claude-plugin', 'plugin.json'), { name: n }));
    utimesSync(join(r, 'manifest.json'), quando, quando);
  };
  if (appAntigo.length) rpm('velha', appAntigo, new Date('2026-01-01'));
  if (app.length) rpm('nova', app, new Date('2026-11-01'));
  return h;
}

describe('pluginsPresentes', () => {
  it('junta os do CLI (installed_plugins) e os da conta do app (manifesto rpm mais recente), pelo nome do plugin', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'], app: ['engineering', 'data'], appAntigo: ['velho-removido'] });
    try {
      const p = pluginsPresentes(h);
      assert.ok(p.size > 0, 'insumo vazio');
      assert.deepEqual(p.get('superpowers'), [{ origem: 'cli', id: 'superpowers@claude-plugins-official' }]);
      assert.deepEqual(p.get('engineering'), [{ origem: 'app', id: 'engineering' }]);
      assert.ok(p.has('data'));
      assert.ok(!p.has('velho-removido'), 'o manifesto antigo de outra sessão não conta');
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('o plugin do marketplace do kit não conta como de fora, mesmo com o nome repetido (design)', () => {
    const h = casa({ cli: ['design@kit-de-orquestracao'], app: ['design'] });
    try {
      assert.deepEqual(pluginsPresentes(h).get('design'), [{ origem: 'app', id: 'design' }]);
      const soDoKit = casa({ cli: ['design@kit-de-orquestracao'] });
      try { assert.ok(!pluginsPresentes(soDoKit).has('design')); } finally { rmSync(soDoKit, { recursive: true, force: true }); }
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('sem nada instalado (ou HOME sem as pastas) devolve vazio, sem erro', () => {
    const h = mkdtempSync(join(tmpdir(), 'kit-skills-de-fora-'));
    try { assert.equal(pluginsPresentes(h).size, 0); } finally { rmSync(h, { recursive: true, force: true }); }
  });
});

describe('conferirSkillsDeFora', () => {
  it('dependência faltando é falha, com o comando de instalar', () => {
    const h = casa();
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo });
      assert.equal(r.falhas, 1);
      const linha = r.linhas.find((l) => l.startsWith('falha:'));
      assert.ok(linha, r.linhas.join('\n'));
      assert.match(linha, /superpowers/);
      assert.match(linha, /claude plugin install superpowers@claude-plugins-official/);
      assert.match(linha, /claude plugin marketplace add anthropics\/claude-plugins-official/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('superpowers de outro marketplace ou da conta do app não satisfaz a dependência: falha nomeando o id certo', () => {
    const h = casa({ cli: ['superpowers@outro-mkt'], app: ['superpowers'] });
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo });
      assert.equal(r.falhas, 1, r.linhas.join('\n'));
      const linha = r.linhas.find((l) => l.startsWith('falha:'));
      assert.match(linha, /superpowers@claude-plugins-official não instalado/);
      assert.match(linha, /superpowers@outro-mkt, o da conta do app não conta/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('dependência instalada sem entrada em enabledPlugins conta como desligada (o Claude Code não a carrega)', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'], settings: {} });
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo });
      assert.equal(r.falhas, 1, r.linhas.join('\n'));
      assert.match(r.linhas.find((l) => l.startsWith('falha:')), /claude plugin enable superpowers@claude-plugins-official/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('dependência desligada em enabledPlugins é falha com o comando de ligar', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'], settings: { enabledPlugins: { 'superpowers@claude-plugins-official': false } } });
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo });
      assert.equal(r.falhas, 1, r.linhas.join('\n'));
      assert.match(r.linhas.find((l) => l.startsWith('falha:')), /desligado.*claude plugin enable superpowers@claude-plugins-official/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('dependência instalada só no escopo de outro projeto é falha; no escopo deste projeto é ok', () => {
    const h = casa({ entradas: { 'superpowers@claude-plugins-official': [{ scope: 'project', projectPath: '/outro/projeto' }] } });
    try {
      assert.equal(conferirSkillsDeFora({ home: h, catalogo, destino: '/este/projeto' }).falhas, 1);
      assert.equal(conferirSkillsDeFora({ home: h, catalogo, destino: '/outro/projeto' }).falhas, 0);
      assert.equal(conferirSkillsDeFora({ home: h, catalogo, destino: '/outro/projeto/apps/web' }).falhas, 0, 'subpasta do projeto conta');
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('dependência presente é ok; plugin com skill barrada vira aviso com o que barra, o que usar e como desligar pelo app', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'], app: ['engineering'] });
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo });
      assert.equal(r.falhas, 0, r.linhas.join('\n'));
      assert.ok(r.linhas.some((l) => l.startsWith('ok:') && l.includes('superpowers')), r.linhas.join('\n'));
      const aviso = r.linhas.find((l) => l.startsWith('aviso:') && l.includes('engineering'));
      assert.ok(aviso, r.linhas.join('\n'));
      assert.match(aviso, /engineering:architecture → processos:spec-driven/);
      assert.match(aviso, /engineering:code-review → orquestracao:validador/);
      assert.match(aviso, /no app/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('o plugin de fora instalado pelo CLI ganha o comando de desligar só para a pessoa, neste projeto (scope local)', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official', 'engineering@knowledge-work-plugins'] });
    try {
      const aviso = conferirSkillsDeFora({ home: h, catalogo }).linhas.find((l) => l.startsWith('aviso:') && l.includes('engineering'));
      assert.ok(aviso);
      assert.match(aviso, /claude plugin disable engineering@knowledge-work-plugins --scope local/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('skill barrada de uma dependência é info, não aviso: não há o que desligar', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'] });
    try {
      const cat = { ...catalogo, skills: [...catalogo.skills, { skill: 'superpowers:requesting-code-review', saida: 'barrar', use: 'orquestracao:validador', motivo: 'revisão do kit' }] };
      const r = conferirSkillsDeFora({ home: h, catalogo: cat });
      assert.ok(r.linhas.some((l) => l.startsWith('info:') && l.includes('superpowers:requesting-code-review')), r.linhas.join('\n'));
      assert.ok(!r.linhas.some((l) => l.startsWith('aviso:')), r.linhas.join('\n'));
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('plugin de fora sem skill barrada não gera aviso (o kit não opina sobre o livre)', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official'], app: ['data'] });
    try {
      const r = conferirSkillsDeFora({ home: h, catalogo: { ...catalogo, plugins: [...catalogo.plugins, { plugin: 'data', saida: 'livre', motivo: 'fora do escopo' }] } });
      assert.ok(!r.linhas.some((l) => l.includes('data')), r.linhas.join('\n'));
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  // F348: o ponytail injeta texto por hook em toda sessão, por fora da trava; ligado num projeto com o kit, o doutor avisa.
  const comHooks = { ...catalogo, plugins: [...catalogo.plugins, { plugin: 'ponytail', marketplace: 'ponytail', saida: 'livre', motivo: 'absorvido', hooks: 'os hooks SessionStart e SubagentStart passam por fora da trava.' }] };
  const SP = { 'superpowers@claude-plugins-official': true };

  it('plugin com hooks ligado: aviso que explica os hooks e como desligar', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official', 'ponytail@ponytail'], settings: { enabledPlugins: { ...SP, 'ponytail@ponytail': true } } });
    try {
      const aviso = conferirSkillsDeFora({ home: h, catalogo: comHooks }).linhas.find((l) => l.startsWith('aviso:') && l.includes('ponytail'));
      assert.ok(aviso, 'o aviso existe');
      assert.match(aviso, /ligado num projeto com o kit: os hooks SessionStart e SubagentStart passam por fora da trava\./);
      assert.match(aviso, /claude plugin disable ponytail@ponytail --scope local/);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('plugin com hooks instalado e desligado (a camada do projeto vence a da conta): sem aviso de hooks', () => {
    const h = casa({ cli: ['superpowers@claude-plugins-official', 'ponytail@ponytail'], settings: { enabledPlugins: { ...SP, 'ponytail@ponytail': true } } });
    try {
      const ligado = conferirSkillsDeFora({ home: h, catalogo: comHooks, configs: [{ enabledPlugins: { ...SP, 'ponytail@ponytail': true } }] }).linhas;
      assert.ok(ligado.some((l) => l.includes('ligado num projeto com o kit')), 'com a camada ligada, o aviso aparece');
      const r = conferirSkillsDeFora({ home: h, catalogo: comHooks, configs: [{ enabledPlugins: { ...SP, 'ponytail@ponytail': true } }, { enabledPlugins: { 'ponytail@ponytail': false } }] });
      assert.ok(!r.linhas.some((l) => l.includes('ligado num projeto com o kit')), r.linhas.join('\n'));
    } finally { rmSync(h, { recursive: true, force: true }); }
  });

  it('o catálogo real barra o ponytail-review, dá a escada como absorvida e explica os hooks do ponytail', async () => {
    const { readFileSync } = await import('node:fs');
    const real = JSON.parse(readFileSync(new URL('../plugins/orquestracao/skills-de-fora.json', import.meta.url), 'utf8'));
    const p = real.plugins.find((x) => x.plugin === 'ponytail');
    assert.ok(p && p.saida === 'livre' && /SessionStart/.test(p.hooks ?? ''), 'o plugin, livre, com os hooks');
    assert.equal(real.skills.find((s) => s.skill === 'ponytail:ponytail-review')?.saida, 'barrar');
    const esc = real.skills.find((s) => s.skill === 'ponytail:ponytail');
    assert.equal(esc?.saida, 'absorver');
    assert.equal(esc?.feito, true);
    const prot = readFileSync(new URL('../plugins/orquestracao/pool/protocolo.md', import.meta.url), 'utf8');
    assert.match(prot, /<a id="menor-diff"><\/a>[\s\S]{0,300}ponytail[\s\S]{0,120}MIT, Dietrich Gebert/, 'a absorção feita existe, com o crédito');
  });

  it('o catálogo real do plugin carrega e dá ao menos uma linha', () => {
    const h = casa();
    try {
      const r = conferirSkillsDeFora({ home: h });
      assert.ok(r.linhas.length > 0);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });
});
