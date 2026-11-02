// F318: o pedido é ponto de partida, não ordem. A regra mora numa seção do protocolo, e cada texto que a sessão lê
// (o resumo injetado no início, o manual da dona, o modelo de CLAUDE.md, o validador) a diz e aponta para ela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(HOOKS, '..');
const ler = (...p) => readFileSync(join(...p), 'utf8');
const ANCORA = 'analise-do-pedido';

const secaoDoProtocolo = () => {
  const m = new RegExp(`<a id="${ANCORA}"></a>\\n## [^\\n]+\\n([\\s\\S]*?)(?=\\n<a id=|$)`).exec(ler(PLUGIN, 'pool', 'protocolo.md'));
  return m?.[1] ?? '';
};

test('o protocolo tem a seção da análise do pedido com as partes da regra', () => {
  const secao = secaoDoProtocolo();
  assert.ok(secao.trim().length > 800, 'seção analise-do-pedido ausente ou curta');
  for (const frase of [
    'ponto de partida', 'premissa', 'Proporcional ao risco', 'Premissa conferida', 'errado ou arriscado',
    'Contraproposta', 'Recomendação', 'não invente', 'Discordar não é travar', 'assumida, a confirmar',
    'Discorda uma vez', 'salvo se for inseguro', 'briefing', 'Q-ID', '#nunca-travar', 'Por que não há trava',
  ]) assert.ok(secao.includes(frase), `a seção não diz "${frase}"`);
  // O que espera o operador é a mesma lista do "nunca travar" e do resumo: nada de "só o irreversível" sozinho.
  for (const frase of ['publica para fora', 'produção', 'gasta job']) assert.ok(secao.includes(frase), `a seção não diz "${frase}"`);
  const resumo = ler(HOOKS, 'regras-globais.md');
  assert.ok(resumo.includes('gasta job') && !/só o irreversível espera/.test(resumo), 'o resumo encurta a lista do que espera');
});

test('o resumo, a dona, o modelo de CLAUDE.md e o validador dizem a regra e apontam para a seção', () => {
  const textos = {
    resumo: ler(HOOKS, 'regras-globais.md'),
    dona: ler(PLUGIN, 'pool', 'dona.md'),
    modelo: ler(PLUGIN, '..', '..', 'modelos', 'CLAUDE.md'),
    validador: ler(PLUGIN, 'agents', 'validador.md'),
  };
  for (const [nome, t] of Object.entries(textos)) {
    assert.ok(t.length > 500, `insumo vazio: ${nome}`);
    assert.ok(t.includes(ANCORA), `${nome} não aponta para ${ANCORA}`);
    assert.match(t, /premissa/i, `${nome} não fala da premissa`);
  }
  for (const nome of ['resumo', 'modelo']) {
    for (const frase of ['ponto de partida', 'proporcional ao risco', 'contraproposta', 'uma vez', 'salvo o inseguro', 'regra do projeto']) {
      assert.ok(textos[nome].toLowerCase().includes(frase), `${nome} não diz "${frase}"`);
    }
  }
});

test('o modelo de CLAUDE.md leva a regra no bloco kit:regras-de-trabalho, que sobe de versão', () => {
  const modelo = ler(PLUGIN, '..', '..', 'modelos', 'CLAUDE.md');
  const b = /<!-- kit:regras-de-trabalho v(\d+) -->([\s\S]*?)<!-- \/kit:regras-de-trabalho -->/.exec(modelo);
  assert.ok(b, 'bloco ausente');
  assert.equal(b[1], '4');
  assert.ok(b[2].includes(ANCORA), 'a regra não está dentro do bloco');
});

test('o início de sessão injeta a regra (o hook real, com HOME temporário)', () => {
  const home = mkdtempSync(join(tmpdir(), 'analise-do-pedido-'));
  try {
    const env = { ...process.env, HOME: home, PAINEL_DIR: join(home, 'painel'), HOOKS_CREWAI_BASE: home };
    delete env.CLAUDE_CODE_HOST_SESSION_ID;
    const saida = execFileSync(process.execPath, [join(HOOKS, 'sessao-inicio.mjs')], {
      input: '{}', env, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL',
    });
    const contexto = JSON.parse(saida).hookSpecificOutput?.additionalContext ?? '';
    assert.ok(contexto.length > 500, 'o hook não injetou nada');
    assert.ok(contexto.includes('Regras do kit'), 'precondição: o resumo entrou');
    assert.ok(contexto.includes(ANCORA), 'o resumo injetado não traz a regra da análise do pedido');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
