// F438 (ADR 0030, fatia 0): os testes não herdam a pasta de configuração de quem os roda. Dentro do Orca, `CLAUDE_CONFIG_DIR`
// aponta para o perfil dele, e os testes que montam uma casa temporária (HOME) liam as opções e os plugins do perfil real em
// vez da casa do teste. Aqui cada arquivo que lia essa pasta roda de novo com a variável apontando para outro lugar, e passa.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Os arquivos que falhavam dentro do Orca (14 testes em 05/11) por ler `CLAUDE_CONFIG_DIR` do processo pai.
const ARQUIVOS = [
  'test/design-system-sucede.test.mjs',
  'test/opcoes-do-plugin.test.mjs',
  'test/processos.test.mjs',
  'test/skills-de-fora.test.mjs',
  'plugins/orquestracao/hooks/tests/atualizar-plugins.test.mjs',
];

// Um perfil envenenado: existe e diz o contrário do que os testes montam na casa temporária, como o perfil do Orca de 05/11
// (todos os plugins do kit e o Impeccable instalados no escopo da conta e ligados). Herdado, ele troca o resultado.
const PLUGINS = ['orquestracao', 'painel-sessoes', 'processos', 'kit-design', 'kit-performance', 'design-system', 'tema-wicomm']
  .flatMap((p) => ['ichikawa-kit', 'kit-de-orquestracao'].map((m) => `${p}@${m}`)).concat(['impeccable@impeccable', 'superpowers@claude-plugins-official']);
function perfilEnvenenado() {
  const dir = mkdtempSync(join(tmpdir(), 'perfil-alheio-'));
  const plugins = {};
  for (const id of PLUGINS) {
    const instalado = join(dir, 'plugins', 'cache', id.replace('@', '-'));
    mkdirSync(join(instalado, '.claude-plugin'), { recursive: true });
    writeFileSync(join(instalado, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: id.split('@')[0], version: '9.9.9' }));
    plugins[id] = [{ scope: 'user', installPath: instalado, version: '9.9.9' }];
  }
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ enabledPlugins: Object.fromEntries(PLUGINS.map((id) => [id, true])) }));
  writeFileSync(join(dir, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }));
  return dir;
}

describe('os testes não herdam o CLAUDE_CONFIG_DIR do processo pai', () => {
  it('a lista de arquivos existe e não é vazia', () => {
    assert.ok(ARQUIVOS.length > 0);
    for (const a of ARQUIVOS) assert.ok(existsSync(join(RAIZ, a)), `${a} não existe`);
  });
  {
    for (const arquivo of ARQUIVOS) {
      it(`${arquivo} passa com o CLAUDE_CONFIG_DIR do pai apontando para um perfil alheio`, () => {
        // Sem o NODE_TEST_CONTEXT do runner pai: com ele, o `node --test` filho se comporta como subprocesso e sai 0 com falha.
        const { NODE_TEST_CONTEXT: _ctx, ...semContexto } = process.env;
        const dir = perfilEnvenenado();
        try {
          const r = spawnSync(process.execPath, ['--test', '--test-reporter=dot', join(RAIZ, arquivo)], {
            cwd: RAIZ, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: { ...semContexto, CLAUDE_CONFIG_DIR: dir },
          });
          assert.equal(r.status, 0, `${arquivo} falhou com CLAUDE_CONFIG_DIR=${dir}:\n${(r.stdout + r.stderr).slice(-3000)}`);
        } finally { rmSync(dir, { recursive: true, force: true }); }
      });
    }
  }
});
