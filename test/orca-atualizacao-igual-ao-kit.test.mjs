// F463: a aba do Orca refaz a conta do `pode-reiniciar` do kit (o plugin do Orca não importa do plugin do Claude). As duas têm de
// concordar: mesmo prazo do cache e mesma lista de plugins a baixar para o mesmo insumo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerInstalados, publicadoDoCache, paraBaixar, KIT_PUBLICADO_VALE_MS } from '../orca/painel-do-kit/src/nucleo/atualizacao.mjs';
import { lerParaBaixar, KIT_PUBLICADO_VALE_MS as VALE_DO_KIT } from '../plugins/orquestracao/skills/orquestradora/scripts/pode-reiniciar.mjs';

const AGORA = Date.parse('2026-11-06T17:00:00Z');

test('o prazo do cache da aba é o do kit', () => {
  assert.equal(KIT_PUBLICADO_VALE_MS, VALE_DO_KIT);
});

test('mesma conta que o lerParaBaixar do kit, para o mesmo insumo (o mapa e o kit concordam)', () => {
  const cache = { em: new Date(AGORA - 60_000).toISOString(), publicado: { orquestracao: '0.0.51', 'painel-sessoes': '0.8.4', processos: '0.3.0', 'kit-design': '0.4.2' } };
  const home = mkdtempSync(join(tmpdir(), 'f463-par-'));
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  const ent = (version) => [{ scope: 'user', version, lastUpdated: '2026-11-06T10:00:00Z' }];
  const plugins = { 'orquestracao@ichikawa-kit': ent('0.0.50'), 'painel-sessoes@ichikawa-kit': ent('0.8.4'), 'processos@ichikawa-kit': ent('0.2.9'), 'design@ichikawa-kit': ent('0.2.0') };
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }));
  const arquivo = join(home, 'kit-publicado.json');
  writeFileSync(arquivo, JSON.stringify(cache));
  const m = { home, cache: arquivo };
  const doKit = lerParaBaixar({ home: m.home, cache: m.cache, agoraMs: AGORA, env: {} });
  assert.ok(doKit.length === 3, 'o insumo tem de gerar atualização, senão a comparação não mede nada');
  assert.deepEqual(paraBaixar(lerInstalados(m.home), publicadoDoCache(m.cache)), doKit);
});

