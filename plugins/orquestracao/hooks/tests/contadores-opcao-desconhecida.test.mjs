// F433: `proxima-pergunta` e `proximo-item` gravam o contador; argumento desconhecido (ex. `--help`) não pode gastar um ID.
// HOME é uma pasta temporária: nunca toca o ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const rodar = (nome, home, args) => spawnSync('bash', [join(SCRIPTS, nome), ...args], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home } });

for (const [nome, contadorRel, prefixo] of [['proxima-pergunta.sh', 'contador-de-perguntas', 'Q'], ['proximo-item.sh', 'pool/contador-de-itens', 'F']]) {
  test(`${nome}: argumento desconhecido sai 1 com o uso e não grava o contador; --help sai 0`, () => {
    const home = mkdtempSync(join(tmpdir(), 'contador-'));
    try {
      const dir = join(home, '.claude', 'orquestracao');
      mkdirSync(join(dir, 'pool'), { recursive: true });
      const cont = join(dir, contadorRel);
      writeFileSync(cont, '7\n');
      for (const arg of ['--help', '-h', 'lixo']) {
        const r = rodar(nome, home, [arg]);
        assert.equal(r.status, arg === 'lixo' ? 1 : 0, `${arg}: ${r.stderr}${r.stdout}`);
        assert.match(arg === 'lixo' ? r.stderr : r.stdout, /uso: /, `${arg}: ${r.stderr}${r.stdout}`);
        assert.equal(readFileSync(cont, 'utf8'), '7\n', `${arg}: o contador não pode mudar`);
      }
      const bad = rodar(nome, home, ['--ajuda']);
      assert.equal(bad.status, 1);
      assert.equal(readFileSync(cont, 'utf8'), '7\n');
      // precondição: sem argumento o script grava (o teste mede de verdade)
      const ok = rodar(nome, home, []);
      assert.equal(ok.status, 0, ok.stderr);
      assert.equal(ok.stdout.trim(), `${prefixo}8`);
      assert.ok(existsSync(cont));
    } finally { rmSync(home, { recursive: true, force: true }); }
  });
}
