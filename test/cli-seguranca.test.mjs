import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../gate/config.mjs';

// O CLI roda num repositório que a pessoa clonou: o que vem dele (link simbólico, `kit.json`, lock) não pode fazer o kit
// gravar ou apagar fora do projeto. Cada caso monta o ataque e confere o arquivo-alvo fora do projeto, não a mensagem.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const sha = (t) => createHash('sha256').update(t).digest('hex');

function cenario(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-seg-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const casa = join(base, 'casa'); const repo = join(base, 'code', 'repo'); const fora = join(base, 'fora');
  for (const d of [casa, repo, fora]) mkdirSync(d, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q'], { timeout: 10000, killSignal: 'SIGKILL' });
  writeFileSync(join(repo, 'CLAUDE.md'), '# P\n\n## Regras\n1. x\n');
  writeFileSync(join(repo, 'package.json'), '{"name":"p","private":true,"scripts":{"test":"node --test"}}\n');
  const kit = (...args) => spawnSync('node', [KIT, ...args], { cwd: repo, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, CI: '' } });
  return { base, casa, repo, fora, kit };
}

describe('o CLI não grava nem apaga fora do projeto', () => {
  it('adotar: `CLAUDE.md.kit-tmp` que é link (quebrado) para fora não cria o arquivo lá', (t) => {
    const c = cenario(t);
    const alvo = join(c.fora, '.zshenv');
    symlinkSync(alvo, join(c.repo, 'CLAUDE.md.kit-tmp'));
    c.kit('adotar');
    assert.equal(existsSync(alvo), false, 'o kit gravou através do link');
  });

  it('atualizar: `.kit-tmp` que é link para arquivo que existe fora não o sobrescreve', (t) => {
    const c = cenario(t);
    assert.equal(c.kit('adotar').status, 0);
    const alvo = join(c.fora, '.zprofile');
    writeFileSync(alvo, 'original\n');
    // um arquivo do gate que sumiu (e saiu do lock) o atualizar grava de novo, passando pelo `.kit-tmp`
    const lock = JSON.parse(readFileSync(join(c.repo, '.claude', 'kit.lock.json'), 'utf8'));
    const rel = Object.keys(lock.arquivos).find((r) => r.startsWith('scripts/kit/'));
    assert.ok(rel, 'o adotar não registrou arquivo do gate');
    delete lock.arquivos[rel]; rmSync(join(c.repo, rel));
    writeFileSync(join(c.repo, '.claude', 'kit.lock.json'), JSON.stringify(lock));
    symlinkSync(alvo, join(c.repo, `${rel}.kit-tmp`));
    c.kit('atualizar');
    assert.equal(readFileSync(alvo, 'utf8'), 'original\n', 'o kit sobrescreveu o arquivo de fora');
  });

  it('remover: `gate.verdeDir` com `..` no kit.json não apaga a pasta de fora', (t) => {
    const c = cenario(t);
    assert.equal(c.kit('adotar').status, 0);
    const vitima = join(c.base, 'code', 'vitima');
    mkdirSync(vitima); writeFileSync(join(vitima, 'dado'), 'x');
    const k = JSON.parse(readFileSync(join(c.repo, '.claude', 'kit.json'), 'utf8'));
    k.gate = { ...(k.gate ?? {}), verdeDir: '../../vitima' };
    writeFileSync(join(c.repo, '.claude', 'kit.json'), JSON.stringify(k));
    c.kit('remover');
    assert.ok(existsSync(join(vitima, 'dado')), 'o remover apagou a pasta de fora');
  });

  it('o kit.json recusa trava e verde que não são um nome simples', () => {
    for (const campo of ['verdeDir', 'trava', 'travaConserto']) {
      for (const ruim of ['../x', 'a/b', '/abs', '..', '.']) {
        assert.throws(() => carregarConfig('/nao-existe', { gate: { [campo]: ruim } }), new RegExp(`gate\\.${campo}`), `${campo}=${ruim}`);
      }
      assert.doesNotThrow(() => carregarConfig('/nao-existe', { gate: { [campo]: 'kit-x.trava' } }));
    }
  });

  it('remover: `.claude/settings.json` que é link para fora não edita o arquivo de fora', (t) => {
    const c = cenario(t);
    assert.equal(c.kit('adotar').status, 0);
    const alvo = join(c.fora, 'settings.json');
    const original = '{"enabledPlugins":{"seguranca@x":true},"extraKnownMarketplaces":{"meu":{}},"permissions":{}}\n';
    writeFileSync(alvo, original);
    rmSync(join(c.repo, '.claude', 'settings.json'));
    symlinkSync(alvo, join(c.repo, '.claude', 'settings.json'));
    const lock = JSON.parse(readFileSync(join(c.repo, '.claude', 'kit.lock.json'), 'utf8'));
    lock.chaves.settings = { ...lock.chaves.settings, plugins: ['seguranca@x'], marketplaces: ['meu'] };
    writeFileSync(join(c.repo, '.claude', 'kit.lock.json'), JSON.stringify(lock));
    c.kit('remover');
    assert.equal(readFileSync(alvo, 'utf8'), original, 'o remover editou o settings de fora pelo link');
  });

  it('remover: caminho do lock com `..` não apaga arquivo de fora', (t) => {
    const c = cenario(t);
    assert.equal(c.kit('adotar').status, 0);
    const alvo = join(c.base, 'code', 'vazio-do-usuario');
    writeFileSync(alvo, '');
    const lock = JSON.parse(readFileSync(join(c.repo, '.claude', 'kit.lock.json'), 'utf8'));
    lock.arquivos['../vazio-do-usuario'] = sha('');
    lock.pastasCriadas = [...(lock.pastasCriadas ?? []), '../pasta-vazia'];
    mkdirSync(join(c.base, 'code', 'pasta-vazia'));
    writeFileSync(join(c.repo, '.claude', 'kit.lock.json'), JSON.stringify(lock));
    c.kit('remover');
    assert.ok(existsSync(alvo), 'o remover apagou o arquivo de fora');
    assert.ok(existsSync(join(c.base, 'code', 'pasta-vazia')), 'o remover apagou a pasta de fora');
  });

  it('o link que fica dentro do projeto (CLAUDE.md -> AGENTS.md) segue valendo: o kit grava no alvo e o link fica', (t) => {
    const c = cenario(t);
    writeFileSync(join(c.repo, 'AGENTS.md'), readFileSync(join(c.repo, 'CLAUDE.md'), 'utf8'));
    rmSync(join(c.repo, 'CLAUDE.md'));
    symlinkSync('AGENTS.md', join(c.repo, 'CLAUDE.md'));
    const r = c.kit('adotar');
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(lstatSync(join(c.repo, 'CLAUDE.md')).isSymbolicLink(), 'o kit trocou o link por arquivo');
    assert.match(readFileSync(join(c.repo, 'AGENTS.md'), 'utf8'), /<!-- kit:/, 'os blocos não foram para o alvo do link');
    const rem = c.kit('remover');
    assert.equal(rem.status, 0, rem.stderr + rem.stdout);
  });

  it('remover: a linha da trava do operador que o lock nomeia só sai se for o git dir deste projeto', (t) => {
    const c = cenario(t);
    const base = join(c.casa, '.claude', 'orquestracao');
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'trava-edicao-repos.txt'), '/outro/repo/.git\n');
    assert.equal(c.kit('adotar').status, 0);
    const lista = () => readFileSync(join(base, 'trava-edicao-repos.txt'), 'utf8').split('\n').filter(Boolean);
    assert.ok(lista().length === 2 && lista().includes('/outro/repo/.git'), `precondição: o adotar pôs este projeto na trava: ${lista()}`);
    const lock = JSON.parse(readFileSync(join(c.repo, '.claude', 'kit.lock.json'), 'utf8'));
    lock.operador.trava = { linha: '/outro/repo/.git', adicionou: true };
    writeFileSync(join(c.repo, '.claude', 'kit.lock.json'), JSON.stringify(lock));
    c.kit('remover');
    assert.ok(lista().includes('/outro/repo/.git'), 'o lock tirou outro repositório da trava');
  });
});
