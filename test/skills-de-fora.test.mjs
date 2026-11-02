// F333 (ADR 0014): o `kit doutor` diz o que ter (dependência faltando = falha, com o comando) e o que desligar (plugin de
// fora com skill barrada = aviso, com o que fica livre e como desligar). Tudo em HOME temporário.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { conferirSkillsDeFora, pluginsPresentes } from '../cli/skills-de-fora.mjs';

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
function casa({ cli = [], app = [], appAntigo = [] } = {}) {
  const h = mkdtempSync(join(tmpdir(), 'kit-skills-de-fora-'));
  escrever(join(h, '.claude', 'plugins', 'installed_plugins.json'), { version: 2, plugins: Object.fromEntries(cli.map((id) => [id, [{ scope: 'user' }]])) });
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

  it('o catálogo real do plugin carrega e dá ao menos uma linha', () => {
    const h = casa();
    try {
      const r = conferirSkillsDeFora({ home: h });
      assert.ok(r.linhas.length > 0);
    } finally { rmSync(h, { recursive: true, force: true }); }
  });
});
